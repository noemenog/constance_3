import { Filter, ObjectId } from "mongodb"
import { DBCollectionTypeEnum, ConstraintChangeActionEnum, NetclassNodeGenTypeEnum, NET_RETRIEVAL_BATCH_SIZE, NetManagementActionTypeEnum, NamingContentTypeEnum } from "../Models/Constants"
import { BasicProperty, NetMgmtCtx, User } from "../Models/HelperModels"
import { C2CRow, C2CRowSlot, G2GRelationContext, Interface, Net, Netclass, PackageLayout, Project } from "../Models/ServiceModels"
import { BaseRepository } from "../Repository/BaseRepository"
import { ServiceModelRepository } from "../Repository/ServiceModelRepository"
import { checkDuplicatesIgnoreCase, getRegexFromFilterTextString, groupBy, isNumber, rfdcCopy, verifyNaming } from "./UtilFunctions"
import { assessLinkageRelatedLGCs, performConstraintsAssessmentForNetclassAction, sortSlots } from "./ConstraintsMgmtLogic"
import { processNetChanges } from "./NetListLogic"
import { createAutoGenSnapshot } from "./SnapShotLogic"
import { getNetclassToChannelNameMapping, saveLatestChangeTrackingVersionsForCollection } from "./BasicCommonLogic"
import { sort } from "fast-sort"
import { processLinkageDeletion, updateProjectClearanceRelationBrands } from "./ProjectLogic"
import { cleanupG2GContextOnDataDeletion } from "./InterfaceLogic"






export async function createNetClasses(iface: Interface, netclasses: Netclass[]) : Promise<Netclass[]> {
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
    let ifaceRepo = new BaseRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION);

    let newNetclasses : Netclass[] = []

    let existingInterface: Interface = await ifaceRepo.GetWithId(iface._id?.toString() || '');
    if(!existingInterface){
        throw new Error(`Associated interface was not found in the system`)
    }

    
    let existingPkg = await pkgRepo.GetOneByProjectID(iface.projectId)
    if(!existingPkg || !existingPkg._id) {
        throw new Error(`Error occured while creating new netclass(es). Layout must exist for project`)
    }

    let goldenLGSet = existingPkg.layerGroupSets.find(a => (a.isGolden === true));
    let defLGSet = existingPkg.layerGroupSets.find(a => a.isPhysicalDefault === true);
    let defaultLGSetId = (defLGSet && defLGSet.id && defLGSet.id.length > 0) ? defLGSet.id : goldenLGSet?.id || '';
        
    //WARNING!: other validations should have already occured before entering this function
    for(let i = 0; i < netclasses.length; i++) {
        delete netclasses[i]['_id']; //IMPORTANT!!
        netclasses[i].lastUpdatedOn = new Date();
        netclasses[i].interfaceId = iface._id?.toString() || '';
        netclasses[i].enableC2CColumn = true;
        netclasses[i].enableC2CRow = true;
        netclasses[i].layerGroupSetId = (netclasses[i].layerGroupSetId.toString().trim().length > 0) 
            ? netclasses[i].layerGroupSetId.toString().trim()
            : defaultLGSetId;
    }

    newNetclasses = await netclassRepo.CreateMany(netclasses);
    if(!newNetclasses || (newNetclasses.length !== netclasses.length)){
        throw new Error(`An unspecified error occured while creating new netclass(es)`)
    }
    else {
        await performConstraintsAssessmentForNetclassAction(iface.projectId, ConstraintChangeActionEnum.NETCLASS_ADDITION, newNetclasses)
    }

    return newNetclasses;
}


export async function deleteNetClasses(netclasses: Netclass[]) : Promise<boolean> {
    let projectId : string;    
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

    if(netclasses && netclasses.length > 0) {
        for(let i = 0; i < netclasses.length; i++) {
            if(!netclasses[0].projectId || netclasses[0].projectId.trim().length === 0 || netclasses[i].projectId !== netclasses[0].projectId) {
                throw new Error(`All netclasses intended for deletion must have same projectId`);
            }
            if(!netclasses[0].interfaceId || netclasses[0].interfaceId.trim().length === 0 || netclasses[i].interfaceId !== netclasses[0].interfaceId) {
                throw new Error(`All netclasses intended for deletion must have same interfaceId`);
            }
        }

        projectId = netclasses[0].projectId;
        let netBatch = new Array<Net>();

        let ncObjIds = netclasses.map((x) => new ObjectId(x._id));
        let infilter = { _id: { $in: ncObjIds } };
        let foundNetclasses: Netclass[] = await netclassRepo.GetAllByProjectID(projectId, infilter) ?? [];

        if(foundNetclasses.length > 0) {
            for(let netclass of foundNetclasses) {
                let filter = { netclassId: netclass._id?.toString() } as Filter<Net>
                let cursor = netRepo.GetCursorByProjectIDAndProjection(projectId, [filter], null, NET_RETRIEVAL_BATCH_SIZE)
                for await (let unmapperNet of cursor) {  
                    netBatch.push(unmapperNet);
                    if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
                        let netChangeInfo: NetMgmtCtx = {
                            projectId: projectId,
                            actionType: NetManagementActionTypeEnum.REMOVE_NET_ASSIGNMENT,
                            status: "",
                            netsInvolved: netBatch,
                            contextualInfo: ""
                        }
                        await processNetChanges(netChangeInfo, null)
                        netBatch = new Array<Net>()
                    }
                }

                if(netBatch.length > 0){
                    let netChangeInfo: NetMgmtCtx = {
                        projectId: projectId,
                        actionType: NetManagementActionTypeEnum.REMOVE_NET_ASSIGNMENT,
                        status: "",
                        netsInvolved: netBatch,
                        contextualInfo: ""
                    }
                    await processNetChanges(netChangeInfo, null)
                    netBatch = new Array<Net>()
                }
            }

            let deleteList = foundNetclasses.map(a => a._id?.toString()) as string[]
            let delRes = await netclassRepo.DeleteMany(deleteList)
            if(delRes === true) {
                await performConstraintsAssessmentForNetclassAction(projectId, ConstraintChangeActionEnum.NETCLASS_REMOVAL, foundNetclasses)
                await processLinkageDeletion(projectId, [], [], new Set<string>(deleteList));
                await cleanupG2GContextOnDataDeletion(projectId, [], foundNetclasses, []); //no need to wait on this
            }
            else{
                throw new Error("An unexpected error occured while deleting netclasses")
            }
        }
    }
    
    return true;
}


