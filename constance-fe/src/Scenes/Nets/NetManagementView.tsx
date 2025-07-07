import { Box, Typography } from "@mui/material";
import { ChangeEvent, SetStateAction, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { Tabs, rem } from "@mantine/core";
import { BarChartOutlined, FileUploadOutlined, FormatAlignJustify, PlaylistAddCheckOutlined, RoomPreferencesOutlined, ShortTextOutlined, SsidChartOutlined, } from "@mui/icons-material";
import NetListUploadTab from "./NetListUploadTab";
import NetDiffPairsTab from "./NetDiffPairsTab";
import NetAssignmentTab from "./NetAssignmentTab";
import NetLengthMatchingTab from "./NetLengthMatchingTab";
import NetStatsTab from "./NetStatsTab";
import { ActionSceneEnum, ProjectPropertyCategoryEnum, UIMessageType } from "../../DataModels/Constants";
import { NetSummary, SPDomainData } from "../../DataModels/HelperModels";
import { NetListImportDetail, PackageLayout, Project } from "../../DataModels/ServiceModels";
import { fetchProjectDetails, getNetSummaryInfo } from "../../BizLogicUtilities/FetchData";
import { useSpiderStore } from "../../DataModels/ZuStore";




interface NetManagementViewProps {
}

const NetManagementView: React.FC<NetManagementViewProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as SPDomainData;
    const projObj = domainData.project;
    const pkgLayout = domainData.packageLayout as PackageLayout
    const netclasses = domainData.netclasses;
    const interfaceList = domainData.interfaceList;

    const{ projectId, tabInfo } = useParams()

    const iconStyle = { width: rem(12), height: rem(12) };
    const netlistUploadTabRef = useRef<HTMLButtonElement>(null);
    const statsTabRef = useRef<HTMLButtonElement>(null);
    const netAssignmentTabRef = useRef<HTMLButtonElement>(null);
    const diffPairsTabRef = useRef<HTMLButtonElement>(null);
    const lengthMatchingTabRef = useRef<HTMLButtonElement>(null);
    const netPropsTabRef = useRef<HTMLButtonElement>(null);

    const [project, setProject] = useState<Project>(projObj as Project);
    const [netFileInfoList, setNetFileInfoList] = useState<NetListImportDetail[]>([]);
    
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const netSummary = useSpiderStore((state) => state.netSummary) as NetSummary
    const setNetSummary = useSpiderStore((state) => state.setNetSummary);


    useEffect(() => {
        let netListFileProp = project.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.NET_FILE_IMPORT && a.name === ProjectPropertyCategoryEnum.NET_FILE_IMPORT))

        if(netListFileProp && netListFileProp.value) {
            setNetFileInfoList(Array.from(netListFileProp.value));
        }
    }, []);


    function onNetsUpdated() {
        fetchProjectDetails(project?._id.toString() as string).then((proj: Project) => {
            if(proj) {
                setProject(proj);
                let netListFileProp = proj.associatedProperties?.find(a => (
                    a.category === ProjectPropertyCategoryEnum.NET_FILE_IMPORT && a.name === ProjectPropertyCategoryEnum.NET_FILE_IMPORT))

                if(netListFileProp && netListFileProp.value) {
                    setNetFileInfoList(Array.from(netListFileProp.value));
                }

                displayQuickMessage(UIMessageType.SUCCESS_MSG, `Net-list operations successfully initiated. `
                    + `It might take few seconds for system to complete all behind-the-scenes assessments (auto netclass assignments, diffpairs, etc)`)    
            }
        });

        getNetSummaryInfo(project?._id.toString() as string, true).then((summary) => {
            if(summary) {
                setNetSummary(summary);
            }
        });
    }


    async function onRefreshNetSummaryRequired(): Promise<void> {
        getNetSummaryInfo(project?._id.toString() as string, true).then((summary) => {
            if(summary) {
                setNetSummary(summary);
            }
        });
    }






    return (
        <Box> 
            <Tabs
                className="tabs"
                classNames={{ tab: "tabstab", panel: "tabspanel" }}
                orientation="horizontal" 
                keepMounted={false} 
                value={tabInfo}
                onChange={ (value) => navigate(`/${ActionSceneEnum.NETS}/${projectId}/${value || ''}`) }>
                
                <Tabs.List variant={"pills"} justify="left">
                    <Tabs.Tab value="netlist-upload" ref={netlistUploadTabRef} leftSection={<FileUploadOutlined style={iconStyle} />}>
                        NetList Upload
                    </Tabs.Tab>
                    <Tabs.Tab value="stats" ref={statsTabRef} leftSection={<BarChartOutlined style={iconStyle} />}>
                        Stats
                    </Tabs.Tab>
                    <Tabs.Tab disabled={(netSummary && netSummary.hasNets) ? false: true} value="net-assignment"  ref={netAssignmentTabRef} leftSection={<PlaylistAddCheckOutlined style={iconStyle} />}>
                        Net Assignment
                    </Tabs.Tab>
                    <Tabs.Tab disabled={(netSummary && netSummary.hasNets) ? false: true} value="diff-pairs" ref={diffPairsTabRef} leftSection={<ShortTextOutlined style={iconStyle} />}>
                        Diff Pairs
                    </Tabs.Tab>
                    <Tabs.Tab disabled={(netSummary && netSummary.hasNets) ? false: true} value="length-matching" ref={lengthMatchingTabRef} leftSection={<SsidChartOutlined style={iconStyle} />}>
                        Length Matching
                    </Tabs.Tab>
                </Tabs.List>

                
                <Tabs.Panel value="netlist-upload">
                    <NetListUploadTab project={project} netSummary={netSummary} netFileInfoList={netFileInfoList} onNetsUpdated={onNetsUpdated} />
                </Tabs.Panel>
                
                <Tabs.Panel value="stats">
                    <NetStatsTab netSummary={netSummary} netclasses={netclasses} interfaceList={interfaceList}/>
                </Tabs.Panel>

                <Tabs.Panel value="net-assignment">
                    <NetAssignmentTab netSummary={netSummary} onRefreshNetSummaryRequired={onRefreshNetSummaryRequired} 
                        project={project} pkgLayout={pkgLayout} ifaceList={interfaceList} netclassList={netclasses} />
                </Tabs.Panel>

                <Tabs.Panel value="diff-pairs">
                    <NetDiffPairsTab netSummary={netSummary} onRefreshNetSummaryRequired={onRefreshNetSummaryRequired} project={project}/>
                </Tabs.Panel>

                <Tabs.Panel value="length-matching">
                    <NetLengthMatchingTab netSummary={netSummary} projectObj={project} interfaceList={interfaceList} netclasses={netclasses}/>
                </Tabs.Panel>
            </Tabs>

        </Box>
    )


}

