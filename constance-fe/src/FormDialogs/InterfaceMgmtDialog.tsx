import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, Divider, IconButton, Tooltip } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CommonPropertyCategoryEnum, NETCLASSES_PROP_NAME, INTERFACE_PROP_DESCRIPTION, INTERFACE_TEMPLATE_UPSERT_NAME,
    InterfaceInitTypeEnum, BASIC_NAME_VALIDATION_REGEX, NetclassNodeGenTypeEnum, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_RED_COLOR, UIMessageType, 
    NamingContentTypeEnum, PermissionActionEnum, 
    SPECIAL_DARK_GOLD_COLOR,
    CHANNEL_RANGE,
    AUTOMAP_PATTERN_CHANNEL_INDICATOR} from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from "../theme";
import { getDateAppendedName, groupBy, removeSubstringFromBeginning, rfdcCopy, splitIgnoreCase, verifyNaming, isNumber } from '../BizLogicUtilities/UtilFunctions';
import { BaseNCNode, IfaceTplCore, Interface, InterfaceTemplate, LayerGroupSet, Netclass, PackageLayout, Project } from '../DataModels/ServiceModels';
import { BasicKVP, BasicProperty, PropertyItem, DisplayOption, LoggedInUser, QuickStatus } from '../DataModels/HelperModels';
import { ColDef, ColGroupDef, GridApi, RowDragEvent } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { MultiTextEntryField } from '../CommonComponents/MultiTextEntryField';
import { fetchG2GContextList, getInterfaceTemplates, saveAsTemplate } from '../BizLogicUtilities/FetchData';
import { useSpiderStore } from '../DataModels/ZuStore';
import SimpleTextDialog, { SimpleTextDialogProps } from './SimpleTextDialog';
import { sort } from "fast-sort";
import { isUserApprovedForCoreAction } from '../BizLogicUtilities/Permissions';
import { generateSeqChannelShortString, getChannelNumArrayFromShortStr, getChannelRangeAndTemplateBasedNetclassListForInterface, getNetclassToChannelNameMapping } from '../BizLogicUtilities/BasicCommonLogic';
import { SpButton } from '../CommonComponents/SimplePieces';




export interface InterfaceMgmtDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string,
    project: Project,
    orgs: string[],
    packageLayout: PackageLayout,
    onFormClosed : (data: Interface | null, contextualInfo: BasicKVP) => void,
    contextualInfo: BasicKVP
}

