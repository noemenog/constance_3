// import { Autocomplete, Box, Button, Divider, FormControlLabel, Grid, IconButton, Paper, Slide, Switch, TextField, Tooltip, Typography } from "@mui/material";
// import { ChangeEvent, MouseEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
// import { themeDarkBlue, tokens } from "../../theme";
// import { useTheme } from "@mui/material/styles";
// import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
// import { BakeryDiningOutlined, Cancel, ClearAllOutlined, CopyAllOutlined, DeleteSweepOutlined, EditNoteOutlined, ExitToAppOutlined, FullscreenExitOutlined, FullscreenOutlined, GridViewOutlined, GroupWorkOutlined, LockOpenOutlined, LockOutlined, PlaylistAddCheckCircle, PlaylistAddCheckOutlined, PlaylistAddOutlined, Settings, SettingsOverscanOutlined, Telegram, Visibility, VisibilityOutlined, WorkspacesOutlined } from "@mui/icons-material";
// import { C2CRow, C2CRowSlot, G2GRelationContext, Interface, LayerGroupSet, LinkageInfo, Netclass, PackageLayout, Project, RuleArea } from "../../DataModels/ServiceModels";
// import { useCStore } from "../../DataModels/ZuStore";
// import { BasicKVP, BasicProperty, PropertyItem, CDomainData, DisplayOption, LoggedInUser, MenuInfo, LoadingSpinnerInfo, StatusIndicatorItem, PollingInfoContext } from "../../DataModels/HelperModels";
// import { MultiTextEntryField } from "../../CommonComponents/MultiTextEntryField";
// import { ActionSceneEnum, BASIC_NAME_VALIDATION_REGEX, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_RED_COLOR, UIMessageType, NamingContentTypeEnum, PermissionActionEnum, ConstraintTypesEnum, KeyProjectAspectTypeEnum, CLEARANCE_PAGE_URL_SUFFIX, PendingProcessActionTypeEnum, ProjectPropertyCategoryEnum } from "../../DataModels/Constants";
// import { ColDef, ColGroupDef, GridApi, NewValueParams } from "ag-grid-community";
// import { verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
// import { AgGridReact } from "ag-grid-react";
// import { clearClassRelationsForRuleArea, copyOverConstraints, fetchG2GContextList, fetchInterfaceList, fetchProjectDetails, processG2GUpdates, updateKeyProjectAspect, updateNetclasses, updateProject } from "../../BizLogicUtilities/FetchData";
// import BaseGlideGrid, { GridCellEditCtx, GridDropDownOption, SpecialGridActionContext } from "../../CommonComponents/BaseGlideGrid";
// import { BASIC_GRID_HEADER_HEIGHT, C2C_GRID_PAGE_SIZE, getClasToClassGridCellContent, getClasToClassGridColumns, onClassToClassGridGetToolTipText, onClasToClassEvaluateFillPattern, onClasToClassGridCellEdited, onClasToClassGridInitialDataFetch } from "../../BizLogicUtilities/BaseGridLogic";
// import { useDisclosure } from "@mantine/hooks";
// import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
// import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
// import C2CAxisVisibilityDialog, { C2CAxisVisibilityDialogProps } from "../../FormDialogs/C2CAxisVisibilityDialog";
// import { handleLockAction, isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
// import { sort } from "fast-sort";
// import { GridCellKind, GridColumn } from "@glideapps/glide-data-grid";
// import RightElement from "../../CommonComponents/RightElement";
// import { DropdownCellType } from "@glideapps/glide-data-grid-cells";
// import G2GLayoutDialog, { G2GLayoutDialogProps } from "../../FormDialogs/G2GLayoutDialog";
// import ConstraintEditorDialog, { ConstraintEditorDialogProps } from "../../FormDialogs/ConstraintEditorDialog";
// import MenuListComposition from "../../CommonComponents/MenuListComposition";
// import LinkageManagementDialog, { LinkageManagementDialogProps } from "../../FormDialogs/LinkageManagementDialog";
// import AsciiTextComp from "../../CommonComponents/AsciiText";
// import useSWR from 'swr'
// import { fetcher } from "../../BizLogicUtilities/BasicCommonLogic";


// interface BucketDetailsProps {
    
// }

// const BucketDetails: React.FC<BucketDetailsProps> = ({ }) => {
//     const theme = useTheme();
//     const colors = tokens(theme.palette.mode);
//     const navigate = useNavigate();
//     const domainData = useLoaderData() as CDomainData;
//     const pkgLayout = domainData.packageLayout as PackageLayout;
//     const projObj = domainData.project as Project;
//     const c2cEnabledColumnToIndexMap = domainData.c2cColToIndexMap;
//     const seltdRA = domainData.selectedRuleArea;
//     const ifaceList = domainData.interfaceList;
//     const ncList = domainData.netclasses;

//     const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
//     const placePageTitle = useCStore((state) => state.placePageTitle);
//     const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
//     const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
//     const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
//     const showRightElementOnGrid = useCStore((state) => state.showRightElementOnGrid);
//     const setShowRightElementOnGrid = useCStore((state) => state.setShowRightElementOnGrid);
//     const setIsLoadingBackdropEnabled = useCStore((state) => state.setIsLoadingBackdropEnabled);

//     const [project, setProject] = useState<Project>(projObj);
//     const [netclasses, setNetclasses] = useState<Netclass[]>(ncList);
//     const [interfaceList, setInterfaceList] = useState<Interface[]>(ifaceList);
//     const [packageLayout, setPackageLayout] = useState<PackageLayout>(pkgLayout);
//     const [clrRelationsProps, setClrRelationsProps] = useState(new Array<BasicProperty>())
//     const [gridApi, setGridApi] = useState<GridApi>();

//     const [classToClassSelectedRowInfo, setClassToClassSelectedRowInfo] = useState<Map<BasicKVP, number>>(new Map<BasicKVP, number>());

//     const [selectedRuleArea, setSelectedRuleArea] = useState<RuleArea|null>(seltdRA)
//     const [showRuleNameGrid, setShowRuleNameGrid] = useState<boolean>(true);
//     const [expandShrinkLabel, setExpandShrinkLabel] = useState<string>("Exapand");


//     const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
//     const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

//     const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
//     const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()

//     const [axisVisibilityModalState, axisVisibilityModalActioner] = useDisclosure(false);
//     const [axisVisibilityDialogProps, setAxisVisibilityDialogProps] = useState<C2CAxisVisibilityDialogProps>();

//     const [constraintEditorDialogModalState, constraintEditorDialogModalActioner] = useDisclosure(false);
//     const [constraintEditorDialogProps, setConstraintEditorDialogProps] = useState<ConstraintEditorDialogProps>();

//     const [g2gLayoutModalState, g2gLayoutModalActioner] = useDisclosure(false);
//     const [g2gLayoutDialogProps, setG2GLayoutDialogProps] = useState<G2GLayoutDialogProps>();

//     const [linkageManagementModalState, linkageManagementModalActioner] = useDisclosure(false);
//     const [linkageManagementDialogProps, setLinkageManagementDialogProps] = useState<LinkageManagementDialogProps>();

//     const classToClassGridRef = useRef<any>();
//     const classToClassGridActionRef = useRef<SpecialGridActionContext<C2CRow>|undefined>();
//     const containerRef = useRef<HTMLElement>(null);  //important!
//     const containerRef2 = useRef<HTMLElement>(null);  //important!
//     const validClrRelationsOptionsRef = useRef<GridDropDownOption[]>([]);
//     const validClrRelationsOptsAsMapRef = useRef<Map<string, string>>(new Map<string, string>());

//     const projectId = project?._id.toString() ?? "";


//     //======================================== Polling ==================================== 
//     const [procStartTime, setProcStartTime] = useState<number | null>(null);
//     const [enableProcPolling, setEnableProcPolling] = useState<boolean>(false);

//     let pollCtx : PollingInfoContext = {
//         type: PendingProcessActionTypeEnum.G2G_UPDATE,
//         mainMessageOnProc: `C2C update initiated via G2G context. Processing can take up to 5 minutes depending on number of netclasses involved. Please be patient. Stay tuned for completion of processing...`,
//         spinnerMessageOnProc: `Checking/handling C2C updates. Please wait...`,
//         messageOnCompletion: `C2C updated via G2G context.`,
//         messageOnError: `Could not successfully perform C2C updates via G2G context`,
//         setBackdropBlocker: true,
//         actionOnCompletion : () => { navigate(`/${ActionSceneEnum.C2CLAYOUT}/${projectId}/${selectedRuleArea?.id.toString() || ''}`) },
//         setStateChange: setEnableProcPolling,
//         getStartTime: () => { return procStartTime }
//     }

//     const { data, error, isLoading } = useSWR(enableProcPolling ? projectId: null, (key: any) => fetcher(key, pollCtx), { refreshInterval: 7000, revalidateOnMount : true})
//     //======================================================================================
    


//     useEffect(() => {
//         placePageTitle("c2cLayout")
//     }, []);


//     //Important!
//     useEffect(() => {
//         if(seltdRA && seltdRA.id && seltdRA.ruleAreaName && seltdRA.ruleAreaName.length > 0) {
//             setSelectedRuleArea(seltdRA);
//         }
//     }, [seltdRA]);



//     useEffect(() => {
//         if(project?.clearanceRelationBrands && project.clearanceRelationBrands.length > 0){
//             setClrRelationsProps([...project.clearanceRelationBrands]);
            
//             let map = new Map<string, string>();
//             let opts = new Array<GridDropDownOption>();
//             project.clearanceRelationBrands.forEach(x => {
//                 //Important! only take those where LGSet has been selected/specified by user
//                 if(x.value && x.value.length > 0) {
//                     map.set(x.id, x.name)
//                     opts.push({label: x.name, value: x.id} as GridDropDownOption) 
//                 }
//             });
//             validClrRelationsOptsAsMapRef.current = map;
//             validClrRelationsOptionsRef.current = opts;
//         }
        
//     }, [project]);


//     //handle cases where clr relation name has been added or removed
//     useEffect(() => {
//         let existingRelationsProps = project?.clearanceRelationBrands ?? [];
        
//         if(existingRelationsProps && existingRelationsProps.length === clrRelationsProps.length) {
//             return;
//         }

//         if((!existingRelationsProps || existingRelationsProps.length === 0) && clrRelationsProps.length > 0) {
//             handleClrRelationsNameSave()
//         }
//         else if (existingRelationsProps && existingRelationsProps.length > 0) {
//             if(clrRelationsProps.length > 0 && existingRelationsProps.length !== clrRelationsProps.length){
//                 handleClrRelationsNameSave()
//             }
//         }
//         if(classToClassGridActionRef && classToClassGridActionRef.current) {
//             classToClassGridActionRef.current?.reloadDataRows()
//         }
//     }, [clrRelationsProps]);


