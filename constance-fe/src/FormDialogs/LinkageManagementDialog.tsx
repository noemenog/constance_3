import * as React from 'react';
import { Autocomplete, Box, Checkbox, Chip, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, Switch, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { Cancel, Check, CheckBoxOutlineBlankOutlined, Height, RadioButtonUncheckedOutlined, Thunderstorm } from '@mui/icons-material';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { BASIC_NAME_VALIDATION_REGEX, ConstraintTypesEnum, NamingContentTypeEnum, LINKAGE_ALL_RULEAREA_INDICATOR, SPECIAL_BLUE_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BasicKVP, BasicProperty, DisplayOption } from '../DataModels/HelperModels';
import { useSpiderStore } from '../DataModels/ZuStore';
import { G2GRelationContext, Interface, LinkageInfo, Netclass, PackageLayout, Project, RuleArea } from '../DataModels/ServiceModels';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { groupBy, rfdcCopy, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { MultiTextEntryField } from '../CommonComponents/MultiTextEntryField';
import { sort } from 'fast-sort';
import { getNetclassToChannelNameMapping } from '../BizLogicUtilities/BasicCommonLogic';
import { SpButton } from '../CommonComponents/SimplePieces';





export interface LinkageManagementDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (contextualInfo: BasicKVP) => void,
    title: string,
    project: Project,
    netclasses: Netclass[],
    ruleAreas: RuleArea[],
    projectInterfaceList: Interface[],
    g2gContextList: G2GRelationContext[],
    constraintType: ConstraintTypesEnum,
    contextualInfo: BasicKVP
}

const LinkageManagementDialog: React.FC<LinkageManagementDialogProps> = ({ title, opened, close, onFormClosed, project, netclasses, ruleAreas, projectInterfaceList, g2gContextList, constraintType, contextualInfo}) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [linkageData, setLinkageData] = useState<LinkageInfo[]>([])

    const [ruleAreaOptions, setRuleAreaOptions] = useState<DisplayOption[]>([])
    
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);

    const containerRef = useRef<HTMLElement>(null);  //important!

    const allSrcRAOption : DisplayOption = {id: LINKAGE_ALL_RULEAREA_INDICATOR, label: "[ALL]"};
    

    useEffect(() => { 
        if (constraintType === ConstraintTypesEnum.Physical) {
            if(project.physicalLinkages && project.physicalLinkages.length > 0) {
                setLinkageData(rfdcCopy<LinkageInfo[]>(project.physicalLinkages) as LinkageInfo[]);
            }
        }
        else if (constraintType === ConstraintTypesEnum.Clearance) {
            if(project.clearanceLinkages && project.clearanceLinkages.length > 0) {
                setLinkageData(rfdcCopy<LinkageInfo[]>(project.clearanceLinkages ?? []) as LinkageInfo[]);
            }
        }
    }, []);


    const netclassMapping = useMemo(() => {         
        let map = new Map<string, Netclass>();
        if(netclasses && netclasses.length > 0) {
            for(let nc of netclasses) {
                map.set(nc._id, nc)
            }
        }
        return map;
    }, []);


    const netclassToChannelNameMapping = useMemo(() => {         
        let map = new Map<string, string>();
        if(netclasses && netclasses.length > 0) {
            let ncByInterface = groupBy(netclasses, x => x.interfaceId)
            for(let [ifaceId, netclassList] of ncByInterface) {
                let iface = projectInterfaceList.find(a => a._id.toString() === ifaceId) as Interface
                let res = getNetclassToChannelNameMapping(iface, netclassList, g2gContextList)
                if(res.isSuccessful) {
                    for(let [ncid, ncNameInfo] of (res.data as Map<string, {channelName: string, suffix: string}>)) {
                        map.set(ncid, ncNameInfo.channelName);
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG,res.message);
                }
            }
        }
        return map;
    }, []);


    const clrRelMapping = useMemo(() => {         
        let map = new Map<string, BasicProperty>();
        if(project.clearanceRelationBrands && project.clearanceRelationBrands.length > 0) {
            for(let clrRel of project.clearanceRelationBrands) {
                map.set(clrRel.id, clrRel)
            }
        }
        return map;
    }, []);


    const ifaceIdToNameMapping = useMemo(() => {         
        let map = new Map<string, string>();
        if(projectInterfaceList && projectInterfaceList.length > 0) {
            for(let iface of projectInterfaceList) {
                map.set(iface._id.toString(), iface.name)
            }
        }
        return map;
    }, []);


    const ruleAreaMapping = useMemo(() => {         
        let map = new Map<string, RuleArea>();
        if(ruleAreas && ruleAreas.length > 0) {
            for(let ra of ruleAreas) {
                map.set(ra.id, ra)
            }
        }
        return map;
    }, []);


    useMemo(() => {         
        let raOptions = sort(ruleAreas ?? []).asc(x => x.ruleAreaName).map(x => ({id: x.id, label: x.ruleAreaName} as DisplayOption))
        setRuleAreaOptions([allSrcRAOption, ...raOptions])
    }, []);


    function onLinkageNamesAdded(items: DisplayOption[]): void {
        let newLnkInfoArr = new Array<LinkageInfo>();
        if(items && items.length > 0) {
            let existingNames = linkageData.map(a => a.name.toLowerCase().trim())
            let checkRes = items.some(a => existingNames.includes(a.label.toLowerCase().trim()))
            if(checkRes === true) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Linkage name already exists for project. Duplicate names are not allowed`);
                return;
            }

            let itemNames = items.map(a => a.label)
            try { verifyNaming(itemNames, NamingContentTypeEnum.LINKAGE) }
            catch(e: any){
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }

            for(let i = 0; i < items.length; i++) {
                let lnk: LinkageInfo = {
                    id: crypto.randomUUID(),
                    name: items[i].label,
                    ruleAreaId: "",
                    sourceElementId: "",
                    confineToRuleArea: true,
                    value: new Array<string>(),
                    tags: []
                }
                newLnkInfoArr.push(lnk)
            }
            let copy = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[] ?? []
            let concatInfo = copy.concat(newLnkInfoArr);
            setLinkageData(concatInfo);
        }
    }


    function onLinkageRemovalAction(event: any, lnkInfo: LinkageInfo, index: number): void {
        if(linkageData && linkageData.length > 0) {
            let ld = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[]
            let data = ld.filter(a => a.id !== lnkInfo.id);
            setLinkageData(data);
        }
    }


    function onLinkageNameChange(event: any, lnkInfo: LinkageInfo, index: number) {
        if(linkageData && linkageData.length > 0) {
            let ld = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[]
            let changed = false;
            for(let i = 0; i < ld.length; i++) {
                if(ld[i].id === lnkInfo.id) {
                    ld[i].name = event?.target?.value ?? "";
                    changed = true;
                    break;
                }
            }
            if (changed === true){
                setLinkageData(ld);
            }
        }
    }


    function onInitDataSourceForLinkageChanged(src: DisplayOption|null, lnkInfo: LinkageInfo) {
        if(lnkInfo && src && (src.id.trim().length > 0) && linkageData && (linkageData.length > 0)) {
            let ld = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[]
            let changed = false;
            for(let i = 0; i < ld.length; i++) {
                if(ld[i].id === lnkInfo.id) {
                    ld[i].sourceElementId = src.id;
                    changed = true;
                    break;
                }
            }
            if (changed === true){
                setLinkageData(ld);
            }
        }
    }


    function onLinkageRuleAreaChanged(raDispOpt: DisplayOption|null, lnkInfo: LinkageInfo) {
        if(lnkInfo && raDispOpt && linkageData && (linkageData.length > 0)) {
            let ld = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[]
            let changed = false;
            for(let i = 0; i < ld.length; i++) {
                if(ld[i].id === lnkInfo.id) {
                    if(raDispOpt.id === LINKAGE_ALL_RULEAREA_INDICATOR) {
                        if(ld[i].confineToRuleArea === false) {
                            ld[i].ruleAreaId = "";
                            displayQuickMessage(UIMessageType.ERROR_MSG, 
                                `Cannot select '[ALL]' if rule-area confinement is set to 'No'. This scenario is not allowed.`)
                        }
                        else {
                            ld[i].ruleAreaId = LINKAGE_ALL_RULEAREA_INDICATOR
                            onRuleAreaConfinementChanged(true, lnkInfo);
                        }
                    }
                    else {
                        ld[i].ruleAreaId = raDispOpt.id.trim()
                    }
                    changed = true;
                    break;
                }
            }
            if (changed === true){
                setLinkageData(ld);
            }
        }
    }


    function onRuleAreaConfinementChanged(value: boolean, lnkInfo: LinkageInfo) {
        if(lnkInfo && linkageData && (linkageData.length > 0)) {
            let ld = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[]
            let changed = false;
            for(let i = 0; i < ld.length; i++) {
                if(ld[i].id === lnkInfo.id) {
                    ld[i].confineToRuleArea = value;

                    if(value === false) {
                        if(ld[i].ruleAreaId === LINKAGE_ALL_RULEAREA_INDICATOR){
                            ld[i].ruleAreaId = "";
                        }
                    }

                    changed = true;
                    break;
                }
            }
            if (changed === true){
                setLinkageData(ld);
            }
        }
    }


    function getOptionNameStr(key: string, lnkInfo: LinkageInfo): string {
        let retval = "";
        if(key && (key.trim().length > 0) && lnkInfo && lnkInfo.id) { //if is valid....
            if (constraintType === ConstraintTypesEnum.Clearance) {
                if(clrRelMapping && clrRelMapping.size > 0) {
                    retval = clrRelMapping.get(key)?.name ?? "";
                }
            }
            else if (constraintType === ConstraintTypesEnum.Physical) {
                if(netclassMapping && netclassMapping.size > 0) {
                    retval = netclassMapping.get(key)?.name ?? "";
                }
            }
        }
        return retval;
    }


    function getLinkageElementSelectableOptions() : DisplayOption[]{         
        let options = new Array<DisplayOption>();
        if (constraintType === ConstraintTypesEnum.Physical) {
            let ncArr = netclasses.filter(nc => linkageData.every(ld => (ld.value.includes(nc._id.toString().trim()) === false)))
            if(ncArr && ncArr.length > 0) {
                for(let nc of ncArr) {
                    let channelName = netclassToChannelNameMapping.get(nc._id.toString()) || "" //the UNKNOWN is not expected to ever occur
                    let dispOpt : DisplayOption = {id: nc._id.toString(), label: nc.name, type: (channelName && channelName.trim().length > 0) ? channelName : ifaceIdToNameMapping.get(nc.interfaceId)}
                    options.push(dispOpt);
                }
            }
        }
        else if (constraintType === ConstraintTypesEnum.Clearance) {
            let clrRelBrandArr = project.clearanceRelationBrands.filter(br => linkageData.every(ld => (ld.value.includes(br.id) === false)))
            if(clrRelBrandArr && clrRelBrandArr.length > 0) {
                options = clrRelBrandArr.map(a => ({id: a.id, label: a.name, type: ConstraintTypesEnum.Clearance} as DisplayOption))
            }
        }
        let sortedOptions = sort(options).asc([a => a.type, a => a.label]);
        return sortedOptions;
    }



    async function onLinkageElementAction(event: any, isAdditionAction: boolean, optionId: string, lnkInfo: LinkageInfo) {
        let elementIdArray = new Array<string>();

        if (optionId === "CLEAR_ALL" && isAdditionAction === false) {
            (lnkInfo.value ?? []).forEach(x => elementIdArray.push(x));
        }
        else if (netclassMapping.has(optionId) || clrRelMapping.has(optionId)) { //singular element scenario
            elementIdArray.push(optionId)
        }
        else if((constraintType === ConstraintTypesEnum.Physical) && (netclassMapping.has(optionId) === false)) { //group level selection (only expected for Physical)
            let currAllOptions = getLinkageElementSelectableOptions()
            if(currAllOptions && currAllOptions.length > 0) {
                let relevOptions = currAllOptions.filter(a => a.type && a.type === optionId)
                if(relevOptions && relevOptions.length > 0) {
                    for(let opt of relevOptions) {
                        let nc = netclassMapping.get(opt.id)
                        if(nc) {
                            elementIdArray.push(nc._id.toString());
                        }
                    }
                }
            }
        }
        else {
            displayQuickMessage(UIMessageType.ERROR_MSG,`Invalid action. Cannot proceed....`)
            return 
        }
        
        //round it all up...
        let valArrCopy = rfdcCopy<string[]>(lnkInfo.value ?? []) as string[];
        valArrCopy = Array.from(new Set<string>(valArrCopy)) //remove any possible duplicates... will result if this is CLEAR_ALL scenario 

        for(let k = 0; k < elementIdArray.length; k++) { 
            if(isAdditionAction === true) {
                valArrCopy.push(elementIdArray[k].trim())
            }
            else {
                valArrCopy = valArrCopy.filter(x => x.trim().toLowerCase() !== elementIdArray[k].trim().toLowerCase())
            }
        }

        let linkageDataArrCopy = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[];
        for(let i = 0; i < linkageDataArrCopy.length; i++) {
            if(linkageDataArrCopy[i].id === lnkInfo.id) {
                linkageDataArrCopy[i].value = Array.from(new Set<string>(valArrCopy)); //Important! By using a Set, we guarantee uniqueness!!
                if(linkageDataArrCopy[i].value.includes(linkageDataArrCopy[i].sourceElementId) === false) {
                    linkageDataArrCopy[i].sourceElementId = ""
                }
                break;
            }
        }
        setLinkageData(linkageDataArrCopy);
    }





    function handleSubmit() {
        let oppositeTypeLnkNames = (constraintType === ConstraintTypesEnum.Physical) 
            ? (project.clearanceLinkages ?? []).map(a => a.name.trim().toUpperCase()) 
            : (project.physicalLinkages ?? []).map(n => n.name.trim().toUpperCase());
            
        let undesiredProjItemNames = 
            [project.name]
            .concat(project.clearanceRelationBrands.map(a => a.name))
            .concat(netclasses.map(a => a.name))
            .concat(projectInterfaceList.map(x => x.name))
            .concat([...netclassToChannelNameMapping.values()])
            .map(a => a.trim().toUpperCase());
        
        let prohibNames = new Set<string>(undesiredProjItemNames.concat(oppositeTypeLnkNames));
        let possibleRuleAreaIndicators = new Set<string>(ruleAreas.map(a => a.id).concat([LINKAGE_ALL_RULEAREA_INDICATOR]) ?? []);

        for(let i = 0; i < linkageData.length; i++) {
            if(!linkageData[i].id || linkageData[i].id.trim().length === 0) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `All linkage elements must be valid and non-empty ID.`)
                return;
            }
            if(!linkageData[i].name || linkageData[i].name.trim().length === 0) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `All linkage names must be valid and non-empty.`)
                return;
            }
            if(!linkageData[i].value || linkageData[i].value.length < 2) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Linkage '${linkageData[i].name}' must have at least two link elements.`)
                return;
            }
            if(!linkageData[i].sourceElementId || linkageData[i].sourceElementId.trim().length === 0) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Linkage '${linkageData[i].name}' cannot have empty source element.`)
                return;
            }
            if(linkageData[i].value.includes(linkageData[i].sourceElementId) === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Linkage '${linkageData[i].name}' is invalid. The specified data source must be part of the linkage.`)
                return;
            }
            if(!linkageData[i].ruleAreaId || linkageData[i].ruleAreaId.trim().length === 0) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Linkage '${linkageData[i].name}' cannot have empty source rule area.`)
                return;
            }
            if(possibleRuleAreaIndicators.has(linkageData[i].ruleAreaId) === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Linkage '${linkageData[i].name}' is invalid. Associated rule area is not valid.`)
                return;
            }
            if((linkageData[i].confineToRuleArea === false) && (linkageData[i].ruleAreaId === LINKAGE_ALL_RULEAREA_INDICATOR)) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Linkage '${linkageData[i].name}' is invalid. If rule-area confinement is disabled, source rule area cannot be '${LINKAGE_ALL_RULEAREA_INDICATOR}'. A specific project rule area is required.`)
                return;
            }
            if(prohibNames.has(linkageData[i].name.trim().toUpperCase())) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Prohibited linkage names found. Linkage '${linkageData[i].name}' cannot use the specified name. Please change the name to proceed.`);
                return;
            }
        }

        if(linkageData.length > 0) {
            let nameList = linkageData.map(a => a.name)
            try { verifyNaming(nameList, NamingContentTypeEnum.LINKAGE) }
            catch(e: any) {
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }
        }

        if (onFormClosed) {
            contextualInfo.value = linkageData;
            onFormClosed(contextualInfo);
        }
       
        setLinkageData([]);
        if(close){ close() }
    }

    
    function handleCancel() {
        if (onFormClosed) {
            contextualInfo.value = null;
            onFormClosed(contextualInfo);
        }
        setLinkageData([]);
        if(close){ close() }
    };


    
    

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
                    
                <Box ref={containerRef} flexDirection="column" sx={{ '& .MuiTextField-root': { width: '100%'}, }}>
                                    
                    <Box justifyContent="center" alignItems="center" sx={{padding: 1, minWidth: "85vw"}}>
                        <Divider sx={{mt: 0, mb: .5}} />

                        <Box sx={{mt: 3, display: "flex", flexDirection:"column"}} >
                            <MultiTextEntryField 
                                labelText={`Add New Linkages (comma separated)`}
                                onItemAdded={(items: DisplayOption[]) => onLinkageNamesAdded(items)}
                                regexForValidation={BASIC_NAME_VALIDATION_REGEX} 
                                textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, width: 1000}}
                                addButtonStyle={{ fontSize: 27}}
                            />

                            <Divider sx={{mt: 3, mb: 3, backgroundColor: colors.greenAccent[400]}}/>

                            <Box sx={{padding: 1}}>
                                <Box key={`box-srll`} style={{ height: "60vh", maxHeight: "60vh", overflowY: "scroll" }}>
                                    <Table>
                                        <TableBody sx={{ overflowY: "scroll" }}> 
                                            {(linkageData ?? []).map((lnkInfo: LinkageInfo, lnkIndex: number) => (
                                                <TableRow key={`lnk-tr-${lnkIndex}`} sx={{height: 44 }}>
                                                
                                                    <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 55, maxWidth: 55, padding: 0, textAlign: "center" }}>
                                                        <Tooltip placement="top" title={`Remove linkage`}>
                                                            <span>
                                                                <IconButton size="small" onClick={(e) => onLinkageRemovalAction(e, lnkInfo, lnkIndex)}>
                                                                    <Cancel sx={{ height: 22, padding: 0, color: SPECIAL_RED_COLOR }} />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </TableCell>

                                                    <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 40, width: "12%", padding: 1, textAlign: "center" }}>
                                                        <Box sx={{ padding: 1, overflowX: "hidden"}}>
                                                            <TextField
                                                                id="name-text"
                                                                value={lnkInfo.name}
                                                                onChange={(e) => onLinkageNameChange(e, lnkInfo, lnkIndex)}
                                                                label={`Linkage Name`}
                                                                sx={{ }}
                                                                size="small" 
                                                            />
                                                        </Box>
                                                    </TableCell>

                                                    <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 80, width: "55%", padding: 1, textAlign: "center" }}>
                                                        <Box sx={{ padding: 1, overflowX: "hidden"}}>
                                                            <Autocomplete
                                                                multiple={true}
                                                                id="chkbox-tags-linkage"
                                                                disableCloseOnSelect
                                                                size="small"
                                                                sx={{ }}
                                                                disabled={(lnkInfo.name && lnkInfo.name.length > 0) ? false : true}
                                                                value={ lnkInfo.value?.map(x => ({id: x, label: getOptionNameStr(x, lnkInfo)} as DisplayOption)) ?? []} 
                                                                options={getLinkageElementSelectableOptions()}
                                                                groupBy={(constraintType === ConstraintTypesEnum.Physical) ? (option) => option.type as string : undefined }
                                                                getOptionLabel={(option: DisplayOption) => option.label}
                                                                onChange={(event, value, reason, details) => {
                                                                    if(value && value.length === 0 && reason.toLowerCase() === "clear") {
                                                                        onLinkageElementAction(event, false, "CLEAR_ALL", lnkInfo)
                                                                    }
                                                                }}
                                                                renderGroup={(params) => (
                                                                    <Fragment key={params.key}>
                                                                        <ListItemButton
                                                                            onClick={(event) => onLinkageElementAction(event, true, params.group, lnkInfo)} 
                                                                            sx={{ height: 32, ml: 0, backgroundColor: SPECIAL_QUARTZ_COLOR }}>
                                                                            <ListItemIcon>
                                                                                <CheckBoxOutlineBlankOutlined />
                                                                            </ListItemIcon>
                                                                            <ListItemText sx={{ml: -3}} primary={params.group} />
                                                                        </ListItemButton>
                                                                            
                                                                        <div>{params.children}</div>
                                                                    </Fragment>
                                                                )}
                                                                renderOption={(props: any, option: DisplayOption, { selected }: any) => {
                                                                    const { key, ...optionProps } = props;
                                                                    return (
                                                                        <ListItem key={key} {...optionProps}>
                                                                            <Checkbox 
                                                                                icon={<RadioButtonUncheckedOutlined fontSize="small" sx={{color: SPECIAL_BLUE_COLOR}}/>} 
                                                                                sx={{ height: 22, ml: 3 }} 
                                                                                checked={selected} 
                                                                                onChange={(event, checked) => onLinkageElementAction(event, checked, option.id, lnkInfo)} 
                                                                            />
                                                                            <Typography onClick={(event) => onLinkageElementAction(event, true, option.id, lnkInfo)} sx={{ fontSize:12 }}>
                                                                                {option.label}
                                                                            </Typography>
                                                                        </ListItem>
                                                                    );
                                                                }}
                                                                renderInput={(params: any) => (
                                                                    <TextField {...params} 
                                                                        label={(constraintType === ConstraintTypesEnum.Physical) ? "Physical Linked Elements" : "Clearance Linked Elements"}
                                                                        size="small" 
                                                                        placeholder={undefined}
                                                                    />
                                                                )}
                                                                renderTags={(value, getTagProps) =>
                                                                    value.sort((a, b) => a.label < b.label ? -1 : 1).map((option, index) => (
                                                                        <Chip
                                                                            {...getTagProps({ index })} //the name lnkIndex is used above, so that it doesnt clash with this "index" variable!!!
                                                                            key={`chp-${index}`}
                                                                            label={option.label}
                                                                            onDelete={(event) => onLinkageElementAction(event, false, option.id, lnkInfo)}
                                                                            sx={{ 
                                                                                '&:hover': { backgroundColor: SPECIAL_BLUE_COLOR}, 
                                                                                '& .MuiChip-deleteIcon:hover': { color: colors.grey[100]  }
                                                                            }}
                                                                        />
                                                                    ))
                                                                }
                                                            />
                                                        </Box>
                                                    </TableCell>

                                                    <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 40, width: "12%", padding: 1, textAlign: "center" }}>
                                                        <Box sx={{ padding: 1, overflowX: "hidden"}}>
                                                            <Autocomplete<DisplayOption>
                                                                value={ (lnkInfo.sourceElementId && lnkInfo.sourceElementId.trim().length > 0) 
                                                                    ? { id: lnkInfo.sourceElementId.trim(), label: getOptionNameStr(lnkInfo.sourceElementId, lnkInfo) } as DisplayOption
                                                                    : { id: "", label: "" } as DisplayOption }
                                                                onChange={(event, value, reason, details) => onInitDataSourceForLinkageChanged((value && value.id) ? value : null, lnkInfo)}
                                                                key="lnk-kvp-sel-CB"
                                                                freeSolo={false}
                                                                filterSelectedOptions={true}
                                                                disablePortal
                                                                disableListWrap
                                                                disabled={(lnkInfo.name && lnkInfo.name.length > 0 && lnkInfo.value && lnkInfo.value.length > 0) ? false : true} 
                                                                size="small"
                                                                id="lnk-kvp-sel-cb"
                                                                options={ lnkInfo.value?.map(x => ({id: x, label: getOptionNameStr(x, lnkInfo)} as DisplayOption)) ?? []}
                                                                getOptionLabel={(option) => option.label } //Important!
                                                                renderInput={(params) => <TextField 
                                                                    {...params} 
                                                                    label={"Source Element"}
                                                                    size="small" 
                                                                    sx={{ fieldset : { borderColor: SPECIAL_DARK_GOLD_COLOR } }}
                                                                />}
                                                            />                                                  
                                                        </Box>
                                                    </TableCell>

                                                    <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 40, width: "12%", padding: 1, textAlign: "center" }}>
                                                        <Box sx={{ padding: 1, overflowX: "hidden"}}>
                                                            <Autocomplete<DisplayOption>
                                                                value={(lnkInfo.ruleAreaId === LINKAGE_ALL_RULEAREA_INDICATOR)
                                                                    ? allSrcRAOption
                                                                    : { id: lnkInfo.ruleAreaId, label: ruleAreaMapping.get(lnkInfo.ruleAreaId)?.ruleAreaName ?? lnkInfo.ruleAreaId }
                                                                }
                                                                onChange={(event, value, reason, details) => onLinkageRuleAreaChanged(value, lnkInfo)}
                                                                key="lnk-ra-sel-CB"
                                                                freeSolo={false}
                                                                filterSelectedOptions={true}
                                                                disablePortal
                                                                disableListWrap
                                                                size="small"
                                                                id="lnk-ra-sel-cb"
                                                                options={ruleAreaOptions}
                                                                disabled={(lnkInfo.name && lnkInfo.name.length > 0) ? false : true}
                                                                getOptionLabel={(option) => option.label } //Important!
                                                                renderInput={(params) => <TextField {...params} label="Source Rule Area" size="small" sx={{ fieldset : { borderColor: SPECIAL_DARK_GOLD_COLOR } }}/>}
                                                            />                                                  
                                                        </Box>
                                                    </TableCell>

                                                    <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 40, width: "12%", padding: 1, textAlign: "center" }}>
                                                        <Box sx={{ padding: 1, overflowX: "hidden"}}>
                                                            <Autocomplete
                                                                value={lnkInfo.confineToRuleArea === true ? "YES" : "NO"}
                                                                onChange={(event, value, reason, details) => onRuleAreaConfinementChanged(((value && value.trim().toUpperCase() === "YES") ? true : false), lnkInfo)}
                                                                key="lnk-raconf-sel-CB"
                                                                freeSolo={false}
                                                                filterSelectedOptions={true}
                                                                disablePortal
                                                                disableListWrap
                                                                size="small"
                                                                id="lnk-raconf-sel-cb"
                                                                disabled={(lnkInfo.name && lnkInfo.name.length > 0) ? false : true}
                                                                options={(lnkInfo.ruleAreaId === LINKAGE_ALL_RULEAREA_INDICATOR) ? ["YES"] : ["YES", "NO"]}
                                                                renderInput={(params) => <TextField {...params} label="Confine To Rule Area?" size="small" sx={{ fieldset : { borderColor: SPECIAL_DARK_GOLD_COLOR } }}/>}
                                                            />                                                  
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                        
                                    </Table>
                                </Box>
                            </Box>
                        </Box>

                    </Box>
                
                </Box>

                <Divider sx={{ mt: .7, mb: 1 }}/>

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
                            onClick={handleSubmit}
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

                </Box>
            </Modal>
        </Box>
    );
}