export default NetManagementView














// <Tabs.Tab disabled value="net-props" ref={netPropsTabRef} leftSection={<RoomPreferencesOutlined style={iconStyle} />}>
// Custom Properties
// </Tabs.Tab>


// <Tabs.Panel value="net-props">
// <NetCustomPropertiesTab netSummary={netSummary} />
// </Tabs.Panel>






    // const [netSummary, setNetSummary] = useState<NetSummary>(netSumObj as NetSummary);

    
    // const [netsAvailable, setNetsAvailable] = useState<boolean>((projStats?.totalNets && projStats.totalNets > 0) ? true : false)
    
    // function updateNetImportHistory() {
    //     fetchProjectDetails(project?._id.toString() as string).then((proj: Project) => {
    //         if(proj) {
    //             setProject(proj);
    //             setRetrievedNetFileInfo(proj);
    //         }
    //     })
    // }
    

    // function setRetrievedNetFileInfo(proj: Project) {
    //     let netListFileProp = proj.associatedProperties?.find(a => (
    //         a.category === ProjectPropertyCategoryEnum.NET_FILE_IMPORT && a.name === ProjectPropertyCategoryEnum.NET_FILE_IMPORT))
        
    //     if(netListFileProp && netListFileProp.value) {
    //         setNetFileInfoList(Array.from(netListFileProp.value));
    //     }

    //     // if(gridApi) { gridApi.setGridOption('rowData', netFilePropList ?? []) }
    // }


    // if(netListActionTakenTracker) {
    //     getProjectStats(project?._id.toString() as string).then((netStats) => {
    //         if(netStats) {
    //             setProjStats(netStats);
    //             updateNetImportHistory();

    //             if(onNetsUpdated) {
    //                 onNetsUpdated()
    //             }
    //         }
    //     });
    // }





    // const ifaceMap : Map<string, TreeViewBaseItem> = useEffect(() => {
    //     let map = new Map<string, TreeViewBaseItem >()
    //     if(context.Interfaces && context.Interfaces.length > 0) {
    //         for(let i = 0; i < context.Interfaces.length; i++) {
    //             let ifaceTvbi : TreeViewBaseItem = {
    //                 id: context.Interfaces[i]._id.toString(),
    //                 label: context.Interfaces[i].name,
    //                 children: new Array<TreeViewBaseItem>(),
    //             }
    //             map.set(context.Interfaces[i]._id.toString(), ifaceTvbi)
    //         }
    //     }
    //     if(context.Netclasses && context.Netclasses.length > 0) {
    //         for(let x = 0; x < context.Netclasses.length; x++) {
    //             let ncIfaceId = context.Netclasses[x].interfaceId
    //             if(ncIfaceId && ncIfaceId.length > 0 && map.has(ncIfaceId)) {
    //                 let ncTvbi : TreeViewBaseItem = {
    //                     id: context.Netclasses[x]._id.toString(),
    //                     label: context.Netclasses[x].name,
    //                     children: [],
    //                 }
    //                 let ifaceEntry = map.get(ncIfaceId) as TreeViewBaseItem;
    //                 (ifaceEntry.children as TreeViewBaseItem[]).push(ncTvbi)
    //         }
    //     }
    //     return map
    // }, []); 


