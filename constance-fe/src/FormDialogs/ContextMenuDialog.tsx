import * as React from 'react';
import { Autocomplete, Box, DialogContent, Divider, List, ListItem, ListItemIcon, ListItemText, PaletteMode, Typography } from '@mui/material';
import { useContext, useEffect, useRef } from "react";
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


