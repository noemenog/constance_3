import { Filter, ObjectId } from "mongodb";
import { AppInfo, Bucket, ConfigChangeHistory, ConfigChangeInstance, ConfigItem, ServiceModel } from "../Models/ServiceModels";
import { BUCKETLIST, CLONE_SOURCE_ID, DB_COLL_TYPE_CLONE_ORDER, DBCollectionTypeEnum, ENVIRONMENTLIST, EnvTypeEnum, NamingContentTypeEnum } from "../Models/Constants";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { checkDuplicatesIgnoreCase, getEnumValuesAsArray, groupBy, rfdcCopy, verifyNaming } from "./UtilFunctions";
import { randomUUID } from "crypto";
import { GetEnvironmentType } from "./BasicCommonLogic";
import { sort } from "fast-sort";
import { BaseUserInfo, User } from "../Models/HelperModels";





export async function performAppAdd(app: AppInfo) : Promise<AppInfo|null>{
    //IMPORTANT! - Intentionally hardcoding dev env because appp should only ever be added to dev. user can choose to export afterwards!!
    let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.DEVELOPMENT)
    
    //check required fields
    if(!app.name || app.name.trim().length < 2 || app.name.toLowerCase().trim() === "undefined"){
        throw new Error(`Please use at least two characters for app name`)
    }
    if(!app.owner || !app.owner.email || !app.owner.idsid){
        throw new Error(`New app must have valid owner info`)
    }
    //check format of app name
    verifyNaming([app.name], NamingContentTypeEnum.APPINFO)

    //NOTE: check if appName already exists. If a app exists in the system and is set to "disabled", it still count in name checking - no duplicates!
    let filter = {name : new RegExp('^' + app.name + '$', 'i')}
    const exisApps: AppInfo[] = (await appRepo.GetWithFilter(filter)) as AppInfo[];
    if (exisApps && exisApps.length > 0) {
        throw new Error(`Cannot add new AppInfo '${app.name}'. 
            ${(exisApps && exisApps.length > 0 && exisApps[0].enabled === false) ? "A disabled app" : "An app"} with the same name already exists in the system`);
    }

    //check duplicate assoc prop names
    let propNames = app.associatedProperties.map(a => a.name)
    let dupNamesRes = checkDuplicatesIgnoreCase(propNames);
    if (dupNamesRes === false) {
        throw new Error(`Duplicate property names are not allowed for new App. `)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = app.associatedProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property names are not allowed for new app. `)
    }

    //ensure all properties have a uuid
    for(let i = 0; i < app.associatedProperties.length; i++){
        if(app.associatedProperties[i].id && app.associatedProperties[i].id.trim().length === 0) {
            app.associatedProperties[i].id = crypto.randomUUID()
        }
    }

    if(app.associatedProperties && app.associatedProperties.length > 0) {
        app.associatedProperties = app.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
    }

    app.createdOn = new Date();
    app.lastUpdatedOn = new Date();
    app.lockedBy = null;
    app.name = app.name.trim().toUpperCase();
    app.enabled = true;
    app.contextProperties = []
    delete app['_id'];

    let newApp : AppInfo = await appRepo.CreateOne(app);
    if(newApp && newApp._id){
        newApp.ownerElementId = (newApp._id as ObjectId).toString()  //Important!
        await appRepo.ReplaceOne(newApp);
    }
    else {
        throw new Error(`An unspecified error occured while creating new app`)
    }

    return newApp ?? null
}



export async function performAppUpdate(app: AppInfo) : Promise<AppInfo|null>{
    let allValidEnvironments = getEnumValuesAsArray(EnvTypeEnum);
    let devAppRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.DEVELOPMENT)

    //check required fields
    if(!app._id || app._id.toString().trim().length === 0 || app._id.toString().trim().toLowerCase() === "undefined"){
        throw new Error(`Input app is invalid. App update cannot proceed`)
    }
    if(!app.name || app.name.trim().length < 2 || app.name.toLowerCase().trim() === "undefined"){
        throw new Error(`Please use at least two characters for app name`)
    }
    if(!app.owner || !app.owner.email || !app.owner.idsid){
        throw new Error(`App must have valid owner info`)
    }
    //check format of app name
    verifyNaming([app.name], NamingContentTypeEnum.APPINFO)

    //NOTE: check if appName already exists. If a app exists in the system and is set to "disabled", it still count in name checking - no duplicates!
    let filter = {name : new RegExp('^' + app.name + '$', 'i')}
    const exisApps: AppInfo[] = (await devAppRepo.GetWithFilter(filter)) as AppInfo[];
    if (exisApps && exisApps.length > 0 && exisApps.some(s => s._id?.toString() !== app._id?.toString())) {
        throw new Error(`Cannot update AppInfo '${app.name}'. 
            ${(exisApps && exisApps.length > 0 && exisApps[0].enabled === false) ? "A disabled app" : "An app"} with the same name already exists in the system`);
    }

    //check duplicate assoc prop names
    let propNames = app.associatedProperties.map(a => a.name)
    let dupNamesRes = checkDuplicatesIgnoreCase(propNames);
    if (dupNamesRes === false) {
        throw new Error(`Duplicate property names are not allowed for new App.`)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = app.associatedProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property names are not allowed for new app.`)
    }

    //ensure all properties have a uuid
    for(let i = 0; i < app.associatedProperties.length; i++){
        if(app.associatedProperties[i].id && app.associatedProperties[i].id.trim().length === 0) {
            app.associatedProperties[i].id = crypto.randomUUID()
        }
    }

    if(app.associatedProperties && app.associatedProperties.length > 0) {
        app.associatedProperties = app.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
    }

    app.lastUpdatedOn = new Date();
    app.name = app.name.trim().toUpperCase();
    app.contextProperties = [];

    for (let i = 0; i < allValidEnvironments.length; i++) {
        let env = allValidEnvironments[i] as EnvTypeEnum;
        let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
        
        let existingApp = await appRepo.GetWithId(app._id.toString())
        if(existingApp) {
            let res = await appRepo.ReplaceOne(app);
            if(res === false){
                throw new Error(`An unspecified error occured while updating app`)
            }
        }
    }
    
    let updatedAppInfo = await devAppRepo.GetWithId(app._id.toString()) //note this is from dev space
    return updatedAppInfo ?? null
}