export default LinkageManagementDialog















// let exisInfo = existingLinkageDataRef.current.find(x => x.id === lnkInfo.id) //check and get current item from original/existing set of linkages
//         if(exisInfo && ((lnkValueArrCopy.length === 0) || lnkValueArrCopy.every(a => (exisInfo.value.includes(a) === false)))) {
//             displayQuickMessage(UIMessageType.ERROR_MSG,`Existing Linkage '${lnkInfo.name}' cannot have empty set of linked elements, AND must maintain at least one of the original linked elements.`)
//             return;
//         }
//         else 




// async function onLinkageElementAction(event: any, isAdditionAction: boolean, optionId: string, lnkInfo: LinkageInfo) {
//     let elementIdArray = new Array<string>();
//     let lnkValueArrCopy = Array.from(new Set<string>(lnkInfo.value ?? []))

//     //handle physical scenario...
//     if(constraintType === ConstraintTypesEnum.Physical) {        
//         if (optionId === "CLEAR_ALL" && isAdditionAction === false) {
//             for(let ncid of lnkValueArrCopy) {
//                 let nc = netclassMapping.get(ncid);
//                 if(nc) {
//                     elementIdArray.push(nc._id.toString())
//                 }
//             }
//         }
//         else if(netclassMapping.has(optionId) === false) { //If this is a Group level selection
//             let currAllOptions = getLinkageElementSelectableOptions()
//             if(currAllOptions && currAllOptions.length > 0) {
//                 let relevOptions = currAllOptions.filter(a => a.type && a.type === optionId)
//                 if(relevOptions && relevOptions.length > 0) {
//                     for(let opt of relevOptions) {
//                         let nc = netclassMapping.get(opt.id)
//                         if(nc) {
//                             elementIdArray.push(nc._id.toString());
//                         }
//                     }
//                 }
//             }
//         }
//         else {
//             let nc = netclassMapping.get(optionId);
//             elementIdArray.push(nc?._id.toString() as string)
//         }
//     }
    
