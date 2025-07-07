
import React, { MutableRefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Divider, IconButton, InputBase, List, ListItem, ListItemIcon, ListItemText, Switch, Tooltip, Typography, useTheme } from '@mui/material';
import { DataEditor, GridColumn, GridColumnIcon, Item, GridCell, GridCellKind, Theme, GridMouseEventArgs, GetRowThemeCallback, AutoGridColumn, DataEditorRef, EditableGridCell, CompactSelection, GridSelection, DataEditorProps, SizedGridColumn, Rectangle, CellArray, CellClickedEventArgs, RowGroupingOptions, useRowGrouping, RowGroup, CustomRenderer, FillPatternEventArgs } from '@glideapps/glide-data-grid';
import { ColorModeContext, tokens } from '../theme';
import SearchIcon from '@mui/icons-material/Search';
import { chunk, range } from 'lodash';
import { DBIdentifiable } from '../DataModels/ServiceModels';
import styled from '@emotion/styled';
import { useDisclosure } from '@mantine/hooks';
import { BasicKVP, Identifiable } from '../DataModels/HelperModels';
import { ContextMenuDialog, ContextMenuDialogProps } from '../FormDialogs/ContextMenuDialog';
import { IBounds, useLayer } from "react-laag";
import { BoltOutlined } from '@mui/icons-material';
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from '../FormDialogs/ConfirmationDialog';
import { allCells, DropdownCell } from '@glideapps/glide-data-grid-cells';
import { SPECIAL_BLUE_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_GOLD_COLOR, SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
import { SpButton } from './SimplePieces';


export interface GridDropDownOption {
    label: string, 
    value: string
}

export interface GroupRowLineInfo {
    index: number,
    headerText: string,
    elementId: string,
    isCollapsed: boolean 
}

export interface SpecialGridActionContext<T extends DBIdentifiable|Identifiable> { 
    getDataAtIndex: (index: number) => T|undefined, 
    getActualDataCount: () => number,
    getFirstEntryByPredicate: (predicate: (obj: T) => any) => T|undefined, 
    reloadDataRows: () => void, 
    setGridRowGroupingInfo: (groupRowLineInfoList: GroupRowLineInfo[]) => void
    changeRowCount: (count: number) => void
    setRightElementEnablement: (enableRightElement: boolean) => void
}

export interface GridCellEditCtx<T extends DBIdentifiable|Identifiable> { 
    current: T; 
    newValue: EditableGridCell; 
    columnIndex: number; 
    columnElement: GridColumn; 
    rowIndex: number;
}



interface BaseGlideGridProps<T extends DBIdentifiable|Identifiable> {
    excludePortal: boolean,
    gridHeight: string,
    rowHeight?: number,
    headerHeight?: string,
    gridRef: any,
    columns: GridColumn[],
    freezeColumns?: number,
    pageSize: number,
    totalRowCount: number,
    enableFillHandle: boolean,
    gridMarginRight?: number,
    // enableRightElement?: boolean,
    rightElementEnablementInitValue?: boolean,
    multiRowSelectionEnabled: boolean,
    // headerMenuInfo?: MenuInfo[],
    // cellContextMenuInfo?: MenuInfo[],
    cellEditConfirmationColumns?: number[],
    // rightElementContent?: JSX.Element,
    enableSearchField: boolean,
    maxSearchTextLength?: number,
    showActionButton?: boolean,
    isActionClickAllowed?: boolean,
    actionButtonText?: string,
    actionButtonWidth?: number,
    // actionSwitchInitValue?: boolean
    // showActionSwitch?: boolean,
    // actionSwitchToolTipText?: string,
    reloadAfterActionClick?: boolean,
    maxRowSelectionCount?: number,
    // rowGroupingOptions?: RowGroupingOptions,
    groupRowLines?: GroupRowLineInfo[],
    onEvaluateFillPattern?: (patternSource: Rectangle, fillDestination: Rectangle, gridColumns: GridColumn[], sourceElement: T) => boolean,
    onGetToolTipText?: (args: GridMouseEventArgs, gridColumns: GridColumn[], rowEntry: T) => string | null,
    onSearchInitiated?: () => void,
    onActionButtonClick?: () => Promise<void>,
    // onActionSwitchChanged?: () => Promise<void>,
    onFetchFirstSetData: (limit: number, filterText: string, existingGroupRowLineInfoList: readonly GroupRowLineInfo[] |undefined) => Promise<T[]>,
    onFetchSubsequentData: (lastId: string, lastDataEntry: T, limit: number, filterText: string, existingGroupRowLineInfoList: readonly GroupRowLineInfo[] |undefined) => Promise<T[]>,
    // onGridCellEdited?: (current: T, newValue: EditableGridCell, columnIndex: number, columnElement: GridColumn) => Promise<T | undefined>;   //TODO: not ready for this yet. see note above: GridCellEditResponseInfo<T> ,
    onGridCellEdited?: (editCtx: GridCellEditCtx<T>) => Promise<T | undefined>,
    onGridCellValueChangeCompleted?: (rowIndex: number, columnIndex: number) => Promise<void>,
    onGetGridCellContent: (rowEntry: T, columns: GridColumn[], columnIndex: number, isGroupHeader: boolean, rowIndex: number) => GridCell,
    onGetRowGroupCellContent?: (rowEntry: T, columns: GridColumn[], columnIndex: number, isGroupHeader: boolean, groupRowLines: GroupRowLineInfo[], path: readonly number[]) => GridCell,
    onGetRightElementContent?:  (rowEntry: T, columns: GridColumn[], columnIndex: number, rowIndex: number) => Promise<JSX.Element|undefined>,
    onGridSelectionChanged: (griddSelection: GridSelection, selectedIds: Map<string, number>) => void,
    onGridSelectionCleared: () => void,
    specialGridActionRef?: MutableRefObject<SpecialGridActionContext<T>|undefined>
}

function BaseGlideGrid<T extends DBIdentifiable|Identifiable>({ gridHeight, headerHeight, gridRef, columns, freezeColumns, totalRowCount, enableFillHandle, rightElementEnablementInitValue,
    // showActionSwitch, actionSwitchInitValue,actionSwitchToolTipText, onActionSwitchChanged
    pageSize, multiRowSelectionEnabled, cellEditConfirmationColumns, enableSearchField, showActionButton, isActionClickAllowed, actionButtonText, gridMarginRight,
    actionButtonWidth, reloadAfterActionClick, maxRowSelectionCount, groupRowLines, onGetRowGroupCellContent, onEvaluateFillPattern, onGetToolTipText,
    onSearchInitiated, onActionButtonClick, onFetchFirstSetData, onFetchSubsequentData, onGridCellEdited, onGridCellValueChangeCompleted, onGetGridCellContent, 
    onGetRightElementContent, onGridSelectionChanged, onGridSelectionCleared, specialGridActionRef, rowHeight = 30, maxSearchTextLength = 90, excludePortal = false }: BaseGlideGridProps<T>) {
    
    const theme = useTheme();
    // const colors = tokens(theme.palette.mode);
    

    const [gridSelection, setGridSelection] = useState<GridSelection>({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
    });

    const [visiblePages, setVisiblePages] = useState<Rectangle>({ x: 0, y: 0, width: 0, height: 0 });
    const [initPageHandled, setInitPageHandled] = useState<boolean>(false);
    const [totalDataElements, setTotalDataElements] = useState<number>(totalRowCount)
    const [gridColumns, setGridColumns] = useState<GridColumn[]>(columns)
    const [hoverRow, setHoverRow] = useState<number | undefined>(undefined);
    

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

    const [reloadToggled, setReloadToggled] = useState<boolean>(false);

    // const [showCellContextMenu, setShowCellContextMenu] = useState(false);
    // const [showHeaderContextMenu, setShowHeaderContextMenu] = useState(false);
    // const [contextMenuXYPosistion, setContextMenuXYPosistion] = useState({ x: 0, y: 0 });
    // const [rightClickedCellContext, setRightClickedCellContext] = useState<{cell: Item, event: CellClickedEventArgs} | null>(null)

    // const [headerMenu, setHeaderMenu] = React.useState<{ col: number; bounds: Rectangle; }>();

    const [groupRowLineInfoList, setGroupRowLineInfoList] = useState<GroupRowLineInfo[] | undefined>(undefined);
    // const [gridRowGroupingOptions, setGridRowGroupingOptions] = React.useState<RowGroupingOptions|undefined>(rowGroupingOptions)
    const [gridRowGroupingOptions, setGridRowGroupingOptions] = useState<RowGroupingOptions|undefined>()
    const { mapper, getRowGroupingForPath, updateRowGroupingByPath } = useRowGrouping(gridRowGroupingOptions, totalDataElements);

    const [tooltip, setTooltip] = React.useState<{ val: string; bounds: IBounds; } | undefined>();

    const [rightElementContent, setRightElementContent] = useState<JSX.Element|undefined>()
    const [rightElementEnabled, setRightElementEnabled] = useState<boolean>(rightElementEnablementInitValue ?? true)
    const [srcTxt, setSrcTxt] = React.useState<string>("");

    // const isHeaderMenuOpen = headerMenu !== undefined;

    const searchTextRef = useRef<string>('');
    const loadingRef = useRef(CompactSelection.empty());
    const dataRef = useRef<Map<number, T>>(new Map<number, T>());
    const componentRef = useRef<any>();
    const visiblePagesRef = useRef(visiblePages);
    const latestGroupRowRef = useRef<GroupRowLineInfo[] | undefined>();
    const timeoutRef = React.useRef(0);

    visiblePagesRef.current = visiblePages;
    latestGroupRowRef.current = groupRowLineInfoList;


    useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

    useEffect(() => {
        let grpOptions : RowGroupingOptions = {
            groups: [],
            height: 30,
            navigationBehavior: "block",
            selectionBehavior: "block-spanning",
            themeOverride: {
                bgCell: quartzTheme.groupRow_bgCell  //"rgba(0, 100, 255, 0.15)"
            }
        }

        if(groupRowLineInfoList) {
            for(let hr of groupRowLineInfoList) {
                //Not zero-based numbering. The grid counts it starting from one. the 'index' value in a group element should be +1 of its index in the data rows.
                let info  = { 
                    headerIndex: hr.index + 1,
                    isCollapsed: hr.isCollapsed ?? false
                } as any
                
                (grpOptions.groups as any).push(info)
            }
            setGridRowGroupingOptions(grpOptions)
            latestGroupRowRef.current = groupRowLineInfoList;
        }
    }, [groupRowLineInfoList]);


    //===================================================================================
    //===================================================================================
    function applyGridRowGroupingInfo(groupRowLineInfoList: GroupRowLineInfo[]) {
        setGroupRowLineInfoList(Array.from(groupRowLineInfoList))
    }
    
    // function applyGridRowGroupingInfo(rgo: RowGroupingOptions) {
    //     setGridRowGroupingOptions({...rgo})
    // }
    
    function setRightElementEnablement(enable: boolean) {
        setRightElementEnabled(enable)
    }

    function applyGridRowCount(count: number) {
        setTotalDataElements(count)
    }
    

    function getDataAtIndex(indexKey: number) : T | undefined{
        if(dataRef && dataRef.current && dataRef.current.has(indexKey)) {
            let value = dataRef.current.get(indexKey) as T
            return value
        }
        else {
            return undefined
        }
    }

    function getActualDataCount() : number {
        if(dataRef && dataRef.current) {
            let value = dataRef.current.size
            return value
        }
        else {
            return 0
        }
    }

    function getFirstEntryByPredicate(predicate: (obj: T) => any) : T | undefined{
        if(dataRef && dataRef.current && dataRef.current.size > 0) {
            let value = Array.from(dataRef.current.values()).find(predicate)
            return value
        }
        else {
            return undefined
        }
    }

    function reloadDataRows(){
        // setTotalDataElements(totalDataElements)
        dataRef.current = new Map<number, T>();
        loadingRef.current = CompactSelection.empty()
        setVisiblePages({ x: 0, y: 0, width: 0, height: 0 });
        visiblePagesRef.current = (visiblePages);
        setInitPageHandled(false);
        onGridSelectionChange({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
        // (gridRef.current as DataEditorRef)?.scrollTo(0, 0)  //Not necessary!
        setReloadToggled(!reloadToggled)
        // setTotalDataElements(totalDataElements)
    }


    useEffect(() => {
        if(specialGridActionRef) {
            specialGridActionRef.current =  { 
                getDataAtIndex: getDataAtIndex,
                getActualDataCount: getActualDataCount,
                getFirstEntryByPredicate: getFirstEntryByPredicate, 
                reloadDataRows: reloadDataRows,
                setGridRowGroupingInfo: applyGridRowGroupingInfo,
                changeRowCount: applyGridRowCount,
                setRightElementEnablement: setRightElementEnablement
            } 
        }
    }, []);
    //========================================================================================



    // #region base funcs
    // 3b. get data from backend
    const getRowData = React.useCallback(async (colRow: Item) => {
        // console.log(latestGroupRowRef.current)
        let items : T[] = []
        
        if(colRow[0] === 0) {
            items = await onFetchFirstSetData(colRow[1], searchTextRef.current, latestGroupRowRef?.current)  
        }
        else {
            let lastDataEntry = dataRef.current.get(colRow[0] - 1)
            if(lastDataEntry) {
                let lastId = null;
                if(lastDataEntry && (lastDataEntry as DBIdentifiable)?._id && (lastDataEntry as DBIdentifiable)._id.toString().trim().length > 0) {
                    lastId = (lastDataEntry as DBIdentifiable)._id?.toString();
                }
                else if(lastDataEntry && (lastDataEntry as Identifiable)?.id && (lastDataEntry as Identifiable).id.toString().trim().length > 0) {
                    lastId = (lastDataEntry as Identifiable).id?.toString();
                }

                if(lastId) {
                    items = await onFetchSubsequentData(lastId, lastDataEntry, colRow[1], searchTextRef.current, latestGroupRowRef?.current)   
                }
            }
        }
        return items;
    }, []);


    const getCellContent = React.useCallback<DataEditorProps["getCellContent"]>(
        (cell: Item) : GridCell => {
            const { path, isGroupHeader, originalIndex } = mapper(cell);
            const [colIndex, rowIndex] = cell;
            const rowEntry: any = dataRef.current?.get(rowIndex);
            
            // console.log(`Total elements is set to : `, totalDataElements)

            if (rowEntry !== undefined) {
                let cellObj : GridCell = onGetGridCellContent(rowEntry, columns, colIndex, isGroupHeader, rowIndex);
                return cellObj;
            }

            return {
                kind: GridCellKind.Loading,
                allowOverlay: false,
            };
    }, [reloadToggled]);

    
    const getCellContentMangled = React.useCallback <DataEditorProps["getCellContent"]> (
        (cell: Item) : GridCell => {
            const { path, isGroupHeader, originalIndex } = mapper(cell);
            const [colIndex, rowIndex] = cell;
            

            if (isGroupHeader) {
                const rowEntry: any = dataRef.current?.get(rowIndex);
                if(groupRowLineInfoList && onGetRowGroupCellContent) {
                    let cellObj : GridCell = onGetRowGroupCellContent(rowEntry, columns, colIndex, isGroupHeader, groupRowLineInfoList, path)
                    return cellObj;
                }
                else {
                    return {
                        kind: GridCellKind.Loading,
                        allowOverlay: false,
                    };
                }
            } 
            else if (cell[0] === 0) {
                return getCellContent(originalIndex);
            } 
            



            // if ((cell[0] === 0) && isGroupHeader) {
            //     const rowEntry: any = dataRef.current?.get(rowIndex);
            //     if(groupRowLineInfoList && onGetRowGroupCellContent) {
            //         let cellObj : GridCell = onGetRowGroupCellContent(rowEntry, columns, colIndex, isGroupHeader, groupRowLineInfoList, path)
            //         return cellObj;
            //     }
            //     else {
            //         return {
            //             kind: GridCellKind.Loading,
            //             allowOverlay: false,
            //         };
            //     }
            // } 
            // else if (cell[0] === 0) {
            //     return getCellContent(originalIndex);
            // } 
            // else if (isGroupHeader) {
            //     return { kind: GridCellKind.Loading, allowOverlay: false, span: [1, columns.length - 1] };
            // }

            return getCellContent(originalIndex);
    }, [getCellContent, mapper, reloadToggled]);


    // 1. whenever visible spectrum changes, set visiblePages state 
    const onVisibleRegionChanged = React.useCallback((r : Rectangle) => {
        setVisiblePages((cv: Rectangle) => {
            if (r.x === cv.x && r.y === cv.y && r.width === cv.width && r.height === cv.height) {
                return cv;
            }
            else {
                return r;
            }
        });
    }, [totalDataElements]);
    

    // 3a. get row data for the given page spectrum
    const loadPage = React.useCallback(
        async (page: number) => {
            const startIndex = page * pageSize;
            const returnedData = await getRowData([startIndex, (page + 1) * pageSize]);
            if(returnedData && returnedData.length > 0) {
                loadingRef.current = loadingRef.current.add(page); //needs to happen here under this 'if'!

                const damageList = new Array<{ cell: [number, number] }>();
                
                for(let i = 0; i < returnedData.length; i++) {
                    (dataRef.current as Map<number, T>).set(i + startIndex, returnedData[i]);
                    for (let col = visiblePages.x; col <= visiblePages.x + visiblePages.width; col++) {
                        damageList.push({
                            cell: [col, i + startIndex],
                        });
                    }
                }

                // Only entertain this potential adjustment when we are not dealing with grouping.
                // In the case of grouping, outer component should track and adjust total via actionRef 
                
                // if(!latestGroupRowRef.current || !latestGroupRowRef.current) {
                //     if(searchTextRef.current && searchTextRef.current.length > 0 && dataRef?.current 
                //         && dataRef?.current.size > 0 && dataRef?.current.size < totalRowCount) {
                //         setTotalDataElements(dataRef?.current?.size)
                //     }
                //     else {
                //         setTotalDataElements(totalRowCount)
                //     }
                // }

                (gridRef.current as DataEditorRef)?.updateCells(damageList);
                if(initPageHandled === false) { setInitPageHandled(true) }
            }
        },
        [getRowData, gridRef, pageSize]
    );


    // 2. upon setting visiblePages state, trigger loadPage
    useEffect(() => {
        const rect = visiblePages;
        const firstPage = Math.max(0, Math.floor((rect.y - pageSize / 2) / pageSize));
        const lastPage = Math.floor((rect.y + rect.height + pageSize / 2) / pageSize);
        for (const page of range(firstPage, lastPage + 1)) {
            if (loadingRef.current.hasIndex(page)) {
                continue;
            }
            else {
                console.log(`Now loading pages: ${firstPage} to ${lastPage} ...`)
                void loadPage(page);
            }
        }        
    }, [loadPage, pageSize, visiblePages, totalDataElements]);
    // #endregion


    // #region added-func
    //=========================================================================================================
    //=================================== Added Functionality =================================================
    
    //Handle cell click event  - for row grouping scenario
    const onCellClicked = React.useCallback(async (cell: Item) => {
        if (gridRowGroupingOptions) {
            const { path, isGroupHeader } = mapper(cell);
            if (isGroupHeader && cell[0] === 0) {
                const group = getRowGroupingForPath(gridRowGroupingOptions.groups, path);
                setGridRowGroupingOptions(prev => {
                    const result: RowGroupingOptions = {
                        ...prev,
                        groups: updateRowGroupingByPath(prev?.groups as readonly RowGroup[], path, { isCollapsed: !group.isCollapsed } as RowGroup)
                    } as RowGroupingOptions;
                    
                    //Update the reference to keep track of collapsed and non-collapesed group items
                    for(let i = 0; i < result.groups.length; i++) {
                        if(latestGroupRowRef && latestGroupRowRef.current) {
                            latestGroupRowRef.current[i].isCollapsed = result.groups[i].isCollapsed;
                        }
                    }

                    return result;
                });
            }
            else {
                handleRightElementAssessment()
            }
        }
        else {
            handleRightElementAssessment()
        }

        async function handleRightElementAssessment() {
            if(rightElementEnabled === true) {
                const [colIndex, rowIndex] = cell;
                const rowEntry: any = dataRef.current?.get(rowIndex);
                if (rowEntry !== undefined) {
                    if(onGetRightElementContent) {
                        let contentElem : JSX.Element|undefined = await onGetRightElementContent(rowEntry, columns, colIndex, rowIndex)
                        setRightElementContent(contentElem);
                    }
                }
            }
        }

    }, [getRowGroupingForPath, mapper, gridRowGroupingOptions?.groups, updateRowGroupingByPath, gridRowGroupingOptions]); //added last one on my won
    
    
    //handle cell editing
    const onCellEdited = React.useCallback(
        async (cell: Item, newVal: EditableGridCell) => {
            const { path, isGroupHeader } = mapper(cell);
            const [colIndex, initRowIndex] = cell;

            //IMPORTANT!!
            // if grouping is enabled, we have to account for the possibility that some rows would have been collapsed, therefore mangling the rowIndexes!
            let rowIndex = (gridRowGroupingOptions && gridRowGroupingOptions.groups && gridRowGroupingOptions.groups.length > 0)
            ? gridRowGroupingOptions.groups[path[0]].headerIndex + path[1]
            : initRowIndex;

            const current = dataRef.current?.get(rowIndex);
            
            if (gridRowGroupingOptions && isGroupHeader && cell[0] === 0) return;
            if (current === undefined) return;
            
            if(onGridCellEdited) {
                let columnItem : GridColumn = gridColumns[colIndex]
                
                let editCtx : GridCellEditCtx<T> = {
                    current: current, 
                    newValue: newVal, 
                    columnIndex: colIndex, 
                    columnElement: columnItem, 
                    rowIndex: rowIndex
                }

                if(cellEditConfirmationColumns && (cellEditConfirmationColumns.length > 0) && cellEditConfirmationColumns.includes(colIndex)) {
                    handleConfirmationRequest(editCtx)
                }
                else {
                    processCellEditData(editCtx)
                }
            }
    }, [gridRowGroupingOptions]);  //added on my own
    

    async function processCellEditData(editCtx: GridCellEditCtx<T>) {
        if(onGridCellEdited) {
            // let res = await onGridCellEdited(editCtx.current, editCtx.newVal, editCtx.colIndex, editCtx.columnItem)
            let res = await onGridCellEdited(editCtx)
            if(res) {
                dataRef.current?.set(editCtx.rowIndex, {...res})
                if(onGridCellValueChangeCompleted) {
                    onGridCellValueChangeCompleted(editCtx.rowIndex, editCtx.columnIndex);
                }
            }
        }
    }

    
    function handleConfirmationRequest(param: GridCellEditCtx<T>): void {
        //Important! works for basic cells and dropdown. If other custom cell types are used, then validation must be done to ensure it will work
        let value = (param.newValue.kind.toLowerCase() === "custom") ? (param.newValue.data as any).value : param.newValue.data; 

        let confirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Row#: ${param.rowIndex + 1}; Column: '${param.columnElement.title}' ---- Are you sure you want to change the value to '${value}' ? `,
            warningText_other: `WARNING: New value will be saved imidiately`,
            actionButtonText: "Proceed",
            enableSecondaryActionButton: false,
            secondaryActionButtonText: "",
            contextualInfo: { key: "CELL_VALUE_CHANGE", value: param },
        }
        setConfirmationDialogProps(confirmData)
        confirmationModalActioner.open()
    }


    function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): void {
        if(contextualInfo && contextualInfo.key && contextualInfo.value) {
            if(contextualInfo.key === "CELL_VALUE_CHANGE") {
                let ctx = contextualInfo.value as GridCellEditCtx<T>
                if(action === ConfirmationDialogActionType.PROCEED) {
                    processCellEditData(ctx)
                }
            }
        }
        else {
            console.error(`Glide: Failed to execute cell data change!`)
        }
    }


    //handle search initiation
    function onSearchActionInitiated(): void {
        reloadDataRows()
        if(onSearchInitiated) {
            onSearchInitiated()
        }
    }


    function onActionPerformButtonClick() : void {
        if(onActionButtonClick) {
            onActionButtonClick().then(() => {
                if(reloadAfterActionClick === true) {
                    reloadDataRows()
                }
            })
        }
    }
    

    // function onActionPerformSwitchChanged() : void {
    //     if(onActionSwitchChanged) {
    //         onActionSwitchChanged();
    //     }
    // }


    //handle keydown for search 
    function handleKeyDowwn(e: any) {
        if (e) {
            if (e.code === 13 || e.key.toUpperCase() === "ENTER") {
                onSearchActionInitiated();
                e.preventDefault();
            }
        }
    }


    //track search text change
    function onSearchTextChanged(event: any): void {
        let txt = event?.target?.value
        if(txt && txt.length > 0) {
            if(txt.length > maxSearchTextLength){
                return;
            }
            searchTextRef.current = txt.toString();
            setSrcTxt(txt.toString())
        }
        else {
            searchTextRef.current = ''
            setSrcTxt("")
        }
    }


    //handle column resizing
    function onColumnResize(col: GridColumn, newSize: number, colIndex: number, newSizeWithGrow: number): void {
        if(gridColumns && gridColumns.length > 0) {
            for(let i = 0; i < gridColumns.length; i++) {
                if(gridColumns[i].id === col.id) {
                    let newCol : SizedGridColumn = {
                        id: gridColumns[i].id,
                        icon: gridColumns[i].icon,
                        width: newSize,
                        title: gridColumns[i].title
                    }
                    gridColumns[i] = newCol;
                    setGridColumns(Array.from(gridColumns))
                    break;
                }
            }
        }
    }


    // handle row theme override
    const getRowThemeOverride = React.useCallback((row: number): Partial<Theme> | undefined => {
        if(theme.palette.mode.toLowerCase() === "light") {
            if (row === hoverRow) {
                return {
                    bgCell: lightTheme.hover_bgCell,
                    // bgCellMedium: "#f0f000"
                };
            }
            else if (row % 2 === 0) {
                return {
                    bgCell: lightTheme.mod_two_bgCell,   
                }
            }
            else {
                return {
                    bgCell: lightTheme.bgCell,
                }
            }
        }
        else if(theme.palette.mode.toLowerCase() === "dark") {
            if (row === hoverRow) {
                return {
                    bgCell: quartzTheme.hover_bgCell,
                    // bgCellMedium: "#f0f000"
                };
            }
        }
    }, [hoverRow]);


    //handle grid selection
    //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--controlled-selection
    function onGridSelectionChange(newSelection: GridSelection) { 
        if(maxRowSelectionCount && multiRowSelectionEnabled === true) {
            if(newSelection && newSelection.rows.length > maxRowSelectionCount) {
                return;
            }
        }
        setGridSelection(newSelection)
        if(onGridSelectionChanged) {
            if(newSelection && newSelection.rows) {
                let selectedIds = new Map<string, number>();
                
                //https://docs.grid.glideapps.com/extended-quickstart-guide/working-with-selections
                for(let rowIndex of newSelection.rows) {
                    let dataItem = dataRef.current.get(rowIndex)
                    
                    let dataItemIdValue = '';
                    if(dataItem && (dataItem as DBIdentifiable)?._id && (dataItem as DBIdentifiable)._id.toString().trim().length > 0) {
                        dataItemIdValue = (dataItem as DBIdentifiable)._id?.toString();
                    }
                    else if(dataItem && (dataItem as Identifiable)?.id && (dataItem as Identifiable).id.toString().trim().length > 0) {
                        dataItemIdValue = (dataItem as Identifiable).id?.toString();
                    }
                    
                    if(dataItemIdValue) {
                        selectedIds.set(dataItemIdValue, rowIndex)
                    }

                }

                if(selectedIds.size > 0) {
                    onGridSelectionChanged(newSelection, selectedIds)
                }
                else if (newSelection.rows.length > 0) {
                    console.error("Glide: Could not determine selected grid items!")
                }
            } 
        }
    }

    
    function onGridSelectionClearup(): void {
        setGridSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
        if(onGridSelectionCleared) {
            onGridSelectionCleared()
        }
    }


    //Handle row hover
    const onItemHovered = React.useCallback((args: GridMouseEventArgs) => {
        const [_, row] = args.location;
        setHoverRow(args.kind !== "cell" ? undefined : row);
        if (args.kind === "cell") {
            window.clearTimeout(timeoutRef.current);
            if(onGetToolTipText) {
                setTooltip(undefined);
                timeoutRef.current = window.setTimeout(() => {
                    let rowEntry = dataRef.current.get(row);
                    let text = onGetToolTipText(args, gridColumns, rowEntry as T)
                    if(text && text.trim().length > 0) {
                        setTooltip({
                            val: text,
                            bounds: {   // translate to react-laag types
                                left: args.bounds.x,
                                top: args.bounds.y,
                                width: args.bounds.width,
                                height: args.bounds.height,
                                right: args.bounds.x + args.bounds.width,
                                bottom: args.bounds.y + args.bounds.height
                            }
                        });
                    }   
                }, 300);
            }
        } 
        else {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = 0;
            setTooltip(undefined);
        }
    }, []);

    //For Tooltip
    const isOpen = tooltip !== undefined;
    const zeroBounds = { left: 0, top: 0, width: 0, height: 0, bottom: 0, right: 0, };
    const { renderLayer, layerProps } = useLayer({
        isOpen,
        triggerOffset: 4,
        auto: true,
        container: "portal",
        trigger: {
            getBounds: () => tooltip?.bounds ?? zeroBounds
        }
    });
    

    function onGridFillPattern(event: FillPatternEventArgs): void {
        if(onEvaluateFillPattern && dataRef.current && dataRef.current.size > 0) {
            const sourceElement = dataRef.current.get(event.patternSource.y) as T
            let result = onEvaluateFillPattern(event.patternSource, event.fillDestination, gridColumns, sourceElement);
            if(result === false) {
                event.preventDefault()
            }
        }
    }

    return (
        <>
            <Box width="100%" ref={componentRef}>
                <Box flexDirection="column" alignItems="center" mr={gridMarginRight ?? 0}>
                    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" width={"100%"} ml={-2} >
                        <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"95%", }}>
                            
                            {showActionButton && <SpButton
                                onClick={(onActionPerformButtonClick)}
                                startIcon={<BoltOutlined />}
                                sx={{ minWidth: 140, width: actionButtonWidth ?? 150}}
                                disabled={isActionClickAllowed ? false : true}
                                label={actionButtonText ?? "Action"} />}

                            {(enableSearchField && showActionButton)
                            ?<Divider orientation="vertical" sx={{height: 50, marginLeft: 1, marginRight: 1 }} />
                            : <Box mb={1} /> }
                            
                            {enableSearchField && <Box display="flex" sx={{ mb: 1, mt: 1, backgroundColor: "white",  width:"66%"}}>
                                <InputBase size="small" sx={{ color: "black", ml: 2, flex: 1}} placeholder="Search" onChange={onSearchTextChanged} onKeyDown={(e) => { handleKeyDowwn(e); }} value={srcTxt}/>
                                <Tooltip placement="top" title={`Search for items ${(searchTextRef.current && searchTextRef.current.length > 0) ? "starting with the name '" + searchTextRef.current + "'" : ''}`}>
                                    <span>
                                        <IconButton sx={{ p: '5px' }} onClick={onSearchActionInitiated}>
                                            <SearchIcon sx={{color: "black"}} />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>}

                            {/* {showActionSwitch && <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 1 }} /> }

                            {showActionSwitch && <Tooltip placement="top" title={actionSwitchToolTipText}>
                                <span>
                                    <Switch
                                        onClick={(onActionPerformSwitchChanged)}
                                        defaultChecked={actionSwitchInitValue ?? false}
                                    />
                                </span>
                            </Tooltip>} */}

                        </Box>

                        {(!columns || columns.length === 0 || totalDataElements === 0)
                        ? 
                            <Typography variant="h6" sx={{ mt: 5, ml: 2, color: quartzTheme.noColDefinedColor, fontStyle: "italic"}}>
                                {`No columns defined...`}
                            </Typography>
                        : 
                            //https://docs.grid.glideapps.com/api/dataeditor
                            <DataEditor 
                                className={"baseGlide"}
                                ref={gridRef}
                                width={"95%"} 
                                height={gridHeight} 
                                rowHeight={rowHeight}

                                getCellContent={(gridRowGroupingOptions && gridRowGroupingOptions.groups && gridRowGroupingOptions.groups.length > 0) ? getCellContentMangled : getCellContent}
                                onVisibleRegionChanged={onVisibleRegionChanged}
                                onCellEdited={onCellEdited}
                                
                                headerHeight={parseInt(headerHeight ?? "36", 10)}
                                
                                columns={gridColumns} 
                                rows={totalDataElements}
                                
                                freezeColumns={freezeColumns || 0}
                                onColumnResize={onColumnResize}

                                onItemHovered={onItemHovered}
                                
                                fixedShadowX={false}

                                //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--row-selections
                                //NOTE: if multiselect is enabled, then disable row reordering
                                rowSelect={multiRowSelectionEnabled ? 'multi' : 'single'}
                                
                                //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--row-markers
                                rowMarkers={{
                                    kind: "both",
                                    checkboxStyle: "circle",
                                    startIndex: 1,
                                    // width: 22,
                                    theme: {
                                        textMedium: "rgba(51, 51, 51, 0.50)"
                                    }
                                }}
                                
                                //https://docs.grid.glideapps.com/extended-quickstart-guide/working-with-selections
                                gridSelection={gridSelection}
                                onGridSelectionChange={onGridSelectionChange}
                                onSelectionCleared={onGridSelectionClearup}
                                
                                showSearch={false}    //if to show search field

                                //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--overscroll
                                overscrollX={20}    //additional space on the horizontal scroll
                                overscrollY={50}    //additional space on the vertical scroll (appears as extra rows)
                                
                                // onCellContextMenu={onCellContextMenu}
                                
                                //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--header-menus
                                // onHeaderMenuClick={onHeaderMenuClick}

                                //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--right-element
                                // EXAMPLE CONTENT - note the use of empty tags as enclosure: 
                                // <>
                                //     <Box width={200} sx={{
                                //         height: "100%", 
                                //         borderTopLeftRadius: 15, 
                                //         borderBottomLeftRadius: 15,
                                //          backgroundColor:"rgb(255,255,255,0.7)"}}> <Typography>Hello Earth</Typography>
                                //     </Box>
                                // </>
                                rightElementProps={{ sticky: true }} 
                                rightElement={(rightElementEnabled && rightElementContent) ? rightElementContent : undefined}

                                // https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--row-grouping
                                // https://github.com/glideapps/glide-data-grid/issues/823
                                rowGrouping={gridRowGroupingOptions} 
                                onCellClicked={onCellClicked} 
                                
                                customRenderers={allCells}

                                //overall grid theming
                                theme={quartzTheme}
                                getRowThemeOverride={getRowThemeOverride}

                                //enable copy paste
                                getCellsForSelection={true} 

                                //fillHandle
                                //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--fill-handle
                                fillHandle={enableFillHandle}
                                keybindings={{
                                    downFill: true,
                                    rightFill: true
                                }}
                                onFillPattern={onGridFillPattern} 
                                
                                //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--paste-support
                                onPaste={true}
                            />
                        }
                            
                    </Box>
                </Box>
                
                {/* //The portal div is necessary!! -  https://github.com/glideapps/glide-data-grid/issues/795 */}
            { (excludePortal === false) ? <div id="portal"></div> : <></> }
            </Box>
            
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }

            {/* render tooltip */}
            {isOpen && renderLayer(
                <>
                    <div 
                        {...layerProps} 
                        style={{ 
                            ...layerProps.style, 
                            padding: "8px 12px", 
                            color: quartzTheme.tooltipTextColor, 
                            fontSize: 13, 
                            backgroundColor: quartzTheme.tooltipBackground, 
                            border: `0.5px dotted ${quartzTheme.borderColor}`,
                            borderRadius: 9 
                        }}>
                        {tooltip.val}
                    </div>
                </>
            )}
        </>
    );
};

