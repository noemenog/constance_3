import { Box, Button, Checkbox, Divider, FormControlLabel, IconButton, InputBase, Link, Switch, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, DragEvent, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { ConstraintTypesEnum, ActionSceneEnum, NamingContentTypeEnum, SPECIAL_DARK_GOLD_COLOR, SPECIAL_RED_COLOR, UIMessageType, LGSET_TAG_SORT, LGSET_TAG_EXPAND, PermissionActionEnum } from "../../DataModels/Constants";
import styled from "@emotion/styled";
import { getDateAppendedName, rfdcCopy, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { Layer, LayerGroup, LayerGroupSet, PackageLayout, Project } from "../../DataModels/ServiceModels";
import { Cancel, ContentCopyOutlined, CopyAllOutlined, DragIndicatorOutlined, DriveFileRenameOutline, EditNoteOutlined, HighlightOffOutlined, LibraryAddOutlined, PlaylistAddCheckCircleOutlined, SortByAlphaOutlined, WorkspacePremiumOutlined, WorkspacesOutlined } from "@mui/icons-material";
import SimpleTextDialog, { SimpleTextDialogProps } from "../../FormDialogs/SimpleTextDialog";
import { useDisclosure } from "@mantine/hooks";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { BasicKVP, LoadingSpinnerInfo, LoggedInUser, SPDomainData } from "../../DataModels/HelperModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { updatelayerGroupSets } from "../../BizLogicUtilities/FetchData";
import { DragDropContext, Draggable, DraggableProvided, DraggableStateSnapshot, Droppable, DroppableProvided, DroppableStateSnapshot, DropResult } from "@hello-pangea/dnd";
import { Accordion } from "@mantine/core";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import { SpButton } from "../../CommonComponents/SimplePieces";




interface LGSetCompProps {
    isGolden: boolean,
    lgSet: LayerGroupSet,
    onDragEnd: (result: DropResult) => void,
    onRemoveLayerGroup: (layerGroup: LayerGroup, layerGroupSet: LayerGroupSet) => void,
    onRenameLayerGroup: (layerGroup: LayerGroup, layerGroupSet: LayerGroupSet) => void ,
    onLayerGroupToggled: (isEnabled: boolean, layerGroup: LayerGroup, layerGroupSet: LayerGroupSet) => void 
    onLayerStatusToggled: (isEnabled: boolean, layer: Layer, layerGroup: LayerGroup, layerGroupSet: LayerGroupSet) => void
}


const LGSetComp: React.FC<LGSetCompProps> = ({ isGolden, lgSet, onDragEnd, onRemoveLayerGroup, onRenameLayerGroup, onLayerGroupToggled, onLayerStatusToggled }) => {
    const theme : any = useTheme();
    const colors : any = tokens(theme.palette.mode);

    return (
        <>
            <DragDropContext onDragEnd={onDragEnd}>
                <Box sx={{ backgroundColor: colors.primary[400] }}>
                    {lgSet.layerGroups.map((lg: LayerGroup, index: number) => (
                        <Droppable key={lg.id} droppableId={lg.id} type={"CARD"} direction="horizontal" isCombineEnabled={false}>
                            {(dropProvided: DroppableProvided, dropSnapshot: DroppableStateSnapshot) => (
                                <Box key={`bx-lg-${index}`} sx={{mt: 1.5, mb: 1.5, borderTop: 1, borderBottom: 1, borderTopStyle: "dotted", borderBottomStyle: "dotted", borderColor: colors.greenAccent[800] }}>
                                    <Box sx={{ display: 'flex', backgroundColor: dropSnapshot.isDraggingOver ? 'rgba(0, 153, 153, 0.3)' : colors.primary[400], mr: 1, ml: 1 }}>
                                        <Typography sx={{color: colors.greenAccent[400], fontSize: 12.5, ml: 1}}>{lg.name}</Typography>
                                    </Box>
                                    <Box sx={{
                                        backgroundColor: dropSnapshot.isDraggingOver ? 'rgba(0, 153, 153, 0.3)' : colors.primary[400],
                                        display: "flex",
                                        flexDirection: "column",
                                        padding: 0,
                                        userSelect: "none",
                                        transition: "background-color 0.1s ease",
                                        mr: 1,
                                        ml: 1,
                                        }}
                                        {...dropProvided.droppableProps} 
                                    >

                                        <Box sx={{display: 'flex', mr: 1, flexDirection: "column"}}>
                                            
                                            <Box sx={{ flexGrow: 1, display: "inline-flex" }}>
                                                <Box sx={{ display: "flex", alignItems: "center", minWidth: "600px", width: "82vw", }} ref={dropProvided.innerRef}>
                                                    
                                                    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>  
                                                        <Tooltip key={`lg-rem-tt-${lg.name}`} placement="top" title={lg.isActive ? `Delete layer group '${lg.name}'` : ''}>
                                                            <span>
                                                                <IconButton onClick={() => onRemoveLayerGroup(lg, lgSet)}>
                                                                    <Cancel sx={{color: SPECIAL_RED_COLOR}}/>
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Divider orientation="vertical" sx={{ml: .5, mr: .5, height:20}} />
                                                        <Tooltip key={`lg-disable-tt-${lg.name}`} placement="top" title={`${lg.isActive ? "Disable" : "Enable"} layer group '${lg.name}'`}>
                                                            <span>
                                                                <Checkbox checked={lg.isActive} onChange={(e, checked) => onLayerGroupToggled(checked, lg, lgSet)} />
                                                            </span>
                                                        </Tooltip>
                                                        <Divider orientation="vertical" sx={{ml: .5, mr: .5, height:20}} />
                                                        <Tooltip key={`lg-rename-tt-${lg.name}`} placement="top" title={lg.isActive ? `Rename layer group '${lg.name}'` : ''}>
                                                            <span>
                                                                <IconButton onClick={() => onRenameLayerGroup(lg, lgSet)}>
                                                                    <DriveFileRenameOutline sx={{color: colors.grey[200]}} />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </Box>

                                                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 3}} flexDirection={"row"}>
                                                        <Divider orientation="vertical" sx={{ml: 1, mr: 1, height:20}} />
                                                    </Box>
                                                    
                                                    {lg.layers.map((lyr: Layer, index: number) => (
                                                        <Draggable key={lyr.id} draggableId={lyr.id} index={index}>
                                                            {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                                                                
                                                            <Box 
                                                                key={`bx-lyr-${index}`}
                                                                ref={(ref: any) => dragProvided.innerRef(ref)} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                                                sx={{
                                                                    backgroundColor: "rgb(208,208,208, 0.22)", borderRadius: 2,
                                                                    mr: .5, ml: .5, mb: .5, mt: .5, maxHeight: 33, maxWidth: "fit-content", minWidth: "fit-content", width: "fit-content",
                                                                    display: "flex", flexDirection: "row"
                                                                }}>
                                                                <Box sx={{ width: "fit-content", display: "flex", flexDirection: "row", alignItems: "center" }} >
                                                                    <DragIndicatorOutlined sx={{ fontSize: 12, color: colors.greenAccent[400] }} />
                                                                    <Typography>{lyr.name}</Typography>
                                                                </Box>

                                                                <Switch
                                                                    size={"small"}
                                                                    style={{ color: colors.grey[100] }}
                                                                    checked={lyr.isActive}
                                                                    onChange={(e, checked) => onLayerStatusToggled(checked, lyr, lg, lgSet)}
                                                                />
                                                            </Box>

                                                            )}
                                                        </Draggable>
                                                    ))}

                                                    {dropProvided.placeholder}
                                                </Box>
                                            </Box>
                                        </Box>

                                    </Box>
                                </Box>
                            )}
                        </Droppable>
                    ))}
                </Box>
            </DragDropContext>
        </>
    );
}



