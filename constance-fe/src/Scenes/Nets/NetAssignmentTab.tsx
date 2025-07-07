import { Box, Divider, Fade, Grid, Grow, Paper, Slide, Typography } from "@mui/material";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import NetClasesTree from "../../CommonComponents/NetClasesTree";
import { DropOptions, NodeModel } from "@minoru/react-dnd-treeview";
import { CONFIGITEM__Org_Settings, DataMappingTypeEnum, ActionSceneEnum, NetManagementActionTypeEnum, UIMessageType, PermissionActionEnum, PendingProcessActionTypeEnum } from "../../DataModels/Constants";
import InterfaceMgmtDialog, { InterfaceMgmtDialogProps } from "../../FormDialogs/InterfaceMgmtDialog";
import { useDisclosure } from "@mantine/hooks";
import { Interface, Net, Netclass, PackageLayout, Project } from "../../DataModels/ServiceModels";
import { BasicKVP, LoadingSpinnerInfo, LoggedInUser, NetMgmtCtx, NetSummary, NodeSelectionCtx, PollingInfoContext } from "../../DataModels/HelperModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import BaseGlideGrid, { SpecialGridActionContext } from "../../CommonComponents/BaseGlideGrid";
import { BASIC_GRID_HEADER_HEIGHT, BASIC_GRID_PAGE_SIZE, getBasicNetNameGridCellContent, getBasicNetNameGridColumns, onBasicNetNameGridInitialDataFetch, onBasicNetNameGridSubsequentDataFetch } from "../../BizLogicUtilities/BaseGridLogic";
import { fetchInterfaceDetails, fetchNetclassList, runAutomapper, updateInterface, updateNets } from "../../BizLogicUtilities/FetchData";
import { useLayer, useMousePositionAsTrigger } from "react-laag";
import { Options } from "react-laag/dist/types";
import styled from '@emotion/styled';
import { SimpleMenu } from "../../CommonComponents/SimplePieces";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import useSWR from "swr";
import { fetcher } from "../../BizLogicUtilities/BasicCommonLogic";




enum ContextMenuActionsEnum {
    RunAutoMap = "RunAutoMap",
    EditInterfaceDetails = "EditInterfaceDetails",
    GoToInterface = "GoToInterface",
    DissasociateNets = "DissasociateNets",
    UpdateNetclass = "UpdateNetclass"
}

interface NetAssignmentTabProps {
    project: Project,
    pkgLayout: PackageLayout,
    ifaceList: Interface[],
    netclassList: Netclass[],
    netSummary: NetSummary,
    onRefreshNetSummaryRequired: () => Promise<void>,
}

