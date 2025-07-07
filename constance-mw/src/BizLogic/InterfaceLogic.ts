import { AppConfigConstants, C2C_ROW_ALLCOLUMN_SLOT_NAME, CHANNEL_RANGE, DBCollectionTypeEnum, DataMappingTypeEnum, IFACE_COPY_LAYERGROUP_MAPPING, 
    IFACE_COPY_NETCLASS_MAPPING, IFACE_COPY_RULEAREA_MAPPING, INTERFACE_TEMPLATE_UPSERT_NAME, InterfaceInitTypeEnum, NETCLASSES_PROP_NAME, NamingContentTypeEnum, 
    PendingProcessActionTypeEnum} from "../Models/Constants";
import { ConfigItem, BasicProperty, User, StorageCollateralInfo, BasicKVP, G2GAssessmentData } from "../Models/HelperModels";
import { BaseNCNode, C2CRow, G2GRelationContext, Interface, InterfaceTemplate, Netclass, PackageLayout, Project } from "../Models/ServiceModels";
import { BaseRepository } from "../Repository/BaseRepository";
import { checkDuplicatesIgnoreCase, getPropertiesFromConfigs, groupBy, rfdcCopy, verifyNaming } from "./UtilFunctions";
import { deleteNetClasses, updateC2CRow, updateNetclassesForInterface } from "./NetClassificationLogic";
import { getGenConfigs, getInterfaceTemplatesForOrg, uploadInterfaceTemplate } from "./ConfigLogic";
import { Filter, ObjectId } from "mongodb";
import { runAutoMapLogic } from "./NetListLogic";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { discardCollaterals, getCollaterals } from "./StorageFilesLogic";
import { pushDefaultConstraints } from "./DefaultConstraintsLogic";
import { assessLinkageRelatedLGCs, processConstraintsForAltIfaceCreateScenarios, sortSlots, switchUpLayerGroupSet } from "./ConstraintsMgmtLogic";
import { createAutoGenSnapshot } from "./SnapShotLogic";
import { getChannelNumArrayFromShortStr } from "./BasicCommonLogic";
import { sort } from "fast-sort";
import { handleProjectPendingProcessIndicator, updateProjectClearanceRelationBrands } from "./ProjectLogic";






export async function addNetclassesToInterfaceContext(iface: Interface) : Promise<Interface> {
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
    let filter = { interfaceId: iface._id?.toString() } as any;
    let netclasses = await netclassRepo.GetAllByProjectID(iface.projectId, filter);
    if (netclasses && netclasses.length > 0) {
        let ncProp: BasicProperty = { id: crypto.randomUUID(), name: NETCLASSES_PROP_NAME, value: netclasses };
        iface.contextProperties = iface.contextProperties.filter(a => a.name.toUpperCase() !== NETCLASSES_PROP_NAME);
        iface.contextProperties.push(ncProp);
    }
    else {
        throw new Error(`DATA ERROR!!  No netclasses found for interface '${iface.name}'. Delete and recreate interface.`)
    }

    return iface
}


export async function createInterface(iface: Interface, user: User) : Promise<Interface> {
    let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
    let ifaceRepo = new BaseRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
    let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION);

    if(!iface.name || iface.name.trim().length < 2 || iface.name.toLowerCase() === "undefined" ){
        throw new Error(`Please use at least three characters for Interface name`)
    }
    if(!iface.projectId || iface.projectId.trim().length === 0 || iface.projectId.toLowerCase() === "undefined" ){
        throw new Error(`New interface must specify valid projectId`)
    }
    if(!iface.contextProperties || iface.contextProperties.length === 0) {
        throw new Error(`Necessary context properties were not provided for interface`)
    }

    //check format of interface name
    verifyNaming([iface.name], NamingContentTypeEnum.INTERFACE)

    //check if interface name already exists
    let filter = {projectId: iface.projectId, name : new RegExp('^' + iface.name.trim() + '$', 'i')}
    const ifaceList: Interface[] = (await ifaceRepo.GetWithFilter(filter)) as Interface[];
    if (ifaceList && ifaceList.length > 0) {
        throw new Error(`Cannot add new Interface '${iface.name}'. An Interface with the same name already exists for current project`);
    }

    //check and retrieve valid org, then add default properties to interface
    let projFilter = { _id: new ObjectId(iface.projectId) } as any;
    let projection = { name: 1, org: 1 };
    let project = (await projRepo.GetByFilterAndProjection(projFilter, projection) as any[])?.at(0);
    if (project && project.org && project.org.length > 0) {
        let genConfigs : ConfigItem[] = await getGenConfigs(null, project.org, false);
        let propArr = getPropertiesFromConfigs(genConfigs, AppConfigConstants.CONFIGITEM__Default_Interface_Properties, true)
        let initPropNames = iface.associatedProperties.map(a => a.name.toLowerCase().trim()) ?? []
        let filteredPropArray  = propArr.filter(a => (initPropNames.includes(a.name.toLowerCase().trim()) === false))
        filteredPropArray = filteredPropArray.sort((a, b) => (a.category < b.category) ? -1 : 1);
        iface.associatedProperties = iface.associatedProperties.concat(filteredPropArray) 
    }
    else {
        throw new Error(`Could not retrieve org for project. Make sure the relevant project exists with a valid 'org' in the system`);
    }
    
    //check duplicate prop names
    let propNames = iface.associatedProperties.map(a => a.name)
    let dupRes = checkDuplicatesIgnoreCase(propNames);
    if (dupRes === false) {
        throw new Error(`Duplicate property names are not allowed for new interface. Please check configured default interface properties`)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = iface.associatedProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property display display-names are not allowed for interface. Please check configured default interface properties`)
    }

    //ensure all properties have a uuid
    for(let i = 0; i < iface.associatedProperties.length; i++){
        if(iface.associatedProperties[i].id && iface.associatedProperties[i].id.trim().length === 0) {
            iface.associatedProperties[i].id = crypto.randomUUID()
        }
    }

    //extract properties - we need to collect these prior to emtying contextProperties
    let inputNetclassList = iface.contextProperties.find(a => a.name.toUpperCase() === NETCLASSES_PROP_NAME)?.value as Netclass[];
    let channelRangeShortStr = iface.contextProperties.find(a => a.name.toUpperCase() === CHANNEL_RANGE)?.value as string;
    let othCtxPropItems = iface.contextProperties.filter(a => (a.name.toUpperCase() === IFACE_COPY_RULEAREA_MAPPING) || (a.name.toUpperCase() === IFACE_COPY_LAYERGROUP_MAPPING)) ?? [];

    //some validations on extracted properties
    if(!inputNetclassList || inputNetclassList.length === 0) {
        throw new Error(`No valid netclasses specified for interface`)
    }

    //handle verifications for input netclasses
    for(let netclass of inputNetclassList) {
        if(!netclass.name || netclass.name.trim().length < 2 || netclass.name.toLowerCase() === "undefined") {
            throw new Error(`Name of new netclass is invalid. Please specify at least two alpha numberic characters for netclass name`)
        }
        if(!netclass.projectId || netclass.projectId.trim().length === 0 || netclass.projectId.toLowerCase() === "undefined") {
            throw new Error(`New netclass must have valid projectId`)
        }
        if(netclass.projectId !== iface.projectId) {
            throw new Error(`New netclass must have same projectId as associated interface`)
        }
    }

    delete iface['_id']; // important - remove any incoming ID before creating interface and running subsequent netclass creation etc
    iface.createdBy = user?.email || '';
    iface.createdOn = new Date();
    iface.lastUpdatedOn = new Date();
    iface.initializationType = iface.initializationType ?? InterfaceInitTypeEnum.FRESH; //setting default value
    iface.name = iface.name.trim()
    iface.contextProperties = [] // important!!

    //now create new interface in DB
    let newIface : Interface = await ifaceRepo.CreateOne(iface);

    //post interface-creation processes
    if(newIface && newIface._id){
        let resultingNetclassList;

        try {
            //handle G2G specifications
            let dataInfo = produceG2GInfoAndScaledNCListBasedOnChannelExpr(newIface, channelRangeShortStr, inputNetclassList, true); 


            //handle pre-netclass handliing checks for interface COPY scenario
            if(iface.initializationType === InterfaceInitTypeEnum.EXTERNAL_IMPORT) {
                if(!iface.sourceProjectId || iface.sourceProjectId.trim().length === 0) {
                    throw new Error(`No sourceProjectId specified for interface. Valid sourceProjectId must be provided for interface copy scenario`)
                }

                if(!iface.sourceInterfaceId || iface.sourceInterfaceId.trim().length === 0) {
                    throw new Error(`No sourceInterfaceId specified for interface. Valid sourceInterfaceId must be provided for interface copy scenario`)
                }

                if(!channelRangeShortStr || channelRangeShortStr.length  === 0) {
                    let exisNCfilter = { interfaceId : iface.sourceInterfaceId } as Filter<Netclass>
                    let srcNCCount = await netclassRepo.GetCountByProjectId(iface.sourceProjectId, [exisNCfilter])
                    if(srcNCCount !== inputNetclassList.length) {
                        throw new Error(`The number of netclasses specified for target interface does not match the number of netclasses found in source interface`)
                    }
                }

                let exisProjNetclassList = await netclassRepo.GetAllByProjectID(iface.projectId) as Netclass[];
                let exisProjNCNamesLowCase = new Set<string>(exisProjNetclassList.map(a => a.name.toLowerCase().trim()));
                if (exisProjNCNamesLowCase && exisProjNCNamesLowCase.size > 0) {
                    for(let i = 0; i < dataInfo.resultNetclassList.length; i++) {
                        if(exisProjNCNamesLowCase.has(dataInfo.resultNetclassList[i].name.toLowerCase().trim())) {
                            let count = 1;
                            do {
                                dataInfo.resultNetclassList[i].name = `${dataInfo.resultNetclassList[i].name}_${++count}`
                            } while(exisProjNCNamesLowCase.has(dataInfo.resultNetclassList[i].name.toLowerCase().trim()))
                        }
                    } 
                }
            }


            //create netclasses for new interface
            resultingNetclassList = await updateNetclassesForInterface (newIface.projectId, newIface._id.toString(), dataInfo.resultNetclassList, dataInfo.resultG2GinfoArray)
            if(!resultingNetclassList || resultingNetclassList.length === 0) {
                throw new Error(`Failed to create netclasses for new interface.`)
            }
            

            //handle post-netclass-creation actions for interface COPY scenario
            if(iface.initializationType === InterfaceInitTypeEnum.EXTERNAL_IMPORT) {
                let ctxPropMap = new Map<string, Map<string, string>>();
                for(let prop of (othCtxPropItems ?? [])) {
                    ctxPropMap.set(prop.name, (new Map<string, string>()));
                    if(prop.value && prop.value.length > 0) {
                        let map = new Map<string, string>();
                        for(let pv of (prop.value as BasicKVP[])) {
                            map.set(pv.key, pv.value);
                        }
                        ctxPropMap.set(prop.name, map);
                    }
                }

                let raMapInfo = ctxPropMap.get(IFACE_COPY_RULEAREA_MAPPING)
                if(!raMapInfo || raMapInfo.size === 0) {
                    throw new Error(`No rule area mapping specified for interface. Valid rule area mapping must be provided for interface copy scenario`)
                }

                let lyrGrpMapInfo = ctxPropMap.get(IFACE_COPY_LAYERGROUP_MAPPING)
                if(!lyrGrpMapInfo || lyrGrpMapInfo.size === 0) {
                    throw new Error(`No layer group mapping specified for interface. Valid layer group mapping must be provided for interface copy scenario`)
                }
                
                let netclassNameToIDMapping = new Map<string, string>();
                resultingNetclassList.forEach(x => { netclassNameToIDMapping.set(x.name, x._id?.toString() as string) }) //Important! - this position is important (comes after possible name change)
                let map = new Map<string, string>(resultingNetclassList.map(x => [x._id?.toString() as string, (netclassNameToIDMapping.get(x.name) ?? '') ] ));
                ctxPropMap.set(IFACE_COPY_NETCLASS_MAPPING, map);
                
                // Handle constraints for interface copy scenario....
                await processConstraintsForAltIfaceCreateScenarios(newIface, resultingNetclassList, ctxPropMap, user);
            }


            //create g2g context data ffor iface...
            await g2gRepo.CreateMany(dataInfo.resultG2GinfoArray);
        }
        catch(error: any) {
            deleteInterface(iface.projectId, [(newIface._id.toString())]);
            throw new Error(`Interface creation process failed. ${error.message} `)
        }


        if(resultingNetclassList && resultingNetclassList.length > 0) {
            runAutoMapLogic(resultingNetclassList)
            await pushDefaultConstraints(iface.projectId) 
        }

        return newIface;
    }
    else {
        throw new Error(`An unspecified error occured while creating new interface`)
    }
}


export async function updateInterface(iface: Interface) : Promise<Interface> {
    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION)

    //check name and projectId and netclasses (required fields)
    if (!iface._id || iface._id.toString().trim().length === 0 || iface._id.toString() === 'undefined') {
        throw new Error(`Input interface cannot have null or empty or undefined 'id'`);
    }
    if (!iface.projectId || iface.projectId.trim().length === 0 || iface.projectId === 'undefined') {
        throw new Error(`Input interface cannot have null or empty or undefined 'projectId'`);
    }
    if (!iface.name || iface.name.trim().length === 0 || iface.name === 'undefined') {
        throw new Error(`Input interface cannot have null or empty or undefined 'name'`);
    }
    if(iface.associatedProperties.length === 0){
        throw new Error(`No valid interface properties found. At least one interface property is required`)
    }
    
    let projection = { name: 1, lockedBy: 1 }
    let existingIfaces = await ifaceRepo.GetAllByProjectIDAndProjection(iface.projectId, null, projection) ?? []
    for(let exIface of existingIfaces) {
        //ensure that user cannot change the interface name to one that already exists
        if(exIface._id?.toString() !== iface._id.toString()) {
            if(exIface.name.toLowerCase() === iface.name.toLowerCase()) {
                throw new Error(`An interface with name '${iface.name}' already exists for this project.`)
            }
        }
    }
    
    //check format of interface name
    verifyNaming([iface.name], NamingContentTypeEnum.INTERFACE)

    //check duplicate prop names
    let propNames = iface.associatedProperties.map(a => a.name)
    let dupRes = checkDuplicatesIgnoreCase(propNames);
    if (dupRes === false) {
        throw new Error(`Duplicate property names are not allowed for interface.`)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = iface.associatedProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property display names are not allowed for interface.`)
    }

    //ensure all properties have a uuid
    for(let i = 0; i < iface.associatedProperties.length; i++){
        if((!iface.associatedProperties[i].id) || (iface.associatedProperties[i].id.trim().length === 0)) {
            iface.associatedProperties[i].id = crypto.randomUUID()
        }
    }

    if(iface.associatedProperties && iface.associatedProperties.length > 0) {
        iface.associatedProperties = iface.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
    }

    //---------------------------------------------------
    //extract netclasses from context
    let inputNetclassList = (iface.contextProperties ?? []).find(a => a.name.toUpperCase() === NETCLASSES_PROP_NAME)?.value as Netclass[]
    
    //Important - we need to collect this prior to emtying contextProperties
    let chRangeCtxProp = (iface.contextProperties ?? []).find(a => a.name.toUpperCase() === CHANNEL_RANGE);

    let g2gReconInfo = {g2grList: new Array<G2GRelationContext>(), hasRangeChange: false};
    let netclassReconInfo  = {ncList: inputNetclassList, lgsetChangeMap: new Map<string, string>()};

    if(chRangeCtxProp) {  
        if(!inputNetclassList || inputNetclassList.length === 0) {
            throw new Error(`No valid netclasses specified for interface`)
        }  
        //handle update to G2G specifications
        let channelRangeShortStr = chRangeCtxProp?.value as string
        let dataInfo = produceG2GInfoAndScaledNCListBasedOnChannelExpr(iface, channelRangeShortStr, inputNetclassList, false); //duplicate Netclass IDs expected as a result of this function
        
        g2gReconInfo = await reconcileG2GForIfaceUpdate(iface, dataInfo.resultG2GinfoArray);
        if(g2gReconInfo.hasRangeChange === true) {
            await createAutoGenSnapshot(iface.projectId);
        }
        
        netclassReconInfo = await reconcileNetclassesForIfaceUpdate(iface, inputNetclassList, g2gReconInfo.g2grList, dataInfo.resultNetclassList);
    }

    iface.lastUpdatedOn = new Date();
    iface.name = iface.name.trim()
    iface.contextProperties = [] // important!!

    let result = await ifaceRepo.ReplaceOne(iface);
    if(result) {
        let ifaceId = iface._id?.toString() as string || '';
        if(netclassReconInfo.ncList && netclassReconInfo.ncList.length > 0) {
            let netclassesForIface = await updateNetclassesForInterface(iface.projectId, ifaceId, netclassReconInfo.ncList, g2gReconInfo.g2grList)
            if(netclassesForIface && netclassesForIface.length > 0) {
                if(netclassReconInfo.lgsetChangeMap && netclassReconInfo.lgsetChangeMap.size > 0){
                    //I understand this might be expensive ... will monitor for now...
                    for (let [relevNCID, lgsetId] of netclassReconInfo.lgsetChangeMap) {
                        await switchUpLayerGroupSet(iface.projectId, relevNCID, lgsetId);
                    }
                }
                
                runAutoMapLogic(netclassesForIface)     //i see no need to 'await' on this....
                await pushDefaultConstraints(iface.projectId)
                //NOTE: sortSlots() is already called in update-net-classes function - no need for it here
            }
        }

        if(g2gReconInfo.g2grList && g2gReconInfo.g2grList.length > 0) {
            let g2gIfaceFilter = {interfaceId: iface._id?.toString() as string} as Filter<G2GRelationContext>; 
            let existingG2GList = await g2gRepo.GetAllByProjectID(iface.projectId, g2gIfaceFilter);
            let exisIdSet = new Set<string>(existingG2GList.map(a => a._id?.toString() as string) ?? []);
            let refreshIdSet = new Set<string>(g2gReconInfo.g2grList.map(a => a._id?.toString() as string) ?? []);
            
            let del : G2GRelationContext[] = existingG2GList.filter(x => x._id && (refreshIdSet.has(x._id.toString() as string) === false));
            if(del && del.length > 0) {
                await g2gRepo.DeleteMany(del.map(x => x._id?.toString() as string));
            }

            let repl : G2GRelationContext[] = g2gReconInfo.g2grList.filter(x => x._id && exisIdSet.has(x._id.toString() as string));
            if(repl && repl.length > 0) {
                await g2gRepo.ReplaceMany(repl);
            }

            let newer : G2GRelationContext[] = g2gReconInfo.g2grList.filter(x => (!x._id || (x._id.toString().trim().length === 0) || (exisIdSet.has(x._id.toString() as string) === false)));
            if(newer && newer.length > 0) {
                await g2gRepo.CreateMany(newer);
            }
        }

        let updatedInterface = await ifaceRepo.GetWithId(ifaceId)
        return updatedInterface;
    }
    else {
        throw new Error(`Failed to update interface '${iface.name}'. An unspecified error occured while performing update operation`)
    }
}


