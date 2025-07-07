import { Filter, ObjectId } from "mongodb";
import { ConstraintPropertyCategoryEnum, ConstraintTypesEnum, DBCollectionTypeEnum, ConstraintChangeActionEnum, C2C_ROW_RETRIEVAL_BATCH_SIZE, C2C_ROW_ALLCOLUMN_SLOT_NAME, InterfaceInitTypeEnum, IFACE_COPY_RULEAREA_MAPPING, IFACE_COPY_LAYERGROUP_MAPPING, IFACE_COPY_NETCLASS_MAPPING, DataMappingTypeEnum, LINKAGE_ALL_RULEAREA_INDICATOR } from "../Models/Constants";
import { BasicKVP, BasicProperty, ConstraintConfExportContext, ConstraintValues, PropertyItem, User } from "../Models/HelperModels";
import { C2CRow, C2CRowSlot, G2GRelationContext, Interface, LayerGroup, LayerGroupConstraints, LayerGroupSet, LinkageInfo, Netclass, PackageLayout, Project, RuleArea } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { getEnumValuesAsArray, groupBy, isNumber, rfdcCopy, splitByDelimiters } from "./UtilFunctions";
import { updateProjectClearanceRelationBrands } from "./ProjectLogic";
import { sort } from 'fast-sort';
import { getNetclassToChannelNameMapping, saveLatestChangeTrackingVersionsForCollection } from "./BasicCommonLogic";
import { getClassRelationLayout, getClassRelationNameElementsForInterface, updateC2CRow } from "./NetClassificationLogic";




export async function performConstraintsAssessmentForRuleAreaAction(projectId: string, actionType: ConstraintChangeActionEnum.RULEAREA_ADDITION|ConstraintChangeActionEnum.RULEAREA_REMOVAL, actionRuleAreas: RuleArea[]) {
	await performLgcChurn(projectId, actionType, actionRuleAreas, null, null, null)
	await performC2CRowChurn(projectId, actionType, actionRuleAreas, null, null)
}
export async function performConstraintsAssessmentForNetclassAction(projectId: string, actionType: ConstraintChangeActionEnum.NETCLASS_ADDITION|ConstraintChangeActionEnum.NETCLASS_REMOVAL, actionNetclasses: Netclass[]) {
	await performLgcChurn(projectId, actionType, null, actionNetclasses, null, null)
	await performC2CRowChurn(projectId, actionType, null, actionNetclasses, null)
}
export async function performConstraintsAssessmentForLayerGroupAction(projectId: string, actionType: ConstraintChangeActionEnum.LAYER_GROUP_ADDITION|ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, actionLayerGroups: LayerGroup[]) {
	await performLgcChurn(projectId, actionType, null, null, actionLayerGroups, null)
}
export async function performConstraintsAssessmentForClrRelationAction(projectId: string, actionType: ConstraintChangeActionEnum.CLEARANCE_RELATION_ADDITION|ConstraintChangeActionEnum.CLEARANCE_RELATION_REMOVAL, actionClrRelations: BasicProperty[]|null) {
	await performLgcChurn(projectId, actionType, null, null, null, actionClrRelations)
	await performC2CRowChurn(projectId, actionType, null, null, actionClrRelations)
}