//     //handle clearance scenario
//     if (constraintType === ConstraintTypesEnum.Clearance) {
//         if (optionId === "CLEAR_ALL" && isAdditionAction === false) {
//             for(let clrRelId of lnkValueArrCopy) {
//                 let clrRel = clrRelMapping.get(clrRelId)
//                 if(clrRel) {
//                     elementIdArray.push(clrRel.id)
//                 }
//             }
//         }
//         else {
//             let clrRel = clrRelMapping.get(optionId)
//             if(clrRel) {
//                 elementIdArray.push(clrRel.id)
//             }
//         }
//     }
    
//     //round it all up...
//     for(let k = 0; k < elementIdArray.length; k++) { 
//         if(isAdditionAction === true) {
//             lnkValueArrCopy.push(elementIdArray[k].trim())
//         }
//         else {
//             lnkValueArrCopy = lnkValueArrCopy.filter(x => x.trim().toLowerCase() !== elementIdArray[k].trim().toLowerCase())
//         }
//     }

//     let exisInfo = existingLinkageDataRef.current.find(x => x.id === lnkInfo.id) //check and get current item from original/existing set of linkages
//     if(exisInfo && ((lnkValueArrCopy.length === 0) || lnkValueArrCopy.every(a => (exisInfo.value.includes(a) === false)))) {
//         displayQuickMessage(UIMessageType.ERROR_MSG,`Existing Linkage '${lnkInfo.name}' cannot have empty set of linked elements, AND must maintain at least one of the original linked elements.`)
//         return;
//     }
//     else {
//         let linkageDataArr = rfdcCopy<LinkageInfo[]>(linkageData) as LinkageInfo[];
//         for(let i = 0; i < linkageDataArr.length; i++) {
//             if(linkageDataArr[i].id === lnkInfo.id) {
//                 linkageDataArr[i].value = Array.from(new Set<string>(lnkValueArrCopy)); //Important! By using a Set, we guarantee uniqueness!!
//                 break;
//             }
//         }
//         setLinkageData(linkageDataArr);
//     }
// }





