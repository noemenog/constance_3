import { Filter, Document, ObjectId, FindOptions, Collection, FindCursor, WithId, Sort, UpdateResult } from "mongodb";
import { BaseRepository } from "./BaseRepository";
import { IBaseServiceModelRepo as IServiceModelRepository } from "./BaseRepoDefs";
import { ServiceModel } from "../Models/ServiceModels";
import { hasAnyMembers } from "../BizLogic/UtilFunctions";
import { nameof } from "ts-simple-nameof";
import { DBCollectionTypeEnum } from "../Models/Constants";


export class ServiceModelRepository<T extends ServiceModel> extends BaseRepository<T> implements IServiceModelRepository<T> {

    constructor(collection: DBCollectionTypeEnum, fromSnapShot?: boolean) {
        super(collection, fromSnapShot)
    }


    async GetAnyOne(projectId: string, filter: Filter<T>|null): Promise<T|null> { 
        let finalFilter = (filter)
            ? { $and: [{ projectId: projectId }, filter] }
            : { projectId: projectId }

        const result = await this.collection.findOne(finalFilter as any);
        
        if(result) {
            return result as T;
        }
        else {
            return null;
        }
        
    }

    async GetOneByProjectID(projectId: string, filter?: Filter<T>): Promise<T> {
        let finalFilter = (filter)
            ? { $and: [{ projectId: projectId }, filter] }
            : { projectId: projectId }
        const result : T[] = (await this.collection.find(finalFilter as any)?.toArray()) as T[];
        return result[0]
    }

    async GetOneByProjectIDAndItemID(projectId: string, itemId: string) : Promise<T>{
        let itemIDFilter = { _id: new ObjectId(itemId) } as any;
        let finalFilter = { $and: [{ projectId: projectId }, itemIDFilter] }
        const result : T[] = (await this.collection.find(finalFilter as any)?.toArray()) as T[];
        return result[0]
    }

    async GetAllByProjectID(projectId: string, filter?: Filter<T>): Promise<T[]> {
        let finalFilter = (filter)
            ? { $and: [{ projectId: projectId }, filter] }
            : { projectId: projectId }
        const result : T[] = (await this.collection.find(finalFilter as any)?.toArray()) as T[];
        return result ?? []
    }

    async GetAllByProjectIDAndProjection(projectId: string, filter: Filter<T>|null, projectionSpec: Document): Promise<any[]> {
        let finalFilter = (filter)
            ? { $and: [{ projectId: projectId }, filter] }
            : { projectId: projectId }
        
        if(projectionSpec && hasAnyMembers(projectionSpec)){
            const projResult : T[] = (await this.collection.find(finalFilter as any, {projection: projectionSpec}).toArray()) as T[];
            return projResult;
        }
        else{
            const fullResult : T[] = (await this.collection.find(finalFilter as any)?.toArray()) as T[];
            return fullResult
        }
    }

    GetCursorByProjectIDAndProjection(projectId: string, filters: Array<Filter<T>>|null, projectionSpec: Document|null, batchSize: number, sortSpec: Sort|null = null): FindCursor<WithId<T>> {
        let finalFilter = (filters && filters.length > 0)
            ? { $and: [{ projectId: projectId }, ...filters] }
            : { projectId: projectId }
        
        let options = {}
        if(projectionSpec){
            options = { projection: projectionSpec, batchSize: batchSize } as FindOptions<T>
        }
        else{
            options = { batchSize: batchSize } as FindOptions<T>
        }
        
        if(sortSpec) {
            (options as FindOptions<T>).sort = sortSpec
        }

        const finalResult : FindCursor<WithId<T>> = this.collection.find(finalFilter as any, options);
        return finalResult;
    }

    async PaginationGetLastByProjectIDAndProjection(projectId: string, filters: Array<Filter<T>>|null, limit: number, projectionSpec: Document|null, sortSpec: Sort = { _id: 1 } as any) : Promise<T[]> {
        let result = new Array<T>()
        if (limit === 0){
            result = new Array<T>()
        }
        else {
            let options = (projectionSpec) ? { projection: projectionSpec } as FindOptions<T> : undefined
            let finalFilter = (filters && filters.length > 0)
                ? { $and: [ { projectId: projectId }, ...filters ] }
                : { projectId: projectId }
            result = await this.collection.find(finalFilter as any, options).sort(sortSpec).limit(limit)?.toArray() as T[];
        }
        return result
    }

    //WARNING: if youre going to call this, make sure you test your usage. - MIGHT NOT WORK AS INTUITIVELY AS ONE MIGHT EXPECT!!
    async PaginationGetPageByProjectIDAndProjection(projectId: string, filters: Array<Filter<T>>|null, exclusionaryLastId: string, limit: number, projectionSpec: Document|null, sortSpec: Sort = { _id: 1 } as any) : Promise<T[]> {
        let result = new Array<T>();
        if(limit === 0 || (!exclusionaryLastId) || exclusionaryLastId.length === 0 || exclusionaryLastId === "undefined"){
            result = new Array<T>() 
        }
        else{
            let options = (projectionSpec) ? { projection: projectionSpec } as FindOptions<T> : undefined
            let oid = new ObjectId(exclusionaryLastId)
            let finalFilter = (filters && filters.length > 0)
                ? { $and: [ { projectId: projectId }, { _id: { $gt: oid } }, ...filters ] }
                : { $and: [ { projectId: projectId }, { _id: { $gt: oid } } ] }

            result = await this.collection.find(finalFilter as any, options).sort(sortSpec).limit(limit)?.toArray() as T[];
        }
        return result
    }