export async function updateNetclassesForInterface (projectId: string, interfaceId: string, incomingNetclasses: Netclass[], g2gList: G2GRelationContext[]) : Promise<Netclass[]> {
    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)

    let result = new Array<Netclass>();

    let toBeAdded = new Array<Netclass>();
    let toBeUpdated = new Array<Netclass>();
    let toBeDeleted = new Array<Netclass>();
    
    if(incomingNetclasses && incomingNetclasses.length > 0)
    {
        for(let i = 0; i < incomingNetclasses.length; i++) {
            //must have same projectId
            if(!incomingNetclasses[0].projectId || incomingNetclasses[0].projectId.trim().length === 0 
                || !incomingNetclasses[i].projectId || incomingNetclasses[i].projectId !== incomingNetclasses[0].projectId || projectId !== incomingNetclasses[0].projectId) {
                throw new Error(`All netclasses must have same and expected projectId`);
            }
            //must have same interfaceId
            if(!incomingNetclasses[0].interfaceId || incomingNetclasses[0].interfaceId.trim().length === 0 
                || !incomingNetclasses[i].interfaceId || incomingNetclasses[i].interfaceId !== incomingNetclasses[0].interfaceId || interfaceId !== incomingNetclasses[0].interfaceId) {
                throw new Error(`All netclasses must have same and expected interfaceId`);
            }
            //must have valid name
            if (!incomingNetclasses[i].name || incomingNetclasses[i].name === 'undefined' || incomingNetclasses[i].name.trim().length === 0) {
                throw new Error(`Input netclass cannot have null or empty or undefined name`);
            }
            //must have valid lgset-Id
            if(!incomingNetclasses[i].layerGroupSetId) {
                throw new Error("`Layer group set is required for each netclass.")
            }
        }
        
        //interface must exist
        let iface = await ifaceRepo.GetWithId(interfaceId)
        if(!iface || !iface._id){
            throw new Error(`Cannot update Netclasses. Interfase specified for netclasses must actually exist`);
        }

        let allProjectNetclasses = await netclassRepo.GetAllByProjectID(projectId) ?? [];
        let existingIfaceNetclasses = allProjectNetclasses.filter(a => a.interfaceId === interfaceId);
        
        let existingNCMap = new Map<string, Netclass>();
        for(let x = 0; x < existingIfaceNetclasses.length; x++) {
            existingNCMap.set(existingIfaceNetclasses[x]._id?.toString() as string, existingIfaceNetclasses[x])
        }

        //determine deleted netclasses
        toBeDeleted = existingIfaceNetclasses.filter(a => incomingNetclasses.every(x => x._id?.toString() !== a._id?.toString()))

        for(let y = 0; y < incomingNetclasses.length; y++) {
            let ncid = incomingNetclasses[y]._id?.toString() as string;
            
            //determine added netclasses
            if((existingNCMap.has(ncid) === false)){
                toBeAdded.push(incomingNetclasses[y]);
            }
            
            //determine netclasses to be updated
            if (existingNCMap.has(ncid as string)){
                let exNC = existingNCMap.get(ncid) as Netclass;
                let updatableNC: Netclass = {
                    _id: exNC._id,
                    projectId: projectId,
                    snapshotSourceId: exNC.snapshotSourceId,
                    contextProperties: exNC.contextProperties,
                    lastUpdatedOn: new Date(),
                    name: incomingNetclasses[y].name || exNC.name,
                    pattern: incomingNetclasses[y].pattern,
                    patternIndex: incomingNetclasses[y].patternIndex,
                    interfaceId: interfaceId,
                    layerGroupSetId: incomingNetclasses[y].layerGroupSetId,
                    nodeType: exNC.nodeType,
                    channel: exNC.channel,
                    segment: incomingNetclasses[y].segment,
                    enableC2CRow: incomingNetclasses[y].enableC2CRow ?? exNC.enableC2CRow,
                    enableC2CColumn: incomingNetclasses[y].enableC2CColumn ?? exNC.enableC2CColumn,
                    associatedProperties: exNC.associatedProperties,
                }

                if(exNC.pattern.trim() !== incomingNetclasses[y].pattern.trim()) {
                    updatableNC.nodeType = NetclassNodeGenTypeEnum.Manual
                }
                
                toBeUpdated.push(updatableNC);
            }
        }

        let projOtherNCNames = allProjectNetclasses.filter(a => a.interfaceId !== interfaceId).map(a => a.name.trim());
        let remainerNCs = toBeAdded.concat(toBeUpdated)
        let remainerNCNames = remainerNCs.map(a => a.name.trim())
        let nameSet = projOtherNCNames.concat(remainerNCNames)
        
        //duplicate names are not allowed across entire project
        let dupRes = checkDuplicatesIgnoreCase(nameSet)
        if(dupRes === false) {
            throw new Error(`Cannot update Netclasses. Update transaction will result in duplicate netclass names within the project. Please re-evaluate the provided netclass names`);
        }

        if(incomingNetclasses.some(a => (a.channel && a.channel.trim().length > 0))) {

            let chToNameRes = getNetclassToChannelNameMapping(iface, incomingNetclasses, g2gList)
            if(chToNameRes.isSuccessful === false) {
                throw new Error(`Error while updating netclasses for interface. ${chToNameRes.message}`);
            }

            let chanToNameResData = chToNameRes.data as Map<string, {channelName: string, suffix: string}>
            let grpBySuffixName = groupBy(remainerNCs, x => (chanToNameResData.get(x._id?.toString() as string)?.suffix || ''));
            let firstSetCount = Array.from(grpBySuffixName.values()).at(0)?.length as number;
            
            for(let [suffixName, ncList] of grpBySuffixName) {
                if(ncList.length !== firstSetCount) {
                    throw new Error(`Error while updating netclasses for interface. There must be an equal set of netclasses across all channels.`);
                }

                for(let k = 0; k < ncList.length; k++) {
                    //all peer netclasses actross channels must have same LGSet
                    if(!ncList[0].layerGroupSetId || ncList[0].layerGroupSetId.trim().length === 0 || !ncList[k].layerGroupSetId || (ncList[k].layerGroupSetId !== ncList[0].layerGroupSetId)) {
                        throw new Error(`All peer netclasses across channels must have valid and exactly-same layerGroupSetId`);
                    }
                    if(ncList[k].pattern !== ncList[0].pattern) {
                        throw new Error(`All peer netclasses across channels must have valid and exactly-same pattern`);
                    }
                    if(ncList[k].patternIndex !== ncList[0].patternIndex) {
                        throw new Error(`All peer netclasses across channels must have valid and exactly-same patternIndex`);
                    }
                    if(!ncList[0].nodeType || !ncList[k].nodeType || (ncList[k].nodeType !== ncList[0].nodeType)) {
                        throw new Error(`All peer netclasses across channels must have valid and exactly-same nodeType`);
                    }
                    if(ncList[k].associatedProperties?.length !== ncList[0].associatedProperties?.length) {
                        throw new Error(`All peer netclasses across channels must have valid and exactly-same associatedProperties`);
                    }
                }
            }
        }

        //naming convention must be followed for all netclasses
        verifyNaming(remainerNCNames, NamingContentTypeEnum.NETCLASS)

        if(toBeDeleted.length > 0) {
            await deleteNetClasses(toBeDeleted) 
        }
        if(toBeAdded.length > 0) {
            await createNetClasses(iface, toBeAdded)
        }
        if(toBeUpdated.length > 0) {
            await netclassRepo.ReplaceMany(toBeUpdated)
        }

        let filter = {interfaceId: interfaceId } as Filter<Netclass>
        result = await netclassRepo.GetAllByProjectID(projectId, filter)
        
        let expectedLength = (toBeAdded.concat(toBeUpdated)).length
        if(!result || (result.length !== expectedLength)){
            throw new Error(`An unspecified error occured while updating netclass(es)`)
        }    
    }
    else {
        throw new Error(`No netclass(es) supplied for update operation`);
    }
    
    assessLinkageRelatedLGCs(projectId, null, true); //do not wait on this...
    sortSlots(projectId);  //IMPORTANT !!!

    return result;
}


