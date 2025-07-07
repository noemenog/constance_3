import { ServiceModel, SnapshotContext } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { copyForSnapshot, getDateAppendedName, getEnumValuesAsArray, verifyNaming } from "./UtilFunctions";
import { DBCollectionTypeEnum, NamingContentTypeEnum } from "../Models/Constants";
import { ObjectId } from "mongodb";



//TODO: handle Net case where data might be too large

//#region ================================== CREATION ====================================================================
export async function createAutoGenSnapshot(projectId: string) : Promise<SnapshotContext[]>{
    let autoSnapName = getDateAppendedName(`AutoSnap`)
    let res = await createSnapshot(projectId, autoSnapName);
    return res;
}



export async function createSnapshot(projectId: string, newSnapshotName: string) : Promise<SnapshotContext[]>{
    let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
    verifyNaming([newSnapshotName], NamingContentTypeEnum.SNAPSHOT)

    let existingSnaps = await snapRepo.GetAllByProjectID(projectId)
    if(existingSnaps && existingSnaps.length > 0){
        if(existingSnaps.some(a => a.name.toLowerCase().trim() === newSnapshotName.toLowerCase().trim())){
            throw new Error(`A snapshot with the given name '${newSnapshotName}' already exists for this project. Snapshot process cannot proceed`);
        }
    }

    let newSnap : SnapshotContext = {
        projectId: projectId,
        name: newSnapshotName,
        snapshotSourceId: "",
        lastUpdatedOn: new Date(),
        contextProperties: [],
        enabled: true,
        components: [],
    }

    let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum) as string[]
    for (let x = 0; x < allCollNames.length; x++) {
        let collectionName : string = allCollNames[x];

        if((collectionName !== DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION) && (collectionName !== DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION)) {
            newSnap = await processSnapshotDataCreation(collectionName, newSnap)
        }
    }

    if(newSnap.components.length > 0) {
        newSnap.components = [...newSnap.components].sort();
        let newSnapContext = await snapRepo.CreateOne(newSnap);
        if(!newSnapContext){
            throw new Error(`Failed to create new snapshot named '${newSnapshotName}'`)
        }
    }
    
    let snapContexts = await snapRepo.GetAllByProjectID(projectId)
    return snapContexts
}




async function processSnapshotDataCreation<T extends ServiceModel>(collectionName: string, newSnap: SnapshotContext) {
    let mainRepo = new ServiceModelRepository<T>(collectionName as DBCollectionTypeEnum)
    let snapshotRepo = new ServiceModelRepository<T>(collectionName as DBCollectionTypeEnum, true)
    
    let items = await mainRepo.GetAllByProjectID(newSnap.projectId)  
    let itemCopies = copyForSnapshot(items, newSnap.projectId, true)
    
    if(itemCopies && itemCopies.length > 0) {
        let createdItemCopies = await snapshotRepo.CreateMany(itemCopies)
        if(createdItemCopies && createdItemCopies.length > 0) {
            let compSet = [...newSnap.components]
            let ids = createdItemCopies.map((a: T) => a._id?.toString() as string) ?? []
            for(let x = 0; x < ids.length; x++){
                compSet.push(ids[x])
            }
            newSnap.components = compSet
        }
    }

    return newSnap;
}

// export async function createSnapshot(projectId: string, newSnapshotName: string) : Promise<SnapshotContext[]>{
//     let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
//     verifyNaming([newSnapshotName], NamingContentTypeEnum.SNAPSHOT)

//     let existingSnaps = await snapRepo.GetAllByProjectID(projectId)
//     if(existingSnaps && existingSnaps.length > 0){
//         if(existingSnaps.some(a => a.name.toLowerCase().trim() === newSnapshotName.toLowerCase().trim())){
//             throw new Error(`A snapshot with the given name '${newSnapshotName}' already exists for this project. Snapshot process cannot proceed`);
//         }
//     }

//     let newSnap : SnapshotContext = {
//         projectId: projectId,
//         name: newSnapshotName,
//         snapshotSourceId: "",
//         lastUpdatedOn: new Date(),
//         contextProperties: [],
//         enabled: true,
//         components: [],
//     }
    
//     let promiseCalls = []
    
//     let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum) as string[]
//     for (let x = 0; x < allCollNames.length; x++) {
//         let collectionName : string = allCollNames[x];
//         if((collectionName !== DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION) && (collectionName !== DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION)) {
//             promiseCalls.push(processSnapshotDataCreation(collectionName, newSnap))
//         }
//     }

//     let resList: string[][] = await Promise.all(promiseCalls);

//     let combinedCompList = new Set<string>();
//     for(let k = 0; k < resList.length; k++) {
//         for(let j = 0; j < resList[k].length; j++) {
//             combinedCompList.add(resList[k][j])
//         }
//     }

