import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, DialogContent, Divider, Typography } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { useContext } from "react";
import { ErrorOption, useForm } from 'react-hook-form';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { SPECIAL_RED_COLOR } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BasicKVP } from '../DataModels/HelperModels';
import { SpButton } from '../CommonComponents/SimplePieces';


export interface SimpleTextDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (data: string | null, contextualInfo: BasicKVP) => void,
    title: string,
    warningText?: string,
    defaultValue?: string,
    finishButtonText?: string,
    unacceptbleValues?: string[],
    validationRegex?: RegExp,
    contextualInfo: BasicKVP,
}

const SimpleTextDialog: React.FC<SimpleTextDialogProps> = ({ title, warningText, defaultValue, finishButtonText, 
    validationRegex, unacceptbleValues, opened, contextualInfo, close, onFormClosed }) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [currentValue, setCurrentValue] = React.useState('')
    const [errMsg, setErrMsg] = React.useState('')


    function onValidate(): boolean {
        const MIN_CHAR = 3

        if (currentValue.length < MIN_CHAR) {
            if ((defaultValue ?? '').length < MIN_CHAR) {
                setErrMsg(`Value must have at least ${MIN_CHAR} characters`)
                return false;
            }
        }

        if(validationRegex) {
            let chkStr = (currentValue.length > 0) ? currentValue : (defaultValue ?? '') as string
            let val = validationRegex.test(chkStr);
            if (val === false) {
                setErrMsg("Value cannot contain space or other special characters")
                return false;
            }
        }

        if (currentValue && currentValue.length > 0) {
            if ((unacceptbleValues && unacceptbleValues.length > 0) && unacceptbleValues.some(a => a.toLowerCase() === currentValue.toLowerCase())) {
                setErrMsg("Unacceptable value specified. Please enter something different")
                return false;
            }
        }
        else if (defaultValue && defaultValue.length > 0) {
            if ((unacceptbleValues && unacceptbleValues.length > 0) && unacceptbleValues.some(a => a.toLowerCase() === defaultValue.toLowerCase())) {
                setErrMsg(`Default value [${defaultValue}] must be changed. Please enter something different`)
                return false;
            }
        }

        setErrMsg("")
        return true;
    }

    const handleCancel = () => {
        if (onFormClosed) {
            onFormClosed(null, contextualInfo);
        }
        setCurrentValue('');
        if(close){ close() }
    };


    const onTextSubmit = () => {
        if (onValidate()) {
            if (onFormClosed) {
                let value = currentValue.length > 0 ? currentValue : defaultValue
                onFormClosed(value as string, contextualInfo);
            }
            setCurrentValue('');
            if(close){ close() }
        }
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
                    title: { padding: 6, marginRight: 10, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: SPECIAL_RED_COLOR, backgroundColor: colors.primary[400] }
                }}>

                    <Box>
                        <Divider />
                        <Box sx={{ marginBottom: 1 }}>
                            {(warningText && warningText.length > 0)
                            ?<Typography sx={{marginTop:1}}>
                                {warningText ?? ''}
                            </Typography>
                            :<></>}
                        </Box>
                        
                        <Box sx={{ display: 'flex'}}>
                            <TextField
                                sx={{ width: "90%", mt: 3, mb: 3}}
                                id="outlined-basic-1"
                                variant="outlined"
                                required
                                defaultValue={defaultValue ?? ''}
                                onChange={(e: any) => { setCurrentValue(e.target.value) }}
                                helperText={errMsg}
                            />
                        </Box>
                        

                        <Divider />
                        <Box>
                            <SpButton
                                intent="cancel"
                                onClick={handleCancel}
                                startIcon={<Cancel />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label="Cancel" />

                            <SpButton
                                intent="plain"
                                startIcon={<Check />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label={finishButtonText ?? "Ok"}
                                onClick={onTextSubmit} />
                        </Box>
                    </Box>

            </Modal>
        </Box>
    );
}

export default SimpleTextDialog