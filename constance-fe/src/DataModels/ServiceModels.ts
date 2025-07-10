import { ConfigContentTypeEnum } from "./Constants";
import { BaseUserInfo, BasicKVP, BasicProperty, EditorNotesData, PropertyItem, User } from "./HelperModels";




export interface DBIdentifiable {
    _id: string;
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
    value: any;
    bucketId: string;
    description: string;
    contentType: ConfigContentTypeEnum;
    createdOn: Date;
    createdBy: string;
    associatedProperties: PropertyItem[];
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




