
export const SPIDER_DEV_EMAIL_CONTACT =  "spider_dev@intel.com"

export const GENERAL_NOTE_FILES_FOLDER_NAME = "GENERAL_NOTE_FILES";

export const NET_RETRIEVAL_BATCH_SIZE = 250000;
export const C2C_ROW_RETRIEVAL_BATCH_SIZE = 2000;
export const LGC_RETRIEVAL_BATCH_SIZE = 2000;

export const C2C_ROW_ALLCOLUMN_SLOT_NAME = "[ALL]"

export const NETLIST_EXPORT_SHEET_NAME = "NetList"
export const NETLIST_EXPORT_SHEET_NAMING_REGEX_PATTERN = /^NetList(_\d+)?$/i;
export const NETLIST_EXPORT_NETNAME_COL_HEADER = "NetName";

export const AUTOMAP_PATTERN_CHANNEL_INDICATOR = "#CHANNEL#"

export const LINKAGE_ALL_RULEAREA_INDICATOR = "[LNK_ALL_RULEAREAS]";

export enum DBCollectionTypeEnum {
    PROJECT_COLLECTION = "Project",  //keep this as the first item on here!
    DEFAULT_CONSTRAINTS_COLLECTION = "DefaultConstraints",
    INTERFACE_COLLECTION = "Interface",
    NETCLASS_COLLECTION = "Netclass",
    G2G_RELATION_CONTEXT_COLLECTION = "G2GRelationContexts",
    PACKAGE_LAYOUT_COLLECTION = "PackageLayout",
    POWER_INFO_COLLECTION = "PowerInfo",
    SNAPSHOT_CONTEXT_COLLECTION = "SnapshotContext",
    LAYERGROUP_CONSTRAINT_COLLECTION = "LayerGroupConstraints",
    C2C_ROW_COLLECTION = "C2CRow",
    NET_COLLECTION = "Net",  //keep Net as the LAST item on here!
    CHANGE_CONTEXT_COLLECTION = "ChangeContext",
}


export const DB_COLL_TYPE_CLONE_ORDER = new Map<number, string>([
    //DO NOT CHANGE ORDER!! RAMIFICATIONS: project cloning!!
    [1, DBCollectionTypeEnum.PROJECT_COLLECTION],
    [2, DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION],
    [3, DBCollectionTypeEnum.INTERFACE_COLLECTION],
    [4, DBCollectionTypeEnum.POWER_INFO_COLLECTION],
    [5, DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION],
    [6, DBCollectionTypeEnum.NETCLASS_COLLECTION],
    [7, DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION],
    [8, DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION],
    [9, DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION],
    [10, DBCollectionTypeEnum.C2C_ROW_COLLECTION],
    [11, DBCollectionTypeEnum.NET_COLLECTION]
    
    // CONSTRAINT_CHANGE_INSTANCE_COLLECTION = "ConstraintChangeInstance",
])

export enum DatabaseConnectionTypeEnum {
    PRIMARY_DB  = "PRIMARY_DB",
    SNAPSHOT_DB  = "SNAPSHOT_DB",
    NETS_DB  = "NETS_DB"
}


//contextProperties items
export const GOLDEN_INDICATOR_NAME = "Golden";
export const CLONE_SOURCE_ID = "CLONE_SOURCE_ID";
export const NETCLASSES_PROP_NAME = "NETCLASSES";
export const DIFFNET_PROP_NAME = "DiffNet";
export const RELATED_DEFAULT_CONSTRAINTS_PROP_NAME = "Related_DefaultConstraints";
export const INTERFACE_TEMPLATE_UPSERT_NAME = "TEMPLATE_NAME";
export const CONF_PERMISSION_ROLES = "CONF_PERMISSION_ROLES";
export const IFACE_COPY_RULEAREA_MAPPING = "IFACE_COPY_RULEAREA_MAPPING";
export const IFACE_COPY_LAYERGROUP_MAPPING = "IFACE_COPY_LAYERGROUP_MAPPING";
export const IFACE_COPY_NETCLASS_MAPPING = "IFACE_COPY_NETCLASS_MAPPING";
export const CHANNEL_RANGE = "CHANNEL_RANGE"

