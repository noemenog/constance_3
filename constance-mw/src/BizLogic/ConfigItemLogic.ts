import { Filter } from "mongodb";
import { ConfigContentTypeEnum, DBCollectionTypeEnum, EnvTypeEnum } from "../Models/Constants";
import { AppInfo, Bucket, ConfigItem } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { checkDuplicatesIgnoreCase, containsSpecialChars } from "./UtilFunctions";
import { User } from "../Models/HelperModels";
import { HeadlessMonacoValidator, ValidationEntry, ValidationResults } from "./HeadlessMonacoValidator";
import { get } from "http";





function formatConfigValueAndBucketName(configs: ConfigItem[], strUploadScenario : boolean = false) : ConfigItem[]{
    for (let i = 0; i < configs.length; i++) {
        let val = configs[i].value;
        if (configs[i].contentType === ConfigContentTypeEnum.BOOLEAN) {
            configs[i].value = val.toString().toLowerCase() == "true" ? true : false;
        }
        else if (configs[i].contentType === ConfigContentTypeEnum.NUMBER) {
            configs[i].value = Number(val);
        }
        else if (configs[i].contentType === ConfigContentTypeEnum.JSON) {
            if(strUploadScenario){
                configs[i].value = JSON.parse(val) ;
            }
            else {
                configs[i].value = JSON.parse(JSON.stringify(val)) ;
            }
        }
        else if (configs[i].contentType === ConfigContentTypeEnum.STRING) {
            configs[i].value = String(val);
        }
    }

    return configs
}


async function validateConfigListForAddOrUpdate(env: string, inputConfigs: ConfigItem[], isAdd :boolean) {
    let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
    let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env)
    let configRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
    let oper = isAdd ? "add" : "update";
    
    let appIdSet = new Set(inputConfigs.map(a => a.ownerElementId));
    if(appIdSet.size !== 1){
        throw new Error(`Cannot ${oper} batch of config items from different apps. This feature is not supported`);
    }
    
    let bucketIdSet = new Set(inputConfigs.map(a => a.bucketId));
    if(bucketIdSet.size !== 1){
        throw new Error(`Cannot ${oper} batch of config items from different buckets. This feature is not supported`);
    }

    const [appId] = appIdSet; //get first item in set
    const [bucketId] = bucketIdSet;  //get first item in set

    let appInfo = await appRepo.GetWithId(appId)
    if(!appInfo) {
        throw new Error(`Cannot ${oper} config items. App specified for config items(s) was not found.`);
    }
    let bucket = await buckRepo.GetWithId(bucketId)
    if(!bucket) {
        throw new Error(`Cannot ${oper} config items. Bucket specified for config items(s) was not found.`);
    }


    for(let i = 0; i < inputConfigs.length; i++) {
        let confItem = inputConfigs[i]

        // Ensure the necessary properties are filled in the config item
        if(!confItem.ownerElementId || !confItem.name || !confItem.bucketId){
            throw new Error(`Cannot ${oper} one or more config items. All required fields must have valid values.`);
        }

        // Check if app name has special/unwanted characters
        if(containsSpecialChars([confItem.name])){
            throw Error("ConfigItem name contains special characters that are not allowed.");
        }

        // Ensure config app is as expected
        if(confItem.ownerElementId !== appId){
            throw Error("ConfigItem's ownerElementId is not as expected.");
        }

        // Ensure config bucket is as expected
        if(confItem.bucketId !== bucketId){
            throw Error("ConfigItem's bucketId is not what is expected.");
        }

        // Ensure bucket has same appId as the config item
        if(bucket.ownerElementId !== appId){
            throw Error("AppId for configItem is not same as the appId for the configItem's assigned bucket.");
        }
    };

    let confFilter = { bucketId : bucketId } as Filter<ConfigItem>
    let relevConfigs = await configRepo.GetAllByOwnerElementId(appId, confFilter) ?? [];
    if(isAdd) {
        let existingNames = relevConfigs.map((x: ConfigItem) => x.name)
        let newNames = inputConfigs.map((x: ConfigItem) => x.name)
        let combinedNames = [...existingNames, ...newNames]
        let checkRes = checkDuplicatesIgnoreCase(combinedNames);
        if(checkRes === false) {
            throw Error("Cannot set configs for app because the process would result in duplicate config names.");
        }
    }
    else {
        let incomingConfigIds = inputConfigs?.map((a, i) => a._id?.toString()) ?? [];
        let uniqueExisting = relevConfigs.filter(x => (incomingConfigIds.includes(x._id?.toString()) === false))
        let newNames = inputConfigs.map((x: ConfigItem) => x.name)
        let existingNames = uniqueExisting.map((x: ConfigItem) => x.name)
        let combinedNames = [...existingNames, ...newNames]
        let checkRes = checkDuplicatesIgnoreCase(combinedNames);
        if(checkRes === false) {
            throw Error("Cannot set configs for app because the process would result in duplicate config names.");
        }
    }
    
    // Ensure that ConfigValue is actually the specified ConfigType.
    validateConfigContent(inputConfigs);
}



