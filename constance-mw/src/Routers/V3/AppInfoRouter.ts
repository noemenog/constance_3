import express, { Request, Response } from "express";
import * as mongo from "mongodb";
import crypto, { randomUUID } from "crypto"
import { DBCollectionTypeEnum, EnvTypeEnum, ErrorSeverityValue } from "../../Models/Constants";
import { AppInfo, Bucket, ConfigItem } from "../../Models/ServiceModels";
import { ResponseData, User } from "../../Models/HelperModels";
import { includeContextDetailsForApp, performAppAdd, performAppClone, performAppDelete, performAppUpdate } from "../../BizLogic/AppInfoLogic";
import { Filter } from "mongodb";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { GetEnvironmentType } from "../../BizLogic/BasicCommonLogic";
import { exportBucket } from "../../BizLogic/BucketLogic";


export const appInfoRouter = express.Router();



appInfoRouter.get("/:env/appinfo/get-all", async (req: Request, res: Response) => {
    try {
        let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, req.params.env)
        let filter = { enabled : true } as Filter<AppInfo>
        let projection = { associatedProperties: 0 }
        let result = await appRepo.GetByFilterAndProjection(filter, projection)
        res.status(200).send({ payload: result } as ResponseData);
    } 
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});



appInfoRouter.get("/:env/appinfo/get-details", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)

        let appId : string = req.query.appId?.toString() || ''
        if (!appId || appId === 'undefined' || appId.trim().length === 0) {
            throw new Error(`Input 'appId' cannot be null or empty or undefined`);
        }
        
        let includeBuckets: boolean = (req.query.includeBuckets?.toString()?.trim()?.toLowerCase() === "true") ? true : false;
        let app = await appRepo.GetWithId(appId)
        if(app) {
            app = await includeContextDetailsForApp(app, env, includeBuckets, true);
        }

        res.status(200).send({ payload: app } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});



appInfoRouter.post("/:env/appinfo/add", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        const app: AppInfo = req.body as AppInfo;
        
        if (app && app.name.length > 0) {
            let insertedApp = await performAppAdd(app);
            if(insertedApp) {
                insertedApp = await includeContextDetailsForApp(insertedApp, env, false, true);
            }
            res.status(200).send({ payload: insertedApp } as ResponseData);
        }
        else {
            throw new Error(`Could not add new app info because no valid app info was provided for the operation`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});



appInfoRouter.post("/:env/appinfo/update", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        const app: AppInfo = req.body as AppInfo;
        
        if (app && app._id && app.name.length > 0) {
            let updatedApp = await performAppUpdate(app);
            if(updatedApp) {
                updatedApp = await includeContextDetailsForApp(updatedApp, env, false, true);
            }
            res.status(200).send({ payload: updatedApp } as ResponseData);
        }
        else {
            throw new Error(`Could not add new app info because no valid app info was provided for the operation`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});



appInfoRouter.delete("/:env/appinfo/delete", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        let appId : string = req.query.appId?.toString() ?? ''
        if (!appId || appId === 'undefined' || appId.trim().length === 0) {
            throw new Error(`Input 'appId' cannot be null or empty or undefined`);
        }
        let delEnv : string = req.query.delEnv?.toString() ?? ''
        if (!delEnv || delEnv === 'undefined' || delEnv.trim().length === 0) {
            throw new Error(`Input 'delEnv' cannot be null or empty or undefined`);
        }
        
        let result : EnvTypeEnum[] = await performAppDelete(env, appId, delEnv);
        res.status(200).send({ payload: result } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});



appInfoRouter.post("/:env/appinfo/export-all", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        let src : EnvTypeEnum = GetEnvironmentType(req.query.src?.toString() ?? '');
        let dest : EnvTypeEnum = GetEnvironmentType(req.query.dest?.toString() ?? '');

        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;
        if (!user) {
            throw new Error(`Cannot export configs! Input 'user' info is invalid!`);
        }

        let appId : string = req.query.appId?.toString() ?? ''
        if (!appId || appId === 'undefined' || appId.trim().length === 0) {
            throw new Error(`Input 'appId' cannot be null or empty or undefined`);
        }

        if (src === dest) {
            throw new Error(`Input 'src' and 'dest' cannot be the same`);
        }

        let srcAppRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, src)
        let app = await srcAppRepo.GetWithId(appId) 
        if(!app) {
            throw new Error(`Could not export app info. Intended source app was not found at source environment`);
        }

        let srcBuckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, src)
        let srcBuckets = await srcBuckRepo.GetAllByOwnerElementId(appId);
        if(srcBuckets && srcBuckets.length > 0) {
            for(let bucket of srcBuckets) {
                await exportBucket(src, bucket, dest, app, user);
            }
        }
        else {
            throw new Error(`Could not export buckets. Intended source buckets were not found at source environment`);
        }

        res.status(200).send({ payload: true } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});



