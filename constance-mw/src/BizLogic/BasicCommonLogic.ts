import rfdc from "rfdc";
import fs from 'fs-extra'
import path from "path";
import { Readable } from "stream";
import { Request, Response } from "express";
import { BasicKVP, BasicProperty, PropertyItem, QuickStatus, ResponseData, User } from "../Models/HelperModels";
import { DBCollectionTypeEnum, ErrorSeverityValue, NET_RETRIEVAL_BATCH_SIZE } from "../Models/Constants";
import { isNumber, isServiceModel, removeSubstringFromBeginning, rfdcCopy, splitByDelimiters } from "./UtilFunctions";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { Filter, ObjectId } from "mongodb";
import { C2CRowSlot, ChangeContext, G2GRelationContext, Interface, Netclass, Project, ServiceModel } from "../Models/ServiceModels";
import { BaseRepository } from "../Repository/BaseRepository";
import { sort } from "fast-sort";
import * as jsondiffpatch from 'jsondiffpatch';
import { deepEqual } from 'fast-equals';





// #region ============================================ Route Intercept Processing =========================================
export async function processRouteIntercept(req: Request, res: Response): Promise<{ proceed: boolean, resp: ResponseData|null }> {
    try {
        let projectId = ''
        let interfaceId = ''

        //Important!! - For project, we must not block route during:  create, clone, lock, unlock
        const projectScenarioAllowedPathRegexList = [
            /^\/api\/v\d+\/project\/create$/,
            /^\/api\/v\d+\/project\/clone$/,
            /^\/api\/v\d+\/project\/manage-lock$/
        ]

        if(req.method.toUpperCase() === "POST" || req.method.toUpperCase() === "DELETE") {
            let payload = (req as any)?.body;
            if(isServiceModel(payload)) {
                projectId = payload?.projectId || ''
                interfaceId = (payload as any).interfaceId || ''
            }
            else if (Array.isArray(payload)) {
                if(isServiceModel(payload[0])){
                    projectId = payload[0]?.projectId || ''
                    interfaceId = (payload[0] as any)?.interfaceId || ''
                }
            }
            
            if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
                projectId = req?.query?.projectId?.toString()?.trim() || payload?.projectId || ''
            }

            if(projectId && projectId.length > 0) {
                let isAllowedPath = projectScenarioAllowedPathRegexList.some(a => a.test(req.path))
                if(isAllowedPath === false) {
                    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
                    let filter = { _id: new ObjectId(projectId as string) } as Filter<Project>;
                    let projection = { name: 1, owner: 1, lockedBy: 1 };
                    let project = (await projRepo.GetByFilterAndProjection(filter, projection) as any[])?.at(0);
                    if(project && project.lockedBy && project.lockedBy.trim().length > 0) {
                        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
                        let projOwnerLC = project.owner?.email?.trim()?.toLowerCase();
                        let lockedByLC = project.lockedBy.trim().toLowerCase()
                        let isYou = (user && user.email && user.email.trim().toLowerCase() === project.lockedBy.trim().toLowerCase()) ? true : false;
                        
                        if(isYou === false) {
                            let contactInfo = (projOwnerLC && (projOwnerLC === lockedByLC)) ? `'${project.lockedBy}'` : `'${project.lockedBy}' or '${project.owner.email}'`
                            let furtherAction = `Please contact ${contactInfo} to unlock`

                            throw new Error(`Project was locked by [${project.lockedBy}]. Action is prohibited on a locked project. ${furtherAction}`)
                        }
                    }
                }
            }
        }
    }
    catch(e: any) {
        let errResp : ResponseData = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        return { proceed: false, resp: errResp };
    }
    
    return { proceed: true, resp: null };
}
//#endregion




