import React, { useState, useContext, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { CellDoubleClickedEvent, ColDef, ColGroupDef, GetContextMenuItemsParams, GridApi, NewValueParams, SuppressKeyboardEventParams, ValueFormatterParams } from 'ag-grid-community';
import { Box, Divider, IconButton, InputBase, Slide, Table, TableBody, TableCell, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import { themeDarkBlue, tokens } from '../../theme';
import { AppInfo, Bucket, CDomainData, ConfigItem, LoadingSpinnerInfo, LoggedInUser } from '../../DataModels/ServiceModels';
import { ConfigContentTypeEnum, GRID_SUPRESS_KEYS, LATEST_VERSION_TAG, SPECIAL_BLUE_COLOR, SPECIAL_RED_COLOR, UIMessageType } from '../../DataModels/Constants';
import { getEnumValuesAsMap, getEnviList, validateConfigValueAndType } from '../../BizLogicUtilities/UtilFunctions';
import { useCStore } from '../../DataModels/ZuStore';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { Editor, Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import EditorComp from '../../CommonComponents/EditorComp';

enum TVActionTypeEnum {
    COPY = "copy",
    EXPORT = "export",
    DELETE = "delete",
    COMPARE = "compare",
    CHANGE = "change",
    UPLOAD = "upload"
}

interface TableViewComponentProps {
    currentConfigs: ConfigItem[],
    darkMode?: boolean,
    disableMiniMap?: boolean,
    editorContentLanguage?: string,
    onSaveAction: () => void,
    onDeleteAction: () => void,
    onAddAction: () => void,
    onCompareAction: (targetEnv: string|null) => void,
    onMoveAction: (targetBucketId: string|null) => void,
    onCopyAction: (targetBucketId: string|null) => void,   
}

interface TableViewComponentRef {
    getSelectedRows: (defaultToSelectAll: boolean, forceGetCompleteValidDataOrGetNone: boolean) => ConfigItem[];
}

const TableViewComponent = forwardRef<TableViewComponentRef, TableViewComponentProps>(({ 
    onSaveAction, onCompareAction, onDeleteAction, onMoveAction, onCopyAction, onAddAction, 
    currentConfigs, darkMode = true, disableMiniMap = true, editorContentLanguage = 'json' }, ref) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as CDomainData;
    const appObj = domainData.appInfo as AppInfo;
    const buckets = domainData.bucketList ?? [];
    
    const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useCStore((state) => state.setIsLoadingBackdropEnabled);
    const placePageTitle = useCStore((state) => state.placePageTitle);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
    const selectedBucket = useCStore((state) => state.selectedBucket);
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment);
    
    const [appInfo, setAppInfo] = useState<AppInfo>(appObj);
    const [bucketList, setBucketList] = useState<Bucket[]>(buckets);
    const [configList, setConfigList] = useState<ConfigItem[]>(currentConfigs);
    const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(true);

    const [gridApi, setGridApi] = useState<GridApi>();
    const [quickFilterText, setQuickFilterText] = useState('')

    const containerRef = useRef<any>();
    const valueEditorRef = useRef<null|editor.IStandaloneCodeEditor>(null);


    useImperativeHandle(ref, () => ({
        getSelectedRows(defaultToSelectAll, forceGetAllDataifValidorNone = false) {
            return getGridViewSelectedRowData(defaultToSelectAll, forceGetAllDataifValidorNone);
        }
    }));


    useEffect(() => {
        placePageTitle("Configs")
    }, []);


    useEffect(() => {
        setConfigList(currentConfigs)
    }, [currentConfigs]);

    const compareEnvs : string[] = useMemo(() => {
        let envs = new Array<string>();
        if(selectedBucket) {
            let bucketEnvList = getEnviList(selectedBucket)
            envs = bucketEnvList.envListRawFormatArray.filter(x => x !== selectedEnvironment)
        }
        return envs;
    }, []);

    
    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const gridCols: Array<ColDef | ColGroupDef> = [
        {
            headerName: "Config Name",
            field: 'name',
            resizable: true,
            filter: 'text',
            cellEditor: 'agPopupTextCellEditor',
            minWidth: 200,
            width: 250,
            sortable: true,
            editable: true,
            onCellValueChanged: (event) => onEditableCellValueChanged(event, "name"),
            cellStyle: (params: any) => { return { fontWeight : 'bold', textAlign: 'left'} }
        },
        {
            headerName: "Value Type",
            field: 'contentType',
            resizable: false,
            filter: 'text',
            minWidth: 185,
            width: 200,
            maxWidth: 200,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            onCellValueChanged: (event) => onEditableCellValueChanged(event, "contentType"),
            cellEditor: 'agPopupSelectCellEditor',
            cellEditorParams: {
                values: Array.from(getEnumValuesAsMap(ConfigContentTypeEnum).keys()),
            },
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left' } }
        },
        {
            //version will be formatted as: "### - date [idsid]"
            //if latest version: "Latest - date [idsid]"   >> in this case, date is lastUpdatedOn field of the main ConfigItem
            headerName: "Version",
            field: 'version',
            resizable: true,
            filter: 'text',
            minWidth: 385,
            width: 300,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            onCellValueChanged: (event) => onEditableCellValueChanged(event, "version"),
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: {
                values: [LATEST_VERSION_TAG],
            },
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left' } }
        },
        {
            headerName: "Description",
            field: "description",
            resizable: true,
            filter: 'text',
            cellEditor: 'agLargeTextCellEditor',
            cellEditorPopup: true,
            minWidth: 200,
            autoHeight: true,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            onCellValueChanged: (event) => onEditableCellValueChanged(event, "description"),
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "",
            field: "_id",
            hide: true  //Always keep hidden!
        }
    ];



    const getContextMenuItems = (params: GetContextMenuItemsParams<any, any>) => {
        let handleOnBucketSwitchMenuItemSelected = (targetBucketName: string, action: string) => {
            const selected = getGridViewSelectedRowData(false, false);
            if (selected && selected.length > 0) {
                let tgtBucket = buckets.find(a => a.name.toUpperCase() === targetBucketName.toUpperCase())
                if(tgtBucket && tgtBucket._id) {
                    if(action === TVActionTypeEnum.COPY && onCopyAction) {
                        onCopyAction(tgtBucket._id?.toString() as string);
                    }
                    else if (action === TVActionTypeEnum.CHANGE && onMoveAction) {
                        onMoveAction(tgtBucket._id?.toString() as string);
                    }
                }
            }
        }

        let getBucketSwitchSubMenu = (action: string) => {
            let arr : any= []
            if(selectedBucket && bucketList.length > 0) {
                let otherBuckets = bucketList.filter(a => a._id.toString() !== selectedBucket._id.toString())
                if(otherBuckets.length > 0) {
                    otherBuckets.forEach(x => {
                        let item = {
                            name: x.name,
                            action: () => {
                                handleOnBucketSwitchMenuItemSelected(x.name, action);
                            }
                        }
                        arr.push(item)
                    })
                }
            }
            return arr
        }

        let result = [
            {
                name: 'Add',
                icon: '<span class="ag-icon ag-icon-arrows" unselectable="on" role="presentation"></span>',
                action: () => {
                    if(onAddAction) {
                        onAddAction();
                    }
                },
                disabled: true,
                tooltip: 'Add selected config items',
                cssClasses: ['bold'],
            },
            {
                name: 'Save',
                icon: '<span class="ag-icon ag-icon-save" unselectable="on" role="presentation"></span>',
                action: () => {
                    if(onSaveAction) {
                    onSaveAction();
                }},
                disabled: true,
                tooltip: 'Save selected config items',
                cssClasses: ['bold'],
            },
            {
                name: 'Delete',
                icon: '<span class="ag-icon ag-icon-cancel" unselectable="on" role="presentation"></span>',
                action: () => {
                    if(onDeleteAction) {
                        onDeleteAction();
                    }
                },
                disabled: true,
                tooltip: 'Delete selected config items',
                cssClasses: ['bold'],
            },
            {
                name: 'Compare To',
                icon: '<span class="ag-icon ag-icon-grip" unselectable="on" role="presentation"></span>',
                disabled: true,
                subMenu: [
                    {
                        name: compareEnvs[0],
                        action: () => {
                            if(onCompareAction) {
                                onCompareAction(compareEnvs[0]);
                            }
                        }
                    },
                    {
                        name: compareEnvs[1],
                        action: () => {
                            if(onCompareAction) {
                                onCompareAction(compareEnvs[1]);
                            }
                        }
                    }
                ],
            },
            {
                name: 'Change Bucket',
                icon: '<span class="ag-icon ag-icon-grip" unselectable="on" role="presentation"></span>',
                disabled: false,
                subMenu: getBucketSwitchSubMenu(TVActionTypeEnum.CHANGE)
            },
            {
                name: 'Copy To Another Bucket',
                icon: '<span class="ag-icon ag-icon-grip" unselectable="on" role="presentation"></span>',
                disabled: false,
                subMenu: getBucketSwitchSubMenu(TVActionTypeEnum.COPY)
            },
        ];

        return result;
    }

    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
        (params.api as GridApi).sizeColumnsToFit();
    }, []);



    function getGridViewSelectedRowData(defaultToSelectAll: boolean, forceGetCompleteValidDataOrGetNone: boolean) : ConfigItem[] {
        const selectedData = gridApi?.getSelectedRows();
        if(forceGetCompleteValidDataOrGetNone === true) {
            let data = new Array<ConfigItem>();
            if(gridApi) {
                gridApi.forEachNode(function(node) {
                    data.push(node.data);
                });
            }
            return data;
        }
        else if (selectedData && selectedData.length > 0) {
            return selectedData
        }
        else if (defaultToSelectAll === true) {
            return configList
        }
        else {
            return []
        }
    }

    








    //==========================================================================================================

    
    function onSearchFieldTextChange(event: any): void {
        setQuickFilterText(event.target.value)
    }



    function getFormattedConfigValueForGrid(params: any, isExportCase: boolean): string {
        if (params) {
            let paramsContentType : ConfigContentTypeEnum | string = ""

            // if(isExportCase) {
            //     if(params.column.colDef.headerName == CONFIG_VALUE_HEADER) {
            //         paramsContentType = params.node.data.contentType
            //     }
            // }
            // else {
            //     paramsContentType = params.data.contentType
            // }

            // if(paramsContentType == ConfigContentTypeEnum.JSON){
            //     return JSON.stringify(params.value)
            // }
            // else if (paramsContentType == ConfigContentTypeEnum.XML){
            //     return params.value.toString()
            // } 
            // else {
            //     return params.value
            // }
        }

        return ""
    }


    function onEditableCellValueChanged(event: NewValueParams<any>, fieldName: string): void {
        if(event && event.data && event.data._id){
            //Was deselecting all items here [gridRef.current?.api?.deselectAll()] -but no longer necessary
            //Nothing here for now...
        
        
            if(fieldName.toLowerCase() === "contentType") {
                if(event && event.data && event.data._id){
                    let valResult = validateConfigValueAndType(event.data.configValue, event.data.contentType)
                    if(valResult === false) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `Value for config item '${event.data.configName}' is not of type '${event.data.contentType}'`)
                    }
                }
            }
        }
        

        //here we need to set "setHasPendingChanges"
    }


    //******************************************************************************************** */

    






    return (
        <Box>
            <Box ref={containerRef} flexDirection="column" alignItems="left" justifyContent="left">
                <Box sx={{display:"flex", flexDirection:"row", justifyContentsx: "center", width:"100%", m: 1, mt: 1}}>
                    
                    <div style={{ marginTop: 5, height: "76.5vh", width: '65%' }} >
                        <AgGridReact
                            rowData={configList}
                            animateRows={true}
                            defaultColDef={defaultColDef}
                            columnDefs={gridCols}
                            onGridReady={onGridReady}
                            theme={themeDarkBlue}
                            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, selectAll: "filtered" }}
                            getContextMenuItems={getContextMenuItems}
                            quickFilterText={quickFilterText} 
                            rowHeight={35}
                            headerHeight={35}
                            includeHiddenColumnsInQuickFilter={true}
                            suppressExcelExport={false}
                            suppressCsvExport={true}
                            defaultCsvExportParams={{
                                fileName : `${appInfo.name}__${selectedBucket?.name}__export`,
                                columnSeparator: ',',
                                processCellCallback: (params) => getFormattedConfigValueForGrid(params, true)
                            }} 
                            defaultExcelExportParams={{
                                fileName : `${appInfo.name}__${selectedBucket?.name}__export`,
                                processCellCallback: (params) => getFormattedConfigValueForGrid(params, true)
                            }}                    
                        />
                    </div>
                    
                    <Slide timeout={{ enter: 600, exit: 400 }} direction="up" in={true} container={containerRef.current}>
                        <Box sx={{ display: 'flex', alignItems: 'center'}} flexDirection={"row"}>
                            <Divider sx={{width: 10, mt: 2, mb: 2}} />
                            <Divider orientation="vertical" sx={{ml: 2, mr: 2, height:"60vh"}} />
                            <Divider sx={{width: 10, mt: 2, mb: 2}} />
                        </Box>
                    </Slide>

                    <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", mt: .5, width: '35%', mr: 2 }} >
                        <Box sx={{  border: 1, borderColor: hasPendingChanges ? SPECIAL_RED_COLOR : colors.grey[400], 
                            display:"flex", flexDirection:"column", alignItems:"center", width: '100%' }} >
                            <EditorComp 
                                darkMode={darkMode}
                                editorHeight={"76.5vh"}
                                disableMiniMap={disableMiniMap} 
                                editorContentLanguage={editorContentLanguage} 
                                editorContent={""}
                                ref={valueEditorRef.current}
                            />
                        </Box>
                    </Box>         
                    
                </Box>
            </Box>
        
        </Box>
    );

})



