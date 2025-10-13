import axios, { AxiosRequestConfig } from "axios";
import { ServiceModel } from "../Models/ServiceModels";
import { PropertyItem, QuickStatus } from "../Models/HelperModels";
import { NamingContentTypeEnum } from "../Models/Constants";
import { ObjectId } from "mongodb";
import https from 'https';
import rfdc from "rfdc";
import fs from 'fs-extra'
import path from "path";






export function getRegexFromFilterTextString(searchText: string, errorOnCheck : boolean = true, caseInsensitive : boolean = true) : RegExp {
    let regex = new RegExp("");
    
    function situateAndEscapeCharacters(input: string): string {
        let str = input.replace(/[+?^${}()|[\]\\]/g, '\\$&');
        str = str.replaceAll("*", "(.*)").trim();
        return str;
    }

    try {
        let regexStr = `^${searchText}`; //set default value...
        let checkSetMin = ['<', '>', '!', '='];
        let checkSetFull = checkSetMin.concat(['*']);

        //Important - Order matters here!!
        if(searchText.startsWith("<>*") && searchText.endsWith("*")) {
            // Not Contains:
            //      <>*jupiter_rising*
            let rem1 = removeSubstringFromBeginning(searchText, "<>*", true);
            let rem2 = removeSubstringFromEnd(rem1, "*", true)
            if(checkSetFull.some(c => rem2.trim().startsWith(c)) || checkSetFull.some(x => rem2.trim().endsWith(x))) {
                if(errorOnCheck) {
                    throw new Error();
                }
            }
            let fintext = situateAndEscapeCharacters(rem2);
            regexStr = `^(?!.*${fintext}).*`

        }
        else if(searchText.startsWith("<>") || searchText.startsWith("!=")) {
            // Not Equals:
            //      !=jupiter_rising
            //      <>jupiter_rising
            //
            // Not Starts With:
            //      !=jupiter_rising*
            let rem1 = removeSubstringFromBeginning(searchText, "!=", true);
            let rem2 = removeSubstringFromBeginning(rem1, "<>", true)
            if(checkSetFull.some(c => rem2.trim().startsWith(c)) || checkSetMin.some(x => rem2.trim().endsWith(x))) {
                if(errorOnCheck) {
                    throw new Error();
                }
            }
            let fintext = situateAndEscapeCharacters(rem2);
            regexStr = `^(?!${fintext}).+$`

        }
        else if(searchText.startsWith("*") && searchText.endsWith("*")) {
            // Contains:
            //      *jupiter_rising*
            let rem1 = removeSubstringFromBeginning(searchText, "*", true);
            let rem2 = removeSubstringFromEnd(rem1, "*", true)
            if(checkSetFull.some(c => rem2.trim().startsWith(c)) || checkSetFull.some(x => rem2.trim().endsWith(x))) {
                if(errorOnCheck) {
                    throw new Error();
                }
            }
            let fintext = situateAndEscapeCharacters(rem2);
            regexStr = `^(.*)(${fintext})+(.*)$`

        }
        else if(searchText.startsWith("==")) {
            // Equals:
            //      ==jupiter_rising
            //
            // Starts With
            //      ==jupiter_rising*
            let rem1 = removeSubstringFromBeginning(searchText, "==", true);
            if(checkSetFull.some(c => rem1.trim().startsWith(c)) || checkSetMin.some(x => rem1.trim().endsWith(x))) {
                if(errorOnCheck) {
                    throw new Error();
                }
            }
            let fintext = situateAndEscapeCharacters(rem1);
            regexStr = `^(${fintext})$`

        }
        else if(searchText.startsWith("*") && (searchText.endsWith("*") === false)) {
            // Ends With:
            //      *jupiter_rising
            let rem1 = removeSubstringFromBeginning(searchText, "*", true);
            if(checkSetFull.some(c => rem1.trim().startsWith(c)) || checkSetMin.some(x => rem1.trim().endsWith(x))) {
                if(errorOnCheck) {
                    throw new Error();
                }
            }
            let fintext = situateAndEscapeCharacters(rem1);
            regexStr = `^(.*)(${fintext})$`

        }

        regex = (caseInsensitive === true) 
            ? new RegExp(`${regexStr}`, 'i')
            : new RegExp(`${regexStr}`)

    }
    catch(error: any) {
        throw new Error("Invalid input search text detected. System cannot formulate info for content filtering");
    }
  
    return regex;
}


export function isValidRegex(pattern: string): boolean {
    try {
        new RegExp(pattern);
        return true;
    } 
    catch (error: any) {
        return false;
    }
}