export default BaseGlideGrid


//Inspired by:
//https://github.com/glideapps/glide-data-grid/blob/5983dcabd2fb55b675009813709752008da6d424/packages/core/src/docs/examples/theme-support.stories.tsx#L26C1-L98C1
const quartzTheme = {
    accentColor: SPECIAL_BLUE_COLOR,
    // accentLight: "rgba(202, 206, 255, 0.253)",
    
    // accentColor: "#474747",  //"rgba(0, 0, 102, 0.15)", //"#8c96ff",
    accentLight: "rgba(71, 71, 71, 0.41)",  //"rgba(0, 0, 77, 0.15)", //"rgba(202, 206, 255, 0.253)",

    textDark: "#ededed", //"#d9d9d9",
    textMedium: "#b8b8b8",
    textLight: "#a0a0a0",
    textBubble: "#ffffff",

    bgIconHeader: "#b8b8b8",
    fgIconHeader: "#000000",
    textHeader: "#70d8bd",  //"#a1a1a1",
    textHeaderSelected: "#ededed",  //"#000000",

    bgCell: SPECIAL_QUARTZ_COLOR,
    bgCellMedium: "#202027",
    bgHeader: "#212121",
    bgHeaderHasFocus: "#474747",
    bgHeaderHovered: "#404040",

    bgBubble: "#212121",
    bgBubbleSelected: "#000000",

    bgSearchResult: "#423c24",

    borderColor: "rgba(225,225,225,0.2)",
    drilldownBorder: "rgba(225,225,225,0.4)",

    linkColor: "#4F5DFF",

    headerFontStyle: "normal 14px",
    baseFontStyle: "normal 13px",
    fontFamily: "intelclear", //"Inter, Roboto, -apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Ubuntu, noto, arial, sans-serif",

    roundingRadius: 5,


    //=========== Added Custom propertied below =================
    hover_bgCell: "#203f5c", //"#4c535e"
    groupRow_bgCell: "rgba(0, 100, 255, 0.15)",

    tooltipBackground: SPECIAL_DEEPER_QUARTZ_COLOR, //"#212121",
    tooltipTextColor: SPECIAL_GOLD_COLOR,  //"#ededed",
    tooltipBorderColor: "gray",

    noColDefinedColor: "#151632"
};


