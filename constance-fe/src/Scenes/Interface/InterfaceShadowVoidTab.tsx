import { Box, Button, Divider, IconButton, Slide, Tooltip } from "@mui/material";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { themeDarkBlue, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi, RowStyle } from "ag-grid-community";
import { Cancel, Check, CloudDownload, DownloadForOfflineOutlined, PlaylistAddCheckCircleOutlined, PlaylistAddOutlined } from "@mui/icons-material";
import { Interface, Project } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { CONFIGITEM__Shadow_Void_Columns, PermissionActionEnum, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { BasicKVP, BasicProperty, LoggedInUser, PropertyItem } from "../../DataModels/HelperModels";
import { useDisclosure } from "@mantine/hooks";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { updateInterface } from "../../BizLogicUtilities/FetchData";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import { SpButton } from "../../CommonComponents/SimplePieces";



interface InterfaceShadowVoidTabProps {
    iface: Interface|null,
    project: Project
}

const InterfaceShadowVoidTab: React.FC<InterfaceShadowVoidTabProps> = ({ iface, project }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const initConfigs = useSpiderStore((state) => state.initConfigs);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);

    const [gridApi, setGridApi] = useState<GridApi>();
    const [quickFilterText, setQuickFilterText] = useState('')

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

    const [shadowVoids, setShadowVoids] = useState<BasicProperty[]>(iface?.shadowVoidEntries ?? [])

    const containerRef = useRef<HTMLElement>(null);  //important!


    useEffect(() => {
        placePageTitle("InterfaceShadowVoid")
    }, []);


    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const columnConfigs = useMemo(() => {
        let sVoidConfigColProps : PropertyItem[] = initConfigs?.filter(a => a.configName === CONFIGITEM__Shadow_Void_Columns)?.at(0)?.configValue ?? undefined
        return sVoidConfigColProps;
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
                        <Tooltip key={`tt-rem-${params.data.id}`} placement="top" title={`Delete ShadowVoid entry'`}>
                            <span>
                                <IconButton onClick={(e) => onRemovalAction(e, params.data)}>
                                    <Cancel fontSize="medium" sx={{color: SPECIAL_RED_COLOR }} key={`sv-rem-${params.data.id}`} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )
                },
            }
        ]
        
        if(columnConfigs && columnConfigs.length > 0) {
            let filterList = columnConfigs.filter((a:PropertyItem) => a.enabled === true)
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
                                for(let i = 0; i < params.data.value.length; i++) {
                                    if(params.data.value[i].key === cProp.name) {
                                        params.data.value[i].value = params.newValue;
                                        return true;
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


    function onRemovalAction(event: any, sVoid: BasicProperty): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_SHADOWVOID) === false) { return; }
        if(sVoid && sVoid.id && sVoid.id.length > 0) {
            let newSet = shadowVoids.filter(a => a.id !== sVoid.id)
            setShadowVoids([...newSet]);
        }
    }


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);   
        }
    }, []);



    function handleAddRow(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_SHADOWVOID) === false) { return; }
        if(gridApi) {
            if(columnConfigs && columnConfigs.length > 0) {
                let newEntry : BasicProperty = {
                    id: crypto.randomUUID(),
                    name: shadowVoids.length.toString(),
                    value: new Array<BasicKVP>()
                }
                for(let cProp of columnConfigs) {
                    let kvp: BasicKVP = {
                        key: cProp.name,
                        value: ''
                    };
                    (newEntry.value as BasicKVP[]).push(kvp);
                }
                let newArr = shadowVoids.concat([newEntry])
                setShadowVoids([...newArr]);
                displayQuickMessage(UIMessageType.INFO_MSG, "New row is available...")
            }
        }
    }


    function handleSaveShadowVoid(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_SHADOWVOID) === false) { return; }
        for(let item of shadowVoids) {
            if(item.value && (item.value.length > 0) && item.value.every((x: BasicKVP) => (!x.value || x.value.toString().trim().length === 0))) {
                displayQuickMessage(UIMessageType.ERROR_MSG, "Action not allowed. Please remove empty row before trying to save the data");
                return;
            }
        }
        settleAGGridCell(); //Important!
        let saveConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Are you sure you want to save shadow-void entries for interface '${iface?.name ?? ''}' ?`,
            warningText_other: "",
            actionButtonText: "Proceed",
            enableSecondaryActionButton: false,
            secondaryActionButtonText: "",
            contextualInfo:  { key: "Save_Action", value: null },
        }
        setConfirmationDialogProps(saveConfirmData)
        confirmationModalActioner.open()
    }


    function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): void {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "Save_Action") {
                if(iface && action === ConfirmationDialogActionType.PROCEED) {
                    let ifaceToSave : Interface = {...iface} as Interface
                    ifaceToSave.shadowVoidEntries = [...shadowVoids]
                    setLoadingSpinnerCtx({enabled: true, text: `Updatinging interface shadow voids. Please wait...`})
                    updateInterface(ifaceToSave, true).then((updatedIface: Interface) => {
                        if(updatedIface && updatedIface._id) {
                            setShadowVoids(updatedIface.shadowVoidEntries);
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `ShadowVoid data update completed!`)
                        }
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``})
                    })               
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
                            onClick={handleSaveShadowVoid}
                            startIcon={<PlaylistAddCheckCircleOutlined />}
                            sx={{ m: 1, width:150 }}
                            label="Save Data" />

                    </Box>
                </Slide>
                <div style={{ height: "72vh" }}>
                    <AgGridReact
                        rowData={shadowVoids ?? []}
                        animateRows={true}
                        columnDefs={columnDefinitions}
                        defaultColDef={defaultColDef}
                        onGridReady={onGridReady}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={false}
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
    );
}

export default InterfaceShadowVoidTab;