// if(lnkInfo.value && isForKnownInitDataSourceValue === true) {
//     if((lnkInfo.value.includes(key) === false)) { //if this is a scenario where we have removed the current data-source element
//         if(existingLinkageDataRef.current && existingLinkageDataRef.current.length > 0) { //if there were existing items
//             let exisInfo = existingLinkageDataRef.current.find(x => x.id === lnkInfo.id) //check and get current item from original/existing set of linkages
//             if(exisInfo && exisInfo.value && exisInfo.value.length > 0) {
//                 for(let item of exisInfo.value) {
//                     if(lnkInfo.value.includes(item)){
//                         if (constraintType === ConstraintTypesEnum.Clearance) {
//                             if(clrRelMapping && clrRelMapping.size > 0) {
//                                 retval = clrRelMapping.get(item)?.name ?? "";
//                                 break;
//                             }
//                         }
//                         else if (constraintType === ConstraintTypesEnum.Physical) {
//                             if(netclassMapping && netclassMapping.size > 0) {
//                                 retval = netclassMapping.get(item)?.name ?? "";
//                                 break;
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }
// }


// if(elementIdArray.length > 0) {
//     if(isAdditionAction) {
//         for(let id of elementIdArray) {
//             if(lnkValueArrCopy.includes(id.trim()) === false) {
//                 lnkValueArrCopy.push(id.trim())
//             }
//         }
//     }
//     else {
//         for(let id of elementIdArray) {
//             lnkValueArrCopy = lnkValueArrCopy.filter(x => x.trim().toLowerCase() !== id.trim().toLowerCase())
//         }
//     }
// }