const NetAssignmentTab: React.FC<NetAssignmentTabProps> = ({ project, pkgLayout, ifaceList, netclassList, 
    netSummary, onRefreshNetSummaryRequired }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const initConfigs = useSpiderStore((state) => state.initConfigs);
    const isAlphabeticalTreeNodeOrder = useSpiderStore((state) => state.isAlphabeticalTreeNodeOrder);
    const setIsAlphabeticalTreeNodeOrder = useSpiderStore((state) => state.setIsAlphabeticalTreeNodeOrder);
    const openNetclassTreeNodes = useSpiderStore((state) => state.openNetclassTreeNodes);
    const setOpenNetclassTreeNodes = useSpiderStore((state) => state.setOpenNetclassTreeNodes);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    
    const [interfaceList, setInterfaceList] = useState<Interface[]>(ifaceList)
    const [netclasses, setNetclasses] = useState<Netclass[]>(netclassList)

    const [unmappedSelectedNetIds, setUnmappedSelectedNetIds] = useState<Map<string, number>>(new Map<string, number>());
    const [assignedGridSelectedNetIds, setAssignedGridSelectedNetIds] = useState<Map<string, number>>(new Map<string, number>());

    const [nodeSelectionInfo, setNodeSelectionInfo] = useState<NodeSelectionCtx|null>(null)

    const [interfaceDetailsDialogProps, setInterfaceDetailsDialogProps] = useState<InterfaceMgmtDialogProps>()
    const [interfaceDetailsModalState, interfaceDetailsModalActioner] = useDisclosure(false);

    const unAssignedNetsGridRef = useRef<any>();
    const assignedNetsGridRef = useRef<any>();
    const containerRef = useRef<HTMLElement>(null);  //important!
    const unassignedGridActionRef = useRef<SpecialGridActionContext<Net>|undefined>();
    const netclassAssignedGridActionRef = useRef<SpecialGridActionContext<Net>|undefined>();
    
    const nodeSelectionInfoRef = useRef<NodeSelectionCtx|null>(null);
    nodeSelectionInfoRef.current = nodeSelectionInfo
    
    const projectId = project?._id.toString() ?? "";

    
    useEffect(() => {
        placePageTitle("NetAssignment")
    }, []);

    
    
    //======================================== Polling ==================================== 
    const [enableProcPolling, setEnableProcPolling] = useState<boolean>(true);

    let pollCtx : PollingInfoContext = {
        type: PendingProcessActionTypeEnum.AUTOMAP_EXEC,
        mainMessageOnProc: `NetList setup/Auto-Map process is currently running. Processing can take several minutes depending on number of nets uploaded. Please be patient. Stay tuned for completion...`,
        spinnerMessageOnProc: `Checking/handling netlist setup and auto-mapping process. Please wait...`,
        messageOnCompletion: ``,
        messageOnError: `Could not successfully complete setup operation`,
        setBackdropBlocker: true,
        actionOnCompletion : () => { },
        setStateChange: setEnableProcPolling,
        getStartTime: () => { return null }
    }

    const { data, error, isLoading } = useSWR(enableProcPolling ? projectId: null, (key: any) => fetcher(key, pollCtx), { refreshInterval: 7000, revalidateOnMount : true})
    //======================================================================================
            
        


    useEffect(() =>{
        if(netclassAssignedGridActionRef && netclassAssignedGridActionRef.current) {
            netclassAssignedGridActionRef.current.reloadDataRows()
        }

        if(unassignedGridActionRef && unassignedGridActionRef.current) {
            unassignedGridActionRef.current.reloadDataRows()
        }
    }, [netSummary])


    useEffect(() => {
        if(netclassAssignedGridActionRef && netclassAssignedGridActionRef.current) {
                netclassAssignedGridActionRef.current.reloadDataRows()
        }
    }, [nodeSelectionInfo]);


    const sectionStyle = useMemo(() => (
        { textAlign: "center", borderRadius: 5, m: 1, height: "81.5vh", backgroundColor: colors.primary[400] }
    ), []); 
    
    
    const knownOrgs : string[] = useMemo(() => {
        let orgInf : any[] = initConfigs?.find(a => a.configName === CONFIGITEM__Org_Settings)?.configValue
        let orgs : string[] = orgInf?.map((a: any) => a.name.toUpperCase())
        return orgs ?? []
    }, [initConfigs]);


    const knownOpenNetclassTreeNodes : string[] = useMemo(() => {
        if(openNetclassTreeNodes === null || openNetclassTreeNodes === undefined) {
            return interfaceList?.map(a => a._id.toString()) ?? []
        }
        else {
            return openNetclassTreeNodes as string[];
        }
    }, [openNetclassTreeNodes]);


    function onChangeOpenNetclassTreeNodes(openNodes: string[]): void {
        if(openNodes) {
            setOpenNetclassTreeNodes(openNodes)
        }
    }


    function handleNetclassMove(setter: React.Dispatch<React.SetStateAction<NodeModel<any>[]>>, newTreeData: NodeModel<any>[], options: DropOptions<any>): void {
        //TODO: handle this drag/drop situation ...at some point...
        console.error("Function not implemented.");
        setter(newTreeData)
    }


    function onContextMenuTriggered(event: any, node: NodeModel<any>, isInterface: boolean, depth: number): void {
        if(event && node){
            onTreeNodeSelected(node, isInterface)
            handleMouseEvent(event)
        } 
    }


//======================================= GRID Input Items ==============================
    const columns = useMemo(() => {           
        let cols = getBasicNetNameGridColumns()
        return cols
    }, []);


    function onTreeNodeSelected(node: NodeModel<any>, isInterface: boolean): void {
        if(nodeSelectionInfoRef && nodeSelectionInfoRef.current && nodeSelectionInfoRef.current.node.id === node.id) {
            setNodeSelectionInfo(null)
        }
        else {
            setNodeAsSelected(node, isInterface);
        }
    }

    function setNodeAsSelected(node: NodeModel<any>, isInterface: boolean){
        let nodeId = node.id as string ?? '';
        if(isInterface) {
            let selInfo : NodeSelectionCtx = { node: node, interfaceId: nodeId, netclassId: "", type: "Interface" } 
            setNodeSelectionInfo(selInfo)
        }
        else {
            let nc = netclasses?.find((a: Netclass) => a._id === nodeId)
            let selInfo : NodeSelectionCtx = { node: node, interfaceId: nc?.interfaceId ?? "", netclassId: nodeId, type: "Netclass" } 
            setNodeSelectionInfo(selInfo)
        }
    }

    
    async function onNetMappingActionButtonClicked(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.MANUALLY_CLASSIFY_NETS) === false) { return; }
        if((unmappedSelectedNetIds && unmappedSelectedNetIds.size > 0 && nodeSelectionInfo && nodeSelectionInfo.type.toLowerCase() === "netclass")) {
            if(unassignedGridActionRef && unassignedGridActionRef.current) {
                let netArr: Net[] = Array.from(unmappedSelectedNetIds.keys()).map((netId: string) => {
                    let net : Net = {
                        _id: netId, //important item here!
                        snapshotSourceId: "",
                        contextProperties: [],
                        lastUpdatedOn: new Date(),
                        projectId: projectId,  //important item here
                        interfaceId: "",
                        name: "", //inconsequential
                        netclassMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                        netClassId: "",
                        constraintClassId: "",
                        diffPairNet: "", //inconsequential
                        diffPairMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                        tags: [],
                        associatedProperties: [],
                    }

                    return net;
                })
                let netUpdateContext : NetMgmtCtx = {
                    projectId: projectId,
                    actionType: NetManagementActionTypeEnum.ASSIGN_NETS,
                    status: "",
                    netsInvolved: netArr,
                    contextualInfo: nodeSelectionInfo.netclassId
                }
                updateNets(netUpdateContext).then((ctx: NetMgmtCtx) => {
                    if(ctx && ctx.status.toLowerCase() === "success") {
                        if(onRefreshNetSummaryRequired) {
                            onRefreshNetSummaryRequired()
                        }
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG,"Netclass assignment was not successful. Please check logs for details.")
                    }
                    
                })
            } 
        }
    }

    
    async function onRemoveMappingActionButtonClicked(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.MANUALLY_CLASSIFY_NETS) === false) { return; }
        if((assignedGridSelectedNetIds && assignedGridSelectedNetIds.size > 0)) {
            if(netclassAssignedGridActionRef && netclassAssignedGridActionRef.current) {
                let netArr: Net[] = Array.from(assignedGridSelectedNetIds.keys()).map((netId: string) => {
                    let net : Net = {
                        _id: netId, //important item here!
                        snapshotSourceId: "",
                        contextProperties: [],
                        lastUpdatedOn: new Date(),
                        projectId: projectId,  //important item here
                        interfaceId: "",
                        name: "", //inconsequential
                        netclassMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                        netClassId: "",
                        constraintClassId: "",
                        diffPairNet: "", //inconsequential
                        diffPairMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                        tags: [],
                        associatedProperties: [] 
                    }

                    return net;
                })
                let netUpdateContext : NetMgmtCtx = {
                    projectId: projectId,
                    actionType: NetManagementActionTypeEnum.REMOVE_NET_ASSIGNMENT,
                    status: "",
                    netsInvolved: netArr,
                    contextualInfo: ""
                }
                updateNets(netUpdateContext).then((ctx: NetMgmtCtx) => {
                    if(ctx && ctx.status.toLowerCase() === "success") {
                        if(onRefreshNetSummaryRequired) {
                            onRefreshNetSummaryRequired()
                        }
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Attempt to dissasociate net from netclass was not successful. Please check logs for details.")
                    }
                    
                })
            } 
        }
    }
    

    const baseOptions = {
        overflowContainer: true,
        auto: true,
        snap: true,
        placement: "right-start",
        possiblePlacements: ["right-start", "left-start"],
        triggerOffset: 8,
        containerOffset: 16,
        arrowOffset: 8,
    };

    const {
        hasMousePosition, // did we get a mouse-position from the event-handler
        resetMousePosition, // reset the mouse-position to `null`, essentially closing the menu
        handleMouseEvent, // event-handler we will use below
        trigger // information regarding positioning we can provide to `useLayer`
    } = useMousePositionAsTrigger();
      
    const { renderLayer, layerProps } = useLayer({
        isOpen: hasMousePosition,
        onOutsideClick: () => {
            resetMousePosition();
            setNodeSelectionInfo(null) //Important!!
        },
        trigger,
        ...baseOptions // shared common options we defined earlier
    } as Options);



    const onContextMenuAction = useCallback((nodeInfo: NodeSelectionCtx, actionType: ContextMenuActionsEnum): void => {
        if(nodeInfo && actionType) {
            if(actionType === ContextMenuActionsEnum.RunAutoMap) {
                let elementId = (nodeInfo.type.toLowerCase() === "interface") ? nodeInfo.interfaceId : nodeInfo.netclassId;
                runAutomapper(projectId, elementId).then((res: boolean) => {
                    if (res) {
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Automap action completed!")
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "Automap action was not successful!")
                    }
                    resetMousePosition();
                    
                    if(onRefreshNetSummaryRequired) {
                        onRefreshNetSummaryRequired()
                    }
                })
            }
            else if(actionType === ContextMenuActionsEnum.EditInterfaceDetails) {
                handleInterfaceUpdate(nodeInfo.interfaceId, "Update Interface")
                resetMousePosition();
                setNodeSelectionInfo(null) //Important!!
            } 
            else if(actionType === ContextMenuActionsEnum.GoToInterface) {
                resetMousePosition();
                setNodeSelectionInfo(null) //Important!!
                navigate(`/${ActionSceneEnum.INTERFACES}/${projectId}/${nodeInfo.interfaceId}/overview`)
            } 
            else if(actionType === ContextMenuActionsEnum.UpdateNetclass) {
                handleInterfaceUpdate(nodeInfo.interfaceId, "Update Interface And/Or Associated Netclasses")
                resetMousePosition();
                setNodeSelectionInfo(null) //Important!!
            }
        }
    }, [])  


    async function handleInterfaceUpdate(interfaceId: string, dlTitle: string): Promise<void> {
        let iface = await fetchInterfaceDetails(interfaceId)
        if(iface) {
            let ifaceSetupDlgProps: InterfaceMgmtDialogProps = {
                onFormClosed: onInterfaceUpdateDataAvailable,
                title: dlTitle,
                contextualInfo: { key: "UPDATE_INTERFACE", value: iface },
                project: project as Project,
                orgs: knownOrgs,
                packageLayout: pkgLayout as PackageLayout,
            }
            setInterfaceDetailsDialogProps(ifaceSetupDlgProps)
            interfaceDetailsModalActioner.open()
        }
        else{
            displayQuickMessage(UIMessageType.ERROR_MSG, "System does not have a record of the relevant interface")
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

                        fetchNetclassList(updatedIface.projectId ?? projectId).then((ncList: Netclass[]) => {
                            if(ncList && ncList.length > 0) {
                                setNetclasses(ncList);
                            }
                        })

                        if(onRefreshNetSummaryRequired) {
                            onRefreshNetSummaryRequired()
                        }

                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Interface update completed...")
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed with interface update. Interface must have at least one valid netclass`)
                }
            }
        }
    }
    
   
    async function onGridCellValueChangeCompleted(rowIndex: number, columnIndex: number): Promise<void> {
        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Net name change has completed")
    }


    function onTreeNodeOrderChange(checked: boolean): void {
        if(checked !== undefined) {
            setIsAlphabeticalTreeNodeOrder(checked)
        }
    }

    



    return (
        <Box>
            <Box sx={{ height: "83vh", mt: 1.2}} ref={containerRef}>
                <Grid container spacing={.2} direction="row">
                    <Grid item xs key={`sec-1`}>
                        <Slide direction="right" in={true} container={containerRef.current}>
                            <Box minHeight="83vh" minWidth="392px" display="flex" flexDirection="column" sx={sectionStyle}>    
                                <Typography variant="h6" color={colors.greenAccent[400]}>{`Unassigned Nets`}</Typography>
                                <Divider />

                                <Box>
                                    <Box minHeight="20px" mt={1}>
                                        {(unmappedSelectedNetIds && unmappedSelectedNetIds.size > 0) && <Typography color={colors.blueAccent[100]}>
                                            <span>{`[ ${unmappedSelectedNetIds.size} ] Net${unmappedSelectedNetIds.size > 1 ? 's' : ''} selected for assignment`}</span>
                                        </Typography>}
                                    </Box>
                                    <Divider sx={{ mb: 0, mt: 0.5 }}/>
                                </Box>
                                
                                <Box sx={{ml:2}}>
                                    <BaseGlideGrid<Net> 
                                        excludePortal={true}
                                        gridHeight={"70vh"}
                                        headerHeight={BASIC_GRID_HEADER_HEIGHT}
                                        gridRef={unAssignedNetsGridRef}
                                        columns={columns}
                                        pageSize={BASIC_GRID_PAGE_SIZE}
                                        totalRowCount={netSummary?.totalNets ?? 0}  //unassignedNetGridCount} //projStats?.totalUnassignedNets as number}
                                        enableFillHandle={false}
                                        multiRowSelectionEnabled={true}
                                        enableSearchField={true}
                                        showActionButton={true}
                                        cellEditConfirmationColumns={[]}
                                        isActionClickAllowed={
                                            (unmappedSelectedNetIds && unmappedSelectedNetIds.size > 0 && nodeSelectionInfo && nodeSelectionInfo.type.toLowerCase() === "netclass") 
                                            ? true
                                            : false
                                        }
                                        actionButtonText={"Assign"}
                                        actionButtonWidth={140}
                                        reloadAfterActionClick={true}
                                        onActionButtonClick={onNetMappingActionButtonClicked}
                                        onGridCellEdited={undefined}
                                        onGridCellValueChangeCompleted={onGridCellValueChangeCompleted}
                                        onGetGridCellContent={getBasicNetNameGridCellContent} 
                                        onGridSelectionChanged={(gridSelection, selectedNetIds) => setUnmappedSelectedNetIds(selectedNetIds)}
                                        onGridSelectionCleared={() => setUnmappedSelectedNetIds(new Map<string, number>())}
                                        onFetchFirstSetData={(limit, filterText) => onBasicNetNameGridInitialDataFetch(projectId, limit, filterText, null, null, true, true)}
                                        onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => onBasicNetNameGridSubsequentDataFetch(projectId, lastId, limit, filterText, null, null, true, true)}  
                                        specialGridActionRef={unassignedGridActionRef}
                                    />
                                </Box>

                            </Box>
                        </Slide>
                    </Grid>
                    <Grid item xs key={`sec-2`}>
                        <Fade in={true} >
                            <Box minHeight="83vh" minWidth="392px" display="flex" flexDirection="column" sx={sectionStyle}>    
                                <Typography variant="h6" color={colors.greenAccent[400]}>{`Net Classes`}</Typography>
                                <Divider />

                                <Box>
                                    <Box minHeight="20px" mt={1}>
                                        {nodeSelectionInfo && <Typography color={colors.blueAccent[100]}>
                                            <span>{`Selected ${nodeSelectionInfo.type.toLowerCase()}:`}</span>
                                                &nbsp;&nbsp;&nbsp;&nbsp;
                                            <span>{`${nodeSelectionInfo.node.text}`}</span>
                                        </Typography>}
                                    </Box>
                                    <Divider sx={{ mb: 1, mt: 0.5 }}/>
                                </Box>

                                <Box sx={{ textAlign: "left", overflowY: "scroll"}}>
                                    <NetClasesTree 
                                        onNodeSelected={onTreeNodeSelected}
                                        selectedNode={nodeSelectionInfo?.node ?? null}
                                        outerContainerRef={containerRef}
                                        handleDropAction={handleNetclassMove}
                                        handleContextMenuAction={onContextMenuTriggered}
                                        interfaceList={interfaceList}
                                        netclasses={netclasses}
                                        enableDragDrop={false}
                                        isAlphabeticalNetclassOrder={isAlphabeticalTreeNodeOrder}
                                        onTreeNodeOrderChange={onTreeNodeOrderChange} 
                                        openNetclassTreeNodes={knownOpenNetclassTreeNodes} 
                                        onChangeOpenNetclassTreeNodes={onChangeOpenNetclassTreeNodes} />
                                </Box>

                            </Box>
                        </Fade>
                    </Grid>
                    <Grid item xs key={`sec-3`}>
                        <Slide direction="left" in={true} container={containerRef.current}>
                            <Box minHeight="83vh" minWidth="392px" display="flex" flexDirection="column" sx={sectionStyle}>    
                                <Typography variant="h6" color={colors.greenAccent[400]}>{`Assigned Nets`}</Typography>
                                <Divider />

                                <Box>
                                    <Box minHeight="20px" mt={1}>
                                        {(nodeSelectionInfo && assignedGridSelectedNetIds && assignedGridSelectedNetIds.size > 0) && <Typography color={colors.blueAccent[100]}>
                                            <span>{`[ ${assignedGridSelectedNetIds.size} ] Assigned net${assignedGridSelectedNetIds.size > 1 ? 's' : ''} ${assignedGridSelectedNetIds.size > 1 ? 'were' : 'was'} selected`}</span>
                                        </Typography>}
                                    </Box>
                                    <Divider sx={{ mb: 0, mt: 0.5 }}/>
                                </Box>

                                <Box sx={{ml:2}}>
                                    <BaseGlideGrid<Net> 
                                        excludePortal={true}
                                        gridHeight={"70vh"}
                                        headerHeight={BASIC_GRID_HEADER_HEIGHT}
                                        gridRef={assignedNetsGridRef}
                                        columns={columns}
                                        pageSize={BASIC_GRID_PAGE_SIZE}
                                        totalRowCount={(netSummary?.totalAssignedNets ?? 0)}  //assignedGridCount}  //projStats?.totalAssignedNets as number}  //i know this doesnt make sense per netclass. it works ok!
                                        enableFillHandle={false}
                                        multiRowSelectionEnabled={true}
                                        enableSearchField={true}
                                        showActionButton={true}
                                        cellEditConfirmationColumns={[]}
                                        isActionClickAllowed={
                                            (assignedGridSelectedNetIds && assignedGridSelectedNetIds.size > 0 && nodeSelectionInfo && nodeSelectionInfo.type.toLowerCase() === "netclass") 
                                            ? true
                                            : false
                                        }
                                        actionButtonText={"Disassociate"}
                                        actionButtonWidth={150}
                                        reloadAfterActionClick={true}
                                        onActionButtonClick={onRemoveMappingActionButtonClicked}
                                        onGridCellEdited={undefined}
                                        onGetGridCellContent={getBasicNetNameGridCellContent} 
                                        onGridSelectionChanged={(gridSelection, selectedNetIds) => setAssignedGridSelectedNetIds(selectedNetIds)}
                                        onGridSelectionCleared={() => setAssignedGridSelectedNetIds(new Map<string, number>())}
                                        onFetchFirstSetData={(limit, filterText) => {                                            
                                            if (nodeSelectionInfoRef && nodeSelectionInfoRef.current && (nodeSelectionInfoRef.current.interfaceId || nodeSelectionInfoRef.current.netclassId)) {
                                                let ifaceId = (nodeSelectionInfoRef?.current?.interfaceId ?? null);
                                                let ncId = (nodeSelectionInfoRef?.current?.netclassId ?? null);
                                                return onBasicNetNameGridInitialDataFetch(projectId, limit, filterText, ifaceId, ncId, false, true);
                                            }
                                            else {
                                                return new Promise(() => new Array<Net>());
                                            }
                                        }}
                                        onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => {
                                            if (nodeSelectionInfoRef && nodeSelectionInfoRef.current && (nodeSelectionInfoRef.current.interfaceId || nodeSelectionInfoRef.current.netclassId)) {
                                                let ifaceId = (nodeSelectionInfoRef?.current?.interfaceId ?? null);
                                                let ncId = (nodeSelectionInfoRef?.current?.netclassId ?? null);
                                                return onBasicNetNameGridSubsequentDataFetch(projectId, lastId, limit, filterText, ifaceId, ncId, false, true);
                                            }
                                            else {
                                                return new Promise(() => new Array<Net>());
                                            }
                                        }} 
                                        specialGridActionRef={netclassAssignedGridActionRef}
                                    />
                        
                                    {/* IMPORTANT! - DO NOT REMOVE portal div! 
                                    I dont know why this works here. But any other scenario makes it such that second grid cannot be edited */}
                                    <div id="portal"></div>
                                    
                                </Box>

                            </Box>
                        </Slide>
                    </Grid>
                </Grid>
            </Box>

            {(nodeSelectionInfo && hasMousePosition) && renderLayer (
                <>
                    {(nodeSelectionInfo.type.toLowerCase() === "interface")
                        ?
                        <SimpleMenu {...layerProps}>
                            <div onClick={() => onContextMenuAction(nodeSelectionInfo, ContextMenuActionsEnum.RunAutoMap)}>Run AutoMap</div>
                            <div onClick={() => onContextMenuAction(nodeSelectionInfo, ContextMenuActionsEnum.EditInterfaceDetails)}>Edit Interface Details</div>
                            <div onClick={() => onContextMenuAction(nodeSelectionInfo, ContextMenuActionsEnum.GoToInterface)}>Go to Interface</div>
                        </SimpleMenu>
                        :
                        <SimpleMenu {...layerProps}>
                            <div onClick={() => onContextMenuAction(nodeSelectionInfo, ContextMenuActionsEnum.RunAutoMap)}>Run Automap</div>
                            <div onClick={() => onContextMenuAction(nodeSelectionInfo, ContextMenuActionsEnum.UpdateNetclass)}>Edit Netclass (via Interface UI)</div>
                            {/* Note how we can use "danger class to change color of menu item" */}
                            {/* <div className="danger" onClick={() => alert("do nothing 4")}> Delete Netclass </div> */}
                        </SimpleMenu>
                    }
                </>
            )}

            {interfaceDetailsModalState && <InterfaceMgmtDialog opened={interfaceDetailsModalState} close={interfaceDetailsModalActioner.close} {...interfaceDetailsDialogProps as InterfaceMgmtDialogProps} />}
            
        </Box>
    );
}

export default NetAssignmentTab


















    // const [unassignedNetGridCount, setUnassignedNetGridCount] = useState<number>(0)
    // const [assignedGridCount, setAssignedGridCount] = useState<number>(0)
    
    // useMemo(() => {
    //     setAssignedGridCount(netSummary.totalAssignedNets as number)
    //     setUnassignedNetGridCount(netSummary.totalNets as number)
    // }, [netSummary]);
    






// useMemo(() => {
    // let count = projStats?.totalAssignedNets as number
    // if (projStats && nodeSelectionInfoRef.current &&  (nodeSelectionInfoRef.current.interfaceId || nodeSelectionInfoRef.current.netclassId)) {
    //     let ncId = (nodeSelectionInfoRef.current.netclassId ?? null);
    //     let ifaceId = (nodeSelectionInfoRef.current.interfaceId ?? null);

    //     if (ncId && ncId.trim().length > 0) {
    //         let ncTotal = projStats?.netclassStats?.find(a => a.netclassId === ncId)?.totalNetclassNets || 0
    //         if(ncTotal > 0) { 
    //             count = ncTotal
    //         }
    //     }
    //     else if(ifaceId && ifaceId.trim().length > 0) {
    //         let ifaceCount = 0
    //         let ncStats = projStats?.netclassStats?.filter(a => a.interfaceId === ifaceId) ?? []
    //         ncStats.forEach(x => { ifaceCount = ifaceCount + x.totalNetclassNets })
    //         if(ifaceCount > 0) { 
    //             count = ifaceCount
    //         }
    //     }
    // }
    // else {
    //     let tc : number[] = projStats?.netclassStats?.map(a => a.totalNetclassNets) ?? []
    //     count = Math.max(...tc)
    // }
    // setAssignedGridCount(count)
    // setUnassignedNetGridCount(projStats.totalUnassignedNets as number)

//     setAssignedGridCount(projStats.totalAssignedNets as number)
//     setUnassignedNetGridCount(projStats.totalNets as number)
// }, [projStats]);




//===================================================================

    // const { layerProps, renderLayer } = useLayer({
    //     isOpen: isNetclassTreeContextMenuOpen,
    //     auto: true,
    //     placement: "bottom-end",
    //     triggerOffset: 2,
    //     onOutsideClick: () => setHeaderMenu(undefined),
    //     trigger: {
    //         getBounds: () => ({
    //             left: headerMenu?.bounds.x ?? 0,
    //             top: headerMenu?.bounds.y ?? 0,
    //             width: headerMenu?.bounds.width ?? 0,
    //             height: headerMenu?.bounds.height ?? 0,
    //             right: (headerMenu?.bounds.x ?? 0) + (headerMenu?.bounds.width ?? 0),
    //             bottom: (headerMenu?.bounds.y ?? 0) + (headerMenu?.bounds.height ?? 0),
    //         }),
    //     },
    // });
    
    // function handleRenameNet(newTreeData: NodeModel<any>[], options: DropOptions<any>): void {
    //     let info = { newTreeData: newTreeData, options: options } as any
    //     let renameNetConfirm: ConfirmationDialogProps = {
    //         onFormClosed: onConfirmationDataAvailable,
    //         title: "Please Confirm",
    //         warningText_main: `Are you sure you want to rename Net ' netclass '${options.dragSource?.text}' to interface '${options.dropTarget?.text}'?`,
    //         warningText_other: "",
    //         actionButtonText: "Proceed",
    //         enableSecondaryActionButton: false,
    //         secondaryActionButtonText: "",
    //         contextualInfo:  { key: "DROP_ACTION", value: info},
    //     }
    //     setConfirmationDialogProps(dropConfirm)
    //     confirmationModalActioner.open()
    //     setTreeData(newTreeData);
    // }


    // function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): void {
    //     if(contextualInfo && contextualInfo.key) {
    //         if(contextualInfo.key === "RENAME_NET") {
    //             if(action === ConfirmationDialogActionType.PROCEED) {
    //                 if(handleDropAction) {
    //                     handleDropAction(setTreeData, contextualInfo.value.newTreeData, contextualInfo.value.options)
    //                 }
    //             }
    //         }
    //     }
    // }

//=======================================================================================  
    


 
        // if(action && ifaceId) {
        //     if(action.toUpperCase() === "VIEW") {
        //         navigate(`/${MainScenePagesEnum.INTERFACES}/${projectId}/${ifaceId}/overview`)
        //     }
        //     else if(action.toUpperCase() === "EDIT") {
        //         let ifaceEditDialogProps: NewInterfaceDialogProps = {
        //             onFormClosed: onNewInterfaceDataAvailable,
        //             title: "Edit Interfrace and Associated Netclasses",
        //             contextualInfo: { key: "EDIT_INTERFACE",  value: interfaceList?.find(a => a._id.toString() === ifaceId) },
        //         }
                
        //         setInterfaceDetailsDialogProps(ifaceEditDialogProps)
        //         newInterfaceModalActioner.open()
        //     }
        // } 






/* <BaseGlideGrid<Net> 
    excludePortal={true}
    gridHeight={"70vh"}
    headerHeight={"26"}
    gridRef={assignedNetsGridRef}
    columns={columns}
    pageSize={BASIC_NET_NAME_GRID_PAGE_SIZE}
    totalRowCount={projStats?.totalNets as number}
    enableFillHandle={false}
    multiRowSelectionEnabled={true}
    headerMenuInfo={[]}
    cellContextMenuInfo={[]}
    enableSearchField={true}
    showActionButton={false}
    isActionClickAllowed={false}
    actionButtonText={undefined}
    actionButtonWidth={0}
    onActionButtonClick={undefined}
    reloadAfterActionClick={false}
    onGridCellEdited={onBasicNetNameGridCellEdited}
    getGridCellContent={getBasicNetNameGridCellContent}
    onGridSelectionChanged={(gridSelection, selectedIds) => setAssignedGridSelectedNetIds(selectedIds)}
    onFetchFirstSetData={(limit, filterText) => {
        if (true) { //(nodeSelectionInfo && (nodeSelectionInfo.interfaceId || nodeSelectionInfo.netclassId)) {
            let ifaceId = (nodeSelectionInfo?.interfaceId ?? null);
            let ncId = (nodeSelectionInfo?.netclassId ?? null);
            return onBasicNetNameGridInitialDataFetch(projectId, limit, filterText, ifaceId, ncId, false, true);
        }
        else {
            return new Promise(() => new Array<Net>());
        }
    } }
    onFetchSubsequentData={(lastId, limit, filterText) => {
        if (true) { //(nodeSelectionInfo && (nodeSelectionInfo.interfaceId || nodeSelectionInfo.netclassId)) {
            let ifaceId = (nodeSelectionInfo?.interfaceId ?? null);
            let ncId = (nodeSelectionInfo?.netclassId ?? null);
            return onBasicNetNameGridSubsequentDataFetch(projectId, lastId, limit, filterText, ifaceId, ncId, false, true);
        }
        else {
            return new Promise(() => new Array<Net>());
        }
    } } 
    onGridSelectionCleared={() => setAssignedGridSelectedNetIds(new Map<string, number>())}
    specialGridActionRef={specialGridActionRef}                                           
/> */






/* <BaseGlideGrid<Net> 
                                    excludePortal={true}
                                    gridHeight={"70vh"}
                                    headerHeight={"26"}
                                    gridRef={assignedNetsGridRef}
                                    columns={columns}
                                    pageSize={BASIC_NET_NAME_GRID_PAGE_SIZE}
                                    totalRowCount={projStats?.totalNets as number}
                                    enableFillHandle={false}
                                    multiRowSelectionEnabled={true}
                                    headerMenuInfo={[]}
                                    cellContextMenuInfo={[]}
                                    enableSearchField={true}
                                    showActionButton={false}
                                    isActionClickAllowed={false}
                                    actionButtonText={undefined}
                                    actionButtonWidth={0}
                                    onActionButtonClick={undefined}
                                    reloadAfterActionClick={false}
                                    onGridCellEdited={onBasicNetNameGridCellEdited}
                                    getGridCellContent={getBasicNetNameGridCellContent}
                                    onGridSelectionChanged={(gridSelection, selectedIds) => setAssignedGridSelectedNetIds(selectedIds)}
                                    onFetchFirstSetData={(limit, filterText) => {
                                        if (true) { //(nodeSelectionInfo && (nodeSelectionInfo.interfaceId || nodeSelectionInfo.netclassId)) {
                                            let ifaceId = (nodeSelectionInfo?.interfaceId ?? null);
                                            let ncId = (nodeSelectionInfo?.netclassId ?? null);
                                            return onBasicNetNameGridInitialDataFetch(projectId, limit, filterText, ifaceId, ncId, false, true);
                                        }
                                        else {
                                            return new Promise(() => new Array<Net>());
                                        }
                                    } }
                                    onFetchSubsequentData={(lastId, limit, filterText) => {
                                        if (true) { //(nodeSelectionInfo && (nodeSelectionInfo.interfaceId || nodeSelectionInfo.netclassId)) {
                                            let ifaceId = (nodeSelectionInfo?.interfaceId ?? null);
                                            let ncId = (nodeSelectionInfo?.netclassId ?? null);
                                            return onBasicNetNameGridSubsequentDataFetch(projectId, lastId, limit, filterText, ifaceId, ncId, false, true);
                                        }
                                        else {
                                            return new Promise(() => new Array<Net>());
                                        }
                                    } } 
                                    onGridSelectionCleared={() => setAssignedGridSelectedNetIds(new Map<string, number>())}
                                    specialGridActionRef={specialNetclassAssignedGridActionRef}                                           
                                    /> */