import * as React from 'react';
import { Alert, Box, Divider, IconButton, SxProps, Table, TableBody, TableCell, TableRow, TextField, Theme, Tooltip, Typography } from '@mui/material';
import { AddCircle, Cancel } from '@mui/icons-material';
import { BasicKVP, DisplayOption } from '../DataModels/ServiceModels';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from '../theme';
import { AgGridReact } from 'ag-grid-react';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { ColDef, ColGroupDef, GridApi, NewValueParams } from 'ag-grid-community';
import { SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_RED_COLOR } from '../DataModels/Constants';




interface MultiRegexCollectionProps {
    onExpressionAdded: (kvpArr: BasicKVP[]) => void,
    title: string,
    regexExprDefaultValues: BasicKVP[],
    regexForValidation?: RegExp
    textFieldStyle?: SxProps<Theme>,
    addButtonStyle?: SxProps<Theme>,
    disabled?: boolean    
}


export const MultiRegexCollection: React.FC<MultiRegexCollectionProps> = ({ 
    title, onExpressionAdded, textFieldStyle, addButtonStyle, regexExprDefaultValues, regexForValidation, disabled = false}) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [startsWithTextFieldValue, setStartsWithTextFieldValue] = React.useState('');
    const [containsTextFieldValue, setContainsTextFieldValue] = React.useState('');
    const [notContainsTextFieldValue, setNotContainsTextFieldValue] = React.useState('');
    const [endsWithTextFieldValue, setEndsWithTextFieldValue] = React.useState('');
    const [expressions, setExpressions] = React.useState<BasicKVP[]>(regexExprDefaultValues ?? []);
    const [openRegexAlert, setOpenRegexAlert] = React.useState(false);
    const [errMsg, setErrMsg] = React.useState('');

    function handleKeyDowwn(e: any) {
        if (e) {
            if (e.code === 13 || e.key.toUpperCase() === "ENTER") {
                onAddExpression();
                e.preventDefault();
            }
        }
    };


    function onAddExpression() {
        if(regexForValidation) {
            let errArr : string[] = [];
            let infArr = [ [startsWithTextFieldValue, "STARTSWITH"], [containsTextFieldValue, "CONTAINS"], 
                [notContainsTextFieldValue, "NOTCONTAINS"], [endsWithTextFieldValue, "ENDSWITH"] ];
            
            for(let item of infArr) {
                if(item[0].trim().length > 0) {
                    if(regexForValidation.test(item[0].trim()) === false) {
                        errArr.push(item[1])
                    }
                }
            }
            
            if(errArr.length > 0){
                setErrMsg(`Cannot add expression. Invalid characters detected for the following fields: [${errArr.join(", ")}]`)
                setOpenRegexAlert(true);
                return;
            }
        }
        
        //Example:  "^(CNV)+(?=.*WT)(?!.*((CLK)|(CK)))+(.*)$"

        let expr = Array.from(expressions)
        let sw = (startsWithTextFieldValue && startsWithTextFieldValue.length > 0) ? startsWithTextFieldValue : ".";
        let ct = (containsTextFieldValue && containsTextFieldValue.length > 0) ? containsTextFieldValue : ".";
        let nct = (notContainsTextFieldValue && notContainsTextFieldValue.length > 0) ? notContainsTextFieldValue : ".";
        let ew = (endsWithTextFieldValue && endsWithTextFieldValue.length > 0) ? endsWithTextFieldValue : ".";
        let regexStr = '';

        if(containsTextFieldValue === notContainsTextFieldValue){
            setErrMsg(`Could not add expression because the generated regex is invalid. --- CONTAINS equals NOTCONTAINS`)
            setOpenRegexAlert(true);
            return; 
        }

        if(!notContainsTextFieldValue || notContainsTextFieldValue.trim().length === 0) {
            regexStr = `^(${sw})+(?=.*${ct})((${ew})*)$`
        }
        else {
            regexStr = `^(${sw})+(?=.*${ct})(?!.*(${nct}))+((${ew})*)$`
        }
        
        try { let regexObj = RegExp(regexStr) }
        catch(err:any){
            setErrMsg(`Could not add expression because the generated regex is invalid. --- ${err.message}`)
            setOpenRegexAlert(true);
            return; 
        }

        let kvp : BasicKVP = { key: crypto.randomUUID(), value: regexStr.trim() }
        
        if(expr.every(a => ((a.key !== kvp.key) && (a.value !== kvp.value)))) {
            expr.push(kvp)
            setExpressions(expr)
            
            if (onExpressionAdded) {
                onExpressionAdded(expr);
            }

            setStartsWithTextFieldValue("");
            setContainsTextFieldValue("");
            setNotContainsTextFieldValue("");
            setEndsWithTextFieldValue("");
        }

        setErrMsg("")
        setOpenRegexAlert(false);
    }
 

    function onExpressionRemovalAction(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, data: any): void {
        if(data && data.key) {
            let expr = Array.from(expressions);
            expr = expr.filter(a => a.key !== data.key);
            setExpressions(expr);
        }
    }




    return (
        <Box>
            <Box sx={{ border: 1, borderRadius: 2, borderColor: colors.grey[300], backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, display: "flex", flexDirection: "column" }} >
                <Box sx={{ mt:2, ml: 2, mb: 1 }}>
                    <Typography sx={{color: colors.greenAccent[400]}}> {title ?? ''}</Typography>
                </Box>
                <div>
                    <Box sx={{display: "flex", flexDirection: "row", verticalAlign: "middle"}}>
                        
                        <TextField
                            disabled={disabled}
                            value={startsWithTextFieldValue}
                            label={"Starts With"}
                            variant="outlined"
                            size={"small"}
                            onChange={(e: any) => setStartsWithTextFieldValue(e.target.value)}
                            sx={textFieldStyle ?? { m: 1, width:"100%" }}
                            onKeyDown={(event) => {
                                handleKeyDowwn(event);
                            }} 
                        />

                        <Divider orientation="vertical" sx={{ mt: 1, height: 40, marginLeft: 1, marginRight: 1 }} />

                        <TextField
                            disabled={disabled}
                            value={containsTextFieldValue}
                            label={"Contains"}
                            variant="outlined"
                            size={"small"}
                            onChange={(e: any) => setContainsTextFieldValue(e.target.value)}
                            sx={textFieldStyle ?? { m: 1, width:"100%" }}
                            onKeyDown={(event) => {
                                handleKeyDowwn(event);
                            }} 
                        />

                        <Divider orientation="vertical" sx={{ mt: 1, height: 40, marginLeft: 1, marginRight: 1 }} />

                        <TextField
                            disabled={disabled}
                            value={notContainsTextFieldValue}
                            label={"Not-Contains"}
                            variant="outlined"
                            size={"small"}
                            onChange={(e: any) => setNotContainsTextFieldValue(e.target.value)}
                            sx={textFieldStyle ?? { m: 1, width:"100%" }}
                            onKeyDown={(event) => {
                                handleKeyDowwn(event);
                            }} 
                        />

                        <Divider orientation="vertical" sx={{mt: 1, height: 40, marginLeft: 1, marginRight: 1 }} />

                        <TextField
                            disabled={disabled}
                            value={endsWithTextFieldValue}
                            label={"Ends With"}
                            variant="outlined"
                            size={"small"}
                            onChange={(e: any) => setEndsWithTextFieldValue(e.target.value)}
                            sx={textFieldStyle ?? { m: 1, width:"100%" }}
                            onKeyDown={(event) => {
                                handleKeyDowwn(event);
                            }} 
                        />

                        <IconButton disabled={disabled} sx={{ml:.5}} size="small" onClick={() => onAddExpression()}>
                            <AddCircle sx={ addButtonStyle ?? { color: colors.grey[100]}} />  
                        </IconButton>
                        <Divider orientation="vertical" sx={{mt: 1, height: 40, marginLeft: .5, marginRight: 1 }} />

                    </Box>
                </div>
            
                <Box padding={1}>
                    <Table>
                        <TableBody>
                            {expressions.map((kvp: BasicKVP, index: number) => (
                                <Fragment key={`exp-frag-${index}`}>
                                    <TableRow key={`exp-tr-${index}`} >
                                    
                                        <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, width: "15%", padding: 0, textAlign: "center" }}>
                                            <Tooltip placement="top" title={``}>
                                                <span>
                                                    <IconButton disabled={disabled} size="small" onClick={(e) => onExpressionRemovalAction(e, kvp)}>
                                                        <Cancel sx={{ height: 22, padding: 0, color: SPECIAL_RED_COLOR }} />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </TableCell>

                                        <TableCell size="small" sx={{ borderBottomColor: undefined, minWidth: 30, maxWidth: 75, padding: 0, textAlign: "center" }}>
                                            <Box sx={{ padding: 0, overflowX: "hidden"}}>
                                                <span>
                                                    <Typography sx={{ fontSize: 11 }}>{`${kvp.value}`}</Typography> 
                                                </span>
                                            </Box>
                                        </TableCell>

                                    </TableRow>
                                </Fragment>
                            ))}
                        </TableBody>
                        
                    </Table>
                </Box>
                
                {openRegexAlert && <Alert color="error" severity="error" onClose={() => setOpenRegexAlert(false)}>{errMsg}</Alert>}
            </Box>
        </Box >
    );
}









