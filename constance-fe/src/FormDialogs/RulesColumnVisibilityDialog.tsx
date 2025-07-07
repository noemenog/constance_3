import * as React from 'react';
import { Autocomplete, Box, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { AspectRatio, Cancel, Check, FileUploadOutlined, ShortTextOutlined, ViewWeekOutlined } from '@mui/icons-material';
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Modal, rem, Tabs } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ConstraintTypesEnum, PermissionActionEnum, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from "../theme";
import { getViewableProperties, groupBy, isNumber, rfdcCopy, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { BasicKVP, BasicProperty, PropertyItem, DisplayOption, LoggedInUser } from '../DataModels/HelperModels';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useSpiderStore } from '../DataModels/ZuStore';
import { Interface, PackageLayout, Project, RuleArea } from '../DataModels/ServiceModels';
import { isUserApprovedForCoreAction } from '../BizLogicUtilities/Permissions';
import { SpButton } from '../CommonComponents/SimplePieces';



export interface RRVisibilityData {
    iface: Interface, 
    pkgLayout: PackageLayout, 
    visProps: PropertyItem[] 
} 

interface RuleAreaVisibilityOption {
    raid: string,
    raName: string,
    ifaceName: string,
    constraintType: ConstraintTypesEnum,
    isVisible: boolean,
}



export interface RulesColumnVisibilityDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string,
    constraintType: ConstraintTypesEnum,
    showNetProps: boolean,
    project: Project,
    onFormClosed : (contextualInfo: BasicKVP|null) => void,
    contextualInfo: BasicKVP,
}