export default TableViewComponent
export type { TableViewComponentRef };










//  const getContextMenuItems = (params: GetContextMenuItemsParams<any, any>) => {
//         let result = [
//             // "separator",
//             {
//                 name: 'Add',
//                 icon: '<span class="ag-icon ag-icon-arrows" unselectable="on" role="presentation"></span>',
//                 action: onAddButtonClicked,
//                 disabled: true,
//                 tooltip: 'Add selected config items',
//                 cssClasses: ['bold'],
//             },
//             {
//                 name: 'Save',
//                 icon: '<span class="ag-icon ag-icon-save" unselectable="on" role="presentation"></span>',
//                 action: () => processConfigSave(getSelectedRowData()),
//                 disabled: true,
//                 tooltip: 'Save selected config items',
//                 cssClasses: ['bold'],
//             },
//             {
//                 name: 'Delete',
//                 icon: '<span class="ag-icon ag-icon-cancel" unselectable="on" role="presentation"></span>',
//                 action: () => processConfigDelete(getSelectedRowData()),
//                 disabled: true,
//                 tooltip: 'Delete selected config items',
//                 cssClasses: ['bold'],
//             },
//             {
//                 name: 'Compare To',
//                 icon: '<span class="ag-icon ag-icon-grip" unselectable="on" role="presentation"></span>',
//                 disabled: true,
//                 subMenu: [
//                     {
//                         name: compareEnvs[0],
//                         action: () => {
//                             handleOnCompareButtonClicked(compareEnvs[0]);
//                         }
//                     },
//                     {
//                         name: compareEnvs[1],
//                         action: () => {
//                             handleOnCompareButtonClicked(compareEnvs[1]);
//                         }
//                     }
//                 ],
//             },
//             {
//                 name: 'Change Bucket',
//                 icon: '<span class="ag-icon ag-icon-grip" unselectable="on" role="presentation"></span>',
//                 disabled: false,
//                 subMenu: getBucketSwitchSubMenu(ActionTypeEnum.CHANGE)
//             },
//             {
//                 name: 'Copy To Another Bucket',
//                 icon: '<span class="ag-icon ag-icon-grip" unselectable="on" role="presentation"></span>',
//                 disabled: false,
//                 subMenu: getBucketSwitchSubMenu(ActionTypeEnum.COPY)
//             },
//             // 'separator',
//             // 'separator',
//             // 'copy',
//             // 'copyWithHeaders',
//             // 'copyWithGroupHeaders',
//             // 'separator',
//             // 'export'
//         ];