//======================================



        
        // if(constraintType === ConstraintTypesEnum.Physical) {        
        //     let netclassArr = new Array<Netclass>()
        //     if (optionId === "CLEAR_ALL" && isAdditionAction === false) {
        //         for(let ncid of lnkInfo.value) {
        //             let nc = netclassMapping.get(ncid);
        //             if(nc) {
        //                 netclassArr.push(nc as Netclass)
        //             }
        //         }
        //     }
        //     else if(netclassMapping.has(optionId) === false) {
        //         let currAllOptions = getLinkageElementSelectableOptions()
        //         if(currAllOptions && currAllOptions.length > 0) {
        //             let relevOptions = currAllOptions.filter(a => a.type && a.type === optionId)
        //             if(relevOptions && relevOptions.length > 0) {
        //                 for(let opt of relevOptions) {
        //                     let nc = netclassMapping.get(opt.id)
        //                     if(nc) {
        //                         netclassArr.push(nc);
        //                     }
        //                 }
        //             }
        //         }
        //     }
        //     else {
        //         let nc = netclassMapping.get(optionId);
        //         netclassArr.push(nc as Netclass)
        //     }
            
        //     if(netclassArr.length > 0) {
        //         if(isAdditionAction) {
        //             for(let netclass of netclassArr) {
        //                 if(lnkInfo.value.includes(netclass._id.toString().trim()) === false) {
        //                     lnkInfo.value.push(netclass._id.toString().trim())
        //                 }
        //             }
        //         }
        //         else {
        //             for(let netclass of netclassArr) {
        //                 lnkInfo.value = lnkInfo.value.filter(x => x.trim().toLowerCase() !== netclass._id.toString().trim().toLowerCase())
        //             }
        //         }
        //     }
            
        // }
        // else if (constraintType === ConstraintTypesEnum.Clearance) {
        //     let clrRelArray = new Array<BasicProperty>();
            
        //     if (optionId === "CLEAR_ALL" && isAdditionAction === false) {
        //         for(let clrRelId of lnkInfo.value) {
        //             let clrRel = clrRelMapping.get(clrRelId)
        //             if(clrRel) {
        //                 clrRelArray.push(clrRel as BasicProperty)
        //             }
        //         }
        //     }
        //     else {
        //         let clrRel = clrRelMapping.get(optionId)
        //         if(clrRel) {
        //             clrRelArray.push(clrRel as BasicProperty)
        //         }
        //     }

        //     if(clrRelArray.length > 0) {
        //         if(isAdditionAction) {
        //             for(let clrRel of clrRelArray) {
        //                 if(lnkInfo.value.includes(clrRel.id.toString().trim()) === false) {
        //                     lnkInfo.value.push(clrRel.id.toString().trim())
        //                 }
        //             }
        //         }
        //         else {
        //             for(let clrRel of clrRelArray) {
        //                 lnkInfo.value = lnkInfo.value.filter(x => x.trim().toLowerCase() !== clrRel.id.toString().trim().toLowerCase())
        //             }
        //         }
        //     }
        // }