//     useEffect(() => {         
//         if(classToClassGridActionRef && classToClassGridActionRef.current){
//             classToClassGridActionRef.current?.setRightElementEnablement(showRightElementOnGrid) 
//             classToClassGridActionRef.current?.reloadDataRows()
//         }
//     }, [showRightElementOnGrid]);


//     const knownLayerGroupSets = useMemo(() => {
//         let map = new Map<string, string>()
//         let lgSets : LayerGroupSet[] = packageLayout?.layerGroupSets ?? []
//         for(let i = 0; i < lgSets.length; i++) {
//             map.set(lgSets[i].id, lgSets[i].name)
//         }
//         return map;
//     }, []);


//     const lgSetInfo : BasicKVP = useMemo(() => {
//         let gldLGSet = packageLayout?.layerGroupSets?.find((a: LayerGroupSet) => (a.isGolden === true));
//         let hasGoldenLayerGroups = (gldLGSet && gldLGSet.layerGroups && gldLGSet.layerGroups.length > 0) ? true : false;
        
//         let defaultClrLGSet = ''
//         let lgSets : LayerGroupSet[] = packageLayout?.layerGroupSets ?? []
//         for(let i = 0; i < lgSets.length; i++) {
//             if(lgSets[i].isClearanceDefault === true) {
//                 defaultClrLGSet = lgSets[i].id
//             }
//         }
//         if(!defaultClrLGSet || defaultClrLGSet.length === 0) {
//             defaultClrLGSet = gldLGSet?.id || '';
//         }

//         let res : BasicKVP = { key: defaultClrLGSet, value: hasGoldenLayerGroups }
//         return res;
//     }, [packageLayout]);


//     const defaultColDef = useMemo(() => {
//         return {
//             flex: 1,
//         };
//     }, []);


    
//     const ifaceMapping = useMemo(() => {         
//         let map = new Map<string, string>();
//         for(let iface of interfaceList) {
//             map.set(iface._id, iface.name)
//         }
//         return map;
//     }, [interfaceList]);


//     const netclassMapping = useMemo(() => {         
//         let map = new Map<string, Netclass>();
//         for(let nc of netclasses) {
//             map.set(nc._id, nc)
//         }
//         return map;
//     }, [netclasses]);


    
//     const netclassNamesLowerCase = useMemo(() => {
//         let ncNames = new Set<string>()
//         for(let i = 0; i < netclasses.length; i++) {
//             ncNames.add(netclasses[i].name.trim().toLowerCase())
//         }
//         return ncNames ?? []
//     }, []);


//     const ncNameToNCMapping = useMemo(() => {         
//         let map = new Map<string, Netclass>();
//         for(let nc of netclasses) {
//             map.set(nc.name.toUpperCase(), nc) //uppercase is important!!
//         }
//         return map;
//     }, [netclasses]);


//     const columnDefs: Array<ColDef | ColGroupDef> = [
//         {
//             headerName: "#",
//             valueGetter: "node.rowIndex + 1",
//             minWidth: 58,
//             width: 58,
//             maxWidth: 58,
//             resizable: false,
//             editable: false,
//             sort: "asc",
//         },
//         {
//             headerName: "Action",
//             resizable: true,
//             minWidth: 130,
//             width: 130,
//             maxWidth: 130,
//             sortable: false,
//             editable: false,
//             cellStyle: (params: any) => { return { fontWeight : 'normal', display: "flex", alignItems: "center"} },
//             cellRenderer: function(params: any) {
//                 return (
//                     <Box  key={`lg-rem-${params.data.name}`} sx={{display: "flex", flexDirection: "row"}} gap={1}>
//                         <Tooltip sx={{padding: "0px"}} key={`tt1-${params.data.name}`} placement="right" title={`Edit values for '${params.data.name}'`}>
//                             <span>
//                                 <IconButton size="small" onClick={(e) => onClrRelationDataEditAction(e, params.data as BasicProperty)}>
//                                     <EditNoteOutlined sx={{height: 22, padding: 0}} color="secondary" />
//                                 </IconButton>
//                             </span>
//                         </Tooltip>
//                         <Tooltip sx={{padding: "0px"}} key={`tt2-${params.data.name}`} placement="right" title={`Delete clearance relation named '${params.data.name}'`}>
//                             <span>
//                                 <IconButton size="small" onClick={(e) => onClrRelationRemovalAction(e, params.data as BasicProperty)}>
//                                     <Cancel sx={{height: 22, padding: 0, color: SPECIAL_RED_COLOR}} />
//                                 </IconButton>
//                             </span>
//                         </Tooltip>
//                     </Box>
//                 )
//             },            
//         },
//         {
//             headerName: "Rule Name",
//             field: "name",
//             resizable: true,
//             filter: 'text',
//             cellDataType: 'text',
//             minWidth: 190,
//             width: 190,
//             autoHeight: true,
//             sortable: true,
//             editable: true,
//             sortingOrder: ["asc", "desc"],
//             cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} },
//             valueSetter: (params: any) => { 
//                 if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_CLEARANCE_RELATION_NAMES) === false) { return false; }
//                 try { verifyNaming([params.newValue], NamingContentTypeEnum.RELATION) }
//                 catch(e: any){
//                     displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
//                     return false;
//                 }
//                 params.data.name = params.newValue
//                 return true;
//             },
//             onCellValueChanged: handleClrRelationsNameSave
//         },
//         {
//             headerName: "LG Format",
//             field: "value",
//             rowGroup: false,
//             resizable: true,
//             minWidth: 250,
//             width: 250,
//             editable: true,
//             cellEditorPopup: false,
//             enableCellChangeFlash: false,
//             cellEditor: 'agRichSelectCellEditor',
//             cellEditorParams: {
//                 values: Array.from(knownLayerGroupSets.values())
//             },
//             valueGetter: params => {
//                 return knownLayerGroupSets?.get(params.data.value) ?? '';
//             },
//             valueSetter: params => {
//                 if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_CLEARANCE_RELATION_NAMES) === false) { return false; }
//                 const filtered = [...knownLayerGroupSets.entries()].filter(([key, value]) => value === params.newValue);
//                 params.data.value = filtered[0][0];
//                 return true;
//             },
//             cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} },
//             onCellValueChanged: handleClrRelationsNameSave
//         }
//     ];


//     const onGridReady = useCallback((params: any) => {
//         if(setGridApi) {
//             setGridApi(params.api as GridApi);
//         }
//     }, []);
    
    
//     function getAltTextContent() : string {
//         if(!selectedRuleArea && (packageLayout && packageLayout.ruleAreas && packageLayout.ruleAreas.length > 0))
//             return `Please select a Rule Area...`
//         else {
//             return `Project has no rule areas...`
//         }
//     }


//     function onRelationNameAdded(items: DisplayOption[]): void {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_CLEARANCE_RELATION_NAMES) === false) { return; }
//         if(items && items.length > 0) {
//             let existingNames = clrRelationsProps.map(a => a.name.toLowerCase().trim()) ?? []
//             let checkRes = items.some(a => existingNames.includes(a.label.toLowerCase().trim()))
//             if(checkRes === true) {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, `One or more added clearance-relation name already exists for project. Duplicate names are not allowed`)
//                 return;
//             }
            
//             if(items.some(a => netclassNamesLowerCase.has(a.label.trim().toLowerCase()))) {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, `Clearance-relation cannot have the same name as a netclass. Please choose another name.`)
//                 return;
//             }

//             let ifNames = new Set<string>(interfaceList.map(a => a.name.trim().toLowerCase()))
//             if(items.some(a => ifNames.has(a.label.trim().toLowerCase()))) {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, `Clearance-relation cannot have the same name as an interface. Please choose another name.`)
//                 return;
//             }

//             if(items.some(a => (project.name.trim().toLowerCase() === a.label.trim().toLowerCase()))) {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, `Clearance-relation cannot have the same name as the project. Please choose another name.`)
//                 return;
//             }

//             let itemNames = items.map(a => a.label.trim())
//             try { verifyNaming(itemNames, NamingContentTypeEnum.RELATION) }
//             catch(e: any){
//                 displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
//                 return;
//             }

//             let relProps = Array.from(clrRelationsProps)
//             for(let i = 0; i < items.length; i++) {
//                 let propItem: BasicProperty = {
//                     id: crypto.randomUUID(),
//                     name: items[i].label,
//                     value: lgSetInfo.key
//                 }
//                 relProps.push(propItem);
//             }
//             setClrRelationsProps(relProps)
//         }
//     }


    
//     async function handleClearC2CLayout(): Promise<void> {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CLEAR_C2C_LAYOUT) === false) { return; }
//         if(clrRelationsProps && clrRelationsProps.length > 0) {
//             let clrLayoutConfirmData: ConfirmationDialogProps = {
//                 onFormClosed: onConfirmationDataAvailable,
//                 title: "Please Confirm",
//                 warningText_main: `Are you sure you want to clear out the C2C relations for rule area '${selectedRuleArea?.ruleAreaName || ''}'?`,
//                 warningText_other: "This action will not affect C2C relations for other rule areas!",
//                 actionButtonText: "Proceed",
//                 enableSecondaryActionButton: false,
//                 secondaryActionButtonText: "",
//                 contextualInfo:  { key: "CLEAR_LAYOUT", value: selectedRuleArea },
//             }
//             setConfirmationDialogProps(clrLayoutConfirmData)
//             confirmationModalActioner.open()
//         }
//     }


//     async function handleDeleteAllRelationBrands(): Promise<void> {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CLEAR_C2C_LAYOUT) === false) { return; }
//         if(clrRelationsProps && clrRelationsProps.length > 0) {
//             let clrLayoutConfirmData: ConfirmationDialogProps = {
//                 onFormClosed: onConfirmationDataAvailable,
//                 title: "Please Confirm",
//                 warningText_main: `Are you sure you want to DELETE all clearance relation brands?`,
//                 warningText_other: "Warning! All C2C assignments will be deleted for ALL rule areas! C2C will be wiped!",
//                 actionButtonText: "Proceed",
//                 enableSecondaryActionButton: false,
//                 secondaryActionButtonText: "",
//                 contextualInfo:  { key: "DELETE_ALL_CRB_ITEMS", value: selectedRuleArea },
//             }
//             setConfirmationDialogProps(clrLayoutConfirmData)
//             confirmationModalActioner.open()
//         }
//     }

