import { getAppInfoCollection, getBucketCollection, getConfigCollection } from "../dbConn";
import { checkDuplicatesIgnoreCase, containsSpecialChars, formatConfigValueAndBucketName, getFilterForApp } from "./generalUtils";
import { getFilterForBucket, validateConfigListForAddOrUpdate } from "./generalUtils";
import { AppInfo, Bucket, ConfigItem } from "../Models/ServiceModels";
import * as mongo from "mongodb";
import * as exceljs from "exceljs";
import { ConfigContentTypeEnum, EnvTypeEnum, MAX_DAYS_FOR_DELETION, MONGO_ID_CHECK_REGEX_PATTERN } from "../Models/Constants";


export async function performConfigRetrieval(env: string, focusApp: string, focusBucket: string, query: any) : Promise<ConfigItem[]>{
    const appsCollection = getAppInfoCollection(env);
    let isGuidAppId = focusApp.match(MONGO_ID_CHECK_REGEX_PATTERN) ? true : false;
    let appFilter : any = getFilterForApp(focusApp, true, isGuidAppId)
    
    const apps = (await appsCollection.find(appFilter).toArray()) as AppInfo[];
    if (apps && apps.length === 1) {
        let appId : any = apps[0]._id?.toString();
        focusApp = apps[0].name;

        const bucketCollection = getBucketCollection(env);
        const appBucketFilter = getFilterForBucket(appId, null);
        let appBuckets = (await bucketCollection.find(appBucketFilter).toArray()) as Bucket[];
        
        let buckFindings = [];
        let isGuidBucketId = focusBucket.match(MONGO_ID_CHECK_REGEX_PATTERN) ? true : false;
        if(isGuidBucketId) {
            buckFindings = appBuckets?.filter(x => x._id?.toString()?.toLowerCase() === focusBucket.toLowerCase());
        }
        else {
            buckFindings = appBuckets?.filter(x => x.name.toLowerCase() === focusBucket.toLowerCase());
        }

        if(buckFindings && buckFindings.length > 0){
            if (buckFindings.length > 1){
                throw new Error(`Duplicate bucket names found for app '${focusApp}'`);
            }

            const bucket = buckFindings[0];
            const buckFilter : any = getFilterForBucket(appId, bucket._id?.toString());
            const confCollection = getConfigCollection(env);
            let configs = (await confCollection.find(buckFilter).toArray()) as ConfigItem[];

            if(configs && configs.length > 0){
                const { key = [] } = query ?? new Array<string>();
                const queryConfigItemKeys = (key as string[])?.map((x: string) => x.toLowerCase())  ?? [];
                if(queryConfigItemKeys && queryConfigItemKeys.length > 0){
                    const filteredConfigs = configs?.filter((conf) => queryConfigItemKeys.includes(conf.name.toLowerCase()));
                    if(filteredConfigs && filteredConfigs.length > 0){
                        configs = filteredConfigs;
                    }
                    else {
                        configs = new Array<ConfigItem>();
                    }
                }
                
                configs = formatConfigValueAndBucketName(configs, bucket);
            }
            return configs as ConfigItem[] //res.status(200).send(configs as ConfigItem[]);
        }
        else{
            throw new Error(`Could not find specified bucket '${focusBucket}' for the app '${focusApp}'. No configs retrieved.`);
        }
    }
    else if (apps && apps.length > 1) {
        throw new Error(`Duplicate apps found with the same name!  [${focusApp}]`);
    }
    else {
        return new Array<ConfigItem>()
    }
}

