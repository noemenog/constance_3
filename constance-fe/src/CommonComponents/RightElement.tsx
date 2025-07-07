import { useNavigate } from "react-router-dom";
import { Box, Divider, IconButton, Snackbar, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography, useTheme } from "@mui/material";
import { ColorModeContext, tokens } from "../theme";
import styled from '@emotion/styled';
import { Fragment, useContext, useEffect, useMemo, useState } from "react";
import { useSpiderStore } from "../DataModels/ZuStore";
import { RestoreOutlined } from "@mui/icons-material";
import { fetchHistoricalChanges } from "../BizLogicUtilities/FetchData";
import { ConstraintTypesEnum, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_BLUE_COLOR } from "../DataModels/Constants";
import React from "react";
import { isConstraintValuesObject } from "../BizLogicUtilities/UtilFunctions";
import { ChangeContext } from "../DataModels/ServiceModels";
import { getMostAppropriateConstraintValue } from "../BizLogicUtilities/BasicCommonLogic";





interface RightElementProps {
    projectId: string,
    rowEntryId: string,
    dataEntryKeyName: string,
    dataEntryId: string,
    groupValue: string,
    groupLabel: string,
    panelHeight?: string,
    onRevertCellData: (element: [string, string, string]) => void
    onTransformValue?: (value: string) => string
}