const InterfaceMgmtDialog: React.FC<InterfaceMgmtDialogProps> = ({ title, project, orgs, packageLayout, opened, close, onFormClosed, contextualInfo }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled)

    const [selectedOrg, setSelectedOrg] = React.useState('')
    const [selectedTemplate, setSelectedTemplate] = React.useState<InterfaceTemplate|null>(null)
    const [interfaceNameSpecified, setInterfaceNameSpecified] = React.useState('')
    const [interfaceDescriptionSpecified, setInterfaceDescriptionSpecified] = React.useState('')
    const [channelRangeSpecified, setChannelRangeSpecified] = React.useState('')

    const [templatesForOrgMap, setTemplatesForOrgMap] = React.useState<Map<string, InterfaceTemplate>>(new Map<string, InterfaceTemplate>());
    const [netclassArray, setNetclassArray] = React.useState<Array<Netclass>>([]);

    const [simpleTextModalState, simpleTextModalActioner] = useDisclosure(false);
    const [simpleTextDialogProps, setSimpleTextDialogProps] = useState<SimpleTextDialogProps>()
    
    const disableOrgSelection = useRef<boolean>(false)
    const disableTemplateSelection = useRef<boolean>(false)
    
    const [gridApi, setGridApi] = useState<GridApi>();



    const isUpdateScenario = useMemo(() => {
        let isUpd = (contextualInfo && contextualInfo.value && contextualInfo.key && contextualInfo.key === "UPDATE_INTERFACE") ? true : false;
        return isUpd;
    }, [])
    

    const knownLayerGroupSets = useMemo(() => {
        let map = new Map<string, string>()
        let lgSets : LayerGroupSet[] = packageLayout?.layerGroupSets ?? []
        for(let i = 0; i < lgSets.length; i++) {
            map.set(lgSets[i].id, lgSets[i].name)
        }
        return map;
    }, []);


    const defaultLgSetId = useMemo(() => {
        let gldLGSet = packageLayout?.layerGroupSets?.find((a: LayerGroupSet) => (a.isGolden === true));
        let lgSets : LayerGroupSet[] = packageLayout?.layerGroupSets ?? []
        for(let i = 0; i < lgSets.length; i++) {
            if(lgSets[i].isPhysicalDefault === true) {
                return lgSets[i].id
            }
        }
        return gldLGSet?.id || '';
    }, []);


    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const autoGroupColumnDef = {
        minWidth: 200,
        width: 200,
        maxWidth: 300,
        resizable: true,
        cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
    }

    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "Remove",
            resizable: false,
            minWidth: 120,
            width: 120,
            maxWidth: 125,
            sortable: false,
            editable: false,
            rowDrag: true, //This allows for rearranging rows!! Important!
            cellStyle: (params: any) => { return { fontWeight : 'normal', display: "flex", alignItems: "center"} },
            cellRenderer: function(params: any) {
                return (
                    <Box  key={`lg-rem-${params.data.name}`} sx={{display: "flex", flexDirection: "row"}} gap={3}>
                        <Tooltip sx={{padding: "0px"}} key={`tt2-${params.data.name}`} placement="left" title={`Remove netclass: '${params.data.name}'`}>
                            <IconButton size="small" onClick={(e) => onDeleteNetclass(e, params.data)}>
                                <Cancel sx={{height: 22, padding: 0, color: SPECIAL_RED_COLOR }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )
            },            
        },
        {
            headerName: `Netclass Name ${(channelRangeSpecified && channelRangeSpecified.length > 0) ? "(Suffix)" : ""}`,
            field: "name",
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 250,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'Bold', textAlign: 'left' } },
            valueSetter: (params: any) => { 
                let valRes = validateNetclassNamesForChannelRange([params.newValue])
                if(valRes.isSuccessful === false) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Invalid netclass name. ${valRes.message}`);
                    return false;
                }
                
                try { verifyNaming([params.newValue], NamingContentTypeEnum.NETCLASS) }
                catch(e: any){
                    displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                    return false;
                }

                params.data.name = params.newValue
                return true;
            },
        },
        {
            headerName: "Layer Group Set",
            field: "layerGroupSetId",
            rowGroup: false,
            resizable: true,
            minWidth: 250,
            width: 250,
            editable: true,
            cellEditorPopup: false,
            enableCellChangeFlash: false,
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: {
                values: Array.from(knownLayerGroupSets.values())
            },
            valueGetter: params => {
                return knownLayerGroupSets?.get(params.data.layerGroupSetId) || '';
            },
            valueSetter: params => {
                const filtered = [...knownLayerGroupSets.entries()].filter(([key, value]) => value === params.newValue);
                params.data.layerGroupSetId = filtered[0][0];
                return true;
            },
        },
        {
            headerName: "Automap Pattern",
            field: 'pattern',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            width: 200,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} },
            cellRenderer: (params: { value: any; }) => {
                const value = params.value;
                if (value && (value as string).toLowerCase().includes(AUTOMAP_PATTERN_CHANNEL_INDICATOR.toLowerCase())) {
                    const parts = splitIgnoreCase(value, AUTOMAP_PATTERN_CHANNEL_INDICATOR);
                    return (
                        <>
                            <span>
                                <span>{parts[0]}</span>
                                <span style={{color: SPECIAL_RED_COLOR}}>{AUTOMAP_PATTERN_CHANNEL_INDICATOR}</span>
                                <span>{parts[1]}</span>
                            </span>
                        </>
                    );
                }
                return value;
            }
        },
        {
            headerName: "Grouping",
            field: 'segment',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 150,
            width: 150,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Node Type",
            field: 'nodeType',
            rowGroup: false,
            hide: false,
            resizable: false,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 130,
            width: 130,
            maxWidth: 130,
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        }
    ];


    const onGridReady = React.useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
        initializeForUpdateScenario();
    }, []);
    
    
    async function initializeForUpdateScenario() {
        if (isUpdateScenario){
            let interfaceToUpdate = contextualInfo.value as Interface
            //set the interface name
            setInterfaceNameSpecified(interfaceToUpdate.name);

            //set description
            let ifaceDesc = interfaceToUpdate.associatedProperties.find(a => a.name === INTERFACE_PROP_DESCRIPTION && a.category === CommonPropertyCategoryEnum.GENERAL_FIXED_KEY)
            setInterfaceDescriptionSpecified(ifaceDesc?.value ?? '')
            
            //set org and template
            disableOrgSelection.current = true;
            disableTemplateSelection.current = true;
            if(interfaceToUpdate.sourceTemplate && interfaceToUpdate.sourceTemplate.org && interfaceToUpdate.sourceTemplate.org.length > 0) {
                getInterfaceTemplates(interfaceToUpdate.projectId, interfaceToUpdate.sourceTemplate.org).then((templates: InterfaceTemplate[]) => {
                    if(templates && templates.length > 0) {
                        let template = templates.find(a => a.id === interfaceToUpdate.sourceTemplate.id)
                        if(!template || !template.id) {
                            template = templates.find(a => a.uniqueName === interfaceToUpdate.sourceTemplate.uniqueName)
                        }

                        if(template && template.id) {
                            setSelectedOrg(template.org)
                            setSelectedTemplate(template)
                        }

                        let map = new Map<string, InterfaceTemplate>();
                        templates.forEach(a => map.set(a.uniqueName, a));
                        setTemplatesForOrgMap(map);
                    }
                })
            }
            
            let res = await getChannelRangeAndTemplateBasedNetclassListForInterface(interfaceToUpdate);
            if(res.isSuccessful === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, res.message);
                return;
            }

            setChannelRangeSpecified(res.data?.channelRangeStr || "");
            setNetclassArray(res.data?.focusNetclasses ?? []);
        }
    }


    function onNetclassNamesAdded(items: DisplayOption[]): void {
        if(items && items.length > 0) {
            let existingNames = netclassArray.map(a => a.name.toLowerCase().trim())
            let checkRes = items.some(a => existingNames.includes(a.label.toLowerCase().trim()))
            if(checkRes === true) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Netclass name already exists for project. Duplicate names are not allowed`);
                return;
            }

            let valRes = validateNetclassNamesForChannelRange(items.map(a => a.label))
            if(valRes.isSuccessful === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Could not add netclasses. ${valRes.message}`);
                return;
            }

            let itemNames = items.map(a => a.label)
            try { verifyNaming(itemNames, NamingContentTypeEnum.NETCLASS) }
            catch(e: any){
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }

            let gridNCArrangement = getArrangedGridData()
            let newNCList = [...gridNCArrangement]
            for(let i = 0; i < items.length; i++) {
                let ncItem: Netclass = {
                    _id: '',
                    projectId: project?._id.toString() ?? '',
                    snapshotSourceId: '',
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    interfaceId: '',
                    name: items[i].label,
                    pattern: '',
                    patternIndex: -1,
                    nodeType: NetclassNodeGenTypeEnum.Manual,
                    layerGroupSetId: defaultLgSetId,
                    channel: "",
                    segment: "",
                    enableC2CRow: true,
                    enableC2CColumn: true,
                    associatedProperties: []
                }
                newNCList.push(ncItem)
            }
            setNetclassArray(newNCList)
            if(gridApi) { gridApi.setGridOption('rowData', newNCList) }
            
        }
    }


    function onOrgChange(event: any, selectedOrg: any) {
        setSelectedOrg(selectedOrg as string);
        setSelectedTemplate(null)
        setTemplatesForOrgMap(new Map<string, InterfaceTemplate>())
        getTemplatesForOrg(selectedOrg as string)
        let manNetclasses = netclassArray.filter(a => a.nodeType === NetclassNodeGenTypeEnum.Manual) ?? []
        setNetclassArray([...manNetclasses]);
    }


    function getTemplatesForOrg(org: string){
        if(org && org.length > 0) {
            setIsLoadingBackdropEnabled(true)
            getInterfaceTemplates(project?._id.toString() ?? '', org).then((templates: InterfaceTemplate[]) => {
                if(templates && templates.length > 0) {
                    let map = new Map<string, InterfaceTemplate>();
                    templates = sort(templates).asc(z => z.uniqueName);
                    templates.forEach(a => map.set(a.uniqueName, a));
                    setTemplatesForOrgMap(map);
                }
            })
            .finally(() => {
                setIsLoadingBackdropEnabled(false)
            })
        }
    }
    

    function onTemplateSelection(tplName: string) {
        let tpl = templatesForOrgMap.get(tplName) as InterfaceTemplate
        if(tpl) {
            
            let valRes = validateNetclassNamesForChannelRange(tpl.netclasses.map(a => (a as BaseNCNode).name))
            if(valRes.isSuccessful === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Could not use the selected template due to invalid netclass names. ${valRes.message}`);
                return;
            }

            let ncArr = new Array<Netclass>()
            for(let i = 0; i < tpl.netclasses.length; i++) {
                let nc: Netclass = {
                    _id: '',
                    projectId: project?._id.toString() ?? '',
                    snapshotSourceId: '',
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    interfaceId: '',
                    name: (tpl.netclasses[i] as BaseNCNode).name,
                    pattern: (tpl.netclasses[i] as BaseNCNode).pattern,
                    patternIndex: (tpl.netclasses[i] as BaseNCNode).patternIndex,
                    nodeType: NetclassNodeGenTypeEnum.Auto,
                    layerGroupSetId: defaultLgSetId,
                    channel: "",
                    segment: (tpl.netclasses[i] as BaseNCNode).segment || '',
                    enableC2CRow: true,
                    enableC2CColumn: true,
                    associatedProperties: []
                }
                ncArr.push(nc)
            }
            
            setInterfaceNameSpecified(tpl.interfaceName)
            setNetclassArray(ncArr);
            setSelectedTemplate(tpl) 
        }
    }


    function onDeleteNetclass(e: any, data: any): void {
        let newArr = [...netclassArray]
        newArr = newArr.filter(a => a.name !== data.name);
        setNetclassArray(newArr)
        if(gridApi) { gridApi.setGridOption('rowData', Array.from(netclassArray) ?? []) }  //TODO: uhm is this really necessary??
    }


    function getArrangedGridData(): Array<Netclass> {
        if(gridApi) {
            gridApi.redrawRows();
        }
        let res = (rfdcCopy<Netclass[]>(netclassArray) as Netclass[]) ?? []
        return res;
    }


    function handleSaveAsTemplate(): void {
        if(isUpdateScenario) {
            if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.SAVE_AS_TEMPLATE) === false) { return; }

            if(netclassArray && netclassArray.length > 0) {
                if(netclassArray.some(x => (x.channel && x.channel.length > 0))) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Sorry ${loggedInUser.givenName}, the 'Save-As-Template' feature is currently disabled for 'channelled' interfaces....`);
                    return;
                }
            }

            let simpleTextDialogProps: SimpleTextDialogProps = {
                onFormClosed: onSimpleTextDataAvailable,
                title: `Specify unique name for new [${project?.org}] interface template`,
                warningText: `WARNING: 'Please make sure a similar template does not already exist. Be careful not to unnecessarily polute the [${project?.org}] template storage space with redundant templates!`,
                defaultValue: getDateAppendedName(`${interfaceNameSpecified ?? "Custom"}_Template`),
                unacceptbleValues: Array.from(templatesForOrgMap.keys()),
                contextualInfo: { key: "SAVE_TEMPLATE", value: null },
            }
            setSimpleTextDialogProps(simpleTextDialogProps)
            simpleTextModalActioner.open()
        }
    }


    async function onSimpleTextDataAvailable(uniqueName: string | null, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key && contextualInfo.key === "SAVE_TEMPLATE") {
            if(uniqueName && uniqueName.length > 0) {
                try { verifyNaming([uniqueName], NamingContentTypeEnum.INTERFACE_TEMPLATE) }
                catch(e: any){
                    displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                    return;
                }
                let info = {...(handleSubmit(true))}
                if(info && info.iface && info.netclasses) {
                    let netclassProp : BasicProperty = {
                        id: "",
                        name: NETCLASSES_PROP_NAME,
                        value: info.netclasses
                    }
                    
                    let templateNameProp : BasicProperty = {
                        id: "",
                        name: INTERFACE_TEMPLATE_UPSERT_NAME,
                        value: uniqueName
                    }

                    info.iface.contextProperties.push(netclassProp);
                    info.iface.contextProperties.push(templateNameProp);

                    saveAsTemplate(info.iface).then((retTemplate: InterfaceTemplate) => {
                        if(retTemplate) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Interface setup was saved as a template for current project's org: ${project?.org?.toUpperCase()}`)
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, `Interface setup was not successfully saved as template`)
                        }
                    })
                }
            }
        }
    }


    function validateNetclassNamesForChannelRange(nameList: string[]) : QuickStatus<any>{
        if(channelRangeSpecified && channelRangeSpecified.length > 0) {
            let chInfo = getChannelNumArrayFromShortStr(channelRangeSpecified);
            if(chInfo.isSuccessful === false) {
                return { isSuccessful: false, message: `Error - ${chInfo.message}`} as QuickStatus<any>;
            }
            else if(!interfaceNameSpecified || (interfaceNameSpecified.length === 0)) {
                return { isSuccessful: false, message: `If channel range is specified, then interface name must be valid and non-empty.`} as QuickStatus<any>;
            }
            else if(chInfo.data && chInfo.data.length > 0) {
                let badNames = new Set<string>();
                for(let name of nameList) {
                    for(let channel of chInfo.data) {
                        let chPrefix = `${interfaceNameSpecified}${channel}`;  //inportant!
                        if(name.trim().toUpperCase().startsWith(chPrefix.trim().toUpperCase())) {
                            badNames.add(name);
                        }
                    }
                }
                
                if(badNames.size > 0) {
                    let msg = `Netclass name cannot start with channel indicator. The system will add the prefix when netclasses are created. [${(Array.from(badNames)).join(", ")}]`;
                    return { isSuccessful: false, message: msg} as QuickStatus<any>;
                }
            }
        }

        return {isSuccessful: true, message: ''} as QuickStatus<any>;
    }


    function handleSubmit(forTemplateSaveAction: boolean) : {iface: Interface, netclasses: Netclass[]} | undefined {
        let iface: Interface;
        if(!interfaceNameSpecified || interfaceNameSpecified.trim().length === 0) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Interface name is required. Please enter a name for the interface`)
            return;
        }

        try {
            verifyNaming([interfaceNameSpecified], NamingContentTypeEnum.INTERFACE)
        }
        catch(e:any) {
            displayQuickMessage(UIMessageType.ERROR_MSG, e.message);
            return;
        }
        
        if(channelRangeSpecified && channelRangeSpecified.length > 0) {
            let res = getChannelNumArrayFromShortStr(channelRangeSpecified);
            if(res.isSuccessful === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, res.message);
                return;
            }
        }
        
        let netclasses = getArrangedGridData()
        if(!netclasses || netclasses.length === 0) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Interface must have at least one netclass. Please add one or more net classes`)
            return;
        }

        if(netclasses.some(a => (a.segment && (a.segment.trim().length > 0)))) {
            if(netclasses.some(a => (!a.segment || (a.segment.trim().length  === 0)))) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `If any netclass is assigned to a group, then all netclasses must be assigned to a group`)
                return;
            }
        }

        for(let i = 0; i < netclasses.length; i++) {
            netclasses[i].patternIndex = i; //IMPORTANT!!! - re-arrange according to grid result!
        }

        if(forTemplateSaveAction || (contextualInfo && contextualInfo.key === "UPDATE_INTERFACE")) {
            //Interface update OR template save scenario
            iface = {...contextualInfo.value}
            iface.lastUpdatedOn = new Date()
            iface.name = interfaceNameSpecified
            
            let descProp = iface.associatedProperties.find(a => a.category === CommonPropertyCategoryEnum.GENERAL_FIXED_KEY && a.name === INTERFACE_PROP_DESCRIPTION) as PropertyItem
            descProp.value = interfaceDescriptionSpecified

            let others = iface.associatedProperties.filter(a => a.category !== CommonPropertyCategoryEnum.GENERAL_FIXED_KEY && a.name !== INTERFACE_PROP_DESCRIPTION)
            iface.associatedProperties = others.concat([descProp])
            
            netclasses.forEach(a => a.interfaceId = iface._id?.toString())
        }
        else {
            //New Interface scenario
            let srcTplInfo : IfaceTplCore = {
                id: selectedTemplate?.id || '',
                org: selectedTemplate?.org || '',
                uniqueName: selectedTemplate?.uniqueName || '',
                owner: selectedTemplate?.owner || ''
            };

            iface = {
                _id: '',
                projectId: project?._id.toString() || '',
                snapshotSourceId: '',
                contextProperties: [],
                lastUpdatedOn: new Date(),
                name: interfaceNameSpecified,
                sourceInterfaceId: '',
                sourceProjectId: '',
                initializationType: InterfaceInitTypeEnum.FRESH,
                createdOn: new Date(),
                createdBy: '',
                sourceTemplate: srcTplInfo,
                shadowVoidEntries: [],
                associatedProperties: [],
                notes: null,
            } 

            let descProp : PropertyItem = {
                id: crypto.randomUUID(),
                name: INTERFACE_PROP_DESCRIPTION,
                displayName: INTERFACE_PROP_DESCRIPTION,
                value: interfaceDescriptionSpecified,
                category: CommonPropertyCategoryEnum.GENERAL_FIXED_KEY,
                editable: true,
                enabled: true,
                contextProperties: [
                    {
                        id: crypto.randomUUID(),
                        name: "export_context",
                        value: {
                            subType: "INTERFACE_DESCRIPTION",
                            exportEnabled: true
                        }
                    } as BasicProperty
                ]
            }

            iface.associatedProperties.push(descProp)
        }
        
        contextualInfo.value = Array.from(netclasses)

        let netclassProp : BasicProperty = { id: crypto.randomUUID(), name: NETCLASSES_PROP_NAME, value: Array.from(netclasses) }
        iface.contextProperties = iface.contextProperties.filter(a => a.name !== NETCLASSES_PROP_NAME) ?? []
        iface.contextProperties.push(netclassProp);

        let channelRangeProp : BasicProperty = { id: crypto.randomUUID(), name: CHANNEL_RANGE, value: channelRangeSpecified }
        iface.contextProperties = iface.contextProperties.filter(a => a.name !== CHANNEL_RANGE) ?? []
        iface.contextProperties.push(channelRangeProp);

        if(forTemplateSaveAction === false) {
            if (onFormClosed) {
                onFormClosed(iface, contextualInfo);
            }
            performReset()
            if(close){ close() }
        }
        
        return {iface: iface, netclasses: contextualInfo.value}
    }


    function handleCancel() {
        if (onFormClosed) {
            onFormClosed(null, contextualInfo);
        }
        performReset()
        if(close){ close() }
    }

    
    function performReset() {
        setSelectedOrg('');
        setSelectedTemplate(null)
        setInterfaceNameSpecified('')
        setInterfaceDescriptionSpecified('')
        setTemplatesForOrgMap(new Map<string, InterfaceTemplate>())
        setNetclassArray(new Array<Netclass>())
    }



    return (
        <Box>
            <Modal 
                opened={opened as boolean}
                onClose={handleCancel} 
                closeOnClickOutside={false}
                closeOnEscape={false}
                centered
                // size="auto"  //'xs' | 'sm' | 'md' | 'lg' | 'xl';
                size="calc(100vw - 3rem)"
                yOffset={"0vh"} 
                xOffset={100}
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 8,
                }}
                styles={{
                    
                    title: { padding: 2, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: "red", backgroundColor: colors.primary[400] }
                }}>
                    <Box sx={{ '& .MuiTextField-root': { width: '100%'} }}>

                        <Divider sx={{ mt: 0, mb: 0 }} /> 

                        <Box>
                            <Box sx={{display: "flex", flexDirection:"row", justifyContent: "space-between", mb: 0}} >
                                <Box sx={{ display: "flex", flex: 1}}>
                                    <Autocomplete 
                                        value={selectedOrg?.toString() ?? ''}
                                        onChange={onOrgChange}
                                        key="iface-org-CB"
                                        freeSolo={false}
                                        filterSelectedOptions={true}
                                        disablePortal
                                        disableListWrap
                                        disabled={disableOrgSelection.current ?? false}
                                        size="small"
                                        id="iface-org-cb"
                                        sx={{ mb: 2, mt: 2, minWidth: "100%"}}
                                        options={['', ...[...orgs]]}
                                        renderInput={(params) => <TextField {...params} label="Org/Business Unit (optional - for template selection)" size="small" />}
                                    />
                                </Box>
                                <Box sx={{display: "flex", flexDirection:"row", justifyContent: "center", alignItems:"center", mt: 0}}>
                                    <Divider orientation="vertical" sx={{height: 35, marginLeft: 3, marginRight: 3 }} />
                                </Box>
                                <Box sx={{ display: "flex", flex: 1}}>
                                    <Autocomplete 
                                        value={selectedTemplate?.uniqueName?.toString() ?? ''}
                                        onChange={(event: any, tplName: string|null) => {
                                            if(tplName && templatesForOrgMap.has(tplName)) {
                                                onTemplateSelection(tplName)
                                            }
                                        }}
                                        key="iface-template-CB"
                                        freeSolo={false}
                                        filterSelectedOptions={true}
                                        disablePortal
                                        disableListWrap
                                        disabled={(selectedOrg && selectedOrg.length > 0 && disableTemplateSelection.current !== true) ? false : true}
                                        size="small"
                                        id="iface-template-cb"
                                        sx={{ mb: 2, mt: 2, minWidth: "100%" }}
                                        options={['', ...[...templatesForOrgMap.keys()]]}
                                        renderInput={(params) => <TextField {...params} label="Select Template (optional)" size="small" />}
                                    />
                                </Box>
                            </Box>

                            <Box sx={{display: "flex", flexDirection:"row", justifyContent: "space-between", mb: 3 }}>
                                <TextField
                                    value={interfaceNameSpecified}
                                    id="iface-name-text"
                                    label="Specify a name for new interface"
                                    variant="outlined"
                                    required
                                    size="small" 
                                    onChange={(e: any) => { setInterfaceNameSpecified(e.target.value) }}
                                    sx={{ mb: 2 }} 
                                />
                                <Box sx={{display: "flex", flexDirection:"row", justifyContent: "center", alignItems:"center", mt: -2}}>
                                    <Divider orientation="vertical" sx={{height: 35, marginLeft: 3, marginRight: 3 }} />
                                </Box>
                                <TextField
                                    value={channelRangeSpecified}
                                    id="channel-name-text"
                                    label="Specify channel range (optional)"
                                    variant="outlined"
                                    size="small"
                                    disabled={(interfaceNameSpecified && interfaceNameSpecified.length > 0) ? false : true}
                                    onChange={(e: any) => { setChannelRangeSpecified(e.target.value) }}
                                    sx={{ mb: 2, fieldset : { borderColor: (channelRangeSpecified && channelRangeSpecified.length > 0) ? SPECIAL_DARK_GOLD_COLOR : undefined } }}
                                />
                            </Box>
                        </Box>

                        <TextField 
                            value={interfaceDescriptionSpecified}
                            id="iface-desc-text"
                            label="Provide description for interface"
                            multiline
                            size="small"
                            maxRows={3}
                            disabled={(interfaceNameSpecified && interfaceNameSpecified.length > 2 ) ? false : true}
                            onChange={(e: any) => { setInterfaceDescriptionSpecified(e.target.value) }}
                            sx={{ mb: 1}} 
                        />

                        <Box sx={{mt: 3, display: "flex", flexDirection:"column"}} >
                            <MultiTextEntryField 
                                labelText={`Add Netclasses (comma separated)`}
                                onItemAdded={(items: DisplayOption[]) => onNetclassNamesAdded(items)}
                                regexForValidation={BASIC_NAME_VALIDATION_REGEX} 
                                textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, width: 1000}}
                                addButtonStyle={{ fontSize: 27}}
                            />

                            <Divider sx={{mt: 3, mb: 0, backgroundColor: colors.greenAccent[400]}}/>

                            <div style={{ height: "42vh", minWidth: "70vw", marginTop: 11}}>
                                <AgGridReact
                                    rowData={netclassArray ?? []}
                                    rowDragManaged={true}
                                    animateRows={true}
                                    columnDefs={columnDefs}
                                    defaultColDef={defaultColDef}
                                    autoGroupColumnDef={autoGroupColumnDef}
                                    onGridReady={onGridReady}
                                    theme={themeDarkBlue}
                                    rowSelection={{ mode: "singleRow", checkboxes: false }}
                                    suppressExcelExport={false}
                                    suppressCsvExport={false}   
                                    groupDisplayType='singleColumn'    
                                    groupDefaultExpanded={0}
                                    rowHeight={33}
                                    headerHeight={33}
                                />
                            </div> 

                        </Box>

                    </Box>

                    <Divider sx={{ mt: .5, mb: .5 }}/>
                    
                    <Box sx={{display: "flex", flexDirection:"row", justifyContent: "space-between", alignItems:"center"}}>
                        <Box sx={{display: "flex", flexDirection:"row"}}>
                            <SpButton
                                intent="cancel"
                                onClick={handleCancel}
                                startIcon={<Cancel />}
                                sx={{ mr: 1, mt: .5, height: 32, width:200 }}
                                label="Cancel" />

                            <SpButton
                                intent="plain"
                                onClick={() => handleSubmit(false)}
                                type="submit"
                                startIcon={<Check />}
                                sx={{ml: 1, mt: .5, height: 32, width:200 }}
                                label="Submit" />
                        </Box>
                        
                        <Box sx={{display: "flex", flexDirection:"row", justifyContent: "center", alignItems:"center"}}>
                            <Divider sx={{ width: 33 }}/>
                            <Divider orientation="vertical" sx={{height: 35, marginLeft: 2, marginRight: 2 }} />
                            <Divider sx={{ width: 33 }}/>
                        </Box>

                        {isUpdateScenario && <SpButton
                            intent="gold_standard"
                            onClick={handleSaveAsTemplate}
                            startIcon={<Check />}
                            sx={{ml: 1, mt: .5, height: 32, width:200 }}
                            label="Save As Template" />}
                    </Box>
            </Modal>
            {simpleTextModalState && <SimpleTextDialog 
                opened={simpleTextModalState}
                close={simpleTextModalActioner.close}
                defaultValue={simpleTextDialogProps?.defaultValue}
                warningText={simpleTextDialogProps?.warningText ?? ''}
                onFormClosed={simpleTextDialogProps?.onFormClosed as any} 
                title={simpleTextDialogProps?.title ?? ''}
                unacceptbleValues={simpleTextDialogProps?.unacceptbleValues}
                contextualInfo={simpleTextDialogProps?.contextualInfo as any} />}
        </Box>
    );
}

