import * as React from 'react';
import { Autocomplete, Box, Checkbox, Chip, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, Switch, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { Cancel, Check, CheckBoxOutlineBlankOutlined, Height, RadioButtonUncheckedOutlined, Thunderstorm } from '@mui/icons-material';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { BASIC_NAME_VALIDATION_REGEX, NamingContentTypeEnum, SPECIAL_BLUE_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BasicKVP, DisplayOption } from '../DataModels/HelperModels';
import { useSpiderStore } from '../DataModels/ZuStore';
import { G2GRelationContext, TargetSetType } from '../DataModels/ServiceModels';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { groupBy, rfdcCopy, verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { MultiTextEntryField } from '../CommonComponents/MultiTextEntryField';
import { sort } from 'fast-sort';
import AsciiTextComp from '../CommonComponents/AsciiText';
import { SpButton } from '../CommonComponents/SimplePieces';





export interface G2GTargetMgmtDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (contextualInfo: BasicKVP) => void,
    title: string,
    inputG2G: G2GRelationContext,
    g2gIdToNameMap: Map<string, string>,
    rowIndex: number, 
    origKnownNames: Set<string>,
    crbIdToNameMap: Map<string, string>,
    onGetTargetOptions: (focusG2G: G2GRelationContext) => DisplayOption[]
    onTargetChangeAction: (focusG2G: G2GRelationContext, rowIndex: number, targetSet: TargetSetType[], index: number) => Promise<G2GRelationContext|undefined>,
    verifyG2gClearanceNaming: (g2gInfo: G2GRelationContext) => boolean,
    contextualInfo: BasicKVP
}

const G2GTargetMgmtDialog: React.FC<G2GTargetMgmtDialogProps> = ({ title, opened, close, onFormClosed, onGetTargetOptions, onTargetChangeAction, 
    verifyG2gClearanceNaming, inputG2G, g2gIdToNameMap, rowIndex, origKnownNames, crbIdToNameMap, contextualInfo}) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [focusG2G, setFocusG2G] = useState<G2GRelationContext>(inputG2G);
    const [nameErrorMap, setNameErrorMap] = useState<Map<number, string>>(new Map());
    const [tgtOptionsMap, setTgtOptionsMap] = useState<Map<number, DisplayOption[]>>(new Map());

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);

    const containerRef = useRef<HTMLElement>(null);  //important!



    useEffect(() => {
        let map = new Map<number, DisplayOption[]>()
        if(focusG2G.across && focusG2G.across.length > 0) {
            for(let i = 0; i < focusG2G.across.length; i++) {
                let opts = getTargetSelectableOptions(i) ?? [];
                map.set(i, opts);
            }
            setTgtOptionsMap(map);
        }
    }, [focusG2G]);



    function onTargetSetNamesAdded(items: DisplayOption[]): void {    
        let newTgtSetArr = new Array<TargetSetType>();
        if(items && items.length > 0) {
            let existingNames = focusG2G.across.map(a => a.clearanceRelationBrandId.toLowerCase().trim())
            let checkRes = items.some(a => existingNames.includes(a.label.toLowerCase().trim()))
            if(checkRes === true) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `One or more specified rule name(s) already exist. Duplicates are not allowed`);
                return;
            }

            let itemNames = items.filter(a => (a.label && a.label.trim().length > 0)).map(a => a.label.trim())
            try { verifyNaming(itemNames, NamingContentTypeEnum.RELATION) }
            catch(e: any){
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }

            for(let i = 0; i < itemNames.length; i++) {
                let tgtSet: TargetSetType = {
                    enabled: true,
                    clearanceRelationBrandId: itemNames[i].trim(),
                    targets: []
                }
                newTgtSetArr.push(tgtSet)
            }
            let g2gCopy = rfdcCopy<G2GRelationContext>(focusG2G) as G2GRelationContext
            g2gCopy.across = g2gCopy.across.concat(newTgtSetArr);
            setFocusG2G(g2gCopy);
        }
    }



    function onTargetSetRemovalAction(event: any, index: number): void {
        if(focusG2G.across && focusG2G.across.length > 0) {
            let g2gCopy = rfdcCopy<G2GRelationContext>(focusG2G) as G2GRelationContext
            g2gCopy.across.splice(index, 1);  //remove in place
            setFocusG2G(g2gCopy);
        }
    }


    function onTargetSetNameChange(event: any, value: string|null, index: number) {
        if(focusG2G.across && focusG2G.across.length > 0) {
            let g2gCopy = rfdcCopy<G2GRelationContext>(focusG2G) as G2GRelationContext
            g2gCopy.across[index].clearanceRelationBrandId = value ?? "";
            setFocusG2G(g2gCopy);
            
            if(value && value.trim().length) {
                try { 
                    verifyNaming([value], NamingContentTypeEnum.RELATION);
                    
                    //else if no error
                    if(nameErrorMap.has(index)) {
                        let nemCopy = rfdcCopy<Map<number, string>>(nameErrorMap) as Map<number, string>
                        nemCopy.delete(index);
                        setNameErrorMap(nemCopy);
                    }
                }
                catch(e: any){
                    //if there is naming error
                    let nemCopy = rfdcCopy<Map<number, string>>(nameErrorMap) as Map<number, string>
                    nemCopy.set(index, e.message);
                    setNameErrorMap(nemCopy);
                }
            }
        }
    }

    
    function getAllCurrentlyKnownTargetNames(): readonly string[] {
        let currNames = new Set<string>(focusG2G.across.map(a => a.clearanceRelationBrandId.trim().toUpperCase()) ?? [])
        let filteredNameList = Array.from(origKnownNames).filter(a => (currNames.has(a.trim().toUpperCase()) === false));
        filteredNameList = filteredNameList.map(x => (crbIdToNameMap.get(x) ?? x))
        let sortedNames = sort(filteredNameList).asc(a => a.toUpperCase())
        return sortedNames;
    }



    function getTargetSelectableOptions(index: number) : DisplayOption[]{         
        let options = new Array<DisplayOption>();
        if(onGetTargetOptions) {
            options = onGetTargetOptions(focusG2G);
        }

        for(let i = 0; i < focusG2G.across.length; i++) {
            let set = new Set<string>(focusG2G.across[i].targets ?? [])
            options = options.filter(a => ((set.has(a.id) === false) && set.has(a.label) === false))
        }
        return options;
    }



    async function onTargetElementAction(event: any, isAdditionAction: boolean, optionId: string, index: number) {
        let g2gCopy = rfdcCopy<G2GRelationContext>(focusG2G) as G2GRelationContext

        if (optionId === "CLEAR_ALL" && isAdditionAction === false) {
            g2gCopy.across[index].targets = [];
        }
        else {
            if(isAdditionAction) {
                g2gCopy.across[index].targets = g2gCopy.across[index].targets.concat(optionId)
            }
            else {
                g2gCopy.across[index].targets = g2gCopy.across[index].targets.filter(x => ((x !== optionId) && (x !== (g2gIdToNameMap.get(optionId) ?? ""))))
            }
        }
        
        if(onTargetChangeAction) {
            let retG2G = await onTargetChangeAction(focusG2G, rowIndex, g2gCopy.across, index);
            if(retG2G) {   
                g2gCopy.across = retG2G.across;
                setFocusG2G(g2gCopy);
            }
        }
    }



    function handleSubmit() {
        if(focusG2G.across.length > 1) {
            if(focusG2G.across.every(x => x.clearanceRelationBrandId.trim().length > 0) === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG,`A name is required for all target group elements!`)
                return 
            }
        }

        let names = focusG2G.across.map(x => x.clearanceRelationBrandId.trim()).filter(x => x.trim().length > 0) ?? [];
        try { verifyNaming(names, NamingContentTypeEnum.ARBITRARY_DEFAULT) }  //could be a guid/mongo-Id
        catch(e: any){
            displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
            return;
        }

        let valRes = verifyG2gClearanceNaming(focusG2G)
        if(valRes === false) {
            return;
        }

        let map = new Map<number, Set<string>>();
        for(let i = 0; i < focusG2G.across.length; i++) {
            if(nameErrorMap.has(i)) {
                let errName = crbIdToNameMap.get(focusG2G.across[i].clearanceRelationBrandId.trim()) ?? focusG2G.across[i].clearanceRelationBrandId
                displayQuickMessage(UIMessageType.ERROR_MSG,`Error detected for item named ${errName}. ${nameErrorMap.get(i)} --- Please make corrections!`)
                return 
            }
            else {
                map.set(i, new Set<string>(focusG2G.across[i].targets?.map(x => x.trim()?.toUpperCase()) ?? []));
            }
        }

        for(let [keyIndex, tgtEntries] of map) {
            if(tgtEntries && tgtEntries.size > 0) {
                
                let tgtEntriesArr = Array.from(tgtEntries.values());
                for(let t = 0; t < tgtEntriesArr.length; t++) {

                    for(let [innerKeyIndex, innerTgtEntries] of map) {
                        if(keyIndex !== innerKeyIndex) {
                            if(innerTgtEntries && innerTgtEntries.has(tgtEntriesArr[t])) {
                                displayQuickMessage(UIMessageType.ERROR_MSG,`Invalid Data. A target group element was found in another target set. Same target item cannot be in multiple sets!`)
                                return 
                            }
                        }
                    }
                }
            }
        }


        if (onFormClosed) {
            contextualInfo.value = focusG2G;
            onFormClosed(contextualInfo);
        }
       
        setNameErrorMap(new Map());
        setTgtOptionsMap(new Map());
        if(close){ close() }
    }

    
    function handleCancel() {
        if (onFormClosed) {
            contextualInfo.value = null;
            onFormClosed(contextualInfo);
        }
        setNameErrorMap(new Map());
        setTgtOptionsMap(new Map());
        if(close){ close() }
    };

    
    const asciiContentCtx : {asciiInfo: any, mapKey: any} = useMemo(() => {
        let asciiInfo = new Map<string, number>([
            ['Doh', 3],
            ['Broadway KB', 9],
            ['Cybermedium', 9],
            ['Dot Matrix', 4]
        ])
        let quickRand = Math.floor(Math.random() * asciiInfo.size);
        let mapKey = [...asciiInfo.keys()].at(quickRand) as any
        return {asciiInfo: asciiInfo, mapKey: mapKey}
    }, []);




    return (
        <Box>
            <Modal 
                opened={opened as boolean}
                onClose={handleCancel} 
                centered
                closeOnClickOutside={false}
                closeOnEscape={false}
                // size="calc(100vw - 3rem)"
                size="auto"
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 4,
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
                                labelText={`Add New Target Group (comma separated)`}
                                onItemAdded={(items: DisplayOption[]) => onTargetSetNamesAdded(items)}
                                regexForValidation={BASIC_NAME_VALIDATION_REGEX} 
                                textFieldStyle={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, width: 1000}}
                                addButtonStyle={{ fontSize: 27}}
                            />

                            <Divider sx={{mt: 3, mb: 3, backgroundColor: colors.greenAccent[400]}}/>

                            <Box sx={{padding: 1}}>
                                <Box key={`box-srll`} style={{ height: "60vh", maxHeight: "60vh", overflowY: "scroll" }}>
                                    <Table>
                                        <TableBody sx={{ overflowY: "scroll" }}> 
                                            {(focusG2G && focusG2G.across && focusG2G.across.length > 0)
                                            ?
                                                <Fragment>
                                                    {(focusG2G.across ?? []).map((tgtSet: TargetSetType, tgtSetIndexNum: number) => (
                                                        <TableRow key={`lnk-tr-${tgtSetIndexNum}`} sx={{height: 44 }}>
                                                        
                                                            <TableCell size="small" sx={{ height: 22, borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 40, width: "2%", padding: 0, textAlign: "center" }}>
                                                                <Typography sx={{ ml: .5, mr: .5, mt: 0, mb: 0, padding: 0, color: SPECIAL_BLUE_COLOR}}>{tgtSetIndexNum + 1}</Typography>
                                                            </TableCell>

                                                            <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 55, width: "2%", maxWidth: 55, padding: 0, textAlign: "center" }}>
                                                                <Tooltip placement="top" title={`Remove target set`}>
                                                                    <span>
                                                                        <IconButton size="small" onClick={(e) => onTargetSetRemovalAction(e, tgtSetIndexNum)}>
                                                                            <Cancel sx={{ height: 22, padding: 0, color: SPECIAL_RED_COLOR }} />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            </TableCell>

                                                            <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 40, width: "15%", padding: 1, textAlign: "center" }}>
                                                                <Box sx={{ padding: 1, overflowX: "hidden"}}>
                                                                    <Autocomplete
                                                                        value={(tgtSet.clearanceRelationBrandId && tgtSet.clearanceRelationBrandId.trim().length > 0) 
                                                                            ? crbIdToNameMap.get(tgtSet.clearanceRelationBrandId) ?? tgtSet.clearanceRelationBrandId
                                                                            : ""
                                                                        }
                                                                        onChange={(event, value, reason, details) => onTargetSetNameChange(event, value, tgtSetIndexNum)}
                                                                        key="tgt-name-sel-CB"
                                                                        freeSolo={true}
                                                                        filterSelectedOptions={true}
                                                                        disablePortal
                                                                        disableListWrap
                                                                        disabled={false} 
                                                                        size="small"
                                                                        id="tgt-name-sel-cb"
                                                                        options={ getAllCurrentlyKnownTargetNames()}
                                                                        renderInput={(params) => <TextField 
                                                                            {...params} 
                                                                            label={"Across Rule Name"}
                                                                            size="small"
                                                                            onChange={(event) => onTargetSetNameChange(event, event?.target?.value, tgtSetIndexNum)}
                                                                            sx={{ fieldset : { borderColor: SPECIAL_DARK_GOLD_COLOR } }}
                                                                            error={nameErrorMap.has(tgtSetIndexNum)}
                                                                            helperText={nameErrorMap.has(tgtSetIndexNum) ? nameErrorMap.get(tgtSetIndexNum) : ""}
                                                                        />}
                                                                    />        
                                                                </Box>
                                                            </TableCell>

                                                            <TableCell size="small" sx={{ borderRight: .4, borderRightColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR, borderBottomColor: undefined, minWidth: 80, padding: 1, textAlign: "center" }}>
                                                                <Box sx={{ padding: 1, overflowX: "hidden"}}>
                                                                    <Autocomplete
                                                                        multiple={true}
                                                                        id="chkbox-tags-linkage"
                                                                        disableCloseOnSelect
                                                                        size="small"
                                                                        sx={{ }}
                                                                        disabled={false}
                                                                        value={ tgtSet.targets?.map(x => (
                                                                            {
                                                                                id: x, 
                                                                                label: (g2gIdToNameMap.get(x) ?? x)
                                                                            }
                                                                        ) as DisplayOption) ?? []} 
                                                                        options={tgtOptionsMap.get(tgtSetIndexNum) ?? []}
                                                                        groupBy={ undefined }
                                                                        getOptionLabel={(option: DisplayOption) => option.label}
                                                                        onChange={(event, value, reason, details) => {
                                                                            if(value && value.length === 0 && reason.toLowerCase() === "clear") {
                                                                                onTargetElementAction(event, false, "CLEAR_ALL", tgtSetIndexNum)
                                                                            }
                                                                        }}
                                                                        renderGroup={(params) => (
                                                                            <Fragment key={params.key}>
                                                                                <ListItemButton
                                                                                    onClick={(event) => onTargetElementAction(event, true, params.group, tgtSetIndexNum)} 
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
                                                                                        onChange={(event, checked) => onTargetElementAction(event, checked, option.id, tgtSetIndexNum)} 
                                                                                    />
                                                                                    <Typography sx={{ fontSize:12 }} onClick={(event) => onTargetElementAction(event, true, option.id, tgtSetIndexNum)} >
                                                                                        {option.label}
                                                                                    </Typography>
                                                                                </ListItem>
                                                                            );
                                                                        }}
                                                                        renderInput={(params: any) => (
                                                                            <TextField {...params} 
                                                                                label={ "Clearance Linked Elements"}
                                                                                size="small" 
                                                                                placeholder={undefined}
                                                                            />
                                                                        )}
                                                                        renderTags={(value, getTagProps) =>
                                                                            value.sort((a, b) => a.label < b.label ? -1 : 1).map((option, index) => (
                                                                                <Chip
                                                                                    {...getTagProps({ index })} //the name tgtSetIndexNum is used above, so that it doesnt clash with this "index" variable!!!
                                                                                    key={`chp-${index}`}
                                                                                    label={option.label}
                                                                                    onDelete={(event) => onTargetElementAction(event, false, option.id, tgtSetIndexNum)}
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

                                                        </TableRow>
                                                    ))}
                                                </Fragment>
                                            : <Box sx={{mt:20, ml: 5}}>
                                                <AsciiTextComp 
                                                    text={`No target group(s) assigned to source group...`} 
                                                    font={asciiContentCtx.mapKey} 
                                                    fontSize={asciiContentCtx.asciiInfo.get(asciiContentCtx.mapKey) as number}>
                                                </AsciiTextComp>
                                              </Box>
                                            }

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
                            label="Cancel" 
                        />

                        <SpButton
                            intent="plain"
                            onClick={handleSubmit}
                            type="submit"
                            startIcon={<Check />}
                            sx={{ml: 1, mt: .5, height: 32, width:200 }}
                            label="Submit" 
                            disabled={false} 
                        />
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


