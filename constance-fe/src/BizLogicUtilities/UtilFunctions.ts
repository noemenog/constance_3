import axios from "axios";
import { RELATED_DEFAULT_CONSTRAINTS_PROP_NAME, UIViewableProjectPropTypes, NamingContentTypeEnum, ConstraintTypesEnum, CONFIGITEM__Rule_Area_Settings } from "../DataModels/Constants";
import 'react-confirm-alert/src/react-confirm-alert.css';
import { Location } from "react-router-dom";
import { DefaultConstraints, G2GRelationContext, Interface, LayerGroup, LayerGroupSet, Netclass, PackageLayout, Project, ServiceModel } from "../DataModels/ServiceModels";
import { BasicKVP, BasicProperty, ConfigItem, ConstraintValues, PropertyItem, QuickStatus } from "../DataModels/HelperModels";
import { GridApi } from "ag-grid-community";
import rfdc from "rfdc";
import { GridCellKind, GridColumn } from "@glideapps/glide-data-grid";
import { useSpiderStore } from "../DataModels/ZuStore";
import { DisplayError } from "../CommonComponents/ErrorDisplay";
import { GridDropDownOption } from "../CommonComponents/BaseGlideGrid";
import { sort } from "fast-sort";






//============================================
//#region basic utilities
export const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));


export function isResolutionWorseThan1080p(): boolean {
    // Check if the resolution is worse than 1080p
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const minWidth : number = 1920 - 1;
    const minHeight: number = 1080 - 1;
    let res = (screenWidth < minWidth) || (screenHeight < minHeight);
    return res
}


export function isConstraintValuesObject(obj: any): obj is ConstraintValues {
    return (
        typeof obj === 'object'
        && obj !== null
        && obj.id !== null
        && obj.id !== undefined
        && typeof obj.configValue === 'string'
        && typeof obj.defautlValue === 'string'
        && typeof obj.customValue === 'string'
    );
}


export function hasAnyMembers(obj: object) : boolean {
    let res = Object.keys(obj).length > 0;
    return res;
}


export function convertUTCToLocalDateTimeString(utcDateTime: string|Date) : string {
    const utcDate = new Date(utcDateTime);
    const localDate = new Date(utcDate.getTime() - (utcDate.getTimezoneOffset() * 60000));

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const localDateString = localDate.toLocaleString('en-US', options);

    return localDateString;
}


export function removeSubstringFromBeginning(str: string, removalSubstring: string, caseInsensitive : boolean): string {
    let newStr = str;
    if(caseInsensitive) {
        const regex = new RegExp(`^${removalSubstring}`, 'i'); // 'i' flag makes it case-insensitive
        newStr = str.replace(regex, '');
    }
    else {
        if (str.startsWith(removalSubstring)) {
            newStr = str.slice(removalSubstring.length);
        }
    }
    
    return newStr;
}


export function newValueMatchesColumnDataType(value: any, valueKind: GridCellKind, columnElement: GridColumn) {
    if(value === '') { return true; } //probably the value was deleted or set back to empty by user. Carry on....
    if(valueKind && columnElement.icon) {
        if (valueKind === GridCellKind.Boolean) {
            if ((value !== null && value !== undefined) && (value.toString().toLowerCase() === "true" || value.toString().toLowerCase() === "false")) {
                return true;
            } 
            else {
                return false;
            }
        }
        else if (valueKind === GridCellKind.Number) {
            let res = isNumber(value);
            return res;
        }
        else if (valueKind === GridCellKind.Text)  {
            if (value && (typeof value === "string") && (value.length > 0)){
                return true;
            } 
            else {
                return false;
            }
        } 
        else if (valueKind === GridCellKind.Custom)  {
            if (value && (typeof value === "string") && (value.length > 0)){
                return true;
            } 
            else {
                return false;
            }
        } 
        else {
            return true;  //for now, we make an assumption.... 
            //TODO: more validation might come later
        }
    }
}