export default InterfaceMgmtDialog
















//===================================================================

//set channel range info
    // let channelRangeStrValue = '';
    // let firstChannelNumStr = '';

    // let g2gList = await fetchG2GContextList(project._id?.toString(), interfaceToUpdate._id?.toString())
    // if(g2gList && g2gList.length > 0) {
    //     let channelSet = new Set<number>();
    //     for(let g2g of g2gList) {
    //         if (g2g.channel && isNumber(g2g.channel) && g2g.channel.trim().length > 0) {
    //             channelSet.add(Number(g2g.channel));
    //         }
    //     }
    //     if(channelSet.size > 0) {
    //         let channelsSorted = Array.from(channelSet).sort();
    //         let rangeRes = generateSeqChannelShortString(channelsSorted);
    //         if(rangeRes) {
    //             channelRangeStrValue = rangeRes;
    //         }
    //         else {
    //             channelRangeStrValue = channelsSorted.map(a => a.toString()).sort().join(",")
    //         }
    //         firstChannelNumStr = channelsSorted[0].toString().trim();
    //     }
    // }
    // setChannelRangeSpecified(channelRangeStrValue);
    
    
    // //handle netclasses - with channel consideration
    // let ifaceBProp = interfaceToUpdate.contextProperties.find(a => a.name === NETCLASSES_PROP_NAME)
    // if(ifaceBProp && ifaceBProp.value && ifaceBProp.value.length > 0) {
    //     let newArr = rfdcCopy<Netclass>(ifaceBProp.value as Netclass[]) as Netclass[];
        
    //     if(!channelRangeStrValue || channelRangeStrValue.trim().length === 0) {
    //         setNetclassArray(newArr);
    //     }
    //     else {
    //         let finalArr = new Array<Netclass>();
    //         let firstSet = newArr.filter(a => a.channel.trim() === firstChannelNumStr);
    //         let ncNameInfoColl = getNetclassToChannelNameMapping(interfaceToUpdate, [firstSet[0]], g2gList)?.data?.values() ?? [];
    //         let chPrefix : string = Array.from(ncNameInfoColl)?.at(0)?.channelName || '';
            
    //         if(!firstChannelNumStr || firstChannelNumStr.length === 0 || !chPrefix || chPrefix.length === 0){
    //             displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to determine netclass information for intended interface. Interface update is not possible");
    //             return;
    //         }

    //         for(let ncItem of firstSet) {
    //             let netclass = rfdcCopy<Netclass>(ncItem) as Netclass; //NOTE: we leave the '_id' intact  - we may use it to know which set the copy comes from
    //             if(netclass.name.trim().toUpperCase().startsWith(chPrefix.trim().toUpperCase())) {
    //                 netclass.name = removeSubstringFromBeginning(netclass.name, (chPrefix + "_"), true);
    //                 netclass.name = netclass.name.replace(/^_+/, '');  //remove preceeding instances of underscore
    //             }
    //             finalArr.push(netclass)
    //         }

    //         setNetclassArray(finalArr);
    //     }
    // }