export async function saveInterfaceSetupAsTemplate(iface: Interface, user: User) : Promise<InterfaceTemplate> {
    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    
    //extract and check netclasses from input
    let inputNetclasses: Netclass[] | undefined;
    let newTplName: string | undefined;
    if(iface && iface.contextProperties && iface.contextProperties.length > 0) {
        let netclassProp = iface.contextProperties.find(a => a.name.toUpperCase() === NETCLASSES_PROP_NAME) 
        if(netclassProp) {
            inputNetclasses = netclassProp.value
        }

        let newTplProp = iface.contextProperties.find(a => a.name.toUpperCase() === INTERFACE_TEMPLATE_UPSERT_NAME) 
        if(newTplProp) {
            newTplName = newTplProp.value
        }
    }
    
    //check name and projectId and netclasses (required fields)
    if(!inputNetclasses || inputNetclasses.length < 1) {
        throw new Error(`At least one valid netclasses must be provided in order to save as a template`)
    }
    if (!iface._id || iface._id.toString().trim().length === 0 || iface._id.toString() === 'undefined') {
        throw new Error(`Input interface cannot have null or empty or undefined 'id'`);
    }
    if (!iface.projectId || iface.projectId.trim().length === 0 || iface.projectId === 'undefined') {
        throw new Error(`Input interface cannot have null or empty or undefined 'projectId'`);
    }
    if (!iface.name || iface.name.trim().length === 0 || iface.name === 'undefined') {
        throw new Error(`Input interface cannot have null or empty or undefined 'name'`);
    }
    if (!newTplName || newTplName.trim().length === 0 || newTplName === 'undefined') {
        throw new Error(`Input template name cannot be null or empty or undefined`);
    }

    let existingIface = await ifaceRepo.GetWithId(iface._id?.toString())
    if (!existingIface) {
        throw new Error(`Provided interface was not found in the system`)
    }

    let project = await projRepo.GetWithId(iface.projectId)
    if (!project || !project.org || project.org === 'undefined' || project.org.trim().length === 0) {
        throw new Error(`Provided interface has invalid projectId. Associated project was not found in the system`)
    }

    //check format of template uniqueName name
    verifyNaming([newTplName], NamingContentTypeEnum.INTERFACE_TEMPLATE)
    
    //check format of interface name
    verifyNaming([iface.name], NamingContentTypeEnum.INTERFACE)

    //check format of netclass names
    let ncNames: string[] = inputNetclasses.map((a: Netclass) => a.name)
    verifyNaming(ncNames, NamingContentTypeEnum.NETCLASS)

    //check duplicate netclass names
    let dupRes = checkDuplicatesIgnoreCase(ncNames);
    if (dupRes === false) {
        throw new Error(`Duplicate netclass names are not allowed for interface template.`)
    }

    let res = await getInterfaceTemplatesForOrg(project.org);
    let existingTemplates = res.templates;
    if(existingTemplates && existingTemplates.length > 0) {
        let sameUniqueNameTpl = existingTemplates.find(a => a.uniqueName.toLowerCase() === newTplName?.toLowerCase());
        if(sameUniqueNameTpl) {
            throw new Error(`Cannot save interface configuration as template. A template already exists with the unique name '${newTplName}.`)
        }

        for (let tpl of existingTemplates) {
            if(tpl.netclasses.length === inputNetclasses.length) {
                if(tpl.netclasses.every(a => inputNetclasses.some(x => (x.name.trim().toLowerCase() === a.name.trim().toLowerCase()) && (x.pattern.trim() === a.pattern.trim())))) {
                    throw new Error(`Cannot save interface configuration as template. A template '${tpl.uniqueName}' already exists with the same set of netclass names.`)
                }
            }
        }
    }

    let tplNCList : BaseNCNode[] = [];
    for (let n = 0; n < inputNetclasses.length; n++) {
        let baseNC : BaseNCNode = {
            name: inputNetclasses[n].name.trim(),
            pattern: inputNetclasses[n].pattern.trim(),
            patternIndex: n,
            segment: inputNetclasses[n].segment?.trim() || ''
        }
        tplNCList.push(baseNC)
    }
    
    let newTPL : InterfaceTemplate = {
        id: crypto.randomUUID(),
        org: project.org,
        uniqueName: newTplName.trim(),
        interfaceName: iface.name.trim(),
        owner: user.email.trim(),
        contextProperties: [],
        netclasses: tplNCList
    }
    
    await uploadInterfaceTemplate(iface.projectId, newTPL);
    return newTPL
}


export async function deleteInterface(projectId: string, deletableIfaceIdList: string[]) : Promise<boolean>{
    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION)
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let delRes = true;

    if (!deletableIfaceIdList || deletableIfaceIdList.length === 0 ) {
        throw new Error(`Cannot perform interface deletion. No interface(s) specified for deletion`);
    }
    if (!projectId || projectId.trim().length === 0 ) {
        throw new Error(`Cannot perform interface deletion. No projectId specified for procedure`);
    }

    let projInterfaceList = await ifaceRepo.GetAllByProjectID(projectId) ?? [];
    let existingG2GList = await g2gRepo.GetAllByProjectID(projectId) ?? [];
    let focusIfaceList = new Array<Interface>();
    let otherStayingInterfaces = new Array<Interface>();
    let delG2GIdList = new Set<string>();

    for(let k = 0; k < projInterfaceList.length; k++) {
        if (deletableIfaceIdList.includes(projInterfaceList[k]._id?.toString() as string)){
            focusIfaceList.push(projInterfaceList[k]);
            
            //important!
            let delIfaceG2GList = existingG2GList.filter(a => (a.interfaceId === projInterfaceList[k]._id?.toString() as string)) ?? [];
            delIfaceG2GList.forEach(x => delG2GIdList.add(x._id?.toString() as string))
        }
        else {
            otherStayingInterfaces.push(projInterfaceList[k]);
        }
    }

    //take auto snapshot
    await createAutoGenSnapshot(projectId);
        
    //handle G2G mentionings of deletable interfaces...
    if(otherStayingInterfaces.length > 0) {
        let updatableG2GMap = new Map<string, G2GRelationContext>();
        for(let x = 0; x < otherStayingInterfaces.length; x++) {
            let stayingIfaceG2GItems = existingG2GList.filter(a => (a.interfaceId === otherStayingInterfaces[x]._id?.toString() as string)) ?? [];
            if(stayingIfaceG2GItems && stayingIfaceG2GItems.length > 0) {
                
                for(let y = 0; y < stayingIfaceG2GItems.length; y++) {
                    if(stayingIfaceG2GItems[y].across && stayingIfaceG2GItems[y].across.length > 0) {
                        
                        for(let z = 0; z < stayingIfaceG2GItems[y].across.length; z++) {
                            if(stayingIfaceG2GItems[y].across[z].targets.length > 0) {
                                
                                let delTgtItems = new Set<string>();
                                
                                for(let n = 0; n < stayingIfaceG2GItems[y].across[z].targets.length; n++) {
                                    
                                    if(delG2GIdList.has(stayingIfaceG2GItems[y].across[z].targets[n])) {
                                        delTgtItems.add(stayingIfaceG2GItems[y].across[z].targets[n]);
                                    }
                                }
                                if(delTgtItems.size > 0) {
                                    stayingIfaceG2GItems[y].across[z].targets = stayingIfaceG2GItems[y].across[z].targets.filter(r => (delTgtItems.has(r) === false));
                                    updatableG2GMap.set(stayingIfaceG2GItems[y]._id?.toString() as string, stayingIfaceG2GItems[y]);
                                }
                            }
                        }
                    }
                }
            }
        }

        if(updatableG2GMap.size > 0) {
            g2gRepo.ReplaceMany(Array.from(updatableG2GMap.values()))
        }
        
    }

    //handle all other work...
    if(focusIfaceList.length > 0) {
        for(let i = 0; i < focusIfaceList.length; i++) {
            if(focusIfaceList[i].projectId.trim().length === 0 || focusIfaceList[i].projectId.trim() !== projectId) {
                throw new Error(`All interfaces intended for deletion must have same projectId`);
            }
        }

        let pkg = await pkgRepo.GetOneByProjectID(projectId)
        let pkgModified = false
        if(!pkg) { 
            throw new Error(`Cannot complete interface deletion processes. Failed to retrieve valid layout info.`)
        }

        
        for(let q = 0; q < focusIfaceList.length; q++) {        
            let iface = focusIfaceList[q]
            //remove interface from ruleArea disablement tracker
            for(let ruleArea of pkg.ruleAreas) {
                if(ruleArea.visibilityContext && ruleArea.visibilityContext.length > 0) {
                    for(let prop of ruleArea.visibilityContext) {
                        if(prop.value && prop.value.length > 0) {
                            prop.value = prop.value.filter((a: string) => a !== iface._id?.toString())
                            pkgModified = true;
                        }
                    }
                }
            }
            
            //delete netclasses (handles net unmapping, adjusting LGCs, adjusting C2CRows)
            let ncfilter = { interfaceId: iface._id?.toString() } as Filter<Netclass>
            let netclasses = await netclassRepo.GetAllByProjectID(iface.projectId, ncfilter) ?? []
            if(netclasses.length > 0) {
                //NOTE: G2G cleanup will occur on netclass deletion
                await deleteNetClasses(netclasses)
            }

            //delete interface collaterals
            try {
                await getCollaterals(iface.projectId, iface._id?.toString() as string).then((collats: StorageCollateralInfo[]) => {
                    if(collats && collats.length > 0) {
                        discardCollaterals(collats);
                    }
                });
            }
            catch(error: any) { /* do nothing for now. this is best effort execution  */ }
        }

        if(pkgModified) {
            await pkgRepo.ReplaceOne(pkg);
        }

        //delete interfaces
        let delIfaceIdList = focusIfaceList.map(a => a._id?.toString() as string)
        delRes = await ifaceRepo.DeleteMany(delIfaceIdList);
        if(delRes === true) {
            if(delG2GIdList.size > 0) {
                let delObjIdArr = existingG2GList.filter(a => delG2GIdList.has(a._id?.toString() as string))?.map(g => (g._id?.toString() as string));
                if(delObjIdArr && delObjIdArr.length > 0) {
                    g2gRepo.DeleteMany(delObjIdArr);
                }
            }
            await cleanupG2GContextOnDataDeletion(projectId, [], [], delIfaceIdList); 
        }

        //sort remaining slots
        sortSlots(projectId)  //IMPORTANT !!! - the null param is perfectly intended
    }

    return delRes;
}




//#region G2G processing
export function produceG2GInfoAndScaledNCListBasedOnChannelExpr(iface: Interface, channelRangeShortStr: string, inputNetclassList: Netclass[], forceNewNetclassIds: boolean) 
    : {resultNetclassList: Netclass[], resultG2GinfoArray: G2GRelationContext[]} {
    
    let ifaceId = iface?._id?.toString() as string;
    let channelBasedG2GDataMap = new Map<string, string>(); 
    let segmentChanMapping = new Map<string|null, Set<string>>(); 
    let chModNetclassList = new Array<Netclass>();
    let g2gInfoArr = new Array<G2GRelationContext>();

    let segmentList = new Set<string>(inputNetclassList.filter(x => (x.segment && x.segment.trim().length > 0)).map(a => a.segment?.trim().toUpperCase()) ?? [])
    
    if(channelRangeShortStr && channelRangeShortStr.trim().length > 0) {
        let res = getChannelNumArrayFromShortStr(channelRangeShortStr)
        if(res.isSuccessful === false) {
            throw new Error(`Channel Range Error: -- ${res.message}`);
        }

        let channelNumArr = res.data ?? [];
        for(let ch of channelNumArr) {
            let chNaming = `${iface.name}${ch}`;                    //IMPORTANT -- See naming convention for channels!
            channelBasedG2GDataMap.set(chNaming, ch.toString())

            for(let seg of segmentList) {
                let exis = Array.from(segmentChanMapping.get(ch.toString()) ?? new Set<string>())
                segmentChanMapping.set(ch.toString(), new Set<string>(exis.concat([seg])));
            }
        }
    }
    else {
        if (segmentList.size > 0) {
            for(let seg of segmentList) {
                let exis = Array.from(segmentChanMapping.get(null) ?? new Set<string>())
                segmentChanMapping.set(null, new Set<string>(exis.concat([seg])));
            }
        }
    }


    if (channelBasedG2GDataMap.size  === 0) {
        let g2g : G2GRelationContext = {
            projectId: iface.projectId,
            snapshotSourceId: "",
            contextProperties: [],
            lastUpdatedOn: new Date(),
            interfaceId: ifaceId,
            channel: "",
            segment: "",
            enabled: true,
            intraclass: { enabled: false, clearanceRelationBrandId: "" },
            toAll: { enabled: false, clearanceRelationBrandId: "" },
            within: { enabled: false, clearanceRelationBrandId: "" },
            across: [],
            tags: [],
        };
        g2gInfoArr.push(g2g);
    }
    else {
        for(let [chName, chNumStr] of channelBasedG2GDataMap) {  
            let g2g : G2GRelationContext = {
                projectId: iface.projectId,
                snapshotSourceId: "",
                contextProperties: [],
                lastUpdatedOn: new Date(),
                interfaceId: ifaceId,
                channel: chNumStr,
                segment: "",
                enabled: true,
                intraclass: { enabled: false, clearanceRelationBrandId: "" },
                toAll: { enabled: false, clearanceRelationBrandId: "" },
                within: { enabled: false, clearanceRelationBrandId: "" },
                across: [],
                tags: [],
            };
            g2gInfoArr.push(g2g);

            if((chName && chName.length > 0 && chNumStr && chNumStr.toString().length > 0)) {
                for(let x = 0; x < inputNetclassList.length; x++) {
                    let netclass = rfdcCopy<Netclass>(inputNetclassList[x]) as Netclass;
                    netclass._id = ((netclass._id?.toString() as string).trim().length > 0) ? new ObjectId(netclass._id?.toString()) : new ObjectId();  //Important - to be 100% sure it is not a string - js is weird!
                    netclass.name = `${chName}_${netclass.name}`;   //IMPORTANT -- See naming convention for channeled netclass
                    netclass.channel = chNumStr.toString();
                    chModNetclassList.push(netclass);
                }
            }
        }
    }

    for(let [ch, segIdColl] of segmentChanMapping) {
        for(let segId of segIdColl) {
            let g2g : G2GRelationContext = {
                projectId: iface.projectId,
                snapshotSourceId: "",
                contextProperties: [],
                lastUpdatedOn: new Date(),
                interfaceId: ifaceId,
                channel: ch || "",  //important that is defaults to empty string!
                segment: segId.split("::").at(-1)?.trim().toUpperCase() as string,
                enabled: true,
                intraclass: { enabled: false, clearanceRelationBrandId: "" },
                toAll: { enabled: false, clearanceRelationBrandId: "" },
                within: { enabled: false, clearanceRelationBrandId: "" },
                across: [],
                tags: [],
            };
            g2gInfoArr.push(g2g);
        }
    }

    let finalNetclassList = (chModNetclassList.length === 0) ? inputNetclassList : chModNetclassList;

    for(let k = 0; k < finalNetclassList.length; k++) {
        finalNetclassList[k].interfaceId = ifaceId;
        if(forceNewNetclassIds === true) {
            finalNetclassList[k]._id = new ObjectId();
        }
    }

    g2gInfoArr = sort(g2gInfoArr).asc([
        a => Number(a.channel),
        a => a.segment.toUpperCase()
    ])

    return {resultNetclassList: finalNetclassList, resultG2GinfoArray: g2gInfoArr}
}