appInfoRouter.post("/:env/appinfo/manage-lock", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        let appId : string = req.query.appId?.toString() || ''
        let userEmail : string = req.query.user?.toString() || ''
        let isLockAction: boolean = (req.query.isLockAction?.toString()?.trim()?.toLowerCase() === "true") ? true : false;

        if (!appId || appId === 'undefined' || appId.trim().length === 0) {
            throw new Error(`Failed to manage lock action. Input 'appId' cannot be null or empty or undefined`);
        }
        if (!userEmail || userEmail === 'undefined' || userEmail.trim().length === 0) {
            throw new Error(`Failed to manage lock action. Input user info cannot be null or empty or undefined`);
        }

        let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
        let appInfo = await appRepo.GetWithId(appId)
        if (appInfo) {
            const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
            if(user?.email.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
                throw new Error(`Could not update app lock status. Indicated user must be same as program executor`);
            }
            
            if(isLockAction) {
                appInfo.lockedBy = userEmail.trim().toLowerCase();
            }
            else {
                appInfo.lockedBy = null;
            }

            let updatedApp = await performAppUpdate(appInfo);
            if(updatedApp) {
                updatedApp = await includeContextDetailsForApp(updatedApp, env, false, true);
            }
            res.status(200).send({ payload: updatedApp } as ResponseData);
        }
        else {
            throw new Error(`Could not update app lock status because no such app was found in the system`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});



appInfoRouter.post("/:env/appinfo/clone", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);

        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
        if (!user || !user.email) {
            throw new Error(`Cannot perform expected operation! Input 'user' info is invalid!`);
        }

        let appId : string = req.query.appId?.toString() ?? ''
        if (!appId || appId === 'undefined' || appId.trim().length === 0) {
            throw new Error(`Input 'appId' cannot be null or empty or undefined`);
        }

        let newName : string = req.query.newName?.toString() ?? ''
        if (!newName || newName === 'undefined' || newName.trim().length === 0) {
            throw new Error(`Input 'newName' cannot be null or empty or undefined`);
        }
        
        let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
        let existingApp = await appRepo.GetWithId(appId.trim());
        if(!existingApp || !existingApp._id) {
            throw new Error(`Cannot proceed with cloning. No AppInfo was found for the provided app ID`);
        }

        let theClone : AppInfo = await performAppClone(existingApp, newName, user);
        if(theClone) {
            theClone = await includeContextDetailsForApp(theClone, env, false, true);
        }
        
        res.status(200).send({ payload: theClone } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});



































        
        
        // const app: AppInfo = req.body as AppInfo;
        // let env = req.params.env;
        // if (env.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase() && env.toLowerCase() !== "dev") {
        //     throw Error("Update action on an existing App can only be performed in development environment");
        // }
        
        // if (app && app.name.length > 0) {
        //     app.lastUpdatedOn = new Date();
        //     app.enabled = true;
        //     const collection = getAppInfoCollection(req.params.env);
            
        //     //check if app name has special/unwanted characters
        //     if(containsSpecialChars([app.name])){
        //         throw Error("App name contains special characters that is not allowed.");
        //     }

        //     const foundApps = (await collection.find({ _id: new mongo.ObjectId(app._id?.toString()) } as any).toArray()) as AppInfo[];
            
        //     if (foundApps && foundApps.length > 0) {
        //         let updatedData = foundApps[0];
        //         updatedData.name = app.name;
        //         updatedData.description = app.description;
        //         updatedData.enabled = app.enabled;
        //         updatedData.lastUpdatedOn = app.lastUpdatedOn;

        //         await collection.replaceOne({ _id: updatedData._id as any }, updatedData);

        //         //get other environments
        //         let otherEnvs = [EnvTypeEnum.PRODUCTION, EnvTypeEnum.PREVIEW, EnvTypeEnum.DEVELOPMENT].filter((a: string) => {
        //             if (a.toLowerCase().startsWith(req.params.env.toLowerCase()) == false) {
        //                 return a;
        //             }
        //         });

        //         //ensure that app info is updated in other environments where it exists
        //         otherEnvs.forEach((a) => {
        //             let otherColl = getAppInfoCollection(a);
        //             otherColl.replaceOne({ _id: updatedData._id } as any, updatedData, { upsert: false }) //upsert NOT allowed!
        //         });

        //         res.status(200).send({ payload: updatedData } as ResponseData);
        //     }
        //     else {
        //         throw new Error(`Could not update app info because no such app was found in specified environment`);
        //     }
        // }
        // else {
        //     throw new Error(`Could not update app info because no valid app info was provided for the operation`);
        // }