export async function updateC2CRow(c2crList: C2CRow[], user: User|null, skipChangeTracking: boolean = false) : Promise<C2CRow[]>{
	let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)

	if(!c2crList || c2crList.length === 0) {
		throw new Error(`Could not update c2c data because no valid data was provided for the operation`);
	}
	
	for(let c2cr of c2crList) {
        if(!c2cr.projectId || c2cr.projectId.trim().length === 0 || c2cr.projectId.toLowerCase() === "undefined" ){
            throw new Error(`C2C data must have valid projectId`)
        }
		if(!c2cr.ruleAreaId || c2cr.ruleAreaId.trim().length < 2 || c2cr.ruleAreaId.toLowerCase() === "undefined" ){
            throw new Error(`Cannot update C2C data. 'ruleAreaId' must be valid`)
        }
		if(!c2cr.netclassId || c2cr.netclassId.trim().length < 2 || c2cr.netclassId.toLowerCase() === "undefined" ){
            throw new Error(`Cannot update C2C data. 'netclassId' must be valid`)
        }
		if(!c2cr.slots || c2cr.slots.length === 0){
            throw new Error(`Cannot update C2C data. Relevant slots were not found for c2c element`)
        }

		//check for sameness where necessary
		if(c2cr.projectId !== c2crList[0].projectId){
            throw new Error(`Cannot update C2C data. All supplied c2c elements must have the same project Id`)
        }
        if(c2cr.ruleAreaId !== c2crList[0].ruleAreaId){
            throw new Error(`Cannot update C2C data. All supplied c2c elements must have the same rule area`)
        }
		if(c2cr.slots.length !== c2crList[0].slots.length){
            throw new Error(`Cannot update C2C data. All supplied c2c elements must have same number of relation slots`)
        }

        c2cr.lastUpdatedOn = new Date();

        //IMPORTANT - Although aggregation query may produce it for UI, we do NOT want this persisted to the DB!!
        //I don't want to get in the business of saving names to DB.
        c2cr.name = ""; 
    }

    let mapBeforeUpdate = new Map<string, Map<string, any>>();
    let idList = c2crList.map((x: C2CRow) => new ObjectId(x._id?.toString()));
    let infilter = { _id: { $in: idList } as any } as Filter<C2CRow>;
    let initData = await c2crRepo.GetAllByProjectID(c2crList[0].projectId, infilter);
    if(initData && initData.length > 0) {
        for(let c2cr of initData) {
            mapBeforeUpdate.set(c2cr._id?.toString() as string, new Map<string, any>())
            for (let slot of c2cr.slots) {
                mapBeforeUpdate.get(c2cr._id?.toString() as string)?.set(slot.id, slot.value);
            }
        }
    }

    let updatedC2CRs = await executeC2CReplaceManyOperation(c2crList, user);
	if (updatedC2CRs && updatedC2CRs.length > 0) {
		updatedC2CRs = await setC2crNetclassName(updatedC2CRs) //only for data that is returned to UI. NOT for DB persistence!!!
        if(skipChangeTracking === false) {
            await saveLatestChangeTrackingVersionsForCollection(updatedC2CRs[0].projectId, user, new Map<string, C2CRowSlot[]>(updatedC2CRs.map(x => [x._id?.toString() as string, x.slots])), mapBeforeUpdate);
        }
        return updatedC2CRs;
	}
	else {
		//redundancy for the f of it...
		updatedC2CRs = await executeC2CReplaceManyOperation(c2crList, user);
		if (updatedC2CRs && updatedC2CRs.length > 0) {
			updatedC2CRs = await setC2crNetclassName(updatedC2CRs) //only for data that is returned to UI. NOT for DB persistence!!!
            if(skipChangeTracking === false) {
                await saveLatestChangeTrackingVersionsForCollection(updatedC2CRs[0].projectId, user, new Map<string, C2CRowSlot[]>(updatedC2CRs.map(x => [x._id?.toString() as string, x.slots])), mapBeforeUpdate);
            }
            return updatedC2CRs;
		}
		else {
			throw new Error(`Failed to get updated C2C data. An unspecified error may have occured while performing update operation`);
		}
	}

    //inner function
    async function setC2crNetclassName(updatedC2CRs : C2CRow[]) {
        let map = new Map<string, string>()
        let netclasses = await netclassRepo.GetAllByProjectID(updatedC2CRs[0].projectId) ?? []
        netclasses.forEach(a => map.set(a._id?.toString() as string, a.name))

        for (let c2cr of updatedC2CRs) {
            if (!c2cr.name || c2cr.name.trim().length === 0) { //Important if stmt
                c2cr.name = map.get(c2cr.netclassId)
            }
        }
        return updatedC2CRs;
    }
}


