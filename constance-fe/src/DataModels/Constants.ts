import { getEnumValuesAsMap } from "../BizLogicUtilities/UtilFunctions";


export const SPECIAL_BLUE_COLOR = "#1976d2";
export const SPECIAL_RED_COLOR = "#e77e7e";  //"#df5454";
export const SPECIAL_DARKMODE_TEXTFIELD_COLOR = "rgb(102, 153, 153, 0.2)";
export const SPECIAL_DARK_GOLD_COLOR = "#AA6C39";
export const SPECIAL_GOLD_COLOR = "#e6b800";
export const SPECIAL_QUARTZ_COLOR = "#1F2836";
export const SPECIAL_DEEPER_QUARTZ_COLOR = "#161c26";
export const SPECIAL_EVEN_DEEPER_QUARTZ_COLOR = "#0f131a";  //"#11161e";
export const SPECIAL_PUPRLE_COLOR = "#c280ff";

export const ERROR_WIKI_PREFIX = "https://wiki.ith.intel.com/display/ATTDDTD/Spider/";


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

export const AUTOMAP_PATTERN_CHANNEL_INDICATOR = "#CHANNEL#"


export const STACKUP_ROUTING_DESIG_NONE = "None";
export const STACKUP_ROUTING_DESIG_ROUTING = "Routing";
export const STACKUP_ROUTING_DESIG_MIX = "Mix";

export enum UIMessageType {
    ERROR_MSG="error", 
    SUCCESS_MSG="success", 
    INFO_MSG="info",
    WARN_MSG="warning",
}


export enum DataMappingTypeEnum { 
    Auto = "Auto", 
    Manual = "Manual", 
    Unmapped = "Unmapped" 
}

export enum NetclassNodeGenTypeEnum { 
    Auto = "Auto", 
    Manual = "Manual",
    Default = "Default", 
    Unknown = "Unknown" 
}

export enum InterfaceInitTypeEnum { 
    INTERNAL_CLONE = "InternalClone", 
    EXTERNAL_IMPORT = "ExternalImport",
    PROJECT_CLONE = "ProjectClone",
    FRESH = "Fresh"
}

export enum ErrorSeverityValue { 
    ERROR = "ERROR", 
    WARNING = "WARNING", 
    FATAL = "FATAL" 
}

export enum StackupLayerTypeEnum {
    Metal = "Metal",
    Dielectric = "Dielectric", 
    PTH = "PTH", 
    SolderResist = "SolderResist", 
    Unknown = "Unknown", 
    PocketDepth = "PocketDepth",
    Signal = "Signal" 
}

export enum StackupSideEnum { 
    Front = "Front", 
    Back = "Back", 
    Other = "Other"
}

export enum KeyProjectAspectTypeEnum {
    PHY_LNK = "PHY_LNK", 
    CLR_LNK = "CLR_LNK",
    CRB_DATA = "CRB_DATA"
}

export enum CommonPropertyCategoryEnum{
    //all general props are intended to be visible in UI
    GENERAL_FIXED_KEY = "GENERAL_FIXED_KEY",
    GENERAL_NON_EDITABLE = "GENERAL_NON_EDITABLE",
    GENERAL_EDITABLE = "GENERAL_EDITABLE",
    GENERAL_CONFIGURED_FIXED_KEY = "GENERAL_CONFIGURED_FIXED_KEY",
    GENERAL_CONFIGURED_NON_EDITABLE = "GENERAL_CONFIGURED_NON_EDITABLE"
}

export const UIViewableProjectPropTypes : ReadonlyArray<string> = [
    CommonPropertyCategoryEnum.GENERAL_FIXED_KEY,
    CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
    CommonPropertyCategoryEnum.GENERAL_EDITABLE,
    CommonPropertyCategoryEnum.GENERAL_CONFIGURED_FIXED_KEY,
    CommonPropertyCategoryEnum.GENERAL_CONFIGURED_NON_EDITABLE
]

