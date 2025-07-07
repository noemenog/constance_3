import { Box, Button, Card, Divider, Grid, IconButton, Paper, Slide, Table, TableBody, TableCell } from "@mui/material"; 
import { TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { PeoplePicker } from "@microsoft/mgt-react";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { themeDarkBlue, tokens } from "../../theme";
import { BuildCircleOutlined, CameraEnhanceOutlined, Cancel, CopyAllOutlined, DeleteForeverOutlined, DoNotDisturbOnTotalSilenceOutlined, EditNoteOutlined, LockOpenOutlined, LockOutlined, PlaylistAddCheckCircle, PublishedWithChangesOutlined, SettingsOutlined } from "@mui/icons-material";
import { Text, Timeline } from "@mantine/core";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi } from "ag-grid-community";
import { convertUTCToLocalDateTimeString, getDateAppendedName, getViewableProperties, rfdcCopy, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { useDisclosure } from "@mantine/hooks";
import SimpleTextDialog, { SimpleTextDialogProps } from "../../FormDialogs/SimpleTextDialog";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { ActionSceneEnum, NamingContentTypeEnum, SPECIAL_RED_COLOR, UIMessageType, CommonPropertyCategoryEnum, PermissionActionEnum, CONF_PERMISSION_ROLES, CONFIGITEM__Maturity_Values, ProjectPropertyCategoryEnum, CONFIGITEM__Org_Settings, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_EVEN_DEEPER_QUARTZ_COLOR } from "../../DataModels/Constants";
import { BasicKVP, BasicProperty, ConstraintConfExportContext, PropertyItem, SPDomainData, StatusIndicatorItem } from "../../DataModels/HelperModels";
import { Project, SnapshotContext } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { cloneProject, createSnapshots, deleteProject, deleteSnapshots, restoreSnapshots, updateKeyProjectAspect, updateProject } from "../../BizLogicUtilities/FetchData";
import { LoadingSpinnerInfo, LoggedInUser, QuickStatus } from "../../DataModels/HelperModels";
import { deleteProjectPermissionElements, getHighestProjectPermRoleForLoggedInUser, getInitPermRolesArray, handleLockAction, isUserApprovedForCoreAction, setupPermissionsForNewProject } from "../../BizLogicUtilities/Permissions";
import PropListEditorDialog, { PropListEditorDialogProps } from "../../FormDialogs/PropListEditorDialog";
import ProjectSetupDialog, { ProjectSetupDialogProps } from "../../FormDialogs/ProjectSetupDialog";





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
    const domainData = useLoaderData() as SPDomainData;
    const projObj = domainData.project;
    const snaps = domainData.snapshots;

    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const setLoggedInUser = useSpiderStore((state) => state.setLoggedInUser);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    const clearBasicProjInfo = useSpiderStore((state) => state.clearBasicProjInfo);
    const permissionRoles = useSpiderStore((state) => state.permissionRoles);
    const setBasicProjInfo = useSpiderStore((state) => state.setBasicProjInfo);
    const statusTimeLineInfo = useSpiderStore((state) => state.statusTimeLineInfo);
    const initConfigs = useSpiderStore((state) => state.initConfigs);

    const [project, setProject] = useState<Project>(projObj as Project);
    const [snapshots, setSnapshots] = useState<SnapshotContext[]>(snaps);

    const [propEditorModalState, propEditorModalActioner] = useDisclosure(false);
    const [propEditorDialogProps, setPropEditorDialogProps] = useState<PropListEditorDialogProps>();

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [simpleTextModalState, simpleTextModalActioner] = useDisclosure(false);
    const [simpleTextDialogProps, setSimpleTextDialogProps] = useState<SimpleTextDialogProps>()

    const [projectSetupModalState, projectSetupModalActioner] = useDisclosure(false);
    const [projectSetupDialogProps, setProjectSetupDialogProps] = useState<ProjectSetupDialogProps>()

    const [genPropCtx, setGenPropCtx] = useState<GenPropCtx>()

    const containerRef = useRef<any>();

    const [gridApi, setGridApi] = useState<GridApi>();


    useEffect(() => {
        placePageTitle("ProjectOverview")
    }, []);


    useMemo(() => {
        const transientProjectNameProp :PropertyItem = {
            id: crypto.randomUUID(),
            name: "PROJECT_NAME",
            displayName: "Project Name",
            category: CommonPropertyCategoryEnum.GENERAL_FIXED_KEY,
            editable: true,
            enabled: true,
            value: project.name
        };
    
        const transientProjectOrgProp : PropertyItem = {
            id: crypto.randomUUID(),
            name: "PROJECT_ORG",
            displayName: "Project Org",
            category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
            editable: false,
            enabled: true,
            value: project.org.toUpperCase()
        }


        const transientProjectDescProp : PropertyItem = {
            id: crypto.randomUUID(),
            name: "Description",
            displayName: "Project Description",
            category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
            editable: false,
            enabled: true,
            value: project.description.trim()
        }

        const transientProjectMaturityProp : PropertyItem = {
            id: crypto.randomUUID(),
            name: "Maturity",
            displayName: "Project Org",
            category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
            editable: false,
            enabled: true,
            value: project.org.toUpperCase()
        }

        const transientProjectCreatedByProp : PropertyItem = {
            id: crypto.randomUUID(),
            name: "PROJECT_ORG",
            displayName: "Project Org",
            category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
            editable: false,
            enabled: true,
            value: project.org.toUpperCase()
        }
        let viewableProps = getViewableProperties(project?.profileProperties) ?? []
        let gpCtx: GenPropCtx = {
            projectHasProps: ((viewableProps.length > 0) ? true : false),
            projOtherDescriptiveProps: Array.from([transientProjectNameProp, transientProjectOrgProp]),
            projKeyContactsProps: new Array<PropertyItem>(),
            projHighestUserRole: getHighestProjectPermRoleForLoggedInUser(project, loggedInUser)
        } 

        for(let i = 0; i < viewableProps.length; i++) {
            let prop = viewableProps[i] as PropertyItem
            let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value

            if(exportSettings && exportSettings.subType && exportSettings.subType.toUpperCase() === "KEY_CONTACTS") {
                gpCtx.projKeyContactsProps.push(prop)
            }
            else if(exportSettings && exportSettings.subType && exportSettings.subType.toUpperCase() === "PROJECT_DESCRIPTION") {
                gpCtx.projOtherDescriptiveProps.push(prop)
            }
            else {
                gpCtx.projOtherDescriptiveProps.push(prop)
            }
        }

        setGenPropCtx(gpCtx)
    }, [project, loggedInUser.perms]);


    //Important
    useEffect(() => {
        if(projObj && projObj._id) {
            setProject(projObj);
            setSnapshots(snaps)
        } 
    }, [projObj]);

    
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
            headerName: "Snapshot",
            field: 'name',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 225,
            width: 225,
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            tooltipValueGetter: (params) => { return `${params.value}`; },
            cellStyle: (params: any) => { return { marginLeft: -2, fontSize: '10.5px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Time",
            field: 'lastUpdatedOn',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 158,
            width: 158,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            tooltipValueGetter: (params) => { return `${params.value}`; },
            cellStyle: (params: any) => { return { marginLeft: -2, fontSize: '10.5px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Action",
            resizable: true,
            minWidth: 91,
            width: 100,
            maxWidth: 100,
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
                                <IconButton size="small" onClick={(e) => onRestoreSnapShot(e, params.data)}>
                                    <PublishedWithChangesOutlined sx={{height: 22, padding: 0}} color="secondary" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip sx={{padding: "0px"}} key={`tt2-${params.data.name}`} placement="right" title={`Delete snapshot: '${params.data.name}'`}>
                            <span>
                                <IconButton size="small" onClick={(e) => onDeleteSnapShot([params.data])}>
                                    <Cancel sx={{height: 22, padding: 0, color: SPECIAL_RED_COLOR}} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                )
            },            
        },

    ];
    

     function getColumnMenuItems() : any {
        let result = [
            'separator',
            {
                name: 'Delete All Snapshots',
                icon: '<span class="ag-icon ag-icon-not-allowed" unselectable="on" role="presentation"></span>',
                action: () =>  onDeleteSnapShot(snapshots),
                disabled: false,
                tooltip: 'This action will irreversibly delete All snapshots.',
                cssClasses: ['bold'],
            }
        ];

        return result;
    }


    const onGridReady = useCallback((params: any) => {
        // setGridApi(params.api as GridApi);
    }, []);
    

    const sectionStyle = useMemo(() => (
        { textAlign: "center", borderRadius: 5, m: 1, height: "81.5vh", backgroundColor: colors.primary[400] }
    ), []); 


    const maturityValues : string[] = useMemo(() => {
        let maturVals : string[] = initConfigs?.find(a => a.configName === CONFIGITEM__Maturity_Values)?.configValue
        return maturVals ?? []
    }, [initConfigs]);
    
    function onRestoreSnapShot (event: any, snapshotContext: SnapshotContext): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.RESTORE_SNAPSHOT) === false) { return; }
        let snapRestoreConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: `Please Confirm`,
            warningText_main: `Please confirm snapshot restore action. Snapshot Time: [ ${convertUTCToLocalDateTimeString(snapshotContext.lastUpdatedOn)} ]`,
            warningText_other: `WARNING: Project data cannot be recovered after stnpshot is restored. Are you sure you want to proceed?`,
            actionButtonText: "Proceed",
            contextualInfo: { key: "Restore_Snapshot", value: snapshotContext },
        }
        setConfirmationDialogProps(snapRestoreConfirmData)
        confirmationModalActioner.open()
    }


    function onDeleteSnapShot(snapshotContexts: SnapshotContext[]): void {
        if(snapshotContexts && snapshotContexts.length > 0) {
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.DELETE_SNAPSHOT) === false) { return; }
            let snapDeleteConfirmData: ConfirmationDialogProps = {
                onFormClosed: onConfirmationDataAvailable,
                title: "Please Confirm",
                warningText_main: (snapshotContexts.length  === 1)
                    ? `Please confirm deletion of snapshot '${snapshotContexts[0].name}'`
                    : `Please confirm deletion of ALL relevant snapshots`,
                warningText_other: `WARNING: Snapshot(s) cannot be recovered after deletion. Are you sure you want to proceed?`,
                actionButtonText: "Proceed",
                contextualInfo:  { key: "Delete_Snapshots", value: snapshotContexts },
            }
            setConfirmationDialogProps(snapDeleteConfirmData)
            confirmationModalActioner.open();
        }
    }


    function handleProjectDeleteAction(event: any): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.DELETE_PROJECT) === false) { return; }
        let projDeleteConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Please confirm deletion of project '${project.name}'`,
            warningText_other: `WARNING: Project data cannot be recovered after deletion. Are you sure you want to completely delete this project?`,
            actionButtonText: "Proceed",
            contextualInfo: { key: "Delete_Project", value: null },
        }
        setConfirmationDialogProps(projDeleteConfirmData)
        confirmationModalActioner.open()
    }


    function handleCloneAction(event: any): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CLONE_PROJECT) === false) { return; }
        let simpleTextDialogProps: SimpleTextDialogProps = {
            onFormClosed: onSimpleTextDataAvailable,
            title: "Please enter a name for new project",
            defaultValue: project.name,
            unacceptbleValues: [project.name as string],
            contextualInfo: { key: "Clone_Project", value: null },
        }
        setSimpleTextDialogProps(simpleTextDialogProps)
        simpleTextModalActioner.open()
    }

    
    function handleSnapshotCreationAction(event: any): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.TAKE_SNAPSHOT) === false) { return; }
        let manualSnapName = getDateAppendedName(`OnDemand`)
        let simpleTextDialogProps: SimpleTextDialogProps = {
            onFormClosed: onSimpleTextDataAvailable,
            title: "Please enter a name for new snapshot",
            defaultValue: manualSnapName,
            unacceptbleValues: [project.name as string, "Snapshot"],
            contextualInfo: { key: "Take_Snapshot", value: null },
        }
        setSimpleTextDialogProps(simpleTextDialogProps)
        simpleTextModalActioner.open()
    }

    
    function handleProjectProfileInfo(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CHANGE_PROJECT_SETTINGS) === false) { return; }
        let orgConf: any[] = initConfigs?.find(a => a.configName === CONFIGITEM__Org_Settings)?.configValue;
        let orgArr : string[] = orgConf?.map((a: any) => a.name.trim().toUpperCase()) ?? []
        let projCopy = rfdcCopy<Project>(project) as Project;
        let psdProps: ProjectSetupDialogProps = {
            onFormClosed: onProjectSetupDataAvailable,
            title: "Manage Project-specific Settings",
            isUpdateScenario: true,
            orgs: orgArr,
            maturityValues: maturityValues,
            contextualInfo: { key: "UPDATE_PROJECT_PROFILE", value: projCopy },
        }
        
        setProjectSetupDialogProps(psdProps)
        projectSetupModalActioner.open()
    }

    
    async function onProjectSetupDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo.key && contextualInfo.key === "UPDATE_PROJECT_PROFILE") {
                let modProj = contextualInfo.value as Project
                
                let pwrNetsToIgnore = modProj?.associatedProperties?.find(a => (
                    a.category === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS && a.name === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS))

                let diffIgnoreRegExpProp = modProj?.associatedProperties?.find(a => (
                    a.category === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA && a.name === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA))
                
                let ifsProp = modProj?.associatedProperties?.find(a => (
                    a.category === ProjectPropertyCategoryEnum.ACCESS_GUARD && a.name === ProjectPropertyCategoryEnum.ACCESS_GUARD))

                let updatedProj = await updateProject(modProj as Project)
                if(updatedProj) {
                    if(pwrNetsToIgnore) {
                        updatedProj = await  updateKeyProjectAspect(updatedProj?._id.toString() as string, ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS, pwrNetsToIgnore)
                    }

                    if(diffIgnoreRegExpProp) {
                        updatedProj = await updateKeyProjectAspect(updatedProj?._id.toString() as string, ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA, diffIgnoreRegExpProp)
                    }

                    if(ifsProp) {
                        updatedProj = await updateKeyProjectAspect(updatedProj?._id.toString() as string, ProjectPropertyCategoryEnum.ACCESS_GUARD, ifsProp)
                    }

                    if(updatedProj) {
                        setProject(updatedProj);
                        setBasicProjInfo(updatedProj)
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project update process completed")
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Project update did not complete successfully")
                    }
                }
            }
        }
    }


    function handlePropEditingAction(event: any): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.EDIT_PROJECT_PROPERTIES) === false) { return; }
        let projPropsCopy = rfdcCopy<PropertyItem[]>(project.profileProperties ?? []) as PropertyItem[]
        let propEditorProps : PropListEditorDialogProps = {
            onFormClosed: onPropEditorDataAvailable,
            title: "Add, update, or delete project properties",  
            contextualInfo:  { key: "IFACE_PROP_EDIT", value: projPropsCopy }, //always pass the entire set to the dialog!
        }
        setPropEditorDialogProps(propEditorProps)
        propEditorModalActioner.open()
    }


    async function onPropEditorDataAvailable(props: PropertyItem[] | null, contextualInfo: BasicKVP): Promise<void> {
        if(props && props.length > 0) {
            let proj = {...project} as Project
            proj.profileProperties = props
            let updatedProj = await updateProject(proj as Project)
            if(updatedProj) {
                setProject(updatedProj);
                setBasicProjInfo(updatedProj)
                displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project update process completed")
            }
        }
    }


            
    async function onSimpleTextDataAvailable(data: string | null, contextualInfo: any): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "Clone_Project") {
                if(data && data.length > 0) {
                    try {
                        verifyNaming([data], NamingContentTypeEnum.PROJECT)
                    }
                    catch(e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    setLoadingSpinnerCtx({enabled: true, text: "Now creating a clone/copy of current project. Please wait..."} as LoadingSpinnerInfo)
                    let clonedProj = await cloneProject(project._id.toString() as string, data).finally(() => { cancelLoadingSpinnerCtx() })
                    if(clonedProj) {
                        let res = await setupPermissionsForNewProject(loggedInUser, clonedProj, true)
                        if (res === true) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project cloning process completed!");
                            clearBasicProjInfo();
                            navigate(`/${ActionSceneEnum.PROJECT}/${clonedProj._id}/overview`)
                        }
                    }
                }
            }
            else if(contextualInfo.key === "Take_Snapshot") {
                if(data && data.length > 0) {
                    try {
                        verifyNaming([data], NamingContentTypeEnum.SNAPSHOT)
                    }
                    catch(e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    let snapInfo : SnapshotContext = {
                        _id: "",
                        projectId: project._id.toString() as string,
                        snapshotSourceId: "",
                        contextProperties: [],
                        lastUpdatedOn: new Date(),
                        name: data.trim(),
                        enabled: true,
                        components: [],
                    }
                    setLoadingSpinnerCtx({enabled: true, text: "Now creating snapshot. Please wait..."} as LoadingSpinnerInfo)
                    let snapContexts = await createSnapshots(snapInfo).finally(() => { cancelLoadingSpinnerCtx() })
                    if(snapContexts && snapContexts.length > 0) {
                        setSnapshots(snapContexts);
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Snapshot creation process completed")
                    }
                }
            }
        }
    }

    

    async function onConfirmationDataAvailable(proceed: ConfirmationDialogActionType, contextualInfo: any): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(proceed === ConfirmationDialogActionType.PROCEED) {
                if(contextualInfo.key === "Delete_Project") {
                    let isDeleted = await deleteProject(project._id.toString() as string)
                    if(isDeleted) {
                        if(permissionRoles && permissionRoles.length > 0) {
                            setLoadingSpinnerCtx({enabled: true, text: "Now deleting roles and permissions for project. Please wait..."} as LoadingSpinnerInfo)
                            let permActionResult : QuickStatus<any> = await deleteProjectPermissionElements(loggedInUser as LoggedInUser, project, permissionRoles).finally(() => { cancelLoadingSpinnerCtx() })
                            if(permActionResult.isSuccessful === false) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
                            }
                            else {
                                displayQuickMessage(UIMessageType.SUCCESS_MSG, `Permissions removal operations have completed.`);
                            }
                        }
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project deletion completed")
                        clearBasicProjInfo()
                        navigate('/projectlist');
                    }
                }
                else if(contextualInfo.key === "Delete_Snapshots") {
                    let snaps = contextualInfo.value as SnapshotContext[];
                    if(snaps && (snaps.length > 0) && snaps.every(x => (x._id && x._id.toString().trim().length > 0))) {
                        setLoadingSpinnerCtx({enabled: true, text: "Now deleting snapshot(s). Please wait..."} as LoadingSpinnerInfo)
                        let snapContexts = await deleteSnapshots(snaps).finally(() => { cancelLoadingSpinnerCtx() })
                        if(snapContexts ) {
                            setSnapshots(snapContexts);
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Snapshot deletion process completed")
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Error occured! Failed to delete snapshot.")
                        }
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to delete snapshot. Snapshot data is invalid.")
                    }
                }
                else if(contextualInfo.key === "Restore_Snapshot") {
                    let snap = contextualInfo.value;
                    if(snap && snap._id && snap._id.toString().trim().length > 0){
                        setLoadingSpinnerCtx({enabled: true, text: "Now restoring snapshot. Please wait..."} as LoadingSpinnerInfo)
                        let snapContexts = await restoreSnapshots(snap).finally(() => { cancelLoadingSpinnerCtx() })
                        if(snapContexts && snapContexts.length > 0) {
                            clearBasicProjInfo()
                            navigate(`/${ActionSceneEnum.PROJECT}/${project._id?.toString()}`) 
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Snapshot restoration process completed")
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Error occured! Failed to restore snapshot.")
                        }
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to restore snapshot. Snapshot data is invalid.")
                    }
                }
            }
        }
    }


    async function processProjectLockAndUnlock(event: any): Promise<void> {
        let updatedProj = await handleLockAction(project, loggedInUser)
        if(updatedProj && updatedProj._id) {
            setProject(updatedProj);
        }
    }

    
    

    return (
        <Box>
            <Box ref={containerRef} sx={{ height: "80vh", mt: 1.2}}>
                {(project && genPropCtx) && <Grid container spacing={.2} direction="row" minWidth="1000px">
                    <Grid item xs sm={3} key={`proj-ov-sec-1`} minWidth="520px" width="520px" >
                        <Box minHeight="80vh" display="flex" flexDirection="column" sx={sectionStyle} gap={2}>    
                            
                            <Box sx={{ display: 'flex', mt: 3}}>
                                <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: 500, height: 81 }} raised>
                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                    <Table sx={{ ml: 2 }}>
                                        <TableBody>
                                            {/* give it transparent background  */}
                                            <TableRow key={`perm-tab-row-${33}`}> 
                                                <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2}}>Actions :</Typography>
                                                </TableCell>
                                                <TableCell size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
                                                    <Box display="flex" flexDirection="row" gap={0.4}>
                                                        <Tooltip placement="top" title={`Update core project info & settings`}>
                                                            <IconButton onClick={handleProjectProfileInfo}>
                                                                <BuildCircleOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip placement="top" title={`Edit descriptive project properties`}>
                                                            <span>
                                                                <IconButton disabled={genPropCtx.projectHasProps ? false : true} onClick={handlePropEditingAction}>
                                                                    <EditNoteOutlined fontSize="large" color={genPropCtx.projectHasProps ? "secondary" : "disabled"} />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip placement="top" title={`Clone Project`}>
                                                            <IconButton onClick={handleCloneAction}>
                                                                <CopyAllOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip placement="top" title={(project.lockedBy && project.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`}>
                                                            <IconButton onClick={processProjectLockAndUnlock}>
                                                                {(project.lockedBy && project.lockedBy.length > 0)
                                                                    ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
                                                                    : <LockOpenOutlined fontSize="large" color="secondary"/>
                                                                }
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip placement="top" title={`Take Project Snapshot`}>
                                                            <IconButton onClick={handleSnapshotCreationAction}>
                                                                <CameraEnhanceOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip placement="top" title={`Delete Project`}>
                                                            <IconButton onClick={handleProjectDeleteAction}>
                                                                <DeleteForeverOutlined fontSize="large" color="secondary"/>
                                                            </IconButton>
                                                        </Tooltip>
                                                        
                                                    </Box>
                                                </TableCell>   
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                </Card>
                            </Box>

                            <Box sx={{ display: 'flex'}}>
                                <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: 500, height: 60 }} raised>
                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                    <Table sx={{ ml: 2 }}>
                                        <TableBody>
                                            {/* give it transparent background  */}
                                            <TableRow key={`perm-tab-row-${33}`}> 
                                                <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2}}>User Role :</Typography>
                                                </TableCell>
                                                {/* TODO: Fix this to get the user's highest role */}
                                                <TableCell size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2}}>{genPropCtx.projHighestUserRole.value}</Typography>
                                                </TableCell>   
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                </Card>
                            </Box>

                            <Box sx={{ display: 'flex'}}>
                                <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: 500, height: 78 }} raised>     
                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                    <Table sx={{ ml: 2 }}>
                                        <TableBody>
                                            {/* give it transparent background  */}
                                            <TableRow key={`tab-row-maturity`}> 
                                                <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2}}>Maturity :</Typography>
                                                </TableCell>
                                                <TableCell size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2}}>{project.maturity ?? ''}</Typography>
                                                </TableCell>   
                                            </TableRow>
                                            <TableRow key={`tab-row-status`}> 
                                                <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2}}>Lock Status :</Typography>
                                                </TableCell>
                                                <TableCell size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2, color: ((project.lockedBy && project.lockedBy.length > 0) ? SPECIAL_RED_COLOR : undefined) }}>
                                                        {
                                                            (project && project.lockedBy && project.lockedBy.length > 0) 
                                                                ? <><span>ON</span>&nbsp;&nbsp;&nbsp;<span>{`[ ${project.lockedBy} ]` }</span></>
                                                                : `[ OFF ]`
                                                        }
                                                    </Typography>
                                                </TableCell>   
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                </Card>
                            </Box>

                            <Box sx={{ display: 'flex'}}>
                                <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 3, ml: 1, mr: 1, width: 500, minHeight: "17rem" }} raised>     
                                    <Divider sx={{ mt: 1, mb: .5}}/>
                                    <Typography variant="h6" color={colors.greenAccent[400]}>{`SnapShots`}</Typography>
                                    
                                    <div style={{ height:"44vh" }}>
                                        <AgGridReact
                                            rowData={snapshots ?? []}
                                            animateRows={false}
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
                                            rowHeight={32}
                                            headerHeight={30} 
                                        />
                                    </div> 

                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                </Card>
                            </Box>
                        </Box>
                    </Grid>

                    <Grid item xs sm={1} key={`proj-ov-sec-3`} minWidth="250px">
                        <Box display="flex" flexDirection="column" sx={sectionStyle}>    
                            <Typography variant="h6" color={colors.greenAccent[400]}>{`Activity Statuses`}</Typography>
                            <Divider sx={{ mt: 1, mb: 1}}/>
                            <Box sx={{mt: 0, height: "75vh", overflowY: "scroll"}}>
                                <Slide timeout={{ enter: 500, exit: 400 }} direction="down" in={(statusTimeLineInfo && statusTimeLineInfo.length > 0) ? true: false} container={containerRef.current}>
                                    <Box sx={{ml: 1, mr: 1, }}>
                                        <Timeline 
                                            key={`proj-timeline`}
                                            active={statusTimeLineInfo.length} //for nowe just mark all as ok 
                                            // active={projProgress.filter(a => a.isOk === true).length - 1} 
                                            bulletSize={22} 
                                            lineWidth={2}
                                            styles={{
                                                root: { },
                                                itemTitle: { color: colors.grey[100], fontWeight: "normal", fontSize: 13 }
                                            }}
                                            >
                                            {
                                                [...statusTimeLineInfo].map((item: StatusIndicatorItem, statusItem: any) => (
                                                    <Timeline.Item key={`titem-${statusItem}`} title={item.title} bullet={item.isOk ? <PlaylistAddCheckCircle /> : <DoNotDisturbOnTotalSilenceOutlined sx={{color: "black"}}/>} lineVariant={ item.isOk ? "solid" : "dashed" }>
                                                        <Typography key={`typog1-${statusItem}`}sx={{ fontWeight: "lighter", fontSize: 10, color: colors.grey[300] }}>{item.description}</Typography>
                                                        <Typography key={`typog2-${statusItem}`}sx={{ fontWeight: "lighter", fontSize: 11, color: item.isOk ? colors.blueAccent[200] : colors.grey[300]}}>{(new Date(item.lastUpdatedOn)).toISOString()}</Typography>
                                                    </Timeline.Item>
                                                ))
                                            }
                                            
                                        </Timeline>
                                    </Box>
                                </Slide>
                            </Box>
                        </Box>
                    </Grid>

                    <Grid item xs sm key={`proj-ov-sec-2`} minWidth="392px">
                        <Box display="flex" flexDirection="column" sx={sectionStyle}>    
                            <Typography variant="h6" color={colors.greenAccent[400]}>{`Project Properties`}</Typography>
                            <Divider sx={{ mt: 1, mb: 1}}/>
    
                            <Box sx={{ display: 'flex', mt: 0}}>
                                <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 2, ml: 1, mr: 1, width: "97%", height: 140 }} raised>       
                                    <Divider sx={{ mt: 1, mb: 1}}/>
                                    <Table sx={{ ml: 2 }}>
                                        <TableBody>
                                            {/* give it transparent background  */}
                                            <TableRow key={`perm-tab-row-${33}`}> 
                                                <TableCell size="small" width={"35%"} height={100} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 2}}>Project Description :</Typography>
                                                </TableCell>
                                                <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                                                    <Typography sx={{ mr: 3 }}>
                                                        {project.description?? ''}
                                                    </Typography>
                                                </TableCell>   
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <Divider sx={{ mt: 1, mb: 1}}/>    
                                </Card>
                            </Box>
                            <Divider sx={{ mt: 1, mb: 1, width: "100%" }}/>
   
                            <Card sx={{ textAlign: "center", height: "60vh", width: "97%", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 2, mb: 1, ml: 1, mr: 1, overflowY: "scroll"}} raised>
                                <Box >
                                    <Box sx={{mt: 1 }}>
                                        <Box>
                                            {
                                                genPropCtx.projOtherDescriptiveProps.map((prop: PropertyItem, index: number) => (
                                                    <Box key={`propbox-${index}`} display="flex" flexDirection="column" >
                                                        <Box>
                                                            <Table key={`tab-${index}`} sx={{ mt: 1, mb: 1, ml: 2, width: "98%"}}>
                                                                <TableBody>
                                                                    {/* give it transparent background  */}
                                                                    <TableRow key={`prop-tab-row-${index}`}> 
                                                                        <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0, borderRight: 1, borderColor: colors.grey[400]}}>
                                                                            <Typography sx={{ mr: 1}}>{prop.displayName}</Typography>
                                                                        </TableCell>
                                                                        <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                                                                            <Typography sx={{ mr: 2, ml: 1}}>
                                                                                {prop.value}
                                                                            </Typography>
                                                                        </TableCell>   
                                                                    </TableRow>
                                                                </TableBody>
                                                            </Table>
                                                            <Divider sx={{ mt: 1, mb: 1}}/>
                                                        </Box>
                                                    </Box>
                                                ))
                                            } 
                                        </Box>
                                    </Box>     
                                </Box>
                            </Card>
                            
                            <Divider sx={{ mt: 1, mb: 1, width: "100%" }}/>
   
                            <Card sx={{ textAlign: "center", height: "60vh", width: "97%", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 2, mb: 1, ml: 1, mr: 1, overflowY: "scroll"}} raised>
                                <Box >
                                    <Box sx={{mt: 1 }}>
                                        <Box>
                                            {
                                                genPropCtx.projKeyContactsProps.map((prop: PropertyItem, index: number) => (
                                                    <Box key={`propbox-${index}`} display="flex" flexDirection="column" >
                                                        <Box>
                                                            <Table key={`tab-${index}`} sx={{ mt: 1, mb: 1, ml: 2, width: "98%"}}>
                                                                <TableBody>
                                                                    {/* give it transparent background  */}
                                                                    <TableRow key={`prop-tab-row-${index}`}> 
                                                                        <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0, borderRight: 1, borderColor: colors.grey[400]}}>
                                                                            <Typography sx={{ mr: 1}}>{prop.displayName}</Typography>
                                                                        </TableCell>
                                                                        <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                                                                            <Typography sx={{ mr: 2, ml: 1}}>
                                                                                {prop.value}
                                                                            </Typography>
                                                                        </TableCell>   
                                                                    </TableRow>
                                                                </TableBody>
                                                            </Table>
                                                            <Divider sx={{ mt: 1, mb: 1}}/>
                                                        </Box>
                                                    </Box>
                                                ))
                                            } 
                                        </Box>
                                    </Box>     
                                </Box>
                            </Card>
                        </Box>
                    </Grid>
                    
                </Grid>}
            </Box>

            {simpleTextModalState && <SimpleTextDialog opened={simpleTextModalState} close={simpleTextModalActioner.close} {...simpleTextDialogProps as SimpleTextDialogProps}  />}
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            {propEditorModalState && <PropListEditorDialog opened={propEditorModalState} close={propEditorModalActioner.close} {...propEditorDialogProps as PropListEditorDialogProps} />}
            {projectSetupModalState && <ProjectSetupDialog opened={projectSetupModalState} close={projectSetupModalActioner.close} {...projectSetupDialogProps as ProjectSetupDialogProps} />}

        </Box>
    )

}

