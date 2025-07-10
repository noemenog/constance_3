import axios from "axios";
import 'react-confirm-alert/src/react-confirm-alert.css';
import { Location } from "react-router-dom";
import { ServiceModel } from "../DataModels/ServiceModels";
import { BasicKVP, BasicProperty, ConfigItem, ConstraintValues, PropertyItem, QuickStatus } from "../DataModels/HelperModels";
import { GridApi } from "ag-grid-community";
import rfdc from "rfdc";
import { GridCellKind, GridColumn } from "@glideapps/glide-data-grid";
import { DisplayError } from "../CommonComponents/ErrorDisplay";
import { sort } from "fast-sort";
import { NamingContentTypeEnum } from "../DataModels/Constants";






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
    //set defaults
    let mainRegex = /^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/
    let firstOthRegex = /.*[a-zA-Z0-9].*/i;
    let secondOthRegex = /[\(\)\[\]]{2,}/;
    
    let minLength = 2
    let maxLength = 35

    //handle special cases
    if(contentType === NamingContentTypeEnum.APPINFO) {
        maxLength = 28
    }
    else if (contentType === NamingContentTypeEnum.ARBITRARY_DEFAULT){
        maxLength= 36 
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
        mainAPIUrl: `http://localhost:7000/api/v3`,
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






