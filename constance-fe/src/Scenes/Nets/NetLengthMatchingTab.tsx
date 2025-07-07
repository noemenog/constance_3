import { Autocomplete, AutocompleteChangeDetails, AutocompleteChangeReason, Box, Button, Divider, FormControlLabel, Grid, IconButton, List, ListItem, ListItemIcon, ListItemText, Paper, Slide, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { ClearAllOutlined, FileUploadOutlined, LockOpenOutlined, LockOutlined, PlaylistAddCheckCircle } from "@mui/icons-material";
import MatchGroupDialog, { MatchGroupDialogProps } from "../../FormDialogs/MatchGroupDialog";
import { useDisclosure } from "@mantine/hooks";
import { BasicKVP, BasicProperty, ConfigItem, ConstraintConfDisplayContext, ConstraintConfExportContext, LoadingSpinnerInfo, LoggedInUser, MenuInfo, NetSummary, PropertyItem, SPDomainData } from "../../DataModels/HelperModels";
import { ConstraintPropertyCategoryEnum, DataMappingTypeEnum, PermissionActionEnum, ProjectPropertyCategoryEnum, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { Interface, Net, Netclass, Project } from "../../DataModels/ServiceModels";
import { GridCellKind, GridColumn, TextCell } from "@glideapps/glide-data-grid";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { clearAllNetPropertyValues, fetchProjectDetails, overrideNetPropertiesWithFileUpload, updateKeyProjectAspect } from "../../BizLogicUtilities/FetchData";
import { BASIC_GRID_HEADER_HEIGHT, BASIC_GRID_PAGE_SIZE, getLMGridCellContent, getLMGridColumns, LM_GRID_PAGE_SIZE, onLMEvaluateFillPattern, onLMGridCellEdited, onLMGridInitialDataFetch, onLMGridSubsequentDataFetch } from "../../BizLogicUtilities/BaseGridLogic";
import BaseGlideGrid, { GridCellEditCtx, GridDropDownOption, SpecialGridActionContext } from "../../CommonComponents/BaseGlideGrid";
import FileCaptureDialog, { FileCaptureDialogProps } from "../../FormDialogs/FileCaptureDialog";
import { FileWithPath, MIME_TYPES } from "@mantine/dropzone";
import { handleLockAction, isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import RightElement from "../../CommonComponents/RightElement";
import { getMostAppropriateConstraintValue } from "../../BizLogicUtilities/BasicCommonLogic";
import MenuListComposition from "../../CommonComponents/MenuListComposition";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";



interface NetLengthMatchingTabProps {
    netSummary: NetSummary,
    interfaceList: Interface[],
    netclasses: Netclass[],
    projectObj: Project,
}

const NetLengthMatchingTab: React.FC<NetLengthMatchingTabProps> = ({ netSummary, netclasses, interfaceList, projectObj }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const showRightElementOnGrid = useSpiderStore((state) => state.showRightElementOnGrid);
    const setShowRightElementOnGrid = useSpiderStore((state) => state.setShowRightElementOnGrid);

    const [project, setProject] = useState<Project>(projectObj as Project)
    
    const [lmSelectedNetInfo, setLMSelectedNetInfo] = useState<Map<BasicKVP, number>>(new Map<BasicKVP, number>());
    
    const [toggleFilterDropDowns, setToggleFilterDropDowns] = useState<boolean>(false);
    const [toggleDataCleared, setToggleDataCleared] = useState<boolean>(false);

    const [matchGroupDialogProps, setMatchGroupDialogProps] = useState<MatchGroupDialogProps>()
    const [matchGroupDialogModalState, matchGroupDialogModalActioner] = useDisclosure(false);

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

    const [fileCaptureModalState, fileCaptureModalActioner] = useDisclosure(false);
    const [fileCaptureDialogProps, setFileCaptureDialogProps] = useState<FileCaptureDialogProps>();

    const selectedInterfaceRef = useRef<string>(); //important that it starts off undefined
    const selectedNetclassRef = useRef<string>(); //important that it starts off undefined
    const interfaceMappingRef = useRef<Map<string, Interface>>(new Map<string, Interface>()); 
    const netclassMappingRef = useRef<Map<string, Netclass>>(new Map<string, Netclass>()); 

    const interfaceOptionsRef = useRef<string[]>([]);
    const netclassOptionsRef = useRef<string[]>([]);
    const matchGroupOptionsRef = useRef<GridDropDownOption[]>([]);

    const containerRef = useRef<any>();
    const lmGridRef = useRef<any>();
    const lmGridActionRef = useRef<SpecialGridActionContext<Net>|undefined>();

    const projectId = project?._id.toString() ?? "";


    useEffect(() => {
        placePageTitle("NetLengthMatching")
    }, []);
    

    useMemo(() => {
        let ifaceMap = new Map<string, Interface>();
        if(interfaceList && interfaceList.length > 0) {
            let sorted = [...interfaceList].sort((a, b) => a.name < b.name ? -1 : 1)  //https://stackoverflow.com/a/66256576
            for(let i = 0; i < sorted.length; i++) {
                ifaceMap.set(sorted[i].name, sorted[i])
            }
        }

        let ncMap = new Map<string, Netclass>();
        if(netclasses && netclasses.length > 0) {
            for(let i = 0; i < netclasses.length; i++) {
                ncMap.set(netclasses[i].name, netclasses[i])
            }
        }

        interfaceMappingRef.current = ifaceMap
        netclassMappingRef.current = ncMap

    }, [interfaceList, netclasses]);

    
    interfaceOptionsRef.current = (interfaceMappingRef && interfaceMappingRef.current && interfaceMappingRef.current.size > 0) 
        ? [''].concat(Array.from(interfaceMappingRef.current.keys())) 
        : [];


    netclassOptionsRef.current = useMemo(() => {
        let rVal = new Array<string>();
        if(selectedInterfaceRef && selectedInterfaceRef.current && selectedInterfaceRef.current.length > 0 && netclasses && netclasses.length > 0) {
            let selIfaceObj = interfaceMappingRef.current.get(selectedInterfaceRef.current) as Interface
            let ifaceNetclasses = netclasses.filter(a => a.interfaceId === selIfaceObj._id.toString());
            if(ifaceNetclasses && ifaceNetclasses.length > 0){
                let sorted = [...ifaceNetclasses].sort((a, b) => a.name < b.name ? -1 : 1) //https://stackoverflow.com/a/66256576
                rVal = [''].concat(sorted.map(x => x.name)) 
            }
        }
        return rVal
    }, [toggleFilterDropDowns]); 


    matchGroupOptionsRef.current = useMemo(() => {         
        return refreshMatchGroupOptions(project)
    }, [project]);


    useEffect(() => {
        if(lmGridActionRef && lmGridActionRef.current) {
            if((selectedInterfaceRef && selectedInterfaceRef.current !== undefined) || (selectedNetclassRef && selectedNetclassRef.current !== undefined)) {
                lmGridActionRef.current.reloadDataRows()
            }
        }
    }, [toggleFilterDropDowns]);
    

    //TODO: there must be a minimum width to each section! - otherwise tree item text gets bunched up
    const sectionStyle = useMemo(() => (
        { textAlign: "center", borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, m: 1, height: "81.5vh", backgroundColor: colors.primary[400] }
    ), []);


    useEffect(() => {         
        if(lmGridActionRef && lmGridActionRef.current){
            lmGridActionRef.current?.setRightElementEnablement(showRightElementOnGrid) 
            lmGridActionRef.current?.reloadDataRows()
        }
    }, [showRightElementOnGrid]);


    function onInterfaceSelectionChanged(event: any, value: string, reason: AutocompleteChangeReason, details?: AutocompleteChangeDetails<string> | undefined): void {
        if(value && value.trim().length > 0) {
            selectedInterfaceRef.current = value;
        }
        else {
            selectedInterfaceRef.current = "";
            selectedNetclassRef.current = "";
        }
        setToggleFilterDropDowns(!toggleFilterDropDowns)
    }

    function onNetclassSelectionChanged(event: any, value: string, reason: AutocompleteChangeReason, details?: AutocompleteChangeDetails<string> | undefined): void {
        selectedNetclassRef.current = value;
        setToggleFilterDropDowns(!toggleFilterDropDowns)
    }

    function getIdForSelectedInterface(): string | null {
        if(selectedInterfaceRef && selectedInterfaceRef.current && selectedInterfaceRef.current.length > 0) {
            if(interfaceMappingRef && interfaceMappingRef.current && interfaceMappingRef.current.has(selectedInterfaceRef.current)) {
                let rval = interfaceMappingRef.current.get(selectedInterfaceRef.current)?._id ?? null
                return rval;
            }
        }
        return null
    }

    function getIdForSelectedNetclass(): string | null {
        if(selectedNetclassRef && selectedNetclassRef.current && selectedNetclassRef.current.length > 0) {
            if(netclassMappingRef && netclassMappingRef.current && netclassMappingRef.current.has(selectedNetclassRef.current)) {
                let rval = netclassMappingRef.current.get(selectedNetclassRef.current)?._id ?? null
                return rval;
            }
        }
        return null
    }


    function handleMatchGroupSetup(): void {
        let initMGP = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))

        let mgdProps: MatchGroupDialogProps = {
            onFormClosed: onMatchGroupDataAvailable,
            title: "Setup Match Groups",
            contextualInfo: { key: "MATCH_GROUP_SETUP", value: initMGP },
        }
        setMatchGroupDialogProps(mgdProps)
        matchGroupDialogModalActioner.open()
    } 

    
    async function onMatchGroupDataAvailable(mgProps: BasicProperty[] | null, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key === "MATCH_GROUP_SETUP") {
            if(mgProps && mgProps.length > 0) {
                mgProps = mgProps.sort((a, b) => a.name < b.name ? -1 : 1);  //necessary...
                let newMatchGroupsProperty : PropertyItem;
                let existingMGProp = project?.associatedProperties?.find(a => (
                    a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))
                
                if(existingMGProp) {
                    newMatchGroupsProperty = {...existingMGProp};
                    newMatchGroupsProperty.value = mgProps;
                }
                else {
                    newMatchGroupsProperty = {
                        id: "",
                        name: ProjectPropertyCategoryEnum.MATCH_GROUP,
                        displayName : ProjectPropertyCategoryEnum.MATCH_GROUP,
                        category: ProjectPropertyCategoryEnum.MATCH_GROUP,
                        editable: false,
                        enabled: true,
                        value: mgProps,
                    } as PropertyItem
                }
                
                let updatedProj = await updateKeyProjectAspect(project?._id.toString() as string, ProjectPropertyCategoryEnum.MATCH_GROUP, newMatchGroupsProperty)
                if(updatedProj) {
                    setProject(updatedProj);
                    displayQuickMessage(UIMessageType.SUCCESS_MSG, "Match group update process completed")
                }
            }
        }
    }


    function refreshMatchGroupOptions(project: Project) {
        let mgProp = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))
        let matchGroupProps = mgProp?.value ?? []
        let opts = new Array<GridDropDownOption>();
        for(let mgp of matchGroupProps) {
            if(mgp.name && mgp.id && mgp.name.length > 0) {
                opts.push({label: mgp.name, value: mgp.id} as GridDropDownOption) 
            }
        }
        return opts;
    }


    //================================================ GRID INPUTS =============================
    const relevantProps = useMemo(() => {         
        let relevantProps = new Map<string, PropertyItem>();
        let netConstrSettings = project.constraintSettings?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase())
        if(!netConstrSettings || netConstrSettings.length === 0) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Length matching properties/settings were not found for project`)
        }
        else {
            for(let i = 0; i < netConstrSettings.length; i++) {
                let prop = netConstrSettings[i] as PropertyItem
                let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
                if(prop.enabled === true) {
                    if(displaySettings && displaySettings.subType && displaySettings.subType.toLowerCase() === "lengthmatching") {
                        relevantProps.set(prop.name, prop)
                    }
                }
            }
        }
        return relevantProps
    }, []);


    const lmGridColumns = useMemo(() => {         
        let cols = getLMGridColumns(relevantProps)
        return cols
    }, [relevantProps]);


    function onLMGridSelectionChanged(selectedNetIdsMap: Map<string, number>): void {
        if(lmGridActionRef && lmGridActionRef.current && selectedNetIdsMap && selectedNetIdsMap.size > 0) {
            let map = new Map<BasicKVP, number>();
            for (let [key, value] of selectedNetIdsMap) {
                let netObj = lmGridActionRef.current.getDataAtIndex(value)
                map.set({key: key, value: netObj?.name } as BasicKVP, value)
            }
            setLMSelectedNetInfo(map)
        }
        else {
            setLMSelectedNetInfo(new Map<BasicKVP, number>())
        }
    }


    function onLMGridSelectionCleared(): void {
        setLMSelectedNetInfo(new Map<BasicKVP, number>())
    }


    async function onGridCellValueChangeCompleted(rowIndex?: number, columnIndex?: number): Promise<void> {
        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Value change completed")
    }


    async function handleLMGridCellEdited(editCtx: GridCellEditCtx<Net>, forceReload : boolean = false) {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CHANGE_LM_VALUES) === false) { return; }

        if(editCtx.columnElement.id && editCtx.columnElement.id.length > 0 && relevantProps && relevantProps.size > 0) {
            let prop: PropertyItem = relevantProps.get(editCtx.columnElement.id) as PropertyItem;
            if(prop) {
                let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
                if(exportSettings && exportSettings.setToDiffPairEntity && exportSettings.setToDiffPairEntity === true) {
                    if(editCtx.current.diffPairMapType === DataMappingTypeEnum.Unmapped){
                        displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot change value of diff-pair related net property '${editCtx.columnElement.title}'. The net (${editCtx.current.name}) is not currently paired`)
                        return undefined;
                    }
                    else {
                        let updatedNet = await onLMGridCellEdited(editCtx, editCtx.current.diffPairNet)
                        if(updatedNet) {
                            onGridCellValueChangeCompleted()
                            lmGridActionRef?.current?.reloadDataRows()
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to update value of net property '${editCtx.columnElement.title}'.`)
                        }

                        return undefined;
                    }
                }
            }
        }

        let updatedNet = await onLMGridCellEdited(editCtx, null)
        if(forceReload) {
            lmGridActionRef?.current?.reloadDataRows()
        }
        return updatedNet;
    }



    async function onLMGridRightElementRetrieval(rowEntry: Net, columns: GridColumn[], columnIndex: number, rowIndex: number): Promise<JSX.Element | undefined> {
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
                let editCtx : GridCellEditCtx<Net> = {
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

                handleLMGridCellEdited(editCtx, true).then(net => {
                    if(net) {
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
                <RightElement projectId={projectId} rowEntryId={rowEntryId} dataEntryKeyName={dataEntryKeyName} panelHeight={`63vh`}
                    dataEntryId={dataElement.id} groupValue={rowEntry.name} groupLabel={"NET"} onRevertCellData={onRevertCellData} />
            </>
        );
    }



    function handleUploadNetProps(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPLOAD_LM_VALUES) === false) { return; }
        let fileCaptureDialogProps: FileCaptureDialogProps = {
            onFormClosed: onFileCaptureDataAvailable,
            title: "Upload NetList file(s)",
            warningText: `Please upload a modified version of the Netlist file that was downloaded from the 'reports' section Project Overview page. `
            + `Warning: imported values will override existing values. Incoming blank values will essentially remove existing values. `
            + `Uploaded file must have the expected column headers (same as what was downloaded). Processing may take a while. Please be patient.`,
            finishButtonText: "Submit",
            acceptedFileTypes: [MIME_TYPES.xlsx],
            maxFileCount: 1,
            contextualInfo: { key: "NET_DATA_UPLOAD", value: null },
        }
        setFileCaptureDialogProps(fileCaptureDialogProps)
        fileCaptureModalActioner.open()
    }


    function onFileCaptureDataAvailable(inputFiles: FileWithPath[] | null, contextualInfo: BasicKVP): void {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "NET_DATA_UPLOAD") {
                if(inputFiles && inputFiles.length > 0) {
                    for(let i = 0; i < inputFiles.length; i++) {
                        let focusFile = inputFiles[i];
                        if(focusFile.name.toLowerCase().trim().endsWith(".xlsx") === false) {
                            displayQuickMessage(UIMessageType.ERROR_MSG, `Error! Net information file type/extension is not acceptable. FileName: '${focusFile.name}'`)
                            return;
                        }
                    }

                    setLoadingSpinnerCtx({enabled: true, text: `Now processing net information file(s). Please be patient. This may take some time...`})
                    overrideNetPropertiesWithFileUpload(project, inputFiles[0], "LengthMatching").then((res: any) => {
                        if(res) {
                            fetchProjectDetails(project?._id.toString() as string).then((proj: Project) => {
                                if(proj) {
                                    setProject(proj);
                                    displayQuickMessage(UIMessageType.SUCCESS_MSG, `Processing of Net properties udata upload has completed`)    
                                }
                            });

                            if(lmGridActionRef && lmGridActionRef.current) {
                                lmGridActionRef.current.reloadDataRows()
                            }
                        } 
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
                    })
                }
            }
        }
    }


    
    useEffect(() => {
        if(lmGridActionRef && lmGridActionRef.current) {
            lmGridActionRef.current.reloadDataRows()
        }
    }, [toggleDataCleared]);

    function handleClearAllNetPropertyValues(): void {
        let confirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Are you sure you want to delete LM and other property values for ALL nets?`,
            warningText_other: "Any existing Match-Groups will remain, but will not be assigned to nets!",
            actionButtonText: "Proceed",
            contextualInfo:  { key: "CLEAR_NET_PROP_VALUES", value: null },
        }
        setConfirmationDialogProps(confirmData)
        confirmationModalActioner.open()
    }


    async function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "CLEAR_NET_PROP_VALUES") {
                if(action === ConfirmationDialogActionType.PROCEED) {
                    setLoadingSpinnerCtx({enabled: true, text: `Now clearing all net property values. Please wait...`})
                    clearAllNetPropertyValues(project?._id.toString() as string).then((res) => {
                        if(res) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Net updates successfully initiated!`)
                            //a little bit of delay is needed here
                            setTimeout(() => {
                                setToggleDataCleared(!toggleDataCleared)
                            }, 1000)
                        }
                        else{
                            displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to successfully clear net property values!`)
                        }
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``})
                    })
                }
            }
        }
    }


    async function processProjectLockAndUnlock(): Promise<void> {
        let updatedProj = await handleLockAction(project, loggedInUser)
        if(updatedProj && updatedProj._id) {
            setProject(updatedProj);
        }
    }


    function onRightElementEnablementChanged(checked: boolean): void {
        setShowRightElementOnGrid(checked);
    }


    function getSubMenuItems() : Array<MenuInfo> {
        let menuArr = new Array<MenuInfo>();
        
        menuArr.push({
            label: "MatchGroup Setup",
            icon: <PlaylistAddCheckCircle />,
            callbackAction: (kvp: BasicKVP) => { handleMatchGroupSetup() }
        });

        menuArr.push({
            label: "Upload & Override LM Info",
            icon: <FileUploadOutlined />,
            indicateWarning: true,
            callbackAction: (kvp: BasicKVP) => { handleUploadNetProps() }
        });


        menuArr.push({
            label: "Clear All Net Property Values",
            icon: <ClearAllOutlined />,
            indicateWarning: true,
            callbackAction: (kvp: BasicKVP) => { handleClearAllNetPropertyValues() }
        });

        menuArr.push({
            label: (project && project.lockedBy && project.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`,
            icon: (project && project.lockedBy && project.lockedBy.length > 0)
                ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
                : <LockOpenOutlined fontSize="large" color="secondary"/>,
            callbackAction: (kvp: BasicKVP) => { processProjectLockAndUnlock() }
        });

        menuArr.push({
            label: "",
            icon: 
                <FormControlLabel 
                    control={ <Switch 
                        size="small"
                        sx={{ mr: 1, backgroundColor: undefined}} 
                        checked={showRightElementOnGrid}
                        onChange={(e, checked) => onRightElementEnablementChanged(checked)}
                    />} 
                    label={(showRightElementOnGrid) ? `Hide Change-History Panel` : `Show Change-History Panel`} 
                />,
            callbackAction: (kvp: BasicKVP) => { onRightElementEnablementChanged(showRightElementOnGrid) }
        });

        return menuArr;
    }






    return (
        <Box>
            <Box sx={{ height: "80vh", mt: 1.2}} ref={containerRef}>
                <Box minWidth={1200} minHeight="83vh" display="flex" flexDirection="column" sx={sectionStyle}>
                    
                    <Slide timeout={{ enter: 1000, exit: 1000 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{width: "98%", ml: 1, mr: 1, mt: 2, mb: 1}}/>
                    </Slide>
                    
                    <Slide direction="left" in={true} container={containerRef.current}>
                        <Box display="flex" flexDirection="row" sx={{ ml: 3 }} gap={2}>
                            <Autocomplete 
                                onChange={onInterfaceSelectionChanged}
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                disableClearable
                                size="small"
                                id="cb-iface"
                                sx={{ minWidth: 275 }}
                                options={interfaceOptionsRef.current ?? []}
                                value={selectedInterfaceRef?.current ?? ''}
                                renderInput={(params: any) => 
                                    <TextField {...params} value={''} size="small" label="Select Interface" />
                                }
                            />
                            <Autocomplete 
                                onChange={onNetclassSelectionChanged}
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                disableClearable
                                size="small"
                                id="cb-netclass"
                                sx={{ minWidth: 275 }}
                                options={netclassOptionsRef.current ?? []}
                                value={selectedNetclassRef?.current ?? ''}
                                renderInput={(params: any) => 
                                    <TextField {...params} value={''} size="small" label="Select Netclass" />
                                }
                            />

                            <Divider orientation="vertical" sx={{height: 35, marginLeft: 4, marginRight: 2 }} />

                            <MenuListComposition menuItems={getSubMenuItems()} tooltipTitle={"Show/hide settings pertaining to Length-Matching"} iconSize="medium"/>

                            <Divider orientation="vertical" sx={{height: 35, marginLeft: 2, marginRight: 4 }} />

                        </Box>
                    </Slide>
                    
                    <Slide timeout={{ enter: 1000, exit: 1000 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{width: "98%", ml: 1, mr: 1, mt: 1, mb: 0}}/>
                    </Slide>
                    
                    <Box>
                        <BaseGlideGrid<Net> 
                            excludePortal={false}
                            gridHeight={"69vh"}
                            headerHeight={BASIC_GRID_HEADER_HEIGHT}
                            gridRef={lmGridRef}
                            columns={lmGridColumns}
                            pageSize={LM_GRID_PAGE_SIZE}
                            totalRowCount={netSummary?.totalNets ?? 0}
                            enableFillHandle={true}
                            gridMarginRight={-4}
                            multiRowSelectionEnabled={true}
                            maxRowSelectionCount={Number.MAX_SAFE_INTEGER}
                            enableSearchField={true}
                            showActionButton={false}
                            isActionClickAllowed={ false }
                            actionButtonText={""}
                            actionButtonWidth={160}
                            reloadAfterActionClick={true}
                            cellEditConfirmationColumns={undefined}
                            groupRowLines={undefined}
                            rightElementEnablementInitValue={showRightElementOnGrid}
                            onGetRightElementContent={onLMGridRightElementRetrieval}
                            onEvaluateFillPattern={onLMEvaluateFillPattern}
                            onGetRowGroupCellContent={undefined}
                            onActionButtonClick={undefined}
                            onGridCellEdited={handleLMGridCellEdited}
                            onGridCellValueChangeCompleted={onGridCellValueChangeCompleted}
                            onGetGridCellContent={(rowEntry, columns, columnIndex, isGroupHeader, rowIndex) => getLMGridCellContent(relevantProps, matchGroupOptionsRef.current, rowEntry, columns, columnIndex)} 
                            onGridSelectionChanged={(gridSelection, selectedIds) => onLMGridSelectionChanged(selectedIds)}
                            onGridSelectionCleared={onLMGridSelectionCleared}
                            onFetchFirstSetData={(limit, filterText) => onLMGridInitialDataFetch(projectId, limit, filterText, getIdForSelectedInterface(), getIdForSelectedNetclass())}
                            onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => onLMGridSubsequentDataFetch(projectId, lastId, limit, filterText, getIdForSelectedInterface(), getIdForSelectedNetclass())}  
                            specialGridActionRef={lmGridActionRef}
                        />
                    </Box>

                </Box>
            </Box>

            {matchGroupDialogModalState && <MatchGroupDialog opened={matchGroupDialogModalState} close={matchGroupDialogModalActioner.close} {...matchGroupDialogProps as MatchGroupDialogProps} />}
            {fileCaptureModalState && <FileCaptureDialog opened={fileCaptureModalState} close={fileCaptureModalActioner.close} {...fileCaptureDialogProps as FileCaptureDialogProps}  />}
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
             
        </Box>
    );
}

export default NetLengthMatchingTab



















//====================================


                            {/* <SpButton
                                onClick={handleMatchGroupSetup}
                                key={`lmb-1`}
                                startIcon={<PlaylistAddCheckCircle />}
                                sx={{ width:200, height: 35 }}
                                label="MatchGroup Setup" 
                            />

                            <Slide timeout={{ enter: 500, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 35, marginLeft: 1, marginRight: 1 }} />
                            </Slide>

                             <Tooltip key={`lmb-up-tt`} placement="right" title={`Click here to upload a modified NetList excel document. `
                                + `You may download the document from the 'Reports' section of the 'Project Home' page.`}>
                                <span>
                                    <SpButton
                                        intent="caution"
                                        onClick={handleUploadNetProps}
                                        key={`lmb-2`}
                                        startIcon={<FileUploadOutlined />}
                                        sx={{ width:200, height: 35 }}
                                        label="Upload & Override LM Info"
                                    />                    
                                </span>
                            </Tooltip>



                            <Slide timeout={{ enter: 500, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 35, marginLeft: 1, marginRight: 1}} />
                            </Slide>
                            
                            <Tooltip placement="top" title={(project && project.lockedBy && project.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`}>
                                <IconButton sx={{ mt: -.5, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} onClick={processProjectLockAndUnlock}>
                                    {(project && project.lockedBy && project.lockedBy.length > 0)
                                        ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
                                        : <LockOpenOutlined fontSize="large" color="secondary"/>
                                    }
                                </IconButton>
                            </Tooltip>

                            <Slide timeout={{ enter: 500, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 35, marginLeft: 1, marginRight: 1 }} />
                            </Slide>

                            <Tooltip placement="top" title={(showRightElementOnGrid) ? `Hide right panel on grid` : `Show right panel on grid`}>
                                <Switch 
                                    size="small"
                                    sx={{ mt: 1, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} 
                                    checked={showRightElementOnGrid}
                                    onChange={onRightElementEnablementChanged} 
                                />
                            </Tooltip> */}

//==========================================




// if(confConstraintProps && confConstraintProps.length > 0) {
//             for(let i = 0; i < confConstraintProps.length; i++) {
//                 let confItem = confConstraintProps[i] as PropertyItem
//                 let displaySettings : ConstraintConfDisplayContext = confItem.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
//                 if(displaySettings && displaySettings.subType && displaySettings.subType.toLowerCase() === "lengthmatching") {
//                     relevantProps.set(confItem.name, confItem)
//                 }
//             }
//         }
//         else {
//             displayQuickMessage(UIMessageType.ERROR_MSG, `Configured length matching properties were not found. Please check config management system for '${CONFIGITEM__Net_Constraint_Properties}'`)
//         }




//    let relevantProps = new Map<string, PropertyItem>(); 
       
    //    (async function fetchConstrConf() {
    //         if(!confConstraintProps || (confConstraintProps.length === 0)) {
    //             setLoadingSpinnerCtx({enabled: true, text: "Retrieving constraint configurations. Please wait..."} as LoadingSpinnerInfo)
    //             let constrSettings: PropertyItem[] = await getConstraintProperties(project?._id as string, project?.org as string).finally(() => { cancelLoadingSpinnerCtx() })
    //             if(constrSettings) {
    //                 setConfConstraintProps(constrSettings ?? [])
    //                 for(let i = 0; i < constrSettings.length; i++) {
    //                     let confItem = constrSettings[i] as PropertyItem
    //                     let displaySettings : ConstraintConfDisplayContext = confItem.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
    //                     if(displaySettings && displaySettings.subType && displaySettings.subType.toLowerCase() === "lengthmatching") {
    //                         relevantProps.set(confItem.name, confItem)
    //                     }
    //                 }
    //             }
    //             else {
    //                 displayQuickMessage(UIMessageType.ERROR_MSG, `Configured length matching properties were not found. Please check config management system for '${CONFIGITEM__Net_Constraint_Properties}'`)
    //             }
    //         }
    //         else {
    //             for(let i = 0; i < confConstraintProps.length; i++) {
    //                 let confItem = confConstraintProps[i] as PropertyItem
    //                 let displaySettings : ConstraintConfDisplayContext = confItem.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
    //                 if(displaySettings && displaySettings.subType && displaySettings.subType.toLowerCase() === "lengthmatching") {
    //                     relevantProps.set(confItem.name, confItem)
    //                 }
    //             }
    //         }
    //     })();
        
        
        // if(confConstraintProps && confConstraintProps.length > 0) {
        //     for(let i = 0; i < confConstraintProps.length; i++) {
        //         let confItem = confConstraintProps[i] as PropertyItem
        //         let displaySettings : ConstraintConfDisplayContext = confItem.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
        //         if(displaySettings && displaySettings.subType && displaySettings.subType.toLowerCase() === "lengthmatching") {
        //             relevantProps.set(confItem.name, confItem)
        //         }
        //     }
        // }
        // else {
            
        // }


        
//=========================================

   
    // const matchGroupOptions = useMemo(() => {         
    //     let mgProp = project?.associatedProperties?.find(a => (
    //         a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))
        
    //     let matchGroupProps = mgProp?.value ?? []
    //     let opts = new Array<GridDropDownOption>();
    //     for(let mgp of matchGroupProps) {
    //         if(mgp.name && mgp.id && mgp.name.length > 0) {
    //             opts.push({label: mgp.name, value: mgp.id} as GridDropDownOption) 
    //         }
    //     }
    //     return opts;
    // }, [project]);


    
    // useEffect(() => {
    //     if(lmGridActionRef && lmGridActionRef.current) {
    //         lmGridActionRef.current.reloadDataRows()
    //     }
    // }, [matchGroupOptions]);


    // useEffect(() => {
    //     refreshMatchGroupOptions(project)
    // }, [project]);








    

    // useEffect(() => {
    //     let mgProps = project?.associatedProperties?.find(a => (
    //         a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP)) ?? []
    //     if(mgProps && mgProps.length > 0) {
    //         matchGroupOptionsRef.current = mgProps.map((a: PropertyItem) => a.name)
    //     }
    // }, [project]);

    







                // if(confItem.contextProperties && confItem.contextProperties.some(a => a.name.toLowerCase() === "display_context" && a.value.subType && a.value.subType.toLowerCase() === "lengthmatching")){
                //     relevantProps.set(confItem.name, confItem)
                // }


                

    // const columns = useMemo(() => {           
    //     let netNameCol = { 
    //         id: NET_NAME_GRID_COLUMN_ID, 
    //         title: "Net Name", 
    //         icon: GridColumnIcon.HeaderString,
    //         allowWrapping: true,  //https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--wrapping-text
    //         width: 300
    //     }

    //     let arr = new Array<GridColumn>(netNameCol) 

    //     if(netPropNamesMap && netPropNamesMap.size > 0) {
    //         for (let [name, displayName] of netPropNamesMap) {
    //             let item = { 
    //                 id: name, 
    //                 title: displayName ?? '', 
    //                 allowWrapping: true,
    //                 icon: GridColumnIcon.HeaderString,
    //             };
    //             arr.push(item)
    //         }
    //     }

    //     return arr
    // }, []);




    // const onContextMenuDataAvailable = useCallback((contextualInfo: BasicKVP) => {
    //     console.error("NOT YET IMPLEMENTED - context menu callback")
    // }, [])



    // let cellContextMenuInfo : MenuInfo[] = [
    //     {
    //         label: "Show change history",
    //         icon: <ChangeHistory />,
    //         callbackAction: onContextMenuDataAvailable,
    //         contextualInfo: {key: "CHANGE_HISTORY", value: null } as BasicKVP
    //     },
    //     {
    //         label: "Do Some other task - skfnsjfnksjkdfkbhkjbkjbkjbs",
    //         icon: <Person2Outlined />,
    //         callbackAction: onContextMenuDataAvailable,
    //         contextualInfo: {key: "CHANGE_HISTORY", value: null } as BasicKVP
    //     },
        
    // ]

    
    