export async function performAppDelete(currEnv: string, appId: string, delEnv: string) : Promise<EnvTypeEnum[]>{
    if(delEnv) {
        if(delEnv.toLowerCase() === EnvTypeEnum.DEVELOPMENT.toLowerCase() || delEnv.toLowerCase() === "dev") {
            throw new Error(`Invalid environment specified. To delete from '${EnvTypeEnum.DEVELOPMENT}', `
                + `Please specify 'ALL'. Exclusively deleting from 'dev' environment is not allowed.`)
        }

        let delEnvList : Array<string|EnvTypeEnum> = (delEnv.toUpperCase().trim() === "ALL") 
            ? getEnumValuesAsArray(EnvTypeEnum) 
            : [GetEnvironmentType(delEnv)];

        //Important! - If deleting from dev, must delete from all envs
        if (delEnvList.includes(EnvTypeEnum.DEVELOPMENT)) {
            if (delEnvList.length !== getEnumValuesAsArray(EnvTypeEnum).length) {
                throw new Error(
                    `Deleting from '${EnvTypeEnum.DEVELOPMENT}' requires deleting from ALL environments. ` +
                    `You cannot delete from 'dev' while the app is still active in other environments.`
                );
            }
        }

        for (let i = 0; i < delEnvList.length; i++) {
            let focusDelEnv = delEnvList[i] as EnvTypeEnum;
            let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, focusDelEnv)
            let appInfo = await appRepo.GetWithId(appId)

            if(appInfo) {
                appInfo.enabled = false;
                appInfo.lastUpdatedOn = new Date(); //Important!

                let res = await appRepo.ReplaceOne(appInfo);
                if(res === false){
                    throw new Error(`An unspecified error occured while disabling app`)
                }
            }
        }

        //===============================================================================================================================
        //ACTUALLY - we cannot ever do a recovery. The fact that we are holding on to the data for a while is only for record keeping purposes.
        // The issue with recovery - when app is disabled, UI will delete AGS ntitlement elements. If recovered/re-enabled, the permission elements in AGS will NOT exist.
        // We dont want that!..
        //===============================================================================================================================

        //find apps that have been disabled for MAX_DAYS_FOR_DELETION or more days - delete apps, buckets, configItems, and changeHistory
        let allEnvironments = sort(Array.from(getEnumValuesAsArray(EnvTypeEnum))).asc(a => a.toString().toUpperCase())
        for(let env of allEnvironments) {
            let envAppRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
            let filter = { enabled : false } as Filter<AppInfo>
            let disabledApps : AppInfo[] = (await envAppRepo.GetWithFilter(filter)) ?? [];

            if(disabledApps && disabledApps.length > 0) {
                const _MS_PER_DAY = 1000 * 60 * 60 * 24;
                const today = new Date();
                const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
                
                const MAX_DAYS_FOR_DELETION = 30; //take note -- at some point we want to move this to configs!

                for (let k = 0; k < disabledApps.length; k++) {
                    let offdApp = disabledApps[k];
                    let offdAppId = offdApp._id?.toString() as string
                    const dt: Date = new Date(offdApp.lastUpdatedOn);
                    const utc = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
                    let dif = Math.floor((utcToday - utc) / _MS_PER_DAY);
                    
                    if (dif > MAX_DAYS_FOR_DELETION) {
                        await envAppRepo.DeleteMany([offdAppId]);

                        let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env)
                        await buckRepo.DeleteManyByOwnerElementId(offdAppId, null, true)

                        let confRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
                        await confRepo.DeleteManyByOwnerElementId(offdAppId, null, true)

                        let histRepo = new ServiceModelRepository<ConfigChangeHistory>(DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION, env)
                        await histRepo.DeleteManyByOwnerElementId(offdAppId, null, true)
                    }
                }
            }
        }
    }

    let environList = await getAllEnvironmentsForApp(appId);
    return environList
}