const darkTheme = {
    accentColor: "#8c96ff",
    accentLight: "rgba(202, 206, 255, 0.253)",

    textDark: "#d9d9d9",//"#ededed",
    textMedium: "#b8b8b8",
    textLight: "#a0a0a0",
    textBubble: "#ffffff",

    bgIconHeader: "#b8b8b8",
    fgIconHeader: "#000000",
    textHeader: "#a1a1a1",
    textHeaderSelected: "#000000",

    bgCell: "#16161b",   //or fff
    bgCellMedium: "#202027",
    bgHeader: "#212121",
    bgHeaderHasFocus: "#474747",
    bgHeaderHovered: "#404040",

    bgBubble: "#212121",
    bgBubbleSelected: "#000000",

    bgSearchResult: "#423c24",

    borderColor: "rgba(225,225,225,0.2)",
    drilldownBorder: "rgba(225,225,225,0.4)",

    linkColor: "#4F5DFF",

    headerFontStyle: "normal 14px",
    baseFontStyle: "normal 13px",
    fontFamily: "intelclear",

    roundingRadius: 5,


    //=========== Added Custom propertied below =================
    hover_bgCell: "#1f1f1f",

    tooltipBackground: "rgba(0, 0, 0, 0.85)",
    tooltipTextColor: "white"
};