    async ReplaceManyOrInsert(projectId: string, replacements: T[]): Promise<T[]> {
         //bulk update based on project ID
         const bulkData = replacements.map(item => ( {
            replaceOne: {
                upsert: true, //upsert is allowed!
                filter: { projectId: projectId } as any,
                replacement: item
            }
        }));
        let result = await this.collection.bulkWrite(bulkData);
        let isSuccessful : boolean = result.isOk() && (result.modifiedCount == replacements.length);
        if(isSuccessful){
            const result : T[] = (await this.collection.find({ projectId: projectId } as any)?.toArray()) as T[];
            return result
        }
        return new Array<T>()
    }

    async DeleteManyByProjectId(projectId: string, filters: Array<Filter<T>>|null, ignoreZeroDeletedCount: boolean): Promise<boolean> {
        let finalFilter = (filters && filters.length > 0)
            ? { $and: [{ projectId: projectId }, ...filters] } as Filter<T>
            : { projectId: projectId } as Filter<T>

        let result = await this.collection.deleteMany(finalFilter)
        if (result && result.deletedCount === 0 && ignoreZeroDeletedCount) {
            return true;
        }
        if (result && result.deletedCount > 0) {
            return true ;
        }
        else {
            return false;
        }
    }

    async GetSnapshotDataInList(projectId: string, snapshotComponentIdList: string[]): Promise<T[]> {
        let scObjIdList = snapshotComponentIdList.map((x: string) => new ObjectId(x));
        let projIdFd = {projectId: projectId} 
        let inListFd = { _id: { $in: scObjIdList } as any }
        let combineFd =  { $and: [projIdFd, inListFd] } as any

        const results = (await this.collection.find(combineFd).toArray()) as T[];
        return results;
    }

    async GetCountByProjectId(projectId: string, filters: Array<Filter<T>>|null): Promise<number> {
        let finalFilter = (filters && filters.length > 0)
            ? { $and: [{ projectId: projectId }, ...filters] }
            : { projectId: projectId }
        
        const result = await this.collection.countDocuments(finalFilter as any);
        return result
        
    }

    
    async BulkFindAndPushToArrayField(projectId: string, 
        filters: Array<Filter<T>>|null, fieldSelector: (obj: T) => any, pushValues: Array<any>, ignoreZeroUpdateCount: boolean): Promise<boolean> {
        
        let finalFilter = (filters && filters.length > 0)
        ? { $and: [{ projectId: projectId }, ...filters] } as Filter<T>
        : { projectId: projectId } as Filter<T>

        let fieldName = nameof<T>(fieldSelector);
        let valuesStr : string = JSON.stringify(pushValues)
        let updateStr : string = `{ "$push": { "${fieldName}": { "$each": ${valuesStr} } } }`
        let updateSpecification;
        try {
            updateSpecification = JSON.parse(updateStr)
        }
        catch (err: any) {
            throw new Error(`Bulk find-and-push operation failed. Could not parse stringified update spec. ${(err && err.message) ? err.message : ""}`)
        }
        const result = await this.collection.updateMany(finalFilter, updateSpecification);

        // return (result.acknowledged && result.modifiedCount > 0);

        if (ignoreZeroUpdateCount) {
            return result.acknowledged
        }
        else {
            return (result.acknowledged && result.modifiedCount > 0);
        }

    }

    async BulkUpdateWithMap<T>(projectId: string, updateDataMap: Map<string, Map<string, string>>, allowUpsert: boolean = false) : Promise<boolean>{
        const bulkOperations: any[] = [];
        updateDataMap.forEach((innerPropMap, itemNameKey) => {
            innerPropMap.forEach((propValue, propName) => {
                bulkOperations.push({
                    updateOne: {
                        filter: { projectId: projectId, name: itemNameKey, 'associatedProperties.name': propName },
                        update: { $set: { 'associatedProperties.$.value.customValue': propValue } },
                        upsert: allowUpsert
                    }
                });
            });
        });

        if (bulkOperations.length > 0) {
            const result = await this.collection.bulkWrite(bulkOperations);
            return result.isOk()
        } else {
            return false;
        }
    }
}
    







        // const updates = []
        // for(const [name, propData] of updateDataMap){
        //     const itemNameFilter = { 'projectId': projectId, 'name': name };
        //     const propUpdates = [];
        //     for(const [propName, propValue] of propData) {
        //         propUpdates.push({
        //             updateOne: {
        //                 filter: {'name': name, 'associatedProperties.name': propName},
        //                 update: { $set: {'associatedProperties.$.value.customValue': propValue}}
        //             }
        //         })
        //     }
        //     updates.push({
        //         updateMany: {
        //             filter: itemNameFilter,
        //             update: {$set: {associatedProperties : propUpdates.map(x => x.updateOne.filter)}}
        //         }
        //     });
        // }

        // const result = await this.collection.bulkWrite(updates as any);
        // return result.isOk()


        //==================================================================


        // if(projectionSpec){
        //     let options = { projection: projectionSpec, batchSize: batchSize } as FindOptions<T>
        //     const projResult : FindCursor<WithId<T>> = this.collection.find(finalFilter as any, options);
        //     return projResult;
        // }
        // else{
        //     let options = { batchSize: batchSize } as FindOptions<T>
        //     const fullResult : FindCursor<WithId<T>> = this.collection.find(finalFilter as any, options);
        //     return fullResult
        // }