export async function performConfigRetrieval(env: EnvTypeEnum, appId: string, bucketId: string, queryConfigItemNames: string[]) : Promise<ConfigItem[]> {
    let appRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, env)
    let configRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
    
    let filter = { enabled : true } as Filter<AppInfo>
    let projection = { associatedProperties: 0 }
    let appInfo = (await appRepo.GetByFilterAndProjection(filter, projection))?.at(0) as AppInfo
    
    if(appInfo) {
        let confFilter = (queryConfigItemNames && queryConfigItemNames.length > 0) 
            ? { bucketId : bucketId, name: { $in: queryConfigItemNames.map(name => new RegExp(`^${name}$`, "i")) } } as Filter<ConfigItem>
            : { bucketId : bucketId  } as Filter<ConfigItem>
        
        let configItem = await configRepo.GetAllByOwnerElementId(appId, confFilter) ?? [];
        configItem = formatConfigValueAndBucketName(configItem, false);

        return configItem;
    }
    else {
        throw new Error(`Could not find a valid app info for the given appId '${appId}'`);
    }
}



export async function performConfigAdd(env: EnvTypeEnum, configs: ConfigItem[], skipValidation: boolean, user: User|null) : Promise<ConfigItem[]|null>{
    let configRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
    
    if(skipValidation === false) {
        await validateConfigListForAddOrUpdate(env, configs, true);
    }
    
    let confsToAdd = configs.map((x: ConfigItem, i: number) => {
        const { _id, ...rest } = x; //Important!!
        rest.lastUpdatedOn = new Date();
        return rest;
    });
    
    let inserted = await configRepo.CreateMany(confsToAdd)
    if (!inserted || inserted.length === 0) {
        throw new Error(`Could not add new config items because the database operation did not succeed`);
    }

    let confFilter = { bucketId : configs[0].bucketId } as Filter<ConfigItem>
    let bucketConfigs = await configRepo.GetAllByOwnerElementId(configs[0].ownerElementId, confFilter)

    return bucketConfigs;
}



export async function performConfigUpdate(env: string, configs: ConfigItem[], skipValidation: boolean, user: User|null) : Promise<ConfigItem[]|null>{
    let configRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
    
    if(skipValidation === false) {
        await validateConfigListForAddOrUpdate(env, configs, false);
    }

    for(let i = 0; i < configs.length; i++) {
        configs[i].lastUpdatedOn = new Date();
    }

    let res = await configRepo.ReplaceMany(configs);
    if (res === false) {
        throw new Error(`Could not update config items because the database operation did not succeed`);
    }

    let confFilter = { bucketId : configs[0].bucketId } as Filter<ConfigItem>
    let bucketConfigs = await configRepo.GetAllByOwnerElementId(configs[0].ownerElementId, confFilter)

    return bucketConfigs;
}
    



export async function performConfigDelete(env: EnvTypeEnum, configs: ConfigItem[]) : Promise<boolean>{
    let configRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, env)
    if(configs && configs.length > 0) {
        let idList = configs?.map(a => a._id?.toString() as string) ?? [];
        let res = await configRepo.DeleteMany(idList);
        return res;
    }

    return false
}
    



// Validate all code snippets
async function validateConfigContent(configs: ConfigItem[]) {
    if(configs && configs.length > 0) { 
        let codeMap = new Map<string, ValidationEntry>();

        for(let k = 0; k < configs.length; k++) {
            if (configs[k].contentType === ConfigContentTypeEnum.BOOLEAN) {
                if (configs[k].value.toString().toLowerCase() === "true" || configs[k].value.toString().toLowerCase() === "false") {
                    return true;
                } 
                else {
                    return false;
                }
            } 
            else if (configs[k].contentType === ConfigContentTypeEnum.NUMBER) {
                let res = /^-?\d+$/.test(configs[k].value.toString());
                return res
            } 
            else if (configs[k].contentType === ConfigContentTypeEnum.STRING) {
                if ((typeof configs[k].value === "string") && (configs[k].value.length > 0)){
                    return true;
                } 
                else {
                    return false;
                }
            } 
            else {
                let vEntry = { code: configs[k].value ?? '', language: getLanguageForContentType(configs[k].contentType) } as ValidationEntry;
                codeMap.set(configs[k]._id?.toString() as string, vEntry);
            }
        }
        
        if(codeMap.size > 0) {
            const validator = new HeadlessMonacoValidator();
            await validator.initialize();
            const results = await validator.validateCodeMap(codeMap);

            if(results) {
                for (const [key, result] of results.entries()) {

                    console.log(key, result)
                }
            }
            validator.dispose();
        }

        
        
        // // Process results
        // for (const [key, result] of results.entries()) {
        //     console.log(`\n=== ${key} ===`);
        //     console.log(`Valid: ${result.isValid}`);
            
        //     if (result.errors.length > 0) {
        //         console.log('Errors:');
        //         result.errors.forEach(error => {
        //             console.log(`  Line ${error.line}:${error.column} - ${error.message}`);
        //         });
        //     }
            
        //     if (result.warnings.length > 0) {
        //         console.log('Warnings:');
        //         result.warnings.forEach(warning => {
        //             console.log(`  Line ${warning.line}:${warning.column} - ${warning.message}`);
        //         });
        //     }
        // }


        // Clean up
        
    }
}





