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
import { LoggedInUser, User } from './DataModels/ServiceModels';
import AsciiTextComp from './CommonComponents/AsciiText';
import { ColorRing, RotatingLines } from 'react-loader-spinner';
import { EnvTypeEnum, SPECIAL_BLUE_COLOR, SPECIAL_QUARTZ_COLOR } from './DataModels/Constants';
import { rfdcCopy } from './BizLogicUtilities/UtilFunctions';
import { getApproverWGName } from './BizLogicUtilities/Permissions';




/*
TODO: 
    permissions
    

*/



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
            navigate(`/list`)
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
            navigate(`/list`)
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










//========================================================================================================
//======================================================================================================== 
// Test endpoint: GET http://localhost:7000/api/v3/test/monaco-validator
// async function executeTest(){
//     try {
//         console.log('🧪 Starting Monaco Validator API Test...');
        
//         const validator = new HeadlessMonacoValidator();
//         await validator.initialize();
        
//         // Test cases with good and bad code for multiple languages
//         const testCases = {
//             // PYTHON TESTS
//             'python-good.py': {
//                 code: `def calculate_fibonacci(n):
//     """Calculate fibonacci number recursively."""
//     if n <= 1:
//         return n
//     return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

// # Test the function
// result = calculate_fibonacci(10)
// print(f"Fibonacci(10) = {result}")`,
//                 language: 'python'
//             },
            
//             'python-bad.py': {
//                 code: `def broken_function(
//     # Missing closing parenthesis and colon
//     if x = 5:  # Should be == not =
//         return x * 2
//     else
//         return x + 1  # Missing colon after else
        
// # Invalid indentation
// print("This is wrong indentation")`,
//                 language: 'python'
//             },
            
//             // JAVASCRIPT TESTS
//             'javascript-good.js': {
//                 code: `class Calculator {
//     constructor() {
//         this.history = [];
//     }
    
//     add(a, b) {
//         const result = a + b;
//         this.history.push(\`\${a} + \${b} = \${result}\`);
//         return result;
//     }
// }

// const calc = new Calculator();
// console.log(calc.add(5, 3));`,
//                 language: 'javascript'
//             },
            
//             'javascript-bad.js': {
//                 code: `class BrokenCalculator {
//     constructor( {
//         this.history = [];  // Missing closing parenthesis
//     }
    
//     add(a, b) {
//         const result = a +;  // Missing operand
//         return result
//     }  // Missing semicolon
// }`,
//                 language: 'javascript'
//             },
            
//             // JSON TESTS
//             'json-good.json': {
//                 code: `{
//     "name": "Test Config",
//     "version": "1.0.0",
//     "settings": {
//         "enabled": true,
//         "maxRetries": 3,
//         "timeout": 5000
//     }
// }`,
//                 language: 'json'
//             },
            
//             'json-bad.json': {
//                 code: `{
//     "name": "Test Config",
//     "version": "1.0.0",
//     "settings": {
//         "enabled": true,
//         "maxRetries": 3,
//         "timeout": 5000,  // Comments not allowed in JSON
//     }  // Trailing comma not allowed
// }`,
//                 language: 'json'
//             },
            
//             // SQL TESTS
//             'sql-good.sql': {
//                 code: `CREATE TABLE users (
//     id SERIAL PRIMARY KEY,
//     username VARCHAR(50) UNIQUE NOT NULL,
//     email VARCHAR(100) UNIQUE NOT NULL,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// INSERT INTO users (username, email) 
// VALUES ('johndoe', 'john@example.com');

// SELECT * FROM users WHERE created_at > '2024-01-01';`,
//                 language: 'sql'
//             },
            
//             'sql-bad.sql': {
//                 code: `CREATE TABLE users (
//     id SERIAL PRIMARY KEY,
//     username VARCHAR(50) UNIQUE NOT NULL,
//     email VARCHAR(100) UNIQUE NOT NULL,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Trailing comma
// );

// -- Missing VALUES keyword
// INSERT INTO users (username, email) 
//     ('johndoe', 'john@example.com');`,
//                 language: 'sql'
//             }
//         };
        
//         console.log('🔍 Running validation tests...');
        
//         // Convert test cases to Map format
//         const testCaseMap = new Map();
//         Object.entries(testCases).forEach(([filename, data]) => {
//             testCaseMap.set(filename, data);
//         });
        
//         // Run validation
//         const results = await validator.validate(testCaseMap);
        
//         // Process results
//         let passCount = 0;
//         let failCount = 0;
//         const testResults = [];
        
//         for (const [filename, result] of results.entries()) {
//             const isGoodCode = filename.includes('-good.');
//             const isBadCode = filename.includes('-bad.');
//             const language = filename.split('.').pop();
            
//             let testPassed = false;
//             let status = '';
            
//             if (isGoodCode && result.isValid) {
//                 status = 'PASS - Good code correctly validated';
//                 testPassed = true;
//                 passCount++;
//             } else if (isBadCode && !result.isValid) {
//                 status = 'PASS - Bad code correctly detected';
//                 testPassed = true;
//                 passCount++;
//             } else if (isGoodCode && !result.isValid) {
//                 status = 'FAIL - Good code incorrectly flagged as invalid';
//                 failCount++;
//             } else if (isBadCode && result.isValid) {
//                 status = 'FAIL - Bad code incorrectly validated as good';
//                 failCount++;
//             }
            
//             testResults.push({
//                 filename,
//                 language: language?.toUpperCase(),
//                 isValid: result.isValid,
//                 errorCount: result.errors.length,
//                 warningCount: result.warnings.length,
//                 status,
//                 passed: testPassed,
//                 errors: result.errors.slice(0, 3).map((error: any) => ({
//                     line: error.line,
//                     message: error.message
//                 }))
//             });
//         }
        
//         // Clean up
//         validator.dispose();
        
//         const summary = {
//             totalTests: passCount + failCount,
//             passed: passCount,
//             failed: failCount,
//             successRate: ((passCount / (passCount + failCount)) * 100).toFixed(1) + '%'
//         };
        
//         console.log(`✅ Monaco Validator Test completed: ${summary.successRate} success rate`);
        
//         console.log({
//             payload: {
//                 summary,
//                 testResults,
//                 message: passCount === (passCount + failCount) 
//                     ? "🎉 ALL TESTS PASSED! Monaco validator is working perfectly!" 
//                     : "⚠️ Some tests failed. Monaco validator may need refinement."
//             }
//         });
        
//     } catch (e: any) {
//         console.error('❌ Monaco validator test failed:', e);
//     }
// }