import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, Checkbox, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { Cancel, Check, LabelImportantOutlined, RadioButtonUncheckedOutlined } from '@mui/icons-material';
import { Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CHANNEL_RANGE, CommonPropertyCategoryEnum, IFACE_COPY_LAYERGROUP_MAPPING, IFACE_COPY_RULEAREA_MAPPING, INTERFACE_PROP_DESCRIPTION, InterfaceInitTypeEnum, NamingContentTypeEnum, NETCLASSES_PROP_NAME, SPECIAL_BLUE_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { isNumber, rfdcCopy, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { Interface, LayerGroup, LayerGroupSet, Netclass, PackageLayout, Project, RuleArea } from '../DataModels/ServiceModels';
import { BasicKVP, BasicProperty, DisplayOption, LoggedInUser, PropertyItem } from '../DataModels/HelperModels';
import { fetchClassRelationLayout, fetchG2GContextList, fetchInterfaceDetails, fetchInterfaceList, getPkgLayout, getRelationNameElementsForIface } from '../BizLogicUtilities/FetchData';
import { useSpiderStore } from '../DataModels/ZuStore';
import { sort } from "fast-sort";
import { getChannelRangeAndTemplateBasedNetclassListForInterface } from '../BizLogicUtilities/BasicCommonLogic';
import { SpButton } from '../CommonComponents/SimplePieces';



//make sure interface name is not already used in project
//make sure all imported netclass names are not already used in project
//      change the name - user cvan decide what to do after that if they dont like it
// make sure all name adhere to standards


const dummyRA : RuleArea = {
    id: "",
    ruleAreaName: "",
    xmodName: "",
    isActive: false,
    defaultConstraintId: "",
    visibilityContext: [],
    tags: []
}


const dummyLG : LayerGroup = {
    id: "",
    name: "",
    isActive: false,
    layers: [],
    tags: []
}


export interface InterfaceCopyDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string,
    targetProject: Project,
    targetPackageLayout: PackageLayout,
    targetExistingNetclasses: Netclass[],
    projectList: Project[],
    onFormClosed : (contextualInfo: BasicKVP) => void,
    contextualInfo: BasicKVP
}

const InterfaceCopyDialog: React.FC<InterfaceCopyDialogProps> = ({ title, targetProject, projectList, targetPackageLayout, targetExistingNetclasses, opened, close, onFormClosed, contextualInfo }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled)

    const [selectedSourceProject, setSelectedSourceProject] = useState<Project|null>(null)
    const [selectedSourceInterface, setSelectedSourceInterface] = useState<Interface|null>(null)
    const [sourceProjectPkgLayout, setSourceProjectPkgLayout] = useState<PackageLayout|null>(null)
    const [sourceProjectLayerGroups, setSourceProjectLayerGroups] = useState<LayerGroup[]>([])

    const [ifacesForSelectedProject, setIfacesForSelectedProject] = useState<Interface[]>([]);
    const [currentProjectGoldenLGSetLayerGroups, setCurrentProjectGoldenLGSetLayerGroups] = useState<LayerGroup[]>([])

    const [ruleAreaMapping, setRuleAreaMapping] = useState<Map<string, RuleArea|undefined>>(new Map<string, RuleArea|undefined>())
    const [layerGroupMapping, setLayerGroupMapping] = useState<Map<string, LayerGroup|undefined>>(new Map<string, LayerGroup|undefined>())

    const [interfaceNameSpecified, setInterfaceNameSpecified] = useState('')
    const [interfaceDescriptionSpecified, setInterfaceDescriptionSpecified] = useState('')



    useEffect(() => {
        if(ruleAreaMapping.size === 0) {
            let raMap = new Map<string, RuleArea|undefined>()
            for(let ra of targetPackageLayout.ruleAreas) {
                raMap.set(ra.id, undefined);
            }
            setRuleAreaMapping(raMap);
        }

        let tgtGldLGSet = targetPackageLayout?.layerGroupSets?.find((a: LayerGroupSet) => (a.isGolden === true));
        if(tgtGldLGSet && layerGroupMapping.size === 0) {
            let lgMap = new Map<string, LayerGroup|undefined>()
            for(let lg of tgtGldLGSet.layerGroups) {
                lgMap.set(lg.id, undefined);
            }
            setLayerGroupMapping(lgMap);
            setCurrentProjectGoldenLGSetLayerGroups(tgtGldLGSet.layerGroups ?? [])
        }
    }, [])



    useEffect(() => {
        if(selectedSourceProject && selectedSourceProject._id) {
            setIsLoadingBackdropEnabled(true)
            fetchInterfaceList(selectedSourceProject._id.toString() as string).then((ifaceList) => {
                if(ifaceList && ifaceList.length > 0) {
                    setIfacesForSelectedProject(ifaceList);
                    getPkgLayout(selectedSourceProject._id.toString() as string).then((srcProjPkg) =>{
                        
                        setSourceProjectPkgLayout(srcProjPkg);
                        let raCopy = rfdcCopy<Map<string, RuleArea|undefined>>(ruleAreaMapping) as Map<string, RuleArea|undefined>
                        for(let [tgtRaid, srcRA] of raCopy) {
                            if(!srcRA || srcRA === null) {
                                let tgtRA = targetPackageLayout.ruleAreas.find(x => x.id === tgtRaid) as RuleArea
                                let similarFound = srcProjPkg.ruleAreas.find(a => a.ruleAreaName.toLowerCase().trim() === tgtRA.ruleAreaName.toLowerCase().trim());
                                if(similarFound) {
                                    raCopy.set(tgtRaid, similarFound);
                                }
                            }
                        }
                        setRuleAreaMapping(raCopy)

                        //-----------------------------------------

                        let srcProjGoldenLGSet = srcProjPkg?.layerGroupSets?.find((a: LayerGroupSet) => (a.isGolden === true));
                        if(!srcProjGoldenLGSet || !srcProjGoldenLGSet.layerGroups || srcProjGoldenLGSet.layerGroups.length === 0){
                            performReset();
                            displayQuickMessage(UIMessageType.ERROR_MSG, `The selected source project cannot be used. The source project must have a 'Golden' LayerGroupSet with valid layer groups.`)
                        }
                        else {
                            setSourceProjectLayerGroups(srcProjGoldenLGSet.layerGroups);
                            let lgCopy = rfdcCopy<Map<string, LayerGroup|undefined>>(layerGroupMapping) as Map<string, LayerGroup|undefined>
                            for(let [tgtLaid, srcLG] of lgCopy) {
                                if(!srcLG || srcLG === null) {
                                    let tgtLG = currentProjectGoldenLGSetLayerGroups.find(x => x.id === tgtLaid) as LayerGroup
                                    let similarFound = srcProjGoldenLGSet.layerGroups.find(a => a.name.toLowerCase().trim() === tgtLG.name.toLowerCase().trim());
                                    if(similarFound) {
                                        lgCopy.set(tgtLaid, similarFound);
                                    }
                                }
                            }
                            setLayerGroupMapping(lgCopy)
                        }

                    })
                }
            })
            .finally(() => {
                setIsLoadingBackdropEnabled(false)
            })
        }
    }, [selectedSourceProject])


    
    function onSelectedSourceProject(option: DisplayOption|null, isClearAllAction: boolean): void {
        let proj = (option ? projectList?.find(a => a._id.toString() === option.id) : null) ?? null;

        let resetOthFields = false;
        if(selectedSourceInterface && selectedSourceProject && proj && (selectedSourceProject._id.toString() !== proj._id.toString())) {
            resetOthFields = true;
        };
        if((isClearAllAction === false) && proj && proj._id) {
            setSelectedSourceProject(proj);
            if(resetOthFields) {
                setSelectedSourceInterface(null)
                setInterfaceNameSpecified('')
            }
        }
        else {
            setSelectedSourceProject(null)
        }
    }



    function onSourceInterfaceSelection(value: Interface | null): void {
        if(value && value._id) {
            setIsLoadingBackdropEnabled(true)
            fetchInterfaceDetails(value._id.toString()).then((iface) => {
                if(iface) {
                    setSelectedSourceInterface(iface);
                    if(targetExistingNetclasses && targetExistingNetclasses.every(a => a.name.toLowerCase().trim() !== iface.name.toLowerCase().trim())){
                        setInterfaceNameSpecified(iface.name);
                    }
                    else {
                        setInterfaceNameSpecified('')
                    }
                }
            })
            .finally(() => {
                setIsLoadingBackdropEnabled(false)
            })
        }
        else {
            setInterfaceNameSpecified('')
        }
    }



    function performReset() {
        setSelectedSourceProject(null);
        setSelectedSourceInterface(null)
        setSourceProjectPkgLayout(null)
        setSourceProjectLayerGroups([])
        setIfacesForSelectedProject([])
        setCurrentProjectGoldenLGSetLayerGroups([]);
        setRuleAreaMapping(new Map<string, RuleArea|undefined>())
        setLayerGroupMapping(new Map<string, LayerGroup|undefined>())
        setInterfaceNameSpecified('')
        setInterfaceDescriptionSpecified('')
    }



    function handleCancel() {
        if (onFormClosed) {
            contextualInfo.value = null;
            onFormClosed(contextualInfo);
        }
        performReset()
        if(close){ close() }
    }



    async function handleSubmit() {
        if(!selectedSourceInterface) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Source interface is required. Please select an existing interface`)
            return;
        }

        if(!interfaceNameSpecified || interfaceNameSpecified.length === 0) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Interface name is required. Please enter a name for the interface`)
            return;
        }

        try { verifyNaming([interfaceNameSpecified], NamingContentTypeEnum.INTERFACE) }
        catch(e: any) {
            displayQuickMessage(UIMessageType.ERROR_MSG, e.message);
            return;
        }
        
        try {
            setIsLoadingBackdropEnabled(true)

            let currProjIfaces = await fetchInterfaceList(targetProject._id.toString() as string)
            if(currProjIfaces && currProjIfaces.length > 0 ) {
                if(currProjIfaces.some(a => a.name.toLowerCase().trim() === interfaceNameSpecified.toLowerCase().trim())) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `An interface with the same name already exists for current project. Please choose a different name`);
                    return;
                }
            }

            let raArr = new Array<BasicKVP>();
            for(let [tgtRaid, correspRA] of ruleAreaMapping) {
                if(!correspRA || !correspRA.id || correspRA.id.length === 0) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Rule area mapping must be completed. `
                        + `Each target rule area must be mapped to a corrresponding rule area of the source project`)
                    return;
                }
                else {
                    raArr.push({key: tgtRaid, value: correspRA.id} as BasicKVP)
                }
            }

            let lyrGrpArr = new Array<BasicKVP>();
            for(let [tgtLgid, correspLG] of layerGroupMapping) {
                if(!correspLG || !correspLG.id || correspLG.id.length === 0) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Layer group mapping must be completed. `
                        + `Each target layer group must be mapped to a corrresponding layer group of the source project`)
                    return;
                }
                else {
                    lyrGrpArr.push({key: tgtLgid, value: correspLG.id} as BasicKVP)
                }
            }

            let srcProjId = selectedSourceProject?._id.toString() as string;
            let srcIfaceId = selectedSourceInterface?._id.toString() as string;
                
            let iface : Interface = {
                _id: '',
                projectId: targetProject?._id.toString() || '',
                snapshotSourceId: '',
                contextProperties: [], //important to be empty at first. see actions populating it (below)
                lastUpdatedOn: new Date(),
                name: interfaceNameSpecified,
                sourceInterfaceId: srcIfaceId,
                sourceProjectId: srcProjId,
                initializationType: InterfaceInitTypeEnum.EXTERNAL_IMPORT,
                createdOn: new Date(),
                createdBy: '',
                sourceTemplate: selectedSourceInterface?.sourceTemplate as any,
                shadowVoidEntries: selectedSourceInterface?.shadowVoidEntries ?? [],
                associatedProperties: selectedSourceInterface?.associatedProperties ?? [],
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
            
            //add description to associatedProperties
            iface.associatedProperties = iface.associatedProperties.filter(a => a.name !== INTERFACE_PROP_DESCRIPTION)
            iface.associatedProperties.push(descProp)

            //add rule area mapping info
            let raMapArrProp : BasicProperty = { id: crypto.randomUUID(), name: IFACE_COPY_RULEAREA_MAPPING, value: raArr }
            iface.contextProperties.push(raMapArrProp);

            //add layer group mapping info
            let lyrGrpMapArrProp : BasicProperty = { id: crypto.randomUUID(), name: IFACE_COPY_LAYERGROUP_MAPPING, value: lyrGrpArr }
            iface.contextProperties.push(lyrGrpMapArrProp);

            let res = await getChannelRangeAndTemplateBasedNetclassListForInterface(selectedSourceInterface);
            if(res.isSuccessful === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, res.message);
                return;
            }

            let channelRangeStrValue = res.data?.channelRangeStr || "";
            let netclassListToPassAlong = res.data?.focusNetclasses ?? [];
            let sourceIfaceFullNetclassList = res.data?.completeNetclassList ?? [];

            //add channel range short string to context
            if(channelRangeStrValue && channelRangeStrValue.trim().length > 0) {
                let channelRangeProp : BasicProperty = { id: crypto.randomUUID(), name: CHANNEL_RANGE, value: channelRangeStrValue }
                iface.contextProperties = iface.contextProperties.filter(a => a.name !== CHANNEL_RANGE) ?? []
                iface.contextProperties.push(channelRangeProp);
            }

            //add netclass info for submission to backend
            netclassListToPassAlong.forEach(a => { 
                a.projectId = targetProject?._id.toString() || ''; //Important!!
            })  
            let netclassProp : BasicProperty = { id: crypto.randomUUID(), name: NETCLASSES_PROP_NAME, value: netclassListToPassAlong  }
            iface.contextProperties.push(netclassProp);
           

            //assess final dialog output data....
            let srcNetclassFullMap = new Map<string, Netclass>(sourceIfaceFullNetclassList.map(a => [(a._id?.toString() as string), a])) //this is the full list before any filtering
            let nonTransefableClrRel = new Map<string, [BasicProperty, Netclass, Netclass]>();
            let srcNetClassIDs = new Set<string>(sourceIfaceFullNetclassList.map(a => (a._id?.toString() as string)))
                
            try {    
                for(let srcRaid of raArr.map(a => (a.value as string)) ?? []) {
                    let relsForIfaceAndRA : BasicProperty[] = (await getRelationNameElementsForIface(srcProjId, srcIfaceId, srcRaid))?.value ?? [];
                    let srcC2CRowsForIfaceAndRA = await fetchClassRelationLayout(srcProjId, null, Number.MAX_SAFE_INTEGER, srcRaid, srcIfaceId, null, null, false) ?? [];
                    for(let srcC2C of srcC2CRowsForIfaceAndRA) {
                        let frmNC = srcNetclassFullMap.get(srcC2C.netclassId)
                        for(let srcSlot of srcC2C.slots) {
                            if(srcSlot.value && srcSlot.value.trim().length > 0) {
                                let isAllSlot = ((!srcSlot.netclassId || srcSlot.netclassId.trim().length === 0) && srcSlot.name && srcSlot.name.length > 0)  //'ALL' & those that are 'within interface'
                                if((isAllSlot === false) && srcSlot.netclassId && (srcNetClassIDs.has(srcC2C.netclassId) === false)) { 
                                    let toNC = srcNetclassFullMap.get(srcSlot.netclassId)
                                    let foundRel = relsForIfaceAndRA?.find(a => a.id.toLowerCase() === srcSlot.value.toLowerCase());
                                    if(foundRel && frmNC && toNC) {
                                        nonTransefableClrRel.set(foundRel.id, [foundRel, frmNC, toNC]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch(error: any) {
                displayQuickMessage(UIMessageType.ERROR_MSG, error.message);
                return;
            }

            //assign dialog output
            contextualInfo.value = [iface, nonTransefableClrRel] as [Interface, Map<string, [BasicProperty, Netclass, Netclass]>]

        }
        finally {
            setIsLoadingBackdropEnabled(false)
        }

        
        if (onFormClosed) {
            onFormClosed(contextualInfo);
        }
        
        performReset()
        if(close){ close() }
    }


    function onRuleAreaMappingAction(ruleArea: RuleArea, value: RuleArea | null): void {
        if(ruleArea && value) {
            if(ruleAreaMapping.has(ruleArea.id)) {
                let copy = rfdcCopy<Map<string, RuleArea|undefined>>(ruleAreaMapping) as Map<string, RuleArea|undefined>
                copy.set(ruleArea.id, value)
                setRuleAreaMapping(copy);
            }
        }
    }

    
    function onLayerGroupMappingAction(layerGroup: LayerGroup, value: LayerGroup | null): void {
        if(layerGroup && value) {
            if(layerGroupMapping.has(layerGroup.id)) {
                let copy = rfdcCopy<Map<string, LayerGroup|undefined>>(layerGroupMapping) as Map<string, LayerGroup|undefined>
                copy.set(layerGroup.id, value)
                setLayerGroupMapping(copy);
            }
        }
    }




    return (
        <Box>
            <Modal 
                opened={opened as boolean}
                onClose={handleCancel} 
                closeOnClickOutside={false}
                closeOnEscape={false}
                centered
                size="auto"  //'xs' | 'sm' | 'md' | 'lg' | 'xl';
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 25,
                }}
                styles={{
                    
                    title: { padding: 2, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: "red", backgroundColor: colors.primary[400] }
                }}>
                    <Box sx={{ '& .MuiTextField-root': { width: '100%'}, }}>
                        <>
                            <Divider sx={{ mt: 0, mb: 0 }} />                    
                            
                            <Autocomplete
                                multiple={false}
                                id="proj-selection-cb"
                                size="small"
                                disabled={false}
                                freeSolo={false}
                                sx={{ mb: 2, mt: 2, minWidth: 300}}
                                value={(selectedSourceProject && selectedSourceProject._id) 
                                    ? {id: selectedSourceProject._id.toString(), label: selectedSourceProject.name, type: selectedSourceProject.org } as DisplayOption
                                    : {id: "", label: "", type: "" } as DisplayOption 
                                }
                                options={projectList.map(x => ({ id: x._id.toString(), label: x.name, type: x.org } as DisplayOption))}
                                groupBy={(option) => option.type as string }
                                getOptionLabel={(option: DisplayOption) => option.label}
                                onChange={(event, value, reason, details) => {
                                    if(reason.toLowerCase() === "clear") {
                                        onSelectedSourceProject(null, true)
                                    }
                                }}
                                renderGroup={(params) => (
                                    <Fragment key={params.key}>
                                        <ListItemButton
                                            sx={{ height: 32, ml: 0, backgroundColor: colors.primary[500] }}>
                                            <ListItemIcon>
                                                <LabelImportantOutlined />
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
                                                onChange={(event, checked) => onSelectedSourceProject(option, false)} 
                                            />
                                            <Typography sx={{ fontSize:12 }} onClick={(event) => onSelectedSourceProject(option, false)} >
                                                {option.label}
                                            </Typography>
                                        </ListItem>
                                    );
                                }}
                                renderInput={(params: any) => (
                                    <TextField {...params} 
                                        label={"Source Project"}
                                        size="small"
                                        sx={{ fontSize:12 }}
                                        placeholder={undefined}
                                    />
                                )}
                            />

                            <Autocomplete<Interface>
                                value={selectedSourceInterface}
                                onChange={(event, value, reason, details) => onSourceInterfaceSelection(value)}
                                key="iface-sel-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                disabled={(selectedSourceProject && selectedSourceProject.name.length > 0) ? false : true}
                                size="small"
                                id="iface-sel-cb"
                                sx={{ mb: 2, minWidth: 300 }}
                                options={ifacesForSelectedProject}
                                getOptionLabel={(option) => option.name} //Important!
                                renderInput={(params) => <TextField {...params} label="Source Interface" size="small" />}
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

                            <TextField 
                                value={interfaceDescriptionSpecified}
                                id="iface-desc-text"
                                label="Provide description for interface"
                                multiline
                                size="small"
                                maxRows={3}
                                disabled={(interfaceNameSpecified && interfaceNameSpecified.length > 2 ) ? false : true}
                                slotProps={{
                                    htmlInput: {
                                    maxLength: 240,
                                    }
                                }}
                                onChange={(e: any) => { setInterfaceDescriptionSpecified(e.target.value) }}
                                sx={{ mb: 0}} 
                            />
                        </>
                        <Box sx={{mt: 1, display: "flex", flexDirection:"column"}} >
                        
                            {/* <Divider sx={{mt: 3, mb: 2, backgroundColor: colors.greenAccent[400]}}/> */}

                            <Box sx={{ mt: 3, display: "flex", flexDirection:"row", justifyContent: "space-between", alignItems:"center"}}>
                                <Box sx={{minWidth: 550, alignSelf: "flex-start"}}>    
                                    <Box sx={{textAlign: "center"}}>
                                        <Typography color={colors.greenAccent[400]}>{`Rule Area Mapping`}</Typography>
                                        <Divider sx={{mt: .5, mb: 2 }}/>
                                    </Box>
                                </Box>
                                <Box sx={{minWidth: 550, alignSelf: "flex-start"}}>    
                                    <Box sx={{textAlign: "center"}}>
                                        <Typography color={colors.greenAccent[400]}>{`Layer Group Mapping`}</Typography>
                                        <Divider sx={{mt: .5, mb: 2 }}/>
                                    </Box>
                                </Box>
                            </Box>
                            
                            <Box sx={{display: "flex", maxHeight: 380, flexDirection:"row", justifyContent: "center", alignItems:"center", }}>
                                <Box sx={{minWidth: 550, alignSelf: "flex-start", overflowY: "auto", maxHeight: 380 }}>    
                                    <Box sx={{ mr: 1}}>
                                        <Table stickyHeader border={1} sx={{ borderTopRightRadius: 12, backgroundColor: "rgba(102, 153, 153, 0.07)"}}>
                                            <TableHead>
                                                <TableRow sx={{ padding: 0}}>
                                                    <TableCell size="small" sx={{ backgroundColor: colors.blueAccent[400], minWidth: 200, padding: 0.5, fontSize: 13, textAlign: "center", whiteSpace: "pre-line"}}>
                                                        {`Target Project Rule Areas \n(${targetProject.name})`}
                                                    </TableCell>
                                                    <TableCell size="small" sx={{ backgroundColor: colors.blueAccent[400], borderTopRightRadius: 12, minWidth: 200, padding: 0.5, fontSize: 13, textAlign: "center", whiteSpace: "pre-line"}}>
                                                        {`Source Equivalent \n${selectedSourceProject?.name ? `(${selectedSourceProject?.name})` : ''}`}
                                                    </TableCell>
                                                </TableRow>
                                                
                                            </TableHead>
                                            <TableBody>
                                                {targetPackageLayout.ruleAreas.map((ruleArea: RuleArea, index: number) => (
                                                    <Fragment key={`ra-frag-${index}`}>
                                                        <TableRow key={`ra-tr-${index}`} >
                                                        
                                                            <TableCell size="small" sx={{ minWidth: 30, width: "20%", padding: 0, textAlign: "center" }}>
                                                                <Tooltip placement="top-start" title={ruleArea.ruleAreaName}>
                                                                    <Box sx={{ padding: 0, overflowX: "clip"}}>
                                                                        <Typography sx={{ fontSize: 13 }}>{`${ruleArea.ruleAreaName}`}</Typography> 
                                                                    </Box>
                                                                </Tooltip>
                                                            </TableCell>

                                                            <TableCell size="small" sx={{ maxWidth: 70, width: "65%", padding: 0, color: "#000000", textAlign: "center" }}>
                                                                <Box sx={{ padding: 1 }}>                                                                    
                                                                    <Autocomplete<RuleArea>
                                                                        value={ruleAreaMapping.get(ruleArea.id) ?? dummyRA}
                                                                        onChange={(event, value, reason, details) => onRuleAreaMappingAction(ruleArea, value)}
                                                                        key="ra-sel-CB"
                                                                        freeSolo={false}
                                                                        filterSelectedOptions={true}
                                                                        disablePortal
                                                                        disableListWrap
                                                                        disabled={false}
                                                                        size="small"
                                                                        id="ra-sel-cb"
                                                                        sx={{ mb: 0, mt: 0, minWidth: 300}}
                                                                        options={(Array.from(sourceProjectPkgLayout?.ruleAreas?.values() ?? [])).filter(x => x !== undefined)}
                                                                        getOptionLabel={(option) => option.ruleAreaName} //Important!
                                                                        renderInput={(params) => <TextField {...params} label="Source Project Rule Area" size="small" />}
                                                                    />
                                                                </Box>
                                                            </TableCell>

                                                        </TableRow>

                                                    </Fragment>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                </Box>

                                <Box sx={{ ml: 4, mr: 4, display: "flex", flexDirection:"row", justifyContent: "center", alignItems:"center"}}>
                                    <Box sx={{ display: "flex", flexDirection:"column", justifyContent: "center", alignItems:"center" }} gap={3}>
                                        <Divider sx={{ width: 33, transform: 'rotate(135deg)' }}/>
                                        <Divider sx={{ width: 33, transform: 'rotate(225deg)' }}/>
                                    </Box>
                                    <Divider orientation="vertical" sx={{ minHeight: 380, height: 380, marginLeft: 1, marginRight: 1 }} />
                                    <Box sx={{ display: "flex", flexDirection:"column", justifyContent: "center", alignItems:"center" }} gap={3}>
                                        <Divider sx={{ width: 33, transform: 'rotate(225deg)' }}/>
                                        <Divider sx={{ width: 33, transform: 'rotate(135deg)' }}/>
                                    </Box>
                                </Box>
                                
                                <Box sx={{minWidth: 550, alignSelf: "flex-start", overflowY: "auto", maxHeight: 380 }}>
                                    <Box sx={{ mr: 1, }}>
                                        <Table stickyHeader border={1} sx={{ borderTopLeftRadius: 12, backgroundColor: "rgba(102, 153, 153, 0.07)"}}>
                                            <TableHead>
                                                <TableRow sx={{ padding: 0, backgroundColor: colors.blueAccent[400]}}>
                                                    <TableCell size="small" sx={{ backgroundColor: colors.blueAccent[400], borderTopLeftRadius: 12, minWidth: 200, padding: 0.5, fontSize: 13, textAlign: "center", whiteSpace: "pre-line"}}>
                                                    {`Target Project Layer Groups \n(${targetProject.name})`}
                                                    </TableCell>
                                                    <TableCell size="small" sx={{ backgroundColor: colors.blueAccent[400], minWidth: 200, padding: 0.5, fontSize: 13, textAlign: "center", whiteSpace: "pre-line"}}>
                                                        {`Source Equivalent \n${selectedSourceProject?.name ? `(${selectedSourceProject?.name})` : ''}`}
                                                    </TableCell>
                                                </TableRow>
                                                
                                            </TableHead>
                                            <TableBody>
                                                {currentProjectGoldenLGSetLayerGroups.map((layerGroup: LayerGroup, index: number) => (
                                                    <Fragment key={`lg-frag-${index}`}>
                                                        <TableRow key={`lg-tr-${index}`} >
                                                        
                                                            <TableCell size="small" sx={{ minWidth: 30, width: "20%", padding: 0, textAlign: "center" }}>
                                                                <Tooltip placement="top-start" title={layerGroup.name}>
                                                                    <Box sx={{ padding: 0, overflowX: "clip"}}>
                                                                        <Typography sx={{ fontSize: 13 }}>{`${layerGroup.name}`}</Typography> 
                                                                    </Box>
                                                                </Tooltip>
                                                            </TableCell>

                                                            <TableCell size="small" sx={{ maxWidth: 70, width: "65%", padding: 0, color: "#000000", textAlign: "center" }}>
                                                                <Box sx={{ padding: 1 }}>
                                                                    <Autocomplete<LayerGroup>
                                                                        value={layerGroupMapping.get(layerGroup.id) ?? dummyLG}
                                                                        onChange={(event, value, reason, details) => onLayerGroupMappingAction(layerGroup, value)}
                                                                        key="lg-sel-CB"
                                                                        freeSolo={false}
                                                                        filterSelectedOptions={true}
                                                                        disablePortal
                                                                        disableListWrap
                                                                        disabled={false}
                                                                        size="small"
                                                                        id="lg-sel-cb"
                                                                        sx={{ mb: 0, mt: 0, minWidth: 300}}
                                                                        options={sourceProjectLayerGroups}
                                                                        getOptionLabel={(option) => option.name} //Important!
                                                                        renderInput={(params) => <TextField {...params} label="Source Project LayerGroups" size="small" />}
                                                                    />
                                                                </Box>
                                                            </TableCell>

                                                        </TableRow>

                                                    </Fragment>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                </Box>
                                
                            </Box>

                        </Box>

                    </Box>

                    <Divider sx={{ mt: 3, mb: .5 }}/>
                    
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
                                disabled={(selectedSourceInterface && interfaceNameSpecified && interfaceNameSpecified.length > 0) ? false : true}
                                label="Submit" />
                        </Box>
                        
                    </Box>
            </Modal>
        </Box>
    );
}

export default InterfaceCopyDialog
















//====================================================================================

    // function onSelectedSourceProject(value: Project | null): void {
    //     let resetOthFields = false;
    //     if(selectedSourceInterface && selectedSourceProject && value && (selectedSourceProject._id.toString() !== value._id.toString())) {
    //         resetOthFields = true;
    //     };
    //     if(value && value._id) {
    //         setSelectedSourceProject(value);
    //         if(resetOthFields) {
    //             setSelectedSourceInterface(null)
    //             setInterfaceNameSpecified('')
    //         }
    //     }
    //     else {
    //         setSelectedSourceProject(null)
    //     }
    // }



//==============================================================================


{/* <Autocomplete
    multiple={false}
    id="proj-selection-cb"
    size="small"
    disabled={false}
    freeSolo={false}
    sx={{minWidth: 310}}
    value={selectedLoadSourceOption || {id: "", label: "", type: "" } as DisplayOption }
    options={sourceDisplayOptions}
    groupBy={(option) => option.type as string }
    getOptionLabel={(option: DisplayOption) => option.label}
    onChange={(event, value, reason, details) => {
        if(reason.toLowerCase() === "clear") {
            onLoadStackupDataFromExistingProject(event, false, null, true)
        }
    }}
    renderGroup={(params) => (
        <Fragment key={params.key}>
            <ListItemButton
                sx={{ height: 32, ml: 0, backgroundColor: colors.primary[500] }}>
                <ListItemIcon>
                    <LabelImportantOutlined />
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
                    onChange={(event, checked) => onLoadStackupDataFromExistingProject(event, checked, option, false)} 
                />
                <Typography sx={{ fontSize:12 }} onClick={(event) => onLoadStackupDataFromExistingProject(event, true, option, false)} >
                    {option.label}
                </Typography>
            </ListItem>
        );
    }}
    renderInput={(params: any) => (
        <TextField {...params} 
            label={"Existing Projects"}
            size="small"
            placeholder={undefined}
        />
    )}
/>
    */}




{/* <Autocomplete<Project>
    value={selectedSourceProject}
    onChange={(event, value, reason, details) => onSelectedSourceProject(value)}
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
    groupBy={(option) => option.org}
    getOptionLabel={(option) => option.org} //Important!
    renderGroup={(params) => (
        <Fragment key={params.key}>
            <ListItemButton
                sx={{ height: 32, ml: 0, backgroundColor: colors.primary[500] }}>
                <ListItemIcon>
                    <LabelImportantOutlined />
                </ListItemIcon>
                <ListItemText sx={{ml: -3}} primary={params.group} />
            </ListItemButton>
                
            <div>{params.children}</div>
        </Fragment>
    )}
    renderOption={(props: any, option: Project, { selected }: any) => {
        const { key, ...optionProps } = props;
        return (
            <ListItem key={key} {...optionProps}>
                <Checkbox 
                    icon={<RadioButtonUncheckedOutlined fontSize="small" sx={{color: SPECIAL_BLUE_COLOR}}/>} 
                    sx={{ height: 22, ml: 3 }} 
                    checked={selected} 
                    onChange={(event, checked) => onSelectedSourceProject(option)} 
                />
                <Typography sx={{ fontSize:12 }} onClick={(event) => onSelectedSourceProject(option)} >
                    {option.name}
                </Typography>
            </ListItem>
        );
    }}
    renderInput={(params) => <TextField {...params} label="Source Project" size="small" />}
/> */}



{/* 
<Autocomplete<Project>
    value={selectedSourceProject}
    onChange={(event, value, reason, details) => onSelectedSourceProject(value)}
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




//======================================================================================
            //======================================================================================
            //======================================================================================
            //WARNING: FOR CHANNELED INTERFACE, WE NEED TO GET THE CORE NETCLASSES - much like interface update scenario
            //======================================================================================
            //======================================================================================
            //======================================================================================

            // if(srcNCList && srcNCList.length > 0) {
            //     if(srcNCList.some(x => (x.channel && x.channel.length > 0))) {
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `Sorry ${loggedInUser.givenName}, interface copy feature is currently disabled for 'channelled' interfaces....`);
            //         return;
            //     }
            // }



            //======================================================================================
            //======================================================================================
            //======================================================================================


            // if(srcNCList && srcNCList.length > 0) {
            //     //It is important that the source NCs are fully intact. No changes except projectId. Pass it along as is from src project
            //     srcNCList = srcNCList.filter(x => x.interfaceId === srcIfaceId);
            //     srcNCList.forEach(a => { a.projectId = targetProject?._id.toString() || '' })
            //     let netclassProp : BasicProperty = { id: crypto.randomUUID(), name: NETCLASSES_PROP_NAME, value: srcNCList  }
            //     iface.contextProperties.push(netclassProp);  
            // }
            // else {
            //     displayQuickMessage(UIMessageType.ERROR_MSG, `Error scenario: Source interface must have at least one netclass!`);
            //     return;
            // }


            // //get channnel range from source interface
            // let channelRangeStrValue : string = "";
            // let firstChannelNumStr : string = "";

            // let srcG2gList = await fetchG2GContextList(selectedSourceProject?._id?.toString() as string, selectedSourceInterface._id?.toString())
            // if(srcG2gList && srcG2gList.length > 0) {
            //     let channelSet = new Set<number>();
            //     for(let g2g of srcG2gList) {
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



            // //handle netclasses - with channel consideration
            
            // let newArr = new Array<Netclass>();
            
            // if(!channelRangeStrValue || channelRangeStrValue.trim().length === 0) {
            //     newArr = rfdcCopy<Netclass>(srcNCList) as Netclass[];
            // }
            // else {
            //     newArr = rfdcCopy<Netclass>(srcNCList) as Netclass[];
            //     let finalArr = new Array<Netclass>();
            //     let firstSet = newArr.filter(a => a.channel.trim() === firstChannelNumStr);
            //     let ncNameInfoColl = getNetclassToChannelNameMapping(selectedSourceInterface, [firstSet[0]], srcG2gList)?.data?.values() ?? [];
            //     let chPrefix : string = Array.from(ncNameInfoColl)?.at(0)?.channelName || '';
                
            //     if(!firstChannelNumStr || firstChannelNumStr.length === 0 || !chPrefix || chPrefix.length === 0){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to determine netclass information for intended interface. Interface update is not possible");
            //         return;
            //     }

            //     for(let ncItem of firstSet) {
            //         let netclass = rfdcCopy<Netclass>(ncItem) as Netclass; //NOTE: we leave the '_id' intact  - we may use it to know which set the copy comes from
            //         if(netclass.name.trim().toUpperCase().startsWith(chPrefix.trim().toUpperCase())) {
            //             netclass.name = removeSubstringFromBeginning(netclass.name, (chPrefix + "_"), true);
            //             netclass.name = netclass.name.replace(/^_+/, '');  //remove preceeding instances of underscore
            //         }
            //         finalArr.push(netclass)
            //     }

            //     setNetclassArray(finalArr);
            // }
            




            







// let channelRangeStrValue : string = "";
//             let res = getChannelToNameMapping(selectedSourceInterface, false)
//             if(res.isSuccessful === false && res.message) {
//                 displayQuickMessage(UIMessageType.ERROR_MSG, res.message, 10000);
//                 return;
//             }
//             else {
//                 if(res.data && res.data.size > 0) {
//                     let channelNumbers = Array.from<number>(res.data.keys()).sort()
//                     let rangeRes = generateSeqChannelShortString(channelNumbers);
//                     if(rangeRes) {
//                         channelRangeStrValue = rangeRes;
//                     }
//                     else {
//                         channelRangeStrValue = channelNumbers.map(a => a.toString()).sort().join(",")
//                     }
//                 }
//             }


            







{/* <Box sx={{textAlign: "center"}}>
    <Typography color={colors.greenAccent[400]}>{`Rule Area Mapping`}</Typography>
    <Divider sx={{mt: .5, mb: 3 }}/>
</Box> */}
{/* <Box sx={{textAlign: "center"}}>
    <Typography color={colors.greenAccent[400]}>{`Layer Group Mapping`}</Typography>
    <Divider sx={{mt: .5, mb: 3 }}/>
</Box> */}
{/* <Box sx={{display: "flex", flexDirection:"row", justifyContent: "center", alignItems:"center"}}>
    <Divider sx={{ width: 33 }}/>
    <Divider orientation="vertical" sx={{height: 35, marginLeft: 2, marginRight: 2 }} />
    <Divider sx={{ width: 33 }}/>
</Box> */}



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

