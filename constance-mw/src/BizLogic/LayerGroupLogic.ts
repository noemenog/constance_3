import { sort } from "fast-sort";
import { AppConfigConstants, DBCollectionTypeEnum, GOLDEN_INDICATOR_NAME, ConstraintChangeActionEnum, LGConstants, StackupRoutingLayerTypeEnum, StackupLayerTypeEnum, NamingContentTypeEnum, StackupSideEnum, LGSET_TAG_SORT } from "../Models/Constants";
import { BasicKVP, BasicProperty, ConfigItem } from "../Models/HelperModels";
import { Layer, LayerGroup, LayerGroupSet, Netclass, PackageLayout, Project, StackupLayer } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { getGenConfigs } from "./ConfigLogic";
import { pushDefaultConstraints } from "./DefaultConstraintsLogic";
import { updateProjectClearanceRelationBrands } from "./ProjectLogic";
import { copyOverLayerGroupConstraintValues, performConstraintsAssessmentForLayerGroupAction, sortSlots, switchUpLayerGroupSet } from "./ConstraintsMgmtLogic";
import { checkDuplicatesIgnoreCase, isNotNullOrEmptyOrWS, rfdcCopy, verifyNaming } from "./UtilFunctions";
import { createAutoGenSnapshot } from "./SnapShotLogic";




export async function generateLayerGroups(project: Project, layers: StackupLayer[], performSepFSBSGrouping: boolean) : Promise<LayerGroup[]> {
    let layerGroups = new Array<LayerGroup>();
    let groupedLayers = new Array<string>();

    //get naming strategy from configs
    let genConfigs : ConfigItem[] = await getGenConfigs(project._id?.toString() as string, project.org, false);
    let confSupportedStgs = genConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__Supported_LayerGroup_Naming_Strategies.toLowerCase())?.configValue ?? []
    let confLgNamingStg = genConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__LayerGroup_Naming_Strategy.toLowerCase())?.configValue ?? null
    let namingStrategy : BasicKVP = { key: LGConstants.Strategy_GENERIC, value: "LG"}; 
    if(confSupportedStgs && confSupportedStgs.length > 0) {
        confSupportedStgs = confSupportedStgs.map((a: string) => a.toUpperCase().trim());
        if(confLgNamingStg && confLgNamingStg.strategy && confLgNamingStg.strategy.length > 0 && confSupportedStgs.includes(confLgNamingStg.strategy.toUpperCase())){
            namingStrategy.key = confLgNamingStg.strategy.toUpperCase(), 
            namingStrategy.value = confLgNamingStg.prefix.toUpperCase();
        }
    }

    for (let fromLayerIdx = 1; fromLayerIdx < layers.length - 1; fromLayerIdx++) {
        let layerGroup : LayerGroup = {
            id: crypto.randomUUID(),
            name: '',
            isActive: true,
            layers: [],
            tags: [ "Auto" ],
        };

        let fromLayer = layers[fromLayerIdx];
        let fromLayerMinusOne = layers[fromLayerIdx - 1];
        let fromLayerPlusOne = layers[fromLayerIdx + 1];

        if (groupedLayers.includes(fromLayer.name) || isInvalidGroup(fromLayer, fromLayerMinusOne, fromLayerPlusOne)) {
            continue;
        }
        let lyr : Layer = {
            id: crypto.randomUUID(),
            name: fromLayer.name,
            isActive: true,
            tags: []
        }
        layerGroup.layers.push(lyr);
        
        //just for now....
        layerGroup.name = LGConstants.STRIPLINE + LGConstants.LAYER_GROUP_DELIM 
            + fromLayerMinusOne.thickness.toString() + LGConstants.LAYER_GROUP_DELIM + fromLayer.thickness.toString()
            + LGConstants.LAYER_GROUP_DELIM + fromLayerPlusOne.thickness.toString();
        
        groupedLayers.push(fromLayer.name);

        for (let toLayerIdx = fromLayerIdx + 1; toLayerIdx < layers.length - 1; toLayerIdx++) {
            let toLayer = layers[toLayerIdx];
            let toLayerMinusOne = layers[toLayerIdx - 1];
            let toLayerPlusOne = layers[toLayerIdx + 1];
            //skip non-routing layers
            if (isInvalidGroup(toLayer, toLayerMinusOne, toLayerPlusOne)) {
                continue;
            }
            
            //both from & to are now metal & routing & sandwiched between dielectrics
            if (fromLayer.thickness === toLayer.thickness) {
                if (
                    (fromLayerMinusOne.thickness === toLayerMinusOne.thickness && fromLayerPlusOne.thickness === toLayerPlusOne.thickness) ||
                    (fromLayerMinusOne.thickness === toLayerPlusOne.thickness && fromLayerPlusOne.thickness === toLayerMinusOne.thickness)
                    )
                {
                    //group
                    let lyr : Layer = {
                        id: crypto.randomUUID(),
                        name: toLayer.name,
                        isActive: true,
                        tags: []
                    }
                    layerGroup.layers.push(lyr);
                    groupedLayers.push(toLayer.name);
                }
            }
        }

        if (layerGroup.layers != null && layerGroup.layers.length > 0) {
            layerGroups.push(layerGroup);
        }
    }

    let result = renameAndSplitLayerGroups(layers, layerGroups, namingStrategy, performSepFSBSGrouping);
    ensureLayerGroupUniqueness(result);

    return result;
}