//     function onClrRelationDataEditAction(e: any, propItem: BasicProperty): void {
//         if(selectedRuleArea && propItem && propItem.name && propItem.name.length > 0) {
//             if(classToClassGridActionRef && classToClassGridActionRef.current) {
//                 let relatedC2CEntry = classToClassGridActionRef.current.getFirstEntryByPredicate(a => a.slots.some(x => x.value === propItem.id));
//                 if(relatedC2CEntry && relatedC2CEntry.netclassId && relatedC2CEntry.netclassId.length > 0) {
//                     let nc = netclassMapping.get(relatedC2CEntry.netclassId)
//                     let ifaceId = nc?.interfaceId;
//                     if(ifaceId && ifaceId.length > 0) {
//                         let constEditorDP: ConstraintEditorDialogProps = {
//                             onFormClosed: (ctx) => { /* do nothing for now -- no need for this since grid internally handles updates to cells */ },
//                             title: "Edit Values for Clearance Rule",
//                             project: project,
//                             packageLayout: packageLayout,
//                             constraintType: ConstraintTypesEnum.Clearance,
//                             ruleArea: selectedRuleArea,
//                             associatedInterfaceId: ifaceId,
//                             exclusiveElementIdSet: new Set<string>([propItem.id]),
//                             enableLinkageBasedRefresh: false,
//                             contextualInfo:  { key: "EDIT_CLR_RULE_DATA", value: null },
//                         }
//                         setConstraintEditorDialogProps(constEditorDP)
//                         constraintEditorDialogModalActioner.open()
//                     }
//                     else {
//                         displayQuickMessage(UIMessageType.ERROR_MSG, `Could findd an interface currently associated with rule [${propItem.name}]. Rule values cannot be edited at this time`)
//                     }
//                 }
//                 else {
//                     displayQuickMessage(UIMessageType.ERROR_MSG, `'${propItem.name}' is unused (not found in C2C layout). It's values cannot be edited at this time`)
//                 }
//             }
//         }
//     }


//     function onClrRelationRemovalAction(e: any, propItem: BasicProperty): void {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_CLEARANCE_RELATION_NAMES) === false) { return; }
//         if(propItem && propItem.name && propItem.name.length > 0) {
//             let delConfirmData: ConfirmationDialogProps = {
//                 onFormClosed: onConfirmationDataAvailable,
//                 title: "Please Confirm",
//                 warningText_main: `Are you sure you want to delete clearance relation '${propItem?.name ?? ''}'?`,
//                 warningText_other: "All class to class data related to this rule-name will be removed for ALL rule areas!",
//                 actionButtonText: "Delete",
//                 enableSecondaryActionButton: false,
//                 secondaryActionButtonText: "",
//                 contextualInfo:  { key: "Delete_Relation", value: propItem },
//             }
//             setConfirmationDialogProps(delConfirmData)
//             confirmationModalActioner.open()
//         }
//     }


//     async function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): Promise<void> {
//         if(contextualInfo && contextualInfo.key && contextualInfo.value) {
//             if(contextualInfo.key === "Delete_Relation") {
//                 if(action === ConfirmationDialogActionType.PROCEED) {
//                     let relProps = Array.from(clrRelationsProps)
//                     let propItem = contextualInfo.value as BasicProperty;
//                     let remaining = relProps.filter(a => a.name !== propItem.name) ?? []
                    
//                     setLoadingSpinnerCtx({enabled: true, text: `Deleting clearance relation names. Please wait...`})
//                     updateKeyProjectAspect(projectId, KeyProjectAspectTypeEnum.CRB_DATA, remaining).then(async (updatedProj: Project) => {
//                         if(updatedProj._id) {
//                             let ifaces = await fetchInterfaceList(projectId);
//                             if(ifaces && ifaces.length > 0) {
//                                 setInterfaceList(ifaces);
//                                 displayQuickMessage(UIMessageType.SUCCESS_MSG, `Changes to clearance relation names have been commited...`)
//                             }
//                             setClrRelationsProps(updatedProj.clearanceRelationBrands ?? [])
//                             setProject(updatedProj);
//                             displayQuickMessage(UIMessageType.SUCCESS_MSG, `Changes to clearance relation names have been commited...`)
//                             setLoadingSpinnerCtx({enabled: false, text: ``})
//                         }
//                     })
//                     .finally(() => {
//                         setLoadingSpinnerCtx({enabled: false, text: ``})
//                     })
//                 }
//             }
//             else if(contextualInfo.key === "CLEAR_LAYOUT") {
//                 if(action === ConfirmationDialogActionType.PROCEED) {
//                     setLoadingSpinnerCtx({enabled: true, text: `Clearing C2c assignments for rule area '${selectedRuleArea?.ruleAreaName || ''}'. Please wait...`})
//                     clearClassRelationsForRuleArea(projectId, selectedRuleArea as RuleArea, false).then((res: boolean) => {
//                         if(res) {
//                             displayQuickMessage(UIMessageType.SUCCESS_MSG, `C2C relations have been cleared`)
//                         }
//                         else {
//                             displayQuickMessage(UIMessageType.ERROR_MSG, `Rule area relations were not successfully cleared.`)
//                         }
                        
//                         if(classToClassGridActionRef && classToClassGridActionRef.current) {
//                             classToClassGridActionRef.current?.reloadDataRows()
//                         }
//                     })
//                     .finally(() => {
//                         setLoadingSpinnerCtx({enabled: false, text: ``})
//                     })
//                 }
//             }
//             else if(contextualInfo.key === "DELETE_ALL_CRB_ITEMS") {
//                 if(action === ConfirmationDialogActionType.PROCEED) {
//                     setLoadingSpinnerCtx({enabled: true, text: `Deleting all clearance-relation-brand elements. Please wait...`})
//                     clearClassRelationsForRuleArea(projectId, selectedRuleArea as RuleArea, true).then((res: boolean) => {
//                         if(res) {
//                             fetchProjectDetails(projectId).then((updatedProj: Project) => {
//                                 if(updatedProj._id) {
//                                     setClrRelationsProps(updatedProj.clearanceRelationBrands ?? [])
//                                     setProject(updatedProj);
//                                     displayQuickMessage(UIMessageType.SUCCESS_MSG, `C2C relations brands have been deleted`)
//                                 }
//                             })
//                         }
//                         else {
//                             displayQuickMessage(UIMessageType.ERROR_MSG, `C2C relations brands were not successfully cleared.`)
//                         }
                        
//                         if(classToClassGridActionRef && classToClassGridActionRef.current) {
//                             classToClassGridActionRef.current?.reloadDataRows()
//                         }
//                     })
//                     .finally(() => {
//                         setLoadingSpinnerCtx({enabled: false, text: ``})
//                     })
//                 }
//             }
//         }
//     }


//     //===================================

//     function ruleAreaSelectionMade(ruleArea: string | null) {
//         if(netclassMapping.size === 0) {
//             displayQuickMessage(UIMessageType.ERROR_MSG, `Project has no interfaces/netclasses. Nothing to show for the selected rule area.`)
//             return;
//         }

//         if(ruleArea && ruleArea.trim().length > 0) {
//             let ra = packageLayout?.ruleAreas.find(a => a.ruleAreaName === ruleArea)
//             if(ra) {
//                 //NOTE: the router loader function will handle loading the selected interface's details
//                 setSelectedRuleArea(null) //IMPORTANT! do not remove this!
//                 navigate(`/${ActionSceneEnum.C2CLAYOUT}/${projectId}/${ra.id.trim() || ''}`)
//             }
//         }
//     }

    
//     async function handleClrRelationsNameSave(): Promise<boolean> {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_CLEARANCE_RELATION_NAMES) === false) { return false; }
//         if(clrRelationsProps && clrRelationsProps.length > 0) {
//             let lgSetIdList = [...knownLayerGroupSets.keys()] 
//             let nameList = clrRelationsProps.map(a => a.name)
            
//             try { verifyNaming(nameList, NamingContentTypeEnum.RELATION) }
//             catch(e: any) {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
//                 return false;
//             }

//             for(let i = 0; i < clrRelationsProps.length; i++) {
//                 if(clrRelationsProps[i].value && clrRelationsProps[i].value.length > 0) {
//                     if(lgSetIdList.includes(clrRelationsProps[i].value) === false) {
//                         displayQuickMessage(UIMessageType.ERROR_MSG, `The layer-group-set selected for clearance relations named '${clrRelationsProps[i].name}' was not recognized`)
//                         return false;
//                     }
//                 }
//             }
            
//             //IMPORTANT: DO NOT commit half-ass relations especially those where LGSet is not specified!
//             let allSet = clrRelationsProps.every(a => a.id && a.id.length > 0 && a.name && a.name.length > 0 && a.value && a.value.length > 0)
//             if(allSet === true) {
//                 setLoadingSpinnerCtx({enabled: true, text: `Updating clearance relation names. Please wait...`})
//                 updateKeyProjectAspect(projectId, KeyProjectAspectTypeEnum.CRB_DATA, clrRelationsProps).then(async (updatedProj: Project) => {
//                     if(updatedProj._id) {
//                         setProject(updatedProj);
//                         displayQuickMessage(UIMessageType.SUCCESS_MSG, `Changes to clearance relation names have been commited...`)
//                     }
//                 })
//                 .finally(() => {
//                     setLoadingSpinnerCtx({enabled: false, text: ``})
//                 })

//             }
//             else {
//                 displayQuickMessage(UIMessageType.WARN_MSG, `One or more clearance relation names do not have an assigned Layer-Group-Set. `
//                     + `Also, please ensure that interfaces exist first before creating relation names. Changes have not been saved!`)
//                 return false
//             }
//         }
//         return true;
//     }

    
//     const classToClassGridColumns = useMemo(() => {         
//         let mapEntries = Array.from(c2cEnabledColumnToIndexMap.entries());
//         let mapEntriesSorted = sort(mapEntries).asc(a => a[1]);
//         let colNames = mapEntriesSorted.map(a => a[0]);
//         let cols = getClasToClassGridColumns(colNames)
//         return cols
//     }, [c2cEnabledColumnToIndexMap]);


//     function onClassToClassGridSelectionChanged(selectedItemIdsMap: Map<string, number>): void {
//         if(classToClassGridActionRef && classToClassGridActionRef.current && selectedItemIdsMap && selectedItemIdsMap.size > 0) {
//             let map = new Map<BasicKVP, number>();
//             for (let [key, value] of selectedItemIdsMap) {
//                 let rowObj = classToClassGridActionRef.current.getDataAtIndex(value)
//                 map.set({key: key, value: rowObj } as BasicKVP, value)
//             }
//             setClassToClassSelectedRowInfo(map)
//         }
//         else {
//             setClassToClassSelectedRowInfo(new Map<BasicKVP, number>())
//         }
//     }

    
//     function onClassToClassGridSelectionCleared(): void {
//         setClassToClassSelectedRowInfo(new Map<BasicKVP, number>())
//     }