async function reconcileG2GForIfaceUpdate(iface: Interface, freshGenG2GList: G2GRelationContext[]) : Promise<{g2grList: G2GRelationContext[], hasRangeChange: boolean}> {
    let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION)
    let returnGroupRelationsInfo = new Array<G2GRelationContext>();
    let majorChangeOccured = false;

    let projG2GList = await g2gRepo.GetAllByProjectID(iface.projectId);
    let existingInterfaceG2GList = projG2GList.filter(x => x.interfaceId === (iface._id?.toString() as string));
    let othG2GIdList = projG2GList.filter(x => x.interfaceId !== (iface._id?.toString() as string));

    for(let x = 0; x < freshGenG2GList.length; x++) {
        let exisG2GByCombo = existingInterfaceG2GList.find(g => ((g.interfaceId === freshGenG2GList[x].interfaceId) && (g.channel === freshGenG2GList[x].channel) && (g.segment === freshGenG2GList[x].segment)))
        let exisG2GById = existingInterfaceG2GList.find(g => g._id?.toString() === freshGenG2GList[x]._id?.toString())
        
        if(exisG2GByCombo) {
            returnGroupRelationsInfo.push(exisG2GByCombo); //take existing G2G
        }
        else if(exisG2GById) {
            returnGroupRelationsInfo.push(exisG2GById); //take existing G2G
        }
        else {
            freshGenG2GList[x]._id = new ObjectId();  //important!
            returnGroupRelationsInfo.push(freshGenG2GList[x])  //use new G2G
            majorChangeOccured = true
        }
    }

    //handle G2G mentionings of deletable interfaces...
    let idConcatSet = new Set<string>(othG2GIdList.concat(returnGroupRelationsInfo).map(a => a._id?.toString() as string));
    for(let y = 0; y < returnGroupRelationsInfo.length; y++) {
        if(returnGroupRelationsInfo[y].across && returnGroupRelationsInfo[y].across.length > 0) {
            for(let z = 0; z < returnGroupRelationsInfo[y].across.length; z++) {
                if(returnGroupRelationsInfo[y].across[z].targets.length > 0) {
                    let delTgtItems = new Set<string>();
                    for(let n = 0; n < returnGroupRelationsInfo[y].across[z].targets.length; z++) {
                        if(idConcatSet.has(returnGroupRelationsInfo[y].across[z].targets[n]) === false) {
                            delTgtItems.add(returnGroupRelationsInfo[y].across[z].targets[n]);
                        }
                    }
                    if(delTgtItems.size > 0) {
                        returnGroupRelationsInfo[y].across[z].targets = returnGroupRelationsInfo[y].across[z].targets.filter(a => (delTgtItems.has(a) === false));
                    }
                }
            }
        }
    }

    return {g2grList: returnGroupRelationsInfo, hasRangeChange: majorChangeOccured}
}


async function reconcileNetclassesForIfaceUpdate(iface: Interface, inputNetclassList: Netclass[], g2gList: G2GRelationContext[], freshGenNCList: Netclass[]) : 
    Promise<{ncList: Netclass[], lgsetChangeMap: Map<string, string>}> {
    
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    
    if(!freshGenNCList || freshGenNCList.length === 0) {
        throw new Error("UNEXPECTED DATA ERROR: failed to determine full set of netclasses for interface update!")
    }

    let chModNetclassMap = new Map<string, Netclass>();
    let lgsetSwitcherMap = new Map<string, string>();
    let ifaceId = iface._id?.toString() as string;
    
    let exisNCfilter = { interfaceId : iface._id?.toString() as string } as Filter<Netclass> 
    let existingIfaceNetclasses = await netclassRepo.GetAllByProjectID(iface.projectId, exisNCfilter) ?? []
    
    for(let i = 0; i < freshGenNCList.length; i++) {
        let freshNC = freshGenNCList[i]
        
        let initCorrespExisNC = existingIfaceNetclasses.find(x => 
            (x.name.trim().toUpperCase() === freshNC.name.trim().toUpperCase())
            && (x.channel.trim().toUpperCase() === freshNC.channel.trim().toUpperCase())
            && (x.segment.trim().toUpperCase() === freshNC.segment.trim().toUpperCase())
        );

        if(initCorrespExisNC) {
            let copyOfCorresNC = rfdcCopy<Netclass>(initCorrespExisNC) as Netclass;
            copyOfCorresNC.lastUpdatedOn = new Date();
            copyOfCorresNC.name = freshNC.name;
            copyOfCorresNC.pattern = freshNC.pattern;
            if(copyOfCorresNC.layerGroupSetId !== freshNC.layerGroupSetId) {
                copyOfCorresNC.layerGroupSetId = freshNC.layerGroupSetId;
                lgsetSwitcherMap.set(copyOfCorresNC._id?.toString() as string, freshNC.layerGroupSetId);
            }
            chModNetclassMap.set(copyOfCorresNC._id?.toString()as string, copyOfCorresNC)
        }
        else {
            let secondaryFoundCorrespExisNC = existingIfaceNetclasses.find(a => 
                (a.name.trim().toUpperCase() === freshNC.name.trim().toUpperCase())
                && (a.pattern === freshNC.pattern)
                && (chModNetclassMap.has(a._id?.toString() as string) === false)
            );

            if(secondaryFoundCorrespExisNC) {
                let secCopyNC = rfdcCopy<Netclass>(secondaryFoundCorrespExisNC) as Netclass;
                secCopyNC.lastUpdatedOn = new Date();
                secCopyNC.name = freshNC.name;
                secCopyNC.pattern = freshNC.pattern;
                secCopyNC.channel = freshNC.channel; //important
                secCopyNC.segment = freshNC.segment; //important
                if(secCopyNC.layerGroupSetId !== freshNC.layerGroupSetId) {
                    secCopyNC.layerGroupSetId = freshNC.layerGroupSetId;
                    lgsetSwitcherMap.set(secCopyNC._id?.toString() as string, freshNC.layerGroupSetId);
                }
                chModNetclassMap.set(secCopyNC._id?.toString()as string, secCopyNC)
            }
            else {
                freshNC._id = new ObjectId(); //Important - This is intentional!
                chModNetclassMap.set(freshNC._id?.toString()as string, freshNC)
            }
        }
    }
    
    let ifaceG2GCtx = g2gList.filter(x => x.interfaceId === ifaceId);
    let finalnetclassList : Netclass[] = (chModNetclassMap.size > 0) ? Array.from(chModNetclassMap.values()) : inputNetclassList;
    
    if(ifaceG2GCtx.some(x => (!x.channel || x.channel.trim().length === 0))) {
        finalnetclassList.forEach(x => {x.channel = ''})  //reset channels if update to iface resulted in removal of channels
    } 
    
    return { ncList: finalnetclassList, lgsetChangeMap: lgsetSwitcherMap }
}


export async function cleanupG2GContextOnDataDeletion(projectId: string, deletedCRBs: BasicProperty[], deletedNetclasses: Netclass[], deletedInterfaceIdList: string[]) {
    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
    let filter = { _id: new ObjectId(projectId as string) } as Filter<Project>;
    let projection = { name: 1, clearanceRelationBrands: 1 };
    let project = (await projRepo.GetByFilterAndProjection(filter, projection) as any[])?.at(0);
    let currentProjCrbIdSet = new Set<string>((project as Project).clearanceRelationBrands?.map(x => x.id) ?? []);

    let deletedCrbIdSet = new Set<string>(deletedCRBs?.map(a => a.id) ?? []);
    let delSegmentNameSet = new Set<string>();
    let delNCInterfaceIDs = new Set<string>();

    if(deletedNetclasses && deletedNetclasses.length > 0) {
        delNCInterfaceIDs = new Set<string>(deletedNetclasses?.map(x => x.interfaceId) ?? []);

        let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
        let netclassProjection = { _id: 1, name: 1, segment: 1, interfaceId: 1 };
        let netclasses = (await netclassRepo.GetAllByProjectIDAndProjection(projectId, null, netclassProjection) as any[])

        let delNCGroupedBySegment = groupBy(deletedNetclasses.filter(x => (x.segment && (x.segment.trim().length > 0))), y => y.segment.toUpperCase().trim()) as Map<string, Netclass[]>
        let allProjectNCGroupedBySegment = groupBy(netclasses.filter(a => (a.segment && (a.segment.trim().length > 0))), z => z.segment.toUpperCase().trim()) as Map<string, Netclass[]>

        for(let [segName, delNetclassSubList] of delNCGroupedBySegment) {
            if(!allProjectNCGroupedBySegment || allProjectNCGroupedBySegment.has(segName) === false) {
                delSegmentNameSet.add(segName.toUpperCase().trim()); //means all segments named as such have already been deleted
            }
            else if(allProjectNCGroupedBySegment.has(segName)) {
                let allNetclassIdForSegment = allProjectNCGroupedBySegment.get(segName)?.map(k => (k._id?.toString() as string)) ?? [];
                let idsOfDeletionSubset = new Set<string>(delNetclassSubList.map(a => a._id?.toString() as string));
                if(allNetclassIdForSegment.every(n => idsOfDeletionSubset.has(n))) { //means all project NCs with this segment are found in the deletion subset
                    delSegmentNameSet.add(segName.toUpperCase().trim());
                }
            }
        }
    }

    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let ifaceProjectionSpec = { _id: 1, name: 1 }
	let projectInterfaces = await ifaceRepo.GetAllByProjectIDAndProjection(projectId, null, ifaceProjectionSpec) ?? []
    let projIfacesIDSet = new Set<string>(projectInterfaces.map(a => ((a as Interface)._id?.toString() as string)));

    let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION)
    let currG2GList = await g2gRepo.GetAllByProjectID(projectId) ?? [];

    let delG2GIdSet = new Set<string>();
    let updatableG2GMap = new Map<string, G2GRelationContext>();

    for(let k = 0; k < currG2GList.length; k++) {
        let g2g = currG2GList[k]
        let g2gId = currG2GList[k]._id?.toString() as string;
        
        //mark g2g for deletion if its interface is in deletion list
        if((deletedInterfaceIdList ?? []).includes(g2g.interfaceId)) {
            delG2GIdSet.add(g2gId);
            continue;
        }

        //mark g2g for deletion if its interface is gone
        if(projIfacesIDSet.has(g2g.interfaceId) === false) {
            delG2GIdSet.add(g2gId);
            continue;
        }

        //mark focus g2g for deletion is its segment has become invalid due to netclass deletions
        if(delSegmentNameSet.size > 0 && g2g.segment && g2g.segment.trim().length > 0) {
            if(delSegmentNameSet.has(g2g.segment.toUpperCase().trim())) {
                if(delNCInterfaceIDs.has(g2g.interfaceId)) {
                    delG2GIdSet.add(g2gId);
                }
                continue;
            }
        }

        g2g = cleanG2GByConsideringInvalidCRB(g2g, deletedCrbIdSet, currentProjCrbIdSet);

        updatableG2GMap.set(g2gId, g2g);
    }

    //handle target values for deleted g2g elements
    if(updatableG2GMap.size > 0) {
        for(let key of Array.from(updatableG2GMap.keys())) {
            let g2g = updatableG2GMap.get(key) as G2GRelationContext;
            if(g2g.across && g2g.across.length > 0) {
                for(let z = 0; z < g2g.across.length; z++) {
                    if(g2g.across[z].targets && g2g.across[z].targets.length > 0) {
                        let delTgtItems = new Set<string>();
                        for(let n = 0; n < g2g.across[z].targets.length; n++) {
                            if(delG2GIdSet.has(g2g.across[z].targets[n])) {
                                delTgtItems.add(g2g.across[z].targets[n]);
                            }
                        }
                        if(delTgtItems.size > 0) {
                            g2g.across[z].targets = g2g.across[z].targets.filter(a => (delTgtItems.has(a) === false));
                        }
                    }
                }
            }

            updatableG2GMap.set(g2g._id?.toString() as string, g2g);
        }
    }


    if(delG2GIdSet.size > 0) {
        await g2gRepo.DeleteMany(Array.from(delG2GIdSet))
    }
    
    if(updatableG2GMap.size > 0) {
        let items = Array.from(updatableG2GMap.values());
        await g2gRepo.ReplaceMany(items);
    }
}



function cleanG2GByConsideringInvalidCRB(g2g: G2GRelationContext, deletedCrbIdSet: Set<string>, currentProjCrbIdSet: Set<string>) : G2GRelationContext {
    //handle intraclass
    if(g2g.intraclass.clearanceRelationBrandId) {
        if(deletedCrbIdSet.has(g2g.intraclass.clearanceRelationBrandId)){
            g2g.intraclass.clearanceRelationBrandId = "";
            g2g.intraclass.enabled = false;
        }
        else if ((g2g.intraclass.clearanceRelationBrandId.length > 0) && (currentProjCrbIdSet.has(g2g.intraclass.clearanceRelationBrandId) === false)) {
            g2g.intraclass.clearanceRelationBrandId = "";
            g2g.intraclass.enabled = false;
        }
    }

    //handle toAll
    if(g2g.toAll.clearanceRelationBrandId) {
        if(deletedCrbIdSet.has(g2g.toAll.clearanceRelationBrandId)){
            g2g.toAll.clearanceRelationBrandId = "";
            g2g.toAll.enabled = false;
        }
        else if ((g2g.toAll.clearanceRelationBrandId.length > 0) && (currentProjCrbIdSet.has(g2g.toAll.clearanceRelationBrandId) === false)) {
            g2g.toAll.clearanceRelationBrandId = "";
            g2g.toAll.enabled = false;
        }
    }

    //handle within
    if(g2g.within.clearanceRelationBrandId) {
        if(deletedCrbIdSet.has(g2g.within.clearanceRelationBrandId)){
            g2g.within.clearanceRelationBrandId = "";
            g2g.within.enabled = false;
        }
        else if ((g2g.within.clearanceRelationBrandId.length > 0) && (currentProjCrbIdSet.has(g2g.within.clearanceRelationBrandId) === false)) {
            g2g.within.clearanceRelationBrandId = "";
            g2g.within.enabled = false;
        }
    }

    //handle across
    if(g2g.across && g2g.across.length > 0) {
        for(let y = 0; y < g2g.across.length; y++) {
            if(g2g.across[y].clearanceRelationBrandId) {
                if(deletedCrbIdSet.has(g2g.across[y].clearanceRelationBrandId)){
                    g2g.across[y].clearanceRelationBrandId = "";
                    g2g.across[y].enabled = false;
                    g2g.across[y].targets = new Array<string>();
                }
                else if ((g2g.across[y].clearanceRelationBrandId.length > 0) && (currentProjCrbIdSet.has(g2g.across[y].clearanceRelationBrandId) === false)) {
                    g2g.across[y].clearanceRelationBrandId = "";
                    g2g.across[y].enabled = false;
                    g2g.across[y].targets = new Array<string>();
                }
            }
        }
    }

    return g2g;
}



