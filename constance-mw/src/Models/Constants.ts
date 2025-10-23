
export enum ErrorSeverityValue { 
    ERROR = "ERROR", 
    WARNING = "WARNING", 
    FATAL = "FATAL" 
}


export enum ConfigContentTypeEnum {
    STRING = "STRING",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",
    PYTHON = "PYTHON",
    JSON = "JSON",
    XML = "XML",
    YAML = "YAML",
    POWERSHELL = "POWERSHELL",
    DOCKERFILE = "DOCKERFILE",
    HTML = "HTML", 
    SQL = "SQL"
    // CSS = "CSS", 
    // BASH_SHELL = "BASH_SHELL",
    // VBSCRIPT = "VBSCRIPT",
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
}



export enum DatabaseConnectionTypeEnum {
    PROD_DB  = "PROD_DB",
    PREVIEW_DB  = "PREVIEW_DB",
    DEV_DB  = "DEV_DB"
}


export enum DBCollectionTypeEnum {
    APPINFO_COLLECTION = "AppInfo",  //keep this as the first item on here!
    BUCKET_COLLECTION = "Bucket",
    CONFIGITEM_COLLECTION = "ConfigItem",
    CHANGE_CHANGE_HISTORY_COLLECTION = "ConfigChangeHistory",
}


export const DB_COLL_TYPE_CLONE_ORDER = new Map<number, string>([
    //DO NOT CHANGE ORDER!! RAMIFICATIONS: appInfo cloning!!
    [1, DBCollectionTypeEnum.APPINFO_COLLECTION],
    [2, DBCollectionTypeEnum.BUCKET_COLLECTION],
    [3, DBCollectionTypeEnum.CONFIGITEM_COLLECTION],
    [4, DBCollectionTypeEnum.CHANGE_CHANGE_HISTORY_COLLECTION]
])


export class AppConfigConstants {
    static readonly APP_ID = "686ec8ccb6abe731fa2cfce7";
    static readonly BUCKETID__MAIN_GENERAL_CONFIG = "686ec8ccb5dcb2fcb0fb32ce";
}


//contextProperties items
export const BUCKETLIST = "BUCKETLIST";
export const ENVIRONMENTLIST = "ENVIRONMENTLIST";


//contextProperties items
export const CLONE_SOURCE_ID = "CLONE_SOURCE_ID";