//     function handleRuleAreaRelationsCopyOver(): void {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.COPY_OVER_C2C_LAYOUT) === false) { return; }
//         let opts = selectedRuleArea ? packageLayout.ruleAreas.filter(a => a.id !== selectedRuleArea.id).map(x => x.ruleAreaName).sort() : []
//         let giDialogProps: GeneralInfoDialogProps = {
//             onFormClosed: onGenInfoDataAvailable,
//             title: "Copy C2C-Relations to Another Rule Area",
//             warningText: `Warning: all C2C relations for destination rule area will be overwritten! Source: ${selectedRuleArea?.ruleAreaName || ''}`,
//             selectionLabel: "Select Destination Rule Area",
//             textMainLabel: "",
//             selectionCtrlOptions: opts,
//             showSelectionCtrl: true,
//             contextualInfo: { key: "COPY_C2C_OVER", value: null },
//         }
//         setGeneralInfoDialogProps(giDialogProps)
//         generalInfoModalActioner.open()
//     }
    

//     function onGenInfoDataAvailable(data: GeneralInfoUIContext | null): void {
//         if(data && data.contextualInfo) {
//             if(data.contextualInfo.key === "COPY_C2C_OVER") {
//                 let destRAName = data?.selection
//                 if(destRAName && destRAName.length > 0 && selectedRuleArea) {
//                     let destRA = packageLayout.ruleAreas.find(a => (a.id !== selectedRuleArea.id) && a.ruleAreaName === destRAName)
//                     if(destRA) {
//                         setLoadingSpinnerCtx({enabled: true, text: `Now copying data to destination rule-area. Please wait...`})
//                         copyOverConstraints(projectId, selectedRuleArea, destRA, ConstraintTypesEnum.Clearance, null).then((res: boolean) => {
//                             if(res) {
//                                 displayQuickMessage(UIMessageType.SUCCESS_MSG, `C2C relations have been copied to destination rule area`)
//                             }
//                             else {
//                                 displayQuickMessage(UIMessageType.ERROR_MSG, `Rule area relations were not successfully copied over.`)
//                             }
//                         })
//                         .finally(() => {
//                             setLoadingSpinnerCtx({enabled: false, text: ``})
//                         })
//                     }
//                     else {
//                         displayQuickMessage(UIMessageType.ERROR_MSG, `Rule area relations were not successfully copied over. Issue occured during destination rule area selection`)
//                     }
//                 }
//             }
//         }
//     }
    

//     function handleShowHideCoordinateAxis(): void {
//         //NOTE: 
//         //  column hiding is handled in c2clayout's react router loader function
//         //  row hiding is handled in BGFeedItems --> onClasToClassGridInitialDataFetch()
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CHANGE_C2C_VISIBILITY) === false) { return; }
//         let visibilityDialogProps : C2CAxisVisibilityDialogProps = {
//             onFormClosed: onAxisVisibilityDataAvailable,
//             title: "Show/hide C2C Coordinate Columns and/or Rows", 
//             contextualInfo:  { key: "AXIS_VISIBILITY_CHANGE", value: netclasses }, //always pass the entire set to the dialog!
//         }
//         setAxisVisibilityDialogProps(visibilityDialogProps)
//         axisVisibilityModalActioner.open()
//     }


//     async function onAxisVisibilityDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
//         if(contextualInfo && contextualInfo.value && contextualInfo.value.length > 0) {
//             if(contextualInfo.key === "AXIS_VISIBILITY_CHANGE") {
//                 let retNetclassList : Netclass[] = contextualInfo.value
//                 setLoadingSpinnerCtx({enabled: true, text: `Updating netclasses. Please wait...`})
//                 updateNetclasses(retNetclassList).then((updatedNetclassList: Netclass[]) => {
//                     if(updatedNetclassList && updatedNetclassList.length > 0) {
//                         navigate(`/${ActionSceneEnum.C2CLAYOUT}/${projectId}/${selectedRuleArea?.id.toString() || ''}`);
//                         displayQuickMessage(UIMessageType.SUCCESS_MSG, "C2C Visibility settings were updated")
//                     }
//                 })
//                 .finally(() => {
//                     setLoadingSpinnerCtx({enabled: false, text: ``})
//                 })
//             }
//         }
//     }


//     async function handleShowG2GLayout(): Promise<void> {
//         if(interfaceList && interfaceList.length > 0) {
//             let g2gList = await fetchG2GContextList(projectId)
//             let g2gDialogProps : G2GLayoutDialogProps = {
//                 onFormClosed: onG2GLayoutDataAvailable,
//                 title: "Group to Group (G2G) Relations",
//                 warningMsg: `The group-to-group relations shown here might not accurately describe current C2C layout. `
//                     + `Changes may have been made directly to C2C grid. `
//                     + `Submitted relations may override such adhoc specifications for all rule-areas of C2C grid. `
//                     + `Unused rule names will be deleted!`,
//                 contextualInfo: { key: "G2G_LAYOUT", value: interfaceList },
//                 projectInterfaceList: interfaceList,
//                 inputG2GCtxList: g2gList,
//                 project: project,
//             }
//             setG2GLayoutDialogProps(g2gDialogProps)
//             g2gLayoutModalActioner.open()
//         }
//     }


//     async function onG2GLayoutDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
//         if(contextualInfo && contextualInfo.value && contextualInfo.value.length > 0) {
//             if(contextualInfo.key === "G2G_LAYOUT") {
//                 let g2gCtxList : G2GRelationContext[] = contextualInfo.value;
//                 if(g2gCtxList && g2gCtxList.length > 0) {
//                     setIsLoadingBackdropEnabled(true)
//                     setProcStartTime(performance.now())
//                     processG2GUpdates(projectId, g2gCtxList).then((res: boolean) => {
//                         if(res === true) {
//                             setEnableProcPolling(true)
//                             displayQuickMessage(UIMessageType.SUCCESS_MSG, "C2C update initiated via G2G context. Please stay tuned for completion of processing...")
//                         }
//                         else {
//                             displayQuickMessage(UIMessageType.ERROR_MSG, "Could not successfully perform C2C updates via G2G context")
//                         }
//                     })
//                     .finally(() => {
//                         setIsLoadingBackdropEnabled(false)
//                     })
//                 }
//             }
//         }
//     }


//     function checkSelectedRowIfaces() : boolean {
//         if(classToClassSelectedRowInfo && classToClassSelectedRowInfo.size > 0) {
//             let c2cRowList : C2CRow[] = Array.from(classToClassSelectedRowInfo.keys())?.map(a => a.value)
//             let allInterfaceIDs = c2cRowList.map(a => netclassMapping.get(a.netclassId)?.interfaceId)
//             let res = allInterfaceIDs.every(a => a && (a !== undefined) && (a === allInterfaceIDs[0])) // are are the same and none is undefined
//             if(res) {
//                 return true;
//             }
//         }
//         return false;
//     }

    
//     function onTransferToInterfaceClearanceDataView() {
//         if(classToClassSelectedRowInfo && classToClassSelectedRowInfo.size > 0) {
//             let c2cRow : C2CRow = Array.from(classToClassSelectedRowInfo.keys())?.at(0)?.value
//             if(c2cRow) {
//                 let ifaceId = netclassMapping.get(c2cRow.netclassId)?.interfaceId
//                 if(ifaceId && ifaceId.length > 0) {
//                     navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${ifaceId.trim()}/${CLEARANCE_PAGE_URL_SUFFIX}`)
//                 }
//             }
//         }
//     }


//     function executeClasToClassGridInitialDataFetch(projectId: string, limit: number, selectedRuleArea: RuleArea, 
//         netclassMapping: Map<string, Netclass>, ifaceMapping: Map<string, string>, filterText: string): Promise<C2CRow[]> {
        
//         setLoadingSpinnerCtx({enabled: true, text: `Now retrieving C2C data. Please wait...`} as LoadingSpinnerInfo)
//         let res = onClasToClassGridInitialDataFetch(projectId, limit, selectedRuleArea, netclassMapping, ifaceMapping, filterText).finally(() => { cancelLoadingSpinnerCtx() });
//         return res
//     }


//     async function handleClassToClassGridCellEdited(editCtx: GridCellEditCtx<C2CRow>): Promise<C2CRow | undefined> {
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_C2C_LAYOUT) === false) { return; }
//         return onClasToClassGridCellEdited(netclassMapping, editCtx);
//     }


//     async function onClassToClassGridRightElementRetrieval(rowEntry: C2CRow, columns: GridColumn[], columnIndex: number, rowIndex: number): Promise<JSX.Element | undefined> {
//         let rowEntryId = rowEntry._id?.toString() as string

//         let dataEntryKeyName = columns[columnIndex]?.id ?? ''
//         let dataElement = rowEntry.slots.find((x: C2CRowSlot) => (netclassMapping.get(x.netclassId)?.name?.toUpperCase() === dataEntryKeyName.toUpperCase()) || (x.name === dataEntryKeyName));
        
//         if(!dataElement || !dataElement.id || !dataElement.value || dataElement.value.length === 0) {
//             return undefined; 
//         }

//         if(showRightElementOnGrid === false) {
//             return undefined; 
//         }

//         function onRevertCellData(element: [string, string, string]): void {
//             if(validClrRelationsOptionsRef && validClrRelationsOptionsRef.current) {
//                 if(element[0] && element[0].toString().length > 0) {
//                     let selValue = validClrRelationsOptionsRef.current.find(a => a.label.toLowerCase().trim() === element[0].toLowerCase().trim())
//                     let editCtx : GridCellEditCtx<C2CRow> = {
//                         current: rowEntry, 
//                         newValue:  {
//                             kind : GridCellKind.Custom,
//                             allowOverlay : true, //Inconsequential
//                             copyData : '4', //Inconsequential
//                             data : {
//                                 kind: 'dropdown-cell', //Inconsequential
//                                 allowedValues: validClrRelationsOptionsRef.current, //Inconsequential
//                                 value: selValue?.value
//                             },
//                             readonly : false, //Inconsequential
//                             style : 'normal' //Inconsequential
//                         } as DropdownCellType, 
//                         columnIndex: columnIndex, 
//                         columnElement: columns[columnIndex], 
//                         rowIndex: rowIndex
//                     }

//                     handleClassToClassGridCellEdited(editCtx).then(c2cr => {
//                         if(c2cr) {
//                             if(classToClassGridActionRef && classToClassGridActionRef.current) {
//                                 classToClassGridActionRef.current?.reloadDataRows()
//                             }
//                             displayQuickMessage(UIMessageType.SUCCESS_MSG, "Value reverted successfully");
//                         }
//                     });
//                 }
//                 else {
//                     displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to revert value. No valid data provided for the operation");
//                 }
//             }
//         }

//         function onTransformValue(value: string) : string {
//             let txVal = validClrRelationsOptsAsMapRef.current.get(value) ?? value;
//             return txVal;
//         }

