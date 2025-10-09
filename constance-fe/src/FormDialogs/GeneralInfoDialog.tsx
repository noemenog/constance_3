import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, DialogContent, Divider, FormControlLabel, Switch, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { Controller, ErrorOption, useForm } from 'react-hook-form';
import { Modal } from '@mantine/core';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BASIC_NAME_VALIDATION_REGEX, MIN_DESCRIPTION_LENGTH, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { BasicKVP, DisplayOption } from '../DataModels/ServiceModels';
import { Fragment, useState } from 'react';
import { keyBy } from 'lodash';
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
import { useCStore } from '../DataModels/ZuStore';
import { SpButton } from '../CommonComponents/SimplePieces';
import { MultiRegexCollection } from '../CommonComponents/MultiRegexCollection';
import { MultiTextEntryField } from '../CommonComponents/MultiTextEntryField';




export interface GeneralInfoUIContext {
    textMain?: string,
    textOther?: string,
    largeText?: string,
    selection?: string,
    secondarySelection?: string,
    booleanValue?: boolean,
    mapper?: Map<string, string>,
    regexExprValues?: BasicKVP[],
    contextualInfo: BasicKVP
};


export interface GeneralInfoDialogProps {
    title: string,
    warningText?: string,
    opened?: boolean,
    close?: () => void,
    onFormClosed : (data: GeneralInfoUIContext | null, ) => void,
    
    
    showTextMainCtrl?: boolean, 
    showTextOtherCtrl?: boolean, 
    showLargeTextCtrl?: boolean, 
    showSelectionCtrl?: boolean, 
    showSecondarySelection?: boolean, 
    showBooleanValueCtrl?: boolean, 
    showMapperCtrl?: boolean,
    showRegexExpressionCollector?: boolean,

    selectionCtrlOptions?: Array<string>
    selectionDefaultValue?: string, 
    textMainDefaultValue?: string, 
    textOtherDefaultValue?: string, 
    largeTextDefaultValue?: string, 
    booleanValueDefaultValue?: boolean,
    mapperItems?: Map<string, string[]>,
    regexExpressionCollectorTitle?: string,
    regexExprDefaultValues?: BasicKVP[],

    selectionLabel?: string,
    secondarySelectionLabel?: string, 
    textMainLabel?: string, 
    textOtherLabel?: string, 
    largeTextLabel?: string, 
    booleanValueLabel?: string,

    largeTextAreaMinCharLength?: number,
    largeTextAreaValueRequired?: boolean,
    enableFormSubmitOnEnterKey?: boolean,

    contextualInfo: any
}