// const [gridApi, setGridApi] = useState<GridApi>();
    

// const defaultColDef = useMemo(() => {
//     return {
//         flex: 1,
//     };
// }, []);


// const columnDefs: Array<ColDef | ColGroupDef> = [
//     {
//         headerName: "#",
//         valueGetter: "node.rowIndex + 1",
//         minWidth: 58,
//         width: 58,
//         maxWidth: 58,
//         resizable: false,
//         editable: false,
//         sort: "asc",
//     },
//     {
//         headerName: "Remove",
//         resizable: true,
//         minWidth: 130,
//         width: 130,
//         maxWidth: 130,
//         sortable: false,
//         editable: false,
//         cellStyle: (params: any) => { return { fontWeight : 'normal', display: "flex", alignItems: "center"} },
//         cellRenderer: function(params: any) {
//             return (
//                 <Box  key={`lg-rem-${params.data.name}`} sx={{display: "flex", flexDirection: "row"}} gap={1}>
//                     <Tooltip sx={{padding: "0px"}} key={`tt2-${params.data.name}`} placement="right" title={`Delete clearance relation named '${params.data.name}'`}>
//                         <span>
//                             <IconButton size="small" onClick={(e) => onExpressionRemovalAction(e, params.data)}>
//                                 <Cancel sx={{height: 22, padding: 0, color: SPECIAL_RED_COLOR}} />
//                             </IconButton>
//                         </span>
//                     </Tooltip>
//                 </Box>
//             )
//         },            
//     },
//     {
//         headerName: "Expression",
//         field: "key",
//         resizable: true,
//         filter: 'text',
//         cellDataType: 'text',
//         minWidth: 190,
//         width: 190,
//         autoHeight: true,
//         sort: "asc",
//         sortable: true,
//         editable: true,
//         sortingOrder: ["asc", "desc"],
//         cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} },
//         onCellValueChanged: handleExpressionChange
//     }
// ];


// const onGridReady = useCallback((params: any) => {
//     if(setGridApi) {
//         setGridApi(params.api as GridApi);
//     }
// }, []);
    



{/* <div style={{ height: "46vh", maxWidth: 1000}}>                                                          
                    <AgGridReact
                        rowData={expressions}
                        animateRows={true}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        onGridReady={onGridReady}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={false}
                        suppressCsvExport={false}   
                        groupDisplayType='singleColumn'    
                        groupDefaultExpanded={1}
                        rowHeight={28}
                        headerHeight={28}
                    />
                </div> */}