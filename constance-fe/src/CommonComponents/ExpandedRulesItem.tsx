import { Box, Divider, Slide, Switch, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { ConstraintTypesEnum, PermissionActionEnum, UIMessageType } from "../DataModels/Constants";
import { Interface, LayerGroup, LayerGroupConstraints, LayerGroupSet, Netclass, Project, RuleArea } from "../DataModels/ServiceModels";
import { useSpiderStore } from "../DataModels/ZuStore";
import BaseGlideGrid, { GridCellEditCtx, GridDropDownOption, GroupRowLineInfo, SpecialGridActionContext } from "./BaseGlideGrid";
import { BASIC_GRID_HEADER_HEIGHT, RR_GRID_PAGE_SIZE, DUMMY_ELEMENT_ID_PREFIX, getCommonRoutingRulesGridCellContent, getCommonRoutingRulesGridColumns, 
    getCommonRoutingRulesRowGroupGridCellContent, onCommonRoutingRulesEvaluateFillPattern, onCommonRoutingRulesGridCellEdited, 
    onCommonRoutingRulesGridGetToolTipText, onCommonRoutingRulesGridInitialDataFetch } from "../BizLogicUtilities/BaseGridLogic";
import { BasicKVP, BasicProperty, LoadingSpinnerInfo, LoggedInUser, PropertyItem } from "../DataModels/HelperModels";
import { fetchNetclassList, getRelationNameElementsForIface } from "../BizLogicUtilities/FetchData";
import { isUserApprovedForCoreAction } from "../BizLogicUtilities/Permissions";
import RightElement from "./RightElement";
import { GridCellKind, GridColumn, TextCell } from "@glideapps/glide-data-grid";
import { getMostAppropriateConstraintValue } from "../BizLogicUtilities/BasicCommonLogic";




interface ExpandedRulesItemProps {
    ruleArea: RuleArea,
    interfaceId: string,
    project: Project,
    relevantPropMap: Map<string, PropertyItem>,
    maxLGCount: number,
    lgSetMapping: Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>,
    lgSetOptions: GridDropDownOption[],
    constraintType: ConstraintTypesEnum,
    enableSearchField: boolean,
    enableLinkageBasedRefresh?: boolean,
    exclusiveElementIdSet?: Set<string>,
    onClick: (clickedItem: RuleArea) => void
}

const ExpandedRulesItem: React.FC<ExpandedRulesItemProps> = ({ ruleArea, interfaceId, project, relevantPropMap, maxLGCount, 
    lgSetMapping, lgSetOptions, constraintType, enableSearchField, exclusiveElementIdSet, onClick, enableLinkageBasedRefresh = true}) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled);

    const containerRef = useRef<any>();
    const gridRef = useRef<any>();
    const gridActionRef = useRef<SpecialGridActionContext<LayerGroupConstraints>|undefined>();
    const firstEntryMapRef = useRef<Map<string, string>>()
    const relevDataMappingRef = useRef<Map<string, Netclass> | Map<string, BasicProperty>>(
        (constraintType === ConstraintTypesEnum.Physical) ? new Map<string, Netclass>() : new Map<string, BasicProperty>()
    );
    
    const [selectedConstraintInfo, setSelectedConstraintInfo] = useState<Map<BasicKVP, number>>(new Map<BasicKVP, number>());
    const [count, setCount] = useState<number>(0);
    const [groupRowLineItems, setGroupRowLineItems] = useState<GroupRowLineInfo[]|undefined>([])

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const showRightElementOnGrid = useSpiderStore((state) => state.showRightElementOnGrid);

    const projectId = project?._id.toString() ?? "";

    
    const gridColumns = useMemo(() => {         
        let cols = getCommonRoutingRulesGridColumns(relevantPropMap, constraintType)
        return cols
    }, []);


    useEffect(() => {         
        refreshRelevDataMappingRef().then(() => {
            onCommonRoutingRulesGridInitialDataFetch(constraintType, relevDataMappingRef.current, lgSetMapping, projectId, Number.MAX_SAFE_INTEGER, ruleArea.id, interfaceId, null, true)
            .then((res: { data: LayerGroupConstraints[], groupInfo: GroupRowLineInfo[], firstEntryMap: Map<string, string>}) => {
                setGroupRowLineItems(res.groupInfo as GroupRowLineInfo[])
                let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_ELEMENT_ID_PREFIX)).length;
                let maxCount = (maxLGCount * relevDataMappingRef.current.size) + dummyCount + 1;
                setCount(maxCount);
            })
        })
    }, []);


    
    useEffect(() => {         
        if(gridActionRef && gridActionRef.current){
            gridActionRef.current?.setRightElementEnablement(showRightElementOnGrid) 
            gridActionRef.current?.reloadDataRows()
        }
    }, [showRightElementOnGrid]);


    //Important!
    async function refreshRelevDataMappingRef() {
        if (constraintType === ConstraintTypesEnum.Clearance) {
            setIsLoadingBackdropEnabled(true)
            let relInfo = await getRelationNameElementsForIface(projectId, interfaceId, null).finally(() => { setIsLoadingBackdropEnabled(false) });
            if(relInfo && relInfo.value && relInfo.value.length > 0) {
                relevDataMappingRef.current = new Map<string, BasicProperty>();
                for(let item of relInfo.value) {
                    if(exclusiveElementIdSet && exclusiveElementIdSet.size > 0) {
                        if(exclusiveElementIdSet.has(item.id)) {
                            relevDataMappingRef.current.set(item.id, item);
                        }
                    }
                    else {
                        relevDataMappingRef.current.set(item.id, item);
                    }
                }
            }
        }
        else if (constraintType === ConstraintTypesEnum.Physical) {
            setIsLoadingBackdropEnabled(true)
            let ncList = await fetchNetclassList(projectId).finally(() => { setIsLoadingBackdropEnabled(false) });
            if(ncList && ncList.length > 0) {
                let map = new Map<string, Netclass>();
                for(let nc of ncList) {
                    if(nc.interfaceId === interfaceId) {
                        map.set(nc._id, nc);
                    }
                }
                relevDataMappingRef.current = map;
            }
        }
    }


    function onRoutingRulesGridSelectionCleared(): void {
        setSelectedConstraintInfo(new Map<BasicKVP, number>())
    }


    function onRoutingRulesGridSelectionChanged(selectedConstraintIdsMap: Map<string, number>): void {
        if(gridActionRef && gridActionRef.current && selectedConstraintIdsMap && selectedConstraintIdsMap.size > 0) {
            let map = new Map<BasicKVP, number>();
            for (let [key, value] of selectedConstraintIdsMap) {
                let constraintObj = gridActionRef.current.getDataAtIndex(value)
                map.set({key: key, value: constraintObj?._id } as BasicKVP, value)
            }
            setSelectedConstraintInfo(map)
        }
        else {
            setSelectedConstraintInfo(new Map<BasicKVP, number>())
        }
    }


    async function executeRoutingRulesGridInitialDataFetch(projectId: string, existingGroupRowLineInfoList: readonly GroupRowLineInfo[]|undefined, 
        limit: number, ruleAreaId: string, interfaceId: string|null, filterText: string|null, excludeProps: boolean) : Promise<LayerGroupConstraints[]> {
        
        setLoadingSpinnerCtx({enabled: true, text: `Now loading constraint data. Please be patient...`} as LoadingSpinnerInfo)
        let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, relevDataMappingRef.current, lgSetMapping, projectId, 
            limit, ruleAreaId, interfaceId, filterText, excludeProps).finally(() => { cancelLoadingSpinnerCtx() }); //filterText
        
        // Collapse the ones that are still exactly the same (best case match)
        if(existingGroupRowLineInfoList && existingGroupRowLineInfoList.length > 0) {
            let exRGMap = new Map<string, GroupRowLineInfo>();
            existingGroupRowLineInfoList.forEach(a => exRGMap.set(a.elementId, a))

            for(let i = 0; i < res.groupInfo.length; i++) {
                let equiv = exRGMap.get(res.groupInfo[i].elementId)
                if(equiv && res.groupInfo[i].index === equiv.index && res.groupInfo[i].headerText === equiv.headerText) {
                    res.groupInfo[i].isCollapsed = equiv.isCollapsed;
                }
            } 
        }

        setGroupRowLineItems(res.groupInfo as GroupRowLineInfo[])
        if (gridActionRef && gridActionRef.current) {
            gridActionRef.current.setGridRowGroupingInfo(res.groupInfo as GroupRowLineInfo[])

            let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_ELEMENT_ID_PREFIX)).length;
            let maxCount = (maxLGCount * res.firstEntryMap.size) + dummyCount + 1;
            setCount(maxCount)
            gridActionRef.current.changeRowCount(maxCount)
        }

        firstEntryMapRef.current = res.firstEntryMap
        return res.data;
    }

    
    async function handleRoutingRulesGridCellEdited(editCtx : GridCellEditCtx<LayerGroupConstraints>, forceNonLGSetChangeRefresh : boolean = false): Promise<LayerGroupConstraints | undefined> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_ROUTING_CONSTRAINTS) === false) { return; }
        let res = await onCommonRoutingRulesGridCellEdited(editCtx.current, editCtx.newValue, editCtx.columnIndex, editCtx.columnElement)
        let forceLnkBasedRefresh = false;
        if(editCtx.current && (enableLinkageBasedRefresh === true)) {
            if(editCtx.current.constraintType === ConstraintTypesEnum.Physical){
                if(project.physicalLinkages.some(x => x.value.includes(editCtx.current.ownerElementId))){
                    forceLnkBasedRefresh = true;
                }
            }
            else if(editCtx.current.constraintType === ConstraintTypesEnum.Clearance) {
                if(project.clearanceLinkages.some(x => x.value.includes(editCtx.current.ownerElementId))){
                    forceLnkBasedRefresh = true;
                }
            }
        }

        if((res && res.refresh === true) || (forceNonLGSetChangeRefresh === true) || (forceLnkBasedRefresh === true)) {
            await refreshRelevDataMappingRef()
            if (gridActionRef && gridActionRef.current) {
                if(relevDataMappingRef && relevDataMappingRef.current){
                    gridActionRef.current.reloadDataRows()
                }   
            }
        }
        return res.data
    }



    function onSearchInitiated(): void {
        // do nothing for now...
    }


    async function onGridCellValueChangeCompleted(rowIndex: number, columnIndex: number): Promise<void> {
        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Value change completed")
    }

    
    async function onRoutingRulesGridRightElementRetrieval(rowEntry: LayerGroupConstraints, columns: GridColumn[], columnIndex: number, rowIndex: number): Promise<JSX.Element | undefined> {
        //get layer group Name
        let grouperMapping = relevDataMappingRef.current;
        let grouperElement = grouperMapping.get(rowEntry.ownerElementId)
        let grouperLgSetId = (grouperElement as any).value;
        let layerGroupMappingForLGSet = lgSetMapping.get(grouperLgSetId)?.lgMapping ?? new Map<string, LayerGroup>();
        let lgName = layerGroupMappingForLGSet.get(rowEntry.layerGroupId)?.name ?? ''

        //get remaining necessary Info
        let rowEntryId = rowEntry._id?.toString() as string

        let dataEntryKeyName = columns[columnIndex]?.id ?? ''

        let dataElement = rowEntry.associatedProperties.find(a => a.name.toUpperCase() === dataEntryKeyName.toUpperCase());
        if(!dataElement || !dataElement.id || !dataElement.value || getMostAppropriateConstraintValue(dataElement.value).length === 0) {
            return undefined; 
        }

        if(showRightElementOnGrid === false) {
            return undefined; 
        }
        
        function onRevertCellData(element: [string, string, string]): void {
            if(element[0] && element[0].toString().length > 0) {
                let editCtx : GridCellEditCtx<LayerGroupConstraints> = {
                    current: rowEntry, 
                    newValue:  {
                        kind : GridCellKind.Text,
                        displayData : element[0].toString(),
                        data : element[0].toString()
                    } as TextCell, 
                    columnIndex: columnIndex, 
                    columnElement: columns[columnIndex], 
                    rowIndex: rowIndex
                }

                handleRoutingRulesGridCellEdited(editCtx, true).then(lgc => {
                    if(lgc) {
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Value reverted successfully");
                    }
                });
            }
            else {
                displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to revert value. No valid data provided for the operation");
            }
        }

        return (
            <>
                <RightElement projectId={projectId} rowEntryId={rowEntryId} dataEntryKeyName={dataEntryKeyName} 
                    dataEntryId={dataElement.id} groupValue={lgName} groupLabel={"LG"} onRevertCellData={onRevertCellData} />
            </>
        );
    }




    
    return (
        <div ref={containerRef} style={{ borderRadius: 5, backgroundColor: colors.blueAccent[400] }} className="expandedListItem" >
            <div style={{ minWidth: 570, cursor: "pointer" }} onClick={() => onClick(ruleArea)}>
                <Box display="flex" justifyContent="left">
                    <Slide timeout={{ enter: 500, exit: 500 }} direction="right" in={true} container={containerRef.current}>
                        <Typography variant="h5" sx={{
                            ml: 5, mt: 1, mb: .5, color: colors.grey[100],
                            borderLeft: 8, borderRight: 8, borderBottomStyle: "dotted", borderBottom: 1, borderRadius: 6, borderColor: colors.blueAccent[200], paddingLeft: 2, paddingRight: 2}}>
                                {ruleArea.ruleAreaName.toUpperCase()}
                        </Typography>
                    </Slide>
                </Box>
            </div>

            <Box height={"59vh"}>
                {(count > 0) && <BaseGlideGrid<LayerGroupConstraints> 
                    excludePortal={false}
                    gridHeight={"59vh"}
                    headerHeight={BASIC_GRID_HEADER_HEIGHT}
                    gridRef={gridRef}
                    columns={gridColumns}
                    pageSize={RR_GRID_PAGE_SIZE}
                    totalRowCount={count}  //TODO - SPECIAL - NEEDED TO ADD TWO BECAUSE I ADDED TWO DUMMY ONES
                    gridMarginRight={-4}
                    enableFillHandle={true}
                    multiRowSelectionEnabled={true}
                    maxRowSelectionCount={Number.MAX_SAFE_INTEGER}
                    enableSearchField={enableSearchField}
                    showActionButton={false}
                    isActionClickAllowed={false}
                    actionButtonText={""}
                    actionButtonWidth={160}
                    onActionButtonClick={undefined}
                    reloadAfterActionClick={true}
                    cellEditConfirmationColumns={[0]}
                    groupRowLines={groupRowLineItems}
                    rightElementEnablementInitValue={showRightElementOnGrid}
                    onGetRightElementContent={onRoutingRulesGridRightElementRetrieval}
                    onEvaluateFillPattern={onCommonRoutingRulesEvaluateFillPattern}
                    onSearchInitiated={onSearchInitiated}
                    onGetRowGroupCellContent={ (rowEntry, columns, columnIndex, isGroupHeader, groupRowLines, path) => getCommonRoutingRulesRowGroupGridCellContent(relevDataMappingRef.current, groupRowLines, rowEntry, columns, columnIndex, isGroupHeader, path)}
                    onGetToolTipText={(args, columns, rowEntry) => onCommonRoutingRulesGridGetToolTipText(args, columns, rowEntry, constraintType, relevDataMappingRef.current, lgSetMapping)}
                    onGridCellEdited={handleRoutingRulesGridCellEdited}
                    onGetGridCellContent={(rowEntry, columns, columnIndex, isGroupHeader, rowIndex) => getCommonRoutingRulesGridCellContent(constraintType, relevDataMappingRef.current, firstEntryMapRef.current ?? null, lgSetMapping, lgSetOptions, relevantPropMap, rowEntry, columns, columnIndex)} 
                    onGridCellValueChangeCompleted={onGridCellValueChangeCompleted}
                    onGridSelectionChanged={(gridSelection, selectedIds) => onRoutingRulesGridSelectionChanged(selectedIds)}
                    onGridSelectionCleared={onRoutingRulesGridSelectionCleared}
                    onFetchFirstSetData={(limit, filterText, existingGroupRowLineInfoList) => executeRoutingRulesGridInitialDataFetch(projectId, existingGroupRowLineInfoList, limit, ruleArea.id, interfaceId, filterText, false)}
                    onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => Promise.resolve([])}  //Nover should be called. initial fetch is expected to get everything at once!
                    specialGridActionRef={gridActionRef}
                />}
            </Box>
        
            <Box display="flex" justifyContent="center">
                <Slide timeout={{ enter: 400, exit: 400 }} direction="up" in={true} container={containerRef.current}>
                    <Divider sx={{mt: 7, mb: 1, width: "90%", backgroundColor: colors.greenAccent[800]}} />
                </Slide>
            </Box>
            <Box display="flex" justifyContent="center">
                <Slide timeout={{ enter: 400, exit: 400 }} direction="up" in={true} container={containerRef.current}>
                    <Divider sx={{mt: .5, mb: 1, width: "50%", backgroundColor: colors.greenAccent[600]}} />
                </Slide>
            </Box>
            <Box display="flex" justifyContent="center">
                <Slide timeout={{ enter: 400, exit: 400 }} direction="up" in={true} container={containerRef.current}>
                    <Divider sx={{mt: .5, mb: 1, width: "20%", backgroundColor: colors.greenAccent[400]}} />
                </Slide>
            </Box>

        </div>
    );
};