//         return (
//             <>
//                 <RightElement projectId={projectId} rowEntryId={rowEntryId} dataEntryKeyName={dataEntryKeyName} panelHeight={`70vh`}
//                     dataEntryId={dataElement.id} groupValue={rowEntry.name} groupLabel={"NC"} onRevertCellData={onRevertCellData} onTransformValue={onTransformValue}/>
//             </>
//         );
//     }


//     function onRightElementEnablementChanged(checked: boolean): void {
//         setShowRightElementOnGrid(checked);
//     }


//     async function onActionButtonClick(): Promise<void> {
//         let show = showRuleNameGrid === true ? false : true
//         setShowRuleNameGrid(show);
//         setExpandShrinkLabel(show === true ? "Expand" : "Shrink")
//     }


//     async function processProjectLockAndUnlock(): Promise<void> {
//         let updatedProj = await handleLockAction(project, loggedInUser)
//         if(updatedProj && updatedProj._id) {
//             setProject(updatedProj);
//         }
//     }


//     async function handleLinkages(constraintType: ConstraintTypesEnum) {
//         let g2gList = await fetchG2GContextList(projectId)
//         let lnkMgmtDlgProps : LinkageManagementDialogProps = {
//             onFormClosed: onLinkageManagementDataAvailable,
//             title: `Link ${(constraintType === ConstraintTypesEnum.Physical) ? "Netclasses (trace)" : "Clearance Rules (space)"}. Changes to one rule will reflect on all linked rules`,
//             constraintType: constraintType,
//             project: project,
//             netclasses: netclasses,
//             ruleAreas: packageLayout.ruleAreas,
//             projectInterfaceList: interfaceList,
//             g2gContextList: g2gList,
//             contextualInfo: { key: "LINKAGE_MGMT", value: null }
//         }
//         setLinkageManagementDialogProps(lnkMgmtDlgProps)
//         linkageManagementModalActioner.open()
//     }


//     async function onLinkageManagementDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
//         if(contextualInfo && contextualInfo.value) {
//             if(contextualInfo && contextualInfo.key && contextualInfo.key === "LINKAGE_MGMT") {
//                 let linkageData : LinkageInfo[] = contextualInfo.value
//                 if(linkageManagementDialogProps?.constraintType === ConstraintTypesEnum.Physical) {
//                     setIsLoadingBackdropEnabled(true)
//                     let updatedProject = await updateKeyProjectAspect(projectId, KeyProjectAspectTypeEnum.PHY_LNK, linkageData).finally(() => { setIsLoadingBackdropEnabled(false) } );
//                     if(updatedProject) {
//                         setProject(updatedProject);
//                         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Physical linkage update process has completed.")
//                     }
//                     else {
//                         displayQuickMessage(UIMessageType.ERROR_MSG, "physical linkage data was not successfully updated.")
//                     }
//                 }
//                 else if(linkageManagementDialogProps?.constraintType === ConstraintTypesEnum.Clearance) {
//                     setIsLoadingBackdropEnabled(true)
//                     let updatedProject = await updateKeyProjectAspect(projectId, KeyProjectAspectTypeEnum.CLR_LNK, linkageData).finally(() => { setIsLoadingBackdropEnabled(false) } );
//                     if(updatedProject) {
//                         setProject(updatedProject);
//                         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Clearance linkage update process has completed.")
//                     }
//                     else {
//                         displayQuickMessage(UIMessageType.ERROR_MSG, "Clearance linkage data was not successfully updated.")
//                     }
//                 }
//             }
//         }
//     }


//     function getSubMenuItems() : Array<MenuInfo> {
//         let menuArr = new Array<MenuInfo>();
        
//         if(interfaceList && interfaceList.length > 0 && netclasses && netclasses.length > 0) {
//             menuArr.push({
//                 label: "Open G2G View",
//                 icon: <BakeryDiningOutlined />,
//                 callbackAction: (kvp: BasicKVP) => { handleShowG2GLayout() }
//             });
//         }
        
//         if(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0){
//             menuArr.push({
//                 label: "COPY C2C To Other RuleArea",
//                 icon: <CopyAllOutlined />,
//                 indicateWarning: true,
//                 callbackAction: (kvp: BasicKVP) => { handleRuleAreaRelationsCopyOver() }
//             });

//             menuArr.push({
//                 label: "CLEAR C2C Layout",
//                 icon: <ClearAllOutlined />,
//                 indicateWarning: true,
//                 callbackAction: (kvp: BasicKVP) => { handleClearC2CLayout() }
//             });

//             menuArr.push({
//                 label: "Delete ALL Relation name/brand items",
//                 icon: <DeleteSweepOutlined />,
//                 indicateWarning: true,
//                 callbackAction: (kvp: BasicKVP) => { handleDeleteAllRelationBrands() }
//             });
        
//             menuArr.push({
//                 label: "Show/Hide C2C Rows and/or Columns",
//                 icon: <Visibility />,
//                 callbackAction: (kvp: BasicKVP) => { handleShowHideCoordinateAxis() }
//             });

//             menuArr.push({
//                 label: `Manage ${ConstraintTypesEnum.Clearance} Rule Linkages`,
//                 icon: <WorkspacesOutlined />,
//                 callbackAction: (kvp: BasicKVP) => { handleLinkages(ConstraintTypesEnum.Clearance) }
//             });

//             menuArr.push({
//                 label: (project && project.lockedBy && project.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`,
//                 icon: (project && project.lockedBy && project.lockedBy.length > 0)
//                     ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
//                     : <LockOpenOutlined fontSize="large" color="secondary"/>,
//                 callbackAction: (kvp: BasicKVP) => { processProjectLockAndUnlock() }
//             });

//             menuArr.push({
//                 label: `${expandShrinkLabel} C2C`,
//                 icon: (showRuleNameGrid === true)
//                     ? <FullscreenOutlined fontSize="large" />
//                     : <FullscreenExitOutlined fontSize="large" />,
//                 callbackAction: (kvp: BasicKVP) => { onActionButtonClick() }
//             });
            
//             menuArr.push({
//                 label: "",
//                 icon: 
//                     <FormControlLabel 
//                         control={ <Switch 
//                             size="small"
//                             sx={{ mr: 1, backgroundColor: undefined}} 
//                             checked={showRightElementOnGrid}
//                             onChange={(e, checked) => onRightElementEnablementChanged(checked)}
//                         />} 
//                         label={(showRightElementOnGrid) ? `Hide Change-History Panel` : `Show Change-History Panel`} 
//                     />,
//                 callbackAction: (kvp: BasicKVP) => { onRightElementEnablementChanged(showRightElementOnGrid) }
//             });
//         }

//         return menuArr;
//     }


//     const asciiContentCtx : {asciiInfo: any, mapKey: any} = useMemo(() => {
//         let asciiInfo = new Map<string, number>([
//             ['Doh', 3],
//             ['Broadway KB', 9],
//             ['Cybermedium', 9],
//             ['Dot Matrix', 4]
//         ])
//         let quickRand = Math.floor(Math.random() * asciiInfo.size);
//         let mapKey = [...asciiInfo.keys()].at(quickRand) as any
//         return {asciiInfo: asciiInfo, mapKey: mapKey}
//     }, []);
        
    
    


    
//     return (
//         <Box>
//             <Box display="flex" flexDirection="column">
            
//                 <Box flexDirection="column" alignItems="center" >          
//                     <Box  height={50} sx={{ overflow: 'hidden', display: "flex", flexDirection:"row", ml: 1 }} ref={containerRef}>
//                         <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: 0}}>
//                             <Autocomplete 
//                                 value={selectedRuleArea?.ruleAreaName ?? ""}
//                                 onChange={(event: any, value: string | null) => { ruleAreaSelectionMade(value);}}
//                                 key="ra-sel-cb"
//                                 freeSolo={false}
//                                 filterSelectedOptions={true}
//                                 disablePortal
//                                 disableListWrap
//                                 size="small"
//                                 id="ra-sel-cb"
//                                 sx={{ mt:.7, minWidth: 350 }}
//                                 options={['', ...packageLayout?.ruleAreas.map(a => a.ruleAreaName) ?? []]}
//                                 renderInput={(params) => <TextField {...params} 
//                                     label="Select Rule Area" 
//                                     size="small" 
//                                     sx={{ '& .MuiInputBase-input': { fontSize: (selectedRuleArea?.ruleAreaName && selectedRuleArea?.ruleAreaName.length > 30) ? 9.5 : 12.5 } }}
//                                 />}
//                             /> 

//                             <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
//                                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
//                             </Slide>

//                             <MenuListComposition menuItems={getSubMenuItems()} tooltipTitle={"Show/hide C2C related settings"} />

//                             <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
//                                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 6 }} />
//                             </Slide>

//                             {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0 && checkSelectedRowIfaces()) && 
//                                 <Tooltip key={`c2c-gv-tt`} placement="top" title={`Go to interface for selected clearance-relation(s)`}>
//                                     <span>
//                                         <IconButton onClick={(event) => onTransferToInterfaceClearanceDataView()} sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
//                                             <ExitToAppOutlined color="primary" />
//                                         </IconButton>                 
//                                     </span>
//                                 </Tooltip>
//                             }

//                             {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0 && checkSelectedRowIfaces()) && 
//                                 <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
//                                     <Divider orientation="vertical" sx={{height: 20, marginLeft: 6, marginRight: 6 }} />
//                                 </Slide>
//                             }

//                         </Box>
//                     </Box>
//                     <Divider sx={{ marginLeft: 0, marginRight: 0 }} />
//                 </Box>

//                 <Divider sx={{ marginLeft: .5, marginRight: 0 }} />

//                 <Box ref={containerRef2}>
//                     {(packageLayout && selectedRuleArea)
//                     ? (
//                         <Box sx={{ 
//                             height: "83vh", m: 1, mr: 0, textAlign: "center", backgroundColor: colors.primary[400],
//                             borderTopLeftRadius: 30, borderTopRightRadius: 30, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>    
                            
//                             {/* //Starting the clearance relations display */}
//                             {/* <Divider sx={{mt: 1, mb: 1, mr: 8, ml: 8}} /> */}
                            
//                             <Box display="flex" flexDirection="row" sx={{mt: 1}}>
                                
//                                 {showRuleNameGrid && 
//                                     <>
//                                         <Box display="flex" flexDirection="row" >
//                                             <Box sx={{width: "30vw", ml: 2}}>
//                                                 <Slide direction="right" in={showRuleNameGrid} container={containerRef2.current}>
//                                                     <Box flexDirection="column" alignItems="center" >
//                                                         <Box flexDirection="row" display="flex"  alignItems="center">
//                                                             <Box sx={{mb: .7, mt: 1}}>
//                                                                 <MultiTextEntryField 
//                                                                     labelText={`Add new clearance relation name(s)`}
//                                                                     onItemAdded={(items: DisplayOption[]) => onRelationNameAdded(items)}
//                                                                     regexForValidation={BASIC_NAME_VALIDATION_REGEX} 
//                                                                     textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, width: "27.5vw"}}
//                                                                     addButtonStyle={{ fontSize: 27}}
//                                                                     disabled={((lgSetInfo.value as boolean) === true) ? false : true}
//                                                                 />
//                                                             </Box>
//                                                         </Box>
//                                                         <div style={{ height: "76vh", maxWidth: 1000}}>
                                                            