export function verifyNaming(names: string[], contentType: NamingContentTypeEnum) {   
    //this check should apply to: 
    //      project name, rule area, layer group, layer group set, physical cset, clearance cset, match group, clearance rule
    //      snapshot name, default constraint dataset name, netclass name, interface name, snapshot name, defcon clone name, configured property names
    
    //set defaults
    let mainRegex = /^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/
    let firstOthRegex = /.*[a-zA-Z0-9].*/i;
    let secondOthRegex = /[\(\)\[\]]{2,}/;
    
    let minLength = 2
    let maxLength = 35

    //handle special cases
    if(contentType === NamingContentTypeEnum.PROJECT) {
        maxLength = 28
    }
    else if(contentType === NamingContentTypeEnum.RULE_AREA) {
        mainRegex = /^[A-Za-z0-9\(\[][A-Za-z0-9_\-]*[A-Za-z0-9\)\]]$/
    }
    else if(contentType === NamingContentTypeEnum.NET) {
        mainRegex = /^[A-Za-z0-9\[][A-Za-z0-9_\-\[\]]*[A-Za-z0-9\]]$/
    }
    else if(contentType === NamingContentTypeEnum.PROJECT_PROPERTY) {
        maxLength = 45
    }
    // else if (contentType === NamingContentTypeEnum.RELATION){
    //     maxLength= 32 
    // }
    else if (contentType === NamingContentTypeEnum.ARBITRARY_DEFAULT){
        maxLength= 36 
    }
    else if (contentType === NamingContentTypeEnum.INTERFACE_TEMPLATE){
        maxLength= 45 
    }

    //run tests
    for(let input of names) {
        let mainRegexTestResult = mainRegex.test(input);
        let firstOthRegexTestResult = firstOthRegex.test(input);
        let secondOthRegexTestResult = secondOthRegex.test(input);
        
        if(input.trim().length === 0) {
            throw new Error(`Invalid data provided. Please specify valid non-empty string(s).`)
        }
        if(minLength > input.length) {
            throw new Error(`Invalid data provided. Length of ${contentType.toString()} name is not up to the minimum number of characters expected: ${minLength}`)
        }
        if(maxLength < input.length) {
            throw new Error(`Invalid data provided. ${contentType.toString()} name exceeded the max number of characters allowed: ${maxLength}`)
        }
        if(mainRegexTestResult === false || firstOthRegexTestResult === false || secondOthRegexTestResult === true) {
            throw new Error(`Naming provided for ${contentType.toString()} did not meet expectation. Please revise and retry.`)
        }
    }
}


export function groupBy<K, V>(array: V[], keyfinder: (item: V) => K) {
    return array.reduce((resultMap, item) => {
        let key = keyfinder(item)
        if (!resultMap.has(key)) {
            resultMap.set(key, [item])
        } else {
            resultMap.get(key)?.push(item)
        }
        return resultMap
    }, new Map<K, V[]>())
}


export function rfdcCopy<T>(item: T|T[]) : T|T[] {
    const clone = rfdc({
        proto: true,
        circles: false,
        constructorHandlers: [
            [ RegExp, (o) => new RegExp(o) ],
            // [ ObjectId, (x) => new ObjectId(x) ] //not valid for UI code
        ]
    });
    const cloneResult = clone(item)
    return cloneResult;
}


export function getEnumValuesAsArray(enumType: any) : Set<string>{
    const values = Object.values(enumType).filter((item) => {
        let retVal = isNaN(Number(item));
        return retVal
    });

    return new Set((values as string[]) ?? [])
}

export function getEnumValuesAsMap(enumType: any, upperCaseKeysInsteadOfLowerCase: boolean = false): Map<string, string> {
    const map: Map<string, string> = new Map();
    getEnumValuesAsArray(enumType).forEach(item => {
        if(upperCaseKeysInsteadOfLowerCase) {
            map.set(item.toUpperCase(), item);
        }
        else {
            map.set(item.toLowerCase(), item);
        }
    });

    return map
}


export function convertMapToArray(map: Map<any, any>): Array<{name: any, value: any}> {
    let array = Array.from(map, ([name, value]) => ({ name, value }));
    return array
}


export function getViewableProperties(props: PropertyItem[]|undefined) : PropertyItem[] {
    if(props && props.length > 0) {
        let viewableProps = props.filter(a => UIViewableProjectPropTypes.includes(a.category))
        let sorted = viewableProps?.sort((a, b) => a.displayName.toLowerCase() < b.displayName.toLowerCase() ? -1 : 1);
        return sorted;
    }
    else {
        return []
    }
}


export function getHumanReadableByteSize(bytes: number) {
    var marker = 1024;
    var decimal = 1;
    var kiloBytes = marker; // One Kilobyte is 1024 bytes
    var megaBytes = marker * marker; // One MB is 1024 KB
    var gigaBytes = marker * marker * marker; // One GB is 1024 MB
  
    if(bytes < kiloBytes) return bytes + " Bytes";
    else if(bytes < megaBytes) return(bytes / kiloBytes).toFixed(decimal) + " KB";
    else if(bytes < gigaBytes) return(bytes / megaBytes).toFixed(decimal) + " MB";
    else return(bytes / gigaBytes).toFixed(decimal) + " GB";
}


export function assessAllDefaultConstraintNames (defCon: DefaultConstraints|null): Map<string, string> {
    if(defCon) {
        if(defCon.contextProperties && defCon.contextProperties.length > 0) {
            let prop = defCon.contextProperties.find(a => a.name.toLowerCase() === RELATED_DEFAULT_CONSTRAINTS_PROP_NAME.toLowerCase())
            if(prop && prop.value) {
                let map = new Map<string, string>()
                let items : any[] = (prop as BasicProperty).value;
                if(items && items.length > 0) {
                    for(let i = 0; i < items.length; i++) {
                        map.set(items[i]._id.toString(), items[i].nameIdentifier)
                    }
                }

                map.set(defCon._id, defCon.nameIdentifier)
                return map;
            }
        }
    }
    return new Map<string, string>()
}