const RightElement: React.FC<RightElementProps> = ({ projectId, rowEntryId, dataEntryKeyName, dataEntryId, groupValue, groupLabel, panelHeight, onRevertCellData, onTransformValue }) => {
    const theme : any = useTheme();
    const colors : any = tokens(theme.palette.mode);

    const bgColor = "rgb(255,255,255,0.9)"
    const PrevValTitleColor = "rgba(31,40,54, 0.75)" ;
    const prevValBGColor = undefined;
    
    const [previousValueInfoArray, setPreviousValueInfoArray] = useState<Array<[string, string, string]>>([]);


    useEffect(() => {
        const fetchData = async () => {
            let prevInfoArr = new Array<[string, string, string]>();
            let resp: ChangeContext = await fetchHistoricalChanges(projectId, `${rowEntryId}::${dataEntryId}`, 10);

            if(resp) {
                if(resp.data && Array.isArray(resp.data)) {
                    if(resp.data.some((a: any) => isConstraintValuesObject(a))) {
                        for(let x = 0; x < resp.data.length; x++) {
                            let value = getMostAppropriateConstraintValue(resp.data[x])
                            if(value && value.toString().length > 0) {
                                if(onTransformValue) {
                                    prevInfoArr.push([onTransformValue(value), "", ""]);
                                }
                                else {
                                    prevInfoArr.push([value, "", ""]);
                                }
                            }
                        }
                    }
                    else if(resp.data.some(x => (typeof(x) === "string"))) {
                        for(let str of resp.data) {
                            if(onTransformValue) {
                                prevInfoArr.push([onTransformValue(str), "", ""]);
                            }
                            else {
                                prevInfoArr.push([str, "", ""]);
                            }
                        }
                    }
                }

                if(resp.tags && resp.tags.length > 0){
                    resp.tags.find(a => a.startsWith("CHANGE_TIMES:"))?.replace("CHANGE_TIMES:", "")?.trim()?.split("|")?.forEach((a, i) => { 
                        prevInfoArr[i][1] = a.trim() 
                    })
                }

                if(resp.tags && resp.tags.length > 0){
                    resp.tags.find(a => a.startsWith("CHANGE_AGENTS:"))?.replace("CHANGE_AGENTS:", "")?.trim()?.split("|")?.forEach((a, i) => { prevInfoArr[i][2] = a.trim().toLowerCase().replace(".com", "") })
                }
            }

            setPreviousValueInfoArray(prevInfoArr);
        }

        fetchData();
    }, [rowEntryId, dataEntryId]); //Important!


    function handleOnRevertCellData(element: [string, string, string]): void {
        if(onRevertCellData) {
            onRevertCellData(element);
        }
    }

    
    let hasNonemptyValues = (previousValueInfoArray && previousValueInfoArray.length > 0);


    return (
        <Box>
            <Box width={200} sx={{
                height: panelHeight || "53vh", 
                borderTopLeftRadius: 10, 
                borderBottomLeftRadius: 10,
                backgroundColor: bgColor,
                color: "black",
                mt: 4
            }}> 
                <Divider sx={{mt: 1, mb: 1, ml: 2, width: "80%", backgroundColor: "rgb(255,255,255,0.1)"}} />
                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", height: "97%"}}>
                    <Divider sx={{mt: 0, mb: 0, ml: 2, width: "80%", backgroundColor: bgColor}} />
                    
                        <Table border={1}>
                            <TableHead>
                                <TableRow sx={{ padding: 0, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
                                    <TableCell size="small" sx={{ padding: 0.5, fontSize: 11, color: "#000000"}}>{`${groupLabel} :`}</TableCell>
                                    <TableCell colSpan={2} size="small" sx={{ padding: 0.5, fontSize: (groupValue.length > 27 ? 9.5 : 11), color: "#000000"}}>{`${groupValue}`}</TableCell>
                                </TableRow>
                                <TableRow sx={{ padding: 0, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
                                    <TableCell size="small" sx={{ padding: 0.5, fontSize: 11, color: "#000000"}}>COL :</TableCell>
                                    <TableCell colSpan={2} size="small" sx={{ padding: 0.5, fontSize: 11, color: "#000000"}}>{`${dataEntryKeyName}`}</TableCell>
                                </TableRow>
                                <TableRow sx={{ padding: 0}}>
                                    <TableCell colSpan={3} size="small" sx={{ height: 20, paddingLeft: .5, PaddingRight: 0, fontSize: 12, color: "#000000"}}>{" "}</TableCell>
                                </TableRow>
                                {hasNonemptyValues && <TableRow sx={{ padding: 0, backgroundColor: PrevValTitleColor}}>
                                    <TableCell colSpan={3} size="small" sx={{ maxHeight: 20, textAlign: "center", paddingLeft: .5, PaddingRight: 0 }}>
                                        <Typography sx={{ fontSize: 11, color: "#ffffff", padding: 0}}>{`Previous Values`}</Typography>
                                    </TableCell>
                                </TableRow>}
                            </TableHead>

                            {(hasNonemptyValues)
                            ? <TableBody>
                                {previousValueInfoArray.map((element: [string, string, string], index: number) => (
                                    <Fragment key={`re-frag-${index}`}>
                                        <TableRow key={`hist-tr-${index}`} >
                                        
                                            <TableCell rowSpan={2} size="small" sx={{ minWidth: 30, width: "20%", maxWidth: 75, backgroundColor: prevValBGColor, padding: 0, textAlign: "center" }}>
                                                <Tooltip placement="top" title={`${element[0]}`}>
                                                    <Box sx={{ padding: 0, overflowX: "hidden"}}>
                                                        <span>
                                                            <Typography sx={{ fontSize: element[0].length > 12 ? 8.5 : 10, color: "#000000"}}>{`${element[0]}`}</Typography> 
                                                        </span>
                                                    </Box>
                                                </Tooltip>
                                            </TableCell>

                                            <TableCell size="small" sx={{ maxWidth: 70, width: "65%", borderBottom: .4, borderBottomStyle: "dotted", 
                                                borderBottomColor: PrevValTitleColor, backgroundColor: prevValBGColor, padding: 0, color: "#000000", textAlign: "center" }}>
                                                <Box sx={{ padding: 0, overflowX: "clip"}}>
                                                    <Typography sx={{ fontSize: 8.5, color: "#000000", padding: .2}}>{`${element[1]}`}</Typography>
                                                </Box>
                                            </TableCell>

                                            <TableCell rowSpan={2} size="small" sx={{ width: "15%", backgroundColor: prevValBGColor, padding: 0, textAlign: "center" }}>
                                                <Tooltip placement="top" title={`Revert cell value to '${element[0]}'`}>
                                                    <span>
                                                        <IconButton sx={{ p: '2px', backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR }} onClick={() => handleOnRevertCellData(element)} >
                                                            <RestoreOutlined sx={{color: SPECIAL_BLUE_COLOR}} />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </TableCell>

                                        </TableRow>

                                        <TableRow key={`hist-tr2-${index}`} >
                                            <TableCell size="small" sx={{ maxWidth: 70, width: "60%", backgroundColor: prevValBGColor, padding: 0, color: "#000000", textAlign: "center" }}>
                                                <Box sx={{ padding: 0, overflowX: "clip"}}>
                                                    <Tooltip placement="top" title={`On: ${element[1]} | By: ${element[2]}`}>
                                                        <span>
                                                            <Typography sx={{ fontSize: 10, color: "#000000", padding: .2}}>{`${element[2]}`}</Typography>
                                                        </span>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    </Fragment>
                                ))}
                            </TableBody>
                            : <TableBody>
                                <Fragment key={`re-frag2`}>
                                    <TableRow key={`hist-tr-`} >
                                    
                                        <TableCell colSpan={3} size="small" sx={{ border: 1, minWidth: 30, width: "20%", backgroundColor: prevValBGColor, padding: 0, textAlign: "center" }}>
                                            <Typography sx={{ mt: 5, mb: 5, fontSize: 12.5, color: "#000000"}}>{`No historical data to display....`}</Typography> 
                                        </TableCell>

                                    </TableRow>
                                </Fragment>
                            </TableBody>}
                        </Table>
                        
                    
                    <Divider sx={{mt: 0, mb: 0, ml: 2, width: "80%", backgroundColor: bgColor}} />
                </Box>
            </Box>
        </Box>
    );
}

export default RightElement












            // if(resp && resp.data && resp.data.length > 0){
            //     for(let x = 0; x < resp.data.length; x++) {
            //         if(resp.data && resp.data.some((a: any) => isConstraintValuesObject(a))) {
            //             let value = getMostAppropriateConstraintValue(resp.data[x])
            //             if(value && value.toString().length > 0) {
            //                 if(onTransformValue) {
            //                     prevInfoArr.push([onTransformValue(value), "", ""]);
            //                 }
            //                 else {
            //                     prevInfoArr.push([value, "", ""]);
            //                 }
            //             }
            //         }
            //         else if(Array.isArray(resp.data) && typeof(resp.data[x]) === "string") {
            //             if(resp.data[x] && resp.data[x].toString().length > 0) {
            //                 if(onTransformValue) {
            //                     prevInfoArr.push([onTransformValue(resp.data[x]), "", ""]);
            //                 }
            //                 else {
            //                     prevInfoArr.push([resp.data[x], "", ""]);
            //                 }
            //             }
            //         }
                    
            //     }
            // }









// : <Typography sx={{mt: 1, mb:0 }}>{`No historical data....`}</Typography>