const GeneralInfoDialog: React.FC<GeneralInfoDialogProps> = ({ title, warningText, opened, close, onFormClosed,
    selectionCtrlOptions, selectionDefaultValue, textMainDefaultValue, textOtherDefaultValue, largeTextDefaultValue, booleanValueDefaultValue, 
    mapperItems, selectionLabel, secondarySelectionLabel, textMainLabel, textOtherLabel, largeTextLabel, booleanValueLabel, largeTextAreaMinCharLength, 
    largeTextAreaValueRequired, regexExpressionCollectorTitle, regexExprDefaultValues, contextualInfo, 
    
    enableFormSubmitOnEnterKey = true, showTextMainCtrl = false, showTextOtherCtrl = false, showLargeTextCtrl = false, showSelectionCtrl = false, showBooleanValueCtrl = false, 
    showMapperCtrl = false, showRegexExpressionCollector = false, showSecondarySelection = false,
 }) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    
    const [mapperSelections, setMapperSelections] = useState<Map<string, string>>(new Map<string, string>());
    const [regExprData, setRegExprData] = useState<BasicKVP[]>(regexExprDefaultValues ?? []);
    const [secondarySelectionOptions, setSecondarySelectionOptions] = useState<string[]>([]);

    const seperationSpace = 3

    const { register, getValues, setError, setValue, clearErrors, handleSubmit, reset, control, formState: { errors } } = useForm({
        defaultValues: {
            textMainField: textMainDefaultValue ?? '',
            textOtherField: textOtherDefaultValue ?? '',
            largeTextField: largeTextDefaultValue ?? '',
            selectionValueField: selectionDefaultValue ?? '',
            secondarySelectionValueField: '',
            booleanValueField: booleanValueDefaultValue ?? false
        }
    });

    const handleCancel = () => {
        if(onFormClosed){
            onFormClosed(null);
        }
        reset();
        if(close){ close() }
    };

    function handleFormSubmit(data: any) {
        if(showMapperCtrl){
            if(mapperItems && mapperItems.size > 0) {
                for(let [key, value] of mapperItems) {
                    if((mapperSelections.size === 0) || (mapperSelections.has(key) === false) || (!mapperSelections.get(key)) || (mapperSelections.get(key)?.length === 0)) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `A value must be selected for each of the one-to-one mapping pair(s).`)
                        return;
                    }
                }
            }
        }

        let giContext : GeneralInfoUIContext = {
            textMain: data.textMainField,
            textOther: data.textOtherField,
            largeText: data.largeTextField,
            selection: data.selectionValueField,
            secondarySelection: data.secondarySelectionValueField,
            booleanValue: data.booleanValueField,
            mapper: mapperSelections,
            regexExprValues: regExprData,
            contextualInfo: contextualInfo
        };

        if (onFormClosed) {
            onFormClosed(giContext);
        }

        reset();
        setMapperSelections(new Map<string, string>());
        if(close){ close() }
    };
    

    function setSelectedMapperValue(key: string, value: string | null): void {
        if(key && value && value.length > 0) {
            let copy = rfdcCopy<Map<string, string>>(mapperSelections) as Map<string, string>;
            copy.set(key, value as string);
            setMapperSelections(copy);
        }
    }


    
    function handleKeyDown(e: any) {
        if (e && enableFormSubmitOnEnterKey === false) {
            if (e.code === 13 || e.key.toUpperCase() === "ENTER") {
                e.preventDefault();
            }
        }
    }


    function determineSecondarySelectionOptions(event: any, value: string | null, reason: any, details?: any): void {
        let res = new Array<string>();
        if(value && value.trim().length > 0) {
            let filtOpts = selectionCtrlOptions?.filter(x => x !== value)
            if(filtOpts && filtOpts.length > 0){
                res = ["", ...filtOpts];
            }
        }
        setSecondarySelectionOptions(res);
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
                    <form onSubmit={handleSubmit(handleFormSubmit)} onKeyDown={handleKeyDown}>
                        <Box sx={{ '& .MuiTextField-root': { width: '100%'}, }}>
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

                            {/* Text Field Main */}
                            {showTextMainCtrl && <TextField {...register("textMainField", {
                                    required: 'A value is required',
                                    minLength: { value: 3, message: 'Value must have minimum of 3 characters' },
                                })}
                                id="txt-text"
                                size="small"
                                label={textMainLabel}
                                error={(errors.textMainField?.message && errors.textMainField?.message.length > 0) ? true : false}
                                helperText={errors.textMainField?.message}
                                sx={{ m: 1, minWidth: 200, marginTop: seperationSpace }} />}

                            {/* Text Field 2 */}
                            {showTextOtherCtrl && <TextField {...register("textOtherField", {
                                    required: 'A value is required',
                                    minLength: { value: 3, message: 'Value must have minimum of 3 characters' },
                                })}
                                id="other-txt-text"
                                size="small"
                                label={textOtherLabel}
                                error={(errors.textOtherField?.message && errors.textOtherField?.message.length > 0) ? true : false}
                                helperText={errors.textOtherField?.message}
                                sx={{ m: 1, minWidth: 200, marginTop: seperationSpace }} />}

                            {/* Text Area */}
                            {showLargeTextCtrl && <TextField {...register("largeTextField", {
                                    required: largeTextAreaValueRequired ? 'A Value is required' : undefined,
                                    minLength: { 
                                        value: largeTextAreaMinCharLength ?? MIN_DESCRIPTION_LENGTH, 
                                        message: `Please provide descriptive text here. Minimum: ${largeTextAreaMinCharLength ?? MIN_DESCRIPTION_LENGTH} characters` 
                                    }
                                })}
                                id="lrg-txt-area"
                                size="small"
                                label={largeTextLabel}
                                multiline
                                maxRows={10}
                                error={(errors.largeTextField?.message && errors.largeTextField?.message.length > 0) ? true : false}
                                helperText={errors.largeTextField?.message}
                                sx={{ m: 1, minWidth: 200, marginTop: seperationSpace}} />}

                            {/* DropDown Menus */}
                            {showSelectionCtrl && <Autocomplete 
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                onChange={determineSecondarySelectionOptions}
                                size="small"
                                id="selectionValueField-cb"
                                sx={{ m: 1, minWidth: 200, marginTop: 0 }}
                                options={['', ...(selectionCtrlOptions ?? [])]}
                                renderInput={(params: any) => <TextField size="small" sx={{marginTop: seperationSpace}} {...register("selectionValueField", {
                                    required: 'A selection is required',
                                })} {...params} 
                                    label={selectionLabel}
                                    error={(errors.selectionValueField?.message && errors.selectionValueField?.message.length > 0) ? true : false}
                                    helperText={errors.selectionValueField?.message}
                                />}
                            />}
                            {showSecondarySelection && <Autocomplete 
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="secSlectionValueField-cb"
                                sx={{ m: 1, minWidth: 200, marginTop: 0 }}
                                options={secondarySelectionOptions}
                                renderInput={(params: any) => <TextField size="small" sx={{marginTop: seperationSpace}} {...register("secondarySelectionValueField", {
                                    required: 'A selection is required',
                                })} {...params} 
                                    label={secondarySelectionLabel}
                                    error={(errors.secondarySelectionValueField?.message && errors.secondarySelectionValueField?.message.length > 0) ? true : false}
                                    helperText={errors.secondarySelectionValueField?.message}
                                />}
                            />}

                            {/* Switch / Boolean field */}
                            {showBooleanValueCtrl && <Controller
                                key="switch-Ctrl"
                                name="booleanValueField"
                                control={control}
                                render={({ field: { onChange, value } }) => (
                                    <FormControlLabel
                                        control={<Switch key="gi-switch" checked={value} onChange={onChange} />}
                                        label={booleanValueLabel}
                                    />
                                )}
                            />}

                        </Box>

                        {(showMapperCtrl && mapperItems && mapperItems.size > 0) && <Box>
                            <Divider sx={{ mt: 2, mb: 1 }}/>
                            
                            <Table stickyHeader border={1}>
                                <TableHead>
                                    <TableRow sx={{ padding: 0, backgroundColor: SPECIAL_DEEPER_QUARTZ_COLOR}}>
                                        <TableCell size="small" sx={{ padding: 1, fontSize: 11, textAlign: "center", color: colors.grey[200] }}>{`Key`}</TableCell>
                                        <TableCell size="small" sx={{ padding: 1, fontSize: 11, textAlign: "center", color: colors.grey[200] }}>{`Value`}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <Fragment key={`mppr-frag2`}>
                                        {Array.from(mapperItems).map(([key, opts], index) => (
                                            <TableRow key={`mppr-tr-`} >
                                            
                                                <TableCell size="small" sx={{ width: "60%", backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, padding: 0, textAlign: "center" }}>
                                                    <Typography sx={{ fontSize: 11, padding: 2}}>{`${key}`}</Typography>
                                                </TableCell>

                                                <TableCell size="small" sx={{ width: "65%", backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, padding: 0, textAlign: "center" }}>
                                                    <Autocomplete<string>
                                                        value={mapperSelections.get(key) ?? ''}
                                                        onChange={(event, value, reason, details) => setSelectedMapperValue(key, value)}
                                                        key="mppr-sel-CB"
                                                        freeSolo={false}
                                                        filterSelectedOptions={true}
                                                        disablePortal
                                                        disableListWrap
                                                        disabled={false}
                                                        size="small"
                                                        id="mppr-sel-cb"
                                                        sx={{ padding: 1, minWidth: 350}}
                                                        options={opts}
                                                        renderInput={(params) => <TextField {...params} label="Source Project" size="small" />}
                                                    />
                                                </TableCell>

                                            </TableRow>
                                        ))}
                                    </Fragment>
                                </TableBody>
                            </Table>

                        </Box>}

                        {showRegexExpressionCollector && <Box>
                            <Divider sx={{ mt: 2, mb: 1 }}/>
                            <MultiRegexCollection 
                                onExpressionAdded={(kvpArr) => setRegExprData(kvpArr)} 
                                regexForValidation={BASIC_NAME_VALIDATION_REGEX}
                                title={regexExpressionCollectorTitle ?? ''}
                                regexExprDefaultValues={regexExprDefaultValues ?? []} />
                        </Box>}
                        
                        <Divider sx={{ mt: 2, mb: 1 }}/>
                        
                        <SpButton
                            intent="cancel"
                            onClick={handleCancel}
                            startIcon={<Cancel />}
                            sx={{ m: 1, height: 32, width:200 }}
                            label="Cancel" />

                        <SpButton
                            intent="plain"
                            type="submit"
                            startIcon={<Check />}
                            sx={{ m: 1, height: 32, width:200 }}
                            label="Submit" />
                        
                    </form>

            </Modal>
        </Box>
    );
}

export default GeneralInfoDialog

