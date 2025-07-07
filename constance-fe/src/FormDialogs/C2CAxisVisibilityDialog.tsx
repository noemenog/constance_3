import * as React from 'react';
import { Autocomplete, Box, Checkbox, Divider, FormControlLabel, IconButton, Slide, Tooltip, Typography } from '@mui/material';
import { ArrowLeft, ArrowLeftOutlined, ArrowRight, Cancel, Check, ClearAllOutlined, DeleteSweepOutlined, DoneAllOutlined, DoubleArrowOutlined, RemoveDoneOutlined, SelectAllOutlined } from '@mui/icons-material';
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from "../theme";
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
import { BasicKVP, BasicProperty, PropertyItem, DisplayOption } from '../DataModels/HelperModels';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useSpiderStore } from '../DataModels/ZuStore';
import { Netclass } from '../DataModels/ServiceModels';
import { transform } from 'lodash';
import { SpButton } from '../CommonComponents/SimplePieces';


enum CheckTypeEnum {
    SHOW_ROWS = "SHOW_ROWS",
    SHOW_COLUMNS = "SHOW_COLUMNS",
    CLEAR_ROWS = "CLEAR_ROWS",
    CLEAR_COLUMNS = "CLEAR_COLUMNS",
    SYNC_ROWS_TO_COLUMNS = "SYNC_ROWS_TO_COLUMNS",
    SYNC_COLUMNS_TO_ROWS = "SYNC_COLUMNS_TO_ROWS" 
}

export interface C2CAxisVisibilityDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string
    onFormClosed : (contextualInfo: BasicKVP|null) => void,
    contextualInfo: BasicKVP,
}

