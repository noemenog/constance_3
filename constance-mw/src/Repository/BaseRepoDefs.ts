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
    GetAnyOne(projectId: string, filter: Filter<T>|null): Promise<T|null>;
    GetOneByProjectID(projectId: string, filter?: Filter<T>) : Promise<T>;
    GetOneByProjectIDAndItemID(projectId: string, itemId: string) : Promise<T>;
    GetAllByProjectID(projectId: string, filter?: Filter<T>) : Promise<T[]>;
    GetAllByProjectIDAndProjection(projectId: string, filter: Filter<T>, projectionSpec: Document) : Promise<any[]>;
    ReplaceManyOrInsert(projectId: string, replacements: T[]): Promise<T[]>;
    DeleteManyByProjectId(projectId: string, filters: Array<Filter<T>>|null, ignoreZeroDeletedCount : boolean) : Promise<boolean>;
    GetSnapshotDataInList(projectId: string, snapshotComponentIdList: string[]): Promise<T[]>;
    GetCountByProjectId(projectId: string, filters: Array<Filter<T>>|null): Promise<number>;
    GetCursorByProjectIDAndProjection(projectId: string, filters: Array<Filter<T>>|null, projectionSpec: Document|null, batchSize: number): FindCursor<WithId<T>>;
    PaginationGetLastByProjectIDAndProjection(projectId: string, filters: Array<Filter<T>>|null, limit: number, projectionSpec: Document|null) : Promise<T[]>;
    PaginationGetPageByProjectIDAndProjection(projectId: string, filters: Array<Filter<T>>|null, exclusionaryLastId: string, limit: number, projectionSpec: Document|null) : Promise<T[]>;
    BulkFindAndPushToArrayField(projectId: string, filters: Array<Filter<T>>|null, fieldSelector: (obj: T) => any, pushValues: Array<any>, ignoreZeroUpdateCount: boolean): Promise<boolean>;
    BulkUpdateWithMap(projectId: string, updateData: Map<string, Map<string, string>>) : Promise<boolean>;   
}