async function executeC2CReplaceManyOperation(c2crList: C2CRow[], user: User|null) : Promise<C2CRow[]>{
	let updatedC2CRs : C2CRow[] = [];
    let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
	let result = await c2crRepo.ReplaceMany(c2crList, false);
    if (result === true) {
        let idList = c2crList.map((x: C2CRow) => new ObjectId(x._id?.toString()));
        let infilter = { _id: { $in: idList } as any };
        updatedC2CRs = await c2crRepo.GetAllByProjectID(c2crList[0].projectId, infilter);
    }
    return updatedC2CRs
}


export async function getClassRelationLayout(projectId: string, lastId: string|null, limit: string|number, filterRuleAreaId: string, 
    filterInterfaceId: string, filterNetclassId: string|null, filterNetclassName: string|null, performSortSlots: boolean) : Promise<C2CRow[]> {
    
    let c2cRowList = new Array<C2CRow>();
    let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)    
    let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)

    let hasLastId = (!lastId || lastId === 'undefined' || lastId.trim().length === 0) ? false : true;
    let hasLimit = (!limit || limit === 'undefined' || limit.toString().trim().length === 0) ? false : true;

    if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
        throw new Error(`Failed to retrieve netclass relation layout. Input 'projectId' cannot be null or empty or undefined`);
    }
    if (!filterRuleAreaId || filterRuleAreaId === 'undefined' || filterRuleAreaId.trim().length === 0) {  // IMPORTANT - this is a must have!!
        throw new Error(`Failed to retrieve netclass relation layout. Input 'ruleAreaId' cannot be null or empty or undefined`);
    }
    if (hasLimit === false || (isNumber(limit) === false)) {
        throw new Error(`Failed to retrieve netclass relation layout. Input 'limit' is required. Its value must be a valid number.`);
    }
    
    let netclassList = new Array<Netclass>();
    let ncMap = new Map<string, Netclass>();
    if((filterInterfaceId && filterInterfaceId.length > 0) && (filterNetclassId && filterNetclassId.length > 0)) {
        let ncFilter = { _id: new ObjectId(filterNetclassId), interfaceId: filterInterfaceId, projectId: projectId } as Filter<Netclass>
        netclassList = await ncRepo.GetWithFilter(ncFilter);
    }
    else if(filterInterfaceId && filterInterfaceId.length > 0) {
        let ncFilter = { interfaceId: filterInterfaceId } as Filter<Netclass>
        netclassList = await ncRepo.GetAllByProjectID(projectId, ncFilter);
    }
    else if(filterNetclassId && filterNetclassId.length > 0) {
        let ncItem = await ncRepo.GetWithId(filterNetclassId);
        netclassList = (ncItem && ncItem._id) ? [ncItem] : [];
    }
    else if(filterNetclassName && filterNetclassName.length > 0) {
        let regexName = getRegexFromFilterTextString(filterNetclassName)
        let ncFilter = { name: regexName } as Filter<Netclass>
        netclassList = await ncRepo.GetAllByProjectID(projectId, ncFilter);
    }
    else {
	    netclassList = await ncRepo.GetAllByProjectID(projectId) ?? []
    }

    netclassList.forEach(nc => ncMap.set(nc._id?.toString()?.trim() as string, nc));
    
    let c2crFilters = new Array<Filter<C2CRow>>();
    if(filterRuleAreaId && filterRuleAreaId.length > 0) {
        let regexRaid = new RegExp(`^${filterRuleAreaId}`, 'i');
        c2crFilters.push({ ruleAreaId: regexRaid } as Filter<C2CRow>)
    }

    if(filterNetclassId && filterNetclassId.length > 0) {
        let regexNetclassId = new RegExp(`^${filterNetclassId}`, 'i');
        c2crFilters.push({ netclassId: regexNetclassId } as Filter<C2CRow>)
    }

    if(performSortSlots === true) {
        sortSlots(projectId, true, true); //silently ensure sorted slots for next time this is queried - for good measures
    }

    if(hasLastId && hasLimit){
        c2cRowList = await c2crRepo.PaginationGetPageByProjectIDAndProjection(projectId, c2crFilters, lastId ?? "", parseInt(limit.toString().trim(), 10), null)
    }
    else if ((hasLastId === false) && hasLimit){
        c2cRowList = await c2crRepo.PaginationGetLastByProjectIDAndProjection(projectId, c2crFilters, parseInt(limit.toString().trim(), 10), null)
    }
    else {
        c2cRowList = await c2crRepo.GetAllByProjectID(projectId)
    }

    if(c2cRowList && c2cRowList.length > 0) {
        let remList = new Set<string>();
        for(let k = 0; k < c2cRowList.length; k++) {
            if(ncMap.has(c2cRowList[k].netclassId.trim())) {
                c2cRowList[k].name = ncMap.get(c2cRowList[k].netclassId)?.name || '';
            }
            else {
                remList.add(c2cRowList[k]._id?.toString() as string)
            }
        }

        if(remList.size > 0) {
            c2cRowList = c2cRowList.filter(a => (remList.has(a._id?.toString() as string) === false));
        }
    }

    if(c2cRowList && c2cRowList.length > 1) {
        let ifaceProjectionSpec = { _id: 1, name: 1 }
	    let ifaceList = await ifaceRepo.GetAllByProjectIDAndProjection(projectId, null, ifaceProjectionSpec) ?? [];
        
        let ifaceToNameMap = new Map<string, string>();
        ifaceList.forEach(x => ifaceToNameMap.set(x._id?.toString()?.trim() as string, x.name));
        
        c2cRowList = sort(c2cRowList).asc([
            a => ifaceToNameMap.get(ncMap.get(a.netclassId)?.interfaceId as string)?.toUpperCase(), 
            a => Number(ncMap.get(a.netclassId)?.channel),
            a => a.name?.toUpperCase()
        ]);
    }

    return c2cRowList;
}


