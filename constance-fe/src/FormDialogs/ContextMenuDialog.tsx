import * as React from 'react';
import { Autocomplete, Box, DialogContent, Divider, List, ListItem, ListItemIcon, ListItemText, PaletteMode, Typography } from '@mui/material';
import { useContext, useEffect, useRef } from "react";
import { ErrorOption, useForm } from 'react-hook-form';
import { Modal } from '@mantine/core';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BasicKVP, MenuInfo } from '../DataModels/HelperModels';
import { Property } from 'csstype';









export interface ContextMenuDialogProps {
    show: boolean,
    onClickOutside: any,
    topYPosition?: number,
    leftXPosition?: number,
    menuInfoList: MenuInfo[],
    centered: boolean,
    mode?: PaletteMode
}

export const ContextMenuDialog: React.FC<ContextMenuDialogProps> = ({ 
    show, onClickOutside, topYPosition, leftXPosition, menuInfoList, centered, mode }) => {
    
    const ref = useRef(null);

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    //with a little help from our friends: https://blog.logrocket.com/detect-click-outside-react-component-how-to/
    useEffect(() => {
        const handleClickOutside = (event: { target: any; }) => {
            if (ref.current && !(ref.current as any).contains(event.target)) {
                onClickOutside && onClickOutside();
            }
        };
        
        document.addEventListener('click', handleClickOutside, true);
        
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        };

    }, [ onClickOutside ]);


    if(!show) {
        return null;
    }
        

    function handleCellContextMenuItemClicked(info: MenuInfo): void {
        if(info.callbackAction && info.contextualInfo) {
            info.callbackAction(info.contextualInfo as BasicKVP);
        }
    }


    

    return (
        <Box 
            sx={{
                position: "absolute", 
                width: 200, 
                borderRadius: 16, 
                top: topYPosition, 
                left: leftXPosition,
                backgroundColor: colors.primary[400]}}>
            
            {/* <Typography onClick={(e) => {alert("You have clicked it")}}>{"THIS IS A SAMPLE CONTENT"}</Typography> */}

            {(menuInfoList && menuInfoList.length > 0)
                ? 
                    <Box>
                        <Modal
                            opened={show}
                            onClose={() => {}}
                            centered
                            size="auto"
                            transitionProps={{ transition: 'fade', duration: 600 }}
                            withCloseButton={false}
                            overlayProps={{
                                backgroundOpacity: 0.00,
                                blur: 0,
                            }}
                            styles={{
                                title: { padding: 6, marginRight: 10, color: "#000000" },
                                header: { backgroundColor: colors.grey[100] },
                                body: { color: colors.grey[100], backgroundColor: (mode === "dark") ? colors.primary[400] : "#383838"}
                            }}>

                                <Box ref={ref}>
                                    <Divider />
                                    
                                    <Box sx={{ display: 'flex'}}>
                                        <List dense={true}>
                                            <>
                                            {menuInfoList.map((info: MenuInfo, index: number) => (
                                                <ListItem 
                                                    dense 
                                                    divider 
                                                    disablePadding 
                                                    onClick={(e) => handleCellContextMenuItemClicked(info)}
                                                    sx={{cursor: "pointer"}}
                                                >
                                                    <ListItemIcon>
                                                        {info.icon}
                                                    </ListItemIcon>
                                                    <ListItemText primary={info.label}/>
                                                </ListItem>
                                            ))}
                                            </>
                                        </List>
                                    </Box>
                                    
                                    
                                </Box>

                        </Modal>
                    </Box>
                    
                : <></>
            }
        </Box> 
    );
}




// export interface ContextMenuDialogProps {
//     opened?: boolean,
//     close?: () => void,
//     onFormClosed: (data: string | null, contextualInfo: BasicKVP) => void,
//     title: string,
//     warningText?: string,
//     defaultValue?: string,
//     finishButtonText?: string,
//     unacceptbleValues?: string[],
//     contextualInfo: BasicKVP,
// }

// const ContextMenuDialog: React.FC<ContextMenuDialogProps> = ({ title, warningText, defaultValue, finishButtonText, 
//     unacceptbleValues, opened, contextualInfo, close, onFormClosed }) => {
    
