import { DatabaseConnectionTypeEnum, DBCollectionTypeEnum } from "./Models/Constants";
import { Netclass, Interface, PackageLayout, PowerInfo, Project, Net, DefaultConstraints, SnapshotContext, LayerGroupConstraints, C2CRow, ChangeContext, G2GRelationContext } from "./Models/ServiceModels";
import { getEnumValuesAsArray } from "./BizLogic/UtilFunctions";
import { ClientSession, Db, MongoClient, MongoClientOptions } from "mongodb";



let clientInstances = new Map<string, MongoClient>();
let dbConnections = new Map<string, Db>();


export async function connectToMongo() {
    try {
        const options = {
            tlsInsecure: true //TODO: resolve this issue -- this is set as is because otherwise there wll be connection errors
        } as MongoClientOptions;

        //MAIN DB connection
        const mainClient = new MongoClient(process.env.PRIMARY_DB_CONN_STRING as string, options);
        await mainClient.connect();
        clientInstances.set(DatabaseConnectionTypeEnum.PRIMARY_DB, mainClient)
        dbConnections.set(DatabaseConnectionTypeEnum.PRIMARY_DB, mainClient.db(process.env.PRIMARY_DB_NAME));
        console.log("\n")
        console.log(`Successfully connected to PRIMARY-DB  [${process.env.PRIMARY_DB_NAME}]`);


        //NETS DB connection
        const netsDBClient = new MongoClient(process.env.NETS_DB_CONN_STRING as string, options);
        await netsDBClient.connect();
        clientInstances.set(DatabaseConnectionTypeEnum.NETS_DB, netsDBClient)
        dbConnections.set(DatabaseConnectionTypeEnum.NETS_DB, netsDBClient.db(process.env.NETS_DB_NAME));
        console.log(`Successfully connected to NETS-DB  [${process.env.NETS_DB_NAME}]`);


        //SNAPSHOT DB connection
        const snapshotClient = new MongoClient(process.env.SNAPSHOT_DB_CONN_STRING as string, options);
        await snapshotClient.connect();
        clientInstances.set(DatabaseConnectionTypeEnum.SNAPSHOT_DB, snapshotClient)
        dbConnections.set(DatabaseConnectionTypeEnum.SNAPSHOT_DB, snapshotClient.db(process.env.SNAPSHOT_DB_NAME));
        console.log(`Successfully connected to SNAPSHOT-DB  [${process.env.SNAPSHOT_DB_NAME}]`);
        console.log("\n")
    }
    catch (e: any) {
        console.error("Failed to connect to mongoDB");
        console.error(e);
        process.exit();
    }
}



