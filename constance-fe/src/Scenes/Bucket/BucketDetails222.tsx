import { AccordionDetails, AccordionSummary, Autocomplete, Box, Divider, FormControlLabel, IconButton, Slide, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { Accordion, Tabs, rem } from "@mantine/core";
import { CopyAllOutlined, DiamondOutlined, FileUploadOutlined, FlipToBackOutlined, GraphicEqOutlined, LockOpenOutlined, LockOutlined, 
    PlaylistAddCheckOutlined, PlaylistAddOutlined, ShortTextOutlined, VerticalSplitOutlined, Visibility, WorkspacesOutlined } from "@mui/icons-material";

import { useDisclosure } from "@mantine/hooks";
import { ActionSceneEnum, UIMessageType, PermissionActionEnum, SPECIAL_RED_COLOR } from "../../DataModels/Constants";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { BasicKVP, BasicProperty, PropertyItem, LoadingSpinnerInfo, LoggedInUser, MenuInfo, CDomainData } from "../../DataModels/HelperModels";
import { useCStore } from "../../DataModels/ZuStore";
import { handleLockAction, isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import MenuListComposition from "../../CommonComponents/MenuListComposition";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import AsciiTextComp from "../../CommonComponents/AsciiText";
import { AppInfo, Bucket } from "../../DataModels/ServiceModels";





interface BucketDetails222Props {
}

const BucketDetails222: React.FC<BucketDetails222Props> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as CDomainData;
    const appInfo = domainData.appInfo;
    const buckets = domainData.bucketList;
    const seltdBucket = domainData.selectedBucket
    // const pkg = domainData.packageLayout
    // const ncList = domainData.bucketList;

    const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useCStore((state) => state.setIsLoadingBackdropEnabled);
    const placePageTitle = useCStore((state) => state.placePageTitle);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
    const initConfigs = useCStore((state) => state.initConfigs);
    
    const{ projectId, interfaceId, tabInfo } = useParams()



    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()
    
    
    // const [physicalRRFocusRA, setPhysicalRRFocusRA] = useState<RuleArea | null | undefined>();
    // const [clearanceRRFocusRA, setClearanceRRFocusRA] = useState<RuleArea | null | undefined>();
    const [project, setProject] = useState<AppInfo>(appInfo as AppInfo);
    const [bucketList, setBucketList] = useState<Bucket[]>(buckets);
    // const [netclasses, setNetclasses] = useState<Netclass[]>(ncList);
    // const [packageLayout, setPackageLayout] = useState<PackageLayout>(pkg as PackageLayout)
    const [selectedBucket, setSelectedBucket] = useState<Bucket|null>(seltdBucket)

    const [physRelevantProps, setPhysRelevantProps] = useState<Map<string, PropertyItem>>(new Map<string, PropertyItem>())
    const [clearanceRelevantProps, setClearanceRelevantProps] = useState<Map<string, PropertyItem>>(new Map<string, PropertyItem>())

    const iconStyle = { width: rem(12), height: rem(12) };
    const containerRef = useRef<HTMLElement>(null);  //important!
    const clrTabRef = useRef();
    const phyTabRef = useRef();

    // let isPhyTab = (tabInfo && (tabInfo.toLowerCase() === PHYSICAL_PAGE_URL_SUFFIX)) ? true : false;
    // let isClrTab = (tabInfo && (tabInfo.toLowerCase() === CLEARANCE_PAGE_URL_SUFFIX)) ? true : false;
    // let isOvTab = (tabInfo && (tabInfo.toLowerCase() === OVERVIEW_PAGE_URL_SUFFIX)) ? true : false;
    // let isSpinTab = (!tabInfo || isPhyTab || isClrTab) ? true: false;



    useEffect(() => {
        if(!tabInfo || tabInfo.length === 0) {  //important!
            placePageTitle("Configs")
        }
    }, []);


    //important!
    // useEffect(() => {
    //     if(seltdIface) {
    //         let other = ifaces.filter(a => a._id?.toString() !== seltdIface._id?.toString())
    //         let newList = other.concat([seltdIface])
    //         setInterfaceList([...newList])
    //         setSelectedInterface(seltdIface)
    //     }
    //     setSelectedInterface(seltdIface)
    // }, [ifaces, seltdIface]);

   
    // const knownOrgs : string[] = useMemo(() => {
    //     // let orgInf : any[] = initConfigs?.find(a => a.configName === CONFIGITEM__Org_Settings)?.configValue
    //     // let orgs : string[] = orgInf?.map((a: any) => a.name.toUpperCase())
    //     // return orgs ?? []
    // }, [initConfigs]);
    

    //============== For RR tabs =====================================
    useMemo(() => {         
        // if(isPhyTab || isClrTab) {
            // let physRes = getRelevantProps(project, ConstraintTypesEnum.Physical)
            // if(physRes.isSuccessful === false) {
            //     displayQuickMessage(UIMessageType.ERROR_MSG, physRes.message);
            // }
            // setPhysRelevantProps(physRes.data as Map<string, PropertyItem>);

            // let clrRes = getRelevantProps(project, ConstraintTypesEnum.Clearance)
            // if(clrRes.isSuccessful === false) {
            //     displayQuickMessage(UIMessageType.ERROR_MSG, clrRes.message);
            // }
            // setClearanceRelevantProps(clrRes.data as Map<string, PropertyItem>);
        // }
    }, [project]);


    // const lgSetOptions : GridDropDownOption[] = useMemo(() => {   
    //     let opts = (isPhyTab || isClrTab) ? getLGSetOptions(packageLayout) : []; 
    //     return opts;
    // }, []);


    // type LGSetMapValType = {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}
    // const lgSetMapping : Map<string, LGSetMapValType> = useMemo(() => { 
    //     let map = (isPhyTab || isClrTab) ? getLGSetMapping(packageLayout) : new Map(); 
    //     return map; 
    // }, []);


    // const maxLGCount : number = useMemo(() => {         
    //     let max = (isPhyTab || isClrTab) ? getMaxLGCount(packageLayout) : 0;
    //     return max;
    // }, []);

    //==============End: For RR tabs =====================================


    const bucketNames = useMemo(() => {         
        return ["", ...(bucketList ?? []).map(a => a.name)?.sort() ] 
    }, [buckets, selectedBucket]);


    function handleNewInterface(): void {
        // if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CREATE_INTERFACE) === false) { return; }
        // if(!packageLayout || (!packageLayout.layerGroupSets) || (packageLayout.layerGroupSets.length === 0)) {
        //     displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface creation. Project does not have stackup/layer-groups. Layer groups are reguired for creation operation`)
        //     return;
        // }
        // let ifaceSetupDlgProps: InterfaceMgmtDialogProps = {
        //     onFormClosed: onNewInterfaceDataAvailable,
        //     title: "Create New Interface",
        //     project: project as Project,
        //     orgs: knownOrgs,
        //     packageLayout: packageLayout as PackageLayout,
        //     contextualInfo: { key: "NEW_INTERFACE", value: null },
        // }
        // setInterfaceMgmtDialogProps(ifaceSetupDlgProps)
        // interfaceMgmtModalActioner.open()
    } 


    // async function handleUpdateExistingInterface(event: any): Promise<void> {
    //     let iface = await fetchInterfaceDetails(selectedInterface?._id?.toString() as string)
    //     if(iface) {
    //         let ifaceSetupDlgProps: InterfaceMgmtDialogProps = {
    //             onFormClosed: onInterfaceUpdateDataAvailable,
    //             title: "Update Interface",
    //             contextualInfo: { key: "UPDATE_INTERFACE", value: iface },
    //             project: project as Project,
    //             orgs: knownOrgs,
    //             packageLayout: packageLayout as PackageLayout
    //         }
    //         setInterfaceMgmtDialogProps(ifaceSetupDlgProps)
    //         interfaceMgmtModalActioner.open()
    //     }
    //     else{
    //         displayQuickMessage(UIMessageType.ERROR_MSG, "System does not have a record of the relevant interface")
    //     }
    // }


    // async function handleCopyInterface(): Promise<void> {
    //     if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.COPY_INTERFACE) === false) { return; }
    //     if(!packageLayout || (!packageLayout.layerGroupSets) || (packageLayout.layerGroupSets.length === 0)) {
    //         displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface copy. Project does not have stackup/layer-groups. Layer groups are reguired for copy operation`)
    //         return;
    //     }
    //     let projList = (await fetchProjectList() ?? []) as Project[];
    //     projList = projList.filter(a => a._id.toString().toLowerCase().trim() !== project._id.toString().toLowerCase().trim());

    //     let ifaceCopyDlgProps: InterfaceCopyDialogProps = {
    //         onFormClosed: onInterfaceCopyDataAvailable,
    //         title: "Copy Interface",
    //         contextualInfo: { key: "COPY_INTERFACE", value: null },
    //         targetProject: project as Project,
    //         projectList: projList,
    //         targetPackageLayout: packageLayout as PackageLayout,
    //         targetExistingNetclasses: netclasses
    //     }
    //     setInterfaceCopyDialogProps(ifaceCopyDlgProps)
    //     interfaceCopyModalActioner.open()
    // }


    // async function onNewInterfaceDataAvailable(newIfaceInfo: Interface | null, contextualInfo: BasicKVP): Promise<void> {
    //     if(contextualInfo && contextualInfo.key === "NEW_INTERFACE") {
    //         if (newIfaceInfo ) {
    //             if(contextualInfo.value && contextualInfo.value.length > 0) {
    //                 await executeIfaceCreation(newIfaceInfo);
    //             }
    //             else {
    //                 displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface creation. New interface must have at least one netclass`)
    //             }
    //         }
    //     }
    // }


    // async function onInterfaceUpdateDataAvailable(iface: Interface | null, contextualInfo: BasicKVP): Promise<void> {
    //     if(contextualInfo && contextualInfo.key === "UPDATE_INTERFACE") {
    //         if (iface ) {
    //             if(contextualInfo.value && contextualInfo.value.length > 0 && contextualInfo.value[0].interfaceId && contextualInfo.value[0].interfaceId.length > 0) {
    //                 setLoadingSpinnerCtx({enabled: true, text: `Now updating interface. Please be patient...`} as LoadingSpinnerInfo)
    //                 let updatedIface : Interface = await updateInterface(iface, false).finally(() => { cancelLoadingSpinnerCtx() });
    //                 if(updatedIface && updatedIface._id && updatedIface._id.toString().length > 0) {
    //                     let others = interfaceList?.filter((a: Interface) => a._id !== iface._id) ?? []
    //                     let concat = others.concat([updatedIface])
    //                     setInterfaceList(concat)
    //                     setSelectedInterface(updatedIface);

    //                     fetchNetclassList(updatedIface.projectId ?? projectId).then((resNCs: Netclass[]) => {
    //                         if(resNCs && resNCs.length > 0) {
    //                             setNetclasses(resNCs);
    //                         }
    //                     })
                        
    //                     displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface update completed")
    //                 }
    //             }
    //             else {
    //                 displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface update. Interface must have at least one valid netclass`)
    //             }
    //         }
    //     }
    // }
    

    async function onInterfaceCopyDataAvailable(contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key === "COPY_INTERFACE") {
            if(contextualInfo.value) {
                // let data = contextualInfo.value as [Interface, Map<string, [BasicProperty, Netclass, Netclass]>]
                // let copyCandidateIface = data[0]
                // let nonTranferableRelationsInfo = data[1]
                // if(nonTranferableRelationsInfo && nonTranferableRelationsInfo.size > 0) {
                //     let strArr = new Array<string>();
                //     for(let [key, value] of nonTranferableRelationsInfo) {
                //         let str = `${value[0].name}=>[from ${value[1].name} to ${value[2].name}]`;
                //         strArr.push(str);
                //     }
                    
                //     let cpConfirmData: ConfirmationDialogProps = {
                //         onFormClosed: onConfirmationDataAvailable,
                //         title: "Please Confirm",
                //         warningText_main: `WARNING! The following cross-interface class-to-class (C2C) relations will NOT carry over from source project to target project. Please decide if to proceed with interface copy'?`,
                //         warningText_other: strArr.join(", "),
                //         actionButtonText: "Proceed",
                //         enableSecondaryActionButton: false,
                //         secondaryActionButtonText: "",
                //         contextualInfo:  { key: "CONFIRM_IFACE_COPY", value: copyCandidateIface },
                //     }
                //     setConfirmationDialogProps(cpConfirmData)
                //     confirmationModalActioner.open()
                // }
                // else {
                //     await executeIfaceCreation(copyCandidateIface);
                // }
                
            }    
        }
    }


    async function executeIfaceCreation(newIfaceInfo: any) {
        // setLoadingSpinnerCtx({enabled: true, text: `Now setting up new interface. `
        //     + `This might be a lenghty operation. Please be patient...`} as LoadingSpinnerInfo)
        
        // let newIface : Interface = await createInterface(newIfaceInfo).finally(() => { cancelLoadingSpinnerCtx() })
        // if(newIface && newIface._id && newIface._id.toString().length > 0) {                        
        //     //NOTE: the router loader function will handle loading the created interface's details
        //     // navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${newIface._id.toString()}/overview`);
        //     displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface setup process has completed")
        // }
    }


    async function onInterfaceSelectionChanged(ifaceName: string) {
        // if(ifaceName && ifaceName.trim().length > 0) {
        //     let iface = (interfaceList as Interface[]).find(a => a.name === ifaceName)
        //     if(iface && iface._id.length > 0) {
        //         //NOTE: the router loader function will handle loading the selected interface's details
        //         // navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${iface._id.trim()}/overview`)
        //     }
        // }
    }


    function getAltTextContent() : string {
        if(!selectedBucket && (bucketList && bucketList.length > 0))
            return `Please select a bucket...`
        else {
            return `Project has no buckets...`
        }
    }


    // function onEditInterfaceProperties(iface: Interface): void {
    //     // let propEditorProps : PropListEditorDialogProps = {
    //     //     onFormClosed: onPropEditorDataAvailable,
    //     //     title: "Add, update, or delete interface properties",
    //     //     contextualInfo:  { key: "IFACE_PROP_EDIT", value: selectedInterface?.associatedProperties ?? [] }, //always pass the entire set to the dialog!
    //     // }
    //     // setPropertiesEditorDialogProps(propEditorProps)
    //     // propEditorModalActioner.open()
    // }


    function onPropEditorDataAvailable(props: PropertyItem[] | null, contextualInfo: BasicKVP): void {
        if(props && props.length > 0) {
            // let iface = {...selectedInterface} as Interface
            // iface.associatedProperties = props
            // setLoadingSpinnerCtx({enabled: true, text: `Updating interface properties. Please wait...`})
            // updateInterface(iface, true).then((updatedIface: Interface) =>{
            //     if(updatedIface && updatedIface._id?.toString().length > 0) {
            //         // navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${updatedIface._id.toString()}/overview`);
            //         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface update process completed")
            //     }
            // })
            // .finally(() => {
            //     setLoadingSpinnerCtx({enabled: false, text: ``})
            // })
        }
    }

    
    // function onDeleteInterface(iface: Interface): void {
    //     let delConfirmData: ConfirmationDialogProps = {
    //         onFormClosed: onConfirmationDataAvailable,
    //         title: "Please Confirm",
    //         warningText_main: `Are you sure you want to delete interface '${selectedInterface?.name ?? ''}'?`,
    //         warningText_other: "Interface collateral files will be deleted permanently!",
    //         actionButtonText: "Delete",
    //         enableSecondaryActionButton: false,
    //         secondaryActionButtonText: "",
    //         contextualInfo:  { key: "Delete_Action", value: null },
    //     }
    //     setConfirmationDialogProps(delConfirmData)
    //     confirmationModalActioner.open()
    // }


    async function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "Delete_Action") {
                if(action === ConfirmationDialogActionType.PROCEED) {
                    // setLoadingSpinnerCtx({enabled: true, text: `Deleting interface. Please wait...`})
                    // deleteInterface(selectedInterface as Interface).then((res) => {
                    //     if(res) {
                    //         //NOTE: the router loader function will handle loading the remaining interfaces, etc
                    //         // navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/`)
                    //         displayQuickMessage(UIMessageType.SUCCESS_MSG, `Interface deletion completed!`)
                    //     }
                    //     else{
                    //         displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to successfully delete interface!`)
                    //     }
                    // })
                    // .finally(() => {
                    //     setLoadingSpinnerCtx({enabled: false, text: ``})
                    // })
                }
            }
            else if(contextualInfo.key === "CONFIRM_IFACE_COPY") {
                if(action === ConfirmationDialogActionType.PROCEED) {
                    // if(contextualInfo.value) {
                    //     await executeIfaceCreation(contextualInfo.value as Interface)
                    // }
                    // else {
                    //     displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to process interface copy. Required data was not provided!`)
                    // }
                }
            }
        }
    }


    // function handleShowHideColumns(): void {
    //     if(isPhyTab || isClrTab) {
    //         // let visibProps = project?.constraintSettings ?? []
    //         // let visibilityDialogProps : RulesColumnVisibilityDialogProps = {
    //         //     onFormClosed: onColVisibilityDataAvailable,
    //         //     title: "Show/hide constraint elements",
    //         //     constraintType: isPhyTab ? ConstraintTypesEnum.Physical : ConstraintTypesEnum.Clearance,
    //         //     showNetProps: false,  
    //         //     project: project,
    //         //     contextualInfo:  { key: "VISIBILITY_CHANGE", value: {iface: selectedInterface, pkgLayout: packageLayout, visProps: visibProps } as RRVisibilityData}, //always pass the entire set to the dialog!
    //         // }
    //         // setColVisibilityDialogProps(visibilityDialogProps)
    //         // colVisibilityModalActioner.open()
    //     }
    // }


    async function onColVisibilityDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo.key === "VISIBILITY_CHANGE") {
                // let proj = {...project} as Project
                // if(contextualInfo.value.visProps && contextualInfo.value.visProps.length > 0) {
                //     proj.constraintSettings = contextualInfo.value.visProps
                //     setLoadingSpinnerCtx({enabled: true, text: `Updating project. Please wait...`})
                //     updateProject(proj as Project).then((updatedProj: Project) => {
                //         if(updatedProj._id) {
                //             let data = contextualInfo.value as RRVisibilityData
                //             if(data.pkgLayout && data.pkgLayout.ruleAreas && data.pkgLayout.ruleAreas.length > 0) {
                //                 updateRuleAreas(data.pkgLayout as PackageLayout).then((updatedPkg: PackageLayout) => {
                //                     if(updatedPkg._id) {
                //                         // navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${selectedInterface?._id.toString()}/${tabInfo || ''}`); //this will refresh everything
                //                         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Visibility settings were updated")
                //                     }
                //                 })
                //                 .finally(() => {
                //                     setLoadingSpinnerCtx({enabled: false, text: ``})
                //                 })
                //             }
                //         }
                //     })
                //     .finally(() => {
                //         setLoadingSpinnerCtx({enabled: false, text: ``})
                //     })
                // }
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
        // setShowRightElementOnGrid(checked);
    }


    // async function handleLinkages(constraintType: ConstraintTypesEnum) {
    //     let g2gList = await fetchG2GContextList(projectId as string)
    //     let lnkMgmtDlgProps : LinkageManagementDialogProps = {
    //         onFormClosed: onLinkageManagementDataAvailable,
    //         title: `Link ${(constraintType === ConstraintTypesEnum.Physical) ? "Netclasses (trace)" : "Clearance Rules (space)"}. Changes to one rule will reflect on all linked rules`,
    //         constraintType: constraintType,
    //         project: project,
    //         netclasses: netclasses,
    //         ruleAreas: packageLayout.ruleAreas,
    //         projectInterfaceList: interfaceList,
    //         g2gContextList: g2gList,
    //         contextualInfo: { key: "LINKAGE_MGMT", value: null }
    //     }
    //     setLinkageManagementDialogProps(lnkMgmtDlgProps)
    //     linkageManagementModalActioner.open()
    // }


    
    async function onLinkageManagementDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo && contextualInfo.key && contextualInfo.key === "LINKAGE_MGMT") {
                // let linkageData : LinkageInfo[] = contextualInfo.value
                // if(isPhyTab) {
                //     setIsLoadingBackdropEnabled(true)
                //     let updatedProject = await updateKeyProjectAspect(projectId as string, KeyProjectAspectTypeEnum.PHY_LNK, linkageData).finally(() => { setIsLoadingBackdropEnabled(false) } );
                //     if(updatedProject) {
                //         setProject(updatedProject);
                //         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Physical linkage update process has completed.")
                //     }
                //     else {
                //         displayQuickMessage(UIMessageType.ERROR_MSG, "Physical linkage data was not successfully updated.")
                //     }
                // }
                // else if(isClrTab) {
                //     setIsLoadingBackdropEnabled(true)
                //     let updatedProject = await updateKeyProjectAspect(projectId as string, KeyProjectAspectTypeEnum.CLR_LNK, linkageData).finally(() => { setIsLoadingBackdropEnabled(false) } );
                //     if(updatedProject) {
                //         setProject(updatedProject);
                //         displayQuickMessage(UIMessageType.SUCCESS_MSG, "Clearance linkage update process has completed.")
                //     }
                //     else {
                //         displayQuickMessage(UIMessageType.ERROR_MSG, "Clearance linkage data was not successfully updated.")
                //     }
                // }
            }
        }
    }
    