export async function performAppEnvironmentRetrieval(appId: string) : Promise<string[]>{
    let appEnvs:any=[];
    
    const appsCollDev = getAppInfoCollection(EnvTypeEnum.DEVELOPMENT);
    const appsDev : AppInfo[] = (await appsCollDev.find({ _id: new mongo.ObjectId(appId) } as any)?.toArray()) as AppInfo[];
    if(appsDev && appsDev.length > 0) { appEnvs.push(EnvTypeEnum.DEVELOPMENT); }

    const appsCollPre = getAppInfoCollection(EnvTypeEnum.PREVIEW);
    const appsPre : AppInfo[] = (await appsCollPre.find({ _id: new mongo.ObjectId(appId) } as any)?.toArray()) as AppInfo[];
    if(appsPre && appsPre.length > 0) { appEnvs.push(EnvTypeEnum.PREVIEW); }

    const appsCollProd = getAppInfoCollection(EnvTypeEnum.PRODUCTION);
    const appsProd : AppInfo[] = (await appsCollProd.find({ _id: new mongo.ObjectId(appId) } as any)?.toArray()) as AppInfo[];
    if(appsProd && appsProd.length > 0) { appEnvs.push(EnvTypeEnum.PRODUCTION); }

    return appEnvs;
}


// export async function performAppAdd(env: string, app: AppInfo) : Promise<AppInfo|null>{
//     const collection = getAppInfoCollection(env);

//     // check if App already exists
//     let appFilter = getFilterForApp(app.name, false);
//     const apps: AppInfo[] = (await collection.find(appFilter).toArray()) as AppInfo[];
//     if (apps && apps.length > 0) {
//         let stateStr = apps[0].enabled ? "An enabled app" : "A disabled app";
//         throw new Error(`Cannot add new App '${app.name}'. ${stateStr} with the same name already exists in the system`);
//     }

//     app.name = app.name.trim();
//     app.lastUpdatedOn = new Date();
//     app.enabled = true;

//     delete app['_id']; 
//     app.buckets = [];

//     // const { _id, buckets, ...rest } = app;

//     let inserted = await collection.insertOne(app);
    
//     if (inserted && inserted.insertedId) {
//         const insertedApp = (await collection.find({ _id: new mongo.ObjectId(inserted.insertedId) } as any).toArray()) as AppInfo[];
//         return  insertedApp[0] 
//     }

//     return null
// }