//         return result;
//         // return [(params.defaultItems as any[]), ...result];
//     }




// <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", mt: .5, width: '35%', mr: 2 }} >
//                         {/* <Typography sx={{ fontSize: 13}}>{`Description`}</Typography> 
//                         <Box sx={{ border: 1, borderColor: hasPendingChanges ? SPECIAL_RED_COLOR : colors.grey[400], display:"flex", flexDirection:"column", alignItems:"center", width: '100%' }}>
//                             <EditorComp 
//                             darkMode={false} 
//                             editorHeight={"10vh"}
//                             disableMiniMap={disableMiniMap} 
//                             editorContentLanguage={editorContentLanguage} 
//                             editorContent={""}
//                             ref={descEditorRef.current}
//                         />
//                         </Box> */}
//                         {/* <Typography sx={{ mt: 0, fontSize: 13}}>{`Config Value`}</Typography>  */}
//                         <Box sx={{  border: 1, borderColor: hasPendingChanges ? SPECIAL_RED_COLOR : colors.grey[400], 
//                             display:"flex", flexDirection:"column", alignItems:"center", width: '100%' }} >
//                             <EditorComp 
//                                 darkMode={true}
//                                 editorHeight={"76.5vh"}
//                                 disableMiniMap={disableMiniMap} 
//                                 editorContentLanguage={editorContentLanguage} 
//                                 editorContent={""}
//                                 ref={valueEditorRef.current}
//                             />
//                         </Box>
//                     </Box>         
                    