export default ExpandedRulesItem







// useEffect(() => {         
    //     const initSteps = async () => {
    //         await refreshRelevDataMappingRef()
    //         let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, relevDataMappingRef.current, lgSetMapping, projectId, Number.MAX_SAFE_INTEGER, ruleArea.id, interfaceId, null, true)

    //         setGroupRowLineItems(res.groupInfo as GroupRowLineInfo[])

    //         let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_ELEMENT_ID_PREFIX)).length;
    //         let maxCount = (maxLGCount * relevDataMappingRef.current.size) + dummyCount + 1;
    //         setCount(maxCount)
    //     }
    //     initSteps()
    // }, []);



    // //Important!
    // async function refreshRelevDataMappingRef() {
    //     if (constraintType === ConstraintTypesEnum.Clearance) {
    //         // setLoadingSpinnerCtx({enabled: true, text: `Now loading cleareance relation data for interface. Please be patient...`} as LoadingSpinnerInfo)
    //         // let relInfo = await getRelationNameElementsForIface(projectId, interfaceId, null).finally(() => { cancelLoadingSpinnerCtx() });
    //         setIsLoadingBackdropEnabled(true)
    //         // let relInfo = await getRelationNameElementsForIface(projectId, interfaceId, null)
    //         let relInfo = await getRelationNameElementsForIface(projectId, interfaceId, null).finally(() => { setIsLoadingBackdropEnabled(false) });
    //         if(relInfo && relInfo.value && relInfo.value.length > 0) {
    //             relevDataMappingRef.current = new Map<string, BasicProperty>();
    //             for(let item of relInfo.value) {
    //                 if(exclusiveElementIdSet && exclusiveElementIdSet.size > 0) {
    //                     if(exclusiveElementIdSet.has(item.id)) {
    //                         relevDataMappingRef.current.set(item.id, item);
    //                     }
    //                 }
    //                 else {
    //                     relevDataMappingRef.current.set(item.id, item);
    //                 }
    //             }
    //         }
    //     }
    //     else if (constraintType === ConstraintTypesEnum.Physical) {
    //         // setLoadingSpinnerCtx({enabled: true, text: `Now loading project netclass data. Please wait...`} as LoadingSpinnerInfo)
    //         // let ncList = await fetchNetclassList(projectId).finally(() => { cancelLoadingSpinnerCtx() });
    //         setIsLoadingBackdropEnabled(true)
    //         let ncList = await fetchNetclassList(projectId).finally(() => { setIsLoadingBackdropEnabled(false) });
    //         if(ncList && ncList.length > 0) {
    //             let map = new Map<string, Netclass>();
    //             for(let nc of ncList) {
    //                 if(nc.interfaceId === interfaceId) {
    //                     map.set(nc._id, nc);
    //                 }
    //             }
    //             relevDataMappingRef.current = map;
    //         }
    //     }
    // }