import { Filter, ObjectId } from "mongodb";
import { DBCollectionTypeEnum, ENVIRONMENTLIST, EnvTypeEnum, NamingContentTypeEnum } from "../Models/Constants";
import { AppInfo, Bucket, ConfigChangeHistory, ConfigChangeInstance, ConfigItem } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { User } from "../Models/HelperModels";
import { randomUUID } from "crypto";
import { checkDuplicatesIgnoreCase, getEnumValuesAsArray, verifyNaming } from "./UtilFunctions";
import { GetEnvironmentType } from "./BasicCommonLogic";




export async function performBucketAdd(bucketList: Bucket[]) : Promise<Bucket[]|null>{
    //IMPORTANT! - Intentionally hardcoding dev env because bucket should only ever be added to dev. User can choose to export afterwards!!
    let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, EnvTypeEnum.DEVELOPMENT)
    let addedBuckets = new Array<Bucket>();

    if(bucketList && bucketList.length > 0) {
        let toAdd = new Array<Bucket>();
        for(let k = 0; k < bucketList.length; k++) {
            let bucket = bucketList[k];

            //check required fields
            if(!bucket.name || bucket.name.trim().length < 2 || bucket.name.toLowerCase().trim() === "undefined"){
                throw new Error(`Please use at least two characters for bucket name`)
            }
            if(!bucket.ownerElementId || !bucket.ownerElementId || !bucket.ownerElementId){
                throw new Error(`New bucket must have valid app Id`)
            }
            //check format of bucket name
            verifyNaming([bucket.name], NamingContentTypeEnum.BUCKET)

            //NOTE: check if appName already exists. If a app exists in the system and is set to "disabled", it still count in name checking - no duplicates!
            let filter = {ownerElementId: bucket.ownerElementId, name : new RegExp('^' + bucket.name + '$', 'i')}
            const exisBucks: Bucket[] = (await buckRepo.GetWithFilter(filter)) as Bucket[];
            if (exisBucks && exisBucks.length > 0) {
                throw new Error(`Cannot add new Bucket '${bucket.name}'. A bucket with the same name already exists in the system`);
            }

            //check duplicate assoc prop names
            let propNames = bucket.associatedProperties.map(a => a.name)
            let dupNamesRes = checkDuplicatesIgnoreCase(propNames);
            if (dupNamesRes === false) {
                throw new Error(`Duplicate property names are not allowed for new bucket. `)
            }

            //check duplicate assoc prop display names
            let propDisplayNames = bucket.associatedProperties.map(a => a.displayName)
            let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
            if (dupDispNameRes === false) {
                throw new Error(`Duplicate property display names are not allowed for new bucket. `)
            }

            //ensure all properties have a uuid
            for(let i = 0; i < bucket.associatedProperties.length; i++){
                if(bucket.associatedProperties[i].id && bucket.associatedProperties[i].id.trim().length === 0) {
                    bucket.associatedProperties[i].id = crypto.randomUUID()
                }
            }

            if(bucket.associatedProperties && bucket.associatedProperties.length > 0) {
                bucket.associatedProperties = bucket.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
            }

            bucket.createdOn = new Date();
            bucket.lastUpdatedOn = new Date();
            bucket.name = bucket.name.trim().toUpperCase();
            bucket.contextProperties = [];
            delete bucket['_id'];

            toAdd.push(bucket);
        }

        if(toAdd.length > 0) {
            addedBuckets = await buckRepo.CreateMany(toAdd);
            if(!addedBuckets || (addedBuckets.length !== toAdd.length)) {
                if(addedBuckets.length > 0) {
                    let addedIds = addedBuckets.map(a => a._id?.toString() as string) ?? [];
                    for(let id of addedIds) {
                        performBucketDelete(EnvTypeEnum.DEVELOPMENT, id, "ALL")
                    }
                }
                throw new Error(`An unspecified error occured while creating new bucket`)
            }
        }
    }

    return addedBuckets ?? null
}




