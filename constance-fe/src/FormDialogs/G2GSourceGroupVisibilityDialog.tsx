import * as React from 'react';
import { Box, Divider } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Modal, rem, Tabs } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from "../theme";
import { rfdcCopy, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { BasicKVP, LoggedInUser } from '../DataModels/HelperModels';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useSpiderStore } from '../DataModels/ZuStore';
import { G2GRelationContext } from '../DataModels/ServiceModels';
import { DUMMY_ELEMENT_ID_PREFIX } from '../BizLogicUtilities/BaseGridLogic';
import { SpButton } from '../CommonComponents/SimplePieces';



export interface G2GSourceGroupVisibilityDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string,
    g2gIdToNameMap: Map<string, string>,
    onFormClosed : (contextualInfo: BasicKVP|null) => void,
    contextualInfo: BasicKVP,
}

const G2GSourceGroupVisibilityDialog: React.FC<G2GSourceGroupVisibilityDialogProps> = ({ title, g2gIdToNameMap, opened, close, onFormClosed, contextualInfo }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;

    const [fullG2GDataMap, setFullG2GDataMap] = useState<Map<string, G2GRelationContext>>(new Map())
    const [g2gList, setG2GList] = useState<G2GRelationContext[]>([])

    const [gridApi, setGridApi] = useState<GridApi>();

    
    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const colColumnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "#",
            valueGetter: "node.rowIndex + 1",
            minWidth: 78,
            width: 78,
            maxWidth: 78,
            resizable: false,
            editable: false
        },
        {
            headerName: "Source Group",
            valueGetter: (params) => {
                let val = g2gIdToNameMap.get(params.data._id.toString() as string)
                return val;
            },
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            width: 200,
            flex: 1,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { 
                if(params.data.segment && params.data.segment.trim().length > 0) {
                    return { color: "#b9ffff", fontWeight: 'normal', textAlign: 'left' } as any
                }
                else if(params.data.channel && params.data.channel.trim().length > 0) {
                    return { color: "pink", fontWeight: 'normal', textAlign: 'left' } as any
                }
                else {
                    return { color: "#fff", fontWeight: 'normal', textAlign: 'left' } as any
                }
            }
        },
        {
            headerName: "Type/Level",
            valueGetter: (params) => {
                if(params.data.segment && params.data.segment.trim().length > 0) {
                    return "Subgroup"
                }
                else if(params.data.channel && params.data.channel.trim().length > 0) {
                    return "Channel"
                }
                else {
                    return "Interface"
                }
            },
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            width: 200,
            maxWidth: 250,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { 
                if(params.data.segment && params.data.segment.trim().length > 0) {
                    return { color: "#b9ffff", fontWeight: 'normal', textAlign: 'left' } as any
                }
                else if(params.data.channel && params.data.channel.trim().length > 0) {
                    return { color: "pink", fontWeight: 'normal', textAlign: 'left' } as any
                }
                else {
                    return { color: "#fff", fontWeight: 'normal', textAlign: 'left' } as any
                }
            }
        },
        {
            headerName: "Visible?",
            field: "enabled",
            resizable: false,
            cellDataType: 'boolean',
            autoHeight: true,
            minWidth: 200,
            width: 200,
            maxWidth: 200,
            sortable: false,
            editable: true,
            hide: false,
            mainMenuItems: (params: any) => {
                return (params.defaultItems as any[]).concat(getColumnMenuItems())
            },
            valueSetter: (params: any) => {
                params.data.enabled = params.newValue
                return true;
            },
            cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left', color: "white"} },          
        }
    ];
    
    
    function getColumnMenuItems() : any {
        let result = [
            'separator',
            {
                name: 'Select ALL',
                icon: '<span class="ag-icon ag-icon-arrows" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("all", true),
                disabled: false,
                tooltip: 'Select All Groups',
                cssClasses: ['bold'],
            },
            {
                name: 'Select All Interface-Level Groups',
                icon: '<span class="ag-icon ag-icon-tick" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("interface", true),
                disabled: false,
                tooltip: 'Mark all Interface-level groups as selected',
                cssClasses: ['bold'],
            },
            {
                name: 'Remove Only Interface-Level Groups',
                icon: '<span class="ag-icon ag-icon-tree-indeterminate" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("interface", false),
                disabled: false,
                tooltip: 'Deselect/Unselect all Interface-level groups',
                cssClasses: ['bold'],
            },
            {
                name: 'Select All Channel-Level Groups',
                icon: '<span class="ag-icon ag-icon-tick" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("channel", true),
                disabled: false,
                tooltip: 'Mark all Interface-level groups as selected',
                cssClasses: ['bold'],
            },
            {
                name: 'Remove Only Channel-Level Groups',
                icon: '<span class="ag-icon ag-icon-tree-indeterminate" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("channel", false),
                disabled: false,
                tooltip: 'Deselect/Unselect all Interface-level groups',
                cssClasses: ['bold'],
            },
            {
                name: 'Select All Subgroup-Level Groups',
                icon: '<span class="ag-icon ag-icon-tick" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("segment", true),
                disabled: false,
                tooltip: 'Mark all Interface-level groups as selected',
                cssClasses: ['bold'],
            },
             {
                name: 'Remove Only Subgroup-Level Groups',
                icon: '<span class="ag-icon ag-icon-tree-indeterminate" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("segment", false),
                disabled: false,
                tooltip: 'Deselect/Unselect all Interface-level groups',
                cssClasses: ['bold'],
            },
            {
                name: 'Remove ALL',
                icon: '<span class="ag-icon ag-icon-not-allowed" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction("clear", false),
                disabled: false,
                tooltip: 'Remove all selections',
                cssClasses: ['bold'],
            }
        ];

        return result;
    }

    
    function handleSelectionAction(action: string, isSelection: boolean) {
        let g2gListCopy = rfdcCopy<G2GRelationContext[]>(g2gList) as G2GRelationContext[]
        if(action.toLowerCase() === "all") {
            g2gListCopy.forEach(a => {a.enabled = true})
        }
        else if(action.toLowerCase() === "clear") {
            g2gListCopy.forEach(a => {a.enabled = false})
        }
        else if(action.toLowerCase() === "interface") {
            g2gListCopy.forEach(a => {
                if((!a.channel || a.channel.trim().length === 0) && (!a.segment || a.segment.trim().length === 0)) {
                    a.enabled = isSelection
                }
            })
        }
        else if(action.toLowerCase() === "channel") {
            g2gListCopy.forEach(a => {
                if(a.channel && a.channel.trim().length > 0 && (!a.segment || a.segment.trim().length === 0)) {
                    a.enabled = isSelection
                }
            })
        }
        if(action.toLowerCase() === "segment") {
            g2gListCopy.forEach(a => {
                if(a.segment && a.segment.trim().length > 0) {
                    a.enabled = isSelection
                }
            })
        }
        setG2GList(g2gListCopy);
    }


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }

        if(contextualInfo && contextualInfo.value && (contextualInfo.value as Map<string, G2GRelationContext>).size > 0) {
            let g2gMapCopy = rfdcCopy<Map<string, G2GRelationContext>>(contextualInfo.value) as Map<string, G2GRelationContext>
            let g2gFilterList = new Array<G2GRelationContext>();

            for(let [g2gId, g2g] of g2gMapCopy) {
                if((g2gId.startsWith(DUMMY_ELEMENT_ID_PREFIX) === false)) {
                    g2gFilterList.push(g2g);
                }
            }
            
            setG2GList(g2gFilterList);
            setFullG2GDataMap(g2gMapCopy);
        }
    }, []);
    

    function handleCancel() {
        if (onFormClosed) {
            onFormClosed(null);
        }
        setG2GList([])
        setFullG2GDataMap(new Map());
        if(close){ close() }
    }


    function handleSubmit() {
        if(g2gList.every(a => a.enabled === false)){
            displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed. At least one source group must be enabled `);
            return;
        }

        for(let k = 0; k < g2gList.length; k++) {
            fullG2GDataMap.set(g2gList[k]._id, g2gList[k])
        }
        contextualInfo.value = fullG2GDataMap  //NOTE this is intentionally a Map object
        if (onFormClosed) {
            onFormClosed(contextualInfo);
        }

        setG2GList([])
        setFullG2GDataMap(new Map());
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
                size="calc(60vw - 3rem)"
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 8,
                }}
                styles={{                 
                    title: { padding: 0, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: colors.grey[200], backgroundColor: colors.primary[400] }
                }}>
                    
                <Box sx={{ '& .MuiTextField-root': { width: '100%'}, }}>
                    
                    <Box flexDirection="column" alignItems="center" sx={{ padding: 2, borderTopLeftRadius: 0, borderTopRightRadius: 200, borderBottomLeftRadius: 0, borderBottomRightRadius: 200, backgroundColor: colors.primary[400] }}>
                        <Divider sx={{mt:0, mb: 2}} />
                       
                        <Divider sx={{mt:2, mb: 1}} />
                        <div style={{ height: "62vh", minWidth: "100%", width: "100%" }}>
                            <AgGridReact
                                rowData={g2gList}
                                animateRows={false}
                                columnDefs={colColumnDefs}
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

export default G2GSourceGroupVisibilityDialog














// cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left', color: colors.greenAccent[400]} },



// function getContextMenuItems2(params: GetContextMenuItemsParams): import("ag-grid-community").GetContextMenuItems<any, any> | undefined {=> {
//     let result = [
//         {
//             name: 'Select All',
//             icon: '<span class="ag-icon ag-icon-arrows" unselectable="on" role="presentation"></span>',
//             action: () => SelectAll(params, "interface"),
//             disabled: false,
//             tooltip: 'Select All Groups',
//             cssClasses: ['bold'],
//         },
//         {
//             name: 'Select All Interface-Level Elements',
//             icon: '<span class="ag-icon ag-icon-tick" unselectable="on" role="presentation"></span>',
//             action: () => SelectAll(params, "interface"),
//             disabled: false,
//             tooltip: 'Mark all Interface-level groups as selected',
//             cssClasses: ['bold'],
//         },
//         {
//             name: 'Select All Channel-Level Elements',
//             icon: '<span class="ag-icon ag-icon-tick" unselectable="on" role="presentation"></span>',
//             action: () => SelectAll(params, "channel"),
//             disabled: false,
//             tooltip: 'Mark all Interface-level groups as selected',
//             cssClasses: ['bold'],
//         },
//         {
//             name: 'Select All Subgroup-Level Elements',
//             icon: '<span class="ag-icon ag-icon-tick" unselectable="on" role="presentation"></span>',
//             action: () => SelectAll(params, "segment"),
//             disabled: false,
//             tooltip: 'Mark all Interface-level groups as selected',
//             cssClasses: ['bold'],
//         },
//         'separator',
//         {
//             name: 'De-Select All',
//             icon: '<span class="ag-icon ag-icon-tree-indeterminate" unselectable="on" role="presentation"></span>',
//             action: () => SelectAll(params, "clear"),
//             disabled: false,
//             tooltip: 'Remove all selections',
//             cssClasses: ['bold'],
//         },
//         'separator',
//         'copy',
//         'copyWithHeaders',
//         'copyWithGroupHeaders',
//         'separator',
//         'export'
//     ];

//     return result;
// }