export function isServiceModel(obj: any): obj is ServiceModel {
    return (
        obj !== undefined
        && typeof obj === 'object'
        && obj !== null
        && obj._id !== null
        && obj._id !== undefined
        && typeof obj.projectId === 'string'
        && Array.isArray(obj.contextProperties)
        && isValidDate(obj?.lastUpdatedOn?.toString())
    );
}


export function hasAnyMembers(obj: object) : boolean {
    let res = Object.keys(obj).length > 0;
    return res;
}


export function removeSubstringFromBeginning(str: string, removalSubstring: string, caseInsensitive : boolean, preTrim: boolean = true): string {
    let newStr = str;
    if(preTrim) {
        str = str.trim();
        removalSubstring = removalSubstring.trimStart();
    }
    
    if(caseInsensitive) {
        if (str.toLowerCase().startsWith(removalSubstring.toLowerCase())) {
            newStr = str.slice(removalSubstring.length);
        }
    }
    else {
        if (str.endsWith(removalSubstring)) {
            newStr = str.slice(removalSubstring.length);
        }
    }
    
    return newStr;
}


function removeSubstringFromEnd(str: string, removalSubstring: string, caseInsensitive : boolean, preTrim: boolean = true): string {
    let newStr = str;
    if(preTrim) {
        str = str.trim();
        removalSubstring = removalSubstring.trimStart();
    }

    if(caseInsensitive) {
        if (str.toLowerCase().endsWith(removalSubstring.toLowerCase())) {
            newStr = str.slice(0, -removalSubstring.length);
        }
    }
    else {
        if (str.endsWith(removalSubstring)) {
            newStr = str.slice(0, -removalSubstring.length);
        }
    }
    
    return newStr;
}


// export function copyForSnapshot<T extends ServiceModel>(items: T[], newProjectId: string, setIdForSnapShot: boolean) : Array<T> {
//     let returnItems : Array<T> = [];
//     let copies = rfdcCopy<T>(items) as T[] 
//     for(let i = 0; i < items.length; i++) {
//         let itemId =  copies[i]._id?.toString();
//         copies[i].snapshotSourceId = (setIdForSnapShot && itemId) ? itemId : '';
//         copies[i].ownerElementId = newProjectId || '';
//         delete copies[i]['_id'];

//         returnItems.push(copies[i])
//     }

//     return returnItems;
// }

export function rfdcCopy<T>(item: T|T[]) : T|T[] {
    const clone = rfdc({
        proto: true,
        circles: false,
        constructorHandlers: [
            [ RegExp, (o) => new RegExp(o) ],
            [ ObjectId, (x) => new ObjectId(x) ]
        ]
    });
    const cloneResult = clone(item)
    return cloneResult;
}


export function getDistinctById<T extends ServiceModel>(items: T[]) {
    let map = new Map<string, T>()
    if(items && items.length > 0) {
        for(let i = 0; i < items.length; i++) {
            map.set(items[i]?._id?.toString() ?? "", items[i])
        }
        return Array.from(map.values())
    }
    return items;
}


function isValidDate(dateString: string): boolean {
    if(dateString && dateString.length > 0) {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }
    else {
        return false;
    }
}

export function isNumber(value?: string | number| undefined): boolean {
    if (value === undefined) { return false; }
    
    let result = ((value != null) && (value !== '') && !isNaN(Number(value.toString())));
    return result
}


