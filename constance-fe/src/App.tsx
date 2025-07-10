import packageJson from '../package.json';
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { ColorModeContext, tokens, useMode } from "./theme";
import { Backdrop, Box, Button, CircularProgress, CssBaseline, Typography, useTheme } from "@mui/material";
import { Routes, Route, Outlet, useNavigate, useLocation, useNavigation, useParams } from 'react-router-dom';
import TopBar from "./Nav/Topbar";
import SidebarLayout from "./Nav/SidebarLayout";
import { ThemeProvider } from "@mui/material/styles";
import { MantineProvider } from "@mantine/core";
import PageTitle from "./CommonComponents/PageTitle";
import axios from 'axios';
import { useCStore } from './DataModels/ZuStore';
import { LoggedInUser, User } from './DataModels/HelperModels';
import AsciiTextComp from './CommonComponents/AsciiText';
import { ColorRing, RotatingLines } from 'react-loader-spinner';
import { EnvTypeEnum, SPECIAL_BLUE_COLOR, SPECIAL_QUARTZ_COLOR } from './DataModels/Constants';
import { rfdcCopy } from './BizLogicUtilities/UtilFunctions';
import { getApproverWGName } from './BizLogicUtilities/Permissions';





const APP_NAME = packageJson.name;
const APP_VERSION = packageJson.version;



function App() {
    const [theme, colorMode] = useMode();
    const navigate = useNavigate();
    const navigation = useNavigation()
    const location = useLocation();
    
    //Can still use the context even here
    const tm = useTheme();
    const colors = tokens(tm.palette.mode);
    
    //Can still use the context even here
    const loggedInUser = useCStore((state) => state.loggedInUser);
    
    const mainTitle = useCStore((state) => state.mainTitle)
    const mainSubtitle = useCStore((state) => state.mainSubtitle)
    const clearCurrentAppInfo = useCStore((state) => state.clearCurrentAppInfo)
    const isLoadingBackdropEnabled = useCStore((state) => state.isLoadingBackdropEnabled)
    const setLoggedInUser = useCStore((state) => state.setLoggedInUser);
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment)

    const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean>(false)
    


    function onLogoClick(event: any): void {
        clearCurrentAppInfo();
        if(isUserLoggedIn) {
            navigate(`/list/${selectedEnvironment ?? EnvTypeEnum.DEVELOPMENT}`)
        }
        else {
            navigate("/")
        }
    }


    async function onLoginOccured(user: LoggedInUser) {
        axios.interceptors.request.use(
            config => {
                //conversion and empty id are intentional. leave it that way!
                let modUsr : User = { id: '', email: user.email, idsid: user.idsid, wwid: user.wwid } 
                config.headers['user'] = JSON.stringify(modUsr);   
                return config;
            },
            error => {
                return Promise.reject(error);
            }
        );
        setLoggedInUser(user); //Important!
        setIsUserLoggedIn(true)
        if(location.pathname === "/") {
            navigate(`/list/${selectedEnvironment ?? EnvTypeEnum.DEVELOPMENT}`)
        }
    }


    async function onLogOutOccured() {
        clearCurrentAppInfo();
        setLoggedInUser(undefined);
        setIsUserLoggedIn(false);
        navigate('/')
    }


    const asciiContentCtx : {asciiInfo: any, mapKey: any} = useMemo(() => {
        let asciiInfo = new Map<string, number>([
          ['Standard', 10],
          ['Bigfig', 10],
          ['Block', 8],
          ['Doh', 4],
          ['Big Chief', 9],
          ['Broadway KB', 10],
          ['Cybermedium', 9],
          ['Dot Matrix', 5]
        ])

        let quickRand = Math.floor(Math.random() * asciiInfo.size);
        let mapKey = [...asciiInfo.keys()].at(quickRand) as any

        return {asciiInfo: asciiInfo, mapKey: mapKey}
    }, []);




    
    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {/* TODO:  figure out how to make exit buttons on dialogs show well on dark mode -- prev Value: theme?.palette?.mode ?? "light" */}
                <MantineProvider defaultColorScheme={"light"}>  
                    <div className="app">
                        <SidebarLayout appName={APP_NAME} appVersion={APP_VERSION} onLogoClick={onLogoClick}/>
                        
                        <main className="content">
                            <TopBar appName={APP_NAME} appVersion={APP_VERSION} onLoginSuccessful={onLoginOccured} 
                                onForcedLogout={onLogOutOccured} onLogoClick={onLogoClick}/>
                            <Box sx={{paddingLeft: 2, paddingRight: 2}}>
                                <PageTitle mainTitle={mainTitle} mainSubtitle={mainSubtitle} />
                                {
                                    isUserLoggedIn 
                                    ? <Box component="main" sx={{ flexGrow: 1, m: "2px 2px 2px 15px", width: { sm: `calc(100% - ${30}px)` } }}>
                                        {
                                          (navigation.state === "loading") 
                                          ? <Box sx={{ml: 2, mr: 2, mt: 33, display: 'flex', flexDirection:'column', alignItems : "center"}}>
                                                <Box sx={{ml: 2, mr: 2, mt: 1, display: 'flex', flexDirection:'column', alignItems : "center"}}>
                                                    <ColorRing
                                                        visible={true}
                                                        height="80"
                                                        width="80"
                                                        ariaLabel="color-ring-loading"
                                                        wrapperStyle={{}}
                                                        wrapperClass="color-ring-wrapper"
                                                        colors={[SPECIAL_BLUE_COLOR, SPECIAL_BLUE_COLOR, SPECIAL_BLUE_COLOR, SPECIAL_BLUE_COLOR, SPECIAL_BLUE_COLOR]}
                                                    />
                                                </Box>
                                                <Typography variant="h5" noWrap component="div" sx={{ mt: 3, ml: 2, color: colors.blueAccent[900], fontStyle: "italic"}}>
                                                    {`Loading...`}
                                                </Typography> 
                                            </Box>
                                          : <>
                                                <Outlet />
                                                <Backdrop sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })} open={isLoadingBackdropEnabled} onClick={() => {}} >
                                                    <CircularProgress size={100} sx={{ color: colors.greenAccent[400] }} />
                                                </Backdrop>
                                            </>
                                        }
                                      </Box>
                                    : <Box sx={{mt: 30, ml: 2, color: colors.blueAccent[900]}}>
                                        <AsciiTextComp 
                                            text={"Please login to continue..."} 
                                            font={asciiContentCtx.mapKey} 
                                            fontSize={asciiContentCtx.asciiInfo.get(asciiContentCtx.mapKey) as number}>
                                        </AsciiTextComp>
                                      </Box>
                                }
                            </Box>
                        </main>
                    </div>
                </MantineProvider>
            </ThemeProvider>
        </ColorModeContext.Provider>
    )
}

export default App;