//nets mgmt
export const NET_REMAP_COL_ADDED_NETS = "ADDED_NETS";
export const NET_REMAP_COL_DELETED_NETS = "DELETED_NETS";
export const NET_REMAP_COL_RENAMING = "RENAMING";

//lgset sort or expand tracker
export const LGSET_TAG_SORT = "SORT";
export const LGSET_TAG_EXPAND = "EXPAND";


export enum ConstraintChangeActionEnum {
    STACKUP_THICKNESS_CHANGE = "STACKUP_THICKNESS_CHANGE",
	STACKUP_REBUILD_WITH_LAYERGROUPS_REDEFINED = "STACKUP_REBUILD_WITH_LAYERGROUPS_REDEFINED",

	RULEAREA_ADDITION = "RULEAREA_ADDITION",
	RULEAREA_REMOVAL = "RULEAREA_REMOVAL",
    
	NETCLASS_ADDITION = "NETCLASS_ADDITION",
	NETCLASS_REMOVAL = "NETCLASS_REMOVAL",
	
	CLEARANCE_RELATION_ADDITION = "CLEARANCE_RELATION_ADDITION",
	CLEARANCE_RELATION_REMOVAL = "CLEARANCE_RELATION_REMOVAL",

	LAYER_GROUP_ADDITION = "LAYER_GROUP_ADDITION",
	LAYER_GROUP_REMOVAL = "LAYER_GROUP_REMOVAL",
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


export enum ConstraintTypesEnum { 
    Physical = "Physical", 
    Clearance = "Clearance",
    Undefined = "Undefined"
}

export enum StackupModelTypeEnum { 
    StandardCore = "StandardCore", 
    Coreless = "Coreless", 
    FullStack = "FullStack",
    GlassCore = "GlassCore"
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

export enum StackupRoutingLayerTypeEnum { 
    None = "None", 
    Routing = "Routing", 
    Mix = "Mix"
}

export enum StackupSideEnum { 
    Front = "Front", 
    Back = "Back", 
    Other = "Other"
}

export enum ErrorSeverityValue { 
    ERROR = "ERROR", 
    WARNING = "WARNING", 
    FATAL = "FATAL" 
}

export enum KeyProjectAspectTypeEnum {
    PHY_LNK = "PHY_LNK", 
    CLR_LNK = "CLR_LNK",
    CRB_DATA = "CRB_DATA"
}

export enum CommonPropertyCategoryEnum {
    //all general props are intended to be visible in UI
    GENERAL_FIXED_KEY = "GENERAL_FIXED_KEY",
    GENERAL_NON_EDITABLE = "GENERAL_NON_EDITABLE",
    GENERAL_EDITABLE = "GENERAL_EDITABLE",
    GENERAL_CONFIGURED_FIXED_KEY = "GENERAL_CONFIGURED_FIXED_KEY",
    GENERAL_CONFIGURED_NON_EDITABLE = "GENERAL_CONFIGURED_NON_EDITABLE",
}

export enum ProjectPropertyCategoryEnum{
    MATCH_GROUP = "MATCH_GROUP",
    NET_FILE_IMPORT = "NET_FILE_IMPORT",
    IGNORABLE_POWER_NETS = "IGNORABLE_POWER_NETS",
    PERMISSION_ROLES = "PERMISSION_ROLES",
    DIFFPAIR_EXCLUSION_CRITERIA = "DIFFPAIR_EXCLUSION_CRITERIA",
    ACCESS_GUARD = "ACCESS_GUARD",
    PENDING_PROCESSES = "PENDING_PROCESSES"
}

export enum InterfacePropertyCategoryEnum {
    
}


export enum ConstraintPropertyCategoryEnum {
    Physical = "Physical", 
    Clearance = "Clearance",
    Net = "Net"
}

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


export enum PowerInfoAspectEnum {
    RAILS = "RAILS", 
    COMPONENTS = "COMPONENTS",
}


export enum NetInfoUploadAspectEnum {
    LM = "LengthMatching", 
    CUSTOM_PROPS = "CustomProperties",
}

export enum ProjectDataDownloadContentTypeEnum {
    APD = "APD",
    XPEDITION = "XPEDITION",
    PDRD = "PDRD",
    NETINFO = "NETINFO",
    FULLZIP = "FULLZIP"
}

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

//=============================================


export class StackupConstants {
    //common
    public static readonly FSR = "FSR";
    public static readonly BSR = "BSR";
    public static readonly METAL_LAYER_MATERIAL = "Cu";
    public static readonly BaseLayerName = "BASE";
    public static readonly SurfaceLayerName = "SURFACE";