//============================================================================================


    // function processInterfaceUpdateDataSubmitAction(performClose: boolean) : {iface: Interface, netclasses: Netclass[]} | undefined {
    //     if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_INTERFACE_COMPOSITION) === false) { return; }
    //     if(interfaceNameSpecified && interfaceNameSpecified.length > 0) {
    //         //NOTE: initially the incoming contextualInfo.value is interface. then on outgoing, it is set to updated netclass list
    //         try {
    //             verifyNaming([interfaceNameSpecified], NamingContentTypeEnum.INTERFACE)
    //         }
    //         catch(e:any) {
    //             displayQuickMessage(UIMessageType.ERROR_MSG, e.message);
    //             return;
    //         }
            
    //         if(channelRangeSpecified && channelRangeSpecified.length > 0) {
    //             let res = getChannelNumArrayFromShortStr(channelRangeSpecified);
    //             if(res.isSuccessful === false) {
    //                 displayQuickMessage(UIMessageType.ERROR_MSG, res.message);
    //                 return;
    //             }
    //         }

    //         let netclasses = getArrangedGridData()
    //         if(!netclasses || netclasses.length === 0) {
    //             displayQuickMessage(UIMessageType.ERROR_MSG, `Interface must have at least one netclass. Please add one or more net classes`)
    //             return;
    //         }

    //         for(let i = 0; i < netclasses.length; i++) {
    //             netclasses[i].patternIndex = i //IMPORTANT!!! - re-arrange according to grid result!
    //         }

    //         let iface: Interface = {...contextualInfo.value}
    //         iface.lastUpdatedOn = new Date()
    //         iface.name = interfaceNameSpecified
            
    //         let descProp = iface.associatedProperties.find(a => a.category === CommonPropertyCategoryEnum.GENERAL_FIXED_KEY && a.name === INTERFACE_PROP_DESCRIPTION) as PropertyItem
    //         descProp.value = interfaceDescriptionSpecified

    //         let others = iface.associatedProperties.filter(a => a.category !== CommonPropertyCategoryEnum.GENERAL_FIXED_KEY && a.name !== INTERFACE_PROP_DESCRIPTION)
    //         iface.associatedProperties = others.concat([descProp])
            
    //         netclasses.forEach(a => a.interfaceId = iface._id?.toString())
            
            
    //         contextualInfo.value = Array.from(netclasses) //important!
            
    //         let netclassProp : BasicProperty = { id: crypto.randomUUID(), name: NETCLASSES_PROP_NAME, value: Array.from(netclasses) }
    //         iface.contextProperties = iface.contextProperties.filter(a => a.name !== NETCLASSES_PROP_NAME) ?? []
    //         iface.contextProperties.push(netclassProp);

    //         let channelRangeProp : BasicProperty = { id: crypto.randomUUID(), name: CHANNEL_RANGE, value: channelRangeSpecified }
    //         iface.contextProperties = iface.contextProperties.filter(a => a.name !== CHANNEL_RANGE) ?? []
    //         iface.contextProperties.push(channelRangeProp);

    //         if (performClose && onFormClosed) {
    //             onFormClosed(iface, contextualInfo);
    //         }

    //         return {iface: iface, netclasses: contextualInfo.value}
            
    //     }
    //     else {
    //         displayQuickMessage(UIMessageType.ERROR_MSG, `Interface name is required. Please enter a name for the interface`)
    //     }
    // }

    
    // function processNewInterfaceDataSubmitAction() {
    //     if(interfaceNameSpecified && interfaceNameSpecified.length > 0) {
    //         try {
    //             verifyNaming([interfaceNameSpecified], NamingContentTypeEnum.INTERFACE)

    //         }
    //         catch(e:any) {
    //             displayQuickMessage(UIMessageType.ERROR_MSG, e.message);
    //             return;
    //         }
            
    //         if(channelRangeSpecified && channelRangeSpecified.length > 0) {
    //             let res = getChannelNumArrayFromShortStr(channelRangeSpecified);
    //             if(res.isSuccessful === false) {
    //                 displayQuickMessage(UIMessageType.ERROR_MSG, res.message);
    //                 return;
    //             }
    //         }
            
    //         let netclasses = getArrangedGridData()
    //         if(!netclasses || netclasses.length === 0) {
    //             displayQuickMessage(UIMessageType.ERROR_MSG, `Interface must have at least one netclass. Please add one or more net classes`)
    //             return;
    //         }


    //         for(let i = 0; i < netclasses.length; i++) {
    //             netclasses[i].patternIndex = i; //IMPORTANT!!! - re-arrange according to grid result!
    //         }

    //         let srcTplInfo : IfaceTplCore = {
    //             id: selectedTemplate?.id || '',
    //             org: selectedTemplate?.org || '',
    //             uniqueName: selectedTemplate?.uniqueName || '',
    //             owner: selectedTemplate?.owner || ''
    //         };

    //         let iface : Interface = {
    //             _id: '',
    //             projectId: project?._id.toString() || '',
    //             snapshotSourceId: '',
    //             contextProperties: [],
    //             lastUpdatedOn: new Date(),
    //             name: interfaceNameSpecified,
    //             sourceInterfaceId: '',
    //             sourceProjectId: '',
    //             initializationType: InterfaceInitTypeEnum.FRESH,
    //             createdOn: new Date(),
    //             createdBy: '',
    //             sourceTemplate: srcTplInfo,
    //             shadowVoidEntries: [],
    //             associatedProperties: [],
    //             notes: null,
    //         } 

    //         let descProp : PropertyItem = {
    //             id: crypto.randomUUID(),
    //             name: INTERFACE_PROP_DESCRIPTION,
    //             displayName: INTERFACE_PROP_DESCRIPTION,
    //             value: interfaceDescriptionSpecified,
    //             category: CommonPropertyCategoryEnum.GENERAL_FIXED_KEY,
    //             editable: true,
    //             enabled: true,
    //             contextProperties: [
    //                 {
    //                     id: crypto.randomUUID(),
    //                     name: "export_context",
    //                     value: {
    //                         subType: "INTERFACE_DESCRIPTION",
    //                         exportEnabled: true
    //                     }
    //                 } as BasicProperty
    //             ]
    //         }

    //         iface.associatedProperties.push(descProp)
            
    //         contextualInfo.value = Array.from(netclasses)

    //         let netclassProp : BasicProperty = { id: crypto.randomUUID(), name: NETCLASSES_PROP_NAME, value: Array.from(netclasses) }
    //         iface.contextProperties = iface.contextProperties.filter(a => a.name !== NETCLASSES_PROP_NAME) ?? []
    //         iface.contextProperties.push(netclassProp);

    //         let channelRangeProp : BasicProperty = { id: crypto.randomUUID(), name: CHANNEL_RANGE, value: channelRangeSpecified }
    //         iface.contextProperties = iface.contextProperties.filter(a => a.name !== CHANNEL_RANGE) ?? []
    //         iface.contextProperties.push(channelRangeProp);

    //         if (onFormClosed) {
    //             onFormClosed(iface, contextualInfo);
    //         }

    //     }
    //     else {
    //         displayQuickMessage(UIMessageType.ERROR_MSG, `Interface name is required. Please enter a name for the interface`)
    //     }
    // }
    




