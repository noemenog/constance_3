import { Box, Button, Card, Divider, Grid, IconButton, Paper, Table, TableBody, TableCell } from "@mui/material"; 
import { TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import { BuildCircleOutlined, DeleteForeverOutlined, EditNoteOutlined } from "@mui/icons-material";
import { Interface, Project } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { LoggedInUser, PropertyItem } from "../../DataModels/HelperModels";
import { PermissionActionEnum, SPECIAL_EVEN_DEEPER_QUARTZ_COLOR } from "../../DataModels/Constants";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";



interface InterfaceOverviewTabProps {
    ifaceObj: Interface|null,
    project: Project,
    onEditInterfaceProperties: (iface: Interface) => void,
    onUpdateInterface: (event: any ) => void
    onDeleteInterface: (iface: Interface) => void
}


const InterfaceOverviewTab: React.FC<InterfaceOverviewTabProps> = ({ ifaceObj, project, onEditInterfaceProperties, onUpdateInterface, onDeleteInterface }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    
    const [ifaceDescriptionProp, setIfaceDescriptionProp] = useState<PropertyItem|null>(null);
    const [otherProperties, setOtherProperties] = useState<PropertyItem[]>([]);

    const [iface, setIface] = useState<Interface|null>(ifaceObj);

    useEffect(() => {
        placePageTitle("InterfaceOverview")
    }, []);


    useEffect(() => {
        let ifaceDescProp = iface?.associatedProperties.find(a => a.name.toLowerCase() === "description") ?? null
        let otherProps = iface?.associatedProperties.filter(a => a.name.toLowerCase() !== "description") ?? []

        setIfaceDescriptionProp(ifaceDescProp);
        setOtherProperties(otherProps)
    }, [iface]);


    function handleEditProps(event: any): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.EDIT_INTERFACE_PROPERTIES) === false) { return; }
        if(onEditInterfaceProperties) {
            onEditInterfaceProperties(iface as Interface)
        }
    }


    function handleDelete(event: any): void {
        if(loggedInUser.email.toLowerCase().trim() !== iface?.createdBy?.toLowerCase()?.trim()) {
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.DELETE_INTERFACE) === false) { 
                return; 
            }
        }
        
        if(onDeleteInterface) {
            onDeleteInterface(iface as Interface)
        }
    }





    return (
        <Box sx={{minWidth: 500}}>
            <Box 
                display="flex" 
                flexDirection="column" 
                sx={{ textAlign: "center", borderRadius: 5, m: 1, minWidth: 500, minHeight: 250, height: "24vh", backgroundColor: colors.primary[400] }}    
            >
                <Box gap={42}>
                    <Box sx={{ display: 'flex', mt: 1, minWidth: 500, height: 81, mb: 1}}>
                        <Card sx={{ textAlign: "center", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, width: "98%"}} raised>
                            <Divider sx={{ mt: 1, mb: 1}}/>
                            <Table sx={{ ml: 2 }}>
                                <TableBody>
                                    {/* give it transparent background  */}
                                    <TableRow key={`perm-tab-row-${33}`}> 
                                        <TableCell size="small" sx={{ minWidth: 175, width: 175, padding: 0, fontSize: 14, borderBottom: 0}}>
                                            <Typography sx={{ mr: 2}}>Actions :</Typography>
                                        </TableCell>
                                        <TableCell size="small" sx={{ padding: 0, fontSize: 13, borderBottom: 0}}>
                                            <Box display="flex" flexDirection="row" gap={1}>
                                                <Tooltip placement="top" title={`Update core interface info & settings`}>
                                                    <IconButton onClick={onUpdateInterface}>
                                                        <BuildCircleOutlined fontSize="large" color="secondary"/>
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip placement="top" title={`Edit descriptive interface properties`}>
                                                    <IconButton onClick={handleEditProps}>
                                                        <EditNoteOutlined fontSize="large" color="secondary"/>
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip placement="top" title={`Delete Interface`}>
                                                    <IconButton onClick={handleDelete}>
                                                        <DeleteForeverOutlined fontSize="large" color="secondary"/>
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>   
                                    </TableRow>
                                </TableBody>
                            </Table>
                            <Divider sx={{ mt: 1, mb: 1}}/>
                        </Card>
                    </Box>
                    
                    <Box sx={{ display: 'flex', minWidth: 500, minHeigt: 105}}>
                        <Card sx={{ backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, ml: 1, mr: 1, minHeight: 105, width: "98%"}} raised>         
                            <Box sx={{display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
                                <Divider sx={{ mt: 1, mb: 1}}/>
                                <Table sx={{ ml: 2, maxHeight: 105, minHeight: 105 }}>
                                    <TableBody>
                                        {/* give it transparent background  */}
                                        <TableRow sx={{alignItems: "center"}}> 
                                            <TableCell size="small" sx={{ width: 184, padding: 0, fontSize: 14, borderBottom: 0 }}>
                                                <Typography sx={{ verticalAlign: "center", mr: 2}}>Interface Description :</Typography>
                                            </TableCell>
                                            <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                                                <Box sx={{ display: 'flex', justifyContent: "left", alignItems: "center"}} >
                                                    <Typography sx={{ mr: 3, ml: 0}}>
                                                        {ifaceDescriptionProp?.value ?? ''}
                                                    </Typography>
                                                </Box>
                                            </TableCell>   
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                <Divider sx={{ mt: 1, mb: 1}}/> 
                            </Box>   
                        </Card>
                    </Box>

                </Box>
            </Box>

            <Divider sx={{ ml: 1, mt: 1.5, mb: 1.5, width: "96%"}}/>

            <Box 
                display="flex" 
                flexDirection="column" 
                sx={{ textAlign: "center", borderRadius: 5, m: 1, minWidth: 500, minHeight: 280, height: "47.5vh", backgroundColor: colors.primary[400] }}
            >    
                <Typography variant="h6" color={colors.greenAccent[400]} sx={{mt: .5}}>{`Interface Properties`}</Typography>
                <Divider sx={{ mt: 0, mb: 1 }}/>

                <Card sx={{ textAlign: "center", height: "42vh", width: "98%", backgroundColor: SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, borderRadius: 5, mb: 1, ml: 1, mr: 1, overflowY: "scroll"}} raised>
                    <Box >
                        <Box sx={{mt: 1 }}>
                            <Box>
                                {
                                    otherProperties.map((prop: PropertyItem, index: number) => (
                                        <Box key={`propbox-${index}`} display="flex" flexDirection="column" >
                                            <Box>
                                                <Table key={`tab-${index}`} sx={{ mt: 2, mb: 1, ml: 2, width: "98%"}}>
                                                    <TableBody>
                                                        {/* give it transparent background  */}
                                                        <TableRow key={`prop-tab-row-${index}`}> 
                                                            <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0, borderRight: 1, borderColor: colors.grey[400]}}>
                                                                <Typography sx={{ mr: 1}}>{prop.displayName}</Typography>
                                                            </TableCell>
                                                            <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                                                                <Typography sx={{ mr: 2, ml: 1}}>
                                                                    {prop.value}
                                                                </Typography>
                                                            </TableCell>   
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                                <Divider sx={{ mt: 1, mb: 1}}/>
                                            </Box>
                                        </Box>
                                    ))
                                } 
                            </Box>
                        </Box>     
                    </Box>
                </Card>

            </Box>
        </Box>
    )
}


