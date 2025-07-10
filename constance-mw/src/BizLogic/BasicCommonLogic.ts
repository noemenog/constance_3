import rfdc from "rfdc";
import fs from 'fs-extra'
import path from "path";
import { Readable } from "stream";
import { Request, Response } from "express";
import { BasicKVP, BasicProperty, PropertyItem, QuickStatus, ResponseData, User } from "../Models/HelperModels";
import { DBCollectionTypeEnum, EnvTypeEnum, ErrorSeverityValue } from "../Models/Constants";
import { isNumber, isServiceModel, removeSubstringFromBeginning, rfdcCopy, splitByDelimiters } from "./UtilFunctions";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { Filter, ObjectId } from "mongodb";
import { AppInfo, ServiceModel } from "../Models/ServiceModels";
import { BaseRepository } from "../Repository/BaseRepository";
import { sort } from "fast-sort";
import * as jsondiffpatch from 'jsondiffpatch';
import { deepEqual } from 'fast-equals';





// #region ============================================ Route Intercept Processing =========================================
export async function processRouteIntercept(req: Request, res: Response): Promise<{ proceed: boolean, resp: ResponseData|null }> {
    try {
        let ownerElementId = ''
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
                ownerElementId = payload?.ownerElementId || ''
                interfaceId = (payload as any).interfaceId || ''
            }
            else if (Array.isArray(payload)) {
                if(isServiceModel(payload[0])){
                    ownerElementId = payload[0]?.ownerElementId || ''
                    interfaceId = (payload[0] as any)?.interfaceId || ''
                }
            }
            
            if (!ownerElementId || ownerElementId === 'undefined' || ownerElementId.trim().length === 0) {
                ownerElementId = req?.query?.projectId?.toString()?.trim() || payload?.projectId || ''
            }

            if(ownerElementId && ownerElementId.length > 0) {
                let isAllowedPath = projectScenarioAllowedPathRegexList.some(a => a.test(req.path))
                // if(isAllowedPath === false) {
                //     let projRepo = new ServiceModelRepository<AppInfo>(DBCollectionTypeEnum.APPINFO_COLLECTION);
                //     let filter = { _id: new ObjectId(ownerElementId as string) } as Filter<AppInfo>;
                //     let projection = { name: 1, owner: 1, lockedBy: 1 };
                //     let element = (await projRepo.GetByFilterAndProjection(filter, projection) as any[])?.at(0);
                //     if(element && element.lockedBy && element.lockedBy.trim().length > 0) {
                //         const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
                //         let elementOwnerLC = element.owner?.email?.trim()?.toLowerCase();
                //         let lockedByLC = element.lockedBy.trim().toLowerCase()
                //         let isYou = (user && user.email && user.email.trim().toLowerCase() === element.lockedBy.trim().toLowerCase()) ? true : false;
                        
                //         if(isYou === false) {
                //             let contactInfo = (elementOwnerLC && (elementOwnerLC === lockedByLC)) ? `'${element.lockedBy}'` : `'${element.lockedBy}' or '${element.owner.email}'`
                //             let furtherAction = `Please contact ${contactInfo} to unlock`

                //             throw new Error(`Project was locked by [${element.lockedBy}]. Action is prohibited on a locked project. ${furtherAction}`)
                //         }
                //     }
                // }
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




export function GetEnvironmentType(env: string) : EnvTypeEnum {
    if(env && env.trim().length> 0) {
        if ((env?.trim()?.toLowerCase() === "production") || (env?.trim()?.toLowerCase() === "prod")) {
            return EnvTypeEnum.PRODUCTION;
        }
        else if ((env?.trim()?.toLowerCase() === "preview") || (env?.trim()?.toLowerCase() === "pre")) {
            return EnvTypeEnum.PREVIEW
        }
        else if ((env?.trim()?.toLowerCase() === "development") || (env?.trim()?.toLowerCase() === "dev")) {
            return EnvTypeEnum.DEVELOPMENT
        }
        else {
            throw new Error(`Specified environment '${env}' is invalid`)
        }
    }
    else {
        throw new Error(`Environment info is either invalid or not provided`)
    }
}