// #region ============================================ File Chunkification Handling =========================================
export async function handleIncomingFileListChunk(projectId: string, chunk: any, fileKey: string, chunkNumber: number, 
    currentFileTotalChunks: number, originalname: string, filesInfo: any) : Promise<{name: string, buffer: Buffer}[]> {
    
    const CHUNK_DIR_ROOT = process.env.STORE_ROOT_PATH as string
    
    let bufferInfo = new Array<{name: string, buffer: Buffer}>()
    let chunkDir = CHUNK_DIR_ROOT + `/chunks/${projectId}__${fileKey}`; 

    try {
        if (!fs.existsSync(chunkDir)) {
            fs.mkdirSync(chunkDir, {recursive: true});
            fs.chmodSync(chunkDir, '777');
        }
    }
    catch(error: any) {
        throw new Error(`Failed to create necessary directory: ${chunkDir}. ${error.message}`)
    }

    let chunkFilePath = `${chunkDir}/${originalname}.part_${chunkNumber}`;

    try{
        fs.writeFileSync(chunkFilePath, chunk, {mode: '777'})
    }
    catch(error: any) {
        throw new Error(`Failed to write file [${chunkFilePath}]. ${error.message}`)
    }

    let lastFileInfo = filesInfo[filesInfo.length - 1]
    if (lastFileInfo && (originalname === lastFileInfo.name) && (chunkNumber === currentFileTotalChunks - 1)) {
        // If this is last chunk scenario -- in here, we merge all chunks into a single file
        for (let info of filesInfo) {
            let buf = await mergeChunks(info.name, info.chunkCount, chunkDir);
            if(buf) {
                bufferInfo.push({name: info.name, buffer: buf});
            }
        }

        try { 
            //remove chunk dir on last file scenario
            await fs.remove(chunkDir); 
        }
        catch(error: any) {
            console.error(`ERROR: Failed to delete chunk directory [ ${chunkDir} ].  ${error.message}`)
        }

        if(bufferInfo.length === 0) {
            throw new Error(`Failed to merge chunks from following path since resulting buffer is invalid --- ${chunkDir}`)
        }
    }

    return bufferInfo;
}


async function mergeChunks(fileName: string, totalChunks: number, chunkDir: string) : Promise<Buffer> {
    let buffer : Buffer = Buffer.from('');
    let bufs = []
    for (let i = 0; i < totalChunks; i++) {
        let chunkFilePath = `${chunkDir}/${fileName}.part_${i}`;
        let chunkBuffer = await fs.promises.readFile(chunkFilePath);
        bufs.push(chunkBuffer);
    }
    buffer = Buffer.concat(bufs);
    return buffer;
}


export function streamResponse(res: Response<any, Record<string, any>>, buffer: Buffer) {
    res.writeHead(200, {
        'Content-Disposition': `attachment; filename="file.zip"`,
        'Content-Type': 'application/zip',
    });

    const bufferStream = new Readable({
        read(size) {
            if (buffer) {
                this.push(buffer?.subarray(0, size));
                buffer = buffer?.subarray(size);
                if (buffer?.length === 0) {
                    this.push(null);
                }
            }
        }
    });

    bufferStream.pipe(res);
    return buffer;
}
//#endregion




// #region ============================================ Change History Mgmt =========================================
export async function saveLatestChangeTrackingVersionsForCollection(projectId: string, user: User|null, inputDataMap: Map<string, C2CRowSlot[] | BasicProperty[] | PropertyItem[]>, mapBeforeUpdate : Map<string, Map<string, any>>) { 
    for(let [itemId, dataColl] of inputDataMap) {
        for(let data of dataColl) {
            let existingValue = mapBeforeUpdate.get(itemId)?.get(data.id) || ''
            let createChangeInfo = false;
            if(typeof(data.value) === "string") {
                if(existingValue !== data.value) {
                    createChangeInfo = true;
                }
            }
            else {
                if(deepEqual(existingValue, data.value) === false) {
                    createChangeInfo = true;
                }
            }

            if(createChangeInfo === true) {
                let changeCtx : ChangeContext = {
                    projectId: projectId,
                    snapshotSourceId: "",
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    uniqueId: `${itemId}::${data.id}`, //Important!! - note the format used here. The UI will need this!
                    tags: [],
                    data: data.value,
                    diffContext: []
                }
                await saveLatestVersion(changeCtx, user);
            }   
        }
    }
}