export function getXmodSelectableOptions(initConfigs: ConfigItem[], defCons: DefaultConstraints | null) : string[] {
    let raConf : any = initConfigs?.filter(a => a.configName === CONFIGITEM__Rule_Area_Settings)?.at(0)?.configValue ?? undefined;
    let confXmods = new Set<string>(raConf?.xmods ?? [])
    let confXmodsUpperCase = new Set<string>(Array.from(confXmods).map((x: string) => x.toUpperCase()))
    let defconXmodNames = defCons?.constraints?.map(a => a.xmodName) ?? [];
    let defconXmodsFiltered = new Set<string>(defconXmodNames.filter(x => confXmodsUpperCase.has(x.toUpperCase()) === false));
    let uniqueXmods = new Set<string>([...confXmods, ...defconXmodsFiltered]);
    return Array.from(uniqueXmods);
}


export function getDateAppendedName(prefix: string): string {
    const re1 = /\./gi;
    const re2 = /:/gi;
    let date = (new Date()).toISOString().replace(re1, "-").replace(re2, "-")
    let str = `${prefix ?? ''}_${date}`
    return str
}


export function isNotNullOrEmptyOrWS(text: string): boolean {
    let result = (text && (text !== null) && (text.length > 0) && (text.trim().length > 0)) ? true: false;
    return result;
}


export function isCollectionNonEmpty<T extends Array<any>>(collection: T[]): boolean {
    let result = (collection && (collection !== null) && (collection.length > 0)) ? true: false;
    return result;
}


export function isNumber(value: string | number | undefined): boolean {
   let result = ((value != undefined) && (value != null) && (value !== '') && !isNaN(Number(value.toString())));
   return result;
}


export function checkDuplicatesIgnoreCase(values: string[]): boolean {
    if(values && values.length > 0) {
        const lowercaseNames = values.map(word => word.toLowerCase()) ?? [];
        let setSize = new Set(lowercaseNames).size;
        if (setSize !== values.length) {
            return false;
        }
    }
    return true;
}


export function sortByLastUpdatedDate<T extends ServiceModel>(itemList: T[]) {
    if(itemList && itemList.length > 0) {
        let sorted = itemList.sort((a, b) => ((new Date(a.lastUpdatedOn)).getTime()) - ((new Date(b.lastUpdatedOn)).getTime()));
        return sorted
    }
    else {
        return itemList
    }
}


export function getFileExtensionWithoutDot(fileName: string) {
    // Split the filename by the dot
    const parts = fileName.split('.');
    if (parts.length === 1) return '';
    return parts.pop();
}


export function splitByDelimiters(input: string, delimiters: string[]): string[] {
    // Create a regular expression pattern from the delimiters array
    const pattern = new RegExp(delimiters.map(d => `\\${d}`).join('|'), 'g');
    // Split the input string using the pattern
    return input.split(pattern);
}


export function splitIgnoreCase(input: string, delimiter: string): string[] {
    // Create a case-insensitive regular expression for the delimiter
    const regex = new RegExp(delimiter, 'i');
    // Use the split method with the regular expression
    return input.split(regex);
}

//#endregion




//========================================================================================================================================================
//#region env mgmt and backend calls
export async function performBackendCall(url: string, action: string, data: any, isDownloadFileExpected = false, dlFileName = "content_download.zip") {
    try {
        let resp = null;

        let host : string = new URL(url).hostname;

        let baseConf: any = {
            maxContentLength: 2000000000,
            maxBodyLength: 2000000000,
        }

        let formDataConf : any = { 
            responseType: 'blob', 
            headers: { 
                'Content-Type': 'multipart/form-data',
                Host: host,
            }, 
            maxContentLength: 2000000000,
            maxBodyLength: 2000000000
        }

        if (action.toUpperCase() === "GET") {
            if(isDownloadFileExpected && dlFileName.trim().length > 0) {
                resp = await axios.get(url, formDataConf).catch((err: any) => errorFunction(err));
                if(resp) {
                    let url = window.URL.createObjectURL(new Blob([resp.data]));
                    let link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', dlFileName);
                    document.body.appendChild(link);
                    resp.data["payload"] = link
                }
            }
            else {
                resp = await axios.get(url, baseConf).catch((err: any) => errorFunction(err));
            }
        }
        else if (action.toUpperCase() === "POST") {
            if(isDownloadFileExpected && dlFileName.trim().length > 0) {
                resp = await axios.post(url, data, formDataConf).catch((err: any) => errorFunction(err));
                if(resp) {
                    let url = window.URL.createObjectURL(new Blob([resp.data]));
                    let link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', dlFileName);
                    document.body.appendChild(link);
                    resp.data["payload"] = link
                }
            }
            else {
                resp = await axios.post(url, data, baseConf).catch((err: any) => errorFunction(err));
            }
        }
        else if (action.toUpperCase() === "DELETE") {
            resp = await axios.delete(url, { data: data ?? {} }).catch((err: any) => errorFunction(err));
        }

        if (resp && resp.data && resp.data.error && resp.data.error.id) {
            errorFunction(resp.data.error);
            console.error(resp.data.error);
            return [];
        }
        else {
            return resp?.data.payload as any;
        }
    }
    catch (e: any) {
        console.error(e);
    }
}