const RulesColumnVisibilityDialog: React.FC<RulesColumnVisibilityDialogProps> = ({ title, constraintType, showNetProps, project, opened, close, onFormClosed, contextualInfo }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;

    const [fullPropertyList, setFullPropertyList] = useState<PropertyItem[]>([])
    const [viewableProps, setViewableProps] = useState<PropertyItem[]>([])

    const [ruleAreaVisibilityOptions, setRuleAreaVisibilityOptions] = useState<RuleAreaVisibilityOption[]>([])

    const [gridApi, setGridApi] = useState<GridApi>();

    const [selectedTab, setSelectedTab] = useState<string>('columns');

    const iconStyle = { width: rem(12), height: rem(12) };

    const viewablePropsOriginalRef = useRef<Map<string, PropertyItem>>(new Map<string, PropertyItem>()); 
    const ruleAreaVisibilityOptionsOriginalsRef = useRef<Map<string, RuleAreaVisibilityOption>>(new Map<string, RuleAreaVisibilityOption>());


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
            editable: false,
        },
        {
            headerName: "Constraint",
            field: "displayName",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 300,
            width: 300,
            flex: 1,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left', color: colors.greenAccent[400]} },
        },
        {
            headerName: "Type",
            field: "category",
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
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
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
                return (params.defaultItems as any[]).concat(getColumnMenuItems(true))
            },
            valueSetter: (params: any) => {
                (params.data as PropertyItem).enabled = params.newValue
                return true;
            },
            cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left', color: "white"} },          
        }
    ];
    

    
    const ruleAreaColumnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "#",
            valueGetter: "node.rowIndex + 1",
            minWidth: 78,
            width: 78,
            maxWidth: 78,
            resizable: false,
            editable: false,
        }, 
        {
            headerName: "Rule Area",
            field: "raName",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 300,
            width: 300,
            flex: 1,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left', color: colors.greenAccent[400]} },
        },
        {
            headerName: "Interface",
            field: "ifaceName",
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
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Type",
            field: "constraintType",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 170,
            width: 170,
            maxWidth: 250,
            autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Visible?",
            field: "isVisible",
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
                return (params.defaultItems as any[]).concat(getColumnMenuItems(false))
            },
            valueSetter: (params: any) => {
                (params.data as RuleAreaVisibilityOption).isVisible = params.newValue
                return true;
            },
            cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left', color: "white"} },          
        }
    ];
    

    function getColumnMenuItems(isForConstraints: boolean) : any {
        let result = [
            'separator',
            {
                name: 'Select All',
                icon: '<span class="ag-icon ag-icon-arrows" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction(isForConstraints, "all"),
                disabled: false,
                tooltip: 'Select All',
                cssClasses: ['bold'],
            },
            {
                name: 'Deselect/Unselect All',
                icon: '<span class="ag-icon ag-icon-not-allowed" unselectable="on" role="presentation"></span>',
                action: () => handleSelectionAction(isForConstraints, "clear"),
                disabled: false,
                tooltip: 'Remove all selections',
                cssClasses: ['bold'],
            }
        ];

        return result;
    }


    function handleSelectionAction(isForConstraints: boolean, action: string) {
        if(isForConstraints) {
            let propListCopy = rfdcCopy<PropertyItem[]>(viewableProps) as PropertyItem[]
        
            if(action.toLowerCase() === "all") {
                propListCopy.forEach(a => {a.enabled = true})
            }
            else if(action.toLowerCase() === "clear") {
                propListCopy.forEach(a => {a.enabled = false})
            }
            setViewableProps(propListCopy);
        }
        else {
            let raVisListCopy = rfdcCopy<RuleAreaVisibilityOption[]>(ruleAreaVisibilityOptions) as RuleAreaVisibilityOption[]
        
            if(action.toLowerCase() === "all") {
                raVisListCopy.forEach(a => {a.isVisible = true})
            }
            else if(action.toLowerCase() === "clear") {
                raVisListCopy.forEach(a => {a.isVisible = false})
            }
            setRuleAreaVisibilityOptions(raVisListCopy);
        }
    }


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }

        if(contextualInfo && contextualInfo.value && contextualInfo.value.pkgLayout && contextualInfo.value.visProps) {
            //initialize columns
            let visPropsCopy = rfdcCopy(contextualInfo.value.visProps) as PropertyItem[];
            setFullPropertyList(visPropsCopy)
            let viewablePropCols = Array.from(visPropsCopy);
            if(constraintType !== ConstraintTypesEnum.Physical) {
                viewablePropCols = viewablePropCols.filter(a => a.category.toLowerCase() !== "physical")
            }
            if(constraintType !== ConstraintTypesEnum.Clearance) {
                viewablePropCols = viewablePropCols.filter(a => a.category.toLowerCase() !== "clearance")
            }
            if(showNetProps === false) {
                viewablePropCols = viewablePropCols.filter(a => a.category.toLowerCase() !== "net")
            }
            setViewableProps(viewablePropCols);

            let origVPMap = new Map<string, PropertyItem>();
            (rfdcCopy(viewablePropCols) as PropertyItem[]).forEach(a => origVPMap.set(a.id, a))
            viewablePropsOriginalRef.current = origVPMap;

            //initialize rule areas
            let ravoList = new Array<RuleAreaVisibilityOption>();
            if(contextualInfo.value.pkgLayout.ruleAreas && contextualInfo.value.pkgLayout.ruleAreas.length > 0) {
                let raListCopy = rfdcCopy<RuleArea[]>(contextualInfo.value.pkgLayout.ruleAreas) as RuleArea[];
                for(let raItem of raListCopy) {
                    let ruleArea = raItem as RuleArea
                    
                    let ctxProp : BasicProperty|null = ruleArea.visibilityContext?.find(a => a.name === constraintType) ?? null
                    let doShowRA = true;
                    let iface = (contextualInfo.value.iface as Interface)

                    if(ctxProp && ctxProp.value && iface && iface._id && iface._id.toString().trim().length > 0) {
                        doShowRA = (ctxProp.value as string[]).includes(iface._id.toString()) ? false : true
                    }

                    let ravo: RuleAreaVisibilityOption = {
                        raid: ruleArea.id,
                        raName: ruleArea.ruleAreaName,
                        ifaceName: iface?.name || '',
                        constraintType: constraintType,
                        isVisible: doShowRA
                    }
                    ravoList.push(ravo)
                }
            }
            setRuleAreaVisibilityOptions(ravoList)
            
            let origRavoMap = new Map<string, RuleAreaVisibilityOption>();
            (rfdcCopy(ravoList) as RuleAreaVisibilityOption[]).forEach(a => origRavoMap.set(a.raid, a))
            ruleAreaVisibilityOptionsOriginalsRef.current = origRavoMap;
        }
    }, []);
    

    const sectionStyle = useMemo(() => (
        { padding: 2, borderTopLeftRadius: 0, borderTopRightRadius: 200, borderBottomLeftRadius: 0, borderBottomRightRadius: 200, backgroundColor: colors.primary[400] }
    ), []);

    
    function handleCancel() {
        if (onFormClosed) {
            onFormClosed(null);
        }
        
        setFullPropertyList(new Array<PropertyItem>())
        setRuleAreaVisibilityOptions(new Array<RuleAreaVisibilityOption>())
        if(close){ close() }
    }


    function handleSubmit() {
        if(viewableProps.every(a => a.enabled === false)){
            displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed. At least one rule (column) must be enabled `);
            return;
        }
        
        if(ruleAreaVisibilityOptions.every(a => a.isVisible === false)){
            displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot proceed. At least one rule-area must be enabled `);
            return;
        }

        let columnsVisChanged = viewableProps.some(a => viewablePropsOriginalRef.current.get(a.id)?.enabled !== a.enabled)
        if(columnsVisChanged) {
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CHANGE_COLUMN_VISIBILITY) === false) { return; }
        }

        let ruleAreaVisChanged = ruleAreaVisibilityOptions.some(a => ruleAreaVisibilityOptionsOriginalsRef.current.get(a.raid)?.isVisible !== a.isVisible)
        if(ruleAreaVisChanged) {
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CHANGE_RULEAREA_VISIBILITY) === false) { return; }
        }  

        let map = new Map<string, PropertyItem>();
        viewableProps.forEach(a => map.set(a.id, a))

        for(let item of fullPropertyList) {
            if(map.has(item.id)) {
                item = map.get(item.id) as PropertyItem
            }
        }

        (contextualInfo.value as RRVisibilityData).visProps = Array.from(fullPropertyList)

        let ifaceId  = (contextualInfo.value.iface as Interface)._id.toString()
        for(let ravo of ruleAreaVisibilityOptions) {
            for(let ra of (contextualInfo.value as RRVisibilityData).pkgLayout.ruleAreas) {
                if(ra.id === ravo.raid) {
                        let prop = ra.visibilityContext.find(a => a.name === constraintType)
                        if(ravo.isVisible) {
                            if(prop) {
                                prop.value = prop.value.filter((a: string) => a !== ifaceId);
                            }
                        }
                        else {
                            if(prop) {
                                let propVal = new Set(prop.value.concat([ifaceId]))
                                prop.value = Array.from(propVal);
                            }
                            else {
                                let newProp = { id: crypto.randomUUID(), name: constraintType, value: [ifaceId] } as BasicProperty
                                ra.visibilityContext.push(newProp)
                            }
                        }

                    break;
                }
            }
        }


        if (onFormClosed) {
            onFormClosed(contextualInfo);
        }

        setFullPropertyList(new Array<PropertyItem>())
        setViewableProps(new Array<PropertyItem>())
        setRuleAreaVisibilityOptions(new Array<RuleAreaVisibilityOption>())

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
                    
                    <Box flexDirection="column" alignItems="center" sx={sectionStyle}>
                        <Divider sx={{mt:0, mb: 2}} />
                       
                        <Tabs
                            className="tabs"
                            classNames={{ tab: "tabstab", panel: "tabspanel" }}
                            orientation="horizontal" 
                            keepMounted={true} //IMPORTANT!!!
                            value={selectedTab}
                            onChange={ (value) => {
                                if(value && value.length > 0) {
                                    setSelectedTab(value);
                                }
                            }}>
                        
                            <Tabs.List variant={"pills"} justify="left">
                                <Tabs.Tab value="columns" style={{width:300}} leftSection={<ViewWeekOutlined style={iconStyle} />}>
                                    <span>Columns</span><span style={{fontSize: 12}}>{" (project-wide setting)"}</span>
                                </Tabs.Tab>
                                <Tabs.Tab value="ruleareas" style={{width:300}} leftSection={<AspectRatio style={iconStyle} />}>
                                    <span>RuleAreas</span><span style={{fontSize: 12}}>{" (current interface only)"}</span>
                                </Tabs.Tab>
                            </Tabs.List>

                            <Tabs.Panel value="columns">
                                <Divider sx={{mt:2, mb: 1}} />
                                <div style={{ height: "62vh", minWidth: "100%", width: "100%" }}>
                                    <AgGridReact
                                        rowData={viewableProps}
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
                            </Tabs.Panel>

                            <Tabs.Panel value="ruleareas">
                                <Divider sx={{mt:2, mb: 1}} />
                                <div style={{ height: "62vh", minWidth: "100%", width: "100%" }}>
                                    <AgGridReact
                                        rowData={ruleAreaVisibilityOptions}
                                        animateRows={false}
                                        columnDefs={ruleAreaColumnDefs}
                                        defaultColDef={defaultColDef}
                                        onGridReady={undefined}
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
                            </Tabs.Panel>
                        </Tabs>
                    
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

export default RulesColumnVisibilityDialog







{/* <Divider sx={{mt:2, mb: 1}} />
    <div className={agTheme(theme.palette.mode)} style={{ height: "62vh", minWidth: "100%", width: "100%" }}>
        
        <AgGridReact
            rowData={viewableProps}
            animateRows={false}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowSelection={'multiple'}
            suppressExcelExport={false}
            suppressCsvExport={false}   
            groupDisplayType='singleColumn'    
            groupDefaultExpanded={1}
            rowHeight={25}
            headerHeight={28}
        />
    </div> */}
    