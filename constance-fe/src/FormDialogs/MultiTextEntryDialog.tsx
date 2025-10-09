import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, Chip, DialogContent, Divider, FormControlLabel, Switch, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { Controller, ErrorOption, useForm } from 'react-hook-form';
import { Modal } from '@mantine/core';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BASIC_NAME_VALIDATION_REGEX, MIN_DESCRIPTION_LENGTH, SPECIAL_BLUE_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_GOLD_COLOR, SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { Fragment, useState } from 'react';
import { keyBy } from 'lodash';
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
import { SpButton } from '../CommonComponents/SimplePieces';
import { MultiRegexCollection } from '../CommonComponents/MultiRegexCollection';
import { MultiTextEntryField } from '../CommonComponents/MultiTextEntryField';
import { useCStore } from '../DataModels/ZuStore';
import { BasicKVP, DisplayOption } from '../DataModels/ServiceModels';


export interface MultiTextEntryDialogProps {
    title: string,
    warningText?: string,
    opened?: boolean,
    close?: () => void,
    onFormClosed : (contextualInfo: BasicKVP) => void,
    
    textArrayLabel?: string,
    textArrayProhibitedValues?: string[],
    textArrayInputMinWidth?: number,
    contextualInfo: any
}

const MultiTextEntryDialog: React.FC<MultiTextEntryDialogProps> = ({ title, warningText, opened, close, onFormClosed,
    textArrayLabel, textArrayProhibitedValues, textArrayInputMinWidth, contextualInfo }) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    
    const [textArrayValues, setTextArrayValues] = useState<Set<string>>(new Set());


    const handleCancel = () => {
        if(onFormClosed){
            contextualInfo.value = null;
            onFormClosed(contextualInfo);
        }
        setTextArrayValues(new Set());
        if(close){ close() }
    };


    function handleSubmit() {
        if(textArrayValues && textArrayValues.size > 0) {
            if(textArrayProhibitedValues && textArrayProhibitedValues.length > 0) {
                let textArrayProhibitedValuesUpperCase = textArrayProhibitedValues.map(x => x.toUpperCase().trim())
                for(let item of textArrayValues) {
                    if(textArrayProhibitedValuesUpperCase.includes(item.toUpperCase().trim())) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `The input value "${item}" is prohibited.`);
                        return;
                    }
                }
            }
        }

        if (onFormClosed) {
            contextualInfo.value = textArrayValues;
            onFormClosed(contextualInfo);
        }
        setTextArrayValues(new Set());
        if(close){ close() }
    };
    

    

    function onTextArrayValuesChanged(items: DisplayOption[]): void {
        const values = items.map(item => item.label);
        let arr = Array.from(textArrayValues).concat(values);
        arr = arr.sort()
        setTextArrayValues(new Set(arr));
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
                    body: { color: "red", backgroundColor: colors.primary[400] }
                }}>
                    <Box sx={{ '& .MuiTextField-root': { width: '100%'}, minWidth: 300 }}>
                        <Divider />
                        {(warningText && warningText.length > 0)
                            ?<Box sx={{ mb: 1}}>
                                <Typography sx={{color: SPECIAL_RED_COLOR}}>
                                    {warningText ?? ''}
                                </Typography>
                            </Box>
                            :<></>                              
                        }
                        <Divider />

                        <Box display="flex" justifyContent="center" sx={{ m: 1, mt: 3, mb: 3, width: "70vw", minWidth: 300 }}>
                            <MultiTextEntryField 
                                labelText={textArrayLabel || `Add New text Value(s)`}
                                onItemAdded={onTextArrayValuesChanged}
                                regexForValidation={BASIC_NAME_VALIDATION_REGEX} 
                                textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR }}
                                addButtonStyle={{ fontSize: 27}}
                                disabled={false}
                            />
                        </Box>

                        <Divider />
                        
                        <Box sx={{ m: 1, mt: 2, mb: 3, borderRadius: 2, backgroundColor: SPECIAL_QUARTZ_COLOR }}>
                            {Array.from(textArrayValues).map((item, index) => (
                                <Chip
                                    key={`chp-${index}`}
                                    label={item}
                                    variant="outlined"
                                    onDelete={() => {
                                        const newValues = Array.from(textArrayValues).filter(x => x.toUpperCase().trim() !== item.toUpperCase().trim());
                                        setTextArrayValues(new Set(newValues));
                                    }}
                                    sx={{
                                        backgroundColor: colors.blueAccent[400],
                                        color: "white",
                                        fontSize: 14,
                                        m: 1,
                                        '&:hover': { borderColor: SPECIAL_GOLD_COLOR },
                                        '& .MuiChip-deleteIcon:hover': { color: colors.grey[100] }
                                    }}
                                />
                                ))}
                        </Box>
                    </Box>

                    <Divider sx={{ mt: 2, mb: 1 }}/>
                    
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
                            label={"Submit"}
                            disabled={(textArrayValues.size > 0) ? false : true}
                            onClick={handleSubmit} />
                    </Box>

            </Modal>
        </Box>
    );
}

export default MultiTextEntryDialog