export async function getClassRelationNameElementsForInterface(project: Project, filterIfaceId: string, filterRuleAreaId: string|null) : Promise<BasicProperty[]> {
    if (!project) {
        throw new Error(`Input 'project' cannot be null or empty or undefined`);
    }
    if (!filterIfaceId || filterIfaceId === 'undefined' || filterIfaceId.trim().length === 0) {
        throw new Error(`Input 'interfaceId' cannot be null or empty or undefined`);
    }
    
    let projectId = project._id?.toString() as string;
    
    let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)

    let result = new Array<BasicProperty>();

    if(project.clearanceRelationBrands && project.clearanceRelationBrands.length > 0) {
        
        //get all netclasses for the interface
        let ncFilter = { interfaceId: filterIfaceId } as Filter<Netclass>
        let netclassesForInterface = await ncRepo.GetAllByProjectID(projectId, ncFilter)

        if(netclassesForInterface && netclassesForInterface.length > 0) {
            if(netclassesForInterface[0].projectId !== projectId) {
                throw new Error("Input mismatch detected. Specified interface does not have the specified project ID")
            }
            
            //get all the C2C rows for netclasses that belong to the interface
            const ncidStrList = netclassesForInterface.map((x: Netclass) => x._id?.toString());
            
            let infilter = (filterRuleAreaId && filterRuleAreaId.trim().length > 0) 
                ? { ruleAreaId: filterRuleAreaId, netclassId: { $in: ncidStrList } as any } as Filter<C2CRow>
                : { netclassId: { $in: ncidStrList } as any } as Filter<C2CRow>;
            
            let relevantC2CRows = await c2crRepo.GetAllByProjectID(projectId, infilter)

            //get a unique set to relation names mentioned/specified in the select group of C2C rows
            let relationIdSet = new Set<string>();
            if(relevantC2CRows && relevantC2CRows.length > 0) {
                for(let c2cr of relevantC2CRows) {
                    for(let slot of c2cr.slots) {
                        if(slot.value && slot.value.trim().length > 0) {
                            relationIdSet.add(slot.value)
                        }
                    }
                }
            }

            if(relationIdSet.size > 0) {
                result = project.clearanceRelationBrands.filter(a => relationIdSet.has(a.id)) ?? []
            }
        }
    }

    return result
}