export async function performAppClone(existingApp: AppInfo, newName: string, user: User): Promise<AppInfo> {
    let newAppId = "";
    let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.DEVELOPMENT)
    let allCollNames = [...DB_COLL_TYPE_CLONE_ORDER.entries()].sort(([key1], [key2]) => key1 - key2).map(x => x[1])
    
    try {
        if(!existingApp || !existingApp._id) {
            throw new Error(`Failed to successfully create a clone named '${newName}' from existing app. Specified existing app is invalid.`)
        }

        //check format of app name
        verifyNaming([newName], NamingContentTypeEnum.APPINFO)
        
        //check if app-Name already exists
        let filter = {name : new RegExp('^' + newName + '$', 'i')}
        const appList: AppInfo[] = (await appRepo.GetWithFilter(filter)) as AppInfo[];
        if (appList && appList.length > 0) {
            throw new Error(`Cannot add new app '${newName}'. 
                ${(appList && appList.length > 0 && appList[0].enabled === false) ? "A disabled app" : "An app"} with the same name already exists in the system`);
        }
        
        //create a copy of AppInfo........
        let newId = new ObjectId();
        let clone = rfdcCopy<AppInfo>(existingApp) as AppInfo
        clone = setCommonCloneState(clone, newId.toString(), false)
        
        clone._id = newId;  //NOTE: this must happen after setting common items. Order matters!
        clone.name = newName;
        clone.createdOn = new Date();
        clone.lockedBy = null; //Important!
        clone.createdBy  = user.email || "";
        clone.owner = { email: user.email, idsid: user.idsid } as BaseUserInfo;
    
        let newApp = await appRepo.CreateOne(clone)
        if(!newApp || !newApp._id) {
            throw new Error(`Failed to successfully create a clone named '${newName}' from app '${existingApp.name}'.`)
        } 
    
        let newAppId = newApp._id?.toString() as string;
        let omissionList =  new Set([DBCollectionTypeEnum.APPINFO_COLLECTION,  DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION]);
        let bucketIdChangeMap = new Map<string, string>();

        for (let x = 0; x < allCollNames.length; x++) {
            let collectionName : string = allCollNames[x];
            
            if(omissionList.has(collectionName as DBCollectionTypeEnum)){ 
                continue; //these items being skipped should never be cloned!
            }

            if(collectionName === DBCollectionTypeEnum.BUCKET_COLLECTION){
                let repo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, EnvTypeEnum.DEVELOPMENT)
                bucketIdChangeMap = await cloneGenerically<Bucket>(existingApp._id?.toString() as string, newAppId, repo, DBCollectionTypeEnum.BUCKET_COLLECTION)
            }
            else if(collectionName === DBCollectionTypeEnum.CONFIGITEM_COLLECTION){
                let repo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, EnvTypeEnum.DEVELOPMENT)
                await cloneGenerically<ConfigItem>(existingApp._id?.toString() as string, newAppId, repo, DBCollectionTypeEnum.CONFIGITEM_COLLECTION, (item: ConfigItem) => {item.bucketId = bucketIdChangeMap.get(item.bucketId) || item.bucketId; });
            }
            else {
                throw new Error("Clone process not fully implemented! Please inform developer!!");
            }
        }

        return newApp as AppInfo;
    }
    catch(err: any)
    {
        try { 
            if(newAppId && newAppId.length > 0) { 
                performAppDelete(EnvTypeEnum.DEVELOPMENT, newAppId, "ALL"); 
            } 
        }
        catch {
            console.error(`Error occured while deleting cloned App after clone attempt failed! ID: ${newAppId}`);
        }
        finally{ throw err; }
    }
}



