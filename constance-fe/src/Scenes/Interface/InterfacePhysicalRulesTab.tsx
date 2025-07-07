import { Box, Divider, IconButton, Slide, Switch, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { ConstraintTypesEnum, PermissionActionEnum, UIMessageType } from "../../DataModels/Constants";
import { Accordion } from "@mantine/core";
import { Interface, LayerGroup, LayerGroupConstraints, LayerGroupSet, Netclass, PackageLayout, Project, RuleArea } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { GridDropDownOption, GroupRowLineInfo, SpecialGridActionContext } from "../../CommonComponents/BaseGlideGrid";
import { BasicKVP, BasicProperty, LoggedInUser, PropertyItem, SPDomainData } from "../../DataModels/HelperModels";
import { groupBy, rfdcCopy } from "../../BizLogicUtilities/UtilFunctions";
import rfdc from "rfdc";
import CompressedRulesItem from "../../CommonComponents/CompressedRulesItem";
import ExpandedRulesItem from "../../CommonComponents/ExpandedRulesItem";




interface InterfacePhysicalRulesTabProps {
    iface: Interface, //passed in for a reason!
    lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>,
    lgSetOptions: GridDropDownOption[],
    maxLGCount: number,
    relevantPropMap: Map<string, PropertyItem>,
    focusRA: RuleArea|null|undefined, 
    setFocusRA: any,
}

const InterfacePhysicalRulesTab: React.FC<InterfacePhysicalRulesTabProps> = ({ iface, focusRA, setFocusRA, lgSetMapping, lgSetOptions, maxLGCount, relevantPropMap }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    
    const domainData = useLoaderData() as SPDomainData;
    const project = domainData.project;
    const netclasses = domainData.netclasses as Netclass[];
    const packageLayout = domainData.packageLayout;

    const [visibleRuleAreas, setVisibleRuleAreas] = useState<RuleArea[]>([])

    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser);

    
    useEffect(() => {
        placePageTitle("InterfacePhysicalRules")
    }, []);


    useEffect(() => {
        if(packageLayout && packageLayout.ruleAreas && packageLayout.ruleAreas.length > 0) {
            let raList = new Array<RuleArea>();
            for(let ra of packageLayout.ruleAreas) {
                if(ra.visibilityContext && ra.visibilityContext.length > 0) {
                    let ctxProp : BasicProperty|null = ra.visibilityContext?.find(a => a.name === ConstraintTypesEnum.Physical) ?? null
                    if(ctxProp && ctxProp.value && iface && iface._id && iface._id.toString().trim().length > 0) {
                        if(ctxProp.value.includes(iface._id.toString().trim())) {
                            continue;
                        }
                    }
                }
                
                raList.push(ra)
            }

            setVisibleRuleAreas(raList)
        }
    }, []);


    const ncMapByIface : Map<string, Netclass[]> = useMemo(() => {         
        let grouping = groupBy(netclasses ?? [], a => a.interfaceId)
        return grouping
    }, []);


    function handleOnClick (clickedRuleArea: RuleArea) {
        if(clickedRuleArea) {
            if(focusRA && clickedRuleArea && focusRA.id === clickedRuleArea.id)
            {
                setFocusRA(null) 
            }
            else {
                setFocusRA({...clickedRuleArea} as RuleArea) 
            }
        }
    }


    function onLGSetChange (clickedRuleArea: RuleArea) {
        if(clickedRuleArea) {
            if(focusRA && clickedRuleArea && focusRA.id === clickedRuleArea.id)
            {
                //do nothing for now...
            }
        }
    }


    
    
    return (
        <>
            <Box className="staggered-list-content">
                {visibleRuleAreas && 
                    <ul className="list">
                        {visibleRuleAreas.map((ra: RuleArea, i: number) => {
                            return (
                                <li key={`itm-${i}`} style={{ minWidth: 400}}>
                                    {((focusRA && focusRA.id === ra.id))
                                        ? <ExpandedRulesItem key={`exp-${i}`} ruleArea={focusRA} interfaceId={iface._id.toString()}
                                            project={project as Project} lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} 
                                            maxLGCount={maxLGCount} relevantPropMap={relevantPropMap}
                                            constraintType={ConstraintTypesEnum.Physical} enableSearchField={true} onClick={handleOnClick} /> 

                                        : <CompressedRulesItem 
                                            key={`cpr-${i}`} 
                                            ruleArea={ra} 
                                            onClick={handleOnClick} 
                                            constraintType={ConstraintTypesEnum.Physical} 
                                            contentCount={ncMapByIface.get(iface._id.toString())?.length ?? 0} />
                                    }
                                </li>
                            );
                        })}
                    </ul>
                }  
            </Box>
        </>
    )
}