//========================================================================================================================================================
//========================================================================================================================================================



interface LayerGroupsProps {
}

const LayerGroups: React.FC<LayerGroupsProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as SPDomainData;
    const pkglayout = domainData.packageLayout;
    const project = domainData.project as Project;

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);

    const [simpleTextModalState, simpleTextModalActioner] = useDisclosure(false);
    const [simpleTextDialogProps, setSimpleTextDialogProps] = useState<SimpleTextDialogProps>()
    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [lgSetCollection, setLGSetCollection] = useState<LayerGroupSet[]>(pkglayout?.layerGroupSets ?? []);

    
    useEffect(() => {
        placePageTitle("LayerGroups")
    }, []);


    const goldenSet : LayerGroupSet | undefined = useMemo(() => {
        let gldLGSet = lgSetCollection?.find((a: LayerGroupSet) => (a.isGolden === true))
        return gldLGSet ?? undefined;
    }, [lgSetCollection]);

    
    const otherSets : LayerGroupSet[] = useMemo(() => {
        let othLGSetColl = lgSetCollection?.filter((a: LayerGroupSet) => (a.isGolden === false)) ?? []
        return othLGSetColl ?? []
    }, [lgSetCollection]);



    function onLayerGroupToggled(isEnabled: boolean, layerGroup: LayerGroup, layerGroupSet: LayerGroupSet): void {
        if (layerGroupSet && lgSetCollection && lgSetCollection.length > 0) {
            let newColl = [...lgSetCollection]
            for(let lgSet of newColl) {
                if(lgSet.id === layerGroupSet.id) {
                    for(let lg of lgSet.layerGroups) {
                        if(lg.id === layerGroup.id) {
                            lg.isActive = isEnabled;
                            break;
                        }
                    }
                    break;
                }
            }
            setLGSetCollection([...newColl])
        }
    }


    function onLayerStatusToggled(isEnabled: boolean, layer: Layer, layerGroup: LayerGroup, layerGroupSet: LayerGroupSet): void {
        if (layerGroupSet && lgSetCollection && lgSetCollection.length > 0) {
            let newColl = [...lgSetCollection]
            for(let lgSet of newColl) {
                if(lgSet.id === layerGroupSet.id) {
                    for(let lg of lgSet.layerGroups) {
                        if(lg.id === layerGroup.id) {
                            for(let lyr of lg.layers) {
                                if(lyr.id === layer.id) {
                                    lyr.isActive = isEnabled;
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
            }
            setLGSetCollection([...newColl])
        }
    }


    function onRemoveLayerGroup(layerGroup: LayerGroup, layerGroupSet: LayerGroupSet): void {
        if(layerGroup.layers.length > 0) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `LayerGroup has [${layerGroup.layers.length}] layers associated to it. Non-empty Layer groups cannot be deleted.`)
            return; //important!
        }

        let lgDelConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Please confirm deletion of layer-group named '${layerGroup.name}'`,
            warningText_other: `WARNING: '${layerGroup.name}' will be deleted permanently!`,
            actionButtonText: "Proceed",
            contextualInfo: { key: "Delete_LayerGroup", value: { lg: layerGroup, lgSet: layerGroupSet } },
        }
        setConfirmationDialogProps(lgDelConfirmData)
        confirmationModalActioner.open()
    }


    function handleDeleteLGSetAction(layerGroupSet: LayerGroupSet): void {
        let lgSetDeleteConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `Please confirm deletion of layer-group-set:  [ ${layerGroupSet.name} ]`,
            warningText_other: `WARNING: any netclass or clearance relation brand name that is currently using [${layerGroupSet.name}] `
                + `will be switched to the 'Golden' LGSet. Please note: deletion is permanent!`,
            actionButtonText: "Proceed",
            contextualInfo: { key: "Delete_LGSet", value: layerGroupSet },
        }
        setConfirmationDialogProps(lgSetDeleteConfirmData)
        confirmationModalActioner.open()
    }


    function onConfirmationDataAvailable(proceed: ConfirmationDialogActionType, contextualInfo: BasicKVP): void {
        if (contextualInfo && contextualInfo.key) {
            if (contextualInfo.key === "Delete_LGSet" && proceed === ConfirmationDialogActionType.PROCEED) {
                let lgSet = contextualInfo.value as LayerGroupSet
                if (lgSet && lgSetCollection && lgSetCollection.length > 0) {
                    let newColl = [...lgSetCollection]
                    newColl = [...newColl.filter(a => a.id !== lgSet.id) ]
                    setLGSetCollection([...newColl])
                }
            }
            else if (contextualInfo.key === "Delete_LayerGroup" && proceed === ConfirmationDialogActionType.PROCEED) {
                let lg = contextualInfo.value.lg as LayerGroup
                let lgSet = contextualInfo.value.lgSet as LayerGroupSet;
                if (lg && lgSet && lgSetCollection && lgSetCollection.length > 0) {
                    let newLgSetColl = [...lgSetCollection]
                    for (let x = 0; x < newLgSetColl.length; x++) {
                        if (newLgSetColl[x].id === lgSet.id && newLgSetColl[x].layerGroups && newLgSetColl[x].layerGroups.length > 0) {
                            if (newLgSetColl[x].layerGroups.some((a: LayerGroup) => a.id === lg.id)) {
                                newLgSetColl[x].layerGroups = newLgSetColl[x].layerGroups.filter(a => a.id !== lg.id)
                                break;
                            }
                        }
                    }
                    setLGSetCollection([...newLgSetColl])
                }
            }
        }
    }


    
    function onRenameLayerGroup(layerGroup: LayerGroup, layerGroupSet: LayerGroupSet): void {
        let defaultName = ''; 
        let count = 0
        do { defaultName = `LG_${layerGroupSet.layerGroups.length + (++count)}` }
        while(layerGroupSet.layerGroups.some(a => a.name.toLowerCase() === defaultName.toLowerCase()))

        let simpleTextDialogProps: SimpleTextDialogProps = {
            onFormClosed: onSimpleTextDataAvailable,
            title: "Please enter a new name for layer group",
            defaultValue: defaultName,
            unacceptbleValues: [project?.name as string, ...(layerGroupSet.layerGroups?.map(a => a.name) ?? []), ...(lgSetCollection?.map(a => a.name) ?? [])],
            contextualInfo: { key: "Rename_LayerGroup", value: { lg: layerGroup, lgSet: layerGroupSet } },
        }
        setSimpleTextDialogProps(simpleTextDialogProps)
        simpleTextModalActioner.open()
    }


    function handleNewLGSetAction(): void {
        let defaultName = getDateAppendedName(`LGSet`)
        let simpleTextDialogProps: SimpleTextDialogProps = {
            onFormClosed: onSimpleTextDataAvailable,
            title: "Please enter a name for new layer group set",
            defaultValue: defaultName,
            unacceptbleValues: [project?.name as string, ...(lgSetCollection?.map(a => a.name) ?? [])],
            contextualInfo: { key: "New_LGSet", value: null },
        }
        setSimpleTextDialogProps(simpleTextDialogProps)
        simpleTextModalActioner.open()
    }


    function handleRenameLGSetAction(layerGroupSet: LayerGroupSet): void {
        let simpleTextDialogProps: SimpleTextDialogProps = {
            onFormClosed: onSimpleTextDataAvailable,
            title: "Please enter a new name for layer group set",
            defaultValue: layerGroupSet.name,
            unacceptbleValues: [project?.name as string, ...(lgSetCollection?.map(a => a.name) ?? [])],
            contextualInfo: { key: "Rename_LGSet", value: layerGroupSet },
        }
        setSimpleTextDialogProps(simpleTextDialogProps)
        simpleTextModalActioner.open()
    }


    function handleNewLayerGroupAction(lgSet: LayerGroupSet | undefined): void {
        if (lgSet) {
            let defaultName = `LayerGroup_${lgSet.layerGroups.length + 1}`
            let simpleTextDialogProps: SimpleTextDialogProps = {
                onFormClosed: onSimpleTextDataAvailable,
                title: "Specify name for new layer group",
                defaultValue: defaultName,
                unacceptbleValues: [project?.name as string,
                ...(lgSetCollection?.map(a => a.name) ?? []),
                ...(lgSet.layerGroups?.map(a => a.name) ?? [])
                ],
                contextualInfo: { key: "New_Layer_Group", value: lgSet },
            }
            setSimpleTextDialogProps(simpleTextDialogProps)
            simpleTextModalActioner.open()
        }
    }


    function onSimpleTextDataAvailable(data: string | null, contextualInfo: any): void {
        if (contextualInfo && contextualInfo.key && data && data.length > 0) {
            if (contextualInfo.key === "New_LGSet") {  
                if (goldenSet && lgSetCollection) {
                    try { verifyNaming([data], NamingContentTypeEnum.LGSET) }
                    catch (e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    let newLayerGroups = rfdcCopy<LayerGroup[]>(goldenSet?.layerGroups) as LayerGroup[]
                    let newColl = [...lgSetCollection]
                    let newLgs: LayerGroupSet = {
                        id: crypto.randomUUID(),
                        name: data.trim(),
                        layerGroups: newLayerGroups, 
                        isGolden: false,
                        isPhysicalDefault: false,
                        isClearanceDefault: false,
                        tags: ["ADDED_LGSET", LGSET_TAG_SORT], //IMPORTANT!
                    }
                    newColl = newColl.concat([newLgs]);
                    setLGSetCollection([...newColl])
                }
            }
            else if (contextualInfo.key === "Rename_LGSet") {
                try { verifyNaming([data], NamingContentTypeEnum.LGSET) }
                catch (e: any) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                    return;
                }
                let layerGroupSet = contextualInfo.value
                if (layerGroupSet && lgSetCollection && lgSetCollection.length > 0) {
                    let newColl = [...lgSetCollection]
                    for(let lgSet of newColl) {
                        if(lgSet.id === layerGroupSet.id) {
                            lgSet.name = data.trim();
                            break;
                        }
                    }
                    setLGSetCollection([...newColl])
                }
            }
            else if (contextualInfo.key === "New_Layer_Group") {
                try { verifyNaming([data], NamingContentTypeEnum.LAYER_GROUP) }
                catch (e: any) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                    return;
                }
                let layerGroupSet: LayerGroupSet = contextualInfo.value
                if (layerGroupSet && lgSetCollection && lgSetCollection.length > 0) {
                    let newColl = [...lgSetCollection]
                    for(let lgSet of newColl) {
                        if(lgSet.id === layerGroupSet.id) {
                            let newLg: LayerGroup = {
                                id:  crypto.randomUUID(),
                                name: data.trim(),
                                isActive: false,
                                layers: [],
                                tags: [] 
                            }
                            lgSet.layerGroups = lgSet.layerGroups.concat([newLg]);
                            break;
                        }

                    }
                    setLGSetCollection([...newColl])
                }
            }
            else if (contextualInfo.key === "Rename_LayerGroup") {
                try { verifyNaming([data], NamingContentTypeEnum.LAYER_GROUP) }
                catch (e: any) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                    return;
                }
                let layerGroup = contextualInfo.value?.lg;
                let layerGroupSet = contextualInfo.value?.lgSet
                if (layerGroup && layerGroupSet && lgSetCollection) {
                    let newColl = [...lgSetCollection]
                    for(let lgSet of newColl) {
                        if(lgSet.id === layerGroupSet.id) {
                            for(let lg of lgSet.layerGroups) {
                                if(lg.id === layerGroup.id) {
                                    lg.name = data.trim();
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    setLGSetCollection([...newColl])
                }
            }
        }
    }


    function onLGSetCheckBoxChanged(type: ConstraintTypesEnum|string, layerGroupSet: LayerGroupSet, checked: boolean): void {
        if(layerGroupSet && lgSetCollection && lgSetCollection.length > 0) {
            let newColl = [...lgSetCollection]
            let modOccured: boolean = false;
            let somethingEnabled = false;
            for(let lgSet of newColl) {
                if(lgSet.id === layerGroupSet.id) {
                    if(type === ConstraintTypesEnum.Physical) {
                        lgSet.isPhysicalDefault = checked;
                    }
                    else if(type === ConstraintTypesEnum.Clearance) {
                        lgSet.isClearanceDefault = checked;
                    }
                    else if(type === LGSET_TAG_SORT){
                        if(checked) {
                            lgSet.tags = Array.from(new Set(lgSet.tags.concat(LGSET_TAG_SORT)))
                            displayQuickMessage(UIMessageType.INFO_MSG, "Remember to click save button AND refresh the UI to complete the sorting of layer groups");
                        }
                        else {
                            lgSet.tags = lgSet.tags.filter(a => a !== LGSET_TAG_SORT)
                        }
                    }
                    else if(type === LGSET_TAG_EXPAND){
                        if(checked) {
                            lgSet.tags = Array.from(new Set(lgSet.tags.concat(LGSET_TAG_EXPAND)))
                        }
                        else {
                            lgSet.tags = lgSet.tags.filter(a => a !== LGSET_TAG_EXPAND)
                        }
                    }

                    if(checked === true) { somethingEnabled = true  }
                    modOccured = true
                    break;
                }
            }
            
            if(somethingEnabled === true) {
                for(let lgSet of newColl) {
                    if(lgSet.id !== layerGroupSet.id) {
                        if(type === ConstraintTypesEnum.Physical) {
                            lgSet.isPhysicalDefault = false;
                        }
                        else if(type === ConstraintTypesEnum.Clearance) {
                            lgSet.isClearanceDefault = false;
                        } 
                        modOccured = true
                    }
                }
            }

            if(modOccured) { 
                setLGSetCollection([...newColl])
            }
        }
    }


    async function handleSaveAll(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_LAYER_GROUPS) === false) { return; }
        if(lgSetCollection && lgSetCollection.length > 0) {
            let pkgToUpdate = {...pkglayout}
            pkgToUpdate.layerGroupSets = lgSetCollection;

            setLoadingSpinnerCtx({enabled: true, text: "Now processing layer group updates. Please wait..."} as LoadingSpinnerInfo)
            let pkg : PackageLayout = await updatelayerGroupSets(pkgToUpdate as PackageLayout).finally(() => { cancelLoadingSpinnerCtx() })
            if(pkg) {
                pkg.layerGroupSets = pkg.layerGroupSets.sort((a, b) => a.name < b.name ? -1 : 1);
                setLGSetCollection(pkg.layerGroupSets as LayerGroupSet[])
                displayQuickMessage(UIMessageType.SUCCESS_MSG, "LayerGroup update process completed")
            }
        }
    }


    function getDefaultExpandedKeys(lgsetList: LayerGroupSet[]): string[] | undefined {
        let defExpList = new Array<string>();
        for(let i = 0; i < lgsetList.length; i++) {
            if(lgsetList[i].tags.includes(LGSET_TAG_EXPAND)) {
                defExpList.push(lgsetList[i].id)
            }
        }
        return defExpList;
    }


    //=============================================================================

    function onDragEnd(layerGroupSet: LayerGroupSet, dropperContext: DropResult): void {
        
        if (!dropperContext.destination) {  // dropped outside the list
            return;
        }

        let sourceLgId = dropperContext.source.droppableId;
        let destinationLgId = dropperContext.destination.droppableId;
        let layerId = dropperContext.draggableId;

        if(sourceLgId && destinationLgId && layerId) {
            if(sourceLgId !== destinationLgId) {
                if (layerGroupSet && lgSetCollection && lgSetCollection.length > 0) {
                    let newColl = [...lgSetCollection]
                    let focusLayer : Layer| null = null;
                    let modOccured: boolean = false;
        
                    for(let lgSet of newColl) {
                        if(lgSet.id === layerGroupSet.id) {
                            for(let lg of lgSet.layerGroups) {
                                let layer = lg.layers.find(x => x.id === layerId)
                                if(layer && layer.id && layer.id.length > 0) {
                                    focusLayer = layer;
                                    break;
                                }
                            }
                            break;
                        }
                    }
        
                    if(focusLayer && focusLayer.id) {
                        for(let lgSet of newColl) {
                            if(lgSet.id === layerGroupSet.id) {
                                for(let lg of lgSet.layerGroups) {
                                    if(lg.id === sourceLgId) {
                                        lg.layers = lg.layers.filter(a => a.id !== layerId)
                                        //DISABLE a layer group if/when all its layers have been removed
                                        if(lg.layers.length === 0) {
                                            lg.isActive = false;
                                        }
                                        modOccured = true;
                                    }
                                    else if(lg.id === destinationLgId) {
                                        lg.layers = lg.layers.concat([focusLayer])
                                        modOccured = true;
                                    }
                                }
                                break;
                            }
                        }
                    }
        
                    if(modOccured) { 
                        setLGSetCollection([...newColl])
                    }
                }
            }
        }
    };

    
    


    return (
        <Box>
            <Box sx={{flexDirection: "column", alignItems: "center"}} >
                <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"100%", m: 0.5}}> 
                    {goldenSet && <SpButton
                        onClick={handleNewLGSetAction}
                        key={`init-1`}
                        startIcon={<CopyAllOutlined />}
                        sx={{ width:250 }}
                        label="Create New Set" />}
                    
                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />
                    
                    <SpButton
                        onClick={handleSaveAll}
                        key={`save-1`}
                        startIcon={<PlaylistAddCheckCircleOutlined />}
                        sx={{ width:250 }}
                        label="Save All Changes" 
                        disabled={(goldenSet) ? false : true}/>

                </Box>

                <Box sx={{height: "82vh", overflowY: "scroll"}} >
                    
                    <Box key={`lgset-gldn`} sx={{display: "flex", flexDirection: "column", mt:0, mr: 2, padding: .2, backgroundColor: SPECIAL_DARK_GOLD_COLOR  }} >
                        <Accordion 
                            key={`acc-gldnset`}
                            multiple={true} 
                            variant="contained" 
                            radius="sm"
                            defaultValue={["lg-golden"]} //makes it open up by default
                            classNames={{ root: "rules-acc-root", label: "rules-acc-label", item: "rules-acc-item", control: "rules-acc-control", panel: "rules-acc-panel" }}
                        >
                            <Accordion.Item key={`acc-lg-golden`} value={`lg-golden`}>
                                <Accordion.Control>{`Golden`}</Accordion.Control>
                                <Accordion.Panel>
                                    {goldenSet
                                    ? <Box key={`bx-lgset-gldn`} sx={{display: "flex", flexDirection: "column", mt:.5, padding: 0}} >
                                        <Box flexDirection="row" display="flex" alignItems="center" sx={{ width:"100%", }}>                
                                            <SpButton
                                                onClick={() => handleNewLayerGroupAction(goldenSet)}
                                                key={`add-lg-on-golden`}
                                                startIcon={<LibraryAddOutlined />}
                                                sx={{ width:140, ml:0, mb:1, }}
                                                label="Add LayerGroup" 
                                                intent={"gold_standard"}
                                            />
                                        </Box>
                                        
                                        <LGSetComp isGolden={true} lgSet={goldenSet} onDragEnd={(result) => onDragEnd(goldenSet, result)} onRemoveLayerGroup={onRemoveLayerGroup} 
                                            onRenameLayerGroup={onRenameLayerGroup} onLayerGroupToggled={onLayerGroupToggled} onLayerStatusToggled={onLayerStatusToggled} />
                                        
                                    </Box>
                                    : <i>Project has no layer groups to display...</i>}
                                </Accordion.Panel>
                            </Accordion.Item>   
                        </Accordion>
                    </Box>

                    <Divider sx={{width: "100%", mt:2, mb: 1}} />
                    
                    <Box key={`lgsets-custom`} sx={{padding: 1, mr: 2 }} >
                        <Accordion 
                            key={`acc-lgset`}
                            multiple={true} 
                            variant="contained" 
                            radius="sm"
                            defaultValue={getDefaultExpandedKeys(otherSets ?? [])} //makes it open up by default
                            classNames={{ chevron: "rules-acc-chevron", label: "rules-acc-label", item: "rules-acc-item", control: "rules-acc-control", panel: "rules-acc-panel" }}
                        > 
                            { 
                                (otherSets ?? []).map((customLGSet: LayerGroupSet, index: number) => ( 
                                    <Box key={`bx-lgset-${index}`} sx={{mt: 1}}>
                                        <Accordion.Item key={`acci-lgset-${index}`} value={`${customLGSet.id}`}>
                                            <Accordion.Control> {`${customLGSet.name}`} </Accordion.Control>
                                            <Accordion.Panel>
                                                <Box sx={{display: "flex", flexDirection: "column", mt:0, padding: 0,}} >
                                                    <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"100%", }}>                
                                
                                                        <Tooltip key={`tt1-${index}`} placement="top" title={`Rename layer group set '${customLGSet.name}'`}>
                                                            <IconButton onClick={() => handleRenameLGSetAction(customLGSet)}>
                                                                <EditNoteOutlined key={`lgs-rem-${index}`} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        
                                                        <Divider orientation="vertical" sx={{ml: 2, mr: 2, height:20}} />
                                                        
                                                        <Tooltip key={`tt2-${index}`} placement="top" title={`Delete layer group set '${customLGSet.name}'`}>
                                                            <IconButton onClick={() => handleDeleteLGSetAction(customLGSet)}>
                                                                <HighlightOffOutlined key={`lgs-rem-${index}`}/>
                                                            </IconButton>
                                                        </Tooltip>
                                                        
                                                        <Divider orientation="vertical" sx={{ml: 2, mr: 3, height:20}} />
                                                        
                                                        <Tooltip key={`tt3-${index}`} placement="top" title={`Mark this set as default for newly created PHYSICAL rules`}>
                                                            <FormControlLabel 
                                                                label="Physical Default" 
                                                                control={
                                                                    <Checkbox 
                                                                        checked={customLGSet.isPhysicalDefault} 
                                                                        onChange={(e, checked) => onLGSetCheckBoxChanged(ConstraintTypesEnum.Physical, customLGSet, checked)} 
                                                                    />
                                                                } 
                                                            />
                                                        </Tooltip>
                                                        
                                                        <Divider orientation="vertical" sx={{ml: 2, mr: 3, height:20}} />
                                                        
                                                        <Tooltip key={`tt4-${index}`} placement="top" title={`Mark this set as default for newly created CLEARANCE rules`}>
                                                            <FormControlLabel 
                                                                label="Clearance Default" 
                                                                control={
                                                                    <Checkbox 
                                                                        checked={customLGSet.isClearanceDefault} 
                                                                        onChange={(e, checked) => onLGSetCheckBoxChanged(ConstraintTypesEnum.Clearance, customLGSet, checked)} 
                                                                    />
                                                                } 
                                                            />
                                                        </Tooltip>

                                                        <Divider orientation="vertical" sx={{ml: 2, mr: 3, height:20}} />
                                                        
                                                        <Tooltip key={`tt5-${index}`} placement="top" title={`Keep layer groups sorted for this set`}>
                                                            <FormControlLabel 
                                                                label="Sort Groups" 
                                                                control={
                                                                    <Checkbox 
                                                                        checked={customLGSet.tags.includes(LGSET_TAG_SORT)} 
                                                                        onChange={(e, checked) => onLGSetCheckBoxChanged(LGSET_TAG_SORT, customLGSet, checked)} 
                                                                    />
                                                                } 
                                                            />
                                                        </Tooltip>

                                                        <Divider orientation="vertical" sx={{ml: 2, mr: 3, height:20}} />
                                                        
                                                        <Tooltip key={`tt6-${index}`} placement="top" title={`Keep this set expanded by default`}>
                                                            <FormControlLabel 
                                                                label="Keep Expanded" 
                                                                control={
                                                                    <Checkbox 
                                                                        checked={customLGSet.tags.includes(LGSET_TAG_EXPAND)} 
                                                                        onChange={(e, checked) => onLGSetCheckBoxChanged(LGSET_TAG_EXPAND, customLGSet, checked)} 
                                                                    />
                                                                } 
                                                            />
                                                        </Tooltip>
                                                    </Box>
                                                
                                                    <Box key={`lgs-comp-${customLGSet.name}`} sx={{display: "flex", flexDirection: "column", mt:0, padding: 0}} >
                                                        
                                                        <LGSetComp isGolden={false} lgSet={customLGSet} onDragEnd={(result) => onDragEnd(customLGSet, result)} onRemoveLayerGroup={onRemoveLayerGroup} 
                                                            onRenameLayerGroup={onRenameLayerGroup} onLayerGroupToggled={onLayerGroupToggled} onLayerStatusToggled={onLayerStatusToggled} />
                                                        
                                                    </Box>

                                                </Box>
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    </Box>
                                ))
                            } 
                        </Accordion>
                    </Box>
                </Box>     
            </Box>

            {simpleTextModalState && <SimpleTextDialog opened={simpleTextModalState} close={simpleTextModalActioner.close} {...simpleTextDialogProps as SimpleTextDialogProps}  />}
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }

        </Box>
    );

}

export default LayerGroups
        
    





//======================

// if (gridApiMap.has(lgSet.id)) {
//     //special
//     setGridApiMap(gridApiMap => {
//         let map = new Map<string, GridApi>(gridApiMap)
//         map.delete(lgSet.id)
//         return map
//     })
// }

//==================================
    

    // function onDragLayerStart(event: React.DragEvent<HTMLSpanElement>, layer: Layer, layerGroup: LayerGroup, layerGroupSet: LayerGroupSet): void {
    //     const jsonData = JSON.stringify({ layer: layer, fromLayerGroup: layerGroup } as DragLayerData);
    //     const userAgent = window.navigator.userAgent;
    //     const isIE = userAgent.indexOf('Trident/') >= 0;
    //     event.dataTransfer.setData(isIE ? 'text' : 'application/json', jsonData);
    // }

    // function onLayerDropEnd(layer: Layer, fromLayerGroup: LayerGroup, toLayerGroup: LayerGroup, layerGroupSet: LayerGroupSet): void {
    //     if (packageLayout?.layerGroupSets) {
    //         if (fromLayerGroup && fromLayerGroup.id && toLayerGroup && toLayerGroup.id && layer && layer.id) {
    //             if (fromLayerGroup.id !== toLayerGroup.id) {
    //                 let pkg = pkgRef.current as PackageLayout
    //                 let lgSet = { ...pkg.layerGroupSets.find(a => a.id === layerGroupSet.id) as LayerGroupSet }
    //                 let frmLG = { ...lgSet.layerGroups.find(a => a.id === fromLayerGroup.id) } as LayerGroup  //expected to have it
    //                 let toLG = { ...lgSet.layerGroups.find(a => a.id === toLayerGroup.id) } as LayerGroup  //expected to have it

    //                 frmLG.layers = frmLG.layers.filter(a => a.id !== layer.id)
    //                 toLG.layers = toLG.layers.concat([layer]).sort((a, b) => a.name < b.name ? -1 : 1);

    //                 let others = lgSet.layerGroups.filter(a => a.id !== frmLG.id && a.id !== toLG.id)
    //                 lgSet.layerGroups = others.concat([frmLG, toLG]).sort((a, b) => a.name < b.name ? -1 : 1);

    //                 pkg.layerGroupSets = pkg.layerGroupSets.filter(x => x.id !== lgSet.id).concat([lgSet])
    //                 pkgRef.current = pkg;

    //                 if (gridApiMap && gridApiMap.has(lgSet.id)) {
    //                     (gridApiMap.get(lgSet.id) as GridApi).setGridOption('rowData', lgSet.layerGroups)
    //                 }
    //             }
    //         }
    //     }
    // }



    /* <DragDropContext onDragEnd={onDragEnd}>
        <Box sx={{ backgroundColor: colors.primary[600] }}>
            {goldenLGSet.layerGroups.map((lg: LayerGroup, index: number) => (
                <Droppable droppableId={lg.id} type={"CARD"} direction="horizontal" isCombineEnabled={false}>
                    {(dropProvided: DroppableProvided, dropSnapshot: DroppableStateSnapshot) => (
                        <Box sx={{mt: 1.5, mb: 1.5}}>
                            <Box sx={{ display: 'flex', backgroundColor: dropSnapshot.isDraggingOver ? 'rgba(0, 153, 153, 0.3)' : colors.primary[400], mr: 1, ml: 1 }}>
                                <Typography sx={{color: colors.greenAccent[400], fontSize: 13, ml: 1}}>{lg.name}</Typography>
                            </Box>
                            <Box sx={{
                                backgroundColor: dropSnapshot.isDraggingOver ? 'rgba(0, 153, 153, 0.3)' : colors.primary[400],
                                display: "flex",
                                flexDirection: "column",
                                padding: 0,
                                userSelect: "none",
                                transition: "background-color 0.1s ease",
                                mr: 1,
                                ml: 1
                                }}
                                {...dropProvided.droppableProps} 
                            >

                                <Box sx={{display: 'flex', mr: 1, flexDirection: "column"}}>
                                    
                                    <Box sx={{ flexGrow: 1, display: "inline-flex" }}>
                                        <Box sx={{ display: "flex", alignItems: "center", minWidth: "600px"}} ref={dropProvided.innerRef}>
                                            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>  
                                                <Tooltip key={`lg-rem-tt-${lg.name}`} placement="top" title={lg.isActive ? `Delete layer group '${lg.name}'` : ''}>
                                                    <span>
                                                        <IconButton onClick={() => onRemoveLayerGroup(lg, goldenLGSet)}>
                                                            <Cancel color="error"/>
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Divider orientation="vertical" sx={{ml: .5, mr: .5, height:20}} />
                                                <Tooltip key={`lg-disable-tt-${lg.name}`} placement="top" title={`${lg.isActive ? "Disable" : "Enable"} layer group '${lg.name}'`}>
                                                    <span>
                                                        <Switch size="small" checked={lg.isActive} onChange={(e, checked) => onLayerGroupToggled(checked, lg, goldenLGSet)} />
                                                    </span>
                                                </Tooltip>
                                                <Divider orientation="vertical" sx={{ml: .5, mr: .5, height:20}} />
                                                <Tooltip key={`lg-rename-tt-${lg.name}`} placement="top" title={lg.isActive ? `Rename layer group '${lg.name}'` : ''}>
                                                    <span>
                                                        <IconButton onClick={() => onRenameLayerGroup(lg, goldenLGSet)}>
                                                            <DriveFileRenameOutline color="info" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </Box>

                                            <Box sx={{ display: 'flex', alignItems: 'center', mr: 3}} flexDirection={"row"}>
                                                <Divider orientation="vertical" sx={{ml: 1, mr: 1, height:20}} />
                                                <Divider sx={ {width: 10 }} />
                                            </Box>
                                            
                                            {lg.layers.map((lyr: Layer, index: number) => (
                                                <Draggable key={lyr.id} draggableId={lyr.id} index={index}>
                                                    {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (

                                                    <Box
                                                        ref={(ref: any) => dragProvided.innerRef(ref)} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                                        sx={{
                                                            backgroundColor: "rgb(208,208,208, 0.22)", borderRadius: 2,
                                                            mr: .5, ml: .5, mb: .5, mt: .5, maxHeight: 33, maxWidth: "fit-content", minWidth: "fit-content", width: "fit-content",
                                                            display: "flex", flexDirection: "row"
                                                        }}>
                                                        <Box sx={{ width: "fit-content", display: "flex", flexDirection: "row", alignItems: "center" }} >
                                                            <DragIndicatorOutlined sx={{ fontSize: 12, color: colors.greenAccent[400] }} />
                                                            <Typography>{lyr.name}</Typography>
                                                        </Box>

                                                        <Switch
                                                            size={"small"}
                                                            style={{ color: 'white' }}
                                                            checked={true}
                                                            onChange={(e, checked) => onLayerStatusToggled(checked, lyr, lg, goldenLGSet)}
                                                        />
                                                    </Box>

                                                    )}
                                                </Draggable>
                                            ))}

                                            {dropProvided.placeholder}
                                        </Box>
                                    </Box>
                                </Box>

                            </Box>
                        </Box>
                    )}
                </Droppable>
            ))}
        </Box>
    </DragDropContext> */
                                                



    /* <Divider sx={{width: 10, mt: 2, mb: 2}} /> */



    // borderBottom: .5, borderTop: 0, borderRight: 0, borderLeft: .5, borderStyle: "dotted", borderColor: colors.grey[400], 

    

    // <Block ref={(ref) => dragProvided.innerRef(ref)} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
    //     {lyr.name}
    // </Block>




    // const Block = styled.div`
    // width: 60px;
    // height: 60px;
    // border-radius: 50%;
    // flex-shrink: 0;
    // margin-right: 4px;
    // border-color: "blue";
    // border-style: solid;
    // border-width: 1px;
    // box-shadow: '2px 2px 1px "magenta"';

    // &:focus {
    // /* disable standard focus color */
    // outline: none;

    // /* use our own awesome one */
    // border-color: "red";
    // }
    // `;




    // return (
    //     <Box>
    //         <Accordion classes={{ root: classes.accordionRoot }} sx={{borderRadius: 2, height: 22, backgroundColor: "grey"}} defaultExpanded>
    //             <AccordionSummary sx={{borderRadius: 2, height: 22, backgroundColor: "grey"}} expandIcon={<ExpandMoreIcon />} >
    //                 <Typography>Expanded by default</Typography>
    //             </AccordionSummary>
    //             <AccordionDetails>
    //             <DragDropContext onDragEnd={onDragEnd}>
    //                 <Box sx={{backgroundColor: "red", padding: 1}}>
    //                     {packageLayout?.layerGroupSets[0].layerGroups.map((lg: LayerGroup, index: number) => (
    //                         <Droppable droppableId={lg.id} type={"CARD"} direction="horizontal" isCombineEnabled={false}>
    //                             {(dropProvided: DroppableProvided, dropSnapshot: DroppableStateSnapshot) => (
                                    
    //                                 <Box sx={{
    //                                     backgroundColor: dropSnapshot.isDraggingOver ? "yellow" : "green",
    //                                     display: "flex",
    //                                     flexDirection: "column",
    //                                     padding: 1,
    //                                     userSelect: "none",
    //                                     transition: "background-color 0.1s ease",
    //                                     margin: 2
    //                                     }}
    //                                     {...dropProvided.droppableProps} 
    //                                 >

    //                                     <Box>
    //                                         <Box sx={{ flexGrow: 1, display: "inline-flex" }}>
    //                                             <Box sx={{ display: "flex", alignItems: "start", minWidth: "600px", minHeight: "60px", mb: 1 }} ref={dropProvided.innerRef}>
    //                                                 {lg.layers.map((lyr: Layer, index: number) => (
    //                                                     <Draggable key={lyr.id} draggableId={lyr.id} index={index}>
    //                                                         {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (

    //                                                             <Block ref={(ref) => dragProvided.innerRef(ref)} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
    //                                                                 {lyr.name}
    //                                                             </Block>

    //                                                         )}
    //                                                     </Draggable>
    //                                                 ))}
    //                                                 {dropProvided.placeholder}
    //                                             </Box>
    //                                         </Box>
    //                                     </Box>

    //                                 </Box>
    //                             )}
    //                         </Droppable>
    //                     ))}
    //                 </Box>
    //             </DragDropContext>
    //             </AccordionDetails>
    //         </Accordion>



    //         {/* <DragDropContext onDragEnd={onDragEnd}>
    //             <Box sx={{backgroundColor: "red", padding: 1}}>
    //                 {packageLayout?.layerGroupSets[0].layerGroups.map((lg: LayerGroup, index: number) => (
    //                     <Droppable droppableId={lg.id} type={"CARD"} direction="horizontal" isCombineEnabled={false}>
    //                         {(dropProvided: DroppableProvided, dropSnapshot: DroppableStateSnapshot) => (
                                
    //                             <Box sx={{
    //                                 backgroundColor: dropSnapshot.isDraggingOver ? "yellow" : "green",
    //                                 display: "flex",
    //                                 flexDirection: "column",
    //                                 padding: 1,
    //                                 userSelect: "none",
    //                                 transition: "background-color 0.1s ease",
    //                                 margin: 2
    //                                 }}
    //                                 {...dropProvided.droppableProps} 
    //                             >

    //                                 <Box>
    //                                     <Box sx={{ flexGrow: 1, display: "inline-flex" }}>
    //                                         <Box sx={{ display: "flex", alignItems: "start", minWidth: "600px", minHeight: "60px", mb: 1 }} ref={dropProvided.innerRef}>
    //                                             {lg.layers.map((lyr: Layer, index: number) => (
    //                                                 <Draggable key={lyr.id} draggableId={lyr.id} index={index}>
    //                                                     {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (

    //                                                         <Block ref={(ref) => dragProvided.innerRef(ref)} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
    //                                                             {lyr.name}
    //                                                         </Block>

    //                                                     )}
    //                                                 </Draggable>
    //                                             ))}
    //                                             {dropProvided.placeholder}
    //                                         </Box>
    //                                     </Box>
    //                                 </Box>

    //                             </Box>
    //                         )}
    //                     </Droppable>
    //                 ))}
    //             </Box>
    //         </DragDropContext> */}

    //     </Box>
    // );









// if(gridApiMap && gridApiMap.has(lgSet.id)) {
//     (gridApiMap.get(lgSet.id) as GridApi).redrawRows()
// }