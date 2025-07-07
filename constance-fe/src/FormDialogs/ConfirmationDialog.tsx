import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, DialogContent, Divider, Typography } from '@mui/material';
import { BoltOutlined, Cancel, Check, PlayArrowOutlined } from '@mui/icons-material';
import { useContext } from "react";
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { SPECIAL_RED_COLOR } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BasicKVP } from '../DataModels/HelperModels';
import { SpButton } from '../CommonComponents/SimplePieces';


export enum ConfirmationDialogActionType { 
    CANCEL = "CANCEL", 
    PROCEED = "PROCEED", 
    SECONDARY_ACTION = "SECONDARY_ACTION"
}

export interface ConfirmationDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (action: ConfirmationDialogActionType, contextualInfo: BasicKVP) => void,
    title: string,
    warningText_main: string,
    warningText_other?: string,
    actionButtonText?: string,
    cancelButtonText?: string,
    setCautionActionButtonIntent?: boolean,
    enableSecondaryActionButton?: boolean
    secondaryActionButtonText?: string,
    contextualInfo: BasicKVP,
    upperCaseButtonText?: boolean
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ 
    title, warningText_main, warningText_other, actionButtonText, cancelButtonText, secondaryActionButtonText, 
    contextualInfo, opened, close, onFormClosed, setCautionActionButtonIntent = false, enableSecondaryActionButton = false, upperCaseButtonText = true}) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const handleCancel = () => {
        if (onFormClosed) {
            onFormClosed(ConfirmationDialogActionType.CANCEL, contextualInfo);
        }
        if(close){ close() }
    };


    const onProceedSubmit = () => {
        if (onFormClosed) {
            onFormClosed(ConfirmationDialogActionType.PROCEED, contextualInfo);
        }
        if(close){ close() }
    }


    const onSecActionSubmit = () => {
        if (onFormClosed) {
            onFormClosed(ConfirmationDialogActionType.SECONDARY_ACTION, contextualInfo);
        }
        if(close){ close() }
    }


    return (
        <Box>
            <Modal
                opened={opened as boolean}
                onClose={handleCancel}
                centered
                size="auto"
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 3,
                }}
                styles={{
                    title: { padding: 2, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: colors.grey[100], backgroundColor: colors.primary[400] }
                }}>

                    <Box>
                        <Divider></Divider>
                        <Box sx={{ mt:2, mb: 1 }}>
                            <Typography > {warningText_main ?? ''}</Typography>
                        </Box>
                        
                        <Box sx={{ mb: 4}}>
                            {
                            (warningText_other && warningText_other.length > 0)
                                ?<Typography sx={{color: SPECIAL_RED_COLOR}}>
                                    {warningText_other ?? ''}
                                </Typography>
                                :<></>
                            }
                        </Box>

                        <Divider />

                        <Box>
                            <SpButton
                                intent="cancel"
                                onClick={handleCancel}
                                startIcon={<Cancel />}
                                sx={{ m: 1, height: 32, width:200, textTransform: (upperCaseButtonText ? undefined : 'none') }}
                                label={cancelButtonText ?? "Cancel"} />

                            <SpButton
                                intent={setCautionActionButtonIntent ? "caution" : "plain"}
                                startIcon={setCautionActionButtonIntent ? <BoltOutlined /> : <Check />}
                                sx={{ m: 1, height: 32, width:200, textTransform: (upperCaseButtonText ? undefined : 'none') }}
                                label={actionButtonText ?? "Ok"}
                                onClick={onProceedSubmit} />
                                
                            { enableSecondaryActionButton && <SpButton
                                intent="plain"
                                startIcon={<PlayArrowOutlined />}
                                sx={{ m: 1, height: 32, width:200, textTransform: (upperCaseButtonText ? undefined : 'none') }}
                                label={secondaryActionButtonText ?? "Action"}
                                onClick={onSecActionSubmit} />}
                        
                        </Box>
                    </Box>

            </Modal>
        </Box>
    );
}

export default ConfirmationDialog