export async function errorFunction(err: any): Promise<any> {
    if(err?.response?.data && err.response.data instanceof Blob) {
        let errdata = await err.response.data.text()
        err = JSON.parse(errdata)?.error
    }

    if (err.id && err.id.length > 0) {
        DisplayError(err.code, err.severity, err.message);
    }
    else if (err?.response?.data?.error?.id) {
        DisplayError(err.response.data.error.code, err.response.data.error.severity, err.response.data.error.message);
    }
    else {
        if (err.message) {
            DisplayError(err.code ?? '', err.severity ?? '', err.message);
        }
    }
}


export const getEnvContext = () => {
    let procStage = import.meta.env.VITE_STAGE || '';
    let apiUrl = import.meta.env.VITE_API_URL || ''

    let backend = {
        mainAPIUrl: `http://localhost:7000/api/v1`,
        permContext: "LOCAL"
    };

    if ((procStage?.toLowerCase() === "production") || (procStage?.toLowerCase() === "prod")) {
        backend.mainAPIUrl = apiUrl.trim();
        backend.permContext = "PROD";
    }
    else if ((procStage?.toLowerCase() === "development") || (procStage?.toLowerCase() === "dev")) {
        backend.mainAPIUrl = apiUrl.trim();
        backend.permContext = "DEV";
    }
    
    if(backend.mainAPIUrl.length === 0) {
        console.error("ERROR!!!  No URL DEFINED FOR API CALLS !!!!")
    }

    return backend;
}
//#endregion












// export function getSectionsFromIdString(str: string): QuickStatus<{ifaceId: string, channel: number|null, segment: string|null}> {
//     type RetType = QuickStatus<{ifaceId: string, channel: number|null, segment: string|null}>;
//     if(str.trim().length === 0) {
//         let errMsg = `Invalid input presented. System cannot determine ifaceId and channel number`;
//         return {isSuccessful: false, message: errMsg, data: {ifaceId: "", channel: null, segment: null}} as RetType;
//     }
//     else {
//         let res = str.trim().split("::");

//         if(res.length === 1) {
//             return { isSuccessful: true, message: "", data: { ifaceId: res[0] as string, channel: null, segment: null } } as RetType
//         }
//         else if(res.length === 2) {
//             return { isSuccessful: true, message: "", data: { ifaceId: res[0] as string, channel: Number(res[1]), segment: null } } as RetType
//         }
//         else {
//             return { isSuccessful: true, message: "", data: { ifaceId: res[0] as string, channel: Number(res[1]), segment: res[2] } } as RetType
//         }
//     }
// }


// export function getChannelToNameMapping(iface: Interface, g2gCtxList: G2GRelationContext[]) : QuickStatus<Map<number, {g2gId: string, segmentedName: string}[]>> {
//     let map = new Map<number, {g2gId: string, segmentedName: string}[]>();
//     // for(let g2gInfo of g2gCtxList) {
//     //     if(!g2gInfo.channel && !g2gInfo.interfaceId) {
//     //         let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
//     //         return {isSuccessful: false, message: errMsg, data: map} as QuickStatus<Map<number, {g2gId: string, segmentedName: string}[]>>
//     //     }
//     //     else if (g2gInfo.channel && g2gInfo.channel.trim().length > 0) {
//     //         let chNumVal = Number(g2gInfo.channel);
//     //         if(map.has(chNumVal) === false) { map.set(chNumVal, []) }
//     //         let segStr = (g2gInfo.segment && (g2gInfo.segment.trim().length > 0)) ? `_${g2gInfo.segment}` : "";
//     //         let segName = `${iface.name}${chNumVal.toString()}${segStr}`
//     //         let concat = map.get(chNumVal)?.concat([ {key: g2gInfo.id, value: } ]) ?? []
//     //         map.set(chNumVal, concat);
//     //     }
//     //     else if (idSections && (idSections.channel === null) && (idSections.ifaceId.trim().length > 0)) {
//     //         if(includeNonChanelledIfaceSelf) {
//     //             let chNumVal = NaN
//     //             map.set(chNumVal, [{key: g2gInfo.id, value: iface.name} as BasicKVP])
//     //         }
//     //     }
//     // }

//     return {isSuccessful: true, message: '', data: map} as QuickStatus<Map<number, {g2gId: string, segmentedName: string}[]>>
// }