export async function saveLatestVersion(inputChangeCtx: ChangeContext, user: User|null) : Promise<ChangeContext|null> {
    const MAX_DELTA_SIZE = 100;
    let resp : ChangeContext|null = null;
    let chgCtxRepo = new BaseRepository<ChangeContext>(DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION)

    async function getExistingChgCtx(incommingCtx : ChangeContext) : Promise<ChangeContext|undefined>{
        let filter = { uniqueId: incommingCtx.uniqueId, projectId: incommingCtx.projectId } as Filter<ChangeContext>
        let relevCtx = await chgCtxRepo.GetWithFilter(filter);
        let found = relevCtx?.at(0);
        return found
    }

    let existingChangeCtx = await getExistingChgCtx(inputChangeCtx);
    if(existingChangeCtx) {
        let sortedDiffInfo = sort(existingChangeCtx.diffContext).asc(a => a.time)
        if(sortedDiffInfo.length >= MAX_DELTA_SIZE) {
            while(sortedDiffInfo.length >= MAX_DELTA_SIZE) {
                sortedDiffInfo = sortedDiffInfo.slice(1)
            }
        }

        let newDelta: jsondiffpatch.Delta = jsondiffpatch.diff(existingChangeCtx.data, inputChangeCtx.data);
        if(newDelta !== undefined && newDelta !== null) {
            sortedDiffInfo.push({ time: new Date(), agent: user?.email || '', delta: newDelta })
            existingChangeCtx.diffContext = sortedDiffInfo;
            existingChangeCtx.data = inputChangeCtx.data;
            existingChangeCtx.lastUpdatedOn = new Date();

            let res = await chgCtxRepo.ReplaceOne(existingChangeCtx)
            if (res === false) {
                throw new Error(`Failed to create new change context. The system could not persist new version info after diff assessment. `)
            }

            resp = existingChangeCtx;
        }
        else {
            /* do nothing here for now - this whole thing is a 'best-effort- ordeal */
        }
    }
    else {
        let sameUIDChangeCtx = await getExistingChgCtx(inputChangeCtx);
        if(sameUIDChangeCtx && sameUIDChangeCtx._id && sameUIDChangeCtx.uniqueId) {
            throw new Error("Cannot create new change context. An item already exists with the provided unique ID. ");
        }

        inputChangeCtx.contextProperties = [];
        inputChangeCtx.lastUpdatedOn = new Date();
        inputChangeCtx.diffContext = [];
        inputChangeCtx.tags = [];

        delete inputChangeCtx['_id'];

        let newlyCreated = await chgCtxRepo.CreateOne(inputChangeCtx)
        resp = newlyCreated;
    }
    
    return resp;
}



export async function getLatestVersions(projectId: string, uniqueId: string, limit: number) : Promise<ChangeContext> {
    let chRepo = new BaseRepository<ChangeContext>(DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION)
    let filter = { uniqueId: uniqueId, projectId: projectId } as Filter<ChangeContext>
    let existingChangeCtx = (await chRepo.GetWithFilter(filter))?.at(0);
    
    let respCtx : ChangeContext = {
        projectId: projectId,
        snapshotSourceId: "",
        lastUpdatedOn: new Date(),
        uniqueId: uniqueId,
        tags: [],
        contextProperties: [],
        data: new Array<any>(),
        diffContext: []
    }

    if(existingChangeCtx) {
        let agents = new Array<string>();
        let times = new Array<string>();
        let sortedDiffInfo = (existingChangeCtx.diffContext && existingChangeCtx.diffContext.length > 0) 
            ? rfdcCopy<any[]>(sort(existingChangeCtx.diffContext).asc(a => a.time)) 
            : []
        if(sortedDiffInfo.length > 0) {
            let data = existingChangeCtx.data;
            for(let i = 0; i < limit; i++) {
                let diffInfo = sortedDiffInfo.pop();
                if (diffInfo && diffInfo.delta) {
                    let dataVersion = jsondiffpatch.unpatch(data, diffInfo.delta)
                    if(dataVersion) {
                        respCtx.data.push(dataVersion);
                        agents.push(diffInfo.agent);
                        times.push(diffInfo.time.toISOString());
                        data = rfdcCopy(dataVersion);
                    }
                }
                else {
                    /* do nothing here for now - this whole thing is a 'best-effort- ordeal */
                }

                if(sortedDiffInfo.length === 0) { break; }
            }

            respCtx.tags.push(`NOTE: Returned versions: ${respCtx.data.length} | Total diff instances: ${existingChangeCtx.diffContext.length}`)
        }
        else {
            // respCtx.data.push(existingChangeCtx.data)
            respCtx.tags.push(`NOTE: Returned versions: ${respCtx.data.length} | Total diff instances: 0`)
        } 

        if(agents.length > 0) {
            respCtx.tags.push(`CHANGE_AGENTS: ${agents.join("|")}`)
        }
        if(times.length > 0) {
            respCtx.tags.push(`CHANGE_TIMES: ${times.join("|")}`)
        }
    }

    checkAndDeleteOutdatedHistoricalChanges();
    return respCtx;
}