export default InterfaceOverviewTab;








{/* <Box sx={{ display: 'flex', minWidth: 500, maxHeight: 61, minHeigt: 61, mt: 1, mb: 1 }}>
<Card sx={{ borderRadius: 5, ml: 1, mr: 1, width: "98%"}} raised>         
    <Box sx={{display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
        <Divider sx={{ mt: 1, mb: 1}}/>
        <Table sx={{ ml: 2, maxHeight: 20 }}>
            <TableBody>
                <TableRow sx={{alignItems: "center"}}> 
                    <TableCell size="small" sx={{ width: 184, padding: 0, fontSize: 14, borderBottom: 0 }}>
                        <Typography sx={{ verticalAlign: "center", mr: 2}}>Lock Status :</Typography>
                    </TableCell>
                    <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                        <Box sx={{ display: 'flex', justifyContent: "left", alignItems: "center"}} >
                            <Typography sx={{ mr: 2, color: ((iface && iface.lockedBy && iface.lockedBy.length > 0) ? SPECIAL_RED_COLOR : undefined) }}>
                                {
                                    (iface && iface.lockedBy && iface.lockedBy.length > 0) 
                                        ? <><span>ON</span>&nbsp;&nbsp;&nbsp;<span>{`[ ${iface.lockedBy} ]` }</span></>
                                        : `[ OFF ]`
                                }
                            </Typography>
                        </Box>
                    </TableCell>   
                </TableRow>
            </TableBody>
        </Table>
        <Divider sx={{ mt: 1, mb: 1}}/> 
    </Box>   
</Card>
</Box> */}




