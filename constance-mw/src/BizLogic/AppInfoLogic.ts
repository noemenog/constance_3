import { ObjectId } from "mongodb";
import { AppInfo, Bucket } from "../Models/ServiceModels";
import { BUCKETLIST, DBCollectionTypeEnum, ENVIRONMENTLIST, EnvTypeEnum, NamingContentTypeEnum } from "../Models/Constants";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { checkDuplicatesIgnoreCase, verifyNaming } from "./UtilFunctions";
import { randomUUID } from "crypto";





export async function performAppAdd(env: EnvTypeEnum, app: AppInfo) : Promise<AppInfo|null>{
    let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
    
    //check required fields
    if(!app.name || app.name.trim().length < 2 || app.name.toLowerCase().trim() === "undefined"){
        throw new Error(`Please use at least two characters for app name`)
    }
    if(!app.owner || !app.owner.email || !app.owner.idsid){
        throw new Error(`New app must have valid owner info`)
    }
    //check format of project name
    verifyNaming([app.name], NamingContentTypeEnum.APPINFO)

    //NOTE: check if appName already exists. If a app exists in the system and is set to "disabled", it still count in name checking - no duplicates!
    let filter = {name : new RegExp('^' + app.name + '$', 'i')}
    const exisApps: AppInfo[] = (await appRepo.GetWithFilter(filter)) as AppInfo[];
    if (exisApps && exisApps.length > 0) {
        throw new Error(`Cannot add new AppInfo '${app.name}'. 
            ${(exisApps && exisApps.length > 0 && exisApps[0].enabled === false) ? "A disabled app" : "An app"} with the same name already exists in the system`);
    }

    app.createdOn = new Date();
    app.lastUpdatedOn = new Date();
    app.lockedBy = null;
    app.name = app.name.trim().toUpperCase();
    app.enabled = true;

    delete app['_id'];

    //check duplicate assoc prop names
    let propNames = app.associatedProperties.map(a => a.name)
    let dupNamesRes = checkDuplicatesIgnoreCase(propNames);
    if (dupNamesRes === false) {
        throw new Error(`Duplicate property names are not allowed for new App. Please check configured default app properties`)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = app.associatedProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property names are not allowed for new app. Please check configured default app properties`)
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
            let environList = new Set<string>([env.toString()])
            if (env !== EnvTypeEnum.PRODUCTION) {
                let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.PRODUCTION);
                let prodInstance = await appRepo.GetWithId(app._id?.toString() as string)
                if(prodInstance && prodInstance._id) {
                    environList.add(EnvTypeEnum.PRODUCTION)
                }
            }
            if (env !== EnvTypeEnum.PREVIEW) {
                let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.PREVIEW);
                let prevInstance = await appRepo.GetWithId(app._id?.toString() as string)
                if(prevInstance && prevInstance._id) {
                    environList.add(EnvTypeEnum.PREVIEW)
                }
            }
            if (env !== EnvTypeEnum.DEVELOPMENT) {
                let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, EnvTypeEnum.DEVELOPMENT);
                let devInstance = await appRepo.GetWithId(app._id?.toString() as string)
                if(devInstance && devInstance._id) {
                    environList.add(EnvTypeEnum.DEVELOPMENT)
                }
            }

            app.contextProperties = app.contextProperties.filter(a => a.name.toUpperCase() !== ENVIRONMENTLIST) ?? [];
            app.contextProperties.push({
                id: randomUUID(),
                name: ENVIRONMENTLIST,
                value: Array.from(environList).sort()
            })
        }
    }
    return app;
}