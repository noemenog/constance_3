import { AutoGridColumn, BooleanCell, EditableGridCell, GridCell, GridCellKind, GridColumn, GridColumnIcon, GridMouseEventArgs, Rectangle } from "@glideapps/glide-data-grid";
import { BasicProperty, ConstraintValues, PropertyItem, NetMgmtCtx, ConstraintConfDisplayContext, LoadingSpinnerInfo, DisplayOption, QuickStatus } from "../DataModels/HelperModels";
import { changeLGSetForConstraintElement, fetchClassRelationLayout, fetchConstraints, fetchNets, updateClassRelationLayout, updateNets, updateRoutingConstraints } from "./FetchData";
import { C2CRow, G2GRelationContext, Interface, LayerGroup, LayerGroupConstraints, LayerGroupSet, Net, Netclass, RuleArea, TargetSetType } from "../DataModels/ServiceModels";
import { getEnumValuesAsArray, groupBy, newValueMatchesColumnDataType, rfdcCopy } from "./UtilFunctions";
import { DropdownCellType, MultiSelectCellType, TagsCellType, LinksCellType, ButtonCellType } from "@glideapps/glide-data-grid-cells";
import { ConstraintTypesEnum, DataMappingTypeEnum, DIFFNET_PROP_NAME, LGSET_TAG_SORT, NetManagementActionTypeEnum, SPECIAL_BLUE_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, SPECIAL_GOLD_COLOR, SPECIAL_PUPRLE_COLOR, SPECIAL_QUARTZ_COLOR } from "../DataModels/Constants";
import { GridCellEditCtx, GridDropDownOption, GroupRowLineInfo } from "../CommonComponents/BaseGlideGrid";
import { sort } from "fast-sort";




// #region consts
export const NET_NAME_GRID_COLUMN_ID = "NET_NAME_GRID_COLUMN_ID";
export const LGSET_GRID_COLUMN_ID = "LGSET_GRID_COLUMN_ID";
export const LAYER_GROUP_GRID_COLUMN_ID = "LAYERGROUP_GRID_COLUMN_ID";
export const CONSTRAINT_ELEMENT_GRID_COLUMN_ID = "CONSTRAINT_ELEMENT_GRID_COLUMN_ID";

export const C2C_LEFTSIDE_NETCLASS_GRID_COLUMN_ID = "C2C_LEFTSIDE_NETCLASS_GRID_COLUMN_ID";
export const C2C_ALL_GRID_COLUMN_ID = "C2C_ALL_GRID_COLUMN_ID";

export const BASIC_GRID_HEADER_HEIGHT = "26"

export const BASIC_GRID_PAGE_SIZE = 10000
export const LM_GRID_PAGE_SIZE = 10000
export const DIFF_PAIR_NON_PAIRED_GRID_PAGE_SIZE = 100
export const C2C_GRID_PAGE_SIZE = Number.MAX_SAFE_INTEGER
export const RR_GRID_PAGE_SIZE = Number.MAX_SAFE_INTEGER


export enum G2G_COL_TYPE {
    SRC_ITEMS = "SRC_ITEMS",
    
    TOALL_CB = "TOALL_CB",
    TOALL_NAMES = "TOALL_NAMES",

    INTRACLASS_CB = "INTRACLASS_CB",
    INTRACLASS_NAMES = "NCTONC_NAMES",

    WITHIN_CB = "WITHIN_CB",
    WITHIN_NAMES = "WITHIN_NAMES",
    
    ACROSS_BUTTON = "ACROSS_BUTTON",
    ACROSS_NAMES = "ACROSS_NAMES",
    ACROSS_TGT_ITEMS = "ACROSS_TGT_ITEMS"
}


export const DUMMY_ELEMENT_ID_PREFIX = "DUMMY_ELEMENT__"
// #endregion 



//======================================================================================================================================
// #region ============================================================= BASIC NET GRID ================================================
//======================================================================================================================================

export function getBasicNetNameGridColumns() {           
    let netNameCol = { 
        id: NET_NAME_GRID_COLUMN_ID, 
        title: "Net Name", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 400
    }
    let arr = new Array<GridColumn>(netNameCol)
    return arr
}


export function getBasicNetNameGridCellContent(rowEntry: Net, columns: GridColumn[], columnIndex: number) : GridCell {
	let cellObj : GridCell = {
	    kind: GridCellKind.Text,
	    data: rowEntry.name ?? '',
	    allowOverlay: true,
	    displayData: rowEntry.name ?? '',
        readonly: true,
	    contentAlign: "left"  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--content-alignment
	}

    return cellObj;
}


export async function onBasicNetNameGridInitialDataFetch(projectId: string, limit: number, nameStartsWith: string, 
    interfaceId: string|null, netclassId: string|null, nonClassifiedNetsOnly: boolean, excludeProps: boolean) : Promise<Net[]> {
    let netList = new Array<Net>();
    if(projectId && projectId.length > 0) {
        netList = await fetchNets(projectId, null, limit, nameStartsWith, interfaceId, netclassId, nonClassifiedNetsOnly, excludeProps, false, false) ?? []
    }
    return netList
}


export async function onBasicNetNameGridSubsequentDataFetch(projectId: string, lastId: string, limit: number, nameStartsWith: string, 
    interfaceId: string|null, netclassId: string|null, nonClassifiedNetsOnly: boolean, excludeProps: boolean) : Promise<Net[]> {
    let netList = new Array<Net>();
    if(projectId && projectId.length > 0) {
        netList = await fetchNets(projectId, lastId, limit, nameStartsWith, interfaceId, netclassId, nonClassifiedNetsOnly, excludeProps, false, false) ?? []
    }
    return netList
}
// #endregion ==================================================== END: BASIC NET GRID =================================================
//======================================================================================================================================





//======================================================================================================================================
// #region ==================================================== DIFF PAIR GRID =========================================================
//======================================================================================================================================
export function getNonDiffedNetGridColumns() {           
    let netNameCol = { 
        id: NET_NAME_GRID_COLUMN_ID, 
        title: "Net Name", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 400
    }
    let arr = new Array<GridColumn>(netNameCol)
    return arr
}


export function getNonDiffedNetGridCellContent(rowEntry: Net, columns: GridColumn[], columnIndex: number) : GridCell {
	let cellObj : GridCell = {
	    kind: GridCellKind.Text,
	    data: rowEntry.name ?? '',
	    allowOverlay: true,
	    displayData: rowEntry.name ?? '',
        readonly: true,
	    contentAlign: "left"  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--content-alignment
	}

    return cellObj;
}


export async function onNonDiffedGridInitialDataFetch(projectId: string, limit: number, nameStartsWith: string) : Promise<Net[]> {
    let netList = new Array<Net>();
    if(projectId && projectId.length > 0) {
        netList = await fetchNets(projectId, null, limit, nameStartsWith, null, null, false, true, false, true) ?? []
    }
    return netList
}


export async function onNonDiffedGridSubsequentDataFetch(projectId: string, lastId: string, limit: number, nameStartsWith: string) : Promise<Net[]> {
    let netList = new Array<Net>();
    if(projectId && projectId.length > 0) {
        netList = await fetchNets(projectId, lastId, limit, nameStartsWith, null, null, false, true, false, true) ?? []
    }
    return netList
}


export function getDiffPairGridColumns() {           
    let firstNetName = { 
        id: "first_net_name", 
        title: "First Net", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 375
    }

    let secondNetName = { 
        id: "second_net_name", 
        title: "Second Net", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,
        width: 375
    }

    let diffType = { 
        id: "diff_map_type", 
        title: "Pairing Type", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,
        width: 150
    }
    let arr = [firstNetName, secondNetName, diffType]
    return arr
}


export function getDiffPairGridCellContent(rowEntry: Net, columns: GridColumn[], columnIndex: number) : GridCell {
    let colId = columns[columnIndex].id
    let cellObj : GridCell;

    if(colId === "first_net_name") {
        cellObj = {
            kind: GridCellKind.Text,
            data: rowEntry.name,
            allowOverlay: true,
            readonly: true,
            displayData: rowEntry.name,
            contentAlign: "left" //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--content-alignment
        }
    }
    else if (colId === "second_net_name") {
        let dataValue = "";
        if(rowEntry.contextProperties && rowEntry.contextProperties.length > 0){
            let prop = rowEntry.contextProperties.find(a => a.name.toLowerCase() === DIFFNET_PROP_NAME.toLowerCase());
            if(prop && prop.value && prop.value.length > 0) {
                dataValue = prop.value;
            }
        }
        cellObj = {
            kind: GridCellKind.Text,
            data: dataValue,
            allowOverlay: true,
            readonly: true,
            displayData: dataValue,
            contentAlign: "left"
        }
    }
    else if (colId === "diff_map_type") {
        cellObj = {
            kind: GridCellKind.Text,
            data: rowEntry.diffPairMapType,
            allowOverlay: true,
            readonly: true,
            displayData: rowEntry.diffPairMapType,
            contentAlign: "left"
        }
    }
    else {
        cellObj = {
            kind: GridCellKind.Loading,
            allowOverlay: false,
	    }
    }

    return cellObj;
}


export async function onDiffPairGridInitialDataFetch(projectId: string, limit: number, pageSize: number, nameStartsWith: string) : Promise<Net[]> {
    let pulledList = new Array<Net>()
    let finalNetList = new Array<Net>();
    let checkerIdSet = new Set<string>()
    if(projectId && projectId.length > 0) {
        pulledList = await fetchNets(projectId, null, (limit + pageSize), nameStartsWith, null, null, false, true, true, false) ?? []
        for(let i = 0; i < pulledList.length; i++) {
            if(pulledList[i].diffPairNet && pulledList[i].diffPairNet.length > 0) {
                if(checkerIdSet.has(pulledList[i]._id) || checkerIdSet.has(pulledList[i].diffPairNet)) {
                    continue;
                }
                else {
                    checkerIdSet.add(pulledList[i]._id);
                    checkerIdSet.add(pulledList[i].diffPairNet);
                    finalNetList.push(pulledList[i]);
                }
            }
        }
    }
    return finalNetList
}


export async function onDiffPairGridSubsequentDataFetch(projectId: string, lastId: string, limit: number, pageSize: number, nameStartsWith: string) : Promise<Net[]> {
    let pulledList = new Array<Net>()
    let finalNetList = new Array<Net>();
    let checkerIdSet = new Set<string>()
    if(projectId && projectId.length > 0) {
        pulledList = await fetchNets(projectId, lastId, (limit + pageSize), nameStartsWith, null, null, false, true, true, false) ?? []
        for(let i = 0; i < pulledList.length; i++) {
            if(pulledList[i].diffPairNet && pulledList[i].diffPairNet.length > 0) {
                if(checkerIdSet.has(pulledList[i]._id) || checkerIdSet.has(pulledList[i].diffPairNet)) {
                    continue;
                }
                else {
                    checkerIdSet.add(pulledList[i]._id);
                    checkerIdSet.add(pulledList[i].diffPairNet);
                    finalNetList.push(pulledList[i]);
                }
            }
        }
    }
    return finalNetList
}
// #endregion ===================================================== END: DIFF PAIR GRID ================================================
//======================================================================================================================================




//======================================================================================================================================
// #region ============================================================= LENGTH MATCHING GRID ==========================================
//======================================================================================================================================
export async function onLMGridInitialDataFetch(projectId: string, limit: number, nameStartsWith: string, interfaceId: string|null, netclassId: string|null) : Promise<Net[]> {
    let netList = new Array<Net>();
    if(projectId && projectId.length > 0) {
        netList = await fetchNets(projectId, null, limit, nameStartsWith, interfaceId, netclassId, false, false, false, false) ?? []
    }
    return netList
}


export async function onLMGridSubsequentDataFetch(projectId: string, lastId: string, limit: number, nameStartsWith: string, interfaceId: string|null, netclassId: string|null) : Promise<Net[]> {
    let netList = new Array<Net>();
    if(projectId && projectId.length > 0) {
        netList = await fetchNets(projectId, lastId, limit, nameStartsWith, interfaceId, netclassId, false, false, false, false) ?? []
    }
    return netList
}


export function onLMEvaluateFillPattern(patternSource: Rectangle, fillDestination: Rectangle, columns: GridColumn[], rowEntry: Net): boolean {
    if(patternSource && patternSource.x === 0) {
        return false;
    }
    if(fillDestination && fillDestination.x === 0) { 
        return false;
    }
    if(fillDestination && fillDestination.width > 1) {  //allow only vertical fill
        return false;
    }
    return true
}


export async function onLMGridCellEdited(editCtx : GridCellEditCtx<Net>, otherNetId: string|null) : Promise<Net | undefined> {
    if(editCtx.columnIndex === 0) {
        if (editCtx.newValue.kind !== GridCellKind.Text) return undefined;
    }
    else{
        //NOTE: Column ID is Net property Name
        let currentNet = editCtx.current
        if(currentNet.associatedProperties && currentNet.associatedProperties.length > 0) {
            for(let i = 0; i < currentNet.associatedProperties.length; i++) {
                if(currentNet.associatedProperties[i].name === editCtx.columnElement.id) {
                    
                    //Important to set default empty string for 'value'!!
                    // let value : any = ((editCtx.newValue.kind.toLowerCase() === "custom") ? (editCtx.newValue.data as any).value : editCtx.newValue.data) ?? ''
                    
                    let value : any = '';
                    if(editCtx.newValue.kind.toLowerCase() === "custom") {
                        value = (editCtx.newValue.data as any).value;
                    }
                    else if((editCtx.newValue.kind.toLowerCase() === "number") && (editCtx.newValue.data === 0)) {
                        value = editCtx.newValue.data
                    } 
                    else {
                        value = editCtx.newValue.data || ''
                    }

                    if(newValueMatchesColumnDataType(value, editCtx.newValue.kind, editCtx.columnElement) === true){
                        currentNet.associatedProperties[i].value.customValue = value.toString().trim();
                        let updaterArray = [currentNet];

                        if(otherNetId && otherNetId.trim().length > 0) {
                            let partnerNet : Net = {
                                _id: otherNetId, //important item here!
                                snapshotSourceId: "",
                                contextProperties: [],
                                lastUpdatedOn: new Date(),
                                projectId: currentNet.projectId,  //important item here
                                interfaceId: "",
                                name: "", //inconsequential
                                netclassMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                                netClassId: "",
                                constraintClassId: "",
                                diffPairNet: "", //inconsequential
                                diffPairMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                                tags: [],
                                associatedProperties: [currentNet.associatedProperties[i]]
                            }
                            updaterArray.push(partnerNet)
                        }

                        let updateCtx : NetMgmtCtx = {
                            projectId: currentNet.projectId,
                            actionType: NetManagementActionTypeEnum.UPDATE_NET_PROPERTY_VALUE,
                            status: "",
                            netsInvolved: updaterArray,
                            contextualInfo: editCtx.columnElement.id //important!!
                        }
                        let resCtx = await updateNets(updateCtx)
                        if(resCtx && resCtx.status.toLowerCase() === "success" && resCtx.netsInvolved && resCtx.netsInvolved.length > 0) {
                            let updatedNet = resCtx.netsInvolved.find(x => x._id?.toString() === currentNet._id?.toString())
                            return updatedNet 
                        }
                    }
                    else{
                        console.error(`glide grid cell editing cannot proceed. data is not of expected type`)
                    }
                }
            }
        }
    }
    
    return undefined;  //this will cause no update to occur on grid
}


export function getLMGridColumns(relevantPropMapping: Map<string, PropertyItem>) {   
    let gridColumnIcons = getEnumValuesAsArray(GridColumnIcon)

    let netNameCol = { 
        id: NET_NAME_GRID_COLUMN_ID, 
        title: "Net Name", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 300
    }
    
    let arr = new Array<GridColumn>(netNameCol)

    if(relevantPropMapping && relevantPropMapping.size > 0) {
        for (let [name, prop] of relevantPropMapping) {
            let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
            if(displaySettings) {
                let item : any = { 
                    id: name, //Column ID is Net property Name
                    title: prop.displayName ?? '', 
                    style: displaySettings.setHighLighted && displaySettings.setHighLighted === true ? "highlight" : "normal",
                    allowWrapping: displaySettings.allowWrapping ? displaySettings.allowWrapping : true,
                    icon: gridColumnIcons.has(displaySettings.icon ?? '') ? displaySettings.icon : GridColumnIcon.HeaderString
                };  
                arr.push(item)
            }
        }
    }

    return arr
}