//===================================================================================================

        // if(contextualInfo && contextualInfo.key === "UPDATE_INTERFACE") {
        //     processInterfaceUpdateDataSubmitAction(true);
        // }
        // else {
        //     processNewInterfaceDataSubmitAction();
        // }



                
                // let res = getChannelToNameMapping(interfaceToUpdate, false)
                // if(res.isSuccessful === false && res.message) {
                //     displayQuickMessage(UIMessageType.ERROR_MSG, res.message, 10000);
                //     return;
                // }
                // else {
                //     if(res.data && res.data.size > 0) {
                //         let channelNumbers = Array.from<number>(res.data.keys()).sort()
                //         let rangeRes = generateSeqChannelShortString(channelNumbers);
                //         if(rangeRes) {
                //             channelRangeStrValue = rangeRes;
                //         }
                //         else {
                //             channelRangeStrValue = channelNumbers.map(a => a.toString()).sort().join(",")
                //         }
                //         firstChannelNumStr = channelNumbers[0].toString().trim();
                //     }
                // }




    // let channelList = new Array<number>()
                    
    //                 if(channelRangeStrValue && channelRangeStrValue.length > 0) {
    //                     let res = getChannelArray(channelRangeStrValue);  //knowingly doing this as a way to doublecheck - could have collected it directly from interface.... yah
    //                     if(res.isSuccessful === false) {
    //                         displayQuickMessage(UIMessageType.ERROR_MSG, `Channel Range Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team! -- ${res.message}`, 10000);
    //                         return;
    //                     }
    //                     else {
    //                         channelList = res.data
    //                     }
    //                 }



    
                    // let groupedByChannel = groupBy(newArr, a => a.channel)
                    // for(let [channelNumStr, netclasses] of groupedByChannel) {
                    //     let ncItem = rfdcCopy<Netclass>(netclasses[0]) as Netclass; //NOTE: we leave the '_id' intact  - we may use it to know which set the copy comes from
                    //     if(channelNumbers.length > 0) {
                    //         for(let channel of channelNumbers) {
                    //             let chPrefix = `${interfaceToUpdate.name}${channel}`;  //inportant!
                    //             if(ncItem.name.trim().toUpperCase().startsWith(chPrefix.trim().toUpperCase())) {
                    //                 ncItem.name = removeSubstringFromBeginning(ncItem.name, chPrefix, true);
                    //                 ncItem.name = ncItem.name.replace(/^_+/, '');  //remove preceeding instances of underscore
                    //             } 
                    //         }
                    //     }
                    //     finalArr.push(ncItem)
                    // }





