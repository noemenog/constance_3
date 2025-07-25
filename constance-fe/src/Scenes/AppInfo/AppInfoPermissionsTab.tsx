import { Box, Button, Card, Divider, IconButton, Paper, Slide, Table, TableBody, TableCell } from "@mui/material"; 
import { TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { PeoplePicker } from "@microsoft/mgt-react";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppInfoPropertyCategoryEnum, SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { BasicProperty, LoadingSpinnerInfo, LoggedInUser, QuickStatus } from "../../DataModels/HelperModels";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import { DoneOutlined } from "@mui/icons-material";
import { useCStore } from "../../DataModels/ZuStore";
import { CDomainData, User } from "../../DataModels/HelperModels";
// import { getPreloadPermissions, updateProjectPermissions } from "../../BizLogicUtilities/Permissions";
import { AppInfo } from "../../DataModels/ServiceModels";
import { SpButton } from "../../CommonComponents/SimplePieces";




interface AppInfoPermissionsTabProps {
    
}


const AppInfoPermissionsTab: React.FC<AppInfoPermissionsTabProps> = ({  }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as CDomainData;
    const appInfo = domainData.appInfo as AppInfo;
    
    
    const placePageTitle = useCStore((state) => state.placePageTitle);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const loggedInUser = useCStore((state) => state.loggedInUser);

    const [roleUsers, setRoleUsers] = useState<Map<string, User[]>>(new Map<string, User[]>())
    
    const roleIdToRoleNameMapping = useRef<Map<string, string>>(new Map<string, string>());

    const containerRef = useRef<any>();



    useEffect(() => {
        placePageTitle("AppPermissions")
    }, []);

    
    // useEffect(() => {
    //     let permissionRoles : BasicProperty[] = appInfo?.associatedProperties?.find(a => (
    //         a.category === AppInfoPropertyCategoryEnum.PERMISSION_ROLES && a.name === AppInfoPropertyCategoryEnum.PERMISSION_ROLES))?.value
        
    //     if(permissionRoles && permissionRoles.length > 0) {
    //         setLoadingSpinnerCtx({enabled: true, text: "Retrieving roles and permission assignments for current appInfo. Please wait..."} as LoadingSpinnerInfo)
    //         permissionRoles?.forEach(x => roleIdToRoleNameMapping.current.set(x.id, x.name))  //Important!
    //         getPreloadPermissions(appInfo._id?.toString() as string, permissionRoles).then((usersPerRoleMapping: Map<string, User[]>) => {
    //             setRoleUsers(usersPerRoleMapping)
    //         })
    //         .finally(() => { 
    //             cancelLoadingSpinnerCtx() 
    //         })  
    //     }
    // }, []);


    // function onMemeberSelectionChanged(e: any, roleId: string) : void {
    //     if(e && e.detail && e.detail.length > 0) {
    //         let newMap = new Map<string, User[]>(roleUsers);
    //         let userSet = new Array<User>()
    //         for(let item of e.detail) {
    //             let user: User = { id: item.id, idsid: '', email: item.userPrincipalName, wwid: item.jobTitle };
    //             userSet.push(user)
    //         } 
    //         for(let [key, value] of newMap) {
    //             if(key.trim().toLowerCase() === roleId.trim().toLowerCase()) {
    //                 newMap.set(key, userSet);
    //                 break;
    //             }
    //         }   
    //         setRoleUsers(newMap);
    //     }
    // }
    


    // async function performPermissionsUpdate(): Promise<void> {
    //     setLoadingSpinnerCtx({enabled: true, text: "Now updating project roles and permission assignments. Please wait..."} as LoadingSpinnerInfo)
    //     let permActionResult : QuickStatus<any> = await updateProjectPermissions(loggedInUser as LoggedInUser, appInfo, roleUsers).finally(() => { cancelLoadingSpinnerCtx() })
    //     if(permActionResult.isSuccessful === false) {
    //         displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
    //     }
    //     else {
    //         displayQuickMessage(UIMessageType.SUCCESS_MSG, `Update operation for project roles and permissions has completed.`);
    //     }
    // }




    return (
        <Box>
            {appInfo && <Box sx={{ mt: 2.5}}>
                {/* <Box display="flex" flexDirection="row" gap={5}>
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
                            Permission changes may require approval by a designated approver (project creator or app admin). Approvals in AGS might not reflect here imidiately. Please be patient.
                        </Typography>
                        <Slide timeout={{ enter: 800, exit: 400 }} direction="down" in={true} container={containerRef.current}>
                            <Divider sx={{ width: "90%" }} />
                        </Slide>
                    </Box>
                </Box>

                <Divider sx={{mt: 1, mb: 1 }} />

                <Box height="78vh">
                    <TableContainer component={Card} sx={{ mt: 2 }}>
                        <Table key={`perm-table-1`} id={`perm-table-id-1`}>

                            <TableHead key={`tablehead-1`} >
                                
                                <TableRow>
                                    <TableCell  width={"26%"} sx={{ backgroundColor: SPECIAL_QUARTZ_COLOR, fontSize: 14 }}>Project Role</TableCell>
                                    <TableCell sx={{ backgroundColor: SPECIAL_QUARTZ_COLOR, fontSize: 14 }}>Project Permissions</TableCell>  
                                </TableRow>
                                
                            </TableHead>
                        </Table>
                        <Box height="69vh" sx={{overflowY: "scroll"}}>
                            {(roleIdToRoleNameMapping && roleIdToRoleNameMapping.current && roleUsers && roleUsers.size > 0)
                                ? <Table>
                                    <TableBody>
                                        {
                                            [...roleUsers.keys()].map((roleId: string, index: any) => (
                                                <TableRow key={`perm-tab-row-${index}`} sx={{ backgroundColor: colors.primary[400] }}>
                                                    <TableCell size="small" width={"24%"} height={60} sx={{ fontSize: 13, borderBottom: 0, borderRight: 0}}>
                                                        {roleIdToRoleNameMapping.current.get(roleId) || ''}
                                                    </TableCell>
                                                    <TableCell size="small" sx={{ borderBottom: 0 }}>
                                                        <PeoplePicker
                                                            className="people-picker"
                                                            id={`people-picker-input-${index}`} 
                                                            key={`people-picker-input-key-${index}`}
                                                            placeholder='members'
                                                            showMax={10}
                                                            disableImages={false}
                                                            selectionChanged={(e : any) => onMemeberSelectionChanged(e, roleId)}
                                                            defaultSelectedUserIds={roleUsers.get(roleId)?.map((a: User) => a.email) ?? []} //pre-populate with array of email addresses
                                                        />
                                                    </TableCell>  
                                                </TableRow>
                                            ))
                                        }
                                        
                                    </TableBody>
                                    
                                 </Table>
                                : <Typography variant="h4" noWrap component="div" sx={{ mt: 20, ml: 2, color: colors.grey[400], fontStyle: "italic"}}>
                                    {`No permission roles configured...`}
                                </Typography>
                            }
                        </Box>
                    </TableContainer>
                </Box> */}
            </Box>}
        </Box>
    )

}

export default AppInfoPermissionsTab






















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