function renameAndSplitLayerGroups(allLayers: StackupLayer[], layerGroups: LayerGroup[], namingStrategy: BasicKVP, performSepFSBSGrouping: boolean) : LayerGroup[] {
    let newLayerGroups = new Array<LayerGroup>();
    
    let frontLayerNames = new Set(allLayers.filter(a => a.side === StackupSideEnum.Front).map(a => a.name));
    let backLayerNames = new Set(allLayers.filter(a => a.side === StackupSideEnum.Back).map(a => a.name));

    for (let i = 0; i < layerGroups.length; i++) {
        let layerGroup : LayerGroup = layerGroups[i];
        
        if (layerGroup.layers.every(lyr => LGConstants.MicroStripLayerNames.includes(lyr.name))) {
            let relevLGs = considerFsBsSplitOff(performSepFSBSGrouping, layerGroup, frontLayerNames, backLayerNames);
            for (let lg of relevLGs) {
                let namedLG = setLayerGroupName(namingStrategy, newLayerGroups, lg, false);
                newLayerGroups.push(namedLG);
            }
        }
        else if (layerGroup.layers.some(lyr => LGConstants.MicroStripLayerNames.includes(lyr.name))) {
            let microStripLayers = layerGroup.layers.filter(lyr => LGConstants.MicroStripLayerNames.includes(lyr.name));
            layerGroup.layers = layerGroup.layers.filter(lyr => (LGConstants.MicroStripLayerNames.includes(lyr.name) === false));
            
            if(microStripLayers && microStripLayers.length > 0) {
                let splitOffMicroStripLayerGroup : LayerGroup = {
                    id: crypto.randomUUID(),
                    name: layerGroup.name, //temporarily
                    isActive: layerGroup.isActive,
                    layers: [...microStripLayers],
                    tags: [...layerGroup.tags],
                };
                
                splitOffMicroStripLayerGroup = setLayerGroupName(namingStrategy, newLayerGroups, splitOffMicroStripLayerGroup, true);
                newLayerGroups.push(splitOffMicroStripLayerGroup);
            }

            let relevLGs = considerFsBsSplitOff(performSepFSBSGrouping, layerGroup, frontLayerNames, backLayerNames);
            for (let lg of relevLGs) {
                let namedLG = setLayerGroupName(namingStrategy, newLayerGroups, lg, false);
                newLayerGroups.push(namedLG);
            }
        }
        else {
            let relevLGs = considerFsBsSplitOff(performSepFSBSGrouping, layerGroup, frontLayerNames, backLayerNames);
            for (let lg of relevLGs) {
                let namedLG = setLayerGroupName(namingStrategy, newLayerGroups, lg, false);
                newLayerGroups.push(namedLG);
            }
        }
    }

    return newLayerGroups;
}


function considerFsBsSplitOff(performSepFSBSGrouping: boolean, layerGroup: LayerGroup, frontLayerNames: Set<string>, backLayerNames: Set<string>) : Array<LayerGroup> {
    let returnLGs = new Array<LayerGroup>();

    if (performSepFSBSGrouping === true) {
        let fronters = layerGroup.layers.filter(a => frontLayerNames.has(a.name));
        let backers = layerGroup.layers.filter(a => backLayerNames.has(a.name));
        let others = layerGroup.layers.filter(a => (frontLayerNames.has(a.name) === false) && (backLayerNames.has(a.name) === false));
        
        if (fronters.length > 0 && backers.length > 0 && others.length === 0) {
            layerGroup.layers = fronters;
            let fsbsSplitOffLG: LayerGroup = {
                id: crypto.randomUUID(),
                name: layerGroup.name.trim() + "_X", //temporarily
                isActive: layerGroup.isActive,
                layers: [...backers],
                tags: [...layerGroup.tags],
            };

            returnLGs.push(layerGroup);
            returnLGs.push(fsbsSplitOffLG);
        }
        else {
            returnLGs.push(layerGroup);
        }
    }
    else {
        returnLGs.push(layerGroup)
    }

    return returnLGs;
}


function setLayerGroupName(namingStrategy: BasicKVP, collectedLayerGroups: LayerGroup[], focusLayerGroup: LayerGroup, performStriplineReplacement: boolean) : LayerGroup {
    if(performStriplineReplacement) {
        focusLayerGroup.name = focusLayerGroup.name.replace(LGConstants.STRIPLINE, LGConstants.MICROSTRIP);
    }
    
    if (namingStrategy.key.toUpperCase() === LGConstants.Strategy_GENERIC) {
        focusLayerGroup.name = `${namingStrategy.value}_${collectedLayerGroups.length + 1}`;
    }
    else if (namingStrategy.key.toUpperCase() === LGConstants.Strategy_STRIP) {
        focusLayerGroup.name = focusLayerGroup.name.startsWith(LGConstants.STRIPLINE) 
        ? `${LGConstants.STRIPLINE}_${collectedLayerGroups.length + 1}`
        : `${LGConstants.MICROSTRIP}_${collectedLayerGroups.length + 1}`;
    }
    else if ((namingStrategy.key.toUpperCase() === LGConstants.Strategy_STRIP_WITH_THICKNESS)) {
        //DO Nothing -- this is already the default behavior
    }

    return focusLayerGroup;
}


function isInvalidGroup(layer: StackupLayer, layerMinusOne: StackupLayer, layerPlusOne: StackupLayer) : boolean {
    let check = (layer.routingLayerType === StackupRoutingLayerTypeEnum.None.toString() 
        || layer.routingLayerType == null 
        || layer.type != StackupLayerTypeEnum.Metal.toString() 
        || layerMinusOne.type === StackupLayerTypeEnum.Metal.toString() 
        || layerPlusOne.type === StackupLayerTypeEnum.Metal.toString() 
        || layer.thickness === 0 
        || layerMinusOne.thickness === 0 
        || layerPlusOne.thickness === 0)

    return check
}


function ensureLayerGroupUniqueness(lyrGrps: LayerGroup[]) {
    let nameSet = new Set(lyrGrps.map(a => a.name))
    let idSet = new Set(lyrGrps.map(a => a.id))

    if(nameSet.size !== lyrGrps.length) {
        throw new Error("Stackup generation failed to produce unique layer group names!");
    }
    if(idSet.size !== lyrGrps.length) {
        throw new Error("Stackup generation failed to produce unique layer group Ids!");
    }
}


