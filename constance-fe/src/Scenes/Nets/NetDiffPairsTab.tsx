import { Box, Button, Divider, Grid, Paper, Typography } from "@mui/material";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useSpiderStore } from "../../DataModels/ZuStore";
import BaseGlideGrid, { SpecialGridActionContext } from "../../CommonComponents/BaseGlideGrid";
import { Net, Project } from "../../DataModels/ServiceModels";
import { BASIC_GRID_HEADER_HEIGHT, DIFF_PAIR_NON_PAIRED_GRID_PAGE_SIZE, getBasicNetNameGridCellContent, getBasicNetNameGridColumns, getDiffPairGridCellContent, getDiffPairGridColumns, getNonDiffedNetGridCellContent, getNonDiffedNetGridColumns, onBasicNetNameGridInitialDataFetch, onBasicNetNameGridSubsequentDataFetch, onDiffPairGridInitialDataFetch, onDiffPairGridSubsequentDataFetch, onNonDiffedGridInitialDataFetch, onNonDiffedGridSubsequentDataFetch } from "../../BizLogicUtilities/BaseGridLogic";
import { BasicKVP, LoadingSpinnerInfo, LoggedInUser, NetMgmtCtx, NetSummary, PollingInfoContext, SPDomainData } from "../../DataModels/HelperModels";
import { DataMappingTypeEnum, NetManagementActionTypeEnum, PendingProcessActionTypeEnum, PermissionActionEnum, UIMessageType } from "../../DataModels/Constants";
import { getNetSummaryInfo, updateNets } from "../../BizLogicUtilities/FetchData";
import { useLoaderData } from "react-router-dom";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import useSWR from "swr";
import { fetcher } from "../../BizLogicUtilities/BasicCommonLogic";




interface NetDiffPairsTabProps {
    project: Project,
    netSummary: NetSummary,
    onRefreshNetSummaryRequired: () => Promise<void>
}