//====================================================


// <li key={params.key}>
//     <div>
//         <ListItemButton
//             onClick={(event) => onLinkageElementSelected(event, true, params.group, lnkInfo)} 
//             sx={{ml: 2}}>
//             <ListItemIcon>
//                 <CheckBoxOutlineBlankOutlined />
//             </ListItemIcon>
//             <ListItemText sx={{ml: -3}} primary={params.group} />
//         </ListItemButton>
        
//     </div>
//     <div>{params.children}</div>
// </li>


// let clrRel = project.clearanceRelationBrands.find(a => a.id === optionId)
// if(clrRel) {
//     if(isSelected) {
//         if(lnkInfo.value.includes(clrRel.id.toString().trim()) === false) {
//             lnkInfo.value.push(clrRel.id.toString().trim())
//         }
//     }
//     else {
//         lnkInfo.value = lnkInfo.value.filter(x => x.trim().toLowerCase() !== clrRel.id.toString().trim().toLowerCase())
//     }
// }


// <ListItemButton {...optionProps} 
//     onClick={(event) => onLinkageElementCheckboxChanged(event, true, option, lnkInfo)} 
//     sx={{ml: 4}}>
//     <ListItemIcon>
//         <Thunderstorm />
//     </ListItemIcon>
//     <ListItemText sx={{ml: -3}} primary={option.label} />
// </ListItemButton>