export async function evaluateLGSetsForStackupChangeScenario(inputStackupLayers: StackupLayer[], pkg: PackageLayout, project: Project, performSepFSBSGrouping: boolean, freshest: boolean) {
    if (freshest === true) {
        let newLayerGroups: LayerGroup[] = await generateLayerGroups(project, inputStackupLayers, performSepFSBSGrouping);
        let lgSet: LayerGroupSet = {
            id: crypto.randomUUID(),
            name: GOLDEN_INDICATOR_NAME,
            isGolden: true,
            layerGroups: newLayerGroups,
            isPhysicalDefault: true,
            isClearanceDefault: true,
            tags: [GOLDEN_INDICATOR_NAME, LGSET_TAG_SORT], //important!!
        };
        pkg.layerGroupSets = [lgSet];
    }
    else {
        let isNoInputRoutingLayerSelected = inputStackupLayers.every(a => !a.routingLayerType || a.routingLayerType.trim().length === 0 || a.routingLayerType.trim().toLowerCase() === "none");
        let isNoExistingRoutingLayer = pkg.stackupLayers.every(x => !x.routingLayerType || x.routingLayerType.trim().length === 0 || x.routingLayerType.trim().toLowerCase() === "none");
    
        if ((isNoInputRoutingLayerSelected === false) || (isNoExistingRoutingLayer === false)) {
        
            let possiblyRestructuredLayerGroupings: LayerGroup[] = await generateLayerGroups(project, inputStackupLayers, performSepFSBSGrouping);

            if (pkg.layerGroupSets.length > 0) {
                await createAutoGenSnapshot(project?._id?.toString() as string);
                pkg.layerGroupSets = await handleStackupShakeup({ ...pkg }, project, possiblyRestructuredLayerGroupings);
            }
            else {
                let lgSet: LayerGroupSet = {
                    id: crypto.randomUUID(),
                    name: GOLDEN_INDICATOR_NAME,
                    isGolden: true,
                    layerGroups: possiblyRestructuredLayerGroupings,
                    isPhysicalDefault: true,
                    isClearanceDefault: true,
                    tags: [GOLDEN_INDICATOR_NAME, LGSET_TAG_SORT], //important!!
                };
                pkg.layerGroupSets = [lgSet];
            }
        }
    }
    
    return pkg;
}


export async function handleStackupShakeup(pkg: PackageLayout, project: Project, incomingNewLayerGroups: LayerGroup[]) : Promise<LayerGroupSet[]>{
    let projectId = project._id?.toString() as string;
    let existingGolden = pkg.layerGroupSets.find(a => (a.isGolden === true))
    let newerGoldenLGSet = rfdcCopy(existingGolden) as LayerGroupSet;
    let allGdLayerSet = new Set<string>()
    let customLGSetList : LayerGroupSet[] = pkg.layerGroupSets.filter(a => (a.isGolden === false))
    let finalLgSetColl = new Map<string, LayerGroupSet>();

    if(existingGolden && existingGolden.layerGroups) {
        
        //get a collection of all current layer names
        existingGolden.layerGroups.forEach(x => {
            x.layers.forEach(y => {
                allGdLayerSet.add(y.name.toLowerCase());
            })
        })

        if(incomingNewLayerGroups && incomingNewLayerGroups.length > 0) {
            let masterMapping = new Map<string, {lg: LayerGroup, correspArray: LayerGroup[]}>();
            let processedInc = new Map<string, LayerGroup>();
            let modIncomingLGs = rfdcCopy(incomingNewLayerGroups) as LayerGroup[];
            let modExistingGoldenLGs = rfdcCopy<LayerGroup[]>((existingGolden?.layerGroups as LayerGroup[] ?? [])) as LayerGroup[];
            
            for (let i = 0; i < modExistingGoldenLGs.length; i++) {
                let exLG = modExistingGoldenLGs[i];
                masterMapping.set(exLG.id, {lg: exLG, correspArray: []}) 

                let exLgLayerNamesLowcase = new Set<string>(exLG.layers.map(a => a.name.toLowerCase()))
                
                // get incoming lg where all layers are found in current existing LG --> map to current existing LG 
                let membersLGs = modIncomingLGs.filter(a => 
                    (a.layers.length <= exLG.layers.length) && a.layers.every(x => exLgLayerNamesLowcase.has(x.name.toLowerCase())))

                //otherwise, get all incoming layers where some are mapped to current existing LG an the rest were never part of existing Golden 
                //    hence (freshly selected as a routing layer) --> map these to existing LG 
                if(!membersLGs || membersLGs.length === 0) {
                    let revMember = modIncomingLGs.find(a => {
                        let incNames = new Set<string>(a.layers.map(v => v.name.toLowerCase()));
                        let moreIncLyrs = (a.layers.length > exLG.layers.length);
                        let hasAllExLgLyrs = Array.from(exLgLayerNamesLowcase).every(w => incNames.has(w))
                        return (moreIncLyrs && hasAllExLgLyrs) ? true : false;
                    })
                
                    if(revMember) {
                        let addedLayers = revMember.layers.filter(p => (exLgLayerNamesLowcase.has(p.name.toLowerCase()) === false))
                        if(addedLayers && (addedLayers.length > 0)) {
                            if(addedLayers.every(p => (allGdLayerSet.has(p.name.toLowerCase()) === false))) {
                                membersLGs = [revMember];
                            }
                        }
                    }
                }

                if(membersLGs && membersLGs.length > 0) {
                    // if true, it means there was a mapping between incoming LG(s) and an existing LG
                    masterMapping.set(exLG.id, {lg: exLG, correspArray: membersLGs})
                    membersLGs.forEach(x => { processedInc.set(x.id, x) })
                }
            }
            
            //now that we (possibly) have a extisting-to-new lg mapping that makes sense, we need to handle the data conversion etc...
            for(let [key, value] of masterMapping) {
                let exLG = value.lg
                let incCorrespLGList = value.correspArray
                if(incCorrespLGList && incCorrespLGList.length > 0) {
                    await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, incCorrespLGList);
                    await copyOverLayerGroupConstraintValues(projectId, pkg.ruleAreas, exLG, incCorrespLGList);
                    await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, [exLG]);
                }
                else {
                    await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, [exLG])
                }
            }

            //these are incoming layergroups with no true equivalent
            let brandNewLGs = modIncomingLGs.filter(a => processedInc.has(a.id) === false) ?? []
            if(brandNewLGs && brandNewLGs.length > 0) {
                await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, brandNewLGs); 
            }

            // handle custom layer group sets
            let goodLGSetIds = new Set<string>();
            if(customLGSetList && customLGSetList.length > 0) {
                for(let q = 0; q < customLGSetList.length; q++) {
                    let clgset = customLGSetList[q]
                    let goodLayerGroupIds = new Set<string>();
                    for(let g = 0; g < clgset.layerGroups.length; g++) {
                        let lgx = clgset.layerGroups[g]
                        if(masterMapping.has(lgx.id)) {
                            let coll = masterMapping.get(lgx.id)?.correspArray as LayerGroup[];
                            if(coll.length > 0) {
                                customLGSetList[q].layerGroups[g].id = coll[0].id as string  //Important to reassign the ID (knowingly using longer /explicit leftside - javascript is wierd)
                                goodLayerGroupIds.add(lgx.id);
                            }
                        }
                        
                        if(goodLayerGroupIds.has(lgx.id) === false) {
                            let equivBN = brandNewLGs.find(b => {
                                let bNewLyrNamesLC = new Set<string>(b.layers.map(n => n.name.toLowerCase()))
                                let lgNamesLC = lgx.layers.map(x => x.name.toLowerCase())
                                if(lgNamesLC.every(y => bNewLyrNamesLC.has(y))) {
                                    return true;
                                }
                                else {
                                    return false
                                }
                            });

                            if(equivBN && equivBN.id) {
                                customLGSetList[q].layerGroups[g].id = equivBN.id;  //Important to reassign the ID (knowingly using longer /explicit leftside - javascript is wierd)
                                goodLayerGroupIds.add(lgx.id);
                            }
                        }
                    }

                    if(clgset.layerGroups.every(a => goodLayerGroupIds.has(a.id))) {
                        goodLGSetIds.add(clgset.id)
                    }
                }

                customLGSetList = customLGSetList.filter(a => goodLGSetIds.has(a.id))  //Important! -- Super Important!!!!!!!!!
            }

            //construct collection of FINAL LGSets
            let newLGs = Array.from(processedInc.values()).concat(brandNewLGs)
            newerGoldenLGSet.layerGroups = sort(newLGs).asc(a => a.name?.toUpperCase());  
            ([newerGoldenLGSet, ...customLGSetList]).forEach(a => { finalLgSetColl.set(a.id, a) })

        }
        else {
            //This scenario cannot be allowed! It is important to prevent user from marking all layers as non-routing and then trying to save. 
            // If they do that, there are negative ramifications if interfaces and their netclasses, etc, have already been created.
            throw new Error(`Reassessment of layer grouping was not successful. The system failed to determine layer grouping based on routing layers. `
                + `Please make sure routing layers have been selected.`)
        }
    }
    else {
        throw new Error(`Cannot process reassessment of layer grouping. The system could not find a golden LGSet with non-empty layer groups`)
    }

    //reassess the lgsetIDs that are assigned to netclasses
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let netclasses = await netclassRepo.GetAllByProjectID(projectId) ?? [];
    let ncIdToNameMapping = new Map<string, string>();
    if(netclasses && netclasses.length > 0) {
        for(let n = 0; n < netclasses.length; n++) {
            ncIdToNameMapping.set(netclasses[n]._id?.toString() as string, netclasses[n].name) //might as well collect this while we're at it...
            if(netclasses[n].layerGroupSetId && (finalLgSetColl.has(netclasses[n].layerGroupSetId) === false)) {
                netclasses[n].layerGroupSetId = existingGolden.id;
            }
        }
        await netclassRepo.ReplaceMany(netclasses);
    }
    
    //reassess the lgsetIDs that are assigned to clearance relations
    if(project.clearanceRelationBrands && project.clearanceRelationBrands.length > 0){
        for(let c = 0; c < (project.clearanceRelationBrands as BasicProperty[]).length; c++) {
            let clrRelVal = project.clearanceRelationBrands[c].value;
            if(clrRelVal && (clrRelVal.length > 0) && (finalLgSetColl.has(clrRelVal) === false)) {
                project.clearanceRelationBrands[c].value = existingGolden.id; //knowingly using the explicit left side. leave as is.
            }
        }
        await updateProjectClearanceRelationBrands(project._id?.toString() as string, Array.from(project.clearanceRelationBrands))
    }
    
    //do the remaining needful...
    if(netclasses && netclasses.length > 0) {
        await pushDefaultConstraints(projectId)
        sortSlots(projectId) //for good measures...
    }

    let retVal = sort(Array.from(finalLgSetColl.values())).asc(x => x.name?.toUpperCase());
    return retVal;
}


