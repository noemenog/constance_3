import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, Menu, MenuItem, MenuItemStyles, menuClasses} from "react-pro-sidebar";
import { Box, Divider, Grid, IconButton, List, ListItem, Typography } from '@mui/material';
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { tokens } from '../theme';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import intelLogo from '../assets/intel-header-logo.svg';
import styled from '@emotion/styled';
import LogoComp, { StyledIntelLogoImg } from "../CommonComponents/LogoComp";
import { useTheme } from "@mui/material/styles";
import { AspectRatio, BlurOn, CasesOutlined, GridGoldenratio, GridOnOutlined, HelpOutline, Layers, MemoryOutlined, PowerOutlined, SettingsApplicationsOutlined, TableRows, VerifiedUser, WebStoriesOutlined } from "@mui/icons-material";
import { Person } from "@microsoft/mgt-react";
import { RotatingLines, Triangle } from  'react-loader-spinner'
import { ActionSceneEnum, SPECIAL_RED_COLOR } from "../DataModels/Constants";
import { ProjectRelatedMenuItem } from "../DataModels/ServiceModels";
import { useCStore } from "../DataModels/ZuStore";




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

    const loggedInUser = useCStore((state) => state.loggedInUser);
    const showMenu = useCStore((state) => state.showMenu);
    const currentAppInfo = useCStore((state) => state.currentAppBasicInfo)
    const isMenuCollapsed = useCStore((state) => state.isMenuCollapsed)
    const setIsMenuCollapsed = useCStore((state) => state.setIsMenuCollapsed)
    const menuCurrentScene = useCStore((state) => state.menuCurrentScene)
    const setMenuCurrentScene = useCStore((state) => state.setMenuCurrentScene)
    const loadingSpinnerCtx = useCStore((state) => state.loadingSpinnerCtx)
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment)

    let isUserLoggedIn = (loggedInUser && loggedInUser.email.length > 0  && loggedInUser.idsid.length > 0  && loggedInUser.wwid.length > 0) ? true : false;

    const [height, setHeight] = useState(window.innerHeight);

    useEffect(() => {
        const handleResize = () => {
            setHeight(window.innerHeight);
        };

        window.addEventListener('resize', handleResize);

        // Cleanup listener on component unmount
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const projMenuItems : Array<ProjectRelatedMenuItem> = useMemo(() => (
        [
            {key: ActionSceneEnum.ROOT, label: "List All", icon: <HomeOutlinedIcon />, onProjSelectionOnly: false, disabled: false, envBased: false},
            {key: ActionSceneEnum.APPHOME, label: "App Home", icon: <CasesOutlined />, onProjSelectionOnly: true, disabled: false, envBased: false},
            {key: ActionSceneEnum.CONFIGURATIONS, label: "Configurations", icon: <SettingsApplicationsOutlined />, onProjSelectionOnly: true,  disabled: false, envBased: true},
            {key: ActionSceneEnum.LOGS, label: "Logs", icon: <WebStoriesOutlined />, onProjSelectionOnly: true, disabled: true, envBased: true}
        ]
    ), []); 

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
        <Box sx={{ backgroundColor: colors.blueAccent[400] }}>
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
            let name = currentAppInfo?.name
            if(name && name.length > 0){
                return (
                    <Box textAlign="center">
                        <Typography 
                            sx={{ color: SPECIAL_RED_COLOR,
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
        <Box sx={{ flexDirection:'column', justifyContent:'space-between'}} >

            <Sidebar
                className="appSidebar"
                backgroundColor={colors.primary[400]} 
                collapsed={isMenuCollapsed}
                width="188px"
                collapsedWidth="80px"
                rootStyles={{ 
                    border: 0, 
                    minHeight: 600,
                    height: isMenuCollapsed ? `${height}px` : `${height-130}px`
                }}>

                <Menu menuItemStyles={menuItemStyles}>
                    
                    {/* Intel logo and Collapser */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" ml={isMenuCollapsed ? "18px" : "2px"}>
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

                    <Divider sx={{mt: isMenuCollapsed ? 0.5 : 0}} />
                    
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
                                                // ? `/${menuItem.key}/${selectedEnvironment}/${currentAppInfo?._id ?? ''}${menuItem.subPath ? ('/' + menuItem.subPath) : ''}`
                                                ? `/${menuItem.key}/${currentAppInfo?.id ?? ''}/${menuItem.envBased ? (`${selectedEnvironment}/`) : ''}${menuItem.subPath ? ('/' + menuItem.subPath) : ''}`
                                                : `${(menuItem.key === ActionSceneEnum.ROOT) ? "/list" : ("/" + menuItem.key)}`
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