const lightTheme = { 
    bgHeader: "#90A4AE",
    roundingRadius: 5,
    fontFamily: "intelclear",
    baseFontStyle: "normal 13px",
    bgCell: "#fff",  //"#181d1f", //"#E8F5E9"


    //=========== Added Custom propertied below =================
    hover_bgCell: "#e6e6e6",
    mod_two_bgCell: "#e0f0ff88", //"#F9FDFF"
};




















//TODO: need to define comfirmatrion dialog states, then:
//when data is available from fialog, you have to manually efit the grid sata and update damaged cells etc...
// export interface GridCellEditResponseInfo<T extends ServiceModel> { 
//     confirmationContext: ConfirmationDialogProps | undefined | null, 
//     element: T | undefined
// }


// ========================================================================

    
    //===============================================================================================
    //https://github.com/glideapps/glide-data-grid/blob/5983dcabd2fb55b675009813709752008da6d424/packages/core/src/docs/examples/header-menus.stories.tsx#L109
    // const { layerProps, renderLayer } = useLayer({
    //     isOpen: isHeaderMenuOpen,
    //     auto: true,
    //     placement: "bottom-end",
    //     triggerOffset: 2,
    //     onOutsideClick: () => setHeaderMenu(undefined),
    //     trigger: {
    //         getBounds: () => ({
    //             left: headerMenu?.bounds.x ?? 0,
    //             top: headerMenu?.bounds.y ?? 0,
    //             width: headerMenu?.bounds.width ?? 0,
    //             height: headerMenu?.bounds.height ?? 0,
    //             right: (headerMenu?.bounds.x ?? 0) + (headerMenu?.bounds.width ?? 0),
    //             bottom: (headerMenu?.bounds.y ?? 0) + (headerMenu?.bounds.height ?? 0),
    //         }),
    //     },
    // });


    // const onHeaderMenuClick = React.useCallback((col: number, bounds: Rectangle) => {
    //     setHeaderMenu({ col, bounds });
    // }, []);

    
    // const onCellContextMenu = React.useCallback((cell: Item, event: CellClickedEventArgs): void => {
    //     if(cellContextMenuInfo && cellContextMenuInfo.length > 0) {
    //         event.preventDefault();
    //         let bounds = event.bounds;
    //         setContextMenuXYPosistion({ x: bounds.x, y: bounds.y-bounds.height })
    //         setRightClickedCellContext({cell: cell, event: event})
    //         for(let i = 0; i < cellContextMenuInfo.length; i++) {
    //             if(cellContextMenuInfo[i].contextualInfo) {
    //                 (cellContextMenuInfo[i].contextualInfo as BasicKVP).value = rightClickedCellContext
    //             }
    //         }
    //         setShowCellContextMenu(true)
    //     }
    // }, []);   
    //#endregion

    //====================================================================================================

    

    
            {/* {isHeaderMenuOpen &&
                renderLayer(
                    <SimpleMenu {...layerProps}>
                        <div onClick={() => setHeaderMenu(undefined)}>These do nothing</div>
                        <div onClick={() => setHeaderMenu(undefined)}>Add column right</div>
                        <div onClick={() => setHeaderMenu(undefined)}>Add column left</div>
                        <div className="danger" onClick={() => setHeaderMenu(undefined)}>
                            Delete
                        </div>
                    </SimpleMenu>
                )
            } */}

            {/* {showCellContextMenu && <div className="container">
                <ContextMenuDialog 
                    show={showCellContextMenu}
                    onClickOutside={() => { setShowCellContextMenu(false); } }
                    topYPosition={contextMenuXYPosistion.y}
                    leftXPosition={contextMenuXYPosistion.x}
                    menuInfoList={cellContextMenuInfo ?? []}
                    centered={true} 
                    mode={"light"}                
                />
            </div>} */}




    //================================================================================================



    // const getCellContentMangled = React.useCallback < DataEditorProps["getCellContent"] > (item => {
    //     const { path, isGroupHeader, originalIndex } = mapper(item);
    //     if (item[0] === 0) {
    //         return {
    //             kind: GridCellKind.Text,
    //             data: `Row ${JSON.stringify(path)}`,
    //             displayData: `Row ${JSON.stringify(path)}`,
    //             allowOverlay: false
    //         };
    //     } else if (isGroupHeader) {
    //         return {
    //             kind: GridCellKind.Loading,
    //             allowOverlay: false
    //             // span: [1, cols.length - 1],
    //         };
    //     }

    //     return getCellContent(originalIndex);
    // }, [getCellContent, mapper]);
     