export async function performBucketUpdate(bucket: Bucket) : Promise<Bucket|null>{
    let allValidEnvironments = getEnumValuesAsArray(EnvTypeEnum);
    let devBuckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, EnvTypeEnum.DEVELOPMENT)

    //check required fields
    if(!bucket._id || bucket._id.toString().trim().length === 0 || bucket._id.toString().trim().toLowerCase() === "undefined"){
        throw new Error(`Input bucket is invalid. Bucket update cannot proceed`)
    }
    if(!bucket.name || bucket.name.trim().length < 2 || bucket.name.toLowerCase().trim() === "undefined"){
        throw new Error(`Please use at least two characters for bucket name`)
    }

    //check format of project name
    verifyNaming([bucket.name], NamingContentTypeEnum.BUCKET)

    //NOTE: check if appName already exists. If a app exists in the system and is set to "disabled", it still count in name checking - no duplicates!
    let filter = {name : new RegExp('^' + bucket.name + '$', 'i')}
    const exisBucks: Bucket[] = (await devBuckRepo.GetWithFilter(filter)) as Bucket[];
    if (exisBucks && exisBucks.length > 0 && exisBucks.some(s => s._id?.toString() !== bucket._id?.toString())) {
        throw new Error(`Cannot update bucket '${bucket.name}'. A bucket with the same name already exists in the system`);
    }

    //check duplicate assoc prop names
    let propNames = bucket.associatedProperties.map(a => a.name)
    let dupNamesRes = checkDuplicatesIgnoreCase(propNames);
    if (dupNamesRes === false) {
        throw new Error(`Duplicate property names are not allowed for new App. `)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = bucket.associatedProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property display names are not allowed for new app. `)
    }

    //ensure all properties have a uuid
    for(let i = 0; i < bucket.associatedProperties.length; i++){
        if(bucket.associatedProperties[i].id && bucket.associatedProperties[i].id.trim().length === 0) {
            bucket.associatedProperties[i].id = crypto.randomUUID()
        }
    }

    if(bucket.associatedProperties && bucket.associatedProperties.length > 0) {
        bucket.associatedProperties = bucket.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
    }

    bucket.lastUpdatedOn = new Date();
    bucket.name = bucket.name.trim().toUpperCase();
    bucket.description = bucket.description.trim().toUpperCase() || '';
    bucket.contextProperties = [];

    for (let i = 0; i < allValidEnvironments.length; i++) {
        let env = allValidEnvironments[i] as EnvTypeEnum;
        let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env)
        
        let existingBucket = await buckRepo.GetWithId(bucket._id.toString())
        if(existingBucket) {
            let res = await buckRepo.ReplaceOne(bucket);
            if(res === false){
                throw new Error(`An unspecified error occured while updating bucket`)
            }
        }
    }
    
    let updatedBucket = await devBuckRepo.GetWithId(bucket._id.toString()) //note this is from dev space
    return updatedBucket ?? null
}



export async function performBucketDelete(currEnv: string, bucketId: string, delEnv: string) : Promise<EnvTypeEnum[]>{
    if(delEnv) {
        if(delEnv.toLowerCase() === EnvTypeEnum.DEVELOPMENT.toLowerCase() || delEnv.toLowerCase() === "dev") {
            throw new Error(`Invalid environment specified. To delete from '${EnvTypeEnum.DEVELOPMENT}', `
                + `Please specify 'ALL'. Exclusively deleting from 'dev' environment is not allowed.`)
        }
    
        let delEnvList : Array<string|EnvTypeEnum> = (delEnv.toUpperCase().trim() === "ALL") 
            ? getEnumValuesAsArray(EnvTypeEnum) 
            : [GetEnvironmentType(delEnv)];

        for (let i = 0; i < delEnvList.length; i++) {
            let focusDelEnv = delEnvList[i] as EnvTypeEnum;
            let bucketRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, focusDelEnv)
            
            let bucket = await bucketRepo.GetWithId(bucketId)
            if(bucket) {
                let res = await bucketRepo.DeleteMany([bucketId]);
                if(res === false){
                    throw new Error(`An unspecified error occured while deleting bucket`)
                }

                let confRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, focusDelEnv)
                let confFilter = { bucketId : bucket._id?.toString() as string } as Filter<ConfigItem>;
                let relevConfigs = await confRepo.GetAllByOwnerElementId(bucket.ownerElementId, confFilter);
                if(relevConfigs && relevConfigs.length > 0) {
                    await confRepo.DeleteManyByOwnerElementId(bucket.ownerElementId, [confFilter], true)
                }

                //Important! - ON BUCKET DELETION - MAKE SURE TO DELETE ALL HISTORY items pertaining to the bucket
                let histRepo = new ServiceModelRepository<ConfigChangeHistory>(DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION, focusDelEnv)
                let histFilter = { bucketId : bucket._id?.toString() as string } as Filter<ConfigChangeHistory>;
                let relevHistItems = await histRepo.GetAllByOwnerElementId(bucket.ownerElementId, histFilter);
                if(relevHistItems && relevHistItems.length > 0) {
                    await histRepo.DeleteManyByOwnerElementId(bucket.ownerElementId, [histFilter], true)
                }
            }
        }
    }

    let environList = await getAllEnvironmentsForBucket(bucketId);
    return environList
}




export async function exportBucket(srcEnv: EnvTypeEnum|string, bucket: Bucket, destEnv: EnvTypeEnum|string, user: User) {
    if (srcEnv.toString().toLowerCase().trim() === destEnv.toString().toLowerCase().trim()) {
        throw new Error(`Source and destination environments cannot be the same. Configs cannot be exported.`);
    }

    if(bucket && bucket.ownerElementId) {
        try {
            let appId = bucket.ownerElementId;
            let buckId = bucket._id?.toString() as string;
            //handle app instance
            let srcAppRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, srcEnv)
            let app = await srcAppRepo.GetWithId(appId)
            if(app) {
                app._id = new ObjectId(appId)
                app.enabled = true;
                let destAppRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION, destEnv)
                await destAppRepo.ReplaceManyOrInsert(appId, [app]);
            }

            //handle bucket instance
            let srcBuckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, srcEnv)
            let srcBucket = await srcBuckRepo.GetWithId(buckId)
            if(srcBucket) {
                srcBucket._id = new ObjectId(buckId)
                let destBucketRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, destEnv)
                await destBucketRepo.ReplaceManyOrInsert(appId, [srcBucket]);
            }

            //handle config items copyover
            let srcConfRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, srcEnv)
            let filter = { bucketId : buckId } as Filter<ConfigItem>
            let srcConfigItems = await srcConfRepo.GetAllByOwnerElementId(appId, filter)

            if(srcConfigItems && srcConfigItems.length > 0) {
                let srcConfIdList = srcConfigItems.map((x: ConfigItem) => (x._id?.toString() as string));

                //set destination configs
                let destConfRepo = new ServiceModelRepository<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION, destEnv)
                await destConfRepo.DeleteManyByOwnerElementId(appId, [filter], true);
                await destConfRepo.ReplaceManyOrInsert(appId, srcConfigItems);

                //reinitialize destination config history
                let destHistoryRepo = new ServiceModelRepository<ConfigChangeHistory>(DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION, destEnv)
                let destInfilter = { bucketId : buckId, configItemId: { $in: srcConfIdList } as any } as Filter<ConfigChangeHistory>;
                await destHistoryRepo.DeleteManyByOwnerElementId(appId, [destInfilter], true);

                let changeInstanceArray = new Array<ConfigChangeHistory>();
                for(let k = 0; k < srcConfigItems.length; k++) {
                    let chInstance : ConfigChangeInstance = {
                        index: 0,
                        contentType: srcConfigItems[k].contentType,
                        value: srcConfigItems[k].value,
                        timeStamp: new Date(),
                        user: user.email,
                        tags: [],
                    }
                    let confChangeHistory : ConfigChangeHistory = {
                        configItemId: srcConfigItems[k]._id?.toString() as string,
                        bucketId: buckId,
                        changes: [chInstance],
                        ownerElementId: appId,
                        contextProperties: [],
                        lastUpdatedOn: new Date()
                    }
                    changeInstanceArray.push(confChangeHistory);
                }

                if(changeInstanceArray && changeInstanceArray.length > 0) {
                    await destHistoryRepo.ReplaceManyOrInsert(appId, changeInstanceArray);
                }
            }
        }
        catch(error: any) {
            throw new Error(`Error occured while exporting bucket from '${srcEnv}' to '${destEnv}'.  ${error.message} `)
        }
    }
}




export async function includeContextDetailsForBuckets(bucketList: Bucket[], env: EnvTypeEnum, includeEnvironmentList: boolean = true): Promise<Bucket[]> {
    if(bucketList && bucketList.length > 0) {
        if(includeEnvironmentList === true) {
            for(let i = 0; i < bucketList.length; i++) {
                let environList = await getAllEnvironmentsForBucket(bucketList[i]._id?.toString() as string)
                bucketList[i].contextProperties = bucketList[i].contextProperties.filter(a => a.name.toUpperCase() !== ENVIRONMENTLIST) ?? [];
                bucketList[i].contextProperties.push({
                    id: randomUUID(),
                    name: ENVIRONMENTLIST,
                    value: environList
                })
            }
        }
    }
    return bucketList;
}



async function getAllEnvironmentsForBucket(bucketId: string) : Promise<Array<EnvTypeEnum>>{
    let environList = new Set<EnvTypeEnum>()
    let allValidEnvironments = getEnumValuesAsArray(EnvTypeEnum);
    
    for (let i = 0; i < allValidEnvironments.length; i++) {
        let env = allValidEnvironments[i] as EnvTypeEnum;
        let buckRepo = new ServiceModelRepository<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION, env);
        let filter = { _id: new ObjectId(bucketId) } as Filter<Bucket>;
        let projection = { associatedProperties: 0 }
        let buckInstance = (await buckRepo.GetByFilterAndProjection(filter, projection)) as Bucket[]
        
        if(buckInstance && buckInstance.length > 0) {
            environList.add(env)
        }
    }

    return Array.from(environList).sort()
}

