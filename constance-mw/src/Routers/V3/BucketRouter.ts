import express, { Request, Response } from "express";
import * as mongo from "mongodb";
import crypto from "crypto"
import multer from "multer"
import { DBCollectionTypeEnum, EnvTypeEnum, ErrorSeverityValue } from "../../Models/Constants";
import { ResponseData, User } from "../../Models/HelperModels";
import { AppInfo, Bucket, ConfigItem } from "../../Models/ServiceModels";
import { getAppInfoCollection, getBucketCollection, getConfigCollection } from "../../dbConn";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { GetEnvironmentType } from "../../BizLogic/BasicCommonLogic";
import { exportBucket, includeContextDetailsForBuckets, performBucketAdd, performBucketDelete, performBucketUpdate } from "../../BizLogic/BucketLogic";


const upload = multer({ storage: multer.memoryStorage() })

export const bucketRouter = express.Router();


bucketRouter.get("/:env/buckets/get-list", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        let appId : string = req.query.appId?.toString() ?? ''
        if (!appId || appId === 'undefined' || appId.trim().length === 0) {
            throw new Error(`Input 'appId' cannot be null or empty or undefined`);
        }

        let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env)
        let bucketList = await buckRepo.GetAllByOwnerElementId(appId) ?? []
        if(bucketList) {
            bucketList = await includeContextDetailsForBuckets(bucketList, env, true);
        }

        res.status(200).send({ payload: bucketList } as ResponseData);
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