// (gridRef.current as DataEditorRef)?.scrollTo(0, 0)

// setTimeout(() => {
//     setVisiblePages({ x: 0, y: 0, width: 0, height: 0 });
//     setInitPageHandled(false);
//     loadingRef.current = CompactSelection.empty();
//     dataRef.current = new Map<number, T>();

// }, 200); 



    // function performReassessmentOfCells(contextualInfo: BasicKVP) : void {
    //     if(specialActionEngageRef && specialActionEngageRef.current && specialActionEngageRef.current.specialActionMood === true) {
    //         // dataRef.current.clear();
    //         // loadingRef.current = CompactSelection.empty()
    //         // setVisiblePages({ x: 0, y: 0, width: 0, height: 0 });
    //         // visiblePagesRef.current = (visiblePages);
    //         // setGridSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
            
    //         reloadDataRows()
    //     }
    // }



// function performReassessmentOfCells(contextualInfo: BasicKVP) : void {
//     if(specialActionEngageRef && specialActionEngageRef.current && specialActionEngageRef.current.specialActionMood === true) {
        // for(let i = 0; i < returnedData.length; i++) {
        //     (dataRef.current as Map<number, T>).set(i + startIndex, returnedData[i]);
        //     for (let col = visiblePages.x; col <= visiblePages.x + visiblePages.width; col++) {
        //         damageList.push({
        //             cell: [col, i + startIndex],
        //         });
        //     }
        // }
        
        // const damageList = new Array<{ cell: [number, number] }>();
        // for (let [key, value] of contextualInfo.value) {
        //     let index = value
        //     for (let col = visiblePages.x; col <= visiblePages.x + visiblePages.width; col++) {    
        //         console.log(key, value, (dataRef.current.get(value) as any)?.name);
        //         damageList.push({
        //             cell: [col, index],
        //         });
                
        //     }
        //     // dataRef.current.delete(index)
        // }
        // dataRef.current.clear();
        // loadingRef.current = CompactSelection.empty()
        // setVisiblePages({ x: 0, y: 0, width: 0, height: 0 });
        // visiblePagesRef.current = (visiblePages);
        // setGridSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
        // (gridRef.current as DataEditorRef)?.updateCells(damageList);
        // (gridRef.current as DataEditorRef).scrollTo(0,0);

        // dataRef.current.clear();
            // //const damageList = new Array<{ cell: [number, number] }>();
            // for (let col = visiblePages.x; col <= visiblePages.x + visiblePages.width; col++) {
            //     damageList.push({
            //         cell: [col, i + startIndex],
            //     });
            // }
        // console.log(gridSelection.rows)
        
       
        
        
        
        // loadingRef.current = CompactSelection.empty()
        // dataRef.current = new Map<number, T>();

        // setVisiblePages({ x: 0, y: 0, width: 0, height: 0 })
        // visiblePagesRef.current = (visiblePages);

        // const damageList = new Array<{ cell: [number, number] }>();
        // for (let col = visiblePages.x; col <= visiblePages.x + visiblePages.width; col++) {
        //     damageList.push({
        //         cell: [col, i + startIndex],
        //     });
        // }
        // (gridRef.current as DataEditorRef).scrollTo(0, 0)
    // }
