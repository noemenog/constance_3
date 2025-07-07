import { ObjectId } from "mongodb";
import { DataMappingTypeEnum, NetclassNodeGenTypeEnum, ConstraintTypesEnum, InterfaceInitTypeEnum, StackupSideEnum } from "./Constants";
import { BaseUserInfo, BasicKVP, BasicProperty, EditorNotesData, NCStats, PropertyItem } from "./HelperModels";


export interface DBIdentifiable {
    _id?: string | ObjectId;
}

export interface ServiceModel extends DBIdentifiable { //extends mongo.Document, mongo.OptionalUnlessRequiredId<any>{
    projectId: string;
    snapshotSourceId: string;
    contextProperties: BasicProperty[];
    lastUpdatedOn: Date;
}


//===================================================================================
//========================== PROJECT ================================================
export interface Project extends ServiceModel {
    name: string;
    org: string;
    owner: BaseUserInfo;
    createdOn: Date;
    createdBy: string;
    description: string;
    maturity: string,
    enabled: boolean;
    lockedBy: string|null;
    notes: EditorNotesData|null;
    physicalLinkages: LinkageInfo[];
    clearanceLinkages: LinkageInfo[];
    clearanceRelationBrands: BasicProperty[];
    constraintSettings: PropertyItem[];
    associatedProperties: PropertyItem[];
    profileProperties: PropertyItem[];
}

export interface LinkageInfo extends BasicProperty {
    ruleAreaId: string,
    sourceElementId : string;
    confineToRuleArea: boolean;
    value: string[];
    tags: string[];
}

export interface NetListImportDetail {
    id: string,
    fileName: string,
    date: Date,
    totalIncomming: number,
    adjustment: boolean,
    tags: string[],
}


//===================================================================================
//========================== PACKAGE LAYOUT =========================================
export interface PackageLayout extends ServiceModel {
    ruleAreas: RuleArea[];
    layerGroupSets: LayerGroupSet[];
    stackupLayers: StackupLayer[];
    stackupGenInfo: StackupGenInfo|null;
}

export interface StackupLayer {
    id: string;
    index: number;
    name: string;
    thickness: number;
    type: string;
    side: StackupSideEnum;
    routingLayerType: string;
    material: string;
    tags: string[];
}

export interface LayerGroupSet {
    id: string;
    name: string;
    layerGroups: LayerGroup[];
    isGolden: boolean;
    isPhysicalDefault: boolean;
    isClearanceDefault: boolean;
    tags: string[];
}

export interface LayerGroup {
    id: string;
    name: string;
    isActive: boolean;
    layers: Layer[];
    tags: string[];
}

export interface Layer {
    id: string;
    name: string;
    isActive: boolean;
    tags: string[]
}

export interface RuleArea {
    id: string;
    ruleAreaName: string;
    xmodName: string;
    isActive: boolean;
    defaultConstraintId: string,
    visibilityContext: BasicProperty[];
    tags: string[];
}

export interface StackupGenInfo {
    projectId: string,
    type: string,
    technology: string,
    isEmib: boolean,
    isAsymetricStack: boolean,
    isBSRLayer: boolean,
    separateFrontSideBackSideGrouping: boolean,

    cZeroThickness: number,

    frontSideMetalLayers: number,
    frontCoreMetalLayers: number,
    backCoreMetalLayers: number,
    backSideMetalLayers: number,
    corelessLayers: number,

    coreThickness: number,
    coreMaterial: string,

    dielectricOnCoreThickness: number,
    dielectricThickness: number,
    dielectricMaterial: string,
    corelessDielectricThickness: number,
    corelessDielectricMaterial: string,

    solderResistThickness: number,
    solderResistMaterial: string,

    buildupMetalThickness: number,
    corelessBuildupMetalThickness: number,
    coreMetalThickness: number,
    metalType: string,
    initialSelectedRoutingLayers: BasicKVP[],

    tags: string[]
}


//===================================================================================
//========================== INTERFACE +=============================================
export interface Interface extends ServiceModel {
    name: string;
    sourceInterfaceId: string;
    sourceProjectId: string;
    initializationType: InterfaceInitTypeEnum;
    createdOn: Date;
    createdBy: string;
    sourceTemplate: IfaceTplCore;
    shadowVoidEntries: BasicProperty[];
    associatedProperties: PropertyItem[];
    notes: EditorNotesData|null;
}

export interface IfaceTplCore {
    id: string;
    org: string;
    uniqueName: string;
    owner: string;
}

export interface InterfaceTemplate extends IfaceTplCore {
    interfaceName: string;
    contextProperties: BasicProperty[];
    netclasses: BaseNCNode[];
}


//===================================================================================
//========================== G2G Context ===============================================

export type TargetSetType = { enabled: boolean; clearanceRelationBrandId: string; targets: string[]; }

export interface G2GRelationContext extends ServiceModel {
    interfaceId: string;
    channel: string;
    segment: string;
    enabled: boolean;
    intraclass: { enabled: boolean; clearanceRelationBrandId: string; },
    toAll: { enabled: boolean; clearanceRelationBrandId: string; },
    within: { enabled: boolean; clearanceRelationBrandId: string; },
    across: Array<TargetSetType>
    tags: string[];
}