//==========================================================================

{/* <Box>
                            <Autocomplete 
                                value={selectedOrg?.toString() ?? ''}
                                onChange={onOrgChange}
                                key="iface-org-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                disabled={disableOrgSelection.current ?? false}
                                size="small"
                                id="iface-org-cb"
                                sx={{ mb: 2, mt: 2, minWidth: 300}}
                                options={['', ...[...orgs]]}
                                renderInput={(params) => <TextField {...params} label="Org/Business Unit (optional)" size="small" />}
                            />

                            <Autocomplete 
                                value={selectedTemplate?.uniqueName?.toString() ?? ''}
                                onChange={(event: any, tplName: string|null) => {
                                    if(tplName && templatesForOrgMap.has(tplName)) {
                                        onTemplateSelection(tplName)
                                    }
                                }}
                                key="iface-template-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                disabled={(selectedOrg && selectedOrg.length > 0 && disableTemplateSelection.current !== true) ? false : true}
                                size="small"
                                id="iface-template-cb"
                                sx={{ mb: 2, minWidth: 300 }}
                                options={['', ...[...templatesForOrgMap.keys()]]}
                                renderInput={(params) => <TextField {...params} label="Template (optional)" size="small" />}
                            />
                        </Box>

                        <Box>
                            <TextField
                                value={interfaceNameSpecified}
                                id="iface-name-text"
                                label="Specify a name for new interface"
                                variant="outlined"
                                required
                                size="small" 
                                onChange={(e: any) => { setInterfaceNameSpecified(e.target.value) }}
                                sx={{ mb: 2 }} 
                            />

                            <TextField
                                value={interfaceNameSpecified}
                                id="iface-name-text"
                                label="Specify a name for new interface"
                                variant="outlined"
                                required
                                size="small" 
                                onChange={(e: any) => { setInterfaceNameSpecified(e.target.value) }}
                                sx={{ mb: 2 }} 
                            />
                        </Box> */}