export async function updateG2GContext(projectId: string, inputG2GInfoList: G2GRelationContext[], user: User|null) : Promise<boolean> {
    try {
        const procStartTime = performance.now();

        let ifaceIncomingG2GData = new Array<G2GRelationContext>();
        let channelIncomingG2GData = new Array<G2GRelationContext>();
        let segmentIncomingG2GData = new Array<G2GRelationContext>();
        let g2gAssessmentInf = new G2GAssessmentData();
        
        let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION);
        let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
        let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
        let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION);

        let filter = { _id: new ObjectId(projectId as string) } as Filter<Project>;
        let projection = { name: 1, clearanceRelationBrands: 1 };
        let project = (await projRepo.GetByFilterAndProjection(filter, projection) as any[])?.at(0) as Project;
        
        let pkg = await pkgRepo.GetOneByProjectID(projectId)

        let netclassList = await ncRepo.GetAllByProjectID(projectId) ?? []
        netclassList = sort(netclassList).asc(x => x.name.toUpperCase());

        let interfaceList = await ifaceRepo.GetAllByProjectID(projectId) ?? [];
        let ifaceMapping = new Map<string, Interface>();
        if(interfaceList && interfaceList.length > 0) {
            for(let iface of interfaceList) {
                ifaceMapping.set(iface._id?.toString() as string, iface)
            }
        }

        let incomingIdSet = new Set<string>(inputG2GInfoList.map(x => (x._id?.toString() as string)))

        let existingG2GData = await g2gRepo.GetAllByProjectID(projectId) ?? [];
        let existingIdSet = new Set<string>(existingG2GData.map(x => (x._id?.toString() as string)))
        if(Array.from(existingIdSet).every(x => incomingIdSet.has(x)) === false) {
            throw new Error(`Cannot process G2G data. Existing G2G data element was not found in incoming G2G data set`);
        }
        
        let existingG2GIdToNameMap = new Map<string, [string, G2GRelationContext]>();
        for(let i = 0; i < existingG2GData.length; i++) {
            let g2g = existingG2GData[i]
            let g2gId = g2g._id?.toString() as string;

            let ifaceName = ifaceMapping.get(g2g.interfaceId)?.name;
            let chName = g2g.channel.toString() || "";
            let segName = (g2g.segment && g2g.segment.length > 0) ? `_${g2g.segment}` : "";
            let finalG2GName = `${ifaceName}${chName}${segName}`.toUpperCase();
            existingG2GIdToNameMap.set(g2gId, [finalG2GName, g2g]);
        }

        let goldenLGSet = pkg.layerGroupSets.find(a => (a.isGolden === true));
        let defLGSet = pkg.layerGroupSets.find(a => a.isClearanceDefault === true);
        let defaultLGSetId = (defLGSet && defLGSet.id && defLGSet.id.length > 0) ? defLGSet.id : goldenLGSet?.id;
        if(!defaultLGSetId || defaultLGSetId.trim().length === 0) {
            throw new Error(`Error occured while processing G2G data. Could not determine default LGSet for clearance rules`)
        }

        if(Array.from(existingIdSet).every(x => incomingIdSet.has(x)) === false) {
            throw new Error(`Cannot process G2G data. Existing G2G data element was not found in incoming G2G data set`);
        }

        for (let g2g of inputG2GInfoList) {
            if (!g2g._id || (g2g._id.toString() as string) === 'undefined' || (g2g._id.toString().trim().length === 0)) {
                throw new Error(`Cannot process G2G data. incoming G2G context element must have a valid ID`);
            }
            if(existingIdSet.has(g2g._id.toString() as string) === false) {
                throw new Error(`Cannot process G2G data. incoming G2G context was not found in existing data`);
            }
            if(!g2g.interfaceId || (ifaceMapping.has(g2g.interfaceId) === false)) {
                throw new Error(`Cannot process G2G data. Unrecognized interface-id found for input G2G data`);
            }

            if((!g2g.channel || g2g.channel.trim().length === 0) && (!g2g.segment || g2g.segment.trim().length === 0)) { 
                ifaceIncomingG2GData.push(g2g);
            }
            else if(g2g.segment && g2g.segment.trim().length > 0) {
                segmentIncomingG2GData.push(g2g);
            }
            else {
                channelIncomingG2GData.push(g2g);
            }
        }

        //#region =============================================== BEGIN CORE PROCESSING =======================================================
    
        //Warning! - ORDER is very important here!!!
        g2gAssessmentInf = generateG2GAssessmentData(project, segmentIncomingG2GData, g2gAssessmentInf, netclassList, existingG2GIdToNameMap, defaultLGSetId);
        g2gAssessmentInf = generateG2GAssessmentData(project, channelIncomingG2GData, g2gAssessmentInf, netclassList, existingG2GIdToNameMap, defaultLGSetId);
        g2gAssessmentInf = generateG2GAssessmentData(project, ifaceIncomingG2GData, g2gAssessmentInf, netclassList, existingG2GIdToNameMap, defaultLGSetId);

        //verify naming and ensure no duplicates
        let crbConcats = g2gAssessmentInf.newCRBArray.concat(project.clearanceRelationBrands) ?? [];
        let cbrNames = crbConcats.map(x => x.name);
        verifyNaming(cbrNames, NamingContentTypeEnum.RELATION);

        let c2crList = await c2crRepo.GetAllByProjectID(projectId);
        
        //Important! - create snapshot here
        // const snapPprocStartTime = performance.now();
        // await createAutoGenSnapshot(projectId);
        // const snapEndTime = performance.now();
        // let snapTimetakenInSeconds = (snapPprocStartTime && snapPprocStartTime > 0) ? (Math.floor((snapEndTime - snapPprocStartTime) / 1000)).toString() : null
        // let snapTimetakenInMinutes = (snapPprocStartTime && snapPprocStartTime > 0) ? (Math.floor((snapEndTime - snapPprocStartTime) / (1000 * 60))).toString() : null

        //handle C2C slot changes according to G2G assessment
        let c2crListForUpdate = handleSlotValueChangesForG2GProcessing(c2crList, g2gAssessmentInf);

        //first clear all c2c-slot 'auto' assignments
        let origListGrpByRuleArea = groupBy(c2crList, a => a.ruleAreaId);
        for(let [raid, origListC2CRColl] of origListGrpByRuleArea) {
            let cleanedItems = new Array<C2CRow>();
            for(let i = 0; i < origListC2CRColl.length; i++) {
                let cleaned = false;
                for(let j = 0; j < origListC2CRColl[i].slots.length; j++) {
                    if(origListC2CRColl[i].slots[j].assignmentType === DataMappingTypeEnum.Auto) {
                        origListC2CRColl[i].slots[j].assignmentType = DataMappingTypeEnum.Unmapped;
                        origListC2CRColl[i].slots[j].value = "";
                        cleaned = true;
                    }
                }
                if(cleaned === true) { cleanedItems.push(origListC2CRColl[i]); }
            }
            if(cleanedItems.length > 0) {
                await updateC2CRow(cleanedItems, user, true);
            }
        }

        //get all used CRBs
        c2crList = await c2crRepo.GetAllByProjectID(projectId);  //get fresh data set
        let updaterIdSet = new Set(c2crListForUpdate.map(x => x._id?.toString() as string))
        let nonChangedC2CRs = c2crList.filter(x => updaterIdSet.has(x._id?.toString() as string) === false);
        c2crList = c2crListForUpdate.concat(nonChangedC2CRs);
        let usedCRBs = new Set<string>();
        for(let c2crItem of c2crList) {
            for(let slot of c2crItem.slots) {
                if(slot.value && slot.value.length > 0) {
                    usedCRBs.add(slot.value)
                }
            }
        }

        //update CRB info for project
        let totalCRBs : BasicProperty[] = g2gAssessmentInf.newCRBArray.concat((project as Project).clearanceRelationBrands ?? []);
        let finalCRBList : BasicProperty[] = totalCRBs.filter(x => usedCRBs.has(x.id)) ?? [];
        let updatedProject : Project|null = null;
        let dupDispNameRes = checkDuplicatesIgnoreCase(finalCRBList.map(a => a.name));
        if (dupDispNameRes === false) {
            throw new Error(`Cannot process G2G data. Duplicate clearance relation brand naming would result due to intended updates.`)
        }
        else {
            updatedProject = await updateProjectClearanceRelationBrands(projectId, finalCRBList);
        }
        
        //perform C2C updates
        if(updatedProject !== null && updatedProject._id) {
            if(c2crListForUpdate.length > 0) {
                let grpByRuleArea = groupBy(c2crListForUpdate, a => a.ruleAreaId);
                for(let [raid, c2crColl] of grpByRuleArea) {
                    await updateC2CRow(c2crColl, user, true);
                }
            }
        }

        //save g2g updates
        if(updatedProject !== null && updatedProject._id) {
            let incConcat = segmentIncomingG2GData.concat(ifaceIncomingG2GData).concat(channelIncomingG2GData) //Important!
            const crbNameToIdMap = new Map((updatedProject.clearanceRelationBrands ?? []).map(b => [b.name, b.id]));
            let currentProjCrbIdSet = new Set<string>((updatedProject.clearanceRelationBrands ?? []).map(x => x.id));
            let grpByIface = groupBy(incConcat, a => a.interfaceId);
            for(let [ifaceId, g2gList] of grpByIface) {
                if(g2gList && g2gList.length > 0) {
                    for(let k = 0; k < g2gList.length; k++){
                        g2gList[k].toAll.clearanceRelationBrandId = crbNameToIdMap.get(g2gList[k].toAll.clearanceRelationBrandId) ?? g2gList[k].toAll.clearanceRelationBrandId;
                        g2gList[k].intraclass.clearanceRelationBrandId = crbNameToIdMap.get(g2gList[k].intraclass.clearanceRelationBrandId) ?? g2gList[k].intraclass.clearanceRelationBrandId;
                        g2gList[k].within.clearanceRelationBrandId = crbNameToIdMap.get(g2gList[k].within.clearanceRelationBrandId) ?? g2gList[k].within.clearanceRelationBrandId;
                        if(g2gList[k].across && g2gList[k].across.length > 0) {
                            g2gList[k].across.forEach(q => {
                                q.clearanceRelationBrandId = crbNameToIdMap.get(q.clearanceRelationBrandId ) ?? q.clearanceRelationBrandId ;
                            })
                        }

                        //Important!
                        g2gList[k] = cleanG2GByConsideringInvalidCRB(g2gList[k], new Set<string>(), currentProjCrbIdSet);
                    }

                    await g2gRepo.ReplaceMany(g2gList);
                }
            }
        }
        
        //do the needful...
        assessLinkageRelatedLGCs(projectId, null, true); //do not wait on this...
        pushDefaultConstraints(projectId) //Important!
        sortSlots(projectId, true, true);
    
        const endTime = performance.now();
        let timetakenInSeconds = (procStartTime && procStartTime > 0) ? (Math.floor((endTime - procStartTime) / 1000)).toString() : null
        let timetakenInMinutes = (procStartTime && procStartTime > 0) ? (Math.floor((endTime - procStartTime) / (1000 * 60))).toString() : null

        //#endregion =============================================== END PROCESSING =======================================================

        handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.G2G_UPDATE, false, false);
    }
    catch(error: any) {
        handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.G2G_UPDATE, true, false, error.message);
        throw error;
    }  

    return true;
}




function generateG2GAssessmentData(project: Project, g2gInfoCollection: G2GRelationContext[], g2gAssessmentInf: G2GAssessmentData, 
    netclassesList: Netclass[], existingG2GIdToNameMap: Map<string, [string, G2GRelationContext]>, defaultLGSetId: string) : G2GAssessmentData {

    for(let g2g of g2gInfoCollection) {
        let g2gId = g2g._id?.toString() as string;
        let g2gName = existingG2GIdToNameMap.get(g2gId)?.[0]?.trim() as string;
        let srcRelevNCList = getRelevantNetclassInfo(g2g, g2gName, netclassesList);

        //-------------------------------------------------------------------------------
        // WARNING: Order matters for the core IF statements below
        //-------------------------------------------------------------------------------

        //handle 'TO_ALL' cases
        if(g2g.toAll.enabled === true) {
            let defaultCRBName = `${g2gName}_TOALL`;
            let g2gCRBPointer = g2g.toAll.clearanceRelationBrandId;
            let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
            g2gAssessmentInf = crbInf.assessInf;
            g2g.toAll.clearanceRelationBrandId = crbInf.crb.id;
            for(let nc of srcRelevNCList) {
                g2gAssessmentInf = setG2GAssessmentPairing(nc, g2gAssessmentInf, null, crbInf.crb, true);
            }
        }
        else { g2g.toAll.clearanceRelationBrandId = ""; }
        

        //handle 'Intraclass' cases
        if(g2g.intraclass.enabled === true) {
            let defaultCRBName = `${g2gName}_TOSELF`;
            let g2gCRBPointer = g2g.intraclass.clearanceRelationBrandId;
            let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
            g2gAssessmentInf = crbInf.assessInf;
            g2g.intraclass.clearanceRelationBrandId = crbInf.crb.id;
            for(let nc of srcRelevNCList) {
                g2gAssessmentInf = setG2GAssessmentPairing(nc, g2gAssessmentInf, nc, crbInf.crb, false);
            }
        }
        else { g2g.intraclass.clearanceRelationBrandId = ""; }


        //handle the 'ACROSS' cases
        if(g2g.across && g2g.across.length > 0) {
            for(let p = 0; p < g2g.across.length; p++) {
                if(g2g.across[p].enabled === true) {
                    if(g2g.across[p].targets && g2g.across[p].targets.length > 0) {
                        let defaultCRBName = (g2g.across.length > 1) ? `${g2gName}_ACROSS_${p}` : `${g2gName}_ACROSS`;
                        let g2gCRBPointer = g2g.across[p].clearanceRelationBrandId;
                        let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
                        g2gAssessmentInf = crbInf.assessInf;
                        g2g.across[p].clearanceRelationBrandId = crbInf.crb.id;
                        
                        for(let tgtId of g2g.across[p].targets) {
                            let tgtG2GCtx = existingG2GIdToNameMap.get(tgtId)?.[1] as G2GRelationContext;
                            let tgtG2GName = existingG2GIdToNameMap.get(tgtId)?.[0]?.trim() as string;
                            let tgtRelevNCList = getRelevantNetclassInfo(tgtG2GCtx, tgtG2GName, netclassesList);
                            for(let k = 0; k < srcRelevNCList.length; k++) {
                                for(let j = 0; j < tgtRelevNCList.length; j++) {
                                    if ((srcRelevNCList[k]._id?.toString() as string) !== (tgtRelevNCList[j]._id?.toString() as string)) {
                                        g2gAssessmentInf = setG2GAssessmentPairing(srcRelevNCList[k], g2gAssessmentInf, tgtRelevNCList[j], crbInf.crb, false);
                                    }
                                }
                            }
                        }
                    }
                }
                else { g2g.across[p].clearanceRelationBrandId = ""; }
            }
        }
        

        //handle the 'WITHIN"'cases
        if(g2g.within.enabled === true) {
            let defaultCRBName = `${g2gName}_WITHIN`;
            let g2gCRBPointer = g2g.within.clearanceRelationBrandId;
            let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
            g2gAssessmentInf = crbInf.assessInf;
            g2g.within.clearanceRelationBrandId = crbInf.crb.id;
                
            let workingNCList = rfdcCopy<Netclass[]>(srcRelevNCList) as Netclass[]
            while(workingNCList && workingNCList.length > 0) {
                let frontNC = workingNCList[0];
                for(let x = 0; x < workingNCList.length; x++) {
                    g2gAssessmentInf = setG2GAssessmentPairing(frontNC, g2gAssessmentInf, workingNCList[x], crbInf.crb, false);
                }
                workingNCList.shift(); //important!
            }
        }
        else { g2g.within.clearanceRelationBrandId = ""; }
    }

    return g2gAssessmentInf;
}