export function getCollection(inputCollectionName: string, dbConnType?: DatabaseConnectionTypeEnum): any {
    let db : Db | undefined;
    let collectionName : string = inputCollectionName;
    let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum);
    try {
        if(dbConnType === DatabaseConnectionTypeEnum.SNAPSHOT_DB){
            db = dbConnections.get(DatabaseConnectionTypeEnum.SNAPSHOT_DB);
            collectionName = (inputCollectionName === DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION) ? collectionName : `Snapshot_${collectionName}`
        }
        else if (dbConnType === DatabaseConnectionTypeEnum.NETS_DB) {
            db = dbConnections.get(DatabaseConnectionTypeEnum.NETS_DB);
        }
        else {
            db = dbConnections.get(DatabaseConnectionTypeEnum.PRIMARY_DB);
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



export async function createMongoIndexes() {
    let mainDB = dbConnections.get(DatabaseConnectionTypeEnum.PRIMARY_DB);
    let netsDB = dbConnections.get(DatabaseConnectionTypeEnum.NETS_DB);
    let snapshotsDB = dbConnections.get(DatabaseConnectionTypeEnum.SNAPSHOT_DB);

    let allCollNames = getEnumValuesAsArray(DBCollectionTypeEnum);
    
    if (netsDB) {
        let collection = netsDB.collection<Net>(DBCollectionTypeEnum.NET_COLLECTION);
        collection.createIndex({projectId: 1})
        collection.createIndex({projectId: 1, name: 1 })
        
        collection.createIndex({diffPairMapType: 1})
        collection.createIndex({projectId: 1, diffPairMapType: 1})

        collection.createIndex({netclassMapType: 1})
        collection.createIndex({projectId: 1, netclassMapType: 1})
        
        collection.createIndex({projectId: 1, interfaceId: 1})
        
        collection.createIndex({projectId: 1, interfaceId: 1, netclassId: 1 })
        collection.createIndex({projectId: 1, interfaceId: 1, netclassId: 1, "associatedProperties.category": 1})
            
    }
    else {
        throw new Error(`Could not create DB indexes for '${DatabaseConnectionTypeEnum.NETS_DB.toString()}'`);
    }

    if (snapshotsDB) {
        let collection = snapshotsDB.collection<ChangeContext>(DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION);
        collection.createIndex({projectId: 1})
        collection.createIndex({projectId: 1, uniqueId: 1 })
        collection.createIndex({projectId: 1, uniqueId: 1, "diffContext.time": 1})      
    }
    else {
        throw new Error(`Could not create DB indexes for '${DatabaseConnectionTypeEnum.SNAPSHOT_DB.toString()}'`);
    }

    if (mainDB) {
        for (let x = 0; x < allCollNames.length; x++) {
            let collectionName = allCollNames[x];

            if(collectionName === DBCollectionTypeEnum.PROJECT_COLLECTION){
                let collection = mainDB.collection<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
                collection.createIndex({projectId: 1})
                collection.createIndex({org: 1})
                collection.createIndex({_id: 1, "associatedProperties.category": 1})
            }
            else if(collectionName === DBCollectionTypeEnum.INTERFACE_COLLECTION){
                let collection = mainDB.collection<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
                collection.createIndex({projectId: 1})
                collection.createIndex({projectId: 1, "associatedProperties.category": 1})
            } 
            else if(collectionName === DBCollectionTypeEnum.NETCLASS_COLLECTION){
                let collection = mainDB.collection<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
                collection.createIndex({projectId: 1})
                collection.createIndex({projectId: 1, interfaceId: 1})
                collection.createIndex({_id: 1, interfaceId: 1, projectId: 1 })
            }
            else if(collectionName === DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION){
                let collection = mainDB.collection<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION);
                collection.createIndex({projectId: 1})
                collection.createIndex({projectId: 1, interfaceId: 1})
                collection.createIndex({projectId: 1, interfaceId: 1, channel: 1})
            }
            else if(collectionName === DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION){
                let collection = mainDB.collection<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION);
                collection.createIndex({projectId: 1})
                collection.createIndex({projectId: 1, ruleAreaId: 1})
                collection.createIndex({projectId: 1, ruleAreaId: 1, constraintType: 1})
            }
            else if(collectionName === DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION){
                let collection = mainDB.collection<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION);
                collection.createIndex({projectId: 1})
                collection.createIndex({projectId: 1, name: 1})
            }
            else if(collectionName === DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION){
                let collection = mainDB.collection<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION);
                collection.createIndex({projectId: 1})
            }
            else if(collectionName === DBCollectionTypeEnum.POWER_INFO_COLLECTION){
                let collection = mainDB.collection<PowerInfo>(DBCollectionTypeEnum.POWER_INFO_COLLECTION);
                collection.createIndex({projectId: 1})
            }
            else if(collectionName === DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION){
                let collection = mainDB.collection<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
                collection.createIndex({projectId: 1})
            } 
            else if(collectionName === DBCollectionTypeEnum.C2C_ROW_COLLECTION){
                let collection = mainDB.collection<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION);
                collection.createIndex({projectId: 1})
                collection.createIndex({projectId: 1, ruleAreaId: 1})
                collection.createIndex({projectId: 1, ruleAreaId: 1, netclassId: 1})
            }        
            else {
                // hapilly do nothing :-)
            }
        }
    }
    else {
        throw new Error(`Could not create DB indexes for '${DatabaseConnectionTypeEnum.PRIMARY_DB.toString()}'`);
    }
}


