export function getLMGridCellContent(relevantPropMapping: Map<string, PropertyItem>, matchGroupOptions: GridDropDownOption[], rowEntry: Net, columns: GridColumn[], columnIndex: number) : GridCell {
	let gridCellKinds = getEnumValuesAsArray(GridCellKind)
    let netPropEntryArr: any[] = (rowEntry as Net).associatedProperties.map(x => [x.name, x.value]);
    
    let map = new Map<string, ConstraintValues>(netPropEntryArr)
    let netNameVal : ConstraintValues = {id: '', configValue: '', defautlValue: rowEntry.name, customValue: rowEntry.name};
    map.set(NET_NAME_GRID_COLUMN_ID, netNameVal)
    let key = columns[columnIndex]?.id ?? ''
    let focusVal = map.get(key)
    let dataValue = '' 
    
    if(focusVal) {
        //WARNING: order matters here. custom value must come first!
        if(focusVal && focusVal.customValue.trim().length > 0) {
            dataValue = focusVal.customValue;
        }
        else if(focusVal && focusVal.defautlValue.trim().length > 0) { 
            dataValue = focusVal.defautlValue;
        }
        else if(focusVal && focusVal.configValue.trim().length > 0) {
            dataValue = focusVal.configValue;
        }
    }

    if(columnIndex === 0) {
        let cellObj : GridCell = {
            kind: GridCellKind.Text,
            data: dataValue,
            allowOverlay: true,
            readonly: true,
            displayData: dataValue,
            contentAlign: "left"
        }
        return cellObj;
    }
    else if(key && key.length > 0) {
        let prop: PropertyItem = relevantPropMapping.get(key) as PropertyItem;
        
        let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
        if(displaySettings) {
            
            //Cell Kinds:
            //  https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--all-cell-kinds
            //  https://glideapps.github.io/glide-data-grid/?path=/story/extra-packages-cells--custom-cells
            //  https://www.npmjs.com/package/@glideapps/glide-data-grid-cells
            //  https://docs.grid.glideapps.com/api/cells

            if(gridCellKinds.has(displaySettings.columnCellKind ?? '')) {
                let cellObj : GridCell = {
                    kind: (gridCellKinds.has(displaySettings.columnCellKind ?? '') ? displaySettings.columnCellKind : GridCellKind.Text) as any,
                    data: dataValue,
                    allowOverlay: displaySettings.allowOverlay ?? true,
                    displayData: dataValue,
                    contentAlign: columnIndex === 0   //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--content-alignment
                        ? "left" 
                        : ((displaySettings.contentAlign && ["left", "right", "center"].includes(displaySettings.contentAlign.toLowerCase())) ? displaySettings.contentAlign : "center") as any 
                }
                return cellObj
            }
            else {
                if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "dropdowncell") {
                    if(displaySettings.valueSource?.toLowerCase() === "length_match_group") {
                        let cellObj: DropdownCellType = {
                            kind: GridCellKind.Custom,
                            allowOverlay: displaySettings.allowOverlay ?? true,
                            copyData: "4",
                            readonly: false,
                            style: "normal",                            
                            data: {
                                kind: "dropdown-cell",
                                allowedValues: [null, ...matchGroupOptions], //Example:  [null, "Good", "Better", { value: "best", label: "Best" }],
                                value: dataValue,
                            }
                        };
                        return cellObj;
                    }
                }
                else if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "buttoncell") {
                    //nothing here for now.
                }
                else if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "rangecell") {
                    //nothing here for now
                }
            }
        }
    }
    
    return {
        kind: GridCellKind.Loading,
        allowOverlay: false,
    };
}
// #endregion ================================================= END: LENGTH MATCHING GRID ==============================================
//======================================================================================================================================




//======================================================================================================================================
// #region ============================================================= COMMON ROUTING RULES GRID =====================================
//======================================================================================================================================
export async function onCommonRoutingRulesGridInitialDataFetch(constraintType: ConstraintTypesEnum, grouperMapping: Map<string, Netclass> | Map<string, BasicProperty>, 
    lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>, projectId: string, limit: number, ruleAreaId: string, interfaceId: string|null, 
    nameStartsWith: string|null, excludeProps: boolean) : Promise<{ data: LayerGroupConstraints[], groupInfo: GroupRowLineInfo[], firstEntryMap: Map<string, string>}> {
    
    let newLgcList = new Array<LayerGroupConstraints>();
    let returnGroupingInfo = new Array<GroupRowLineInfo>();
    let initPulledLgcData = new Array<LayerGroupConstraints>();
    let firstInLineItemsMap = new Map<string, string>();

    if(projectId && projectId.length > 0) {
        initPulledLgcData = await fetchConstraints(projectId, null, limit, ruleAreaId, null, interfaceId, null, nameStartsWith, constraintType, excludeProps) ?? []
        
        
        if(initPulledLgcData.length > 0) {            
            let filterOutLGCs = new Set<string>();
            
            for(let lgc of initPulledLgcData) {
                let itemMarkedForExclusion = false;
                
                //for clearance scenario, filter out LGCs that do not pertain to the relevant relation names
                if(constraintType === ConstraintTypesEnum.Clearance) {
                    if(grouperMapping.has(lgc.ownerElementId) === false) {
                        filterOutLGCs.add(lgc._id?.toString() as string);
                        itemMarkedForExclusion = true;
                    }
                }

                //filter out LCGs that do not belong to LGSets that are assigned to the involved ownerElement
                if(itemMarkedForExclusion === false) {
                    let grouperElement : Netclass | BasicProperty = grouperMapping.get(lgc.ownerElementId) as Netclass | BasicProperty
                    let grouperLgSetId = (constraintType === ConstraintTypesEnum.Physical) ? (grouperElement as Netclass).layerGroupSetId : (grouperElement as BasicProperty).value;
                    let layerGroupMappingForLGSet = lgSetMapping.get(grouperLgSetId)?.lgMapping;
                    if(layerGroupMappingForLGSet && layerGroupMappingForLGSet.has(lgc.layerGroupId) === false) {
                        filterOutLGCs.add(lgc._id?.toString() as string)
                        itemMarkedForExclusion = true;   //for good measures
                    }
                    else if(layerGroupMappingForLGSet && layerGroupMappingForLGSet.has(lgc.layerGroupId)) {
                        // this will hide layer groups that have been disabled
                        if(layerGroupMappingForLGSet.get(lgc.layerGroupId)?.isActive === false) {
                            filterOutLGCs.add(lgc._id?.toString() as string)
                            itemMarkedForExclusion = true;   //for good measures
                        }
                    }  
                }
            }

            if(filterOutLGCs.size > 0) {
                initPulledLgcData = initPulledLgcData.filter(a => (filterOutLGCs.has(a._id?.toString()) === false))
            }    
        }
        


        if(initPulledLgcData.length > 0) {
            let mapped : Map<string, LayerGroupConstraints[]> = groupBy(initPulledLgcData, a => a.ownerElementId);
            
            //Sort the initial grouping by keys
            mapped = new Map(
                [...mapped.entries()].sort((a, b) => {
                    let nc_a = (grouperMapping.get(a[0]) as Netclass | BasicProperty).name
                    let nc_b = (grouperMapping.get(b[0]) as Netclass | BasicProperty).name
                    return nc_a.localeCompare(nc_b);
                })
            );

            let count = 0

            for(let [key, value] of mapped) {
                
                let grouperElement : Netclass | BasicProperty = grouperMapping.get(key) as Netclass | BasicProperty
                let grouperId = (constraintType === ConstraintTypesEnum.Physical) ? (grouperElement as Netclass)._id : (grouperElement as BasicProperty).id;
                let grouperLgSetId = (constraintType === ConstraintTypesEnum.Physical) ? (grouperElement as Netclass)?.layerGroupSetId : (grouperElement as BasicProperty)?.value;
                let grouperName = grouperElement?.name;

                //handle group row header info
                let info : GroupRowLineInfo = {
                    index: count, //the index where dummy item lives
                    headerText: grouperName ?? '',
                    elementId: key, 
                    isCollapsed: false
                };
                returnGroupingInfo.push(info);

                // Perform Sort for value section - if sort is enabled
                let mappedItemLGSSet = lgSetMapping.get(grouperLgSetId)
                let indexMap = new Map<string, number>();
                let index = 0;
                
                mappedItemLGSSet?.lgMapping.forEach((value, key) => { indexMap.set(key, index++) });
                
                if(mappedItemLGSSet && mappedItemLGSSet.lgSetObj && mappedItemLGSSet.lgSetObj.tags.includes(LGSET_TAG_SORT)){
                    //normal sorting...
                    value = value.sort((a, b) => {
                        let a_layerGroupName = mappedItemLGSSet.lgMapping.get(a.layerGroupId)?.name as string;
                        let b_layerGroupName = mappedItemLGSSet.lgMapping.get(b.layerGroupId)?.name as string; 
                        return (a_layerGroupName < b_layerGroupName ? -1 : 1) 
                    });
                }
                else {
                    //Important! Sorting to make sure the original setup is retained
                    value = value.sort((a, b) => {
                        let a_layerGroupIndex = indexMap.get(a.layerGroupId) as number;
                        let b_layerGroupIndex = indexMap.get(b.layerGroupId) as number;
                        return (a_layerGroupIndex < b_layerGroupIndex ? -1 : 1) 
                    });
                }

                //Important! This needs to happen after sort!!
                firstInLineItemsMap.set(grouperId as string, value[0]._id)

                let dummyLGC : LayerGroupConstraints = {
                    _id: `${DUMMY_ELEMENT_ID_PREFIX}${key}`, //important! leave this as is - especially the prefix string!
                    ownerElementId: value[0].ownerElementId,  
                    ruleAreaId: ruleAreaId,
                    layerGroupId: initPulledLgcData[0].layerGroupId, //necessary dummy value
                    constraintType: constraintType,
                    associatedProperties: [],  //IMPORTANT that dummy does not have any associated properties!!!!!! fillhandle checks this in order to skip dummy
                    projectId: projectId,
                    snapshotSourceId: "",
                    contextProperties: [],
                    lastUpdatedOn: new Date()
                }
                
                newLgcList = count === 0 ? [dummyLGC, ...value] : newLgcList.concat([dummyLGC, ...value]);
                count = newLgcList.length;
            }
        }

    }

    return { data: newLgcList, groupInfo: returnGroupingInfo, firstEntryMap: firstInLineItemsMap }
}


export function getCommonRoutingRulesGridColumns(relevantPropMapping: Map<string, PropertyItem>, constraintType: ConstraintTypesEnum) {   
    let gridColumnIcons = getEnumValuesAsArray(GridColumnIcon)

    let netclassCol = { 
        id: CONSTRAINT_ELEMENT_GRID_COLUMN_ID, 
        title: (constraintType === ConstraintTypesEnum.Clearance) ? "Clearance Relation" : "Netclass", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 200
    }

    let lgSetCol = { 
        id: LGSET_GRID_COLUMN_ID, 
        title: "LG-Set", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 200
    }

    let lgNameCol = { 
        id: LAYER_GROUP_GRID_COLUMN_ID, 
        title: "LayerGroup", 
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 200
    }

    let arr = new Array<GridColumn>().concat([netclassCol, lgSetCol, lgNameCol])

    if(relevantPropMapping && relevantPropMapping.size > 0) {
        for (let [name, prop] of relevantPropMapping) {
            let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
            if(displaySettings) {
                let item : any = { 
                    id: name, //Column ID is property 'Name'
                    title: prop.displayName ?? '', 
                    style: displaySettings.setHighLighted && displaySettings.setHighLighted === true ? "highlight" : "normal",
                    allowWrapping: displaySettings.allowWrapping ? displaySettings.allowWrapping : true,
                    icon: gridColumnIcons.has(displaySettings.icon ?? '') ? displaySettings.icon : GridColumnIcon.HeaderString
                };  
                arr.push(item)
            }
        }
    }

    return arr
}


export function getCommonRoutingRulesGridCellContent(constraintType: ConstraintTypesEnum, grouperMapping: Map<string, Netclass> | Map<string, BasicProperty>, firstEntryMap: Map<string, string> | null,
    lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>, 
    lgSetOptions: GridDropDownOption[], relevantPropMapping: Map<string, PropertyItem>, 
    rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number) : GridCell {

	let gridCellKinds = getEnumValuesAsArray(GridCellKind)
    let propEntryArr: any[] = (rowEntry as LayerGroupConstraints).associatedProperties.map(x => [x.name, x.value]);
    
    let map = new Map<string, ConstraintValues>(propEntryArr)
    
    let grouperElement : Netclass | BasicProperty = grouperMapping.get(rowEntry.ownerElementId) as Netclass | BasicProperty
    let grouperId = (constraintType === ConstraintTypesEnum.Physical) ? (grouperElement as Netclass)._id : (grouperElement as BasicProperty).id;
    let grouperLgSetId = (constraintType === ConstraintTypesEnum.Physical) ? (grouperElement as Netclass).layerGroupSetId : (grouperElement as BasicProperty).value;
    let grouperName = grouperElement?.name;
    let grouperVal : ConstraintValues = {id: '', configValue: '', defautlValue: grouperName ?? '', customValue: grouperName?? ''};
    map.set(CONSTRAINT_ELEMENT_GRID_COLUMN_ID, grouperVal)

    let lgSet = lgSetMapping.get(grouperLgSetId)?.lgSetObj
    let lgSetName = lgSet?.name as string
    let lgSetVal : ConstraintValues = {id: '', configValue: '', defautlValue: lgSetName, customValue: lgSetName};
    map.set(LGSET_GRID_COLUMN_ID, lgSetVal)

    let layerGroupName = lgSetMapping.get(grouperLgSetId)?.lgMapping.get(rowEntry.layerGroupId)?.name as string
    let layerGroupVal : ConstraintValues = {id: '', configValue: '', defautlValue: layerGroupName, customValue: layerGroupName};
    map.set(LAYER_GROUP_GRID_COLUMN_ID, layerGroupVal)

    let key = columns[columnIndex]?.id ?? ''
    let focusVal = map.get(key)
    let dataValue = '' 
    
    // WARNING: 'layerGroupName' may be undefined imidiately after switching LGSet, so thats why we check for it here
    if(focusVal && layerGroupName) {
        //WARNING: order matters here. custom value must come first!
        if(focusVal.customValue.trim().length > 0) {
            dataValue = focusVal.customValue;
        }
        else if(focusVal.defautlValue.trim().length > 0) {
            dataValue = focusVal.defautlValue;
        }
        else if(focusVal.configValue.trim().length > 0) {
            dataValue = focusVal.configValue;
        }
    }
    
    if(columnIndex === 0) {
        let cellObj : GridCell = {
            kind: GridCellKind.Loading,
            allowOverlay: false,
        }
        return cellObj;
    } 
    else if (columnIndex === 1) { 
        if(firstEntryMap && firstEntryMap.size > 0 && firstEntryMap.get(grouperId) === rowEntry._id){ //IMPORTANT!!
            let cellObj: DropdownCellType = {
                kind: GridCellKind.Custom,
                allowOverlay: true,
                readonly: false,
                copyData: "4",
                style: "normal",                            
                data: {
                    kind: "dropdown-cell",
                    allowedValues: [null, ...lgSetOptions],
                    value: lgSet?.id,
                },
                themeOverride: {
                    // accentColor: "rgba(71, 71, 71, 0.781)", //for cell border and currently/already selected option
                    accentLight: "#212121", //"#203f5c",  //for box selected and options hovered
                    bgCell: "rgba(7, 18, 15, .3)",
                }
            };
            return cellObj;
        }
        else {
            let cellObj : GridCell = {
                kind: GridCellKind.Loading,
                allowOverlay: false,
            }
            return cellObj;
        }
    }
    else if (columnIndex === 2) {
        let cellObj : GridCell = {
            kind: GridCellKind.Text,
            data: dataValue,
            allowOverlay: true,
            readonly: true,
            displayData: dataValue,
            contentAlign: "left"
        }
        return cellObj;
    }
    else if(key && key.length > 0) {
        let prop: PropertyItem = relevantPropMapping.get(key) as PropertyItem;
        let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
        if(displaySettings) {
            
            //Cell Kinds:
            //  https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--all-cell-kinds
            //  https://glideapps.github.io/glide-data-grid/?path=/story/extra-packages-cells--custom-cells
            //  https://www.npmjs.com/package/@glideapps/glide-data-grid-cells
            //  https://docs.grid.glideapps.com/api/cells

            if(gridCellKinds.has(displaySettings.columnCellKind ?? '')) {
                let cellObj : GridCell = {
                    kind: (gridCellKinds.has(displaySettings.columnCellKind ?? '') ? displaySettings.columnCellKind : GridCellKind.Text) as any,
                    data: dataValue,
                    allowOverlay: displaySettings.allowOverlay ?? true,
                    readonly: false,
                    displayData: dataValue,
                    contentAlign: ((displaySettings.contentAlign && ["left", "right", "center"].includes(displaySettings.contentAlign.toLowerCase())) ? displaySettings.contentAlign : "center") as any 
                }
                return cellObj
            }
            else {
                if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "dropdowncell") {
                    //nothing here for now
                }
                else if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "buttoncell") {
                    //nothing here for now.
                }
                else if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "rangecell") {
                    //nothing here for now
                }
            }
        }
    }
    
    return {
        kind: GridCellKind.Loading,
        allowOverlay: false,
    };
}


