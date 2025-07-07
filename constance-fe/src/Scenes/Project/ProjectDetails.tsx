import { Box, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { Tabs, rem } from "@mantine/core";
import { BarChartOutlined, DownloadDoneOutlined, DownloadForOfflineOutlined, FileUploadOutlined, KeyOutlined, LeakRemoveOutlined, PlaylistAddCheckOutlined, ShortTextOutlined, SsidChartOutlined, } from "@mui/icons-material";
import NetListUploadTab from "../Nets/NetListUploadTab";
import ProjectPermissionsTab from "./ProjectPermissionsTab";
import ProjectReportsTab from "./ProjectReportsTab";
import ProjectOverviewTab from "./ProjectOverviewTab";
import { ActionSceneEnum } from "../../DataModels/Constants";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { SPDomainData } from "../../DataModels/HelperModels";
import ProjectNotesTab from "./ProjectNotesTab";


interface ProjectDetailsProps {
}

const ProjectDetails: React.FC<ProjectDetailsProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as SPDomainData;
    const project = domainData.project;
    
    const{ projectId, tabInfo } = useParams()

    const iconStyle = { width: rem(12), height: rem(12) };
    
    const overviewTabRef = useRef<HTMLButtonElement>(null);
    const reportsTabRef = useRef<HTMLButtonElement>(null);
    const permissionsUploadTabRef = useRef<HTMLButtonElement>(null);



    return (
        <Box> 
            <Tabs  //TODO: add minimin width on this to make sure the page shring doesnt look wierd
                className="tabs"
                classNames={{ tab: "tabstab", panel: "tabspanel" }}
                orientation="horizontal" 
                keepMounted={false} 
                value={tabInfo}
                onChange={ (value) => navigate(`/${ActionSceneEnum.PROJECT}/${projectId}/${value || ''}`) }>
                
                <Tabs.List variant={"pills"} justify="left">
                    <Tabs.Tab value="overview"  ref={overviewTabRef} leftSection={<PlaylistAddCheckOutlined style={iconStyle} />}>
                        Project Overview
                    </Tabs.Tab>

                    <Tabs.Tab value="reports" ref={reportsTabRef} leftSection={<DownloadDoneOutlined style={iconStyle} />}>
                        Reports
                    </Tabs.Tab>

                    <Tabs.Tab value="notes" leftSection={<ShortTextOutlined style={iconStyle} />}>
                        Notes
                    </Tabs.Tab>
                    
                    <Tabs.Tab value="permissions" ref={permissionsUploadTabRef} leftSection={<KeyOutlined style={iconStyle} />}>
                        Permisssions
                    </Tabs.Tab>

                </Tabs.List>


                <Tabs.Panel value="overview">
                    <ProjectOverviewTab />
                </Tabs.Panel>

                <Tabs.Panel value="reports">
                    <ProjectReportsTab />
                </Tabs.Panel>

                <Tabs.Panel value="notes">
                    <ProjectNotesTab />
                </Tabs.Panel>

                <Tabs.Panel value="permissions">
                    <ProjectPermissionsTab />
                </Tabs.Panel>

            </Tabs>

        </Box>
    )


}

export default ProjectDetails
