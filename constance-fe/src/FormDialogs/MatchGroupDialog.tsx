import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { AddCircleOutlineOutlined, Cancel, Check, CheckOutlined, PublishedWithChangesOutlined } from '@mui/icons-material';
import { useCallback, useContext, useMemo, useState } from "react";
import { ErrorOption, useForm } from 'react-hook-form';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FIXED_ALL, FIXED_KEY, INTERFACE_PROP_DESCRIPTION, BASIC_NAME_VALIDATION_REGEX, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_RED_COLOR, UIMessageType, NamingContentTypeEnum } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from "../theme";
import { isNumber, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { BasicKVP, BasicProperty, PropertyItem, DisplayOption } from '../DataModels/HelperModels';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { MultiTextEntryField } from '../CommonComponents/MultiTextEntryField';
import { getInterfaceTemplates } from '../BizLogicUtilities/FetchData';
import { useSpiderStore } from '../DataModels/ZuStore';
import { SpButton } from '../CommonComponents/SimplePieces';



export interface MatchGroupDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string,
    onFormClosed : (data: BasicProperty[] | null, contextualInfo: BasicKVP) => void,
    contextualInfo: BasicKVP,
}

const MatchGroupDialog: React.FC<MatchGroupDialogProps> = ({ title, opened, close, onFormClosed, contextualInfo }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);

    const[matchGroupProps, setMatchGroupProps] = useState<BasicProperty[]>([])

    const [gridApi, setGridApi] = useState<GridApi>();

    
    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "#",
            valueGetter: "node.rowIndex + 1",
            minWidth: 58,
            width: 58,
            maxWidth: 58,
            resizable: false,
            editable: false,
            sort: "asc",
        },
        {
            headerName: "Remove",
            resizable: false,
            autoHeight: true,
            minWidth: 130,
            width: 130,
            maxWidth: 130,
            sortable: false,
            editable: false,
            hide: false,
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left'} },
            cellRenderer: function(params: any) {             
                return (
                    <Tooltip key={`mg-${params.data.name}`} placement="top" title={`Delete match group name '${params.data.name}'`}>
                        <IconButton onClick={(e) => onMatchGroupRemovalAction(e, params.data as BasicProperty)}>
                            <Cancel sx={{color: SPECIAL_RED_COLOR }} key={`mg-rem-${params.data.name}`}/>
                        </IconButton>
                    </Tooltip>
                )
            },            
        },
        {
            headerName: "Match Group Name",
            field: "name",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 150,
            width: 150,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Tolerance Value",
            field: "value",
            resizable: true,
            filter: 'agNumberColumnFilter',
            cellDataType: 'number',
            minWidth: 150,
            width: 150,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            headerClass: "ag-align-center-header",
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'center' } },
        }
    ];
    
    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
        if(contextualInfo && contextualInfo.value) {
            setMatchGroupProps((contextualInfo.value as PropertyItem).value as BasicProperty[]);
        }
    }, []);
    

    const sectionStyle = useMemo(() => (
        { padding: 2, borderTopLeftRadius: 0, borderTopRightRadius: 200, borderBottomLeftRadius: 0, borderBottomRightRadius: 200, backgroundColor: colors.primary[400] }
    ), []);


    function onMatchGroupRemovalAction(e: any, propItem: BasicProperty): void {
        if(propItem && propItem.name && propItem.name.length > 0) {
            let relProps = Array.from(matchGroupProps)
            let remaining = relProps.filter(a => a.name !== propItem.name) ?? []
            setMatchGroupProps(remaining)
        }
    }
    

    function onMatchGroupNamesAdded(items: DisplayOption[]): void {
        if(items && items.length > 0) {
            let existingNames = matchGroupProps.map(a => a.name.toLowerCase().trim()) ?? []
            let checkRes = items.some(a => existingNames.includes(a.label.toLowerCase().trim()))
            if(checkRes === true) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Match-group name already exists for project. Duplicate names are not allowed`)
            }
            else {
                let itemNames = items.map(a => a.label)
                try { verifyNaming(itemNames, NamingContentTypeEnum.MATCH_GROUP) }
                catch(e: any){
                    displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                    return;
                }

                let mgProps = Array.from(matchGroupProps)
                for(let i = 0; i < items.length; i++) {
                    let propItem: BasicProperty = {
                        id: crypto.randomUUID(),
                        name: items[i].label,
                        value: 0,  
                    }
                    mgProps.push(propItem);
                }
                setMatchGroupProps(mgProps)
                // if(gridApi) { gridApi.setGridOption('rowData', matchGroupProps ?? []) }
            }
        }
    }

    
    function handleCancel() {
        if (onFormClosed) {
            onFormClosed(null, contextualInfo);
        }
        
        setMatchGroupProps(new Array<BasicProperty>())
        if(close){ close() }
    }


    function handleSubmit() {
        if(matchGroupProps && matchGroupProps.length > 0) {
            let nameList = matchGroupProps.map(a => a.name)
            try { verifyNaming(nameList, NamingContentTypeEnum.MATCH_GROUP) }
            catch(e: any) {
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }

            for(let i = 0; i < matchGroupProps.length; i++) {
                let result = isNumber(matchGroupProps[i].value) 
                if(result === false) {
                    displayQuickMessage(UIMessageType.ERROR_MSG,`Non numeric value detected for a match group '${matchGroupProps[i].name}'. Please make corrections`)
                    return;
                }
            }

            if (onFormClosed) {
                onFormClosed(matchGroupProps, contextualInfo);
            }
        }
        else {
            displayQuickMessage(UIMessageType.ERROR_MSG, `No matchGroup data to submit`)
        }

        setMatchGroupProps(new Array<BasicProperty>())
        if(close){ close() }
    }
    






    return (
        <Box>
            <Modal 
                opened={opened as boolean}
                onClose={handleCancel} 
                centered
                size="auto"  //'xs' | 'sm' | 'md' | 'lg' | 'xl';
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 8,
                }}
                styles={{
                    
                    title: { padding: 0, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: SPECIAL_RED_COLOR, backgroundColor: colors.primary[400] }
                }}>
                    <Box sx={{ '& .MuiTextField-root': { width: '100%'}, }}>
                        
                        <Box flexDirection="column" alignItems="center" sx={sectionStyle}>
                            <Divider sx={{mt:0, mb: 2}} />
                            <MultiTextEntryField 
                                labelText={`Add new match group name(s)`}
                                onItemAdded={(items: DisplayOption[]) => onMatchGroupNamesAdded(items)}
                                regexForValidation={BASIC_NAME_VALIDATION_REGEX} 
                                textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, width: 1000}}
                                addButtonStyle={{ fontSize: 27}}
                            />

                            <Divider sx={{mt:2, mb: 1, mr:1}} />
                            <div style={{ height: "62vh", minWidth: 700, maxWidth: 1000}}>
                                
                                <AgGridReact
                                    rowData={matchGroupProps}
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
                                    rowHeight={25}
                                    headerHeight={28}
                                />
                            </div>
                            
                        </Box>

                    </Box>

                    <Divider sx={{ mt: 1, mb: 1 }}/>
                    
                    <SpButton
                        intent="cancel"
                        onClick={handleCancel}
                        startIcon={<Cancel />}
                        sx={{ m: 1, mb: 0, height: 32, width:200 }}
                        label="Cancel" />

                    <SpButton
                        intent="plain"
                        onClick={handleSubmit}
                        type="submit"
                        startIcon={<Check />}
                        sx={{ m: 1, mb: 0, height: 32, width:200 }}
                        label="Save" />
            </Modal>
        </Box>
    );
}

export default MatchGroupDialog

