import { getEnumValuesAsMap } from "../BizLogicUtilities/UtilFunctions";



export const KEY_ARROW_LEFT = 'ArrowLeft';
export const KEY_ARROW_UP = 'ArrowUp';
export const KEY_ARROW_RIGHT = 'ArrowRight';
export const KEY_ARROW_DOWN = 'ArrowDown';
export const KEY_PAGE_UP = 'PageUp';
export const KEY_PAGE_DOWN = 'PageDown';
export const KEY_PAGE_HOME = 'Home';
export const KEY_PAGE_END = 'End';
export const KEY_BACKSPACE = 'Backspace';
export const KEY_DELETE = 'Delete';
export const KEY_F2 = 'F2';
export const KEY_ENTER = 'Enter';
export const KEY_TAB = 'Tab';

export const GRID_SUPRESS_KEYS = [
    KEY_ARROW_LEFT,
    KEY_ARROW_UP,
    KEY_ARROW_RIGHT,
    KEY_ARROW_DOWN,
    KEY_PAGE_UP,
    KEY_PAGE_DOWN,
    KEY_PAGE_HOME,
    KEY_PAGE_END,
    KEY_BACKSPACE,
    KEY_DELETE,
    KEY_F2,
    KEY_ENTER,
    KEY_TAB,
]


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
// export const BASIC_NAME_VALIDATION_REGEX_WITH_SPACE: RegExp = /^[A-Za-z0-9][A-Za-z0-9_-\s]*[A-Za-z0-9]$/;
export const MIN_DESCRIPTION_LENGTH = 15;


// export const MLCR_AUTH_AGS_URL = 'https://mlcr-auth.app.intel.com'
export const MLCR_AUTH_AGS_URL_V2 = 'https://mlcr-auth.app.intel.com/v2'
export const AGS_APP_NAME = "Constance"
export const AGS_APP_IAPM_NUMBER = "37332"
export const AGS_APP_OWNER_WG = "Owner-constance"
export const AGS_APP_APPROVER_GROUP_POSTFIX = "APPROVER"
export const AGS_APP_ACCESS_ENTITLEMENT = "Constance_User"


export const CONFIGITEM__Init_Display_Message = "init_display_message";
export const CONFIGITEM__Disabled_Apps = "disabled_apps";
export const CONFIGITEM__Permission_Revoked_Actions = "permission_revoked_actions";
export const CONFIGITEM__Page_Title_Settings = "page_title_settings";


//contextProperties items
export const BUCKETLIST = "BUCKETLIST";
export const ENVIRONMENTLIST = "ENVIRONMENTLIST";

export const LATEST_VERSION_TAG = "Latest"

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


export enum ConfigContentTypeEnum {
    STRING = "STRING",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",
    PYTHON = "PYTHON",
    JSON = "JSON",
    XML = "XML",
    YAML = "YAML",
    POWERSHELL = "POWERSHELL",
    BASH_SHELL = "BASH_SHELL",
    HTML = "HTML", 
    CSS = "CSS", 
    DOCKERFILE = "DOCKERFILE",
    VBSCRIPT = "VBSCRIPT",
    SQL = "SQL"
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


export enum PermEntityTypeEnum {
    BUCKET= 'Bucket',
    APP= 'App',
}

export enum ActionSceneEnum {
    ROOT = "root",
    APPHOME = "apphome",
    CONFIGURATIONS = "configurations",
    LOGS = "logs",
} 

export const SCENES_MAPPING = getEnumValuesAsMap(ActionSceneEnum)


export enum PermissionAppLevelActionEnum {
    //scene: apphome
    EDIT_APPINFO_PROFILE = "EDIT_APPINFO_PROFILE",
    EXPORT_ALL_APPINFO_DATA = "EXPORT_ALL_APPINFO_DATA",
    CLONE_APPINFO = "CLONE_APPINFO",
    LOCK_APPINFO = "LOCK_APPINFO",
    DELETE_APPINFO = "DELETE_APPINFO",
}

export enum PermissionBucketLevelActionEnum {
    //scene: configurations
    VIEW_BUCKET_CONTENTS = "VIEW_BUCKET_CONTENTS",
    ADD_BUCKET = "ADD_BUCKET",
    CLONE_BUCKET = "CLONE_BUCKET",
    DELETE_BUCKET = "DELETE_BUCKET",
    UPDATE_BUCKET = "UPDATE_BUCKET",
    EXPORT_BUCKET = "EXPORT_BUCKET",
}

export enum PermissionConfigLevelActionEnum {
    UPDATE_CONFIG = "UPDATE_CONFIG",
    ADD_CONFIG = "ADD_CONFIG", //also use against destination bucket -- to determine if user can COPY or MOVE config to destination bucket
    COPY_CONFIG = "COPY_CONFIG",
    MOVE_CONFIG = "MOVE_CONFIG",
    DELETE_CONFIG = "DELETE_CONFIG",
    COMPARE_CONFIG = "COMPARE_CONFIG",  //user must have access to both environments
}

export enum PermRolesEnum {
    APP_ADMIN = "APP_ADMIN",
    DEV_ENV_ACCESS = "DEV_ENV_ACCESS",
    PRE_ENV_ACCESS = "PRE_ENV_ACCESS",
    PROD_ENV_ACCESS = "PROD_ENV_ACCESS",
    BUCKET_ADMIN = "BUCKET_ADMIN",
    BUCKET_READ_ONLY = "BUCKET_READ_ONLY",
}

export const PERM_ROLES_RELATED_DATA_MAP: ReadonlyMap<PermRolesEnum, readonly [string, string]> = new Map<PermRolesEnum, readonly [string, string]>([
    [PermRolesEnum.APP_ADMIN, ["App Admin", "Admin"]],
    [PermRolesEnum.DEV_ENV_ACCESS, ["DEV Environment Access", "DEV_Access"]],
    [PermRolesEnum.PRE_ENV_ACCESS, ["PRE Environment Access", "PRE_Access"]],
    [PermRolesEnum.PROD_ENV_ACCESS, ["PROD Environment Access", "PROD_Access"]],
    [PermRolesEnum.BUCKET_ADMIN, ["Bucket Admin", "Admin"]],
    [PermRolesEnum.BUCKET_READ_ONLY, ["Bucket Read Only", "ReadOnly"]],
]);

//===================================================================================================
//===================================================================================================