export default InterfacePhysicalRulesTab







//=====================================================================================






// interface ExpandedPhysicalRulesItemProps {
//     ruleArea: RuleArea,
//     iface: Interface,
//     project: Project,
//     relevantPropMap: Map<string, PropertyItem>,
//     maxLGCount: number,
//     lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>,
//     lgSetOptions: GridDropDownOption[],
//     constraintType: ConstraintTypesEnum,
//     onClick: (clickedItem: RuleArea) => void,
//     onLGSetChange: (clickedItem: RuleArea) => void
// }

// const ExpandedPhysicalRulesItem: React.FC<ExpandedPhysicalRulesItemProps> = ({ ruleArea, iface, project, relevantPropMap, maxLGCount, lgSetMapping, lgSetOptions, constraintType, onClick, onLGSetChange }) => {
//     const theme = useTheme();
//     const colors = tokens(theme.palette.mode);
//     const navigate = useNavigate();

//     const containerRef = useRef<any>();
//     const physGridRef = useRef<any>();
//     const gridActionRef = useRef<SpecialGridActionContext<LayerGroupConstraints>|undefined>();
//     const netclassMappingRef = useRef<Map<string, Netclass>>(new Map<string, Netclass>());
//     const firstEntryMapRef = useRef<Map<string, string>>()


//     const [selectedConstraintInfo, setSelectedConstraintInfo] = useState<Map<BasicKVP, number>>(new Map<BasicKVP, number>());
//     const [count, setCount] = useState<number>(0);
//     const [groupRowLineItems, setGroupRowLineItems] = useState<GroupRowLineInfo[]|undefined>([])

//     const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
//     const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
//     const showRightElementOnGrid = useSpiderStore((state) => state.showRightElementOnGrid);

//     const projectId = project?._id.toString() ?? "";


//     const gridColumns = useMemo(() => {         
//         let cols = getCommonRoutingRulesGridColumns(relevantPropMap, constraintType)
//         return cols
//     }, []);


//     useMemo(() => {         
//         const initSteps = async () => {
//             await refreshNCMappingRef()
//             let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, netclassMappingRef.current, lgSetMapping, projectId, Number.MAX_SAFE_INTEGER, ruleArea.id, iface._id, null, true)
            
//             setGroupRowLineItems(res.groupInfo as GroupRowLineInfo[])

//             let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_LGC_ID_PREFIX)).length;
//             let maxCount = (maxLGCount * netclassMappingRef.current.size) + dummyCount + 1;
//             setCount(maxCount)
//         }
//         initSteps()
//     }, []);

    
//     useEffect(() => {         
//         if(gridActionRef && gridActionRef.current){
//             gridActionRef.current?.setRightElementEnablement(showRightElementOnGrid) 
//             gridActionRef.current?.reloadDataRows()
//         }
//     }, [showRightElementOnGrid]);


//     //Important!
//     async function refreshNCMappingRef() {
//         let ncList = await fetchNetclassList(projectId)
//         if(ncList && ncList.length > 0) {
//             let map = new Map<string, Netclass>();
//             for(let nc of ncList) {
//                 if(nc.interfaceId === iface._id) {
//                     map.set(nc._id, nc);
//                 }
//             }
//             netclassMappingRef.current = map;
//         }
//     }


//     function onPhysicalRoutingRulesGridSelectionCleared(): void {
//         setSelectedConstraintInfo(new Map<BasicKVP, number>())
//     }