async function checkAndDeleteOutdatedHistoricalChanges() {
    let chRepo = new ServiceModelRepository<ChangeContext>(DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION)
    let chgBatch = new Array<string>();
    let twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

    let filter = { lastUpdatedOn: { $lt: twentyFourMonthsAgo } as any } as Filter<ChangeContext>;
    const cursor = chRepo.GetCursorByFilterAndProjection([filter], null, NET_RETRIEVAL_BATCH_SIZE)
    for await (let chgCtx of cursor) { 
        if(chgCtx._id) {
            chgBatch.push(chgCtx._id.toString() as string);
            if(chgBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
                chRepo.DeleteMany([...chgBatch])
                chgBatch = new Array<string>()
            }
        }
    }

    if(chgBatch.length > 0){
        chRepo.DeleteMany(chgBatch)
        chgBatch = new Array<string>()
    }
}

//#endregion




// #region ============================================ Channel Mgmt =========================================
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
//#endregion















    // setTimeout(() => {
    //     try { fs.remove(chunkDir); }
    //     catch(error: any) { /* do nothing - this is for good measures... */ }
    // }, 3000);



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


// export function getChannelToNameMapping(iface: Interface, includeNonChanelledIfaceSelf: boolean) : QuickStatus<Map<number, BasicKVP[]>> {
//     let map = new Map<number, BasicKVP[]>();
//     for(let g2gInfo of iface.groupRelationContexts) {
//         let idSections = getSectionsFromIdString(g2gInfo.id)?.data;
//         if((g2gInfo.id.length === 0) || (idSections && !idSections.channel  && !idSections.ifaceId)) {
//             let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
//             return {isSuccessful: false, message: errMsg, data: map} as QuickStatus<Map<number, BasicKVP[]>>
//         }
//         else if (idSections && (idSections.channel !== null)) {
//             let chNumVal = Number(idSections.channel);
//             if(map.has(chNumVal) === false) { map.set(chNumVal, []) }
//             let segStr = (idSections.segment && (idSections.segment.trim().length > 0)) ? `_${idSections.segment}` : "";
//             let concat = map.get(chNumVal)?.concat([ {key: g2gInfo.id, value: `${iface.name}${chNumVal.toString()}${segStr}`} ]) ?? []
//             map.set(chNumVal, concat);
//         }
//         else if (idSections && (idSections.channel === null) && (idSections.ifaceId.trim().length > 0)) {
//             if(includeNonChanelledIfaceSelf) {
//                 let chNumVal = NaN
//                 map.set(chNumVal, [{key: g2gInfo.id, value: iface.name} as BasicKVP])
//             }
//         }
//     }

//     return {isSuccessful: true, message: '', data: map} as QuickStatus<Map<number, BasicKVP[]>>
// }


// export function getNetclassToChannelNameMapping(iface: Interface, netclassList: Netclass[]) : QuickStatus<Map<string, {channelName: string, suffix: string}>> {
//     let resultMap = new Map<string, {channelName: string, suffix: string}>();
//     let chToNameMap = new Map<number, BasicKVP>();

//     if(iface.groupRelationContexts && iface.groupRelationContexts.length > 0) {
//         for(let g2gInfo of iface.groupRelationContexts) {
//             let idSections = getSectionsFromIdString(g2gInfo.id)?.data;
//             if((g2gInfo.id.length === 0) || (idSections && !idSections.channel  && !idSections.ifaceId)) {
//                 let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
//                 return {isSuccessful: false, message: errMsg, data: resultMap} as QuickStatus<Map<string, {channelName: string, suffix: string}>>
//             }
//             else if (idSections && (idSections.segment === null) && (idSections.channel !== null) ) {
//                 let chNumVal = Number(idSections.channel);
//                 let name = `${iface.name}${chNumVal.toString()}`;
//                 chToNameMap.set(chNumVal, {key: g2gInfo.id, value: name} );
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


//=========================================================================================








