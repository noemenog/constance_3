import { Box, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { Tabs, rem } from "@mantine/core";
import { KeyOutlined, PlaylistAddCheckOutlined } from "@mui/icons-material";
import AppInfoOverviewTab from "./AppInfoOverviewTab";
import { ActionSceneEnum } from "../../DataModels/Constants";
import { useCStore } from "../../DataModels/ZuStore";
import { CDomainData } from "../../DataModels/ServiceModels";
import AppInfoPermissionsTab from "./AppInfoPermissionsTab";


interface AppInfoContainerProps {
}

const AppInfoContainer: React.FC<AppInfoContainerProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as CDomainData;
    const appInfo = domainData.appInfo;
    
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment)

    const{ appId, tabInfo } = useParams()

    const iconStyle = { width: rem(12), height: rem(12) };
    
    const overviewTabRef = useRef<HTMLButtonElement>(null);
    const permissionsUploadTabRef = useRef<HTMLButtonElement>(null);



    return (
        <Box> 
            <Tabs  //TODO: add minimin width on this to make sure the page shring doesnt look wierd
                className="tabs"
                classNames={{ tab: "tabstab", panel: "tabspanel" }}
                orientation="horizontal" 
                keepMounted={false} 
                value={tabInfo}
                onChange={ (value) => navigate(`/${ActionSceneEnum.APPHOME}/${appId}/${value || ''}`) }>
                
                <Tabs.List variant={"pills"} justify="left">
                    <Tabs.Tab value="overview"  ref={overviewTabRef} leftSection={<PlaylistAddCheckOutlined style={iconStyle} />}>
                        App Overview
                    </Tabs.Tab>

                    <Tabs.Tab value="permissions" ref={permissionsUploadTabRef} leftSection={<KeyOutlined style={iconStyle} />}>
                        Permisssions
                    </Tabs.Tab>

                </Tabs.List>


                <Tabs.Panel value="overview">
                    <AppInfoOverviewTab />
                </Tabs.Panel>

                <Tabs.Panel value="permissions">
                    <AppInfoPermissionsTab />
                </Tabs.Panel>

            </Tabs>

        </Box>
    )


}

export default AppInfoContainer
