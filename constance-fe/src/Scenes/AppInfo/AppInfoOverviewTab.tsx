import { Autocomplete, Box, Button, Card, Divider, Grid, IconButton, Link, Paper, Slide, Table, TableBody, TableCell } from "@mui/material"; 
import { TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { PeoplePicker } from "@microsoft/mgt-react";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { themeDarkBlue, tokens } from "../../theme";
import { BuildCircleOutlined, Cancel, CopyAllOutlined, DeleteForeverOutlined, LockOpenOutlined, LockOutlined, MoveUpOutlined, PublishedWithChangesOutlined } from "@mui/icons-material";
import { Text, Timeline } from "@mantine/core";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi, NewValueParams } from "ag-grid-community";
import { convertUTCToLocalDateTimeString, getDateAppendedName, getEnumValuesAsArray, getEnviList, rfdcCopy, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { useDisclosure } from "@mantine/hooks";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { ActionSceneEnum, NamingContentTypeEnum, SPECIAL_RED_COLOR, UIMessageType, SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, EnvTypeEnum, BASIC_NAME_VALIDATION_REGEX, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_GOLD_COLOR, PermEntityTypeEnum } from "../../DataModels/Constants";
import { BasicKVP, BasicProperty, PropertyItem, CDomainData, DisplayOption, ServiceModel } from "../../DataModels/ServiceModels";
import { AppInfo, Bucket } from "../../DataModels/ServiceModels";
import { useCStore } from "../../DataModels/ZuStore";
import { LoadingSpinnerInfo, LoggedInUser, QuickStatus } from "../../DataModels/ServiceModels";
import { deletePermissionElements, handleLockAction, isUserApprovedForCoreAction, setupPermissionsForNewElement } from "../../BizLogicUtilities/Permissions";
import { addBucketList, cloneAppInfo, cloneBucket, deleteAppInfo, deleteBucket, exportAll, exportBucket, fetchAppDetails, getBucketList, updateAppInfo, updateBucket } from "../../BizLogicUtilities/FetchData";
import { MultiTextEntryField } from "../../CommonComponents/MultiTextEntryField";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import { sort } from "fast-sort";





interface AppInfoOverviewTabProps {
    
}

const AppInfoOverviewTab: React.FC<AppInfoOverviewTabProps> = ({  }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as CDomainData;
    const buckets = domainData.bucketList;
    const appObj = domainData.appInfo as AppInfo;

    const placePageTitle = useCStore((state) => state.placePageTitle);
    const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
    const setLoggedInUser = useCStore((state) => state.setLoggedInUser);
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
    const clearCurrentAppInfo = useCStore((state) => state.clearCurrentAppInfo);
    const initConfigs = useCStore((state) => state.initConfigs);
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment);
    const setSelectedBucket = useCStore((state) => state.setSelectedBucket);

    const [appInfo, setAppInfo] = useState<AppInfo>(appObj);
    const [bucketList, setBucketList] = useState<Bucket[]>([]);

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()

    const containerRef = useRef<any>();

    const [gridApi, setGridApi] = useState<GridApi>();

    
    
    useEffect(() => {
        placePageTitle("AppOverview")
    }, []);


    
    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const autoGroupColumnDef = {
        minWidth: 200,
        width: 200,
        maxWidth: 300,
        resizable: true,
        cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
    }



    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "Actions",
            resizable: true,
            minWidth: 130,
            width: 130,
            maxWidth: 140,
            sortable: false,
            editable: false,
            cellStyle: (params: any) => { return { marginLeft: -5, fontWeight : 'normal', display: "flex", alignItems: "center"} },
            cellRenderer: function(params: any) {
                return (
                    <Box  key={`lg-rem-${params.data.name}`} sx={{display: "flex", flexDirection: "row"}} gap={1}>
                        <Tooltip sx={{padding: "0px"}} key={`tt1-${params.data.name}`} placement="right" title={`Export bucket: '${params.data.name}'`}>
                            <span>
                                <IconButton size="small" onClick={(e) => {performExportBucketAction(params.data)}}>
                                    <MoveUpOutlined sx={{height: 22, padding: 0}} color="secondary" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip sx={{padding: "0px"}} key={`tt2-${params.data.name}`} placement="right" title={`Create copy of bucket: '${params.data.name}'`}>
                            <span>
                                <IconButton size="small" onClick={(e) => {performCloneBucketAction(params.data)}}>
                                    <CopyAllOutlined sx={{height: 22, padding: 0, color: SPECIAL_GOLD_COLOR}} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip sx={{padding: "0px"}} key={`tt3-${params.data.name}`} placement="right" title={`Delete bucket: '${params.data.name}'`}>
                            <span>
                                <IconButton size="small" onClick={(e) => {performDeleteBucketAction(params.data)}}>
                                    <Cancel sx={{height: 22, padding: 0, color: SPECIAL_RED_COLOR}} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                )
            },            
        },
        {
            headerName: "Bucket Name",
            field: "name",
            resizable: true,
            filter: 'text',
            minWidth: 200,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
            onCellValueChanged: (event: NewValueParams<any, any>) => { 
                handleBucketListSave(event.data); 
            },
            cellRenderer: function(params: any) {
                let agGridFocusItemNameLinkColor = theme.palette.mode === 'dark' ? "#99ccff" : "#0000EE"
                let agGridFocusItemNameLinkColorHover = theme.palette.mode === 'dark' ? "#66b3ff" : "#0000EE"
                return (
                    <Link 
                        sx={{fontSize: 14, color: agGridFocusItemNameLinkColor, ':hover': { fontWeight: 'bold', color: agGridFocusItemNameLinkColorHover }}} 
                        onClick={() => onBucketSelected(params.data)} 
                        underline="hover">
                        {params.value}
                    </Link>
                )
            }
        },
        {
            headerName: "Bucket ID",
            field: "_id",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            sortable: false,
            sortingOrder: ["asc", "desc"],
            valueGetter: (params) => {
                return params.data._id.toString() as string;
            },
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Created By",
            field: "createdBy",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Created On",
            field: "createdOn",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Description",
            field: "description",
            flex: 1,
            minWidth: 150,
            rowGroup: false,
            hide: false,
            resizable: true,
            sortable: false,
            cellEditor: 'agLargeTextCellEditor',
            cellEditorPopup: true,
            editable: true,
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
            cellEditorParams: {
                maxLength: 260
            },
            onCellValueChanged: (event: NewValueParams<any, any>) => { 
                handleBucketListSave(event.data) 
            }
        },
        {
            headerName: "Environments",
            field: "env",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            sortable: false,
            sortingOrder: ["asc", "desc"],
            valueGetter: (params) => {
                return getEnviList(params.data as Bucket)?.envListShortSingleString || '';
            },
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Perm",
            field: "description",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        
    ];
    

    const onGridReady = useCallback((params: any) => {
        setGridApi(params.api as GridApi);
        if(buckets && buckets.length > 0) {
            setBucketList(buckets);
        }
    }, []);
    

    function onBucketSelected(bucket: Bucket): void {
        if(bucket && bucket._id && bucket._id.length > 0) {
            setSelectedBucket(bucket)
            navigate(`/${ActionSceneEnum.CONFIGURATIONS}/${appInfo._id.toString()}/${selectedEnvironment}/${bucket._id.toString()}`); 
        }
    }


    function performExportBucketAction(bucket: Bucket): void {
        //___PERM___ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Please select source & destination for bucket export",
            showSelectionCtrl: true, 
            showSecondarySelection: true,
            selectionLabel: "Source Environment",
            secondarySelectionLabel: "Destination Environment",
            selectionCtrlOptions: Array.from(getEnumValuesAsArray(EnvTypeEnum)),
            contextualInfo: { key: "EXPORT_BUCKET", value: bucket }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }


    function performCloneBucketAction(bucket: Bucket): void {
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Please enter a name for bucket instance",
            showTextMainCtrl: true,
            textMainLabel: "New Bucket Name",
            textMainDefaultValue: `${bucket.name}_Copy`,
            contextualInfo: { key: "CLONE_BUCKET", value: bucket }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }

    
    function performDeleteBucketAction(bucket: Bucket): void {
        //__PERM__ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.DELETE_APPINFO) === false) { return; }
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Please select environment where app presence will be removed",
            showSelectionCtrl: true, 
            selectionLabel: "Environment",
            selectionCtrlOptions: (getEnviList(appInfo).envListRawFormatArray ?? []).filter((a: string) => a.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase()).concat("ALL"),
            contextualInfo: { key: "DELETE_BUCKET", value: bucket }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }





    function handleProfileChangeAction(): void {
        //___PERM___ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Application Info",
            textMainLabel: "Update App Name", 
            textMainDefaultValue: appInfo.name, 
            largeTextLabel: "Update App Description",
            largeTextDefaultValue: appInfo.description,
            largeTextAreaMinCharLength: 15,
            largeTextAreaValueRequired: true,
            showTextMainCtrl: true,
            showLargeTextCtrl: true,
            contextualInfo: { key: "UPDATE_APP_INFO", value: null }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }

    
    function handleExportALLAction(event: any): void {
        //___PERM___ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Please select export source & destination",
            showSelectionCtrl: true, 
            showSecondarySelection: true,
            selectionLabel: "Source Environment",
            secondarySelectionLabel: "Destination Environment",
            selectionCtrlOptions: Array.from(getEnumValuesAsArray(EnvTypeEnum)),
            contextualInfo: { key: "EXPORT_ALL_FOR_APPINFO", value: null }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }


    function handleCloneAppAction(event: any): void {
        //___PERM___ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Please enter a name for app instance",
            showTextMainCtrl: true,
            textMainLabel: "New AppInfo Name",
            textMainDefaultValue: `${appInfo.name}_Copy`,
            contextualInfo: { key: "CLONE_APPINFO", value: null }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }


    function handleDeleteAppAction(event: any): void {
        //__PERM__ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.DELETE_APPINFO) === false) { return; }
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Please select environment where app presence will be removed",
            showSelectionCtrl: true, 
            selectionLabel: "Environment",
            selectionCtrlOptions: (getEnviList(appInfo).envListRawFormatArray ?? []).filter((a: string) => a.toLowerCase() !== EnvTypeEnum.DEVELOPMENT.toLowerCase()).concat("ALL"),
            contextualInfo: { key: "DELETE_APPINFO", value: null }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }



    async function onGenInfoDataAvailable(data: GeneralInfoUIContext | null): Promise<void> {
        if(data && data.contextualInfo) {
            if(data.contextualInfo.key === "UPDATE_APP_INFO") {
                let name = data?.textMain?.trim()
                let desc = data?.largeText?.trim()
                if(name && name.length > 0 && desc && desc.length > 0) {
                    try { verifyNaming([name], NamingContentTypeEnum.APPINFO) }
                    catch (e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    let updApp = rfdcCopy<AppInfo>(appInfo as AppInfo) as AppInfo
                    updApp.name = name;
                    updApp.description = desc;
                    
                    setLoadingSpinnerCtx({enabled: true, text: "Now creating new app context. Please wait..."} as LoadingSpinnerInfo)      
                    let updatedAppInfo = await updateAppInfo(EnvTypeEnum.DEVELOPMENT, updApp).finally(() => { cancelLoadingSpinnerCtx() })
                    if(updatedAppInfo) {
                        setAppInfo(updatedAppInfo)
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "AppInfo updated successfully!");
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to successfully update app info!");
                    }
                }
            }
            else if(data.contextualInfo.key === "EXPORT_ALL_FOR_APPINFO") {
                let srcEnv = data?.selection
                let destEnv = data?.secondarySelection
                if(srcEnv && srcEnv.length > 0 && destEnv && destEnv.length > 0) {

                    setLoadingSpinnerCtx({enabled: true, text: `Now exporting all configurations from source environment '${srcEnv}' to destination environment '${destEnv}'. Please wait...`})
                    let res = await exportAll(selectedEnvironment, appInfo._id.toString(), srcEnv as EnvTypeEnum, destEnv as EnvTypeEnum).finally(() => { cancelLoadingSpinnerCtx() })
                    if(res) {
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "App buckets exported successfully!");
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to successfully export app data!");
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Invalid source and/or destination selected....`)
                }
            }
            else if(data.contextualInfo.key === "DELETE_APPINFO") {
                let focusEnv = data?.selection
                if(focusEnv && focusEnv.length > 0) {
                    let appDeleteConfirmData: ConfirmationDialogProps = {
                        onFormClosed: onConfirmationDataAvailable,
                        title: "Please Confirm",
                        warningText_main: `Please confirm deletion of app '${appInfo.name}'`,
                        warningText_other: `WARNING: App data cannot be recovered after deletion. Are you sure you want to completely delete this app?`,
                        actionButtonText: "Proceed",
                        contextualInfo: { key: "DELETE_APPINFO_PROCEED", value: focusEnv },
                    }
                    setConfirmationDialogProps(appDeleteConfirmData)
                    confirmationModalActioner.open()
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Invalid deletion environment selected....`)
                }
            }
            else if(data.contextualInfo.key === "CLONE_APPINFO") {
                let newName = data?.textMain?.trim()
                if(newName && newName.length > 0) {
                    try {
                        verifyNaming([newName], NamingContentTypeEnum.APPINFO)
                    }
                    catch(e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    setLoadingSpinnerCtx({enabled: true, text: "Now creating a clone/copy of current app info. Please wait..."} as LoadingSpinnerInfo)
                    let clonedAppInfo = await cloneAppInfo(selectedEnvironment, appInfo._id.toString() as string, newName).finally(() => { cancelLoadingSpinnerCtx() })
                    if(clonedAppInfo) {
                        let res = await setupPermissionsForNewElement(loggedInUser, clonedAppInfo, PermEntityTypeEnum.APP, true)
                        if (res[0] === true) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Cloning process completed!");
                            clearCurrentAppInfo();
                            navigate(`/${ActionSceneEnum.APPHOME}/${clonedAppInfo._id}/overview`)
                        }
                        else {
                            //for good measures...
                            deleteAppInfo(EnvTypeEnum.DEVELOPMENT, clonedAppInfo, "ALL");
                            displayQuickMessage(UIMessageType.ERROR_MSG, "App cloning failed!");
                        }
                    }
                }
            }
            else if(data.contextualInfo.key === "EXPORT_BUCKET") {
                let srcEnv = data?.selection
                let destEnv = data?.secondarySelection
                let bucket = data.contextualInfo.value;
                if(bucket && bucket._id && srcEnv && srcEnv.length > 0 && destEnv && destEnv.length > 0) {
                    setLoadingSpinnerCtx({enabled: true, text: `Now exporting all configurations from source environment '${srcEnv}' to destination environment '${destEnv}'. Please wait...`})
                    let res = await exportBucket(selectedEnvironment, bucket._id.toString(), srcEnv as EnvTypeEnum, destEnv as EnvTypeEnum).finally(() => { cancelLoadingSpinnerCtx() })
                    if(res) {
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Bucket exported successfully!");
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to successfully export bucket!");
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Invalid source and/or destination selected....`)
                }
            }
            else if(data.contextualInfo.key === "DELETE_BUCKET") {
                let focusEnv = data?.selection
                let bucket : Bucket = data.contextualInfo.value;
                if(focusEnv && focusEnv.length > 0) {
                    let appDeleteConfirmData: ConfirmationDialogProps = {
                        onFormClosed: onConfirmationDataAvailable,
                        title: "Please Confirm",
                        warningText_main: `Please confirm deletion of bucket '${bucket.name}'`,
                        warningText_other: `WARNING: Bucket data might not be recovered after deletion. Are you sure you want to completely delete this bucket?`,
                        actionButtonText: "Proceed",
                        contextualInfo: { key: "DELETE_BUCKET_PROCEED", value: { focusEnv: focusEnv, bucket: bucket } },
                    }
                    setConfirmationDialogProps(appDeleteConfirmData)
                    confirmationModalActioner.open()
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Invalid deletion environment selected....`)
                }
            }
            else 
                if(data.contextualInfo.key === "CLONE_BUCKET") {
                let newName = data?.textMain?.trim()
                if(newName && newName.length > 0) {
                    let bucket = data.contextualInfo.value;
                    try {
                        verifyNaming([newName], NamingContentTypeEnum.BUCKET)
                    }
                    catch(e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    setLoadingSpinnerCtx({enabled: true, text: "Now creating a clone/copy of bucket. Please wait..."} as LoadingSpinnerInfo)
                    let clonedBucket = await cloneBucket(selectedEnvironment, bucket._id.toString() as string, newName).finally(() => { cancelLoadingSpinnerCtx() })
                    if(clonedBucket) {
                        let res = await setupPermissionsForNewElement(loggedInUser, clonedBucket, PermEntityTypeEnum.BUCKET, true)
                        if (res[0] === true) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Cloning process completed!");
                            getBucketList(selectedEnvironment, appInfo._id.toString()).then(buckRes => {
                                if(buckRes) {
                                    let sortedBucks = sort(buckRes).asc(a => a.name)
                                    setBucketList(sortedBucks);
                                }
                            })
                        }
                        else {
                            //for good measures...
                            deleteBucket(EnvTypeEnum.DEVELOPMENT, clonedBucket, "ALL");
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Bucket cloning failed!");
                        }
                    }
                }
            }
            
        }
    }

    
    async function onConfirmationDataAvailable(proceed: ConfirmationDialogActionType, contextualInfo: any): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(proceed === ConfirmationDialogActionType.PROCEED) {
                if(contextualInfo.key === "DELETE_APPINFO_PROCEED") {
                    let focusEnv = contextualInfo.value
                    if(focusEnv && focusEnv.length > 0) {
                        setLoadingSpinnerCtx({enabled: true, text: `Now deleting app presence from '${focusEnv}' environment(s). Please wait...`})
                        let remainingEnvList = await deleteAppInfo(selectedEnvironment, appInfo, focusEnv).finally(() => { cancelLoadingSpinnerCtx() })
                        
                        if(!remainingEnvList || (remainingEnvList.length === 0)) {
                            setLoadingSpinnerCtx({enabled: true, text: "Now deleting roles and permissions for AppInfo instance. Please wait..."} as LoadingSpinnerInfo)
                            let permActionResult : QuickStatus<any> = await deletePermissionElements(appInfo, PermEntityTypeEnum.APP)
                            if(permActionResult.isSuccessful === false) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
                            }
                            else {
                                displayQuickMessage(UIMessageType.SUCCESS_MSG, `App permissions removal operations have completed.`);
                                if(bucketList && bucketList.length > 0) {
                                    try {
                                        setLoadingSpinnerCtx({enabled: true, text: "Now deleting roles and permissions for AppInfo buckets. Please wait..."} as LoadingSpinnerInfo)
                                    
                                        let promList = bucketList.map(buck => deletePermissionElements(buck, PermEntityTypeEnum.BUCKET) )
                                        const results = await Promise.all(promList);
                                        
                                        let hasError = false;

                                        results.forEach((buckPermActionResult: QuickStatus<any>) => {
                                            if(buckPermActionResult.isSuccessful === false) {
                                                console.error(`${buckPermActionResult.message}`);
                                                hasError = true;
                                            }
                                        });

                                        if (hasError) {
                                            displayQuickMessage(UIMessageType.ERROR_MSG, `One or more errors occurred while deleting bucket permissions. Please review console log for details.`);
                                        }
                                        else {
                                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Bucket permissions removal operations have completed.`);
                                        }                                
                                    }
                                    catch(err: any) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `An error occurred while deleting bucket permissions. Permissions deleted due to AppInfo removal operation`);
                                    }
                                    finally {
                                        cancelLoadingSpinnerCtx();
                                    }
                                }
                            }

                            clearCurrentAppInfo();
                            navigate(`/list`); 
                        }
                        else {
                            navigate(`/${ActionSceneEnum.APPHOME}/${appInfo._id}/overview`); 
                        }
                    }
                    
                }
                else if(contextualInfo.key === "DELETE_BUCKET_PROCEED") {
                    let focusEnv = contextualInfo.value.focusEnv;
                    let bucket : Bucket = contextualInfo.value.bucket;
                    if(bucket && bucket._id && focusEnv && focusEnv.length > 0) {
                        setLoadingSpinnerCtx({enabled: true, text: `Now deleting bucket presence from '${focusEnv}' environment(s). Please wait...`})
                        let remainingEnvList = await deleteBucket(selectedEnvironment, bucket, focusEnv).finally(() => { cancelLoadingSpinnerCtx() })
                        
                        if(!remainingEnvList || (remainingEnvList.length === 0)) {
                            setLoadingSpinnerCtx({enabled: true, text: "Now deleting roles and permissions for bucket instance. Please wait..."} as LoadingSpinnerInfo)
                            let permActionResult : QuickStatus<any> = await deletePermissionElements(bucket, PermEntityTypeEnum.BUCKET).finally(() => { cancelLoadingSpinnerCtx() })
                            if(permActionResult.isSuccessful === false) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
                            }
                            else {
                                displayQuickMessage(UIMessageType.SUCCESS_MSG, `Bucket permissions removal operations have completed.`);
                                fetchAppDetails(selectedEnvironment, appInfo._id.toString(), false).then(appRes => {
                                    if(appRes && appRes._id) {
                                        setAppInfo(appRes);
                                        getBucketList(selectedEnvironment, appInfo._id.toString()).then(buckRes => {
                                            if(buckRes) {
                                                let sortedBucks = sort(buckRes).asc(a => a.name)
                                                setBucketList(sortedBucks);
                                            }
                                        })
                                    }
                                })
                            }
                        }
                        
                    }
                    
                }
            }
        }
    }


    async function handleAppLockAndUnlockAction(event: any): Promise<void> {
        let updatedApp = await handleLockAction(appInfo, loggedInUser)
        if(updatedApp && updatedApp._id) {
            setAppInfo(updatedApp)
        }
    }

    
    
    function onBucketsAdded(items: DisplayOption[]): void {
        // if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.ADD_BUCKET) === false) { return; }
        if(items && items.length > 0) {
            let existingNames = bucketList.map(a => a.name.toLowerCase().trim()) ?? []
            let checkRes = items.some(a => existingNames.includes(a.label.toLowerCase().trim()))
            if(checkRes === true) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `One or more added bucket name already exists for current app. Duplicate names are not allowed`)
                return;
            }
            
            if(items.some(a => appInfo.name.trim().toLowerCase() === a.label.trim().toLowerCase())) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Bucket name cannot be same as app name. Please choose another name.`)
                return;
            }

            let itemNames = items.map(a => a.label.trim())
            try { verifyNaming(itemNames, NamingContentTypeEnum.BUCKET) }
            catch(e: any){
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }

            let bucks = rfdcCopy<Bucket>(bucketList as Bucket[]) as Bucket[]
            for(let i = 0; i < items.length; i++) {
                let newBuck: Bucket = {
                    _id: crypto.randomUUID(),
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    ownerElementId: appInfo._id.toString(),
                    name: items[i].label,
                    description: "",
                    createdOn: new Date(),
                    createdBy: loggedInUser.email,
                    associatedProperties: []
                }
                bucks.push(newBuck);
            }

            setLoadingSpinnerCtx({enabled: true, text: `Adding buckets. Please wait...`})
            addBucketList(selectedEnvironment, bucks).then(async (addedBuckets: Bucket[]) => {
                if(addedBuckets && addedBuckets.length > 0) {
                    try {
                        setLoadingSpinnerCtx({enabled: true, text: "Now adding roles and permissions for new bucket(s). Please wait..."} as LoadingSpinnerInfo)
                    
                        let promList = addedBuckets.map(buck => setupPermissionsForNewElement(loggedInUser, buck, PermEntityTypeEnum.BUCKET, false))
                        const results = await Promise.all(promList);
                        
                        let hasError = false;
                        let delList = new Set<Bucket>();

                        results.forEach((resInst: [boolean, AppInfo|Bucket]) => {
                            if(resInst[0] === false) {
                                console.error(`Failed to set up permissions for new bucket ${resInst[1].name}.`);
                                hasError = true;
                                delList.add(resInst[1]);
                            }
                        });

                        if (hasError) {
                            displayQuickMessage(UIMessageType.ERROR_MSG, `One or more errors occurred while setting up bucket permissions. Please review console log for details.`);
                            if(delList.size > 0) {
                                Array.from(delList).forEach(buck => deleteBucket(EnvTypeEnum.DEVELOPMENT, buck, "ALL"));
                            }
                        }
                        else {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Bucket(s) have been added. Bucket permission setup operations have completed.`);
                        }                                
                    }
                    catch(err: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `An error occurred while setting up bucket permissions. Permissions deleted due to AppInfo removal operation`);
                    }
                    finally {
                        cancelLoadingSpinnerCtx();
                    }
                    
                    fetchAppDetails(selectedEnvironment, appInfo._id.toString(), false).then(appRes => {
                        if(appRes && appRes._id) {
                            setAppInfo(appRes);
                            getBucketList(selectedEnvironment, appInfo._id.toString()).then(buckRes => {
                                if(buckRes) {
                                    let sortedBucks = sort(buckRes).asc(a => a.name)
                                    setBucketList(sortedBucks);
                                }
                            })
                        }
                    })
                }
            })
            .finally(() => {
                setLoadingSpinnerCtx({enabled: false, text: ``})
            })
        }
    }


    async function handleBucketListSave(bucket: Bucket|null): Promise<boolean> {
        //__PERM__ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.UPDATE_BUCKET) === false) { return false; }
        if(bucket && bucket._id) {
            try { verifyNaming([bucket.name], NamingContentTypeEnum.BUCKET) }
            catch(e: any) {
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return false;
            }

            //IMPORTANT: on update: always send all buckets! - every single time
            setLoadingSpinnerCtx({enabled: true, text: `Updating buckets. Please wait...`})
            updateBucket(selectedEnvironment, bucket).then((updatedBucket: Bucket) => {
                if(updatedBucket && updatedBucket._id) {
                    let exisBucks = bucketList.filter(a => a._id.toString() !== updatedBucket._id.toString())
                    let copy = rfdcCopy<Bucket[]>(exisBucks.concat(updatedBucket)) as Bucket[]
                    setBucketList(copy);
                    fetchAppDetails(selectedEnvironment, appInfo._id.toString(), true).then(appRes => {
                        if(appRes && appRes._id) {
                            setAppInfo(appRes);
                        }
                    })
                    displayQuickMessage(UIMessageType.SUCCESS_MSG, `Changes to buckets have been commited...`)
                }
            })
            .finally(() => {
                setLoadingSpinnerCtx({enabled: false, text: ``})
            })
        }
        return true;
    }




    return (
        <Box ref={containerRef}>
        
            <Box sx={{display: 'flex', mt: 1.5, mr: 1, justifyContent: "center", flexDirection: "column"}}>
                <Box sx={{ display: 'flex', justifyContent: "center", minWidth: "600px" }}>
                    <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: 900, height: 190 }} raised>
                        <Divider sx={{ mt: 1, mb: 1}}/>
                        <Table sx={{ ml: 2, width: "96%" }}>
                            <TableBody>
                                
                                <TableRow sx={{ borderBottom: 1}}> 
                                    <TableCell size="small" width={"20%"} sx={{ padding: 0.5, fontSize: 14}}>
                                        <Typography sx={{ mr: 2}}>Name :</Typography>
                                    </TableCell>
                                    <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                        <Typography sx={{ mr: 1}}> {appInfo.name} </Typography>
                                    </TableCell>   
                                </TableRow>

                                <TableRow sx={{ borderBottom: 1}}> 
                                    <TableCell size="small" width={"20%"} sx={{ padding: 0.5, fontSize: 14}}>
                                        <Typography sx={{ mr: 2}}>App ID :</Typography>
                                    </TableCell>
                                    <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                        <Typography sx={{ mr: 1}}> {appInfo.ownerElementId.toString()} </Typography>
                                    </TableCell>   
                                </TableRow>

                                <TableRow sx={{ borderBottom: 1}}> 
                                    <TableCell size="small" width={"20%"} sx={{ padding: 0.5, fontSize: 14}}>
                                        <Typography sx={{ mr: 2 }}>Created By :</Typography>
                                    </TableCell>
                                    <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                        <Typography sx={{ mr: 1}}> {appInfo.createdBy} </Typography>
                                    </TableCell>   
                                </TableRow>
                                
                                <TableRow sx={{ borderBottom: 1}}> 
                                    <TableCell size="small" width={"20%"} sx={{ padding: 0.5, fontSize: 14}}>
                                        <Typography sx={{ mr: 2}}>Environments :</Typography>
                                    </TableCell>
                                    <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                        <Typography sx={{ mr: 1}}>{getEnviList(appInfo)?.envListShortSingleString || ''}</Typography>
                                    </TableCell>   
                                </TableRow>

                                <TableRow sx={{ border: 0}}> 
                                    <TableCell size="small" width={"20%"} sx={{ padding: 0.5, fontSize: 14, borderBottom: 0}}>
                                        <Typography sx={{ mr: 2}}>Description :</Typography>
                                    </TableCell>
                                    <TableCell size="small" sx={{ borderBottom: 0, padding: 0, fontSize: 13}}>
                                        <Typography sx={{ mr: 1}}> {appInfo.description} </Typography>
                                    </TableCell>   
                                </TableRow>
                                
                            </TableBody>
                        </Table>
                        <Divider sx={{ mt: 2, mb: 1}}/>
                    </Card>
                </Box>
            
                <Box sx={{display: 'flex', mt: 2, mr: 1, justifyContent: "center", flexDirection: "column"}}>
                    <Box sx={{ display: 'flex', justifyContent: "center", minWidth: "600px" }}>
                        <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: 900, height: 100 }} raised>
                            <Divider sx={{ mt: 1, mb: 1}}/>
                            <Table sx={{ ml: 2, width: "96%" }}>
                                <TableBody>
                                    
                                    <TableRow>
                                        <TableCell colSpan={2} size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
                                            <Box display="flex" flexDirection="row" sx={{alignContent: "center", justifyContent: "center", textAlign: "center", alignSelf: "center" }}>
                                                
                                                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                    <Tooltip placement="top" title={`Update core app info & settings`}>
                                                        <span>
                                                            <IconButton onClick={handleProfileChangeAction}>
                                                                <BuildCircleOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Typography sx={{ }}>Edit Profile</Typography>
                                                </Box>
                                                
                                                <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                                                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                </Slide>

                                                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                    <Tooltip placement="top" title={`Export all buckets to a different environment`}>
                                                        <span>
                                                            <IconButton disabled={false} onClick={handleExportALLAction}>
                                                                <MoveUpOutlined fontSize="large" color={"secondary"} />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Typography sx={{ }}>Export All</Typography>
                                                </Box>

                                                <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                                                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                </Slide>

                                                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                    <Tooltip placement="top" title={`Clone App`}>
                                                        <span>
                                                            <IconButton onClick={handleCloneAppAction}>
                                                                <CopyAllOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Typography sx={{ }}>Clone App</Typography>
                                                </Box>

                                                <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                </Slide>

                                                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                    <Tooltip placement="top" title={(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock App`: `Lock App`}>
                                                        <span>
                                                            <IconButton onClick={handleAppLockAndUnlockAction}>
                                                                {(appInfo.lockedBy && appInfo.lockedBy.length > 0)
                                                                    ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
                                                                    : <LockOpenOutlined fontSize="large" color="secondary"/>
                                                                }
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Typography sx={{ }}>{(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock App`: `Lock App`}</Typography>
                                                </Box>

                                                <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                </Slide>

                                                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                    <Tooltip placement="top" title={`Delete App`}>
                                                        <span>
                                                            <IconButton onClick={handleDeleteAppAction}>
                                                                <DeleteForeverOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Typography sx={{ }}>Delete App</Typography>
                                                </Box>
                                                
                                            </Box>
                                        </TableCell>   
                                    </TableRow>

                                </TableBody>
                            </Table>
                            <Divider sx={{ mt: 1, mb: 1}}/>
                        </Card>
                    </Box>                            
                </Box>

                <Box display="flex" justifyContent="center" sx={{ mt: 2, mb: 2 }}>
                    <Slide timeout={{ enter: 500, exit: 500 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{ width: "80%" }} />
                    </Slide>
                </Box>
                
                <Box display="flex" justifyContent="center" sx={{ ml: .5, mb: 1 }}>
                    <MultiTextEntryField 
                        labelText={`Add New Bucket(s)`}
                        onItemAdded={onBucketsAdded}
                        regexForValidation={BASIC_NAME_VALIDATION_REGEX} 
                        textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, width: "80vw"}}
                        addButtonStyle={{ fontSize: 27}}
                        disabled={false}
                    />
                </Box>

                <div style={{ height: "42vh" }}>
                    <AgGridReact
                        rowData={bucketList}
                        animateRows={true}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        autoGroupColumnDef={autoGroupColumnDef}
                        onGridReady={onGridReady}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={false}
                        rowHeight={35}
                        headerHeight={35}
                        suppressCsvExport={false}   
                        groupDisplayType='singleColumn'    
                        groupDefaultExpanded={0}
                    />
                </div>
            </Box>
            
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}
            
        </Box>
    )

}

export default AppInfoOverviewTab








    //Important
    // useEffect(() => {
    //     if(appObj && appObj._id) {
    //         setAppInfo(appObj);
    //     } 
    // }, [appObj]);