export function onCommonRoutingRulesEvaluateFillPattern(patternSource: Rectangle, fillDestination: Rectangle, columns: GridColumn[], rowEntry: LayerGroupConstraints): boolean {
    if(patternSource && patternSource.x < 3) {
        return false;
    }
    if(fillDestination && fillDestination.x < 3) { //NOTE: destination rect includes the source
        return false;
    }

    return true
}


export async function onCommonRoutingRulesGridCellEdited(currentLGC: LayerGroupConstraints, newValue: EditableGridCell, columnIndex: number, columnElement: GridColumn) : Promise<{ data: LayerGroupConstraints|undefined, refresh: boolean }> {
    if(columnIndex === 1) {
        let value = (newValue.kind.toLowerCase() === "custom") ? (newValue.data as any).value : newValue.data;
        let res = await changeLGSetForConstraintElement(currentLGC.projectId, currentLGC.ownerElementId, value)
        return { data: currentLGC, refresh: true }
    }
    else if (columnIndex >= 3) {
        //NOTE: Column ID is Net property Name
        if(currentLGC.associatedProperties && currentLGC.associatedProperties.length > 0) {  //IMPORTANT for fill handle skipping etc etc etc
            for(let i = 0; i < currentLGC.associatedProperties.length; i++) {
                if(currentLGC.associatedProperties[i].name === columnElement.id) {
                    //Important to set default empty string for 'value'!!
                    //NOTE: This next line will NOT allow "0" value instead it will be empty string! Unlike the LM grid, 
                    //  This is fine for routing rules, as we do not want 0 values in the grid
                    let value = ((newValue.kind.toLowerCase() === "custom") ? (newValue.data as any).value : newValue.data) || '';
                    
                    if(newValueMatchesColumnDataType(value, newValue.kind, columnElement) === true){
                        currentLGC.associatedProperties[i].value.customValue = value.toString().trim();

                        let updatedLGC = await updateRoutingConstraints([currentLGC])
                        if(updatedLGC && updatedLGC.length > 0) {
                            return (updatedLGC.length === 1) ? { data: updatedLGC[0], refresh : false } : { data: updatedLGC[0], refresh : true }
                        }
                        else {
                            return { data: undefined, refresh: true }; //Important!
                        }
                    }
                    else{
                        console.error(`glide grid cell editing cannot proceed. data is not of expected type`)
                    }
                }
            }
        }
    }
    
    return { data: undefined, refresh: false };  //this will cause no update to occur on grid
}


export function getCommonRoutingRulesRowGroupGridCellContent(grouperMapping: Map<string, Netclass> | Map<string, BasicProperty>, groupRowLines: GroupRowLineInfo[],
    rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number, isGroupHeader: boolean, path: readonly number[]): GridCell {

    //return right away if its not col 0
    if ((columnIndex !== 0) && isGroupHeader) {
        let cellObj : GridCell = {
            kind: GridCellKind.Loading, 
            allowOverlay: false, 
            span: [1, columns.length - columnIndex] 
        }
        return cellObj;
    }

    //ELSE: proceed as normal...

    let lineInfo = groupRowLines && groupRowLines.length > 0 ? groupRowLines[path[0]] : undefined

    if(!rowEntry || isGroupHeader === false) {
        let cellObj : GridCell = {
            kind: GridCellKind.Loading,
            allowOverlay: false,
        }
        return cellObj;
    }

    if(!lineInfo || !lineInfo.elementId || grouperMapping.has(lineInfo.elementId) === false){       
        let cellObj : GridCell = {
            kind: GridCellKind.Loading,
            allowOverlay: false,
        }
        return cellObj;
    }

    let netclass = grouperMapping.get(lineInfo.elementId) as Netclass
    let grpRowTextValue = netclass.name.toUpperCase();
    let cellObj : GridCell = {
        kind: GridCellKind.Text,
        data: grpRowTextValue,
        allowOverlay: true,
        readonly: true,
        displayData: grpRowTextValue,
        contentAlign: "left",
        themeOverride: {
            baseFontStyle: "normal 13px",
        }
    }
    return cellObj

}


export function onCommonRoutingRulesGridGetToolTipText(args: GridMouseEventArgs, columns: GridColumn[], rowEntry: LayerGroupConstraints, constraintType: ConstraintTypesEnum, 
    grouperMapping: Map<string, Netclass> | Map<string, BasicProperty>, lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>) : string|null{
    
    if(args && args.location) {
        let col = args.location[0];
        if(col === 2) {
            if(rowEntry) {
                if(rowEntry._id && rowEntry._id.trim().startsWith(DUMMY_ELEMENT_ID_PREFIX) === false) {
                    let grouperElement : Netclass | BasicProperty = grouperMapping.get(rowEntry.ownerElementId) as Netclass | BasicProperty
                    let grouperLgSetId = (constraintType === ConstraintTypesEnum.Physical) ? (grouperElement as Netclass).layerGroupSetId : (grouperElement as BasicProperty).value;
                    let layerGroup = lgSetMapping.get(grouperLgSetId)?.lgMapping?.get(rowEntry.layerGroupId)
                    if(layerGroup && layerGroup.layers && layerGroup.layers.length > 0) {
                        let layerNames = layerGroup.layers.map(a => a.name);
                        let tooltip = layerNames.join(" | ").trim()
                        return tooltip
                    }
                } 
            }
        }
    }
    return null
}
// #endregion ================================================= END: COMMON ROUTING RULES ==============================================
//======================================================================================================================================




//======================================================================================================================================
// #region ============================================================= C2CROW GRID ===================================================
//======================================================================================================================================
export async function onClasToClassGridInitialDataFetch(projectId: string, limit: number, ruleArea: RuleArea|null, netclassMapping: Map<string, Netclass>, 
    ifaceIdToNameMapping: Map<string, string>, netclassName: string|null) : Promise<C2CRow[]> {
    
    let c2cRowList = new Array<C2CRow>();
    if(projectId && projectId.length > 0) {
        c2cRowList = await fetchClassRelationLayout(projectId, null, limit, ruleArea?.id ?? null, null, null, netclassName, false) ?? [];
        //hide rows where visibility has been disabled
        if(netclassMapping && netclassMapping.size > 0) {
            c2cRowList = c2cRowList.filter(a => (!a.netclassId) || (netclassMapping.has(a.netclassId) && netclassMapping.get(a.netclassId)?.enableC2CRow === true));
        }
    }

    c2cRowList = sort(c2cRowList).asc([
        a => ifaceIdToNameMapping.get(netclassMapping.get(a.netclassId)?.interfaceId as string)?.toUpperCase(), 
        a => Number(netclassMapping.get(a.netclassId)?.channel),
        a => a.name?.toUpperCase()
    ]); //Important!

    return c2cRowList
}


export function onClasToClassEvaluateFillPattern(patternSource: Rectangle, fillDestination: Rectangle, columns: GridColumn[], rowEntry: C2CRow): boolean {
    if(patternSource && patternSource.x === 0) {
        return false;
    }
    if(fillDestination && fillDestination.x === 0) {
        return false;
    }
    return true
}


export async function onClasToClassGridCellEdited(netclassMapping: Map<string, Netclass>, editCtx: GridCellEditCtx<C2CRow>) : Promise<C2CRow|undefined> {
    if(editCtx.columnIndex > 0) { //IMPORTANT!!! - prevent changes to Netclass name column
        if(editCtx.columnIndex <= editCtx.rowIndex + 2) {  //IMPORTANT!!! - avoid changes to blocked cells during fill handle
            if(editCtx.current.slots && editCtx.current.slots.length > 0) {
                for(let i = 0; i < editCtx.current.slots.length; i++) {

                    let slotNetclass = netclassMapping.get(editCtx.current.slots[i].netclassId) as Netclass
                    let slotName = editCtx.current.slots[i].name;

                    if (
                        (slotNetclass && slotNetclass.name === editCtx.columnElement.id) //handles cases where col > 1
                        || (editCtx.columnIndex === 1 && slotName && slotName === editCtx.columnElement.id) //handles the '[ALL]' column scenarios
                    ) 
                    { 
                        let value = (editCtx.newValue.kind.toLowerCase() === "custom") ? (editCtx.newValue.data as any).value : editCtx.newValue.data;
                        
                        editCtx.current.slots[i].value = value || '';  //Important to have default empty string!!
                        editCtx.current.slots[i].assignmentType = DataMappingTypeEnum.Manual;  //Important!!

                        let updatedC2CRow = await updateClassRelationLayout([editCtx.current])
                        if(updatedC2CRow && updatedC2CRow.length > 0) {
                            return updatedC2CRow[0]
                        }
                    }
                }
            }
        }
    }

    return undefined
}


export function getClasToClassGridColumns(c2cColumnsArray: string[]) {
    let netclassLeftSideNameCol: any = { 
        id: C2C_LEFTSIDE_NETCLASS_GRID_COLUMN_ID, 
        title: " ", //purposefully
        style: "highlight",
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 200
    }
    
    let arr = new Array<GridColumn>().concat([netclassLeftSideNameCol])

    if(c2cColumnsArray && c2cColumnsArray.length > 0) {
        for(let name of c2cColumnsArray){
            let item : any = { 
                id: name.trim(),
                title: name ?? '', 
                style: "normal",
                allowWrapping: true,
                icon: GridColumnIcon.HeaderString,
            };  

            arr.push(item)
        }
    }
    return arr

}


export function getClasToClassGridCellContent(validClrRelationsOptionsRef: GridDropDownOption[], netclassMapping: Map<string, Netclass>, ifaceMapping: Map<string, string>, 
    ncNameToNCMapping: Map<string, Netclass>, c2cEnabledColumnToIndexMap: Map<string, number>, rowEntry: C2CRow, columns: GridColumn[], columnIndex: number) : GridCell {
    
    if(columnIndex === 0) {
        let cellObj : GridCell = {
            kind: GridCellKind.Text,
            data: rowEntry.name,
            allowOverlay: true,
            readonly: true,
            displayData: rowEntry.name,
            contentAlign: "left",
            style: "normal",
        }
        return cellObj;
    }
    else if(columnIndex === 1) {
        let cellObj: DropdownCellType = {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            readonly: false,
            copyData: "4",
            style: "normal",                            
            data: {
                kind: "dropdown-cell",
                allowedValues: [null, ...validClrRelationsOptionsRef],
                value: rowEntry.slots.find(a => a.name === columns[1].title)?.value ?? null,
            },
            themeOverride: {
                bgCell: "rgba(75,206,171, 0.05)"
            }
        };
        return cellObj;
    }
    else {
        let columnTextName = columns[columnIndex].title
        let rowTextName = rowEntry.name;
        let colSlot = rowEntry.slots[c2cEnabledColumnToIndexMap.get(columnTextName) as number] //Important!

        if(!columnTextName || columnTextName.trim().length === 0 || !rowTextName || rowTextName.trim().length === 0) {
            return {
                kind: GridCellKind.Loading,
                allowOverlay: false,
            };
        }

        /*
        There is a reason why i did not use the "> " operator and elected to use "sort() aka fast-sort.
        String Comparison in TypeScript:
            Understanding the ">" Operator
            In TypeScript, the ">" operator is used to compare two strings lexicographically based on their Unicode values. 
            This means that the comparison is done character by character, starting from the first character of each string.
            Example: "Default" > "DTC_CLK_OSC"
            When comparing the strings "Default" and "DTC_CLK_OSC" using the ">" operator, TypeScript will compare the Unicode values of each character in the strings sequentially:
            Compare 'D' (Unicode: 68) with 'D' (Unicode: 68) - they are equal.
            Compare 'e' (Unicode: 101) with 'T' (Unicode: 84) - 'e' has a higher Unicode value than 'T'.
            Since 'e' > 'T', the comparison "Default" > "DTC_CLK_OSC" will yield true.
            
            WTF! - not what i want!
        */

        //Important! the uppercase in here is massively crucial!!
        //For the first part of the 'if' check --> we need to make sure we dont block the cell where  rowName equals colName
        //If the second part of the check below is 'true', it means 'columnTextName comes AFTER rowTextName in alphabetical order
        

        //NOTE: there are three main places that sorting needs to happen with care: 
        // 1) sortSlots() in backend code
        // 2) onClasToClassGridInitialDataFetch() in frontend code
        // 3) here in getClasToClassGridCellContent()
        let sorted = sort([columnTextName, rowTextName]).asc([
            a => ifaceMapping.get(ncNameToNCMapping.get(a.trim().toUpperCase())?.interfaceId as string)?.toUpperCase(), 
            a => Number(ncNameToNCMapping.get(a.trim().toUpperCase())?.channel),
            a => a.toUpperCase()
        ]); //Important!

        // let sorted = sort([columnTextName, rowTextName]).asc(a => a.toUpperCase()) 

        if((columnTextName.toUpperCase() !== rowTextName.toUpperCase()) && (sorted[1].toUpperCase() === columnTextName.toUpperCase())) {
            let cellObj : GridCell = {
                kind: GridCellKind.Loading,
                allowOverlay: false,
                contentAlign: "center",
                style: "faded",
                themeOverride: {
                    bgCell: "rgba(77, 0, 0, .3)"
                }
            }
            return cellObj;
        }
        else {
            let cellObj: DropdownCellType = {
                kind: GridCellKind.Custom,
                allowOverlay: true,
                copyData: "4",
                readonly: false,
                style: "normal",                            
                data: {
                    kind: "dropdown-cell",
                    allowedValues: [null, ...validClrRelationsOptionsRef],
                    value: (netclassMapping.has(colSlot.netclassId) && netclassMapping.get(colSlot.netclassId)?.name === columnTextName) ? colSlot.value : null
                }
            }
            return cellObj;
        }
    
    }
}


export function onClassToClassGridGetToolTipText(args: GridMouseEventArgs, columns: GridColumn[], rowEntry: C2CRow, netclassMapping: Map<string, Netclass>, ifaceMapping: Map<string, string>) : string|null{
    if(args && args.location) {
        let col = args.location[0];
        if(col === 0) {
            if(rowEntry && rowEntry.netclassId && rowEntry.netclassId.trim().length > 0) {
                let netclass = netclassMapping.get(rowEntry.netclassId)
                if(netclass && netclass.interfaceId && netclass.interfaceId.trim().length > 0) {
                    let ifaceName = ifaceMapping.get(netclass.interfaceId)
                    if(ifaceName && ifaceName.trim().length > 0) {
                        let tooltip = `Interface: ${ifaceName}`
                        return tooltip
                    }
                }
            }
        }
    }
    return null
}
// #endregion ================================================= END: C2CROW GRID =======================================================
//======================================================================================================================================




//======================================================================================================================================
// #region ============================================================= G2G GRID ===================================================
//======================================================================================================================================
export async function onG2GGridInitialDataFetch(g2gInfoDataMap: Map<string, G2GRelationContext>, clrRelMapping: Map<string, BasicProperty>, ifaceToG2GIdMap: Map<string, string[]>, 
    g2gIdToNameMap: Map<string, string>, ifaceMapping: Map<string, Interface>, filterText: string) : Promise<G2GRelationContext[]>  {
    
    let tempVals = Array.from(g2gInfoDataMap.values()) as Array<G2GRelationContext>
    let arr = rfdcCopy<G2GRelationContext[]>(tempVals) as G2GRelationContext[]; //important

    //exclude interface level items if they have channels or segments levels
    arr = arr.filter(x => (ifaceToG2GIdMap.has(x._id) === false) || (ifaceToG2GIdMap.has(x._id) && ifaceToG2GIdMap.get(x._id)?.length === 1))

    //exclude disabled items
    arr = arr.filter(x => (x.enabled === true))

    //apply filtering
    if(filterText && filterText.trim().length > 0) {
        arr = arr.filter(a => (g2gIdToNameMap.get(a._id) as string)?.trim()?.toLowerCase()?.startsWith(filterText.trim().toLowerCase())) ?? []
    }

    //sort format --> IMPORTANT!!
    arr = sort(arr).asc( [
        a => ifaceMapping.get(a.interfaceId)?.name?.toUpperCase(),
        a => Number(a.channel),
        a => g2gIdToNameMap.get(a._id.toString())?.toUpperCase()
    ]);

    let finalArr = new Array<G2GRelationContext>();
    for(let i = 0; i < arr.length; i++) {
        finalArr.push(arr[i]);
        
        if(arr[i].across.length > 1) {
            arr[i].across = sort(arr[i].across).asc(q => getClrRelNameStr(clrRelMapping, arr[i], arr[i].across.indexOf(q), true).toUpperCase() )

            for(let x = 1; x < arr[i].across.length; x++) {
                let dummyGRC = rfdcCopy<G2GRelationContext>(arr[i]) as G2GRelationContext; 
                dummyGRC._id = `${DUMMY_ELEMENT_ID_PREFIX}::${arr[i]._id.toString()}::${x}`,
                finalArr.push(dummyGRC);
            }
        }
    }

    return finalArr;
}