//=====================

{/* <Autocomplete
    multiple={true}
    id="chkbox-tags-linkage"
    disableCloseOnSelect
    size="small"
    sx={{ }}
    disabled={(lnkInfo.name && lnkInfo.name.length > 0) ? false : true}
    value={ lnkInfo.value.map(x => ({id: x, label: getOptionNameStr(x)} as DisplayOption)) as DisplayOption[]} 
    options={getLinkageCheckboxOptions()}
    groupBy={constraintType === ConstraintTypesEnum.Physical ? (option) => option.type as string : undefined }
    getOptionLabel={(option: DisplayOption) => option.label}
    renderGroup={(params) => (
        <li key={params.key}>
            <div>
                <FormControlLabel 
                    label={params.group}
                    sx={{}}
                    control={<Checkbox 
                        icon={<CheckBoxOutlineBlankOutlined fontSize="small" />} 
                        checkedIcon={<CheckBoxOutlined fontSize="small" />} 
                        sx={{ ml: 3, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR }} 
                        checked={false} 
                        onChange={(event, checked) => onLinkageElementCheckboxChanged(event, checked, params, lnkInfo)} 
                    />} 
                />
                
            </div>
            <div>{params.children}</div>
        </li>
    )}
    renderOption={(props: any, option: DisplayOption, { selected }: any) => {
        const { key, ...optionProps } = props;
        return (
            <li key={key} {...optionProps}>
                <Checkbox 
                    icon={<CheckBoxOutlineBlankOutlined fontSize="small" />} 
                    checkedIcon={<CheckBoxOutlined fontSize="small" />} 
                    sx={{ height: 25, ml: 8, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR }} 
                    checked={selected} 
                    onChange={(event, checked) => onLinkageElementCheckboxChanged(event, checked, option, lnkInfo)} />
                <span style={{marginLeft: 5}}>{option.label}</span>
            </li>
        );
    }}
    renderInput={(params: any) => (
        <TextField {...params} 
            label={ConstraintTypesEnum.Physical ? "Physical Linked Elements" : "Clearance Linked Elements"}
            size="small" 
            placeholder={ConstraintTypesEnum.Physical ? "Netclasses" : "Clearance Relations Names"}
        />
    )}
/> */}