//     function onPhysicalRoutingRulesGridSelectionChanged(selectedConstraintIdsMap: Map<string, number>): void {
//         if(gridActionRef && gridActionRef.current && selectedConstraintIdsMap && selectedConstraintIdsMap.size > 0) {
//             let map = new Map<BasicKVP, number>();
//             for (let [key, value] of selectedConstraintIdsMap) {
//                 let constraintObj = gridActionRef.current.getDataAtIndex(value)
//                 map.set({key: key, value: constraintObj?._id } as BasicKVP, value)
//             }
//             setSelectedConstraintInfo(map)
//         }
//         else {
//             setSelectedConstraintInfo(new Map<BasicKVP, number>())
//         }
//     }


//     async function executePhysicalRoutingRulesGridInitialDataFetch(projectId: string, existingGroupRowLineInfoList: readonly GroupRowLineInfo[]|undefined, limit: number, ruleAreaId: string, interfaceId: string|null, filterText: string|null, excludeProps: boolean) : Promise<LayerGroupConstraints[]> {
//         let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, netclassMappingRef.current, lgSetMapping, projectId, limit, ruleAreaId, interfaceId, filterText, excludeProps);//filterText
        
//         // Collapse the ones that are still exactly the same (best case match)
//         if(existingGroupRowLineInfoList && existingGroupRowLineInfoList.length > 0) {
//             let exRGMap = new Map<string, GroupRowLineInfo>();
//             existingGroupRowLineInfoList.forEach(a => exRGMap.set(a.elementId, a))

//             for(let i = 0; i < res.groupInfo.length; i++) {
//                 let equiv = exRGMap.get(res.groupInfo[i].elementId)
//                 if(equiv && res.groupInfo[i].index === equiv.index && res.groupInfo[i].headerText === equiv.headerText) {
//                     res.groupInfo[i].isCollapsed = equiv.isCollapsed;
//                 }
//             } 
//         }

//         setGroupRowLineItems(res.groupInfo as GroupRowLineInfo[])
//         if (gridActionRef && gridActionRef.current) {
//             gridActionRef.current.setGridRowGroupingInfo(res.groupInfo as GroupRowLineInfo[])

//             let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_LGC_ID_PREFIX)).length;
//             let maxCount = (maxLGCount * res.firstEntryMap.size) + dummyCount + 1;
//             setCount(maxCount)
//             gridActionRef.current.changeRowCount(maxCount)
//         }

//         firstEntryMapRef.current = res.firstEntryMap
//         return res.data;
//     }

    
//     async function handlePhysicalRoutingRulesGridCellEdited(editCtx : GridCellEditCtx<LayerGroupConstraints>, forceNonLGSetChangeRefresh : boolean = false): Promise<LayerGroupConstraints | undefined> {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_ROUTING_CONSTRAINTS) === false) { return; }
//         let res = await onCommonRoutingRulesGridCellEdited(editCtx.current, editCtx.newValue, editCtx.columnIndex, editCtx.columnElement)
//         if(res && res.refresh === true || forceNonLGSetChangeRefresh === true) {
//             await refreshNCMappingRef()
//             if (gridActionRef && gridActionRef.current) {
//                 if(netclassMappingRef && netclassMappingRef.current){
//                     gridActionRef.current.reloadDataRows()
//                     if(forceNonLGSetChangeRefresh === false) {
//                         onLGSetChange(ruleArea);
//                     }
//                 }   
//             }
//         }
//         return res.data
//     }



//     function onSearchInitiated(): void {
//         //do nothing for now...
//     }


//     async function onGridCellValueChangeCompleted(): Promise<void> {
//         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Value change completed")
//     }
    

//     async function onPhysicalRoutingRulesGridRightElementRetrieval(rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number, rowIndex: number): Promise<JSX.Element | undefined> {
//         //get layer group Name
//         let grouperMapping = netclassMappingRef.current;
//         let grouperElement : Netclass = grouperMapping.get(rowEntry.ownerElementId) as Netclass
//         let grouperLgSetId = (grouperElement as Netclass).layerGroupSetId;
//         let layerGroupMappingForLGSet = lgSetMapping.get(grouperLgSetId)?.lgMapping ?? new Map<string, LayerGroup>();
//         let lgName = layerGroupMappingForLGSet.get(rowEntry.layerGroupId)?.name ?? ''

//         //get remaining necessary Info
//         let rowEntryId = rowEntry._id?.toString() as string

