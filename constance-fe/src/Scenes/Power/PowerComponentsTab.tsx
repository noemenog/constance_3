import { Box, Button, Divider, IconButton, InputBase, Link, Slide, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import styled from "@emotion/styled";
import FileDropZone from "../../CommonComponents/FileDropZone";
import { FileWithPath, FileRejection, MIME_TYPES } from "@mantine/dropzone";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { Cancel, PlaylistAddCheckCircleOutlined, PlaylistAddOutlined } from "@mui/icons-material";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { useDisclosure } from "@mantine/hooks";
import { BasicKVP, BasicProperty, LoggedInUser, PropertyItem, SPDomainData } from "../../DataModels/HelperModels";
import { CONFIGITEM__Power_Components_Columns, PermissionActionEnum, PowerInfoAspectEnum, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { PowerInfo, Project } from "../../DataModels/ServiceModels";
import { replacePowerInfo, uploadPowerInfo } from "../../BizLogicUtilities/FetchData";
import { getHumanReadableByteSize } from "../../BizLogicUtilities/UtilFunctions";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import { SpButton } from "../../CommonComponents/SimplePieces";



interface PowerComponentsTabProps {

}

const PowerComponentsTab: React.FC<PowerComponentsTabProps> = ({ }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as SPDomainData;
    const project = domainData.project as Project;
    const powerInfo = domainData.powerInfo;

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const initConfigs = useSpiderStore((state) => state.initConfigs);

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [powerComponents, setPowerComponents] = useState<BasicProperty[]>([])

    const [quickFilterText, setQuickFilterText] = useState('')
    const [gridApi, setGridApi] = useState<GridApi>();
    
    const containerRef = useRef<HTMLElement>(null);  //important!


    useEffect(() => {
        placePageTitle("PowerComponents")
    }, []);


    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const columnConfigs = useMemo(() => {
        let configColProps : PropertyItem[] = initConfigs?.filter(a => a.configName === CONFIGITEM__Power_Components_Columns)?.at(0)?.configValue ?? undefined
        return configColProps;
    }, [initConfigs]);


    const columnDefinitions = useMemo(() => {
        const columnDefs: Array<ColDef | ColGroupDef> = [
            {
                headerName: "#",
                valueGetter: "node.rowIndex + 1",
                editable: false,
                minWidth: 100,
                width: 100,
                maxWidth: 100,
                resizable: false,
                sort: "asc",
            },
            {
                headerName: "Remove",
                resizable: false,
                autoHeight: true,
                minWidth: 150,
                width: 150,
                maxWidth: 150,
                sortable: false,
                editable: false,
                hide: false,
                cellRenderer: function (params: any) {
                    return (
                        <Tooltip key={`pw-tt-rem-${params.data.id}`} placement="top" title={`Delete power components entry`}>
                            <span>
                                <IconButton onClick={(e) => onRemovalAction(e, params.data)}>
                                    <Cancel fontSize="medium" sx={{color: SPECIAL_RED_COLOR }} key={`pw-rem-${params.data.id}`} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )
                },
            }
        ]
        
        if(columnConfigs && columnConfigs.length > 0) {
            let filterList = columnConfigs.filter((a: PropertyItem) => a.enabled === true && a.category.toUpperCase() === PowerInfoAspectEnum.COMPONENTS.toString().toUpperCase())
            if(filterList && filterList.length > 0) {
                for(let cProp of filterList) {
                    //NOTE: data will Be a collection of BasicProperty items with the value of each being a collection of BasicKVPs
                    
                    let colDef: ColDef = {
                        headerName: cProp.displayName,
                        valueGetter: (params) => {
                            let kvp = params.data.value.find((a: BasicKVP) => a.key === cProp.name);
                            if(kvp){
                                return kvp.value;
                            } 
                            return null;
                        },
                        valueSetter: (params) => {
                            if(params.data && params.data.value && params.data.value.length > 0){
                                if(params.data.value.every((a: BasicKVP) => a.key !== cProp.name)) {
                                    params.data.value = (params.data.value as BasicKVP[]).concat([{ key: cProp.name, value: params.newValue } as BasicKVP])
                                    return true;
                                }
                                else {
                                    for(let i = 0; i < params.data.value.length; i++) {
                                        if(params.data.value[i].key === cProp.name) {
                                            params.data.value[i].value = params.newValue;
                                            return true;
                                        }
                                    }
                                }
                            } 
                            return false;
                        },
                        rowGroup: false,
                        hide: false,
                        resizable: true,
                        filter: 'text',
                        cellDataType: 'text',
                        minWidth: 200,
                        width: 200,
                        sortable: true,
                        editable: true,
                        // sort: "asc",
                        // sortingOrder: ["asc", "desc"],
                    }
                    columnDefs.push(colDef);
                }
            }
        }
        return columnDefs;
    }, [columnConfigs]);


    function onRemovalAction(event: any, item: BasicProperty): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_POWER_COMPONENTS) === false) { return; }
        if(item && item.id && item.id.length > 0) {
            let newSet = powerComponents.filter(a => a.id !== item.id)
            setPowerComponents([...newSet]);
        }
    }


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);  
            setPowerComponents(powerInfo?.components ?? [])
        }
    }, []);



    function handleAddRow(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_POWER_COMPONENTS) === false) { return; }
        if(gridApi) {
            if(columnConfigs && columnConfigs.length > 0) {
                let newEntry : BasicProperty = {
                    id: crypto.randomUUID(),
                    name: powerComponents.length.toString(),
                    value: new Array<BasicKVP>()
                }
                for(let cProp of columnConfigs) {
                    let kvp: BasicKVP = {
                        key: cProp.name,
                        value: ''
                    };
                    (newEntry.value as BasicKVP[]).push(kvp);
                }
                let newArr = powerComponents.concat([newEntry])
                setPowerComponents([...newArr]);
                displayQuickMessage(UIMessageType.INFO_MSG, "New row is available...")
            }
        }
    }


    function handleSavePowerAspect(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_POWER_COMPONENTS) === false) { return; }
        for(let item of powerComponents) {
            if(item.value && (item.value.length > 0) && item.value.every((x: BasicKVP) => (!x.value || x.value.toString().trim().length === 0))) {
                displayQuickMessage(UIMessageType.ERROR_MSG, "Action not allowed. Please remove empty row before trying to save the data");
                return;
            }
        }
        settleAGGridCell(); //Important!
        let saveConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: (powerComponents.length > 0)
                ? `Are you sure you want to save power info for current project?`
                : `No power components in scope. Are you sure you want to clear any/all power component entries for the current project?`,
            warningText_other: "",
            actionButtonText: "Proceed",
            enableSecondaryActionButton: false,
            secondaryActionButtonText: "",
            contextualInfo:  { key: "SAVE_ACTION", value: null },
        }
        setConfirmationDialogProps(saveConfirmData)
        confirmationModalActioner.open()
    }


    async function onSuccessfulDrop(files: FileWithPath[]): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_POWER_COMPONENTS) === false) { return; }
        if(files && files.length > 0) {
            if(files[0].size > 0) {
                displayQuickMessage(UIMessageType.INFO_MSG, `File provided: '${files[0].name}'. File size: ${getHumanReadableByteSize(files[0].size)}'`)
            }
            let procKey = "PERFORM_UPLOAD";
            if(powerComponents && powerComponents.length > 0) {
                let delConfirmData: ConfirmationDialogProps = {
                    onFormClosed: onConfirmationDataAvailable,
                    title: "Please Confirm",
                    warningText_main: `Are you sure you want to import fresh Power components info?`,
                    warningText_other: "Warning! All existing Components data will be ovewritten!",
                    actionButtonText: "Proceed",
                    enableSecondaryActionButton: false,
                    secondaryActionButtonText: "",
                    contextualInfo:  { key: procKey, value: files },
                }
                setConfirmationDialogProps(delConfirmData)
                confirmationModalActioner.open()
            }
            else {
                let kvp : BasicKVP = { key: procKey, value: files }
                onConfirmationDataAvailable(ConfirmationDialogActionType.PROCEED, kvp)
            }
        }
        else{
            displayQuickMessage(UIMessageType.ERROR_MSG, "Error! Could not process file upload.")
        }
    }


    async function onFileRejected(fileRejections: FileRejection[]): Promise<void> {
        let name = fileRejections.map(a => a.file.name).at(0)
        displayQuickMessage(UIMessageType.ERROR_MSG, `File '${name}' was rejected.`)
    }



    async function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP) {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "SAVE_ACTION") {
                if(powerInfo && action === ConfirmationDialogActionType.PROCEED) {
                    let powerInfoToSave : PowerInfo;
                    if(powerInfo && powerInfo._id) {
                        powerInfoToSave = {...powerInfo} as PowerInfo
                        powerInfoToSave.components = [...powerComponents]
                    }
                    else {
                        let newPI: PowerInfo = {
                            _id: "",
                            projectId: project._id?.toString(),
                            snapshotSourceId: "",
                            contextProperties: [],
                            lastUpdatedOn: new Date(),
                            rails: [],
                            components: [...powerComponents],
                            associatedProperties: []
                        }
                        powerInfoToSave = newPI;
                    }
                    
                    replacePowerInfo(powerInfoToSave, false, true).then((updatedPowerInfo: PowerInfo) => {
                        if(updatedPowerInfo && updatedPowerInfo._id) {
                            setPowerComponents(updatedPowerInfo.components);
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Power components data update completed!`)
                        }
                    })                
                }
            }
            else if(contextualInfo.key === "PERFORM_UPLOAD") {
                if(action === ConfirmationDialogActionType.PROCEED) {
                    let files: FileWithPath[] = contextualInfo.value
                    if(files && files.length > 0) {
                        let resultPowerInfo : PowerInfo = await uploadPowerInfo(files[0], project?._id?.toString() as string, PowerInfoAspectEnum.COMPONENTS)
                        if(resultPowerInfo) {
                            setPowerComponents(resultPowerInfo.components)
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Power components upload process completed")
                        }
                    }
                }
            }
        }
    }


    function settleAGGridCell() {
        if(gridApi) {
            //https://www.ag-grid.com/javascript-data-grid/grid-api/#reference-editing-stopEditing
            gridApi.stopEditing(); 
            
            //https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/blur
            (document.activeElement as any)?.blur()
        }
    }





    return (
        <Box flexDirection="column" alignItems="center" mt={2} >
            <FileDropZone 
                height={70} 
                acceptableMimeTypes={[MIME_TYPES.csv]}
                onSuccessfulDrop={onSuccessfulDrop} 
                onFileRejected={onFileRejected} 
                multipleFilesAllowed={false}
                showAcceptedTypesInUI={false}
            />

            <Box ref={containerRef}>
                <Box flexDirection="column" alignItems="center">
                    <Slide direction="left" in={true} container={containerRef.current}>
                        <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"100%", m: "1px"}}>
                            <SpButton
                                intent="plain"
                                onClick={handleAddRow}
                                startIcon={<PlaylistAddOutlined />}
                                sx={{ m: 1, width:150 }}
                                label="Add Row" />
                            
                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />
                        
                            <SpButton
                                intent="plain"
                                onClick={handleSavePowerAspect}
                                startIcon={<PlaylistAddCheckCircleOutlined />}
                                sx={{ m: 1, width:150 }}
                                label="Save Components" />

                        </Box>
                    </Slide>
                    <div style={{ height: "66vh" }}>
                        <AgGridReact
                            rowData={powerComponents ?? []}
                            animateRows={true}
                            columnDefs={columnDefinitions}
                            defaultColDef={defaultColDef}
                            onGridReady={onGridReady}
                            theme={themeDarkBlue}
                            rowSelection={{ mode: "singleRow", checkboxes: false }}
                            suppressExcelExport={true}
                            suppressCsvExport={false}
                            groupDisplayType='singleColumn'
                            groupDefaultExpanded={0}
                            quickFilterText={quickFilterText}
                            rowHeight={33}
                            headerHeight={28}
                        />
                    </div>
                </Box>

                {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
                
            </Box>
            
        </Box>
    );
}

export default PowerComponentsTab





// import { Box, Button, Divider, IconButton, InputBase, Link, Typography } from "@mui/material";
// import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
// import { ColorModeContext, agTheme, tokens } from "../../theme";
// import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
// import { useTheme } from "@mui/material/styles";
// import { useLocation, useNavigate } from "react-router-dom";
// import { AgGridReact } from "ag-grid-react";
// import { ColDef, ColGroupDef, GridApi, GridOptions, ICellRendererParams, SuppressKeyboardEventParams, ValueFormatterParams } from 'ag-grid-community';
// import styled from "@emotion/styled";
// import FileDropZone from "../../CompPieceUtilities/FileDropZone";
// import { FileWithPath, FileRejection } from "@mantine/dropzone";
// import { useSpiderStore } from "../../DataModels/ZuStore";
// import { PowerInfo, Project } from "../../DataModels/ServiceModels";



// interface PowerComponentsTabProps {
//     powerInfo: PowerInfo|null
//     project: Project
// }

// const PowerComponentsTab: React.FC<PowerComponentsTabProps> = () => {
//     const theme = useTheme();
//     const colors = tokens(theme.palette.mode);

//     const placePageTitle = useSpiderStore((state) => state.placePageTitle);

//     useEffect(() => {
//         placePageTitle("PowerComponents")
//     }, []);

//     const defaultColDef = useMemo(() => {
//         return {
//             flex: 1,
//         };
//     }, []);

//     const autoGroupColumnDef = {
//         flex: 1,
//         minWidth: 190,
//         width: 190,
//         cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
//     }


//       const columnDefs: Array<ColDef | ColGroupDef> = [
//         {
//             headerName: "Region",
//             field: "region",
//             rowGroup: false,
//             hide: false,
//             resizable: true,
//             filter: 'text',
//             cellDataType: 'text',
//             minWidth: 200,
//             // autoHeight: true,
//             sort: "asc",
//             sortable: true,
//             editable: false,
//             sortingOrder: ["asc", "desc"],
//             cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
//         },
//         {
//             headerName: "Layer",
//             field: 'layerName',
//             rowGroup: false,
//             hide: false,
//             resizable: true,
//             filter: 'text',
//             cellDataType: 'text',
//             minWidth: 120,
//             width: 120,
//             sort: "asc",
//             sortable: true,
//             editable: false,
//             sortingOrder: ["asc", "desc"],
//             cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
//         },
//         {
//             headerName: "Constraint Type",
//             field: 'constraintType',
//             rowGroup: false,
//             hide: false,
//             resizable: true,
//             filter: 'text',
//             cellDataType: 'text',
//             minWidth: 120,
//             width: 120,
//             sort: "asc",
//             sortable: true,
//             editable: false,
//             sortingOrder: ["asc", "desc"],
//             cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
//         },
//         {
//             headerName: "Rule Name",
//             field: 'ruleString',
//             rowGroup: false,
//             hide: false,
//             resizable: true,
//             filter: 'text',
//             cellDataType: 'text',
//             minWidth: 120,
//             width: 120,
//             sort: "asc",
//             sortable: true,
//             editable: false,
//             sortingOrder: ["asc", "desc"],
//             cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
//         },
//         {
//             headerName: "Value",
//             field: 'value',
//             rowGroup: false,
//             hide: false,
//             resizable: true,
//             filter: 'text',
//             cellDataType: 'text',
//             minWidth: 120,
//             width: 120,
//             sort: "asc",
//             sortable: true,
//             editable: false,
//             sortingOrder: ["asc", "desc"],
//             cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
//         },
        
//     ];
    
    
//     const onGridReady = useCallback((params: any) => {
//         // (params.api as GridApi).sizeColumnsToFit();
//     }, []);
    

    
//     async function onSuccessfulDrop(files: FileWithPath[]): Promise<void> {
//         console.log("Function not implemented.");
//         //TODO: make sure to still check the file extension
//     }

//     async function onFileRejected(fileRejections: FileRejection[]): Promise<void> {
//         console.log("Function not implemented.");
//     }

//     return (
//         <Box flexDirection="column" alignItems="center" mt={2} >
//             <FileDropZone 
//                 height={70} 
//                 acceptableMimeTypes={[]} 
//                 theme={theme} 
//                 onSuccessfulDrop={onSuccessfulDrop} 
//                 onFileRejected={onFileRejected} />

//             <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"100%", m: "1px"}}>
//                 <Button
//                     key={`xx-1`}
//                     size="small"
//                     variant="outlined"
//                     startIcon={<PlaylistAddOutlinedIcon />}
//                     sx={{ backgroundColor: colors.blueAccent[400], width:180 }}>
//                     Push Defaults
//                 </Button>
                
//                 <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />
                
//                 <Button
//                     key={`save-1`}
//                     size="small"
//                     variant="outlined"
//                     startIcon={<PlaylistAddOutlinedIcon />}
//                     sx={{ backgroundColor: colors.blueAccent[400], width:180 }}>
//                     Manage Discrepancies
//                 </Button>
//             </Box>
//             <div className={agTheme(theme.palette.mode)} style={{ height: "66vh" }}>
                
//                 <AgGridReact
//                     rowData={[]}
//                     animateRows={true}
//                     columnDefs={columnDefs}
//                     defaultColDef={defaultColDef}
//                     autoGroupColumnDef={autoGroupColumnDef}
//                     onGridReady={onGridReady}
//                     rowSelection={'multiple'}
//                     suppressExcelExport={false}
//                     suppressCsvExport={false}   
//                     groupDisplayType='singleColumn'    
//                     groupDefaultExpanded={1}
//                     rowHeight={25}
//                     headerHeight={28}
//                 />
//             </div>
            
//         </Box>
//     );
// }

// export default PowerComponentsTab