export enum ProjectPropertyCategoryEnum {
    MATCH_GROUP = "MATCH_GROUP",
    NET_FILE_IMPORT = "NET_FILE_IMPORT",
    IGNORABLE_POWER_NETS = "IGNORABLE_POWER_NETS",
    PERMISSION_ROLES = "PERMISSION_ROLES",
    DIFFPAIR_EXCLUSION_CRITERIA = "DIFFPAIR_EXCLUSION_CRITERIA",
    ACCESS_GUARD = "ACCESS_GUARD",
    PENDING_PROCESSES = "PENDING_PROCESSES"
}

//Known project property names - others - non changeable
export const PROJECT_PROP_PDRD_DOCUMENT_NUMBER = "PDRD Document Number"
export const PROJECT_PROP_SUBSTRATE_PACKAGE_PART_NUMBER = "Substrate Package Part Number"

//Known interface property names - on project create
export const INTERFACE_PROP_DESCRIPTION = "Description"

export const FIXED_KEY = "FIXED_KEY"; //keys for properties with this tag cannot be changed
export const FIXED_ALL = "FIXED_ALL"; //Both keys and values for properties with this tag cannot be changed

export const LINKAGE_ALL_RULEAREA_INDICATOR = "[LNK_ALL_RULEAREAS]";

export enum NetManagementActionTypeEnum {
    UPDATE_WHOLE_NET = "UPDATE_WHOLE_NET",
    UPDATE_NET_PROPERTY_VALUE = "UPDATE_NET_PROPERTY_VALUE",
    ASSIGN_NETS = "ASSIGN_NETS",
    RENAME_NET = "RENAME_NET",
    REMOVE_NET_ASSIGNMENT = "REMOVE_NET_ASSIGNMENT",
    ASSIGN_DIFF_PAIR = "ASSIGN_DIFF_PAIR",
    REMOVE_DIFF_PAIR = "REMOVE_DIFF_PAIR"
}


export enum PendingProcessActionTypeEnum {
    NET_IMPORT = "NET_IMPORT",
    NET_PROP_UPLOAD = "NET_PROP_UPLOAD",
    AUTOMAP_EXEC = "AUTOMAP_EXEC",
    AUTODIFF_EXEC = "AUTODIFF_EXEC",
    G2G_UPDATE = "G2G_UPDATE"
}


export enum ConstraintTypesEnum { 
    Physical = "Physical", 
    Clearance = "Clearance", 
    Undefined = "Undefined"
}


export enum ConstraintPropertyCategoryEnum {
    Physical = "Physical", 
    Clearance = "Clearance",
    Net = "Net"
}


export enum PowerInfoAspectEnum {
    RAILS = "RAILS", 
    COMPONENTS = "COMPONENTS",
}


export enum ProjectDataDownloadContentTypeEnum {
    APD = "APD",
    XPEDITION = "XPEDITION",
    PDRD = "PDRD",
    NETINFO = "NETINFO",
    FULLZIP = "FULLZIP"
}


export enum ActionSceneEnum {
    ROOT = "root",
    PROJECT = "project",
    STACKUP = "stackup",
    LAYERGROUPS = "layergroups",
    RULEAREAS = "ruleareas",
    NETS = "nets",
    DEFAULTCONSTRAINTS = "defaultconstraints",
    INTERFACES = "interfaces", 
    C2CLAYOUT = "c2clayout", 
    POWERINFO = "powerinfo", 
    VALIDATIONS = "validations", 
    LOGS = "logs",
    FAQS = "faq",
} 


export const SCENES_MAPPING = getEnumValuesAsMap(ActionSceneEnum)