// <Tooltip placement="top" title={(iface && iface.lockedBy && iface.lockedBy.length > 0) ? `Unlock Interface`: `Lock Interface`}>
// {/* THIS IS DISABLED UNTIL FURTHER DISCUSSION */}
// <IconButton disabled onClick={handleLockAction}>
//     {(iface && iface.lockedBy && iface.lockedBy.length > 0)
//         ? <LockOpenOutlined fontSize="large" color="secondary"/>
//         : <LockOutlined fontSize="large" />// color="secondary"/>
//     }
// </IconButton>
// </Tooltip>
// async function handleLockAction(event: any): Promise<void> {
// if(iface && iface._id) {
//     let ifaceForUpdate = {...iface} as Interface
//     let ifaceId = ifaceForUpdate._id.toString() as string;
//     let actionMsg = "";
    
//     if(ifaceForUpdate.lockedBy && ifaceForUpdate.lockedBy.length > 0) {
//         //unlock Scenario
//         if((await isUserApprovedForUnlockAction(loggedInUser, project, ifaceId, UnlockPermissionActionEnum.UN_LOCK_INTERFACE)) === false) { return; }
//         actionMsg = "Unlock";
//         ifaceForUpdate.lockedBy = null;
//     }
//     else {
//         //lock scenario
//         if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.LOCK_INTERFACE) === false) { return; }
//         actionMsg = "Lock";
//         ifaceForUpdate.lockedBy = (loggedInUser?.email || loggedInUser?.idsid || null)
//     }

//     setLoadingSpinnerCtx({enabled: true, text: `${actionMsg}ing interface. Please wait...`})
//     updateInterface(ifaceForUpdate).then((updatedIface: Interface) =>{
//         if(updatedIface && updatedIface._id) {
//             setIface(updatedIface);
//             displayQuickMessage(UIMessageType.WARN_MSG, `Interface ${actionMsg} triggered by user: ${loggedInUser?.idsid}. Timestamp: ${(new Date()).toISOString()}`)
//         }
//     })
//     .finally(() => {
//         setLoadingSpinnerCtx({enabled: false, text: ``})
//     })
// }
// }







{/* <Box sx={{ display: 'flex', minWidth: 500, maxHeight: "22vh", minHeigt: 200 }}>
                        <Card sx={{ borderRadius: 5, ml: 1, mr: 1, width: "98%"}} raised>         
                            <Box sx={{display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
                                <Divider sx={{ mt: 1, mb: 1}}/>
                                <Table sx={{ ml: 2, height: 140 }}>
                                    <TableBody>
                                        <TableRow sx={{alignItems: "center"}}> 
                                            <TableCell size="small" sx={{ minWidth: 175, padding: 0, fontSize: 14, borderBottom: 0 }}>
                                                <Typography sx={{ verticalAlign: "center", mr: 2}}>Interface Description :</Typography>
                                            </TableCell>
                                            <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                                                <Box sx={{ display: 'flex', justifyContent: "left", alignItems: "center"}} >
                                                    <Typography sx={{ mr: 3, ml: 2}}>
                                                        {ifaceDescriptionProp?.value ?? ''}
                                                    </Typography>
                                                </Box>
                                            </TableCell>   
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                <Divider sx={{ mt: 1, mb: 1}}/> 
                            </Box>   
                        </Card>
                    </Box> */}



//==============================================================================================================

    /* 
    <Card sx={{ textAlign: "center", width: "97%", height: "95%", borderRadius: 5, mb: 1, ml: 1, mr: 1, overflowY: "scroll" }} raised>

        <Box sx={{mt: 1}}>

                {
                    ([...otherProperties]).map((prop: PropertyItem, index: number) => (
                        <Box key={`propbox-${index}`} display="flex" flexDirection="column" >
                            <Box>
                                <Table key={`tab-${index}`} sx={{ ml: 2, width: "98%"}}>
                                    <TableBody>
                                        
                                        <TableRow key={`prop-tab-row-${index}`}> 
                                            <TableCell size="small" width={"35%"} sx={{ padding: 0, fontSize: 14, borderBottom: 0}}>
                                                <Typography sx={{ mr: 1}}>{prop.displayName}</Typography>
                                            </TableCell>
                                            <TableCell size="small" sx={{padding: 0, fontSize: 13, borderBottom: 0}}>
                                                <Typography sx={{ mr: 2, ml: 1}}>
                                                    {prop.value}
                                                </Typography>
                                            </TableCell>   
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                <Divider sx={{ mt: 1, mb: 1}}/>
                            </Box>
                        </Box>
                    ))
                } 

        </Box>
    </Card> 
    
    */
                


    