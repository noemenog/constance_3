
import { sort } from "fast-sort";
import { GridDropDownOption } from "../CommonComponents/BaseGlideGrid";
import { ConstraintTypesEnum, PendingProcessActionTypeEnum, ProjectPropertyCategoryEnum, UIMessageType } from "../DataModels/Constants";
import { BasicProperty, ConstraintValues, PollingInfoContext, PropertyItem, QuickStatus, StatusIndicatorItem } from "../DataModels/HelperModels";
import { Netclass, G2GRelationContext, Interface, LayerGroup, LayerGroupSet, PackageLayout, Project } from "../DataModels/ServiceModels";
import { splitByDelimiters, removeSubstringFromBeginning, isNumber, rfdcCopy } from "./UtilFunctions";
import { fetchG2GContextList, fetchNetclassList, fetchProjectDetails } from "./FetchData";
import { useSpiderStore } from "../DataModels/ZuStore";




//#region ============================================ ServiceModel management utils ==========================================================
// ============================================================================================================================================
export function getRelevantProps(project: Project, constraintType: ConstraintTypesEnum) : QuickStatus<Map<string, PropertyItem>> {         
    let relevantProps = new Map<string, PropertyItem>();
    let constrSettings = project?.constraintSettings?.filter(a => a.category && a.category.toLowerCase().trim() === constraintType.toLowerCase()) ?? []
    
    if(!constrSettings || constrSettings.length === 0) {
        let errMsg = `${constraintType} rules' properties/settings were not found for project`;
        return {isSuccessful: false, message: errMsg, data: relevantProps} as QuickStatus<Map<string, PropertyItem>>
    }
    else {
        //SORT Constraint Items according to display_context ID
        constrSettings = sort<PropertyItem>(constrSettings).asc(x => 
            x.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "display_context")?.id?.toUpperCase() ?? ""
        )

        for(let i = 0; i < constrSettings.length; i++) {
            if(constrSettings[i].enabled === true) {
                relevantProps.set(constrSettings[i].name, constrSettings[i])
            }
        }
    }

    return {isSuccessful: true, message: "", data: relevantProps} as QuickStatus<Map<string, PropertyItem>>
}

export function getLGSetOptions(packageLayout: PackageLayout) : GridDropDownOption[] {         
    let opts = new Array<GridDropDownOption>();
    for(let lgSet of packageLayout?.layerGroupSets ?? []) {
        if(lgSet.name && lgSet.id && lgSet.name.length > 0) {
            opts.push({label: lgSet.name, value: lgSet.id} as GridDropDownOption) 
        }
    }
    return opts;
}

export function getLGSetMapping(packageLayout: PackageLayout) : Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}> {      
    let map = new Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>();
    for(let lgSet of packageLayout?.layerGroupSets ?? []) {
        let lgMap = new Map<string, LayerGroup>();
        for(let lg of lgSet.layerGroups) {
            lgMap.set(lg.id, lg)
        }
        map.set(lgSet.id, {lgSetObj: lgSet, lgMapping: lgMap})
    }
    return map;
}


export function getMaxLGCount(packageLayout: PackageLayout): number {         
    let max = 0;
    for(let lgSet of packageLayout?.layerGroupSets ?? []) {
        if(lgSet.layerGroups && lgSet.layerGroups.length > max) {
            max = lgSet.layerGroups.length;
        }
    }
    return max;
}


export function getMostAppropriateConstraintValue(propValElement: ConstraintValues|undefined) {
    if(propValElement) {
        let propValue = propValElement?.customValue || propValElement?.defautlValue || propValElement?.configValue || '';
        return propValue
    }
    return '' 
}
//#endregion







//#region ============================================ channel management ====================================================================
//============================================================================================================================================
export function generateSeqChannelShortString(arr: number[]): string | null {
    if (arr.length === 0) return null;

    // Sort the array
    arr.sort((a, b) => a - b);

    // Check if the array is sequential
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1] + 1) {
            return null; // Not in sequence
        }
    }

    // Produce the string "n1-nx"
    const n1 = arr[0];
    const nx = arr[arr.length - 1];
    return `${n1}-${nx}`;
}