    //Full Stackup logic
    public static readonly LAYER_SMS = "SMS";
    public static readonly LAYER_SURFACE_OUTER = "SURFACE_OUTER";
    public static readonly LAYER_BASE_INNER = "BASE_INNER";
    public static readonly LAYER_MLI = "MLI";
    public static readonly LAYER_SURFACE_INNER = "SURFACE_INNER";
    public static readonly LAYER_BASE_OUTER = "BASE_OUTER";
    public static readonly LAYER_SMB = "SMB";

    //Std Core Stackup logic
    public static readonly FRONT_SUFFIX = "F";
    public static readonly BACK_SUFFIX = "B";
    public static readonly FRONT_CORE_SUFFIX = "FC";
    public static readonly BACK_CORE_SUFFIX = "BC";
    public static readonly OUTER_CORE_SUFFIX = "O";
    public static readonly INNER_CORE_SUFFIX = "I";
    public static readonly EMIB_LAYER_NAME = "C0";
    
    public static readonly PTH = "PTH";
    public static readonly MIN_LAYERS = 1;

    //coreless stackup logic
    public static readonly CORELESS_PREFIX = "L";

    //stackupType
    public static readonly CorelessStackupType = "Coreless";
    public static readonly StdCoreStackupType = "StandardCore";
    public static readonly FullStackStackupType = "FullStack";
}


export class LGConstants {
    public static readonly STRIPLINE = "Stripline";
    public static readonly MICROSTRIP = "Microstrip";
    public static readonly LAYER_GROUP_DELIM = "_";
    public static readonly SurfaceLayerName = "SURFACE";
    public static readonly BaseLayerName = "BASE";
    public static readonly MicroStripLayerNames = [this.SurfaceLayerName, this.BaseLayerName];

    public static readonly Strategy_GENERIC = "GENERIC"
    public static readonly Strategy_STRIP = "STRIP"
    public static readonly Strategy_STRIP_WITH_THICKNESS = "STRIP_WITH_THICKNESS"
}



export class AppConfigConstants {
    static readonly APP_ID = "671a335237075b645fe75388";
    static readonly BUCKETID__MAIN_GENERAL_CONFIG = "671a335237075b645fe75389";
    static readonly BUCKETID__IMPORT_EXPORT_CONFIG = "671a335237075b645fe7538a";

    static readonly CONFIGITEM__Max_Days_For_Deletion = "max_days_for_deletion";
    static readonly CONFIGITEM__Rule_Area_Settings = "rule_area_settings";
    static readonly CONFIGITEM__Diff_Pair_Settings = "diff_pair_settings";
    static readonly CONFIGITEM__Default_Project_Properties = "default_project_properties";
    static readonly CONFIGITEM__Default_Interface_Properties = "default_interface_properties";
    static readonly CONFIGITEM__Materials = "materials";
    static readonly CONFIGITEM__Substrate_Technologies = "substrate_technologies";
    static readonly CONFIGITEM__LayerGroup_Naming_Strategy = "layergroup_naming_strategy";
    static readonly CONFIGITEM__Supported_LayerGroup_Naming_Strategies = "supported_layergroup_naming_strategies";
    static readonly CONFIGITEM__Storage_Api_Settings = "storage_api_settings";
    static readonly CONFIGITEM__Maturity_Values = "maturity_values";