export default ProjectOverviewTab














    

    // useEffect(() => {
    //     setLoadingSpinnerCtx({enabled: true, text: "Retrieving AWG permissions for current project. Please wait..."} as LoadingSpinnerInfo)
    //     loadAWGStatusForLoggedInUser(loggedInUser as LoggedInUser, project._id?.toString() as string).then((user: LoggedInUser) => {
    //         setLoggedInUser(user);
    //     }).finally(() => { cancelLoadingSpinnerCtx() })
    // }, []);


    


// if(clonedProj) {
//     let deleteAndBail = false
//     if(clonedProj.contextProperties && clonedProj.contextProperties.length > 0) {
//         let permRolesConfData = clonedProj.contextProperties.find(a => a.name.toUpperCase() === CONF_PERMISSION_ROLES)?.value //NOTE: for new project, perm context is added to contextProps
//         if(permRolesConfData && permRolesConfData.length > 0) {
//             let usersPermRoleArray : BasicProperty[] = getInitPermRolesArray(permRolesConfData)
//             setLoadingSpinnerCtx({enabled: true, text: "Now setting up roles and permissions for the fresh copy. Please wait..."} as LoadingSpinnerInfo)
//             displayQuickMessage(UIMessageType.INFO_MSG, "Now setting up roles and permissions for the fresh copy. This will take some time. Please be patient...", 45000)
//             let permActionResult : QuickStatus = await setupPermissionsForProject(loggedInUser as LoggedInUser, clonedProj, usersPermRoleArray).finally(() => { cancelLoadingSpinnerCtx() })
//             if(permActionResult.isSuccessful === false) {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
//                 deleteAndBail = true
//             }
//         }
//         else {
//             displayQuickMessage(UIMessageType.ERROR_MSG, `Project creation was not successful. Permissions context was not retrieved.`);
//             deleteAndBail = true
//         }
//     }
//     else {
//         displayQuickMessage(UIMessageType.ERROR_MSG, `Project cloning was not successful. Permissions were not setup due to missing contextual information.`);
//         deleteAndBail = true
//     }