export function getChannelNumArrayFromShortStr(channelRangeSpecified: string) : QuickStatus<number[]>  {
    try {
        const MAX_CHANNEL_COUNT = 30
        const errMsgCore = `Channel Range is not formated as expected. Please make corrections. `
        let errMsgDesc = `Example values: '8' (means 8 only) | '0-8' (means 0 thru 8) | '2:8' (means 2 thru 8) | '3,8,12' (means 3 and 8 and 12) `;
        let resultArray = new Array<number>();
        let hasError = false;

        if(channelRangeSpecified && channelRangeSpecified.trim().length > 0) {
            channelRangeSpecified = channelRangeSpecified.trim();
            
            if(isNumber(channelRangeSpecified)) {
                let num = Math.round(Number(channelRangeSpecified));
                resultArray.push(num);
            }
            else {
                if(channelRangeSpecified.includes(",") || channelRangeSpecified.includes(";")) {
                    let andSplitStr : string[] = splitByDelimiters(channelRangeSpecified, [",", ";"]) ?? []
                    if((andSplitStr.length > 1) && andSplitStr.every(x => isNumber(x.trim()))){
                        andSplitStr.forEach(a => {
                            let andNum = Math.round(Number(a.trim()));
                            resultArray.push(andNum);
                        });
                    }
                    else {
                        hasError = true;
                    }
                }
                else if(channelRangeSpecified.includes("-") || channelRangeSpecified.includes(":")) {
                    let thruSplitStr : string[] = splitByDelimiters(channelRangeSpecified, ["-", ":"]) ?? []
                    if((thruSplitStr.length === 2) && thruSplitStr.every(x => isNumber(x.trim()))){
                        let firstNum = Math.round(Number(thruSplitStr[0].trim()));
                        let secondNum = Math.round(Number(thruSplitStr[1].trim()));
                        if(firstNum < secondNum) {
                            for(let i = firstNum; i <= secondNum; i++) {
                                resultArray.push(i);
                            }
                        }
                        else {
                            hasError = true;
                        }
                    }
                    else {
                        hasError = true;
                    }
                }
                else {
                    hasError = true;
                }
            }
        }

        if(resultArray.length > MAX_CHANNEL_COUNT) {
            errMsgDesc = `Max number of channels allowed is ${MAX_CHANNEL_COUNT} `
            hasError = true;
        }

        if(hasError) {
            return { isSuccessful: false, message: (errMsgCore + errMsgDesc), data: [] } as QuickStatus<number[]> 
        }
        else {
            return { isSuccessful: true, message: '', data: resultArray } as QuickStatus<number[]> 
        }

    }
    catch(err: any) {
        return { isSuccessful: false, message: `Could not process the specified channel range. ${err.message}`, data: [] } as QuickStatus<number[]> ;
    }
}