//                     {/* <Box flexGrow={1}>                
//                         <Box height="100%">
//                             <Editor
//                                 height="83vh"
//                                 width="100%"
//                                 theme={colorMode}
//                                 defaultLanguage={editorContentLanguage}
//                                 defaultValue={JSON.stringify([])}
//                                 onChange={handleEditorChange}
//                                 onMount={handleEditorDidMount}
//                                 beforeMount={handleEditorWillMount}
//                                 onValidate={handleEditorValidation}
//                                 value={JSON.stringify(configs ?? [])}
//                             />
//                         </Box>
//                     </Box> */}



//====================================================================================================

                {/* <Box sx={{display:"flex", flexDirection:"row", alignItems:"center", justifyContentsx: "center", alignSelf: "center", width:"100%", m: 1, mt:2}}>
                    
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginRight: 1 }} />
                    </Slide>

                    <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", padding: 0}}>
                        <Tooltip placement="top" title={`Update core app info & settings`}>
                            <IconButton onClick={() => {}}>
                                <CheckCircleOutline fontSize="small" color="secondary"/>
                            </IconButton>
                        </Tooltip>
                        <Typography sx={{ fontSize: 11 }}>Save</Typography>
                    </Box>
                    
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                    </Slide>

                    <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", padding: 0}}>
                        <Tooltip placement="top" title={`Update core app info & settings`}>
                            <IconButton onClick={() => {}}>
                                <AddCircleOutlined fontSize="small" color="secondary"/>
                            </IconButton>
                        </Tooltip>
                        <Typography sx={{ fontSize: 11 }}>Add</Typography>
                    </Box>
                    
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                    </Slide>

                    <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", padding: 0}}>
                        <Tooltip placement="top" title={`Update core app info & settings`}>
                            <IconButton onClick={() => {}}>
                                <BuildCircleOutlined fontSize="small" color="secondary"/>
                            </IconButton>
                        </Tooltip>
                        <Typography sx={{ fontSize: 11 }}>Copy</Typography>
                    </Box>
                    
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                    </Slide>

                    <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                        <Tooltip placement="top" title={`Export all buckets to a different environment`}>
                            <span>
                                <IconButton disabled={false} onClick={() => {}}>
                                    <MoveUpOutlined fontSize="small" color={"secondary"} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Typography sx={{ fontSize: 11 }}>Move</Typography>
                    </Box>

                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                    </Slide>

                    <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                        <Tooltip placement="top" title={`Compare`}>
                            <IconButton onClick={() => {}}>
                                <CopyAllOutlined fontSize="small" color="secondary"/>
                            </IconButton>
                        </Tooltip>
                        <Typography sx={{ fontSize: 11 }}>Compare</Typography>
                    </Box>

                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                    </Slide>

                    <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                        <Tooltip placement="top" title={(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock`: `Lock`}>
                            <IconButton onClick={() => {}}>
                                {(appInfo.lockedBy && appInfo.lockedBy.length > 0)
                                    ? <LockOutlined fontSize="small" sx={{ color: SPECIAL_RED_COLOR}} />
                                    : <LockOpenOutlined fontSize="small" color="secondary"/>
                                }
                            </IconButton>
                        </Tooltip>
                        <Typography sx={{ fontSize: 11 }}>{(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock`: `Lock`}</Typography>
                    </Box>

                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                    </Slide>

                    <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                        <Tooltip placement="top" title={`Delete`}>
                            <IconButton onClick={() => {}}>
                                <DeleteForeverOutlined fontSize="small" color="secondary"/>
                            </IconButton>
                        </Tooltip>
                        <Typography sx={{ fontSize: 11 }}>Delete</Typography>
                    </Box>
                    
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                        <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 3 }} />
                    </Slide>

                    <Box display="flex" sx={{ backgroundColor: colors.primary[400], width:"61%"}}>
                        <InputBase size="small" sx={{ ml: 2, flex: 1}}  placeholder="Search" onChange={onSearchFieldTextChange}/>
                        <IconButton sx={{ p: '5px' }}>
                            <SearchIcon />
                        </IconButton>
                    </Box>
                    
                    <Divider orientation="vertical" sx={{height: 30, ml: 1}} />
                </Box> */}