// export function getSession(fromSnapShot : boolean = false): any {
//     let client : MongoClient | undefined;
//     let session: ClientSession;
//     try {
//         if(fromSnapShot){
//             client = clientInstances.get(SNAPSHOT_DB);
//         }
//         else {
//             client = clientInstances.get(PRIMARY_DB);
//         }

//         if (!client) {
//             throw new Error(`Could not retrieve DB client for '${fromSnapShot ? "Snapshot DB" : "Spider Main DB"}'`);
//         }
        
//         session = client.startSession();
//         if (!session) {
//             throw new Error(`Could not retrieve DB session for '${fromSnapShot ? "Snapshot DB" : "Spider Main DB"}'`);
//         }

//         return session;
//     }
//     catch(e: any) {
//         let msg = `Failed to establish mongo session. `;
//         throw new Error(msg + "---- " + e.message)
//     } 
// }

// fromSnapShot : boolean = false



//======================================================================


        // if (db && collectionName) {
        //     let collection : any;

        //     if(collectionName === DBCollectionTypeEnum.PROJECT_COLLECTION){
        //         collection = db.collection<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        //     }
        //     else if(collectionName === DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION){
        //         collection = db.collection<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION);
        //     }
        //     else if(collectionName === DBCollectionTypeEnum.INTERFACE_COLLECTION){
        //         collection = db.collection<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
        //     } 
        //     else if(collectionName === DBCollectionTypeEnum.NETCLASS_COLLECTION){
        //         collection = db.collection<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
        //     }
        //     else if(collectionName === DBCollectionTypeEnum.NET_COLLECTION){
        //         collection = db.collection<Net>(DBCollectionTypeEnum.NET_COLLECTION);
        //     }
        //     else if(collectionName === DBCollectionTypeEnum.POWER_INFO_COLLECTION){
        //         collection = db.collection<PowerInfo>(DBCollectionTypeEnum.POWER_INFO_COLLECTION);
        //     }
        //     else if(collectionName === DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION){
        //         collection = db.collection<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION);
        //     }
        //     else if(collectionName === DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION){
        //         collection = db.collection<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
        //     } 
        //     else if(collectionName === DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION){
        //         collection = db.collection<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION);
        //     } 
            
        //     // else if(collectionName === DBCollectionTypeEnum.CSET_COLLECTION){
        //     //     collection = db.collection<CSet>(DBCollectionTypeEnum.CSET_COLLECTION);
        //     // } 
        //     // else if(collectionName === DBCollectionTypeEnum.CONSTRAINT_CHANGE_INSTANCE_COLLECTION){
        //     //     collection = db.collection<ConstraintChangeInstance>(DBCollectionTypeEnum.CONSTRAINT_CHANGE_INSTANCE_COLLECTION);
        //     // } 
        //     // else if(collectionName === DBCollectionTypeEnum.C2C_ROW_COLLECTION){
        //     //     collection = db.collection<ConstraintChangeInstance>(DBCollectionTypeEnum.C2C_ROW_COLLECTION);
        //     // }
        //     // else if(collectionName === DBCollectionTypeEnum.LINKAGE){
        //     //     collection = db.collection<Linkage>(DBCollectionTypeEnum.LINKAGE);
        //     // }             
        //     else {
        //         if(fromSnapShot) { 
        //             collection = db.collection(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION);
        //             throw new Error(`Collection unknown or not supported `); }
        //     }

        //     return collection;
        // }
        // else {
        //     throw new Error(`Could not establish DB connection for '${fromSnapShot ? "Snapshot DB" : "Spider Main DB"}'`);
        // }