export function getNetclassToChannelNameMapping(iface: Interface, netclassList: Netclass[], g2gCtxList: G2GRelationContext[]) : QuickStatus<Map<string, {channelName: string, suffix: string}>> {
    let resultMap = new Map<string, {channelName: string, suffix: string}>();
    let chToNameMap = new Map<number, string>();

    let ifaceG2GCtx = g2gCtxList.filter(x => x.interfaceId === iface._id?.toString());
    if(ifaceG2GCtx && ifaceG2GCtx.length > 0) {
        for(let g2gInfo of ifaceG2GCtx) {
            if(!g2gInfo.channel && !g2gInfo.interfaceId) {
                let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
                return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
            }
            else if ((!g2gInfo.segment || g2gInfo.segment.trim().length === 0) && (g2gInfo.channel.trim().length > 0) ) {
                let chNumVal = Number(g2gInfo.channel);
                let name = `${iface.name}${chNumVal.toString()}`;
                chToNameMap.set(chNumVal, name);
            }
        }
    }

    if(netclassList.some(a => a.interfaceId !== iface._id?.toString())) {
        let errMsg = "Could not determine netclass channel name. All supplied netclasses must have same interfaceId"
        return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
    }

    for(let netclass of netclassList) {
        let ncid = netclass._id?.toString() as string
        if(!netclass.channel || netclass.channel.trim().length === 0) {
            resultMap.set(ncid, {channelName: "", suffix: netclass.name}); 
        }
        else if(isNumber(netclass.channel) === false){
            let errMsg = `Data error: Could not determine channel for netclass ${netclass.name}. Unexpected non-numeric channel value found`
            return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
        }
        else if (chToNameMap.has(Number(netclass.channel)) === false) {
            let errMsg = `Data error: Could not determine channel for netclass ${netclass.name}. Related interface does not have such channel ${netclass.channel}`
            return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
        }
        else {
            let currChannelName = chToNameMap.get(Number(netclass.channel));
            if (!currChannelName || currChannelName.trim().length === 0) {
                let errMsg = `Data error: Could not determine channel for netclass ${netclass.name}. Please check interface data. Interface: ${iface.name}`
                return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
            }
            let ncRawName = removeSubstringFromBeginning(netclass.name, (currChannelName + "_"), true);
            resultMap.set(ncid, {channelName: currChannelName, suffix: ncRawName});
        }
    }
    
    return {isSuccessful: true, message: '', data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
}



export async function getChannelRangeAndTemplateBasedNetclassListForInterface(iface: Interface) 
    : Promise<QuickStatus<{focusNetclasses: Netclass[], channelRangeStr: string, completeNetclassList: Netclass[]}>> {
    let subsetNCArray : Netclass[] = [];
    let errMsg = "";
    let channelRangeStrValue = '';
    let firstChannelNumStr = '';

    let g2gList = await fetchG2GContextList(iface.projectId, iface._id?.toString())
    if(g2gList && g2gList.length > 0) {
        let channelSet = new Set<number>();
        for(let g2g of g2gList) {
            if (g2g.channel && isNumber(g2g.channel) && g2g.channel.trim().length > 0) {
                channelSet.add(Number(g2g.channel));
            }
        }
        if(channelSet.size > 0) {
            let channelsSorted = Array.from(channelSet).sort();
            let rangeRes = generateSeqChannelShortString(channelsSorted);
            if(rangeRes) {
                channelRangeStrValue = rangeRes;
            }
            else {
                channelRangeStrValue = channelsSorted.map(a => a.toString()).sort().join(",")
            }
            firstChannelNumStr = channelsSorted[0].toString().trim();
        }
    } 
    
    //handle netclasses - with channel consideration
    let fullNCList = await fetchNetclassList(iface.projectId)
    fullNCList = fullNCList.filter(a => (a.interfaceId === (iface._id.toString() as string)));  //Important!

    if(!fullNCList || fullNCList.length === 0) {
        errMsg = `Error scenario: Source interface must have at least one netclass!`;
    }
    else {
        let fullNetclassListCopy = rfdcCopy<Netclass>(fullNCList) as Netclass[];
        
        if(!channelRangeStrValue || channelRangeStrValue.trim().length === 0) {
            subsetNCArray = fullNetclassListCopy;
        }
        else {
            let firstSet = fullNetclassListCopy.filter(a => a.channel.trim() === firstChannelNumStr);
            let ncNameInfoColl = getNetclassToChannelNameMapping(iface, [firstSet[0]], g2gList)?.data?.values() ?? [];
            let chPrefix : string = Array.from(ncNameInfoColl)?.at(0)?.channelName || '';
            
            if(!firstChannelNumStr || firstChannelNumStr.length === 0 || !chPrefix || chPrefix.length === 0){
                errMsg = "Failed to determine netclass information for intended interface. Interface update is not possible";
            }
            else {
                for(let x = 0; x < firstSet.length; x++){
                    let netclass = firstSet[x]; //NOTE: we leave the '_id' intact  - we may use it to know which set the copy comes from
                    if(netclass.name.trim().toUpperCase().startsWith(chPrefix.trim().toUpperCase())) {
                        netclass.name = removeSubstringFromBeginning(netclass.name, (chPrefix + "_"), true);
                        netclass.name = netclass.name.replace(/^_+/, '');  //remove preceeding instances of underscore
                    }
                    subsetNCArray.push(netclass)
                }
            }
        }
    }

    let isOK = (errMsg.trim().length > 0) ? false : true;
    let focusNCArr = rfdcCopy<Netclass>(subsetNCArray) as Netclass[];  //Important - there is a reason for this. for InterfaceCopy scenario
    let finalData = {focusNetclasses: focusNCArr, channelRangeStr: channelRangeStrValue, completeNetclassList: fullNCList}

    return {isSuccessful: isOK, message: errMsg, data: finalData} as QuickStatus<{focusNetclasses: Netclass[], channelRangeStr: string, completeNetclassList: Netclass[]}>

}
//#endregion






export async function fetcher(projectId: string, infoCtx : PollingInfoContext) {
    if(!projectId || projectId.trim().length === 0 || !infoCtx?.type) {
        let err = "ERROR: polling context is invalid!";
        console.error(err);
        alert(err);
    }

    let store = useSpiderStore.getState(); 
    const proj: Project = await fetchProjectDetails(projectId, true);
    let pendingProc = proj?.associatedProperties?.find(a => (
        a.category === ProjectPropertyCategoryEnum.PENDING_PROCESSES && a.name === ProjectPropertyCategoryEnum.PENDING_PROCESSES))
    
    if(pendingProc && pendingProc.value && pendingProc.value.length > 0) {
        let sii : StatusIndicatorItem = pendingProc.value.find((x: StatusIndicatorItem) => x.title === infoCtx.type)
        if(sii) {
            if(sii.isOk === false) {
                store.cancelLoadingSpinnerCtx();
                store.setIsLoadingBackdropEnabled(false)
                store.displayQuickMessage(UIMessageType.ERROR_MSG, infoCtx.messageOnError + ` --- ${sii.message}.`)
                infoCtx.setStateChange(false)
            }
            else if(sii.isProcessing === true) {
                store.displayQuickMessage(UIMessageType.INFO_MSG, infoCtx.mainMessageOnProc)
                if(infoCtx.setBackdropBlocker === true) {
                    store.setIsLoadingBackdropEnabled(true);
                }
                store.setLoadingSpinnerCtx({enabled: true, text: infoCtx.spinnerMessageOnProc})
            }
            else {
                const endTime = performance.now();
                let procStartTime = infoCtx.getStartTime();
                let timetaken = (procStartTime && procStartTime > 0) ? (Math.floor((endTime - procStartTime) / 1000)).toString() : null
                store.cancelLoadingSpinnerCtx();
                store.setIsLoadingBackdropEnabled(false)
                infoCtx.actionOnCompletion();
                store.displayQuickMessage(UIMessageType.SUCCESS_MSG, infoCtx.messageOnCompletion + (timetaken ? ` Time Taken: ${timetaken} Seconds` : ''), 7000)
                infoCtx.setStateChange(false)
            }
        }
        else {
            infoCtx.setStateChange(false)
        }
    }
    else {
        infoCtx.setStateChange(false)
    }
}