async function performLgcChurn(projectId: string, actionType: ConstraintChangeActionEnum, actionRuleAreas: RuleArea[]|null, actionNetclasses: Netclass[]|null, actionLayerGroups: LayerGroup[]|null, actionClrRelations: BasicProperty[]|null) {
	try {
		if(!projectId || projectId.trim().length === 0 || projectId.toLowerCase() === "undefined" ){
        	throw new Error(`Invalid projectId was provided.`)
		}
		if(!actionRuleAreas && !actionNetclasses && !actionLayerGroups && !actionClrRelations) {
			throw new Error(`Invalid contextual information was provided. ActionType: ${actionType}`)
		}

		let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
		let pkg = await pkgRepo.GetOneByProjectID(projectId)
		if(!pkg) { throw new Error(`Failed to retrieve valid layout info.`) }

		let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
		let lgcList = await lgcRepo.GetAllByProjectID(projectId) ?? []
		let groupByOwnerElementMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId)
		let addActions = [ConstraintChangeActionEnum.RULEAREA_ADDITION, ConstraintChangeActionEnum.NETCLASS_ADDITION,
			ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, ConstraintChangeActionEnum.CLEARANCE_RELATION_ADDITION];

		let lgcItemsToAdd = new Array<LayerGroupConstraints>();
		let lgcItemsToDelete = new Array<LayerGroupConstraints>();

		let projectNetclasses : Netclass[] = [];
		let clrRelationElements : BasicProperty[] = []
		let physConstrProps: PropertyItem[] = [];
		let clearanceConstrProps: PropertyItem[] = [];
		let layerGroupMapping = new Map<string, LayerGroup>()

		if(addActions.includes(actionType)) {
			let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
			projectNetclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []
	
			let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
			let project = await projRepo.GetWithId(projectId);
			
			//get all clearance relations for the project
			clrRelationElements = project.clearanceRelationBrands ?? []

			//get all layer groups for the project
			for(let lgSet of pkg.layerGroupSets) {
				for (let lg of lgSet.layerGroups) {
					layerGroupMapping.set(lg.id, lg)
				}
			}

			//get all physical rule properties as configured
			physConstrProps = project.constraintSettings?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase())
			if(!physConstrProps || physConstrProps.length === 0) {
				throw new Error(`Physical constraint settings were not found in config mgmt system! Please check configuration system! ORG: '${project.org}'`);
			}
			for(let physProp of physConstrProps) {
				let initValue : ConstraintValues = { id: crypto.randomUUID(), configValue: physProp.value, defautlValue: '', customValue: '' };
				physProp.value = initValue;
				physProp.contextProperties = []; //remove configured contextproperties, they are not needed in DB
			}
			
			//get all clearance rule properties as configured
			clearanceConstrProps = project.constraintSettings?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase())
			if(!clearanceConstrProps || clearanceConstrProps.length === 0) {
				throw new Error(`Clearance constraint settings were not found in config mgmt system! Please check configuration system! ORG: '${project.org}'`);
			}
			for(let clrProp of clearanceConstrProps) {
				let initValue : ConstraintValues = { id: crypto.randomUUID(), configValue: clrProp.value, defautlValue: '', customValue: '' };
				clrProp.value = initValue;
				clrProp.contextProperties = []; //remove configured contextproperties, they are not needed in DB
			}
		}


		//Addition processes----------------------------------------------
		if(actionType === ConstraintChangeActionEnum.RULEAREA_ADDITION) {
			if(actionRuleAreas && actionRuleAreas.length > 0) {
				for (let ruleArea of actionRuleAreas) {
					if(layerGroupMapping.size > 0) {
						for (let lgId of layerGroupMapping.keys()) {
							for (let netclass of projectNetclasses) {
								let ncId = netclass._id?.toString() as string;
								let hasPhyLgcElement = groupByOwnerElementMap.has(ncId) && (groupByOwnerElementMap.get(ncId) as LayerGroupConstraints[]).some(a => a.ruleAreaId === ruleArea.id && a.layerGroupId === lgId)
								if(hasPhyLgcElement === false) {
									let lgc : LayerGroupConstraints = {
										projectId: projectId,
										snapshotSourceId: "",
										contextProperties: [],
										lastUpdatedOn: new Date(),
										ownerElementId: ncId,
										ruleAreaId: ruleArea.id,
										layerGroupId: lgId,
										constraintType: ConstraintTypesEnum.Physical,
										associatedProperties: physConstrProps,
									}
									lgcItemsToAdd.push(lgc);
								}
							}

							for(let clrRelation of clrRelationElements) {
								let hasClrLgcElement = groupByOwnerElementMap.has(clrRelation.id) && (groupByOwnerElementMap.get(clrRelation.id) as LayerGroupConstraints[]).some(a => a.ruleAreaId === ruleArea.id && a.layerGroupId === lgId)
								if(hasClrLgcElement === false) {
									let lgc : LayerGroupConstraints = {
										projectId: projectId,
										snapshotSourceId: "",
										contextProperties: [],
										lastUpdatedOn: new Date(),
										ownerElementId: clrRelation.id,
										ruleAreaId: ruleArea.id,
										layerGroupId: lgId,
										constraintType: ConstraintTypesEnum.Clearance,
										associatedProperties: clearanceConstrProps,
									}
									lgcItemsToAdd.push(lgc);
								}
							}
						}
					}
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.LAYER_GROUP_ADDITION) {
			if(actionLayerGroups && actionLayerGroups.length > 0) {
				for (let ruleArea of pkg.ruleAreas) {
					for (let layerGroup of actionLayerGroups) {
						for (let netclass of projectNetclasses) {
							let ncId = netclass._id?.toString() as string;
							let hasPhyLgcElement = groupByOwnerElementMap.has(ncId) && (groupByOwnerElementMap.get(ncId) as LayerGroupConstraints[]).some(a => a.ruleAreaId === ruleArea.id && a.layerGroupId === layerGroup.id)
							if(hasPhyLgcElement === false) {
								let lgc : LayerGroupConstraints = {
									projectId: projectId,
									snapshotSourceId: "",
									contextProperties: [],
									lastUpdatedOn: new Date(),
									ownerElementId: ncId,
									ruleAreaId: ruleArea.id,
									layerGroupId: layerGroup.id,
									constraintType: ConstraintTypesEnum.Physical,
									associatedProperties: physConstrProps,
								}
								lgcItemsToAdd.push(lgc);
							}
						}

						for(let clrRelation of clrRelationElements) {
							let hasClrLgcElement = groupByOwnerElementMap.has(clrRelation.id) && (groupByOwnerElementMap.get(clrRelation.id) as LayerGroupConstraints[]).some(a => a.ruleAreaId === ruleArea.id && a.layerGroupId === layerGroup.id)
							if(hasClrLgcElement === false) {
								let lgc : LayerGroupConstraints = {
									projectId: projectId,
									snapshotSourceId: "",
									contextProperties: [],
									lastUpdatedOn: new Date(),
									ownerElementId: clrRelation.id,
									ruleAreaId: ruleArea.id,
									layerGroupId: layerGroup.id,
									constraintType: ConstraintTypesEnum.Clearance,
									associatedProperties: clearanceConstrProps,
								}
								lgcItemsToAdd.push(lgc);
							}
						}
					}
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.NETCLASS_ADDITION) {
			if(actionNetclasses && actionNetclasses.length > 0) {
				for (let ruleArea of pkg.ruleAreas) {
					if(layerGroupMapping.size > 0) {
						for (let lgId of layerGroupMapping.keys()) {
							for (let netclass of actionNetclasses) {
								let ncId = netclass._id?.toString() as string;
								if(groupByOwnerElementMap.has(ncId) === false) {
									let lgc : LayerGroupConstraints = {
										projectId: projectId,
										snapshotSourceId: "",
										contextProperties: [],
										lastUpdatedOn: new Date(),
										ownerElementId: ncId,
										ruleAreaId: ruleArea.id,
										layerGroupId: lgId,
										constraintType: ConstraintTypesEnum.Physical,
										associatedProperties: physConstrProps,
									}
									lgcItemsToAdd.push(lgc);
								}
							}
						}
					}
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.CLEARANCE_RELATION_ADDITION) {
			if(actionClrRelations && actionClrRelations.length > 0) {
				for (let ruleArea of pkg.ruleAreas) {
					if(layerGroupMapping.size > 0) {
						for (let lgId of layerGroupMapping.keys()) {
							for (let clrRel of actionClrRelations) {
								if(groupByOwnerElementMap.has(clrRel.id) === false) {
									let lgc : LayerGroupConstraints = {
										projectId: projectId,
										snapshotSourceId: "",
										contextProperties: [],
										lastUpdatedOn: new Date(),
										ownerElementId: clrRel.id,
										ruleAreaId: ruleArea.id,
										layerGroupId: lgId,
										constraintType: ConstraintTypesEnum.Clearance,
										associatedProperties: clearanceConstrProps,
									}
									lgcItemsToAdd.push(lgc);
								}
							}
						}
					}
				}
			}
		}

		//Removal processes-------------------------------------------------------------
		else if(actionType === ConstraintChangeActionEnum.RULEAREA_REMOVAL) {
			if(actionRuleAreas && actionRuleAreas.length > 0) {
				let remActionRAIds = actionRuleAreas.map(a => a.id);
				let remExistingLgcItems = lgcList.filter(a => remActionRAIds.includes(a.ruleAreaId));
				if(remExistingLgcItems && remExistingLgcItems.length > 0) {
					remExistingLgcItems.forEach(a => lgcItemsToDelete.push(a))
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL) {
			if(actionLayerGroups && actionLayerGroups.length > 0) {
				let remActionLGIds = actionLayerGroups.map(a => a.id);
				let remExistingLgcItems = lgcList.filter(a => remActionLGIds.includes(a.layerGroupId));
				if(remExistingLgcItems && remExistingLgcItems.length > 0) {
					remExistingLgcItems.forEach(a => lgcItemsToDelete.push(a))
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.NETCLASS_REMOVAL) {
			if(actionNetclasses && actionNetclasses.length > 0) {
				let remActionNCIds = actionNetclasses.map(a => a._id?.toString() as string);
				let remExistingLgcItems = lgcList.filter(a => remActionNCIds.includes(a.ownerElementId));
				if(remExistingLgcItems && remExistingLgcItems.length > 0) {
					remExistingLgcItems.forEach(a => lgcItemsToDelete.push(a))
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.CLEARANCE_RELATION_REMOVAL) {
			if(actionClrRelations && actionClrRelations.length > 0) {
				let remActionClrRelationIds = actionClrRelations.map(a => a.id);
				let remExistingLgcItems = lgcList.filter(a => remActionClrRelationIds.includes(a.ownerElementId));
				if(remExistingLgcItems && remExistingLgcItems.length > 0) {
					remExistingLgcItems.forEach(a => lgcItemsToDelete.push(a))
				}
			}
		}

		//roundup actions----------------------------------------------------
		if(lgcItemsToAdd.length > 0) {
			let result = await lgcRepo.CreateMany(lgcItemsToAdd)
			if(result.length !== lgcItemsToAdd.length) {
				throw new Error(`Failed to successfully CREATE constraint elements. ActionType: ${actionType}. `)
			}
		}

		if(lgcItemsToDelete.length > 0) {
			let idsToDel = lgcItemsToDelete.map(a => a._id?.toString() as string)
			let result = await lgcRepo.DeleteMany(idsToDel)
			if(result === false) {
				throw new Error(`Failed to successfully DELETE constraint elements. ActionType: ${actionType}. `)
			}
		}
	}
	catch(error: any) {
		throw new Error(`Could not complete constraint re-assessment process. ` + error.Message)
	}

}



async function performC2CRowChurn(projectId: string, actionType: ConstraintChangeActionEnum, actionRuleAreas: RuleArea[]|null, actionNetclasses: Netclass[]|null, actionClrRelations: BasicProperty[]|null) {
	try {
		let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
		
		let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
		let pkg = await pkgRepo.GetOneByProjectID(projectId)
		if(!pkg) { throw new Error(`Failed to retrieve valid layout info.`) }

		let addActions = [ConstraintChangeActionEnum.RULEAREA_ADDITION, ConstraintChangeActionEnum.NETCLASS_ADDITION];

		let c2cRowItemsToAdd: C2CRow[] = [];
		let emptySlotsForAllNetclasses : C2CRowSlot[] = [];
		let projectNetclasses: Netclass[] = [];
		let existingC2CRowsForActionNCs: C2CRow[] = [];
		let ncIdToNameMapping = new Map<string, string>();
		
		if(addActions.includes(actionType)) {
			//WARNING: In the case of netclass addition, the expectation is that the netclasses have already been created and added to DB before calling this function 
			let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
			projectNetclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []

			for(let nc of projectNetclasses) {
				ncIdToNameMapping.set(nc._id?.toString() as string, nc.name)
				let slot : C2CRowSlot = {
					id: crypto.randomUUID(),
					netclassId: nc._id?.toString() as string,
					assignmentType: DataMappingTypeEnum.Unmapped,
					name: "", //No! do not put the netclass name here!!
					value: ""
				};
				emptySlotsForAllNetclasses.push(slot);
			}

			//sorting is necessary prior to adding the 'ALL' slot
			emptySlotsForAllNetclasses = sort(emptySlotsForAllNetclasses).asc(a => (ncIdToNameMapping.get(a.netclassId) as string)?.toUpperCase());

			let initAllSlot : C2CRowSlot = {
				id: crypto.randomUUID(),
				netclassId: "",  //empty string intended! WARNING! There ARE ramifications to G2G processing if the ALL slot does not keep this field empty
				assignmentType: DataMappingTypeEnum.Unmapped,
				name: C2C_ROW_ALLCOLUMN_SLOT_NAME, //Allowed! This acts as a marker !!
				value: ""
			};
			emptySlotsForAllNetclasses = [initAllSlot, ...emptySlotsForAllNetclasses]

			//if dealing with a netclass situation, then get the relevant netclass info upfront to reduce expensiveness/time complexity
			if(actionNetclasses && actionNetclasses.length > 0) {
				const ncidStrList = actionNetclasses.map((x: Netclass) => x._id?.toString());
				let infilter = { netclassId: { $in: ncidStrList } as any } as Filter<C2CRow>;
				let projectionSpec = { projectId: 1, ruleAreaId: 1, netclassId: 1, lastUpdatedOn: 1 }
				existingC2CRowsForActionNCs = await c2crRepo.GetAllByProjectIDAndProjection(projectId, infilter, projectionSpec);
			}
		}

		if(actionType === ConstraintChangeActionEnum.RULEAREA_ADDITION) {
			if(actionRuleAreas && actionRuleAreas.length > 0) {
				for(let ruleArea of actionRuleAreas) {
					let filter = {ruleAreaId: ruleArea.id} as Filter<C2CRow>
					let c2crOne = await c2crRepo.GetAnyOne(projectId, filter); //not smart to get all items for a rule area. might be heavy
					if(!c2crOne) {
						for(let netclass of projectNetclasses) {
							let c2cRowEntry : C2CRow = {
								name: "",
								projectId: projectId,
								snapshotSourceId: "",
								contextProperties: [],
								lastUpdatedOn: new Date(),
								ruleAreaId: ruleArea.id,
								netclassId: netclass._id?.toString() as string,
								slots: emptySlotsForAllNetclasses,
								tags: [],
							}
							c2cRowItemsToAdd.push(c2cRowEntry)
						}
					}
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.NETCLASS_ADDITION) {
			if(actionNetclasses && actionNetclasses.length > 0) {
				const actionNCIDs = actionNetclasses.map((x: Netclass) => x._id?.toString());
				for(let ruleArea of pkg.ruleAreas) {
					for(let netclass of actionNetclasses) {
						let ncid = netclass._id?.toString() as string;
						let c2crOne = existingC2CRowsForActionNCs.find(a => (a.ruleAreaId === ruleArea.id && a.netclassId === ncid))
						if(!c2crOne) {
							let c2cRowEntry : C2CRow = {
								name: "",
								projectId: projectId,
								snapshotSourceId: "",
								contextProperties: [],
								lastUpdatedOn: new Date(),
								ruleAreaId: ruleArea.id,
								netclassId: ncid,
								slots: emptySlotsForAllNetclasses,
								tags: [],
							}
							c2cRowItemsToAdd.push(c2cRowEntry)
						}
					}

					//adjust existing C2CRows by adding slot items pertaining to new netclasses
					let slotItemsForActionNCs = emptySlotsForAllNetclasses.filter(x => actionNCIDs.includes(x.netclassId))
					if(slotItemsForActionNCs && slotItemsForActionNCs.length > 0) {
						let notInfilter = { ruleAreaId: ruleArea.id, netclassId: { $nin: actionNCIDs } as any } as Filter<C2CRow>;
						await c2crRepo.BulkFindAndPushToArrayField(projectId, [notInfilter], (a => a.slots), slotItemsForActionNCs, true)
					}
				}
			}
		}
		
		//C2CRow Removal processes-------------------------------------------------------------
		else if(actionType === ConstraintChangeActionEnum.RULEAREA_REMOVAL) {
			if(actionRuleAreas && actionRuleAreas.length > 0) {
				let remActionRaids : string[] = actionRuleAreas.map(a => a.id);
				let infilter = { ruleAreaId: { $in: remActionRaids } as any } as Filter<C2CRow>;
				let result = await c2crRepo.DeleteManyByProjectId(projectId, [infilter], true)
				if(result === false) {
					throw new Error(`Failed to successfully DELETE C2CRow elements. ActionType: ${actionType}. `)
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.NETCLASS_REMOVAL) {
			if(actionNetclasses && actionNetclasses.length > 0) {
				let remActionNCIds = actionNetclasses.map(a => a._id?.toString() as string);
				let relIdsAsSet = new Set(remActionNCIds)
				
				let remInfilter = { netclassId: { $in: remActionNCIds } as any } as Filter<C2CRow>;
				let result = await c2crRepo.DeleteManyByProjectId(projectId, [remInfilter], true)
				if(result === false) {
					throw new Error(`Failed to successfully DELETE C2CRow elements. ActionType: ${actionType}. `)
				}
				let infilter = { projectId: projectId, "slots.netclassId" : { $in: remActionNCIds } as any } as Filter<C2CRow>;
				let relevants = await c2crRepo.GetWithFilter(infilter) //if all else fails, just use this basic GetWithFilter call
				if(relevants && relevants.length > 0) {
					for(let item of relevants) {
						item.slots = item.slots.filter(a => (relIdsAsSet.has(a.netclassId) === false))
					}
					await c2crRepo.ReplaceMany(relevants)
				}
			}
		}
		else if(actionType === ConstraintChangeActionEnum.CLEARANCE_RELATION_REMOVAL) {
			if(actionClrRelations && actionClrRelations.length > 0) {
				let remActionClrRelIds = actionClrRelations.map(a => a.id?.toString() as string);
				let relIdsAsSet = new Set(remActionClrRelIds)
				let infilter = { projectId: projectId, "slots.value" : { $in: remActionClrRelIds } as any } as Filter<C2CRow>;
				let relevants = await c2crRepo.GetWithFilter(infilter) //if all else fails, just use this basic GetWithFilter call
				if(relevants && relevants.length > 0) {
					for(let item of relevants) {
						for(let slot of item.slots) {
							if(slot.value && slot.value.trim().length > 0 && relIdsAsSet.has(slot.value)) {
								slot.value = "";
							}
						}
					}
					await c2crRepo.ReplaceMany(relevants)
				}
			}
		}

		//roundup for additions ----------------------------------------------------
		if(c2cRowItemsToAdd.length > 0) {
			let result = await c2crRepo.CreateMany(c2cRowItemsToAdd)
			if(result.length !== c2cRowItemsToAdd.length) {
				throw new Error(`Failed to successfully CREATE C2CRow elements. ActionType: ${actionType}. `)
			}
		}

	}
	catch(error: any) {
		throw new Error(`Could not complete C2C Row setup. ` + error.Message)
	}

}



export async function copyOverLayerGroupConstraintValues(projectId: string, allProjectRuleAreas: RuleArea[], sourceLG: LayerGroup, destinationLayerGroups: LayerGroup[]) {
	try {
		if(!projectId || projectId.trim().length === 0 || projectId.trim().toLowerCase() === "undefined") {
        	throw new Error(`Input layout object is either null or has invalid projectId.`)
		}
		
		let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
		
		let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
		let projectNetclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []

		let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
		let project = await projRepo.GetWithId(projectId);
		
		let clrRelationElements = project.clearanceRelationBrands ?? []
		
		let lgcToUpdate = new Array<LayerGroupConstraints>();

		if(sourceLG && destinationLayerGroups && destinationLayerGroups.length > 0) {
			for(let ruleArea of allProjectRuleAreas) {  
				
				let filter = {ruleAreaId: ruleArea.id } as Filter<LayerGroupConstraints>
				let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
				
				for(let destLG of destinationLayerGroups) {

					for(let netclass of projectNetclasses) {
						let srcPhyLgcElement = lgcList.find(a => a.layerGroupId === sourceLG.id && a.ruleAreaId === ruleArea.id && a.ownerElementId === netclass._id?.toString() as string)
						let destPhyLgcElement = lgcList.find(a => a.layerGroupId === destLG.id && a.ruleAreaId === ruleArea.id && a.ownerElementId === netclass._id?.toString() as string)
						if(srcPhyLgcElement && destPhyLgcElement) {
							destPhyLgcElement.associatedProperties = srcPhyLgcElement.associatedProperties;
							lgcToUpdate.push(destPhyLgcElement);
						}
					}

					for(let clrRelation of clrRelationElements) {
						let srcClrLgcElement = lgcList.find(a => a.layerGroupId === sourceLG.id && a.ruleAreaId === ruleArea.id && a.ownerElementId === clrRelation.id)
						let destClrLgcElement = lgcList.find(a => a.layerGroupId === destLG.id && a.ruleAreaId === ruleArea.id && a.ownerElementId === clrRelation.id)
						if(srcClrLgcElement && destClrLgcElement) {
							destClrLgcElement.associatedProperties = srcClrLgcElement.associatedProperties;
							lgcToUpdate.push(destClrLgcElement);
						}
					}

				}
			}
		}
					
		if(lgcToUpdate && lgcToUpdate.length > 0) {
			let result = await lgcRepo.ReplaceMany(lgcToUpdate)
			if(result === false) {
				throw new Error(`Error occured while performing necessary constraint value replacement!`)
			}
		}
	}
	catch(error: any) {
		throw new Error(`Could not complete constraint copy-over process. ` + error.Message)
	}
}



export async function processConstraintsForAltIfaceCreateScenarios(newIface: Interface, newNetclasses: Netclass[], incomingDataMapping: Map<string, Map<string, string>>, user: User) {
    if (newIface && newIface._id && newIface.initializationType === InterfaceInitTypeEnum.EXTERNAL_IMPORT) {
		try {
			let sourceProjectId = newIface.sourceProjectId
			let sourceIfaceId = newIface.sourceInterfaceId
			let tgtProjectId = newIface.projectId;
			let tgtIfaceId = newIface._id?.toString() as string;

			let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
			let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
			let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
			
			//setup necessary collaterals
			let srcProject = await projRepo.GetWithId(sourceProjectId);
			let tgtProject = await projRepo.GetWithId(tgtProjectId);

			let tgtPkg = await pkgRepo.GetOneByProjectID(tgtProjectId)
			if(!tgtPkg) { 
				throw new Error(`Failed to retrieve valid layout info.`) 
			}

			let tgtGldLGSet = tgtPkg?.layerGroupSets?.find((a: LayerGroupSet) => (a.isGolden === true));
			if(!tgtGldLGSet || !tgtGldLGSet.layerGroups || (tgtGldLGSet.layerGroups.length === 0)) {
				throw new Error(`Could not find a golden layer group set with non empty layer groups for target project. This is required for interface copy scenario.`) 
			}

			let reverseNetclassSrcToTgtMapping = new Map<string, string>();
			for (let [key, value] of (incomingDataMapping?.get(IFACE_COPY_NETCLASS_MAPPING) as Map<string, string>)) {
				if(!key || key.trim().length === 0) {
					throw new Error(`System not could determine target netclass Id corresponding to a source netclass.`)
				}
				else if(!value || value.trim().length === 0) {
					throw new Error(`System not could determine source netclass Id corresponding to a target netclass.`)
				}
				reverseNetclassSrcToTgtMapping.set(value, key); //Important!
			}

			let reverseRuleAreaSrcToTgtMapping = new Map<string, string>();
			for (let [key, value] of (incomingDataMapping?.get(IFACE_COPY_RULEAREA_MAPPING) as Map<string, string>)) {
				if(!key || key.trim().length === 0) {
					throw new Error(`System not could determine target rule area Id corresponding to a source rule area.`)
				}
				else if(!value || value.trim().length === 0) {
					throw new Error(`System not could determine source rule area Id corresponding to a target rule area.`)
				}
				reverseRuleAreaSrcToTgtMapping.set(value, key); //Important!
			}
			
			let tgtLgcToUpdate = new Array<LayerGroupConstraints>();
			
			let srcNetClassIDs = new Set<string>(incomingDataMapping?.get(IFACE_COPY_NETCLASS_MAPPING)?.values() ?? [])
			let srcRuleAreaIDs = new Set<string>(incomingDataMapping?.get(IFACE_COPY_RULEAREA_MAPPING)?.values() ?? [])
			
			let srcC2CMapping = new Map<string, Map<string, [C2CRow, string][]>>();	// ruleArea, srcClrRelID, [frmNC2CCRow, toNCID]  
			let clrRelSrcToTgtPropMapping = new Map<string, BasicProperty|null>();

			for(let srcRaid of srcRuleAreaIDs) {
				srcC2CMapping.set(srcRaid, new Map<string, [C2CRow, string][]>());
				
				let srcC2CRowsForIfaceAndRA = await getClassRelationLayout(sourceProjectId, null, Number.MAX_SAFE_INTEGER, srcRaid, sourceIfaceId, null, null, false) ?? [];
				let srcRels = await getClassRelationNameElementsForInterface(srcProject, sourceIfaceId, srcRaid)
				let relsMapForIfaceAndRA = new Map<string, BasicProperty>(srcRels?.map(a => [a.id.toLowerCase(), a]) ?? []);
				
				for(let srcC2CRow of srcC2CRowsForIfaceAndRA) {
					for(let srcSlot of srcC2CRow.slots) {
						if(srcSlot.value && srcSlot.value.trim().length > 0) {
							let foundRel = relsMapForIfaceAndRA.get(srcSlot.value.toLowerCase());
							if(foundRel) {
								clrRelSrcToTgtPropMapping.set(foundRel.id, null);
								if(srcC2CMapping.get(srcRaid)?.has(foundRel.id) === false) {
									srcC2CMapping.get(srcRaid)?.set(foundRel.id, [])
								}
								
								if(srcSlot.name === C2C_ROW_ALLCOLUMN_SLOT_NAME) { 
									srcC2CMapping.get(srcRaid)?.get(foundRel.id)?.push([srcC2CRow, C2C_ROW_ALLCOLUMN_SLOT_NAME]);
								}
								else if(srcSlot.netclassId && srcNetClassIDs.has(srcC2CRow.netclassId)) { 
									srcC2CMapping.get(srcRaid)?.get(foundRel.id)?.push([srcC2CRow, srcSlot.netclassId]);
								}
							}
						}
					}
				}
			}

			
			//handle clearance relation names
			let relPropsToAdd = new Array<BasicProperty>()
			let tgtClrRelNameSetUpperCase : Set<string> = new Set<string>(tgtProject.clearanceRelationBrands.map((a: BasicProperty) => a.name.toUpperCase()) ?? [])
			for(let srcRelProp of srcProject.clearanceRelationBrands.filter((a: BasicProperty) => clrRelSrcToTgtPropMapping.has(a.id))) {
				let propCopy = rfdcCopy<BasicProperty>(srcRelProp) as BasicProperty
				propCopy.id = crypto.randomUUID();
				if(tgtClrRelNameSetUpperCase.has(propCopy.name)) {
					let count = 1;
					do {
						propCopy.name = `${propCopy.name}_${++count}`
					} while(tgtClrRelNameSetUpperCase.has(propCopy.name))
				}
				relPropsToAdd.push(propCopy);
				clrRelSrcToTgtPropMapping.set(srcRelProp.id, propCopy);
			}
			
			tgtProject.clearanceRelationBrands = tgtProject.clearanceRelationBrands.concat(relPropsToAdd);
			
			await updateProjectClearanceRelationBrands(tgtProject._id?.toString() as string, Array.from(tgtProject.clearanceRelationBrands))

			//update C2C layout
			let tgtUpdatedC2CRList = new Array<C2CRow>();
			for(let [srcRaid, c2cInfo] of srcC2CMapping) {  //srcC2CMapping ==> ruleArea, srcClrRelID, [frmNC2CCRow, toNCID] 
				let tgtRaid = reverseRuleAreaSrcToTgtMapping.get(srcRaid);
				let tgtC2CRowsForIfaceAndRA = await getClassRelationLayout(tgtProjectId, null, Number.MAX_SAFE_INTEGER, tgtRaid as string, tgtIfaceId, null, null, false) ?? [];

				for(let [srcClrRelID, mapData] of c2cInfo) {
					let tgtCltRelProp = clrRelSrcToTgtPropMapping.get(srcClrRelID);
					for (let directionData of mapData) {
						let tgtFromNCID = reverseNetclassSrcToTgtMapping.get(directionData[0].netclassId);
						let tgtToIdentifier = directionData[1] === C2C_ROW_ALLCOLUMN_SLOT_NAME ? C2C_ROW_ALLCOLUMN_SLOT_NAME : reverseNetclassSrcToTgtMapping.get(directionData[1]);
					
						if(tgtFromNCID && tgtToIdentifier) {
							let tgtC2CRow = tgtC2CRowsForIfaceAndRA.find(a => a.netclassId === tgtFromNCID);
							if(tgtC2CRow) {
								let c2crUpdated = false
								for (let tgtSlot of tgtC2CRow.slots) {
									if(tgtToIdentifier === C2C_ROW_ALLCOLUMN_SLOT_NAME && tgtSlot.name === C2C_ROW_ALLCOLUMN_SLOT_NAME && (tgtSlot.netclassId.trim().length === 0)) {
										tgtSlot.value = tgtCltRelProp?.id || '';
										c2crUpdated = true;
										continue;
									}
									else if(tgtToIdentifier === tgtSlot.netclassId) {
										tgtSlot.value = tgtCltRelProp?.id || '';
										c2crUpdated = true;
										continue;
									}
								}
								if(c2crUpdated === true) {
									tgtUpdatedC2CRList.push(tgtC2CRow)
								}
							}
						}
					}
				}
			}

			if(tgtUpdatedC2CRList.length > 0) {
				tgtUpdatedC2CRList = await updateC2CRow(tgtUpdatedC2CRList, user); 
			}


			//handle LGCs
			for(let tgtRuleArea of (tgtPkg.ruleAreas)) {  		
				let srcRaid = incomingDataMapping?.get(IFACE_COPY_RULEAREA_MAPPING)?.get(tgtRuleArea.id);
				if(!srcRaid || srcRaid.trim().length === 0) {
					throw new Error(`Could not find a corresponding source rule area for target rule area. This is required for interface copy scenario.`) 
				}

				let tgtFilter = {ruleAreaId: tgtRuleArea.id, constraintType: ConstraintTypesEnum.Physical} as Filter<LayerGroupConstraints>
				let tgtLgcList = await lgcRepo.GetAllByProjectID(tgtProjectId, tgtFilter) ?? []
				
				let srcfilter = {ruleAreaId: srcRaid, constraintType: ConstraintTypesEnum.Physical} as Filter<LayerGroupConstraints>
				let srcLGCs = await lgcRepo.GetAllByProjectID(sourceProjectId, srcfilter) ?? []

				for(let tgtLG of tgtGldLGSet.layerGroups) {
					let srcLgid = incomingDataMapping?.get(IFACE_COPY_LAYERGROUP_MAPPING)?.get(tgtLG.id);
					if(!srcLgid || srcLgid.trim().length === 0) {
						throw new Error(`Could not find a corresponding source layer group for target layer group. This is required for interface copy scenario.`) 
					}

					//handle netclasses and associated LGCs
					for(let netclass of newNetclasses) {
						let srcNcid = incomingDataMapping?.get(IFACE_COPY_NETCLASS_MAPPING)?.get(netclass._id?.toString() as string);
						if(!srcNcid || srcNcid.trim().length === 0) {
							throw new Error(`Could not find a corresponding source netclass for target netclass. This is required for interface copy scenario.`) 
						}

						let srcPhyLgcElement = srcLGCs.find(a => a.layerGroupId === srcLgid && a.ruleAreaId === srcRaid && a.ownerElementId === srcNcid)
						let destPhyLgcElement = tgtLgcList.find(a => a.layerGroupId === tgtLG.id && a.ruleAreaId === tgtRuleArea.id && a.ownerElementId === netclass._id?.toString() as string)
						
						if(srcPhyLgcElement && destPhyLgcElement) {
							srcPhyLgcElement.associatedProperties.forEach(x => { 
								x.id = crypto.randomUUID();
								(x.value as ConstraintValues).defautlValue = ""; 
							});
							destPhyLgcElement.associatedProperties = srcPhyLgcElement.associatedProperties;
							tgtLgcToUpdate.push(destPhyLgcElement);
						}
					}

					//handle clearance relation LGCs
					for(let [srcRelId, tgtClrRelation] of clrRelSrcToTgtPropMapping) {
						if(tgtClrRelation) {
							let srcClrLgcElement = srcLGCs.find(a => a.layerGroupId === srcLgid && a.ruleAreaId === srcRaid && a.ownerElementId === srcRelId)
							let destClrLgcElement = tgtLgcList.find(a => a.layerGroupId === tgtLG.id && a.ruleAreaId === tgtRuleArea.id && a.ownerElementId === tgtClrRelation.id)
							if(srcClrLgcElement && destClrLgcElement) {
								srcClrLgcElement.associatedProperties.forEach(x => { 
									x.id = crypto.randomUUID();
									(x.value as ConstraintValues).defautlValue = ""; 
								});
								destClrLgcElement.associatedProperties = srcClrLgcElement.associatedProperties;
								tgtLgcToUpdate.push(destClrLgcElement);
							}
						}
					}
				}
			}

			if(tgtLgcToUpdate && tgtLgcToUpdate.length > 0) {
				let result = await lgcRepo.ReplaceMany(tgtLgcToUpdate)
				if(result === false) {
					throw new Error(`Error occured while performing necessary constraint value replacement!`)
				}
			}

		}
		catch(error: any) {
			throw new Error(`Could not complete constraint management processes for interface copy scenario. ${error.message}`)
		}
	} 
}



export async function sortSlots(projectId: string, forceFillAssignmentType: boolean = false, performCleanup: boolean = false) {
	let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
	let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
	let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);

	let filter = { _id: new ObjectId(projectId as string) } as Filter<Project>;
    let projection = { name: 1, clearanceRelationBrands: 1 };
    let project = (await projRepo.GetByFilterAndProjection(filter, projection) as any[])?.at(0);
    let currentProjCrbIdSet = new Set<string>((project as Project).clearanceRelationBrands?.map(x => x.id) ?? []);

	let ifaceMapping = new Map<string, string>();
	let ifaceProjectionSpec = { _id: 1, name: 1 }
	let projectInterfaces = await ifaceRepo.GetAllByProjectIDAndProjection(projectId, null, ifaceProjectionSpec) ?? []
	for(let iface of projectInterfaces) {
		ifaceMapping.set((iface as Interface)._id?.toString() as string, iface.name);
	}

	let netclassMapping = new Map<string, Netclass>();
	let ncProjectionSpec = { _id: 1, name: 1, interfaceId: 1, channel: 1, segment: 1 }
	let projectNetclasses = await netclassRepo.GetAllByProjectIDAndProjection(projectId, null, ncProjectionSpec) ?? []
	for(let nc of projectNetclasses) {
		netclassMapping.set((nc as Netclass)._id?.toString() as string, nc);
	}

	if(ifaceMapping && ifaceMapping.size > 0 && netclassMapping && netclassMapping.size > 0) {
		let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
		let c2crBatch = new Array<C2CRow>();

		const c2cCursor = c2crRepo.GetCursorByProjectIDAndProjection(projectId, null, null, C2C_ROW_RETRIEVAL_BATCH_SIZE)
		for await (const c2crElement of c2cCursor) { 
			let theAllSlot : C2CRowSlot|undefined = undefined;
			let otherSlots : C2CRowSlot[] = [];

			for(let i = 0; i < c2crElement.slots.length; i++) {
				//delete slot value if CRB does not exist for project
				if(performCleanup === true) {
					if(c2crElement.slots[i].value && (c2crElement.slots[i].value.trim().length > 0)) {
						if(currentProjCrbIdSet.has(c2crElement.slots[i].value) === false) {
							c2crElement.slots[i].value = "";
						}
					}
				}

				//check to make sure the assignment type is set
				if(forceFillAssignmentType === true) {
					if(!c2crElement.slots[i].assignmentType || c2crElement.slots[i].assignmentType?.trim().length === 0) {
						if(c2crElement.slots[i].value && c2crElement.slots[i].value.trim().length > 0) {
							c2crElement.slots[i].assignmentType = DataMappingTypeEnum.Manual;
						}
						else {
							c2crElement.slots[i].assignmentType = DataMappingTypeEnum.Unmapped;
						}
					}
				}

				//filter ALL or NC-Type slot
				if(c2crElement.slots[i].name.trim().toUpperCase() === C2C_ROW_ALLCOLUMN_SLOT_NAME) {
					theAllSlot = c2crElement.slots[i];
				}
				else {
					otherSlots.push(c2crElement.slots[i])
				}
			}

			otherSlots = sort(otherSlots).asc([
				a => ifaceMapping.get(netclassMapping.get(a.netclassId)?.interfaceId as string)?.toUpperCase(), 
				a => Number(netclassMapping.get(a.netclassId)?.channel),
				a => a.name?.toUpperCase()
			]); //Important!

			if(theAllSlot && otherSlots.length > 0) {
				c2crElement.slots = [theAllSlot, ...otherSlots];
			}
			
			c2crBatch.push(c2crElement);
			if(c2crBatch.length >= C2C_ROW_RETRIEVAL_BATCH_SIZE){
				await c2crRepo.ReplaceMany([...c2crBatch])
				c2crBatch = new Array<C2CRow>()
			}
		}

		if(c2crBatch.length > 0){
			await c2crRepo.ReplaceMany(c2crBatch)
			c2crBatch = new Array<C2CRow>()
		}
	}
}



export async function updateLGC(lgcList: LayerGroupConstraints[], user: User|null) : Promise<LayerGroupConstraints[]>{
	let cTypes = getEnumValuesAsArray(ConstraintTypesEnum)
	let projectId = lgcList?.at(0)?.projectId 

	if(!lgcList || lgcList.length === 0) {
		throw new Error(`Could not update layer group constraints because no valid constraint element(s) were provided for the operation`);
	}
	if(!projectId || projectId.trim().length === 0 || projectId.trim().toLowerCase() === "undefined"){
		throw new Error(`Cannot update layer group constraint. Constraint data must have valid projectId`)
	}
	
	let physConstrCriteriaSettings = new Map<PropertyItem, string[]>();
	let clrConstrCriteriaSettings = new Map<PropertyItem, string[]>();
	
	let projFilter = { _id: new ObjectId(projectId) } as any;
	
	let projection = { 
		_id: 1, 
		name: 1,
		constraintSettings: {
			$filter: {
			  input: "$constraintSettings",
			  as: "constrSetting",
			  cond: { $in: ["$$constrSetting.category", [ConstraintTypesEnum.Physical, ConstraintTypesEnum.Clearance]] }
			}
		  }
	};

	let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
	let project = (await projRepo.GetByFilterAndProjection(projFilter, projection) as any[])?.at(0);
	
	if (project && project.constraintSettings && project.constraintSettings.length > 0) {
		for(let prop of project.constraintSettings) {
			let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "export_context")?.value
			if(exportSettings && exportSettings.okCriteria && exportSettings.okCriteria.length > 0) {
				if(prop.category === ConstraintTypesEnum.Physical) {
					physConstrCriteriaSettings.set(prop as PropertyItem, exportSettings.okCriteria)
				}
				else if(prop.category === ConstraintTypesEnum.Clearance) {
					clrConstrCriteriaSettings.set(prop as PropertyItem, exportSettings.okCriteria)
				}
			}
		}
	}
	else {
		throw new Error(`Could not retrieve corresponding project. Make sure the relevant project exists in order to update layer group constraint`);
	}

	let linkedLGCs = await assessLinkageRelatedLGCs(projectId, lgcList, false);
	lgcList = lgcList.concat(linkedLGCs);

	for(let lgc of lgcList) {
        if(!lgc.projectId || lgc.projectId.trim().length === 0 || lgc.projectId.toLowerCase() === "undefined"){
            throw new Error(`Cannot update layer group constraint. Constraint data must have valid projectId`)
        }
		if(!lgc.ruleAreaId || lgc.ruleAreaId.trim().length < 2 || lgc.ruleAreaId.toLowerCase() === "undefined"){
            throw new Error(`Cannot update layer group constraint. 'ruleAreaId' must be valid`)
        }
		if(!lgc.layerGroupId || lgc.layerGroupId.trim().length < 2 || lgc.layerGroupId.toLowerCase() === "undefined"){
            throw new Error(`Cannot update layer group constraint. 'layergroupId' must be valid`)
        }
		if(!lgc.ownerElementId || lgc.ownerElementId.trim().length < 2 || lgc.ownerElementId.toLowerCase() === "undefined"){
            throw new Error(`Cannot update layer group constraint. 'ruleAreaId' must be valid`)
        }
		if(!lgc.constraintType || (cTypes.includes(lgc.constraintType) === false)){
            throw new Error(`Cannot update layer group constraint. 'constraintType' could not be determined`)
        }
		if(!lgc.associatedProperties || lgc.associatedProperties.length === 0){
            throw new Error(`Cannot update layer group constraint. Relevant properties were not found for constraint element`)
        }

		//check for same projectID
		if(lgc.projectId !== projectId){
            throw new Error(`Cannot update layer group constraint. All supplied constraint elements must have the same project Id`)
        }

		// check for same constraintType - no mixing allowed
		if(lgc.constraintType !== lgcList[0].constraintType){  //very Important!!
            throw new Error(`Cannot update layer group constraint. All supplied constraint elements must be of same type`)
        }
		if(lgc.associatedProperties.length !== lgcList[0].associatedProperties.length) {
            throw new Error(`Cannot update layer group constraint. All supplied constraint elements must have the same number of properties`)
        }

		//make sure any configured criteria for acceptance is satisfied
		checkLGCAgainstConstraintCriteriaSettings(lgc, physConstrCriteriaSettings);

		lgc.lastUpdatedOn = new Date()
    }

	let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	

	let mapBeforeUpdate = new Map<string, Map<string, any>>();
    let idList = lgcList.map((x: LayerGroupConstraints) => new ObjectId(x._id?.toString()));
    let infilter = { _id: { $in: idList } as any } as Filter<LayerGroupConstraints>;
    let initData = await lgcRepo.GetAllByProjectID(projectId, infilter);
    if(initData && initData.length > 0) {
        for(let lgc of initData) {
            mapBeforeUpdate.set(lgc._id?.toString() as string, new Map<string, any>())
            for (let prop of lgc.associatedProperties) {
                mapBeforeUpdate.get(lgc._id?.toString() as string)?.set(prop.id, prop.value);
            }
        }
    }

	let updatedLGCs = await executeLGCReplaceManyOperation(lgcList, user);
	if (updatedLGCs && updatedLGCs.length > 0) {
		await saveLatestChangeTrackingVersionsForCollection(updatedLGCs[0].projectId, user, new Map<string, PropertyItem[]>(updatedLGCs.map(x => [x._id?.toString() as string, x.associatedProperties])), mapBeforeUpdate);
		return updatedLGCs;
	}
	else {
		//redundancy for the f of it...
		updatedLGCs = await executeLGCReplaceManyOperation(lgcList, user);
		if (updatedLGCs && updatedLGCs.length > 0) {
			await saveLatestChangeTrackingVersionsForCollection(updatedLGCs[0].projectId, user, new Map<string, PropertyItem[]>(updatedLGCs.map(x => [x._id?.toString() as string, x.associatedProperties])), mapBeforeUpdate);
			return updatedLGCs;
		}
		else {
			throw new Error(`Failed to get updated constraint elements. An unspecified error may have occured while performing update operation`);
		}
	}
}



function checkLGCAgainstConstraintCriteriaSettings(lgc: LayerGroupConstraints, physConstrCriteriaSettings: Map<PropertyItem, string[]>) {
	if (lgc.constraintType === ConstraintTypesEnum.Physical && physConstrCriteriaSettings.size > 0) {
		for (let [confProp, criteriaEntry] of physConstrCriteriaSettings) {
			let lgcRelevProp = lgc.associatedProperties.find(a => confProp.name.trim().toUpperCase() === a.name.trim().toUpperCase());

			if (lgcRelevProp) {
				let lgcPropName = lgcRelevProp.name.trim().toUpperCase();
				let cusVal = (lgcRelevProp.value as ConstraintValues).customValue;

				if (lgcPropName && cusVal && cusVal.toString().trim().length > 0) {
					for (let crit of criteriaEntry) {
						let split = splitByDelimiters(crit, [";", ",", "|", " "]);
						if (split && split.length === 3) {
							let firstVal = null;
							let secValue = null;
							let firstConfName = split[0].trim().toUpperCase();
							let secondConfName = split[2].trim().toUpperCase();

							if (firstConfName === lgcPropName) {
								let propValElement = lgc.associatedProperties.find(a => a.name.toUpperCase() === secondConfName)?.value;
								let v2 = getMostAppropriateConstraintValue(propValElement);
								if (isNumber(cusVal) && isNumber(v2)) {
									firstVal = Number(cusVal);
									secValue = Number(v2);
								}
							}

							if (secondConfName === lgcPropName) {
								let propValElement = lgc.associatedProperties.find(a => a.name.toUpperCase() === firstConfName)?.value;
								let v1 = getMostAppropriateConstraintValue(propValElement);
								if (isNumber(v1) && isNumber(cusVal)) {
									firstVal = Number(v1);
									secValue = Number(cusVal);
								}
							}

							if (firstVal && secValue) {
								let operator = split[1].trim().toLowerCase();
								if (operator === "eq") {
									if (firstVal !== secValue) {
										throw new Error(`Cannot update layer group constraint. Value for '${firstConfName}' must be equal to the value for '${secondConfName}'. `);
									}
								}
								else if (operator === "lt") {
									if (firstVal >= secValue) {
										throw new Error(`Cannot update layer group constraint. Value for '${firstConfName}' must be less than the value for '${secondConfName}'. `);
									}
								}
								else if (operator === "gt") {
									if (firstVal <= secValue) {
										throw new Error(`Cannot update layer group constraint. Value for '${firstConfName}' must be greater than the value for '${secondConfName}'. `);
									}
								}
								else if (operator === "le") {
									if (firstVal > secValue) {
										throw new Error(`Cannot update layer group constraint. Value for '${firstConfName}' must be less than or equal to the value for '${secondConfName}'. `);
									}
								}
								else if (operator === "ge") {
									if (firstVal < secValue) {
										throw new Error(`Cannot update layer group constraint. Value for '${firstConfName}' must be greater than or equal to the value for '${secondConfName}. `);
									}
								}
								else if (operator === "ne") {
									if (firstVal === secValue) {
										throw new Error(`Cannot update layer group constraint. Value for '${firstConfName}' must not equal the value for '${secondConfName}'. `);
									}
								}
							}
						}
					}
				}
			}
		}
	}
}



async function executeLGCReplaceManyOperation(lgcList: LayerGroupConstraints[], user: User|null) : Promise<LayerGroupConstraints[]>{
	let updatedLGCs : LayerGroupConstraints[] = [];
	let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	let result = await lgcRepo.ReplaceMany(lgcList, false);
	if (result === true) {
		let idList = lgcList.map((x: LayerGroupConstraints) => new ObjectId(x._id?.toString()));
		let infilter = { _id: { $in: idList } as any };
		updatedLGCs = await lgcRepo.GetAllByProjectID(lgcList[0].projectId, infilter);
	}
	return updatedLGCs
}



export async function switchUpLayerGroupSet(projectId: string, elementId: string, switchToLGSetId: string) : Promise<boolean> {
	//NOTE: project linkages are handled here as well...	
	let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
	let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
	let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
	let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION)
	let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	
	let lgc = await lgcRepo.GetAnyOne(projectId, {ownerElementId: elementId } as Filter<LayerGroupConstraints>)
	if(!lgc || (lgc.constraintType !== ConstraintTypesEnum.Physical && lgc.constraintType !== ConstraintTypesEnum.Clearance)) {
		throw new Error(`Could not update layer group set. No valid constraint exists for the element identifier provided`);
	}

	let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
	let pkg = await pkgRepo.GetOneByProjectID(projectId)
	if(!pkg) { 
		throw new Error(`Failed to retrieve valid layout info.`) 
	}
	if(pkg.layerGroupSets.every(a => a.id !== switchToLGSetId)) {
		throw new Error(`Could not update layer group set. The specified NEW layer group set is not associated with the current project`);
	}

	let project = await projRepo.GetWithId(projectId);
	let response = false;

	if(lgc.constraintType === ConstraintTypesEnum.Physical) {
		let focusNetclassList = new Array<Netclass>();
		let projNetclasses = await netclassRepo.GetAllByProjectID(projectId) ?? [];
		
		//handle input NC
		let inputElemNC = projNetclasses.find(a => ((a._id?.toString() as string) === elementId));
		if(!inputElemNC) {
			throw new Error(`Could not update LGSet. No netclass found for the specified netclass/element ID`);
		}
		focusNetclassList.push(inputElemNC);

		//handle linkage situation
		let involvedPhyLinkage = project.physicalLinkages.find(a => a.value.includes(elementId));
		if(involvedPhyLinkage) {
			let othVals = involvedPhyLinkage.value.filter(x => x !== elementId.trim())
			let othLnkNCList = projNetclasses.filter(x => othVals.includes(x._id?.toString() as string));
			if(!othLnkNCList || othLnkNCList.length === 0) {
				throw new Error(`Could not update LGSet. No linked netclass found for the specified netclass/element ID`);
			}
			othLnkNCList.forEach(k => focusNetclassList.push(k));
		}
		
		//handle channel situation
		let chSituationNCs = new Array<Netclass>();
		let uniqueIfaceIds = new Set<string>(focusNetclassList.map(a => a.interfaceId))
		let ifaceObjIds = Array.from(uniqueIfaceIds).map((x) => new ObjectId(x));
		let infilter = { _id: { $in: ifaceObjIds } };
		let ifaceList = await ifaceRepo.GetAllByProjectID(projectId, infilter) ?? [];
		let existingG2GList = await g2gRepo.GetAllByProjectID(projectId) ?? [];
		
		for(let i = 0; i < focusNetclassList.length; i++) {
			if(focusNetclassList[i].channel && focusNetclassList[i].channel.toString().trim().length > 0) {
				let iface = ifaceList.find(a => ((a._id?.toString() as string) === focusNetclassList[i].interfaceId)) as Interface;
				let ifaceNCList = projNetclasses.filter(n => n.interfaceId === focusNetclassList[i].interfaceId);
				let chToNameRes = getNetclassToChannelNameMapping(iface, ifaceNCList, existingG2GList);
				if(chToNameRes.isSuccessful === false) {  //sanity check 1
					throw new Error(`Error while updating LGSet for channelled netclass(es). ${chToNameRes.message}`);
				}
		
				let chanToNameResData = chToNameRes.data as Map<string, {channelName: string, suffix: string}>  //< ncId, {chName, suffix} >
				let focusSuffix = chanToNameResData.get(focusNetclassList[i]._id?.toString()as string)?.suffix as string;
				let grpBySuffixName = groupBy(ifaceNCList, x => (chanToNameResData.get(x._id?.toString() as string)?.suffix || ''));
				let peerNetclasses = grpBySuffixName.get(focusSuffix) ?? [];
				for(let [suffixName, ncList] of grpBySuffixName) {
					if(ncList.length !== peerNetclasses.length) { //sanity check 2
						throw new Error(`Error while updating LGSet for channelled netclass(es). There must be an equal set of netclasses across all channels.`);
					}
				}
				let othPeerNCs = peerNetclasses.filter(x => ((x._id?.toString() as string) !== (focusNetclassList[i]._id?.toString()as string)))
				othPeerNCs.forEach(p => chSituationNCs.push(p));
			}
		}
		chSituationNCs.forEach(x => focusNetclassList.push(x));

		//roundup....
		for(let i = 0; i < focusNetclassList.length; i++) {
			focusNetclassList[i].layerGroupSetId = switchToLGSetId;
			focusNetclassList[i].lastUpdatedOn = new Date();
		}
		
		response = await netclassRepo.ReplaceMany(focusNetclassList, false)
	}
	else if(lgc.constraintType === ConstraintTypesEnum.Clearance) {				
		let clrBrandArray = new Array<BasicProperty>()
		let involvedClrLinkage = project.clearanceLinkages.find(a => a.value.includes(elementId));

		if(involvedClrLinkage) {
			clrBrandArray = project.clearanceRelationBrands.filter(a => involvedClrLinkage.value.includes(a.id))
			if(!clrBrandArray || clrBrandArray.length === 0) {
				throw new Error(`Could not update layer group set. No linked clearance relation info found for the specified ID`);
			}
		}
		else {
			if(!project.clearanceRelationBrands || project.clearanceRelationBrands.every((a: BasicProperty) => a.id !== elementId)) {
				throw new Error(`Could not update layer group set. No clearance relation info was found for the specified ID`);
			}
			clrBrandArray = project.clearanceRelationBrands.filter(x => (x.id === elementId));
		}

		let clrRelBrandIds = new Set<string>(clrBrandArray.map(a => a.id))
		for(let i = 0; i < project.clearanceRelationBrands.length; i++) {
			if(clrRelBrandIds.has(project.clearanceRelationBrands[i].id)) {
				project.clearanceRelationBrands[i].value = switchToLGSetId;
			}
		}
		let updatedProj = await updateProjectClearanceRelationBrands(project._id?.toString() as string, Array.from(project.clearanceRelationBrands))
		if(updatedProj) {
			response = (updatedProj && updatedProj._id) ? true : false;
		}
	}

	assessLinkageRelatedLGCs(projectId, null, true); //do not wait on this...

	return response;
}



export function getLgcPropValue(columnName: string, forceDefault: boolean, keyToPropNameMapping: Map<string, string>, lgcPropsMap : Map<string, ConstraintValues>) : string {
    //Example of columnName:  "Trace Width Minimum"
    let finalValue = "";
    let valObj : ConstraintValues = { id: "", configValue: "", defautlValue: "", customValue: "" }
    if(columnName && keyToPropNameMapping && keyToPropNameMapping.size > 0) {
        let columnNameMod = columnName.replaceAll(" ", "").toUpperCase()
        let propName = keyToPropNameMapping.get(columnNameMod);
        if(propName && propName.trim().length > 0 && lgcPropsMap.has(propName)) {
            valObj = lgcPropsMap.get(propName) as ConstraintValues;
        }
    }

    if(forceDefault) {
        finalValue = valObj.defautlValue || "";
    }
    else {
        finalValue = getMostAppropriateConstraintValue(valObj);
    }

    return finalValue;
}
	


export function getMostAppropriateConstraintValue(propValElement: ConstraintValues|undefined) {
    if(propValElement) {
		let propValue = propValElement?.customValue || propValElement?.defautlValue || propValElement?.configValue || '';
		return propValue
	}
	
	return '' 
}



export async function assessLinkageRelatedLGCs(projectId: string, inputLGCs: LayerGroupConstraints[]|null, executeUpdate : boolean) : Promise<LayerGroupConstraints[]> {
    // LGC filter aspects: constraintType | ruleAreaId | ownerElementId | layerGroupId

	let updatableLGCMap = new Map<string, LayerGroupConstraints>();
	let inputLGCMapping = new Map<string, LayerGroupConstraints>();

	let projectRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    let project = await projectRepo.GetWithId(projectId);
	
	let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
	let pkg = await pkgRepo.GetOneByProjectID(projectId)

	//bail out if there are no linkages
	if(project && (project.physicalLinkages.length === 0) && (project.clearanceLinkages.length === 0)) {
		return inputLGCs ?? []
	}

	let typeToSrcElementInfoMap = new Map<ConstraintTypesEnum, Map<string, Set<string>>>();   //constraintType -> {ruleAreaId, [elementId]}
	typeToSrcElementInfoMap.set(ConstraintTypesEnum.Physical, new Map<string, Set<string>>())
	typeToSrcElementInfoMap.set(ConstraintTypesEnum.Clearance, new Map<string, Set<string>>())

	if(inputLGCs && inputLGCs.length > 0) {
		for(let lgc of inputLGCs) {
			if(typeToSrcElementInfoMap.get(lgc.constraintType)?.has(lgc.ruleAreaId) === false) {
				typeToSrcElementInfoMap.get(lgc.constraintType)?.set(lgc.ruleAreaId, new Set())
			} 
			typeToSrcElementInfoMap.get(lgc.constraintType)?.get(lgc.ruleAreaId)?.add(lgc.ownerElementId)
			inputLGCMapping.set(lgc._id?.toString() as string, lgc);
		}
	}
	else {
		for(let lnk of project.physicalLinkages) {
			let relevRaids : string[] = (lnk.ruleAreaId === LINKAGE_ALL_RULEAREA_INDICATOR) ? pkg.ruleAreas.map(a => a.id) : [lnk.ruleAreaId];
			for (let raid of relevRaids) {
				if(typeToSrcElementInfoMap.get(ConstraintTypesEnum.Physical)?.has(raid) === false) {
					typeToSrcElementInfoMap.get(ConstraintTypesEnum.Physical)?.set(raid, new Set())
				} 
				typeToSrcElementInfoMap.get(ConstraintTypesEnum.Physical)?.get(raid)?.add(lnk.sourceElementId)
			}
		}
		for(let lnk of project.clearanceLinkages) {
			let relevRaids : string[] = (lnk.ruleAreaId === LINKAGE_ALL_RULEAREA_INDICATOR) ? pkg.ruleAreas.map(a => a.id) : [lnk.ruleAreaId];
			for (let raid of relevRaids) {
				if(typeToSrcElementInfoMap.get(ConstraintTypesEnum.Clearance)?.has(raid) === false) {
					typeToSrcElementInfoMap.get(ConstraintTypesEnum.Clearance)?.set(raid, new Set())
				} 
				typeToSrcElementInfoMap.get(ConstraintTypesEnum.Clearance)?.get(raid)?.add(lnk.sourceElementId)
			}
		}
	}
	
	if(typeToSrcElementInfoMap.size > 0) {
		let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	
		let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
		let netclassList = await netclassRepo.GetAllByProjectID(projectId) ?? [];
		
		let lgSetToLgIdCollMap = new Map<string, Set<string>>();
		for(let lgSet of pkg.layerGroupSets) {
			let lgIds = new Set<string>(lgSet.layerGroups?.map(a => a.id) ?? [])
			lgSetToLgIdCollMap.set(lgSet.id, lgIds)
		}
	
		for(let [type, infoMap] of typeToSrcElementInfoMap) {
			if(infoMap.size > 0) {
				for(let [raid, ownerElemSet] of infoMap) {
					if(ownerElemSet.size > 0) {
						let lgcArr = new Array<LayerGroupConstraints>()
						let lnkSrcInfoMap = new Map<string, Map<string, LayerGroupConstraints>>(); 		// {lnkId, {lyrGrpId, LGc} }
						let lnkAssocElemInfoMap = new Map<string, Map<string, LayerGroupConstraints[]>>(); 	// {lnkId, {elementId, LgcList} }

						for(let srcElement of ownerElemSet) {
							let lnk : LinkageInfo|undefined;
							let lgsetId : string|undefined = "";

							//for each incoming ownerElement, determine the related linkage and layerGroupSet
							if(type === ConstraintTypesEnum.Physical) {
								lnk = project.physicalLinkages.find(x => x.value.includes(srcElement));
								lgsetId = netclassList.find(a => a._id?.toString() === srcElement)?.layerGroupSetId
							}
							else if(type === ConstraintTypesEnum.Clearance) {
								lnk = project.clearanceLinkages.find(x => x.value.includes(srcElement));
								lgsetId = project.clearanceRelationBrands.find(a => a.id === srcElement)?.value
							}

							if(lnk && lnk.value && lnk.value.length > 0 && lgsetId && lgsetId.length > 0) {
								//get layergroups involved for the lgset
								let lgIdColl = lgSetToLgIdCollMap.get(lgsetId) ?? new Set();
								if(lgIdColl.size > 0) {
									
									//NOTE: from here on out, we know the linkage item we are dealing with....
									
									lnkSrcInfoMap.set(lnk.id, new Map())
									lnkAssocElemInfoMap.set(lnk.id, new Map())
									let srcLgcMappedByLG = new Map<string, LayerGroupConstraints>();
									let count = 0;

									//pull a targeted and relevant chunk of LCGs from database
									if(lgcArr.length === 0) {
										let involvedElemSet = new Set<string>(lnk.value.concat(srcElement));
										let ownerElemCriteria = { $in: Array.from(involvedElemSet) } as any;
										let layerGrpIdCriteria =  { $in: Array.from(lgIdColl) } as any; 
										
										if(lnk.confineToRuleArea === true) {
											let filter = { constraintType: type, ruleAreaId: raid, ownerElementId: ownerElemCriteria, layerGroupId: layerGrpIdCriteria } as Filter<LayerGroupConstraints>;
											lgcArr = await lgcRepo.GetAllByProjectID(projectId, filter)
										}
										else {
											let filter = { constraintType: type, ownerElementId: ownerElemCriteria, layerGroupId: layerGrpIdCriteria} as Filter<LayerGroupConstraints>;
											lgcArr = await lgcRepo.GetAllByProjectID(projectId, filter)
										}
									}

									//continue processing...
									if(lgcArr && lgcArr.length > 0) {
										for(let lgc of lgcArr) {
											if((lgc.ruleAreaId === raid) && (lgc.ownerElementId === srcElement) && lgIdColl.has(lgc.layerGroupId)) {
												count = count + 1;

												//In determining values that will be used for source: 
												// 		If there are incoming LGSs, take the incoming instead (for update scenatios) 
												// 		Otherwise, take from DB (for general sync-up scenarios)
												if(inputLGCMapping.size > 0) {
													let srcLgcItem = inputLGCMapping.get(lgc._id?.toString() as string)
													if(srcLgcItem) {
														srcLgcMappedByLG.set(lgc.layerGroupId, srcLgcItem) //It is expected that the items found at this stage will be unique by 'layerGroupId'
													}
												}
												else {
													srcLgcMappedByLG.set(lgc.layerGroupId, lgc) //It is expected that the items found at this stage will be unique by 'layerGroupId'
												}
												
												if(count === lgIdColl.size) {
													lnkSrcInfoMap.set(lnk.id, srcLgcMappedByLG);
													break;
												}
											}
										}

										if (lnkSrcInfoMap.has(lnk.id)) {
											for(let linkedElemId of lnk.value) {
												let relatedElemLgcCollection = new Array<LayerGroupConstraints>();
												
												if(linkedElemId !== srcElement) {
													if(lnk.confineToRuleArea === false) {
														relatedElemLgcCollection = lgcArr.filter(a => ((a.ownerElementId === linkedElemId) && lgIdColl.has(a.layerGroupId)));
													}
													else {
														relatedElemLgcCollection = lgcArr.filter(a => ((a.ruleAreaId === raid) && (a.ownerElementId === linkedElemId) && lgIdColl.has(a.layerGroupId)));
													}
												}
												else {
													if(lnk.confineToRuleArea === false) {
														relatedElemLgcCollection = lgcArr.filter(a => ((a.ruleAreaId !== raid) && (a.ownerElementId === linkedElemId) && lgIdColl.has(a.layerGroupId))); //rule area NOT equal...
													}
													else {
														/* intentionally doing nothing here as there is nothing to do in this case */
													}
												}

												if(relatedElemLgcCollection && relatedElemLgcCollection.length > 0) {
													lnkAssocElemInfoMap.get(lnk.id)?.set(linkedElemId, relatedElemLgcCollection);
												}

											}
										}
									}
								}
							}
						}

						for(let [lnkId, assocDataMap] of lnkAssocElemInfoMap) {
							let tempUpdLGCMap = new Map<string, LayerGroupConstraints>();
							for(let [elem, lgcColl] of assocDataMap) {
								for(let lgc of lgcColl) {
									let srcLgc = lnkSrcInfoMap.get(lnkId)?.get(lgc.layerGroupId);
									if(srcLgc && srcLgc.associatedProperties && srcLgc.associatedProperties.length > 0) {
										let propMapByName = new Map<string, PropertyItem>(srcLgc.associatedProperties.map(p => [p.name.toUpperCase().trim(), p]))
										for(let i = 0; i < lgc.associatedProperties.length; i++) {
											let matchedProp = propMapByName.get(lgc.associatedProperties[i].name.toUpperCase().trim())
											if(matchedProp) {
												(lgc.associatedProperties[i].value as ConstraintValues).customValue = (matchedProp.value as ConstraintValues).customValue;
												tempUpdLGCMap.set(lgc._id?.toString() as string, lgc);
											}
										}
									} 
									
								}
							}
							
							if(executeUpdate === true && tempUpdLGCMap.size > 0) {
								lgcRepo.ReplaceMany(Array.from(tempUpdLGCMap.values()))
							}
							for(let [id, tuLGC] of tempUpdLGCMap) {
								updatableLGCMap.set(id, tuLGC);
							}
							tempUpdLGCMap = new Map();
						}
					}
				}
			}
		}
	}

	let res = Array.from(updatableLGCMap.values())
	return res 
}



export async function copyConstraintsToAnotherRuleArea(user: User|null, project: Project, srcRA: RuleArea, destRA: RuleArea, constraintType: ConstraintTypesEnum, ifaceId: string) : Promise<boolean> {
	let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
	let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)

	let relevNcidList = new Set<string>();
	if(ifaceId && ifaceId.length > 0) {
		let ifaceFilter = { interfaceId: ifaceId } as Filter<Netclass>
		let ifaceNetclasses = await netclassRepo.GetAllByProjectID(project?._id?.toString() as string, ifaceFilter) ?? [];
		relevNcidList = new Set<string>(ifaceNetclasses.map(a => a._id?.toString() as string))
	}
	
	if(constraintType === ConstraintTypesEnum.Physical) {
		if (!ifaceId || ifaceId === 'undefined' || ifaceId.trim().length === 0) {
			throw new Error(`Cannot process constraints copy-over. A valid interfaceId is required.`);
		}

		let tempUpdLGCMap = new Map<string, LayerGroupConstraints>();
		let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
		let srcInfilter = { constraintType: ConstraintTypesEnum.Physical, ruleAreaId: srcRA.id, ownerElementId: { $in: Array.from(relevNcidList) } as any } as Filter<LayerGroupConstraints>;
		let srcRelevLgcList = await lgcRepo.GetAllByProjectID(project?._id?.toString() as string, srcInfilter) ?? []

		let destInfilter = { constraintType: ConstraintTypesEnum.Physical, ruleAreaId: destRA.id, ownerElementId: { $in: Array.from(relevNcidList) } as any } as Filter<LayerGroupConstraints>;
		let destRelevLgcList = await lgcRepo.GetAllByProjectID(project?._id?.toString() as string, destInfilter) ?? []

		if(srcRelevLgcList.length !== destRelevLgcList.length) {
			throw new Error(`Could not complete Physical constraints copy-over. Incorrect data detected. Number of source constraint elements should equal nuumber of destination constraint elements`)
		}

		//potentially expendive
		for(let j = 0; j < destRelevLgcList.length; j++) {
			let dLgc = destRelevLgcList[j]
			let correspSrcLGC = srcRelevLgcList.find(k => ((k.ownerElementId === dLgc.ownerElementId) && (k.layerGroupId === dLgc.layerGroupId)))
			if(correspSrcLGC && correspSrcLGC.associatedProperties && correspSrcLGC.associatedProperties.length > 0) {
				let propMapByName = new Map<string, PropertyItem>(correspSrcLGC.associatedProperties.map(p => [p.name.toUpperCase().trim(), p]))
				for(let p = 0; p < dLgc.associatedProperties.length; p++) {
					let matchedProp = propMapByName.get(dLgc.associatedProperties[p].name.toUpperCase().trim())
					if(matchedProp) {
						(dLgc.associatedProperties[p].value as ConstraintValues).customValue = (matchedProp.value as ConstraintValues).customValue;
						tempUpdLGCMap.set(dLgc._id?.toString() as string, dLgc);
					}
				}
			} 
		}

		if(tempUpdLGCMap.size > 0) {
			let updArr = Array.from(tempUpdLGCMap.values());
			await updateLGC(updArr, user);
		}
	}
	else if(constraintType === ConstraintTypesEnum.Clearance) {
		let srcFilter = { ruleAreaId: srcRA.id }
		let destFilter = { ruleAreaId: destRA.id }

		let srcC2cr = await c2crRepo.GetAllByProjectID(project?._id?.toString() as string, srcFilter);
		let destC2cr = await c2crRepo.GetAllByProjectID(project?._id?.toString() as string, destFilter);
		if(ifaceId && ifaceId.length > 0 && relevNcidList.size > 0) {
			destC2cr = destC2cr.filter(x => relevNcidList.has(x.netclassId))
		}

		let srcMapping = new Map<string, C2CRow>();
		srcC2cr.forEach(a => srcMapping.set(a.netclassId, a))

		for(let i = 0; i < destC2cr.length; i++) {
			let srcSlots = srcMapping.get(destC2cr[i].netclassId)?.slots
			if(srcSlots) {
				destC2cr[i].slots = srcSlots;
			}
			else {
				throw new Error(`Could not complete C2C-relations copy-over. Incorrect data detected. Source rule area: ${srcRA.ruleAreaName}; NetclassId: ${destC2cr[i].netclassId}`)
			}
		}

		await c2crRepo.ReplaceMany(destC2cr);
	}

	return true;
}














//==============================================================

		// for(let lnk of project.physicalLinkages) {
		// 	if(typeToSrcElementInfoMap.get(ConstraintTypesEnum.Physical)?.has(lnk.ruleAreaId) === false) {
		// 		typeToSrcElementInfoMap.get(ConstraintTypesEnum.Physical)?.set(lnk.ruleAreaId, new Set())
		// 	} 
		// 	typeToSrcElementInfoMap.get(ConstraintTypesEnum.Physical)?.get(lnk.ruleAreaId)?.add(lnk.sourceElementId)
		// }
		// for(let lnk of project.clearanceLinkages) {
		// 	if(typeToSrcElementInfoMap.get(ConstraintTypesEnum.Clearance)?.has(lnk.ruleAreaId) === false) {
		// 		typeToSrcElementInfoMap.get(ConstraintTypesEnum.Clearance)?.set(lnk.ruleAreaId, new Set())
		// 	} 
		// 	typeToSrcElementInfoMap.get(ConstraintTypesEnum.Clearance)?.get(lnk.ruleAreaId)?.add(lnk.sourceElementId)
		// }

//============================================================================

// export async function switchUpLayerGroupSet(projectId: string, elementId: string, switchToLGSetId: string) : Promise<boolean> {
// 	//NOTE: project linkages are handled here as well...	
// 	let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
// 	let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);

// 	let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
// 	let lgc = await lgcRepo.GetAnyOne(projectId, {ownerElementId: elementId } as Filter<LayerGroupConstraints>)
// 	if(!lgc || (lgc.constraintType !== ConstraintTypesEnum.Physical && lgc.constraintType !== ConstraintTypesEnum.Clearance)) {
// 		throw new Error(`Could not update layer group set. No valid constraint exists for the element identifier provided`);
// 	}

// 	let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
// 	let pkg = await pkgRepo.GetOneByProjectID(projectId)
// 	if(!pkg) { 
// 		throw new Error(`Failed to retrieve valid layout info.`) 
// 	}
// 	if(pkg.layerGroupSets.every(a => a.id !== switchToLGSetId)) {
// 		throw new Error(`Could not update layer group set. The specified NEW layer group set is not associated with the current project`);
// 	}

// 	let project = await projRepo.GetWithId(projectId);
// 	let response = false;

// 	if(lgc.constraintType === ConstraintTypesEnum.Physical) {
// 		let netclassList = new Array<Netclass>();
// 		let involvedPhyLinkage = project.physicalLinkages.find(a => a.value.includes(elementId));
		
// 		if(involvedPhyLinkage) {
// 			let ncObjIds = involvedPhyLinkage.value.map((x) => new ObjectId(x));
// 			let infilter = { _id: { $in: ncObjIds } };
// 			netclassList = await netclassRepo.GetAllByProjectID(projectId, infilter) ?? [];
// 			if(!netclassList || netclassList.length === 0) {
// 				throw new Error(`Could not update layer group set. No linked netclass found for the specified netclass/element ID`);
// 			}
// 		}
// 		else {
// 			let netclass = await netclassRepo.GetWithId(elementId);
// 			if(!netclass) {
// 				throw new Error(`Could not update layer group set. No netclass found for the specified netclass/element ID`);
// 			}
// 			netclassList.push(netclass);
// 		}

// 		for(let i = 0; i < netclassList.length; i++) {
// 			netclassList[i].layerGroupSetId = switchToLGSetId;
// 			netclassList[i].lastUpdatedOn = new Date();
// 		}
		
// 		response = await netclassRepo.ReplaceMany(netclassList, false)
// 	}
// 	else if(lgc.constraintType === ConstraintTypesEnum.Clearance) {				
// 		let clrBrandArray = new Array<BasicProperty>()
// 		let involvedClrLinkage = project.clearanceLinkages.find(a => a.value.includes(elementId));

// 		if(involvedClrLinkage) {
// 			clrBrandArray = project.clearanceRelationBrands.filter(a => involvedClrLinkage.value.includes(a.id))
// 			if(!clrBrandArray || clrBrandArray.length === 0) {
// 				throw new Error(`Could not update layer group set. No linked clearance relation info found for the specified ID`);
// 			}
// 		}
// 		else {
// 			if(!project.clearanceRelationBrands || project.clearanceRelationBrands.every((a: BasicProperty) => a.id !== elementId)) {
// 				throw new Error(`Could not update layer group set. No clearance relation info was found for the specified ID`);
// 			}
// 			clrBrandArray = project.clearanceRelationBrands.filter(x => (x.id === elementId));
// 		}

// 		let clrRelBrandIds = new Set<string>(clrBrandArray.map(a => a.id))
// 		for(let i = 0; i < project.clearanceRelationBrands.length; i++) {
// 			if(clrRelBrandIds.has(project.clearanceRelationBrands[i].id)) {
// 				project.clearanceRelationBrands[i].value = switchToLGSetId;
// 			}
// 		}
// 		let updatedProj = await updateProjectClearanceRelationBrands(project._id?.toString() as string, Array.from(project.clearanceRelationBrands))
// 		if(updatedProj) {
// 			response = (updatedProj && updatedProj._id) ? true : false;
// 		}
// 	}

// 	assessLinkageRelatedLGCs(projectId, null, true); //do not wait on this...

// 	return response;
// }

//==============================================================================



// if(forceFillAssignmentType === true) {
// 	for(let i = 0; i < c2crElement.slots.length; i++) {
// 		if(!c2crElement.slots[i].assignmentType || c2crElement.slots[i].assignmentType?.trim().length === 0) {
// 			if(c2crElement.slots[i].value && c2crElement.slots[i].value.trim().length > 0) {
// 				c2crElement.slots[i].assignmentType = DataMappingTypeEnum.Manual;
// 			}
// 			else {
// 				c2crElement.slots[i].assignmentType = DataMappingTypeEnum.Unmapped;
// 			}
// 		}
// 	}
// }

// let theAllSlot = c2crElement.slots.find(a => a.name.toUpperCase() === C2C_ROW_ALLCOLUMN_SLOT_NAME)
			
	// c2crElement.slots = c2crElement.slots.filter(a => a.name.toUpperCase() !== C2C_ROW_ALLCOLUMN_SLOT_NAME)


	// c2crElement.slots = sort(c2crElement.slots).asc(a => (ncIdToNameMapping.get(a.netclassId) as string)?.toUpperCase());



//=========================

// let relatedElemLgcCollection = new Array<LayerGroupConstraints>();
// if(lnk.confineToRuleArea === true) {
// 	if(linkedElemId !== srcElement) { 
// 		relatedElemLgcCollection = lgcArr.filter(a => ((a.ruleAreaId === raid) && (a.ownerElementId === linkedElemId) && lgIdColl.has(a.layerGroupId)));
// 	}
// }
// else {
// 		if((linkedElemId !== srcElement) || (linkedElemId === srcElement) &&  ()
// 		relatedElemLgcCollection = lgcArr.filter(a => ((a.ownerElementId === linkedElemId) && lgIdColl.has(a.layerGroupId)));
	
// }

// if(relatedElemLgcCollection && relatedElemLgcCollection.length > 0) {
// 	lnkAssocElemInfoMap.get(lnk.id)?.set(linkedElemId, relatedElemLgcCollection);
// }

//==================


// if(linkedElemId !== srcElement) { //important!
// 	let relatedElemLgcCollection = new Array<LayerGroupConstraints>();
// 	if(lnk.confineToRuleArea === true) {
// 		relatedElemLgcCollection = lgcArr.filter(a => ((a.ruleAreaId === raid) && (a.ownerElementId === linkedElemId) && lgIdColl.has(a.layerGroupId)));
// 	}
// 	else {
// 		relatedElemLgcCollection = lgcArr.filter(a => ((a.ownerElementId === linkedElemId) && lgIdColl.has(a.layerGroupId)));
// 	}

// 	if(relatedElemLgcCollection && relatedElemLgcCollection.length > 0) {
// 		lnkAssocElemInfoMap.get(lnk.id)?.set(linkedElemId, relatedElemLgcCollection);
// 	}
// }

//====================================





// export async function copyConstraintsToAnotherRuleArea2(project: Project, srcRA: RuleArea, destRA: RuleArea, constraintType: ConstraintTypesEnum, ifaceId: string) : Promise<boolean> {
// 	let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
// 	let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)

// 	if(constraintType === ConstraintTypesEnum.Physical) {
// 		if (!ifaceId || ifaceId === 'undefined' || ifaceId.trim().length === 0) {
// 			throw new Error(`Cannot process constraints copy-over. A valid interfaceId is required.`);
// 		}

		
// 	}
// 	else if(constraintType === ConstraintTypesEnum.Clearance) {
// 		let srcFilter = { ruleAreaId: srcRA.id }
// 		let destFilter = { ruleAreaId: destRA.id }
		
// 		let srcC2cr = await c2crRepo.GetAllByProjectID(project?._id?.toString() as string, srcFilter);
// 		let destC2cr = await c2crRepo.GetAllByProjectID(project?._id?.toString() as string, destFilter);
		
// 		let srcMapping = new Map<string, C2CRow>();
// 		srcC2cr.forEach(a => srcMapping.set(a.netclassId, a))

// 		let relevNcidList = new Set<string>();
// 		if(ifaceId && ifaceId.length > 0) {
// 			let ifaceFilter = { interfaceId: ifaceId }
// 			let ifaceNetclasses = await netclassRepo.GetAllByProjectID(project?._id?.toString() as string, ifaceFilter) ?? [];
// 			relevNcidList = new Set<string>(ifaceNetclasses.map(a => a._id?.toString() as string))
// 		}

// 		for(let i = 0; i < destC2cr.length; i++) {
// 			let srcSlots : C2CRowSlot[] | undefined;
			
// 			if(ifaceId && ifaceId.length > 0 && relevNcidList.size > 0) {
// 				if(relevNcidList.has(destC2cr[i].netclassId)) {
// 					srcSlots = srcMapping.get(destC2cr[i].netclassId)?.slots
// 				}
// 			}
// 			else {
// 				srcSlots = srcMapping.get(destC2cr[i].netclassId)?.slots
// 			}
			
// 			if(srcSlots) {
// 				destC2cr[i].slots = srcSlots;
// 			}
// 			else {
// 				throw new Error(`Could not complete C2C-relations copy-over. Incorrect data detected. Source rule area: ${srcRA.ruleAreaName}; NetclassId: ${destC2cr[i].netclassId}`)
// 			}
// 		}

// 		await c2crRepo.ReplaceMany(destC2cr);
// 	}

// 	return true;
// }






// let srcLgcItem = inputLGCMapping.get(lgc._id?.toString() as string)
// if(srcLgcItem) {
// 	srcLgcMappedByLG.set(lgc.layerGroupId, srcLgcItem) //It is expected that the items found at this stage will be unique by 'layerGroupId'
// }
// else {
// 	srcLgcMappedByLG.set(lgc.layerGroupId, lgc) //It is expected that the items found at this stage will be unique by 'layerGroupId'
// }
												
	





	// let typeToLgcArrMap = new Map<ConstraintTypesEnum, Map<string, LayerGroupConstraints[]>>();
	// typeToLgcArrMap.set(ConstraintTypesEnum.Physical, new Map<string, LayerGroupConstraints[]>())
	// typeToLgcArrMap.set(ConstraintTypesEnum.Clearance, new Map<string, LayerGroupConstraints[]>())


	// let srcLgcList = lgcArr.filter(a => ((a.ownerElementId === srcElement) && lgIdColl.has(a.layerGroupId)))
	// 							let groupedByLG = groupBy(srcLgcList, x => x.layerGroupId);


//================================

	// if(!inputLGCs || inputLGCs === null || inputLGCs.length === 0){
	// 	for(let item of project.physicalLinkages) {

	// 	}
	// }

	// let allLinkages = (project.physicalLinkages ?? []).concat(project.clearanceLinkages ?? [])



	// ownerElementId: string,
    // ruleAreaId: string;
    // layerGroupId: string;
    // constraintType: ConstraintTypesEnum;


				// let map = new Map<ConstraintTypesEnum, Map<string, [Set<string>, LayerGroupConstraints[]]>>();
				// map.set(ConstraintTypesEnum.Physical, new Map<string, [Set<string>, LayerGroupConstraints[]]>())
				// map.set(ConstraintTypesEnum.Clearance, new Map<string, [Set<string>, LayerGroupConstraints[]]>())

				// if(inputLGCs && inputLGCs.length > 0) {
				// 	for(let lgc of inputLGCs) {
				// 		if(map.get(lgc.constraintType)?.has(lgc.ruleAreaId) === false) {
				// 			map.get(lgc.constraintType)?.set(lgc.ruleAreaId, [new Set(), []])
				// 		} 
				// 		map.get(lgc.constraintType)?.get(lgc.ruleAreaId)?.[0].add(lgc.ownerElementId)
				// 	}
				// }
				// else {
				// 	// for(let lnk of project.physicalLinkages) {
				// 	// 	if(map.get(ConstraintTypesEnum.Physical)?.has([lnk.sourceElementId, lnk.ruleAreaId ]) === false) {
				// 	// 		map.get(ConstraintTypesEnum.Physical)?.set([lnk.sourceElementId, lnk.ruleAreaId ], new Array<LayerGroupConstraints>())
				// 	// 	}
				// 	// }
				// 	// for(let lnk of project.clearanceLinkages) {
				// 	// 	if(map.get(ConstraintTypesEnum.Clearance)?.has([lnk.sourceElementId, lnk.ruleAreaId ]) === false) {
				// 	// 		map.get(ConstraintTypesEnum.Clearance)?.set([lnk.sourceElementId, lnk.ruleAreaId ], new Array<LayerGroupConstraints>())
				// 	// 	}
				// 	// }
				// }

				// let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
				
				// for(let [type, infoMap] of map) {
				// 	if(infoMap.size > 0) {
				// 		for(let [raid, dataTuple] of infoMap) {
				// 			let filter = { constraintType: type, ruleAreaId: raid, ownerElementId: { $in: Array.from(dataTuple[0]) } } as Filter<LayerGroupConstraints>
				// 			let lgcArr = await lgcRepo.GetAllByProjectID(projectId, filter)
				// 			if(lgcArr && lgcArr.length > 0) {
				// 				map.get(type)?.set(raid, [dataTuple[0], lgcArr])
				// 			}
				// 		}
				// 	}
				// }

				// for(let [type, infoMap] of map) {
				// 	if(infoMap.size > 0) {
				// 		for(let [raid, dataTuple] of infoMap) {
				// 			if(dataTuple[0].size > 0) {
				// 				for(let srcElement of dataTuple[0]) {
				// 					let lnk : LinkageInfo|undefined;
				// 					let lgsetId : string|undefined = "";

				// 					if(type === ConstraintTypesEnum.Physical) {
				// 						lnk = project.physicalLinkages.find(x => x.value.includes(srcElement));
				// 						lgsetId = netclassList.find(a => a._id?.toString() === srcElement)?.layerGroupSetId
				// 					}
				// 					else if(type === ConstraintTypesEnum.Clearance) {
				// 						lnk = project.clearanceLinkages.find(x => x.value.includes(srcElement));
				// 						lgsetId = project.clearanceRelationBrands.find(a => a.id === srcElement)?.value
				// 					}

				// 					if(lnk && lgsetId && lgsetId.length > 0) {
				// 						let lgIdStrArr = new Set<string>((pkg.layerGroupSets.find(a => a.id === lgsetId)?.layerGroups?.map(a => a.id) ?? []))
				// 						let lgcList = dataTuple[1].filter(a => ((a.ownerElementId === srcElement) && lgIdStrArr.has(a.layerGroupId)))

				// 						lnk.values.
				// 					}
				// 				}
				// 			}
				// 		}
				// 	}
				// }

	//=============================
	// let map = new Map<ConstraintTypesEnum, Map<string, Map<string, LayerGroupConstraints[]>>>();
	// map.set(ConstraintTypesEnum.Physical, new Map<string, Map<string, LayerGroupConstraints[]>>())
	// map.set(ConstraintTypesEnum.Clearance, new Map<string, Map<string, LayerGroupConstraints[]>>())

	// if(inputLGCs && inputLGCs.length > 0) {
	// 	for(let lgc of inputLGCs) {
	// 		if(map.get(lgc.constraintType)?.has(lgc.ruleAreaId) === false) {
	// 			map.get(lgc.constraintType)?.set(lgc.ruleAreaId, new Map<string, LayerGroupConstraints[]>())
	// 		} 
	// 		if(map.get(lgc.constraintType)?.get(lgc.ruleAreaId)?.has(lgc.ownerElementId) === false) {
	// 			map.get(lgc.constraintType)?.get(lgc.ruleAreaId)?.set(lgc.ownerElementId, new Array<LayerGroupConstraints>())
	// 		} 
	// 	}
	// }
	// else {
	// 	for(let lnk of project.physicalLinkages) {
	// 		if(map.get(ConstraintTypesEnum.Physical)?.has([lnk.sourceElementId, lnk.ruleAreaId ]) === false) {
	// 			map.get(ConstraintTypesEnum.Physical)?.set([lnk.sourceElementId, lnk.ruleAreaId ], new Array<LayerGroupConstraints>())
	// 		}
	// 	}
	// 	for(let lnk of project.clearanceLinkages) {
	// 		if(map.get(ConstraintTypesEnum.Clearance)?.has([lnk.sourceElementId, lnk.ruleAreaId ]) === false) {
	// 			map.get(ConstraintTypesEnum.Clearance)?.set([lnk.sourceElementId, lnk.ruleAreaId ], new Array<LayerGroupConstraints>())
	// 		}
	// 	}
	// }





	//----------------
	
	// let map = new Map<ConstraintTypesEnum, Map<[string, string], LayerGroupConstraints[]>>([
	// 	[ConstraintTypesEnum.Physical, new Map<[string, string], LayerGroupConstraints[]>()],
	// 	[ConstraintTypesEnum.Clearance, new Map<[string, string], LayerGroupConstraints[]>()],
	// ]);

	// if(inputLGCs && inputLGCs.length > 0) {
	// 	for(let lgc of inputLGCs) {
	// 		if(map.get(lgc.constraintType)?.has([lgc.ownerElementId, lgc.ruleAreaId ]) === false) {
	// 			map.get(lgc.constraintType)?.set([lgc.ownerElementId, lgc.ruleAreaId ], new Array<LayerGroupConstraints>())
	// 		}
	// 	}
	// }
	// else {
	// 	for(let lnk of project.physicalLinkages) {
	// 		if(map.get(ConstraintTypesEnum.Physical)?.has([lnk.sourceElementId, lnk.ruleAreaId ]) === false) {
	// 			map.get(ConstraintTypesEnum.Physical)?.set([lnk.sourceElementId, lnk.ruleAreaId ], new Array<LayerGroupConstraints>())
	// 		}
	// 	}
	// 	for(let lnk of project.clearanceLinkages) {
	// 		if(map.get(ConstraintTypesEnum.Clearance)?.has([lnk.sourceElementId, lnk.ruleAreaId ]) === false) {
	// 			map.get(ConstraintTypesEnum.Clearance)?.set([lnk.sourceElementId, lnk.ruleAreaId ], new Array<LayerGroupConstraints>())
	// 		}
	// 	}
	// }

	
	//============
				// let phyDataInfo = new Array<{ ownerElementId: string, ruleAreaId: string }>();
				// let clrDataInfo = new Array<{ ownerElementId: string, ruleAreaId: string }>();
				
				// if(inputLGCs && inputLGCs.length > 0) {
				// 	let dataInfo = inputLGCs.map(a => ({ownerElementId: a.ownerElementId, ruleAreaId: a.ruleAreaId }))
				// 	if(inputLGCs[0].constraintType === ConstraintTypesEnum.Physical) {phyDataInfo = dataInfo }
				// 	else if (inputLGCs[0].constraintType === ConstraintTypesEnum.Clearance) {clrDataInfo = dataInfo }
				// }
				// else {
				// 	phyDataInfo = project.physicalLinkages.map(x => ({ownerElementId: x.sourceElementId, ruleAreaId: x.ruleAreaId }))
				// 	clrDataInfo = project.clearanceLinkages.map(x => ({ownerElementId: x.sourceElementId, ruleAreaId: x.ruleAreaId }))
				// }

				// if(phyDataInfo.length > 0) {
				// 	for (let inf of phyDataInfo) {
				// 		let lnk = project.physicalLinkages.find(a => a.value.includes(inf.ownerElementId))

				// 	}
				// }










// if(!project.clearanceRelationBrands || project.clearanceRelationBrands.every((a: BasicProperty) => a.id !== elementId)) {
// 	throw new Error(`Could not update layer group set. No clearance relation info was found for the specified ID`);
// }
// for(let i = 0; i < project.clearanceRelationBrands.length; i++) {
// 	if((project.clearanceRelationBrands[i] as BasicProperty).id === elementId) {
// 		project.clearanceRelationBrands[i].value = switchToLGSetId;
// 		let updatedProj = await updateProjectClearanceRelationBrands(project, Array.from(project.clearanceRelationBrands))
// 		//let updatedProj = await updateProjectPropertyCategoryInFull(projectId, ProjectPropertyCategoryEnum.CLEARANCE_RELATION, [clrRelContainerProp])
// 		if(updatedProj) {
// 			return (updatedProj && updatedProj._id) ? true : false;
// 		}
// 	}
// }


//=============================================================

// // let srcRelMapping = new Map<string, BasicProperty[]>()
// let relevClrRel = new Map<string, BasicProperty>();
// let srcNetClassIDs = new Set<string>(incomingDataMapping?.get(IFACE_COPY_NETCLASS_MAPPING)?.values() ?? [])
// for(let srcRaid of incomingDataMapping?.get(IFACE_COPY_RULEAREA_MAPPING)?.values() ?? []) {
// 	let relsForIface = await getClassRelationNameElementsForInterface(srcProject, sourceIfaceId, srcRaid) ?? [];
// 	// let relIds = new Set<string>(relsForIface.map(x => x.id))
// 	// if(relsForIface && relsForIface.length > 0) {
// 	// 	srcRelMapping.set(srcRaid, relsForIface);
// 	// }


// 	let srcC2CRowsForIfaceAndRA = await getClassRelationLayout(sourceProjectId, null, Number.MAX_SAFE_INTEGER, srcRaid, sourceIfaceId, null, null, false) ?? [];
	
	
// 	for(let srcC2C of srcC2CRowsForIfaceAndRA) {
// 		for(let srcSlot of srcC2C.slots) {
// 			if(srcSlot.netclassId && srcNetClassIDs.has(srcC2C.netclassId) && srcSlot.value && srcSlot.value.trim().length > 0) { //means it is within interface
// 				let foundRel = relsForIface.find(a => a.id.toLowerCase() === srcSlot.value.toLowerCase());
// 				if(foundRel) {
// 					relevClrRel.set(foundRel.id, foundRel);
// 				}
// 			}
// 			else if (srcSlot.name === C2C_ROW_ALLCOLUMN_SLOT_NAME) {

// 			}
// 		}
// 	}
// }





// for(let i = 0; i < updatedLGCs.length; i++) {
// 	let changeCtx : ChangeContext = {
// 		groupId: updatedLGCs[0].projectId,
// 		uniqueId: updatedLGCs[i]._id?.toString() as string,
// 		notes: "",
// 		contextProperties: [],
// 		data: updatedLGCs[i],
// 		diffContext: []
// 	}
// 	saveLatestVersion(changeCtx);
// }




// constraintSettings: {
// 	$filter: {
// 	  input: "$constraintSettings",
// 	  as: "constrSetting",
// 	  cond: { $eq: ["$$constrSetting.category", ConstraintTypesEnum.Physical] }
// 	}
//   }



//emptySlotsForAllNetclasses = emptySlotsForAllNetclasses.sort((a, b) => ((ncIdToNameMapping.get(a.netclassId) as string) < (ncIdToNameMapping.get(b.netclassId) as string)) ? -1 : 1);
			

//c2crElement.slots = c2crElement.slots.sort((a, b) => ((ncIdToNameMapping.get(a.netclassId) as string) < (ncIdToNameMapping.get(b.netclassId) as string)) ? -1 : 1);
		