//     if(combinedCompList.size > 0) {
//         let compArr = Array.from(combinedCompList);
//         newSnap.components = compArr.sort();
//         let newSnapContext = await snapRepo.CreateOne(newSnap);
//         if(!newSnapContext){
//             throw new Error(`Failed to create new snapshot named '${newSnapshotName}'`)
//         }
//     }

//     let snapContexts = await snapRepo.GetAllByProjectID(projectId)
//     return snapContexts
// }



// async function processSnapshotDataCreation<T extends ServiceModel>(collectionName: string, newSnap: SnapshotContext) : Promise<Array<string>> {
//     let mainRepo = new ServiceModelRepository<T>(collectionName as DBCollectionTypeEnum)
//     let snapshotRepo = new ServiceModelRepository<T>(collectionName as DBCollectionTypeEnum, true)
    
//     let items = await mainRepo.GetAllByProjectID(newSnap.projectId)  
//     let itemCopies = copyForSnapshot(items, newSnap.projectId, true)
    
//     let compSet = new Array<string>();
//     if(itemCopies && itemCopies.length > 0) {
//         let createdItemCopies = await snapshotRepo.CreateMany(itemCopies)
//         if(createdItemCopies && createdItemCopies.length > 0) {
//             let ids = createdItemCopies.map((a: T) => a._id?.toString() as string) ?? []
//             for(let x = 0; x < ids.length; x++){
//                 compSet.push(ids[x])
//             }
//         }
//     }

//     return compSet;
// }

//#endregion =============================================================================================================




//#region ================================== RESTORE ====================================================================
export async function restoreSnapshot(restoreSnapContext: SnapshotContext) : Promise<SnapshotContext[]>{
    if(!restoreSnapContext || !restoreSnapContext.projectId || !restoreSnapContext.name || !restoreSnapContext.components) {
        throw new Error(`Could not proceed with provided context data. Input information is invalid`)
    }
    if(restoreSnapContext.enabled === false) {
        throw new Error(`Could not proceed because snapshot is disabled. Cannot restore disabled snapshot`)
    }
    let projectId = restoreSnapContext.projectId

    let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum) as string[]
    for (let x = 0; x < allCollNames.length; x++) {
        let collectionName : string = allCollNames[x];

        if((collectionName !== DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION) && (collectionName !== DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION)) {
            await processSnapshotDataRestore(collectionName, restoreSnapContext);
        }
    }

    let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
    let snapContexts = await snapRepo.GetAllByProjectID(projectId)

    return snapContexts
}


async function processSnapshotDataRestore<T extends ServiceModel>(collectionName: string, restoreSnapContext: SnapshotContext) {
    if(restoreSnapContext && restoreSnapContext.components && restoreSnapContext.components.length > 0) {
        let mainRepo = new ServiceModelRepository<T>(collectionName as DBCollectionTypeEnum)
        let snapshotRepo = new ServiceModelRepository<T>(collectionName as DBCollectionTypeEnum, true)
        
        const componentIdList : ObjectId[] = restoreSnapContext.components.map((x: string) => new ObjectId(x));
        let infilter = { _id: { $in: componentIdList } as any }
        
        let snapItemList = await snapshotRepo.GetAllByProjectID(restoreSnapContext.projectId, infilter)

        if(snapItemList && snapItemList.length > 0) {
            for(let x = 0; x < snapItemList.length; x++) {
                let item = snapItemList[x];
                item._id = new ObjectId(item.snapshotSourceId);
                item.snapshotSourceId = '';
            }
            
            let delRes = await mainRepo.DeleteManyByProjectId(restoreSnapContext.projectId, null, true);
            let createdItems = await mainRepo.CreateMany(snapItemList);

            if(delRes === false) {
                throw new Error(`Error occured while deleting existing items for snapshot restore! ItemType: ${collectionName}`)
            }
            if(!createdItems || createdItems.length !== snapItemList.length) {
                throw new Error(`Error occured while replacing items for snapshot restore!`)
            }
        }
    }
    else {
        throw new Error(`Cannot restore snapshot. Supplied snapshot context is invalid!`)
    }

    return true;
}
//#endregion =============================================================================================================