export async function includeContextDetailsForApp(app: AppInfo, env: EnvTypeEnum, includeBuckets: boolean, includeEnvironmentList: boolean): Promise<AppInfo> {
    if(app) {
        if(includeBuckets === true) {
            let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env)
            let buckets = await buckRepo.GetAllByOwnerElementId(app._id?.toString() as string) ?? []
            app.contextProperties = app.contextProperties.filter(a => a.name.toUpperCase() !== BUCKETLIST) ?? [];
            app.contextProperties.push({
                id: randomUUID(),
                name: BUCKETLIST,
                value: buckets
            })
        }

        if(includeEnvironmentList === true) {
            let environList = await getAllEnvironmentsForApp(app._id?.toString() as string)
            app.contextProperties = app.contextProperties.filter(a => a.name.toUpperCase() !== ENVIRONMENTLIST) ?? [];
            app.contextProperties.push({
                id: randomUUID(),
                name: ENVIRONMENTLIST,
                value: environList
            })
        }
    }
    return app;
}



async function getAllEnvironmentsForApp(appId: string) : Promise<Array<EnvTypeEnum>>{
    let environList = new Set<EnvTypeEnum>()
    let allValidEnvironments = getEnumValuesAsArray(EnvTypeEnum);
    
    for (let i = 0; i < allValidEnvironments.length; i++) {
        let env = allValidEnvironments[i] as EnvTypeEnum;
        let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env);
        let filter = { _id: new ObjectId(appId), enabled: true } as Filter<AppInfo>;
        let projection = { associatedProperties: 0 }
        let appInstance = (await appRepo.GetByFilterAndProjection(filter, projection)) as AppInfo[]
        
        if(appInstance && appInstance.length > 0) {
            environList.add(env)
        }
    }

    return Array.from(environList).sort()
}




function setCommonCloneState<T extends ServiceModel>(clone: T, newOwnerElementId: string, setNewObjectId: boolean) : T{
    clone.ownerElementId = newOwnerElementId;
    clone.lastUpdatedOn = new Date();
    clone.contextProperties = clone.contextProperties.filter(a => a.name.toUpperCase() !== CLONE_SOURCE_ID) ?? [];
    
    clone.contextProperties.push({
        id: randomUUID(),
        name: CLONE_SOURCE_ID,
        value: clone._id?.toString() as string
    })
    
    if(setNewObjectId) {
        clone._id = new ObjectId();
    }
    return {...clone} as T
}



