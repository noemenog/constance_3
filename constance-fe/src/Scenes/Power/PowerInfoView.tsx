import { Box, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { Tabs, rem } from "@mantine/core";
import { AlignVerticalCenterOutlined, BarChartOutlined, CompassCalibrationOutlined, TaskOutlined, } from "@mui/icons-material";
import PowerRailsTab from "./PowerRailsTab";
import PowerComponentsTab from "./PowerComponentsTab";
import { ActionSceneEnum } from "../../DataModels/Constants";
import { SPDomainData } from "../../DataModels/HelperModels";
import { PowerInfo, Project } from "../../DataModels/ServiceModels";



interface PowerInfoProps {
}

const PowerInfoView: React.FC<PowerInfoProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();

    const{ projectId, interfaceId, tabInfo } = useParams()

    const iconStyle = { width: rem(12), height: rem(12) };

  

    return (
        <Box> 
            <Tabs
                className="tabs"
                classNames={{ tab: "tabstab", panel: "tabspanel" }}
                orientation="horizontal" 
                keepMounted={false} 
                value={tabInfo}
                onChange={ (value) => navigate(`/${ActionSceneEnum.POWERINFO}/${projectId}/${value || ''}`) } >
                
                <Tabs.List variant={"pills"} justify="left">
                    <Tabs.Tab value="rails" leftSection={<AlignVerticalCenterOutlined style={iconStyle} />}>
                        Rails
                    </Tabs.Tab>
                    <Tabs.Tab value="components" leftSection={<CompassCalibrationOutlined style={iconStyle} />}>
                        Components
                    </Tabs.Tab>
                </Tabs.List>


                <Tabs.Panel value="rails">
                    <PowerRailsTab />
                </Tabs.Panel>
                
                <Tabs.Panel value="components">
                    <PowerComponentsTab />
                </Tabs.Panel>

            </Tabs>
        </Box>
    )


}

export default PowerInfoView











/* <Tabs.Tab value="sheets" leftSection={<TaskOutlined style={iconStyle} />}>
                        Sheets
                    </Tabs.Tab> */

/* <Tabs.Panel value="sheets">
                    <PowerSheetsTab powerInfo={powerInfo} project={project as Project} />
                </Tabs.Panel> */


//Example Data:

// {
//     "_id" : ObjectId("65caf2e3f1a951c5a55161e9"),
//     "ProjectID" : "65ca84e0ad1a559173f59f4b",
//     "Rails" : [
//         {
//             "_id" : "3k_X9D1cvqxS0_okhwqix",
//             "Rail" : "VCC",
//             "Voltage" : "1.2",
//             "TotalCurrent" : "1",
//             "PkgPins" : "3",
//             "DiePins" : ""
//         }
//     ],
//     "CapsComponent" : [
//         {
//             "_id" : "Po3v7GrMRiHCzOo14NOPj",
//             "Refdes" : "R1",
//             "Pin" : "C1",
//             "Cell" : "1C1",
//             "PDB" : "12",
//             "Net" : "AX0",
//             "FormFactor" : "2x2",
//             "Value" : "12",
//             "Stuffed" : "False"
//         },
//         {
//             "_id" : "wLdoExvn055QWSLr_xkMp",
//             "Refdes" : "C2",
//             "Pin" : "CR",
//             "Cell" : "C2",
//             "PDB" : "12",
//             "Net" : "AX1",
//             "FormFactor" : "12x12",
//             "Value" : "12",
//             "Stuffed" : "True"
//         }
//     ],
//     "Sheets" : [
//         {
//             "_id" : null,
//             "Name" : "Sample2_LMData",
//             "SheetData" : "[[\"NetName\",\"Netclass\",\"Match Group\",\"LengthMatch Target (um)\",\"LM1 (optional)\",\"LM1 Target(um)\",\"LM2(optional)\",\"LM2 Target(um)\",\"LM3(optional)\",\"LM3 Target(um)\",\"Comments\",\"Diff Pair Tolerance(um)\",\"Total Cummulative Length\",\"ROV (optional)\"],[\"BARE_SYNC\",\"\",\"R1\",\"100\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_0\",\"\",\"R1\",\"100\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_1\",\"\",\"R1\",\"100\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_10\",\"\",\"R1\",\"100\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_15\",\"\",\"R3\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_16\",\"\",\"R3\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_17\",\"\",\"R3\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_18\",\"\",\"R3\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_19\",\"\",\"R3\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_2\",\"\",\"R4\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_5\",\"\",\"R5\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_6\",\"\",\"R6\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_7\",\"\",\"R7\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_8\",\"\",\"R8\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[\"BTM_SCANIO_9\",\"\",\"R9\",\"300\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"]]"
//         }
//     ]
// }