export async function clearClassRelations(projectId: string, ruleAreaId: string, deleteAllRelationBrands: boolean) : Promise<boolean> {
    let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
    
    if(deleteAllRelationBrands === true) {
        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let project = await projRepo.GetWithId(projectId);
        if(!project) { throw new Error(`Could not perform deletion action. Project not found for provided ID.`); }
        
        let updatedProject = await updateProjectClearanceRelationBrands(project?._id?.toString() as string, new Array<BasicProperty>())
        if(!updatedProject || !updatedProject._id) {
            return false;
        }
    }
    else {
        let changed = false;
        let filter = { ruleAreaId: ruleAreaId }
        let c2crList = await c2crRepo.GetAllByProjectID(projectId, filter);

        if (c2crList && c2crList.length > 0) {
            for(let c2cr of c2crList){
                for (let slot of c2cr.slots) {
                    if(slot.value && slot.value.length > 0) {
                        slot.value = "";
                        changed = true;
                    }
                }
            }
        }
        else {
            throw new Error(`Could not find any C2C relations for the provided project and Rule-Area ID.`);
        }
        
        if(changed) {
            await createAutoGenSnapshot(projectId);
            await c2crRepo.ReplaceMany(c2crList);
        }
    }

    return true;
}














// let existingIfaceNetclasses = allProjectNetclasses.filter(a => a.interfaceId === interfaceId)
        // let exisProjNCNamesLowCase = new Set<string>(allProjectNetclasses.map(a => a.name.toLowerCase().trim()));
        // let exisProjNetclassList = await netclassRepo.GetAllByProjectID(iface.projectId) as Netclass[];
    
        // if(!existingIfaceNetclasses || existingIfaceNetclasses.length === 0) {  //NOTE: a netclass is always expected to exist for an interface
        //     throw new Error(`ERROR! Unexpected scenario! Interface is expected to have existing netclasses.`);
        // }  
        



        // c2cRowList = c2cRowList.filter(a => ncMap.has(a.netclassId.trim()));
        // c2cRowList[k].name = ncMap.get(c2cRowList[k].netclassId)?.name || '';



        // for(let k = 0; k < c2cRowList.length; k++) {
        //     if(ncMap.has(c2cRowList[k].netclassId.trim()) === false) {
        //         throw new Error(`Failed to determine netclass associated to C2C-Row item. Netclass not found: ${c2cRowList[k].netclassId}`);
        //     }
        //     else {
        //         c2cRowList[k].name = ncMap.get(c2cRowList[k].netclassId)?.name || '';
        //     }
        // }