//====================================================================================================


    // const gridCols: Array<ColDef | ColGroupDef> = [
    //     // {
    //     //     headerName: "Row",
    //     //     valueGetter: "node.rowIndex + 1",
    //     //     field: '',
    //     //     resizable: true,
    //     //     filter: 'number',
    //     //     width: 120,
    //     //     minWidth: 120,
    //     //     maxWidth: 150,
    //     //     sortable: false,
    //     //     editable: false,
    //     //     checkboxSelection: true,
    //     //     headerCheckboxSelection: true,
    //     //     headerCheckboxSelectionFilteredOnly: true,
    //     //     cellStyle: (params: any) => { return { fontWeight: 'lighter', textAlign: 'left' } },
    //     // },
    //     {
    //         headerName: "Config Name",
    //         field: 'name',
    //         resizable: true,
    //         filter: 'text',
    //         cellEditor: 'agPopupTextCellEditor',
    //         minWidth: 200,
    //         width: 250,
    //         // maxWidth: 300,
    //         // sort: "asc",
    //         sortable: true,
    //         editable: true,
    //         // sortingOrder: ["asc", "desc"],
    //         checkboxSelection: true,
    //         headerCheckboxSelection: true,
    //         headerCheckboxSelectionFilteredOnly: true,
    //         onCellValueChanged: editableCellValueChanged,
    //         cellStyle: (params: any) => { return { fontWeight : 'bold', 'color': '#641E16', textAlign: 'left'} }
    //     },
    //     // {
    //     //     headerName: CONFIG_VALUE_HEADER,
    //     //     field: CONFIG_VALUE_FIELD,
    //     //     resizable: true,
    //     //     filter: 'text',
    //     //     minWidth: 200,
    //     //     autoHeight: true,
    //     //     // sort: "asc",
    //     //     sortable: true,
    //     //     editable: false,
    //     //     sortingOrder: ["asc", "desc"],
    //     //     valueFormatter: params => getFormattedConfigValueForGrid(params, false),
    //     //     cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
    //     //     suppressKeyboardEvent: disableTabAndEnterKeys,
    //     // },
    //     // {
    //     //     headerName: "Description",
    //     //     field: CONFIG_DESC_FIELD,
    //     //     resizable: true,
    //     //     filter: 'text',
    //     //     cellEditor: 'agLargeTextCellEditor',
    //     //     cellEditorPopup: true,
    //     //     minWidth: 200,
    //     //     autoHeight: true,
    //     //     // sort: "asc",
    //     //     sortable: true,
    //     //     editable: false,
    //     //     sortingOrder: ["asc", "desc"],
    //     //     onCellValueChanged: editableCellValueChanged,
    //     //     suppressKeyboardEvent: disableTabAndEnterKeys,
    //     //     cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
    //     // },
    //     {
    //         headerName: "Value Type",
    //         field: 'contentType',
    //         resizable: false,
    //         filter: 'text',
    //         cellEditor: 'agPopupSelectCellEditor',
    //         cellEditorParams: {
    //             values: Array.from(getEnumValuesAsMap(ConfigContentTypeEnum).keys()),
    //         },
    //         minWidth: 185,
    //         width: 200,
    //         maxWidth: 200,
    //         // sort: "asc",
    //         sortable: true,
    //         editable: true,
    //         sortingOrder: ["asc", "desc"],
    //         onCellValueChanged: onConfigTypeCellValueChanged,
    //         cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left' } }
    //     },
    //     {
    //         //version will be formatted as: "### - date [idsid]"
    //         //if latest version: "Latest - date [idsid]"   >> in this case, date is lastUpdatedOn field of the main ConfigItem
    //         headerName: "Version",
    //         field: 'version',
    //         resizable: true,
    //         filter: 'text',
    //         cellEditor: 'agPopupSelectCellEditor',
    //         cellEditorParams: {
    //             values: Array.from(getEnumValuesAsMap(ConfigContentTypeEnum).keys()),
    //         },
    //         minWidth: 385,
    //         width: 300,
    //         // maxWidth: 300,
    //         // sort: "asc",
    //         sortable: true,
    //         editable: true,
    //         sortingOrder: ["asc", "desc"],
    //         onCellValueChanged: onConfigTypeCellValueChanged,
    //         cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left' } }
    //     },
    //     {
    //         headerName: "Description",
    //         field: CONFIG_DESC_FIELD,
    //         resizable: true,
    //         filter: 'text',
    //         cellEditor: 'agLargeTextCellEditor',
    //         cellEditorPopup: true,
    //         minWidth: 200,
    //         autoHeight: true,
    //         // sort: "asc",
    //         sortable: true,
    //         editable: false,
    //         sortingOrder: ["asc", "desc"],
    //         onCellValueChanged: editableCellValueChanged,
    //         suppressKeyboardEvent: disableTabAndEnterKeys,
    //         cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
    //     },
    //     {
    //         headerName: "",
    //         field: "_id",
    //         hide: true  //Always keep hidden!
    //     }
    // ];