async function cloneGenerically<T extends ServiceModel>(existingOwnerElementId: string, newOwnerElementId: string, repo: ServiceModelRepository<T>, collType: DBCollectionTypeEnum, updateItem?: (item: T) => void) : Promise<Map<string, string>> {
    let items = await repo.GetAllByOwnerElementId(existingOwnerElementId) ?? []
    let idChangeMap = new Map<string, string>();
    if(items && items.length > 0) {
        let cloneList = rfdcCopy<T[]>(items) as T[];
        for(let i = 0; i < cloneList.length; i++) {
            let oldId  = cloneList[i]._id?.toString() as string;
            cloneList[i] = setCommonCloneState(cloneList[i], newOwnerElementId, true)
            idChangeMap.set(oldId, cloneList[i]._id?.toString() as string);
        }
        
        for(let i = 0; i < cloneList.length; i++) {
            if(updateItem) {
                updateItem(cloneList[i]);
            }
        }

        let created = await repo.CreateMany(cloneList)
        if(!created || created.length === 0) {
            throw new Error(`Failed to create copy of '${collType}' while cloning elements`)
        }
    }
    return idChangeMap;
}










     // let devAppRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.DEVELOPMENT)
        // let filter = { enabled : false } as Filter<AppInfo>
        // let disabledApps : AppInfo[] = (await devAppRepo.GetWithFilter(filter)) ?? [];


        // if(disabledApps && disabledApps.length > 0) {
        //     const _MS_PER_DAY = 1000 * 60 * 60 * 24;
        //     const today = new Date();
        //     const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
            
        //     const MAX_DAYS_FOR_DELETION = 30; //take note -- at some point we want to move this to configs!

        //     for (let k = 0; k < disabledApps.length; k++) {
        //         let offdApp = disabledApps[k];
        //         let offdAppId = offdApp._id?.toString() as string
        //         const dt: Date = new Date(offdApp.lastUpdatedOn);
        //         const utc = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
        //         let dif = Math.floor((utcToday - utc) / _MS_PER_DAY);
                
        //         if (dif > MAX_DAYS_FOR_DELETION) {
        //             let allEnvironments = getEnumValuesAsArray(EnvTypeEnum)
        //             for(let env of allEnvironments) {
        //                 let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
        //                 await appRepo.DeleteMany([offdAppId]);

        //                 let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env)
        //                 let bucks = await buckRepo.GetAllByOwnerElementId(offdAppId) ?? [];
        //                 if(bucks.length > 0) {
        //                     await buckRepo.DeleteManyByOwnerElementId(offdAppId, null, true)
        //                 }

        //                 let confRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
        //                 let confs = await confRepo.GetAllByOwnerElementId(offdAppId) ?? [];
        //                 if(confs.length > 0) {
        //                     await confRepo.DeleteManyByOwnerElementId(offdAppId, null, true)
        //                 }

        //                 let histRepo = new ServiceModelRepository<ConfigChangeHistory>(DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION, env)
        //                 let hists = await histRepo.GetAllByOwnerElementId(offdAppId) ?? [];
        //                 if(hists.length > 0) {
        //                     await histRepo.DeleteManyByOwnerElementId(offdAppId, null, true)
        //                 }
        //             }
        //         }
        //     }
        // }

        // //===============================================================
        
        
        
        // let devAppRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.DEVELOPMENT)
        // let filter = { enabled : false } as Filter<AppInfo>
        // let disabledApps : AppInfo[] = (await devAppRepo.GetWithFilter(filter)) ?? [];


        // if(disabledApps && disabledApps.length > 0) {
        //     const _MS_PER_DAY = 1000 * 60 * 60 * 24;
        //     const today = new Date();
        //     const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
            
        //     const MAX_DAYS_FOR_DELETION = 30; //take note -- at some point we want to move this to configs!

        //     for (let k = 0; k < disabledApps.length; k++) {
        //         let offdApp = disabledApps[k];
        //         let offdAppId = offdApp._id?.toString() as string
        //         const dt: Date = new Date(offdApp.lastUpdatedOn);
        //         const utc = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
        //         let dif = Math.floor((utcToday - utc) / _MS_PER_DAY);
                
        //         if (dif > MAX_DAYS_FOR_DELETION) {
        //             let allEnvironments = getEnumValuesAsArray(EnvTypeEnum)
        //             for(let env of allEnvironments) {
        //                 let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
        //                 await appRepo.DeleteMany([offdAppId]);

        //                 let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env)
        //                 let bucks = await buckRepo.GetAllByOwnerElementId(offdAppId) ?? [];
        //                 if(bucks.length > 0) {
        //                     await buckRepo.DeleteManyByOwnerElementId(offdAppId, null, true)
        //                 }

        //                 let confRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
        //                 let confs = await confRepo.GetAllByOwnerElementId(offdAppId) ?? [];
        //                 if(confs.length > 0) {
        //                     await confRepo.DeleteManyByOwnerElementId(offdAppId, null, true)
        //                 }

        //                 let histRepo = new ServiceModelRepository<ConfigChangeHistory>(DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION, env)
        //                 let hists = await histRepo.GetAllByOwnerElementId(offdAppId) ?? [];
        //                 if(hists.length > 0) {
        //                     await histRepo.DeleteManyByOwnerElementId(offdAppId, null, true)
        //                 }
        //             }
        //         }
        //     }
        // }


//==================================================================

// if (env !== EnvTypeEnum.PRODUCTION) {
//     let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.PRODUCTION);
//     let prodInstance = await appRepo.GetWithId(app._id?.toString() as string)
//     if(prodInstance && prodInstance._id) {
//         environList.add(EnvTypeEnum.PRODUCTION)
//     }
// }
// if (env !== EnvTypeEnum.PREVIEW) {
//     let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.PREVIEW);
//     let prevInstance = await appRepo.GetWithId(app._id?.toString() as string)
//     if(prevInstance && prevInstance._id) {
//         environList.add(EnvTypeEnum.PREVIEW)
//     }
// }
// if (env !== EnvTypeEnum.DEVELOPMENT) {
//     let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.DEVELOPMENT);
//     let devInstance = await appRepo.GetWithId(app._id?.toString() as string)
//     if(devInstance && devInstance._id) {
//         environList.add(EnvTypeEnum.DEVELOPMENT)
//     }
// }