//         let dataEntryKeyName = columns[columnIndex]?.id ?? ''
        
//         let dataElement = rowEntry.associatedProperties.find(a => a.name.toUpperCase() === dataEntryKeyName.toUpperCase());
//         if(!dataElement || !dataElement.id || !dataElement.value || getMostAppropriateConstraintValue(dataElement.value).length === 0) {
//             return undefined; 
//         }
        
//         function onRevertCellData(element: [string, string, string]): void {
//             if(element[0] && element[0].toString().length > 0) {
//                 let editCtx : GridCellEditCtx<LayerGroupConstraints> = {
//                     current: rowEntry, 
//                     newValue:  {
//                         kind : GridCellKind.Text,
//                         displayData : element[0].toString(),
//                         data : element[0].toString()
//                     } as TextCell, 
//                     columnIndex: columnIndex, 
//                     columnElement: columns[columnIndex], 
//                     rowIndex: rowIndex
//                 }

//                 handlePhysicalRoutingRulesGridCellEdited(editCtx, true).then(lgc => {
//                     if(lgc) {
//                         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Value reverted successfully");
//                     }
//                 });
//             }
//             else {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to revert value. No valid data provided for the operation");
//             }
//         }

//         return (
//             <>
//                 <RightElement projectId={projectId} rowEntryId={rowEntryId} dataEntryKeyName={dataEntryKeyName} 
//                     dataEntryId={dataElement.id} groupValue={lgName} groupLabel={"LG"} onRevertCellData={onRevertCellData} />
//             </>
//         );
//     }





//     return (
//         <div ref={containerRef} style={{ borderRadius: 5, backgroundColor: colors.blueAccent[400] }} className="expandedListItem" >
//             <div style={{ minWidth: 570, cursor: "pointer" }} onClick={() => onClick(ruleArea)}>
//                 <Box display="flex" justifyContent="left">
//                     <Slide timeout={{ enter: 500, exit: 500 }} direction="right" in={true} container={containerRef.current}>
//                         <Typography variant="h5" sx={{
//                             ml: 5, mt: 1, mb: .5, color: colors.grey[100],
//                             borderLeft: 8, borderRight: 8, borderBottomStyle: "dotted", borderBottom: 1, borderRadius: 6, borderColor: colors.blueAccent[200], paddingLeft: 2, paddingRight: 2}}>
//                                 {ruleArea.ruleAreaName.toUpperCase()}
//                         </Typography>
//                     </Slide>
//                 </Box>
//             </div>

//             <Box height={"59vh"}>
//                 {(count > 0) && <BaseGlideGrid<LayerGroupConstraints> 
//                     excludePortal={false}
//                     gridHeight={"59vh"}
//                     headerHeight={BASIC_GRID_HEADER_HEIGHT}
//                     gridRef={physGridRef}
//                     columns={gridColumns}
//                     pageSize={PHYSICAL_RR_GRID_PAGE_SIZE}
//                     totalRowCount={count}  //TODO - SPECIAL - NEEDED TO ADD TWO BECAUSE I ADDED TWO DUMMY ONES
//                     enableFillHandle={true}
//                     multiRowSelectionEnabled={true}
//                     maxRowSelectionCount={Number.MAX_SAFE_INTEGER}
//                     enableSearchField={true}
//                     showActionButton={false}
//                     isActionClickAllowed={false}
//                     actionButtonText={""}
//                     actionButtonWidth={160}
//                     onActionButtonClick={undefined}
//                     reloadAfterActionClick={true}
//                     cellEditConfirmationColumns={[0]}
//                     groupRowLines={groupRowLineItems}
//                     rightElementEnablementInitValue={showRightElementOnGrid}
//                     onGetRightElementContent={onPhysicalRoutingRulesGridRightElementRetrieval}
//                     onEvaluateFillPattern={onCommonRoutingRulesEvaluateFillPattern}
//                     onSearchInitiated={onSearchInitiated}
//                     onGetRowGroupCellContent={ (rowEntry, columns, columnIndex, isGroupHeader, groupRowLines, path) => getCommonRoutingRulesRowGroupGridCellContent(netclassMappingRef.current, groupRowLines, rowEntry, columns, columnIndex, isGroupHeader, path)}
//                     onGetToolTipText={(args, columns, rowEntry) => onCommonRoutingRulesGridGetToolTipText(args, columns, rowEntry, constraintType, netclassMappingRef.current, lgSetMapping)}
//                     onGridCellEdited={handlePhysicalRoutingRulesGridCellEdited}
//                     onGetGridCellContent={(rowEntry, columns, columnIndex, isGroupHeader, path) => getCommonRoutingRulesGridCellContent(constraintType, netclassMappingRef.current, firstEntryMapRef.current ?? null, lgSetMapping, lgSetOptions, relevantPropMap, rowEntry, columns, columnIndex)} 
//                     onGridCellValueChangeCompleted={onGridCellValueChangeCompleted}
//                     onGridSelectionChanged={(gridSelection, selectedIds) => onPhysicalRoutingRulesGridSelectionChanged(selectedIds)}
//                     onGridSelectionCleared={onPhysicalRoutingRulesGridSelectionCleared}
//                     onFetchFirstSetData={(limit, filterText, existingGroupRowLineInfoList) => executePhysicalRoutingRulesGridInitialDataFetch(projectId, existingGroupRowLineInfoList, limit, ruleArea.id, iface._id, filterText, false)}
//                     onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => Promise.resolve([])}  //Nover should be called. initial fetch is expected to get everything at once!
//                     specialGridActionRef={gridActionRef}
//                 />}
//             </Box>
        