// export function getChannelToNameMapping(iface: Interface, includeNonChanelledIfaceSelf: boolean) : QuickStatus<Map<number, BasicKVP[]>> {
//     let map = new Map<number, BasicKVP[]>();
//     for(let g2gInfo of iface.groupRelationsInfo) {
//         let idSections = getSectionsFromIdString(g2gInfo.id)?.data;
//         if((g2gInfo.id.length === 0) || (idSections && !idSections.channel  && !idSections.ifaceId)) {
//             let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
//             return {isSuccessful: false, message: errMsg, data: map} as QuickStatus<Map<number, BasicKVP[]>>
//         }
//         else if (idSections && (idSections.channel !== null)) {
//             let chNumVal = Number(idSections.channel);
//             if(map.has(chNumVal) === false) { map.set(chNumVal, []) }
//             let segStr = (idSections.segment && (idSections.segment.trim().length > 0)) ? `_${idSections.segment}` : "";
//             let nameVal = `${iface.name}${chNumVal.toString()}${segStr}`
//             let concat = map.get(chNumVal)?.concat([ {key: g2gInfo.id, value: nameVal} ]) ?? []
//             map.set(chNumVal, concat);
//         }
//         else if (idSections && (idSections.channel === null) && (idSections.ifaceId.trim().length > 0)) {
//             if(includeNonChanelledIfaceSelf) {
//                 let chNumVal = NaN
//                 map.set(chNumVal, [{key: g2gInfo.id, value: iface.name} as BasicKVP])
//             }
//         }
//     }






// export function getNetclassToChannelNameMapping(iface: Interface, netclassList: Netclass[], g2gCtxList: G2GRelationContext[]) : QuickStatus<Map<string, {channelName: string, suffix: string}>> {
//     let resultMap = new Map<string, {channelName: string, suffix: string}>();
//     let chToNameMap = new Map<number, BasicKVP>();

//     let ifaceG2GCtx = g2gCtxList.filter(x => x.interfaceId === iface._id?.toString());
//     if(ifaceG2GCtx && ifaceG2GCtx.length > 0) {
//         for(let g2gInfo of ifaceG2GCtx) {
//             if(!g2gInfo.channel && !g2gInfo.interfaceId) {
//                 let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
//                 return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
//             }
//             else if ((!g2gInfo.segment || g2gInfo.segment.trim().length === 0) && (g2gInfo.channel.trim().length > 0) ) {
//                 let chNumVal = Number(g2gInfo.channel);
//                 let name = `${iface.name}${chNumVal.toString()}`;
//                 chToNameMap.set(chNumVal, {key: g2gInfo._id?.toString() as string, value: name} );
//             }
//         }
//     }

//     if(netclassList.some(a => a.interfaceId !== iface._id?.toString())) {
//         let errMsg = "Could not determine netclass channel name. All supplied netclasses must have same interfaceId"
//         return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
//     }

//     for(let netclass of netclassList) {
//         let ncid = netclass._id?.toString() as string
//         if(!netclass.channel || netclass.channel.trim().length === 0) {
//             resultMap.set(ncid, {channelName: "", suffix: netclass.name}); 
//         }
//         else if(isNumber(netclass.channel) === false){
//             let errMsg = `Data error: Could not determine channel for netclass ${netclass.name}. Unexpected non-numeric channel value found`
//             return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
//         }
//         else if (chToNameMap.has(Number(netclass.channel)) === false) {
//             let errMsg = `Data error: Could not determine channel for netclass ${netclass.name}. Related interface does not have such channel ${netclass.channel}`
//             return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
//         }
//         else {
//             let currChannelName : string = chToNameMap.get(Number(netclass.channel))?.value;
//             if (!currChannelName || currChannelName.trim().length === 0) {
//                 let errMsg = `Data error: Could not determine channel for netclass ${netclass.name}. Please check interface data. Interface: ${iface.name}`
//                 return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
//             }
//             let ncRawName = removeSubstringFromBeginning(netclass.name, (currChannelName + "_"), true);
//             resultMap.set(ncid, {channelName: currChannelName, suffix: ncRawName});
//         }
//     }
    
//     return {isSuccessful: true, message: '', data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
// }



//============================================

        // else if (action.toUpperCase() === "POST") {
        //     if(isDownloadFileExpected && dlFileName.trim().length > 0) {
        //         let conf : any = { responseType: 'blob', headers: { 'Content-Type': 'multipart/form-data' } }
        //         resp = await axios.post(url, data, conf).catch((err: any) => errorFunction(err));
        //         if(resp) {
        //             let url = window.URL.createObjectURL(new Blob([resp.data]));
        //             let link = document.createElement('a');
        //             link.href = url;
        //             link.setAttribute('download', dlFileName);
        //             document.body.appendChild(link);
        //             resp.data["payload"] = link
        //         }
        //     }
        //     else {
        //         resp = await axios.post(url, data).catch((err: any) => errorFunction(err));
        //     }
        // }


//===============================================
//No preview env
// else if ((procStage?.toLowerCase() === PREVIEW.toLowerCase()) || (procStage?.toLowerCase() === "pre")) {
//     //backend.mainAPIUrl = `https://constance-pre-BE.apps1-fm-int.icloud.intel.com/api`;
//     backend.permContext = "pre";
// }


// export async function updateUserPerms(context: SpiderStore, project : Project) {
//     if(context.LoggedInUser && context.LoggedInUser.perms.size <= 1) {
//         let awgName = getApproverWGName(project._id);
//         let resultMap: Map<string, string> = await getPermissionsListForCurrentUser(context.LoggedInUser, project, awgName);
//         if (resultMap && resultMap.size > 0) {
//             context.LoggedInUser.perms = resultMap;
//         }
//     }
// }



