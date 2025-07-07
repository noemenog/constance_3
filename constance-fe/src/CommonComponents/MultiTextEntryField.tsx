import * as React from 'react';
import { Alert, Box, Divider, Grid, IconButton, SxProps, TextField, Theme } from '@mui/material';
import { AddCircle } from '@mui/icons-material';
import { DisplayOption } from '../DataModels/HelperModels';
import { useTheme } from "@mui/material/styles";
import { tokens } from '../theme';




interface MultiTextEntryFieldProps {
    labelText: string,
    onItemAdded: (buckets: DisplayOption[]) => void,
    regexForValidation?: RegExp
    textFieldStyle?: SxProps<Theme>,
    addButtonStyle?: SxProps<Theme>,
    disabled?: boolean
}


export const MultiTextEntryField: React.FC<MultiTextEntryFieldProps> = ({ 
    labelText, onItemAdded, regexForValidation, textFieldStyle, addButtonStyle, disabled = false}) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const [textFieldValue, setTextFieldValue] = React.useState('');
    const [openRegexAlert, setOpenRegexAlert] = React.useState(false);

    
    function handleKeyDowwn(e: any) {
        if (e) {
            if (e.code === 13 || e.key.toUpperCase() === "ENTER") {
                onAddStringData();
                e.preventDefault();
            }
        }
    };

    function onAddStringData() {
        let bucketEntryData = new Array<DisplayOption>();
        textFieldValue.split(",")?.forEach((name: string, i: number) => {
            if (name) {
                let found = bucketEntryData?.filter(x => x.label.toLowerCase() === name.toLowerCase()) ?? [];
                if (found && found.length === 0) {
                    if(regexForValidation) {
                        if(regexForValidation.test(name.trim()) === false) {
                            setOpenRegexAlert(true);
                            return;
                        }
                    }

                    let newItem = { id: i.toString(), label: name.trim() } as DisplayOption;
                    bucketEntryData.push(newItem)
                    setTextFieldValue('');
                    setOpenRegexAlert(false);
                }
            }
        });

        if(bucketEntryData.length > 0) {
            if (onItemAdded) {
                onItemAdded(bucketEntryData);
            }
        }
    }



    return (
        <Box>
            <div>
                <Box sx={{display: "flex", flexDirection: "row"}}>
                    
                    <TextField
                        disabled={disabled}
                        value={textFieldValue}
                        id="str-coll-add-text"
                        label={labelText}
                        variant="outlined"
                        size={"small"}
                        onChange={(e: any) => setTextFieldValue(e.target.value)}
                        sx={textFieldStyle ?? { m: 1, width:"100%",  backgroundColor: "white", }}
                        onKeyDown={(event) => {
                            handleKeyDowwn(event);
                        }} 
                    />

                    <IconButton disabled={disabled} sx={{ml:.5}} size="small" onClick={() => onAddStringData()}>
                        <AddCircle sx={ addButtonStyle ?? { color: colors.grey[100]}} />  
                    </IconButton>
                    <Divider orientation="vertical" sx={{height: 35, marginLeft: .5, marginRight: 0 }} />

                </Box>
            </div >
            {openRegexAlert && <Alert color="error" severity="error" onClose={() => setOpenRegexAlert(false)}>Cannot add item. Invalid characters detected</Alert>}
        </Box >
    );
}



// '#616161' 


// error={onEntryInfoValidation ? onEntryInfoValidation().error : false}
// helperText={onEntryInfoValidation ? onEntryInfoValidation()?.message ?? '' : ''}
// error={false}
// helperText={''}