//             <Box display="flex" justifyContent="center">
//                 <Slide timeout={{ enter: 400, exit: 400 }} direction="up" in={true} container={containerRef.current}>
//                     <Divider sx={{mt: 7, mb: 1, width: "90%", backgroundColor: colors.greenAccent[800]}} />
//                 </Slide>
//             </Box>
//             <Box display="flex" justifyContent="center">
//                 <Slide timeout={{ enter: 400, exit: 400 }} direction="up" in={true} container={containerRef.current}>
//                     <Divider sx={{mt: .5, mb: 1, width: "50%", backgroundColor: colors.greenAccent[600]}} />
//                 </Slide>
//             </Box>
//             <Box display="flex" justifyContent="center">
//                 <Slide timeout={{ enter: 400, exit: 400 }} direction="up" in={true} container={containerRef.current}>
//                     <Divider sx={{mt: .5, mb: 1, width: "20%", backgroundColor: colors.greenAccent[400]}} />
//                 </Slide>
//             </Box>

//         </div>
//     );
// };



//=======================================================================================






// async function onPhysicalRoutingRulesGridRightElementRetrieval(rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number, rowIndex: number, path: readonly number[]): Promise<JSX.Element | undefined> {
//     const bgColor = "rgb(255,255,255,0.9)"
//     const PrevValTitleColor = "rgba(31,40,54, 0.75)" ;
//     const prevValBGColor = undefined;
    
//     let key = columns[columnIndex]?.id ?? ''
//     let focusVal = rowEntry.associatedProperties.find((x: PropertyItem) => x.name === key)?.value;
//     let dataValue = getMostAppropriateConstraintValue(focusVal)

//     if(dataValue.length === 0) { return undefined; }
    
//     let dataElement = rowEntry.associatedProperties.find(a => a.name.toUpperCase() === key.toUpperCase());

//     if(!dataElement || !dataElement.id) { return undefined; }

//     let resp = await fetchHistoricalChanges(projectId, `${rowEntry._id.toString() as string}::${dataElement.id}`, 10);
    
//     let previousValueArray = new Array<[string, string, string]>();

//     if(resp && resp.data && resp.data.length > 0){
//         for(let x = 0; x < resp.data.length; x++) {
//             let value = getMostAppropriateConstraintValue(resp.data[x])
//             if(value && value.toString().length > 0) {
//                 previousValueArray.push([value, "", ""]);
//             }
//         }
//     }

//     if(resp && resp.tags && resp.tags.length > 0){
//         resp.tags.find(a => a.startsWith("CHANGE_TIMES:"))?.replace("CHANGE_TIMES:", "")?.trim()?.split("|")?.forEach((a, i) => { previousValueArray[i][1] = a.trim() })
//     }

