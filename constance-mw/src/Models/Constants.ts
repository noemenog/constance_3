export const GENERAL_NOTE_FILES_FOLDER_NAME = "GENERAL_NOTE_FILES";

export const SPECIAL_BLUE_COLOR = "#1976d2";
export const SPECIAL_RED_COLOR = "#e77e7e";  //"#df5454";
export const SPECIAL_DARKMODE_TEXTFIELD_COLOR = "rgb(102, 153, 153, 0.2)";
export const SPECIAL_DARK_GOLD_COLOR = "#AA6C39";
export const SPECIAL_GOLD_COLOR = "#e6b800";
export const SPECIAL_QUARTZ_COLOR = "#1F2836";
export const SPECIAL_DEEPER_QUARTZ_COLOR = "#161c26";
export const SPECIAL_EVEN_DEEPER_QUARTZ_COLOR = "#0f131a";  //"#11161e";
export const SPECIAL_PUPRLE_COLOR = "#c280ff";

export const ERROR_WIKI_PREFIX = "https://wiki.ith.intel.com/display/ATTDDTD/Constance/";


export const BASIC_NAME_VALIDATION_REGEX: RegExp = /^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/;
export const BASIC_NAME_VALIDATION_REGEX_WITH_SPACE: RegExp = /^[A-Za-z0-9][A-Za-z0-9_-\s]*[A-Za-z0-9]$/;
export const MIN_DESCRIPTION_LENGTH = 15;


export const MLCR_AUTH_AGS_URL = 'https://mlcr-auth.app.intel.com'
export const MLCR_AUTH_AGS_URL_V2 = 'https://mlcr-auth.app.intel.com/v2'
export const AGS_APP_NAME = "Spider"
export const AGS_APP_IAPM_NUMBER = "25193"
export const AGS_APP_OWNER_WG = "Owner-constance"
export const AGS_APP_APPROVER_GROUP_POSTFIX = "APPROVER"
export const AGS_APP_ACCESS_ENTITLEMENT = "Constance_User"


export enum UIMessageType {
    ERROR_MSG="error", 
    SUCCESS_MSG="success", 
    INFO_MSG="info",
    WARN_MSG="warning",
}


export enum ErrorSeverityValue { 
    ERROR = "ERROR", 
    WARNING = "WARNING", 
    FATAL = "FATAL" 
}


export enum ActionSceneEnum {
    ROOT = "root",
    APPINFO = "project",
    CONFIGURATIONS = "stackup",
    COMPARE = "layergroups",
    LOGS = "logs",
    FAQS = "faq",
} 


export enum ConfigContentTypeEnum {
    JSON = "JSON",
    XML = "XML",
    STRING = "STRING",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",
}


export enum EnvTypeEnum {
    PRODUCTION = "PRODUCTION",
    PREVIEW = "PREVIEW",
    DEVELOPMENT = "DEVELOPMENT",
}


export enum NamingContentTypeEnum {
    APPINFO = "APPINFO",
    BUCKET = "BUCKET",
    CONFIGITEM = "CONFIGITEM",
    ARBITRARY_DEFAULT = "ARBITRARY_DEFAULT",
    SNAPSHOT = "SNAPSHOT"
}


export enum AppInfoPropertyCategoryEnum {
    PERMISSION_ROLES = "PERMISSION_ROLES",
}



//contextProperties items
export const BUCKETLIST = "BUCKETLIST";
export const ENVIRONMENTLIST = "ENVIRONMENTLIST";

export enum DatabaseConnectionTypeEnum {
    PROD_DB  = "PROD_DB",
    PREVIEW_DB  = "PREVIEW_DB",
    DEV_DB  = "DEV_DB"
}


export enum DBCollectionTypeEnum {
    APPINFO_COLLECTION = "AppInfo",  //keep this as the first item on here!
    BUCKET_COLLECTION = "Bucket",
    CONFIGITEM_COLLECTION = "ConfigItem",
    SNAPSHOT_CONTEXT_COLLECTION = "SnapshotContext",
    CHANGE_CONTEXT_COLLECTION = "ChangeContext",
}


export const DB_COLL_TYPE_CLONE_ORDER = new Map<number, string>([
    //DO NOT CHANGE ORDER!! RAMIFICATIONS: appInfo cloning!!
    [1, DBCollectionTypeEnum.APPINFO_COLLECTION],
    [2, DBCollectionTypeEnum.BUCKET_COLLECTION],
    [3, DBCollectionTypeEnum.CONFIGITEM_COLLECTION],
    [4, DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION]
    
    // CONSTRAINT_CHANGE_INSTANCE_COLLECTION = "ConstraintChangeInstance",
])



export class AppConfigConstants {
    static readonly APP_ID = "686ec8ccb6abe731fa2cfce7";
    static readonly BUCKETID__MAIN_GENERAL_CONFIG = "686ec8ccb5dcb2fcb0fb32ce";
}

export const MAX_DAYS_FOR_DELETION = 30; //take note!
export const MONGO_ID_CHECK_REGEX_PATTERN : RegExp = /^[0-9a-fA-F]{24}$/;



export const CONFIGITEM__Init_Display_Message = "init_display_message";
export const CONFIGITEM__Disabled_Apps = "disabled_apps";