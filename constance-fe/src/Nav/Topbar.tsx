import {Alert, AlertColor, Box, Divider, IconButton, Snackbar, Typography, useTheme } from "@mui/material";
import { useContext, useEffect, useMemo } from "react";
import { ColorModeContext, tokens } from "../theme";
import InputBase from "@mui/material/InputBase";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import React from "react";
import { SnackBarData, LoggedInUser, LoadingSpinnerInfo } from "../DataModels/ServiceModels";
import { Login } from '@microsoft/mgt-react';
import { Providers, ProviderState } from "@microsoft/mgt-element";
import { AGS_APP_ACCESS_ENTITLEMENT, AGS_APP_NAME, ActionSceneEnum, CONFIGITEM__Init_Display_Message, UIMessageType } from "../DataModels/Constants";
import { IMsalContext, useIsAuthenticated, useMsal } from '@azure/msal-react';
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import intelLogo from '../assets/intel-header-logo.svg';
import LogoComp from "../CommonComponents/LogoComp";
import { useCStore } from "../DataModels/ZuStore";
import { getPermissionEntitlementsForCurrentUser } from "../BizLogicUtilities/FetchData";
import { loadAWGStatusForLoggedInUser, loadEntitlementsForLoggedInUser } from "../BizLogicUtilities/Permissions";
import { isResolutionWorseThan1080p } from "../BizLogicUtilities/UtilFunctions";




const SNACKBAR_DEFAULT_TIMEOUT = 5000;


interface TopBarProps {
    appName?: string, 
    appVersion?: string,
    onLoginSuccessful: (user: LoggedInUser) => Promise<void>
    onForcedLogout: () => Promise<void>,
    onLogoClick: (event: any) => void
}