export function getEnumValuesAsArray(enumType: any, allUpperCase: boolean = false) : Array<string>{
    let values = Object.values(enumType).filter((item) => {
        let retVal = isNaN(Number(item));
        return retVal
    });

    if(allUpperCase === true) {
        values = values.map((a: any) => a.toString().toUpperCase())
    }
    
    let cautiouslyRemoveDuplicatesIfAny = new Set((values as string[]) ?? [])
    return Array.from(cautiouslyRemoveDuplicatesIfAny)
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


export function getDateAppendedName(prefix: string): string {
    const re1 = /\./gi;
    const re2 = /:/gi;
    let date = (new Date()).toISOString().replace(re1, "-").replace(re2, "-")
    let str = `${prefix || ''}_${date}`
    return str
}


export function getFileExt(file: File|string) {
    if(file) {
        if(typeof(file) === "string") {
            let ext = file.slice(file.lastIndexOf("."))?.trim()
            return ext
        }
        else {
            if(file.name) {
                let ext = file.name.slice(file.name.lastIndexOf("."))?.trim()
                return ext
            }
        }
    }
    return undefined
}


export function getFileExtensionWithoutDot(fileName: string) {
    // Split the filename by the dot
    let parts = fileName.split('.');
    if (parts.length === 1) return '';
    return parts.pop();
}


export function getFileNameWithoutExtension(fileName: string) {
    // Split the filename by the dot
    let parts = fileName.split('.');
    if (parts.length === 1) {
        return fileName;
    }
    else if (parts.length > 1) {
        parts.pop();
        return parts.join('.')
    }
    else {
        return ""
    }
}


export function isNotNullOrEmptyOrWS(text: string|null|undefined): boolean {
    let result = (text && (text !== null) && (text.length > 0) && (text.trim().length > 0)) ? true: false;
    return result;
}


export function isCollectionNonEmpty<T extends Array<any>>(collection: T[]): boolean {
    let result = (collection && (collection !== null) && (collection.length > 0)) ? true: false;
    return result;
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

    //sample alt implementation [ assuming: n => (n._id?.toString() as string) ]:
    // let ncGrouping = new Map<string, Netclass[]>();
    // myNetclassList.forEach(n => {
    //     let currId = n._id?.toString() as string;
    //     ncGrouping.set(currId, (ncGrouping.get(currId) ?? []).concat([n])) 
    // });
    // return ncGrouping;
}


export function checkDuplicatesIgnoreCase(values: string[]): boolean {
    if(values && values.length > 0) {
        let lowercaseNames = values.map(word => word.toLowerCase()) ?? [];
        let setSize = new Set(lowercaseNames).size;
        if (setSize !== values.length) {
            return false;
        }
    }
    return true;
}


export function verifyNaming(names: string[], contentType: NamingContentTypeEnum) {   
    ///set defaults
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


export function replaceStringCharAtIndex (str: string, index: number, replacement: string) : string {
    if(replacement.length !== 1) {
        throw new Error(`Function to replace char of string cannot be called with a non-char replacement value`)
    }
    else if(str.length > index) {
        let res = str.substring(0, index) + replacement + str.substring(index + replacement.length);
        return res
    }
    else {
        return str;
    }    
}


export function splitByDelimiters(input: string, delimiters: string[]): string[] {
    // Create a regular expression pattern from the delimiters array
    const pattern = new RegExp(delimiters.map(d => `\\${d}`).join('|'), 'g');
    // Split the input string using the pattern
    return input.split(pattern);
}


export function containsSpecialChars(inputStrings: string[]) {
    for(let i = 0; i < inputStrings.length; i++){
        const charsExpression = /[`!@#$%^&*()+=\[\]{};':"\\|,<>\/?~]/;
        let val = charsExpression.test(inputStrings[i]);
        if (val === true) { return true; }
    }
    return false;
}


export async function performBackendCall(url: string, action: string, data: any) {
    const AX_AGENT = new https.Agent({ rejectUnauthorized: false });
    try {
        let resp = null;
        if (action.toUpperCase() === "GET") {
            resp = await axios.get(url, { httpsAgent: AX_AGENT } as AxiosRequestConfig<any>).catch((err: any) => errorFunction(err));
        }
        else if (action.toUpperCase() === "POST") {
            resp = await axios.post(url, data, { httpsAgent: AX_AGENT } as AxiosRequestConfig<any>).catch((err: any) => errorFunction(err));
        }
        else if (action.toUpperCase() === "DELETE") {
            resp = await axios.delete(url, { data: data ?? {}, httpsAgent: AX_AGENT } as AxiosRequestConfig<any>).catch((err: any) => errorFunction(err));
        }

        if (resp.data && resp.data.error && resp.data.error.id) {
            errorFunction(resp.data.error);
            console.error(resp.data.error);
            return [];
        }
        else {
            return resp.data.payload as any;
        }
    }
    catch (e: any) {
        throw e
    }
}


export function errorFunction(err: any, skipConsoleLog = false): any {
    if (err.id && err.id.length > 0) {
        if(skipConsoleLog === false) {
            console.error(err.code,  err.severity + " --- " + err.message);
        }
        //do other things here in future
    }
    else if (err?.response?.data?.error?.id) {
        if(skipConsoleLog === false) {
            console.error(err.response.data.error.code, err.response.data.error.severity + " --- " + err.response.data.error.message);
        }
        //do other things here in future
    }
    else {
        if (err.message) {
            if(skipConsoleLog === false) {
                console.error(err.message);
            }
            //do other things here in future
        }
    }

    throw new Error(`${err.message}`)
}



export const getDateStringForExport = (): string => {
    let date = new Date();
    const pad = (num: number): string => num.toString().padStart(2, '0');
    
    let year = date.getFullYear();
    let month = pad(date.getMonth() + 1); // Months are zero-based
    let day = pad(date.getDate());
    let hours = pad(date.getHours());
    let minutes = pad(date.getMinutes());
    let seconds = pad(date.getSeconds());
  
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};