function getLanguageForContentType(contentType: ConfigContentTypeEnum): string {
    switch (contentType) {
        case ConfigContentTypeEnum.BASH_SHELL:
            return "shell";
        case ConfigContentTypeEnum.JSON:
            return "json";
        case ConfigContentTypeEnum.POWERSHELL:
            return "powershell";
        case ConfigContentTypeEnum.PYTHON:
            return "python";
        case ConfigContentTypeEnum.XML:
            return "xml";
        case ConfigContentTypeEnum.YAML:
            return "yaml";
        case ConfigContentTypeEnum.HTML:
            return "html";
        case ConfigContentTypeEnum.CSS:
            return "css";
        case ConfigContentTypeEnum.DOCKERFILE:
            return "dockerfile";
        case ConfigContentTypeEnum.VBSCRIPT:
            return "vbscript";
        case ConfigContentTypeEnum.SQL:
            return "sql";
        default:
            return "plaintext";
    }
}













        // let valueTypeValResult = validateConfigValueAndType(confItem.value, confItem.contentType)
        // if(valueTypeValResult === false){
        //     throw new Error(`The value for ConfigItem '${confItem.name}' is not actually of the type ${confItem.contentType}'`);
        // }










            // const collection = getConfigCollection(req.params.env);
            // let incomingConfIdArr: (string | mongo.ObjectId )[] = [];
            // let incomingConfigNameArr: string[] = [];
            
            // for (const item in configs) {
            //     const cid = configs[item]?._id ?? ""
            //     const cName = configs[item]?.name ?? ""
                
            //     if(cid && cid.toString().length > 0) {
            //         incomingConfIdArr.push(new mongo.ObjectId(cid));
            //     }
            //     else if (cName && cName.toString().length > 0) {
            //         incomingConfigNameArr.push(cName);
            //     }
            //     else {
            //         throw new Error("Cannot update config item(s). All input configs items must have valid IDs")
            //     }
            // }
            
            // let expression = { $or: [ {_id: { $in: incomingConfIdArr } as any }, {configName: { $in: incomingConfigNameArr } as any } ]};
            // const foundConfs = (await collection.find(expression).toArray()) as ConfigItem[];

            // let foundIdStrs = foundConfs?.map((a, i) => a._id?.toString()) ?? [];
            // let foundNames = foundConfs?.map((a, i) => a.name?.toString()) ?? [];
            
            // let nonExistent = [];

            // if(foundConfs && foundConfs.length > 0) {
                
            //     let incomingConfIdStrArr : string[] = incomingConfIdArr.map((a, i) => a.toString())
            //     for(let x = 0; x < incomingConfIdStrArr.length; x++) {
            //         if(foundIdStrs.includes(incomingConfIdStrArr[x]) == false) {
            //             nonExistent.push(foundConfs[x])  
            //         }
            //     }
                
            //     for(let y = 0; y < incomingConfigNameArr.length; y++) {
            //         if(foundNames.includes(incomingConfigNameArr[y]) == false) {
            //             nonExistent.push(foundConfs[y])  
            //         }
            //     }

            //     if (configs.length !== foundConfs.length) {
            //         throw new Error("Cannot perform update. Input config(s) were not found in the system")
            //     }
            //     else if (nonExistent.length > 0) {
            //         throw new Error("Cannot perform update. Input config(s) were not found in the system")
            //     }
            //     else {
            //         for(let x = 0; x < configs.length; x++) {
            //             if(!configs[x]._id){
            //                 let foundFltr = foundConfs.filter(a => a.name === configs[x].name)
            //                 if(foundFltr && foundFltr.length > 0){
            //                     configs[x]._id = foundFltr[0]._id;
            //                 }
            //             }
            //         }

            //         let updatedConfigs = await performConfigUpdate(req.params.env, configs, false);
            //         res.status(200).send({ payload: updatedConfigs } as ResponseData);
            //     }
            // }
            // else {
            //     throw new Error("Cannot update config item(s). All input configs items must already exist")
            // }


