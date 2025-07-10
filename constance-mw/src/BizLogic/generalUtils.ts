import * as mongo from "mongodb";
import { getAppInfoCollection, getBucketCollection, getConfigCollection } from "../dbConn";
import { AppInfo, Bucket, ConfigItem } from "../Models/ServiceModels";
import { ConfigContentTypeEnum } from "../Models/Constants";



export function getFilterForApp(app: string, enabledOnly: boolean, isAppId: boolean = false){
    if(enabledOnly){
        let enableOnlyExpr = {}
        if(isAppId) {
            enableOnlyExpr = { 
                _id: new mongo.ObjectId(app),
                enabled : true 
            };
        }
        else {
            enableOnlyExpr = { 
                appName : new RegExp('^' + app + '$', 'i'), 
                enabled : true 
            };
        }
        return enableOnlyExpr;
    }
    else {
        let expr = {}
        if(isAppId) {
            expr = { _id: new mongo.ObjectId(app) };
        }
        else {
            expr = { appName : new RegExp('^' + app + '$', 'i') };
        }
        return expr;
    }
}


export function getFilterForBucket(appId: string, bucketId: string|null|undefined) {
    if(appId && appId.length > 0) {
        if(bucketId && bucketId.length > 0){
            let expr1 = { 
                appId: new RegExp('^' + appId + '$', 'i'), 
                bucketId: new RegExp('^' + bucketId + '$', 'i')
            };
            return expr1;
        }
        else{
            let expr3 = { 
                appId: new RegExp('^' + appId + '$', 'i')
            };
            return expr3;
        }
    }
    else{
        throw new Error(`Input appId cannot be null or empty`);
    }
}


export function containsSpecialChars(inputStrings: string[]) {
    for(let i = 0; i < inputStrings.length; i++){
        const charsExpression = /[`!@#$%^&*()+=\[\]{};':"\\|,<>\/?~]/;
        let val = charsExpression.test(inputStrings[i]);
        if (val === true) { return true; }
    }
    return false;
}


export async function validateConfigListForAddOrUpdate(env: string, inputConfigs: ConfigItem[], isAdd :boolean) {
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

    const appsCollection = getAppInfoCollection(env);
    const confCollection = getConfigCollection(env);
    const bucketCollection = getBucketCollection(env);
    
    let appItems : AppInfo[] = (await appsCollection.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
    let bucks : Bucket[] = (await bucketCollection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];

    if (appItems && appItems.length > 0) {
        if(bucks && bucks.length > 0) {
            for(let i = 0; i < inputConfigs.length; i++) {
                let confItem = inputConfigs[i]

                // Ensure the necessary properties are filled in the config item
                if(!confItem.ownerElementId || !confItem.name || !confItem.bucketId || !confItem.lastUpdatedOn){
                    throw new Error(`Cannot ${oper} one or more config items. All required fields must have valid values.`);
                }
        
                // Check if app name has special/unwanted characters
                if(containsSpecialChars([confItem.name])){
                    throw Error("ConfigItem name contains special characters that are not allowed.");
                }
        
                // Ensure that ConfigValue is actually the specified ConfigType.
                let valueTypeValResult = validateConfigValueAndType(confItem.value, confItem.contentType)
                if(valueTypeValResult === false){
                    throw new Error(`The value for ConfigItem '${confItem.name}' is not actually of the type ${confItem.contentType}'`);
                }
        
                // Ensure config app is as expected
                if(confItem.ownerElementId !== appItems[0]._id?.toString()){
                    throw Error("ConfigItem's appId is not what is expected.");
                }

                // Ensure config bucket is as expected
                if(confItem.bucketId !== bucks[0]._id?.toString()){
                    throw Error("ConfigItem's bucketId is not what is expected.");
                }

                // Ensure bucket has same appId as the config item
                if(bucks[0].ownerElementId !== appItems[0]._id?.toString()){
                    throw Error("AppId for configItem is not same as the appId for the configItem's assigned bucket.");
                }
            };

            // Ensure no duplicate configItem name
            let buckFilter = getFilterForBucket(appId, bucketId)
            let existingConfigs = (await confCollection.find(buckFilter).toArray() as ConfigItem[]);
            if(isAdd) {
                let existingNames = existingConfigs.map((x: ConfigItem) => x.name)
                let newNames = inputConfigs.map((x: ConfigItem) => x.name)
                let combinedNames = [...existingNames, ...newNames]
                let checkRes = checkDuplicatesIgnoreCase(combinedNames);
                if(checkRes === false) {
                    throw Error("Cannot set configs for app because the process would result in duplicate config names.");
                }
            }
            else {
                let incomingConfigIds = inputConfigs?.map((a, i) => a._id?.toString()) ?? [];
                let uniqueExisting = existingConfigs.filter(x => (incomingConfigIds.includes(x._id?.toString()) === false))
                let newNames = inputConfigs.map((x: ConfigItem) => x.name)
                let existingNames = uniqueExisting.map((x: ConfigItem) => x.name)
                let combinedNames = [...existingNames, ...newNames]
                let checkRes = checkDuplicatesIgnoreCase(combinedNames);
                if(checkRes === false) {
                    throw Error("Cannot set configs for app because the process would result in duplicate config names.");
                }
            }
        }
        else{
            throw new Error(`Cannot ${oper} config items. Bucket for config items(s) was not found.`);
        }
    }
    else {
        throw new Error(`Cannot ${oper} config items. App specified for config items(s) was not found.`);
    }

}


export function validateConfigValueAndType(value: any, valueType: ConfigContentTypeEnum) : boolean {
    if (ConfigContentTypeEnum.JSON === valueType.toUpperCase()) {
        try {
            if(typeof value == "string") {
                return (value && value.length > 0 && JSON.parse(value)) ? true : false
            }
            else if(typeof value == "object") {
                return (value && JSON.parse(JSON.stringify(value))) ? true : false
            }
            else {
                throw new Error();
            }
        } 
        catch (e) {
            return false;
        }
    } 
    else if (ConfigContentTypeEnum.BOOLEAN === valueType.toUpperCase()) {
        if (value.toString().toLowerCase() === "true" || value.toString().toLowerCase() === "false") {
            return true;
        } 
        else {
            return false;
        }
    } 
    else if (ConfigContentTypeEnum.NUMBER === valueType.toUpperCase()) {
        return /^-?\d+$/.test(value.toString());
    } 
    else if (ConfigContentTypeEnum.STRING === valueType.toUpperCase()) {
        if ((typeof value === "string") && (value.length > 0)){
            return true;
        } 
        else {
            return false;
        }
    } 
    else if (ConfigContentTypeEnum.XML === valueType.toUpperCase()) {
        try {
            //libxml.parseXml(value);
            return true;
        } 
        catch (e) {
            return false;
        }
    } 
    else {
        return false;
    }
}


export function formatConfigValueAndBucketName(configs: ConfigItem[], bucket: Bucket, strUploadScenario : boolean = false) : ConfigItem[]{
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

        // configs[i].bucketName = bucket.name;
    }

    return configs
}


export function checkDuplicatesIgnoreCase(values: string[]): boolean {
    if(values && values.length > 0) {
        const lowercaseNames = values.map(word => word.toLowerCase()) ?? [];
        let dist = new Set(lowercaseNames).size;
        if (dist !== values.length) {
            return false;
        }
    }
    return true;
}