export const CONFIGITEM__Rule_Area_Settings = "rule_area_settings";
export const CONFIGITEM__Diff_Pair_Settings = "diff_pair_settings";
export const CONFIGITEM__Diff_Pair_Formation_Aggregation = "diff_pair_formation_aggregation";
export const CONFIGITEM__Diff_Pair_Query_Operation = "diff_pair_query_operation";
export const CONFIGITEM__Default_Project_Properties = "default_project_properties";
export const CONFIGITEM__Default_Interface_Properties = "default_interface_properties";
export const CONFIGITEM__Org_Settings = "org_settings";
export const CONFIGITEM__Maturity_Values = "maturity_values";
export const CONFIGITEM__Materials = "materials";
export const CONFIGITEM__Substrate_Technologies = "substrate_technologies";
export const CONFIGITEM__Name_Check_Settings = "name_check_setting";
export const CONFIGITEM__Shadow_Void_Columns = "shadow_void_columns";
export const CONFIGITEM__Power_Rails_Columns = "power_rails_columns";
export const CONFIGITEM__Power_Components_Columns = "power_components_columns";
export const CONFIGITEM__Page_Title_Settings = "page_title_settings";
export const CONFIGITEM__Permission_Action_Context = "permission_action_context";
export const CONFIGITEM__Separate_FrontSide_BackSide_Grouping = "separate_frontside_backside_grouping";
export const CONFIGITEM__Init_Display_Message = "init_display_message";
export const CONFIGITEM__Permission_Revoked_Actions = "permission_revoked_actions";
export const CONFIGITEM__Disabled_Projects = "disabled_projects";


//contextProperties items
export const GOLDEN_INDICATOR_NAME = "Golden";
export const CLONE_SOURCE_ID = "CLONE_SOURCE_ID"
export const DIFFNET_PROP_NAME = "DiffNet";
export const RELATED_DEFAULT_CONSTRAINTS_PROP_NAME = "Related_DefaultConstraints"
export const INTERFACE_TEMPLATE_UPSERT_NAME = "TEMPLATE_NAME";
export const CONF_PERMISSION_ROLES = "CONF_PERMISSION_ROLES";
export const NETCLASSES_PROP_NAME = "NETCLASSES"
export const CHANNEL_RANGE = "CHANNEL_RANGE"
export const IFACE_COPY_RULEAREA_MAPPING = "IFACE_COPY_RULEAREA_MAPPING";
export const IFACE_COPY_LAYERGROUP_MAPPING = "IFACE_COPY_LAYERGROUP_MAPPING";


export enum NamingContentTypeEnum {
    PROJECT = "PROJECT",
    DEFAULT_CONSTRAINTS = "DEFAULT_CONSTRAINTS",
    INTERFACE = "INTERFACE",
    INTERFACE_TEMPLATE = "INTERFACE_TEMPLATE",
    NETCLASS = "NETCLASS",
    LINKAGE = "LINKAGE",
    RULE_AREA = "RULE_AREA",
    LGSET = "LGSET",
    LAYER_GROUP = "LAYER_GROUP",
    SNAPSHOT = "SNAPSHOT",
    RELATION = "RELATION",
    NET = "NET",  
    PROJECT_PROPERTY = "PROJECT_PROPERTY",
    MATCH_GROUP = "MATCH_GROUP",
    ARBITRARY_DEFAULT = "ARBITRARY_DEFAULT"
}


export const LGSET_TAG_SORT = "SORT";
export const LGSET_TAG_EXPAND = "EXPAND";

export const PHYSICAL_PAGE_URL_SUFFIX = "physical"
export const CLEARANCE_PAGE_URL_SUFFIX = "clearance"
export const OVERVIEW_PAGE_URL_SUFFIX = "overview"

export enum PermissionActionEnum {
    //project
    EDIT_PROJECT_PROPERTIES = "EDIT_PROJECT_PROPERTIES",
    CLONE_PROJECT = "CLONE_PROJECT",
    LOCK_PROJECT = "LOCK_PROJECT",
    TAKE_SNAPSHOT = "TAKE_SNAPSHOT",
    DELETE_SNAPSHOT = "DELETE_SNAPSHOT",
    RESTORE_SNAPSHOT = "RESTORE_SNAPSHOT",
    CHANGE_PROJECT_SETTINGS = "CHANGE_PROJECT_SETTINGS",
    DELETE_PROJECT = "DELETE_PROJECT",
    DOWNLOAD_APD_DATA = "DOWNLOAD_APD_DATA",
    DOWNLOAD_XPEDITION_DATA = "DOWNLOAD_XPEDITION_DATA",
    DOWNLOAD_NET_INFO = "DOWNLOAD_NET_INFO",
    DOWNLOAD_DPRD = "DOWNLOAD_DPRD",
    EDIT_PROJECT_NOTES = "EDIT_PROJECT_NOTES",