export default G2GTargetMgmtDialog













// if(value && g2gCopy.across.some((x, iterIndex, arr) => (
//     (iterIndex !== index) 
//         && x.clearanceRelationBrandId 
//              && (
//                 (x.clearanceRelationBrandId.trim().toUpperCase() === value.trim().toUpperCase())
//                 || ((crbIdToNameMap.get(x.clearanceRelationBrandId.trim().toUpperCase()) ?? x.clearanceRelationBrandId.trim().toUpperCase()) === (crbIdToNameMap.get(value.trim().toUpperCase()) ?? value.trim().toUpperCase()))
//              )
// ))) {
//     let nemCopy = rfdcCopy<Map<number, string>>(nameErrorMap) as Map<number, string>
//     nemCopy.set(index, "Duplicate rule name is not allowed!");
//     setNameErrorMap(nemCopy);
// }
// else {
//     if(nameErrorMap.has(index)) {
//         let nemCopy = rfdcCopy<Map<number, string>>(nameErrorMap) as Map<number, string>
//         nemCopy.delete(index);
//         setNameErrorMap(nemCopy);
//     }
// }


    
// const origKnownNames : string[] = useMemo(() => {
    //     let nameList = new Array<string>();
    //     for(let [g2gId, g2g] of g2gContextMap) {
    //         if(g2g.across && g2g.across.length > 0) {
    //             for(let item of g2g.across) {
    //                 let name = g2gIdToNameMap.get(item.clearanceRelationBrandId) ?? item.clearanceRelationBrandId
    //                 nameList.push(name);
    //             }
    //         }
    //     }
    //     return nameList
    // }, []);







// for(let othK of otherKeys) {
//     if((map.get(othK) as Set<string>).has(tgt.trim().toUpperCase())) {
//         displayQuickMessage(UIMessageType.ERROR_MSG,`Invalid Data. Same target group was found in multiple target sets. Cannot proceed....`)
//         return 
//     }
// }





        // let sortedOptions = sort(options).asc([a => a.type, a => a.label]);



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