//======================== NOT Intended for Constance UI =================================================
//example: http://localhost:7000/api/v2/Development/appinfo/get?appId=652884b1f8bbabef92b66f37
//========================================================================================================
// appInfoRouter.get("/:env/appinfo/get", async (req: Request, res: Response) => {
//     try {
//         const collection = getAppInfoCollection(req.params.env);
//         let appId : string = req.query.appId?.toString() ?? ''
//         if (!appId) {
//             throw new Error(`Input 'appId' cannot be null or empty or undefined`);
//         }
//         const apps = (await collection.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
        
//         if(apps && apps.length > 0) {
//             const bucketCollection = getBucketCollection(req.params.env);
//             const appBucketFilter = getFilterForBucket(appId, null);
//             let appBuckets = (await bucketCollection.find(appBucketFilter).toArray()) as Bucket[];
            
//             let resultApp = apps[0];
//             // resultApp.buckets = appBuckets;
            
//             // if(!resultApp.tags){
//             //     resultApp.tags = []
//             // }
            
//             // let appEnvs: string[] = await performAppEnvironmentRetrieval(req.params?.env, appId)
//             // for(let item of appEnvs){
//             //     if(item.length > 0){
//             //         let entry = `env:${item}`;
//             //         if(resultApp.tags.includes(entry) == false){
//             //             resultApp.tags.push(entry)
//             //         }
//             //     }
//             // }
            
//             res.status(200).send({ payload: resultApp } as ResponseData);
//         }
//         else {
//             throw Error("App not found")
//         }
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         console.error(resp);
//         res.status(500).json(resp);
//     }
// });




// appInfoRouter.get("/appinfo/get-envs", async(req: Request, res: Response) => {
//     try {
//         let appId : string = req.query.appId?.toString() ?? ''
//         if (!appId) {
//             throw new Error(`Input 'appId' cannot be null or empty or undefined`);
//         }

//         let appEnvs = await performAppEnvironmentRetrieval(appId)
        
//         res.status(200).send({ payload: appEnvs } as ResponseData);
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         console.error(resp);
//         res.status(500).json(resp);
//     }
// });



// appInfoRouter.get("/:env/appinfo/get-full-details/:appId", async(req:Request, res:Response) => {
//     try {
//         const appCollection = getAppInfoCollection(req.params.env);
//         let appId : string = req.query.appId?.toString() ?? ''
//         if (!appId) {
//             throw new Error(`Input 'appId' cannot be null or empty or undefined`);
//         }
        
//         let apps = (await appCollection.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
        
//         if(apps && apps.length === 1) {
//             let theApp = apps[0]
//             const bucketCollection = getBucketCollection(req.params.env);
//             const appBucketFilter = getFilterForBucket(appId, null);
//             let appBuckets = (await bucketCollection.find(appBucketFilter).toArray()) as Bucket[];
            
