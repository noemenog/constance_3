import axios, { AxiosRequestConfig } from "axios";
import { ServiceModel } from "../Models/ServiceModels";
import { ConfigItem, PropertyItem, QuickStatus } from "../Models/HelperModels";
import { CommonPropertyCategoryEnum, NamingContentTypeEnum } from "../Models/Constants";
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
        && typeof obj.snapshotSourceId === 'string'
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


export function copyForSnapshot<T extends ServiceModel>(items: T[], newProjectId: string, setIdForSnapShot: boolean) : Array<T> {
    let returnItems : Array<T> = [];
    let copies = rfdcCopy<T>(items) as T[] 
    for(let i = 0; i < items.length; i++) {
        let itemId =  copies[i]._id?.toString();
        copies[i].snapshotSourceId = (setIdForSnapShot && itemId) ? itemId : '';
        copies[i].projectId = newProjectId || '';
        delete copies[i]['_id'];

        returnItems.push(copies[i])
    }

    return returnItems;
}

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
    else if (contentType === NamingContentTypeEnum.ARBITRARY_DEFAULT) {
        maxLength= 36 
    }
    else if (contentType === NamingContentTypeEnum.INTERFACE_TEMPLATE) {
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


export function getPropertiesFromConfigs(incomingConfigs: ConfigItem[], configItemName: string, setCateg: boolean): PropertyItem[] {
    let propArr: PropertyItem[] = []
    let namesToCheck = []

    if(incomingConfigs && incomingConfigs.length > 0) {
        let propConf : any = incomingConfigs.filter(a => a.configName.toLowerCase() === configItemName.toLowerCase())?.at(0)?.configValue ?? null
        
        if(propConf && propConf.length > 0) {
            
            for(let x = 0; x < propConf.length; x++) {
                let propInstance = (propConf[x] as PropertyItem);
                
                let name = propInstance?.name?.trim() ?? ""
                let value = propInstance?.value ?? ""
                let enabled = propInstance?.enabled ?? false
                let editable = propInstance?.editable ?? false
                let displayName = propInstance?.displayName?.trim() ?? name  //use 'name' if 'displayName' is not specified
                let contextProps = propInstance.contextProperties ?? []

                if(propInstance && name.length > 0 && enabled === true) {
                    namesToCheck.push(name);
                    
                    propInstance.id = crypto.randomUUID()
                    propInstance.displayName = displayName;
                    
                    if(setCateg === true) {
                        if(editable){
                            propInstance.category = CommonPropertyCategoryEnum.GENERAL_CONFIGURED_FIXED_KEY
                        }
                        else {
                            propInstance.category = CommonPropertyCategoryEnum.GENERAL_CONFIGURED_NON_EDITABLE
                        }
                    }
                    propInstance.value = value.toString() //allowing only string values from config
                    propArr.push(propInstance)
                }
            }

        }
    }

    if(namesToCheck.length > 0) {
        verifyNaming(namesToCheck, NamingContentTypeEnum.PROJECT_PROPERTY)
    }

    return propArr;
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








//intended use:
        //  get-nets:                  filterNetName
        //  get-constraints:          filterElementName
        //  get-class-relation-layout: netclassName
        



    
// let newStr = str;
// if(caseInsensitive) {
//     const regex = new RegExp(`^${removalSubstring}`, 'i'); // 'i' flag makes it case-insensitive
//     newStr = str.replace(regex, '');
// }
// else {
//     if (str.startsWith(removalSubstring)) {
//         newStr = str.slice(removalSubstring.length);
//     }
// }

// return newStr;


//============================================================================




// sample test: jupiter_mountain

// starts with 
// jupiter_

// ends With
// *_mountain

// contains
// *mount*

// not contains
// <>*mount*


// equals
// =jupiter_mountain

// not equals
// !=jupiter_rising
// <>jupiter_rising

//=========================================================================



// async function mergeChunks(fileName: string, totalChunks: number, chunkDir: string) : Promise<Buffer> {
//     // if (!fs.existsSync(mergedFilePath)) {
//     //     fs.mkdirSync(mergedFilePath);
//     // }
    
//     //======================
//     let buffer : Buffer = Buffer.from('');
//     let bufs = []
//     for (let i = 0; i < totalChunks; i++) {
//         const chunkFilePath = `${chunkDir}/${fileName}.part_${i}`;
//         const chunkBuffer = await fs.promises.readFile(chunkFilePath);
//         bufs.push(chunkBuffer);
//         // Delete the individual chunk file after merging
//     }
//     buffer = Buffer.concat(bufs);
//     return buffer;

//     //=======================
//     // const writeStream = fs.createWriteStream(`${mergedFilePath}/${fileName}`);
//     // for (let i = 0; i < totalChunks; i++) {
//     //     const chunkFilePath = `${chunkDir}/${fileName}.part_${i}`;
//     //     const chunkBuffer = await fs.promises.readFile(chunkFilePath);
//     //     writeStream.write(chunkBuffer);
//     //     fs.unlinkSync(chunkFilePath); // Delete the individual chunk file after merging
//     // }
  
//     // writeStream.end();
//     // console.log("Chunks merged successfully");
// }

//=============================================================================



    // let newItems : Array<T> = [];
    // if(items && items.length > 0){
    //     for(let i = 0; i < items.length; i++) {
    //         let oldItem : T = items[i];
    //         let copy : T = {...oldItem};
    //         copy.snapshotSourceId = (setIdForSnapShot && oldItem._id) ? oldItem._id.toString() : '';
    //         copy.projectId = newProjectId ?? '';
    //         delete copy['_id'];
            
    //         newItems.push(copy)
    //     }
    // }


// export function deepCopy<T>(item: T|T[]) : T|T[] {
//     const str = JSON.stringify(item)
//     const copy = JSON.parse(str) as typeof item;
//     return copy;
// }





// allowSpace: boolean, elementName: string|null, maxLength: number




// function containsSpecialChars(inputStrings: string[]) {
//     for(let i = 0; i < inputStrings.length; i++){
//         const charsExpression = /[`!@#$%^&*()+=\[\]{};':"\\|,<>\/?~]/;
//         let val = charsExpression.test(inputStrings[i]);
//         if (val === true) { return true; }
//     }
//     return false;
// }





// export function verifyNaming(names: string[], regexPattern: string, maxLength: number, errMsgToUse: string = '') {

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
//         configured property names
//     */

//     // try {
//         // let namingConf : {regexPattern: string, maxLength: number}| null = null;
//         // if(inputNamingConf && inputNamingConf.regexPattern && inputNamingConf.regexPattern.trim().length > 0) {
//         //     namingConf = inputNamingConf
//         // }
//         // else {
//         //     let genConfigs : ConfigItem[] = await getGenConfigs(null, null, true);
//         //     namingConf = genConfigs.find(a => a.configName === AppConfigConstants.CONFIGITEM__Name_Check_Settings)?.configValue ?? undefined
//         //     if(!namingConf || !namingConf.regexPattern) {
//         //         throw new Error(`Could not find value for config item: '${AppConfigConstants.CONFIGITEM__Name_Check_Settings}'. Check config management system`)
//         //     }
//         // }
        


//         for(let input of names) {
//             const regex = new RegExp(namingConf.regexPattern);
//             let testResult = regex.test(input);
            
//             if(input.trim().length === 0) {
//                 throw new Error(`Invalid data provided. Please specify valid non-empty string(s).`)
//             }
//             if(namingConf.maxLength && namingConf.maxLength < input.length) {
//                 throw new Error(`Invalid data provided. Value exceeded the max number of characters allowed: ${namingConf.maxLength || ''}`)
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
//     // }
//     // catch(error: any) {
//     //     throw new Error(`Error: ${error.message}`)
//     // }
// }



// export function getFilterForApp(app: string, enabledOnly: boolean, isAppId: boolean = false){
//     if(enabledOnly){
//         let enableOnlyExpr = {}
//         if(isAppId) {
//             enableOnlyExpr = { 
//                 _id: new mongo.ObjectId(app),
//                 enabled : true 
//             };
//         }
//         else {
//             enableOnlyExpr = { 
//                 appName : new RegExp('^' + app + '$', 'i'), 
//                 enabled : true 
//             };
//         }
//         return enableOnlyExpr;
//     }
//     else {
//         let expr = {}
//         if(isAppId) {
//             expr = { _id: new mongo.ObjectId(app) };
//         }
//         else {
//             expr = { appName : new RegExp('^' + app + '$', 'i') };
//         }
//         return expr;
//     }
// }


// export function getFilterForBucket(appId: string, bucketId: string|null|undefined) {
//     if(appId && appId.length > 0) {
//         if(bucketId && bucketId.length > 0){
//             let expr1 = { 
//                 appId: new RegExp('^' + appId + '$', 'i'), 
//                 bucketId: new RegExp('^' + bucketId + '$', 'i')
//             };
//             return expr1;
//         }
//         else{
//             let expr3 = { 
//                 appId: new RegExp('^' + appId + '$', 'i')
//             };
//             return expr3;
//         }
//     }
//     else{
//         throw new Error(`Input appId cannot be null or empty`);
//     }
// }


// export function containsSpecialChars(inputStrings: string[]) {
//     for(let i = 0; i < inputStrings.length; i++){
//         const charsExpression = /[`!@#$%^&*()+=\[\]{};':"\\|,<>\/?~]/;
//         let val = charsExpression.test(inputStrings[i]);
//         if (val === true) { return true; }
//     }
//     return false;
// }


// export async function validateConfigListForAddOrUpdate(env: string, inputConfigs: ConfigItem[], isAdd :boolean) {
//     let oper = isAdd ? "add" : "update";
    
//     let appIdSet = new Set(inputConfigs.map(a => a.appId));
//     if(appIdSet.size !== 1){
//         throw new Error(`Cannot ${oper} batch of config items from different apps. This feature is not supported`);
//     }
    
//     let bucketIdSet = new Set(inputConfigs.map(a => a.bucketId));
//     if(bucketIdSet.size !== 1){
//         throw new Error(`Cannot ${oper} batch of config items from different buckets. This feature is not supported`);
//     }

//     const [appId] = appIdSet; //get first item in set
//     const [bucketId] = bucketIdSet;  //get first item in set

//     const appsCollection = getAppInfoCollection(env);
//     const confCollection = getConfigCollection(env);
//     const bucketCollection = getBucketCollection(env);
    
//     let appItems : AppInfo[] = (await appsCollection.find({ _id: new mongo.ObjectId(appId) } as any).toArray()) as AppInfo[];
//     let bucks : Bucket[] = (await bucketCollection.find({ _id: new mongo.ObjectId(bucketId) } as any).toArray()) as Bucket[];

//     if (appItems && appItems.length > 0) {
//         if(bucks && bucks.length > 0) {
//             for(let i = 0; i < inputConfigs.length; i++) {
//                 let confItem = inputConfigs[i]

//                 // Ensure the necessary properties are filled in the config item
//                 if(!confItem.appId || !confItem.configName || !confItem.bucketId || !confItem.lastUpdatedOn){
//                     throw new Error(`Cannot ${oper} one or more config items. All required fields must have valid values.`);
//                 }
        
//                 // Check if app name has special/unwanted characters
//                 if(containsSpecialChars([confItem.configName])){
//                     throw Error("ConfigItem name contains special characters that are not allowed.");
//                 }
        
//                 // Ensure that ConfigValue is actually the specified ConfigType.
//                 let valueTypeValResult = validateConfigValueAndType(confItem.configValue, confItem.contentType)
//                 if(valueTypeValResult === false){
//                     throw new Error(`The value for ConfigItem '${confItem.configName}' is not actually of the type ${confItem.contentType}'`);
//                 }
        
//                 // Ensure config app is as expected
//                 if(confItem.appId !== appItems[0]._id?.toString()){
//                     throw Error("ConfigItem's appId is not what is expected.");
//                 }

//                 // Ensure config bucket is as expected
//                 if(confItem.bucketId !== bucks[0]._id?.toString()){
//                     throw Error("ConfigItem's bucketId is not what is expected.");
//                 }

//                 // Ensure bucket has same appId as the config item
//                 if(bucks[0].appId !== appItems[0]._id?.toString()){
//                     throw Error("AppId for configItem is not same as the appId for the configItem's assigned bucket.");
//                 }
//             };

//             // Ensure no duplicate configItem name
//             let buckFilter = getFilterForBucket(appId, bucketId)
//             let existingConfigs = (await confCollection.find(buckFilter).toArray() as ConfigItem[]);
//             if(isAdd) {
//                 let existingNames = existingConfigs.map((x: ConfigItem) => x.configName)
//                 let newNames = inputConfigs.map((x: ConfigItem) => x.configName)
//                 let combinedNames = [...existingNames, ...newNames]
//                 let checkRes = checkDuplicatesIgnoreCase(combinedNames);
//                 if(checkRes === false) {
//                     throw Error("Cannot set configs for app because the process would result in duplicate config names.");
//                 }
//             }
//             else {
//                 let incomingConfigIds = inputConfigs?.map((a, i) => a._id?.toString()) ?? [];
//                 let uniqueExisting = existingConfigs.filter(x => (incomingConfigIds.includes(x._id?.toString()) === false))
//                 let newNames = inputConfigs.map((x: ConfigItem) => x.configName)
//                 let existingNames = uniqueExisting.map((x: ConfigItem) => x.configName)
//                 let combinedNames = [...existingNames, ...newNames]
//                 let checkRes = checkDuplicatesIgnoreCase(combinedNames);
//                 if(checkRes === false) {
//                     throw Error("Cannot set configs for app because the process would result in duplicate config names.");
//                 }
//             }
//         }
//         else{
//             throw new Error(`Cannot ${oper} config items. Bucket for config items(s) was not found.`);
//         }
//     }
//     else {
//         throw new Error(`Cannot ${oper} config items. App specified for config items(s) was not found.`);
//     }

// }


// export function validateConfigValueAndType(value: any, valueType: ConfigContentTypeEnum) : boolean {
//     if (ConfigContentTypeEnum.JSON === valueType.toUpperCase()) {
//         try {
//             if(typeof value == "string") {
//                 return (value && value.length > 0 && JSON.parse(value)) ? true : false
//             }
//             else if(typeof value == "object") {
//                 return (value && JSON.parse(JSON.stringify(value))) ? true : false
//             }
//             else {
//                 throw new Error();
//             }
//         } 
//         catch (e) {
//             return false;
//         }
//     } 
//     else if (ConfigContentTypeEnum.BOOLEAN === valueType.toUpperCase()) {
//         if (value.toString().toLowerCase() === "true" || value.toString().toLowerCase() === "false") {
//             return true;
//         } 
//         else {
//             return false;
//         }
//     } 
//     else if (ConfigContentTypeEnum.NUMBER === valueType.toUpperCase()) {
//         return /^-?\d+$/.test(value.toString());
//     } 
//     else if (ConfigContentTypeEnum.STRING === valueType.toUpperCase()) {
//         if ((typeof value === "string") && (value.length > 0)){
//             return true;
//         } 
//         else {
//             return false;
//         }
//     } 
//     else if (ConfigContentTypeEnum.XML === valueType.toUpperCase()) {
//         try {
//             //libxml.parseXml(value);
//             return true;
//         } 
//         catch (e) {
//             return false;
//         }
//     } 
//     else {
//         return false;
//     }
// }


// export function formatConfigValueAndBucketName(configs: ConfigItem[], bucket: Bucket, strUploadScenario : boolean = false) : ConfigItem[]{
//     for (let i = 0; i < configs.length; i++) {
//         let val = configs[i].configValue;
//         if (configs[i].contentType === ConfigContentTypeEnum.BOOLEAN) {
//             configs[i].configValue = val.toString().toLowerCase() == "true" ? true : false;
//         }
//         else if (configs[i].contentType === ConfigContentTypeEnum.NUMBER) {
//             configs[i].configValue = Number(val);
//         }
//         else if (configs[i].contentType === ConfigContentTypeEnum.JSON) {
//             if(strUploadScenario){
//                 configs[i].configValue = JSON.parse(val) ;
//             }
//             else {
//                 configs[i].configValue = JSON.parse(JSON.stringify(val)) ;
//             }
//         }
//         else if (configs[i].contentType === ConfigContentTypeEnum.STRING) {
//             configs[i].configValue = String(val);
//         }

//         configs[i].bucketName = bucket.name;
//     }

//     return configs
// }


// export function checkDuplicatesIgnoreCase(values: string[]): boolean {
//     if(values && values.length > 0) {
//         const lowercaseNames = values.map(word => word.toLowerCase()) ?? [];
//         let dist = new Set(lowercaseNames).size;
//         if (dist !== values.length) {
//             return false;
//         }
//     }
//     return true;
// }