    static readonly CONFIGITEM__Net_Constraint_Properties = "net_constraint_properties";
    static readonly CONFIGITEM__Physical_Constraint_Properties = "physical_constraint_properties";
    static readonly CONFIGITEM__Clearance_Constraint_Properties = "clearance_constraint_properties";

    static readonly CONFIGITEM__Page_Title_Settings = "page_title_settings";

    static readonly CONFIGITEM__Shadow_Void_Columns = "shadow_void_columns";
    static readonly CONFIGITEM__Power_Rails_Columns = "power_rails_columns";
    static readonly CONFIGITEM__Power_Components_Columns = "power_components_columns";

    static readonly CONFIGITEM__XPEDITION_VBS_TEMPLATE = "xpedition_vbs_template";
    static readonly CONFIGITEM__XPEDITION_IMPORT_README = "xpedition_import_readme";

    static readonly CONFIGITEM__CADENCE_IMPORT_BAT_SCRIPT = "cadence_import_bat_script";
    static readonly CONFIGITEM__CADENCE_IMPORT_README = "cadence_import_readme";
    static readonly CONFIGITEM__CADENCE_IMPORT_NET_NAME_CHAR_REPL = "cadence_net_name_char_replacement";
    static readonly CONFIGITEM__CADENCE_IMPORT_DEFAULT_REGION = "cadence_default_region_name";
    
    static readonly CONFIGITEM__Name_Check_Settings = "name_check_setting";

    static readonly CONFIGITEM__Progress_Status_Display_Settings = "progress_status_display_settings";

    static readonly CONFIGITEM__Permission_Roles = "permission_roles";

    static readonly CONFIGITEM__Org_Settings = "org_settings";

    static readonly CONFIGITEM__Separate_FrontSide_BackSide_Grouping = "separate_frontside_backside_grouping";

    static readonly CONFIGITEM__Net_Extraction_Exclusions = "net_extraction_exclusions";
}


export enum AppConfigConstantsBucketType {
    BUCKET_TYPE_GENERAL_CONFIGS = "BUCKET_TYPE_GENERAL_CONFIGS",
    BUCKET_TYPE_INTERFACE_TEMPLATES = "BUCKET_TYPE_INTERFACE_TEMPLATES",
    BUCKET_TYPE_CONSTRAINT_SETTINGS = "BUCKET_TYPE_CONSTRAINT_SETTINGS"
}




























// export enum LockStatusEnum { 
//     OFF = "OFF", 
//     ON = "ON" 
// }

// static readonly CONFIGITEM__Orgs = "orgs";

    // static readonly APP_ID = "6712e075c268827d25139691";
    // static readonly BUCKETID__MAIN_GENERAL_CONFIG = "6712e075c268827d25139692";
    // static readonly BUCKETID__IMPORT_EXPORT_CONFIG = "6712e075c268827d25139695";




//await verifyNaming([iface.name], false, "interface name", NAMING_MAX_CHAR_LENGTH)
// export const PRODUCTION = "Production";
// export const PREVIEW = "Preview";
// export const DEVELOPMENT = "Development";
// export const MONGO_ID_CHECK_REGEX_PATTERN: RegExp = /^[0-9a-fA-F]{24}$/;




// export enum CES_LINE_SPLIT_INDEXES {
//     RULE_LAYER_SEG = 0,
//     REGION_SEG = 1,
//     RULE_STR_SEG = 2,
//     VALUE = 3
// }

// export enum CES_FromToIndex { FROM = 0, TO = 2 };