//===================================================================================

// const grouperMap = useMemo(() => {         
//     let map = new Map<string, string>()
//     // interfaceList = sort(interfaceList ?? []).asc(a => a.name.toUpperCase());
//     // for(let iface of interfaceList) {
//     //     let res = getChannelToNameMapping(iface, true)
//     //     if(res.isSuccessful === false && res.message) {
//     //         displayQuickMessage(UIMessageType.ERROR_MSG, res.message, 10000);
//     //         return;
//     //     }
//     //     else {
//     //         for(let [key, value] of (res.data as Map<number, {id: string, name: string}>)) {
//     //             let g2gInfo = iface.groupRelationsInfo.find(x => x.id === value.id) as G2GRelationInfo
//     //             map.set(value.id, [value.name, g2gInfo])
//     //         }
//     //     }
//     // }
//     return map
// }, []);

//==================================================================



{/* <Autocomplete
                                                                value={project.clearanceRelationBrands}
                                                                multiple={true}
                                                                id="chkbox-tags-linkage"
                                                                options={project.clearanceRelationBrands}
                                                                disableCloseOnSelect
                                                                size="small"
                                                                getOptionLabel={(option) => option.name}
                                                                style={{ }}
                                                                disabled={(prop.name && prop.name.length > 0 && (!existingLinkageDataRef.current || existingLinkageDataRef.current.every(x => x.id !== prop.id))) ? false : true} 
                                                                renderOption={(props, option, { selected }) => {
                                                                    const { key, ...optionProps } = props;
                                                                    return (
                                                                    <li key={key} {...optionProps}>
                                                                        <Checkbox icon={<CheckBoxOutlineBlankOutlined fontSize="small" />} checkedIcon={<CheckBoxOutlined fontSize="small" />} style={{ marginRight: 8 }} checked={selected} />
                                                                        {option.name}
                                                                    </li>
                                                                    );
                                                                }}
                                                                renderInput={(params) => (
                                                                    <TextField {...params} 
                                                                        label="Physical Linkage Element" 
                                                                        size="small" 
                                                                        placeholder="Netclasses222"
                                                                        sx={{ fieldset : { borderColor: SPECIAL_GOLD_COLOR } }} />
                                                                )}
                                                            /> */}

                                                            

//==============================================================================



// <TextField
//                                     value={channelRangeSpecified}
//                                     id="channel-name-text"
//                                     label="Specify channel range (optional)"
//                                     variant="outlined"
//                                     size="small"
//                                     disabled={(interfaceNameSpecified && interfaceNameSpecified.length > 0) ? false : true}
//                                     onChange={(e: any) => { setChannelRangeSpecified(e.target.value) }}
//                                     sx={{ mb: 2, fieldset : { borderColor: (channelRangeSpecified && channelRangeSpecified.length > 0) ? SPECIAL_GOLD_COLOR : undefined } }}
//                                 />

{/* <Autocomplete<Project>
    value={selectedSourceProject}
    onChange={(event, value, reason, details) => setSelectedSourceProject(value)}
    key="proj-sel-CB"
    freeSolo={false}
    filterSelectedOptions={true}
    disablePortal
    disableListWrap
    disabled={false}
    size="small"
    id="proj-sel-cb"
    sx={{ mb: 2, mt: 2, minWidth: 300}}
    options={projectList}
    groupBy={(option) => option.owner.idsid}
    getOptionLabel={(option) => option.name} //Important!
    renderInput={(params) => <TextField {...params} label="Source Project" size="small" />}
/> */}
                                                            


// let relInfo = await getRelationNameElementsForIface(projectId, iface._id as string, null)
// let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, relevDataMappingRef.current, lgSetMapping, projectId, Number.MAX_SAFE_INTEGER, ruleArea.id, iface._id, null, true)



{/* <Box className="staggered-list-content">
    {visibleRuleAreas && 
        <ul className="list">
            {visibleRuleAreas.map((ra: RuleArea, i: number) => {
                return (
                    <li key={`itm-${i}`} style={{ minWidth: 400}}>
                        {((focusRA && focusRA.id === ra.id))
                            ? <ExpandedRulesItem key={`exp-${i}`} ruleArea={focusRA} iface={iface}
                                project={project as Project} lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} 
                                maxLGCount={maxLGCount} relevantPropMap={relevantPropMap}
                                constraintType={ConstraintTypesEnum.Clearance} onClick={handleOnClick} onLGSetChange={onLGSetChange}/> 

                            : <CompressedRulesItem 
                                key={`cpr-${i}`} 
                                ruleArea={ra} 
                                onClick={handleOnClick} 
                                constraintType={ConstraintTypesEnum.Clearance} 
                                contentCount={clrRelMappingInfo.get(ra.id)?.length ?? 0 }/>
                        }
                    </li>
                );
            })}
        </ul>
    }  
</Box> */}