function getRelevantNetclassInfo(g2g: G2GRelationContext, g2gName: string, fullNetclassList: Netclass[]) : Netclass[] {
    let relevNCList = new Array<Netclass>();

    let isIfaceRootItem = ((!g2g.channel || g2g.channel.trim().length === 0) && (!g2g.segment || g2g.segment.trim().length === 0)) ? true : false; //is iface root G2G
    let isChannelAndSegment = ((g2g.channel && g2g.channel.trim().length > 0) && (g2g.segment && g2g.segment.trim().length > 0)) ? true : false;
    let isSegmentOnly = ((!g2g.channel || g2g.channel.trim().length === 0) && (g2g.segment && g2g.segment.trim().length > 0)) ? true : false;
    
    if(isIfaceRootItem) {
        relevNCList = fullNetclassList.filter(a =>  (a.interfaceId === g2g.interfaceId));
        relevNCList = relevNCList.filter(a => (!a.channel || (a.channel.trim().length === 0)));
        //Note: For interface Root level items, segment might or might not be set, and that is OK
    }
    else if(isChannelAndSegment) {
        relevNCList = fullNetclassList.filter(a =>  (a.interfaceId === g2g.interfaceId));
        relevNCList = relevNCList.filter(a => (a.channel && g2g.channel && (a.channel.trim() === g2g.channel.trim())));
        relevNCList = relevNCList.filter(a => (a.segment.trim().toUpperCase() === g2g.segment.trim().toUpperCase()));
    }
    else if (isSegmentOnly) {
        relevNCList = fullNetclassList.filter(a =>  (a.interfaceId === g2g.interfaceId));
        relevNCList = relevNCList.filter(a => (a.segment.trim().toUpperCase() === g2g.segment.trim().toUpperCase()));
        relevNCList = relevNCList.filter(a => (!a.channel || (a.channel.trim().length === 0)));
    }
    else {
        relevNCList = fullNetclassList.filter(a => 
            ((a.interfaceId === g2g.interfaceId) && a.channel && g2g.channel && (a.channel.trim() === g2g.channel.trim()))
        );
    }
    
    //The result Netclass list should NEVER be empty!
    if(!relevNCList || relevNCList.length === 0) {
        throw new Error(`UNEXPECTED DATA ERROR: Could not determine associated Netclasses for G2G Context '${g2gName ?? ''}'!`);                  
    }

    relevNCList = sort(relevNCList).asc(x => x.name.toUpperCase());
    return relevNCList
}


function setG2GAssessmentPairing(fromNC: Netclass, g2gAssessmentInf: G2GAssessmentData, toNC: Netclass|null, crb: BasicProperty, isToAll: boolean) : G2GAssessmentData {
    let fromNCID = fromNC?._id?.toString() as string || '';
    let toNCID = (isToAll ? C2C_ROW_ALLCOLUMN_SLOT_NAME : toNC?._id?.toString() as string) || '';
    let destNetclassName = (isToAll ? C2C_ROW_ALLCOLUMN_SLOT_NAME : toNC?.name) || '';

    if((fromNCID.trim().length === 0 && toNCID.trim().length === 0) || (toNC === null && isToAll === false)) {
        throw new Error("UNEXPECTED DATA ERROR: The ID for both source and destination netclass cannot be null or empty!")
    }

    let pairStrToken = `${fromNCID}__${toNCID}`;
    let pairStrTokenReverse = `${toNCID}__${fromNCID}`;
    let nameBasedPairStrToken = `${fromNC.name}__${destNetclassName}`;

    if((g2gAssessmentInf.ncidPairingSet.has(pairStrToken) === false) && (g2gAssessmentInf.ncidPairingSet.has(pairStrTokenReverse) === false)) {
        g2gAssessmentInf.ncidPairingSet.add(pairStrToken);
        g2gAssessmentInf.netclassPairingByName.add(nameBasedPairStrToken)
        g2gAssessmentInf.ncidPairingToCrbIdMap.set(pairStrToken, crb.id);
    }
    return g2gAssessmentInf;
}


function getExistingReusableCRB(project: Project, g2gAssessmentInf: G2GAssessmentData, g2gCRBPointer: string,
    defaultLGSetId: string, defaultCRBName: string) : {crb: BasicProperty, assessInf: G2GAssessmentData} {
    
    let crbName = "";
    let performAddNewCRB = true;

    let crb: BasicProperty = { id: crypto.randomUUID(), name: "", value: defaultLGSetId } as BasicProperty;

    if(g2gCRBPointer && g2gCRBPointer.trim().length > 0) {
        let foundInProj = (project as Project).clearanceRelationBrands.find(x => (x.id === g2gCRBPointer.trim() || x.name.toUpperCase() === g2gCRBPointer.trim().toUpperCase()));
        if(foundInProj) {
            crb = foundInProj;
            g2gAssessmentInf.reusedCRBIdArray.add(crb.id);
            performAddNewCRB = false;
        }
        else {
            let foundInNew = (g2gAssessmentInf.newCRBArray ?? []).find(x => (x.id === g2gCRBPointer.trim() || x.name.toUpperCase() === g2gCRBPointer.trim().toUpperCase()));
            if(foundInNew) {
                crb = foundInNew;
                performAddNewCRB = false
            }
        }

        crbName = (crb && crb.name && crb.name.length > 0) ? crb.name : (g2gCRBPointer.trim());  //potentially use custom CRB name
    }
    else {
        crbName = (crb && crb.name && crb.name.length > 0) ? crb.name : defaultCRBName
    }

    if(performAddNewCRB === true) {
       crb.name = crbName;
       g2gAssessmentInf.newCRBArray.push(crb);
    }

    return { crb: crb, assessInf: g2gAssessmentInf }
}


function handleSlotValueChangesForG2GProcessing(c2crList: C2CRow[], g2gAssessmentInf: G2GAssessmentData) : C2CRow[] {
    let groupedC2CR = groupBy(c2crList, a => a.netclassId)
    let c2crListForUpdate = new Array<C2CRow>();
    
    //handle slot value changes
    for(let pairing of g2gAssessmentInf.ncidPairingSet) {
        let splitArr: string[] = pairing.split("__");
        let fromNCID = splitArr[0];
        let toNCID = (splitArr[1] === C2C_ROW_ALLCOLUMN_SLOT_NAME) ? "" : splitArr[1];  //important!
        let correspCRB = g2gAssessmentInf.ncidPairingToCrbIdMap.get(pairing);

        if(fromNCID && correspCRB) {
            let pairingHandled = false;

            //direction 1
            let c2cRowInAllRuleAreas = groupedC2CR.get(fromNCID) ?? [];
            for(let c2cr of c2cRowInAllRuleAreas) {
                let breakoff = false;
                for(let slot of c2cr.slots) {
                    if(slot.name.trim() === C2C_ROW_ALLCOLUMN_SLOT_NAME) {
                        if (slot.netclassId !== "") {
                            throw new Error(`Data correctness error occured while processing G2G data. `
                                + `C2CRowSlot '${slot.name}' has incorrect netclass id. Main C2C Row id: ${c2cr._id?.toString()}`)
                        }
                    }

                    if(slot.netclassId !== toNCID && slot.netclassId === fromNCID) {
                        breakoff = true;
                        break;
                    }
                    else if(slot.netclassId === toNCID) {
                        slot.value = correspCRB;
                        slot.assignmentType = DataMappingTypeEnum.Auto;
                        c2crListForUpdate.push(c2cr);
                        pairingHandled = true;
                        break;
                    }
                }
                if(breakoff === true) {
                    break;
                }
            }

            //direction 2
            if(pairingHandled === false) {
                if(toNCID && (toNCID.trim().length > 0) && (toNCID.trim() !== C2C_ROW_ALLCOLUMN_SLOT_NAME)) { //important!
                    let revDirC2CRowInAllRuleAreas = groupedC2CR.get(toNCID) ?? [];
                    for(let c2cr of revDirC2CRowInAllRuleAreas) {
                        let breakoff = false;
                        for(let slot of c2cr.slots) {
                            if(slot.name !== C2C_ROW_ALLCOLUMN_SLOT_NAME) {
                                if(slot.netclassId !== fromNCID && slot.netclassId === toNCID) {
                                    breakoff = true;
                                    break;
                                }
                                else if(slot.netclassId === fromNCID) {
                                    slot.value = correspCRB;
                                    slot.assignmentType = DataMappingTypeEnum.Auto;
                                    c2crListForUpdate.push(c2cr);
                                    pairingHandled = true;
                                    break;
                                }
                            }
                        }
                        if(breakoff === true) {
                            break;
                        }
                    }
                }
            }

        }
    }

    let retList = rfdcCopy<C2CRow[]>(c2crListForUpdate) as C2CRow[];
    return retList;
}
//#endregion













//==========================================================


// let inputNetclassList = new Array<Netclass>();
    // let ctxPropMap = new Map<string, Map<string, string>>();
    // let inputNCNameToIDMapping = new Map<string, string>();

    // for(let netclass of inputNetclassList) {
    //     inputNCNameToIDMapping.set(netclass.name, netclass._id?.toString() as string) //Important! - this position is important (after possible name change)
    // }

    //     //handle verifications for interface COPY scenario
    // if(iface.initializationType === InterfaceInitTypeEnum.EXTERNAL_IMPORT) {
    //     if(!iface.sourceProjectId || iface.sourceProjectId.trim().length === 0) {
    //         throw new Error(`No sourceProjectId specified for interface. Valid sourceProjectId must be provided for interface copy scenario`)
    //     }
    //     if(!iface.sourceInterfaceId || iface.sourceInterfaceId.trim().length === 0) {
    //         throw new Error(`No sourceInterfaceId specified for interface. Valid sourceInterfaceId must be provided for interface copy scenario`)
    //     }
    //     // if(!iface.sourceTemplate) {
    //     //     throw new Error(`No sourceTemplate specified for interface. Valid sourceTemplate must be provided for interface copy scenario`)
    //     // } 
        
    //     let othList = iface.contextProperties.filter(a => (a.name.toUpperCase() === IFACE_COPY_RULEAREA_MAPPING) || (a.name.toUpperCase() === IFACE_COPY_LAYERGROUP_MAPPING)) ?? []
    //     for(let prop of othList) {
    //         ctxPropMap.set(prop.name, (new Map<string, string>()));
    //         if(prop.value && prop.value.length > 0) {
    //             let map = new Map<string, string>();
    //             for(let pv of (prop.value as BasicKVP[])) {
    //                 map.set(pv.key, pv.value);
    //             }
    //             ctxPropMap.set(prop.name, map);
    //         }
    //     }
    //     let raMapInfo = ctxPropMap.get(IFACE_COPY_RULEAREA_MAPPING)
    //     if(!raMapInfo || raMapInfo.size === 0) {
    //         throw new Error(`No rule area mapping specified for interface. Valid rule area mapping must be provided for interface copy scenario`)
    //     }
    //     let lyrGrpMapInfo = ctxPropMap.get(IFACE_COPY_LAYERGROUP_MAPPING)
    //     if(!lyrGrpMapInfo || lyrGrpMapInfo.size === 0) {
    //         throw new Error(`No layer group mapping specified for interface. Valid layer group mapping must be provided for interface copy scenario`)
    //     }
        
    //     if(!channelRangeShortStr || channelRangeShortStr.length  === 0) {
    //         let exisNCfilter = { interfaceId : iface.sourceInterfaceId } as Filter<Netclass>
    //         let srcNCCount = await netclassRepo.GetCountByProjectId(iface.sourceProjectId, [exisNCfilter])
    //         if(srcNCCount !== inputNetclassList.length) {
    //             throw new Error(`The number of netclasses specified for target interface does not match the number of netclasses found in source interface`)
    //         }
    //     }

    //     // if (exisProjNCNamesLowCase && exisProjNCNamesLowCase.size > 0) {
    //     //     for(let i = 0; i < inputNetclassList.length; i++) {
    //     //         if(exisProjNCNamesLowCase.has(inputNetclassList[i].name.toLowerCase().trim())) {
    //     //             let count = 1;
    //     //             do {
    //     //                 inputNetclassList[i].name = `${inputNetclassList[i].name}_${++count}`
    //     //             } while(exisProjNCNamesLowCase.has(inputNetclassList[i].name.toLowerCase().trim()))
    //     //         }
    //     //     } 
    //     // }
    // }



    // //handle constraints for iface copy scenario
    // if (newIface.initializationType === InterfaceInitTypeEnum.EXTERNAL_IMPORT) {
    //     let map = new Map<string, string>(resultingNetclassList.map(x => [x._id?.toString() as string, (inputNCNameToIDMapping.get(x.name) ?? '') ] ));
    //     ctxPropMap.set(IFACE_COPY_NETCLASS_MAPPING, map);
    //     await processConstraintsForAltIfaceCreateScenarios(newIface, resultingNetclassList, ctxPropMap, user)
    // }
            





//============================================================================================


// let isTGTIfaceLevelElem = ((!tgtG2GCtx.channel || tgtG2GCtx.channel.trim().length === 0) && (!tgtG2GCtx.segment || tgtG2GCtx.segment.trim().length === 0)) ? true : false;
                            

// //DEBUG
// if(g2gName === ("MISC_TESTING")) {
//     console.log("sdfddfsdfsd")
// }        
        

    // if(isIfaceRootColl === true) {
    //     relevNCList = fullNetclassList.filter(a => (!a.channel || (a.channel .trim().length === 0)) && (a.interfaceId === g2g.interfaceId));
    // }
    // else {
    //     if (g2g.segment && g2g.segment.trim().length > 0) {
    //         relevNCList = fullNetclassList.filter(a =>  (a.interfaceId === g2g.interfaceId));
    //         relevNCList =  relevNCList.filter(a => (a.channel && g2g.channel && (a.channel.trim() === g2g.channel.trim())));
    //         relevNCList = relevNCList.filter(a => (a.segment.trim().toUpperCase() === g2g.segment.trim().toUpperCase()));
    //     }
    //     else {
    //         relevNCList = fullNetclassList.filter(a => 
    //             ((a.interfaceId === g2g.interfaceId) && a.channel && g2g.channel && (a.channel.trim() === g2g.channel.trim()))
    //         );
    //     }
    // }

//==============================================================



        // //handle intraclass
        // if(deletedCrbIdSet.has(g2g.intraclass.clearanceRelationBrandId)){
        //     g2g.intraclass.clearanceRelationBrandId = "";
        //     g2g.intraclass.enabled = false;
        // }
        // else if ((g2g.intraclass.clearanceRelationBrandId && g2g.intraclass.clearanceRelationBrandId.length > 0) && (currentProjCRBList.has(g2g.intraclass.clearanceRelationBrandId) === false)) {
        //     g2g.intraclass.clearanceRelationBrandId = "";
        //     g2g.intraclass.enabled = false;
        // }

        // //handle toAll
        // if(deletedCrbIdSet.has(g2g.toAll.clearanceRelationBrandId)){
        //     g2g.toAll.clearanceRelationBrandId = "";
        //     g2g.toAll.enabled = false;
        // }
        // else if ((g2g.toAll.clearanceRelationBrandId && g2g.toAll.clearanceRelationBrandId.length > 0) && (currentProjCRBList.has(g2g.toAll.clearanceRelationBrandId) === false)) {
        //     g2g.toAll.clearanceRelationBrandId = "";
        //     g2g.toAll.enabled = false;
        // }

        // //handle within
        // if(deletedCrbIdSet.has(g2g.within.clearanceRelationBrandId)){
        //     g2g.within.clearanceRelationBrandId = "";
        //     g2g.within.enabled = false;
        // }
        // else if ((g2g.within.clearanceRelationBrandId && g2g.within.clearanceRelationBrandId.length > 0) && (currentProjCRBList.has(g2g.within.clearanceRelationBrandId) === false)) {
        //     g2g.within.clearanceRelationBrandId = "";
        //     g2g.within.enabled = false;
        // }

        // //handle across
        // if(g2g.across && g2g.across.length > 0) {
        //     for(let y = 0; y < g2g.across.length; y++) {
        //         if(deletedCrbIdSet.has(g2g.across[y].clearanceRelationBrandId)){
        //             g2g.across[y].clearanceRelationBrandId = "";
        //             g2g.across[y].enabled = false;
        //             g2g.across[y].targets = new Array<string>();
        //         }
        //         else if ((g2g.across[y].clearanceRelationBrandId && g2g.across[y].clearanceRelationBrandId.length > 0) && (currentProjCRBList.has(g2g.across[y].clearanceRelationBrandId) === false)) {
        //             g2g.across[y].clearanceRelationBrandId = "";
        //             g2g.across[y].enabled = false;
        //             g2g.across[y].targets = new Array<string>();
        //         }
        //     }
        // }





