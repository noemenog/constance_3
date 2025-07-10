import { EnvTypeEnum, ErrorSeverityValue, PermissionActionEnum } from "./Constants";
import { AppInfo, Bucket } from "./ServiceModels";
import { ActionSceneEnum, UIMessageType } from "./Constants";




export interface CDomainData {
    appInfoCollection: AppInfo[];
    appInfo : AppInfo | null;
    bucketList : Bucket[];
    selectedBucket: Bucket | null
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

export interface ConstraintValues {
    id: string;
    configValue: string;
    defautlValue: string;
    customValue: string;
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

export interface ConfigItem {
    _id: string;
    appId: string;
    bucketId: string;
    bucketName?: string;
    configName: string;
    configValue: any;
    contentType: "JSON" | "XML" | "STRING" | "NUMBER" | "BOOLEAN";
    description: string;
    lastUpdatedOn: Date;
    tags: string[];
}



export interface StorageCollateralInfo{
    id: string,
    name: string,
    projectId: string,
    interfaceId: string,
    size: string,
    mediaType: string
}


export interface EditorNotesData { 
    blocks: any[], 
    time: number, 
    version: string
}


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


export interface StatusIndicatorItem {
    id: string, 
    index : number,
    title: string,
    description: string,
    lastUpdatedOn: Date,
    isOk: boolean,
    isProcessing: boolean,
    message: string
}


export interface ActionPermissionContext {
    id: string,
    category: ActionSceneEnum,
    name: PermissionActionEnum, 
    enabled: boolean,
    enabledRoles: Set<string>
}


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