//             if(appBuckets && appBuckets.length > 0) {
//                 const configCollection = getConfigCollection(req.params.env);
//                 let appConfigs = (await configCollection.find({ appId: appId }).toArray() as ConfigItem[]);
                
//                 theApp.buckets = appBuckets ?? new Array<Bucket>();
                
//                 for (let i = 0; i < theApp.buckets.length; i++){
//                     let buckConfs = appConfigs?.filter(x => x.bucketId === (theApp.buckets as Bucket[])[i]._id?.toString());
//                     theApp.buckets[i].configs = buckConfs;
//                 }
//             }

//             res.status(200).send({ payload: theApp } as ResponseData);
//         }
//         else {
//             throw Error("AppId is invalid/problematic");
//         }
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         console.error(resp);
//         res.status(500).json(resp);
//     }
// });






// appInfoRouter.post("/:env/appinfo/upload", async (req: Request, res: Response) => {
//     let insertedApp : AppInfo|null = null;
//     try {
//         const app: AppInfo = req.body as AppInfo;
        
//         if (app && app.name.length > 0) {
//             if(app.buckets && app.buckets.length > 0) {
//                 insertedApp = await performAppAdd(EnvTypeEnum.DEVELOPMENT, app);
//                 if(insertedApp && insertedApp._id && insertedApp._id.toString().length > 0) {
//                     app.buckets.forEach(x => x.ownerElementId = insertedApp?._id?.toString() as string ?? x.ownerElementId) 
//                     const insertedBuckets = await performBucketAdd(EnvTypeEnum.DEVELOPMENT, app.buckets);
                    
//                     if(insertedBuckets && insertedBuckets.length > 0) {
//                         let bcCollections = new Array<ConfigItem[]>()
//                         for(let i = 0; i < insertedBuckets.length; i++) {
//                             let appBuck = app.buckets.filter((x: Bucket) => x.name === insertedBuckets[i].name)
//                             if(appBuck && appBuck.length > 0 ) {
//                                 let buck = appBuck[0];
//                                 if(buck.configs && buck.configs.length > 0) {
//                                     await validateConfigListForAddOrUpdate(EnvTypeEnum.DEVELOPMENT, buck.configs, true);
//                                     bcCollections.push(buck.configs)
//                                 }
//                             }
//                         }

//                         if(bcCollections.length > 0) {
//                             for(let i = 0; i < bcCollections.length; i++) {
//                                 performConfigAdd(EnvTypeEnum.DEVELOPMENT, bcCollections[i], true)
//                             }
//                         }
                        
//                         for(let i = 0; i < insertedBuckets.length; i++) {
//                             let expAppId = insertedApp._id.toString();
//                             let buckId = insertedBuckets[i]._id?.toString();
//                             if(buckId) {
//                                 await performBucketExport(EnvTypeEnum.DEVELOPMENT, expAppId, buckId, req.params.env);
//                             }
//                         }
//                     }
//                 }
//             }
//             else {
//                 throw new Error(`Could not add new app info. At least one bucket is required to perform upload`);
//             }
//         }
//         else {
//             throw new Error(`Could not add new app info because no valid app info was provided for the operation`);
//         }
//     }
//     catch (e: any) {
//         try {
//             if(insertedApp && insertedApp._id && insertedApp._id.toString().length > 0) {
//                 await performAppDelete(EnvTypeEnum.DEVELOPMENT, insertedApp._id.toString(), req.params.env);
//             }
//         }
//         catch (e: any) {
//             console.error(`Error occured while performing cleanup that was due to upload error. Environment: ${req.params.env}`)
//         }
        
//         try{
//             if(insertedApp && insertedApp._id && insertedApp._id.toString().length > 0) {
//                 await performAppDelete(EnvTypeEnum.DEVELOPMENT, insertedApp._id.toString(), EnvTypeEnum.DEVELOPMENT);
//             }
//         }
//         catch (e: any) {
//             console.error(`Error occured while performing cleanup that was due to upload error. Environment: ${EnvTypeEnum.DEVELOPMENT}`)
//         }

//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: "ERROR", message: e.message }
//         }
//         res.status(500).send(resp);
//     }
// });

