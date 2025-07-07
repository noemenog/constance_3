import { AccordionDetails, AccordionSummary, Autocomplete, Box, Divider, FormControlLabel, IconButton, Slide, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { Accordion, Tabs, rem } from "@mantine/core";
import { CopyAllOutlined, DiamondOutlined, FileUploadOutlined, FlipToBackOutlined, GraphicEqOutlined, LockOpenOutlined, LockOutlined, PlaylistAddCheckOutlined, PlaylistAddOutlined, ShortTextOutlined, VerticalSplitOutlined, Visibility, WorkspacesOutlined } from "@mui/icons-material";
import InterfaceCollateralsTab from "./InterfaceCollateralsTab";
import InterfaceShadowVoidTab from "./InterfaceShadowVoidTab";
import InterfaceNotesTab from "./InterfaceNotesTab";
import InterfaceOverviewTab from "./InterfaceOverviewTab";
import InterfaceMgmtDialog, { InterfaceMgmtDialogProps } from "../../FormDialogs/InterfaceMgmtDialog";
import { useDisclosure } from "@mantine/hooks";
import { CONFIGITEM__Org_Settings, ConstraintTypesEnum, ActionSceneEnum, UIMessageType, PermissionActionEnum, SPECIAL_RED_COLOR, KeyProjectAspectTypeEnum, CLEARANCE_PAGE_URL_SUFFIX, PHYSICAL_PAGE_URL_SUFFIX, OVERVIEW_PAGE_URL_SUFFIX } from "../../DataModels/Constants";
import { Interface, LayerGroup, LayerGroupSet, LinkageInfo, Netclass, PackageLayout, Project, RuleArea } from "../../DataModels/ServiceModels";
import { copyOverConstraints, createInterface, deleteInterface, fetchG2GContextList, fetchInterfaceDetails, fetchNetclassList, fetchProjectList, updateInterface, updateKeyProjectAspect, updateProject, updateRuleAreas } from "../../BizLogicUtilities/FetchData";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { BasicKVP, BasicProperty, PropertyItem, SPDomainData, LoadingSpinnerInfo, LoggedInUser, MenuInfo } from "../../DataModels/HelperModels";
import InterfaceClearanceRulesTab from "./InterfaceClearanceRulesTab";
import { useSpiderStore } from "../../DataModels/ZuStore";
import InterfacePhysicalRulesTab from "./InterfacePhysicalRulesTab";
import { GridDropDownOption } from "../../CommonComponents/BaseGlideGrid";
import PropListEditorDialog, { PropListEditorDialogProps } from "../../FormDialogs/PropListEditorDialog";
import RulesColumnVisibilityDialog, { RRVisibilityData, RulesColumnVisibilityDialogProps } from "../../FormDialogs/RulesColumnVisibilityDialog";
import { handleLockAction, isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import InterfaceCopyDialog, { InterfaceCopyDialogProps } from "../../FormDialogs/InterfaceCopyDialog";
import { getLGSetMapping, getLGSetOptions, getMaxLGCount, getRelevantProps } from "../../BizLogicUtilities/BasicCommonLogic";
import MenuListComposition from "../../CommonComponents/MenuListComposition";
import LinkageManagementDialog, { LinkageManagementDialogProps } from "../../FormDialogs/LinkageManagementDialog";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import AsciiTextComp from "../../CommonComponents/AsciiText";





interface InterfacesViewProps {
}

const InterfacesView: React.FC<InterfacesViewProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as SPDomainData;
    const proj = domainData.project;
    const ifaces = domainData.interfaceList;
    const seltdIface = domainData.selectedIface
    const pkg = domainData.packageLayout
    const ncList = domainData.netclasses;

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled);
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    const initConfigs = useSpiderStore((state) => state.initConfigs);
    const showRightElementOnGrid = useSpiderStore((state) => state.showRightElementOnGrid);
    const setShowRightElementOnGrid = useSpiderStore((state) => state.setShowRightElementOnGrid);
    
    const{ projectId, interfaceId, tabInfo } = useParams()

    const [interfaceMgmtDialogProps, setInterfaceMgmtDialogProps] = useState<InterfaceMgmtDialogProps>()
    const [interfaceMgmtModalState, interfaceMgmtModalActioner] = useDisclosure(false);

    const [interfaceCopyDialogProps, setInterfaceCopyDialogProps] = useState<InterfaceCopyDialogProps>()
    const [interfaceCopyModalState, interfaceCopyModalActioner] = useDisclosure(false);

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

    const [propEditorModalState, propEditorModalActioner] = useDisclosure(false);
    const [propertiesEditorDialogProps, setPropertiesEditorDialogProps] = useState<PropListEditorDialogProps>();

    const [colVisibilityModalState, colVisibilityModalActioner] = useDisclosure(false);
    const [colVisibilityDialogProps, setColVisibilityDialogProps] = useState<RulesColumnVisibilityDialogProps>();

    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()
    
    const [linkageManagementModalState, linkageManagementModalActioner] = useDisclosure(false);
    const [linkageManagementDialogProps, setLinkageManagementDialogProps] = useState<LinkageManagementDialogProps>();
    
    const [physicalRRFocusRA, setPhysicalRRFocusRA] = useState<RuleArea | null | undefined>();
    const [clearanceRRFocusRA, setClearanceRRFocusRA] = useState<RuleArea | null | undefined>();
    const [project, setProject] = useState<Project>(proj as Project);
    const [interfaceList, setInterfaceList] = useState<Interface[]>(ifaces);
    const [netclasses, setNetclasses] = useState<Netclass[]>(ncList);
    const [packageLayout, setPackageLayout] = useState<PackageLayout>(pkg as PackageLayout)
    const [selectedInterface, setSelectedInterface] = useState<Interface|null>(seltdIface)

    const [physRelevantProps, setPhysRelevantProps] = useState<Map<string, PropertyItem>>(new Map<string, PropertyItem>())
    const [clearanceRelevantProps, setClearanceRelevantProps] = useState<Map<string, PropertyItem>>(new Map<string, PropertyItem>())

    const iconStyle = { width: rem(12), height: rem(12) };
    const containerRef = useRef<HTMLElement>(null);  //important!
    const clrTabRef = useRef();
    const phyTabRef = useRef();

    let isPhyTab = (tabInfo && (tabInfo.toLowerCase() === PHYSICAL_PAGE_URL_SUFFIX)) ? true : false;
    let isClrTab = (tabInfo && (tabInfo.toLowerCase() === CLEARANCE_PAGE_URL_SUFFIX)) ? true : false;
    let isOvTab = (tabInfo && (tabInfo.toLowerCase() === OVERVIEW_PAGE_URL_SUFFIX)) ? true : false;
    let isSpinTab = (!tabInfo || isPhyTab || isClrTab) ? true: false;



    useEffect(() => {
        if(!tabInfo || tabInfo.length === 0) {  //important!
            placePageTitle("Interfaces")
        }
    }, []);


    //important!
    useEffect(() => {
        if(seltdIface) {
            let other = ifaces.filter(a => a._id?.toString() !== seltdIface._id?.toString())
            let newList = other.concat([seltdIface])
            setInterfaceList([...newList])
            setSelectedInterface(seltdIface)
        }
        setSelectedInterface(seltdIface)
    }, [ifaces, seltdIface]);

   
    const knownOrgs : string[] = useMemo(() => {
        let orgInf : any[] = initConfigs?.find(a => a.configName === CONFIGITEM__Org_Settings)?.configValue
        let orgs : string[] = orgInf?.map((a: any) => a.name.toUpperCase())
        return orgs ?? []
    }, [initConfigs]);
    

    //============== For RR tabs =====================================
    useMemo(() => {         
        if(isPhyTab || isClrTab) {
            let physRes = getRelevantProps(project, ConstraintTypesEnum.Physical)
            if(physRes.isSuccessful === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, physRes.message);
            }
            setPhysRelevantProps(physRes.data as Map<string, PropertyItem>);

            let clrRes = getRelevantProps(project, ConstraintTypesEnum.Clearance)
            if(clrRes.isSuccessful === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, clrRes.message);
            }
            setClearanceRelevantProps(clrRes.data as Map<string, PropertyItem>);
        }
    }, [project]);


    const lgSetOptions : GridDropDownOption[] = useMemo(() => {   
        let opts = (isPhyTab || isClrTab) ? getLGSetOptions(packageLayout) : []; 
        return opts;
    }, []);


    type LGSetMapValType = {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}
    const lgSetMapping : Map<string, LGSetMapValType> = useMemo(() => { 
        let map = (isPhyTab || isClrTab) ? getLGSetMapping(packageLayout) : new Map(); 
        return map; 
    }, []);


    const maxLGCount : number = useMemo(() => {         
        let max = (isPhyTab || isClrTab) ? getMaxLGCount(packageLayout) : 0;
        return max;
    }, []);

    //==============End: For RR tabs =====================================


    const ifaceNames = useMemo(() => {         
        return ["", ...(interfaceList ?? []).map(a => a.name)?.sort() ] 
    }, [ifaces, selectedInterface]);


    function handleNewInterface(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CREATE_INTERFACE) === false) { return; }
        if(!packageLayout || (!packageLayout.layerGroupSets) || (packageLayout.layerGroupSets.length === 0)) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface creation. Project does not have stackup/layer-groups. Layer groups are reguired for creation operation`)
            return;
        }
        let ifaceSetupDlgProps: InterfaceMgmtDialogProps = {
            onFormClosed: onNewInterfaceDataAvailable,
            title: "Create New Interface",
            project: project as Project,
            orgs: knownOrgs,
            packageLayout: packageLayout as PackageLayout,
            contextualInfo: { key: "NEW_INTERFACE", value: null },
        }
        setInterfaceMgmtDialogProps(ifaceSetupDlgProps)
        interfaceMgmtModalActioner.open()
    } 


    async function handleUpdateExistingInterface(event: any): Promise<void> {
        let iface = await fetchInterfaceDetails(selectedInterface?._id?.toString() as string)
        if(iface) {
            let ifaceSetupDlgProps: InterfaceMgmtDialogProps = {
                onFormClosed: onInterfaceUpdateDataAvailable,
                title: "Update Interface",
                contextualInfo: { key: "UPDATE_INTERFACE", value: iface },
                project: project as Project,
                orgs: knownOrgs,
                packageLayout: packageLayout as PackageLayout
            }
            setInterfaceMgmtDialogProps(ifaceSetupDlgProps)
            interfaceMgmtModalActioner.open()
        }
        else{
            displayQuickMessage(UIMessageType.ERROR_MSG, "System does not have a record of the relevant interface")
        }
    }


    async function handleCopyInterface(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.COPY_INTERFACE) === false) { return; }
        if(!packageLayout || (!packageLayout.layerGroupSets) || (packageLayout.layerGroupSets.length === 0)) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface copy. Project does not have stackup/layer-groups. Layer groups are reguired for copy operation`)
            return;
        }
        let projList = (await fetchProjectList() ?? []) as Project[];
        projList = projList.filter(a => a._id.toString().toLowerCase().trim() !== project._id.toString().toLowerCase().trim());

        let ifaceCopyDlgProps: InterfaceCopyDialogProps = {
            onFormClosed: onInterfaceCopyDataAvailable,
            title: "Copy Interface",
            contextualInfo: { key: "COPY_INTERFACE", value: null },
            targetProject: project as Project,
            projectList: projList,
            targetPackageLayout: packageLayout as PackageLayout,
            targetExistingNetclasses: netclasses
        }
        setInterfaceCopyDialogProps(ifaceCopyDlgProps)
        interfaceCopyModalActioner.open()
    }


    async function onNewInterfaceDataAvailable(newIfaceInfo: Interface | null, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key === "NEW_INTERFACE") {
            if (newIfaceInfo ) {
                if(contextualInfo.value && contextualInfo.value.length > 0) {
                    await executeIfaceCreation(newIfaceInfo);
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface creation. New interface must have at least one netclass`)
                }
            }
        }
    }


    async function onInterfaceUpdateDataAvailable(iface: Interface | null, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key === "UPDATE_INTERFACE") {
            if (iface ) {
                if(contextualInfo.value && contextualInfo.value.length > 0 && contextualInfo.value[0].interfaceId && contextualInfo.value[0].interfaceId.length > 0) {
                    setLoadingSpinnerCtx({enabled: true, text: `Now updating interface. Please be patient...`} as LoadingSpinnerInfo)
                    let updatedIface : Interface = await updateInterface(iface, false).finally(() => { cancelLoadingSpinnerCtx() });
                    if(updatedIface && updatedIface._id && updatedIface._id.toString().length > 0) {
                        let others = interfaceList?.filter((a: Interface) => a._id !== iface._id) ?? []
                        let concat = others.concat([updatedIface])
                        setInterfaceList(concat)
                        setSelectedInterface(updatedIface);

                        fetchNetclassList(updatedIface.projectId ?? projectId).then((resNCs: Netclass[]) => {
                            if(resNCs && resNCs.length > 0) {
                                setNetclasses(resNCs);
                            }
                        })
                        
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface update completed")
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface update. Interface must have at least one valid netclass`)
                }
            }
        }
    }
    

    async function onInterfaceCopyDataAvailable(contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key === "COPY_INTERFACE") {
            if(contextualInfo.value) {
                let data = contextualInfo.value as [Interface, Map<string, [BasicProperty, Netclass, Netclass]>]
                let copyCandidateIface = data[0]
                let nonTranferableRelationsInfo = data[1]
                if(nonTranferableRelationsInfo && nonTranferableRelationsInfo.size > 0) {
                    let strArr = new Array<string>();
                    for(let [key, value] of nonTranferableRelationsInfo) {
                        let str = `${value[0].name}=>[from ${value[1].name} to ${value[2].name}]`;
                        strArr.push(str);
                    }
                    
                    let cpConfirmData: ConfirmationDialogProps = {
                        onFormClosed: onConfirmationDataAvailable,
                        title: "Please Confirm",
                        warningText_main: `WARNING! The following cross-interface class-to-class (C2C) relations will NOT carry over from source project to target project. Please decide if to proceed with interface copy'?`,
                        warningText_other: strArr.join(", "),
                        actionButtonText: "Proceed",
                        enableSecondaryActionButton: false,
                        secondaryActionButtonText: "",
                        contextualInfo:  { key: "CONFIRM_IFACE_COPY", value: copyCandidateIface },
                    }
                    setConfirmationDialogProps(cpConfirmData)
                    confirmationModalActioner.open()
                }
                else {
                    await executeIfaceCreation(copyCandidateIface);
                }
                
            }    
        }
    }


    async function executeIfaceCreation(newIfaceInfo: Interface) {
        setLoadingSpinnerCtx({enabled: true, text: `Now setting up new interface. `
            + `This might be a lenghty operation. Please be patient...`} as LoadingSpinnerInfo)
        
        let newIface : Interface = await createInterface(newIfaceInfo).finally(() => { cancelLoadingSpinnerCtx() })
        if(newIface && newIface._id && newIface._id.toString().length > 0) {                        
            //NOTE: the router loader function will handle loading the created interface's details
            navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${newIface._id.toString()}/overview`);
            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface setup process has completed")
        }
    }


    async function onInterfaceSelectionChanged(ifaceName: string) {
        if(ifaceName && ifaceName.trim().length > 0) {
            let iface = (interfaceList as Interface[]).find(a => a.name === ifaceName)
            if(iface && iface._id.length > 0) {
                //NOTE: the router loader function will handle loading the selected interface's details
                navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${iface._id.trim()}/overview`)
            }
        }
    }


    function getAltTextContent() : string {
        if(!selectedInterface && (interfaceList && interfaceList.length > 0))
            return `Please select an Interface...`
        else {
            return `Project has no interfaces...`
        }
    }


    function onEditInterfaceProperties(iface: Interface): void {
        let propEditorProps : PropListEditorDialogProps = {
            onFormClosed: onPropEditorDataAvailable,
            title: "Add, update, or delete interface properties",
            contextualInfo:  { key: "IFACE_PROP_EDIT", value: selectedInterface?.associatedProperties ?? [] }, //always pass the entire set to the dialog!
        }
        setPropertiesEditorDialogProps(propEditorProps)
        propEditorModalActioner.open()
    }


    function onPropEditorDataAvailable(props: PropertyItem[] | null, contextualInfo: BasicKVP): void {
        if(props && props.length > 0) {
            let iface = {...selectedInterface} as Interface
            iface.associatedProperties = props
            setLoadingSpinnerCtx({enabled: true, text: `Updating interface properties. Please wait...`})
            updateInterface(iface, true).then((updatedIface: Interface) =>{
                if(updatedIface && updatedIface._id?.toString().length > 0) {
                    navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${updatedIface._id.toString()}/overview`);
                    displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface update process completed")
                }
            })
            .finally(() => {
                setLoadingSpinnerCtx({enabled: false, text: ``})
            })
        }
    }

    
    function onDeleteInterface(iface: Interface): void {
        let delConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Are you sure you want to delete interface '${selectedInterface?.name ?? ''}'?`,
            warningText_other: "Interface collateral files will be deleted permanently!",
            actionButtonText: "Delete",
            enableSecondaryActionButton: false,
            secondaryActionButtonText: "",
            contextualInfo:  { key: "Delete_Action", value: null },
        }
        setConfirmationDialogProps(delConfirmData)
        confirmationModalActioner.open()
    }


    async function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "Delete_Action") {
                if(action === ConfirmationDialogActionType.PROCEED) {
                    setLoadingSpinnerCtx({enabled: true, text: `Deleting interface. Please wait...`})
                    deleteInterface(selectedInterface as Interface).then((res) => {
                        if(res) {
                            //NOTE: the router loader function will handle loading the remaining interfaces, etc
                            navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/`)
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Interface deletion completed!`)
                        }
                        else{
                            displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to successfully delete interface!`)
                        }
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``})
                    })
                }
            }
            else if(contextualInfo.key === "CONFIRM_IFACE_COPY") {
                if(action === ConfirmationDialogActionType.PROCEED) {
                    if(contextualInfo.value) {
                        await executeIfaceCreation(contextualInfo.value as Interface)
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to process interface copy. Required data was not provided!`)
                    }
                }
            }
        }
    }


    function handleShowHideColumns(): void {
        if(isPhyTab || isClrTab) {
            let visibProps = project?.constraintSettings ?? []
            let visibilityDialogProps : RulesColumnVisibilityDialogProps = {
                onFormClosed: onColVisibilityDataAvailable,
                title: "Show/hide constraint elements",
                constraintType: isPhyTab ? ConstraintTypesEnum.Physical : ConstraintTypesEnum.Clearance,
                showNetProps: false,  
                project: project,
                contextualInfo:  { key: "VISIBILITY_CHANGE", value: {iface: selectedInterface, pkgLayout: packageLayout, visProps: visibProps } as RRVisibilityData}, //always pass the entire set to the dialog!
            }
            setColVisibilityDialogProps(visibilityDialogProps)
            colVisibilityModalActioner.open()
        }
    }


    async function onColVisibilityDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo.key === "VISIBILITY_CHANGE") {
                let proj = {...project} as Project
                if(contextualInfo.value.visProps && contextualInfo.value.visProps.length > 0) {
                    proj.constraintSettings = contextualInfo.value.visProps
                    setLoadingSpinnerCtx({enabled: true, text: `Updating project. Please wait...`})
                    updateProject(proj as Project).then((updatedProj: Project) => {
                        if(updatedProj._id) {
                            let data = contextualInfo.value as RRVisibilityData
                            if(data.pkgLayout && data.pkgLayout.ruleAreas && data.pkgLayout.ruleAreas.length > 0) {
                                updateRuleAreas(data.pkgLayout as PackageLayout).then((updatedPkg: PackageLayout) => {
                                    if(updatedPkg._id) {
                                        navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${selectedInterface?._id.toString()}/${tabInfo || ''}`); //this will refresh everything
                                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Visibility settings were updated")
                                    }
                                })
                                .finally(() => {
                                    setLoadingSpinnerCtx({enabled: false, text: ``})
                                })
                            }
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


    async function handleLinkages(constraintType: ConstraintTypesEnum) {
        let g2gList = await fetchG2GContextList(projectId as string)
        let lnkMgmtDlgProps : LinkageManagementDialogProps = {
            onFormClosed: onLinkageManagementDataAvailable,
            title: `Link ${(constraintType === ConstraintTypesEnum.Physical) ? "Netclasses (trace)" : "Clearance Rules (space)"}. Changes to one rule will reflect on all linked rules`,
            constraintType: constraintType,
            project: project,
            netclasses: netclasses,
            ruleAreas: packageLayout.ruleAreas,
            projectInterfaceList: interfaceList,
            g2gContextList: g2gList,
            contextualInfo: { key: "LINKAGE_MGMT", value: null }
        }
        setLinkageManagementDialogProps(lnkMgmtDlgProps)
        linkageManagementModalActioner.open()
    }


    
    async function onLinkageManagementDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo && contextualInfo.key && contextualInfo.key === "LINKAGE_MGMT") {
                let linkageData : LinkageInfo[] = contextualInfo.value
                if(isPhyTab) {
                    setIsLoadingBackdropEnabled(true)
                    let updatedProject = await updateKeyProjectAspect(projectId as string, KeyProjectAspectTypeEnum.PHY_LNK, linkageData).finally(() => { setIsLoadingBackdropEnabled(false) } );
                    if(updatedProject) {
                        setProject(updatedProject);
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Physical linkage update process has completed.")
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Physical linkage data was not successfully updated.")
                    }
                }
                else if(isClrTab) {
                    setIsLoadingBackdropEnabled(true)
                    let updatedProject = await updateKeyProjectAspect(projectId as string, KeyProjectAspectTypeEnum.CLR_LNK, linkageData).finally(() => { setIsLoadingBackdropEnabled(false) } );
                    if(updatedProject) {
                        setProject(updatedProject);
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Clearance linkage update process has completed.")
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Clearance linkage data was not successfully updated.")
                    }
                }
            }
        }
    }
    


   function handleRuleAreaPhyRulesCopyOver(): void {
        if (isPhyTab) {
            let raOpts = packageLayout.ruleAreas.map(a => a.ruleAreaName).sort() ?? []
            if(raOpts.length < 2) {
                displayQuickMessage(UIMessageType.SUCCESS_MSG, "Cannot perform constraints-copy operation. Project must have more than one rule area.")
                return;
            }
            
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.COPY_OVER_PHY_RULES) === false) { return; }
            let giDialogProps: GeneralInfoDialogProps = {
                onFormClosed: onGenInfoDataAvailable,
                title: `Copy '${selectedInterface?.name ?? ''}' Physical Rules to Another Rule Area`,
                warningText: `Warning: all physical rules pertaining to current interface will be overwritten for destination rule area! Source: ${selectedInterface?.name || ''}`,
                showSelectionCtrl: true,
                selectionLabel: "Select Source Rule Area",
                showSecondarySelection: true,
                secondarySelectionLabel: "Select Destination Rule Area",
                selectionCtrlOptions: raOpts,
                contextualInfo: { key: "COPY_PHY_RULES_OVER", value: null },
            }
            setGeneralInfoDialogProps(giDialogProps)
            generalInfoModalActioner.open()
        }
    }
    

    function onGenInfoDataAvailable(data: GeneralInfoUIContext | null): void {
        if(data && data.contextualInfo) {
            if(data.contextualInfo.key === "COPY_PHY_RULES_OVER") {
                let srcRAName = data?.selection
                let destRAName = data?.secondarySelection
                if(srcRAName && srcRAName.length > 0 && destRAName && destRAName.length > 0) {
                    let srcRA = packageLayout.ruleAreas.find(a => a.ruleAreaName === srcRAName)
                    let destRA = packageLayout.ruleAreas.find(a => a.ruleAreaName === destRAName)
                    if(srcRA && destRA) {
                        setLoadingSpinnerCtx({enabled: true, text: `Now copying physical rules from source to destination rule-area. This might take some time. Please wait...`})
                        copyOverConstraints(projectId as string, srcRA, destRA, ConstraintTypesEnum.Physical, selectedInterface?._id.toString() as string).then((res: boolean) => {
                            if(res) {
                                displayQuickMessage(UIMessageType.SUCCESS_MSG, `Physical rules have been copied to destination rule area`)
                            }
                            else {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `Physical rules were not successfully copied over.`)
                            }
                        })
                        .finally(() => {
                            setLoadingSpinnerCtx({enabled: false, text: ``})
                        })
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `Physical rules were not successfully copied over. Issue occured during selection of source and destination rule areas`)
                    }
                }
            }
        }
    }


    
    function getSubMenuItems() : Array<MenuInfo> {
        let menuArr = new Array<MenuInfo>();
        
        menuArr.push({
            label: "Create Interface",
            icon: <PlaylistAddOutlined />,
            callbackAction: (kvp: BasicKVP) => { handleNewInterface() }
        });
        menuArr.push({
            label: "Copy Interface",
            icon: <CopyAllOutlined />,
            callbackAction: (kvp: BasicKVP) => { handleCopyInterface() }
        });
        
        if (isPhyTab) {
            menuArr.push({
                label: "COPY Physical Rules to Other RuleArea",
                icon: <FlipToBackOutlined />,
                indicateWarning: true,
                callbackAction: (kvp: BasicKVP) => { handleRuleAreaPhyRulesCopyOver() }
            });
        }

        if (isPhyTab || isClrTab) {
            menuArr.push({
                label: "Show/Hide Columns",
                icon: <Visibility />,
                callbackAction: (kvp: BasicKVP) => { handleShowHideColumns() }
            });

            menuArr.push({
                label: `Manage ${isPhyTab ? ConstraintTypesEnum.Physical : ConstraintTypesEnum.Clearance} Rule Linkages`,
                icon: <WorkspacesOutlined />,
                callbackAction: (kvp: BasicKVP) => { handleLinkages((isPhyTab ? ConstraintTypesEnum.Physical : ConstraintTypesEnum.Clearance)) }
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
        }

        return menuArr;
    }


    const asciiContentCtx : {asciiInfo: any, mapKey: any} = useMemo(() => {
        let asciiInfo = new Map<string, number>([
            ['Doh', 3],
            ['Broadway KB', 9],
            ['Cybermedium', 9],
            ['Dot Matrix', 4]
        ])
        let quickRand = Math.floor(Math.random() * asciiInfo.size);
        let mapKey = [...asciiInfo.keys()].at(quickRand) as any
        return {asciiInfo: asciiInfo, mapKey: mapKey}
    }, []);



    return (
        <Box>
            <Box minWidth={1200}> 
                <Box flexDirection="column" alignItems="center" >
                
                    <Box  height={50} sx={{ overflow: 'hidden', display: "flex", flexDirection:"row", ml: 1 }} ref={containerRef}>
                        <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: 0}}>
                            <Autocomplete 
                                value={selectedInterface?.name ?? ""}
                                onChange={(event, value) => { onInterfaceSelectionChanged(value as string); }}
                                key="iface-sel-cb"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="iface-sel-cb"
                                sx={{ mt:.7, minWidth: 350, }}
                                options={ifaceNames}
                                renderInput={(params) => <TextField {...params} label="Select Interface" size="small" />}
                            /> 

                            <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
                            </Slide>

                            <MenuListComposition disableAnimation={isSpinTab ? false: true} menuItems={getSubMenuItems()} tooltipTitle={"Show/hide interface related settings"} />

                            <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 6 }} />
                            </Slide>

                        </Box>
                    </Box>
  
                    <Divider sx={{ marginLeft: 0, marginRight: 0 }} />

                </Box>
                
                {(selectedInterface)
                ? (
                    <Tabs   //TODO: add minimin width on this to make sure the page shring doesnt look wierd
                        className="tabs"
                        classNames={{ tab: "tabstab", panel: "tabspanel" }}
                        orientation="horizontal" 
                        keepMounted={false} 
                        value={tabInfo}
                        // TODO: need to stop the interfaceInFocus and pass it in instead
                        onChange={ (value) => navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${interfaceId ?? selectedInterface?._id?.toString()}/${value}`) } >
                        
                        <Tabs.List variant={"pills"} justify="left">
                            <Tabs.Tab value="overview" leftSection={<PlaylistAddCheckOutlined style={iconStyle} />}>
                                Interface Overview
                            </Tabs.Tab>
                            <Tabs.Tab value={PHYSICAL_PAGE_URL_SUFFIX} leftSection={<DiamondOutlined style={iconStyle} />}>
                                Physical
                            </Tabs.Tab>
                            <Tabs.Tab value={CLEARANCE_PAGE_URL_SUFFIX} leftSection={<VerticalSplitOutlined style={iconStyle} />}>
                                Clearance
                            </Tabs.Tab>
                            <Tabs.Tab value="shadowvoid" leftSection={<GraphicEqOutlined style={iconStyle} />}>
                                Shadow Void
                            </Tabs.Tab>
                            <Tabs.Tab value="collaterals" leftSection={<FileUploadOutlined style={iconStyle} />}>
                                Collaterals
                            </Tabs.Tab>
                            <Tabs.Tab value="notes" leftSection={<ShortTextOutlined style={iconStyle} />}>
                                Notes
                            </Tabs.Tab>
                        </Tabs.List>


                        <Tabs.Panel value="overview" >
                            <InterfaceOverviewTab ifaceObj={selectedInterface} project={project} onEditInterfaceProperties={onEditInterfaceProperties} 
                                onUpdateInterface={handleUpdateExistingInterface} onDeleteInterface={onDeleteInterface} />
                        </Tabs.Panel>

                        <Tabs.Panel value={PHYSICAL_PAGE_URL_SUFFIX}>
                            <InterfacePhysicalRulesTab iface={selectedInterface} focusRA={physicalRRFocusRA} setFocusRA={setPhysicalRRFocusRA} 
                                lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} relevantPropMap={physRelevantProps} />
                        </Tabs.Panel>

                        <Tabs.Panel value={CLEARANCE_PAGE_URL_SUFFIX}>
                            <InterfaceClearanceRulesTab iface={selectedInterface} focusRA={clearanceRRFocusRA} setFocusRA={setClearanceRRFocusRA} 
                                lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} relevantPropMap={clearanceRelevantProps} />
                        </Tabs.Panel>

                        <Tabs.Panel value="shadowvoid">
                            <InterfaceShadowVoidTab iface={selectedInterface} project={project} />
                        </Tabs.Panel>

                        <Tabs.Panel value="collaterals">
                            <InterfaceCollateralsTab iface={selectedInterface} project={project}/>
                        </Tabs.Panel>

                        <Tabs.Panel value="notes">
                            <InterfaceNotesTab iface={selectedInterface} project={project}/>
                        </Tabs.Panel>
                    </Tabs>
                )
                : <Box sx={{mt:20, ml: 5}}>
                    <AsciiTextComp 
                        text={getAltTextContent()} 
                        font={asciiContentCtx.mapKey} 
                        fontSize={asciiContentCtx.asciiInfo.get(asciiContentCtx.mapKey) as number}>
                    </AsciiTextComp>
                </Box>}
            </Box>
            
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            {interfaceMgmtModalState && <InterfaceMgmtDialog  opened={interfaceMgmtModalState} close={interfaceMgmtModalActioner.close} {...interfaceMgmtDialogProps as InterfaceMgmtDialogProps} />}
            {interfaceCopyModalState && <InterfaceCopyDialog opened={interfaceCopyModalState} close={interfaceCopyModalActioner.close} {...interfaceCopyDialogProps as InterfaceCopyDialogProps} />}
            {propEditorModalState && <PropListEditorDialog opened={propEditorModalState} close={propEditorModalActioner.close} {...propertiesEditorDialogProps as PropListEditorDialogProps} />}
            {colVisibilityModalState && <RulesColumnVisibilityDialog  opened={colVisibilityModalState} close={colVisibilityModalActioner.close} {...colVisibilityDialogProps as RulesColumnVisibilityDialogProps} />}
            {generalInfoModalState && <GeneralInfoDialog 
                opened={generalInfoModalState} 
                close={() => {
                    generalInfoModalActioner.close()
                    //just in case if the RR table/view is expanded: this will force it to close therefore forcing a refresh of data after linkage changes
                    setPhysicalRRFocusRA(null);
                    setClearanceRRFocusRA(null);
                }}
                {...generalInfoDialogProps as GeneralInfoDialogProps} />
            }
            {linkageManagementModalState && <LinkageManagementDialog 
                opened={linkageManagementModalState}
                close={() => {
                    linkageManagementModalActioner.close()
                    //just in case if the RR table/view is expanded: this will force it to close therefore forcing a refresh of data after linkage changes
                    setPhysicalRRFocusRA(null);
                    setClearanceRRFocusRA(null);
                }}
                {...linkageManagementDialogProps as LinkageManagementDialogProps} />
            }

        </Box>
    )


}

export default InterfacesView













    // const disableActions : boolean = useMemo(() => {
    //     let hasValidRuleAreas = (packageLayout && packageLayout.ruleAreas && packageLayout?.ruleAreas.length > 0) ? true : false;
    //     let gldLGSet = packageLayout?.layerGroupSets?.find((a: LayerGroupSet) => a.name.toLowerCase() === GOLDEN_INDICATOR_NAME.toLowerCase());
    //     let val = (hasValidRuleAreas && gldLGSet && gldLGSet.layerGroups && gldLGSet.layerGroups.length > 0) ? false : true;
    //     return val
    // }, [packageLayout]);

    



// async function onLinkageManagementDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
//     if(contextualInfo && contextualInfo.value) {
//         if(contextualInfo && contextualInfo.key && contextualInfo.key === "LINKAGE_MGMT") {
//             let linkageData : LinkageInfo[] = contextualInfo.value
//             let proj = {...project}
//             if(linkageManagementDialogProps?.constraintType === ConstraintTypesEnum.Physical) {
//                 proj.physicalLinkages = linkageData;
//             }
//             else if(linkageManagementDialogProps?.constraintType === ConstraintTypesEnum.Clearance) {
//                 proj.clearanceLinkages = linkageData;
//             }

//             setLoadingSpinnerCtx({enabled: true, text: `Updating project. Please wait...`})
//             updateProject(proj, false).then((updatedProject: Project) => {
//                 if(updatedProject) {
//                     setProject(updatedProject);
//                     displayQuickMessage(UIMessageType.SUCCESS_MSG, "Project update process has completed.")
//                 }
//             })
//             .finally(() => {
//                 setLoadingSpinnerCtx({enabled: false, text: ``})
//             })
//         }
//     }
// }




{/* {(isPhyTab || isClrTab) && <Tooltip placement="top" title={(showRightElementOnGrid) ? `Hide right panel on grid` : `Show right panel on grid`}>
    <Switch 
        size="small"
        sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} 
        checked={showRightElementOnGrid}
        onChange={onRightElementEnablementChanged} 
    />
</Tooltip>}

{(isPhyTab || isClrTab) && <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
    <Divider orientation="vertical" sx={{height: 20, marginLeft: 6, marginRight: 2 }} />
</Slide>} */}




//============================================================================================================


// <Box  height={showControls ? 50 : 30} sx={{ overflow: 'hidden', display: "flex", flexDirection:"row" }} ref={containerRef}>
    // {/* <Tooltip sx={{ml: 2, padding: 0}} placement="top" title={showControls ? `Hide interface menu controls` : `Show interface menu controls`}>
    //     <span>
    //         <IconButton disabled={(selectedInterface && selectedInterface.name) ? false : true} onClick={(e) => handleChangeControlsVisibility()}>
    //             <Settings color={(showControls && selectedInterface && selectedInterface.name) ? "secondary" : "inherit"}/>
    //         </IconButton>
    //     </span>
    // </Tooltip> */}
    // {/* <Divider orientation="vertical" sx={{height: 50, marginLeft: 4, marginRight: 4 }} /> */}
//     <Box ml={1}>
//         {showControls && <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: 0}}>
//             <Autocomplete 
//                 value={selectedInterface?.name ?? ""}
//                 onChange={(event, value) => { onInterfaceSelectionChanged(value as string); }}
//                 key="iface-sel-cb"
//                 freeSolo={false}
//                 filterSelectedOptions={true}
//                 disablePortal
//                 disableListWrap
//                 size="small"
//                 id="iface-sel-cb"
//                 sx={{ mt:.7, minWidth: 350, }}
//                 options={ifaceNames}
//                 renderInput={(params) => <TextField {...params} label="Select Interface" size="small" />}
//             /> 

//             <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={showControls} container={containerRef.current}>
//                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
//             </Slide>

//             <SpButton
//                 intent="plain"
//                 onClick={handleNewInterface}
//                 startIcon={<PlaylistAddOutlined />}
//                 sx={{ mt:1, height: 32, minWidth: 150, width: 150 }}
//                 label="Create Interface" 
//                 disabled={disableActions} 
//             />

//             <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={showControls} container={containerRef.current}>
//                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 2, marginRight: 2 }} />
//             </Slide>

//             <SpButton
//                 intent="plain"
//                 onClick={handleCopyInterface}
//                 startIcon={<CopyAllOutlined />}
//                 sx={{ mt:1, height: 32, minWidth: 150, width: 150 }}
//                 label="Copy Interface"
//                 disabled={disableActions}
//             />

//             {(isPhyTab || isClrTab) && <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={showControls} container={containerRef.current}>
//                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 2, marginRight: 2 }} />
//             </Slide>}

//             {(isPhyTab || isClrTab) && <Tooltip placement="top" title={`Show / hide columns and rule areas`}>
//                 <IconButton sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} onClick={handleShowHideColumns}>
//                     <Visibility fontSize="large" color="secondary"/>
//                 </IconButton>
//             </Tooltip>}

//             {(isPhyTab || isClrTab) && <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={showControls} container={containerRef.current}>
//                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 2, marginRight: 2 }} />
//             </Slide>}
                
//             {(isPhyTab || isClrTab) && <Tooltip placement="top" title={(project && project.lockedBy && project.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`}>
//                 <IconButton sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} onClick={processProjectLockAndUnlock}>
//                     {(project && project.lockedBy && project.lockedBy.length > 0)
//                         ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
//                         : <LockOpenOutlined fontSize="large" color="secondary"/>
//                     }
//                 </IconButton>
//             </Tooltip>}
            
           

//             <MenuListComposition menuItems={menuArr} tooltipTitle={"Show/hide interface related settings"} />

//             <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={showControls} container={containerRef.current}>
//                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 2 }} />
//             </Slide>

//             {(isPhyTab || isClrTab) && <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={showControls} container={containerRef.current}>
//                 <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 6 }} />
//             </Slide>}

//             {(isPhyTab || isClrTab) && <Tooltip placement="top" title={(showRightElementOnGrid) ? `Hide right panel on grid` : `Show right panel on grid`}>
//                 <Switch 
//                     size="small"
//                     sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}} 
//                     checked={showRightElementOnGrid}
//                     onChange={onRightElementEnablementChanged} 
//                 />
//             </Tooltip>}
            

//         </Box>}
//     </Box>
// </Box>



// /===========================================================================================================


        // setLoadingSpinnerCtx({enabled: true, text: "Now processing interface creation. Please wait..."} as LoadingSpinnerInfo)
                    // let newIface : Interface = await createInterface(newIfaceInfo).finally(() => { cancelLoadingSpinnerCtx() })
                    // if(newIface && newIface._id && newIface._id.toString().length > 0) {                        
                    //     //NOTE: the router loader function will handle loading the created interface's details
                    //     navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${newIface._id.toString()}/overview`);
                    //     displayQuickMessage(UIMessageType.SUCCESS_MSG, "New Interface creation completed")
                    // }


        // createInterface(copyCandidateIface).then((copyIface: Interface) => {
        //     if(copyIface && copyIface._id && copyIface._id.toString().length > 0) {                        
        //         //NOTE: the router loader function will handle loading the created interface's details
        //         navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${copyIface._id.toString()}/overview`);
        //         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface copy process has completed")
        //     }
        // }).finally(() => { 
        //     cancelLoadingSpinnerCtx();
        // })






                                {/* {(isPhyTab || isClrTab) && <SpButton
                                    intent="plain"
                                    onClick={handleShowHideColumns}
                                    startIcon={<VisibilityOutlined />}
                                    sx={{ mt:1, height: 32, minWidth: 180, width: 180 }}
                                    label="Show/Hide"
                                    disabled={disableActions}
                                />} */}




// <SpButton
//                     intent="plain"
//                     onClick={() => { 
//                         setEnableRightElement((enableRightElement === true) ? false : true); 
//                         gridActionRef.current?.setRightElementEnablement((enableRightElement === true) ? false : true) 
//                         gridActionRef.current?.reloadDataRows()
//                     }}
//                     key={`c2cb-399`}
//                     startIcon={<VisibilityOutlined />}
//                     sx={{ width:140, height: 30}}
//                     label={(enableRightElement === true) ? "Hide" : "Show"}
//                     disabled={false}
//                 />   




// const confRelevantProps = useMemo(() => {         
//     let physRelevantProps = new Map<string, PropertyItem>();
//     let clearanceRelevantProps = new Map<string, PropertyItem>();
    
//     let physConstrSettings = project?.constraintSettings?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase())
//     if(!physConstrSettings || physConstrSettings.length === 0) {
//         displayQuickMessage(UIMessageType.ERROR_MSG, `Physical rules properties/settings were not found for project`)
//     }
    
//     for(let i = 0; i < physConstrSettings.length; i++) {
//         let prop = physConstrSettings[i] as PropertyItem
//         let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.value
//         if(prop.enabled === true) {
//             if(displaySettings && displaySettings.subType && displaySettings.subType.toLowerCase() === "lengthmatching") {
//                 physRelevantProps.set(prop.name, prop)
//             }
//         }
//     }



//     (async function fetchConstrConf() {
//         if(!confConstraintProps || (confConstraintProps.length === 0)) {
//             setLoadingSpinnerCtx({enabled: true, text: "Retrieving constraint configurations. Please wait..."} as LoadingSpinnerInfo)
//             let constrSettings: PropertyItem[] = await getConstraintProperties(project?._id as string, project?.org as string).finally(() => { cancelLoadingSpinnerCtx() })
//             if(constrSettings) {
//                 setConfConstraintProps(constrSettings ?? [])
//             }
//         }
//     })();

//     if(confConstraintProps && confConstraintProps.length > 0) {
//         for(let i = 0; i < confConstraintProps.length; i++) {
//             let prop = confConstraintProps[i] as PropertyItem
//             if(prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase()) {
//                 physRelevantProps.set(prop.name, prop)
//             }
//             else if(prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase()) {
//                 clearanceRelevantProps.set(prop.name, prop)
//             }
//         }
//     }
//     if(physRelevantProps.size === 0) {
//         displayQuickMessage(UIMessageType.ERROR_MSG, `Configured physical rule properties were not found. Please check config management system for '${CONFIGITEM__Physical_Constraint_Properties}'`)
//     }
//     if(clearanceRelevantProps.size === 0) {
//         displayQuickMessage(UIMessageType.ERROR_MSG, `Configured clearance rule properties were not found. Please check config management system for '${CONFIGITEM__Clearance_Constraint_Properties}'`)
//     }
//     return {physConfProps: physRelevantProps, clrConfProps: clearanceRelevantProps}
// }, [confConstraintProps]);




// function getIfaceNames() { 
//     return ["", ...(interfaceList ?? []).map(a => a.name)?.sort() ] 
// }


// getProjectAggregateSummary(project?._id.toString() as string).then((netStats) => {
//     if(netStats) {
//         setProjStats(netStats);
//     }
// });




// <Tabs.Panel value="physical">
//     <InterfacePhysicalRulesTab iface={selectedInterface} focusRA={physicalRRFocusRA} setFocusRA={setPhysicalRRFocusRA} 
//         projStats={projStats} lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} 
//         confRelevantProps={confRelevantProps.physConfProps} ruleAreaEnablementMap={physicalRuleAreaEnableMap} onRuleAreaEnablementToggled={onRuleAreaEnablementToggled} />
// </Tabs.Panel>

// <Tabs.Panel value="clearance">
//     <InterfaceClearanceRulesTab iface={selectedInterface} focusRA={clearanceRRFocusRA} setFocusRA={setClearanceRRFocusRA} 
//         projStats={projStats} lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} 
//         confRelevantProps={confRelevantProps.clrConfProps} ruleAreaEnablementMap={clearanceRuleAreaEnableMap} onRuleAreaEnablementToggled={onRuleAreaEnablementToggled}/>
// </Tabs.Panel>



// const physicalRuleAreaEnableMap = useMemo(() => {         
//     let map = new Map<string, boolean>();
//     if(selectedInterface && selectedInterface._id) {
//         for(let ruleArea of packageLayout?.ruleAreas ?? []) {
//             if(ruleArea.physicalInterfaceExclusionList && ruleArea.physicalInterfaceExclusionList.includes(selectedInterface._id.toString())) {
//                 map.set(ruleArea.id, false)
//             }
//             else {
//                 map.set(ruleArea.id, true)
//             }
//         }
//     }
//     return map;
// }, [packageLayout, selectedInterface]);


// const clearanceRuleAreaEnableMap = useMemo(() => {         
//     let map = new Map<string, boolean>();
//     if(selectedInterface && selectedInterface._id) {
//         for(let ruleArea of packageLayout?.ruleAreas ?? []) {
//             if(ruleArea.clearanceInterfaceExclusionList && ruleArea.clearanceInterfaceExclusionList.includes(selectedInterface._id.toString())) {
//                 map.set(ruleArea.id, false)
//             }
//             else {
//                 map.set(ruleArea.id, true)
//             }
//         }
//     }
//     return map;
// }, [packageLayout, selectedInterface]);


// function onRuleAreaEnablementToggled(checked: boolean, ruleArea: RuleArea, iface: Interface, constraintType: ConstraintTypesEnum): void {
//     if(packageLayout.ruleAreas && iface) {
//         let ifaceId = iface._id?.toString()
//         for(let i = 0; i < packageLayout.ruleAreas.length; i++) {
//             if(packageLayout.ruleAreas[i].id === ruleArea.id) {
//                 if(checked === true) {
//                     if(constraintType === ConstraintTypesEnum.Physical) {
//                         packageLayout.ruleAreas[i].physicalInterfaceExclusionList = packageLayout.ruleAreas[i].physicalInterfaceExclusionList.filter(a => a !== ifaceId)
//                     }
//                     else if(constraintType === ConstraintTypesEnum.Clearance) {
//                         packageLayout.ruleAreas[i].clearanceInterfaceExclusionList = packageLayout.ruleAreas[i].clearanceInterfaceExclusionList.filter(a => a !== ifaceId)
//                     }
//                 }
//                 else {
//                     if(constraintType === ConstraintTypesEnum.Physical) {
//                         let existing = packageLayout.ruleAreas[i].physicalInterfaceExclusionList ?? []
//                         let ids = new Set<string>([ifaceId, ...existing])
//                         packageLayout.ruleAreas[i].physicalInterfaceExclusionList = Array.from(ids)
//                     }
//                     else if(constraintType === ConstraintTypesEnum.Clearance) {
//                         let existing = packageLayout.ruleAreas[i].clearanceInterfaceExclusionList ?? []
//                         let ids = new Set<string>([ifaceId, ...existing])
//                         packageLayout.ruleAreas[i].clearanceInterfaceExclusionList = Array.from(ids)
//                     }
//                 }

//                 updateRuleAreas(packageLayout).then((updatedPkg: PackageLayout) => {
//                     setPackageLayout(updatedPkg);
//                 })

//                 break;
//             }
//         }
//     }
// }




// const clearanceConfRelevantProps = useMemo(() => {         
//     let relevantProps = new Map<string, PropertyItem>();
//     if(confConstraintProps && confConstraintProps.length > 0) {
//         for(let i = 0; i < confConstraintProps.length; i++) {
//             let prop = confConstraintProps[i] as PropertyItem
//             if(prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase()) {
//                 relevantProps.set(prop.name, prop)
//             }
//         }
//     }

//     if(relevantProps.size === 0) {
//         displayQuickMessage(UIMessageType.ERROR_MSG, `Configured clearance rule properties were not found. Please check config management system for '${CONFIGITEM__Clearance_Constraint_Properties}'`)
//     }

//     return relevantProps
// }, []);


/* <SpButton
                                        intent="plain"
                                        onClick={handleUpdateExistingInterface}
                                        startIcon={<PlaylistAddOutlined />}
                                        sx={{ mt:1, height: 32, minWidth: 180, width:180 }}
                                        label="Update New Interface" 
                                        disabled={disableActions === false && selectedInterface ? false : true} />

                                    <Divider orientation="vertical" sx={{height: 10, marginLeft: 2, marginRight: 2 }} />
                                     */



    // let selIfaceId = selectedInterface?._id?.toString() ?? ''
    // if(interfaceList) {
    //     setInterfaceList(interfaceList.filter(a => a._id.toString() !== selIfaceId)) 
    // }
    



// let newList = Array.from(interfaceList ?? []).concat([iface])
// setInterfaceList([...newList])


// fetchNetclassList(newIface.projectId ?? projectId).then((ncList: Netclass[]) => {
//     if(ncList && ncList.length > 0) {
//         setNetclasses(ncList);
//     }
// })




    // const selectedInterface = useMemo(() => {
    //     if(interfaceId && interfaceList && interfaceList.length > 0) {
    //         let iface = interfaceList.find(a => a._id === interfaceId)
    //         if(iface && iface._id) {
    //             return iface
    //         }
    //     }
    //     else if(!interfaceId) {
    //         return null
    //     }
    // }, [interfaceList, interfaceId]);


    // useEffect(() => {
    //     if(interfaceId && interfaceList && interfaceList.length > 0) {
    //         let iface = interfaceList.find(a => a._id === interfaceId)
    //         if(iface && iface._id) {
    //             setSelectedInterface(iface)
    //         }
    //     }
    //     else if(!interfaceId) {
    //         setSelectedInterface(null)
    //     }

    // }, [interfaceList, selectedInterface]);

    
    // useEffect(() => {
    //     let ifaceNames = (interfaceList ?? []).map(a => a.name).sort()
    //     setInterfaceNames(ifaceNames)
    // }, [interfaceList]);






// const overviewTabRef = useRef<HTMLButtonElement>(null);
    // const routingRulesTabRef = useRef<HTMLButtonElement>(null);
    // const shadowVoidTabRef = useRef<HTMLButtonElement>(null);
    // const collateralsTabRef = useRef<HTMLButtonElement>(null);
    // const notesTabRef = useRef<HTMLButtonElement>(null);


{/* <FormControlLabel
                            control={ <Switch sx={{ml: 1}} checked={checked} onChange={handleChange} /> }
                            label="Show Interface Controls"
                        /> */}

{/* <Box sx={{color: "black"}} >
                        <Accordion 
                            multiple={true} 
                            variant="contained" 
                            radius="sm"
                            classNames={{ root: "rules-acc-root", label: "rules-acc-label", item: "rules-acc-item", control: "rules-acc-control" }}
                        >
                            
                            <Accordion.Item key={`acc-iface-ctrl`} value={`iface-ctrl`}>
                                <Accordion.Control>{`PHYSICAL --- `}</Accordion.Control>
                                <Accordion.Panel>
                                    <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: "1px"}}>
                                        <Autocomplete 
                                            value={""}
                                            onChange={(event: any, newValue: any) => {
                                                // setLinkType(newValue as string);
                                            }}
                                            key="lnk-type-CB"
                                            freeSolo={false}
                                            filterSelectedOptions={true}
                                            disablePortal
                                            disableListWrap
                                            size="small"
                                            id="lnk-type-cb"
                                            sx={{ m: 0, minWidth: 300, marginTop: 1 }}
                                            options={['', ...["earth", "hello"]]}
                                            renderInput={(params) => <TextField {...params} label="Link Type" size="small" />}
                                        /> 

                                        <Divider orientation="vertical" sx={{height: 50, marginLeft: 8, marginRight: 8 }} />
                                        
                                        <SpButton
                                            intent="plain"
                                            onClick={handleNewInterface}
                                            startIcon={<PlaylistAddCheckOutlined />}
                                            sx={{ m: 1, height: 32, width:200 }}
                                            label="Create New Interface" />

                                        <Divider orientation="vertical" sx={{height: 50, marginLeft: 2, marginRight: 2 }} />
                                        
                                        <SpButton
                                            intent="plain"
                                            onClick={handleCopyInterface}
                                            startIcon={<CopyAllOutlined />}
                                            sx={{ m: 1, height: 32, width:200 }}
                                            label="Copy Interface" />
                                    </Box>
                                </Accordion.Panel>
                            </Accordion.Item>
                                
                        </Accordion>
                    </Box> */}
                        
                        {/* <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: "1px"}}>
                            

                            <Autocomplete 
                                value={""}
                                onChange={(event: any, newValue: any) => {
                                    
                                }}
                                key="lnk-type-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="lnk-type-cb"
                                sx={{ m: 0, minWidth: 300, marginTop: 1 }}
                                options={['', ...["earth", "hello"]]}
                                renderInput={(params) => <TextField {...params} label="Link Type" size="small" />}
                            /> 

                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 8, marginRight: 8 }} />
                            
                            <SpButton
                                intent="plain"
                                onClick={handleNewInterface}
                                startIcon={<PlaylistAddCheckOutlined />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label="Create New Interface" />

                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 2, marginRight: 2 }} />
                            
                            <SpButton
                                intent="plain"
                                onClick={handleCopyInterface}
                                startIcon={<CopyAllOutlined />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label="Copy Interface" />

                        </Box> */}



{/* <Accordion defaultExpanded>
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1-content"
                    id="panel1-header"
                    >
                    <Typography>Expanded by default</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: "1px"}}>
                            <Autocomplete 
                                value={""}
                                onChange={(event: any, newValue: any) => {
                                    // setLinkType(newValue as string);
                                }}
                                key="lnk-type-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="lnk-type-cb"
                                sx={{ m: 0, minWidth: 300, marginTop: 1 }}
                                options={['', ...["earth", "hello"]]}
                                renderInput={(params) => <TextField {...params} label="Link Type" size="small" />}
                            /> 

                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 8, marginRight: 8 }} />
                            
                            <SpButton
                                intent="plain"
                                onClick={handleNewInterface}
                                startIcon={<PlaylistAddCheckOutlined />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label="Create New Interface" />

                            <Divider orientation="vertical" sx={{height: 50, marginLeft: 2, marginRight: 2 }} />
                            
                            <SpButton
                                intent="plain"
                                onClick={handleCopyInterface}
                                startIcon={<CopyAllOutlined />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label="Copy Interface" />
                        </Box>
                    </AccordionDetails>
                </Accordion> */}