// export function displayQuickMessage(context: SpiderStore, infoType: UIMessageType, message: string) {
//     if(context && infoType && message){
//         let snkBar = {type: infoType, msg: message} as SnackBarData;
//         context.DisplayQuickMessage(snkBar);

//         if(infoType == UIMessageType.ERROR_MSG) {
//             console.error(message)
//         }
//     }
//     else
//     {
//         console.log(`Message: ${message ?? 'Failed to properly display UI message...'}`);
//     }
// }



// export function verifyNaming(names: string[], errMsgToUse: string = '') {

//     //this check should apply to: 
//     /*
//         project name 
//         rule area
//         layer group
//         layer group set
//         physical cset
//         clearance cset
//         match group
//         clearance rule
//         snapshot name
//         default constraint dataset name
//         netclass name
//         interface name
//         snapshot name
//         defcon clone name
//     */

//     try {
//         let maximumLength = 35;
        
//         for(let input of names) {
//             const regex = new RegExp(BASIC_NAME_VALIDATION_REGEX);
//             let testResult = regex.test(input);
            
//             if(input.trim().length === 0) {
//                 throw new Error(`Invalid data provided. Please specify valid non-empty string(s).`)
//             }
//             if(maximumLength < input.length) {
//                 throw new Error(`Invalid data provided. Value exceeded the max number of characters allowed: ${maximumLength || ''}`)
//             }
//             if(testResult === false) {
//                 if(errMsgToUse && errMsgToUse.trim().length > 0) {
//                     throw new Error(errMsgToUse);
//                 }
//                 else {
//                     throw new Error(`Value specified do not meet proper naming standards. Please verify the information before submitting`)
//                 }
//             } 
//         }
//     }
//     catch(error: any) {
//         throw new Error(`Error: ${error.message}`)
//     }
// }


//=======================================================

 ///^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/;




         // const store = useSpiderStore.getState();
        // let namingConf : any = store?.initConfigs?.filter(a => a.configName === CONFIGITEM__Name_Check_Settings)?.at(0)?.configValue ?? undefined
        // if(!namingConf || !namingConf.regexPattern) {
        //     throw new Error(`Could not find value for config item: '${CONFIGITEM__Name_Check_Settings}'. Check config management system`)
        // }

        // let regexPattern = "^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$"

//TODO: clean this up. remove all instances of "context.MenuCurrentScene = MainScenePagesEnum.NETS" around the project and do it in this function
//perhaps make this a function in sidebar and add the function as a property to store and call it from store:  context.setPageContextInfo(location, key) ???
//TODO: do we need to do SetTimeout for all the sections? for some reqason, some time is needed for this to show up
// setTimeout(function () {
//     context.MenuCurrentScene = MainScenePagesEnum.C2CLAYOUT
//     context.MainTitle = "C2C Layout"
//     context.MainSubtitle = `Manage clearance relations`
// }, 100); 

// export function placePageTitle(context: SpiderStore, location: Location, key: string) {
//     let path = location.pathname;
//     let procStage = import.meta.env.VITE_STAGE ?? "DEV"
    
//     //TODO: This can be configured...
//     if(key.toLowerCase() === "projectlist"){
//         context.MenuCurrentScene = MainScenePagesEnum.ROOT
//         context.MainTitle = "Project List"
//         context.MainSubtitle = `All projects in current '${procStage.toUpperCase()}' environment are listed here. Please select a project to view Details.`
//     }
//     else if(key.toLowerCase() === "projectoverview"){
//         context.MenuCurrentScene = MainScenePagesEnum.PROJECT
//         context.MainTitle = "Project Overview"
//         context.MainSubtitle = `Project Name: [ ${context.Project?.name} ]. General details of selected project are displayed here. Select different tabs to navigate between info categories`
//     }
//     else if(key.toLowerCase() === "projectreports") {
//         context.MenuCurrentScene = MainScenePagesEnum.PROJECT
//         context.MainTitle = "Project Reports"
//         context.MainSubtitle = `Download data for records, analysis, or for import into external systems (Mentor, Cadence...)`
//     }
//     else if(key.toLowerCase() === "projectpermissions") {
//         context.MenuCurrentScene = MainScenePagesEnum.PROJECT
//         context.MainTitle = "Project Permissions"
//         context.MainSubtitle = `Define project team roles. Only members assigned to given role will have permission to perform activities for the role`
//     }

//     //================================================================
//     else if(key.toLowerCase() === "stackup") {
//         context.MenuCurrentScene = MainScenePagesEnum.STACKUP
//         context.MainTitle = "Stackup"
//         context.MainSubtitle = `Define, and/or update project stackup. Note: Changes to thickness may reconfigure layer grouping`
//     }
//     else if(key.toLowerCase() === "layergroups") {
//         context.MenuCurrentScene = MainScenePagesEnum.LAYERGROUPS
//         context.MainTitle = "Layer Groups"
//         context.MainSubtitle = `Group stackup layers as necessary. Layer groups are an abstraction to aid in efficient constraint data entry`
//     }
//     else if(key.toLowerCase() === "ruleareas") {
//         context.MenuCurrentScene = MainScenePagesEnum.RULEAREAS
//         context.MainTitle = "Rule Areas"
//         context.MainSubtitle = `Define, or rename or update rule areas`
//     }
    