const NetDiffPairsTab: React.FC<NetDiffPairsTabProps> = ({ project, netSummary, onRefreshNetSummaryRequired }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);

    const [nonDiffSelectedNetIds, setNonDiffSelectedNetIds] = useState<Map<BasicKVP, number>>(new Map<BasicKVP, number>());
    const [diffSelectedNetInfo, setDiffSelectedNetInfo] = useState<Map<BasicKVP, number>>(new Map<BasicKVP, number>());
    const projectId = project?._id.toString() ?? "";

    useEffect(() => {
        placePageTitle("NetDiffPairs")
    }, []);
    
    

    
    //======================================== Polling ==================================== 
    const [enableProcPolling, setEnableProcPolling] = useState<boolean>(true);

    let pollCtx : PollingInfoContext = {
        type: PendingProcessActionTypeEnum.AUTODIFF_EXEC,
        mainMessageOnProc: `Auto-Diff process is currently running. Please allow some time for the process to complete. Stay tuned for completion...`,
        spinnerMessageOnProc: `Checking/handling auto diff-pairing. Please wait...`,
        messageOnCompletion: ``,
        messageOnError: `Could not successfully complete auto-diff pairing operation`,
        setBackdropBlocker: true,
        actionOnCompletion : () => { },
        setStateChange: setEnableProcPolling,
        getStartTime: () => { return null }
    }

    const { data, error, isLoading } = useSWR(enableProcPolling ? projectId: null, (key: any) => fetcher(key, pollCtx), { refreshInterval: 7000, revalidateOnMount : true})
    //======================================================================================
        
    

    const nonDiffNetsGridRef = useRef<any>();
    const nonDiffedGridActionRef = useRef<SpecialGridActionContext<Net>|undefined>();

    const dpGridRef = useRef<any>();
    const dpGridActionRef = useRef<SpecialGridActionContext<Net>|undefined>();

    
    let nonDiffSelArr = Array.from(nonDiffSelectedNetIds.keys() ?? [])?.map(a => a.value);
    let nonDiffFirstSel = nonDiffSelArr?.at(0) ?? ''
    let nonDiffSecondSel = nonDiffSelArr?.at(1) ?? ''
    

    //TODO: there must be a minimum width to each section! - otherwise tree item text gets bunched up
    const sectionStyle = useMemo(() => (
        { textAlign: "center", borderTopLeftRadius: 40, borderTopRightRadius: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, m: 1, height: "81.5vh", backgroundColor: colors.primary[400] }
    ), []); 

    const sectionStyle2 = useMemo(() => (
        { textAlign: "center", borderTopLeftRadius: 4, borderTopRightRadius: 40, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, m: 1, height: "81.5vh", backgroundColor: colors.primary[400] }
    ), []);

    const diffGridPageSize = useMemo(() => {
        //IMPORTANT - for this grid, page size MUST be an even number!!!
        let size = (DIFF_PAIR_NON_PAIRED_GRID_PAGE_SIZE % 2 === 0) ? DIFF_PAIR_NON_PAIRED_GRID_PAGE_SIZE : DIFF_PAIR_NON_PAIRED_GRID_PAGE_SIZE + 1;
        return size
    }, []);


    //================================= NON-PAIRED =============================================
    const unpairedGridColumns = useMemo(() => {           
        let cols = getNonDiffedNetGridColumns()
        return cols
    }, []);


    function onNonDiffedSelectionChanged(selectedNetIdsMap: Map<string, number>): void {
        if(nonDiffedGridActionRef && nonDiffedGridActionRef.current && selectedNetIdsMap && selectedNetIdsMap.size > 0) {
            let map = new Map<BasicKVP, number>();
            for (let [key, value] of selectedNetIdsMap) {
                let netObj = nonDiffedGridActionRef.current.getDataAtIndex(value)
                map.set({key: key, value: netObj?.name } as BasicKVP, value)
            }
            setNonDiffSelectedNetIds(map)
        }
        else {
            setNonDiffSelectedNetIds(new Map<BasicKVP, number>())
        }
    }


    function onNonDiffedSelectionCleared(): void {
        setNonDiffSelectedNetIds(new Map<BasicKVP, number>())
    }
    //====================================== END: NON-PAIRED =============================================



    //=================================================DIFF PAIRS ==========================================
    const dpGridColumns = useMemo(() => {           
        let cols = getDiffPairGridColumns()
        return cols
    }, []);


    function executeDiffPairGridInitialDataFetch(limit: number, filterText: string): Promise<Net[]> {
        setLoadingSpinnerCtx({enabled: true, text: `Now retrieving diff pairs. Please wait...`} as LoadingSpinnerInfo)
        let res = onDiffPairGridInitialDataFetch(projectId, limit, diffGridPageSize, filterText).finally(() => { cancelLoadingSpinnerCtx() });
        return res
    }


    // function executeDiffPairGridSubsequentDataFetch(lastId: string, lastDataEntry: Net, limit: number, filterText: string): Promise<Net[]> {
    //     setLoadingSpinnerCtx({enabled: true, text: `Now retrieving diff pairs. Please wait...`} as LoadingSpinnerInfo)
    //     let res = onDiffPairGridSubsequentDataFetch(projectId, lastId, limit, diffGridPageSize, filterText).finally(() => { cancelLoadingSpinnerCtx() });
    //     return res
    // }
    
    function onDiffPairGridSelectionChanged(selectedNetIdsMap: Map<string, number>): void {
        if(dpGridActionRef && dpGridActionRef.current && selectedNetIdsMap && selectedNetIdsMap.size > 0) {
            let map = new Map<BasicKVP, number>();
            for (let [key, value] of selectedNetIdsMap) {
                let netObj = dpGridActionRef.current.getDataAtIndex(value)
                map.set({key: key, value: netObj?.name } as BasicKVP, value)
            }
            setDiffSelectedNetInfo(map)
        }
        else {
            setDiffSelectedNetInfo(new Map<BasicKVP, number>())
        }
    }


    function onDiffPairGridSelectionCleared(): void {
        setDiffSelectedNetInfo(new Map<BasicKVP, number>())
    }
    //====================================================== END: DIFF-PAIR GRID ===============================




    async function onPairNetsActionButtonClicked(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.MANUALLY_SETUP_DIFFPAIRS) === false) { return; }
        if(nonDiffSelectedNetIds && nonDiffSelectedNetIds.size > 1){
            let keysArr = Array.from(nonDiffSelectedNetIds.keys())
            let firstNet = keysArr[0].key;
            let secondNet = keysArr[1].key;

            let netArr: Net[] = [firstNet, secondNet].map((netId: string) => {
                let net : Net = {
                    _id: netId, //important item here!
                    projectId: projectId, //important item here
                    snapshotSourceId: "",
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    interfaceId: "",
                    name: "", //inconsequential
                    netclassMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                    netClassId: "",
                    constraintClassId: "",
                    diffPairNet: (netId === firstNet) ? secondNet : firstNet, //inconsequential
                    diffPairMapType: DataMappingTypeEnum.Manual, //inconsequential
                    tags: [],
                    associatedProperties: []
                }

                return net;
            })

            let netUpdateContext : NetMgmtCtx = {
                projectId: projectId,
                actionType: NetManagementActionTypeEnum.ASSIGN_DIFF_PAIR,
                status: "",
                netsInvolved: netArr,
                contextualInfo: ""
            }
            
            updateNets(netUpdateContext).then((ctx: NetMgmtCtx) => {
                if(ctx && ctx.status.toLowerCase() === "success") {
                    onRefreshNetSummaryRequired().then(() =>{
                        nonDiffedGridActionRef?.current?.reloadDataRows()
                        dpGridActionRef?.current?.reloadDataRows()
                    })
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG,"Diff pair assignment was not successful. Please check logs for details.")
                }
                
            })
        }
    }

    
    async function onDiffPairRemovalActionButtonClicked(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.MANUALLY_SETUP_DIFFPAIRS) === false) { return; }
        if(diffSelectedNetInfo && diffSelectedNetInfo.size > 0){
            let keysArr = Array.from(diffSelectedNetInfo.keys())

            let netArr: Net[] = keysArr.map((netEntry: BasicKVP) => {
                let net : Net = {
                    _id: netEntry.key, //important item here!
                    snapshotSourceId: "",
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    projectId: projectId, //important item here
                    interfaceId: "",
                    name: netEntry.value, //inconsequential
                    netclassMapType: DataMappingTypeEnum.Unmapped, //inconsequential
                    netClassId: "",
                    constraintClassId: "",
                    diffPairNet: "", //inconsequential
                    diffPairMapType: DataMappingTypeEnum.Manual, //inconsequential
                    tags: [],
                    associatedProperties: []
                }

                return net;
            })

            let netUpdateContext : NetMgmtCtx = {
                projectId: projectId,
                actionType: NetManagementActionTypeEnum.REMOVE_DIFF_PAIR,
                status: "",
                netsInvolved: netArr,
                contextualInfo: ""
            }
            
            updateNets(netUpdateContext).then((ctx: NetMgmtCtx) => {
                if(ctx && ctx.status.toLowerCase() === "success") {
                    onRefreshNetSummaryRequired().then(() =>{
                        nonDiffedGridActionRef?.current?.reloadDataRows()
                        dpGridActionRef?.current?.reloadDataRows()
                    })
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG,"Attempt to unpair/remove diff pair(s) was not successful. Please check logs for details.")
                }
                
            })
        }
    }




    

    return (
        <Box>
            <Box  sx={{ height: "80vh", mt: 1.2}}>
                <Grid container spacing={2} direction="row">
                    <Grid minWidth={370} item xs={4} key={`sec-diff-1`}>
                        <Box minHeight="83vh" display="flex" flexDirection="column" sx={sectionStyle}>    
                            <Typography variant="h6" color={colors.greenAccent[400]}>{`Unpaired Nets`}</Typography>
                            <Divider sx={{ ml: 2, width:"96%"}}/>

                            <Box>
                                <Box sx={{overflowX: "clip", minHeight: "20px", mt: 1 }}>
                                    <Typography sx={{ mt: -0.5, fontSize: 10, color: colors.blueAccent[100] }}>
                                        {(nonDiffFirstSel && nonDiffFirstSel.length > 0) ? <span>{`(#1): ${nonDiffFirstSel}`}</span> : <span></span>}
                                    </Typography>
                                    <Typography sx={{ mb: -0.5, fontSize: 10, color: colors.blueAccent[100] }}>
                                        {(nonDiffSecondSel && nonDiffSecondSel.length > 0) ? <span>{`(#2): ${nonDiffSecondSel}`}</span> : <span></span>}
                                    </Typography>
                                </Box>
                                <Divider sx={{ mb: 0.5, mt: 1, ml: 2, width:"96%" }}/>
                            </Box>

                            <Box sx={{ml:2}}>
                                <BaseGlideGrid<Net> 
                                    excludePortal={true}
                                    gridHeight={"69vh"}
                                    headerHeight={BASIC_GRID_HEADER_HEIGHT}
                                    gridRef={nonDiffNetsGridRef}
                                    columns={unpairedGridColumns}
                                    pageSize={DIFF_PAIR_NON_PAIRED_GRID_PAGE_SIZE}
                                    totalRowCount={netSummary?.totalNonPairedNets ?? 0}
                                    enableFillHandle={false}
                                    multiRowSelectionEnabled={true}
                                    maxRowSelectionCount={2}
                                    enableSearchField={true}
                                    showActionButton={true}
                                    cellEditConfirmationColumns={[]}
                                    isActionClickAllowed={ (nonDiffSelectedNetIds && nonDiffSelectedNetIds.size === 2) ? true : false }
                                    actionButtonText={"Pair Nets"}
                                    actionButtonWidth={160}
                                    reloadAfterActionClick={true}
                                    onActionButtonClick={onPairNetsActionButtonClicked}                     
                                    onGridCellEdited={undefined}
                                    onGetGridCellContent={getNonDiffedNetGridCellContent} 
                                    onGridSelectionChanged={(gridSelection, selectedIds) => onNonDiffedSelectionChanged(selectedIds)}
                                    onGridSelectionCleared={onNonDiffedSelectionCleared}
                                    onFetchFirstSetData={(limit, filterText) => onNonDiffedGridInitialDataFetch(projectId, limit, filterText)}
                                    onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => onNonDiffedGridSubsequentDataFetch(projectId, lastId, limit, filterText)}  
                                    specialGridActionRef={nonDiffedGridActionRef}
                                />
                            </Box>

                        </Box>
                    </Grid>
                    <Grid minWidth={392} item xs key={`sec-diff-2`}>
                        <Box minHeight="83vh" display="flex" flexDirection="column" sx={sectionStyle2}>    
                            <Typography variant="h6" color={colors.greenAccent[400]}>{`Paired Nets`}</Typography>
                            <Divider sx={{width: "98%"}}/>

                            <Box>
                                <Box minHeight="20px" mt={1}>
                                    {(diffSelectedNetInfo && diffSelectedNetInfo.size > 0) && <Typography color={colors.blueAccent[100]}>
                                        <span>{`[ ${diffSelectedNetInfo.size} ] Diff Pair${diffSelectedNetInfo.size > 1 ? 's' : ''} Selected`}</span>
                                    </Typography>}
                                </Box>
                                <Divider sx={{ mb: 0.5, mt: 1, width:"98%" }}/>
                            </Box>

                            <Box sx={{ml:2}}>
                                <BaseGlideGrid<Net> 
                                    excludePortal={true}
                                    gridHeight={"69vh"}
                                    headerHeight={BASIC_GRID_HEADER_HEIGHT}
                                    gridRef={dpGridRef}
                                    columns={dpGridColumns}
                                    pageSize={diffGridPageSize}
                                    gridMarginRight={-3}
                                    totalRowCount={netSummary?.totalDiffPairedNets ?? 0}
                                    enableFillHandle={false}
                                    multiRowSelectionEnabled={true}
                                    maxRowSelectionCount={Number.MAX_SAFE_INTEGER}
                                    enableSearchField={true}
                                    showActionButton={true}
                                    cellEditConfirmationColumns={[]}
                                    isActionClickAllowed={ (diffSelectedNetInfo && diffSelectedNetInfo.size > 0) ? true : false }
                                    actionButtonText={"Remove"}
                                    actionButtonWidth={160}
                                    onActionButtonClick={onDiffPairRemovalActionButtonClicked}
                                    reloadAfterActionClick={true}
                                    onGridCellEdited={undefined}
                                    onGetGridCellContent={getDiffPairGridCellContent} 
                                    onGridSelectionChanged={(gridSelection, selectedIds) => onDiffPairGridSelectionChanged(selectedIds)}
                                    onGridSelectionCleared={onDiffPairGridSelectionCleared}
                                    onFetchFirstSetData={executeDiffPairGridInitialDataFetch}
                                    onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => onDiffPairGridSubsequentDataFetch(projectId, lastId, limit, diffGridPageSize, filterText)}  
                                    specialGridActionRef={dpGridActionRef}
                                />
                                
                                {/* IMPORTANT! - DO NOT REMOVE portal div! 
                                I dont know why this works here. But any other scenario makes it such that second grid cannot be edited */}
                                <div id="portal"></div>

                            </Box>

                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}

export default NetDiffPairsTab
