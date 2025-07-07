import * as React from 'react';
import { Autocomplete, Box, Checkbox, Chip, Divider, Slide, Typography } from '@mui/material';
import { Cancel, Check, DeleteSweepOutlined, MenuOutlined, SettingsOutlined, VisibilityOutlined } from '@mui/icons-material';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NamingContentTypeEnum, PermissionActionEnum, SPECIAL_BLUE_COLOR, SPECIAL_EVEN_DEEPER_QUARTZ_COLOR, SPECIAL_GOLD_COLOR, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BasicKVP, BasicProperty, DisplayOption, LoadingSpinnerInfo, LoggedInUser, MenuInfo } from '../DataModels/HelperModels';
import { useSpiderStore } from '../DataModels/ZuStore';
import { G2GRelationContext, Interface, Project, TargetSetType } from '../DataModels/ServiceModels';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { groupBy, rfdcCopy, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { sort } from 'fast-sort';
import MenuListComposition from '../CommonComponents/MenuListComposition';
import BaseGlideGrid, { GridCellEditCtx, SpecialGridActionContext } from '../CommonComponents/BaseGlideGrid';
import { BASIC_GRID_HEADER_HEIGHT, DUMMY_ELEMENT_ID_PREFIX, G2G_COL_TYPE, getG2GGridCellContent, getG2GGridColumns, onG2GEvaluateFillPattern, onG2GGridCellEdited, onG2GGridGetToolTipText, onG2GGridInitialDataFetch } from '../BizLogicUtilities/BaseGridLogic';
import { isUserApprovedForCoreAction } from '../BizLogicUtilities/Permissions';
import { GridCellKind, GridColumn } from '@glideapps/glide-data-grid';
import G2GTargetMgmtDialog, { G2GTargetMgmtDialogProps } from './G2GTargetMgmtDialog';
import G2GSourceGroupVisibilityDialog, { G2GSourceGroupVisibilityDialogProps } from './G2GSourceGroupVisibilityDialog';
import { MultiSelectCellType } from '@glideapps/glide-data-grid-cells';
import { SpButton } from '../CommonComponents/SimplePieces';




export interface G2GLayoutDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (contextualInfo: BasicKVP) => void,
    title: string,
    warningMsg: string,
    project: Project,
    projectInterfaceList: Interface[],
    inputG2GCtxList: G2GRelationContext[],
    maxSearchTextLength?: number,
    contextualInfo: BasicKVP,

}