export async function processLGSetChanges(inputPkg: PackageLayout): Promise<PackageLayout> {
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let existingPkg = await pkgRepo.GetOneByProjectID(inputPkg.projectId)     
    
    if(!existingPkg) {
        throw new Error("Cannot update layer grouping. Layout container is expected to exist but was not found for the project")
    }

    let existingGolden : LayerGroupSet | undefined = existingPkg.layerGroupSets.find(a => (a.isGolden === true))
    
    let addedLGSets : LayerGroupSet[] = inputPkg.layerGroupSets.filter(a => ((!a.id) || (a.id.trim().length === 0) || a.tags.includes("ADDED_LGSET"))) //IMPORTANT!
    let deletedLGSets :LayerGroupSet[] = existingPkg.layerGroupSets.filter(a => inputPkg.layerGroupSets.every(x => x.id !== a.id))
    let updatedLGSets : LayerGroupSet[] = inputPkg.layerGroupSets.filter(a => a.id && (a.id.length > 0) && existingPkg.layerGroupSets.some(x => x.id === a.id))
    let deletableNonGoldLGSetIdList = new Array<string>();
    let allIncomingLyrGroupMap = new Map<string, LayerGroup>()
    let allExistingLyrGroupMap = new Map<string, LayerGroup>()
    
    for(let lgSetIncoming of inputPkg.layerGroupSets) {
        for (let lyrGrpInput of lgSetIncoming.layerGroups) {
            allIncomingLyrGroupMap.set(lyrGrpInput.id, lyrGrpInput)
        }
    }
    
    for(let lgSetEx of existingPkg.layerGroupSets) {
        for (let lgEx of lgSetEx.layerGroups) {
            allExistingLyrGroupMap.set(lgEx.id, lgEx)
        }
    }

    let modPkg = {...existingPkg}
    
    if(addedLGSets && addedLGSets.length > 0) {
        //check if there are duplicate names
        let existingNames = modPkg?.layerGroupSets?.map(a => a.name) ?? []
        let namesForAdd = addedLGSets?.map(a => a.name) ?? []
        let duplCheckRes = checkDuplicatesIgnoreCase([...namesForAdd, ...existingNames])
        if(duplCheckRes === false) {
            throw new Error(`Duplicate LGSet names will occur. Request to add layer-group-set cannot be processed.`)
        }

        //check name validity
        verifyNaming(namesForAdd, NamingContentTypeEnum.LGSET)

        //cheap check for same layer grouping as golden copy
        let goldenLGIdList = Array.from(existingGolden?.layerGroups.map(a => a.id) ?? []) //fresh!
        if(goldenLGIdList && goldenLGIdList.length > 0){
            for(let i = 0; i < addedLGSets.length; i++){
                if(addedLGSets[i].layerGroups.some(a => (goldenLGIdList.includes(a.id) === false))){
                    throw new Error("All layer groups in a newly added LGSet must exist in the golden LGSet.")
                }
            }
        }

        //update mod version of pkg
        for(let i = 0; i < addedLGSets.length; i++) {
            addedLGSets[i].id = crypto.randomUUID()
            addedLGSets[i].tags = new Array<string>();
            modPkg.layerGroupSets.push(addedLGSets[i])
        }
        
    }

    if(updatedLGSets && updatedLGSets.length > 0) {
        let namesForUpdate = updatedLGSets?.map(a => a.name) ?? []
        //check if there are duplicate lgset names
        let namesForAdd = addedLGSets?.map(a => a.name) ?? []
        let duplCheckRes = checkDuplicatesIgnoreCase([...namesForUpdate, ...namesForAdd])
        if(duplCheckRes === false) {
            throw new Error(`Duplicate LGSet names will occur. Request to update cannot be processed.`)
        }

        //check LGSET name validity
        verifyNaming(namesForUpdate, NamingContentTypeEnum.LGSET) 

        for(let i = 0; i < updatedLGSets.length; i++) {
            //check if there are duplicate lg names
            let lgNames = updatedLGSets[i].layerGroups?.map(a => a.name) ?? []
            let duplCheckRes = checkDuplicatesIgnoreCase(lgNames)
            if(duplCheckRes === false) {
                throw new Error(`Duplicate layer group names found in LGSet '${updatedLGSets[i].name}'. Request to update cannot be processed.`)
            }

            //check LG name validity
            verifyNaming(lgNames, NamingContentTypeEnum.LAYER_GROUP) 

            //ensure lgs have Ids
            for(let q = 0; q < updatedLGSets[i].layerGroups.length; q++) {
                if(!updatedLGSets[i].layerGroups[q].id || updatedLGSets[i].layerGroups[q].id.trim().length === 0) {
                    updatedLGSets[i].layerGroups[q].id = crypto.randomUUID();
                }
            }

            //ensure deleted lg is empty and all of its layers are redistributed
            let existingEquivLGSet = existingPkg.layerGroupSets.find(a => a.id === updatedLGSets[i].id);
            if(existingEquivLGSet) {
                for(let k = 0; k < existingEquivLGSet.layerGroups.length; k++) {
                    let exisLG = existingEquivLGSet.layerGroups[k]  //aka layers expected to be relocated due to incoming lg deletion
                    let isLyrGrpDeleted = updatedLGSets[i].layerGroups.some(a => a.id === exisLG.id) ? false : true
                    if(isLyrGrpDeleted) {
                        let isAllDelLayersRelocated = exisLG.layers.every(x => 
                            updatedLGSets[i].layerGroups.some(y => 
                                (y.id !== exisLG.id) && y.layers.some(z => z.id === x.id)))
                        
                        if(isAllDelLayersRelocated === false) {
                            throw new Error(`Layer group '${exisLG.name}' cannot be deleted if layers are still associated with it. Please reallocate layers prior to layergroup deletion`)
                        }
                    }
                }
            }

            //paste to mod version of pkg
            for(let x = 0; x < modPkg.layerGroupSets.length; x++) {
                if(modPkg.layerGroupSets[x].id === updatedLGSets[i].id) {
                    modPkg.layerGroupSets[x] = updatedLGSets[i]
                    break;
                }
            }
        }
    }

    if(deletedLGSets && deletedLGSets.length > 0) {
        if(deletedLGSets.some(a => (isNotNullOrEmptyOrWS(a.id) === false))) {
            throw new Error(`Layer group set intended for deletion is invalid. It should have a valid identifier`)
        }
        deletableNonGoldLGSetIdList = deletedLGSets.filter(x => x.id !== (existingGolden as LayerGroupSet).id)?.map(a => a.id) ?? [] //cannot delete golden!
        
        if(deletableNonGoldLGSetIdList.length > 0) {
            let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
            let project = await projRepo.GetWithId(existingPkg.projectId);
            let relevClrRelBrands = project.clearanceRelationBrands.filter(a => deletableNonGoldLGSetIdList.includes(a.value))
            if(relevClrRelBrands && relevClrRelBrands.length > 0) {
                //NOTE: for linked elements, we only need to run the LGSet switch-up function for one. the function will consider the linkage
                let map = new Map<string, string[]>()
                for(let brand of relevClrRelBrands) {
                    let found = project.clearanceLinkages.find(a => (a.value && a.value.includes(brand.id)))
                    if(found) {
                        map.set(found.id, (map.get(found.id) ?? []).concat([brand.id]))
                    }
                }

                for(let [lnk, brandIdList] of map) {
                    if(brandIdList && brandIdList.length > 0) {
                        switchUpLayerGroupSet(existingPkg.projectId, brandIdList[0], (existingGolden as LayerGroupSet).id) 
                    }
                }
            }

            let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
			let projectNetclasses = await netclassRepo.GetAllByProjectID(existingPkg.projectId) ?? []
	        let relevNetclasses = projectNetclasses.filter(a => deletableNonGoldLGSetIdList.includes(a.layerGroupSetId))
            if(relevNetclasses && relevNetclasses.length > 0) {
                let map = new Map<string, string[]>()
                for(let netclass of relevNetclasses) {
                    let ncid = netclass._id?.toString() as string;
                    let found = project.physicalLinkages.find(a => (a.value && a.value.includes(ncid)))
                    if(found) {
                        map.set(found.id, (map.get(found.id) ?? []).concat([ncid]))
                    }
                }

                for(let [lnk, ncidList] of map) {
                    if(ncidList && ncidList.length > 0) {
                        switchUpLayerGroupSet(existingPkg.projectId, ncidList[0], (existingGolden as LayerGroupSet).id) 
                    }
                }
            }
            
            modPkg.layerGroupSets = modPkg.layerGroupSets.filter(a => (deletableNonGoldLGSetIdList.includes(a.id) === false))   
        }     
    }


    let result = await pkgRepo.ReplaceOne(modPkg)
    if(result) {
        let finalPkg = await pkgRepo.GetOneByProjectID(modPkg.projectId)
        
        let allFinalLyrGroupMap = new Map<string, LayerGroup>()
        for(let lgSetFin of finalPkg.layerGroupSets) {
            for (let lgFin of lgSetFin.layerGroups) {
                allFinalLyrGroupMap.set(lgFin.id, lgFin)
            }
        }

        let deletedLayerGroups = new Array<LayerGroup>()
        for(let [key, value] of allExistingLyrGroupMap) {
            if(allIncomingLyrGroupMap.has(key) === false && allFinalLyrGroupMap.has(key) === false) {
                deletedLayerGroups.push(value)
            }
        }
        
        let addedLayerGroups = new Array<LayerGroup>()
        for(let [key, value] of allIncomingLyrGroupMap) {
            if(allExistingLyrGroupMap.has(key) === false && allFinalLyrGroupMap.has(key)) {
                addedLayerGroups.push(value)
            }
        }
        
        if(deletedLayerGroups && deletedLayerGroups.length > 0) {
            await performConstraintsAssessmentForLayerGroupAction(modPkg.projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, deletedLayerGroups)
        }

        if(addedLayerGroups && addedLayerGroups.length > 0) {
            await performConstraintsAssessmentForLayerGroupAction(modPkg.projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, addedLayerGroups)
        }
        
        await pushDefaultConstraints(finalPkg.projectId) 
        
        return finalPkg;
    }
    else {
        throw new Error("Unknown error occured while persisting layer grouping changes")
    }    
}