    //stackup
    CREATE_RECREATE_STACKUP = "CREATE_RECREATE_STACKUP",
    UPDATE_STACKUP = "UPDATE_STACKUP",

    //layer groups
    UPDATE_LAYER_GROUPS = "UPDATE_LAYER_GROUPS",

    //default constraints
    UPLOAD_DEFCON_FILE = "UPLOAD_DEFCON_FILE",
    OVERWRITE_WITH_DEFCON_VALUES = "OVERWRITE_WITH_DEFCON_VALUES",
    CREATE_EDITABLE_DEFCON_COPY = "CREATE_EDITABLE_DEFCON_COPY",
    UPDATE_EDITABLE_DEFCON_COPY = "UPDATE_EDITABLE_DEFCON_COPY",
    
    //rule areas
    UPDATE_RULE_AREAS = "UPDATE_RULE_AREAS",
    
    //nets
    UPLOAD_NETLIST_FILE = "UPLOAD_NETLIST_FILE",
    MANUALLY_CLASSIFY_NETS = "MANUALLY_CLASSIFY_NETS",
    MANUALLY_SETUP_DIFFPAIRS = "MANUALLY_SETUP_DIFFPAIRS",
    CHANGE_LM_VALUES = "CHANGE_LM_VALUES",
    UPLOAD_LM_VALUES = "UPLOAD_LM_VALUES",

    //interface
    CHANGE_COLUMN_VISIBILITY = "CHANGE_COLUMN_VISIBILITY",
    CREATE_INTERFACE = "CREATE_INTERFACE",
    COPY_INTERFACE = "COPY_INTERFACE",
    EDIT_INTERFACE_PROPERTIES = "EDIT_INTERFACE_PROPERTIES",
    UPDATE_INTERFACE_COMPOSITION = "UPDATE_INTERFACE_COMPOSITION",
    SAVE_AS_TEMPLATE = "SAVE_AS_TEMPLATE",
    DELETE_INTERFACE = "DELETE_INTERFACE",
    CHANGE_RULEAREA_VISIBILITY = "CHANGE_RULEAREA_VISIBILITY",
    UPDATE_SHADOWVOID = "UPDATE_SHADOWVOID",
    UPLOAD_COLLATERALS = "UPLOAD_COLLATERALS",
    DOWNLOAD_COLLATERALS = "DOWNLOAD_COLLATERALS",
    DELETE_COLLATERALS = "DELETE_COLLATERALS",
    EDIT_INTERFACE_NOTES = "EDIT_INTERFACE_NOTES",

    // routing rules
    COPY_OVER_PHY_RULES = "COPY_OVER_PHY_RULES",
    UPDATE_ROUTING_CONSTRAINTS = "UPDATE_ROUTING_CONSTRAINTS",

    //class-to-class layout
    UPDATE_CLEARANCE_RELATION_NAMES = "UPDATE_CLEARANCE_RELATION_NAMES",
    UPDATE_C2C_LAYOUT = "UPDATE_C2C_LAYOUT",
    COPY_OVER_C2C_LAYOUT = "COPY_OVER_C2C_LAYOUT",
    CLEAR_C2C_LAYOUT = "CLEAR_C2C_LAYOUT",
    CHANGE_C2C_VISIBILITY = "CHANGE_C2C_VISIBILITY",
    EXECUTE_G2G_ACTION = "EXECUTE_G2G_ACTION",

    //power info
    UPDATE_POWER_RAILS = "UPDATE_POWER_RAILS",
    UPDATE_POWER_COMPONENTS = "UPDATE_POWER_COMPONENTS"

}




























//Known project property names - on project create
// export const PROJECT_PROP_DESCRIPTION = "Description"
// export const PROJECT_PROP_MATURITY = "Maturity"
// export const PROJECT_PROP_CREATED_BY = "Created By"






// export const CONFIGITEM__Permission_Roles = "permission_roles";




// export enum NodeTypeEnum { Project, Interface, Netclass, Net, CompressedNet }

