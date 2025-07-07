import { ErrorSeverityValue, NetManagementActionTypeEnum, PendingProcessActionTypeEnum, PermissionActionEnum } from "./Constants";
import { DefaultConstraints, Interface, Net, Netclass, PackageLayout, PowerInfo, Project, RuleArea, SnapshotContext } from "./ServiceModels";
import { ActionSceneEnum, UIMessageType } from "./Constants";
import { NodeModel } from "@minoru/react-dnd-treeview";




export interface SPDomainData {
    projectCollection: Project[];
    project : Project | null;
    interfaceList : Interface[];
    selectedIface: Interface | null
    selectedIfaceCollaterals: StorageCollateralInfo[];
    selectedRuleArea: RuleArea | null;
    packageLayout: PackageLayout | null;
    powerInfo : PowerInfo | null;
    defaultConstraints : DefaultConstraints | null;
    netclasses : Netclass[];
    snapshots : SnapshotContext[];
    c2cColToIndexMap: Map<string, number>;
    clrRelationsMappingForCurrentIface: Map<string, BasicProperty[]>;
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
    okCriteria?: string[],
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

export interface NodeSelectionCtx { 
    node: NodeModel<any>; 
    interfaceId: string; 
    netclassId: string, 
    type: string
}

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


export interface PollingInfoContext {
    type: PendingProcessActionTypeEnum,
    mainMessageOnProc: string,
    spinnerMessageOnProc: string,
    messageOnCompletion: string,
    messageOnError: string,
    setBackdropBlocker: boolean,
    actionOnCompletion: () => void,
    setStateChange: React.Dispatch<React.SetStateAction<boolean>>,
    getStartTime: () => number|null
}














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
//     setToDiffPairEntity: boolean,
//     defConKeySet?: string[],
//     genericKey?: string,
//     apdKey?: string,
//     xpeditionKey?: string,
//     xpeditionDataIndex?: string | number
// }




// export interface StackupThickness {
//     buildupMetal: number;
//     coreMetal: number;
//     dielectric: number;
//     coreDielectric: number;
//     core: number;
//     sR: number;
// }

// export interface StackupMaterial {
//     dielectric: string;
//     core: string;
//     sR: string;
// }





// export interface NetListUploadPropValue
// {
//     uploadDate: Date,
//     totalNets: number,
//     adjustmentPerformed: boolean
// }

    // category: string;       
    // id: string;             
    // description: string;    action
    // enabled: boolean;       
    // tags?: string[];        projectId
    // name: string;           fileName
    // value: any;             {}


    //===========================================



    // export interface BasicKVP {
    //     key: string;
    //     value: any;
    // }
    
    // export interface BasicProperty {
    //     id: string;
    //     name: string;
    //     value: any;
    // }
    
    // export interface SubProp extends BasicKVP {
    //     subcategory: string;
    //     valueType?: ValueTypeEnum;
    // }
    
    // export interface PropertyItem extends BasicProperty {
    //     category: string;
    //     displayName?: string,
    //     editable: boolean;
    //     enabled: boolean;
    //     subProperties?: SubProp[];
    // }