// for(let brand of relevClrRelBrands) {
//     switchUpLayerGroupSet(existingPkg.projectId, brand.id, (existingGolden as LayerGroupSet).id) 
// }


//==========================================================
//==========================================================

//==============================================================



            // modExistingGoldenLGs.forEach(a => { 
            //     masterMapping.set(a.id, {lg: a, correspArray: new Array<LayerGroup>()}) 
            // });

            // for(let exLG of modExistingGoldenLGs) {
            //     let exLgLayerNamesLowcase = new Set<string>(exLG.layers.map(a => a.name.toLowerCase()))
                
            //     let membersLGs = modIncomingLGs.filter(a => 
            //         (a.layers.length <= exLG.layers.length) && a.layers.every(x => exLgLayerNamesLowcase.has(x.name.toLowerCase())))
                
            //     if(membersLGs && membersLGs.length > 0) {
            //         masterMapping.set(exLG.id, {lg: exLG, correspArray: membersLGs})
            //         membersLGs.forEach(x => { processedInc.set(x.id, x) })
            //     }
            // }




//if one lg becomes one, values remain same 
    //      therefore in custom lgset, same lg can be set to id of translation

    //if one lg becomes two we use src to populate two 
    //      therefore in customLGSet, src lg can remain same with translation to any one of the new lgs

    //if src LG is deleted in golden, recreate for 




    //delete all non-GOLDEN LGSet
    //save modified pkg
    //set all netclasses to golden lgset
    //set all clr-relations to golden lgset
    //for LGCs make sure they have the newest lg-id



    //=======================================================


                // //handle new LGs where layers are exactly still the same
                // let incSameLG = modIncomingLGs.filter(a => (a.layers.length === exLgLayerNamesLowcase.length) && a.layers.every(x => exLgLayerNamesLowcase.includes(x.name.toLowerCase())))
                // if(incSameLG) {
                //     existingLayerGroupToNewLayerGroupsMapping.set(exLG.id, [exLG, incSameLG])
                //     incSameLG.forEach(x => processedInc.set(x.id, x))
                // }

                // //handle the new LGs where layers are still fully found in an existing LG
                // let membersWithin = modIncomingLGs.filter(a => (a.layers.length < exLgLayerNamesLowcase.length) && a.layers.every(x => exLgLayerNamesLowcase.includes(x.name.toLowerCase())))
                // if(membersWithin && membersWithin.length > 0) {
                //     existingLayerGroupToNewLayerGroupsMapping.set(exLG.id, [exLG, membersWithin])
                //     membersWithin.forEach(x => processedInc.set(x.id, x))
                // }