// }


// function performReset() {
        // async (page: number) => {
        //     const startIndex = page * pageSize;
        //     const returnedData = await getRowData([startIndex, (page + 1) * pageSize]);
        //     if(returnedData && returnedData.length > 0) {
        //         loadingRef.current = loadingRef.current.add(page); //needs to happen here under this 'if'!

        //         const damageList = new Array<{ cell: [number, number] }>();
                
        //         for(let i = 0; i < returnedData.length; i++) {
        //             (dataRef.current as Map<number, T>).set(i + startIndex, returnedData[i]);
        //             for (let col = visiblePages.x; col <= visiblePages.x + visiblePages.width; col++) {
        //                 damageList.push({
        //                     cell: [col, i + startIndex],
        //                 });
        //             }
        //         }

        //         if(searchText.current && searchText.current.length > 0 && dataRef?.current 
        //             && dataRef?.current.size > 0 && dataRef?.current.size < totalRowCount) {
        //             setTotalDataElements(dataRef?.current?.size)
        //         }
        //         else {
        //             setTotalDataElements(totalRowCount)
        //         }

        //         (gridRef.current as DataEditorRef)?.updateCells(damageList);
        //         if(initPageHandled === false) { setInitPageHandled(true) }
        //     }
        // },
        
        //========================================================
        // loadingRef.current = CompactSelection.empty()
        // dataRef.current = new Map<number, T>();

        // setVisiblePages({ x: 0, y: 0, width: 0, height: 0 })
        // visiblePagesRef.current = (visiblePages);

        // const damageList = new Array<{ cell: [number, number] }>();
        // for (let col = visiblePages.x; col <= visiblePages.x + visiblePages.width; col++) {
        //     damageList.push({
        //         cell: [col, i + startIndex],
        //     });
        // }
        // (gridRef.current as DataEditorRef).scrollTo(0, 0)
    // }


    

    // function onDeleteEngaged(selection: GridSelection): boolean | GridSelection {
    //     if(specialDeleteEnageRef && specialDeleteEnageRef.current === true) {
    //         let sel : GridSelection = {
    //             columns: CompactSelection.empty(),
    //             rows: selection.rows
    //         } 
    //         return sel;
    //     }
    //     else {
    //         return false;
    //     }
    // }