// function getRelevantNetclassInfo(g2gId: string, fullNetclassList: Netclass[], isIfaceRootColl: boolean) : {ifaceId: string, ncList: Netclass[] } {
//     let relevIfaceID: string;
//     let relevNCList = new Array<Netclass>();

//     if(isIfaceRootColl === true) {
//         relevIfaceID = getSectionsFromIdString(g2gId)?.data?.ifaceId as string
//         relevNCList = fullNetclassList.filter(a => (!a.channel || (a.channel .trim().length === 0)) && (a.interfaceId === relevIfaceID)) ?? [];
//     }
//     else {
//         let idSplitCtx = getSectionsFromIdString(g2gId)?.data  ///Note: if g2g ID is not same as interfaceID, then a valid number is expected here!
//         relevIfaceID = idSplitCtx?.ifaceId as string;
//         let chNum = (idSplitCtx?.channel?.toString()) ? idSplitCtx.channel.toString() : null;
//         let seg = (idSplitCtx?.segment && idSplitCtx.segment.trim().length > 0) ? idSplitCtx.segment.trim() : null;
//         if (seg){
//             relevNCList = fullNetclassList.filter(a => (a.channel && chNum && (a.channel === chNum) && (a.interfaceId === relevIfaceID) && a.segment === seg)) ?? []
//         }
//         else {
//             relevNCList = fullNetclassList.filter(a => (a.channel && chNum && (a.channel === chNum) && (a.interfaceId === relevIfaceID))) ?? []
//         }
//     }
    
//     relevNCList = sort(relevNCList).asc(x => x.name.toUpperCase());

//     return { ifaceId: relevIfaceID, ncList: relevNCList }
// }





// if(ifaceList && ifaceList.length > 0) {
//     for(let i = 0; i < ifaceList.length; i++) {
//         let delG2GList = new Set<string>();
//         for(let g2g of ifaceList[i].groupRelationContexts){
            
//             //handle intraclass
//             if(deletedCrbIdSet.has(g2g.clearanceRelationBrandIntraclass)){
//                 g2g.clearanceRelationBrandIntraclass = "";
//             }
//             else if ((g2g.clearanceRelationBrandIntraclass && g2g.clearanceRelationBrandIntraclass.length > 0) && (currentProjCRBList.has(g2g.clearanceRelationBrandIntraclass) === false)) {
//                 g2g.clearanceRelationBrandIntraclass = "";
//             }

//             //handle toAll
//             if(deletedCrbIdSet.has(g2g.clearanceRelationBrandToAll)){
//                 g2g.clearanceRelationBrandToAll = "";
//             }
//             else if ((g2g.clearanceRelationBrandToAll && g2g.clearanceRelationBrandToAll.length > 0) && (currentProjCRBList.has(g2g.clearanceRelationBrandToAll) === false)) {
//                 g2g.clearanceRelationBrandToAll = "";
//             }

//             //handle within
//             if(deletedCrbIdSet.has(g2g.clearanceRelationBrandWithin)){
//                 g2g.clearanceRelationBrandWithin = "";
//             }
//             else if ((g2g.clearanceRelationBrandWithin && g2g.clearanceRelationBrandWithin.length > 0) && (currentProjCRBList.has(g2g.clearanceRelationBrandWithin) === false)) {
//                 g2g.clearanceRelationBrandWithin = "";
//             }

//             //handle across
//             if(deletedCrbIdSet.has(g2g.clearanceRelationBrandAcross)){
//                 g2g.clearanceRelationBrandAcross = "";
//                 g2g.targets = new Array<string>();
//             }
//             else if ((g2g.clearanceRelationBrandAcross && g2g.clearanceRelationBrandAcross.length > 0) && (currentProjCRBList.has(g2g.clearanceRelationBrandAcross) === false)) {
//                 g2g.clearanceRelationBrandAcross = "";
//                 g2g.targets = new Array<string>();
//             }

//             //mark focus g2g for deletion is its segment has become invalid due to netclass deletions
//             let g2gIdSections = getSectionsFromIdString(g2g.id)?.data;
//             let g2gSeg = g2gIdSections?.segment?.trim()?.toUpperCase();
//             if(delSegmentNameSet.size > 0 && g2gSeg && g2gSeg.length > 0) {
//                 if(delSegmentNameSet.has(g2gSeg)) {
//                     delG2GList.add(g2g.id);
//                 }
//             }

//             //Remove G2G value if it points to an interface or a segment that has no corresponding is now invalid to the system
//             if(g2g.targets && g2g.targets.length > 0) {
//                 let delValueList = new Set<string>();
//                 for(let v = 0; v < g2g.targets.length; v++) {
//                     let valIdSections = getSectionsFromIdString(g2g.targets[v])?.data;
                    
//                     //remove target item if its segment has become invalid due to netclass deletions
//                     let g2gSeg = valIdSections?.segment?.trim()?.toUpperCase();
//                     if(delSegmentNameSet.size > 0 && g2gSeg && g2gSeg.length > 0) {
//                         if(delSegmentNameSet.has(g2gSeg)) {
//                             delValueList.add(g2g.targets[v]);
//                         }
//                     }

//                     //remove target item if its interface is no longer valid
//                     // this cleans up all target lists during whole-interface deletion scenarios
//                     if(valIdSections?.ifaceId && deletedIfaceIdSet.has(valIdSections.ifaceId)) {
//                         delValueList.add(g2g.targets[v]);
//                     }
//                 }
//                 g2g.targets = g2g.targets.filter(s => (delValueList.has(s) === false));
//             }

//         }
//         if(delG2GList.size > 0) {
//             ifaceList[i].groupRelationContexts = ifaceList[i].groupRelationContexts.filter(q => (delG2GList.has(q.id) === false));
//         }
        
//     }






    // let ifaceG2GCtx = g2gList.filter(x => x.interfaceId === ifaceId);

    // let chToNameRes = getNetclassToChannelNameMapping(iface, existingIfaceNetclasses, ifaceG2GCtx);
    // if(chToNameRes.isSuccessful === false) {
    //     throw new Error(chToNameRes.message);
    // }

    // let freshGenNCGrpById = groupBy(freshGenNCList, z => (z._id?.toString() as string));
    // for(let itemKey of Array.from(freshGenNCGrpById.keys())) {
    //     let ncid = itemKey;
    //     let ncList = freshGenNCGrpById.get(itemKey) ?? [];
    //     let exisNC = existingIfaceNetclasses.find(x => ((x._id?.toString() as string) === ncid))
    //     if(exisNC) {
    //         let namingInfo = chToNameRes.data?.get(exisNC._id?.toString() as string)
    //         let relevColl = existingIfaceNetclasses.filter(a => chToNameRes.data?.get(a._id?.toString() as string)?.suffix === namingInfo?.suffix)

    //         let byChannelMap = new Map<string, Netclass>();
    //         for(let nc of relevColl){
    //             if(byChannelMap.has(nc.channel)) {
    //                 throw new Error("UNEXPECTED DATA ERROR: only one item should exist with given channel!")
    //             }
    //             else {
    //                 byChannelMap.set(nc.channel, nc) //For this, it is expected that only one item should exist per channel number
    //             }
    //         }

    //         for (let mainNC of ncList) {
    //             let correspExisNC = byChannelMap.get(mainNC.channel)
    //             if(correspExisNC) {
    //                 let copyOfCorresNC = rfdcCopy<Netclass>(correspExisNC) as Netclass;
    //                 copyOfCorresNC.lastUpdatedOn = new Date();
    //                 copyOfCorresNC.name = mainNC.name;
    //                 copyOfCorresNC.pattern = mainNC.pattern;
    //                 if(mainNC.layerGroupSetId !== copyOfCorresNC.layerGroupSetId) {
    //                     copyOfCorresNC.layerGroupSetId = mainNC.layerGroupSetId;
    //                     lgsetSwitcherMap.set(copyOfCorresNC._id?.toString() as string, mainNC.layerGroupSetId);
    //                 }
    //                 chModNetclassList.push(copyOfCorresNC)
    //             }
    //             else {
    //                 mainNC._id = new ObjectId(); //Important - This is intentional!
    //                 chModNetclassList.push(mainNC)
    //             }
    //         }
    //     }
    // }





// SEPARATE THIS INTO G2G reconciliation function and NetClassList reconciliation function!!
// async function reconcileG2GAndNCListBasedOnChannelRangeMod(ifaceId: string, inputNetclassList: Netclass[], freshGenG2GList: G2GRelationContext[], freshGenNCList: Netclass[]) : 
//     Promise<{g2grList: G2GRelationContext[], ncList: Netclass[], lgsetChangeMap: Map<string, string>, hasRangeChange: boolean}>{
    
//     let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
//     let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//     let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION)
    
//     if(!freshGenNCList || freshGenNCList.length === 0) {
//         throw new Error("UNEXPECTED DATA ERROR: failed to determine full set of netclasses for interface update!")
//     }

//     let existingIface = await ifaceRepo.GetWithId(ifaceId);
    
//     let g2gIfaceFilter = {interfaceId: ifaceId} as Filter<G2GRelationContext>;
//     let existingG2GList = await g2gRepo.GetAllByProjectID(existingIface.projectId, g2gIfaceFilter);

//     let returnGroupRelationsInfo = new Array<G2GRelationContext>();
//     let chModNetclassList = new Array<Netclass>();
//     let lgsetSwitcherMap = new Map<string, string>();
    
//     let majorChangeOccured = false;

//     for(let x = 0; x < freshGenG2GList.length; x++) {
//         let exisEquivG2G = existingG2GList.find(g => g._id?.toString() === freshGenG2GList[x]._id?.toString())
        
//         if(exisEquivG2G && exisEquivG2G.across && exisEquivG2G.across.some(a => (a.enabled && a.targets && a.targets.length > 0))) {
//             returnGroupRelationsInfo.push(exisEquivG2G); //take existing G2G
//         }
//         else {
//             returnGroupRelationsInfo.push(freshGenG2GList[x])  //use new G2G
//             majorChangeOccured = true
//         }
//     }

//     let exisNCfilter = { interfaceId : ifaceId } as Filter<Netclass> 
//     let existingIfaceNetclasses = await netclassRepo.GetAllByProjectID(existingIface.projectId, exisNCfilter) ?? []
//     let chToNameRes = getNetclassToChannelNameMapping(existingIface, existingIfaceNetclasses)
//     if(chToNameRes.isSuccessful === false) {
//         throw new Error(chToNameRes.message);
//     }

//     let freshGenNCGrpById = groupBy(freshGenNCList, z => (z._id?.toString() as string));
//     for(let itemKey of Array.from(freshGenNCGrpById.keys())) {
//         let ncid = itemKey;
//         let ncList = freshGenNCGrpById.get(itemKey) ?? [];
//         let exisNC = existingIfaceNetclasses.find(x => ((x._id?.toString() as string) === ncid))
//         if(exisNC) {
//             let namingInfo = chToNameRes.data?.get(exisNC._id?.toString() as string)
//             let relevColl = existingIfaceNetclasses.filter(a => chToNameRes.data?.get(a._id?.toString() as string)?.suffix === namingInfo?.suffix)

//             let byChannelMap = new Map<string, Netclass>();
//             for(let nc of relevColl){
//                 if(byChannelMap.has(nc.channel)) {
//                     throw new Error("UNEXPECTED DATA ERROR: only one item should exist with given channel!")
//                 }
//                 else {
//                     byChannelMap.set(nc.channel, nc) //For this, it is expected that only one item should exist per channel number
//                 }
//             }

//             for (let mainNC of ncList) {
//                 let correspExisNC = byChannelMap.get(mainNC.channel)
//                 if(correspExisNC) {
//                     let copyOfCorresNC = rfdcCopy<Netclass>(correspExisNC) as Netclass;
//                     copyOfCorresNC.lastUpdatedOn = new Date();
//                     copyOfCorresNC.name = mainNC.name;
//                     copyOfCorresNC.pattern = mainNC.pattern;
//                     if(mainNC.layerGroupSetId !== copyOfCorresNC.layerGroupSetId) {
//                         copyOfCorresNC.layerGroupSetId = mainNC.layerGroupSetId;
//                         lgsetSwitcherMap.set(copyOfCorresNC._id?.toString() as string, mainNC.layerGroupSetId);
//                     }
//                     chModNetclassList.push(copyOfCorresNC)
//                 }
//                 else {
//                     mainNC._id = new ObjectId(); //Important - This is intentional!
//                     chModNetclassList.push(mainNC)
//                 }
//             }
//         }
//     }
    
//     let finalnetclassList = (chModNetclassList.length > 0) ? chModNetclassList : inputNetclassList;
//     if(returnGroupRelationsInfo.length === 1 && returnGroupRelationsInfo[0].id === ifaceId) {
//         finalnetclassList.forEach(x => {x.channel = ''})  //reset channels if update to iface resulted in removal of channels
//     } 
    
//     return {g2grList: returnGroupRelationsInfo, ncList: finalnetclassList, lgsetChangeMap: lgsetSwitcherMap, hasRangeChange: majorChangeOccured}
// }





//==========================================================================================

    // let reconInfo = {g2grList: new Array<G2GRelationContext>(), ncList: inputNetclassList, lgsetChangeMap: new Map<string, string>(), hasRangeChange: false};
    
    // if(chRangeCtxProp) {  
    //     if(!inputNetclassList || inputNetclassList.length === 0) {
    //         throw new Error(`No valid netclasses specified for interface`)
    //     }  
    //     //handle update to G2G specifications
    //     let channelRangeShortStr = chRangeCtxProp?.value as string
    //     let dataInfo = produceG2GInfoAndScaledNCListBasedOnChannelExpr(iface, channelRangeShortStr, inputNetclassList); //duplicate Netclass IDs expected as a result of this function
    //     reconInfo = await reconcileG2GAndNCListBasedOnChannelRangeMod(iface._id.toString(), inputNetclassList, dataInfo.resultG2GinfoArray, dataInfo.resultNetclassList);
    //     if(reconInfo.hasRangeChange === true) {
    //         await createAutoGenSnapshot(iface.projectId);
    //     }
    //     iface.groupRelationContexts = reconInfo.g2grList;
    // }


        
        
        // for(let [chName, [id, chNumStr]] of channelBasedG2GDataMap) {    
        //     let g2gRel: G2GRelationContext = { 
        //         id: id,
        //         setIntraclass: false,
        //         setToAll: false,
        //         setWithin: false,
        //         setAcross: false,
        //         clearanceRelationBrandIntraclass: "",
        //         clearanceRelationBrandToAll: "",
        //         clearanceRelationBrandWithin: "",
        //         clearanceRelationBrandAcross: "",
        //         targets: [],
        //         tags: [],
        //     }
        //     g2gInfoArr.push(g2gRel);

        //     if((chName && chName.length > 0 && chNumStr && chNumStr.toString().length > 0)) {
        //         for(let x = 0; x < inputNetclassList.length; x++) {
        //             let netclass = rfdcCopy<Netclass>(inputNetclassList[x]) as Netclass;
        //             netclass._id = ((netclass._id?.toString() as string).trim().length > 0) ? new ObjectId(netclass._id?.toString()) : netclass._id;  //Important - to be 100% sure it is not a string - js is weird!
        //             netclass.name = `${chName}_${netclass.name}`;   //IMPORTANT -- See naming convention for channeled netclass
        //             netclass.channel = chNumStr.toString();
        //             chModNetclassList.push(netclass);
        //         }
        //     }
        // }




//=============================================================

// let tgtIdInfo = getSectionsFromIdString(tgtId)?.data;
// if(tgtIdInfo?.ifaceId && tgtIdInfo.ifaceId.trim().length > 0 && tgtIdInfo?.channel && tgtIdInfo.channel !== null) {
//     let tgtElemNCList = netclassesList.filter(a => (a.channel && (a.channel === tgtIdInfo?.channel?.toString()) && (a.interfaceId === tgtIdInfo?.ifaceId))) ?? []
//     tgtElemNCList = sort(tgtElemNCList).asc(x => x.name.toUpperCase());
    
//     for(let k = 0; k < relevNCList.length; k++) {
//         for(let j = 0; j < tgtElemNCList.length; j++) {
//             if ((relevNCList[k]._id?.toString() as string) !== (tgtElemNCList[j]._id?.toString() as string)) {
//                 g2gAssessmentInf = setG2GAssessmentPairing(relevNCList[k], g2gAssessmentInf, tgtElemNCList[j], crbInf.crb, false);
//             }
//         }
//     }
// }