//=================================================================================================================================================

{/* <Box display="flex" flexDirection="column" sx={{alignContent: "top", justifyContent: "center", textAlign: "top", alignSelf: "center" }}>
                                                
                        <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", padding: 0}}>
                            <Tooltip placement="top" title={`Update core app info & settings`}>
                                <IconButton onClick={() => {}}>
                                    <BuildCircleOutlined fontSize="medium" color="secondary"/>
                                </IconButton>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11 }}>Copy</Typography>
                        </Box>
                        
                        <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 40, marginLeft: 4, marginRight: 4 }} />
                        </Slide>

                        <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                            <Tooltip placement="top" title={`Export all buckets to a different environment`}>
                                <span>
                                    <IconButton disabled={false} onClick={() => {}}>
                                        <MoveUpOutlined fontSize="medium" color={"secondary"} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11 }}>Move</Typography>
                        </Box>

                        <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                        </Slide>

                        <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                            <Tooltip placement="top" title={`Compare`}>
                                <IconButton onClick={() => {}}>
                                    <CopyAllOutlined fontSize="medium" color="secondary"/>
                                </IconButton>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11 }}>Compare</Typography>
                        </Box>

                        <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                        </Slide>

                        <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                            <Tooltip placement="top" title={(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock`: `Lock`}>
                                <IconButton onClick={() => {}}>
                                    {(appInfo.lockedBy && appInfo.lockedBy.length > 0)
                                        ? <LockOutlined fontSize="medium" sx={{ color: SPECIAL_RED_COLOR}} />
                                        : <LockOpenOutlined fontSize="medium" color="secondary"/>
                                    }
                                </IconButton>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11 }}>{(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock`: `Lock`}</Typography>
                        </Box>

                        <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                        </Slide>

                        <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                            <Tooltip placement="top" title={`Delete`}>
                                <IconButton onClick={() => {}}>
                                    <DeleteForeverOutlined fontSize="medium" color="secondary"/>
                                </IconButton>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11 }}>Delete</Typography>
                        </Box>
                        
                    </Box>

                    <Slide timeout={{ enter: 600, exit: 400 }} direction="up" in={true} container={containerRef.current}>
                        <Box sx={{ display: 'flex', alignItems: 'center'}} flexDirection={"row"}>
                            <Divider sx={{width: 10, mt: 2, mb: 2}} />
                            <Divider orientation="vertical" sx={{ml: 2, mr: 2, height:"60vh"}} />
                            <Divider sx={{width: 10, mt: 2, mb: 2}} />
                        </Box>
                    </Slide> */}





// import { useContext, useRef, useState, useEffect } from "react";
// import { useCStore } from "../../DataModels/ZuStore";




// interface TableViewComponentProps {
    
// }


// const TableViewComponent: React.FC<TableViewComponentProps> = ({  }) => {
//     const placePageTitle = useCStore((state) => state.placePageTitle);

//     useEffect(() => {
//         placePageTitle("TableView")
//     }, []);

//     return (
//         <div>Project Logs</div>
//     );
// }


// export default TableViewComponent