// export async function handleStackupThicknessShakeup(pkg: PackageLayout, incomingNewLayerGroups: LayerGroup[]) : Promise<LayerGroupSet[]>{
//     // let existingGolden : LayerGroupSet | undefined = pkg.layerGroupSets.find(a => a.tags.includes(GOLDEN_INDICATOR_NAME))
//     let projectId = pkg.projectId;
//     // let newerGoldenLGSet = rfdcCopy(existingGolden) as LayerGroupSet;

//     for(let lgSet of pkg.layerGroupSets) {
//         //existingGolden && existingGolden.layerGroups && incomingNewLayerGroups) {
//         // let newerGoldenLGSet = rfdcCopy(existingGolden) as LayerGroupSet;
//         let modIncomingLGs = rfdcCopy(incomingNewLayerGroups) as LayerGroup[];
//         let processedInc = new Map<string, LayerGroup>();

//         let existingLayerGroupToNewLayerGroupsMapping = new Map<string, [LayerGroup, LayerGroup[]]>();
//         let modLGList = rfdcCopy(lgSet.layerGroups) as LayerGroup[];
//         modLGList.forEach(a => existingLayerGroupToNewLayerGroupsMapping.set(a.id, [a, new Array<LayerGroup>()]))

//         if(modIncomingLGs.length > 0) {
//             for(let exLG of modLGList) {
//                 let exLgLayerNamesLowcase = exLG.layers.map(a => a.name.toLowerCase())
                
