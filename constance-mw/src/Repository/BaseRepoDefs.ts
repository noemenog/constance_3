import { Filter, Document, FindCursor, WithId, AggregationCursor, AnyBulkWriteOperation, Sort, ObjectId } from "mongodb";
import { ServiceModel } from "../Models/ServiceModels";



export interface IBaseRepository<T extends Document>
{
    GetWithId(id: string) : Promise<T>;
    GetWithFilter(filter: Filter<T>): Promise<T[]>;
    CreateOne(item: T): Promise<T>;
    CreateMany(items: T[], skipReturnCreated: boolean, chunkedOperation: boolean, chunkSize: number): Promise<T[]>;
    ReplaceOne(item: T, considerModifiedCount: boolean) : Promise<boolean>;
    ReplaceMany(replacements : T[]) : Promise<boolean>;
    DeleteMany(idList : string[]) : Promise<boolean>;
    GetByFilterAndProjection(filter: Filter<T>, projectionSpec: Document): Promise<any[]>;
    RunAggregation(aggQueryString: string, allowDiskUse: boolean, batchSize: number): AggregationCursor<Document>;
    BulkWrite(operations: AnyBulkWriteOperation<T>[]) : any;
    GetCursorByFilterAndProjection(filters: Array<Filter<T>>, projectionSpec: Document|null, batchSize: number, sortSpec: Sort|null): FindCursor<WithId<T>>;
    UpdateDocumentProperty(docId: ObjectId|string, propertyName: string, newValue: any) : Promise<T|undefined>
}

export interface IBaseServiceModelRepo<T extends ServiceModel> extends IBaseRepository<T>
{
    GetAnyOne(ownerElementId: string, filter: Filter<T>|null): Promise<T|null>;
    GetOneByOwnerElementId(ownerElementId: string, filter?: Filter<T>) : Promise<T>;
    GetOneByOwnerElementIdAndItemID(ownerElementId: string, itemId: string) : Promise<T>;
    GetAllByOwnerElementId(ownerElementId: string, filter?: Filter<T>) : Promise<T[]>;
    GetAllByOwnerElementIdAndProjection(ownerElementId: string, filter: Filter<T>, projectionSpec: Document) : Promise<any[]>;
    ReplaceManyOrInsert(ownerElementId: string, replacements: T[]): Promise<T[]>;
    DeleteManyByOwnerElementId(ownerElementId: string, filters: Array<Filter<T>>|null, ignoreZeroDeletedCount : boolean) : Promise<boolean>;
    GetSnapshotDataInList(ownerElementId: string, snapshotComponentIdList: string[]): Promise<T[]>;
    GetCountByOwnerElementId(ownerElementId: string, filters: Array<Filter<T>>|null): Promise<number>;
    GetCursorByOwnerElementIdAndProjection(ownerElementId: string, filters: Array<Filter<T>>|null, projectionSpec: Document|null, batchSize: number): FindCursor<WithId<T>>;
    PaginationGetLastByOwnerElementIdAndProjection(ownerElementId: string, filters: Array<Filter<T>>|null, limit: number, projectionSpec: Document|null) : Promise<T[]>;
    PaginationGetPageByOwnerElementIdAndProjection(ownerElementId: string, filters: Array<Filter<T>>|null, exclusionaryLastId: string, limit: number, projectionSpec: Document|null) : Promise<T[]>;
    BulkFindAndPushToArrayField(ownerElementId: string, filters: Array<Filter<T>>|null, fieldSelector: (obj: T) => any, pushValues: Array<any>, ignoreZeroUpdateCount: boolean): Promise<boolean>;
    BulkUpdateWithMap(ownerElementId: string, updateData: Map<string, Map<string, string>>) : Promise<boolean>;   
}