//    function handleRuleAreaPhyRulesCopyOver(): void {
//         if (isPhyTab) {
//             let raOpts = packageLayout.ruleAreas.map(a => a.ruleAreaName).sort() ?? []
//             if(raOpts.length < 2) {
//                 displayQuickMessage(UIMessageType.SUCCESS_MSG, "Cannot perform constraints-copy operation. Project must have more than one rule area.")
//                 return;
//             }
            
//             // if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.COPY_OVER_PHY_RULES) === false) { return; }
//             let giDialogProps: GeneralInfoDialogProps = {
//                 onFormClosed: onGenInfoDataAvailable,
//                 title: `Copy '${selectedInterface?.name ?? ''}' Physical Rules to Another Rule Area`,
//                 warningText: `Warning: all physical rules pertaining to current interface will be overwritten for destination rule area! Source: ${selectedInterface?.name || ''}`,
//                 showSelectionCtrl: true,
//                 selectionLabel: "Select Source Rule Area",
//                 showSecondarySelection: true,
//                 secondarySelectionLabel: "Select Destination Rule Area",
//                 selectionCtrlOptions: raOpts,
//                 contextualInfo: { key: "COPY_PHY_RULES_OVER", value: null },
//             }
//             setGeneralInfoDialogProps(giDialogProps)
//             generalInfoModalActioner.open()
//         }
//     }
    

    // function onGenInfoDataAvailable(data: GeneralInfoUIContext | null): void {
    //     if(data && data.contextualInfo) {
    //         if(data.contextualInfo.key === "COPY_PHY_RULES_OVER") {
    //             let srcRAName = data?.selection
    //             let destRAName = data?.secondarySelection
    //             if(srcRAName && srcRAName.length > 0 && destRAName && destRAName.length > 0) {
    //                 let srcRA = packageLayout.ruleAreas.find(a => a.ruleAreaName === srcRAName)
    //                 let destRA = packageLayout.ruleAreas.find(a => a.ruleAreaName === destRAName)
    //                 if(srcRA && destRA) {
    //                     setLoadingSpinnerCtx({enabled: true, text: `Now copying physical rules from source to destination rule-area. This might take some time. Please wait...`})
    //                     // copyOverConstraints(projectId as string, srcRA, destRA, ConstraintTypesEnum.Physical, selectedInterface?._id.toString() as string).then((res: boolean) => {
    //                     //     if(res) {
    //                     //         displayQuickMessage(UIMessageType.SUCCESS_MSG, `Physical rules have been copied to destination rule area`)
    //                     //     }
    //                     //     else {
    //                     //         displayQuickMessage(UIMessageType.ERROR_MSG, `Physical rules were not successfully copied over.`)
    //                     //     }
    //                     // })
    //                     // .finally(() => {
    //                     //     setLoadingSpinnerCtx({enabled: false, text: ``})
    //                     // })
    //                 }
    //                 else {
    //                     displayQuickMessage(UIMessageType.ERROR_MSG, `Physical rules were not successfully copied over. Issue occured during selection of source and destination rule areas`)
    //                 }
    //             }
    //         }
    //     }
    // }


    
    function getSubMenuItems() : Array<MenuInfo> {
        let menuArr = new Array<MenuInfo>();
        
        menuArr.push({
            label: "Create Interface",
            icon: <PlaylistAddOutlined />,
            callbackAction: (kvp: BasicKVP) => { }
        });
        menuArr.push({
            label: "Copy Interface",
            icon: <CopyAllOutlined />,
            callbackAction: (kvp: BasicKVP) => { }
        });
        
        menuArr.push({
            label: (project && project.lockedBy && project.lockedBy.length > 0) ? `Unlock Project`: `Lock Project`,
            icon: (project && project.lockedBy && project.lockedBy.length > 0)
                ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
                : <LockOpenOutlined fontSize="large" color="secondary"/>,
            callbackAction: (kvp: BasicKVP) => { processProjectLockAndUnlock() }
        });
           
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
                                value={selectedBucket?.name ?? ""}
                                onChange={(event, value) => { onInterfaceSelectionChanged(value as string); }}
                                key="env-sel-cb"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="env-sel-cb"
                                sx={{ mt:.7, minWidth: 220, }}
                                options={bucketNames}
                                renderInput={(params) => <TextField {...params} label="Select Environment" size="small" />}
                            /> 

                            <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
                            </Slide>

                            <Autocomplete 
                                value={selectedBucket?.name ?? ""}
                                onChange={(event, value) => { onInterfaceSelectionChanged(value as string); }}
                                key="bk-sel-cb"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="bk-sel-cb"
                                sx={{ mt:.7, minWidth: 300, }}
                                options={bucketNames}
                                renderInput={(params) => <TextField {...params} label="Select Bucket" size="small" />}
                            /> 

                            <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
                            </Slide>

                            <MenuListComposition disableAnimation={false} menuItems={getSubMenuItems()} tooltipTitle={"Show/hide interface related settings"} />

                            <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 6 }} />
                            </Slide>

                            <Box sx={{ ml:1, padding: 0, maxHeight: 33, mb: .3, border:1,borderRadius: 7, minWidth: 100}}>
                                <FormControlLabel control={
                                    <Switch size="small"
                                        sx={{ ml: 2.5}}
                                        checked={true}
                                        onChange={() => {}}
                                        inputProps={{ 'aria-label': 'document view switch' }}
                                    />
                                } label="Json" />
                            </Box>

                        </Box>
                    </Box>
  
                    <Divider sx={{ marginLeft: 0, marginRight: 0 }} />

                </Box>
                
                {(selectedBucket)
                ? (
                    <></>
                    // <Tabs   //TODO: add minimin width on this to make sure the page shring doesnt look wierd
                    //     className="tabs"
                    //     classNames={{ tab: "tabstab", panel: "tabspanel" }}
                    //     orientation="horizontal" 
                    //     keepMounted={false} 
                    //     value={tabInfo}
                    //     // TODO: need to stop the interfaceInFocus and pass it in instead
                    //     onChange={ (value) => navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${interfaceId ?? selectedInterface?._id?.toString()}/${value}`) } >
                        
                    //     <Tabs.List variant={"pills"} justify="left">
                    //         <Tabs.Tab value="overview" leftSection={<PlaylistAddCheckOutlined style={iconStyle} />}>
                    //             Interface Overview
                    //         </Tabs.Tab>
                    //         <Tabs.Tab value={PHYSICAL_PAGE_URL_SUFFIX} leftSection={<DiamondOutlined style={iconStyle} />}>
                    //             Physical
                    //         </Tabs.Tab>
                    //         <Tabs.Tab value={CLEARANCE_PAGE_URL_SUFFIX} leftSection={<VerticalSplitOutlined style={iconStyle} />}>
                    //             Clearance
                    //         </Tabs.Tab>
                    //         <Tabs.Tab value="shadowvoid" leftSection={<GraphicEqOutlined style={iconStyle} />}>
                    //             Shadow Void
                    //         </Tabs.Tab>
                    //         <Tabs.Tab value="collaterals" leftSection={<FileUploadOutlined style={iconStyle} />}>
                    //             Collaterals
                    //         </Tabs.Tab>
                    //         <Tabs.Tab value="notes" leftSection={<ShortTextOutlined style={iconStyle} />}>
                    //             Notes
                    //         </Tabs.Tab>
                    //     </Tabs.List>


                    //     <Tabs.Panel value="overview" >
                    //         <InterfaceOverviewTab ifaceObj={selectedInterface} project={project} onEditInterfaceProperties={onEditInterfaceProperties} 
                    //             onUpdateInterface={handleUpdateExistingInterface} onDeleteInterface={onDeleteInterface} />
                    //     </Tabs.Panel>

                    //     <Tabs.Panel value={PHYSICAL_PAGE_URL_SUFFIX}>
                    //         <InterfacePhysicalRulesTab iface={selectedInterface} focusRA={physicalRRFocusRA} setFocusRA={setPhysicalRRFocusRA} 
                    //             lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} relevantPropMap={physRelevantProps} />
                    //     </Tabs.Panel>

                    //     <Tabs.Panel value={CLEARANCE_PAGE_URL_SUFFIX}>
                    //         <InterfaceClearanceRulesTab iface={selectedInterface} focusRA={clearanceRRFocusRA} setFocusRA={setClearanceRRFocusRA} 
                    //             lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} relevantPropMap={clearanceRelevantProps} />
                    //     </Tabs.Panel>

                    //     <Tabs.Panel value="shadowvoid">
                    //         <InterfaceShadowVoidTab iface={selectedInterface} project={project} />
                    //     </Tabs.Panel>

                    //     <Tabs.Panel value="collaterals">
                    //         <InterfaceCollateralsTab iface={selectedInterface} project={project}/>
                    //     </Tabs.Panel>

                    //     <Tabs.Panel value="notes">
                    //         <InterfaceNotesTab iface={selectedInterface} project={project}/>
                    //     </Tabs.Panel>
                    // </Tabs>
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
            {generalInfoModalState && <GeneralInfoDialog 
                opened={generalInfoModalState} 
                close={() => {
                    generalInfoModalActioner.close()
                    //just in case if the RR table/view is expanded: this will force it to close therefore forcing a refresh of data after linkage changes
                    // setPhysicalRRFocusRA(null);
                    // setClearanceRRFocusRA(null);
                }}
                {...generalInfoDialogProps as GeneralInfoDialogProps} />
            }

        </Box>
    )


}

export default BucketDetails222