bucketRouter.post("/:env/buckets/add", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        const bucketList: Bucket[] = req.body as Bucket[];
        
        if (bucketList && bucketList.length > 0) {
            let insertedBuckets = await performBucketAdd(bucketList);
            if(insertedBuckets) {
                insertedBuckets = await includeContextDetailsForBuckets(insertedBuckets, env, true);
            }
            res.status(200).send({ payload: insertedBuckets } as ResponseData);
        }
        else {
            throw new Error(`Could not add new bucket(s) because no valid bucket was provided for the operation`);
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


bucketRouter.post("/:env/buckets/update", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        const bucket: Bucket = req.body as Bucket;
        
        if (bucket && bucket._id && bucket.name.length > 0) {
            let updatedBucket = await performBucketUpdate(bucket);
            if(updatedBucket) {
                updatedBucket = (await includeContextDetailsForBuckets([updatedBucket], env, true))?.at(0) as Bucket;
            }
            res.status(200).send({ payload: updatedBucket } as ResponseData);
        }
        else {
            throw new Error(`Could not update bucket because no valid bucket was provided for the operation`);
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


bucketRouter.delete("/:env/buckets/delete", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        let bucketId : string = req.query.bucketId?.toString() ?? ''
        if (!bucketId || bucketId === 'undefined' || bucketId.trim().length === 0) {
            throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
        }
        let delEnv : string = req.query.delEnv?.toString() ?? ''
        if (!delEnv || delEnv === 'undefined' || delEnv.trim().length === 0) {
            throw new Error(`Input 'delEnv' cannot be null or empty or undefined`);
        }
        
        let result : EnvTypeEnum[] = await performBucketDelete(env, bucketId, delEnv);
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



bucketRouter.post("/:env/buckets/export-bucket", async (req: Request, res: Response) => {
    try {
        let env = req.params.env;
        let bucketId : string = req.query.bucketId?.toString() ?? ''
        let src : string = req.query.src?.toString() ?? ''
        let dest : string = req.query.dest?.toString() ?? ''

        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;

        if (!bucketId || bucketId === 'undefined' || bucketId.trim().length === 0) {
            throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
        }
        if (!src || src === 'undefined' || src.trim().length === 0) {
            throw new Error(`Input 'src' cannot be null or empty or undefined`);
        }
        if (!dest || dest === 'undefined' || dest.trim().length === 0) {
            throw new Error(`Input 'dest' cannot be null or empty or undefined`);
        }

        if (!user) {
            throw new Error(`Cannot export configs! Input 'user' info is invalid!`);
        }

        let srcBuckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, src)
        let bucket = await srcBuckRepo.GetWithId(bucketId);
        if(bucket && bucket._id) {
            await exportBucket(src, bucket, dest, null, user);
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




// bucketRouter.get("/:env/buckets/get-details", async (req: Request, res: Response) => {
//     try {
//         let bucketId : string = req.query.bucketId?.toString() ?? ''
//         if (!bucketId) {
//             throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
//         }
//         const collection = getBucketCollection(req.params.env);
//         const retBucket = (await collection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
//         if(retBucket && retBucket.length > 0) {
//             res.status(200).send({ payload: retBucket[0] } as ResponseData);
//         }
//         else {
//             throw Error("Bucket not found")
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


// bucketRouter.get("/buckets/get-envs", async(req:Request, res:Response) => {
//     try {
//         let bucksEnvs:any=[];
//         let bucketId : string = req.query.bucketId?.toString() ?? ''
//         if (!bucketId) {
//             throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
//         }

//         const bucksCollDev = getBucketCollection(EnvTypeEnum.DEVELOPMENT);
//         const bucksDev : Bucket[] = (await bucksCollDev.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
//         if(bucksDev && bucksDev.length > 0) { bucksEnvs.push(EnvTypeEnum.DEVELOPMENT); }

//         const bucksCollPre = getBucketCollection(EnvTypeEnum.PREVIEW);
//         const bucksPre : Bucket[] = (await bucksCollPre.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
//         if(bucksPre && bucksPre.length > 0) { bucksEnvs.push(EnvTypeEnum.PREVIEW); }

//         const bucksCollProd = getBucketCollection(EnvTypeEnum.PRODUCTION);
//         const bucksProd : Bucket[] = (await bucksCollProd.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
//         if(bucksProd && bucksProd.length > 0) { bucksEnvs.push(EnvTypeEnum.PRODUCTION); }

//         res.status(200).send({ payload: bucksEnvs } as ResponseData);
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


// bucketRouter.post("/:env/buckets/add", async (req: Request, res: Response) => {
//     try {
//         let env = req.params.env;
//         if (env.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase() && env.toLowerCase() !== "dev") {
//             throw Error("Creation of new bucket is only allowed in development environment");
//         }
        
//         const bucketList: Bucket[] = req.body as Bucket[];
        
//         if (bucketList && bucketList.length > 0) {
//             let insertedBuckets = await performBucketAdd(env, bucketList);
//             res.status(200).send({ payload: insertedBuckets } as ResponseData);
//         }
//         else {
//             throw new Error(`Could not add new bucket(s) because no valid bucket was provided for the operation`);
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



// bucketRouter.post("/:env/buckets/copy", async (req: Request, res: Response) => {
//     try {
//         let env = req.params.env;
        
//         if (env.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase() && env.toLowerCase() !== "dev") {
//             throw Error("Creation of new bucket is only allowed in development environment");
//         }

//         let newName : string = req.query.newName?.toString() ?? ''
//         if (!newName || newName.length == 0) {
//             throw Error("Could neot determine name for new bucket. 'Copy' action cannot proceed");
//         }

//         const srcBucket: Bucket = req.body as Bucket;
        
//         if (srcBucket) {
//             if(srcBucket._id && srcBucket._id.toString().length > 0) {
//                 let copyBucket = {...srcBucket}
//                 copyBucket.name = newName;
//                 copyBucket._id = "";
//                 let insertedBuckets = await performBucketAdd(env, [copyBucket]);
//                 if(insertedBuckets && insertedBuckets.length > 0){
//                     let newCopyBuck = insertedBuckets[0] as Bucket
//                     const confCollection = getConfigCollection(env);
//                     const confFilter = { appId: srcBucket.ownerElementId, bucketId: srcBucket._id.toString() };
//                     const srcConfigs = (await confCollection.find(confFilter).toArray()) as ConfigItem[];
//                     if (srcConfigs && srcConfigs.length > 0) {
//                         for(let i = 0; i < srcConfigs.length; i++){
//                             srcConfigs[i]._id = "";
//                             srcConfigs[i].ownerElementId = newCopyBuck.ownerElementId
//                             srcConfigs[i].bucketId = (newCopyBuck._id?.toString() as string)
//                             // srcConfigs[i].bucketName = newCopyBuck.name
//                         }
//                         let addedConfs = await performConfigAdd(env, srcConfigs, false);
//                         // newCopyBuck.configs = addedConfs ?? []
//                     }

//                     res.status(200).send({ payload: newCopyBuck } as ResponseData);
//                 }
//                 else{
//                     throw new Error(`Failef to 'Copy' bucket!`);
//                 }
//             }
//             else {
//                 throw new Error(`Incoming bucket does not have a valid ID, 'Copy' action cannot be completed`);
//             }
//         }
//         else {
//             throw new Error(`Could not add new bucket(s) because no valid bucket was provided for the operation`);
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


// bucketRouter.post("/:env/buckets/update", async (req: Request, res: Response) => {
//     try {
//         const bucketList: Bucket[] = req.body as Bucket[];
//         let env = req.params.env;
//         if (env.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase() && env.toLowerCase() !== "dev") {
//             throw Error("Update action on an existing App can only be performed in development environment");
//         }
        
//         if (bucketList && bucketList.length > 0) {
//             bucketList.forEach(x => x.lastUpdatedOn = new Date());
//             const bucketCollection = getBucketCollection(req.params.env);
//             const appCollection = getAppInfoCollection(req.params.env);
//             let inputBucketNames = bucketList.map(x => x.name)
//             let inputBucketIds = bucketList.filter(a => (a._id && a._id.toString().length > 0)).map(x => x._id?.toString())
//             let appIdsinBucketList = new Set<string>()

//             //check if app name has special/unwanted characters
//             if(containsSpecialChars(inputBucketNames)){
//                 throw Error("One or more supplied bucket names contains special characters that is not allowed.");
//             }

//             //check for appId
//             bucketList.forEach(element => {
//                 if(element.ownerElementId){
//                     appIdsinBucketList.add(element.ownerElementId.toString() as string)
//                 }
//             });
//             if(appIdsinBucketList.size === 0 || appIdsinBucketList.size > 1){
//                 throw Error("Bucket list error. Please ensure that appID for each bucket is valid and all buckets items for transaction are associated to same app");
//             }

//             //check for duplicate bucket
//             let checkRes = checkDuplicatesIgnoreCase(inputBucketNames);
//             if (checkRes === false) {
//                 throw Error("Duplicate bucket names found.");
//             }
            
//             let filter = { _id: new mongo.ObjectId(appIdsinBucketList.values().next().value)} as any
//             const foundApps = (await appCollection.find(filter).toArray()) as AppInfo[];
            
//             if (foundApps && foundApps.length > 0) {
//                 for(let i = 0; i < bucketList.length; i++) {
//                     if(bucketList[i]._id){
//                         let strId = bucketList[i]._id?.toString().length 
//                         if(strId && strId > 0){
//                             let oid = new mongo.ObjectId(bucketList[i]._id);
//                             bucketList[i]._id = oid;
//                             bucketList[i].lastUpdatedOn = new Date();
//                         }
//                     }
//                     else {
//                         const { _id, ...rest } = bucketList[i];
//                         rest.lastUpdatedOn = new Date();
//                         bucketList[i] = rest;
//                     }
//                 }

//                 //bulk update - with upsert!!
//                 const bulkData = bucketList.map(item => (
//                     {
//                         replaceOne: {
//                             upsert: true,
//                             filter: { _id: new mongo.ObjectId(item._id) } as any,  //{ appId: bucketList[0].appId } as any,
//                             replacement: item
//                         }
//                     }
//                 ));
//                 await bucketCollection.bulkWrite(bulkData);

//                 //get other environments
//                 let otherEnvs = [EnvTypeEnum.PRODUCTION, EnvTypeEnum.PREVIEW, EnvTypeEnum.DEVELOPMENT].filter((a: string) => {
//                     if (a.toLowerCase().startsWith(req.params.env.toLowerCase()) == false) {
//                         return a;
//                     }
//                 });

//                 //ensure that app info is updated in other environments where it exists
//                 for(let q = 0; q < otherEnvs.length; q++) {
//                     let otherColl = getBucketCollection(otherEnvs[q]);
                    
//                     //bulk update - NO upsert!!
//                     const bulkData = bucketList.map(item => (
//                         {
//                             replaceOne: {
//                                 upsert: false, //upsert NOT allowed!
//                                 filter: { _id: new mongo.ObjectId(item._id) } as any, //{ appId: bucketList[0].appId } as any,
//                                 replacement: item
//                             }
//                         }
//                     ));
//                     await otherColl.bulkWrite(bulkData);
//                 }

//                 const appBucketFilter = getFilterForBucket(bucketList[0].ownerElementId, null);
//                 let freshBuckets = (await bucketCollection.find(appBucketFilter).toArray()) as Bucket[];
//                 if(freshBuckets && freshBuckets.length > 0) {
//                     freshBuckets = freshBuckets.filter(x => inputBucketIds.includes(x._id?.toString()))
//                 }
//                 res.status(200).send({ payload: freshBuckets } as ResponseData);
//             }
//             else {
//                 throw new Error(`Could not update bucket item(s) because associated app was found`);
//             }
//         }
//         else {
//             throw new Error(`Could not update bucket item(s) because no valid buckets were provided for the operation`);
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


// // bucketRouter.delete("/:env/buckets/delete", async (req: Request, res: Response) => {
// //     try {
// //         let env = req.params.env;
        
// //         let bucketId : string = req.query.bucketId?.toString() ?? ''
// //         if (!bucketId) {
// //             throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
// //         }
// //         let delEnv : string = req.query.delEnv?.toString() ?? ''
// //         if (!delEnv) {
// //             throw new Error(`Input 'delEnv' cannot be null or empty or undefined`);
// //         }
        
// //         let result = await performBucketDelete(env, bucketId, delEnv);
// //         res.status(200).send({ payload: result } as ResponseData);
// //     }
// //     catch (e: any) {
// //         let resp = {
// //             payload: undefined,
// //             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
// //         }
// //         console.error(resp);
// //         res.status(500).json(resp);
// //     }
// // });


// bucketRouter.post("/:env/buckets/export", async (req: Request, res: Response) => {
//     try {
//         let bucketId : string = req.query.bucketId?.toString() ?? ''
//         if (!bucketId) {
//             throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
//         }
//         let destEnv : string = req.query.destEnv?.toString() ?? ''
//         if (!destEnv) {
//             throw new Error(`Input 'destEnv' cannot be null or empty or undefined`);
//         }
//         let appId : string = req.query.appId?.toString() ?? ''
//         if (!appId) {
//             throw new Error(`Input 'appId' cannot be null or empty or undefined`);
//         }

//         let result = await performBucketExport(req.params.env, appId, bucketId, destEnv);
//         res.status(200).send({ payload: result } as ResponseData);
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



// bucketRouter.post('/:env/buckets/upload', upload.single("file"), async (req: Request, res: Response) => {
//     try {
//         let bucketId : string = req.query.bucketId?.toString() ?? ''
//         if (!bucketId) {
//             throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
//         }

//         let buf : Buffer = (req as any)?.file?.buffer
//         const collection = getBucketCollection(req.params.env);
//         const buckArr = (await collection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
//         if(buckArr) {
//             let bucket : Bucket = buckArr[0]
//             if(buf && buf.length > 0) {
//                 let newConfigs: ConfigItem[] = await processCSVContent(buf, bucket)
//                 if(newConfigs && newConfigs.length > 0){
//                     const confCollection = getConfigCollection(req.params.env);
//                     const filter : any = getFilterForBucket(bucket.ownerElementId, bucket._id?.toString());
//                     let existingConfigs = (await confCollection.find(filter).toArray()) as ConfigItem[];
//                     const deleteList = existingConfigs.map((x: ConfigItem) => new mongo.ObjectId(x._id)) ?? [];
//                     if(deleteList.length > 0) {
//                         await confCollection.deleteMany({ _id: { $in: deleteList } as any })
//                     }
                    
//                     await performConfigAdd(req.params.env, newConfigs, false);

//                     res.status(200).send({ payload: true } as ResponseData);
//                 }
//                 else{
//                     throw new Error(`Could not upload content for bucket [${bucket.name}]. File was either invalid or empty`);
//                 }
//             }
//             else {
//                 throw new Error(`Could not upload content for bucket [${bucket.name}]. File was either invalid or empty`);
//             }
//         }
//         else {
//             throw new Error(`Could not upload content for bucket. The bucket did does not exist`);
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