export function onG2GEvaluateFillPattern(patternSource: Rectangle, fillDestination: Rectangle, columns: GridColumn[], rowEntry: G2GRelationContext): boolean {
    if(rowEntry._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
        if(fillDestination.x < 8) {
            return false;
        }
    }

    if(patternSource && patternSource.x === 0) {
        return false;
    }
    if(fillDestination && fillDestination.x === 0) { 
        return false;
    }
    if(fillDestination && (fillDestination.x === 7 || fillDestination.x === 9)) { //disable fill pattern on Target Groups column!!
        return false;
    }
    if(fillDestination && fillDestination.width > 1) {  //allow only vertical fill
        return false;
    }
    return true
}


export async function onG2GGridCellEdited(editCtx: GridCellEditCtx<G2GRelationContext>, g2gMap: Readonly<Map<string, G2GRelationContext>>, g2gIdToNameMap: Map<string, string>, 
    ifaceToG2GIdMap: Map<string, string[]>, currentPairings: Set<string>, uppercaseG2GNameToIdMap: Map<string, string>, 
    acrosssIndex: number, verifyG2gClearanceNaming: ((g2g: G2GRelationContext) => boolean)) : Promise<QuickStatus<G2GRelationContext|undefined>> {
    
    let errWarnMsg = "";  //intentional...
    if(editCtx.columnIndex > 0) { //IMPORTANT!!! - prevent changes to Netclass name column
        let g2g = rfdcCopy<G2GRelationContext>(editCtx.current) as G2GRelationContext; //Important - editCtx is passed by ref. this will prevent pre-error changes from sticking
        let g2gId = g2g._id.toString() as string;

        if(editCtx.columnElement.id === G2G_COL_TYPE.TOALL_CB) {
            g2g.toAll.enabled = editCtx.newValue.data as boolean;
        }
        else if (editCtx.columnElement.id === G2G_COL_TYPE.INTRACLASS_CB) {
            g2g.intraclass.enabled = editCtx.newValue.data as boolean;
        }
        else if(editCtx.columnElement.id === G2G_COL_TYPE.WITHIN_CB) {
            g2g.within.enabled = editCtx.newValue.data as boolean;
        }

        else if (editCtx.columnElement.id === G2G_COL_TYPE.TOALL_NAMES) {
            if(g2g.toAll.enabled) {
                g2g.toAll.clearanceRelationBrandId = editCtx.newValue.data as string || "";
                let resp = verifyG2gClearanceNaming(g2g);
                if(resp == false) {
                    return {isSuccessful: false, message: errWarnMsg, data: undefined} as QuickStatus<G2GRelationContext|undefined>;
                }
            }
        }
        else if (editCtx.columnElement.id === G2G_COL_TYPE.INTRACLASS_NAMES) {
            if(g2g.intraclass.enabled) {
                g2g.intraclass.clearanceRelationBrandId = editCtx.newValue.data as string || "";
                let resp = verifyG2gClearanceNaming(g2g);
                if(resp == false) {
                    return {isSuccessful: false, message: errWarnMsg, data: undefined} as QuickStatus<G2GRelationContext|undefined>;
                }
            }
        }
        else if(editCtx.columnElement.id === G2G_COL_TYPE.WITHIN_NAMES) {
            if(g2g.within.enabled) {
                g2g.within.clearanceRelationBrandId = editCtx.newValue.data as string || "";
                let resp = verifyG2gClearanceNaming(g2g);
                if(resp == false) {
                    return {isSuccessful: false, message: errWarnMsg, data: undefined} as QuickStatus<G2GRelationContext|undefined>;
                }
            }
        }
        else if (editCtx.columnElement.id === G2G_COL_TYPE.ACROSS_NAMES) {
            if(editCtx.current._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
                let splitStr: string[] = editCtx.current._id.toString().split("::");
                let index = Number(splitStr.at(splitStr.length -1));
                (g2g.across.at(index) as any).clearanceRelationBrandId = editCtx.newValue.data as string || "";
            }
            else {
                if(!g2g.across || g2g.across.length === 0) {
                    let accItem : TargetSetType = { enabled: true, clearanceRelationBrandId: "", targets: [] }
                    g2g.across = [accItem];
                }
                (g2g.across.at(0) as any).clearanceRelationBrandId = editCtx.newValue.data as string || "";
            }

            if(g2g.across && g2g.across.length > 0) {
                if(g2g.across.some(a => a.clearanceRelationBrandId.trim().length > 0) || g2g.across.some(a => a.targets.length > 0)){
                    g2g.across.forEach(x => { x.enabled = true })
                }
                else {
                    g2g.across.forEach(x => { x.enabled = false })
                }
            }

            let resp = verifyG2gClearanceNaming(g2g);
            if(resp == false) {
                return {isSuccessful: false, message: errWarnMsg, data: undefined} as QuickStatus<G2GRelationContext|undefined>;
            }
        }

        else if (editCtx.columnElement.id === G2G_COL_TYPE.ACROSS_TGT_ITEMS) {
            let newVals : string[] = (editCtx.newValue.data as any)?.values ?? [];
            newVals = newVals.map(val => (uppercaseG2GNameToIdMap.get(val.trim().toUpperCase()) ?? val)); //Important!! -- this is just necessary b/c values comes here as names
            let newValsCopy : string[] = rfdcCopy<string[]>(newVals) as string[];
            
            for(let x = 0; x < newVals.length; x++) {
                let g2gAtIndex = g2gMap.get(newVals[x]) as G2GRelationContext;
                if(!g2gAtIndex.segment || g2gAtIndex.segment.trim().length === 0) {
                    let g2gIfaceRelatedIds = (ifaceToG2GIdMap.get(g2gAtIndex.interfaceId) as string[]) ?? [];
                    let gatheredFriends = g2gIfaceRelatedIds.filter(x => (
                        ((g2gMap.get(x)?.channel as string) === g2gAtIndex.channel) 
                        && ((g2gMap.get(x)?.segment as string).trim().length > 0)
                    )) ?? []

                    if(gatheredFriends.length > 0) {
                        newValsCopy = newValsCopy.filter(r => r !== newVals[x]);
                        let furtherFiltered = gatheredFriends.filter(b => 
                            ((currentPairings.has(`${g2gId}__${b}`) || currentPairings.has(`${b}__${g2gId}`)) === false) 
                        )
                        let exclusions = gatheredFriends.filter(a => (furtherFiltered.includes(a) === false));
                        if(exclusions.length > 0) {
                            let exclNames = exclusions.map(n => (g2gIdToNameMap.get(n) ?? n));
                            errWarnMsg = `Target item(s) excluded! Source group '${g2gIdToNameMap.get(g2gId)}' `
                                + `already has a relationship to the following targets: [ ${exclNames.join(", ")} ]`
                        }
                        let finalConcat = newValsCopy.concat(gatheredFriends);
                        newValsCopy = Array.from(new Set<string>(finalConcat));
                    }
                }
            }

            if(!g2g.across || g2g.across.length === 0) {
                let accItem : TargetSetType = { enabled: true, clearanceRelationBrandId: "", targets: [] }
                g2g.across = [accItem];
            }
            
            g2g.across[acrosssIndex].targets = newValsCopy;
        }

        return {isSuccessful: true, message: errWarnMsg, data: g2g} as QuickStatus<G2GRelationContext|undefined>;
    }

    return {isSuccessful: false, message: errWarnMsg, data: undefined} as QuickStatus<G2GRelationContext|undefined>
}


export function getG2GGridColumns(): GridColumn[] {
    let srcNameCol: any = { 
        id: G2G_COL_TYPE.SRC_ITEMS, 
        title: "Source Group",
        style: "highlight",
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
        width: 200
    }


    let toAllCBCol: any = { 
        id: G2G_COL_TYPE.TOALL_CB, 
        title: "To-All",
        style: "normal",
        icon: GridColumnIcon.HeaderBoolean,
        allowWrapping: true,
        width: 90
    }
    let ruleNameToAllCol: any = { 
        id: G2G_COL_TYPE.TOALL_NAMES, 
        title: "To-All Rule Name",
        style: "normal",
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,
        width: 200
    }


    let intraclassCBCol: any = { 
        id: G2G_COL_TYPE.INTRACLASS_CB, 
        title: "Intraclass",
        style: "normal",
        icon: GridColumnIcon.HeaderBoolean,
        allowWrapping: true,
        width: 95
    }
    let ruleNameIntraclassCol: any = { 
        id: G2G_COL_TYPE.INTRACLASS_NAMES, 
        title: "Intraclass Rule Name",
        style: "normal",
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,
        width: 200
    }
    

    let withinCBCol: any = { 
        id: G2G_COL_TYPE.WITHIN_CB, 
        title: "Within",
        style: "normal",
        icon: GridColumnIcon.HeaderBoolean,
        allowWrapping: true,
        width: 90
    }
    let ruleNameWithinCol: any = { 
        id: G2G_COL_TYPE.WITHIN_NAMES, 
        title: "Within Rule Name",
        style: "normal",
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,
        width: 200
    }


    let acrossButtonCol: any = { 
        id: G2G_COL_TYPE.ACROSS_BUTTON, 
        title: "Across",
        style: "normal",
        icon: GridColumnIcon.HeaderRollup,
        allowWrapping: true,
        width: 140
    }
    let ruleNameAcrossCol: any = { 
        id: G2G_COL_TYPE.ACROSS_NAMES, 
        title: "Across Rule Name",
        style: "normal",
        icon: GridColumnIcon.HeaderString,
        allowWrapping: true,
        width: 200
    }
    let acrossTargetGroupCol: any = { 
        id: G2G_COL_TYPE.ACROSS_TGT_ITEMS, 
        title: "Across Target Groups",
        style: "normal",
        icon: GridColumnIcon.HeaderArray,
        allowWrapping: true,
        width: 700,
        grow: 10
    }


    let arr = new Array<GridColumn>().concat([
        srcNameCol, 
        toAllCBCol, ruleNameToAllCol,
        intraclassCBCol, ruleNameIntraclassCol,  
        withinCBCol, ruleNameWithinCol, 
        acrossButtonCol, ruleNameAcrossCol, acrossTargetGroupCol, 
    ])

    return arr

}


export function getG2GGridCellContent(g2gIdToNameMap: Map<string, string>, clrRelMapping: Map<string, BasicProperty>, tgtOptions: DisplayOption[], 
    rowEntry: G2GRelationContext, columns: GridColumn[], columnIndex: number, rowIndex: number, handleTargetManagementAction: (g2g: G2GRelationContext, rowIndex: number) => void) : GridCell {

    let splitStr: string[] = rowEntry._id.toString().split("::");
    let undummifiedId : string = (splitStr.length > 1) ? splitStr.at(1) as string: splitStr.at(0) as string;
    let acrossIndexFromId : number = (splitStr.length > 1) ? Number(splitStr.at(splitStr.length -1)) : 0;
    
    function getEntryCBVal(index: number) : boolean|null {
        if(index === 1) { return rowEntry.toAll.enabled }
        else if(index === 3) {return rowEntry.intraclass.enabled }
        else if(index === 5) {return rowEntry.within.enabled }
        else {
            return false;
        }
    }

    function checkNameFieldEnablement(index: number) : boolean {
        if(index === 2) { return (rowEntry.toAll.enabled ? false : true)}
        else if(index === 4) {return (rowEntry.intraclass.enabled ? false : true) }
        else if(index === 6) {return (rowEntry.within.enabled ? false : true) }
        else {
            return false;
        }
    }

    //Handle Dummy rows
    if(rowEntry._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
        if(columnIndex < 8) {
            let cellObj : GridCell = {
                kind: GridCellKind.Loading,
                allowOverlay: false,
                contentAlign: "center",
                style: "faded",
                themeOverride: {
                    bgCell: "rgba(66, 38, 38, 0.3)"
                },
                // span: [0, 7]  
            }
            return cellObj;
        }
        else if(columnIndex === 8) {
            let cellObj : EditableGridCell = {
                kind: GridCellKind.Text,
                allowOverlay: true,
                readonly: false,
                contentAlign: "left",
                style: "normal",
                data: getClrRelNameStr(clrRelMapping, rowEntry, acrossIndexFromId, true),
                displayData: getClrRelNameStr(clrRelMapping, rowEntry, acrossIndexFromId, true),
                themeOverride: {
                    baseFontStyle: "normal 13px",
                }
            }
            return cellObj;
        }
    }   
        
    //handle regular rows
    if(columnIndex === 0) {
        let color = "#ffffff"
        if(rowEntry.segment && rowEntry.segment.trim().length > 0) {
            color = "#b9ffff" //"#d7ffff"
        }
        else if(rowEntry.channel && rowEntry.channel.trim().length > 0) {
            color = "pink"
        }
        
        let cellObj : GridCell = {
            kind: GridCellKind.Text,
            data: g2gIdToNameMap.get(rowEntry._id) || '',
            allowOverlay: true,
            readonly: true,
            displayData: g2gIdToNameMap.get(rowEntry._id) || '',
            contentAlign: "left",
            style: "normal",
            themeOverride: {
                textDark: color,
                baseFontStyle: "normal 13px",
            }
        }
        return cellObj;
    }
    else if(columnIndex === 1 || columnIndex === 3 || columnIndex === 5) {
        let cellObj: BooleanCell = {
            kind: GridCellKind.Boolean,
            allowOverlay: false,
            readonly: false,
            copyData: "4",
            style: "normal",                            
            data: getEntryCBVal(columnIndex),
            themeOverride: {
                textMedium: "white",
                textLight: SPECIAL_QUARTZ_COLOR,
                textDark: SPECIAL_DARK_GOLD_COLOR,
                accentColor: SPECIAL_BLUE_COLOR,

                bgBubble: "#86c5da",
                bgBubbleSelected: "#add8e6",
            }
        };
        return cellObj;
    }
    else if(columnIndex === 2 || columnIndex === 4 || columnIndex === 6) {
        let cellObj : EditableGridCell = {
            kind: GridCellKind.Text,
            allowOverlay: true,
            readonly: checkNameFieldEnablement(columnIndex),
            contentAlign: "left",
            style: "normal",
            data: getClrRelNameStr(clrRelMapping, rowEntry, columnIndex, false),
            displayData: checkNameFieldEnablement(columnIndex) ? "" : getClrRelNameStr(clrRelMapping, rowEntry, columnIndex, false),
            themeOverride: {
                baseFontStyle: "normal 13px",
            }
        }
        return cellObj;
    }
    else if(columnIndex === 7) {
        let cellObj: ButtonCellType = {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: "4",
            readonly: true,
            data: {
                kind: "button-cell",
                backgroundColor: ["#0f518a", "#0d4373"], //["transparent", "#6572ffee"],
                color: ["#fafafa", SPECIAL_GOLD_COLOR], //["accentColor", "accentFg"],
                borderColor: SPECIAL_BLUE_COLOR, //"#6572ffa0",
                borderRadius: 5,
                title: "Edit Rules Across",
                onClick: () => handleTargetManagementAction(rowEntry, rowIndex)
            },
            themeOverride: {
                baseFontStyle: "normal 12px",
            }
        };
        return cellObj;
    }
    else if(columnIndex === 8) {
        let cellObj : EditableGridCell = {
            kind: GridCellKind.Text,
            allowOverlay: true,
            readonly: false,
            contentAlign: "left",
            style: "normal",
            data: getClrRelNameStr(clrRelMapping, rowEntry, 0, true),
            displayData: getClrRelNameStr(clrRelMapping, rowEntry, 0, true),
            themeOverride: {
                baseFontStyle: "normal 13px",
            }
        }
        return cellObj;
    } 

    
    //handle target column - dummy or not...
    if(columnIndex === 9) {
        let cellObj: MultiSelectCellType = {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            readonly: false,
            copyData: "4",
            style: "normal", 
            themeOverride: {
                // textMedium: "yellow",
                // textLight: "green",
                bgBubble: "#86c5da",
                bgBubbleSelected: "#add8e6",
                textBubble: "#000000",
                accentColor: SPECIAL_BLUE_COLOR,
                textDark: "#ffffff",
            },                          
            data: {
                kind: "multi-select-cell",
                allowDuplicates: false,
                allowCreation: false,
                values: (rowEntry.across?.at(acrossIndexFromId)?.targets ?? []).map(x => (g2gIdToNameMap.get(x) as string)),
                options: tgtOptions.map(a => ({ value: a.id, label: a.label, color: "#add8e6" }) ),
            },
        };
        return cellObj;
    }
    else {
        let cellObj : GridCell = {
            kind: GridCellKind.Loading,
            allowOverlay: false,
            contentAlign: "center",
            style: "faded",
            themeOverride: {
                bgCell: "rgba(77, 0, 0, .3)"
            }
        }
        return cellObj;
    }
}


