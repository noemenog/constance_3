import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Sidebar, Menu, MenuItem, MenuItemStyles, menuClasses} from "react-pro-sidebar";
import { Box, Divider, Grid, IconButton, List, ListItem, Typography } from '@mui/material';
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { tokens } from '../theme';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import intelLogo from '../assets/intel-header-logo.svg';
import appLogo from '../assets/spider_logo.svg';
import styled from '@emotion/styled';
import LogoComp, { StyledIntelLogoImg } from "../CommonComponents/LogoComp";
import { useTheme } from "@mui/material/styles";
import { AspectRatio, BlurOn, GridGoldenratio, GridOnOutlined, HelpOutline, Layers, MemoryOutlined, PowerOutlined, TableRows, VerifiedUser, WebStoriesOutlined } from "@mui/icons-material";
import { Person } from "@microsoft/mgt-react";
import { RotatingLines, Triangle } from  'react-loader-spinner'
import { ActionSceneEnum, SPECIAL_RED_COLOR } from "../DataModels/Constants";
import { ProjectRelatedMenuItem } from "../DataModels/HelperModels";
import { useSpiderStore } from "../DataModels/ZuStore";




const AboutDiv = styled.div`
    margin-top: 2;
    display: flex;
    flex-direction:column;
    justify-contents: center; 
    align-items: center;
    align-content: center;
`
const ExtraInfoDiv = styled.div`
    flex-grow: 1;    
    flex-shrink: 1;
    display: flex;
    width: 100%;
    justify-contents: center; 
    align-items: center;
    align-content: center;
    flex-direction: column;     
    padding:10px; 
    margin-left: 1px;
    margin-right: 1px;  
`


interface SidebarLayoutProps {
    appName?: string, 
    appVersion?: string,
    onLogoClick: (event: any) => void
}