//     //================================================================
//     else if(key.toLowerCase() === "defaultconstraints") {
//         context.MenuCurrentScene = MainScenePagesEnum.DEFAULTCONSTRAINTS
//         context.MainTitle = "Default Constraints"
//         context.MainSubtitle = `Upload default constraints '.Vbs' file and generate/manage editable copies of constraint dataset`
//     }

//     //================================================================
//     else if(key.toLowerCase() === "interfaces") {
//         context.MenuCurrentScene = MainScenePagesEnum.INTERFACES
//         context.MainTitle = "Interfaces"
//         context.MainSubtitle = `Manage project interfaces`
//     }
//     else if(key.toLowerCase() === "interfaceoverview") {
//         context.MenuCurrentScene = MainScenePagesEnum.INTERFACES
//         context.MainTitle = "Interface Overview"
//         context.MainSubtitle = `General details of selected interface are displayed here. Select different tabs to navigate between info categories`
//     }
//     else if(key.toLowerCase() === "interfacephysicalrules") {
//         context.MenuCurrentScene = MainScenePagesEnum.INTERFACES
//         context.MainTitle = "Physical Rules"
//         context.MainSubtitle = `Manage physical rules for selected interface`
//     }
//     else if(key.toLowerCase() === "interfaceclearancerules") {
//         context.MenuCurrentScene = MainScenePagesEnum.INTERFACES
//         context.MainTitle = "Clearance Rules"
//         context.MainSubtitle = `Manage clearance rules for selected interface`
//     }
//     else if(key.toLowerCase() === "interfaceshadowvoid") {
//         context.MenuCurrentScene = MainScenePagesEnum.INTERFACES
//         context.MainTitle = "Interfaces"
//         context.MainSubtitle = `Add or remove shadow void data entries for the selected interface`
//     }
//     else if(key.toLowerCase() === "interfacecollaterals") {
//         context.MenuCurrentScene = MainScenePagesEnum.INTERFACES
//         context.MainTitle = "Interfaces"
//         context.MainSubtitle = `Manage interface collaterals (images, PDFs, and other associated content pertaining to interface should be kept here)`
//     }
//     else if(key.toLowerCase() === "interfacenotes") {
//         context.MenuCurrentScene = MainScenePagesEnum.INTERFACES
//         context.MainTitle = "Interfaces"
//         context.MainSubtitle = `Manage project interfaces`
//     }

//     //================================================================
//     else if(key.toLowerCase() === "netlistupload") {
//         context.MenuCurrentScene = MainScenePagesEnum.NETS
//         context.MainTitle = "Upload Nets"
//         context.MainSubtitle = `Upload nets for project`
//     }
//     else if(key.toLowerCase() === "netstats") {
//         context.MenuCurrentScene = MainScenePagesEnum.NETS
//         context.MainTitle = "Net Stats"
//         context.MainSubtitle = `Net quantity and allocation summary`
//     }
//     else if(key.toLowerCase() === "netassignment") {
//         context.MenuCurrentScene = MainScenePagesEnum.NETS
//         context.MainTitle = "Net Assignment"
//         context.MainSubtitle = `Manage allocation nets to netclasses`
//     }
//     else if(key.toLowerCase() === "netdiffpairs") {
//         context.MenuCurrentScene = MainScenePagesEnum.NETS
//         context.MainTitle = "Diff Pairs"
//         context.MainSubtitle = `Manage diff pairs for project`
//     }
//     else if(key.toLowerCase() === "netlengthmatching") {
//         context.MenuCurrentScene = MainScenePagesEnum.NETS
//         context.MainTitle = "Length Matching"
//         context.MainSubtitle = `Manage length-matching net properties`
//     }
//     else if(key.toLowerCase() === "netcustomproperties") {
//         context.MenuCurrentScene = MainScenePagesEnum.NETS
//         context.MainTitle = "Custom Net Properties"
//         context.MainSubtitle = `Manage additional/custom properties for nets`
//     }

//     //================================================================
//     else if(key.toLowerCase() === "c2clayout") {
//         context.MenuCurrentScene = MainScenePagesEnum.C2CLAYOUT
//         context.MainTitle = "C2C Layout"
//         context.MainSubtitle = `Manage clearance relations`
//     }

//     //================================================================
//     else if(key.toLowerCase() === "links") {
//         context.MenuCurrentScene = MainScenePagesEnum.LINKS
//         context.MainTitle = "Links"
//         context.MainSubtitle = `Manage project linkages`
//     }
    