//===================================================================================
//========================== NETCLASS ===============================================
export interface BaseNCNode {
    name: string;
    pattern: string;
    patternIndex: number,
    segment: string,
    nodeType?: NetclassNodeGenTypeEnum;
}

export interface Netclass extends BaseNCNode, ServiceModel {
    interfaceId: string;
    layerGroupSetId: string;
    channel: string, 
    enableC2CRow: boolean;
    enableC2CColumn: boolean;
    associatedProperties: PropertyItem[];
}


//===================================================================================
//========================== NET ================================================
export interface Net extends ServiceModel {
    interfaceId: string;
    name: string;
    netclassMapType: DataMappingTypeEnum;
    netclassId: string;
    constraintClassId: string;
    diffPairNet: string;
    diffPairMapType: DataMappingTypeEnum; //do not rename without revising the diff pairing query string (aka AGG_QUERY_DIFF_PAIR_FORMATION)
    tags: string[];
    associatedProperties: PropertyItem[];
}



//===================================================================================
//========================== CONSTRAINTS =============================================
export interface LayerGroupConstraints extends ServiceModel {
    ownerElementId: string,
    ruleAreaId: string;
    layerGroupId: string;
    constraintType: ConstraintTypesEnum;
    associatedProperties: PropertyItem[];
}

export interface DefaultConstraints extends ServiceModel {
    fileName: string;
    nameIdentifier: string;
    description: string;
    sourceDefaultConstraintsId: string;
    createdOn: Date;
    isGolden: boolean;
    constraints: DefConEntry[];
    tags: string[];
}

export interface DefConEntry extends BasicProperty{
    xmodName: string;
    layerName: string;
    constraintType: string;
    value: string;
}



//===================================================================================
//========================== C2C ROW =======================================
export interface C2CRow extends ServiceModel{
    name?: string,
    ruleAreaId: string;
    netclassId: string;
    slots: C2CRowSlot[];
    tags: string[];
}

export interface C2CRowSlot extends BasicProperty{  //NOTE: Do NOT ever set the BaseProperty's 'name' item programatically. Leave it alone!
    netclassId: string;
    assignmentType?: DataMappingTypeEnum;
    value: string;
}



//===================================================================================
//========================== POWER INFO =============================================
export interface PowerInfo extends ServiceModel {
    rails: BasicProperty[];
    components: BasicProperty[];
    associatedProperties: PropertyItem[];
}



//===================================================================================
//========================== SNAPSHOT CONTEXT =======================================
export interface SnapshotContext extends ServiceModel  {
    name: string;
    enabled: boolean;
    components: string[];
}




//===================================================================================
//========================== CHANGE TRACKER CONTEXT =======================================
export interface ChangeContext extends ServiceModel {
    uniqueId: string,  //itemId
    tags: string[],
    data: any;
    diffContext: { time: Date, agent: string, delta: any }[],
}

























// export interface G2GRelationInfo {
//     id: string;
//     setToAll: boolean;
//     setWithin: boolean;
//     setIntraclass: boolean;
//     clearanceRelationBrandAcross: string;
//     clearanceRelationBrandWithin: string;
//     value: string[];
//     tags: string[];
// }



// export interface LinkageDetail {
//     id: string,
//     interfaceId: string,
//     ruleAreaId?: string,
//     layerGroupSetId?: string,
//     classificationId?: string,
//     tags: string[],
// }




// export interface ServiceModel { //extends mongo.Document, mongo.OptionalUnlessRequiredId<any>{
//     _id?: string | ObjectId;
//     projectId: string;
//     snapshotSourceId: string;
//     contextProperties: BasicProperty[];
//     lastUpdatedOn: Date;
// }

// "interfaceId": "dsfsdffww32432323fwef",
//     "Cset": "asdas",
//     "property": "TRACE_TO_WIDTH",
//     "previous_value": 33,
//     "new_value": 44,
//     "timestamp" : "2024-03-25T11:48:26.1260865-07:00"
//     "user" : { }



// physicalInterfaceExclusionList: string[];
// clearanceInterfaceExclusionList: string[];


// export interface PowerRails {
//     id: string;
//     rail: string;
//     voltage: string;
//     totalCurrent: string;
//     pkgPins: string;
//     diePins: string;
// }

// export interface PowerCapsComponents {
//     id: string;
//     refdes: string;
//     pin: string;
//     cell: string;
//     pDB: string;
//     net: string;
//     formFactor: string;
//     value: string;
//     stuffed: string;
// }

// export interface PowerSheets {
//     id: string;
//     name: string;
//     sheetData: string;
// }



// export interface ConstraintChangeContext extends ServiceModel  {
//     interfaceId: string;
//     csetId: string;
//     csetPropSetIdentifier: string;
//     changedPropertyid: string;
//     previousValue: string;
//     newValue: string;
//     timestamp : string;
//     user : User;
// }



// export class C2CRow implements ServiceModel {  //needed to make this a class!
//     _id?: string | ObjectId | undefined;
//     projectId: string;
//     snapshotSourceId: string;
//     contextProperties: BasicProperty[];
//     lastUpdatedOn: Date;

//     name?: string;
//     ruleAreaId: string;
//     netclassId: string;
//     slots: C2CRowSlot[]; //WARNING!! Do not rename this field item!!!. It is refered to by plain string elsewhere in codebase 
//     tags: string[];
// }

// export interface C2CRowSlot extends BasicProperty{
//     netclassId: string;
// }