const TopBar: React.FC<TopBarProps> = ({ appName, appVersion, onLoginSuccessful, onForcedLogout, onLogoClick }) => {
    
    const theme : any = useTheme();
    const colors : any = tokens(theme.palette.mode);
    const colorMode : any = useContext(ColorModeContext);
    const navigate = useNavigate();

    const [openSnackBarAlert, setOpenSnackBarAlert] = React.useState(false);
    const [snackBarMsg, setSnackBarMsg] = React.useState('');
    const [snackBarMsgTypeIndicator, setSnackBarMsgTypeIndicator] = React.useState('info');
    const [snackBarTimeout, setSnackBarTimeout] = React.useState<number>(SNACKBAR_DEFAULT_TIMEOUT);

    const msalContext : IMsalContext = useMsal();

    const{ appId } = useParams()

    //zustand impl
    const setLoggedInUser = useCStore((state) => state.setLoggedInUser);
    const setDisplayQuickMessage = useCStore((state) => state.setDisplayQuickMessage)
    const isMenuCollapsed = useCStore((state) => state.isMenuCollapsed)
    const clearCurrentAppInfo = useCStore((state) => state.clearCurrentAppInfo);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);

    
    useMemo(() => {
        setDisplayQuickMessage(displaySnackBarMessage)
    }, [appName]);
    
    
    const handleLoginEvent = async (e: any) => {
        try {
            const userDetails = await Providers.globalProvider.graph.api("/me/").version("beta").get();
            if (userDetails && Providers.globalProvider.state === ProviderState.SignedIn) {
                let user : LoggedInUser = {
                    id: userDetails.id,
                    email: userDetails.mail,
                    wwid: userDetails.employeeId ?? userDetails.jobTitle,
                    idsid: userDetails.mailNickname ?? userDetails.onPremisesSamAccountName,
                    givenName: userDetails.givenName,
                    surname: userDetails.surname,
                    perms: new Map<string, string>(),
                }

                setLoadingSpinnerCtx({enabled: true, text: "Getting permissions for current user. Please wait..."} as LoadingSpinnerInfo)
                user = await loadEntitlementsForLoggedInUser(user).finally(() => { cancelLoadingSpinnerCtx() });
                
                if(user.perms && user.perms.size > 0 && user.perms.has(AGS_APP_ACCESS_ENTITLEMENT)) {   
                    //This handles scenario where user paste a specific URL to drop to certain page of a project
                    setLoadingSpinnerCtx({enabled: true, text: "Retrieving permissions from AGS system. Please wait...."} as LoadingSpinnerInfo)
                    loadAWGStatusForLoggedInUser(user as LoggedInUser, appId || '').then((awgCheckUser: LoggedInUser) => {
                        user = awgCheckUser;
                    }).finally(() => { 
                        // setLoggedInUser(user); //Important!
                        if(onLoginSuccessful){
                            onLoginSuccessful(user)
                        }
                        cancelLoadingSpinnerCtx() 
                    })

                    displaySnackBarMessage(UIMessageType.SUCCESS_MSG, `User signed in successfully. Welcome ${user.givenName} !`); 
                    
                    //check resolution
                    if (isResolutionWorseThan1080p()) {
                        displaySnackBarMessage(UIMessageType.ERROR_MSG, `Display resolution is worse than the not-recommended bare minimum of 1080P. `
                            + `${AGS_APP_NAME} was not built for this level of low-res. The year is [${new Date().getFullYear()}]. Do the needful!`, 7000); 
                    }
                    
                    setTimeout(() => {
                        const store = useCStore.getState();  //need to use this strategy here!
                        let initMsg = store.initConfigs?.find(a => a.name === CONFIGITEM__Init_Display_Message)?.value
                        if(initMsg && initMsg.messageType && initMsg.message && initMsg.message.length > 0) {
                            let time = ((initMsg.msTime && initMsg.msTime !== 0) ? initMsg.msTime : 6000)
                            if (initMsg.messageType === UIMessageType.INFO_MSG) { displaySnackBarMessage(UIMessageType.INFO_MSG, initMsg.message, time); }
                            else if(initMsg.messageType === UIMessageType.WARN_MSG) { displaySnackBarMessage(UIMessageType.WARN_MSG, initMsg.message, time); }
                            else if(initMsg.messageType === UIMessageType.ERROR_MSG) { displaySnackBarMessage(UIMessageType.ERROR_MSG, initMsg.message, time); }
                            else if(initMsg.messageType === UIMessageType.SUCCESS_MSG) { displaySnackBarMessage(UIMessageType.SUCCESS_MSG, initMsg.message, time); }
                        }
                    }, 7000); 
                }
                else {
                    displaySnackBarMessage(UIMessageType.ERROR_MSG, "User does not have access. Please apply for access via AGS", 7000);
                    
                    //This is not the right way to do this.... temp solution for now until proper solution is found
                    Providers.globalProvider.setState(ProviderState.SignedOut);
                    
                    if(onForcedLogout){
                        onForcedLogout();
                    }

                    //Not working....
                    // msalContext.instance.logout().then(() => {
                    //     if(onForcedLogout){ onForcedLogout(); }
                    //     displaySnackBarMessage(UIMessageType.ERROR_MSG, "User does not have access");
                    // });    
                }
            }
        }
        catch (error: any) {
          displaySnackBarMessage(UIMessageType.ERROR_MSG, error.message);
        }
    };

    //TODO: this event is not firing due to mgt bug --- https://github.com/microsoftgraph/microsoft-graph-toolkit/issues/2951
    //TODO: make sure a fix is out, otherwise do a downgrade!!
    const handleLogoutEvent = async (e: any) => {
        if(onForcedLogout){
            onForcedLogout().then(() => {
                displaySnackBarMessage(UIMessageType.INFO_MSG, "User signed out");
            })
        }
    };


    function displaySnackBarMessage(type: UIMessageType, msg: string, timeout?: number) {
        if(type && msg && msg.trim().length > 0){
            setOpenSnackBarAlert(false);
            setSnackBarMsg(msg);
            setSnackBarTimeout(timeout ?? SNACKBAR_DEFAULT_TIMEOUT)
            setSnackBarMsgTypeIndicator(type.toLowerCase());
            setOpenSnackBarAlert(true);
            if(type === UIMessageType.ERROR_MSG) {
                console.error(msg)
            }
        }
    };

    const getSnackBarBackgroundColor = () => {
        if(snackBarMsgTypeIndicator === UIMessageType.SUCCESS_MSG.toString())
            return "lightgreen";
        else if(snackBarMsgTypeIndicator === UIMessageType.ERROR_MSG.toString())
            return "#e57373";
        else
            return "white";
    }

    const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenSnackBarAlert(false);
        setSnackBarTimeout(SNACKBAR_DEFAULT_TIMEOUT);
    };





    return (
        <>
            <Box alignItems='center' sx={{ minHeight:40, height:40, backgroundColor: colors.primary[400], display: "flex", justifyContent: "space-between"}}>
                <Box sx={{ display: "flex"}}>
                    {isMenuCollapsed && <LogoComp appName={appName} appVersion={appVersion} onLogoClick={onLogoClick}/>}
                </Box>
                
                <Snackbar 
                    transitionDuration={{ enter: 500, exit: 1500 }} 
                    open={openSnackBarAlert} 
                    autoHideDuration={snackBarTimeout} 
                    onClose={handleSnackbarClose} 
                    sx={{ mt: -2.5 }}
                    anchorOrigin={{ vertical: 'top', horizontal: "center" }}
                >
                    <Alert onClose={handleSnackbarClose} severity={snackBarMsgTypeIndicator as AlertColor} style={{ paddingTop: 0, paddingBottom: 0, color: "black", backgroundColor: getSnackBarBackgroundColor()}}>
                        {snackBarMsg}
                    </Alert>
                </Snackbar>
                
                {/* Icons */}
                <Box display="flex">
                    <IconButton disabled onClick={colorMode.toggleColorMode}>
                        {theme.palette.mode === 'dark' ? (<DarkModeOutlined />) : (<LightModeOutlinedIcon />)}
                    </IconButton>
                    <IconButton disabled onClick={() => { /* do nothing for now */}}>
                        <HelpOutlineOutlinedIcon />
                    </IconButton>
                    <IconButton>
                        <NotificationsNoneOutlinedIcon />
                    </IconButton>
                    <Box sx={{ mt: .4, mr: 1}} >
                        <Login className="login" show-presence={true} logoutCompleted={(e: any) => handleLogoutEvent(e)}  loginCompleted={(e: any) => handleLoginEvent(e)} loginView='compact'/>
                    </Box>
                </Box>
            </Box>
            <Divider />
        </>
    );
}

export default TopBar;