//     if(resp && resp.tags && resp.tags.length > 0){
//         resp.tags.find(a => a.startsWith("CHANGE_AGENTS:"))?.replace("CHANGE_AGENTS:", "")?.trim()?.split("|")?.forEach((a, i) => { previousValueArray[i][2] = a.trim().toLowerCase().replace(".com", "") })
//     }

//     let grouperMapping = netclassMappingRef.current;
//     let grouperElement : Netclass | BasicProperty = grouperMapping.get(rowEntry.ownerElementId) as Netclass | BasicProperty
//     let grouperLgSetId = (constraintType === ConstraintTypesEnum.Physical) ? (grouperElement as Netclass).layerGroupSetId : (grouperElement as BasicProperty).value;
//     let layerGroupMappingForLGSet = lgSetMapping.get(grouperLgSetId)?.lgMapping ?? new Map<string, LayerGroup>();
    
//     let lgName = layerGroupMappingForLGSet.get(rowEntry.layergroupId)?.name ?? ''



//     function onRevertCellData(element: [string, string, string]): void {
//         throw new Error("Function not implemented.");
//     }

    

//     return (
//         <Box>
//             <Box width={200} sx={{
//                 height: "53vh", 
//                 borderTopLeftRadius: 10, 
//                 borderBottomLeftRadius: 10,
//                 backgroundColor: bgColor,
//                 color: "black",
//                 mt: 4
//             }}> 
//                 <Divider sx={{mt: 1, mb: 1, ml: 2, width: "80%", backgroundColor: "rgb(255,255,255,0.1)"}} />
//                 <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", height: "97%"}}>
//                     <Divider sx={{mt: 0, mb: 0, ml: 2, width: "80%", backgroundColor: bgColor}} />
//                     {(resp && previousValueArray && previousValueArray.length > 0) 
//                         ? <Table border={1}>
//                             <TableHead>
//                                 <TableRow sx={{ padding: 0, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
//                                     <TableCell size="small" sx={{ padding: 0.5, fontSize: 11, color: "#000000"}}>LG :</TableCell>
//                                     <TableCell colSpan={2} size="small" sx={{ padding: 0.5, fontSize: 11, color: "#000000"}}>{`${lgName}`}</TableCell>
//                                 </TableRow>
//                                 <TableRow sx={{ padding: 0, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
//                                     <TableCell size="small" sx={{ padding: 0.5, fontSize: 11, color: "#000000"}}>COL :</TableCell>
//                                     <TableCell colSpan={2} size="small" sx={{ padding: 0.5, fontSize: 11, color: "#000000"}}>{`${key}`}</TableCell>
//                                 </TableRow>
//                                 <TableRow sx={{ padding: 0}}>
//                                     <TableCell colSpan={3} size="small" sx={{ height: 20, paddingLeft: .5, PaddingRight: 0, fontSize: 12, color: "#000000"}}>{" "}</TableCell>
//                                 </TableRow>
//                                 <TableRow sx={{ padding: 0, backgroundColor: PrevValTitleColor}}>
//                                     <TableCell colSpan={3} size="small" sx={{ maxHeight: 20, textAlign: "center", paddingLeft: .5, PaddingRight: 0 }}>
//                                         <Typography sx={{ fontSize: 11, color: "#ffffff", padding: 0}}>{`Previous Values`}</Typography>
//                                     </TableCell>
//                                 </TableRow>
//                             </TableHead>
//                             <TableBody>
//                                 {previousValueArray.map((element: [string, string, string], index: number) => (
//                                     <>
//                                         <TableRow key={`hist-tr-${index}`} >
                                        
//                                             <TableCell rowSpan={2} size="small" sx={{ minWidth: 30, width: "20%", backgroundColor: prevValBGColor, padding: 0, textAlign: "center" }}>
//                                                 <Tooltip placement="top" title={`On: [${element[1]}]  By: [${element[2]}]`}>
//                                                     <span>
//                                                         <Typography sx={{ fontSize: 11, color: "#000000"}}>{`${element[0]}`}</Typography> 
//                                                     </span>
//                                                 </Tooltip>
//                                             </TableCell>

