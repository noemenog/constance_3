import { ObjectId } from "mongodb";
import { ConfigContentTypeEnum } from "./Constants";
import { BaseUserInfo, BasicKVP, BasicProperty, EditorNotesData, PropertyItem, User } from "./HelperModels";




export interface DBIdentifiable {
    _id?: string | ObjectId;
}

export interface ServiceModel extends DBIdentifiable { 
    ownerElementId: string;
    contextProperties: BasicProperty[];
    lastUpdatedOn: Date;
}



//===================================================================================
//========================== MAIN MODELS ================================================

export interface AppInfo extends ServiceModel {
    name: string;
    enabled: boolean;
    description: string;
    owner: BaseUserInfo;
    createdOn: Date;
    createdBy: string;
    lockedBy: string|null;
    associatedProperties: PropertyItem[];
}


export interface Bucket extends ServiceModel {
    name: string;
    description: string;
    createdOn: Date;
    createdBy: string;
    associatedProperties: PropertyItem[];
}


export interface ConfigItem extends ServiceModel {
    name: string;
    bucketId: string;
    description: string;
    contentType: ConfigContentTypeEnum;
    value: any;
    createdOn: Date;
    createdBy: string;
    associatedProperties: PropertyItem[];
}


export interface ConfigChangeHistory extends ServiceModel {
    configItemId: string;
    bucketId: string;
    changes: ConfigChangeInstance[];
}


export interface ConfigChangeInstance {
    index: number;
    contentType: ConfigContentTypeEnum;
    value: any; 
    timeStamp: Date;
    user: string;
    tags: string[];
}

//===================================================================================
//========================== SNAPSHOT CONTEXT =======================================
// export interface SnapshotContext extends ServiceModel  {
//     name: string;
//     enabled: boolean;
//     components: string[];
// }



// //===================================================================================
// //========================== CHANGE TRACKER CONTEXT =======================================
// export interface ChangeContext extends ServiceModel {
//     uniqueId: string,  //itemId
//     tags: string[],
//     data: any;
//     diffContext: { time: Date, agent: string, delta: any }[],
// }




