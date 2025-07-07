import { ErrorSeverityValue, NetManagementActionTypeEnum } from "./Constants";
import { Net } from "./ServiceModels";


export interface BaseUserInfo {
    email: string,
    idsid: string
}

export interface User extends BaseUserInfo {
    id: string,
    wwid: string
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


export interface NCStats {
    interfaceId: string,
    interfaceName: string,
    netclassId: string,
    netclassName: string,
    manuallyAssigned: number,
    autoAssigned: number,
    totalNetclassNets: number
}



export interface NetSummary {
    projectId: string,
    hasNets: boolean,
    totalNets: number,
    totalNonPairedNets: number,
    totalDiffPairedNets: number,
    totalAssignedNets?: number,
    totalUnassignedNets?: number,
    netclassStats?: NCStats[]
}


export interface NetMgmtCtx {
    projectId: string,
    actionType: NetManagementActionTypeEnum,
    status: string,
    netsInvolved: Net[],
    contextualInfo: string,
}


export interface ConstraintConfDisplayContext {
    subType: string,
    valueSource?: string,
    columnCellKind?: string,
    contentAlign?: string,
    allowOverlay?: boolean,
    allowWrapping?: boolean,
    icon?: string,
    setHighLighted?: boolean,
}


export interface ConstraintConfExportContext {
    subType: string,
    exportEnabled?: boolean,
    setToDiffPairEntity?: boolean,
    defConKeys?: string[],
    apdKeys?: string[],
    xpeditionKeys?: string[],
    extraKeys?: string[],
    okCriteria?: string[]
}


export interface StorageCollateralInfo {
    id: string,
    projectId: string,
    interfaceId: string,
    name: string,
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

    lineCount() : number {
        return this.lines.length;
    }
    
    clear(): void {
        this.lines = [];
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


export interface QuickStatus<T> {
    isSuccessful: boolean,
    message: string, 
    data?: T
}


export class G2GAssessmentData { 
    reusedCRBIdArray : Set<string> = new Set();
    newCRBArray : Array<BasicProperty> = [];
    netclassPairingByName : Set<string> = new Set(); 
    ncidPairingSet : Set<string> = new Set(); 
    ncidPairingToCrbIdMap : Map<string, string> = new Map(); 
}






























// export interface ServiceModel { //extends mongo.Document, mongo.OptionalUnlessRequiredId<any>{
//     _id?: string | ObjectId;
//     projectId: string;
//     snapshotSourceId: string;
//     contextProperties: BasicProperty[];
//     lastUpdatedOn: Date;
// }



// export interface ChangeContext extends ServiceModel, BaseUserInfo  {
//     srcItemId: string,
//     srcItemProperty: string,
//     srcItemCollection: DBCollectionTypeEnum,
//     previous: any,
//     current: any
//     tags: string[];
// }









// export interface AggregateSummary {
//     projectId: string,
//     totalInterfaces: number,
//     totalNetclasses: number,
//     totalStackupLayers: number,
//     totalRuleAreas: number,
//     totalLayerGroupSets: number,
//     totalLayerGroups: number,
//     totalSnapShots: number,
//     totalDefaultConstraintSets: number,
//     hasNets: boolean,
//     totalNets: number,
//     totalNonPairedNets: number,
//     totalDiffPairs: number,
//     totalAssignedNets?: number,
//     totalUnassignedNets?: number,
//     netclassStats?: NCStats[]
// }



// export interface ProjectStats {
//     projectId: string,
//     totalInterfaces: number,
//     totalNetclasses: number,
//     totalStackupLayers: number,
//     totalRuleAreas: number,
//     totalLayerGroupSets: number,
//     totalLayerGroups: number,
//     totalSnapShots: number,
//     totalDefaultConstraintSets: number,
//     hasNets: boolean,
//     totalNets: number,
//     totalNonPairedNets: number,
//     totalDiffPairs: number,
//     totalAssignedNets?: number,
//     totalUnassignedNets?: number,
//     netclassStats?: NCStats[]
// }




// export interface ConstraintConfPropSubContext {
//     subType: string,
//     //---------------------------
//     valueSource?: string,
//     columnCellKind?: string,
//     contentAlign?: string,
//     allowOverlay?: boolean,
//     allowWrapping?: boolean,
//     icon?: string,
//     setHighLighted?: boolean,
//     //---------------------------
//     exportEnabled?: boolean,
//     setToDiffPairEntity?: boolean,
//     defConKeySet?: string[],
//     genericKey?: string,
//     apdKey?: string,
//     xpeditionKey?: string,
//     xpeditionDataIndex?: string | number
// }



// export interface LinkageDetail {
//     interfaceId: string,
//     ruleAreaId: string,
//     layerGroupSetId: string,
//     classificationId: string
// }




// export interface ProjectNetStatInfo {
//     projectId: string,
//     totalNets: number,
//     totalAssigned: number,
//     totalUnassigned: number,
//     totalInterfaces: number,
//     totalNetclasses: number,
//     netclassStats: NCStats[]
// }