export function onG2GGridGetToolTipText(args: GridMouseEventArgs, columns: GridColumn[], rowEntry: G2GRelationContext, ifaceMapping: Map<string, Interface>, g2gIdToNameMap: Map<string, string>) : string|null{
    let retVal = null
    if(args && args.location) {
        let col = args.location[0];
        if(col === 0) {
            if(rowEntry._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX) === false) {
                if(ifaceMapping.has(rowEntry._id) === false) {
                    if((rowEntry.segment && rowEntry.segment.trim().length > 0) && (!rowEntry.channel || rowEntry.channel.trim().length === 0)) {
                        retVal = `${ifaceMapping.get(rowEntry.interfaceId)?.name as string} : : Segment=${rowEntry.segment?.toString() || ''}`;
                    }
                    else if(rowEntry.segment && rowEntry.segment.trim().length > 0) {
                        retVal = `${ifaceMapping.get(rowEntry.interfaceId)?.name as string} : : Channel=${rowEntry.channel?.toString() || ''} : : Segment=${rowEntry.segment?.toString() || ''}`;
                    }
                    else if(rowEntry.channel && rowEntry.channel.trim().length > 0) {
                        retVal = `${ifaceMapping.get(rowEntry.interfaceId)?.name as string} : : Channel=${rowEntry.channel?.toString() || ''}`;
                    }
                    else {
                        retVal = `${ifaceMapping.get(rowEntry.interfaceId)?.name as string}`;
                    }
                }
            }
        }
        else if(col === 9) {
            if(rowEntry.across && rowEntry.across.length > 0) {
                if(rowEntry._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
                    let splitStr: string[] = rowEntry._id.toString().split("::");
                    let undummifiedId : string = (splitStr.length > 1) ? splitStr.at(1) as string: splitStr.at(0) as string;
                    let acrossIndexFromId : number = (splitStr.length > 1) ? Number(splitStr.at(splitStr.length -1)) : 0;
                    retVal = (rowEntry.across[acrossIndexFromId].targets ?? []).map(x => (g2gIdToNameMap.get(x) as string)).join(" , ") || ''
                }
                else {
                    retVal = (rowEntry.across[0].targets ?? []).map(x => (g2gIdToNameMap.get(x) as string)).join(" , ") || ''
                }
            }
        }
    }
        
    return retVal
    // return retVal === null ? null : retVal + " --- " + rowEntry._id;  //for debug only
}


function getClrRelNameStr(clrRelMapping: Map<string, BasicProperty>, rowEntry: G2GRelationContext, index: number, isAcrossColumnScenario: boolean): string {
    if(isAcrossColumnScenario === false) {
        let g2gInfoRuleText = "";
        if(index === 2) { g2gInfoRuleText = rowEntry.toAll.clearanceRelationBrandId }
        else if(index === 4) {g2gInfoRuleText = rowEntry.intraclass.clearanceRelationBrandId }
        else if(index === 6) {g2gInfoRuleText = rowEntry.within.clearanceRelationBrandId }
        let val = clrRelMapping.get(g2gInfoRuleText)?.name || (g2gInfoRuleText || "")
        return val;
    }
    else {
        let val = (rowEntry.across?.at(index) && rowEntry.across?.at(index)?.clearanceRelationBrandId && (rowEntry.across.at(index)?.clearanceRelationBrandId as string).length > 0)
            ? (clrRelMapping.get(rowEntry.across.at(index)?.clearanceRelationBrandId as string)?.name ?? rowEntry.across.at(index)?.clearanceRelationBrandId as string)
            : "";

        return val;
    }
}


// #endregion ================================================= END: G2G GRID =======================================================
//======================================================================================================================================











// let isIfaceLevel = ((!rowEntry.channel || rowEntry.channel.trim().length === 0) && (!rowEntry.segment || rowEntry.segment.trim().length === 0)) ? true : false;
// let isSegmentLevel = (rowEntry.segment && rowEntry.segment.trim().length > 0) ? true : false;
        


// else if(columnIndex === 9) {
        //     let cellObj: MultiSelectCellType = {
        //         kind: GridCellKind.Custom,
        //         allowOverlay: true,
        //         readonly: false,
        //         copyData: "4",
        //         style: "normal", 
        //         themeOverride: {
        //             // textMedium: "yellow",
        //             // textLight: "green",
        //             bgBubble: "#86c5da",
        //             bgBubbleSelected: "#add8e6",
        //             textBubble: "#000000",
        //             accentColor: SPECIAL_BLUE_COLOR,
        //             textDark: "#ffffff",
        //         },                          
        //         data: {
        //             kind: "multi-select-cell",
        //             allowDuplicates: false,
        //             allowCreation: false,
        //             values: (rowEntry.across?.at(acrossIndexFromId)?.targets ?? []).map(x => (g2gIdToNameMap.get(x) as string)),
        //             options: tgtOptions.map(a => ({ value: a.id, label: a.label, color: "#add8e6" }) ),
        //         },
        //     };
        //     return cellObj;
        // }
        // else {
        //     let cellObj : GridCell = {
        //         kind: GridCellKind.Loading,
        //         allowOverlay: false,
        //         contentAlign: "center",
        //         style: "faded",
        //         themeOverride: {
        //             bgCell: "rgba(77, 0, 0, .3)"
        //         }
        //     }
        //     return cellObj;
        // }



// return retVal === null ? null : retVal + " --- " + rowEntry._id;  //for debug only



// let data = getSectionsFromIdString(rowEntry._id)?.data as {ifaceId: string, channel: number|null, segment: string|null};
// let color = "#ffffff"
// if(data) {
//     if(data.segment !== null) {
//         color = "#b9ffff" //"#d7ffff"
//     }
//     else if(data.channel !== null) {
//         color = "pink"
//     }
// }



// export function getG2GRowGroupGridCellContent(g2gIdToNameMap: Map<string, string>, clrRelMapping: Map<string, BasicProperty>, tgtOptions: DisplayOption[], 
//     rowEntry: G2GRelationContext, columns: GridColumn[], columnIndex: number, groupRowLines: GroupRowLineInfo[], isGroupHeader: boolean, path: readonly number[]): GridCell {

//     let lineInfo = groupRowLines && groupRowLines.length > 0 ? groupRowLines[path[0]] : undefined

//     // if(!rowEntry || isGroupHeader === false) {
//     //     let cellObj : GridCell = {
//     //         kind: GridCellKind.Loading,
//     //         allowOverlay: false,
//     //     }
//     //     return cellObj;
//     // }

//     // if(!lineInfo || !lineInfo.elementId || grouperMapping.has(lineInfo.elementId) === false){       
//     //     let cellObj : GridCell = {
//     //         kind: GridCellKind.Loading,
//     //         allowOverlay: false,
//     //     }
//     //     return cellObj;
//     // }

//     // let netclass = grouperMapping.get(lineInfo.elementId) as Netclass
//     // let grpRowTextValue = netclass.name.toUpperCase();
//     // let cellObj : GridCell = {
//     //     kind: GridCellKind.Text,
//     //     data: grpRowTextValue,
//     //     allowOverlay: true,
//     //     readonly: true,
//     //     displayData: grpRowTextValue,
//     //     contentAlign: "left",
//     //     themeOverride: {
//     //         baseFontStyle: "normal 13px",
//     //     }
//     // }
//     // return cellObj


//     function getClrRelNameStr(index: number): string {
//         let retVal = "";
//         // let g2gInfoRuleText = "";
//         // if(index === 5) { g2gInfoRuleText = rowEntry.clearanceRelationBrandIntraclass }
//         // else if(index === 6) {g2gInfoRuleText = rowEntry.clearanceRelationBrandWithin }
//         // else if(index === 7) {g2gInfoRuleText = rowEntry.clearanceRelationBrandAcross }

//         // if (g2gInfoRuleText && g2gInfoRuleText.length > 0) {
//         //     let clrRelProp = clrRelMapping.get(g2gInfoRuleText);
//         //     if(clrRelProp && clrRelProp.name) {
//         //         retVal = clrRelProp.name
//         //     }
//         //     else {
//         //         retVal = g2gInfoRuleText;
//         //     }
//         // }
//         return retVal;
//     }

//     function getEntryCBVal(index: number) : boolean|null {
//         // if(index === 1) { return rowEntry.setToAll }
//         // else if(index === 2) {return rowEntry.setIntraclass }
//         // else if(index === 3) {return rowEntry.setWithin }
//         // else if(index === 4) {return rowEntry.setAcross }
//         // else {
//         //     return null;
//         // }

//         return false;
//     }

//     if(columnIndex === 0) {
//         // let data = getSectionsFromIdString(rowEntry._id)?.data as {ifaceId: string, channel: number|null, segment: string|null};
//         let color = "#ffffff"
//         // if(data) {
//         //     if(data.segment !== null) {
//         //         color = "#b9ffff" //"#d7ffff"
//         //     }
//         //     else if(data.channel !== null) {
//         //         color = "pink"
//         //     }
//         // }

//         if(rowEntry.segment && rowEntry.segment.trim().length > 0) {
//             color = "#b9ffff" //"#d7ffff"
//         }
//         else if(rowEntry.channel && rowEntry.channel.trim().length > 0) {
//             color = "pink"
//         }
        
//         let cellObj : GridCell = {
//             kind: GridCellKind.Text,
//             data: g2gIdToNameMap.get(rowEntry._id) || '',
//             allowOverlay: true,
//             readonly: true,
//             displayData: g2gIdToNameMap.get(rowEntry._id) || '',
//             contentAlign: "left",
//             style: "normal",
//             themeOverride: {
//                 bgCell: "rgba(75,206,171, 0.04)",
//                 textDark: color,
//                 baseFontStyle: "normal 13px",
//             }
//         }
//         return cellObj;
//     }
//     else if(columnIndex === 1 || columnIndex === 3 || columnIndex === 5) {
//         let cellObj: BooleanCell = {
//             kind: GridCellKind.Boolean,
//             allowOverlay: false,
//             readonly: false,
//             copyData: "4",
//             style: "normal",                            
//             data: getEntryCBVal(columnIndex),
//             themeOverride: {
//                 // bgCell: "rgba(75,206,171, 0.04)",
//                 textMedium: "white",
//                 textLight: SPECIAL_QUARTZ_COLOR,
//                 textDark: SPECIAL_DARK_GOLD_COLOR,
//                 accentColor: SPECIAL_BLUE_COLOR,

//                 bgBubble: "#86c5da",
//                 bgBubbleSelected: "#add8e6",
//             }
//         };
//         return cellObj;
//     }
//     else if(columnIndex === 7) {
//         let cellObj: ButtonCellType = {
//             kind: GridCellKind.Custom,
//             allowOverlay: true,
//             copyData: "4",
//             readonly: true,
//             data: {
//                 kind: "button-cell",
//                 backgroundColor: ["#0f518a", "#0d4373"], //["transparent", "#6572ffee"],
//                 color: ["#fafafa", SPECIAL_GOLD_COLOR], //["accentColor", "accentFg"],
//                 borderColor: SPECIAL_BLUE_COLOR, //"#6572ffa0",
//                 borderRadius: 5,
//                 title: "Edit Rules Across",
//                 onClick: () => window.alert("Button clicked")
//             },
//             themeOverride: {
//                 baseFontStyle: "normal 12px"
//             }
//         };
//         return cellObj;
//     }
//     else if(columnIndex === 2 || columnIndex === 4 || columnIndex === 6 || columnIndex === 8) {
//         let cellObj : EditableGridCell = {
//             kind: GridCellKind.Text,
//             allowOverlay: true,
//             readonly: false,
//             contentAlign: "left",
//             style: "normal",
//             data: getClrRelNameStr(columnIndex),
//             displayData: getClrRelNameStr(columnIndex),
//             themeOverride: {
//                 baseFontStyle: "normal 13px",
//             }
//         }
//         return cellObj;
//     }
//     else if(columnIndex === 9) {
//         let cellObj: MultiSelectCellType = {
//             kind: GridCellKind.Custom,
//             allowOverlay: true,
//             readonly: false,
//             copyData: "4",
//             style: "normal", 
//             themeOverride: {
//                 // bgCell: "rgba(75,206,171, 0.05)",
//                 // textMedium: "yellow",
//                 // textLight: "green",
//                 bgBubble: "#86c5da",
//                 bgBubbleSelected: "#add8e6",
//                 textBubble: "#000000",
//                 accentColor: SPECIAL_BLUE_COLOR,
//                 textDark: "#ffffff",
//             },                          
//             data: {
//                 kind: "multi-select-cell",
//                 allowDuplicates: false,
//                 allowCreation: false,
//                 values: [], //(rowEntry.targets ?? []).map(x => (g2gIdToNameMap.get(x) as string)),
//                 options: tgtOptions.map(a => ({ value: a.id, label: a.label, color: "#add8e6" }) ),
//             },
//         };
//         return cellObj;
//     }
//     else {
//         let cellObj : GridCell = {
//             kind: GridCellKind.Loading,
//             allowOverlay: false,
//             contentAlign: "center",
//             style: "faded",
//             themeOverride: {
//                 bgCell: "rgba(77, 0, 0, .3)"
//             }
//         }
//         return cellObj;
//     }
// }




//=========================================================\

// export async function onG2GGridInitialDataFetch(g2gInfoDataMap: Map<string, G2GRelationContext>, ifaceToG2GIdMap: Map<string, string[]>, g2gIdToNameMap: Map<string, string>, 
//     ifaceMapping: Map<string, Interface>, filterText: string) : Promise<{ data: G2GRelationContext[], groupInfo: GroupRowLineInfo[] }>  {
    
//     let tempVals = Array.from(g2gInfoDataMap.values()) as Array<G2GRelationContext>
//     let arr = rfdcCopy<G2GRelationContext[]>(tempVals) as G2GRelationContext[]; //important

//     arr = arr.filter(x => (ifaceToG2GIdMap.has(x._id) === false) || (ifaceToG2GIdMap.has(x._id) && ifaceToG2GIdMap.get(x._id)?.length === 1))

//     if(filterText && filterText.trim().length > 0) {
//         arr = arr.filter(a => (g2gIdToNameMap.get(a._id) as string)?.trim()?.toLowerCase()?.startsWith(filterText.trim().toLowerCase())) ?? []
//     }

//     //sort format --> IMPORTANT!!
//     arr = sort(arr).asc( [
//         a => ifaceMapping.get(a._id)?.name?.toUpperCase(),
//         a => Number(a.channel),
//         a => g2gIdToNameMap.get(a._id)?.toUpperCase()
//     ]);
    
//     let count = 0;
//     let returnGroupingInfo = new Array<GroupRowLineInfo>();
//     let finalArr = new Array<G2GRelationContext>();
//     for(let i = 0; i < arr.length; i++) {
//         //handle group row header info
//         let info : GroupRowLineInfo = {
//             index: count++,
//             headerText: g2gIdToNameMap.get(arr[i]._id.toString()) ?? '',
//             elementId: arr[i]._id.toString(), 
//             isCollapsed: false
//         };
//         returnGroupingInfo.push(info);

//         finalArr.push(arr[i]);

//         if(arr[i].across.length > 1) {
//             for(let x = 1; x < arr[i].across.length; x++) {
//                 let dummyGRC = rfdcCopy<G2GRelationContext>(arr[i]) as G2GRelationContext; 
//                 dummyGRC._id = `${DUMMY_ELEMENT_ID_PREFIX}${arr[i]._id.toString()}::${x}`,
                
//                 finalArr.push(dummyGRC);
//                 count = count + 1;
//             }
//         }
//     }

    
//     return { data: finalArr, groupInfo: returnGroupingInfo }
// }