// export function getChannelToNameMapping(iface: Interface, includeNonChanelledIfaceSelf: boolean) : QuickStatus<Map<number, {id: string, name: string}>> {
//     let map = new Map<number, {id: string, name: string}>();
//     for(let g2gInfo of iface.groupRelationsInfo) {
//         let splitCtx = getSectionsFromIdString(g2gInfo.id)?.data;
//         if((g2gInfo.id.length === 0) || (splitCtx && !splitCtx.channel  && !splitCtx.ifaceId)) {
//             let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
//             return {isSuccessful: false, message: errMsg, data: map} as QuickStatus<Map<number, {id: string, name: string}>>
//         }
//         else if (splitCtx && (splitCtx.channel !== null)) {
//             let chNumVal = Number(splitCtx.channel)
//             map.set(chNumVal, {id: g2gInfo.id, name: `${iface.name}${chNumVal.toString()}`})
//         }
//         else if (splitCtx && (splitCtx.ifaceId.trim().length > 0) && (splitCtx.channel === null)) {
//             if(includeNonChanelledIfaceSelf) {
//                 let chNumVal = NaN
//                 map.set(chNumVal, {id: g2gInfo.id, name: iface.name})
//             }
//         }
//     }

//     return {isSuccessful: true, message: '', data: map} as QuickStatus<Map<number, {id: string, name: string}>>
// }






// export function getChannelToNameMapping(iface: Interface, includeNonChanelledIfaceSelf: boolean) : QuickStatus<Map<number, {id: string, name: string}>> {
//     let map = new Map<number, {id: string, name: string}>();
//     for(let g2gInfo of iface.groupRelationsInfo) {
//         let splitVal: string[] = g2gInfo.id.split("::");
//         if(g2gInfo.id.length === 0 || splitVal.length > 2) {
//             let errMsg = `G2G Error: UNEXPECTED INTERFACE DATA! Please exit interface-update and notify dev team!`
//             return {isSuccessful: false, message: errMsg, data: map} as QuickStatus<Map<number, {id: string, name: string}>>
//         }
//         else if (splitVal.length === 2) {
//             let numVal = Number(splitVal[1].trim())
//             map.set(numVal, {id: g2gInfo.id, name: `${iface.name}${numVal.toString()}`})
//         }
//         else if (splitVal.length === 1) {
//             if(includeNonChanelledIfaceSelf) {
//                 let numVal = Number(splitVal[0].trim())
//                 map.set(numVal, {id: g2gInfo.id, name: iface.name})
//             }
//         }
//     }

//     return {isSuccessful: true, message: '', data: map} as QuickStatus<Map<number, {id: string, name: string}>>
// }

//====================================================================






// const jsondiffpatchInstance = jsondiffpatch.create(options);




// let newChangeCtx : ChangeContext = {
//     projectId: inputChangeCtx.projectId,
//     snapshotSourceId: "",
//     lastUpdatedOn: new Date(),
//     uniqueId: inputChangeCtx.uniqueId,
//     notes: inputChangeCtx.notes,
//     contextProperties: [],
//     data: inputChangeCtx.data,
//     diffContext: [],
// }






    // groupId: string,  //projectId
    // uniqueId: string,  //itemId
    // notes: string,
    // contextProperties: BasicProperty[];
    // data: any;
    // diffContext: { time: Date, delta: any }[],


        // let previousVersion : any = jsondiffpatch.patch(rfdcCopy(changeCtx.data), sortedDiffInfo[sortedDiffInfo.length - 1].delta);

        // const newDelta = jsondiffpatch.diff(previousVersion, changeCtx.data);
        // sortedDiffInfo.push({ time: new Date(), delta: newDelta });
        // existingChangeCtx.diffContext = sortedDiffInfo;







// export async function handleChangeTrackingOperations() {
//     //TODO: perform change tracking operations here
//     //Might need to RoutingConstraintsLogic.ts
//     //console.warn("tracking operation not yet implemented")

//     export interface ChangeContext extends ServiceModel, BaseUserInfo  {
//         srcItemId: string,
//         srcItemProperty: string,
//         srcItemCollection: DBCollectionTypeEnum,
//         previous: any,
//         current: any
//         tags: string[];
//     }
// }




// if(isYou === false) {
//     let contactInfo = (projOwnerLC && (projOwnerLC === lockedByLC)) ? `'${project.lockedBy}'` : `'${project.lockedBy}' or '${project.owner.email}'`
//     let furtherAction = isYou ? "" : `Please contact ${contactInfo} to unlock`

//     throw new Error(`Project was locked by ${isYou ? "you ": ""}[${project.lockedBy}]. Action is prohibited on a locked project. ${furtherAction}`)
// }


 //simulating logging of data on an express middleware
//  console.log(`<${(new Date()).toISOString()}> --- ${req.method} --- ${req.url} --- PROJECT_ID: [${projectId}] --- INTERFACE_ID: [${interfaceId}]`);
