import { Box, Button, Card, Divider, IconButton, Paper, Slide, Table, TableBody, TableCell } from "@mui/material"; 
import { TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { PeoplePicker } from "@microsoft/mgt-react";
import React, { Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { EnvTypeEnum, PERM_ROLES_RELATED_DATA_MAP, PermRolesEnum, SPECIAL_BLUE_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, SPECIAL_GOLD_COLOR, SPECIAL_PUPRLE_COLOR, SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { BasicProperty, Bucket, LoadingSpinnerInfo, LoggedInUser, QuickStatus } from "../../DataModels/ServiceModels";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import { DoneOutlined } from "@mui/icons-material";
import { useCStore } from "../../DataModels/ZuStore";
import { CDomainData, User } from "../../DataModels/ServiceModels";
import { AppInfo } from "../../DataModels/ServiceModels";
import { SpButton } from "../../CommonComponents/SimplePieces";
import { getEnviList, getRoleForEnv, rfdcCopy } from "../../BizLogicUtilities/UtilFunctions";
import { getPreloadPermissions, updateOwnerElementPermissions } from "../../BizLogicUtilities/Permissions";




interface AppInfoPermissionsTabProps {
    
}


const AppInfoPermissionsTab: React.FC<AppInfoPermissionsTabProps> = ({  }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as CDomainData;
    const buckets = domainData.bucketList;
    const appObj = domainData.appInfo as AppInfo;
    
    
    const placePageTitle = useCStore((state) => state.placePageTitle);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const loggedInUser = useCStore((state) => state.loggedInUser);

    const [appInfo, setAppInfo] = useState<AppInfo>(appObj);
    const [bucketList, setBucketList] = useState<Bucket[]>(buckets);

    const [roleUsers, setRoleUsers] = useState<Map<string, Map<PermRolesEnum, User[]>>>(new Map())

    const containerRef = useRef<any>();


    useEffect(() => {
        placePageTitle("AppPermissions")
    }, []);

    
    useEffect(() => {
        setLoadingSpinnerCtx({enabled: true, text: "Retrieving roles and permission assignments for current appInfo. Please wait..."} as LoadingSpinnerInfo)
        getPreloadPermissions(appInfo._id?.toString() as string, bucketList).then((usersPerRoleMapping: Map<string, Map<PermRolesEnum, User[]>>) => {
            setRoleUsers(usersPerRoleMapping)
        })
        .finally(() => { 
            cancelLoadingSpinnerCtx() 
        })
    }, []);


    const permRolesDisplayTextMap = useMemo(() => {
        let map = new Map<PermRolesEnum, string>();
        for(let [role, data] of PERM_ROLES_RELATED_DATA_MAP) {
            map.set(role, data[0]);
        }
        return map;
    }, []);


    function onMemeberSelectionChanged(selectedPeople: Array<any>, ownerElementId: string, permRole: PermRolesEnum) : void {
        if(selectedPeople && selectedPeople.length > 0) {
            let newMap = rfdcCopy<Map<string, Map<PermRolesEnum, User[]>>>(roleUsers) as Map<string, Map<PermRolesEnum, User[]>>;
            let userSet = new Array<User>()
            for(let item of selectedPeople) {
                let user: User = { id: item.id, idsid: '', email: item.userPrincipalName, wwid: item.jobTitle };
                userSet.push(user)
            } 
            let iterMap = newMap.get(ownerElementId) ?? new Map<PermRolesEnum, User[]>();
            for(let [role, userList] of iterMap) {
                if(role === permRole) {
                    newMap.get(ownerElementId)?.set(role, userSet);
                    break;
                }
            }   
            setRoleUsers(newMap);
        }
    }
    


    async function performPermissionsUpdate(): Promise<void> {
        setLoadingSpinnerCtx({enabled: true, text: "Now updating app/bucket roles and permission assignments. Please wait..."} as LoadingSpinnerInfo)
        let permActionResult : QuickStatus<any> = await updateOwnerElementPermissions(loggedInUser as LoggedInUser, appInfo, roleUsers).finally(() => { cancelLoadingSpinnerCtx() })
        if(permActionResult.isSuccessful === false) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
        }
        else {
            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Update operation for project roles and permissions has completed.`);
        }
    }



    function getExistingMembers(role: PermRolesEnum|null, ownerElementId: string): string[] {
        let userEntities: User[] = roleUsers.get(ownerElementId)?.get(role as PermRolesEnum) ?? []
        let res = userEntities.map((a: User) => a.email) ?? []
        return res;
    }



    

    return (
        <Box sx={{mt: 2, display: "flex", flexDirection:"column" }}>
            <Box display="flex" flexDirection="row" gap={5}>
                <SpButton
                    onClick={performPermissionsUpdate}
                    key={`perms-button-1`}
                    startIcon={<DoneOutlined />}
                    sx={{ width:250 }}
                    label="Save" />
                <Divider orientation="vertical" sx={{height: 30 }} />
                <Box display="flex" flexDirection={"column"} alignItems={"center"} justifyContent="center" sx={{ mb: 0, mt: 0  }}>
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{ width: "90%" }} />
                    </Slide>
                    <Typography sx={{ fontSize: 13, fontStyle: "italic", color: SPECIAL_RED_COLOR }}>
                        Permission changes may require approval by a designated approver (app instance creator/admin). Approvals in AGS might not reflect here immediately. Please be patient.
                    </Typography>
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{ width: "90%" }} />
                    </Slide>
                </Box>
            </Box>

            <Divider sx={{mt: 1, mb: 1 }} />
            <Box sx={{ display: "flex", flexDirection:"column", justifyContent: "center", alignItems:"center", minWidth: 600, width: "98.5%"}}>
                <Typography sx={{ mr: 1, fontSize: 13, fontWeight: "normal" }}>{`App-Level Permissions`}</Typography>
                <TableContainer component={Paper} sx={{ m: 1, backgroundColor: colors.primary[400] }}>
                    <Table sx={{border: 1, borderStyle: "dotted", borderColor: SPECIAL_BLUE_COLOR, minWidth: 600 }}>
                        <TableBody sx={{fontSize: 11}}>
                            <TableRow key={`tr-admin`} sx={{ borderBottom: 0}}> 
                                <TableCell size="small" width={"24%"} height={50} sx={{ fontSize: 13, borderBottom: 0, borderRight: 0}}>
                                    <Typography sx={{padding: 0, mr: 2, fontSize: 13 }}>{permRolesDisplayTextMap.get(PermRolesEnum.APP_ADMIN)}</Typography>
                                </TableCell>
                                <TableCell size="small" sx={{ borderBottom: 0 }}>
                                    <PeoplePicker
                                        className="people-picker"
                                        id={`admin-people-picker-input-0`} 
                                        key={`admin-people-picker-input-key-0`}
                                        placeholder='members'
                                        showMax={10}
                                        disableImages={false}
                                        selectionChanged={(event : any) => onMemeberSelectionChanged(event?.target?.selectedPeople, appInfo._id?.toString() as string, PermRolesEnum.APP_ADMIN)}
                                        defaultSelectedUserIds={getExistingMembers(PermRolesEnum.APP_ADMIN, appInfo._id?.toString() as string)} //pre-populate with array of email addresses
                                    >
                                    </PeoplePicker>
                                </TableCell>
                            </TableRow>

                            {
                                (getEnviList(appInfo)?.envListShortFormatArray ?? []).map((environment, index) => ( 
                                    <TableRow key={`tr-access-${index}`} sx={{ borderBottom: 0}}> 
                                        <TableCell size="small" width={"24%"} height={50} sx={{ fontSize: 13, borderBottom: 0, borderRight: 0}}>
                                            <Typography sx={{padding: 0, mr: 2, fontSize: 13 }}>{environment}&nbsp;&nbsp;Environment&nbsp;&nbsp;Access</Typography>
                                        </TableCell>
                                        <TableCell size="small" sx={{ borderBottom: 0 }}>
                                            <PeoplePicker
                                                className="people-picker"
                                                id={`app-people-picker-input-${index}`} 
                                                key={`app-people-picker-input-key-${index}`}
                                                placeholder='members'
                                                showMax={10}
                                                disableImages={false}
                                                selectionChanged={(event : any) => onMemeberSelectionChanged(event?.target?.selectedPeople, appInfo._id?.toString() as string, getRoleForEnv(environment) as PermRolesEnum)}
                                                defaultSelectedUserIds={getExistingMembers(getRoleForEnv(environment), appInfo._id?.toString() as string)}  //pre-populate with array of email addresses
                                            >
                                            </PeoplePicker>
                                        </TableCell>
                                    </TableRow>
                                ))
                            }                                                                    
                        </TableBody>

                    </Table>
                </TableContainer>
            </Box>
            
            <Box sx={{display: "flex", flexDirection:"column", mt: 3, minWidth: 600, width: "100%", height: "51vh"}}>
            {
                (bucketList && bucketList.length > 0) 
                ? (
                    <Box sx={{width: "100%"}}>
                        
                        <Box sx={{display: "flex", flexDirection:"column", justifyContent: "center", alignItems:"center", mt: 0, mb: 1, gap: 2}}>
                            <Divider sx={{ backgroundColor: SPECIAL_BLUE_COLOR, minWidth: 600, width: "100%" }} />
                            <Typography sx={{ fontSize: 13, fontWeight: "normal"}}>{`Bucket-Level Permissions`}</Typography>   
                        </Box>
                        
                        <Box sx={{display: "flex", flexDirection:"column", minWidth: 600, width: "100%", paddingRight: 3, overflowY: "auto"}}>
                        {

                            bucketList.map((bucket, index) => (
                                <Box key={`bxItemm-${index}`} sx={{ width: "100%" }}>
                                    <TableContainer component={Paper} sx={{ width: "100%", mt: 1, mb: 4 }}>
                                        <Table>
                                            <TableHead>
                                                <TableRow sx={{ backgroundColor: SPECIAL_QUARTZ_COLOR, borderTop: 0, borderBottom: 1 }}>
                                                    <TableCell size="small" colSpan={1} sx={{}}>
                                                        <Typography sx={{fontWeight: "normal"}}>
                                                            <span>
                                                                <span>
                                                                    {bucket.name}
                                                                </span>
                                                                <span style={{ fontFamily: "consolas", fontSize: 11, color: SPECIAL_GOLD_COLOR, marginLeft: 20 }}> 
                                                                    {`[${bucket._id?.toString()}]`}
                                                                </span>
                                                            </span>
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell size="small" colSpan={2} sx={{backgroundColor: colors.primary[600]}}>
                                                        <Typography sx={{fontWeight: "normal"}}>
                                                            <span>
                                                                
                                                            </span>
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow> 
                                            </TableHead>

                                            <TableBody>
                                                {
                                                    [PermRolesEnum.BUCKET_ADMIN, PermRolesEnum.BUCKET_READ_ONLY].map((role: any, index: any) => (
                                                        <TableRow key={`tr-access-${index}`} sx={{ backgroundColor: colors.primary[400]}}>
                                                            <TableCell size="small" width={"24%"} height={50} sx={{ paddingTop: 2, fontSize: 13, borderBottom: 0, borderRight: 0}}>
                                                                <Typography sx={{ mr: 2, fontSize: 13 }}>{permRolesDisplayTextMap.get(role)}</Typography>
                                                            </TableCell>
                                                            <TableCell size="small" sx={{ paddingTop: 2, borderBottom: 0 }}>
                                                                <PeoplePicker
                                                                    className="people-picker"
                                                                    id={`people-picker-input-${index}`} 
                                                                    key={`people-picker-input-key-${index}`}
                                                                    placeholder='members'
                                                                    showMax={10}
                                                                    disableImages={false}
                                                                    selectionChanged={(event : any) => onMemeberSelectionChanged(event?.target?.selectedPeople, bucket._id?.toString() as string, role)}
                                                                    defaultSelectedUserIds={getExistingMembers(role, bucket._id?.toString() as string)}
                                                                >
                                                                </PeoplePicker>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                }
                                                
                                            </TableBody>
                                            
                                        </Table>
                                    </TableContainer>
                                </Box>
                            ))
                           
                        }
                        </Box>
                    </Box>
                )
                : (
                    <>
                        <Typography sx={{padding: 0, mr: 2, fontSize: 13, fontStyle: "italic" }}>{`App has no buckets...`}</Typography>
                    </>
                )
            }
            </Box>
        </Box>
    )

}

export default AppInfoPermissionsTab

















// {
//                 (bucketList && bucketList.length > 0) 
//                 ? ( 
//                     <Box sx={{display: "flex", flexDirection:"column", justifyContent: "left", alignItems:"center", minWidth: 600, width: "100%", height: "53vh"}}>
//                         <Box display="flex" sx={{ mt: 2, mb: 2 }}>
//                             <Divider sx={{ backgroundColor: SPECIAL_BLUE_COLOR, minWidth: 600, width: "100%" }} />
//                         </Box>
                        
//                         <Typography sx={{ fontSize: 13, fontWeight: "normal" }}>{`Bucket Permissions`}</Typography>   
                        
//                         <Box sx={{display: "flex", flexDirection:"column", minWidth: 600, width: "88%", height: "53vh", paddingRight: 3, overflowY: "auto"}}>
//                         {

//                             bucketList.map((bucket, index) => (
//                                 <Box key={`bxItemm-${index}`} sx={{ width: "100%" }}>
//                                     <TableContainer component={Paper} sx={{ width: "100%", mt: 1, mb: 1, backgroundColor: colors.primary[500] }}>
//                                         <Table>
//                                             <TableHead>
//                                                 <TableRow sx={{ backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderTop: 1, borderBottom: 1,  }}>
//                                                     <TableCell size="small" colSpan={2} sx={{}}>
//                                                         <Typography sx={{fontWeight: "normal"}}>
//                                                             <span>
//                                                                 <span>
//                                                                     {bucket.name}
//                                                                 </span>
//                                                                 <span style={{ fontFamily: "consolas", fontSize: 11, color: SPECIAL_GOLD_COLOR, marginLeft: 20 }}> 
//                                                                     {`[${bucket._id?.toString()}]`}
//                                                                 </span>
//                                                             </span>
//                                                         </Typography>
//                                                     </TableCell>
//                                                 </TableRow> 
//                                             </TableHead>

//                                             <TableBody>
//                                                 {
//                                                     ["Bucket Admin", "Read Only"].map((category: any, index: any) => (
//                                                         <TableRow key={`tr-access-${index}`} sx={{ borderBottom: 0}}> 
//                                                             <TableCell size="small" width={"24%"} height={50} sx={{ fontSize: 13, borderBottom: 0, borderRight: 0}}>
//                                                                 <Typography sx={{padding: 0, mr: 2, fontSize: 13 }}>{`${category}`}</Typography>
//                                                             </TableCell>
//                                                             <TableCell size="small" sx={{ borderBottom: 0 }}>
//                                                                 <PeoplePicker
//                                                                     className="people-picker"
//                                                                     id={`people-picker-input-${index}`} 
//                                                                     key={`people-picker-input-key-${index}`}
//                                                                     placeholder='members'
//                                                                     showMax={10}
//                                                                     disableImages={false}
//                                                                     selectionChanged={(event : any) => onMemeberSelectionChanged(event?.target?.selectedPeople, category)}
//                                                                     //pre-populate with array of email addresses
//                                                                     defaultSelectedUserIds={getExistingMembers(category)}
//                                                                 >
//                                                                 </PeoplePicker>
//                                                             </TableCell>
//                                                         </TableRow>
//                                                     ))
//                                                 }
                                                
//                                             </TableBody>
                                            
//                                         </Table>
//                                     </TableContainer>
//                                 </Box>
//                             ))
                           
//                         }
//                         </Box>
//                     </Box>
//                 )
//                 : (
//                     <>
//                         <Typography sx={{padding: 0, mr: 2, fontSize: 13, fontStyle: "italic" }}>{`App has no buckets...`}</Typography>
//                     </>
//                 )
//             }


















// let permCtxConf : any = initConfigs.find(a => a.configName === CONFIGITEM__Permission_Context)?.configValue ?? undefined
        // if(permCtxConf && permCtxConf.roles && permCtxConf.roles.length > 0) {
        //     let ids = permCtxConf.roles.map((a: any) => a.id || '')
        //     try { verifyNaming(ids, NamingContentTypeEnum.PERMISSION_ROLE_ID) }
        //     catch(e: any){
        //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
        //         return;
        //     }




//===================================================================================

//  <SpButton
//     onClick={() => {}}
//     key={`perms-button-2`}
//     startIcon={<ClearAllOutlined />}
//     sx={{ width:250 }}
//     label="Clear All" /> 




    
    // useEffect(() => {
    //     setTimeout(() => {
    //         let sr = document.getElementById("people-picker-input-1")?.shadowRoot;
    //         let yy = sr?.querySelector('.outline')?.shadowRoot
    //         let zz = yy?.querySelector('.root')
    //         let gg = zz?.setAttribute('style', 'border-radius:44px');

    //         console.error(zz)
    //     }, 400);

    // }, []);