//                                                             <AgGridReact
//                                                                 rowData={clrRelationsProps}
//                                                                 animateRows={true}
//                                                                 columnDefs={columnDefs}
//                                                                 defaultColDef={defaultColDef}
//                                                                 onGridReady={onGridReady}
//                                                                 theme={themeDarkBlue}
//                                                                 rowSelection={{ mode: "singleRow", checkboxes: false }}
//                                                                 suppressExcelExport={false}
//                                                                 suppressCsvExport={false}   
//                                                                 groupDisplayType='singleColumn'    
//                                                                 groupDefaultExpanded={1}
//                                                                 rowHeight={28}
//                                                                 headerHeight={28}
//                                                             />
//                                                         </div>
                                                        
//                                                     </Box>
//                                                 </Slide>
//                                             </Box>

//                                         </Box>

//                                         <Divider orientation="vertical" sx={{height: "81.5vh", marginLeft: 2, marginRight: 1 }} />
//                                     </>
//                                 }

//                                 <Box sx={{height: "69vh", minWidth: 444, width: (showRuleNameGrid && selectedRuleArea && selectedRuleArea.ruleAreaName) ? "54vw" : "86.5vw"}}>
//                                     <BaseGlideGrid<C2CRow> 
//                                         excludePortal={true}
//                                         gridHeight={"76vh"}
//                                         headerHeight={BASIC_GRID_HEADER_HEIGHT}
//                                         gridRef={classToClassGridRef}
//                                         columns={classToClassGridColumns}
//                                         freezeColumns={1}
//                                         pageSize={C2C_GRID_PAGE_SIZE}
//                                         totalRowCount={netclasses?.length ?? 99999}
//                                         gridMarginRight={showRuleNameGrid ? -2.5 : -4}
//                                         enableFillHandle={true}
//                                         multiRowSelectionEnabled={true}
//                                         maxRowSelectionCount={Number.MAX_SAFE_INTEGER}
//                                         enableSearchField={true}
//                                         showActionButton={true}
//                                         isActionClickAllowed={ true }
//                                         actionButtonText={expandShrinkLabel}
//                                         actionButtonWidth={80}
//                                         reloadAfterActionClick={false}
//                                         cellEditConfirmationColumns={undefined}
//                                         groupRowLines={undefined}
//                                         rightElementEnablementInitValue={showRightElementOnGrid}
//                                         onGetRightElementContent={onClassToClassGridRightElementRetrieval}
//                                         onEvaluateFillPattern={onClasToClassEvaluateFillPattern}
//                                         onGetRowGroupCellContent={undefined}
//                                         onGetToolTipText={(args, columns, rowEntry) => onClassToClassGridGetToolTipText(args, columns, rowEntry, netclassMapping, ifaceMapping)}
//                                         onActionButtonClick={onActionButtonClick}
//                                         onGridCellEdited={handleClassToClassGridCellEdited}
//                                         onGetGridCellContent={(rowEntry, columns, columnIndex, isGroupHeader, rowIndex) => getClasToClassGridCellContent(validClrRelationsOptionsRef.current, netclassMapping, ifaceMapping, ncNameToNCMapping, c2cEnabledColumnToIndexMap, rowEntry, columns, columnIndex)} 
//                                         onGridSelectionChanged={(gridSelection, selectedIds) => onClassToClassGridSelectionChanged(selectedIds)}
//                                         onGridSelectionCleared={onClassToClassGridSelectionCleared}
//                                         onFetchFirstSetData={(limit, filterText) => executeClasToClassGridInitialDataFetch(projectId, limit, selectedRuleArea, netclassMapping, ifaceMapping, filterText)}
//                                         onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => {return new Promise(() => new Array<C2CRow>());}}  
//                                         specialGridActionRef={classToClassGridActionRef}
//                                     />
                                    
//                                     {/* 
//                                         IMPORTANT! - DO NOT REMOVE portal div! 
//                                         I dont know why this works here. But any other scenario makes it such that second grid cannot be edited.
//                                         There can only be one portal for glide grid, 
//                                         therefore if constraint editor popup is open, or if g2g popup is open, then we need to disable the main portal.
//                                     */}
//                                     {(constraintEditorDialogModalState === false && g2gLayoutModalState === false) && <div id="portal"></div>}
//                                 </Box>
                                
//                             </Box>
//                             {/* //End of clearance relations display */}
                            
//                         </Box>
//                     )
//                     : <Box sx={{mt:20, ml: 5}}>
//                             <AsciiTextComp 
//                                 text={getAltTextContent()} 
//                                 font={asciiContentCtx.mapKey} 
//                                 fontSize={asciiContentCtx.asciiInfo.get(asciiContentCtx.mapKey) as number}>
//                             </AsciiTextComp>
//                         </Box>}
                
//                 </Box>
//             </Box>

//             {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
//             {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}
//             {axisVisibilityModalState && <C2CAxisVisibilityDialog opened={axisVisibilityModalState} close={axisVisibilityModalActioner.close} {...axisVisibilityDialogProps as C2CAxisVisibilityDialogProps} />}
//             {g2gLayoutModalState && <G2GLayoutDialog opened={g2gLayoutModalState} close={g2gLayoutModalActioner.close} {...g2gLayoutDialogProps as G2GLayoutDialogProps} />}
//             {constraintEditorDialogModalState && <ConstraintEditorDialog opened={constraintEditorDialogModalState} close={constraintEditorDialogModalActioner.close} {...constraintEditorDialogProps as ConstraintEditorDialogProps} />}
//             {linkageManagementModalState && <LinkageManagementDialog opened={linkageManagementModalState} close={linkageManagementModalActioner.close} {...linkageManagementDialogProps as LinkageManagementDialogProps} />}

//         </Box>        
//     );

// }

// export default BucketDetails











// //  interface PollingInfoContext {
// //         mainMessageOnProc: string,
// //         spinnerMessageOnProc: string,
// //         messageOnCompletion: string,
// //         messageOnError: string,
// //         actionOnCompletion: () => void
// //     }

// //     const [procStartTime, setProcStartTime] = useState<number | null>(null);
// //     const [enableG2GProcPolling, setEnableG2GProcPolling] = useState<boolean>(false);

// //     let pollCtx : PollingInfoContext = {
// //         mainMessageOnProc: `C2C update initiated via G2G context. Processing can take up to 5 minutes depending on number of netclasses involved. Please be patient. Stay tuned for completion of processing...`,
// //         spinnerMessageOnProc: `Checking C2C processing status. Please wait...`,
// //         messageOnCompletion: `C2C updated via G2G context.`,
// //         messageOnError: `Could not successfully perform C2C updates via G2G context`,
// //         actionOnCompletion : () => { navigate(`/${ActionSceneEnum.C2CLAYOUT}/${projectId}/${selectedRuleArea?.id.toString() || ''}`) }
// //     }
// //     const { data, error, isLoading } = useSWR(enableG2GProcPolling ? PendingProcessActionTypeEnum.G2G_UPDATE: null, (key: any) => fetcher(key, pollCtx), { refreshInterval: 7000, revalidateOnMount : true})


// //     async function fetcher(type: PendingProcessActionTypeEnum, pollCtx : PollingInfoContext) {
// //         let infoCtx = pollCtx
// //         const proj: Project = await fetchProjectDetails(projectId, true);

// //         let pendingProc = proj?.associatedProperties?.find(a => (
// //             a.category === ProjectPropertyCategoryEnum.PENDING_PROCESSES && a.name === ProjectPropertyCategoryEnum.PENDING_PROCESSES))
        
// //         if(pendingProc && pendingProc.value && pendingProc.value.length > 0) {
// //             let sii : StatusIndicatorItem = pendingProc.value.find((x: StatusIndicatorItem) => x.title === type)
// //             if(sii) {
// //                 if(sii.isOk === false) {
// //                     cancelLoadingSpinnerCtx();
// //                     setIsLoadingBackdropEnabled(false)
// //                     // displayQuickMessage(UIMessageType.ERROR_MSG, `Could not successfully perform C2C updates via G2G context --- ${sii.message}.`)
// //                     displayQuickMessage(UIMessageType.ERROR_MSG, infoCtx.messageOnError + ` --- ${sii.message}.`)
// //                     setEnableG2GProcPolling(false)
// //                 }
// //                 else if(sii.isProcessing === true) {
// //                     // let msg = `C2C update initiated via G2G context. Processing can take up to 5 minutes depending on number of netclasses involved. Please be patient. Stay tuned for completion of processing...`
// //                     // let spinnerMsg = `Checking C2C processing status. Please wait...`
// //                     displayQuickMessage(UIMessageType.INFO_MSG, infoCtx.mainMessageOnProc)
// //                     setIsLoadingBackdropEnabled(true)
// //                     setLoadingSpinnerCtx({enabled: true, text: infoCtx.spinnerMessageOnProc})
// //                 }
// //                 else {
// //                     const endTime = performance.now();
// //                     let timetaken = (procStartTime && procStartTime > 0) ? (Math.floor((endTime - procStartTime) / 1000)).toString() : null
// //                     // let msg  = `C2C updated via G2G context. Time Taken: ${timetaken} Seconds`
// //                     cancelLoadingSpinnerCtx();
// //                     setIsLoadingBackdropEnabled(false)
// //                     // navigate(`/${ActionSceneEnum.C2CLAYOUT}/${projectId}/${selectedRuleArea?.id.toString() || ''}`);
// //                     infoCtx.actionOnCompletion();
// //                     displayQuickMessage(UIMessageType.SUCCESS_MSG, infoCtx.messageOnCompletion + (timetaken ? ` Time Taken: ${timetaken} Seconds` : ''))
// //                     setEnableG2GProcPolling(false)
// //                 }
// //             }
// //             else {
// //                 setEnableG2GProcPolling(false)
// //             }
// //         }
// //     }


// //=================================================================================================



// // import usePolling from '@eballoi/react-use-polling';
// // // import { createHttpPoller } from '@azure/core-lro';
// // import { createHttpPoller, PollerLike, OperationState, OperationResponse, RunningOperation } from '@azure/core-lro';
// // import { AbortSignalLike } from "@azure/abort-controller";

//     //================================================================================================================
//     //================================================================================================================

//     // async function onPollingCallback(type: PendingProcessActionTypeEnum) {
//     //     // Your data fetching logic here
//     //     // const response = await fetchDataFromApi();
//     //     console.error(`polling type: ${type}`)
//     //     return "ok";
//     // };