//=========================================


 // let trailer: any = { 
    //     id: "__TRAILER__", 
    //     title: "",
    //     allowWrapping: false,
    //     width: 10
    // }




// themeOverride: {
//     accentColor: SPECIAL_BLUE_COLOR,
    
//     accentLight: "rgba(71, 71, 71, 0.41)",  //"rgba(0, 0, 77, 0.15)", //"rgba(202, 206, 255, 0.253)",

//     textDark: "#ededed", //"#d9d9d9",
//     textMedium: "#b8b8b8",
//     textLight: "#a0a0a0",
//     textBubble: "#ffffff",

//     bgIconHeader: "#b8b8b8",
//     fgIconHeader: "#ffffff",
//     textHeader: "#70d8bd",  //"#a1a1a1",
//     textHeaderSelected: "#ededed",  //"#000000",

//     bgCell: SPECIAL_QUARTZ_COLOR,
//     bgCellMedium: "#202027",
//     bgHeader: "#212121",
//     bgHeaderHasFocus: "#474747",
//     bgHeaderHovered: "#404040",

//     bgBubble: "green",
//     bgBubbleSelected: "red",

//     bgSearchResult: "#423c24",

//     borderColor: "rgba(225,225,225,0.2)",
//     drilldownBorder: "rgba(225,225,225,0.4)",

//     linkColor: "#4F5DFF",

//     headerFontStyle: "normal 14px",
//     baseFontStyle: "normal 13px",
//     fontFamily: "intelclear", //"Inter, Roboto, -apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Ubuntu, noto, arial, sans-serif",

//     roundingRadius: 5,


//     //=========== Added Custom propertied below =================
// },

// 200: 146bb8
// 300: "#0f518a",
// 400: "#0d4373",








// export async function onG2GGridCellEdited(editCtx: GridCellEditCtx<G2GRelationInfo>, g2gIdToNameMap: Map<string, string>, 
//     upperCaseG2GNameToIdMap: Map<string, string>, ifaceToG2GIdMap: Map<string, string[]>) : Promise<G2GRelationInfo|undefined> {
    
//     if(editCtx.columnIndex > 0) { //IMPORTANT!!! - prevent changes to Netclass name column
//         if(editCtx.columnElement.id === COL_TYPE.TOALL_CB) {
//             editCtx.current.setToAll = editCtx.newValue.data as boolean;
//         }
//         else if (editCtx.columnElement.id === COL_TYPE.INTRACLASS_CB) {
//             editCtx.current.setIntraclass = editCtx.newValue.data as boolean;
//         }
//         else if(editCtx.columnElement.id === COL_TYPE.WITHIN_CB) {
//             editCtx.current.setWithin = editCtx.newValue.data as boolean;
//         }
//         else if (editCtx.columnElement.id === COL_TYPE.ACROSS_CB) {
//             editCtx.current.setAcross = editCtx.newValue.data as boolean;
//         }
        
//         else if (editCtx.columnElement.id === COL_TYPE.INTRACLASS_NAMES) {
//             editCtx.current.clearanceRelationBrandIntraclass = editCtx.newValue.data as string || "";
//         }
//         else if(editCtx.columnElement.id === COL_TYPE.WITHIN_NAMES) {
//             editCtx.current.clearanceRelationBrandWithin = editCtx.newValue.data as string || "";
//         }
//         else if (editCtx.columnElement.id === COL_TYPE.ACROSS_NAMES) {
//             editCtx.current.clearanceRelationBrandAcross = editCtx.newValue.data as string || "";
//         }

//         else if (editCtx.columnElement.id === COL_TYPE.TGT_ITEMS) {
//             let newVals : string[] = (editCtx.newValue.data as any)?.values ?? [];
//             let newValsCopy : string[] = rfdcCopy<string[]>(newVals) as string[];
//             for(let x = 0; x < newVals.length; x++) {
//                 let data = getSectionsFromIdString(upperCaseG2GNameToIdMap.get(newVals[x]) as string)?.data;
//                 if(data && data.channel !== null && (data.segment === null || data.segment.trim().length === 0)) {
//                     let potentialFriendsArr = ifaceToG2GIdMap.get(data.ifaceId) ?? []
//                     let gatheredFriends = potentialFriendsArr.filter(k => {
//                         let subseqData = getSectionsFromIdString(k)?.data;
//                         if(subseqData && subseqData.channel === data.channel && subseqData.segment !== null && subseqData.segment.length > 0) {
//                             return k;
//                         }
//                     })
//                     if(gatheredFriends.length > 0) {
//                         newValsCopy = newValsCopy.filter(r => r !== newVals[x]);
//                         let names = gatheredFriends.map(a => g2gIdToNameMap.get(a) as string);
//                         newValsCopy = Array.from(new Set<string>(newValsCopy.concat(names)));
//                     }
//                 }
//             }
//             editCtx.current.targets = newValsCopy;
//         }
//         return editCtx.current;
//     }

//     return undefined
// }






// if(gatheredFriends.length > 0) {
//     newValsCopy = newValsCopy.filter(r => r !== newVals[x]);
//     // let furtherFiltered = gatheredFriends.filter(b => ((currentPairings.has(`${editCtx.current.id}__${b}`) || currentPairings.has(`${b}__${editCtx.current.id}`)) === false) )
//     let names = gatheredFriends.map(a => g2gIdToNameMap.get(a) as string);
//     newValsCopy = Array.from(new Set<string>(newValsCopy.concat(names)));
// }
// if(gatheredFriends.length > 0) {
//     newValsCopy = newValsCopy.filter(r => r !== newVals[x]);
//     let furtherFiltered = gatheredFriends.filter(b => ((currentPairings.has(`${editCtx.current.id}__${b}`) || currentPairings.has(`${b}__${editCtx.current.id}`)) === false) )
//     let names = furtherFiltered.map(a => g2gIdToNameMap.get(a) as string);
//     newValsCopy = Array.from(new Set<string>(newValsCopy.concat(names)));
// }


        // // let cellObj: TagsCellType = {
        // //     kind: GridCellKind.Custom,
        // //     allowOverlay: true,
        // //     readonly: false,
        // //     copyData: "4",
        // //     style: "normal",
        // //     themeOverride: {
        // //         bgCell: "rgba(75,206,171, 0.05)"
        // //     },
        // //     data: {
        // //         kind: "tags-cell",
        // //         tags:  [Array.from(g2gIdToNameMap.values()).at(0) as string, Array.from(g2gIdToNameMap.values()).at(1) as string], 
        // //         possibleTags: optionsArray.map(a => ({tag: g2gIdToNameMap.get(a.id), color: "maroon"} as any))
        // //     }
        // // };

        // let opts = [{
        //     label: "gl1", 
        //     value: "glide",
        //     color: "#ffc38a"
        //   }, {
        //       label: "dt1",
        //     value: "data",
        //     color: "#ebfdea"
        //   }, {
        //     value: "grid",
        //     color: "teal"
        //   }];


        //   let vals = rowEntry.targets.map(a => g2gIdToNameMap.get(a) as string) ?? [];

        // //   let optArr = optionsArray.map(a => ({label: g2gIdToNameMap.get(a.id) as string, value: a.id, color: "teal"}) );

        // for(let x = 0; x < optionsArray.length ; x++) {
        //     opts.push({
        //         label: g2gIdToNameMap.get(optionsArray[x].id) as string, 
        //         value: optionsArray[x].id,
        //         color: "teal"
        //     })
        // }

        // let cellObj: MultiSelectCellType = {
        //     kind: GridCellKind.Custom,
        //     allowOverlay: true,
        //     readonly: false,
        //     copyData: "4",
        //     style: "normal",                            
        //     data: {
        //         kind: "multi-select-cell",
        //         // values: rowEntry.targets ?? [],
        //         // options: optionsArray.map(a => ({value: a.id, color: "rgba(54,117,136)"} as any)),
        //         // values: rowEntry.targets.map(a => g2gIdToNameMap.get(a) as string).filter(x => (x && x.length > 0)) ?? [],


        //         values: rowEntry.targets.map(a => g2gIdToNameMap.get(a) as string) ?? [],
        //         options: optionsArray.map(a => ({label: g2gIdToNameMap.get(a.id) as string, value: a.id, color: "red"}) ),

        //         // values: vals, //["glide", "data", "grid"],
        //         // options: opts, //opts,
            
        //     // [{
        //     //   label: "gl1", 
        //     //   value: "glide",
        //     //   color: "#ffc38a"
        //     // }, {
        //     //     label: "dt1",
        //     //   value: "data",
        //     //   color: "#ebfdea"
        //     // }, {
        //     //   value: "grid",
        //     //   color: "teal"
        //     // }],


        //         allowDuplicates: false,
        //         allowCreation: false
        //     },
        //     // themeOverride: {
        //     //     bgCell: "rgba(75,206,171, 0.05)"
        //     // }

//=======================================================



// let cellObj: TagsCellType = {
//     kind: GridCellKind.Custom,
//     allowOverlay: true,
//     readonly: false,
//     copyData: "4",
//     style: "normal",
//     themeOverride: {
//         bgCell: "rgba(75,206,171, 0.05)"
//     },
//     data: {
//         kind: "tags-cell",
//         tags: ["hello", "earth"],
//         possibleTags: optionsArray.map(a => ({tag: a.id, color: "red"} as any))

//         //     {
//         //         tag: "hello", 
//         //         color: "red",
//         //     },
//         //     {
//         //         tag: "earth", 
//         //         color: "green",
//         //     },
//         //     {
//         //         tag: "jupiter", 
//         //         color: "pink",
//         //     },
//         //     {
//         //         tag: "mars", 
//         //         color: "yellow",
//         //     }
//         // ]

//     }
// };






// let cellObj: MultiSelectCellType = {
//     kind: GridCellKind.Custom,
//     allowOverlay: true,
//     readonly: false,
//     copyData: "4",
//     style: "normal",                            
//     data: {
//         kind: "multi-select-cell",
//         values: rowEntry.targets.map(a => g2gIdToNameMap.get(a) as string).filter(x => (x && x.length > 0)) ?? [], //["glide", "data"],
//         options: returnOptions(),
//         // [{
//         //     value: "glide",
//         //     color: "rgba(233, 236, 240, 0.8)", //"#ffc38a"
//         // }, 
//         // {
//         //     value: "data",
//         //     color: "#ebfdea"
//         // }, 
//         // {
//         //     value: "grid",
//         //     color: "teal"
//         // }],
//         allowDuplicates: false,
//         allowCreation: false
//     },
//     themeOverride: {
//         bgCell: "rgba(75,206,171, 0.05)"
//     }
// };







        // const t: MultiSelectCell = {
        //     kind: GridCellKind.Custom,
        //     allowOverlay: true,
        //     copyData: ["glide", "data", "grid"].join(","),
        //     readonly: row % 2 === 0,
        //     data: {
        //       kind: "multi-select-cell",
        //       values: ["glide", "data", "grid"],
        //       options: [{
        //         value: "glide",
        //         color: "#ffc38a"
        //       }, {
        //         value: "data",
        //         color: "#ebfdea"
        //       }, {
        //         value: "grid",
        //         color: "teal"
        //       }],
        //       allowDuplicates: false,
        //       allowCreation: true
        //     }
        //   };
        //   return t;



// export const G2G_SRC_GROUP_GRID_COLUMN_ID = "G2G_SRC_GROUP_GRID_COLUMN_ID";
// export const G2G_TO_ALL_GRID_COLUMN_ID = "G2G_TO_ALL_GRID_COLUMN_ID";
// export const G2G_EXEMPTION_GRID_COLUMN_ID = "G2G_EXEMPTION_GRID_COLUMN_ID"; 
// export const G2G_CUST_RULE_NAME_GRID_COLUMN_ID = "G2G_CUST_RULE_NAME_GRID_COLUMN_ID"
// export const G2G_TGT_GROUP_GRID_COLUMN_ID = "G2G_TGT_GROUP_GRID_COLUMN_ID" 
// export const G2G_GRID_PAGE_SIZE = Number.MAX_SAFE_INTEGER


//======================================================================================================================================
// #region ============================================================= GROUP-TO-GROUP GRID ===========================================
//======================================================================================================================================

// export function onGroupToGroupEvaluateFillPattern(patternSource: Rectangle, fillDestination: Rectangle, columns: GridColumn[], rowEntry: G2GRelationInfo): boolean {
//     if(patternSource && patternSource.x === 0) {
//         return false;
//     }
//     if(fillDestination && fillDestination.x === 0) { 
//         return false;
//     }
//     if(fillDestination && fillDestination.width > 1) {  //allow only vertical fill
//         return false;
//     }
//     return true
// }


// export async function onGroupToGroupGridCellEdited(ifaceMapping: Map<string, Interface>, editCtx: GridCellEditCtx<G2GRelationInfo>) : Promise<G2GRelationInfo|undefined> {
    
//     // if(editCtx.columnIndex > 0) { //IMPORTANT!!! - prevent changes to Netclass name column
//     //     if(editCtx.columnIndex <= editCtx.rowIndex + 2) {  //IMPORTANT!!! - avoid changes to blocked cells during fill handle
//     //         if(editCtx.current.slots && editCtx.current.slots.length > 0) {
//     //             for(let i = 0; i < editCtx.current.slots.length; i++) {

//     //                 let slotNetclass = netclassMapping.get(editCtx.current.slots[i].netclassId) as Netclass
//     //                 let slotName = editCtx.current.slots[i].name;

//     //                 if (
//     //                     (slotNetclass && slotNetclass.name === editCtx.columnElement.id) //handles cases where col > 1
//     //                     || (editCtx.columnIndex === 1 && slotName && slotName === editCtx.columnElement.id) //handles the '[ALL]' column scenarios
//     //                 ) 
//     //                 { 
//     //                     let value = (editCtx.newValue.kind.toLowerCase() === "custom") ? (editCtx.newValue.data as any).value : editCtx.newValue.data;
//     //                     editCtx.current.slots[i].value = value || '';  //Important to have default empty string!!
//     //                     let updatedC2CRow = await updateClassRelationLayout([editCtx.current])
//     //                     if(updatedC2CRow && updatedC2CRow.length > 0) {
//     //                         return updatedC2CRow[0]
//     //                     }
//     //                 }
//     //             }
//     //         }
//     //     }
//     // }

//     return undefined
// }


// export function getGroupToGroupGridColumns() {
//     let srcGroup: any = { 
//         id: G2G_SRC_GROUP_GRID_COLUMN_ID, 
//         title: "Source Group", //purposefully
//         style: "highlight",
//         icon: GridColumnIcon.HeaderString,
//         allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
//         width: 200
//     }
    
//     let toAll = { 
//         id: G2G_TO_ALL_GRID_COLUMN_ID, 
//         title:"To All", 
//         icon: GridColumnIcon.HeaderString,
//         allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
//         width: 110
//     }

//     let exempt = { 
//         id: G2G_EXEMPTION_GRID_COLUMN_ID, 
//         title: "Exemption", 
//         icon: GridColumnIcon.HeaderString,
//         allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
//         width: 110
//     }

//     let custRuleName = { 
//         id: G2G_CUST_RULE_NAME_GRID_COLUMN_ID, 
//         title: "Custom Rule Name", 
//         icon: GridColumnIcon.HeaderString,
//         allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
//         width: 200
//     }

//     let tgtGroups = { 
//         id: G2G_TGT_GROUP_GRID_COLUMN_ID, 
//         title: "Target Groups", 
//         icon: GridColumnIcon.HeaderString,
//         allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
//         width: 700
//     }

//     let arr = [srcGroup, toAll, exempt, custRuleName, tgtGroups]

//     return arr
// }


// export function getGroupToGroupGridCellContent(rowEntry: G2GRelationInfo, columns: GridColumn[], columnIndex: number) : GridCell {
    
//     // if(columnIndex === 0) {
//     //     let cellObj : GridCell = {
//     //         kind: GridCellKind.Text,
//     //         data: rowEntry.name,
//     //         allowOverlay: true,
//     //         readonly: true,
//     //         displayData: rowEntry.name,
//     //         contentAlign: "center",
//     //         style: "normal",
//     //     }
//     //     return cellObj;
//     // }
//     // else if(columnIndex === 1) {
//     //     let cellObj: DropdownCellType = {
//     //         kind: GridCellKind.Custom,
//     //         allowOverlay: true,
//     //         readonly: false,
//     //         copyData: "4",
//     //         style: "normal",                            
//     //         data: {
//     //             kind: "dropdown-cell",
//     //             allowedValues: [null, ...validClrRelationsOptionsRef],
//     //             value: rowEntry.slots.find(a => a.name === columns[1].title)?.value ?? null,
//     //         },
//     //         themeOverride: {
//     //             bgCell: "rgba(75,206,171, 0.05)"
//     //         }
//     //     };
//     //     return cellObj;
//     // }
//     // else {
//     //     let columnTextName = columns[columnIndex].title
//     //     let rowTextName = rowEntry.name;
//     //     let colSlot = rowEntry.slots[c2cEnabledColumnToIndexMap.get(columnTextName) as number] //Important!

