import { Autocomplete, Box, Button, Card, Divider, Grid, IconButton, Link, Paper, Slide, Table, TableBody, TableCell } from "@mui/material"; 
import { TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { PeoplePicker } from "@microsoft/mgt-react";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { themeDarkBlue, tokens } from "../../theme";
import { AddOutlined, BuildCircleOutlined, CameraEnhanceOutlined, Cancel, CopyAllOutlined, DeleteForeverOutlined, DoNotDisturbOnTotalSilenceOutlined, EditNoteOutlined, LockOpenOutlined, LockOutlined, PlaylistAddCheckCircle, PlaylistAddCheckCircleOutlined, PlaylistAddCircleOutlined, PublishedWithChangesOutlined, SettingsOutlined } from "@mui/icons-material";
import { Text, Timeline } from "@mantine/core";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi } from "ag-grid-community";
import { convertUTCToLocalDateTimeString, getDateAppendedName, rfdcCopy, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { useDisclosure } from "@mantine/hooks";
import SimpleTextDialog, { SimpleTextDialogProps } from "../../FormDialogs/SimpleTextDialog";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { ActionSceneEnum, NamingContentTypeEnum, SPECIAL_RED_COLOR, UIMessageType, PermissionActionEnum, SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, EnvTypeEnum, ENVIRONMENTLIST } from "../../DataModels/Constants";
import { BasicKVP, BasicProperty, PropertyItem, CDomainData, StatusIndicatorItem } from "../../DataModels/HelperModels";
import { AppInfo } from "../../DataModels/ServiceModels";
import { useCStore } from "../../DataModels/ZuStore";
// import { cloneProject, createSnapshots, deleteProject, deleteSnapshots, restoreSnapshots, updateProject } from "../../BizLogicUtilities/FetchData";
import { LoadingSpinnerInfo, LoggedInUser, QuickStatus } from "../../DataModels/HelperModels";
// import { deleteProjectPermissionElements, getHighestProjectPermRoleForLoggedInUser, getInitPermRolesArray, handleLockAction, isUserApprovedForCoreAction, setupPermissionsForNewProject } from "../../BizLogicUtilities/Permissions";
import { handleLockAction, isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import { deleteAppInfo } from "../../BizLogicUtilities/FetchData";





interface GenPropCtx {
    projectHasProps : boolean,
    projOtherDescriptiveProps : Array<PropertyItem>;
    projKeyContactsProps : Array<PropertyItem>;
    projHighestUserRole: BasicKVP;
}


interface ProjectOverviewTabProps {
    
}

const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({  }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as CDomainData;
    const appObj = domainData.appInfo;

    const placePageTitle = useCStore((state) => state.placePageTitle);
    const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
    const setLoggedInUser = useCStore((state) => state.setLoggedInUser);
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
    const clearCurrentAppInfo = useCStore((state) => state.clearCurrentAppInfo);
    const permissionRoles = useCStore((state) => state.permissionRoles);
    const setCurrentAppInfo = useCStore((state) => state.setCurrentAppInfo);
    const initConfigs = useCStore((state) => state.initConfigs);
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment);

    const [appInfo, setAppInfo] = useState<AppInfo>(appObj as AppInfo);

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [simpleTextModalState, simpleTextModalActioner] = useDisclosure(false);
    const [simpleTextDialogProps, setSimpleTextDialogProps] = useState<SimpleTextDialogProps>()

    const [genPropCtx, setGenPropCtx] = useState<GenPropCtx>()

    const containerRef = useRef<any>();

    const [gridApi, setGridApi] = useState<GridApi>();

    let appEnvList = appInfo.contextProperties.find(a => a.name.toUpperCase() === ENVIRONMENTLIST);
    let appEnvironmentList : string = appEnvList?.value?.join(", ") ?? ""
    
    
    useEffect(() => {
        placePageTitle("AppOverview")
    }, []);


    //Important
    useEffect(() => {
        if(appObj && appObj._id) {
            setAppInfo(appObj);
        } 
    }, [appObj]);

    
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
            minWidth: 120,
            width: 120,
            maxWidth: 120,
            sortable: false,
            editable: false,
            cellStyle: (params: any) => { return { marginLeft: -5, fontWeight : 'normal', display: "flex", alignItems: "center"} },
            mainMenuItems: (params: any) => {
                return (params.defaultItems as any[]).concat(getColumnMenuItems())
            },
            cellRenderer: function(params: any) {
                return (
                    <Box  key={`lg-rem-${params.data.name}`} sx={{display: "flex", flexDirection: "row"}} gap={1}>
                        <Tooltip sx={{padding: "0px"}} key={`tt1-${params.data.name}`} placement="right" title={`Restore snapshot: '${params.data.name}'`}>
                            <span>
                                <IconButton size="small" onClick={(e) => {}}>
                                    <PublishedWithChangesOutlined sx={{height: 22, padding: 0}} color="secondary" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip sx={{padding: "0px"}} key={`tt2-${params.data.name}`} placement="right" title={`Delete snapshot: '${params.data.name}'`}>
                            <span>
                                <IconButton size="small" onClick={(e) => {}}>
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
            // sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
            cellRenderer: function(params: any) {
                let agGridProjNameLinkColor = theme.palette.mode === 'dark' ? "#99ccff" : "#0000EE"
                let agGridProjNameLinkColorHover = theme.palette.mode === 'dark' ? "#66b3ff" : "#0000EE"
                return (
                    <Link 
                        sx={{fontSize: 14, color: agGridProjNameLinkColor, ':hover': { fontWeight: 'bold', color: agGridProjNameLinkColorHover }}} 
                        onClick={() => onBucketSelected(params.data._id.toString())} 
                        underline="hover">
                        {params.value}
                    </Link>
                )}
        },
        {
            headerName: "Created By",
            field: "createdBy",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            // sort: "asc",
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
            // sort: "asc",
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Description",
            field: "description",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            // sort: "asc",
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            //NOTE: get all environments for bucket.
            //NOTE: Use a util function to convert long name to short version (dev, pre, prod) - do same for app level
            headerName: "Environments",
            field: "description",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            // sort: "asc",
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            //NOTE: get highest user permission for bucket
            headerName: "Perm",
            field: "description",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            // sort: "asc",
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        
    ];
    

    function getColumnMenuItems() : any {
        let result = [
            'separator',
            {
                name: 'Delete All Snapshots',
                icon: '<span class="ag-icon ag-icon-not-allowed" unselectable="on" role="presentation"></span>',
                action: () =>  {},
                disabled: false,
                tooltip: 'This action will irreversibly delete All snapshots.',
                cssClasses: ['bold'],
            }
        ];

        return result;
    }


    const onGridReady = useCallback((params: any) => {
        setGridApi(params.api as GridApi);
    }, []);
    

    const sectionStyle = useMemo(() => (
        { textAlign: "center", borderRadius: 5, m: 1, height: "81.5vh", backgroundColor: colors.primary[400] }
    ), []); 


    function onBucketSelected(arg0: any): void {
        throw new Error("Function not implemented.");
    }


    // function onRestoreSnapShot (event: any, snapshotContext: SnapshotContext): void {
    //     if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.RESTORE_SNAPSHOT) === false) { return; }
    //     let snapRestoreConfirmData: ConfirmationDialogProps = {
    //         onFormClosed: onConfirmationDataAvailable,
    //         title: `Please Confirm`,
    //         warningText_main: `Please confirm snapshot restore action. Snapshot Time: [ ${convertUTCToLocalDateTimeString(snapshotContext.lastUpdatedOn)} ]`,
    //         warningText_other: `WARNING: Project data cannot be recovered after stnpshot is restored. Are you sure you want to proceed?`,
    //         actionButtonText: "Proceed",
    //         contextualInfo: { key: "Restore_Snapshot", value: snapshotContext },
    //     }
    //     setConfirmationDialogProps(snapRestoreConfirmData)
    //     confirmationModalActioner.open()
    // }


    // function onDeleteSnapShot(snapshotContexts: SnapshotContext[]): void {
    //     if(snapshotContexts && snapshotContexts.length > 0) {
    //         if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.DELETE_SNAPSHOT) === false) { return; }
    //         let snapDeleteConfirmData: ConfirmationDialogProps = {
    //             onFormClosed: onConfirmationDataAvailable,
    //             title: "Please Confirm",
    //             warningText_main: (snapshotContexts.length  === 1)
    //                 ? `Please confirm deletion of snapshot '${snapshotContexts[0].name}'`
    //                 : `Please confirm deletion of ALL relevant snapshots`,
    //             warningText_other: `WARNING: Snapshot(s) cannot be recovered after deletion. Are you sure you want to proceed?`,
    //             actionButtonText: "Proceed",
    //             contextualInfo:  { key: "Delete_Snapshots", value: snapshotContexts },
    //         }
    //         setConfirmationDialogProps(snapDeleteConfirmData)
    //         confirmationModalActioner.open();
    //     }
    // }


    function handleProjectDeleteAction(event: any): void {
        if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.DELETE_APPINFO) === false) { return; }
        let projDeleteConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Please confirm deletion of project '${appInfo.name}'`,
            warningText_other: `WARNING: Project data cannot be recovered after deletion. Are you sure you want to completely delete this project?`,
            actionButtonText: "Proceed",
            contextualInfo: { key: "Delete_Project", value: null },
        }
        setConfirmationDialogProps(projDeleteConfirmData)
        confirmationModalActioner.open()
    }


    function handleCloneAction(event: any): void {
        if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
        let simpleTextDialogProps: SimpleTextDialogProps = {
            onFormClosed: onSimpleTextDataAvailable,
            title: "Please enter a name for new project",
            defaultValue: appInfo.name,
            unacceptbleValues: [appInfo.name as string],
            contextualInfo: { key: "Clone_Project", value: null },
        }
        setSimpleTextDialogProps(simpleTextDialogProps)
        simpleTextModalActioner.open()
    }

    
    // function handleSnapshotCreationAction(event: any): void {
    //     if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.TAKE_SNAPSHOT) === false) { return; }
    //     let manualSnapName = getDateAppendedName(`OnDemand`)
    //     let simpleTextDialogProps: SimpleTextDialogProps = {
    //         onFormClosed: onSimpleTextDataAvailable,
    //         title: "Please enter a name for new snapshot",
    //         defaultValue: manualSnapName,
    //         unacceptbleValues: [appInfo.name as string, "Snapshot"],
    //         contextualInfo: { key: "Take_Snapshot", value: null },
    //     }
    //     setSimpleTextDialogProps(simpleTextDialogProps)
    //     simpleTextModalActioner.open()
    // }

    
    function handleProjectProfileInfo(): void {
        // if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CHANGE_PROJECT_SETTINGS) === false) { return; }
        // let orgConf: any[] = initConfigs?.find(a => a.configName === CONFIGITEM__Org_Settings)?.configValue;
        // let orgArr : string[] = orgConf?.map((a: any) => a.name.trim().toUpperCase()) ?? []
        // let projCopy = rfdcCopy<AppInfo>(project) as AppInfo;
        // let psdProps: ProjectSetupDialogProps = {
        //     onFormClosed: onProjectSetupDataAvailable,
        //     title: "Manage Project-specific Settings",
        //     isUpdateScenario: true,
        //     orgs: orgArr,
        //     maturityValues: maturityValues,
        //     contextualInfo: { key: "UPDATE_PROJECT_PROFILE", value: projCopy },
        // }
        
        // setProjectSetupDialogProps(psdProps)
        // projectSetupModalActioner.open()
    }

    
    async function onProjectSetupDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo.key && contextualInfo.key === "UPDATE_PROJECT_PROFILE") {
                let modProj = contextualInfo.value as AppInfo
                
                // let pwrNetsToIgnore = modProj?.associatedProperties?.find(a => (
                //     a.category === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS && a.name === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS))

                // let diffIgnoreRegExpProp = modProj?.associatedProperties?.find(a => (
                //     a.category === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA && a.name === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA))
                
                // let ifsProp = modProj?.associatedProperties?.find(a => (
                //     a.category === ProjectPropertyCategoryEnum.ACCESS_GUARD && a.name === ProjectPropertyCategoryEnum.ACCESS_GUARD))

                // let updatedProj = await updateProject(modProj as AppInfo)
                // if(updatedProj) {
                //     if(pwrNetsToIgnore) {
                //         updatedProj = await  updateKeyProjectAspect(updatedProj?._id.toString() as string, ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS, pwrNetsToIgnore)
                //     }

                //     if(diffIgnoreRegExpProp) {
                //         updatedProj = await updateKeyProjectAspect(updatedProj?._id.toString() as string, ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA, diffIgnoreRegExpProp)
                //     }

                //     if(ifsProp) {
                //         updatedProj = await updateKeyProjectAspect(updatedProj?._id.toString() as string, ProjectPropertyCategoryEnum.ACCESS_GUARD, ifsProp)
                //     }

                //     if(updatedProj) {
                //         setProject(updatedProj);
                //         setCurrentAppInfo(updatedProj)
                //         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project update process completed")
                //     }
                //     else {
                //         displayQuickMessage(UIMessageType.ERROR_MSG, "Project update did not complete successfully")
                //     }
                // }
            }
        }
    }


    function handlePropEditingAction(event: any): void {
        // if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.EDIT_PROJECT_PROPERTIES) === false) { return; }
        // let projPropsCopy = rfdcCopy<PropertyItem[]>(project.profileProperties ?? []) as PropertyItem[]
        // let propEditorProps : PropListEditorDialogProps = {
        //     onFormClosed: onPropEditorDataAvailable,
        //     title: "Add, update, or delete project properties",  
        //     contextualInfo:  { key: "IFACE_PROP_EDIT", value: projPropsCopy }, //always pass the entire set to the dialog!
        // }
        // setPropEditorDialogProps(propEditorProps)
        // propEditorModalActioner.open()
    }


    async function onPropEditorDataAvailable(props: PropertyItem[] | null, contextualInfo: BasicKVP): Promise<void> {
        if(props && props.length > 0) {
            // let proj = {...project} as AppInfo
            // proj.profileProperties = props
            // let updatedProj = await updateProject(proj as AppInfo)
            // if(updatedProj) {
            //     setProject(updatedProj);
            //     setCurrentAppInfo(updatedProj)
            //     displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project update process completed")
            // }
        }
    }


            
    async function onSimpleTextDataAvailable(data: string | null, contextualInfo: any): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            // if(contextualInfo.key === "Clone_Project") {
            //     if(data && data.length > 0) {
            //         try {
            //             verifyNaming([data], NamingContentTypeEnum.APPINFO)
            //         }
            //         catch(e: any) {
            //             displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
            //             return;
            //         }
            //         setLoadingSpinnerCtx({enabled: true, text: "Now creating a clone/copy of current project. Please wait..."} as LoadingSpinnerInfo)
            //         let clonedProj = await cloneProject(project._id.toString() as string, data).finally(() => { cancelLoadingSpinnerCtx() })
            //         if(clonedProj) {
            //             let res = await setupPermissionsForNewProject(loggedInUser, clonedProj, true)
            //             if (res === true) {
            //                 displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project cloning process completed!");
            //                 clearCurrentAppInfo();
            //                 navigate(`/${ActionSceneEnum.APPINFO}/${clonedProj._id}/overview`)
            //             }
            //         }
            //     }
            // }
            // else if(contextualInfo.key === "Take_Snapshot") {
            //     if(data && data.length > 0) {
            //         try {
            //             verifyNaming([data], NamingContentTypeEnum.SNAPSHOT)
            //         }
            //         catch(e: any) {
            //             displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
            //             return;
            //         }
            //         let snapInfo : SnapshotContext = {
            //             _id: "",
            //             projectId: project._id.toString() as string,
            //             snapshotSourceId: "",
            //             contextProperties: [],
            //             lastUpdatedOn: new Date(),
            //             name: data.trim(),
            //             enabled: true,
            //             components: [],
            //         }
            //         setLoadingSpinnerCtx({enabled: true, text: "Now creating snapshot. Please wait..."} as LoadingSpinnerInfo)
            //         let snapContexts = await createSnapshots(snapInfo).finally(() => { cancelLoadingSpinnerCtx() })
            //         if(snapContexts && snapContexts.length > 0) {
            //             setSnapshots(snapContexts);
            //             displayQuickMessage(UIMessageType.SUCCESS_MSG, "Snapshot creation process completed")
            //         }
            //     }
            // }
        }
    }

    

    async function onConfirmationDataAvailable(proceed: ConfirmationDialogActionType, contextualInfo: any): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(proceed === ConfirmationDialogActionType.PROCEED) {
                if(contextualInfo.key === "Delete_Project") {
                    // let isDeleted = await deleteAppInfo(selectedEnvironment, appInfo._id.toString() as string)
                    // if(isDeleted) {
                    //     if(permissionRoles && permissionRoles.length > 0) {
                    //         setLoadingSpinnerCtx({enabled: true, text: "Now deleting roles and permissions for project. Please wait..."} as LoadingSpinnerInfo)
                    //         let permActionResult : QuickStatus<any> = await deleteProjectPermissionElements(loggedInUser as LoggedInUser, appInfo, permissionRoles).finally(() => { cancelLoadingSpinnerCtx() })
                    //         if(permActionResult.isSuccessful === false) {
                    //             displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
                    //         }
                    //         else {
                    //             displayQuickMessage(UIMessageType.SUCCESS_MSG, `Permissions removal operations have completed.`);
                    //         }
                    //     }
                    //     displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project deletion completed")
                    //     clearCurrentAppInfo()
                    //     navigate(`/list/${selectedEnvironment ?? EnvTypeEnum.DEVELOPMENT}`)
                    // }
                }
                else if(contextualInfo.key === "Delete_Snapshots") {
                    // let snaps = contextualInfo.value as SnapshotContext[];
                    // if(snaps && (snaps.length > 0) && snaps.every(x => (x._id && x._id.toString().trim().length > 0))) {
                    //     setLoadingSpinnerCtx({enabled: true, text: "Now deleting snapshot(s). Please wait..."} as LoadingSpinnerInfo)
                    //     let snapContexts = await deleteSnapshots(snaps).finally(() => { cancelLoadingSpinnerCtx() })
                    //     if(snapContexts ) {
                    //         setSnapshots(snapContexts);
                    //         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Snapshot deletion process completed")
                    //     }
                    //     else {
                    //         displayQuickMessage(UIMessageType.ERROR_MSG, "Error occured! Failed to delete snapshot.")
                    //     }
                    // }
                    // else {
                    //     displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to delete snapshot. Snapshot data is invalid.")
                    // }
                }
                else if(contextualInfo.key === "Restore_Snapshot") {
                    // let snap = contextualInfo.value;
                    // if(snap && snap._id && snap._id.toString().trim().length > 0){
                    //     setLoadingSpinnerCtx({enabled: true, text: "Now restoring snapshot. Please wait..."} as LoadingSpinnerInfo)
                    //     let snapContexts = await restoreSnapshots(snap).finally(() => { cancelLoadingSpinnerCtx() })
                    //     if(snapContexts && snapContexts.length > 0) {
                    //         clearCurrentAppInfo()
                    //         navigate(`/${ActionSceneEnum.APPINFO}/${appInfo._id?.toString()}`) 
                    //         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Snapshot restoration process completed")
                    //     }
                    //     else {
                    //         displayQuickMessage(UIMessageType.ERROR_MSG, "Error occured! Failed to restore snapshot.")
                    //     }
                    // }
                    // else {
                    //     displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to restore snapshot. Snapshot data is invalid.")
                    // }
                }
            }
        }
    }


    async function processProjectLockAndUnlock(event: any): Promise<void> {
        let updatedProj = await handleLockAction(appInfo, loggedInUser)
        if(updatedProj && updatedProj._id) {
            setAppInfo(updatedProj);
        }
    }

    
    

    return (
        <Box ref={containerRef}>
            {/*         
            <Box flexDirection="column" alignItems="center" >          
                <Box  height={50} sx={{ overflow: 'hidden', display: "flex", flexDirection:"row", ml: 1 }} ref={containerRef}>
                    <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: 0}}>
                        <Autocomplete 
                            value={appInfo.name ?? ""}
                            onChange={(event: any, value: string | null) => { }}
                            key="ra-sel-cb"
                            freeSolo={false}
                            filterSelectedOptions={true}
                            disablePortal
                            disableListWrap
                            size="small"
                            id="ra-sel-cb"
                            sx={{ mt:.7, minWidth: 350 }}
                            options={['', appInfo.name ?? []]}
                            renderInput={(params) => <TextField {...params} 
                                label="Select App" 
                                size="small" 
                                sx={{ '& .MuiInputBase-input': { fontSize: (appInfo?.name && appInfo?.name.length > 30) ? 9.5 : 12.5 } }}
                            />}
                        /> 

                        <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
                        </Slide>

                    </Box>
                </Box>
                <Divider sx={{ marginLeft: 0, marginRight: 0 }} />
            </Box>
            <Divider sx={{ marginLeft: .5, marginRight: 0 }} /> 
            */}

            <Box sx={{display: 'flex', mr: 1, justifyContent: "center", flexDirection: "column"}}>
                <Box sx={{ flexGrow: 1, display: "inline-flex" }}>
                    <Box sx={{ display: "flex", justifyContent: "center", minWidth: "600px", width: "82vw", }} >
                        <Box sx={{ display: 'flex', mt: 3}}>
                            <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: 900, height: 210 }} raised>
                                <Divider sx={{ mt: 1, mb: 1}}/>
                                <Table sx={{ ml: 2, width: "96%" }}>
                                    <TableBody>
                                        
                                        <TableRow sx={{ borderBottom: 1}}> 
                                            <TableCell size="small" width={"20%"} sx={{ padding: 0, fontSize: 14}}>
                                                <Typography sx={{ mr: 2}}>Name :</Typography>
                                            </TableCell>
                                            <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                                <Typography sx={{ mr: 1}}> {appInfo.name} </Typography>
                                            </TableCell>   
                                        </TableRow>

                                        <TableRow sx={{ borderBottom: 1}}> 
                                            <TableCell size="small" width={"20%"} sx={{ padding: 0, fontSize: 14}}>
                                                <Typography sx={{ mr: 2}}>Created By :</Typography>
                                            </TableCell>
                                            <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                                <Typography sx={{ mr: 1}}> {appInfo.createdBy} </Typography>
                                            </TableCell>   
                                        </TableRow>

                                        <TableRow sx={{ borderBottom: 1}}> 
                                            <TableCell size="small" width={"20%"} sx={{ padding: 0, fontSize: 14}}>
                                                <Typography sx={{ mr: 2}}>Description :</Typography>
                                            </TableCell>
                                            <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                                <Typography sx={{ mr: 1}}> {appInfo.description} </Typography>
                                            </TableCell>   
                                        </TableRow>
                                        
                                        <TableRow sx={{ borderBottom: 1}}> 
                                            <TableCell size="small" width={"20%"} sx={{ padding: 0, fontSize: 14}}>
                                                <Typography sx={{ mr: 2}}>Environments :</Typography>
                                            </TableCell>
                                            <TableCell size="small" sx={{ padding: 0, fontSize: 13}}>
                                                <Typography sx={{ mr: 1}}>{appEnvironmentList}</Typography>
                                            </TableCell>   
                                        </TableRow>

                                        <TableRow> 
                                            <TableCell colSpan={2} size="small" width={"20%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
                                                <Typography sx={{ mr: 2}}>Actions</Typography>
                                            </TableCell>  
                                        </TableRow>

                                        <TableRow>
                                            <TableCell colSpan={2} size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
                                                <Box display="flex" flexDirection="row" >
                                                    
                                                    <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                        <Tooltip placement="top" title={`Update core project info & settings`}>
                                                            <IconButton onClick={handleProjectProfileInfo}>
                                                                <BuildCircleOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Typography sx={{ }}>Edit Profile</Typography>
                                                    </Box>
                                                    
                                                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                                        <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                    </Slide>

                                                    <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                        <Tooltip placement="top" title={`Edit descriptive project properties`}>
                                                            <span>
                                                                <IconButton disabled={false} onClick={handlePropEditingAction}>
                                                                    <PlaylistAddCircleOutlined fontSize="large" color={"secondary"} />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Typography sx={{ }}>Add Buckets</Typography>
                                                    </Box>

                                                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                                        <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                    </Slide>

                                                    <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                        <Tooltip placement="top" title={`Clone Project`}>
                                                            <IconButton onClick={handleCloneAction}>
                                                                <CopyAllOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Typography sx={{ }}>Clone App</Typography>
                                                    </Box>

                                                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                                        <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                    </Slide>

                                                    <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                        <Tooltip placement="top" title={(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`}>
                                                            <IconButton onClick={processProjectLockAndUnlock}>
                                                                {(appInfo.lockedBy && appInfo.lockedBy.length > 0)
                                                                    ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
                                                                    : <LockOpenOutlined fontSize="large" color="secondary"/>
                                                                }
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Typography sx={{ }}>Lock App</Typography>
                                                    </Box>

                                                    <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                                        <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
                                                    </Slide>

                                                    <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                                        <Tooltip placement="top" title={`Delete Project`}>
                                                            <IconButton onClick={handleProjectDeleteAction}>
                                                                <DeleteForeverOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
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
                </Box>
            
                <Box display="flex" justifyContent="center" sx={{ mb: 5, mt: 5  }}>
                    <Slide timeout={{ enter: 500, exit: 500 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{ width: "80%" }} />
                    </Slide>
                </Box>
                <div style={{ height: "42vh" }}>
                    <AgGridReact
                        rowData={[]}
                        animateRows={true}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        autoGroupColumnDef={autoGroupColumnDef}
                        onGridReady={onGridReady}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={false}
                        suppressCsvExport={false}   
                        groupDisplayType='singleColumn'    
                        groupDefaultExpanded={0}
                    />
                </div>
            </Box>
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            
        </Box>


            
            
    )

}