//                                             <TableCell size="small" sx={{ maxWidth: 70, width: "65%", borderBottom: .4, borderBottomStyle: "dotted", borderBottomColor: PrevValTitleColor, backgroundColor: prevValBGColor, padding: 0, color: "#000000", textAlign: "center" }}>
//                                                 <Box sx={{ padding: 0, overflowX: "clip"}}>
//                                                     <Typography sx={{ fontSize: 8.5, color: "#000000", padding: .2}}>{`${element[1]}`}</Typography>
//                                                 </Box>
//                                             </TableCell>

//                                             <TableCell rowSpan={2} size="small" sx={{ width: "15%", backgroundColor: prevValBGColor, padding: 0, textAlign: "center" }}>
//                                                 <Tooltip placement="top" title={`Revert cell value to '${element[0]}'`}>
//                                                     <span>
//                                                         <IconButton sx={{ p: '2px', backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR }} onClick={() => onRevertCellData(element)} >
//                                                             <RestoreOutlined sx={{color: SPECIAL_BLUE_COLOR}} />
//                                                         </IconButton>
//                                                     </span>
//                                                 </Tooltip>
//                                             </TableCell>

//                                         </TableRow>

//                                         <TableRow key={`hist-tr2-${index}`} >
//                                             <TableCell size="small" sx={{ maxWidth: 70, width: "60%", backgroundColor: prevValBGColor, padding: 0, color: "#000000", textAlign: "center" }}>
//                                             <Box sx={{ padding: 0, overflowX: "clip"}}>
//                                                     <Typography sx={{ fontSize: 10, color: "#000000", padding: .2}}>{`${element[2]}`}</Typography>
//                                                 </Box>
//                                             </TableCell>
//                                         </TableRow>
//                                     </>
//                                 ))}
//                             </TableBody>
//                         </Table>
//                         : <Typography sx={{mt: 1, mb:0 }}>{`No historical data....`}</Typography>
//                     }
//                     <Divider sx={{mt: 0, mb: 0, ml: 2, width: "80%", backgroundColor: bgColor}} />
//                 </Box>
//             </Box>
//         </Box>
//     );
    
// }





//====================================================================================

// let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_LGC_ID_PREFIX)).length;
// let ncItemsForIface = Array.from(netclassMappingRef.current.values()).filter(a => a.interfaceId === iface._id.toString())
// let maxCount = (maxLGCount * ncItemsForIface.length) + dummyCount + 1;





// const confRelevantProps = useMemo(() => {         
//     let relevantProps = new Map<string, PropertyItem>();
//     if(confConstraintProps && confConstraintProps.length > 0) {
//         for(let i = 0; i < confConstraintProps.length; i++) {
//             let prop = confConstraintProps[i] as PropertyItem
//             if(prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase()) {
//                 relevantProps.set(prop.name, prop)
//             }
//         }
//     }

//     if(relevantProps.size === 0) {
//         displayQuickMessage(UIMessageType.ERROR_MSG, `Configured physical rule properties were not found. Please check config management system for '${CONFIGITEM__Physical_Constraint_Properties}'`)
//     }

//     return relevantProps
// }, []);


// const lgSetOptions : GridDropDownOption[]= useMemo(() => {         
//     let opts = new Array<GridDropDownOption>();
//     for(let lgSet of packageLayout?.layerGroupSets ?? []) {
//         if(lgSet.name && lgSet.id && lgSet.name.length > 0) {
//             opts.push({label: lgSet.name, value: lgSet.id} as GridDropDownOption) 
//         }
//     }
//     return opts;
// }, []);


// const lgSetMapping = useMemo(() => {         
//     let map = new Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>();
//     for(let lgSet of packageLayout?.layerGroupSets ?? []) {
//         let lgMap = new Map<string, LayerGroup>();
//         for(let lg of lgSet.layerGroups) {
//             lgMap.set(lg.id, lg)
//         }
//         map.set(lgSet.id, {lgSetObj: lgSet, lgMapping: lgMap})
//     }
//     return map;
// }, []);


// const maxLGCount = useMemo(() => {         
//     let max = 0;
//     for(let lgSet of packageLayout?.layerGroupSets ?? []) {
//         if(lgSet.layerGroups && lgSet.layerGroups.length > max) {
//             max = lgSet.layerGroups.length;
//         }
//     }
//     return max;
// }, []);