//#region ================================== DELETION ====================================================================
export async function deleteSnapshots(snapInfoList: SnapshotContext[]) : Promise<SnapshotContext[]>{
    let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
    let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum) as string[];
    let returnSnapContexts : SnapshotContext[] = [];

    if(snapInfoList && snapInfoList.length > 0) {
        let sameAndValidProjId = snapInfoList.every(a => (a.projectId.length > 0 && a.projectId === snapInfoList[0].projectId))
        if(sameAndValidProjId === false) {
            throw new Error(`Cannot delete snapshot(s). All supplied snapshot contexts must have valid and same project ID!`)
        }

        for(let i = 0; i < snapInfoList.length; i++) {
            let delSnapContext = snapInfoList[i]
            
            if(delSnapContext._id && (delSnapContext._id.toString().length > 0)){
                if(delSnapContext.components && delSnapContext.components.length > 0) {
                    for (let x = 0; x < allCollNames.length; x++) {
                        let collectionName : string = allCollNames[x];

                        if((collectionName !== DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION) && (collectionName !== DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION)) {
                            await processSnapshotDataDeletion(collectionName, delSnapContext)
                        }
                    }
                }

                await snapRepo.DeleteMany([delSnapContext._id?.toString()])
            }
        }
        
        returnSnapContexts = await snapRepo.GetAllByProjectID(snapInfoList[0].projectId)
    }
    
    return returnSnapContexts
}


async function processSnapshotDataDeletion<T extends ServiceModel>(collectionName: string, deleteSnapContext: SnapshotContext) {
    if(deleteSnapContext && deleteSnapContext.components && deleteSnapContext.components.length > 0) {
        let snapshotRepo = new ServiceModelRepository<T>(collectionName as DBCollectionTypeEnum, true)
        
        const componentIdList : ObjectId[] = deleteSnapContext.components.map((x: string) => new ObjectId(x));
        let infilter = { _id: { $in: componentIdList } as any } as any
        
        let snapItemList = await snapshotRepo.GetAllByProjectID(deleteSnapContext.projectId, infilter)

        if(snapItemList && snapItemList.length > 0) {
            let deleteList = new Array<string>()
            for(let x = 0; x < snapItemList.length; x++) {
                deleteList.push(snapItemList[x]._id!.toString());
            }
            
            await snapshotRepo.DeleteMany(deleteList);
        }
    }
    else {
        throw new Error(`Cannot delete snapshot. Supplied snapshot context is invalid!`)
    }
    
    return true;
}
//#endregion =============================================================================================================