export default ProjectOverviewTab




        // <Box sx={{display: 'flex', mr: 1, flexDirection: "column"}}>
                                            
        //     <Box sx={{ flexGrow: 1, display: "inline-flex" }}>
        //         <Box sx={{ display: "flex", alignItems: "center", minWidth: "600px", width: "82vw", }} >
        //             <Box sx={{ display: 'flex', mt: 3}}>
        //                 <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: 500, height: 81 }} raised>
        //                     <Divider sx={{ mt: 1, mb: 1}}/>
        //                     <Table sx={{ ml: 2 }}>
        //                         <TableBody>
        //                             {/* give it transparent background  */}
        //                             <TableRow key={`perm-tab-row-${33}`}> 
        //                                 <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
        //                                     <Typography sx={{ mr: 2}}>Actions :</Typography>
        //                                 </TableCell>
        //                                 <TableCell size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
        //                                     <Box display="flex" flexDirection="row" gap={0.4}>
        //                                         <Tooltip placement="top" title={`Update core project info & settings`}>
        //                                             <IconButton onClick={handleProjectProfileInfo}>
        //                                                 <BuildCircleOutlined fontSize="large" color="secondary"/>
        //                                             </IconButton>
        //                                         </Tooltip>
        //                                         <Tooltip placement="top" title={`Edit descriptive project properties`}>
        //                                             <span>
        //                                                 <IconButton disabled={false} onClick={handlePropEditingAction}>
        //                                                     <EditNoteOutlined fontSize="large" color={"secondary"} />
        //                                                 </IconButton>
        //                                             </span>
        //                                         </Tooltip>
        //                                         <Tooltip placement="top" title={`Clone Project`}>
        //                                             <IconButton onClick={handleCloneAction}>
        //                                                 <CopyAllOutlined fontSize="large" color="secondary"/>
        //                                             </IconButton>
        //                                         </Tooltip>
        //                                         <Tooltip placement="top" title={(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`}>
        //                                             <IconButton onClick={processProjectLockAndUnlock}>
        //                                                 {(appInfo.lockedBy && appInfo.lockedBy.length > 0)
        //                                                     ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
        //                                                     : <LockOpenOutlined fontSize="large" color="secondary"/>
        //                                                 }
        //                                             </IconButton>
        //                                         </Tooltip>
        //                                         <Tooltip placement="top" title={`Delete Project`}>
        //                                             <IconButton onClick={handleProjectDeleteAction}>
        //                                                 <DeleteForeverOutlined fontSize="large" color="secondary"/>
        //                                             </IconButton>
        //                                         </Tooltip>
                                                
        //                                     </Box>
        //                                 </TableCell>   
        //                             </TableRow>
        //                         </TableBody>
        //                     </Table>
        //                     <Divider sx={{ mt: 1, mb: 1}}/>
        //                 </Card>
        //             </Box>                            
        //         </Box>
        //     </Box>
        // </Box>










    