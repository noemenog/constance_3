import { Box, Divider, Slide, Switch, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { ConstraintTypesEnum } from "../../DataModels/Constants";
import { Interface, LayerGroup, LayerGroupConstraints, LayerGroupSet, Netclass, PackageLayout, Project, RuleArea } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { GridDropDownOption } from "../../CommonComponents/BaseGlideGrid";
import { BasicProperty, PropertyItem, SPDomainData } from "../../DataModels/HelperModels";
import CompressedRulesItem from "../../CommonComponents/CompressedRulesItem";
import ExpandedRulesItem from "../../CommonComponents/ExpandedRulesItem";



interface InterfaceClearanceRulesTabProps {
    iface: Interface,
    lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>,
    lgSetOptions: GridDropDownOption[],
    maxLGCount: number,
    relevantPropMap: Map<string, PropertyItem>,
    focusRA: RuleArea|null|undefined, 
    setFocusRA: any
}

const InterfaceClearanceRulesTab: React.FC<InterfaceClearanceRulesTabProps> = ({ iface, focusRA, setFocusRA, lgSetMapping, lgSetOptions, maxLGCount, relevantPropMap }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    
    const domainData = useLoaderData() as SPDomainData;
    const project = domainData.project;
    const packageLayout = domainData.packageLayout;
    const clrRelMappingInfo = domainData.clrRelationsMappingForCurrentIface as Map<string, BasicProperty[]>

    const [visibleRuleAreas, setVisibleRuleAreas] = useState<RuleArea[]>([])

    const loggedInUser = useSpiderStore((state) => state.loggedInUser);
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);


    useEffect(() => {
        placePageTitle("InterfaceClearanceRules")
    }, []);


    useEffect(() => {
        if(packageLayout && packageLayout.ruleAreas && packageLayout.ruleAreas.length > 0) {
            let raList = new Array<RuleArea>();
            for(let ra of packageLayout.ruleAreas) {
                if(ra.visibilityContext && ra.visibilityContext.length > 0) {
                    let ctxProp : BasicProperty|null = ra.visibilityContext?.find(a => a.name === ConstraintTypesEnum.Clearance) ?? null
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


    function hasData(ruleArea: RuleArea): boolean {
        let res = (clrRelMappingInfo.has(ruleArea.id) && ((clrRelMappingInfo.get(ruleArea.id) as BasicProperty[]).length > 0)) ? true : false;
        return res;
    }


    function handleOnClick (clickedRuleArea: RuleArea) {
        if(clickedRuleArea) {
            if(clickedRuleArea.isActive === false) {
                return;
            }

            if(hasData(clickedRuleArea) === false) {
                return;
            }

            if(focusRA && clickedRuleArea && focusRA.id === clickedRuleArea.id) {
                setFocusRA(null) 
            }
            else {
                setFocusRA({...clickedRuleArea} as RuleArea) 
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
                                            constraintType={ConstraintTypesEnum.Clearance} enableSearchField={true} onClick={handleOnClick} /> 

                                        : <CompressedRulesItem 
                                            key={`cpr-${i}`} 
                                            ruleArea={ra} 
                                            onClick={handleOnClick} 
                                            constraintType={ConstraintTypesEnum.Clearance} 
                                            contentCount={clrRelMappingInfo.get(ra.id)?.length ?? 0 }/>
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

export default InterfaceClearanceRulesTab
















// interface ExpandedClearanceRulesItemProps {
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

// const ExpandedClearanceRulesItem: React.FC<ExpandedClearanceRulesItemProps> = ({ ruleArea, iface, project, relevantPropMap, maxLGCount, lgSetMapping, lgSetOptions, constraintType, onClick, onLGSetChange }) => {
//     const theme = useTheme();
//     const colors = tokens(theme.palette.mode);
//     const navigate = useNavigate();

//     const containerRef = useRef<any>();
//     const clearGridRef = useRef<any>();
//     const gridActionRef = useRef<SpecialGridActionContext<LayerGroupConstraints>|undefined>();
//     const clrRelationsMappingRef = useRef<Map<string, BasicProperty>>(new Map<string, BasicProperty>());
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
//             await refreshRelationsMappingRef()
//             let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, clrRelationsMappingRef.current, lgSetMapping, projectId, Number.MAX_SAFE_INTEGER, ruleArea.id, iface._id, null, true)
            
//             setGroupRowLineItems(res.groupInfo as GroupRowLineInfo[])

//             let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_LGC_ID_PREFIX)).length;
//             let maxCount = (maxLGCount * clrRelationsMappingRef.current.size) + dummyCount + 1;
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
//     async function refreshRelationsMappingRef() {
//         let relInfo = await getRelationNameElementsForIface(projectId, iface._id as string, null)
//         if(relInfo && relInfo.value && relInfo.value.length > 0) {
//             clrRelationsMappingRef.current = new Map<string, BasicProperty>();
//             for(let item of relInfo.value) {
//                 if(item.name === "PW1") {clrRelationsMappingRef.current.set(item.id, item);}
//                 // clrRelationsMappingRef.current.set(item.id, item);
//             }
//         }
//     }


//     function onClearanceRoutingRulesGridSelectionCleared(): void {
//         setSelectedConstraintInfo(new Map<BasicKVP, number>())
//     }


//     function onClearanceRoutingRulesGridSelectionChanged(selectedConstraintIdsMap: Map<string, number>): void {
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


//     async function executeClearanceRoutingRulesGridInitialDataFetch(projectId: string, existingGroupRowLineInfoList: readonly GroupRowLineInfo[]|undefined, limit: number, ruleAreaId: string, interfaceId: string|null, filterText: string|null, excludeProps: boolean) : Promise<LayerGroupConstraints[]> {
//         let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, clrRelationsMappingRef.current, lgSetMapping, projectId, limit, ruleAreaId, interfaceId, filterText, excludeProps);//filterText
        
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

    
//     async function handleClearanceRoutingRulesGridCellEdited(editCtx : GridCellEditCtx<LayerGroupConstraints>, forceNonLGSetChangeRefresh : boolean = false): Promise<LayerGroupConstraints | undefined> {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_ROUTING_CONSTRAINTS) === false) { return; }
//         let res = await onCommonRoutingRulesGridCellEdited(editCtx.current, editCtx.newValue, editCtx.columnIndex, editCtx.columnElement)
//         if(res && res.refresh === true || forceNonLGSetChangeRefresh === true) {
//             await refreshRelationsMappingRef()
//             if (gridActionRef && gridActionRef.current) {
//                 if(clrRelationsMappingRef && clrRelationsMappingRef.current){
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
//         // do nothing for now...
//     }


//     async function onGridCellValueChangeCompleted(): Promise<void> {
//         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Value change completed")
//     }

    
//     async function onClearanceRoutingRulesGridRightElementRetrieval(rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number, rowIndex: number): Promise<JSX.Element | undefined> {
//         //get layer group Name
//         let grouperMapping = clrRelationsMappingRef.current;
//         let grouperElement : BasicProperty = grouperMapping.get(rowEntry.ownerElementId) as BasicProperty
//         let grouperLgSetId = (grouperElement as BasicProperty).value;
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

//                 handleClearanceRoutingRulesGridCellEdited(editCtx, true).then(lgc => {
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
//                     dataEntryId={dataElement.id} groupValue={lgName} groupLabel={"LG"} onRevertCellData={onRevertCellData}  />
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
//                     gridRef={clearGridRef}
//                     columns={gridColumns}
//                     pageSize={CLEARANCE_RR_GRID_PAGE_SIZE}
//                     totalRowCount={count}  //TODO - SPECIAL - NEEDED TO ADD TWO BECAUSE I ADDED TWO DUMMY ONES
//                     enableFillHandle={true}
//                     // enableRightElement={enableRightElement}
//                     multiRowSelectionEnabled={true}
//                     maxRowSelectionCount={Number.MAX_SAFE_INTEGER}
//                     enableSearchField={true}
//                     showActionButton={false}
//                     // showActionSwitch={true}
//                     // actionSwitchToolTipText="hello world"
//                     isActionClickAllowed={false}
//                     actionButtonText={""}
//                     actionButtonWidth={160}
//                     onActionButtonClick={undefined}
//                     reloadAfterActionClick={true}
//                     cellEditConfirmationColumns={[0]}
//                     groupRowLines={groupRowLineItems}
//                     rightElementEnablementInitValue={showRightElementOnGrid}
//                     onGetRightElementContent={onClearanceRoutingRulesGridRightElementRetrieval}
//                     onEvaluateFillPattern={onCommonRoutingRulesEvaluateFillPattern}
//                     onSearchInitiated={onSearchInitiated}
//                     onGetRowGroupCellContent={ (rowEntry, columns, columnIndex, isGroupHeader, groupRowLines, path) => getCommonRoutingRulesRowGroupGridCellContent(clrRelationsMappingRef.current, groupRowLines, rowEntry, columns, columnIndex, isGroupHeader, path)}
//                     onGetToolTipText={(args, columns, rowEntry) => onCommonRoutingRulesGridGetToolTipText(args, columns, rowEntry, constraintType, clrRelationsMappingRef.current, lgSetMapping)}
//                     onGridCellEdited={handleClearanceRoutingRulesGridCellEdited}
//                     onGridCellValueChangeCompleted={onGridCellValueChangeCompleted}
//                     onGetGridCellContent={(rowEntry, columns, columnIndex, isGroupHeader, path) => getCommonRoutingRulesGridCellContent(constraintType, clrRelationsMappingRef.current, firstEntryMapRef.current ?? null, lgSetMapping, lgSetOptions, relevantPropMap, rowEntry, columns, columnIndex)} 
//                     onGridSelectionChanged={(gridSelection, selectedIds) => onClearanceRoutingRulesGridSelectionChanged(selectedIds)}
//                     onGridSelectionCleared={onClearanceRoutingRulesGridSelectionCleared}
//                     onFetchFirstSetData={(limit, filterText, existingGroupRowLineInfoList) => executeClearanceRoutingRulesGridInitialDataFetch(projectId, existingGroupRowLineInfoList, limit, ruleArea.id, iface._id, filterText, false)}
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




