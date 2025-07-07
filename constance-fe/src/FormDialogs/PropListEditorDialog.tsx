import * as React from 'react';
import { Autocomplete, Box, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { useCallback, useContext, useMemo, useState } from "react";
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { BASIC_NAME_VALIDATION_REGEX, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_RED_COLOR, UIMessageType, NamingContentTypeEnum, CommonPropertyCategoryEnum, BASIC_NAME_VALIDATION_REGEX_WITH_SPACE } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from "../theme";
import { getViewableProperties, isNumber, rfdcCopy, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { BasicKVP, BasicProperty, PropertyItem, DisplayOption } from '../DataModels/HelperModels';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { MultiTextEntryField } from '../CommonComponents/MultiTextEntryField';
import { useSpiderStore } from '../DataModels/ZuStore';
import { SpButton } from '../CommonComponents/SimplePieces';



export interface PropListEditorDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string,
    onFormClosed : (data: PropertyItem[] | null, contextualInfo: BasicKVP) => void,
    contextualInfo: BasicKVP,
}

const PropListEditorDialog: React.FC<PropListEditorDialogProps> = ({ title, opened, close, onFormClosed, contextualInfo }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);

    const [fullPropertyList, setFullPropertyList] = useState<PropertyItem[]>([])
    const [viewableProps, setViewableProps] = useState<PropertyItem[]>([])
    const [deletedPropIdList, setDeletedPropIdList] = useState<string[]>([])

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
            sortable: false,
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
                function canPropBeDeleted(data: PropertyItem) {
                    if(data) {
                        if(data.category === CommonPropertyCategoryEnum.GENERAL_EDITABLE) {
                            return true;
                        }
                    }
                    return false;
                }
                return (
                    <Tooltip key={`pp-${params.data.name}`} placement="top" title={`Delete property '${params.data.name}'`}>
                        <IconButton onClick={(e) => onRemovalAction(e, params.data as PropertyItem)}>
                            <Cancel sx={{color: canPropBeDeleted(params.data) ? SPECIAL_RED_COLOR : colors.grey[400]}}  key={`pp-rem-${params.data.name}`}/>
                        </IconButton>
                    </Tooltip>
                )
            },            
        },
        {
            headerName: "Property Name",
            field: "name",
            valueGetter: (params: any) => {
                return (params && params.data.displayName || params.data.name)
            },
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 150,
            width: 150,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            sortingOrder: ["asc", "desc"],
            editable: (params) => {
                if(params && params.data) {
                    if((params.data as PropertyItem).category === CommonPropertyCategoryEnum.GENERAL_EDITABLE) {
                        return true;
                    }
                }
                return false
            },
        },
        {

            headerName: "Property Value",
            field: 'value',
            flex: 1,
            minWidth: 150,
            rowGroup: false,
            hide: false,
            resizable: true,
            sortable: true,
            cellEditor: 'agLargeTextCellEditor',
            cellEditorPopup: true,
            cellEditorParams: {
                maxLength: 260
            },
            editable: (params) => {
                if(params && params.data) {
                    if((params.data as PropertyItem).category === CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE 
                        || (params.data as PropertyItem).category === CommonPropertyCategoryEnum.GENERAL_CONFIGURED_NON_EDITABLE) {
                        return false;
                    }
                }
                return true
            },
        },
    ];
    
    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
        if(contextualInfo && contextualInfo.value) {
            let copy = rfdcCopy<PropertyItem>(contextualInfo.value) as PropertyItem[];
            let props = getViewableProperties(copy);
            setFullPropertyList(copy)
            setViewableProps(props)
        }
    }, []);
    

    const sectionStyle = useMemo(() => (
        { padding: 2, borderTopLeftRadius: 0, borderTopRightRadius: 200, borderBottomLeftRadius: 0, borderBottomRightRadius: 200, backgroundColor: colors.primary[400] }
    ), []);


    function onRemovalAction(e: any, prop: PropertyItem): void {
        if(prop && prop.name && prop.name.length > 0) {
            let newSet = viewableProps.filter(a => a.id !== prop.id)
            setViewableProps([...newSet]);
            let newDelArr = deletedPropIdList.concat([prop.id])
            setDeletedPropIdList([...newDelArr])
        }
    }
    

    function onNewPropertyNamesAdded(items: DisplayOption[]): void {
        if(items && items.length > 0) {
            let nameMap = new Map<string, string>();
            items.forEach(a => {
                if(a.label && a.label.trim().length > 0) {
                    let originalName = a.label.trim().replaceAll(/\s+/g, ' ');
                    let propNameMod = originalName.replaceAll(" ", "_");
                    nameMap.set(propNameMod, originalName)
                }
            })

            let existingNames = fullPropertyList.map(a => a.name.toLowerCase().trim()) ?? [];
            let okPropList = new Array<PropertyItem>();

            for(let [key, value] of nameMap) {
                if(existingNames.includes(key.toLowerCase()) === true) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Property named '${value}' cannot be added. A property with the same name already exists.`)
                    return;
                }

                try { verifyNaming([key], NamingContentTypeEnum.PROJECT_PROPERTY) }
                catch(e: any) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Property named '${value}' cannot be added. ${e.message}`)
                    return;
                }

                let prop: PropertyItem = {
                    id: crypto.randomUUID(),
                    name: key,
                    displayName: value,
                    category: CommonPropertyCategoryEnum.GENERAL_EDITABLE,
                    editable: true,
                    enabled: true,
                    value: ""
                }
                okPropList.push(prop);
            }

            let newPropList = [...viewableProps, ...okPropList] 
            setViewableProps(newPropList);
        }
    }

    
    function handleCancel() {
        if (onFormClosed) {
            onFormClosed(null, contextualInfo);
        }
        
        setFullPropertyList(new Array<PropertyItem>())
        setViewableProps(new Array<PropertyItem>())
        setDeletedPropIdList(new Array<string>())
        if(close){ close() }
    }


    function handleSubmit() {
        let added = viewableProps.filter(a => fullPropertyList.every(x => x.id !== a.id))
        let submitList = [...fullPropertyList]

        for(let i = 0; i < submitList.length; i++){
            let fProp = viewableProps.find(a => (a.id.trim().length !== 0) && (a.id === submitList[i].id))
            if(fProp) {
                submitList[i].value = fProp.value //set value for those that are edited
            }
        }
        
        if(added && added.length > 0) {
            added.forEach(a => submitList.push(a))
        }
        if(deletedPropIdList && deletedPropIdList.length > 0) {
            submitList = submitList.filter(a => (deletedPropIdList.includes(a.id) === false))
        }

        if (onFormClosed) {
            onFormClosed(submitList, contextualInfo);
        }

        setFullPropertyList(new Array<PropertyItem>())
        setViewableProps(new Array<PropertyItem>())
        setDeletedPropIdList(new Array<string>())

        if(close){ close() }
    }
    



    return (
        <Box>
            <Modal 
                opened={opened as boolean}
                onClose={handleCancel} 
                centered
                closeOnClickOutside={false}
                closeOnEscape={false}
                size="calc(100vw - 3rem)"
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
                            labelText={`Add new property name(s)`}
                            onItemAdded={(items: DisplayOption[]) => onNewPropertyNamesAdded(items)}
                            regexForValidation={BASIC_NAME_VALIDATION_REGEX_WITH_SPACE} 
                            textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, width: 1000}}
                            addButtonStyle={{ fontSize: 27}}
                        />

                        <Divider sx={{mt:2, mb: 1, mr:1}} />
                        <div style={{ height: "62vh", minWidth: "100%", width: "100%" }}>
                            
                            <AgGridReact
                                rowData={viewableProps}
                                animateRows={false}
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

export default PropListEditorDialog