//==================================================================





// const loadingSpinnerCtx = useSpiderStore((state) => state.loadingSpinnerCtx)
// const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
// const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);



// <Box sx={{ml: 5, mr: 2, mt: .3, display: 'flex', flexDirection:'row', alignItems : "center"}}>
//     <RotatingLines
//         strokeColor={SPECIAL_RED_COLOR}
//         strokeWidth="5"
//         animationDuration="0.75"
//         width="36"
//         visible={loadingSpinnerCtx.enabled}
//     />
// </Box>

// {loadingSpinnerCtx.enabled && 
//     <Box sx={{overflowWrap: "break-word", m: 1}}>
//         <span
//             style={{ width: 55, color: colors.grey[100],
//             fontSize: (loadingSpinnerCtx.text.length <= 22) ? 14 : 11 }}>
//             {loadingSpinnerCtx.text}
//         </span>
//     </Box>
// }




// let descProp : PropertyItem = {
//     id: crypto.randomUUID(),
//     name: INTERFACE_PROP_DESCRIPTION,
//     displayName: INTERFACE_PROP_DESCRIPTION,
//     value: interfaceDescriptionSpecified,
//     category: CommonPropertyCategoryEnum.GENERAL_FIXED_KEY,
//     editable: true,
//     enabled: true
// }






