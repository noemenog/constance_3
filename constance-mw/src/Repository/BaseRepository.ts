import { Filter, Document, ObjectId, Collection, OptionalUnlessRequiredId, AggregationCursor, AnyBulkWriteOperation, Sort, FindCursor, WithId, FindOptions } from "mongodb";
import { IBaseRepository } from "./BaseRepoDefs";
import { DatabaseConnectionTypeEnum, DBCollectionTypeEnum } from "../Models/Constants";
import { getCollection } from "../dbConn";


export class BaseRepository<T extends Document> implements IBaseRepository<T>
{
    protected collection : Collection<T>;
    
    constructor(collection: DBCollectionTypeEnum, fromSnapShot?: boolean) {
        if(fromSnapShot === true || collection === DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION) {
            this.collection = getCollection(collection, DatabaseConnectionTypeEnum.SNAPSHOT_DB)
        }
        else if(collection === DBCollectionTypeEnum.NET_COLLECTION) {
            this.collection = getCollection(collection, DatabaseConnectionTypeEnum.NETS_DB)
        }
        else {
            this.collection = getCollection(collection, DatabaseConnectionTypeEnum.PRIMARY_DB)
        }
    }

    async GetWithId(id: string): Promise<T> {
        const result : T[] = (await this.collection.find({ _id: new ObjectId(id) } as any)?.toArray()) as T[];
        return result?.at(0) as T
    }

    async GetWithFilter(filter: Filter<T>): Promise<T[]> {
        const result : T[] = (await this.collection.find(filter as any)?.toArray()) as T[];
        return result
    }

    async GetByFilterAndProjection(filter: Filter<T>, projectionSpec: Document): Promise<any[]> {
        const projResult = await this.collection.find(filter as any, {projection: projectionSpec}).toArray();
        return projResult;
    }

    async CreateOne(item: T): Promise<T> {
        let insertRes = await this.collection.insertOne(item as any);
        const result : T[] = (await this.collection.find({ _id: new ObjectId(insertRes.insertedId) } as any)?.toArray()) as T[];
        return result[0]
    }

    async CreateMany(items: T[], skipReturnCreated: boolean = false, chunkedOperation = false, chunkSize = 10): Promise<T[]> {
        let createdItems = new Array<T>();
        if(chunkedOperation === false) {
            let insertManyRes = await this.collection.insertMany(items as OptionalUnlessRequiredId<T>[]);
            if(skipReturnCreated === false) {
                let idArr = []
                for (const key in insertManyRes.insertedIds) {
                    idArr.push(insertManyRes.insertedIds[key])
                }
                const results = (await this.collection.find({ _id: { $in: idArr } as any }).toArray()) as T[];
                createdItems = results
            }
        }
        else {
            for (let c = 0; c < items.length; c += chunkSize) {
                let chunk = items.slice(c, c + chunkSize);
                let insertManyRes = await this.collection.insertMany(chunk as OptionalUnlessRequiredId<T>[]);
                if(skipReturnCreated === false) {
                    let idArr = []
                    for (const key in insertManyRes.insertedIds) {
                        idArr.push(insertManyRes.insertedIds[key])
                    }
                    let results = (await this.collection.find({ _id: { $in: idArr } as any }).toArray()) as T[];
                    createdItems = createdItems.concat(results)
                }
            }
        }

        return createdItems;
    }

    async ReplaceOne(item: T, considerModifiedCount : boolean = false): Promise<boolean> {
        (item as any)._id = new ObjectId(item._id as string) 
        let result = await this.collection.replaceOne({ _id: new ObjectId(item._id as string) as any }, item);
        if(considerModifiedCount) {
            return (result.acknowledged && result.modifiedCount > 0);
        }
        else {
            return result.acknowledged
        }
    }

    async ReplaceMany(replacements: T[], considerModifiedCount : boolean = true): Promise<boolean> {
        //bulk update - NO upsert!!
        for(let i = 0; i < replacements.length; i++) {
            (replacements[i] as any)._id = new ObjectId(replacements[i]._id as string) 
        }
        const bulkData = replacements.map(item => ( {
            replaceOne: {
                upsert: false, //upsert NOT allowed!
                filter: { _id: new ObjectId(item._id as string) } as any,
                replacement: item
            }
        }));
        
        let result = await this.collection.bulkWrite(bulkData);
        
        if(considerModifiedCount) {
            let isSuccessful : boolean = result.isOk() && (result.modifiedCount == replacements.length);
            return isSuccessful;
        }
        else {
            let isSuccessful : boolean = result.isOk();
            return isSuccessful;
        }
    }

    async DeleteMany(idList: string[]): Promise<boolean> {
        const deleteList = idList.map((x: string) => new ObjectId(x));
        let result = await this.collection.deleteMany({ _id: { $in: deleteList } as any })
        if (result && result.deletedCount > 0) {
            return true ;
        }
        else {
            return false;
        }
    }


    RunAggregation(aggQueryString: string, allowDiskUse?: boolean, batchSize?: number): AggregationCursor<Document> {
        const addOptions = { 
            allowDiskUse: allowDiskUse, 
            batchSize: batchSize 
        }

        let pipeline : Document[] = JSON.parse(aggQueryString);
        const aggCursor = this.collection.aggregate(pipeline, addOptions)
        return aggCursor;
    }

    
    async BulkWrite(operations: AnyBulkWriteOperation<T>[]) : Promise<any> {
        return this.collection.bulkWrite(operations);
    }


    GetCursorByFilterAndProjection(filters: Array<Filter<T>>, projectionSpec: Document|null, batchSize: number, sortSpec: Sort|null = null) {
        if(filters && filters.length > 0) {
            let finalFilter = { $and: [...filters] }
            let options = {}

            if(projectionSpec){
                options = { projection: projectionSpec, batchSize: batchSize }
            }
            else{
                options = { batchSize: batchSize }
            }
            
            if(sortSpec) {
                (options as any).sort = sortSpec
            }

            const finalResult = this.collection.find(finalFilter as any, options);
            return finalResult as FindCursor<WithId<T>>;
        }
        else {
            throw new Error("Cannot perform mongo-cursor based data retrieval. Valid filter(s) are required!")
        } 
    }


    async UpdateDocumentProperty(docId: ObjectId|string, propertyName: string, newValue: any) : Promise<T|undefined>{
        const result = await this.collection.updateOne(
            { _id: new ObjectId(docId) } as any,
            { $set: { [propertyName]: newValue } as any },
            { upsert: false }
        );
    
        if (result.acknowledged && result.modifiedCount && result.modifiedCount > 0) {
            let upd = await this.GetWithId(docId.toString());
            return upd as T
        }
        else {
            return undefined;
        }
    }
}












// let collObj = (fromSnapShot === true) ? getCollection(collection, fromSnapShot) : getCollection(collection)
// this.collection = collObj