//=====================================


// let relevIfaceID: string;
        // let relevNCList  = new Array<Netclass>();

        // if(isIfaceRootCollection === true) {
        //     relevIfaceID = getSectionsFromIdString(g2gInfo.id)?.data?.ifaceId as string
        //     relevNCList = netclassesList.filter(a => (!a.channel || (a.channel .trim().length === 0)) && (a.interfaceId === relevIfaceID)) ?? [];
        // }
        // else {
        //     let idSplitCtx = getSectionsFromIdString(g2gInfo.id)?.data  ///Note: if g2g ID is not same as interfaceID, then a valid number is expected here!
        //     relevIfaceID = idSplitCtx?.ifaceId as string;
        //     let chNum = (idSplitCtx?.channel?.toString()) ? idSplitCtx.channel.toString() : null;
        //     let seg = (idSplitCtx?.segment && idSplitCtx.segment.trim().length > 0) ? idSplitCtx.segment.trim() : null;
        //     if (seg){
        //         relevNCList = netclassesList.filter(a => (a.channel && chNum && (a.channel === chNum) && (a.interfaceId === relevIfaceID) && a.segment === seg)) ?? []
        //     }
        //     else {
        //         relevNCList = netclassesList.filter(a => (a.channel && chNum && (a.channel === chNum) && (a.interfaceId === relevIfaceID))) ?? []
        //     }
        // }
        
        // relevNCList = sort(relevNCList).asc(x => x.name.toUpperCase());



//==========================================================


// function generateG2GAssessmentData(project: Project, g2gInfoCollection: G2GRelationInfo[], g2gAssessmentInf: G2GAssessmentData, 
//     netclassesList: Netclass[], existingG2GIdToNameMap: Map<string, Map<string, string>>, defaultLGSetId: string, isIfaceRootCollection: boolean) : G2GAssessmentData {
    
//     //-------------------------------------------------------------------------------
//     // WARNING: Order matters for the core IF statements below
//     //-------------------------------------------------------------------------------

//     let crbIdList = new Set<string>(project.clearanceRelationBrands?.map((a: BasicProperty) => a.id) ?? []);

//     for(let g2gInfo of g2gInfoCollection) {
//         let relevIfaceID: string;
//         let relevNCList  = new Array<Netclass>();

//         if(isIfaceRootCollection === true) {
//             relevIfaceID = getSectionsFromIdString(g2gInfo.id)?.data?.ifaceId as string
//             relevNCList = netclassesList.filter(a => (!a.channel || (a.channel .trim().length === 0)) && (a.interfaceId === relevIfaceID)) ?? [];
//         }
//         else {
//             let idSplitCtx = getSectionsFromIdString(g2gInfo.id)?.data  ///Note: if g2g ID is not same as interfaceID, then a valid number is expected here!
//             relevIfaceID = idSplitCtx?.ifaceId as string;
//             let chNum = (idSplitCtx?.channel?.toString()) ? idSplitCtx.channel.toString() : null;
//             let seg = (idSplitCtx?.segment && idSplitCtx.segment.trim().length > 0) ? idSplitCtx.segment.trim() : null;
//             if (seg){
//                 relevNCList = netclassesList.filter(a => (a.channel && chNum && (a.channel === chNum) && (a.interfaceId === relevIfaceID) && a.segment === seg)) ?? []
//             }
//             else {
//                 relevNCList = netclassesList.filter(a => (a.channel && chNum && (a.channel === chNum) && (a.interfaceId === relevIfaceID))) ?? []
//             }
//         }
        
//         relevNCList = sort(relevNCList).asc(x => x.name.toUpperCase());

        
//         //#region ------------------------------------------------------------- CORE LOGIC -----------------------------------------------------------
        
//         //handle 'TO_ALL' cases
//         if(g2gInfo.setToAll === true) {
//             let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//             let defaultCRBName = `${g2gName}_TOALL`;
//             let g2gCRBPointer = g2gInfo.clearanceRelationBrandToAll;
//             let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
//             g2gAssessmentInf = crbInf.assessInf;
//             g2gInfo.clearanceRelationBrandToAll = crbInf.crb.id;
//             for(let nc of relevNCList) {
//                 g2gAssessmentInf = setG2GAssessmentPairing(nc, g2gAssessmentInf, null, crbInf.crb, true);
//             }


//             // let crb: BasicProperty;
//             // if(g2gInfo.clearanceRelationBrandToAll && crbIdList.has(g2gInfo.clearanceRelationBrandToAll.trim())) {
//             //     crb = (project as Project).clearanceRelationBrands.find(a => a.id === g2gInfo.clearanceRelationBrandToAll.trim()) as BasicProperty;
//             //     g2gAssessmentInf.reusedCRBIdArray.add(crb.id);
//             // }
//             // else if()
//             // else {
//             //     if(!g2gInfo.clearanceRelationBrandToAll || g2gInfo.clearanceRelationBrandToAll.trim().length === 0) {
//             //         let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//             //         g2gInfo.clearanceRelationBrandToAll = `${g2gName}_TOALL`;
//             //     }
//             //     crb = { id: crypto.randomUUID(), name: g2gInfo.clearanceRelationBrandToAll, value: defaultLGSetId } as BasicProperty;
//             //     g2gAssessmentInf.newCRBArray.push(crb);
//             // }

//             // for(let nc of relevNCList) {
//             //     g2gAssessmentInf = setG2GAssessmentPairing(nc, g2gAssessmentInf, null, crb, true);
//             // }
//         }
        
//         //handle 'Intraclass' cases
//         if(g2gInfo.setIntraclass === true) {
//             let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//             let defaultCRBName = `${g2gName}_TOSELF`;
//             let g2gCRBPointer = g2gInfo.clearanceRelationBrandIntraclass;
//             let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
//             g2gAssessmentInf = crbInf.assessInf;
//             g2gInfo.clearanceRelationBrandIntraclass = crbInf.crb.id;
//             for(let nc of relevNCList) {
//                 g2gAssessmentInf = setG2GAssessmentPairing(nc, g2gAssessmentInf, nc, crbInf.crb, false);
//             }

//             // let crb: BasicProperty;
//             // if(g2gInfo.clearanceRelationBrandIntraclass && crbIdList.has(g2gInfo.clearanceRelationBrandIntraclass.trim())) {
//             //     crb = (project as Project).clearanceRelationBrands.find(a => a.id === g2gInfo.clearanceRelationBrandIntraclass.trim()) as BasicProperty;
//             //     g2gAssessmentInf.reusedCRBIdArray.add(crb.id);
//             // }
//             // else {
//             //     if(!g2gInfo.clearanceRelationBrandIntraclass || g2gInfo.clearanceRelationBrandIntraclass.trim().length === 0) {
//             //         let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//             //         g2gInfo.clearanceRelationBrandToAll = `${g2gName}_TOSELF`;
//             //     }
//             //     crb = { id: crypto.randomUUID(), name: g2gInfo.clearanceRelationBrandToAll, value: defaultLGSetId } as BasicProperty;
//             //     g2gAssessmentInf.newCRBArray.push(crb);
//             // }

//             // for(let nc of relevNCList) {
//             //     g2gAssessmentInf = setG2GAssessmentPairing(nc, g2gAssessmentInf, nc, crb, false);
//             // }
//         }

//         //handle the 'ACROSS' cases
//         if(g2gInfo.setAcross === true) {
//             if(g2gInfo.targets && g2gInfo.targets.length > 0) {
//                 let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//                 let defaultCRBName = `${g2gName}_ACROSS`;
//                 let g2gCRBPointer = g2gInfo.clearanceRelationBrandAcross;
//                 let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
//                 g2gAssessmentInf = crbInf.assessInf;
//                 g2gInfo.clearanceRelationBrandAcross = crbInf.crb.id;
                
                
//                 // let crb: BasicProperty;
//                 // if(g2gInfo.clearanceRelationBrandAcross && crbIdList.has(g2gInfo.clearanceRelationBrandAcross.trim())) {
//                 //     crb = (project as Project).clearanceRelationBrands.find(a => a.id === g2gInfo.clearanceRelationBrandAcross.trim()) as BasicProperty;
//                 //     g2gAssessmentInf.reusedCRBIdArray.add(crb.id);
//                 // }
//                 // else {
//                 //     if(!g2gInfo.clearanceRelationBrandAcross || g2gInfo.clearanceRelationBrandAcross.trim().length === 0) {
//                 //         let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//                 //         g2gInfo.clearanceRelationBrandAcross = `${g2gName}_ACROSS`;
//                 //     }
//                 //     crb = { id: crypto.randomUUID(), name: g2gInfo.clearanceRelationBrandAcross, value: defaultLGSetId } as BasicProperty;
//                 //     g2gAssessmentInf.newCRBArray.push(crb);
//                 // }

//                 for(let tgtId of g2gInfo.targets) {
//                     let tgtIdInfo = getSectionsFromIdString(tgtId)?.data;
//                     if(tgtIdInfo?.ifaceId && tgtIdInfo.ifaceId.trim().length > 0 && tgtIdInfo?.channel && tgtIdInfo.channel !== null) {
//                         let tgtElemNCList = netclassesList.filter(a => (a.channel && (a.channel === tgtIdInfo?.channel?.toString()) && (a.interfaceId === tgtIdInfo?.ifaceId))) ?? []
//                         tgtElemNCList = sort(tgtElemNCList).asc(x => x.name.toUpperCase());
                        
//                         for(let k = 0; k < relevNCList.length; k++) {
//                             for(let j = 0; j < tgtElemNCList.length; j++) {
//                                 if ((relevNCList[k]._id?.toString() as string) !== (tgtElemNCList[j]._id?.toString() as string)) {
//                                     g2gAssessmentInf = setG2GAssessmentPairing(relevNCList[k], g2gAssessmentInf, tgtElemNCList[j], crbInf.crb, false);
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//         }

//         //handle the 'WITHIN"'cases
//         if(g2gInfo.setWithin === true) {
//             let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//             let defaultCRBName = `${g2gName}_WITHIN`;
//             let g2gCRBPointer = g2gInfo.clearanceRelationBrandWithin;
//             let crbInf = getExistingReusableCRB(project, g2gAssessmentInf, g2gCRBPointer, defaultLGSetId, defaultCRBName) as {crb: BasicProperty, assessInf: G2GAssessmentData} 
//             g2gAssessmentInf = crbInf.assessInf;
//             g2gInfo.clearanceRelationBrandWithin = crbInf.crb.id;
                
            
//             // let crb: BasicProperty;
//             // if(g2gInfo.clearanceRelationBrandWithin && crbIdList.has(g2gInfo.clearanceRelationBrandWithin.trim())) {
//             //     crb = (project as Project).clearanceRelationBrands.find(a => a.id === g2gInfo.clearanceRelationBrandWithin.trim()) as BasicProperty;
//             //     g2gAssessmentInf.reusedCRBIdArray.add(crb.id);
//             // }
//             // else {
//             //     if(!g2gInfo.clearanceRelationBrandWithin || g2gInfo.clearanceRelationBrandWithin.trim().length === 0) {
//             //         let g2gName = existingG2GIdToNameMap.get(relevIfaceID)?.get(g2gInfo.id)?.trim() as string;
//             //         g2gInfo.clearanceRelationBrandWithin = `${g2gName}_WITHIN`;
//             //     }
//             //     crb = { id: crypto.randomUUID(), name: g2gInfo.clearanceRelationBrandWithin, value: defaultLGSetId } as BasicProperty;
//             //     g2gAssessmentInf.newCRBArray.push(crb);
//             // }

//             let workingNCList = rfdcCopy<Netclass[]>(relevNCList) as Netclass[]
//             while(workingNCList && workingNCList.length > 0) {
//                 let frontNC = workingNCList[0];
//                 for(let x = 0; x < workingNCList.length; x++) {
//                     g2gAssessmentInf = setG2GAssessmentPairing(frontNC, g2gAssessmentInf, workingNCList[x], crbInf.crb, false);
//                 }
//                 workingNCList.shift(); //important!
//             }
//         }
//         //#endregion ------------------------------------------------------------- END CORE LOGIC -----------------------------------------------------

//     }

//     return g2gAssessmentInf;
// }


//==============================================================================

// g2gAssessmentInf = generateNCToSelfG2gAssessmentData(project, inputG2GInfoList, g2gAssessmentInf, netclassList, defaultLGSetId);


// function generateNCToSelfG2gAssessmentData(project: Project, g2gList: G2GRelationInfo[], 
//     g2gAssessmentInf: G2GAssessmentData, netclassList: Netclass[], defaultLGSetId: string): G2GAssessmentData {
//     const NETCLASS_TO_SELF_CRB_NAME_PREFIX = "NC_TO_SELF";
//     let crbName = `${NETCLASS_TO_SELF_CRB_NAME_PREFIX}_${project._id?.toString().slice(-6)}`.trim().toUpperCase(); //Note: trim and uppercase!
//     let proceed = g2gList.every(x => x.setIntraclass === true); //for now....
    
//     if (proceed === true) {
//         let crb = project.clearanceRelationBrands.find(a => a.name.trim().toUpperCase() === crbName)
//         if(!crb || !crb.id) {
//             crb = { id: crypto.randomUUID(), name: crbName, value: defaultLGSetId } as BasicProperty;
//             g2gAssessmentInf.newCRBArray.push(crb);
//             g2gList.forEach(x => {x.clearanceRelationBrandIntraclass = crbName});
//         }
//         else {
//             g2gAssessmentInf.reusedCRBIdArray.add(crb.id);
//         }

//         for(let n = 0; n < netclassList.length; n++) {
//             g2gAssessmentInf = setG2GAssessmentPairing(netclassList[n], g2gAssessmentInf, netclassList[n], crb, false);
//         }
//     }

//     return g2gAssessmentInf;
// }





// //some cleanups
// if((g2gInfo.setToAll === false) && (g2gInfo.targets ??[]).length === 0) {
//     g2gInfo.clearanceRelationBrandAcross = "";
// }
// if(g2gInfo.setWithin === false) {
//     g2gInfo.clearanceRelationBrandWithin = "";
// }



// //clear values if g2g should not have any
// if((g2g.clearanceRelationBrandAcross.trim().length === 0) && (g2g.clearanceRelationBrandWithin.trim().length === 0)) {
//     g2g.targets = new Array<string>();
//     g2g.setToAll = false;
//     //NOTE: intentionally leaving 'g2g.setWithin' as whatever it was. No need to reset it.
// }






// let ncid = netclassList[n]._id?.toString() as string;
// let ncName = netclassList[n].name;
// let pairStrToken = `${ncid}__${ncid}`;
// let nameBasedPairStrToken = `${ncName}__${ncName}`

// if(g2gAssessmentInf.ncidPairingSet.has(pairStrToken) === false) {
//     g2gAssessmentInf.ncidPairingSet.add(pairStrToken);
//     g2gAssessmentInf.netclassPairingByName.add(nameBasedPairStrToken)
//     g2gAssessmentInf.ncidPairingToCrbIdMap.set(pairStrToken, crb.id);
// }



// let delSegments = new Set<string>(deletedNetclasses.filter(x => (x.segment && (x.segment.trim().length > 0))).map(a => a.segment.trim().toUpperCase()) ?? []);






// async function assessChannelRelatedDataUpdate(iface: Interface, channelRangeShortStr: string, inputNetclassList: Netclass[]) : Promise<[G2GRelationInfo[], Netclass[], Map<string, string>]>{
//     let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
//     let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    
//     let existingFocusIface = await ifaceRepo.GetWithId(iface._id?.toString() as string);
//     let dataInfo = determineNetclassAndG2GData(iface, channelRangeShortStr, inputNetclassList);
//     let returnGroupRelationsInfo = new Array<G2GRelationInfo>();
//     let chModNetclassList = new Array<Netclass>();

//     for(let x = 0; x < dataInfo.resultG2GinfoArray.length; x++) {
//         let exisEquiv = existingFocusIface.groupRelationsInfo.find(g => g.id === dataInfo.resultG2GinfoArray[x].id)
//         if(exisEquiv && exisEquiv.value) {
//             returnGroupRelationsInfo.push(exisEquiv);
//         }
//         else {
//             returnGroupRelationsInfo.push(dataInfo.resultG2GinfoArray[x])
//         }
//     }