// let existingG2GDataMap = new Map<string, Map<string, G2GRelationInfo>>();

    // //==========================

    //     // let exisIfaceId = exisIfaceItem._id?.toString() as string
    //     existingG2GDataMap.set(exisIfaceId, new Map());
    //     for (let exisG2gInfo of exisIfaceItem.groupRelationsInfo) {
    //         existingG2GDataMap.get(exisIfaceId)?.set(exisG2gInfo.id, exisG2gInfo);
    //         existingIdSet.add(exisG2gInfo.id);
    //         if(incomingIdSet.has(exisG2gInfo.id) === false) {
    //             throw new Error(`Cannot process G2G data. Existing G2G context was not found in incoming data`);
    //         }
    //     }
    

    // let reusedCRBIdArray = new Set<string>();
    // let newCRBArray = new Array<BasicProperty>();
    // let ncPairingSet = new Set<string>();
    // let ncPairingToCrbIdMap = new Map<string, string>();


    //======================================

    // let incomingG2GDataMap = new Map<string, Map<string, G2GRelationInfo>>();
    // for (let incG2gInfo of g2gInfoList) {
    //     if (!incG2gInfo.id || incG2gInfo.id === 'undefined' || incG2gInfo.id.trim().length === 0) {
    //         throw new Error(`Cannot process G2G data. incoming G2G conrtext element must have a valid ID`);
    //     }
    //     if(existingIdSet.has(incG2gInfo.id) === false) {
    //         throw new Error(`Cannot process G2G data. incoming G2G conrtext was not found in existing data`);
    //     }
    //     let res = getIdAndChannelFromString(incG2gInfo.id);
    //     let incIfaceId = res?.data?.ifaceId || "";
    //     if(!incIfaceId || (existingG2GDataMap.has(incIfaceId) === false)){
    //         throw new Error(`Cannot process G2G data. Unrecognized interface id found in input G2G data`);
    //     }
    //     if((res.isSuccessful === false)) {
    //        throw new Error(`${res.message}`);
    //     }
        
    //     if (incomingG2GDataMap.has(incIfaceId) === false){
    //         incomingG2GDataMap.set(incIfaceId, new Map());
    //     }
    //     incomingG2GDataMap.get(incIfaceId)?.set(incG2gInfo.id, incG2gInfo);
    // }

    // let reusedCRBIdArray = new Set<string>();
    // let newCRBArray = new Array<BasicProperty>();
    // let ncPairingSet = new Set<string>();
    // let ncPairingToCrbIdMap = new Map<string, string>();

    // for(let [ifaceId, g2gMapping] of incomingG2GDataMap) {
    //     for(let [g2gId, g2gInfo] of g2gMapping) {
            
    //         let relevNCList  = new Array<Netclass>();
    //         if (g2gId === ifaceId) {
    //             relevNCList = netclassesList.filter(a => (!a.channel || (a.channel .trim().length === 0)) && (a.interfaceId === ifaceId)) ?? []
    //         }
    //         else if(g2gId !== ifaceId) {
    //             let channelNum : number = getIdAndChannelFromString(g2gId)?.data?.channel as number  ///if g2gId is not same as interfaceID, then a valid number is expected here!
    //             relevNCList = netclassesList.filter(a => (a.channel && (a.channel === channelNum.toString()) && (a.interfaceId === ifaceId))) ?? []
    //         }

    //         relevNCList = sort(relevNCList).asc(x => x.name.toUpperCase());

    //         //handle 'TO_ALL' cases
    //         if(g2gInfo.setToAll === true) {
    //             let crb: BasicProperty;
    //             if(g2gInfo.clearanceRelationBrandAcross && crbIdList.has(g2gInfo.clearanceRelationBrandAcross.trim())) {
    //                 crb = (project as Project).clearanceRelationBrands.find(a => a.id === g2gInfo.clearanceRelationBrandAcross) as BasicProperty;
    //                 reusedCRBIdArray.add(crb.id);
    //             }
    //             else {
    //                 if(!g2gInfo.clearanceRelationBrandAcross || g2gInfo.clearanceRelationBrandAcross.trim().length === 0) {
    //                     g2gInfo.clearanceRelationBrandAcross = `${g2gInfo.name.trim()}_TOALL`;
    //                 }
    //                 crb = { id: crypto.randomUUID(), name: g2gInfo.clearanceRelationBrandAcross, value: defaultLGSetId } as BasicProperty;
    //                 newCRBArray.push(crb);
    //             }

    //             for(let nc of relevNCList) {
    //                 let ncid = nc._id?.toString() as string;
    //                 let pairStrToken = `${ncid}__${C2C_ROW_ALLCOLUMN_SLOT_NAME}`
    //                 ncPairingSet.add(pairStrToken)
    //                 ncPairingToCrbIdMap.set(pairStrToken, crb.id);
    //             }
    //         }
            
    //         //handle the 'ACROSS' cases
    //         if(g2gInfo.setToAll === false) {
    //             if(g2gInfo.value && g2gInfo.value.length > 0) {
    //                 let crb: BasicProperty;
    //                 if(g2gInfo.clearanceRelationBrandAcross && crbIdList.has(g2gInfo.clearanceRelationBrandAcross.trim())) {
    //                     crb = (project as Project).clearanceRelationBrands.find(a => a.id === g2gInfo.clearanceRelationBrandAcross) as BasicProperty;
    //                     reusedCRBIdArray.add(crb.id);
    //                 }
    //                 else {
    //                     if(!g2gInfo.clearanceRelationBrandAcross || g2gInfo.clearanceRelationBrandAcross.trim().length === 0) {
    //                         g2gInfo.clearanceRelationBrandAcross = `${g2gInfo.name.trim()}_ACROSS`;
    //                     }
    //                     crb = { id: crypto.randomUUID(), name: g2gInfo.clearanceRelationBrandAcross, value: defaultLGSetId } as BasicProperty;
    //                     newCRBArray.push(crb);
    //                 }

    //                 for(let valueId of g2gInfo.value) {
    //                     let valueIdInfo = getIdAndChannelFromString(valueId)?.data;
    //                     if(valueIdInfo?.ifaceId && valueIdInfo.ifaceId.trim().length > 0 && valueIdInfo?.channel && valueIdInfo.channel !== null) {
    //                         let valueElemNCList = netclassesList.filter(a => (a.channel && (a.channel === valueIdInfo?.channel?.toString()) && (a.interfaceId === valueIdInfo?.ifaceId))) ?? []
    //                         valueElemNCList = sort(valueElemNCList).asc(x => x.name.toUpperCase());
                            
    //                         for(let k = 0; k = relevNCList.length; k++) {
    //                             for(let j = 0; j = valueElemNCList.length; j++) {
    //                                 let fromNCID = relevNCList[k]._id?.toString() as string;
    //                                 let toNCID = valueElemNCList[j]._id?.toString() as string;
    //                                 if (fromNCID !== toNCID) {
    //                                     let pairStrToken = `${toNCID}__${toNCID}`;
    //                                     let pairStrTokenReverse = `${toNCID}__${toNCID}`

    //                                     if((ncPairingSet.has(pairStrToken) === false) && (ncPairingSet.has(pairStrTokenReverse) === false)) {
    //                                         ncPairingSet.add(pairStrToken);
    //                                         ncPairingToCrbIdMap.set(pairStrToken, crb.id);
    //                                     }
    //                                 }
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }

    //         //handle the 'WITHIN"'cases
    //         if(g2gInfo.setWithin === true) {
    //             let crb: BasicProperty;
    //             if(g2gInfo.clearanceRelationBrandWithin && crbIdList.has(g2gInfo.clearanceRelationBrandWithin.trim())) {
    //                 crb = (project as Project).clearanceRelationBrands.find(a => a.id === g2gInfo.clearanceRelationBrandWithin) as BasicProperty;
    //                 reusedCRBIdArray.add(crb.id);
    //             }
    //             else {
    //                 if(!g2gInfo.clearanceRelationBrandWithin || g2gInfo.clearanceRelationBrandWithin.trim().length === 0) {
    //                     g2gInfo.clearanceRelationBrandWithin = `${g2gInfo.name.trim()}_WITHIN`;
    //                 }
    //                 crb = { id: crypto.randomUUID(), name: g2gInfo.clearanceRelationBrandWithin, value: defaultLGSetId } as BasicProperty;
    //                 newCRBArray.push(crb);
    //             }

    //             let workingNCList = rfdcCopy<Netclass[]>(relevNCList) as Netclass[]
    //             while(workingNCList && workingNCList.length > 0) {
    //                 let frontNC = workingNCList[0];
    //                 let frontNcId = frontNC?._id?.toString() as string;
                    
    //                 for(let x = 0; x = workingNCList.length; x++) {
    //                     let wIndexNcId = workingNCList[x]._id?.toString() as string;
    //                     let pairStrToken = `${frontNcId}__${wIndexNcId}`;
    //                     let pairStrTokenReverse = `${wIndexNcId}__${frontNcId}`
    //                     if((ncPairingSet.has(pairStrToken) === false) && (ncPairingSet.has(pairStrTokenReverse) === false)) {
    //                         ncPairingSet.add(pairStrToken);
    //                         ncPairingToCrbIdMap.set(pairStrToken, crb.id);
    //                     }
    //                 }

    //                 workingNCList.shift(); //important!
    //             }
    //         }
    //         }
    //     }
    // }