//     if(deleteAndBail) {
//         deleteProject(clonedProj._id.toString() as string);
//         return;
//     }
//     else {
//         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project cloning process completed")
//         setProject(clonedProj);
//         navigate(`/${ActionSceneEnum.PROJECT}/${clonedProj._id?.toString()}`) 
//     }
// }

//================================================================================

// if(clonedProj) {                        
//     let deleteAndBail = false
//     if(confPermissionRoles && confPermissionRoles.length > 0) {
//         setLoadingSpinnerCtx({enabled: true, text: "Now setting up roles and permissions for the fresh copy. Please wait..."} as LoadingSpinnerInfo)
//         let permActionResult : QuickStatus = await setupPermissionsForNewProject(loggedInUser as LoggedInUser, clonedProj, confPermissionRoles).finally(() => { cancelLoadingSpinnerCtx() })
//         if(permActionResult.isSuccessful === false) {
//             displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
//             deleteAndBail = true
//         }
//     }


//================================================


            // setLoadingSpinnerCtx({enabled: true, text: `Refreshing project progress/status info. Please wait...`})
            // getProjectStatusIndicators(projObj._id?.toString() as string).then((statusTimeLineInfo) => {
            //     setStatusTimeLineInfo(statusTimeLineInfo)
            // }).finally(() => cancelLoadingSpinnerCtx())

    //=======================================================




    // let viewableProps = getViewableProperties(project?.associatedProperties) ?? []
    // let projectHasProps = (viewableProps.length > 0) ? true : false
    // let projectDescProp = undefined;
    // let projectMaturityProp = undefined;
    // let projDescProps = new Array<PropertyItem>()
    // let projKeyContactsProps = new Array<PropertyItem>()

    // for(let i = 0; i < viewableProps.length; i++) {
    //     let prop = viewableProps[i] as PropertyItem
    //     let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
        
    //     if(prop.name.toLowerCase() === PROJECT_PROP_DESCRIPTION.toLowerCase()) {
    //         projectDescProp = prop;
    //     }
    //     else if(prop.name.toLowerCase() === PROJECT_PROP_MATURITY.toLowerCase()) {
    //         projectMaturityProp = prop;
    //     }
    //     else if(exportSettings && exportSettings.subType && exportSettings.subType.toUpperCase() === "KEY_CONTACTS") {
    //         projKeyContactsProps.push(prop)
    //     }
    //     else if(exportSettings && exportSettings.subType && exportSettings.subType.toUpperCase() === "PROJECT_DESCRIPTION") {
    //         projDescProps.push(prop)
    //     }
    //     else {
    //         projDescProps.push(prop)
    //     }
    // }

    // /================================================================================================================


