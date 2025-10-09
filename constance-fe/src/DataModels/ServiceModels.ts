import { ActionSceneEnum, ConfigContentTypeEnum, EnvTypeEnum, ErrorSeverityValue, UIMessageType } from "./Constants";




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



//=================================================================================================================================
//========================================================== OTHER ================================================================
//=================================================================================================================================




export interface CDomainData {
    appInfoCollection: AppInfo[];
    appInfo : AppInfo | null;
    bucketList : Bucket[];
    configList: ConfigItem[];
    selectedConfig: ConfigItem | null;
    currentEnv: EnvTypeEnum | null;
    destEnv : EnvTypeEnum | null;
}



export interface BaseUserInfo {
    email: string,
    idsid: string
}

export interface User extends BaseUserInfo {
    id: string,
    wwid: string
}


export interface LoggedInUser extends User {
    perms: Map<string, string>,
    givenName: string,
    surname: string
}


//===================================================================================
//========================== PROPERTY =======================================
export interface Identifiable {
    id: string;
}

export interface BasicProperty extends Identifiable {
    name: string;
    value: any;
}

export interface PropertyItem extends BasicProperty {
    category: string;
    displayName: string;
    editable: boolean;
    enabled: boolean;
    contextProperties?: BasicProperty[];
}

export interface BasicKVP {
    key: string;
    value: any;
}

//===================================================================================
//========================== API RESPONSE DATA ======================================
export interface ResponseData {
    payload: any;
    error: ErrorData;
}

export interface ErrorData {
    id: string;
    code: string;
    severity: ErrorSeverityValue;
    message: string;
}



//===================================================================================
//========================== OTHER DATA ======================================

export class StringBuilder {
    private lines: string[] = [];

    append(line: string = ""): void {
        this.lines.push(line);
    }

    appendLine(line: string = ""): void {
        this.lines.push(line);
        this.lines.push("\n");
    }

    toString(): string {
        return this.lines.join("");
    }
}


// export interface ActionPermissionContext {
//     id: string,
//     category: ActionSceneEnum,
//     name: PermissionActionEnum, 
//     enabled: boolean,
//     enabledRoles: Set<string>
// }


export interface QuickStatus<T> {
    isSuccessful: boolean,
    message: string, 
    data?: T
}


//===================================================================================
//========================== UI FOCUSED ITEMS ======================================


export interface MenuInfo {
    label: string,
    icon: React.ReactNode,
    callbackAction?: (contextualInfo: BasicKVP) => void,
    indicateWarning?: boolean,
    contextualInfo?: BasicKVP
}

export interface ProjectRelatedMenuItem extends MenuInfo{
    key: ActionSceneEnum, 
    subPath?: string,
    onProjSelectionOnly: boolean, 
    envBased: boolean,
    disabled: boolean
}

export interface SnackBarData {
    type?: UIMessageType;
    msg: string;
}

export interface LoadingSpinnerInfo {
    enabled: boolean,
    text: string
}

export interface DisplayOption {
    id: string;
    label: string;
    type?: string
}

export interface PageConfInfo {
    key: string, 
    scene: string, 
    title: string, 
    subtitle: string
}