const C2CAxisVisibilityDialog: React.FC<C2CAxisVisibilityDialogProps> = ({ title, opened, close, onFormClosed, contextualInfo }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    
    const [gridApi, setGridApi] = useState<GridApi>();
    
    const [netclasses, setNetclasses] = useState<Netclass[]>([])

    const containerRef = useRef<HTMLElement>(null);  //important!

    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);

    const columnDefsFromXAxis: Array<ColDef | ColGroupDef> = [
        {
            headerName: "#",
            valueGetter: "node.rowIndex + 1",
            minWidth: 78,
            width: 78,
            maxWidth: 78,
            resizable: false,
            editable: false,
        },
        {
            headerName: "Class",
            field: "name",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 300,
            width: 300,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left', color: colors.greenAccent[400]} },
        },
        {
            headerName: "Row Visible?",
            field: "enableC2CRow",
            resizable: false,
            cellDataType: 'boolean',
            autoHeight: true,
            minWidth: 200,
            width: 200,
            maxWidth: 200,
            sortable: false,
            editable: true,
            hide: false,
            cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left', color: "white"} }, 
            mainMenuItems: (params: any) => {
                return (params.defaultItems as any[]).concat(getColumnMenuItems(true))
            },
            valueSetter: (params: any) => {
                (params.data as Netclass).enableC2CRow = params.newValue
                return true;
            }    
        }
    ];
    
    const columnDefsToYAxis: Array<ColDef | ColGroupDef> = [
        {
            headerName: "#",
            valueGetter: "node.rowIndex + 1",
            minWidth: 78,
            width: 78,
            maxWidth: 78,
            resizable: false,
            editable: false,
        },
        {
            headerName: "Class",
            field: "name",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 300,
            width: 300,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left', color: colors.greenAccent[400]} },
        },
        {
            headerName: "Column Visible?",
            field: "enableC2CColumn",
            resizable: false,
            cellDataType: 'boolean',
            autoHeight: true,
            minWidth: 200,
            width: 200,
            maxWidth: 200,
            sortable: false,
            editable: true,
            hide: false,
            cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left', color: "white"} },   
            mainMenuItems: (params: any) => {
                return (params.defaultItems as any[]).concat(getColumnMenuItems(false))
            },
            valueSetter: (params: any) => {
                (params.data as Netclass).enableC2CColumn = params.newValue
                return true;
            },       
        }
    ];
    
    
    function getColumnMenuItems(isRowScenario: boolean) : any {
        let result = [
            'separator',
            {
                name: 'Select All',
                icon: '<span class="ag-icon ag-icon-arrows" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction(isRowScenario, "all"),
                disabled: false,
                tooltip: 'Select All',
                cssClasses: ['bold'],
            },
            {
                name: 'Deselect/Unselect All',
                icon: '<span class="ag-icon ag-icon-not-allowed" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction(isRowScenario, "clear"),
                disabled: false,
                tooltip: 'Remove all selections',
                cssClasses: ['bold'],
            }
        ];

        return result;
    }


    function handleSelectionAction(isRowScenario: boolean, action: string) {
        let ncListCopy = rfdcCopy<Netclass[]>(netclasses) as Netclass[]
        if(isRowScenario) {
            if(action.toLowerCase() === "all") {
                ncListCopy.forEach(a => {a.enableC2CRow = true})
            }
            else if(action.toLowerCase() === "clear") {
                ncListCopy.forEach(a => {a.enableC2CRow = false})
            }
        }
        else {
            if(action.toLowerCase() === "all") {
                ncListCopy.forEach(a => {a.enableC2CColumn = true})
            }
            else if(action.toLowerCase() === "clear") {
                ncListCopy.forEach(a => {a.enableC2CColumn = false})
            }
        }
        setNetclasses(ncListCopy);
    }


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
        if(contextualInfo && contextualInfo.value) {
            let ncList : Netclass[] = contextualInfo.value.sort((a: Netclass, b: Netclass) => a.name < b.name ? -1 : 1);
            let ncListCopy = rfdcCopy<Netclass>(ncList) as Netclass[];
            setNetclasses(ncListCopy)
        }
    }, []);
    

    const sectionStyle = useMemo(() => (
        { padding: 2, borderTopLeftRadius: 0, borderTopRightRadius: 200, borderBottomLeftRadius: 0, borderBottomRightRadius: 200, backgroundColor: colors.primary[400] }
    ), []);

    
    function handleSpecialAction(event: any, type: CheckTypeEnum): void {
        if(type && netclasses.length > 0) {
            let modNetclasses = rfdcCopy(netclasses) as Netclass[]
            if(type === CheckTypeEnum.SHOW_ROWS) {
                modNetclasses.forEach(a => { a.enableC2CRow = true; } )
            }
            else if(type === CheckTypeEnum.SHOW_COLUMNS) {
                modNetclasses.forEach(a => { a.enableC2CColumn = true; } )
            }
            else if(type === CheckTypeEnum.CLEAR_ROWS) {
                modNetclasses.forEach(a => { a.enableC2CRow = false; } )
            }
            else if(type === CheckTypeEnum.CLEAR_COLUMNS) {
                modNetclasses.forEach(a => { a.enableC2CColumn = false; } )
            }
            else if(type === CheckTypeEnum.SYNC_ROWS_TO_COLUMNS) {
                modNetclasses.forEach(a => { a.enableC2CColumn = a.enableC2CRow; } )
            }
            else if(type === CheckTypeEnum.SYNC_COLUMNS_TO_ROWS) {
                modNetclasses.forEach(a => { a.enableC2CRow = a.enableC2CColumn; } )
            }
            
            setNetclasses(modNetclasses);
        }
    }


    function handleCancel() {
        if (onFormClosed) {
            onFormClosed(null);
        }
        
        setNetclasses(new Array<Netclass>())
        if(close){ close() }
    }


    function handleSubmit() {
        if(netclasses.every(a => a.enableC2CRow === false)){
            displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed. At least one ROW (left-side) must be enabled `);
            return;
        }
        else {
            contextualInfo.value = Array.from(netclasses)

            if (onFormClosed) {
                onFormClosed(contextualInfo);
            }

            setNetclasses(new Array<Netclass>())
            if(close){ close() }
        }
    }




    return (
        <Box>
            <Modal 
                opened={opened as boolean}
                onClose={handleCancel} 
                centered
                closeOnClickOutside={false}
                closeOnEscape={false}
                size="calc(60vw - 3rem)"
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 8,
                }}
                styles={{                 
                    title: { padding: 0, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: SPECIAL_RED_COLOR, backgroundColor: colors.primary[400] }
                }}>
                    
                <Box ref={containerRef} flexDirection="row" sx={{ '& .MuiTextField-root': { width: '100%'}, }}>
                    
                    <Box justifyContent="center" alignItems="center" sx={sectionStyle}>
                        <Divider sx={{mt:0, mb: 0}} />
                        <Box display="flex" flexDirection="row" justifyContent="center" alignItems="center">
                            
                            <Tooltip placement="top" title={`Select (show) all rows`}>
                                <IconButton onClick={ (event) => handleSpecialAction(event, CheckTypeEnum.SHOW_ROWS) }>
                                <ArrowLeft color="secondary"/>
                                <DoneAllOutlined sx={{color: SPECIAL_RED_COLOR}} />
                                </IconButton>
                            </Tooltip>

                            <Divider orientation="vertical" sx={{ml: 3, mr: 3, height:20}} />
                            
                            <Tooltip placement="top" title={`Uncheck (hide) all rows`}>
                                <IconButton onClick={ (event) => handleSpecialAction(event, CheckTypeEnum.CLEAR_ROWS) }>
                                    <ArrowLeft color="secondary"/>
                                    <RemoveDoneOutlined sx={{color: SPECIAL_RED_COLOR}} />
                                </IconButton>
                            </Tooltip>
                            
                            <Divider orientation="vertical" sx={{ml: 3, mr: 3, height:20}} />
                            
                            <Tooltip placement="top" title={`Sync left to right`}>
                                <IconButton onClick={ (event) => handleSpecialAction(event, CheckTypeEnum.SYNC_ROWS_TO_COLUMNS) }>
                                    <DoubleArrowOutlined color="secondary" />
                                </IconButton>
                            </Tooltip>

                            <Divider orientation="vertical" sx={{ml: 3, mr: 5, height:20}} />
                            <Divider orientation="horizontal" sx={{ml: 2, mr: 2, width:200}} />
                            <Divider orientation="vertical" sx={{ml: 5, mr: 3, height:20}} />
                            
                            <Tooltip placement="top" title={`Sync right to left`}>
                                <IconButton onClick={ (event) => handleSpecialAction(event, CheckTypeEnum.SYNC_COLUMNS_TO_ROWS) } sx={{transform: "rotate(180deg)"}}>
                                    <DoubleArrowOutlined color="secondary" />
                                </IconButton>
                            </Tooltip>

                            <Divider orientation="vertical" sx={{ml: 3, mr: 3, height:20}} />
                            
                            <Tooltip placement="top" title={`Uncheck (hide) all columns`}>
                                <IconButton onClick={ (event) => handleSpecialAction(event, CheckTypeEnum.CLEAR_COLUMNS) }>
                                    <RemoveDoneOutlined sx={{color: SPECIAL_RED_COLOR}} />
                                    <ArrowRight color="secondary"/>
                                </IconButton>
                            </Tooltip>

                            <Divider orientation="vertical" sx={{ml: 3, mr: 3, height:20}} />
                            
                            <Tooltip placement="top" title={`Select (show) all columns`}>
                                <IconButton onClick={ (event) => handleSpecialAction(event, CheckTypeEnum.SHOW_COLUMNS) }>
                                    <DoneAllOutlined sx={{color: SPECIAL_RED_COLOR}} />
                                    <ArrowRight color="secondary"/>
                                </IconButton>
                            </Tooltip>
                        </Box>
                        
                        <Divider sx={{mt:0, mb: 0}} />
                        
                        <Box display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ ml: 5, color: colors.greenAccent[400]}}>Rows (X-Axis)</Typography>
                            <Typography sx={{ mr: 5, color: colors.greenAccent[400]}}>Columns (Y-Axis)</Typography>
                        </Box>
                        
                        <Divider sx={{mt:0, mb: 1}} />
                        
                        <Box display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
                            <div style={{ height: "62vh", minWidth: "48%", width: "48%" }}>
                                <AgGridReact
                                    rowData={netclasses}
                                    animateRows={false}
                                    columnDefs={columnDefsFromXAxis}
                                    defaultColDef={defaultColDef}
                                    onGridReady={onGridReady}
                                    theme={themeDarkBlue}
                                    rowSelection={{ mode: "singleRow", checkboxes: false }}
                                    suppressExcelExport={false}
                                    suppressCsvExport={false}   
                                    groupDisplayType='singleColumn'    
                                    groupDefaultExpanded={1}
                                    rowHeight={25}
                                    headerHeight={28}
                                />
                            </div>  

                            <Slide timeout={{ enter: 600, exit: 400 }} direction="down" in={true} container={containerRef.current}>
                                <Box sx={{ display: 'flex', alignItems: 'center'}} flexDirection={"row"}>
                                    <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                    <Divider orientation="vertical" sx={{ml: 2, mr: 2, height:"60vh"}} />
                                    <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                </Box>
                            </Slide>

                            <div style={{ height: "62vh", minWidth: "48%", width: "48%" }}>
                                <AgGridReact
                                    rowData={netclasses}
                                    animateRows={false}
                                    columnDefs={columnDefsToYAxis}
                                    defaultColDef={defaultColDef}
                                    onGridReady={undefined}
                                    theme={themeDarkBlue}
                                    rowSelection={{ mode: "singleRow", checkboxes: false }}
                                    suppressExcelExport={false}
                                    suppressCsvExport={false}   
                                    groupDisplayType='singleColumn'    
                                    groupDefaultExpanded={1}
                                    rowHeight={25}
                                    headerHeight={28}
                                />
                            </div>
                        </Box>                      
                    </Box>

                </Box>

                <Divider sx={{ mt: 1, mb: 1 }}/>
                
                <SpButton
                    intent="cancel"
                    onClick={handleCancel}
                    startIcon={<Cancel />}
                    sx={{ m: 1, mb: 0, height: 32, width:200 }}
                    label="Cancel" />

                <SpButton
                    intent="plain"
                    onClick={handleSubmit}
                    type="submit"
                    startIcon={<Check />}
                    sx={{ m: 1, mb: 0, height: 32, width:200 }}
                    label="Save" />
            </Modal>
        </Box>
    );
}

export default C2CAxisVisibilityDialog















    //Capabilities: 
    //  Make sure at least one row is selected
    //  Make sure at least one column is selected
    //  ALL column must be off limits
    //  Allow sync rows to columns
    //  Allow sync Columns to Rows
    //  Clear all X
    //  Clear all Y
    

    



{/* <Tooltip placement="top" title={`Apply changes to all rule areas`}>
    <FormControlLabel 
        label="Sync X and Y axis" 
        control={
            <Checkbox 
                checked={true} 
                onChange={(e, checked) => onCheckBoxChanged(CheckTypeEnum.ALL_RULE_AREAS, checked)} 
            />
        } 
    />
</Tooltip> */}


{/* <SpButton
                                    intent="plain"
                                    onClick={handleCancel}
                                    startIcon={<ClearAllOutlined />}
                                    sx={{ m: 1, mb: 0, height: 32, width:150 }}
                                    label="Clear Rows (X)" 
                                /> */}