//     //     if(!columnTextName || columnTextName.trim().length === 0 || !rowTextName || rowTextName.trim().length === 0) {
//     //         return {
//     //             kind: GridCellKind.Loading,
//     //             allowOverlay: false,
//     //         };
//     //     }

//     //     /*
//     //     There is a readon why i did not use the "> " operator and elected to use "sort() aka fast-sort.
//     //     String Comparison in TypeScript:
//     //         Understanding the ">" Operator
//     //         In TypeScript, the ">" operator is used to compare two strings lexicographically based on their Unicode values. 
//     //         This means that the comparison is done character by character, starting from the first character of each string.
//     //         Example: "Default" > "DTC_CLK_OSC"
//     //         When comparing the strings "Default" and "DTC_CLK_OSC" using the ">" operator, TypeScript will compare the Unicode values of each character in the strings sequentially:
//     //         Compare 'D' (Unicode: 68) with 'D' (Unicode: 68) - they are equal.
//     //         Compare 'e' (Unicode: 101) with 'T' (Unicode: 84) - 'e' has a higher Unicode value than 'T'.
//     //         Since 'e' > 'T', the comparison "Default" > "DTC_CLK_OSC" will yield true.
            
//     //         WTF! - not what i want!
//     //     */

//     //     //Important! the uppercase in here is massively crucial!!
//     //     //For the first part of the 'if' check --> we need to make sure we dont block the cell where  rowName equals colName
//     //     //If the second part of the check below is 'true', it means 'columnTextName comes AFTER rowTextName in alphabetical order
        
//     //     let sorted = sort([columnTextName, rowTextName]).asc(a => a.toUpperCase())  
//     //     if((columnTextName.toUpperCase() !== rowTextName.toUpperCase()) && (sorted[1].toUpperCase() === columnTextName.toUpperCase())) {
//     //         let cellObj : GridCell = {
//     //             kind: GridCellKind.Loading,
//     //             allowOverlay: false,
//     //             contentAlign: "center",
//     //             style: "faded",
//     //             themeOverride: {
//     //                 bgCell: "rgba(77, 0, 0, .3)"
//     //             }
//     //         }
//     //         return cellObj;
//     //     }
//     //     else {
//     //         let cellObj: DropdownCellType = {
//     //             kind: GridCellKind.Custom,
//     //             allowOverlay: true,
//     //             copyData: "4",
//     //             readonly: false,
//     //             style: "normal",                            
//     //             data: {
//     //                 kind: "dropdown-cell",
//     //                 allowedValues: [null, ...validClrRelationsOptionsRef],
//     //                 value: (netclassMapping.has(colSlot.netclassId) && netclassMapping.get(colSlot.netclassId)?.name === columnTextName) ? colSlot.value : null
//     //             }
//     //         }
//     //         return cellObj;
//     //     }
    
//     // }




//     //============ testing 1 2 3=========
//     let cellObj : GridCell = {
//         kind: GridCellKind.Text,
//         data: rowEntry.name,
//         allowOverlay: true,
//         readonly: true,
//         displayData: rowEntry.name,
//         contentAlign: "center",
//         style: "normal",
//     }
//     return cellObj;
// }


// export function onGroupToGroupGridGetToolTipText(args: GridMouseEventArgs, columns: GridColumn[], rowEntry: G2GRelationInfo, ifaceMapping: Map<string, Interface>) : string|null{
//     if(args && args.location) {
//         let col = args.location[0];
//         if(col === 0) {
//             // if(rowEntry && rowEntry.netclassId && rowEntry.netclassId.trim().length > 0) {
//             //     let netclass = netclassMapping.get(rowEntry.netclassId)
//             //     if(netclass && netclass.interfaceId && netclass.interfaceId.trim().length > 0) {
//             //         let ifaceName = ifaceMapping.get(netclass.interfaceId)
//             //         if(ifaceName && ifaceName.trim().length > 0) {
//             //             let tooltip = `Interface: ${ifaceName}`
//             //             return tooltip
//             //         }
//             //     }
//             // }
//         }
//     }
//     return null
// }
// #endregion ================================================= END: GROUP-TO-GROUP GRID =======================================================
//======================================================================================================================================





















//-----------------------------------------------------------------------------------------------

//let colSlot = rowEntry.slots[columnIndex - 1]  //we do -1 here to exclude the leftmost netclass column


//======================================================================================================================================
//============================================================= CLEARANCE ROUTING RULES GRID ============================================
//======================================================================================================================================
// export async function onClearanceRoutingRulesGridInitialDataFetch(netclassMapping: Map<string, Netclass>, lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>, 
//     projectId: string, limit: number, ruleAreaId: string, interfaceId: string|null, nameStartsWith: string|null, excludeProps: boolean) : Promise<{ data: LayerGroupConstraints[], groupInfo: GroupRowLineInfo[], firstEntryMap: Map<string, string>}> {
    
//     let newLgcList = new Array<LayerGroupConstraints>();
//     let returnGroupingInfo = new Array<GroupRowLineInfo>();
//     let initPulledLgcData = new Array<LayerGroupConstraints>();
//     let filterOutLGCs = new Set<string>();
//     let firstInLineItemsMap = new Map<string, string>();

//     if(projectId && projectId.length > 0) {
//         initPulledLgcData = await fetchConstraints(projectId, null, limit, ruleAreaId, null, interfaceId, null, nameStartsWith, ConstraintTypesEnum.Physical, excludeProps) ?? []
        
//         //filter out LCGs that do not belong to LGSets that are assigned to the involved netclasses (given that this is pertaining to physical rules)
//         if(initPulledLgcData.length > 0) {
//             for(let lgc of initPulledLgcData) {
//                 let netclass = netclassMapping.get(lgc.ownerElementId) as Netclass
//                 let lgSet = lgSetMapping.get(netclass.layerGroupSetId)?.lgSetObj
//                 let layerGroupMappingForLGSet = lgSetMapping.get(netclass.layerGroupSetId)?.lgMapping;

//                 if(layerGroupMappingForLGSet && layerGroupMappingForLGSet.has(lgc.layergroupId) === false) {
//                     filterOutLGCs.add(lgc._id?.toString() as string)
//                 }
//             }
//             if(filterOutLGCs.size > 0) {
//                 initPulledLgcData = initPulledLgcData.filter(a => (filterOutLGCs.has(a._id?.toString()) === false))
//             }    
//         }
        


//         if(initPulledLgcData.length > 0) {
//             let mapped : Map<string, LayerGroupConstraints[]> = groupBy(initPulledLgcData, a => a.ownerElementId);
            
//             //Sort the initial grouping by keys
//             mapped = new Map(
//                 [...mapped.entries()].sort((a, b) => {
//                     let nc_a = (netclassMapping.get(a[0]) as Netclass).name
//                     let nc_b = (netclassMapping.get(b[0]) as Netclass).name
//                     return nc_a.localeCompare(nc_b);
//                 })
//             );

//             let count = 0

//             for(let [key, value] of mapped) {
//                 let netclass = netclassMapping.get(key) as Netclass;
                
//                 //handle group row header info
//                 let info : GroupRowLineInfo = {
//                     index: count, //the index where dummy item lives
//                     headerText: netclass?.name ?? '',
//                     elementId: key, 
//                     isCollapsed: false
//                 };
//                 returnGroupingInfo.push(info);

//                 //perform Sort for value section
//                 value = value.sort((a, b) => {
//                     let a_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(a.layergroupId)?.name as string);
//                     let b_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(b.layergroupId)?.name as string); 
//                     return (a_layerGroupName < b_layerGroupName ? -1 : 1) 
//                 });
                
//                 //Important! This needs to happen after sort!!
//                 firstInLineItemsMap.set(netclass._id as string, value[0]._id)

//                 let dummyLGC : LayerGroupConstraints = {
//                     _id: `${DUMMY_LGC_ID_PREFIX}${key}`, //important! leave this as is!
//                     ownerElementId: value[0].ownerElementId,  
//                     ruleAreaId: ruleAreaId,
//                     layergroupId: initPulledLgcData[0].layergroupId, //necessary dummy value
//                     constraintType: ConstraintTypesEnum.Physical,
//                     associatedProperties: [],
//                     projectId: projectId,
//                     snapshotSourceId: "",
//                     contextProperties: [],
//                     lastUpdatedOn: new Date()
//                 }
                
//                 newLgcList = count === 0 ? [dummyLGC, ...value] : newLgcList.concat([dummyLGC, ...value]);
//                 count = newLgcList.length;
//             }
//         }

//     }

//     return { data: newLgcList, groupInfo: returnGroupingInfo, firstEntryMap: firstInLineItemsMap }
// }
//================================================= END: CLR ROUTING RULES ===========================================================




// export async function onBasicNetNameGridCellEdited(currentNet: Net, newValue: EditableGridCell, columnIndex: number, columnElement: GridColumn) : Promise<Net|undefined> {
//     if (newValue.kind !== GridCellKind.Text) return undefined;
//     let updateCtx : NetMgmtCtx = {
//         projectId: currentNet.projectId,
//         actionType: NetManagementActionTypeEnum.RENAME_NET,
//         status: "",
//         netsInvolved: [currentNet],
//         contextualInfo: newValue.data
//     }
//     let resCtx = await updateNets(updateCtx)
//     if(resCtx && resCtx.status.toLowerCase() === "success" && resCtx.netsInvolved && resCtx.netsInvolved.length > 0)
//     {
//         return resCtx.netsInvolved[0]  
//     }
//     else {
//         return undefined;  //this will cause no update to occur on grid
//     }
// }



//=============================================================================================================


// let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
// let blockCell = false;
// if(exportSettings && exportSettings.setToDiffPairEntity && exportSettings.setToDiffPairEntity === true) {
//     if(rowEntry.diffPairMapType === DataMappingTypeEnum.Unmapped){
//         blockCell = true 
//     }
// }


//==================================================================================================

// if(lgcPropNamesMap && lgcPropNamesMap.size > 0) {
//     for (let [name, displayName] of lgcPropNamesMap) {
//         if(confPropMapping.has(name)) {
//             let prop: PropertyItem = confPropMapping.get(name) as PropertyItem;
//             let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
            
//             if(displaySettings) {
//                 let item : any = { 
//                     id: name, //Column ID is Constraint property Name
//                     title: displayName ?? '', 
//                     style: displaySettings.setHighLighted && displaySettings.setHighLighted === true ? "highlight" : "normal",
//                     allowWrapping: displaySettings.allowWrapping ? displaySettings.allowWrapping : true,
//                     icon: gridColumnIcons.has(displaySettings.icon ?? '') ? displaySettings.icon : GridColumnIcon.HeaderString
//                 };  

//                 arr.push(item)
//             }
//         }
//     }
// }




                    
// if(validClrRelationsOptsAsMapRef.has(value)) {
//     currentC2CRow.slots[i].value = value;
//     let updatedC2CRow = await updateClassRelationLayout([currentC2CRow])
//     if(updatedC2CRow && updatedC2CRow.length > 0) {
//         return updatedC2CRow[0]
//     }
// }
// else{
//     console.error(`glide grid cell editing cannot proceed. value unexpected`)
// }




// export function getClearanceRoutingRulesGridCellContent(path: any, netclassMapping: Map<string, Netclass>, firstEntryMap: Map<string, string> | null,
//     lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>, 
//     lgSetOptions: GridDropDownOption[], relevantPropMapping: Map<string, PropertyItem>, 
//     rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number) : GridCell {

// 	let gridCellKinds = getEnumValuesAsArray(GridCellKind)
//     let propEntryArr: any[] = (rowEntry as LayerGroupConstraints).associatedProperties.map(x => [x.name, x.value]);
    
//     let map = new Map<string, ConstraintValues>(propEntryArr)
    
//     let netclass = netclassMapping.get(rowEntry.ownerElementId) as Netclass
//     let netclassVal : ConstraintValues = {id: '', configValue: '', defautlValue: netclass?.name ?? '', customValue: netclass?.name ?? ''};
//     map.set(CONSTRAINT_ELEMENT_GRID_COLUMN_ID, netclassVal)

//     let lgSet = lgSetMapping.get(netclass.layerGroupSetId)?.lgSetObj
//     let lgSetName = lgSet?.name as string //lgSetMapping.get(netclass.layerGroupSetId)?.lgSetObj.name as string
//     let lgSetVal : ConstraintValues = {id: '', configValue: '', defautlValue: lgSetName, customValue: lgSetName};
//     map.set(LGSET_GRID_COLUMN_ID, lgSetVal)

//     let layerGroupName = lgSetMapping.get(netclass.layerGroupSetId)?.lgMapping.get(rowEntry.layergroupId)?.name as string
//     let layerGroupVal : ConstraintValues = {id: '', configValue: '', defautlValue: layerGroupName, customValue: layerGroupName};
//     map.set(LAYER_GROUP_GRID_COLUMN_ID, layerGroupVal)


//     let key = columns[columnIndex]?.id ?? ''
//     let focusVal = map.get(key)
//     let dataValue = '' 
    
//     if(focusVal) {
//         //WARNING: order matters here. custom value must come first!
//         if(focusVal.customValue.trim().length > 0) {
//             dataValue = focusVal.customValue;
//         }
//         else if(focusVal.defautlValue.trim().length > 0) {
//             dataValue = focusVal.defautlValue;
//         }
//         else if(focusVal.configValue.trim().length > 0) {
//             dataValue = focusVal.configValue;
//         }
//     }
    
//     if(columnIndex === 0) {
//         let cellObj : GridCell = {
//             kind: GridCellKind.Loading,
//             allowOverlay: false,
//         }
//         return cellObj;
//     } 
//     else if (columnIndex === 1) { 
//         if(firstEntryMap && firstEntryMap.size > 0 && firstEntryMap.get(netclass._id) === rowEntry._id){ //IMPORTANT!!
//             let cellObj: DropdownCellType = {
//                 kind: GridCellKind.Custom,
//                 allowOverlay: true,
//                 readonly: false,
//                 copyData: "4",
//                 style: "normal",                            
//                 data: {
//                     kind: "dropdown-cell",
//                     allowedValues: [null, ...lgSetOptions],
//                     value: lgSet?.id,
//                 },
//                 themeOverride: {
//                     // accentColor: "rgba(71, 71, 71, 0.781)", //for cell border and currently/already selected option
//                     accentLight: "#212121", //"#203f5c",  //for box selected and options hovered
//                     bgCell: "rgba(7, 18, 15, .3)",
//                 }
//             };
//             return cellObj;
//         }
//         else {
//             let cellObj : GridCell = {
//                 kind: GridCellKind.Loading,
//                 allowOverlay: false,
//             }
//             return cellObj;
//         }
//     }
//     else if (columnIndex === 2) {
//         let cellObj : GridCell = {
//             kind: GridCellKind.Text,
//             data: dataValue,
//             allowOverlay: true,
//             readonly: true,
//             displayData: dataValue,
//             contentAlign: "left"
//         }
//         return cellObj;
//     }
//     else if(key && key.length > 0) {
//         let prop: PropertyItem = relevantPropMapping.get(key) as PropertyItem;
//         let displaySettings : ConstraintConfPropSubContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
//         if(displaySettings) {
            
//             //Cell Kinds:
//             //  https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--all-cell-kinds
//             //  https://glideapps.github.io/glide-data-grid/?path=/story/extra-packages-cells--custom-cells
//             //  https://www.npmjs.com/package/@glideapps/glide-data-grid-cells
//             //  https://docs.grid.glideapps.com/api/cells

//             if(gridCellKinds.has(displaySettings.columnCellKind ?? '')) {
//                 let cellObj : GridCell = {
//                     kind: (gridCellKinds.has(displaySettings.columnCellKind ?? '') ? displaySettings.columnCellKind : GridCellKind.Text) as any,
//                     data: dataValue,
//                     allowOverlay: displaySettings.allowOverlay ?? true,
//                     readonly: false,
//                     displayData: dataValue,
//                     contentAlign: ((displaySettings.contentAlign && ["left", "right", "center"].includes(displaySettings.contentAlign.toLowerCase())) ? displaySettings.contentAlign : "center") as any 
//                 }
//                 return cellObj
//             }
//             else {
//                 if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "dropdowncell") {
//                     //nothing here for now
//                 }
//                 else if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "buttoncell") {
//                     //nothing here for now.
//                 }
//                 else if(displaySettings.columnCellKind && displaySettings.columnCellKind.toLowerCase() === "rangecell") {
//                     //nothing here for now
//                 }
//             }
//         }
//     }
    