//     // async function onPollingError(type: PendingProcessActionTypeEnum, error: any) {
//     //     // Your data fetching logic here
//     //     // const response = await fetchDataFromApi();
//     //     console.error(`polling type: ${type}. ERROR: ${error}`)
//     //     return "ok";
//     // };


//     // const { data, loading, error } = usePolling(
//     //     () => onPollingCallback(PendingProcessActionTypeEnum.G2G_UPDATE), 
//     //     { interval: 5000,  onError: (error) => onPollingError(PendingProcessActionTypeEnum.G2G_UPDATE, error) }
//     // )






//     // const pollEmploymentStatus = async () => {
//     //     const pObj = createHttpPoller({
//     //         intervalInMs: 5000, // Poll every 5 seconds
//     //         processResult: async () => {
//     //             const response: Project = await fetchProjectDetails("683aaac7f4d10e6ffe5eeb90");
//     //             return response
//     //         },
//     //         isDone: (result: Project) => result.enabled === false,
//     //     });

//     //     const result = await pObj.pollUntilDone();
//     //     console.log('Project is now disabled status is now true:', result);
//     // };


// //     interface EmploymentState extends OperationState<boolean> {
// //         employed: boolean;
// //     }

// //     const runningOperation: RunningOperation = {
// //   url: 'http://localhost:3000/api/person/status',
// //   method: 'GET',
// //   headers: {
// //     'Content-Type': 'application/json'
// //   }
// // };
// //     let lro : RunningOperation = {
// //         /**
// //          * A function that can be used to send initial request to the service.
// //          */
// //         sendInitialRequest: async () => {},
// //         /**
// //          * A function that can be used to poll for the current status of a long running operation.
// //          */
// //         sendPollRequest: (path: string, options?: { abortSignal?: AbortSignalLike }) => {employed: true};
// //     }

// //     const pollEmploymentStatus = async (personId: string) => {
// //         const poller: PollerLike = createHttpPoller(lro, {
// //             intervalInMs: 5000, // Poll every 5 seconds
// //             processResult: async () => {
// //                 const response: Project = await fetchProjectDetails("683aaac7f4d10e6ffe5eeb90");
// //                 return response
// //             },
// //             isDone: (result: Project) => result.enabled === false,
// //         });

// //         try {
// //             const result = await poller.pollUntilDone();
// //             console.log(`Person is employed: ${result}`);
// //         } catch (error) {
// //             console.error('Error polling employment status:', error);
// //         }
// //     };


// //==============================================================================

// // <Typography sx={{mt:10, ml: 5}}>{getAltTextContent()}</Typography>}


// // opened={generalInfoModalState}
//                 // title={generalInfoDialogProps?.title ?? ''}
//                 // close={generalInfoModalActioner.close}
//                 // onFormClosed={generalInfoDialogProps?.onFormClosed as any}
//                 // selectionLabel={generalInfoDialogProps?.selectionLabel ?? ''}
//                 // textMainLabel={generalInfoDialogProps?.textMainLabel ?? ''}
//                 // selectionCtrlOptions={generalInfoDialogProps?.selectionCtrlOptions ?? []}
//                 // showSelectionCtrl={generalInfoDialogProps?.showSelectionCtrl ?? false}
//                 // showTextMainCtrl={generalInfoDialogProps?.showTextMainCtrl ?? false}
//                 // showTextOtherCtrl={generalInfoDialogProps?.showTextOtherCtrl ?? false}
//                 // showLargeTextCtrl={generalInfoDialogProps?.showLargeTextCtrl ?? false}
//                 // showBooleanValueCtrl={generalInfoDialogProps?.showBooleanValueCtrl ?? false}
//                 // showMapperCtrl={generalInfoDialogProps?.showMapperCtrl ?? false}
//                 // warningText={generalInfoDialogProps?.warningText}
//                 // showRegexExpressionCollector={generalInfoDialogProps?.showRegexExpressionCollector ?? false}
//                 // contextualInfo={generalInfoDialogProps?.contextualInfo as any}  />}





// // let updatedProj = await replaceProjectPropertyCategoryInFull(project?._id.toString() as string, ProjectPropertyCategoryEnum.CLEARANCE_RELATION, [clrRelProp])
// // if(updatedProj) {
// //     setClrRelationsProps(updatedProj.clearanceRelationBrands ?? [])
// //     setProject(updatedProj);
// //     displayQuickMessage(UIMessageType.SUCCESS_MSG, `Changes to clearance relation names have been commited...`)
// // }


// // let updatedProj = await replaceProjectPropertyCategoryInFull(project?._id.toString() as string, ProjectPropertyCategoryEnum.CLEARANCE_RELATION, [newClearanceRelationProperty])
// // if(updatedProj) {
// //     setProject(updatedProj);
// //     displayQuickMessage(UIMessageType.SUCCESS_MSG, `Changes to clearance relation names have been commited...`)
// // }

// //=================================================================================================


// // <Box height={showControls ? 50 : 30} sx={{ display: "flex", flexDirection:"row" }} ref={containerRef}>
                    
// //     <Tooltip sx={{ml: 2, padding: 0}} placement="top" title={showControls ? `Hide C2C Layout controls` : `Show C2C Layout controls`}>
// //         <span>
// //             <IconButton disabled={(selectedRuleArea && selectedRuleArea.ruleAreaName) ? false : true} onClick={(e) => onActionButtonClick()}>
// //                 <Settings color={(showControls && selectedRuleArea && selectedRuleArea.ruleAreaName) ? "secondary" : "inherit"}/>
// //             </IconButton>
// //         </span>
// //     </Tooltip>
    
// //     <Divider orientation="vertical" sx={{height: showControls ? 50 : 30, marginLeft: 4, marginRight: 4 }} />
    
// //     <Box>
// //         <Slide direction="left" in={showControls} container={containerRef.current}>
// //             <Box>
// //                 {showControls && 
// //                     <Box display="flex" flexDirection="row" alignItems="center" >
                        
// //                         <Tooltip placement="top-end" title={selectedRuleArea?.ruleAreaName ?? ''} >
// //                             <Autocomplete 
// //                                 value={selectedRuleArea?.ruleAreaName ?? ""}
// //                                 onChange={(event: any, value: string | null) => { ruleAreaSelectionMade(value);}}
// //                                 key="ra-sel-cb"
// //                                 freeSolo={false}
// //                                 filterSelectedOptions={true}
// //                                 disablePortal
// //                                 disableListWrap
// //                                 size="small"
// //                                 id="ra-sel-cb"
// //                                 sx={{ mt:.7, minWidth: 275 }}
// //                                 options={['', ...packageLayout?.ruleAreas.map(a => a.ruleAreaName) ?? []]}
// //                                 renderInput={(params) => <TextField {...params} 
// //                                     label="Select Rule Area" 
// //                                     size="small" 
// //                                     sx={{ '& .MuiInputBase-input': { fontSize: (selectedRuleArea?.ruleAreaName && selectedRuleArea?.ruleAreaName.length > 30) ? 9 : 12.5 } }}
// //                                 />}
// //                             /> 
// //                         </Tooltip>
                        
// //                         <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />

// //                         <Tooltip key={`c2c-clr-tt`} placement="top" title={`Click here to remove all C2C relations defined for '${selectedRuleArea?.ruleAreaName ?? ""}'.`}>
// //                             <span>
// //                                 <SpButton
// //                                     intent="plain"
// //                                     onClick={handleShowG2GLayout}
// //                                     key={`c2cb-2`}
// //                                     startIcon={<GroupWorkOutlined />}
// //                                     sx={{ width:130, height: 30}}
// //                                     label="Open G2G View"
// //                                     disabled={(lgSetInfo.value && netclasses.length > 0) ? false : true}
// //                                 />                    
// //                             </span>
// //                         </Tooltip>


// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
// //                             <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />
// //                         }
                        
// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) && 
// //                             <Tooltip key={`c2c-cp-tt`} placement="top" title={`Click here to copy '${selectedRuleArea?.ruleAreaName ?? ""}' C2C relations to another rule area.`}>
// //                                 <span>
// //                                     <SpButton
// //                                         intent="caution"
// //                                         onClick={handleRuleAreaRelationsCopyOver}
// //                                         key={`c2cb-1`}
// //                                         startIcon={<CopyAllOutlined />}
// //                                         sx={{ width:130, height: 30}}
// //                                         label="Copy C2C Over"
// //                                         disabled={false}
// //                                     />                    
// //                                 </span>
// //                             </Tooltip>
// //                         }

// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
// //                             <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />
// //                         }

// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) && 
// //                             <Tooltip key={`c2c-clr-tt`} placement="top" title={`Click here to remove all C2C relations defined for '${selectedRuleArea?.ruleAreaName ?? ""}'.`}>
// //                                 <span>
// //                                     <SpButton
// //                                         intent="caution"
// //                                         onClick={handleClearC2CLayout}
// //                                         key={`c2cb-2`}
// //                                         startIcon={<ClearAllOutlined />}
// //                                         sx={{ width:147, height: 30}}
// //                                         label="Clear C2C Layout"
// //                                         disabled={false}
// //                                     />                    
// //                                 </span>
// //                             </Tooltip>
// //                         }

// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
// //                             <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />
// //                         }

// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
// //                             <Tooltip placement="top" title={`Click here to show/hide rows and/or columns on the C2C grid`}>
// //                                 <IconButton sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} onClick={handleShowHideCoordinateAxis}>
// //                                     <Visibility fontSize="large" color="secondary"/>
// //                                 </IconButton>
// //                             </Tooltip>}

// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
// //                             <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />
// //                         }
                        
// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) && 
// //                         <Tooltip placement="top" title={(project && project.lockedBy && project.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`}>
// //                             <IconButton sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} onClick={processProjectLockAndUnlock}>
// //                                 {(project && project.lockedBy && project.lockedBy.length > 0)
// //                                     ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
// //                                     : <LockOpenOutlined fontSize="large" color="secondary"/>
// //                                 }
// //                             </IconButton>
// //                         </Tooltip>}

// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
// //                             <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />
// //                         }

// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) && 
// //                         <Tooltip placement="top" title={(showRightElementOnGrid) ? `Hide right panel on grid` : `Show right panel on grid`}>
// //                             <Switch 
// //                                 size="small"
// //                                 sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} 
// //                                 checked={showRightElementOnGrid}
// //                                 onChange={onRightElementEnablementChanged} 
// //                             />
// //                         </Tooltip>}



// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
// //                             <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />
// //                         }
                        