//     const theme = useTheme();
//     const colors = tokens(theme.palette.mode);
//     const context = useContext(SpiderContext);

//     const [currentValue, setCurrentValue] = React.useState('')
//     const [errMsg, setErrMsg] = React.useState('')


//     function onValidate(): boolean {
//         const MIN_CHAR = 3

//         if (currentValue.length < MIN_CHAR) {
//             if ((defaultValue ?? '').length < MIN_CHAR) {
//                 setErrMsg(`Value must have at least ${MIN_CHAR} characters`)
//                 return false;
//             }
//         }

//         let chkStr = (currentValue.length > 0) ? currentValue : (defaultValue ?? '') as string
//         let val = NAME_VALIDATION_REGEX.test(chkStr);
//         if (val === false) {
//             setErrMsg("Value cannot contain space or other special characters")
//             return false;
//         }

//         if (currentValue && currentValue.length > 0) {
//             if ((unacceptbleValues && unacceptbleValues.length > 0) && unacceptbleValues.includes(currentValue)) {
//                 setErrMsg("Unacceptable value specified. Please enter something different")
//                 return false;
//             }
//         }
//         else if (defaultValue && defaultValue.length > 0) {
//             if ((unacceptbleValues && unacceptbleValues.length > 0) && unacceptbleValues.includes(defaultValue)) {
//                 setErrMsg(`Default value [${defaultValue}] must be changed. Please enter something different`)
//                 return false;
//             }
//         }

//         setErrMsg("")
//         return true;
//     }

//     const handleCancel = () => {
//         if (onFormClosed) {
//             onFormClosed(null, contextualInfo);
//         }
//         setCurrentValue('');
//         if(close){ close() }
//     };


//     const onTextSubmit = () => {
//         if (onValidate()) {
//             if (onFormClosed) {
//                 let value = currentValue.length > 0 ? currentValue : defaultValue
//                 onFormClosed(value as string, contextualInfo);
//             }
//             setCurrentValue('');
//             if(close){ close() }
//         }
//     }


//     return (
//         <Box>
//             <Modal
//                 opened={opened as boolean}
//                 onClose={handleCancel}
//                 centered
//                 size="auto"
//                 transitionProps={{ transition: 'fade', duration: 600 }}
//                 withCloseButton={false}
//                 overlayProps={{
//                     backgroundOpacity: 0.00,
//                     blur: 0,
//                 }}
//                 styles={{
//                     title: { padding: 6, marginRight: 10, color: "#000000" },
//                     header: { backgroundColor: colors.grey[100] },
//                     body: { color: SPECIAL_RED_COLOR, backgroundColor: colors.primary[400] }
//                 }}>

//                     <Box>
//                         <Divider />
//                         <Box sx={{ marginBottom: 1 }}>
//                             {(warningText && warningText.length > 0)
//                             ?<Typography sx={{marginTop:1}}>
//                                 {warningText ?? ''}
//                             </Typography>
//                             :<></>}
//                         </Box>
                        
//                         <Box sx={{ display: 'flex'}}>
//                             <TextField
//                                 sx={{ width: "90%", mt: 3, mb: 3}}
//                                 id="outlined-basic-1"
//                                 variant="outlined"
//                                 required
//                                 defaultValue={defaultValue ?? ''}
//                                 onChange={(e: any) => { setCurrentValue(e.target.value) }}
//                                 helperText={errMsg}
//                             />
//                         </Box>
                        

//                         <Divider />
//                         <Box>
//                         <SpButton
//                             intent="cancel"
//                             onClick={handleCancel}
//                             startIcon={<Cancel />}
//                             sx={{ m: 1, height: 32, width:200 }}
//                             label="Cancel" />

//                         <SpButton
//                             intent="plain"
//                             startIcon={<Check />}
//                             sx={{ m: 1, height: 32, width:200 }}
//                             label={finishButtonText ?? "Ok"}
//                             onClick={onTextSubmit} />
//                         </Box>
//                     </Box>

//             </Modal>
//         </Box>
//     );
// }

// export default observer(ContextMenuDialog)