//============================================================================
//============================================================================
export function checkIncomingSnapshotContexts(snapInfoList: SnapshotContext[], idExpected: boolean = true){
    if(!snapInfoList || snapInfoList.length === 0){
        throw new Error(`Input snapshot info cannot be null or empty or undefined`);
    }

    for(let i = 0; i < snapInfoList.length; i++) {
        let snapInfo = snapInfoList[i]
        if(!snapInfo.projectId || snapInfo.projectId.trim().length === 0 || snapInfo.projectId.toLowerCase() === "undefined"){
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if(!snapInfo.name || snapInfo.name.length < 3 || snapInfo.name.toLowerCase() === "undefined"){
            throw new Error(`Input snapshot name cannot be null, empty, undefined, or have too few characters`);
        }
        if(idExpected === true) {
            if(!snapInfo._id || snapInfo._id.toString().trim().length === 0){
                throw new Error(`Input snapshot id cannot be null, empty, undefined, or have too few characters`);
            }
        }
    }

    let firstProjId = snapInfoList[0].projectId;
    let sameAndValidProjId = snapInfoList.every(a => (a.projectId && a.projectId.trim().length > 0 && a.projectId === firstProjId))
    if(sameAndValidProjId === false) {
        throw new Error(`Cannot proceed with operation. All supplied snapshot contexts must have valid and same project ID!`)
    }
}










//===========================


    // newSnap = await processSnapshotDataSetup(projectId, DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<Interface>(projectId, DBCollectionTypeEnum.INTERFACE_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<Netclass>(projectId, DBCollectionTypeEnum.NETCLASS_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<Net>(projectId, DBCollectionTypeEnum.NET_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<PackageLayout>(projectId, DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<PowerInfo>(projectId, DBCollectionTypeEnum.POWER_INFO_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<Project>(projectId, DBCollectionTypeEnum.PROJECT_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<RuleAreaConstraints>(projectId, DBCollectionTypeEnum.RULEAREA_CONSTRAINTS_COLLECTION, newSnap)
    // newSnap = await processSnapshotDataSetup<CSet>(projectId, DBCollectionTypeEnum.CSET_COLLECTION, newSnap)


    // await processSnapshotDataRestore<DefaultConstraints>(projectId, DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION, restoreSnapContext)
    // await processSnapshotDataRestore<Interface>(projectId, DBCollectionTypeEnum.INTERFACE_COLLECTION,restoreSnapContext)
    // await processSnapshotDataRestore<Netclass>(projectId, DBCollectionTypeEnum.NETCLASS_COLLECTION, restoreSnapContext)
    // await processSnapshotDataRestore<Net>(projectId, DBCollectionTypeEnum.NET_COLLECTION, restoreSnapContext)
    // await processSnapshotDataRestore<PackageLayout>(projectId, DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION, restoreSnapContext)
    // await processSnapshotDataRestore<PowerInfo>(projectId, DBCollectionTypeEnum.POWER_INFO_COLLECTION, restoreSnapContext)
    // await processSnapshotDataRestore<Project>(projectId, DBCollectionTypeEnum.PROJECT_COLLECTION, restoreSnapContext)
    // await processSnapshotDataRestore<RuleAreaConstraints>(projectId, DBCollectionTypeEnum.RULEAREA_CONSTRAINTS_COLLECTION, restoreSnapContext)
    // await processSnapshotDataRestore<CSet>(projectId, DBCollectionTypeEnum.CSET_COLLECTION, restoreSnapContext)
    

    // await processSnapshotDataDeletion<DefaultConstraints>(projectId, DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<Interface>(projectId, DBCollectionTypeEnum.INTERFACE_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<Netclass>(projectId, DBCollectionTypeEnum.NETCLASS_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<Net>(projectId, DBCollectionTypeEnum.NET_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<PackageLayout>(projectId, DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<PowerInfo>(projectId, DBCollectionTypeEnum.POWER_INFO_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<Project>(projectId, DBCollectionTypeEnum.PROJECT_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<RuleAreaConstraints>(projectId, DBCollectionTypeEnum.RULEAREA_CONSTRAINTS_COLLECTION, delSnapContext)
    // await processSnapshotDataDeletion<CSet>(projectId, DBCollectionTypeEnum.CSET_COLLECTION, delSnapContext)
    
//=========================================


    // let defConstrColl = getCollection(DEFAULT_CONSTRAINTS_COLLECTION)
    // let defConstrRepo = new ServiceModelRepository<DefaultConstraintSet>(defConstrColl)
    // let defConstrList = await defConstrRepo.GetAllByProjectID(snapInfo.projectId)

    // let snapshotDefConstrColl = getCollection(DEFAULT_CONSTRAINTS_COLLECTION, true)
    // let snapshotDefConstrRepo = new ServiceModelRepository<DefaultConstraintSet>(snapshotDefConstrColl)
    // let defConstrCopies = copyServiceModelItems(defConstrList, snapInfo.projectId, true)
    // if(defConstrCopies && defConstrCopies.length > 0) {
    //     let createdDefConstrCopies = await snapshotDefConstrRepo.CreateMany(defConstrCopies)
    //     if(createdDefConstrCopies && createdDefConstrCopies.length > 0) {
    //         let comsSet = new Set(newSnap.components)
    //         let ids = createdDefConstrCopies.map((a: DefaultConstraintSet) => a._id?.toString() as string) ?? []
    //         for(let x = 0; x < ids.length; x++){
    //             comsSet.add(ids[x])
    //         }
    //         newSnap.components = comsSet
    //     }
    // }

    // //interfaces
    // let ifaceColl = getCollection(INTERFACE_COLLECTION)
    // let ifaceRepo = new ServiceModelRepository<SnapshotContext>(ifaceColl)
    // let ifaceList = await ifaceRepo.GetAllByProjectID(snapInfo.projectId)

    // //net classes
    // let netclassColl = getCollection(NETCLASS_COLLECTION)
    // let netclassRepo = new ServiceModelRepository<SnapshotContext>(netclassColl)
    // let netclasses = await netclassRepo.GetAllByProjectID(snapInfo.projectId)

    // //net sets
    // let netsetColl = getCollection(NETSET_COLLECTION)
    // let netsetRepo = new ServiceModelRepository<SnapshotContext>(netsetColl)
    // let netsets = await netsetRepo.GetAllByProjectID(snapInfo.projectId)

    // //package Layout
    // let pkgColl = getCollection(PACKAGE_LAYOUT_COLLECTION)
    // let pkgRepo = new ServiceModelRepository<SnapshotContext>(pkgColl)
    // let pkg = await pkgRepo.GetAllByProjectID(snapInfo.projectId)

    // //power info
    // let powerColl = getCollection(POWER_INFO_COLLECTION)
    // let powerRepo = new ServiceModelRepository<SnapshotContext>(powerColl)
    // let powerInfo = await powerRepo.GetAllByProjectID(snapInfo.projectId)

    // //project object
    // let projColl = getCollection(PROJECT_COLLECTION)
    // let projRepo = new ServiceModelRepository<SnapshotContext>(projColl)
    // let proj = await projRepo.GetAllByProjectID(snapInfo.projectId)

    // //RACs
    // let racColl = getCollection(RULEAREA_CONSTRAINTS_COLLECTION)
    // let racRepo = new ServiceModelRepository<SnapshotContext>(racColl)
    // let racs = await racRepo.GetAllByProjectID(snapInfo.projectId)

    // //CSets
    // let csetColl = getCollection(CSET_COLLECTION)
    // let csetRepo = new ServiceModelRepository<SnapshotContext>(csetColl)
    // let csets = await csetRepo.GetAllByProjectID(snapInfo.projectId)


    
    // return []