//                 //handle new LGs where layers are exactly still the same
//                 let incSameLG = modIncomingLGs.filter(a => (a.layers.length === exLgLayerNamesLowcase.length) && a.layers.every(x => exLgLayerNamesLowcase.includes(x.name.toLowerCase())))
//                 if(incSameLG) {
//                     existingLayerGroupToNewLayerGroupsMapping.set(exLG.id, [exLG, incSameLG])
//                     incSameLG.forEach(x => processedInc.set(x.id, x))
//                 }

//                 //handle the new LGs where layers are still fully found in an existing LG
//                 let membersWithin = modIncomingLGs.filter(a => (a.layers.length < exLgLayerNamesLowcase.length) && a.layers.every(x => exLgLayerNamesLowcase.includes(x.name.toLowerCase())))
//                 if(membersWithin && membersWithin.length > 0) {
//                     existingLayerGroupToNewLayerGroupsMapping.set(exLG.id, [exLG, membersWithin])
//                     membersWithin.forEach(x => processedInc.set(x.id, x))
//                 }
//             }


//             for(let [key, value] of existingLayerGroupToNewLayerGroupsMapping) {
//                 let exLG = value[0]
//                 let incCorrespLGList = value[1]
                
//                 if(incCorrespLGList && incCorrespLGList.length > 1) {
//                     await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, incCorrespLGList); 
//                     await copyOverLayerGroupConstraintValues(projectId, pkg.ruleAreas, exLG, incCorrespLGList)
//                     await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, [exLG])
//                 }
//                 else {
//                     await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, [exLG])
//                 }
//             }
        
//             //these are incoming layergroups with no true equivalent
//             let brandNewLGs = modIncomingLGs.filter(a => processedInc.has(a.id) === false) ?? []
//             if(brandNewLGs && brandNewLGs.length > 0) {
//                 await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, brandNewLGs); 
//             }
        
//             let newLGs = Array.from(processedInc.values()).concat(brandNewLGs)
//             // newerGoldenLGSet = rfdcCopy(existingGolden) as LayerGroupSet;
//             // newerGoldenLGSet.layerGroups = sort(newLGs).asc(a => a.name);  
//         }
//     }



//     //delete all non-GOLDEN LGSet
//     //save modified pkg
//     //set all netclasses to golden lgset
//     //set all clr-relations to golden lgset
//     pushDefaultConstraints(projectId)
//     sortSlots(projectId, null) //for good measures...

//     // return incomingNewLayerGroups

//     return pkg.layerGroupSets = [
//         {
//             id: crypto.randomUUID(),
//             name: GOLDEN_INDICATOR_NAME,
//             layerGroups: incomingNewLayerGroups,
//             isPhysicalDefault: true,
//             isClearanceDefault: true,
//             tags: [GOLDEN_INDICATOR_NAME, LGSET_TAG_SORT], //important!!
//         }
//     ]
// }


//=============================================================


// export async function handleStackupThicknessShakeup(pkg: PackageLayout, incomingNewLayerGroups: LayerGroup[]) : Promise<LayerGroup[]>{
//     let existingGolden : LayerGroupSet | undefined = pkg.layerGroupSets.find(a => a.tags.includes(GOLDEN_INDICATOR_NAME))
//     let projectId = pkg.projectId;
//     let newerGoldenLGSet = rfdcCopy(existingGolden) as LayerGroupSet;

//     if(existingGolden && existingGolden.layerGroups && incomingNewLayerGroups) {

//         let modIncomingLGs = rfdcCopy(incomingNewLayerGroups) as LayerGroup[];
//         let processedInc = new Map<string, LayerGroup>();

//         let existingLayerGroupToNewLayerGroupsMapping = new Map<string, [LayerGroup, LayerGroup[]]>();
//         let modExistingGoldenLGs = rfdcCopy(existingGolden.layerGroups) as LayerGroup[];
//         modExistingGoldenLGs.forEach(a => existingLayerGroupToNewLayerGroupsMapping.set(a.id, [a, new Array<LayerGroup>()]))

//         if(modIncomingLGs.length > 0) {
//             for(let exLG of modExistingGoldenLGs) {
//                 let exLgLayerNamesLowcase = exLG.layers.map(a => a.name.toLowerCase())
                
//                 //handle new LGs where layers are exactly still the same
//                 let incSameLG = modIncomingLGs.filter(a => (a.layers.length === exLgLayerNamesLowcase.length) && a.layers.every(x => exLgLayerNamesLowcase.includes(x.name.toLowerCase())))
//                 if(incSameLG) {
//                     existingLayerGroupToNewLayerGroupsMapping.set(exLG.id, [exLG, incSameLG])
//                     incSameLG.forEach(x => processedInc.set(x.id, x))
//                 }

//                 //handle the new LGs where layers are still fully found in an existing LG
//                 let membersWithin = modIncomingLGs.filter(a => (a.layers.length < exLgLayerNamesLowcase.length) && a.layers.every(x => exLgLayerNamesLowcase.includes(x.name.toLowerCase())))
//                 if(membersWithin && membersWithin.length > 0) {
//                     existingLayerGroupToNewLayerGroupsMapping.set(exLG.id, [exLG, membersWithin])
//                     membersWithin.forEach(x => processedInc.set(x.id, x))
//                 }
//             }


//             for(let [key, value] of existingLayerGroupToNewLayerGroupsMapping) {
//                 let exLG = value[0]
//                 let incCorrespLGList = value[1]
                
//                 if(incCorrespLGList && incCorrespLGList.length > 1) {
//                     await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, incCorrespLGList); 
//                     await copyOverLayerGroupConstraintValues(projectId, pkg.ruleAreas, exLG, incCorrespLGList)
//                     await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, [exLG])
//                 }
//                 else {
//                     await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, [exLG])
//                 }
//             }
        
//             //these are incoming layergroups with no true equivalent
//             let brandNewLGs = modIncomingLGs.filter(a => processedInc.has(a.id) === false) ?? []
//             if(brandNewLGs && brandNewLGs.length > 0) {
//                 await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, brandNewLGs); 
//             }
        
//             let newLGs = Array.from(processedInc.values()).concat(brandNewLGs)
//             newerGoldenLGSet = rfdcCopy(existingGolden) as LayerGroupSet;
//             newerGoldenLGSet.layerGroups = sort(newLGs).asc(a => a.name);  
//         }
//     }