const G2GLayoutDialog: React.FC<G2GLayoutDialogProps> = ({ title, warningMsg, opened, close, onFormClosed, project, projectInterfaceList, inputG2GCtxList, contextualInfo, maxSearchTextLength = 65}) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);

    const [g2gTargetMgmtModalState, g2gTargetMgmtModalActioner] = useDisclosure(false);
    const [g2gTargetMgmtDialogProps, setG2GTargetMgmtDialogProps] = useState<G2GTargetMgmtDialogProps>();

    const [g2gSourceGroupVisibilityModalState, g2gSourceGroupVisibilityModalActioner] = useDisclosure(false);
    const [g2gSourceGroupVisibilityDialogProps, setG2GSourceGroupVisibilityDialogProps] = useState<G2GSourceGroupVisibilityDialogProps>();

    const [originalG2GArray, setOriginalG2GArray] = useState<G2GRelationContext[]>([])
    const [g2gSelectedRowInfo, setG2GSelectedRowInfo] = useState<Map<BasicKVP, number>>(new Map<BasicKVP, number>());
    const [g2gIdToNameMap, setG2GIdToNameMap] = useState<Map<string, string>>(new Map());
    const [uppercaseG2GNameToIdMap, setUppercaseG2GNameToIdMap] = useState<Map<string, string>>(new Map());
    const [ifaceToG2GIdMap, setIfaceToG2GIdMap] = useState<Map<string, string[]>>(new Map());
   
    const [g2gRowCountTracker, setG2GRowCountTracker] = useState<number>(0);

    const g2gGridRef = useRef<any>();
    const g2gGridActionRef = useRef<SpecialGridActionContext<G2GRelationContext>|undefined>();
    const containerRef = useRef<HTMLElement>(null);  //important!

    const currentG2GInfoMapRef = useRef<Map<string, G2GRelationContext>>(new Map());
    const currentPairingsRef = useRef<Set<string>>(new Set());
    
    


    const g2gGridColumns = useMemo(() => {         
        let cols = getG2GGridColumns()
        return cols
    }, []);


    const ifaceMapping = useMemo(() => {         
        let map = new Map<string, Interface>();
        if(projectInterfaceList && projectInterfaceList.length > 0) {
            for(let iface of projectInterfaceList) {
                map.set(iface._id, iface)
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

    
    const crbNameToIdMap = useMemo(() => {         
        let map = new Map<string, string>();
        if(project.clearanceRelationBrands && project.clearanceRelationBrands.length > 0) {
            for(let clrRel of project.clearanceRelationBrands) {
                map.set(clrRel.name.trim().toUpperCase(), clrRel.id)
            }
        }
        return map;
    }, []);


    useMemo(() => {        
        let g2gList = rfdcCopy<G2GRelationContext[]>(inputG2GCtxList) as G2GRelationContext[];
        let sortedG2GList = sort(g2gList ?? []).asc([
            a => ifaceMapping.get(a._id)?.name?.toUpperCase(),
            a => Number(a.channel),
            a => g2gIdToNameMap.get(a._id)?.toUpperCase()
        ]);
        setG2GRowCountTracker(sortedG2GList.length);
        setOriginalG2GArray(sortedG2GList);
    }, []);


    useMemo(async () => {        
        if(projectInterfaceList.length > 0 && originalG2GArray.length > 0) {
            let g2gCtxMap = new Map<string, G2GRelationContext>();
            let idToNameMap = new Map<string, string>();
            let nameToIdMap = new Map<string, string>();
            let ifaceToG2GGrouped = new Map<string, string[]>();
            
            for(let i = 0; i < originalG2GArray.length; i++) {
                let g2g = originalG2GArray[i]
                let g2gId = g2g._id?.toString() as string;

                let ifaceName = ifaceMapping.get(g2g.interfaceId)?.name;
                let chName = g2g.channel.toString() || "";
                let segName = (g2g.segment && g2g.segment.length > 0) ? `_${g2g.segment}` : "";
                let finalG2GName = `${ifaceName}${chName}${segName}`.toUpperCase();

                g2gCtxMap.set(g2gId, g2g);
                idToNameMap.set(g2gId, finalG2GName);
                nameToIdMap.set(finalG2GName, g2gId);
            }

            for(let iface of projectInterfaceList){
                let ifaceId = iface._id.toString() as string;
                let ifaceG2GIds = originalG2GArray.filter(a => (a.interfaceId === ifaceId))?.map(k => k._id.toString());
                ifaceToG2GGrouped.set(ifaceId, ifaceG2GIds ?? []);
            }

            setG2GIdToNameMap(idToNameMap);
            setUppercaseG2GNameToIdMap(nameToIdMap);
            setIfaceToG2GIdMap(ifaceToG2GGrouped);
            currentG2GInfoMapRef.current = g2gCtxMap;

            if(g2gGridActionRef && g2gGridActionRef.current) {
                g2gGridActionRef.current?.reloadDataRows();
            }
        }

    }, [originalG2GArray]);

    

    function handleClearAllData() {
        let g2gList = rfdcCopy<G2GRelationContext[]>(originalG2GArray) as G2GRelationContext[];
        for(let g2g of g2gList) {
            g2g.toAll.enabled = false;
            g2g.toAll.clearanceRelationBrandId = "",

            g2g.intraclass.enabled = false;
            g2g.intraclass.clearanceRelationBrandId = "";

            g2g.within.enabled = false;
            g2g.within.clearanceRelationBrandId = "";

            g2g.across = [];
        }
        setOriginalG2GArray(g2gList);
    }


    function getRelatedSegmentItemForNonSegElement(g2g: G2GRelationContext) {
        let found = new Array<string>();
        if(!g2g.segment || g2g.segment.trim().length === 0) {
            let ifaceRelatedG2GIds = (ifaceToG2GIdMap.get(g2g.interfaceId) as string[]);
            if(ifaceRelatedG2GIds && ifaceRelatedG2GIds.length > 0) {
                // found = ifaceRelatedG2GIds.filter(x => ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length > 0)) ?? [];

                found = ifaceRelatedG2GIds.filter(x => {
                    let ch = currentG2GInfoMapRef.current.get(x)?.channel || '';
                    let seg = currentG2GInfoMapRef.current.get(x)?.segment || '';

                    if(ch && (ch.trim().length > 0) && (ch === g2g.channel) && (seg.trim().length > 0)) {
                        return true;
                    }
                    else if(!ch && !g2g.channel && (seg.trim().length > 0)) {
                        return true;
                    }
                }) ?? [];
            }
        }
        return found;
    }


    function getParentForSegmentElement(g2g: G2GRelationContext) {
        let found = new Array<string>();
        if(g2g.segment && g2g.segment.trim().length > 0) {
            let ifaceRelatedG2GIds = (ifaceToG2GIdMap.get(g2g.interfaceId) as string[]);
            if(ifaceRelatedG2GIds && ifaceRelatedG2GIds.length > 0) {
                found = ifaceRelatedG2GIds.filter(x => {
                    let ch = currentG2GInfoMapRef.current.get(x)?.channel || '';
                    let seg = currentG2GInfoMapRef.current.get(x)?.segment || '';

                    if(ch && (ch.trim().length > 0) && (ch === g2g.channel) && (seg.trim().length === 0)) {
                        return true;
                    }
                    else if(!ch && !g2g.channel && (seg.trim().length === 0)) {
                        return true;
                    }
                }) ?? [];
            }
        }
        return found;
    }


    function getOptionExclusionList(focusG2G: G2GRelationContext) : Set<string>{         
        let focusId = focusG2G._id.toString() as string
        let focusName = g2gIdToNameMap.get(focusId) as string;

        let focusRelSegs = getRelatedSegmentItemForNonSegElement(focusG2G);
        let focusRelParent = getParentForSegmentElement(focusG2G);

        // 1) start by excluding self
        // 2) for channel level G2G element, exclude its segments
        // 3) for segment level G2G element, exclude its parent level element
        let skipOptions = new Set<string>([focusId, ...focusRelSegs, ...focusRelParent]);

        if (g2gGridActionRef && g2gGridActionRef.current && g2gIdToNameMap && g2gIdToNameMap.size > 0) {
            let currentG2GCount = g2gGridActionRef.current.getActualDataCount();
            for(let k = 0; k < currentG2GCount; k++) {

                let optG2G = g2gGridActionRef.current.getDataAtIndex(k) as G2GRelationContext
                let optId = optG2G._id.toString() as string
                let optName = g2gIdToNameMap.get(optId) as string;

                if(optG2G && optId && (skipOptions.has(optId) === false)) {
                    
                    let optRelSegs = getRelatedSegmentItemForNonSegElement(optG2G);
                    let optRelParent = getParentForSegmentElement(optG2G);

                    // 4) skip dummy items --- this should never happen!!
                    if(optId.startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
                        skipOptions.add(optId);
                        continue;
                    }

                    // 5) if there is a direct mapping between focus G2G and option G2G then skip the option G2G
                    if(currentPairingsRef.current.has(`${focusId}__${optId}`) || currentPairingsRef.current.has(`${optId}__${focusId}`)) {
                        skipOptions.add(optId);
                        continue;
                    }

                    // 6) if focus G2G is a parent level element, and option is already mapped to every segment of focus element
                    if(focusRelSegs.length > 0) {
                        let hasAll = (focusRelSegs.every(x => (currentPairingsRef.current.has(`${x}__${optId}`) || currentPairingsRef.current.has(`${optId}__${x}`)) )) ? true : false;
                        if(hasAll) {
                            skipOptions.add(optId);
                            continue;
                        }
                    }

                    // 7) if option G2G is parent level element, and all of its segments is already mapped to the focus G2G element
                    if(optRelSegs.length > 0) {
                        let hasAll = (optRelSegs.every(x => (currentPairingsRef.current.has(`${x}__${focusId}`) || currentPairingsRef.current.has(`${focusId}__${x}`)) )) ? true : false;
                        if(hasAll) {
                            skipOptions.add(optId);
                            continue;
                        }
                    }
                }
            }
        }

        return skipOptions;
    }

    
    function getTargetOptionsForG2G(focusG2G: G2GRelationContext) {
        let tgtOptionsForG2GSrcItem = new Array<DisplayOption>();
        let exclusionIdSet = getOptionExclusionList(focusG2G);
        let optIdSet = new Set<string>(Array.from(g2gIdToNameMap.keys()).filter(a => exclusionIdSet.has(a) === false));
        tgtOptionsForG2GSrcItem = Array.from(optIdSet).map(k => ({id: k, label: g2gIdToNameMap.get(k) as string}))

        // sort format --> IMPORTANT!!
        tgtOptionsForG2GSrcItem = sort(tgtOptionsForG2GSrcItem).asc( [
            a => ifaceMapping.get((currentG2GInfoMapRef.current.get(a.id) as G2GRelationContext).interfaceId)?.name?.toUpperCase(),
            a => Number((currentG2GInfoMapRef.current.get(a.id) as G2GRelationContext).channel),
            a => a.label.toUpperCase()
        ]);

        return tgtOptionsForG2GSrcItem;
    }


    async function handleG2GGridInitialDataFetch(g2gInfoDataMap: Map<string, G2GRelationContext>, ifaceToG2GIdMap: Map<string, string[]>, 
        g2gIdToNameMap: Map<string, string>, ifaceMapping: Map<string, Interface>, filterText: string) : Promise<G2GRelationContext[]> {
        let arr = await onG2GGridInitialDataFetch(currentG2GInfoMapRef.current, clrRelMapping, ifaceToG2GIdMap, g2gIdToNameMap, ifaceMapping, filterText);
        g2gGridActionRef.current?.changeRowCount(arr.length);
        setG2GRowCountTracker(arr.length);   
        return arr;
    }


    function handleG2GGridGetCellContent(g2gIdToNameMap: Map<string, string>, clrRelMapping: Map<string, BasicProperty>, 
        rowEntry: G2GRelationContext, columns: GridColumn[], columnIndex: number, rowIndex: number, 
        handleTargetManagwementAction: (g2g: G2GRelationContext, rowIndex: number) => void) {
            
        let tgtOptions = new Array<DisplayOption>();
        if(columns[columnIndex].id === G2G_COL_TYPE.ACROSS_TGT_ITEMS) {
            tgtOptions = getTargetOptionsForG2G(rowEntry);
        }
        return getG2GGridCellContent(g2gIdToNameMap, clrRelMapping, tgtOptions, rowEntry, columns, columnIndex, rowIndex, handleTargetManagwementAction);
    }


    async function handleG2GGridCellEdited(editCtx: GridCellEditCtx<G2GRelationContext>, relevantAcrossTgtSetIndex: number|null): Promise<G2GRelationContext | undefined> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.EXECUTE_G2G_ACTION) === false) { return; }
        let acrosssIndex: number = 0;
        if(editCtx.columnElement.id === G2G_COL_TYPE.ACROSS_TGT_ITEMS) {
            if(relevantAcrossTgtSetIndex === null) {
                if(editCtx.current._id.toString().trim().startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
                    let splitStr: string[] = editCtx.current._id.toString().trim().split("::");
                    acrosssIndex = (splitStr.length > 1) ? Number(splitStr.at(splitStr.length -1)) : 0;
                }
                else {
                    acrosssIndex = 0
                }
            }
            else {
                acrosssIndex = relevantAcrossTgtSetIndex;
            }
        }
        
        let resProm = await onG2GGridCellEdited(editCtx, currentG2GInfoMapRef.current, g2gIdToNameMap, ifaceToG2GIdMap, currentPairingsRef.current, uppercaseG2GNameToIdMap, acrosssIndex, verifyG2gClearanceNaming);
        if(resProm.isSuccessful === false) {
            if(resProm.message.trim().length > 0) {
                displayQuickMessage(UIMessageType.ERROR_MSG, resProm.message);
            }
            if(g2gGridActionRef && g2gGridActionRef.current) {
                g2gGridActionRef.current?.reloadDataRows();
            }
            return undefined;
        }
        else {
            if(resProm.message.trim().length > 0) {
                displayQuickMessage(UIMessageType.WARN_MSG, resProm.message);
            }
            return resProm.data;
        }
    }


    async function onNoCommitTargetChangeAction(focusG2G: G2GRelationContext, rowIndex: number, targetSet: TargetSetType[], index: number) : Promise<G2GRelationContext | undefined> {
        let cellObj: MultiSelectCellType = {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            readonly: false,
            copyData: "4",             
            data: {
                kind: "multi-select-cell",
                allowDuplicates: false,
                allowCreation: false,
                values: targetSet[index].targets, 
                options: [],
            },
        };
        
        let editCtx : GridCellEditCtx<G2GRelationContext> = {
            current: focusG2G,
            columnIndex: getG2GGridColumns().findIndex(x => x.id === G2G_COL_TYPE.ACROSS_TGT_ITEMS) ?? 9, 
            columnElement: getG2GGridColumns().find(a => a.id === G2G_COL_TYPE.ACROSS_TGT_ITEMS) as GridColumn,
            rowIndex: rowIndex,
            newValue: cellObj
        }

       let retG2G = await handleG2GGridCellEdited(editCtx, index);
       return retG2G
    }



    async function onGridCellValueChangeCompleted(rowIndex: number, columnIndex: number) {
        if(g2gGridActionRef && g2gGridActionRef.current) {
            if(currentG2GInfoMapRef && currentG2GInfoMapRef.current) {
                let g2gAtIndex = g2gGridActionRef.current.getDataAtIndex(rowIndex);
                if (g2gAtIndex) {

                    let isTgtColumnChange = ((getG2GGridColumns().at(columnIndex)?.id as string) === G2G_COL_TYPE.ACROSS_TGT_ITEMS) ? true : false;

                    if(g2gAtIndex._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
                        let splitStr: string[] = g2gAtIndex._id.toString().split("::");
                        let undummifiedId : string = (splitStr.length > 1) ? splitStr.at(1) as string: splitStr.at(0) as string;
                        let acrossIndexFromId : number = (splitStr.length > 1) ? Number(splitStr.at(splitStr.length -1)) : 0;
                        let mainG2G = currentG2GInfoMapRef.current.get(undummifiedId) as G2GRelationContext;

                        if(isTgtColumnChange) {
                            if(mainG2G.across && mainG2G.across.length > 0) {
                                mainG2G.across[acrossIndexFromId] = rfdcCopy<TargetSetType>(g2gAtIndex.across[acrossIndexFromId]) as TargetSetType;
                            }
                            currentG2GInfoMapRef.current.set(mainG2G._id.toString(), mainG2G);   //due to mainG2G being modified here...
                        }   
                    }
                    else {
                        currentG2GInfoMapRef.current.set(g2gAtIndex._id.toString(), g2gAtIndex); 
                    }


                    if(isTgtColumnChange) {
                        let pairingSet = new Set<string>();
                        for(let k = 0; k < g2gRowCountTracker; k++) {
                            let currG2GAtIndex = g2gGridActionRef.current.getDataAtIndex(k) as G2GRelationContext;
                            if(currG2GAtIndex) {
                                let splitStr: string[] = currG2GAtIndex._id.toString().split("::");
                                let undummifiedId : string = (splitStr.length > 1) ? splitStr.at(1) as string: splitStr.at(0) as string;
                                let mainG2G = currentG2GInfoMapRef.current.get(undummifiedId) as G2GRelationContext;
                                
                                if(currG2GAtIndex.across && currG2GAtIndex.across.length > 0 && currG2GAtIndex.across.some(x => x.targets.length > 0)) {
                                    let realSrcIdList = new Set<string>([mainG2G._id.toString()]);
                                    if(!mainG2G.segment || mainG2G.segment.trim().length === 0) {
                                        let srcIfaceRelatedIds = (ifaceToG2GIdMap.get(mainG2G.interfaceId) as string[]);
                                        let filtered = srcIfaceRelatedIds.filter(x => (
                                            ((currentG2GInfoMapRef.current.get(x)?.channel as string) === mainG2G.channel) 
                                            && ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length > 0)
                                        )) ?? []
                                            
                                        filtered.forEach(f => realSrcIdList.add(f));
                                    }

                                    for(let srcId of realSrcIdList) {
                                        for(let acrossItem of currG2GAtIndex.across) {
                                            for(let tgtId of acrossItem.targets) {
                                                pairingSet.add(`${srcId}__${tgtId}`);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        currentPairingsRef.current = pairingSet;
                        g2gGridActionRef.current?.reloadDataRows();  //Important -- Now refresh the grid to trigger options reassessment
                        
                    }
                }
            }
        }
    }


    function onG2GGridSelectionChanged(selectedItemIdsMap: Map<string, number>): void {
        if(g2gGridActionRef && g2gGridActionRef.current && selectedItemIdsMap && selectedItemIdsMap.size > 0) {
            let map = new Map<BasicKVP, number>();
            for (let [key, value] of selectedItemIdsMap) {
                let rowObj = g2gGridActionRef.current.getDataAtIndex(value)
                map.set({key: key, value: rowObj } as BasicKVP, value)
            }
            setG2GSelectedRowInfo(map)
        }
        else {
            setG2GSelectedRowInfo(new Map<BasicKVP, number>())
        }
    }

    
    function onG2GGridSelectionCleared(): void {
        setG2GSelectedRowInfo(new Map<BasicKVP, number>())
    }

    
    function doDataReset() {
        currentG2GInfoMapRef.current = new Map();
        currentPairingsRef.current = new Set();
        setG2GSelectedRowInfo(new Map());
        setG2GIdToNameMap(new Map());
        setUppercaseG2GNameToIdMap(new Map());
        setIfaceToG2GIdMap(new Map());
        setG2GRowCountTracker(0);
    }


    function handleCancel() {
        if (onFormClosed) {
            contextualInfo.value = null;
            onFormClosed(contextualInfo);
        }
        doDataReset()
        if(close){ close() }
    }


    function verifyG2gClearanceNaming(g2g: G2GRelationContext) : boolean {
        let prohibNames = new Set<string>(
            [project.name, project._id?.toString() as string]
            .concat(projectInterfaceList.map(x => x.name))
            .map(a => a.toUpperCase()) 
        );
        
        
        if (g2gGridActionRef && g2gGridActionRef.current && g2gIdToNameMap && g2gIdToNameMap.size > 0) {
            for(let k = 0; k < g2gRowCountTracker; k++) {
                let gridItem = g2gGridActionRef.current.getDataAtIndex(k) as G2GRelationContext
                if (gridItem) {
                    let gridItemId = gridItem._id.toString() as string
                    if(gridItemId.startsWith(DUMMY_ELEMENT_ID_PREFIX) === false) {
                        
                        let toAllName = crbNameToIdMap.get(g2g.toAll.clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.toAll.clearanceRelationBrandId.trim();
                        if(toAllName && toAllName.length > 0) {
                            
                            let indexIntra = crbNameToIdMap.get(gridItem.intraclass.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.intraclass.clearanceRelationBrandId.trim();
                            if(indexIntra && indexIntra.length > 0 && (indexIntra.toUpperCase() === toAllName.toUpperCase())) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'TO_ALL' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'INTRACLASS' rule name`);
                                return false;
                            }
                            let indexWithin = crbNameToIdMap.get(gridItem.within.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.within.clearanceRelationBrandId.trim();
                            if(indexWithin && indexWithin.length > 0 && (indexWithin.toUpperCase() === toAllName.toUpperCase())) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'TO_ALL' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'WITHIN' rule name`);
                                return false;
                            }
                            
                            if(gridItem.across && gridItem.across.length > 0) {
                                for(let x = 0; x < gridItem.across.length; x++) {
                                    let indexAcross = crbNameToIdMap.get(gridItem.across[x].clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.across[x].clearanceRelationBrandId.trim();
                                    if(indexAcross && indexAcross.length > 0 && (indexAcross.toUpperCase() === toAllName.toUpperCase())) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `'TO_ALL' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'ACROSS' rule name`);
                                        return false;
                                    }  
                                }
                            }

                            //check name prohibition and formatting...
                            if(prohibNames.has(toAllName.trim().toUpperCase())){
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'ToAll' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
                                return false;
                            }

                            try { verifyNaming([toAllName], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
                            catch(e: any) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, e.message + ` ... Invalid name: '${toAllName}'`)
                                return false;
                            }
                        }



                        let intraName = crbNameToIdMap.get(g2g.intraclass.clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.intraclass.clearanceRelationBrandId.trim();
                        if(intraName && intraName.length > 0) {
                            
                            let indexToAll = crbNameToIdMap.get(gridItem.toAll.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.toAll.clearanceRelationBrandId.trim();
                            if(indexToAll && indexToAll.length > 0 && (indexToAll.toUpperCase() === intraName.toUpperCase())) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'INTRACLASS' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'TO_ALL' rule name`);
                                return false;
                            }
                            let indexWithin = crbNameToIdMap.get(gridItem.within.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.within.clearanceRelationBrandId.trim();
                            if(indexWithin && indexWithin.length > 0 && (indexWithin.toUpperCase() === intraName.toUpperCase())) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'INTRACLASS' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'WITHIN' rule name`);
                                return false;
                            }
                            
                            if(gridItem.across && gridItem.across.length > 0) {
                                for(let x = 0; x < gridItem.across.length; x++) {
                                    let indexAcross = crbNameToIdMap.get(gridItem.across[x].clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.across[x].clearanceRelationBrandId.trim();
                                    if(indexAcross && indexAcross.length > 0 && (indexAcross.toUpperCase() === intraName.toUpperCase())) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `'INTRACLASS' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'ACROSS' rule name`);
                                        return false;
                                    } 
                                }
                            }

                            //check name prohibition and formatting...
                            if(prohibNames.has(intraName.trim().toUpperCase())){
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'Intraclass' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
                                return false;
                            }

                            try { verifyNaming([intraName], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
                            catch(e: any) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, e.message + ` ... Invalid name: '${intraName}'`)
                                return false;
                            }
                        }



                        let withinName = crbNameToIdMap.get(g2g.within.clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.within.clearanceRelationBrandId.trim();
                        if(withinName && withinName.length > 0) {
                            
                            let indexToAll = crbNameToIdMap.get(gridItem.toAll.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.toAll.clearanceRelationBrandId.trim();
                            if(indexToAll && indexToAll.length > 0 && (indexToAll.toUpperCase() === withinName.toUpperCase())) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'TO_ALL' rule name`);
                                return false;
                            }
                            let indexIntra = crbNameToIdMap.get(gridItem.intraclass.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.intraclass.clearanceRelationBrandId.trim();
                            if(indexIntra && indexIntra.length > 0 && (indexIntra.toUpperCase() === withinName.toUpperCase())) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'INTRACLASS' rule name`);
                                return false;
                            }
                            
                            if(gridItem.across && gridItem.across.length > 0) {
                                for(let x = 0; x < gridItem.across.length; x++) {
                                    let indexAcross = crbNameToIdMap.get(gridItem.across[x].clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.across[x].clearanceRelationBrandId.trim();
                                    if(indexAcross && indexAcross.length > 0 && (indexAcross.toUpperCase() === withinName.toUpperCase())) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'ACROSS' rule name`);
                                        return false;
                                    }
                                }
                            }

                            //check name prohibition and formatting...
                            if(prohibNames.has(withinName.trim().toUpperCase())){
                                displayQuickMessage(UIMessageType.ERROR_MSG, `'Within' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
                                return false;
                            }

                            try { verifyNaming([withinName], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
                            catch(e: any) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, e.message + ` ... Invalid name: '${withinName}'`)
                                return false;
                            }
                        }


                        if(g2g.across && g2g.across.length > 0) {
                            for(let x = 0; x < g2g.across.length; x++) {
                                let acrossName = crbNameToIdMap.get(g2g.across[x].clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.across[x].clearanceRelationBrandId.trim();
                                if(acrossName && acrossName.length > 0) {
                                    let actualAccName = clrRelMapping.get(acrossName)?.name ?? acrossName;

                                    let indexToAll = crbNameToIdMap.get(gridItem.toAll.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.toAll.clearanceRelationBrandId.trim();
                                    if(indexToAll && indexToAll.length > 0 && (indexToAll.toUpperCase() === acrossName.toUpperCase())) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' rule name (${actualAccName}) for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'TO_ALL' rule name`);
                                        return false;
                                    }
                                    let indexIntra = crbNameToIdMap.get(gridItem.intraclass.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.intraclass.clearanceRelationBrandId.trim();
                                    if(indexIntra && indexIntra.length > 0 && (indexIntra.toUpperCase() === acrossName.toUpperCase())) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' rule name (${actualAccName}) for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'INTRACLASS' rule name`);
                                        return false;
                                    }   
                                    
                                    let indexWithin = crbNameToIdMap.get(gridItem.within.clearanceRelationBrandId.trim().toUpperCase()) ?? gridItem.within.clearanceRelationBrandId.trim();
                                    if(indexWithin && indexWithin.length > 0 && (indexWithin.toUpperCase() === acrossName.toUpperCase())) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' rule name (${actualAccName}) for source group '${g2gIdToNameMap.get(g2g._id)}' is already used as 'WITHIN' rule namep`);
                                        return false;
                                    }

                                    //check name prohibition and formatting...
                                    if(prohibNames.has(acrossName.trim().toUpperCase())){
                                        displayQuickMessage(UIMessageType.ERROR_MSG, `'Across' rule name (${actualAccName}) for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
                                        return false;
                                    }

                                    try { verifyNaming([acrossName], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
                                    catch(e: any) {
                                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message + ` ... Invalid name: '${acrossName}'`)
                                        return false;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return true;
    }



    function handleSubmit(): void {
        let finalG2GInfoCollection = new Array<G2GRelationContext>();
        
        if (g2gGridActionRef && g2gGridActionRef.current && g2gIdToNameMap && g2gIdToNameMap.size > 0) {
            let currentG2GCount = g2gGridActionRef.current.getActualDataCount();
            for(let k = 0; k < currentG2GCount; k++) {
                let g2gItem = g2gGridActionRef.current.getDataAtIndex(k) as G2GRelationContext
                if (g2gItem) {
                    if(g2gItem._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX) === false) {
                        currentG2GInfoMapRef.current.set(g2gItem._id, g2gItem);
                    }
                }
            }
        }
        
        for(let [id, g2g] of currentG2GInfoMapRef.current) {
            if(!g2g.interfaceId || (ifaceMapping.has(g2g.interfaceId) === false)) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! Could not determine interface ID for group relation info!`);
                return;
            }

            if(g2g.across && g2g.across.length > 0) {
                for(let acrosssItem of g2g.across) {
                    if(acrosssItem.targets && acrosssItem.targets.length > 0) {
                        for(let tgt of acrosssItem.targets) {
                            if(g2gIdToNameMap.has(tgt) === false) {
                                displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! invalid target detected for source group '${g2gIdToNameMap.get(id)}'!`);
                                return;
                            }
                        }
                    }
                }
            }

            //verify naming where necessary...
            let resp = verifyG2gClearanceNaming(g2g);
            if(resp === false) {
                return;
            }

            //verify that naming exists for items with multiple target sets
            if(g2g.across && g2g.across.length > 1) {
                if(g2g.across.every(x => x.clearanceRelationBrandId.trim().length > 0) === false) {
                    displayQuickMessage(UIMessageType.ERROR_MSG,`An across-rule-name is required for all target group of source element '${g2gIdToNameMap.get(id)}'!`);
                    return 
                }
            }

            //if CRB is a reused one, make sure the ID (not the name) is what goes out to backend
            g2g.toAll.clearanceRelationBrandId = crbNameToIdMap.get(g2g.toAll.clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.toAll.clearanceRelationBrandId.trim();
            g2g.intraclass.clearanceRelationBrandId = crbNameToIdMap.get(g2g.intraclass.clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.intraclass.clearanceRelationBrandId.trim();
            g2g.within.clearanceRelationBrandId = crbNameToIdMap.get(g2g.within.clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.within.clearanceRelationBrandId.trim();
            
            if(g2g.across && g2g.across.length > 0) {
                for(let x = 0; x < g2g.across.length; x++) {
                    g2g.across[x].clearanceRelationBrandId = crbNameToIdMap.get(g2g.across[x].clearanceRelationBrandId.trim().toUpperCase()) ?? g2g.across[x].clearanceRelationBrandId.trim();

                    if(g2g.across[x].targets) {
                        g2g.across[x].targets = Array.from(new Set<string>(g2g.across[x].targets))   //ensure uniqueness!
                    }
                }
            }

            finalG2GInfoCollection.push(g2g);
        }

        if (onFormClosed) {
            contextualInfo.value = finalG2GInfoCollection;
            onFormClosed(contextualInfo);
        }

        doDataReset()
        if(close){ close() }
    }


    
    function handleG2GSourceVisibilityAction(): void {
        if(g2gRowCountTracker > 0 && g2gGridActionRef && g2gGridActionRef.current) {
            let map = rfdcCopy<Map<string, G2GRelationContext>>(currentG2GInfoMapRef.current) as Map<string, G2GRelationContext>;
            for(let x = 0; x < g2gRowCountTracker; x++) {
                let g2gAtIndex = g2gGridActionRef.current.getDataAtIndex(x);
                if (g2gAtIndex) {
                    map.set(g2gAtIndex._id.toString() as string, g2gAtIndex)
                }
            }
            let srcVisGlgProps: G2GSourceGroupVisibilityDialogProps = {
                onFormClosed: onSourceVisibilityDataAvailable,
                title: `Show/Hide Source Groups`,
                g2gIdToNameMap: g2gIdToNameMap,
                contextualInfo: { key: "SRC_VIS_ACTION", value: map },
            }
            setG2GSourceGroupVisibilityDialogProps(srcVisGlgProps)
            g2gSourceGroupVisibilityModalActioner.open();
        }
    }


    function onSourceVisibilityDataAvailable(contextualInfo: BasicKVP | null): void {
        if(contextualInfo && contextualInfo.key === "SRC_VIS_ACTION") {
            if(contextualInfo.value && (contextualInfo.value as Map<string, G2GRelationContext>).size > 0) {
                let g2gMap = contextualInfo.value as Map<string, G2GRelationContext>
                let allKeys = Array.from(g2gMap.keys())
                let nonDummyKeys = allKeys.filter(x => (x.startsWith(DUMMY_ELEMENT_ID_PREFIX) === false))
                
                for(let i = 0; i < nonDummyKeys.length; i++) {
                    let g2g = g2gMap.get(nonDummyKeys[i]);
                    if(g2g) {
                        if(g2g.enabled === false) {
                            if(g2g.across && g2g.across.length > 0) {
                                let dummyRelatedIDs : string[] = allKeys.filter(a => {
                                    let splitStr: string[] = a.split("::");
                                    if(splitStr.length < 2){ //means it is not a dummy ID to begin with...
                                        return false;  
                                    }
                                    else {
                                        let undummifiedId = splitStr.at(1) as string;
                                        if(undummifiedId === (g2g._id.toString() as string)) {
                                            return true;
                                        }
                                        else {
                                            return false
                                        }
                                    }
                                });

                                if(dummyRelatedIDs && dummyRelatedIDs.length > 0) {
                                    dummyRelatedIDs.forEach(a => { g2gMap.delete(a) })
                                }

                                g2g.across = [];
                            }
                        }
                    }
                }

                for(let i = 0; i < nonDummyKeys.length; i++) {
                    let g2g = g2gMap.get(nonDummyKeys[i]);
                    if(g2g) {
                        let resp = verifyG2gClearanceNaming(g2g);
                        if(resp == false) {
                            g2g.toAll.enabled = false;
                            g2g.toAll.clearanceRelationBrandId = "";
                            g2g.intraclass.enabled = false;
                            g2g.intraclass.clearanceRelationBrandId = "";
                            g2g.within.enabled = false;
                            g2g.within.clearanceRelationBrandId = "";
                            g2g.across = [];
                        }
                    }
                }

                let finalG2GList = Array.from(g2gMap.values())
                setOriginalG2GArray(finalG2GList);
            }
        }
    }


    function handleTargetManagementAction(g2g: G2GRelationContext, rowIndex: number): void {
        if(g2gRowCountTracker > 0 && g2gGridActionRef && g2gGridActionRef.current) {
            let knownAcrossNamesList = new Set<string>();
            for(let x = 0; x < g2gRowCountTracker; x++) {
                let g2gAtIndex = g2gGridActionRef.current.getDataAtIndex(x);
                if (g2gAtIndex) {
                    if(g2g.across && g2g.across.length > 0) {
                        for(let item of g2g.across) {
                            let name = g2gIdToNameMap.get(item.clearanceRelationBrandId) ?? item.clearanceRelationBrandId
                            knownAcrossNamesList.add(name);
                        }
                    }
                }
            }

            let crbIdToNameMap = new Map<string, string>();
            if(project.clearanceRelationBrands && project.clearanceRelationBrands.length > 0) {
                for(let clrRel of project.clearanceRelationBrands) {
                    crbIdToNameMap.set(clrRel.id, clrRel.name)
                }
            }

            let tgtMgmtDP: G2GTargetMgmtDialogProps = {
                onFormClosed: onTgtMgmtDialogDataAvailable,
                title: `Manage targets for source group [${g2gIdToNameMap.get(g2g._id)}]`,
                inputG2G: g2g,
                g2gIdToNameMap: g2gIdToNameMap,
                rowIndex: rowIndex,
                origKnownNames: knownAcrossNamesList,
                crbIdToNameMap: crbIdToNameMap,
                onGetTargetOptions: getTargetOptionsForG2G,
                contextualInfo: { key: "TGT_MGMT_ACTION", value: null },
                verifyG2gClearanceNaming: verifyG2gClearanceNaming,
                onTargetChangeAction: onNoCommitTargetChangeAction
            }
            setG2GTargetMgmtDialogProps(tgtMgmtDP)
            g2gTargetMgmtModalActioner.open()
        }
    }
    
    
    function onTgtMgmtDialogDataAvailable(contextualInfo: BasicKVP): void {
        if(contextualInfo && contextualInfo.key === "TGT_MGMT_ACTION") {
            if(contextualInfo.value) {
                if(g2gGridActionRef && g2gGridActionRef.current) { 
                    
                    let focusG2G = contextualInfo.value as G2GRelationContext;
                    let pickedRowIndex : number|null = null;
                    let columnIndex = getG2GGridColumns().findIndex(x => x.id === G2G_COL_TYPE.ACROSS_TGT_ITEMS) ?? 9
                    let currentG2GCount = g2gGridActionRef.current.getActualDataCount();

                    for(let x = 0; x < currentG2GCount; x++) {
                        let g2gAtIndex = g2gGridActionRef.current.getDataAtIndex(x)
                        if (g2gAtIndex) {
                            if(g2gAtIndex._id.toString() === focusG2G._id.toString()) {
                                pickedRowIndex = x;
                                g2gAtIndex.across = focusG2G.across;
                                currentG2GInfoMapRef.current.set(g2gAtIndex._id, g2gAtIndex);
                                break;
                            }
                        }
                    }
                    
                    if(pickedRowIndex !== null) {
                        onGridCellValueChangeCompleted(pickedRowIndex, columnIndex);
                    }
                }
            }
        }
    }
    


    function getGeneralSubMenuItems(): MenuInfo[] {
        let menuArr = new Array<MenuInfo>();      
        menuArr.push({
            label: "Clear All Data",
            icon: <DeleteSweepOutlined />,
            indicateWarning: false,
            callbackAction: (kvp: BasicKVP) => { handleClearAllData() }
        });
        menuArr.push({
            label: "Show/Hide Source Groups",
            icon: <VisibilityOutlined />,
            indicateWarning: false,
            callbackAction: (kvp: BasicKVP) => { handleG2GSourceVisibilityAction() }
        });
            
        return menuArr;
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
                yOffset={"0vh"} 
                xOffset={50}
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
                                    
                    <Box alignItems="center" sx={{padding: 1, minWidth: "85vw"}}>
                        <Box>
                            <Slide timeout={{ enter: 1500, exit: 500 }} direction="down" in={true} container={containerRef.current}>
                                <Divider sx={{mt: 0, mb: .5}} />
                            </Slide>
                            <Box sx={{display: "flex", flexDirection: "row", verticalAlign: "middle" }} gap={"2vw"}>
                                <Box style={{zIndex: 1000 }}>
                                    <MenuListComposition 
                                        menuListBGColor={SPECIAL_EVEN_DEEPER_QUARTZ_COLOR} 
                                        icon={<SettingsOutlined fontSize="small" color="secondary" sx={{ fontSize: 25 }}/>} 
                                        menuItems={getGeneralSubMenuItems()}
                                        padding={.2}
                                    />
                                </Box>
                                <Slide timeout={{ enter: 500, exit: 500 }} direction="down" in={true} container={containerRef.current}>
                                    <Typography sx={{ verticalAlign: "middle", justifySelf: "center", color: SPECIAL_RED_COLOR}}>
                                        {warningMsg ?? ''}
                                    </Typography>
                                </Slide>
                            </Box>
                            <Slide timeout={{ enter: 1000, exit: 500 }} direction="down" in={true} container={containerRef.current}>
                                <Divider sx={{mt: .5, mb: .5}} />
                            </Slide>
                        </Box>
                        
                        {(g2gRowCountTracker > 0) && <Box sx={{height: "69vh", minWidth: 444, width: "92vw"}}>
                            <BaseGlideGrid<G2GRelationContext> 
                                excludePortal={false}
                                gridHeight={"64vh"}
                                rowHeight={30}
                                headerHeight={BASIC_GRID_HEADER_HEIGHT}
                                gridRef={g2gGridRef}
                                columns={g2gGridColumns}
                                freezeColumns={1}
                                pageSize={Number.MAX_SAFE_INTEGER}
                                totalRowCount={g2gRowCountTracker ?? 9999}
                                gridMarginRight={-3}
                                enableFillHandle={true}
                                multiRowSelectionEnabled={true}
                                maxRowSelectionCount={Number.MAX_SAFE_INTEGER}
                                enableSearchField={true}
                                showActionButton={false}
                                isActionClickAllowed={ true }
                                actionButtonText={''}
                                actionButtonWidth={80}
                                reloadAfterActionClick={false}
                                cellEditConfirmationColumns={undefined}
                                groupRowLines={undefined}
                                rightElementEnablementInitValue={undefined}
                                onGetRightElementContent={undefined}
                                onEvaluateFillPattern={onG2GEvaluateFillPattern}
                                onGetRowGroupCellContent={undefined}
                                onGetToolTipText={(args, columns, rowEntry) => onG2GGridGetToolTipText(args, columns, rowEntry, ifaceMapping, g2gIdToNameMap)}
                                onActionButtonClick={undefined}
                                onGridCellEdited={(editCtx) => handleG2GGridCellEdited(editCtx, null)}
                                onGridCellValueChangeCompleted={onGridCellValueChangeCompleted}
                                onGetGridCellContent={(rowEntry, columns, columnIndex, isGroupHeader, rowIndex) => handleG2GGridGetCellContent(g2gIdToNameMap, clrRelMapping, rowEntry, columns, columnIndex, rowIndex, handleTargetManagementAction)} 
                                onGridSelectionChanged={(gridSelection, selectedIds) => onG2GGridSelectionChanged(selectedIds)}
                                onGridSelectionCleared={onG2GGridSelectionCleared}
                                onFetchFirstSetData={(limit, filterText, existingGroupRowLineInfoList) => handleG2GGridInitialDataFetch(currentG2GInfoMapRef.current, ifaceToG2GIdMap, g2gIdToNameMap, ifaceMapping, filterText)}
                                onFetchSubsequentData={(lastId, lastDataEntry, limit, filterText) => {return new Promise(() => new Array<G2GRelationContext>());}}  
                                specialGridActionRef={g2gGridActionRef}
                            />
                        </Box>}
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

            {g2gTargetMgmtModalState && <G2GTargetMgmtDialog opened={g2gTargetMgmtModalState} close={g2gTargetMgmtModalActioner.close} {...g2gTargetMgmtDialogProps as G2GTargetMgmtDialogProps} /> }
            {g2gSourceGroupVisibilityModalState && <G2GSourceGroupVisibilityDialog opened={g2gSourceGroupVisibilityModalState} close={g2gSourceGroupVisibilityModalActioner.close} {...g2gSourceGroupVisibilityDialogProps as G2GSourceGroupVisibilityDialogProps} /> }
            
        </Box>
    );
}


export default G2GLayoutDialog













//==========================================================================================



// function getOptionExclusionList_OLD(focusG2GInfo: G2GRelationContext) : Set<string>{         
//     let focusId = focusG2GInfo._id.toString() as string
    
    
//     // 1) start by excluding self
//     let skipOptions = new Set<string>([focusId]);

//     if(focusG2GInfo.channel && focusG2GInfo.channel.trim().length > 0) {
//         let focusIfaceRelatedIds = (ifaceToG2GIdMap.get(focusG2GInfo.interfaceId) as string[]);
//         if(focusIfaceRelatedIds && focusIfaceRelatedIds.length > 0) {
//             let filtered = new Array<string>();
            
//             if(!focusG2GInfo.segment || focusG2GInfo.segment.trim().length === 0) {
//                 // 2) for channel level G2G element, exclude its segments
//                 let filtered = focusIfaceRelatedIds.filter(x => (
//                     ((currentG2GInfoMapRef.current.get(x)?.channel as string) === focusG2GInfo.channel) 
//                     && ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length > 0)
//                 )) ?? []
//             }
//             else {
//                 // 3) for segment level G2G element, exclude its channel level element
//                 let filtered = focusIfaceRelatedIds.filter(x => (
//                     ((currentG2GInfoMapRef.current.get(x)?.channel as string) === focusG2GInfo.channel) 
//                     && ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length === 0)
//                 )) ?? []
//             }
//             filtered.forEach(k => { skipOptions.add(k) });
//         }
//     }

//     if (g2gGridActionRef && g2gGridActionRef.current && g2gIdToNameMap && g2gIdToNameMap.size > 0) {
//         let currentG2GCount = g2gGridActionRef.current.getActualDataCount();
//         for(let k = 0; k < currentG2GCount; k++) { //intentionally not using 'g2gRowCountTracker' for the count - due to it might be off track when this is called

//             let optG2G = g2gGridActionRef.current.getDataAtIndex(k) as G2GRelationContext
            
//             //DEBUG
//             if(!optG2G || !optG2G._id){
//                 console.log("adfsfsdfsdf")
//             }

//             let optId = optG2G._id.toString() as string


//             if(skipOptions.has(optId) === false) {
                
//                 //skip dummy items
//                 if(optId.startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
//                     let splitStr: string[] = optId.split("::");
//                     let undummifiedId : string = (splitStr.length > 1) ? splitStr.at(1) as string: splitStr.at(0) as string;
//                     skipOptions.add(optId);
//                     skipOptions.add(undummifiedId);
//                     continue;
//                 }

//                 if(currentPairingsRef.current.size > 0) {

//                     // 1) if there is a direct mapping between focus G2G and option G2G then skip the option G2G
//                     if(currentPairingsRef.current.has(`${focusId}__${optId}`) || currentPairingsRef.current.has(`${optId}__${focusId}`)) {
//                         skipOptions.add(optId);
//                         continue;
//                     }

//                     // 2) if focus G2G is a channel-level element, and option is already mapped to every segment of focus element
//                     if(!focusG2GInfo.segment || focusG2GInfo.segment.trim().length === 0) {
//                         let focusIfaceRelatedIds = (ifaceToG2GIdMap.get(focusG2GInfo.interfaceId) as string[]);
    
//                         let filtered = focusIfaceRelatedIds.filter(x => (
//                             ((currentG2GInfoMapRef.current.get(x)?.channel as string) === focusG2GInfo.channel) 
//                             && ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length > 0)
//                         )) ?? []

//                         if(filtered && filtered.length > 0) {
//                             let hasAll = (filtered.every(x => (currentPairingsRef.current.has(`${x}__${optId}`) || currentPairingsRef.current.has(`${optId}__${x}`)) )) ? true : false;
//                             if(hasAll) {
//                                 skipOptions.add(optId);
//                                 continue;
//                             }
//                         }
//                     }

//                     // 3) if option G2G is channel level, and all of its segments is already mapped to the focus G2G element
//                     if(!optG2G.segment || optG2G.segment.trim().length === 0) {
//                         let optIfaceRelatedIds = (ifaceToG2GIdMap.get(optG2G.interfaceId) as string[]) ?? [];
                        
//                         let filtered = optIfaceRelatedIds.filter(x => (
//                             ((currentG2GInfoMapRef.current.get(x)?.channel as string) === optG2G.channel) 
//                             && ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length > 0)
//                         )) ?? []

//                         if(filtered && filtered.length > 0) {
//                             let hasAll = (filtered.every(x => (currentPairingsRef.current.has(`${x}__${focusId}`) || currentPairingsRef.current.has(`${focusId}__${x}`)) )) ? true : false;
//                             if(hasAll) {
//                                 skipOptions.add(optId);
//                                 continue;
//                             }
//                         }
//                     }
//                 }


//                 // 4) exclude G2G options that are already in target list of focus element
//                 if(focusG2GInfo.across && focusG2GInfo.across.length > 0){
//                     let doContinue = false;
//                     for(let acrossItem of focusG2GInfo.across) {
//                         if((acrossItem.targets ?? []).includes(optId) || (acrossItem.targets ?? []).includes(g2gIdToNameMap.get(optId) as string)) {
//                             skipOptions.add(optId);
//                             doContinue = true;
//                             break;
//                         }
//                     }
//                     if(doContinue === true) {
//                         continue;
//                     }
//                 }

//                 // 5) exclude G2G options that already have focus element in its target list
//                 if(optG2G.across && optG2G.across.length > 0){
//                     let doContinue = false;
//                     for(let acrossItem of optG2G.across) {
//                         if((acrossItem.targets ?? []).includes(focusId) || (acrossItem.targets ?? []).includes(g2gIdToNameMap.get(focusId) as string)) {
//                             skipOptions.add(optId);
//                             doContinue = true;
//                             break;
//                         }
//                     }
//                     if(doContinue === true) {
//                         continue;
//                     }
//                 }

//                 // 6) if option is a channel level G2G, but focus G2G already has all the segments of that channel/option 
//                 if(focusG2GInfo.across && focusG2GInfo.across.length > 0){
//                     if(!optG2G.segment || optG2G.segment.trim().length === 0) {
//                         let optIfaceRelatedIds = (ifaceToG2GIdMap.get(optG2G.interfaceId) as string[]) ?? [];
                        
//                         let filtered = optIfaceRelatedIds.filter(x => (
//                             ((currentG2GInfoMapRef.current.get(x)?.channel as string) === optG2G.channel) 
//                             && ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length > 0)
//                         )) ?? []

//                         if(filtered && filtered.length > 0) {
//                             let doContinue = false;
//                             for(let acrossItem of focusG2GInfo.across) {
//                                 let hasAll = (filtered.every(x => ( (acrossItem.targets ?? []).includes(x) || (acrossItem.targets ?? []).includes(g2gIdToNameMap.get(x) as string) ))) ? true : false;
//                                 if(hasAll) {
//                                     skipOptions.add(optId);
//                                     doContinue = true;
//                                     break;
//                                 }
//                             }
//                             if(doContinue === true) {
//                                 continue;
//                             }
//                         }
//                     }
//                 }

//                 // 7) if option is channel-level G2G, AND focus element is also channel-level G2G, AND option's across-mapping already has all segments of focus G2G element
//                 if(optG2G.across && optG2G.across.length > 0) {
//                     if((!optG2G.segment || optG2G.segment.trim().length === 0) && (!focusG2GInfo.segment || focusG2GInfo.segment.trim().length === 0)) {
//                         let focusIfaceRelatedIds = (ifaceToG2GIdMap.get(focusG2GInfo.interfaceId) as string[]);
                        
//                         let filtered = focusIfaceRelatedIds.filter(x => (
//                             ((currentG2GInfoMapRef.current.get(x)?.channel as string) === focusG2GInfo.channel) 
//                             && ((currentG2GInfoMapRef.current.get(x)?.segment as string).trim().length > 0)
//                         )) ?? []

//                         if(filtered && filtered.length > 0) {
//                             let doContinue = false;
//                             for(let acrossItem of optG2G.across) {
//                                 let hasAll = (filtered.every(x => ( (acrossItem.targets ?? []).includes(x) || (acrossItem.targets ?? []).includes(g2gIdToNameMap.get(x) as string) ))) ? true : false;
//                                 if(hasAll) {
//                                     skipOptions.add(optId);
//                                     doContinue = true;
//                                     break;
//                                 }
//                             }
//                             if(doContinue === true) {
//                                 continue;
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }

//     return skipOptions;
// }


//======================================================================================


        // let intraName = g2g.intraclass.clearanceRelationBrandId.trim().toUpperCase();
        // if(intraName && intraName.length > 0) {
        //     if(withinCRBSetRef.current.has(intraName) || acrossCRBSetRef.current.has(intraName) || toAllCRBSetRef.current.has(intraName)){
        //         displayQuickMessage(UIMessageType.ERROR_MSG, `'Intraclass' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' cannot be used for another relation type!`);
        //         return false;
        //     }
        //     else if(prohibNames.has(intraName)){
        //         displayQuickMessage(UIMessageType.ERROR_MSG, `'Intraclass' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
        //         return false;
        //     }

        //     try { verifyNaming([g2g.intraclass.clearanceRelationBrandId.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
        //     catch(e: any) {
        //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
        //         return false;
        //     }
        // }

        // let withinName = g2g.within.clearanceRelationBrandId.trim().toUpperCase();
        // if(withinName && withinName.length > 0) {
        //     if(intraCRBSetRef.current.has(withinName) || acrossCRBSetRef.current.has(withinName) || toAllCRBSetRef.current.has(withinName)){
        //         displayQuickMessage(UIMessageType.ERROR_MSG, `'Within' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' cannot be used for another relation type!`);
        //         return false;
        //     }
        //     else if(prohibNames.has(withinName)){
        //         displayQuickMessage(UIMessageType.ERROR_MSG, `'Within' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
        //         return false;
        //     }

        //     try { verifyNaming([g2g.within.clearanceRelationBrandId.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
        //     catch(e: any) {
        //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
        //         return false;
        //     }
        // }

        // let toAllName = g2g.toAll.clearanceRelationBrandId.trim().toUpperCase();
        // if(toAllName && toAllName.length > 0) {
        //     if(intraCRBSetRef.current.has(toAllName) || acrossCRBSetRef.current.has(toAllName) || withinCRBSetRef.current.has(toAllName)){
        //         displayQuickMessage(UIMessageType.ERROR_MSG, `'ToAll' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' cannot be used for another relation type!`);
        //         return false;
        //     }
        //     else if(prohibNames.has(toAllName)){
        //         displayQuickMessage(UIMessageType.ERROR_MSG, `'ToAll' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
        //         return false;
        //     }

        //     try { verifyNaming([g2g.toAll.clearanceRelationBrandId.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
        //     catch(e: any) {
        //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
        //         return false;
        //     }
        // }

        // if(g2g.across) {
        //     for(let across of g2g.across) {
        //         let acrossName = across.clearanceRelationBrandId.trim().toUpperCase();
        //         if(acrossName && acrossName.length > 0) {
        //             if(intraCRBSetRef.current.has(acrossName) || withinCRBSetRef.current.has(acrossName) || toAllCRBSetRef.current.has(acrossName)){
        //                 displayQuickMessage(UIMessageType.ERROR_MSG, `'Across' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' cannot be used for another relation type!`);
        //                 return false;
        //             }
        //             else if(prohibNames.has(acrossName)){
        //                 displayQuickMessage(UIMessageType.ERROR_MSG, `'Across' rule name for source group '${g2gIdToNameMap.get(g2g._id)}' is prohibited. Please use another name!`);
        //                 return false;
        //             }

        //             try { verifyNaming([across.clearanceRelationBrandId.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
        //             catch(e: any) {
        //                 displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
        //                 return false;
        //             }
        //         }
        //     }
        // }
        






    // for(let x = 0; x < g2gRowCountTracker; x++) {
    //     let g2gAtIndex = g2gGridActionRef.current.getDataAtIndex(x)
    //     if (g2gAtIndex) {
    //         // if(g2gAtIndex._id.toString().startsWith(DUMMY_ELEMENT_ID_PREFIX)) {
    //         //     let splitStr: string[] = g2gAtIndex._id.toString().split("::");
    //         //     let undummifiedId : string = (splitStr.length > 1) ? splitStr.at(1) as string: splitStr.at(0) as string;
    //         //     if(undummifiedId === focusG2G._id.toString()) {
    //         //         g2gAtIndex.across = focusG2G.across;
    //         //     }
    //         // }
    //         if(g2gAtIndex._id.toString() === focusG2G._id.toString()) {
    //             pickedRowIndex = x;
    //             g2gAtIndex.across = focusG2G.across;
    //         }
        
    //         // currentG2GInfoMapRef.current.set(g2gAtIndex._id.toString(), g2gAtIndex);
            
    //     }
    // }







    // async function executeG2GGridInitialDataFetch(existingGroupRowLineInfoList: readonly GroupRowLineInfo[]|undefined, 
    //     g2gInfoDataMap: Map<string, G2GRelationContext>, ifaceToG2GIdMap: Map<string, string[]>, g2gIdToNameMap: Map<string, string>, 
    //     ifaceMapping: Map<string, Interface>, filterText: string) : Promise<G2GRelationContext[]> {
        
    //     setLoadingSpinnerCtx({enabled: true, text: `Now loading G2G data. Please be patient...`} as LoadingSpinnerInfo)
    //     let res = await onG2GGridInitialDataFetch(g2gInfoDataMap, ifaceToG2GIdMap, g2gIdToNameMap, 
    //         ifaceMapping, filterText).finally(() => { cancelLoadingSpinnerCtx() }); //filterText
        
    //     // Collapse the ones that are still exactly the same (best case match)
    //     if(existingGroupRowLineInfoList && existingGroupRowLineInfoList.length > 0) {
    //         let exRGMap = new Map<string, GroupRowLineInfo>();
    //         existingGroupRowLineInfoList.forEach(a => exRGMap.set(a.elementId, a))

    //         for(let i = 0; i < res.groupInfo.length; i++) {
    //             let equiv = exRGMap.get(res.groupInfo[i].elementId)
    //             if(equiv && res.groupInfo[i].index === equiv.index && res.groupInfo[i].headerText === equiv.headerText) {
    //                 res.groupInfo[i].isCollapsed = equiv.isCollapsed;
    //             }
    //         } 
    //     }

    //     // setGroupRowLineItems(res.groupInfo as GroupRowLineInfo[])
    //     // if (g2gGridActionRef && g2gGridActionRef.current) {
    //     //     g2gGridActionRef.current.setGridRowGroupingInfo(res.groupInfo as GroupRowLineInfo[])

    //     //     let dummyCount = res.data.filter(a => a._id.toString().trim().startsWith(DUMMY_ELEMENT_ID_PREFIX)).length;
    //     //     let maxCount = g2gContextList.length + dummyCount + 1;
    //     //     setG2GRowCount(maxCount)
    //     //     g2gGridActionRef.current.changeRowCount(maxCount);
    //     // }

    //     // firstEntryMapRef.current = res.firstEntryMap
    //     return res.data;
    // }
    



    // function handleG2GRowGroupGridCellContent(rowEntry: G2GRelationContext, columns: GridColumn[], columnIndex: number, isGroupHeader: boolean, groupRowLines: GroupRowLineInfo[], path: readonly number[]): GridCell {
        // let res = getG2GGridCellContent(g2gIdToNameMap, clrRelMapping, tgtOptionsForG2GSrcItem, rowEntry, columns, columnIndex);
        // let tgtOptionsForG2GSrcItem = new Array<DisplayOption>();
        // let res = getG2GRowGroupGridCellContent(g2gIdToNameMap, clrRelMapping, tgtOptionsForG2GSrcItem, rowEntry, columns, columnIndex, groupRowLines, isGroupHeader, path);
        // return res
    // }






        // menuArr.push({
        //     label: "",
        //     icon: 
        //         <FormControlLabel 
        //             control={ <Switch 
        //                 size="small"
        //                 sx={{ mr: 1, backgroundColor: undefined}} 
        //                 checked={channelSyncEnabled}
        //                 onChange={(e, checked) => { setChannelSyncEnabled(checked); }}
        //             />} 
        //             label={<Typography sx={{mr: 1, color: colors.grey[100], fontSize: 13}}>{(false) ? `Disengage Channel Sync` : `Engage Channel Sync` }</Typography>}
        //         />,
        //     callbackAction: (kvp: BasicKVP) => {  }
        // });


    //====================================================================================================
    //====================================================================================================
    //====================================================================================================

    //sync channel capability
                                                                                        //clear all data
                                                                                        //enhanced sortSlots()
    //cleanup selectable option filtering on fly
    //... need to set segments instead - if/when a channel level that has segments is selected
    //handle validation on cell edited (handle here before calling BaseGridLogic function)
    //handle on submit logic for this dialog
    //reassess whats happening on backend after submit
    //ensure ability to reuse rule name vertically


    //==============================================================================================



// setTimeout(() => {
//     g2gGridActionRef.current?.reloadDataRows();
// }, 10);




        // if(editCtx.columnIndex === 8) {
        //     let furtherFiltered = editCtx.current.targets.filter(b => 
        //         ((currentPairingsRef.current.has(`${editCtx.current.id}__${upperCaseG2GNameToIdMap.get(b)}`) 
        //             || currentPairingsRef.current.has(`${upperCaseG2GNameToIdMap.get(b)}__${editCtx.current.id}`)) === false) 
        //     )

        //     let exclusions = editCtx.current.targets.filter(a => (furtherFiltered.includes(a) === false));
        //     if(exclusions.length > 0) {
        //         displayQuickMessage(UIMessageType.WARN_MSG, `Target item(s) excluded! Source group '${g2gIdToNameMap.get(editCtx.current.id)}' `
        //             + `already has a relationship to the following targets: [${exclusions.join(", ")}]`);
        //     }

        //     editCtx.current.targets = furtherFiltered;
        // }
        // else {
        //     let resp = verifyG2gClearanceNaming(editCtx.current);
        //     if(resp == false) {
        //         if(g2gGridActionRef && g2gGridActionRef.current) {
        //             g2gGridActionRef.current?.reloadDataRows();
        //         }
        //         return undefined;

        //     }
        // }
        // return resProm




            // let intraName = g2gInfo.clearanceRelationBrandIntraclass.trim().toUpperCase();
            // if(intraName && intraName.length > 0) {
            //     if(withinCRBSetRef.current.has(intraName) || acrossCRBSetRef.current.has(intraName) || toAllCRBSetRef.current.has(intraName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'TO_SELF' relation rule name used for source group '${g2gIdToNameMap.get(id)}' was also used in another G2G relation type!`);
            //         return;
            //     }
            //     else if(prohibNames.has(intraName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'TO_SELF' relation rule name used for source group '${g2gIdToNameMap.get(id)}' is prohibited. Please use another name!`);
            //         return;
            //     }

            //     try { verifyNaming([g2gInfo.clearanceRelationBrandIntraclass.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
            //     catch(e: any) {
            //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
            //         return;
            //     }
            // }

            // let withinName = g2gInfo.clearanceRelationBrandWithin.trim().toUpperCase();
            // if(withinName && withinName.length > 0) {
            //     if(intraCRBSetRef.current.has(withinName) || acrossCRBSetRef.current.has(withinName) || toAllCRBSetRef.current.has(withinName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' relation rule name used for source group '${g2gIdToNameMap.get(id)}' was also used in another G2G relation type!`);
            //         return;
            //     }
            //     else if(prohibNames.has(withinName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' relation rule name used for source group '${g2gIdToNameMap.get(id)}' is prohibited. Please use another name!`);
            //         return;
            //     }

            //     try { verifyNaming([g2gInfo.clearanceRelationBrandWithin.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
            //     catch(e: any) {
            //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
            //         return;
            //     }
            // }

            // let acrossName = g2gInfo.clearanceRelationBrandAcross.trim().toUpperCase();
            // if(acrossName && acrossName.length > 0) {
            //     if(intraCRBSetRef.current.has(acrossName) || withinCRBSetRef.current.has(acrossName) || toAllCRBSetRef.current.has(acrossName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' relation rule name used for source group '${g2gIdToNameMap.get(id)}' was also used in another G2G relation type!`);
            //         return;
            //     }
            //     else if(prohibNames.has(acrossName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' relation rule name used for source group '${g2gIdToNameMap.get(id)}' is prohibited. Please use another name!`);
            //         return;
            //     }

            //     try { verifyNaming([g2gInfo.clearanceRelationBrandAcross.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
            //     catch(e: any) {
            //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
            //         return;
            //     }
            // }

            // let toAllName = g2gInfo.clearanceRelationBrandToAll.trim().toUpperCase();
            // if(toAllName && toAllName.length > 0) {
            //     if(intraCRBSetRef.current.has(toAllName) || acrossCRBSetRef.current.has(toAllName) || withinCRBSetRef.current.has(toAllName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! Could not proceed because name intended for one of the "TO-ALL" group relations was used for another G2G relation type!`);
            //         return;
            //     }
            //     else if(prohibNames.has(toAllName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! Could not proceed due to name intended for one of the "TO-ALL" group relations!`);
            //         return;
            //     }

            //     try { verifyNaming([g2gInfo.clearanceRelationBrandToAll.trim()], NamingContentTypeEnum.ARBITRARY_DEFAULT) }
            //     catch(e: any) {
            //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
            //         return;
            //     }
            // }


            //===================================================================






            // let withinName = editCtx.current.clearanceRelationBrandWithin.trim().toUpperCase();
            // if(withinName && withinName.length > 0) {
            //     if(intraCRBSetRef.current.has(withinName) || acrossCRBSetRef.current.has(withinName) || toAllCRBSetRef.current.has(withinName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' relation rule name used for source group '${g2gIdToNameMap.get(editCtx.current.id)}' was also used in another G2G relation type!`);
            //         return undefined;
            //     }
            // }

            // let acrossName = editCtx.current.clearanceRelationBrandAcross.trim().toUpperCase();
            // if(acrossName && acrossName.length > 0) {
            //     if(intraCRBSetRef.current.has(acrossName) || withinCRBSetRef.current.has(acrossName) || toAllCRBSetRef.current.has(acrossName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' relation rule name used for source group '${g2gIdToNameMap.get(editCtx.current.id)}' was also used in another G2G relation type!`);
            //         return undefined;
            //     }
            // }

            // let intraName = editCtx.current.clearanceRelationBrandIntraclass.trim().toUpperCase();
            // if(intraName && intraName.length > 0) {
            //     if(withinCRBSetRef.current.has(intraName) || acrossCRBSetRef.current.has(intraName) || toAllCRBSetRef.current.has(intraName)){
            //         displayQuickMessage(UIMessageType.ERROR_MSG, `'TO_SELF' relation rule name used for source group '${g2gIdToNameMap.get(editCtx.current.id)}' was also used in another G2G relation type!`);
            //         return;
            //     }
            // }



//------------
            // if(columnIndex === 8) {
            //     let pairingSet = new Set<string>();
            //     for(let k = 0; k < g2gRowCount; k++) {
            //         let g2g = g2gGridActionRef.current.getDataAtIndex(k) as G2GRelationInfo;
            //         let srcG2GSections = getSectionsFromIdString(g2g.id)?.data as {ifaceId: string, channel: number|null, segment: string|null};
            //         let srcIdList = [g2g.id];
            //         if(srcG2GSections.segment === null) {
            //             let srcIfaceRelatedIds = (ifaceToG2GIdMap.get(srcG2GSections.ifaceId) as string[]);
            //             let filtered = srcIfaceRelatedIds.filter(x => {
            //                 let inner = getSectionsFromIdString(x)?.data;
            //                 if(inner && inner.channel === srcG2GSections.channel && inner.segment !== null) {
            //                     return x
            //                 }
            //             });
            //             if(filtered && filtered.length > 0) {
            //                 filtered.forEach(x => { srcIdList.push(x) });
            //             }
            //         }

            //         for(let src of srcIdList) {
            //             for(let tgt of g2g.targets) {
            //                 pairingSet.add(`${src}__${tgt}`);
            //             }
            //         }
            //     }
            //     setCurrentPairings(pairingSet);
            // }




        // if(g2gGridActionRef && g2gGridActionRef.current && g2gIdToNameMap && g2gIdToNameMap.size > 0) {
        //     for(let k = 0; k < g2gRowCount; k++) {
        //         let g2g = g2gGridActionRef.current.getDataAtIndex(k) as G2GRelationInfo
        //         let iterG2GSections = getSectionsFromIdString(g2g.id)?.data as {ifaceId: string, channel: number|null, segment: string|null};
                
        //         if(skipOptions.has(g2g.id)) {
        //             continue;
        //         }

        //         if(iterG2GSections && (iterG2GSections.channel === null)) {
        //             if(ifaceToG2GIdMap.has(iterG2GSections.ifaceId) && ((ifaceToG2GIdMap.get(iterG2GSections.ifaceId)?.length as number) > 1)){
        //                 continue;
        //             }
        //         }

        //         if(g2g.id === relevG2gInfo.id) {
        //             continue;
        //         }

        //         if(((relevG2gInfo.targets as string[]) ?? []).includes(g2g.id)) {
        //             continue;
        //         }

        //         if(g2g.targets && g2g.targets.length > 0) {
        //             let ifaceRelatedIds = (ifaceToG2GIdMap.get(iterG2GSections.ifaceId) as string[]);
        //             if(ifaceRelatedIds && ifaceRelatedIds.length > 0) {
        //                 let filtered = new Array<string>();
        //                 if(iterG2GSections.segment === null) {
        //                     filtered = ifaceRelatedIds.filter(x => {
        //                         let inner = getSectionsFromIdString(x)?.data;
        //                         if(inner && inner.channel === iterG2GSections.channel && inner.segment !== null) {
        //                             return x
        //                         }
        //                     });
        //                     if(filtered && filtered.length > 0) {
        //                         let hasAll = (filtered.every(x => g2g.targets.includes(x))) ? true : false;
        //                         if(hasAll) {
        //                             continue;
        //                         }
        //                     }
        //                 }
        //             }
        //         }

                
        //         if(currentPairings.size > 0) {
        //             //important to follow the 'A->B equals B->A bidirectional equality rule
        //             if(currentPairings.has(`${relevG2gInfo.id}__${g2g.id}`) || currentPairings.has(`${g2g.id}__${relevG2gInfo.id}`)) {
        //                 continue;
        //             }
                    
        //             //important to follow the 'A->B equals B->A bidirectional equality rule
        //             if(ifaceMapping.has(relevG2gInfo.id)) {
        //                 let chComponents = ifaceToG2GIdMap.get(relevG2gInfo.id)?.filter(a => a !== relevG2gInfo.id) ?? []
        //                 if((chComponents.length > 0) && chComponents.every(x => currentPairings.has(`${iterG2GSections.ifaceId}__${x}`))) {
        //                     continue;
        //                 }
        //             }
        //         }


        //         options.add(g2g.id)
        //     }
        // }







// if(data && data.segment === null) {
                    //     if(data.channel !== null) {
                    //         let groupBySegment = groupBy(ifaceToG2GIdMap.get(ifaceId) as string[], c => getSectionsFromIdString(g2g.id)?.data?.channel)
                    //         console.log(groupBySegment)
                    //     }
                    // }


// function handleG2GGridGetCellContent(g2gIdToNameMap: Map<string, string>, clrRelMapping: Map<string, BasicProperty>, rowEntry: G2GRelationInfo, columns: GridColumn[], columnIndex: number) {
//     let optSet = new Set<string>();
//     if(columnIndex === 8 && rowEntry.setAcross === true) {
//         optSet = getG2gElementSelectableOptions(rowEntry)
//         // tgtOptionsArray = Array.from(optSet).map(n => ({id: n, label: g2gIdToNameMap.get(n)} as DisplayOption ))
//         // tgtOptionsArray = Array.from(g2gIdToNameMap).map(([key, val]) => ({id: key, label: val} as DisplayOption ))
//         // console.log(othArray);
//     }
//     let res = getG2GGridCellContent(g2gIdToNameMap, clrRelMapping, optSet, rowEntry, columns, columnIndex);
//     return res;
// }








    // function getG2gElementSelectableOptions(relevG2gInfo: G2GRelationInfo) : DisplayOption[]{         
    //     // if item is interface level item only, then options should not have same interface item
    //     // If item is interface with channnels, options can have interface with its channels, BUT... selection will only include channel (handle this in element action function)
    //     // if item is channel item, options cannot include same channel
        
    //     let options = new Array<DisplayOption>()
    //     if(g2gInfoMap && g2gInfoMap.size > 0) {
            
    //         for(let [g2gId, ctx] of g2gInfoMap) {
    //             if(g2gId.length > 0) {
    //                 let dataInfo = getSectionsFromIdString(g2gId)?.data;
    //                 let ifaceId = dataInfo?.ifaceId as string;
                    
    //                 if(g2gId === relevG2gInfo.id) {
    //                     continue;
    //                 }

    //                 if(dataInfo && (dataInfo.channel === null)) {
    //                     if(ifaceToG2GIdMap.has(ifaceId) && ((ifaceToG2GIdMap.get(ifaceId)?.length as number) > 1)){
    //                         continue;
    //                     }
    //                 }

    //                 if(((relevG2gInfo.targets as string[]) ?? []).includes(g2gId)) {
    //                     continue;
    //                 }

    //                 if(currentPairings.size > 0) {
    //                     //important to follow the 'A->B equals B->A bidirectional equality rule
    //                     if(currentPairings.has(`${relevG2gInfo.id}__${g2gId}`) || currentPairings.has(`${g2gId}__${relevG2gInfo.id}`)) {
    //                         continue;
    //                     }
                        
    //                     //important to follow the 'A->B equals B->A bidirectional equality rule
    //                     let g2gName = g2gInfoMap.get(relevG2gInfo.id)?.name as string;
    //                     if(currentPairings.has(`${ifaceId}__${g2gName}`)) {
    //                         continue;
    //                     }
                        
    //                     //important to follow the 'A->B equals B->A bidirectional equality rule
    //                     if(ifaceMapping.has(relevG2gInfo.id)) {
    //                         let chComponents = ifaceToG2GIdMap.get(relevG2gInfo.id)?.filter(a => a !== relevG2gInfo.id) ?? []
    //                         if((chComponents.length > 0) && chComponents.every(x => currentPairings.has(`${ifaceId}__${x}`))) {
    //                             continue;
    //                         }
    //                     }
    //                 }

    //                 let rootName = g2gInfoMap.get(ifaceId)?.name as string
    //                 let dispOpt : DisplayOption = {id: g2gId, label: ctx.name, type: rootName }
    //                 options.push(dispOpt)
    //             }
    //         }
    //     }
    //     let sortedOptions = sort(options).asc([a => a.type, a => a.label]);
    //     return sortedOptions;
    // }


    // async function onG2gElementAction(event: any, isAdditionAction: boolean, optionId: string, relevG2gInfo: G2GRelationInfo) {
    //     if(optionId && optionId.trim().length > 0) {
    //         let g2gInfoMapCopy = rfdcCopy<Map<string, G2GCtx>>(g2gInfoMap) as Map<string, G2GCtx>
    //         let currentPairingsCopy = rfdcCopy<Set<string>>(currentPairings) as Set<string>;
            
    //         if (optionId === "CLEAR_ALL" && isAdditionAction === false) { 
    //             for(let [id, ctx] of g2gInfoMapCopy) {
    //                 if(id === relevG2gInfo.id) {
    //                     ctx.g2gInfo.targets = new Array<string>();
    //                     setG2GInfoMap(g2gInfoMapCopy);
    //                     return;
    //                 }
    //             }
    //         }
            
    //         let optionIdList = new Array<string>();
    //         let currAllOptions = new Array<DisplayOption>();

    //         if(g2gInfoMap.has(optionId)) {
    //             optionIdList.push(optionId)
    //         } 
    //         else { 
    //             currAllOptions = getG2gElementSelectableOptions(relevG2gInfo)
    //             if(currAllOptions && currAllOptions.length > 0) {
    //                 let relevOptions = currAllOptions.filter(a => a.type && a.type === optionId)
    //                 if(relevOptions && relevOptions.length > 0) {
    //                     optionIdList = relevOptions.map(x => x.id)
    //                 }
    //             }
    //         }

    //         if(optionIdList.length > 0) {
    //             for(let i = 0; i < optionIdList.length; i++) {
    //                 let opt = optionIdList[i]
    //                 for(let [id, ctx] of g2gInfoMapCopy) {
    //                     if(id === relevG2gInfo.id) {
    //                         if(opt.length > 0) {
    //                             if(isAdditionAction === true) {
    //                                 //important to follow the 'A->B equals B->A bidirectional equality rule
    //                                 if(currentPairingsCopy.has(`${id}__${opt}`) || currentPairingsCopy.has(`${opt}__${id}`)) {
    //                                     let correspName = g2gInfoMapCopy.get(opt)?.name ?? "";
    //                                     let errMsg = `Omitting provided association between '${name}' and '${correspName}'. A same or bidirectionally-equal association already exists`;
    //                                     displayQuickMessage(UIMessageType.ERROR_MSG, errMsg);
    //                                     continue;
    //                                 }

    //                                 //add tracker for newly recognized association
    //                                 let setInfo = new Set<string>(((ctx.g2gInfo.targets as string[]) ?? []).concat(opt));
    //                                 ctx.g2gInfo.targets = Array.from(setInfo);
    //                                 currentPairingsCopy.add(`${id}__${opt}`)
    //                             }
    //                             else if(isAdditionAction === false) {
    //                                 //remove tracker for newly recognized association
    //                                 let setInfo = new Set<string>(((ctx.g2gInfo.targets as string[]) ?? []).filter(x => x !== opt))
    //                                 ctx.g2gInfo.targets = Array.from(setInfo); //important that this gets set before the tracker removals below
    //                                 currentPairingsCopy.delete(`${id}__${opt}`);
    //                             }
    //                         }

    //                         break;
    //                     }
    //                 }
    //             }

    //             setCurrentPairings(currentPairingsCopy);
    //             setG2GInfoMap(g2gInfoMapCopy);
    //         }
    //     }
    // }


    // function handleSubmit() {
        // if(!g2gInfoMap || g2gInfoMap.size === 0) {
        //     displayQuickMessage(UIMessageType.ERROR_MSG, `No G2G data to submit`);
        //     return;
        // }

        // let prohibNames = new Set<string>(
        //     [project.name, project._id?.toString() as string]
        //     // .concat(project.clearanceRelationBrands.map(a => a.id))
        //     .concat(projectInterfaceList.map(x => x.name))
        //     .map(a => a.toUpperCase()) 
        // );

        // let g2gInfoCollection = new Array<G2GRelationInfo>();
        // let newCustRuleNames = new Array<string>();

        // let intraNameSet = new Set<string>();
        // let withinNameSet = new Set<string>();
        // let acrossNameSet = new Set<string>();
        // let toAllNameSet = new Set<string>();

        // for(let [id, ctx] of g2gInfoMap) {
        //     if(ctx.g2gInfo.clearanceRelationBrandIntraclass && ctx.g2gInfo.clearanceRelationBrandIntraclass.trim().length > 0){
        //         intraNameSet.add(ctx.g2gInfo.clearanceRelationBrandIntraclass.trim().toUpperCase());
        //     }
        //     if(ctx.g2gInfo.clearanceRelationBrandWithin && ctx.g2gInfo.clearanceRelationBrandWithin.trim().length > 0){
        //         withinNameSet.add(ctx.g2gInfo.clearanceRelationBrandWithin.trim().toUpperCase());
        //     }
        //     if(ctx.g2gInfo.clearanceRelationBrandAcross && ctx.g2gInfo.clearanceRelationBrandAcross.trim().length > 0){
        //         acrossNameSet.add(ctx.g2gInfo.clearanceRelationBrandAcross.trim().toUpperCase());
        //     }
        //     if(ctx.g2gInfo.clearanceRelationBrandToAll && ctx.g2gInfo.clearanceRelationBrandToAll.trim().length > 0){
        //         toAllNameSet.add(ctx.g2gInfo.clearanceRelationBrandToAll.trim().toUpperCase());
        //     }
        // }

        // for(let [id, ctx] of g2gInfoMap) {
        //     let ifaceId = getSectionsFromIdString(ctx.g2gInfo.id)?.data?.ifaceId as string;
        //     if(!ifaceId || (ifaceMapping.has(ifaceId) === false)) {
        //         displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! Could not determine interface ID for group relation info!`);
        //         return;
        //     }

        //     //check if starts with NETCLASS_TO_SELF_CRB_NAME_PREFIX

        //     let intraName = ctx.g2gInfo.clearanceRelationBrandIntraclass.trim().toUpperCase();
        //     if(intraName && intraName.length > 0) {
        //         if(withinNameSet.has(intraName) || acrossNameSet.has(intraName) || toAllNameSet.has(intraName)){
        //             displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! Could not proceed because name intended for 'CLASS_TO_SELF' group relations was also used for another G2G relation type!`);
        //             return;
        //         }
        //     }

        //     let withinName = ctx.g2gInfo.clearanceRelationBrandWithin.trim().toUpperCase();
        //     if(withinName && withinName.length > 0) {
        //         if(intraNameSet.has(withinName) || acrossNameSet.has(withinName) || toAllNameSet.has(withinName)){
        //             displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' relation rule name used for source group '${ctx.name}' was also used in another G2G relation type!`);
        //             return;
        //         }
        //         else if(withinName.startsWith(NETCLASS_TO_SELF_CRB_NAME_PREFIX.toUpperCase()) || prohibNames.has(withinName)){
        //             displayQuickMessage(UIMessageType.ERROR_MSG, `'WITHIN' relation rule name used for source group '${ctx.name}' is prohibited. Please use another name!`);
        //             return;
        //         }
        //     }

        //     let acrossName = ctx.g2gInfo.clearanceRelationBrandAcross.trim().toUpperCase();
        //     if(acrossName && acrossName.length > 0) {
        //         if(intraNameSet.has(acrossName) || withinNameSet.has(acrossName) || toAllNameSet.has(acrossName)){
        //             displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' relation rule name used for source group '${ctx.name}' was also used in another G2G relation type!`);
        //             return;
        //         }
        //         else if(acrossName.startsWith(NETCLASS_TO_SELF_CRB_NAME_PREFIX.toUpperCase()) || prohibNames.has(acrossName)){
        //             displayQuickMessage(UIMessageType.ERROR_MSG, `'ACROSS' relation rule name used for source group '${ctx.name}' is prohibited. Please use another name!`);
        //             return;
        //         }
        //     }

        //     let toAllName = ctx.g2gInfo.clearanceRelationBrandToAll.trim().toUpperCase();
        //     if(toAllName && toAllName.length > 0) {
        //         if(intraNameSet.has(toAllName) || acrossNameSet.has(toAllName) || withinNameSet.has(toAllName)){
        //             displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! Could not proceed because name intended for one of the "TO-ALL" group relations was used for another G2G relation type!`);
        //             return;
        //         }
        //         else if(toAllName.startsWith(NETCLASS_TO_SELF_CRB_NAME_PREFIX.toUpperCase()) || prohibNames.has(toAllName)){
        //             displayQuickMessage(UIMessageType.ERROR_MSG, `DATA ERROR! Could not proceed due to name intended for one of the "TO-ALL" group relations!`);
        //             return;
        //         }
        //     }


        //     if((ctx.g2gInfo.setAcross === true) && ctx.g2gInfo.clearanceRelationBrandAcross && ctx.g2gInfo.clearanceRelationBrandAcross.trim().length > 0){
        //         newCustRuleNames.push(ctx.g2gInfo.clearanceRelationBrandAcross)
        //     }
            
        //     if((ctx.g2gInfo.setWithin === true) && ctx.g2gInfo.clearanceRelationBrandWithin && (ctx.g2gInfo.clearanceRelationBrandWithin.trim().length > 0)) {
        //         newCustRuleNames.push(ctx.g2gInfo.clearanceRelationBrandWithin);
        //     }

        //     ctx.g2gInfo.targets = Array.from(new Set<string>(ctx.g2gInfo.targets ?? [])) //ensure uniqueness!
        //     g2gInfoCollection.push(ctx.g2gInfo);

        // }

        // if(newCustRuleNames.length > 0) {
        //     try { verifyNaming(newCustRuleNames, NamingContentTypeEnum.ARBITRARY_DEFAULT) }
        //     catch(e: any) {
        //         displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
        //         return;
        //     }
        // }

        // if (onFormClosed) {
        //     contextualInfo.value = g2gInfoCollection;
        //     onFormClosed(contextualInfo);
        // }

        // doExitTimeDataReset()
        // if(close){ close() }
    // }

    