const SidebarLayout: React.FC<SidebarLayoutProps> = ({ appName, appVersion, onLogoClick }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const MENU_ITEM_HEIGHT = "33px" 

    const loggedInUser = useSpiderStore((state) => state.loggedInUser);
    const showMenu = useSpiderStore((state) => state.showMenu);
    const basicProjInfo = useSpiderStore((state) => state.basicProjInfo)
    const isMenuCollapsed = useSpiderStore((state) => state.isMenuCollapsed)
    const setIsMenuCollapsed = useSpiderStore((state) => state.setIsMenuCollapsed)
    const heightForSidebar = useSpiderStore((state) => state.heightForSidebar)
    const menuCurrentScene = useSpiderStore((state) => state.menuCurrentScene)
    const setMenuCurrentScene = useSpiderStore((state) => state.setMenuCurrentScene)
    const loadingSpinnerCtx = useSpiderStore((state) => state.loadingSpinnerCtx)
    
    let isUserLoggedIn = (loggedInUser && loggedInUser.email.length > 0  && loggedInUser.idsid.length > 0  && loggedInUser.wwid.length > 0) ? true : false;

    const projMenuItems : Array<ProjectRelatedMenuItem> = useMemo(() => (
        [
            {key: ActionSceneEnum.PROJECT, label: "Project Home", icon: <HomeOutlinedIcon />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.STACKUP, label: "Stackup", icon: <TableRows />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.LAYERGROUPS, label: "Layer Groups", icon: <Layers />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.DEFAULTCONSTRAINTS, label: "Default Constraints", icon: <GridGoldenratio />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.RULEAREAS, label: "Rule Areas", icon: <AspectRatio />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.NETS, label: "Nets", icon: <BlurOn />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.INTERFACES, label: "Interfaces", icon: <MemoryOutlined />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.C2CLAYOUT, label: "C2C (Clearances)", icon: <GridOnOutlined />, onProjSelectionOnly: true, disabled: false},
            {key: ActionSceneEnum.POWERINFO, label: "Power Info", icon: <PowerOutlined />, onProjSelectionOnly: true, disabled: false},
            
            {key: ActionSceneEnum.VALIDATIONS, label: "Validations", icon: <VerifiedUser />, onProjSelectionOnly: true, disabled: true},
            {key: ActionSceneEnum.LOGS, label: "Logs", icon: <WebStoriesOutlined />, onProjSelectionOnly: true, disabled: true},
            {key: ActionSceneEnum.FAQS, label: "FAQ", icon: <HelpOutline />, onProjSelectionOnly: false, disabled: true}
        ]
    ), []); 

    // let menuItemsToDisplay = displayProjRelatedMenuItems ? projMenuItems : projMenuItems.filter(a => a.onProjSelectionOnly === false);
    let menuItemsToDisplay = showMenu ? projMenuItems : projMenuItems.filter(a => a.onProjSelectionOnly === false);

    const menuItemStyles: MenuItemStyles = useMemo(() => ({
        root: {
          fontSize: '13px',
          fontWeight: 400,
          height: 40
        },
        icon: {
          color: colors.greenAccent[400],
        },
        SubMenuExpandIcon: {
          color: '#b6b7b9',
        },
        subMenuContent: {
          backgroundColor: colors.greenAccent[400],
        },
        button: {
            height: MENU_ITEM_HEIGHT,
            [`&.${menuClasses.active}`]: {
            backgroundColor: colors.greenAccent[400],
            color: colors.primary[400],
          },
          [`&.${menuClasses.disabled}`]: {
            color: colors.grey[400],
          },
          '&:hover': {
            backgroundColor: colors.primary[500],
            color: colors.blueAccent[100],
          },
        }
      } ), []); 

    
    const toolInfo = useMemo(() => (
        <Box sx={{ backgroundColor: colors.greenAccent[800] }}>
            <ExtraInfoDiv style={{ color: "white" }}>
                <StyledIntelLogoImg src={intelLogo} alt="intel-logo"></StyledIntelLogoImg>
                <Typography sx={{mt: 1}} variant="caption">
                    Design Tools
                </Typography>
                <Typography variant="caption">
                    {`${new Date().getFullYear()} © Intel Corporation.`}
                </Typography>
                <AboutDiv>
                    <Box alignContent="center">
                        <span style={{ color: SPECIAL_RED_COLOR, fontSize: 13, fontFamily: 'Courier' }}>Intel Confidential</span>
                    </Box>
                    <Box alignContent="center">
                        <span>
                            <span style={{ color: colors.grey[100], fontSize: 11 }}>Version: </span>
                            <span style={{ color: colors.grey[100], fontSize: 11 }}>{appVersion}</span> 
                            <span>&nbsp;&nbsp;</span>
                            <span style={{ color: colors.grey[100], fontSize: 11 }}> | </span>
                            <span>&nbsp;&nbsp;</span>
                            <span style={{ color: colors.grey[100], fontSize: 10 }}>{`${import.meta.env.VITE_STAGE?.toString()?.toUpperCase() || ""}`}</span>
                        </span>
                    </Box>
                </AboutDiv>
            </ExtraInfoDiv>
        </Box>
    ), []); 


    //project Name section
    let getProjectNameDisplay = () => {
        if(showMenu) {
            let name = basicProjInfo?.name
            if(name && name.length > 0){
                return (
                    <Box textAlign="center">
                        <Typography 
                            sx={{ color: SPECIAL_RED_COLOR, //colors.greenAccent[400]
                            fontSize: (name.length <= 20) ? 14 : 10.5 }}>
                            {name ?? ''}
                        </Typography>
                    </Box>
                )
            }
            else { return (<></>)}
        }
        else { return(<></>) }
    }

    

    return (
        <Box sx={{ flexDirection:'column', justifyContent:'space-between'}}>

            <Sidebar
                backgroundColor={colors.primary[400]} 
                collapsed={isMenuCollapsed}
                width="198px"
                collapsedWidth="80px"
                rootStyles={{ 
                    border: 0, 
                    minHeight: 600,
                    height: typeof(heightForSidebar) === 'number' && (heightForSidebar as number) > 0 
                        ? heightForSidebar
                        : isMenuCollapsed // ["99vh" : "85vh"]  or [window.innerHeight-5 : window.innerHeight-138]
                            ? "99vh"
                            : "85.6vh"
                }}>

                <Menu menuItemStyles={menuItemStyles}>
                    
                    {/* Intel logo and Collapser */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" ml={isMenuCollapsed ? "18px" : "12px"}>
                        {!isMenuCollapsed && 
                            <LogoComp appName={appName} appVersion={appVersion} onLogoClick={onLogoClick} />
                        }
                        <IconButton onClick={() => {setIsMenuCollapsed(!isMenuCollapsed)}}>
                            <MenuOutlinedIcon />
                        </IconButton>
                        
                    </Box>


                    {/* Person Image and project name */}
                    {(isUserLoggedIn && !isMenuCollapsed) && (
                        <Box mb="10px" mt="5px">
                            <Box display="flex" justifyContent="center" alignItems="center">
                                <Person show-presence={true} avatarSize={'large'} personQuery={loggedInUser?.email}/> 
                            </Box>
                            <Divider sx={{mt: 1, mb: 1}} />
                            {getProjectNameDisplay()}
                        </Box>
                    )}

                    <Divider sx={{}} />
                    
                    {/* Main menu items */}
                    <Box paddingLeft={isMenuCollapsed ? undefined : "0%"} >
                        {
                            menuItemsToDisplay.map((menuItem: ProjectRelatedMenuItem, index: number) => (
                                <MenuItem
                                    disabled={menuItem.disabled} 
                                    key={`menuItem-${menuItem.key}-${index}`}
                                    component={
                                        <Link 
                                            to={menuItem.onProjSelectionOnly 
                                                ? `/${menuItem.key}/${basicProjInfo?.id ?? ''}${menuItem.subPath ? '/' + menuItem.subPath : ''}`
                                                : `/${menuItem.key}`
                                            } 
                                            onClick={() => {setMenuCurrentScene(menuItem.key)}}
                                        />
                                    } 
                                    icon={menuItem.icon} 
                                    rootStyles={{ backgroundColor: menuCurrentScene == menuItem.key ? colors.primary[600] : colors.primary[400], height: MENU_ITEM_HEIGHT }} >{`${menuItem.label}`}</MenuItem>
                                
                            ))
                        }
                        
                    </Box>
                </Menu>
                <Box sx={{ml: 2, mr: 2, mt: 3, display: 'flex', flexDirection:'column', alignItems : "center"}}>
                    <RotatingLines
                        strokeColor={colors.greenAccent[400]}
                        strokeWidth="5"
                        animationDuration="0.75"
                        width="96"
                        visible={loadingSpinnerCtx.enabled}
                    />
                </Box>
                {loadingSpinnerCtx.enabled && 
                    <Box sx={{overflowWrap: "break-word", m: 1}}>
                        <span
                            style={{ width: 55, color: colors.grey[100],
                            fontSize: (loadingSpinnerCtx.text.length <= 22) ? 14 : 11 }}>
                            {loadingSpinnerCtx.text}
                        </span>
                    </Box>
                }
            </Sidebar>
            
            {!isMenuCollapsed && (
                <Box>
                    {toolInfo}
                </Box>
            )}

        </Box>
        
    );
}


export default SidebarLayout;




// const StyledLogoImg = styled.img`
//     width: 50px;
//     height: 50px;
//     margin-right: 0px;
//     margin-left: 0px;
//     margin-top: 0px;
// `