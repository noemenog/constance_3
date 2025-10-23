import { DatabaseConnectionTypeEnum, DBCollectionTypeEnum } from "./Models/Constants";
import { AppInfo, Bucket, ConfigChangeHistory, ConfigItem } from "./Models/ServiceModels";
import { getEnumValuesAsArray } from "./BizLogic/UtilFunctions";
import { ClientSession, Collection, Db, MongoClient, MongoClientOptions } from "mongodb";



let clientInstances = new Map<string, MongoClient>();
let dbConnections = new Map<string, Db>();


export async function connectToMongo() {
    try {
        const options = {
            tlsInsecure: true //TODO: resolve this issue -- this is set as is because otherwise there wll be connection errors
        } as MongoClientOptions;

        //PROD DB connection
        const prodClient = new MongoClient(process.env.PROD_DB_CONN_STRING as string, options);
        await prodClient.connect();
        clientInstances.set(DatabaseConnectionTypeEnum.PROD_DB, prodClient)
        dbConnections.set(DatabaseConnectionTypeEnum.PROD_DB, prodClient.db(process.env.PROD_DB_NAME));
        console.log("\n")
        console.log(`Successfully connected to PROD-DB  [${process.env.PROD_DB_NAME}]`);


        //PREVIEW DB connection
        const previewDBClient = new MongoClient(process.env.PRE_DB_CONN_STRING as string, options);
        await previewDBClient.connect();
        clientInstances.set(DatabaseConnectionTypeEnum.PREVIEW_DB, previewDBClient)
        dbConnections.set(DatabaseConnectionTypeEnum.PREVIEW_DB, previewDBClient.db(process.env.PRE_DB_NAME));
        console.log(`Successfully connected to PREVIEW-DB  [${process.env.PRE_DB_NAME}]`);


        //DEV DB connection
        const devClient = new MongoClient(process.env.DEV_DB_CONN_STRING as string, options);
        await devClient.connect();
        clientInstances.set(DatabaseConnectionTypeEnum.DEV_DB, devClient)
        dbConnections.set(DatabaseConnectionTypeEnum.DEV_DB, devClient.db(process.env.DEV_DB_NAME));
        console.log(`Successfully connected to DEV-DB  [${process.env.DEV_DB_NAME}]`);
        console.log("\n")
    }
    catch (e: any) {
        console.error("Failed to connect to mongoDB");
        console.error(e);
        process.exit();
    }
}



function getCollectionImpl(inputCollectionName: string, dbConnType: DatabaseConnectionTypeEnum): any {
    let db : Db | undefined;
    let collectionName : string = inputCollectionName;
    let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum);
    try {
        if(dbConnType === DatabaseConnectionTypeEnum.PROD_DB){
            db = dbConnections.get(DatabaseConnectionTypeEnum.PROD_DB);
        }
        else if (dbConnType === DatabaseConnectionTypeEnum.PREVIEW_DB) {
            db = dbConnections.get(DatabaseConnectionTypeEnum.PREVIEW_DB);
        }
        else if (dbConnType === DatabaseConnectionTypeEnum.DEV_DB) {
            db = dbConnections.get(DatabaseConnectionTypeEnum.DEV_DB);
        }

        if(allCollNames.includes(inputCollectionName) === false){
            throw new Error(`DB collection '${collectionName}' is either unknown or not supported. DBType: ${dbConnType?.toString() || ''}`)
        }

        if (db && collectionName) {
            let collection = db.collection(collectionName);
            return collection
        }
        else {
            throw new Error(`Could not establish DB connection for '${dbConnType?.toString() || ''}'`);
        }
    }
    catch(e: any) {
        let msg = `Failed to get mongo collection '${collectionName}' from '${dbConnType?.toString() || ''}`;
        throw new Error(msg + "---- " + e.message)
    }
}



export function getAppInfoCollection(environment: string): Collection<AppInfo> {
    return getCollection(environment, DBCollectionTypeEnum.APPINFO_COLLECTION)
}

export function getBucketCollection(environment: string): Collection<Bucket> {
    return getCollection(environment, DBCollectionTypeEnum.BUCKET_COLLECTION)
}

export function getConfigCollection(environment: string): Collection<ConfigItem> {
    return getCollection(environment, DBCollectionTypeEnum.CONFIGITEM_COLLECTION)
}

export function getCollection(env: string, collType: DBCollectionTypeEnum) {
    if ((env?.trim()?.toLowerCase() === "production") || (env?.trim()?.toLowerCase() === "prod")) {
        return getCollectionImpl(collType.toString(), DatabaseConnectionTypeEnum.PROD_DB)
    }
    else if ((env?.trim()?.toLowerCase() === "preview") || (env?.trim()?.toLowerCase() === "pre")) {
        return getCollectionImpl(collType.toString(), DatabaseConnectionTypeEnum.PREVIEW_DB)
    }
    else if ((env?.trim()?.toLowerCase() === "development") || (env?.trim()?.toLowerCase() === "dev")) {
        return getCollectionImpl(collType.toString(), DatabaseConnectionTypeEnum.DEV_DB)
    }
    else {
        throw new Error(`Invalid environment specified. The value '${env}' is not acceptable.`)
    }
}


export async function createMongoIndexes() {
    let prodDB = dbConnections.get(DatabaseConnectionTypeEnum.PROD_DB);
    let previewDB = dbConnections.get(DatabaseConnectionTypeEnum.PREVIEW_DB);
    let devDB = dbConnections.get(DatabaseConnectionTypeEnum.DEV_DB);

    let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum);
    
    for(let db of [prodDB, previewDB, devDB]) {
        if (db) {
            for (let x = 0; x < allCollNames.length; x++) {
                let collectionName = allCollNames[x];

                if(collectionName === DBCollectionTypeEnum.APPINFO_COLLECTION){
                    let collection = db.collection<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION);
                    collection.createIndex({ownerElementId: 1})
                    collection.createIndex({name: 1})
                    collection.createIndex({enabled: 1})
                }
                else if(collectionName === DBCollectionTypeEnum.BUCKET_COLLECTION){
                    let collection = db.collection<Bucket>(DBCollectionTypeEnum.BUCKET_COLLECTION);
                    collection.createIndex({ownerElementId: 1})
                    collection.createIndex({_id: 1, ownerElementId: 1, name: 1 })
                }
                else if(collectionName === DBCollectionTypeEnum.CONFIGITEM_COLLECTION){
                    let collection = db.collection<ConfigItem>(DBCollectionTypeEnum.CONFIGITEM_COLLECTION);
                    collection.createIndex({ownerElementId: 1})
                    collection.createIndex({_id: 1, ownerElementId: 1, name: 1 })
                    collection.createIndex({_id: 1, ownerElementId: 1, bucketId: 1})
                    collection.createIndex({_id: 1, ownerElementId: 1, bucketId: 1, name: 1})
                }
                else if(collectionName === DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION){
                    let collection = db.collection<ConfigChangeHistory>(DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION);
                    collection.createIndex({ownerElementId: 1})
                    collection.createIndex({ownerElementId: 1, configItemId: 1 })
                    collection.createIndex({_id: 1, ownerElementId: 1, configItemId: 1 })
                } 
                else {
                    // hapilly do nothing :-)
                }
            }
        }
        else {
            throw new Error(`Could not create indexes for database....'`);
        }
    }
}