// //                         {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0 && checkSelectedRowIfaces()) && 
// //                             <Tooltip key={`c2c-gv-tt`} placement="top" title={`Go to interface for selected clearance-relation(s)`}>
// //                                 <span>
// //                                     <IconButton onClick={(event) => onTransferToInterfaceClearanceDataView()} sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
// //                                         <ExitToAppOutlined color="secondary" />
// //                                     </IconButton>                 
// //                                 </span>
// //                             </Tooltip>
// //                         }

// //                     </Box>
// //                 }
// //             </Box>

// //         </Slide>
// //     </Box>
// // </Box>



// //================================================================================================================================




// {/* {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) && 
//                                         <Tooltip key={`c2c-sh-tt`} placement="top" title={`Click here to show/hide rows and/or columns on the C2C grid`}>
//                                             <span>
//                                                 <SpButton
//                                                     intent="plain"
//                                                     onClick={handleShowHideCoordinateAxis}
//                                                     key={`c2cb-3`}
//                                                     startIcon={<VisibilityOutlined />}
//                                                     sx={{ width:140, height: 30}}
//                                                     label="Show/Hide"
//                                                     disabled={false}
//                                                 />                    
//                                             </span>
//                                         </Tooltip>
//                                     } */}


                                


//                                     {/* {(selectedRuleArea && clrRelationsProps && clrRelationsProps.length > 0) &&
//                                         <Divider orientation="vertical" sx={{height: 20, marginLeft: 3, marginRight: 3 }} />
//                                     } */}




// //=================================================




//         // setShowControls((prev) => !prev);


//     // const classToClassGridColumns = useMemo(() => {         
//     //     let colNames = Array.from(c2cEnabledColumnToIndexMap.keys())
//     //     let cols = getClasToClassGridColumns(colNames)
//     //     return cols
//     // }, [c2cEnabledColumnToIndexMap]);




    
// // const disableAddRelations : boolean = useMemo(() => {
// //     let gldLGSet = packageLayout?.layerGroupSets?.find((a: LayerGroupSet) => a.name.toLowerCase() === GOLDEN_INDICATOR_NAME.toLowerCase());
// //     let val = (gldLGSet && gldLGSet.layerGroups && gldLGSet.layerGroups.length > 0) ? false : true;
// //     return val
// // }, [packageLayout]);






// /* <SpButton
//                                         intent="plain"
//                                         onClick={handleSaveAll}
//                                         startIcon={<PlaylistAddCheckOutlined />}
//                                         sx={{ mt:1, height: 32, width:200 }}
//                                         label="Copy " /> */

//                                     /* <Divider orientation="vertical" sx={{height: 20, marginLeft: 2, marginRight: 2 }} />
                                    
//                                     <SpButton
//                                         intent="plain"
//                                         onClick={handleClearC2CLayout}
//                                         startIcon={<ClearAllOutlined />}
//                                         sx={{ mt:1, height: 32, width:200 }}
//                                         label="Clear C2C Layout" /> */



//         // if(ruleArea && ruleArea.trim().length > 0) {
//         //     let ra = packageLayout?.ruleAreas.find(a => a.ruleAreaName === ruleArea)
//         //     setSelectedRuleArea(ra ?? null);
//         // }
//         // else {
//         //     setSelectedRuleArea(null);
//         // }


// //=====================================================================================================================================


//     /* <Box sx={{mr: 2, ml: 2}}>
//         <C2CGrid dtHeight={"75.5vh"} contentWidth={showControls ? "51.5vw" : "84vw"} assocControlComponents={[]} gridRef={diffGridRef}/>
//     </Box> */



// //===============================================================================================================================




// // return (
        
// //     <Box>
// //         <Box> 
// //             <Box flexDirection="column" alignItems="center" >
            
// //                 <Box height={showControls ? 50 : 30} sx={{ overflow: 'hidden', display: "flex", flexDirection:"row" }} ref={containerRef}>
// //                     <Tooltip sx={{ml: 2, padding: 0}} placement="top" title={showControls ? `Hide C2C Layout controls` : `Show C2C Layout controls`}>
// //                         <IconButton onClick={(e) => handleChangeControlsVisibility()}>
// //                             <Settings color={showControls ? "secondary" : "inherit"}/>
// //                         </IconButton>
// //                     </Tooltip>
// //                     <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} />
// //                     <Slide direction="left" in={showControls} container={containerRef.current}>
// //                         <Box>
// //                             <Box flexDirection="row" display="flex" alignItems="center" >
// //                                 <Autocomplete 
// //                                     value={selectedRuleArea?.ruleAreaName ?? ""}
// //                                     onChange={(event: any, value: string | null) => { ruleAreaSelectionMade(value);}}
// //                                     key="ra-sel-cb"
// //                                     freeSolo={false}
// //                                     filterSelectedOptions={true}
// //                                     disablePortal
// //                                     disableListWrap
// //                                     size="small"
// //                                     id="ra-sel-cb"
// //                                     sx={{ mt:.7, minWidth: 350, }}
// //                                     options={['', ...packageLayout?.ruleAreas.map(a => a.ruleAreaName) ?? []]}
// //                                     renderInput={(params) => <TextField {...params} label="Select Rule Area" size="small" />}
// //                                 /> 

// //                                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
                                
// //                                 <SpButton
// //                                     intent="plain"
// //                                     onClick={handleSaveC2CLayout}
// //                                     startIcon={<PlaylistAddCheckOutlined />}
// //                                     sx={{ mt:1, height: 32, width:200 }}
// //                                     label="Save All" />

// //                                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 2, marginRight: 2 }} />
                                
// //                                 <SpButton
// //                                     intent="plain"
// //                                     onClick={handleClearC2CLayout}
// //                                     startIcon={<ClearAllOutlined />}
// //                                     sx={{ mt:1, height: 32, width:200 }}
// //                                     label="Clear C2C Layout" />
// //                             </Box>
// //                         </Box>
// //                     </Slide>
// //                 </Box>

// //                 <Divider sx={{ marginLeft: 0, marginRight: 0 }} />

// //             </Box>
            
// //             {(selectedRuleArea && packageLayout && packageLayout.ruleAreas && packageLayout.ruleAreas.length > 0)
// //             ? (
// //                 <Box ref={containerRef2}>
// //                     <Box sx={{ display:"flex", flexDirection: "column", 
// //                         height: "81.5vh", minHeight:"81.5vh", minWidth:400, m: 1, textAlign: "center", backgroundColor: colors.primary[400],
// //                         borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>    
                        
// //                         <Divider sx={{mt:1, mb: 1, mr: 8, ml: 8}} />
                        
// //                         <Box display="flex" flexDirection="row" sx={{mt: 0}}>
// //                             <Slide direction="right" in={showControls} container={containerRef2.current}>
// //                                 <Box display="flex" flexDirection="row" >
// //                                     <Box sx={{width: "56%", ml: 2}}>
// //                                         <ClearanceRelations packageLayout={packageLayout} projObj={project} />
// //                                     </Box>
// //                                     <Divider orientation="vertical" sx={{height: "79vh", marginLeft: 2, marginRight: 2 }} />
// //                                 </Box>
// //                             </Slide>
// //                             <Slide direction="down" in={selectedRuleArea ? true : false} container={containerRef2.current}>
// //                                 <Box display="flex" sx={{ minWidth: 1000, mr: 2, ml: showControls ? -53: -135}}>
// //                                     <C2CGrid dtHeight={"74vh"} contentWidth={showControls ? "50vw": "85vw"} assocControlComponents={[]} gridRef={diffGridRef}/>
// //                                 </Box>
// //                             </Slide>
// //                         </Box>

// //                     </Box>
// //                 </Box>
// //             )
// //             : <Typography sx={{mt:5}}>{getAltTextContent()}</Typography>}
// //         </Box>

// //         {/* {confirmationModalState && <ConfirmationDialog 
// //             opened={confirmationModalState}
// //             close={confirmationModalActioner.close}
// //             onFormClosed={confirmationDialogProps?.onFormClosed as any}
// //             title={confirmationDialogProps?.title ?? ''}
// //             warningText_main={confirmationDialogProps?.warningText_main ?? ''} 
// //             warningText_other={confirmationDialogProps?.warningText_other} 
// //             actionButtonText={confirmationDialogProps?.actionButtonText}
// //             enableSecondaryActionButton={confirmationDialogProps?.enableSecondaryActionButton}
// //             secondaryActionButtonText={confirmationDialogProps?.secondaryActionButtonText}
// //             contextualInfo={confirmationDialogProps?.contextualInfo as any} /> } */}

// //     </Box>
    
// // );


// //==========================================================================================================================================
// // <Box>
// //             {/* <Box sx={{ height: "88vh", mt: 1}}> */}
// //                 <Box minHeight="89vh" display="flex" flexDirection="column" sx={sectionStyle}>    
// //                     <Box display="flex" flexDirection="row" sx={{ml: 5, mt: 1, mb:.4}} gap={2}>
// //                         <Autocomplete 
// //                             onChange={(event: any, value: string | null) => { ruleAreaSelectionMade(value); }}
// //                             freeSolo={false}
// //                             filterSelectedOptions={true}
// //                             disablePortal
// //                             disableListWrap
// //                             disableClearable
// //                             size="small"
// //                             id="cb-ra"
// //                             sx={{ minWidth: 275, marginTop: 0, marginBottom: 0.5 }}
// //                             options={['', ...ruleAreaNames ?? []]}
// //                             value={''}
// //                             renderInput={(params: any) => 
// //                                 <TextField {...params} value={''} size="small" label="Select Rule Area" />
// //                             }
// //                         />
                        
// //                         <Button
// //                             key={`net-diff-1`}
// //                             size="small"
// //                             variant="outlined"
// //                             startIcon={<PlaylistAddCheckCircle />}
// //                             sx={{ backgroundColor: colors.blueAccent[400], width:172, height: 37 }}>
// //                             Save
// //                         </Button>
// //                         <Button
// //                             key={`net-diff-2`}
// //                             size="small"
// //                             variant="outlined"
// //                             startIcon={<PlaylistAddCheckCircle />}
// //                             sx={{ backgroundColor: colors.blueAccent[400], width:235, height: 37 }}>
// //                             Clear All
// //                         </Button>
// //                     </Box>
// //                     <Divider sx={{mt:0, mb: 1, mr: 2}} />
// //                     <Box display="flex" flexDirection="row" >
// //                         <Box sx={{width: "30%", ml: 2}}>
// //                             <ClearanceRelations />
// //                         </Box>
// //                         <Divider orientation="vertical" sx={{height: 850, marginLeft: 3, marginRight: 3 }} />
// //                         <Box sx={{width: "66%", mr: 2}}>
// //                             <C2CGrid dtHeight={"77vh"} assocControlComponents={[]} gridRef={diffGridRef}/>
// //                         </Box>
// //                     </Box>

// //                 </Box>
// //             {/* </Box> */}
// //         </Box>