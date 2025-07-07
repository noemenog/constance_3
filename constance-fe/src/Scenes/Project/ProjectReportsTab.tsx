import { Box, Button, Card, Divider, Grid, Grow, IconButton } from "@mui/material"; 
import { Typography } from "@mui/material";
import { PeoplePicker } from "@microsoft/mgt-react";
import React, { useContext, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import { tokens } from "../../theme";
import { PlaylistAddCheckCircleOutlined } from "@mui/icons-material";
import { ActionSceneEnum, PermissionActionEnum, ProjectDataDownloadContentTypeEnum, SPECIAL_QUARTZ_COLOR } from "../../DataModels/Constants";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { downloadProjectData } from "../../BizLogicUtilities/FetchData";
import { LoadingSpinnerInfo, LoggedInUser, SPDomainData } from "../../DataModels/HelperModels";
import { Project } from "../../DataModels/ServiceModels";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import { SpButton } from "../../CommonComponents/SimplePieces";



interface ReportInfo { name: string, description: string, contentType: ProjectDataDownloadContentTypeEnum, enabled: boolean }  


interface ProjectReportsTabProps {
    
}


const ProjectReportsTab: React.FC<ProjectReportsTabProps> = ({  }) => { 
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as SPDomainData;
    const project = domainData.project as Project;
    
    const containerRef = useRef<HTMLElement>(null);  //important!
    
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    

    useEffect(() => {
        placePageTitle("ProjectReports")
    }, []);



    const reportTypes : ReportInfo[] = useMemo(() => {
        let items = [
            {
                name: "PDRD",
                description: `Download package design requirement document (PDRD) in excel format. The document includes project-level properties, nets and associated properties, stackup information, and all rules/constraint values for the project according to interface. `,
                contentType: ProjectDataDownloadContentTypeEnum.PDRD,
                enabled: true
            }, 
            {
                name: "Net Info",
                description: `Download a list of all nets for current project. The data includes length matching info and other custom properties for each net. `,
                contentType: ProjectDataDownloadContentTypeEnum.NETINFO,
                enabled: true
            }, 
            {
                name: "Constraints for Xpedition/Mentor",
                description: `Download data intended for (Xpedition) electronic design automation (EDA) software (also known as Mentor). Downloaded zip package includes instruction of how to import the downloaded data into XPedition/Mentor`,
                contentType: ProjectDataDownloadContentTypeEnum.XPEDITION,
                enabled: true
            }, 
            {
                name: "Constraints for APD/Cadence",
                description: `Download data intended for Cadence Allegro PCB Designer (APD). A 'README.txt' file within the downloaded zip file precisely describes how to import the data into APD/Mentor`,
                contentType: ProjectDataDownloadContentTypeEnum.APD,
                enabled: true
            }
        ]

        return items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

    }, []);



    function reportDownloadClicked(typeInfo: ReportInfo): void {
        if(typeInfo.contentType === ProjectDataDownloadContentTypeEnum.PDRD){
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.DOWNLOAD_DPRD) === false) { return; }
        }
        else if(typeInfo.contentType === ProjectDataDownloadContentTypeEnum.NETINFO){
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.DOWNLOAD_NET_INFO) === false) { return; }
        }
        else if(typeInfo.contentType === ProjectDataDownloadContentTypeEnum.XPEDITION){
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.DOWNLOAD_XPEDITION_DATA) === false) { return; }
        }
        else if(typeInfo.contentType === ProjectDataDownloadContentTypeEnum.APD){
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.DOWNLOAD_APD_DATA) === false) { return; }
        }
        else if(typeInfo.contentType === ProjectDataDownloadContentTypeEnum.FULLZIP){
            //do nothing for now
        }

        setLoadingSpinnerCtx({enabled: true, text: `Now processing data retrieval. Please wait...`} as LoadingSpinnerInfo)
        downloadProjectData(project as Project, typeInfo.contentType).then((dlHandler: any) => {
            if(dlHandler) {
                let link = dlHandler as HTMLAnchorElement;
                link.click();
                link.remove();
            } 
        })
        .finally(() => { cancelLoadingSpinnerCtx() });
    }



    return (
        <Box sx={{ mt: 2.5}} ref={containerRef}>
            <Divider sx={{ marginLeft: 0, marginRight: 0 }} />
            {project && <Box  alignItems="center" sx={{ height: "80vh", overflowY: "scroll" }}>
                <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }} >
                {
                    reportTypes.map((repInfo: ReportInfo, index: number) => (
                        <Grid key={`gd-${index}`} item xs={2} sm={4} md={4} minWidth={500}>
                            <Box key={`bx-${index}`} sx={{ display: 'flex'}}>
                                <Grow in={true} timeout={"auto"}>
                                    <Card key={`pap-${index}`} sx={{ textAlign: "center", borderRadius: 5, m: 1, width: 500 }} raised> 
                                        
                                        <Box key={`bx1-${index}`} display="flex" width={"100%"} height={40} sx={{justifyContent: "center", backgroundColor: SPECIAL_QUARTZ_COLOR }} >
                                            <Box key={`bx2-${index}`} width={"90%"}>
                                                <Typography variant="h5" sx={{mt: 1}}>{repInfo.name}</Typography>
                                            </Box>
                                        </Box>

                                        <Divider sx={{ mt: 2, mb: 2}}/>

                                        <Box display="flex" sx={{ ml: 2, mr: 2, textAlign:"left", fontSize: 12, minHeight: 85, maxHeight: 85}}>
                                            <Typography>{repInfo.description}</Typography>
                                        </Box>
                                        
                                        <Divider sx={{ mt: 2, mb: 2}}/>

                                        <SpButton
                                            onClick={() => reportDownloadClicked(repInfo)}
                                            key={`rep-button-${index}`}
                                            startIcon={<PlaylistAddCheckCircleOutlined />}
                                            sx={{ width:250, mb: 2 }}
                                            label="Download"
                                            disabled={repInfo.enabled ? false : true}
                                            intent={repInfo.enabled ? "plain" : "cancel"} />
                                    </Card>
                                </Grow>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Box>}

        </Box>
    )

}

export default ProjectReportsTab











    // {
    //     name: "Full Project Backup (.zip)",
    //     description: `Download all information saved for current project. This file may be huge. Please be patient. Download process may take several minutes.`,
    //     contentType: ProjectDataDownloadContentTypeEnum.FULLZIP,
    //     enabled: false
    // }



    
// Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
// Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.


//reportTypes.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())).map((item: any, index: number) => (
//height: 235 