// export enum StackupModelTypeEnum { StandardCore, Coreless, FullStack }

// export enum StackupLayerTypeEnum { Metal, Dielectric, PTH, SolderResist, Unknown, PocketDepth }

// export enum RoutingLayerTypeEnum { None, RoutingLayer, Mix }

// export enum CES_LINE_SPLIT_INDEXES {
//     RULE_LAYER_SEG = 0,
//     REGION_SEG = 1,
//     RULE_STR_SEG = 2,
//     VALUE = 3
// }

// export enum CES_FromToIndex { FROM = 0, TO = 2 };

// export enum ActionType {
//     COPY = "copy",
//     EXPORT = "export",
//     DELETE = "delete",
//     COMPARE = "compare",
//     CHANGE = "change",
//     UPLOAD = "upload"
// }


// export enum CustomGridTypes {
//     ProjectLayerGroup = "ProjectLayerGroup",
//     InterfaceLayerGroup = "InterfaceLayerGroup",
//     Project = "Project",
//     Interface = "Interface",
//     Stackup = "Stackup",
//     RuleArea = "RuleArea"
// }




// export enum ValueTypeEnum {
//     STRING = "string",
//     NUMBER = "number",
//     BOOLEAN = "boolean",
// }




// export enum ProjectPropertyCategoryEnum {
//     GENERAL_FIXED_KEY = "GENERAL_FIXED_KEY",
//     GENERAL_NON_EDITABLE = "GENERAL_NON_EDITABLE",
//     GENERAL_EDITABLE = "GENERAL_EDITABLE",
//     GENERAL_CONFIGURED_FIXED_KEY = "GENERAL_CONFIGURED_FIXED_KEY",
//     GENERAL_CONFIGURED_NON_EDITABLE = "GENERAL_CONFIGURED_NON_EDITABLE",

//     MATCH_GROUP = "MATCH_GROUP",
//     NET_FILE_IMPORT = "NET_FILE_IMPORT",
//     IGNORABLE_POWER_NETS = "IGNORABLE_POWER_NETS",

// }

// export const PROJECT_PROP_HELIOS_DESIGN = "Helios Design"

// export class BucketConstants_GeneralConfigs{
//     static readonly BUCKETID__GENERAL_CONFIG = "66103fb635982fbef6e023ce";
//     static readonly CONFIGITEM__Default_Rule_Areas = "default_rule_areas";
//     static readonly CONFIGITEM__Default_Project_Properties = "default_project_properties";
//     static readonly CONFIGITEM__Orgs = "orgs";
//     static readonly CONFIGITEM__Materials = "materials";
//     static readonly CONFIGITEM__Substrate_Technologies = "substrate_technologies";
//     static readonly CONFIGITEM__Default_Shadow_Void_Columns = "default_shadow_void_columns"
// }





// export const KEY_ARROW_LEFT = 'ArrowLeft';
// export const KEY_ARROW_UP = 'ArrowUp';
// export const KEY_ARROW_RIGHT = 'ArrowRight';
// export const KEY_ARROW_DOWN = 'ArrowDown';
// export const KEY_PAGE_UP = 'PageUp';
// export const KEY_PAGE_DOWN = 'PageDown';
// export const KEY_PAGE_HOME = 'Home';
// export const KEY_PAGE_END = 'End';
// export const KEY_BACKSPACE = 'Backspace';
// export const KEY_DELETE = 'Delete';
// export const KEY_F2 = 'F2';
// export const KEY_ENTER = 'Enter';
// export const KEY_TAB = 'Tab';

// export const GRID_SUPRESS_KEYS = [
//     KEY_ARROW_LEFT,
//     KEY_ARROW_UP,
//     KEY_ARROW_RIGHT,
//     KEY_ARROW_DOWN,
//     KEY_PAGE_UP,
//     KEY_PAGE_DOWN,
//     KEY_PAGE_HOME,
//     KEY_PAGE_END,
//     KEY_BACKSPACE,
//     KEY_DELETE,
//     KEY_F2,
//     KEY_ENTER,
//     KEY_TAB,
// ]