// const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
// const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

{/* <ConfirmationDialog 
                opened={confirmationModalState}
                close={confirmationModalActioner.close}
                onFormClosed={confirmationDialogProps?.onFormClosed as any}
                title={confirmationDialogProps?.title ?? ''}
                warningText_main={confirmationDialogProps?.warningText_main ?? ''} 
                warningText_other={confirmationDialogProps?.warningText_other} 
                actionButtonText={confirmationDialogProps?.actionButtonText}
                enableSecondaryActionButton={confirmationDialogProps?.enableSecondaryActionButton}
                secondaryActionButtonText={confirmationDialogProps?.secondaryActionButtonText}
                contextualInfo={confirmationDialogProps?.contextualInfo as any} 
            /> */}



// function handleSaveAsTemplate(): void {          
    //     let saveTemplateConfirmData: ConfirmationDialogProps = {
    //         onFormClosed: onConfirmationDataAvailable,
    //         title: "Please Confirm",
    //         warningText_main: `Are you sure you want to save the current interface setup as a template? `,
    //         warningText_other: `WARNING: 'Please make sure there isnt already a similar template. Be careful not to unnecessarily polute the storage with redundant templates!`,
    //         enableSecondaryActionButton: false,
    //         secondaryActionButtonText: "",
    //         contextualInfo:  { key: "SAVE_TEMPLATE", value: null },
    //     }
    //     setConfirmationDialogProps(saveTemplateConfirmData)
    //     confirmationModalActioner.open()
    // }

    // function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): void {
    //     if(contextualInfo && contextualInfo.key && contextualInfo.key === "SAVE_TEMPLATE") {
    //         if(action === ConfirmationDialogActionType.PROCEED) {
                
    //         }
    //     }
    // }



//====================================================================================

{/* <TextField {...register("descriptionField", {
                                    required: 'Project description is required',
                                    minLength: { value: MIN_DESCRIPTION_LENGTH, message: `Please provide descriptive text for project. Minimum: ${MIN_DESCRIPTION_LENGTH} characters` }
                                })}
                                id="conf-desc-text"
                                label="Provide description for project"
                                multiline
                                maxRows={10}
                                error={(errors.descriptionField?.message && errors.descriptionField?.message.length > 0) ? true : false}
                                helperText={errors.descriptionField?.message}
                                sx={{ m: 1, minWidth: 200, marginTop: seperationSpace}} />
 */}



 
                        {/* <Box sx={{mt:1, display: "flex", flexDirection:"column"}} >
                            <Typography color={colors.greenAccent[400]}>{`Select Org/BU & Template (optional)`}</Typography>
                            <Divider sx={{ mt: 0, mb: 1 }} />
                            
                            <Autocomplete 
                                value={selectedOrg?.toString() ?? ''}
                                onChange={onOrgChange}
                                key="iface-org-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="iface-org-cb"
                                sx={{ mb: 1, minWidth: 300, marginTop: 1 }}
                                options={['', ...[...getKnownOrgs()]]}
                                renderInput={(params) => <TextField {...params} label="Org/Business Unit" size="small" />}
                            />

                            <Autocomplete 
                                value={selectedTemplate?.uniqueIdName?.toString() ?? ''}
                                onChange={(event: any, newValue: any) => {
                                    let tplName : string = newValue as string;
                                    if(templatesForOrgMap.has(tplName)) {
                                        onTemplateSelection(tplName)
                                    }
                                }}
                                key="iface-template-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                disabled={(selectedOrg && selectedOrg.length > 0) ? false : true}
                                size="small"
                                id="iface-template-cb"
                                sx={{ mb: 1.5, minWidth: 300, marginTop: 1 }}
                                options={['', ...[...templatesForOrgMap.keys()]]}
                                renderInput={(params) => <TextField {...params} label="Template" size="small" />}
                            />
                        </Box> */}