//     let exisNCfilter = { interfaceId : iface._id?.toString() } as Filter<Netclass> 
//     let existingIfaceNetclasses = await netclassRepo.GetAllByProjectID(iface.projectId, exisNCfilter) ?? []
//     let chToNameRes = getNetclassToChannelNameMapping(existingFocusIface, existingIfaceNetclasses)
//     if(chToNameRes.isSuccessful == false) {
//         throw new Error(chToNameRes.message);
//     }

//     if(!dataInfo.resultNetclassList || dataInfo.resultNetclassList.length === 0) {
//         throw new Error("UNEXPECTED DATA ERROR: failed to determine full set of netclasses for interface update!")
//     }
//     let lgsetChangeMap = new Map<string, string>();
//     let grpMap = new Map<string, Netclass[]>();
//     for(let q = 0; q < dataInfo.resultNetclassList.length; q++){  //all netclass items in resultNetclassList are expected to have valid id
//         let currId = dataInfo.resultNetclassList[q]._id?.toString() as string;
//         let ncCollVal = grpMap.get(currId) ?? [];
//         ncCollVal.push(dataInfo.resultNetclassList[q])
//         grpMap.set(currId, Array.from(ncCollVal)) 
//     }
    
//     for(let [ncid, ncList] of grpMap) {
//         let exisNC = existingIfaceNetclasses.find(x => ((x._id?.toString() as string) === ncid))
//         if(exisNC) {
//             let naminfInfo = chToNameRes.data.get(exisNC._id?.toString() as string)
//             let relevColl = existingIfaceNetclasses.filter(a => chToNameRes.data.get(a._id?.toString() as string)?.suffix === naminfInfo.suffix)

//             let grpByChannel = new Map<string, Netclass>();
//             for(let nc of relevColl){
//                 if(grpByChannel.has(nc.channel)) {
//                     throw new Error("UNEXPECTED DATA ERROR: only one item should exist with given channel!")
//                 }
//                 else {
//                     grpByChannel.set(nc.channel, nc) //For this, it is expected that only one item should exist per channel number
//                 }
//             }

//             for (let mainNC of ncList) {
//                 let correspExisNC = grpByChannel.get(mainNC.channel)
//                 if(correspExisNC) {
//                     let copyOfCorresNC = rfdcCopy<Netclass>(correspExisNC) as Netclass;
//                     copyOfCorresNC.lastUpdatedOn = new Date();
//                     copyOfCorresNC.name = mainNC.name;
//                     copyOfCorresNC.pattern = mainNC.pattern;
//                     if(mainNC.layerGroupSetId !== copyOfCorresNC.layerGroupSetId) {
//                         copyOfCorresNC.layerGroupSetId = mainNC.layerGroupSetId;
//                         lgsetChangeMap.set(copyOfCorresNC._id?.toString() as string, mainNC.layerGroupSetId);
//                     }
//                     chModNetclassList.push(copyOfCorresNC)
//                 }
//                 else {
//                     chModNetclassList.push(mainNC)
//                 }
//             }
//         }
//     }
    

//     let finalnetclassList = (chModNetclassList.length > 0) ? chModNetclassList : inputNetclassList;
//     return [returnGroupRelationsInfo, finalnetclassList, lgsetChangeMap]
// }




//=================================================================================================
    

    // //handle update to G2G specifications
    // let existingFocusIface = await ifaceRepo.GetWithId(iface._id.toString() as string);
    // let dataInfo = determineNetclassAndG2GData(iface, channelRangeShortStr, inputNetclassList);
    // iface.groupRelationsInfo = [] //Important - reset this list first!
    // for(let x = 0; x < dataInfo.resultG2GinfoArray.length; x++) {
    //     let exisEquiv = existingFocusIface.groupRelationsInfo.find(g => g.id === dataInfo.resultG2GinfoArray[x].id)
    //     if(exisEquiv && exisEquiv.value) {
    //         iface.groupRelationsInfo.push(exisEquiv);
    //     }
    //     else {
    //         iface.groupRelationsInfo.push(dataInfo.resultG2GinfoArray[x])
    //     }
    // }

    // let exisNCfilter = { interfaceId : iface._id?.toString() } as Filter<Netclass> 
    // let existingIfaceNetclasses = await netclassRepo.GetAllByProjectID(iface.projectId, exisNCfilter) ?? []
    // let chToNameRes = getNetclassToChannelNameMapping(existingFocusIface, existingIfaceNetclasses)
    // if(chToNameRes.isSuccessful == false) {
    //     throw new Error(chToNameRes.message);
    // }

    // if(dataInfo.resultNetclassList) {
    //     let chModNetclassList = new Array<Netclass>();
    //     let grpMap = new Map<string, Netclass[]>();
    //     for(let item of dataInfo.resultNetclassList){  //all netclass items in resultNetclassList are expected to have valid id
    //         let currId = item._id?.toString() as string;
    //         let ncCollVal = (grpMap.get(currId) ?? []).concat([item])
    //         grpMap.set(currId, ncCollVal) 
    //     }

    //     if(grpMap.size > 0) {
    //         let lgsetChangeMap = new Map<string, string>();
    //         for(let [ncid, ncList] of grpMap) {
    //             let exisNC = existingIfaceNetclasses.find(x => ((x._id?.toString() as string) === ncid))
    //             if(exisNC) {
    //                 let naminfInfo = chToNameRes.data.get(exisNC._id?.toString() as string)
    //                 let relevColl = existingIfaceNetclasses.filter(a => chToNameRes.data.get(a._id?.toString() as string)?.suffix === naminfInfo.suffix)

    //                 let grpByChannel = new Map<string, Netclass>();
    //                 for(let nc of relevColl){
    //                     if(grpByChannel.has(nc.channel)) {
    //                         throw new Error("UNEXPECTED DATA ERROR: only one item should exist with given channel!")
    //                     }
    //                     else {
    //                         grpByChannel.set(nc.channel, nc) //For this, it is expected that only one item should exist per channel number
    //                     }
    //                 }

    //                 for (let mainNC of ncList) {
    //                     let correspExisNC = grpByChannel.get(mainNC.channel)
    //                     if(correspExisNC) {
    //                         let copyOfCorresNC = rfdcCopy<Netclass>(correspExisNC) as Netclass;
    //                         copyOfCorresNC.lastUpdatedOn = new Date();
    //                         copyOfCorresNC.name = mainNC.name;
    //                         copyOfCorresNC.pattern = mainNC.pattern;
    //                         if(mainNC.layerGroupSetId !== copyOfCorresNC.layerGroupSetId) {
    //                             copyOfCorresNC.layerGroupSetId = mainNC.layerGroupSetId;
    //                             lgsetChangeMap.set(copyOfCorresNC._id?.toString() as string, mainNC.layerGroupSetId);
    //                         }
    //                         chModNetclassList.push(copyOfCorresNC)
    //                     }
    //                     else {
    //                         chModNetclassList.push(mainNC)
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }


    //===========================================================


    //----------------------
    // group resultNetclassList by ID
    // for each group key of [key, val]:
    // 	    let X = item in existingNetclasses that has same key (aka id)
        
    // 	    for this same-key existing item, determine non-channeled netclass name based on seperating its channelname from base NC name
        
    // 	    let X_Oth = get all other existingNetclass items that have same non-channeled netclass name
        
    // 	    now we have two lists:
    // 		    val - (aka group values) 
    // 		    let corresp = [X].concat(X_oth)
            
    // 	we can now maptch items in val to items in corresp based on channel number

    // Need to check following:
        // name  --> make sure its the newest name if name was updated
        // enableC2CRow --> use from previous
        // enableC2CColumn --> use from previous
        // associatedProperties --> use from previous
        // layerGroupSetId  ===> if this is different, we need to use the proper function-call to execute the change


    //---------------------------------------------------

    

        





// async function XXXX(iface: Interface, inputNetclassList: Netclass[]) {
//     let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
//     let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//     //---------------------------------------------------
//     //Important - we need to collect this prior to emtying contextProperties
//     let channelRangeShortStr = iface.contextProperties.find(a => a.name.toUpperCase() === CHANNEL_RANGE)?.value as string
    
//     //handle update to G2G specifications
//     let existingFocusIface = await ifaceRepo.GetWithId(iface._id?.toString() as string);
//     let dataInfo = determineNetclassAndG2GData(iface, channelRangeShortStr, inputNetclassList);
//     iface.groupRelationsInfo = [] //Important - reset this list first!
//     for(let x = 0; x < dataInfo.resultG2GinfoArray.length; x++) {
//         let exisEquiv = existingFocusIface.groupRelationsInfo.find(g => g.id === dataInfo.resultG2GinfoArray[x].id)
//         if(exisEquiv && exisEquiv.value) {
//             iface.groupRelationsInfo.push(exisEquiv);
//         }
//         else {
//             iface.groupRelationsInfo.push(dataInfo.resultG2GinfoArray[x])
//         }
//     }

//     let exisNCfilter = { interfaceId : iface._id?.toString() } as Filter<Netclass> 
//     let existingIfaceNetclasses = await netclassRepo.GetAllByProjectID(iface.projectId, exisNCfilter) ?? []
//     let chToNameRes = getNetclassToChannelNameMapping(existingFocusIface, existingIfaceNetclasses)
//     if(chToNameRes.isSuccessful == false) {
//         throw new Error(chToNameRes.message);
//     }

//     // let ncGrouping : Map<string, Netclass[]> = groupBy<string, Netclass>(dataInfo.resultNetclassList as Netclass[], a => (a._id as any))
    
//     const grpMap = new Map<string, Netclass[]>();
//     if(dataInfo.resultNetclassList) {
        
//         for(let item of dataInfo.resultNetclassList){
//             let currId = item._id?.toString() as string;
//             let val = (grpMap.get(currId) ?? []).concat([rfdcCopy<Netclass>(item) as Netclass])
//             grpMap.set(currId, val) 
//         }
//         if(grpMap.size > 0) {
//             for(let [ncid, ncList] of grpMap) {
//                 let exisNC = existingIfaceNetclasses.find(x => (x._id?.toString() as string) === ncid)
//                 if(exisNC) {
//                     let rawNetclassName = chToNameRes.data.get(exisNC._id?.toString())
//                 }
//             }
//         }
//     }
    
//     console.log("adsaddadsa")
//     return grpMap;
// }








// let existingFocusIface = await ifaceRepo.GetWithId(iface._id.toString() as string);
    // let g2gChannelMapping = new Map<string|null, [string, string|null]>([ [null, [`${iface._id.toString()}`, null]] ]); 
    // iface.groupRelationsInfo = [] //Important - reset this list first!

    // if(channelRangeShortStr && channelRangeShortStr.trim().length > 0) {
    //     let res = getChannelArray(channelRangeShortStr)
    //     if(res.isSuccessful === false) {
    //         throw new Error(`Channel Range Error: -- ${res.message}`);
    //     }
    //     else if (res.data && res.data.length > 0) {
    //         for(let ch of res.data) {
    //             let id = `${iface._id.toString()}::${Number(ch).toString()}`; //important! - take note of Id convention here!
    //             let chNaming = `${iface.name}${ch}`;                    //IMPORTANT -- See naming convention for channels!
    //             g2gChannelMapping.set(chNaming, [id, ch])
    //         }
    //     }
    // }

    // for(let [chName, [id, chNumStr]] of g2gChannelMapping) {    
    //     let exisEquiv = existingFocusIface.groupRelationsInfo.find(x => x.id === id)
    //     if(exisEquiv && exisEquiv.value) {
    //         iface.groupRelationsInfo.push(exisEquiv);
    //     }
    //     else {
    //         let g2gRel: G2GRelationInfo = {
    //             id: id,
    //             name: (chName && chName.length > 0) ? chName : iface.name,
    //             value: new Array<BasicProperty>(),
    //             isToAll: false,
    //             channel: (chNumStr) ? chNumStr.toString() : null,
    //             clearanceRelationId: "",
    //             hasExemptionList: false,
    //             tags: [] 
    //         }
    //         iface.groupRelationsInfo.push(g2gRel);
    //     }
    // }


    //


//=======================================================================

//handle G2G specifications
            // let g2gChannelMapping = new Map<string|null, [string, string|null]>([ [null, [`${newInterfaceId}`, null]] ]); 
            // let chModNetclassList = new Array<Netclass>();

            // if(channelRangeShortStr && channelRangeShortStr.trim().length > 0) {
            //     let res = getChannelArray(channelRangeShortStr)
            //     if(res.isSuccessful === false) {
            //         throw new Error(`Channel Range Error: -- ${res.message}`);
            //     }
            //     else if (res.data && res.data.length > 0) {
            //         for(let ch of res.data) {
            //             let id = `${newInterfaceId}::${Number(ch).toString()}`; //important! - take note of Id convention here!
            //             let chNaming = `${iface.name}${ch}`;                    //IMPORTANT -- See naming convention for channels!
            //             g2gChannelMapping.set(chNaming, [id, ch])
            //         }
            //     }
            // }

            // for(let [chName, [id, chNumStr]] of g2gChannelMapping) {    
            //     let g2gRel: G2GRelationInfo = {
            //         id: id,
            //         name: (chName && chName.length > 0) ? chName : newIface.name,
            //         value: new Array<BasicProperty>(),
            //         isToAll: false,
            //         channel: (chNumStr) ? chNumStr.toString() : null,
            //         clearanceRelationId: "",
            //         hasExemptionList: false,
            //         tags: [] 
            //     }
            //     newIface.groupRelationsInfo.push(g2gRel);

            //     if((chName && chName.length > 0 && chNumStr && chNumStr.toString().length > 0)) {
            //         for(let x = 0; x < inputNetclassList.length; x++) {
            //             let netclass = rfdcCopy<Netclass>(inputNetclassList[x]) as Netclass;
            //             netclass.name = `${chName}_${netclass.name}`; //IMPORTANT -- See naming convention for channeled netclass
            //             netclass.channel = chNumStr.toString();
            //             chModNetclassList.push(netclass);
            //         }
            //     }
            // }

            // //handle netclass creation...
            // let finalNetclassList = (chModNetclassList.length === 0) ? inputNetclassList : chModNetclassList;






//===================================================


            // let resMap = getChannelToNameMapping(newIface, false);
            // if(resMap.data && resMap.data.size > 0) {
                // for(let [chNum, chNameInfo] of resMap.data) {



//handle G2G specifications
        //   export interface G2GRelationInfo {
        //     id: 601afe66ac7df215b94d819e  |  601afe66ac7df215b94d819e::0
        //     name: DDR0 
        //     isToAll: false;
        //     relationId: 2d32dff4-678b-412f-834b-3514cf7734dd;
        //     value: [
        //         {
        //             id: 601afe66ac7df215b94d819e::0
        //             name: DDR0
        //             value: 
        //         },
        //          {
        //             id: 601afe66ac7df215b94d819e::1
        //             name: DDR0
        //             value: 
        //         },
        //          {
        //             id: 601afe66ac7df215b94d819e::2
        //             name: DDR0
        //             value: 
        //         },
        //         ...etc...

        //     ]
        // }  

//=============================================================================



// let map = new Map<string, string>()
// for (let newNC of newNCList) {
//     let srcId = inputNCNameToIDMapping.get(newNC.name)
//     if(!srcId || srcId.trim().length === 0) {
//         throw new Error(`System could determine source netclass Id corresponding to a target netclass.`)
//     }
//     map.set(newNC._id?.toString() as string, srcId);
// }




// //make sure we cannot lock an already locked interface
// if(exIface._id?.toString() === iface._id.toString()) {
//     if(exIface.lockedBy && exIface.lockedBy.length > 0 && iface.lockedBy && iface.lockedBy.length > 0) {
//         if(exIface.lockedBy.toLowerCase().trim() !== iface.lockedBy.toLowerCase().trim()) {
//             throw new Error(`Interface with name '${iface.name}' is already locked by [${exIface.lockedBy}].`)
//         }
//     }
// }


// let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)

// let pkg = await pkgRepo.GetOneByProjectID(interfaces[0].projectId)
// if(!pkg) { throw new Error(`Failed to retrieve valid layout info.`) }


        
//     //remove interface from ruleArea disablement trackers
//     for(let ruleArea of pkg.ruleAreas) {
//         ruleArea.clearanceInterfaceExclusionList = ruleArea.clearanceInterfaceExclusionList.filter(a => ifaceIdList.includes(a) === false) ?? [];
//         ruleArea.physicalInterfaceExclusionList = ruleArea.physicalInterfaceExclusionList.filter(a => ifaceIdList.includes(a) === false) ?? []
//     }
//     await pkgRepo.ReplaceOne(pkg);