//==========================================================



    //important
    // function situateRowGrouping(groupRowLineInfoList: GroupRowLineInfo[]) {
    //     let grpOptions : RowGroupingOptions = {
    //         groups: [],
    //         height: 30,
    //         navigationBehavior: "block",
    //         selectionBehavior: "block-spanning",
    //         themeOverride: {
    //             bgCell: "rgba(0, 100, 255, 0.15)"
    //         }
    //     }

    //     for(let hr of groupRowLineInfoList) {
    //         //Not zero-based numbering. The grid counts it starting from one. the 'index' value in a group element should be +1 of its index in the data rows.
    //         let info  = { 
    //             headerIndex: hr.index + 1,
    //             isCollapsed: false
    //         } as any
            
    //         (grpOptions.groups as any).push(info)
    //     }

    //     setRowGrouping(grpOptions)
    //     if (gridActionRef && gridActionRef.current) {
    //         gridActionRef.current.setGridRowGroupingInfo(grpOptions)
    //     }
    // }



//==================================

        // situateRowGrouping(res.groupInfo as GroupRowLineInfo[])
        
        // setCount(res.data.length + 1);
        // if (gridActionRef && gridActionRef.current) {
        //     gridActionRef.current.changeRowCount(res.data.length + 3)
        // }


//=======================


// interface GroupHeaderLineInfo {
//     index: number,
//     headerText: string,
//     elementId: string, 
// }

// let dummyLGC : LayerGroupConstraints = {
//     _id: "",
//     ownerElementId: data[0].ownerElementId,
//     ruleAreaId: ruleArea.id,
//     layergroupId: data[0].layergroupId,
//     constraintType: ConstraintTypesEnum.Physical,
//     associatedProperties: [],
//     projectId: projectId,
//     snapshotSourceId: "",
//     contextProperties: [],
//     lastUpdatedOn: new Date()
// }

// let mapped : Map<string, LayerGroupConstraints[]> = groupBy(data, a => a.ownerElementId);
// let returnGroupingInfo = new Array<GroupHeaderLineInfo>()

// let count = 0
// let isInit = false;
// for(let [key, value] of mapped) {
    
//     let info : GroupHeaderLineInfo = {
//         index: (isInit) ? 0 : count + value.length,
//         headerText: netclassMapping.get(key)?.name ?? '',
//         elementId: key
//     }
//     isInit == false;
//     returnGroupingInfo.push(info);

// }

//TODO - SPECIAL - NEEDED TO ADD TWO BECAUSE I ADDED TWO DUMMY ONES
// newLgcList = [...lgcList];

// let newLgcList : any;


// newLgcList = [...lgcList.slice(0, 1), dummyLGC, ...lgcList.slice(1)];
// newLgcList = [...newLgcList.slice(0, 3), dummyLGC, ...newLgcList.slice(3)];




// let itemCount = await getConstraintsCount(projectId, ruleArea.id, null, iface._id, null, constraintType)
// setCount(itemCount)





    // const [rowGrouping, setRowGrouping] = useState<RowGroupingOptions>(() => ({
    //     groups: [
    //         {
    //             headerIndex: 4,
    //             isCollapsed: false
    //         }, 
    //         {
    //             headerIndex: 2,
    //             isCollapsed: false
    //         },
    //         {
    //             headerIndex: 0,
    //             isCollapsed: false
    //         },
    //         // {
    //         //     headerIndex: 6,
    //         //     isCollapsed: false,
    //         //     // subGroups: [{
    //         //     //     headerIndex: 15,
    //         //     //     isCollapsed: false
    //         //     // }, {
    //         //     //     headerIndex: 20,
    //         //     //     isCollapsed: false
    //         //     // }]
    //         // },
    //         // {
    //         //     headerIndex: 30,
    //         //     isCollapsed: false
    //         // }
    //     ],
    //     height: 30,
    //     navigationBehavior: "block",
    //     selectionBehavior: "block-spanning",
    //     themeOverride: {
    //         bgCell: "grey" // "rgba(0, 100, 255, 0.15)"
    //     }
    // }));
    