//     return {
//         kind: GridCellKind.Loading,
//         allowOverlay: false,
//     };
// }



//====================================================

// export function getPhysicalRoutingRulesRowGroupGridCellContent(netclassMapping: Map<string, Netclass>, groupRowLines: GroupRowLineInfo[],
//     rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number, isGroupHeader: boolean, path: readonly number[]): GridCell {

//     let lineInfo = groupRowLines && groupRowLines.length > 0 ? groupRowLines[path[0]] : undefined

//     if(!rowEntry || isGroupHeader === false) {
//         let cellObj : GridCell = {
//             kind: GridCellKind.Loading,
//             allowOverlay: false,
//         }
//         return cellObj;
//     }

//     if(!lineInfo || !lineInfo.elementId || netclassMapping.has(lineInfo.elementId) === false){
//         // Log  for debugging purposes only
//         // console.log("Get GroupRow Cell Content: [path] => ", path)
//         // console.log("Get GroupRow Cell Content: [rowEntry] => ", rowEntry)
//         // console.log("Get GroupRow Cell Content: [groupRowLines] => ", groupRowLines)
//         // console.log("Get GroupRow Cell Content: [lineInfo] => ", lineInfo)
//         // console.log("Get GroupRow Cell Content: [netclassMapping] => ", netclassMapping)
        
//         let cellObj : GridCell = {
//             kind: GridCellKind.Loading,
//             allowOverlay: false,
//         }
//         return cellObj;
//     }

//     let netclass = netclassMapping.get(lineInfo.elementId) as Netclass
//     let grpRowTextValue = netclass.name.toUpperCase();
//     let cellObj : GridCell = {
//         kind: GridCellKind.Text,
//         data: grpRowTextValue,
//         allowOverlay: true,
//         readonly: true,
//         displayData: grpRowTextValue,
//         contentAlign: "center",
//         themeOverride: {
//             baseFontStyle: "normal 13px",
//         }
//     }
//     return cellObj

// }


//=============================================


                //GET ROW GROUPING FUNC
            // let netclass = netclassMapping.get(rowEntry.ownerElementId) as Netclass


//================================================================================


        // //Handle grouping  - which involves inserting some Dummy LGCs
        // if(initPulledLgcData.length > 0) {
            
        //     let mapped : Map<string, LayerGroupConstraints[]> = groupBy(initPulledLgcData, a => a.ownerElementId);

        //     let count = 0
        //     for(let [key, value] of mapped) {
        //         let netclass = netclassMapping.get(key) as Netclass;
                
        //         let info : GroupHeaderLineInfo = {
        //             index: count, //the index where dummy item lives
        //             headerText: netclass?.name ?? '',
        //             elementId: key
        //         };

        //         returnGroupingInfo.push(info);
                
        //         value = value.sort((a, b) => {
        //             let a_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(a.layergroupId)?.name as string);
        //             let b_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(b.layergroupId)?.name as string); 
        //             return (a_layerGroupName < b_layerGroupName ? -1 : 1) 
        //         });

        //         //Important! This needs to happen after sort!!
        //         firstInLineItemsMap.set(netclass._id as string, value[0]._id)
                
        //         newLgcList = count === 0 ? value : newLgcList.concat([value[0], ...value]);
        //         count = newLgcList.length;
        //     }
        // }

        //========================================
        //Handle grouping  - which involves inserting some Dummy LGCs
        // if(initPulledLgcData.length > 0) {
        //     let dummyLGC : LayerGroupConstraints = {
        //         _id: "", //important! leave this empty!
        //         ownerElementId: "",  
        //         ruleAreaId: ruleAreaId,
        //         layergroupId: initPulledLgcData[0].layergroupId, //necessary dummy value
        //         constraintType: ConstraintTypesEnum.Physical,
        //         associatedProperties: [],
        //         projectId: projectId,
        //         snapshotSourceId: "",
        //         contextProperties: [],
        //         lastUpdatedOn: new Date()
        //     }

        //     let mapped : Map<string, LayerGroupConstraints[]> = groupBy(initPulledLgcData, a => a.ownerElementId);

        //     let count = 0
        //     for(let [key, value] of mapped) {
        //         let netclass = netclassMapping.get(key) as Netclass;
                 
        //         let info : GroupHeaderLineInfo = {
        //             index: count, //the index where dummy item lives
        //             headerText: netclass?.name ?? '',
        //             elementId: key
        //         };

        //         dummyLGC.ownerElementId = value[0].ownerElementId;
        //         returnGroupingInfo.push(info);
                
        //         value = value.sort((a, b) => {
        //             let a_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(a.layergroupId)?.name as string);
        //             let b_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(b.layergroupId)?.name as string); 
        //             return (a_layerGroupName < b_layerGroupName ? -1 : 1) 
        //         });
                
        //         newLgcList = (newLgcList.length === 0) ? [{...dummyLGC}, ...value] : [...newLgcList, {...dummyLGC}, ...value];
        //         count = newLgcList.length;
        //     }
        // }


        // ==============================

        // //Handle grouping  - which involves inserting some Dummy LGCs
        // if(initPulledLgcData.length > 0) {
            
        //     let mapped : Map<string, LayerGroupConstraints[]> = groupBy(initPulledLgcData, a => a.ownerElementId);

        //     let count = 0
        //     for(let [key, value] of mapped) {
        //         let netclass = netclassMapping.get(key) as Netclass;
                 
        //         let info : GroupHeaderLineInfo = {
        //             index: count, //the index where dummy item lives
        //             headerText: netclass?.name ?? '',
        //             elementId: key
        //         };

        //         returnGroupingInfo.push(info);
                
        //         value = value.sort((a, b) => {
        //             let a_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(a.layergroupId)?.name as string);
        //             let b_layerGroupName = (lgSetMapping.get(netclass?.layerGroupSetId)?.lgMapping.get(b.layergroupId)?.name as string); 
        //             return (a_layerGroupName < b_layerGroupName ? -1 : 1) 
        //         });
                
        //         newLgcList = newLgcList.concat(value);
        //         count = newLgcList.length;
        //     }
        // }

        // =============================


        //================================================================================






// export async function onPhysicalRoutingRulesGridSubsequentDataFetch(projectId: string, lastId: string, limit: number, ruleAreaId: string, interfaceId: string|null, nameStartsWith: string|null) : Promise<LayerGroupConstraints[]> {
//     let lgcList = new Array<LayerGroupConstraints>();
//     if(projectId && projectId.length > 0) {
//         lgcList = await fetchConstraints(projectId, lastId, limit, ruleAreaId, null, interfaceId, null, nameStartsWith, ConstraintTypesEnum.Physical, false) ?? []
//     }
//     return lgcList
// }



// export function getRowGroupCellContent(relevantPropMapping: Map<string, PropertyItem>, matchGroupOptions: string[], rowEntry: Net, columns: GridColumn[], columnIndex: number) : GridCell {
//     return {
//         kind: GridCellKind.Loading,
//         allowOverlay: false
//     };
// }



    // // let allColumn : any = { 
    // //     id: C2C_ALL_GRID_COLUMN_ID, 
    // //     title: "[ALL]", 
    // //     style: "normal",
    // //     icon: GridColumnIcon.HeaderString,
    // //     allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
    // //     width: 200
    // // }

    // let arr = new Array<GridColumn>().concat([netclassLeftSideNameCol])

    // // c2cColumnsArray = c2cColumnsArray.filter(a => a.toUpperCase() !== "[ALL]")





//========================================================================================================





// const [rowGrouping, setRowGrouping] = useState <RowGroupingOptions> (() => ({
//     groups: [{
//         headerIndex: 0,
//         isCollapsed: false
//     }, {
//         headerIndex: 10,
//         isCollapsed: true,
//         subGroups: [{
//             headerIndex: 15,
//             isCollapsed: false
//         }, {
//             headerIndex: 20,
//             isCollapsed: false
//         }]
//     }, {
//         headerIndex: 30,
//         isCollapsed: false
//     }],
//     height: 55,
//     navigationBehavior: "block",
//     selectionBehavior: "block-spanning",
//     themeOverride: {
//         bgCell: "rgba(0, 100, 255, 0.1)"
//     }
// }));




// const getCellContent = useCallback(() => {
//     const starCell: xxx.StarCellType = {
//         kind: GridCellKind.Custom,
//         allowOverlay: true,
//         copyData: "4 out of 5",
//         data: {
//             kind: "star-cell",
//             label: "Test",
//             rating: 4,
//         },
//     };

//     return starCell;
// }, []);
// xxx.
// const Grid = () => {
//     const { customRenderers } = useExtraCells();
//     return <DataEditor customRenderers={customRenderers} {...rest} />;
// };






    // let cellObj : GridCell = {
	//     kind: GridCellKind.Text,
	//     data: rowEntry.name ?? '',
	//     allowOverlay: true,
	//     displayData: rowEntry.name ?? '',
	//     contentAlign: "left"  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--content-alignment
	// }

    // return cellObj;

//TODO: this 'netPropNamesMap' needs to be the full configured net property list: then in the next function below we can retrieve the config from zuStore and do whatever needs to be done based on column settings
        // {
        //     "id": "1",
        //     "name": "Formula",
        //     "value": "aa",
        //     "category": "General",
        //     "editable": true,
        //     "enabled": true,
        //     "contextProperties": [
        //         {
        //             "id": "",
        //             "name": "export_context",
        //             "value": {
        //                 "subType": "LengthMatching",
        //                 "exportEnabled": true,
        //                 "genericKey": "",
        //                 "apdKey": "",
        //                 "xpeditionKey": ""
        //             }
        //         },
        //         {
        //             "id": "",
        //             "name": "display_context",
        //             "value": {
        //                 "displayName": "Formula",
        //                 "gridCellKind": "text",
                        
        //                 "genericKey": "",
        //                 "apdKey": "",
        //                 "xpeditionKey": ""
        //             }
        //         }
        //     ]
        // },




//=================================== ROW GROUPING =============================
    
    // const [rowGroupingOptions, setRowGroupingOptions] = React.useState < RowGroupingOptions > (() => ({
    //     groups: [
    //         {
    //             headerIndex: 0,
    //             isCollapsed: false
    //         }, 
    //         {
    //             headerIndex: 10,
    //             isCollapsed: false,
    //             // subGroups: [
    //             //     {
    //             //     headerIndex: 15,
    //             //     isCollapsed: false
    //             //     }, 
    //             //     {
    //             //         headerIndex: 20,
    //             //         isCollapsed: false
    //             //     }
    //             // ]
    //         }, 
    //         {
    //             headerIndex: 30,
    //             isCollapsed: false
    //         }
    //     ],
    //     height: 55,
    //     navigationBehavior: "normal",
    //     selectionBehavior: undefined,
    //     themeOverride: {
    //         bgCell: "rgba(0, 100, 255, 0.1)"
    //     }
    // }));
   


// if (rowGroupingOptions) {
//     if(cell[0] === 0) {
//         return {
//             kind: GridCellKind.Text,
//             data: `Row ${JSON.stringify(path)}`,
//             displayData: `Row ${JSON.stringify(path)}`,
//             allowOverlay: true
//         };
//     } 
//     else if (isGroupHeader) {
//         return {
//             kind: GridCellKind.Loading,
//             allowOverlay: true
//             // span: [1, cols.length - 1],
//         };
//     }
// }


//==================================================



// export function onLoadedNetGridCellEdited(currentNet: Net, newValue: EditableGridCell, columnIndex: number) : Net|undefined {
//     if (newValue.kind !== GridCellKind.Text) return undefined;
// 	let propIndex = (columnIndex === 0) ? 0 : (columnIndex-1)
// 	currentNet.associatedProperties[propIndex].value = newValue.data
// 	let returnNet = {...currentNet}
//     return returnNet;
// }


// export function getLoadedNetGridCellContent(rowEntry: Net, columns: GridColumn[], columnIndex: number) : GridCell {
//     let map = new Map<string, string>() //temp
    
    
//     // let arr = rowEntry.associatedProperties.map(x => [x.name, x.value])
//     // let map = new Map<string, string>(arr)
// 	map.set(NET_NAME_GRID_COLUMN_ID, rowEntry.name)
// 	let mapEntry = map.get(columns[columnIndex]?.id ?? '') ?? ''

// 	let cellObj : GridCell = {
// 	    kind: GridCellKind.Text,
// 	    data: mapEntry,
// 	    allowOverlay: true,
// 	    displayData: mapEntry,
// 	    contentAlign: columnIndex === 0 ? "left" : "center"  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--content-alignment
// 	}

//     return cellObj;
// }








//===========================================================================================

// /* NEEDED:
//     **gridHeight: string,
//     *headerHeight?: string,
//     *gridRef: any,
//     columns: GridColumn[],
//     pageSize: number;
//     totalRowCount: number,
//     enableFillHandle: boolean,
//     multiSelectEnabled: boolean,
//     headerMenuInfo?: MenuInfo[],
//     cellContextMenuInfo?: MenuInfo[],
//     rightElementContent?: JSX.Element,
//     onFetchFirstSetData: (limit: number, filterText: string) => T[],
//     onFetchSubsequentData: (lastId: string, limit: number, filterText: string) => T[],
//     onGridCellEdited?: (current: T, newValue: EditableGridCell, column: number) => T,
//     getGridCellContent(rowEntry: T, columnIndex: number) : GridCell,
// */

// const diffGridRef = useRef<any>();


// const columns = () => {           
//     let netNameCol = { 
//         id: NET_NAME_GRID_COLUMN_ID, 
//         title: "Net Name", 
//         icon: GridColumnIcon.HeaderString,
//         allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
//         width: 300
//     }

//     let arr = new Array<GridColumn>(netNameCol) 

//     if(netPropNamesMap && netPropNamesMap.size > 0) {
//         for (let [name, displayName] of netPropNamesMap) {
//             let item = { 
//                 id: name, 
//                 title: displayName ?? '', 
//                 allowWrapping: true,
//                 icon: GridColumnIcon.HeaderString,
//             };
//             arr.push(item)
//         }
//     }

//     return arr
// }


// const onContextMenuDataAvailable = useCallback((contextualInfo: BasicKVP) => {
//     console.error("NOT YET IMPLEMENTED - context menu callback")
// }, [])


// let cellContextMenuInfo : MenuInfo[] = [
//     {
//         label: "Show change history",
//         icon: <ChangeHistory />,
//         callbackAction: onContextMenuDataAvailable,
//         contextualInfo: {key: "CHANGE_HISTORY", value: null } as BasicKVP
//     },
//     {
//         label: "Do Some other task - skfnsjfnksjkdfkbhkjbkjbkjbs",
//         icon: <Person2Outlined />,
//         callbackAction: onContextMenuDataAvailable,
//         contextualInfo: {key: "CHANGE_HISTORY", value: null } as BasicKVP
//     },
    
// ]




// export const rightElementContent = () => {
//     return (
//         <div style={{
//             height: "100%",
//             padding: "20px 20px 40px 20px",
//             width: 200,
//             color: "black",
//             whiteSpace: "pre-wrap",
//             backgroundColor: "rgba(240, 240, 250, 0.2)",
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             boxShadow: "0 0 10px rgba(0, 0, 0, 0.15)",
//             backdropFilter: "blur(12px)"
//         }}>
//             <List dense={true}>
//                 <>
//                     <ListItem onClick={(e) => alert("hello earth!!!!!")} dense divider disablePadding>
//                         <ListItemIcon>
//                             <DraftsOutlined fontSize="inherit"/>
//                         </ListItemIcon>
//                         <ListItemText primary={`Delete header`}/>
//                     </ListItem>
//                     <ListItem dense divider disablePadding>
//                         <ListItemIcon>
//                             <DraftsOutlined fontSize="inherit"/>
//                         </ListItemIcon>
//                         <ListItemText primary={`Rename header`}/>
//                     </ListItem>
//                     <ListItem dense divider disablePadding>
//                         <ListItemIcon>
//                             <DraftsOutlined fontSize="inherit"/>
//                         </ListItemIcon>
//                         <ListItemText primary="Remove header Nets"/>
//                     </ListItem>
//                     <ListItem dense divider disablePadding>
//                         <ListItemIcon>
//                             <DraftsOutlined fontSize="inherit"/>
//                         </ListItemIcon>
//                         <ListItemText primary="Run header header"/>
//                     </ListItem>
//                 </>
//             </List>
//         </div>
//     );
// }