//     //delete all non-GOLDEN LGSet
//     //save modified pkg
//     //set all netclasses to golden lgset
//     //set all clr-relations to golden lgset
//     pushDefaultConstraints(projectId)
//     sortSlots(projectId, null) //for good measures...

//     return incomingNewLayerGroups
// }



//========================================================

// export async function handleStackupThicknessShakeup(existingPkg: PackageLayout, incomingNewLayerGroups: LayerGroup[]) : Promise<LayerGroup[]>{
//     let existingGolden : LayerGroupSet | undefined = existingPkg.layerGroupSets.find(a => a.tags.includes(GOLDEN_INDICATOR_NAME))
//     let existingLayerGroupToNewLayerGroupsMapping = new Map<LayerGroup, LayerGroup[]>();
//     let projectId = existingPkg.projectId;

//     if(existingGolden && existingGolden.layerGroups && incomingNewLayerGroups) {
//         let modExistingGoldenLGs = rfdcCopy(existingGolden.layerGroups) as LayerGroup[];
//         let modNewLGs = rfdcCopy(incomingNewLayerGroups) as LayerGroup[];
        
//         modExistingGoldenLGs.forEach(a => existingLayerGroupToNewLayerGroupsMapping.set(a, []))

//         //handle new LGs where layers are exactly still the same
//         if(modNewLGs.length > 0) {
//             let modExRemList : string[] = []
//             for(let exLG of Array.from(modExistingGoldenLGs)) {
//                 let exLgInstanceLayerNamesLowcase = exLG.layers.map(a => a.name.toLowerCase())
//                 let exactSameLG = modNewLGs.find(a => (a.layers.length === exLgInstanceLayerNamesLowcase.length) && a.layers.every(x => exLgInstanceLayerNamesLowcase.includes(x.name.toLowerCase())))
//                 if(exactSameLG) {
//                     existingLayerGroupToNewLayerGroupsMapping.set(exLG, [exactSameLG])
//                     modNewLGs = modNewLGs.filter(a => a.id !== exactSameLG.id)
//                     modExRemList.push(exLG.id)
//                 }
//             }
//             modExRemList.forEach(x => { 
//                 modExistingGoldenLGs = modExistingGoldenLGs.filter(a => a.id !== x) 
//             })
//         }

//         //handle the new LGs where layers are still fully found in an existing LG
//         if(modNewLGs.length > 0) {
//             for(let exLG of modExistingGoldenLGs) {
//                 let exLgLayerNames = exLG.layers.map(a => a.name.toLowerCase())
//                 let membersWithin = modNewLGs.filter(a => (a.layers.length < exLgLayerNames.length) && a.layers.every(x => exLgLayerNames.includes(x.name.toLowerCase())))
//                 if(membersWithin && membersWithin.length > 0) {
//                     existingLayerGroupToNewLayerGroupsMapping.set(exLG, membersWithin)
//                     modNewLGs = modNewLGs.filter(a => membersWithin.every(x => x.id !== a.id))
//                 }
//             }
//         }

//         let processedNewLGs : LayerGroup[] = [];
//         let freshAddLGs: LayerGroup[] = [];
//         let discardableOldLGs: LayerGroup[] = [];

//         for(let [key, value] of existingLayerGroupToNewLayerGroupsMapping) {
//             if(key && value && value.length === 1) {
//                 //one to one mappings
//                 processedNewLGs = processedNewLGs.concat(value);
//                 for(let x = 0; x < incomingNewLayerGroups.length; x++) {
//                     if(incomingNewLayerGroups[x].id === value[0].id){
//                         await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, value); 
//                         await copyOverLayerGroupConstraintValues(existingPkg, key, value)
//                         discardableOldLGs.push(key)

//                         incomingNewLayerGroups[x].id === key.id;
//                         break;
//                     }
//                 }
//             }
//             else if(key && value && value.length > 1) {
//                 //existing was split into multiple LGs
//                 await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, value)
//                 await copyOverLayerGroupConstraintValues(existingPkg, key, value)
//                 discardableOldLGs.push(key);
//                 processedNewLGs = processedNewLGs.concat(value);
//             }
//             else if( value.length === 0){
//                 discardableOldLGs.push(key)
//             }
//         }

//         freshAddLGs = incomingNewLayerGroups.filter(a => processedNewLGs.every(x => x.id !== a.id))
//         if(freshAddLGs && freshAddLGs.length > 0) {
//             await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_ADDITION, freshAddLGs); 
//         }

//         if(discardableOldLGs && discardableOldLGs.length > 0) {
//             let allExistingLyrGroupMap = new Map<string, LayerGroup>()
//             let nonGolden : LayerGroupSet[] = existingPkg.layerGroupSets.filter(a => (a.tags.includes(GOLDEN_INDICATOR_NAME) === false))
//             for(let lgSet of nonGolden) {
//                 for (let lg of lgSet.layerGroups) {
//                     allExistingLyrGroupMap.set(lg.id, lg)
//                 }
//             }
//             let surelyDiscardable = discardableOldLGs.filter(a => (allExistingLyrGroupMap.has(a.id) === false))
//             if(surelyDiscardable && surelyDiscardable.length > 0) {
//                 await performConstraintsAssessmentForLayerGroupAction(projectId, ConstraintChangeActionEnum.LAYER_GROUP_REMOVAL, surelyDiscardable)
//             }
//         }
//     }

//     pushDefaultConstraints(projectId)
//     sortSlots(projectId, null) //for good measures...

//     return incomingNewLayerGroups
// }











        // let toBeUpdatedGoldenLayerGroups = updatedLGSets.find(a => a.tags.includes(GOLDEN_INDICATOR_NAME))?.layerGroups ?? []
        // let remLGsOnUpdateSide = existingGolden?.layerGroups?.filter(a => toBeUpdatedGoldenLayerGroups.every(x => x.id !== a.id))
        // if(remLGsOnUpdateSide && remLGsOnUpdateSide.length > 0) {
        //     if(remLGsOnUpdateSide.some(a => (a.layers.length > 0))) {
        //         throw new Error(`Layer group cannot be deleted if layers are still associated with it. Please reallocate layers prior to layergroup deletion`)
        //     }
        // }
        