// let awgName = getApproverWGName(params.projectId as string);
// if(store.loggedInUser && store.loggedInUser.perms && (store.loggedInUser.perms.has(awgName) === false)) {
//     store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving AWG permissions for current project. Please wait..."} as LoadingSpinnerInfo)
//     getPermissionAWGItemsForCurrentUser(store.loggedInUser as LoggedInUser, params.projectId as string).then((awgStatus : QuickStatus) => {
//         let awgName = awgStatus?.message;
//         let newLoggedInUser = rfdcCopy<LoggedInUser>(store.loggedInUser as LoggedInUser) as LoggedInUser
//         if(awgStatus && awgStatus.isSuccessful === true && awgName.trim().length > 0) {
//             newLoggedInUser.perms.set(awgName, awgName) //This indicates we have looked up this AWG and found that currently logged in user belongs to the group
//         }
//         else {
//             newLoggedInUser.perms.set(awgName, ""); //This indicates we have looked up this AWG and found nothing for logged in user
//         }
//         store.setLoggedInUser(newLoggedInUser);
//     })
//     .finally(() => { store.cancelLoadingSpinnerCtx() })
    
// }


// let permCtxConf : any = initConfigs.find(a => a.configName === CONFIGITEM__Permission_Context)?.configValue ?? undefined
// if(permCtxConf && permCtxConf.roles && permCtxConf.roles.length > 0) {
    // let usersPerRoleMapping = getInitPermRolesMap(permCtxConf.roles)