//     //================================================================
//     else if(key.toLowerCase() === "powercapscomponents") {
//         context.MenuCurrentScene = MainScenePagesEnum.POWERINFO
//         context.MainTitle = "Power Components"
//         context.MainSubtitle = `Manage Power Caps Components`
//     }
//     else if(key.toLowerCase() === "powerrails") {
//         context.MenuCurrentScene = MainScenePagesEnum.POWERINFO
//         context.MainTitle = "Power Rails"
//         context.MainSubtitle = `Manage power Rails`
//     }
//     else if(key.toLowerCase() === "powersheets") {
//         context.MenuCurrentScene = MainScenePagesEnum.POWERINFO
//         context.MainTitle = "Power Sheets"
//         context.MainSubtitle = `Manage power sheets`
//     }

    
//     //================================================================
//     else if(key.toLowerCase() === "validations") {
//         context.MenuCurrentScene = MainScenePagesEnum.VALIDATIONS
//         context.MainTitle = "Validations"
//         context.MainSubtitle = `View project validation results`
//     }
//     else if(key.toLowerCase() === "logs") {
//         context.MenuCurrentScene = MainScenePagesEnum.LOGS
//         context.MainTitle = "Logs"
//         context.MainSubtitle = `View logs`
//     }
//     else if(key.toLowerCase() === "faqs") {
//         context.MenuCurrentScene = MainScenePagesEnum.FAQS
//         context.MainTitle = "FAQs"
//         context.MainSubtitle = `View FAQs`
//     } 



//     //================================================================
    
//     else{
//         context.MainTitle = ""
//         context.MainSubtitle = ""
//     }

// }




// export function deepCopy<T>(item: T|T[]) : T|T[] {
//     const str = JSON.stringify(item)
//     const copy = JSON.parse(str) as typeof item;
//     return copy;
// }



//TODO: fill this out based on location - if it is project list then clear all
// export function clearProjectStore(context: SpiderStore) {
//     //TODO: should not be empty
// }







// export function downloadFile(url: string, fileNameWithExtension: string){
//     fetch(url)  //ex: 'http://localhost:3000/download-excel'
//       .then(response => response.blob())
//       .then(blob => {
//         const url = window.URL.createObjectURL(new Blob([blob]));
//         const link = document.createElement('a');
//         link.href = url;
//         link.setAttribute('download', fileNameWithExtension);  //ex: 'ExcelFile.xlsx'
//         document.body.appendChild(link);
//         link.click();
//         link.parentNode?.removeChild(link);
//       });
//   };


// export function errorFunction(err: any): any {
//     // if(err.response.data.error) {
//     //     err  = err.response.data.error
//     // }
//     if (err.id && err.id.length > 0) {
//         DisplayError(err.code, err.severity, err.message);
//     }
//     else if (err?.response?.data?.error?.id) {
//         DisplayError(err.response.data.error.code, err.response.data.error.severity, err.response.data.error.message);
//     }
//     else {
//         if (err.message) {
//             DisplayError(err.code ?? '', err.severity ?? '', err.message);
//         }
//     }
// }



// backend.constanceAPIUrl = `https://constance-mw.app.intel.com/api/v2/development/`;
// backend.constanceAPIUrl = `https://constance-mw.app.intel.com/api/v2/preview/`;
// backend.constanceAPIUrl = `https://constance-mw.app.intel.com/api/v2/production/`;
// constanceAPIUrl: `https://constance-mw.app.intel.com/api/v2/development/`,


//TODO: need to perfect this
// export async function performBackendParallelGetCall(urls: string[], action: string) {
//     try {
//         let resp = null;
        
//         if (action.toUpperCase() === "GET") {
//             resp = await Promise.all(urls.map(a => axios.get(a))).catch((err: any) => errorFunction(err));
//         }
//         else {
//             throw new Error ("ERROR! Only Parallel GET calls are supported/implemented at this time...")
//         }

//         if (resp.data && resp.data.error && resp.data.error.id) {
//             errorFunction(resp.data.error);
//             console.error(resp.data.error);
//             return [];
//         }
//         else {
//             return resp.data.payload as any;
//         }
//     }
//     catch (e: any) {
//         console.error(e);
//     }
// }





// if(resp) {
//     const url = window.URL.createObjectURL(new Blob([resp.data]));
//     const link = document.createElement('a');
//     link.href = url;
//     link.setAttribute('download', zipFileName + ".zip");
//     document.body.appendChild(link);
//     // link.click();
//     // link.remove();

//     resp.data["payload"] = link
// }


//===============================================

// else if(key.toLowerCase() === "clearancerelations") {
    //     context.MenuCurrentScene = MainScenePagesEnum.CONSTRAINTUTILS
    //     context.MainTitle = "Clearance Relations"
    //     context.MainSubtitle = `Define and manage clearance rule names to be used in C2C grid`
    // }
    // else if(key.toLowerCase() === "links") {
    //     context.MenuCurrentScene = MainScenePagesEnum.CONSTRAINTUTILS
    //     context.MainTitle = "Links"
    //     context.MainSubtitle = `Define or update links between interfaces, between netclasses (for physical rules), or between clearance relations (for clearance rules)`
    // }
    // else if(key.toLowerCase() === "matchgroups") {
    //     context.MenuCurrentScene = MainScenePagesEnum.CONSTRAINTUTILS
    //     context.MainTitle = "Match Groups"
    //     context.MainSubtitle = `Create and manage match groups`
    // }