export async function performAppDelete(env: string, appId: string, inDelEnv: string) : Promise<boolean>{
    let actualDelEnvironment: string[] = [];
    let appNeedsToBeDel: mongo.ObjectId[] = [];

    const _MS_PER_DAY = 1000 * 60 * 60 * 24;
    const today = new Date();
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

    if (env.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase() && env.toLowerCase() !== "dev") {
        throw Error("Delete action can only be performed in development environment");
    }

    if ((inDelEnv.toLowerCase() === EnvTypeEnum.DEVELOPMENT.toLowerCase()) || (inDelEnv.toLowerCase() === "dev") || (inDelEnv.toLowerCase() === "all")) {
        if (inDelEnv.toLowerCase() === "all") {
            actualDelEnvironment = [EnvTypeEnum.DEVELOPMENT, EnvTypeEnum.PREVIEW, EnvTypeEnum.PRODUCTION];
        }
        else {
            const prevCollection = getAppInfoCollection(EnvTypeEnum.PREVIEW);
            const prevCheckApps = (await prevCollection.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
            if (prevCheckApps && prevCheckApps.length > 0 && prevCheckApps[0].enabled == true) {
                throw new Error(`Cannot delete an app from ${EnvTypeEnum.DEVELOPMENT} environment because app also exists in ${EnvTypeEnum.PREVIEW}`);
            }

            const prodCollection = getAppInfoCollection(EnvTypeEnum.PRODUCTION);
            const prodCheckerApps = (await prodCollection.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
            if (prodCheckerApps && prodCheckerApps.length > 0 && prodCheckerApps[0].enabled == true) {
                throw new Error(`Cannot delete an app from ${EnvTypeEnum.DEVELOPMENT} environment because app also exists in ${EnvTypeEnum.PRODUCTION}`);
            }

            actualDelEnvironment.push(EnvTypeEnum.DEVELOPMENT);
        }
    }
    else if ((inDelEnv.toLowerCase() === EnvTypeEnum.PREVIEW.toLowerCase()) || (inDelEnv.toLowerCase() === "pre") || (inDelEnv.toLowerCase() === "all")) {
        actualDelEnvironment.push(EnvTypeEnum.PREVIEW);
    }
    else if ((inDelEnv.toLowerCase() === EnvTypeEnum.PRODUCTION.toLowerCase()) || (inDelEnv.toLowerCase() === "prod") || (inDelEnv.toLowerCase() === "all")) {
        actualDelEnvironment.push(EnvTypeEnum.PRODUCTION);
    }
    else {
        throw Error("The environment specified for deletion is invalid");
    }

    for (let i = 0; i < actualDelEnvironment.length; i++) {
        let env = actualDelEnvironment[i];
        const collection = getAppInfoCollection(env);
        const foundApps = (await collection.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
        if (foundApps && foundApps.length > 0) {
            foundApps[0].enabled = false;
            await collection.replaceOne({ _id: new mongo.ObjectId(foundApps[0]._id) as any }, foundApps[0]);
        }
    };

    //find apps that have been disabled for MAX_DAYS_FOR_DELETION or more days
    const appsCollDev = getAppInfoCollection(EnvTypeEnum.DEVELOPMENT);
    const disabledAppsDevlopment = await appsCollDev.find({ enabled: false }).toArray() as AppInfo[];;
    if (disabledAppsDevlopment && disabledAppsDevlopment.length > 0) {
        disabledAppsDevlopment.forEach((disabledApp: any) => {
            const dt: Date = new Date(disabledApp.lastUpdatedOn);
            const utc = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
            let dif = Math.floor((utcToday - utc) / _MS_PER_DAY);
            if (dif > MAX_DAYS_FOR_DELETION) {
                appNeedsToBeDel.push(new mongo.ObjectId(disabledApp._id));
            }
        });
    }

    //delete apps and associated configItems when the appInfo has been disabled for MAX_DAYS_FOR_DELETION days
    if (appNeedsToBeDel && appNeedsToBeDel.length > 0) {
        let appIDStrings = appNeedsToBeDel.map((item: mongo.ObjectId) => item.toString());
        [EnvTypeEnum.DEVELOPMENT, EnvTypeEnum.PREVIEW, EnvTypeEnum.PRODUCTION].forEach((delEnv: string) => {
            const appsCollection = getAppInfoCollection(delEnv);
            const configCollection = getConfigCollection(delEnv);
            const bucketCollection = getBucketCollection(delEnv);

            appsCollection.deleteMany({ _id: { $in: appNeedsToBeDel } as any });
            configCollection.deleteMany({ appId: { $in: appIDStrings } as any });
            bucketCollection.deleteMany({ appId: { $in: appIDStrings } as any });
        });
    }

    return true;
}


export async function performConfigAdd(env: string, configs: ConfigItem[], skipValidation: boolean) : Promise<ConfigItem[]|null>{
    if(skipValidation === false) {
        await validateConfigListForAddOrUpdate(env, configs, true);
    }
    const collection = getConfigCollection(env);

    let addItems = configs.map((x: ConfigItem, i: number) => {
        const { _id, ...rest } = x;
        rest.lastUpdatedOn = new Date();
        return rest;
    });
    
    let inserted = await collection.insertMany(addItems)
    if (inserted && inserted.insertedIds) {
        let arr = [];
        for (const key in inserted.insertedIds) {
            const indexedItem = inserted.insertedIds[key];
            arr.push(indexedItem);
        }
        const addedConfigs = (await collection.find({ _id: { $in: arr } as any }).toArray()) as ConfigItem[];
        return addedConfigs;
    }

    return null;
}



export async function performConfigUpdate(env: string, configs: ConfigItem[], skipValidation: boolean) {
    if(skipValidation === false) {
        await validateConfigListForAddOrUpdate(env, configs, false);
    }
    const collection = getConfigCollection(env);
    
    const deleteList = new Array<mongo.ObjectId>();
    for (let i = 0; i < configs.length; i++) {
        let oid = new mongo.ObjectId(configs[i]._id);
        deleteList.push(oid);
        configs[i]._id = oid;
        configs[i].lastUpdatedOn = new Date();
    }
    
    let delRes = await collection.deleteMany({ _id: { $in: deleteList } as any })
    if (delRes && delRes.deletedCount > 0 && delRes.deletedCount === deleteList.length) {
        let inserted = await collection.insertMany(configs)
        if (inserted && inserted.insertedIds) {
            let arr = [];
            for (const key in inserted.insertedIds) {
                const indexedItem = inserted.insertedIds[key];
                arr.push(indexedItem);
            }
            const updatedConfigs = (await collection.find({ _id: { $in: arr } as any }).toArray()) as ConfigItem[];
            return updatedConfigs;
        }
    }

    return null;
}



export async function performBucketAdd(env: string, bucketList: Bucket[]) : Promise<Bucket[]|null>{
    let inputBucketNames = new Array<string>();
    let inputBucketIds = new Array<string | undefined>();

    bucketList.forEach(element => {
        inputBucketNames.push(element.name);
        inputBucketIds.push(element._id?.toString());
    })
    
    //check for appId
    let appIdsinBucketList = new Set<string>()
    bucketList.forEach(element => {
        if(element.ownerElementId && element.ownerElementId.length > 0){
            appIdsinBucketList.add(element.ownerElementId)
        }
        else {
            throw Error("Cannot add new bucket(s). Please ensure that appID for each bucket is valid");
        }
    });
    if(appIdsinBucketList.size === 0 || appIdsinBucketList.size > 1){
        throw Error("Bucket list error. Please ensure that appID for each bucket is valid and all buckets items for transaction are associated to same appInfo");
    }

    //check for duplicate bucket
    let checkRes = checkDuplicatesIgnoreCase(inputBucketNames);
    if (checkRes === false) {
        throw Error("Duplicate bucket names found.");
    }

    //check if buck names have special/unwanted characters
    if (containsSpecialChars(inputBucketNames)) {
        throw Error("One or more bucket names contain special characters that are not allowed.");
    }

    const bucketCollection = getBucketCollection(env);
    const appBucketFilter = getFilterForBucket(appIdsinBucketList.values().next().value as string, null);

    let existingAppBuckets = (await bucketCollection.find(appBucketFilter).toArray()) as Bucket[];
    let existingAppBucketsIds = existingAppBuckets.map((a, i) => a._id?.toString());
    let addedBuckets = bucketList.filter(x => !existingAppBucketsIds.includes(x._id?.toString()));
    if (addedBuckets && addedBuckets.length > 0) {
        const appBucketNames = existingAppBuckets.map((a, i) => a.name.trim().toUpperCase());
        let dupNamesBuckets = addedBuckets.filter(x => appBucketNames.includes(x.name.trim().toUpperCase()));
        if (dupNamesBuckets && dupNamesBuckets.length > 0) {
            throw Error("Cannot add new buckets. One or more specified bucket names already exist for app.");
        }
        let addItems = addedBuckets.map((x: Bucket, i: number) => {
            const { _id, ...rest } = x;
            rest.lastUpdatedOn = new Date();
            return rest;
        });
        let insertResults = await bucketCollection.insertMany(addItems);
        if (insertResults && insertResults.insertedIds) {
            let arr = [];
            for (const key in insertResults.insertedIds) {
                const indexedItem = insertResults.insertedIds[key];
                arr.push(indexedItem);
            }
            const freshBuckets = (await bucketCollection.find({ _id: { $in: arr } as any }).toArray()) as Bucket[];
            return freshBuckets; 
        }
    }

    return null
}


export async function performBucketDelete(env: string, bucketId: string, inDelEnv: string) : Promise<boolean>{
    let actualDelEnvironment: string[] = [];

    if (env.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase() && env.toLowerCase() !== "dev") {
        throw Error("Delete action can only be performed in development environment");
    }

    if ((inDelEnv.toLowerCase() === EnvTypeEnum.DEVELOPMENT.toLowerCase()) || (inDelEnv.toLowerCase() === "dev") || (inDelEnv.toLowerCase() === "all")) {
        if (inDelEnv.toLowerCase() === "all") {
            actualDelEnvironment = [EnvTypeEnum.DEVELOPMENT, EnvTypeEnum.PREVIEW, EnvTypeEnum.PRODUCTION];
        }
        else {
            const prevCollection = getBucketCollection(EnvTypeEnum.PREVIEW);
            const previewCheckBucket = (await prevCollection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
            if (previewCheckBucket && previewCheckBucket.length > 0) {
                throw new Error(`Cannot delete an app from ${EnvTypeEnum.DEVELOPMENT} environment because app also exists in ${EnvTypeEnum.PREVIEW}`);
            }

            const prodCollection = getBucketCollection(EnvTypeEnum.PRODUCTION);
            const prodCheckerBucket = (await prodCollection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
            if (prodCheckerBucket && prodCheckerBucket.length > 0) {
                throw new Error(`Cannot delete an app from ${EnvTypeEnum.DEVELOPMENT} environment because app also exists in ${EnvTypeEnum.PRODUCTION}`);
            }

            actualDelEnvironment.push(EnvTypeEnum.DEVELOPMENT);
        }
    }
    else if ((inDelEnv.toLowerCase() === EnvTypeEnum.PREVIEW.toLowerCase()) || (inDelEnv.toLowerCase() === "pre") || (inDelEnv.toLowerCase() === "all")) {
        actualDelEnvironment.push(EnvTypeEnum.PREVIEW);
    }
    else if ((inDelEnv.toLowerCase() === EnvTypeEnum.PRODUCTION.toLowerCase()) || (inDelEnv.toLowerCase() === "prod") || (inDelEnv.toLowerCase() === "all")) {
        actualDelEnvironment.push(EnvTypeEnum.PRODUCTION);
    }
    else {
        throw Error("The environment specified for deletion is invalid");
    }

    for (let i = 0; i < actualDelEnvironment.length; i++) {
        let env = actualDelEnvironment[i];
        const bucketCollection = getBucketCollection(env);
        const foundBucket = (await bucketCollection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
        
        if (foundBucket && foundBucket.length > 0) {
            let remBucketIds = foundBucket.map(x => x._id?.toString() ?? '__DUMMYVALUE__')
            const configCollection = getConfigCollection(env);
            let buckConfigs = await configCollection.find({ bucketId: { $in: remBucketIds } as any }).toArray();
            if (buckConfigs && buckConfigs.length > 0) {
                throw new Error(`Could not delete bucket [${foundBucket[0].name}] because it has ${buckConfigs.length} config items. Please delete/empty the contents first`);
            }
        }
    };

    for (let i = 0; i < actualDelEnvironment.length; i++) {
        let env = actualDelEnvironment[i];
        const bucketCollection = getBucketCollection(env);
        const foundBucket = (await bucketCollection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
        if (foundBucket && foundBucket.length > 0) {   
            const deleteList = foundBucket.map((x: Bucket) => new mongo.ObjectId(x._id));
            await bucketCollection.deleteMany({ _id: { $in: deleteList } as any });
        }
    };

    return true;
}


export async function performBucketExport(env: string, appId: string, bucketId: string, destinationEnv: string) : Promise<boolean> {
    if (destinationEnv === env) {
        throw new Error(`Source and destination environments cannot be the same. Configs cannot be exported to current location.`);
    }

    const srcAppsColl = getAppInfoCollection(env);
    const srcConfigColl = getConfigCollection(env);
    const srcBucketCollection = getBucketCollection(env);

    const destAppsColl = getAppInfoCollection(destinationEnv);
    const destConfigColl = getConfigCollection(destinationEnv);
    const destBucketCollection = getBucketCollection(destinationEnv);

    const filter = { appId: appId, bucketId: bucketId };

    const srcConfigs = (await srcConfigColl.find(filter).toArray()) as ConfigItem[];

    if (srcConfigs && srcConfigs.length > 0) {
        const [srcBucket] = (await srcBucketCollection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];
        if (srcBucket && srcBucket.ownerElementId) {
            if (srcBucket.ownerElementId !== appId) {
                throw new Error(`Could not export configs from '${env}' to '${destinationEnv}'. Specified bucket is not associated to specified app`);
            }
        }
        else {
            throw new Error(`Could not export configs from '${env}' to '${destinationEnv}'. Bucket-Id is invalid`);
        }

        const destConfigs = (await destConfigColl.find(filter).toArray()) as ConfigItem[];
        if (destConfigs && destConfigs.length > 0) {
            const deleteList = destConfigs.map((x: ConfigItem) => new mongo.ObjectId(x._id));
            await destConfigColl.deleteMany({ _id: { $in: deleteList } as any });
        }

        let inserted = await destConfigColl.insertMany(srcConfigs)
        if (inserted && inserted.insertedIds) {
            const [srcApp] = (await srcAppsColl.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
            await destAppsColl.replaceOne({ _id: new mongo.ObjectId(srcApp._id) } as any, srcApp, { upsert: true });

            await destBucketCollection.replaceOne({ _id: new mongo.ObjectId(srcBucket._id) } as any, srcBucket, { upsert: true });
            return true;
        }
    }
    else {
        throw new Error(`Could not export configs from '${env}' to '${destinationEnv}'. No valid set of configs were retrieved for export`);
    }

    return false;
}



export async function processCSVContent(buffer: Buffer, bucket: Bucket): Promise<ConfigItem[]> {
    let confList : ConfigItem[] = []
    
    const workbook = new exceljs.Workbook();
    let wb = await workbook.xlsx.load(buffer);
    if(wb) {
        workbook.eachSheet(function(worksheet, sheetId) {
            worksheet.eachRow(function(row, rowNumber) {
                //console.log('Row ' + rowNumber + ' = ' + JSON.stringify(row.values));
                
                if(rowNumber !== 1) {  //first row is HEADER -- skip it
                    let rowValues : exceljs.CellValue[] = (row.values as exceljs.CellValue[])
                    if(rowValues && rowValues.length < 5) {
                        throw new Error(`Could not process config upload file for bucket [${bucket.name}]. File was either invalid or not formatted as expected`);
                    }
            
                    let cType = row.getCell(5).toString().trim();
            
                    if(cType.toLowerCase() == ConfigContentTypeEnum.NUMBER.toString().toLowerCase()){
                        cType = ConfigContentTypeEnum.NUMBER
                    }
                    else if(cType.toLowerCase() == ConfigContentTypeEnum.BOOLEAN.toString().toLowerCase()){
                        cType = ConfigContentTypeEnum.BOOLEAN
                    }
                    else if(cType.toLowerCase() == ConfigContentTypeEnum.JSON.toString().toLowerCase()){
                        cType = ConfigContentTypeEnum.JSON
                    }
                    else if(cType.toLowerCase() == ConfigContentTypeEnum.STRING.toString().toLowerCase()){
                        cType = ConfigContentTypeEnum.STRING
                    }
                    else if(cType.toLowerCase() == ConfigContentTypeEnum.XML.toString().toLowerCase()){
                        cType = ConfigContentTypeEnum.XML
                    }
                    else{
                        throw new Error(`Could not process uploaded file for bucket [${bucket.name}]. File is not formatted as expected. unrecognized value-type specified`);
                    }
            
                    let cname = (row.getCell(2)?.value as string)?.trim() ?? ''
                    let cval = row.getCell(3)?.value
                    let cdesc = (row.getCell(4)?.value as string)?.trim() ?? ''

                    let conf : ConfigItem = {
                        _id: '',
                        createdOn: new Date(),
                        createdBy: "",
                        contextProperties: [],
                        ownerElementId: bucket.ownerElementId,
                        bucketId: bucket._id?.toString() as string,
                        name: cname,
                        value: (cval && cType === ConfigContentTypeEnum.STRING) ? (cval as string).trim() : cval,
                        description: cdesc,
                        contentType: cType as ConfigContentTypeEnum,
                        lastUpdatedOn: new Date(),
                        associatedProperties: [],
                    }
            
                    confList.push(conf);
                }
            }); 
        });
    }

    confList = formatConfigValueAndBucketName(confList, bucket, true)
    return confList
}