//=====================================================================

    //g2g input must be complete set every single time
    //group by interfaceID aspect of g2gId
    //make sure interface exists for each g2ginfo
    //take care of clearanceRelationBrand - might have to generate it - use the proper function for doing so

    //how do we handle the "within" cases? 

    //clean out clearanceRelationBrandWithin if there is no indication that it is needed

    //Keep track to adhere to bidirectional-equality rule of A->B = B->A. Channel-level G2G specs take precedence over interface-level specs

    //initially capture all CRBs mentioned in G2Gs. If after churn, the CRB is not used anywhere, properly delete it with the right functions.

    //make sure at the end no duplicate CRB name will occur
    //make sure to verify names of newly added CRBss

    // on going through C2C slots, go it one time, check both directions, for each FROM, if DEST slot has gone past the FROM slot, skip and search other direction 
    //          where from is now dest and dest is from


    // run await createAutoGenSnapshot(projectId);
    // run default constraints
    // run sortSlots
    // run assessLinkageRelatedLGCs(projectId, null, true); //do not wait on this...







// export async function runPreNetclassCreationProcessing(iface: Interface, netclasses: Netclass[]) : Promise<Netclass[]> {
//     let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)

//     //check name and projectId (required fields)
//     if(iface.projectId.length < 2){
//         throw new Error(`Interface must have valid projectId`)
//     }
//     if(!netclasses || netclasses.length === 0){
//         throw new Error(`Cannot create netclasses. No netclass information was provided for creation`)
//     }

//     let existingProjectNetclasses: Netclass[] = (await netclassRepo.GetAllByProjectID(iface.projectId)) as Netclass[];
    
//     for(let i = 0; i < netclasses.length; i++) {
//         let nc = netclasses[i]
//         if(!nc.name || nc.name.trim().length < 2 || nc.name.toLowerCase() === "undefined" ){
//             throw new Error(`Name of new netclass is invalid. Please specify at least two alpha numberic characters for netclass name`)
//         }
//         if(!nc.projectId || nc.projectId.trim().length === 0 || nc.projectId.toLowerCase() === "undefined" ){
//             throw new Error(`New netclass must have valid projectId`)
//         }
//         if(nc.projectId !== iface.projectId) {
//             throw new Error(`New netclass must have same projectId as associated interface`)
//         }

//         //check netclass naming
//         verifyNaming([nc.name], NamingContentTypeEnum.NETCLASS)
//         if (existingProjectNetclasses && existingProjectNetclasses.length > 0) {
//             if(existingProjectNetclasses.some(a => a.name.toLowerCase().trim() === nc.name.toLowerCase().trim())) {
//                 throw new Error(`Cannot add new netclass '${nc.name}'. A netclass with the same name already exists for current project`);
//             } 
//         }
//     }

//     return netclasses;
// }


	// let result = await c2crRepo.ReplaceMany(c2crList)
	// if(result === true) {
	// 	const idList = c2crList.map((x: C2CRow) => new ObjectId(x._id?.toString()));
    // 	let infilter = { _id: { $in: idList } as any };
	// 	updatedC2CRs = await c2crRepo.GetAllByProjectID(c2crList[0].projectId, infilter);
	// }

	// if (updatedC2CRs && updatedC2CRs.length > 0) {
	// 	await newFunction()        

    //     return updatedC2CRs;
	// }
	// else {
	// 	throw new Error(`Failed to get updated C2C data. An unspecified error may have occured while performing update operation`);
	// }



    //=======================================================



// if(iface.projectId.length < 2){
    //     throw new Error(`Cannot perform netclass deletion. Specified interface must have valid projectId`)
    // // }
    
    // let filter = {interfaceId: iface._id?.toString()} as any
    // const existingNetclasses: Netclass[] = await netclassRepo.GetAllByProjectID(iface.projectId, filter) ?? [];
    
    // if((netclasses && netclasses.length > 0) && (existingNetclasses.length === 0)) {
    //     throw new Error("Cannot delete netclasses. The specified interface does not have such netclasses in the system");
    // } 
    
    // if(existingNetclasses.length > 0) {
    //     let existingNCIdList = existingNetclasses.map(a => a._id?.toString()) as string[]
    //     let deleteList = Array.from(existingNCIdList)
    //     let deletableNetclasses = new Array<Netclass>();

    //     if(netclasses && netclasses.length > 0) {
    //         let hasRogueNC = netclasses.some(a => (existingNCIdList.includes(a._id?.toString() as string) === false))
    //         if(hasRogueNC) {
    //             throw new Error(`Cannot process netclass deletion. Some specified netclasses do not belong to the interface '${iface?.name}'`);
    //         }
    //         else{
    //             deletableNetclasses = netclasses.filter(x => existingNCIdList.includes(x._id?.toString() as string))
    //             deleteList = deletableNetclasses.map(z => z._id?.toString() as string)
    //         }
    //     }

    //     result = await netclassRepo.DeleteMany(deleteList)
    //     if(result === true && deletableNetclasses.length > 0) {
    //         await performConstraintsAssessmentForNetclassAction(iface.projectId, ConstraintChangeActionEnum.NETCLASS_REMOVAL, deletableNetclasses)
    //     }
    // }
    
    // return result;