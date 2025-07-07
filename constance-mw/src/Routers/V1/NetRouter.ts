import multer from "multer";
import express, { Request, Response } from "express";
import { DBCollectionTypeEnum, DataMappingTypeEnum, ErrorSeverityValue, NetInfoUploadAspectEnum, PendingProcessActionTypeEnum } from "../../Models/Constants";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { Interface, Net, Netclass, Project } from "../../Models/ServiceModels";
import { NetMgmtCtx, ResponseData, User } from "../../Models/HelperModels";
import { assessNetWranglingScenarios, clearAllNetProperties as clearAllNetPropertyValues, getNetSummaryInfo, includeDiffPairNetNameInContext, processNetChanges, processNetPropertiesUpload, runAutoMapLogic } from "../../BizLogic/NetListLogic";
import { getRegexFromFilterTextString, isNumber } from "../../BizLogic/UtilFunctions";
import { Filter } from "mongodb";
import { BaseRepository } from "../../Repository/BaseRepository";
import { handleIncomingFileListChunk, streamResponse } from "../../BizLogic/BasicCommonLogic";
import { handleProjectPendingProcessIndicator } from "../../BizLogic/ProjectLogic";




const upload = multer({ storage: multer.memoryStorage() })

export const netRouter = express.Router();


netRouter.post('/nets/upload-netlist', upload.single('chunk'), async (req: Request, res: Response) => {
    try {
        req.setTimeout( 1000 * 60 * 8 ); // eight minutes
        
        /*
        Possible Scenarios:
            1) no existing nets
            2) nets already exist and we want to override existing nets (forceCommit = true)
        */

        let response = false;
        let projectId : string = (req as any)?.body?.projectId?.trim()
        let forceCommit: boolean = ((req as any)?.body?.forceCommit?.toString().trim().toLowerCase() === "true") ? true : false;

        let chunk = req?.file?.buffer;
        let chunkNumber = Number(req.body.chunkNumber); // Sent from the client
        let totalChunks = Number(req.body.totalChunks); // Sent from the client
        let originalname : string = (req as any)?.body?.originalname?.trim();
        let fileKey : string = (req as any)?.body?.fileKey?.trim();
        let filesInfoStr : string = (req as any)?.body?.filesInvolved?.trim() || '';
        let filesInfo = JSON.parse(filesInfoStr)

        let bufferInfoList : {name: string, buffer: Buffer}[] = await handleIncomingFileListChunk(projectId, chunk, fileKey, chunkNumber, totalChunks, originalname, filesInfo)
        if(bufferInfoList && bufferInfoList.length > 0) {
            await handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, false, true);
            let isFreshNew = (bufferInfoList.length === 1 && forceCommit === false) ? true : false;
            response = await assessNetWranglingScenarios(bufferInfoList, projectId, originalname, forceCommit, isFreshNew) as boolean
        }
        else {
            response = true;
        }

        res.status(200).send({ payload: response } as ResponseData);

    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});


netRouter.post('/nets/replace-netlist', upload.single("chunk"), async (req: Request, res: Response) => {
    try {
        req.setTimeout( 1000 * 60 * 8 ); // eight minutes
        
        /*
        Possible Scenarios:
            3) nets already exist and decision needs to be made regarding mapping/renaming (need to produce mapping file)
            4) nets already exist and mapping/replacement file was also supplied for assessment
        */
       
        let projectId : string = (req as any)?.body?.projectId?.trim()
        let netListFileName : string = (req as any)?.body?.netListFileName?.trim()
        
        let chunk = req?.file?.buffer;
        let chunkNumber = Number(req.body.chunkNumber); // Sent from the client
        let totalChunks = Number(req.body.totalChunks); // Sent from the client
        let originalname : string = (req as any)?.body?.originalname?.trim();
        let fileKey : string = (req as any)?.body?.fileKey?.trim();
        let filesInfoStr : string = (req as any)?.body?.filesInvolved?.trim() || '';
        let filesInfo = JSON.parse(filesInfoStr)

        let bufferInfoList : {name: string, buffer: Buffer}[] = await handleIncomingFileListChunk(projectId, chunk, fileKey, chunkNumber, totalChunks, originalname, filesInfo)
        if(bufferInfoList && bufferInfoList.length > 0) {
            await handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, false, true);
            let responseZip = await assessNetWranglingScenarios(bufferInfoList, projectId, netListFileName, false, false);
            if(responseZip) {
                responseZip = streamResponse(res, responseZip as any);
                return;
            }
            res.status(200).send({ payload: null } as ResponseData);
        }
        else {
            res.status(200).send({ payload: null } as ResponseData);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});


netRouter.post('/nets/upload-net-properties', upload.single("chunk"), async (req: Request, res: Response) => {
    try {
        let response = false;
        let projectId : string = (req as any)?.body?.projectId?.trim()
        let aspect : string = (req as any)?.body?.aspect?.trim()
        
        let chunk = req?.file?.buffer;
        let chunkNumber = Number(req.body.chunkNumber); // Sent from the client
        let totalChunks = Number(req.body.totalChunks); // Sent from the client
        let originalname : string = (req as any)?.body?.originalname?.trim();
        let fileKey : string = (req as any)?.body?.fileKey?.trim();
        let filesInfoStr : string = (req as any)?.body?.filesInvolved?.trim() || '';
        let filesInfo = JSON.parse(filesInfoStr)

        if(aspect.toLowerCase() === NetInfoUploadAspectEnum.LM.toLowerCase()) { aspect = NetInfoUploadAspectEnum.LM }
        if(aspect.toLowerCase() === NetInfoUploadAspectEnum.CUSTOM_PROPS.toLowerCase()) { aspect = NetInfoUploadAspectEnum.CUSTOM_PROPS }
        
        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        if(!projectId || projectId === 'undefined' || projectId.trim().length === 0){
            throw new Error(`Could not process net info file content. Input projectId is invalid`);
        }

        let project = await projRepo.GetWithId(projectId)
        if(!project) {
            throw new Error(`Could not find project in the system. project with ID '${projectId}' does not exist!`);
        }

        let bufferInfoList : {name: string, buffer: Buffer}[] = await handleIncomingFileListChunk(projectId, chunk, fileKey, chunkNumber, totalChunks, originalname, filesInfo)
        if(bufferInfoList && bufferInfoList.length > 0) {
            let bufferList = bufferInfoList.map(a => a.buffer)
            response = await processNetPropertiesUpload(bufferList[0], project, aspect, originalname);
        }
        else {
            response = true;
        }

        res.status(200).send({ payload: response } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});


//==============================================


netRouter.get("/nets/get-nets", async (req: Request, res: Response) => {
    try {
        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
        let result = new Array<Net>();

        let projectId : string = req.query.projectId?.toString() || ''
        let lastId : string = req.query.lastId?.toString() || ''
        let limit : string = req.query.limit?.toString() || ''

        let filterNetName : string = req.query.filterNetName?.toString()?.trim() || ''
        let filterInterfaceId : string = req.query.filterInterfaceId?.toString()?.trim() || ''
        let filterNetclassId : string = req.query.filterNetclassId?.toString()?.trim() || ''
        let filterNonClassifiedNetsOnly: boolean = (req.query.nonClassifiedNetsOnly && req.query.nonClassifiedNetsOnly?.toString().toLowerCase().trim() === "true") ? true : false
        let filterExcludeProps: boolean = (req.query.excludeProps && req.query.excludeProps?.toString().toLowerCase().trim() === "true") ? true : false
        let filterDiffPairedOnly: boolean = (req.query.diffPairedOnly && req.query.diffPairedOnly?.toString().toLowerCase().trim() === "true") ? true : false
        let filterNonDiffNetsOnly: boolean = (req.query.nonDiffNetsOnly && req.query.nonDiffNetsOnly?.toString().toLowerCase().trim() === "true") ? true : false

        let hasLastId = (!lastId || lastId === 'undefined' || lastId.trim().length === 0) ? false : true;
        let hasLimit = (!limit || limit === 'undefined' || limit.trim().length === 0) ? false : true;
        let filters = new Array<Filter<Net>>();
        let projectionSpec = null;

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to retrieve nets. Input 'projectId' cannot be null or empty or undefined`);
        }
        if (hasLimit && (isNumber(limit) === false)) {
            throw new Error(`Failed to retrieve nets. Input 'limit' must be a valid number.`);
        }
        if(hasLastId && (hasLimit === false)) {
            throw new Error(`Failed to retrieve nets. Input 'limit' is required when last/exclusionary net is provided.`);
        }
        if((filterDiffPairedOnly === true) && (filterNonDiffNetsOnly === true)) {
            throw new Error(`Query parameters are in conflict. Cannot specify to retrieve only diff-paired nets and also only non-diff-paired nets.`);
        }

        //=========================================================
        if(filterNetName && filterNetName.length > 0) {
            let regexName = getRegexFromFilterTextString(filterNetName)
            filters.push({ name: regexName } as Filter<Net>)
        }

        if(filterInterfaceId && filterInterfaceId.length > 0) {
            let regexIface = new RegExp(`^${filterInterfaceId}`, 'i');
            filters.push({ interfaceId: regexIface } as Filter<Net>)
        }

        if(filterNetclassId && filterNetclassId.length > 0) {
            let regexNetclass = new RegExp(`^${filterNetclassId}`, 'i');
            filters.push({ netclassId: regexNetclass } as Filter<Net>)
        }

        if(filterNonClassifiedNetsOnly === true) {
            filters.push({ netclassMapType: DataMappingTypeEnum.Unmapped } as Filter<Net>)
        }

        if(filterExcludeProps === true) {
            projectionSpec = { associatedProperties: 0 }
        }

        if(filterNonDiffNetsOnly === true) {
            filters.push({ diffPairMapType: DataMappingTypeEnum.Unmapped } as Filter<Net>)
        }

        
        if(filterDiffPairedOnly === true) {
            filters.push({ diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>)
        }
        //==============================================================
        
        if(hasLastId && hasLimit){
            result = await netRepo.PaginationGetPageByProjectIDAndProjection(projectId, filters, lastId, parseInt(limit.trim(), 10), projectionSpec)
        }
        else if ((hasLastId === false) && hasLimit){
            result = await netRepo.PaginationGetLastByProjectIDAndProjection(projectId, filters, parseInt(limit.trim(), 10), projectionSpec)
        }
        else {
            result = await netRepo.GetAllByProjectID(projectId)
        }

        //special case: for diff pair data retrieval, we want to specify the name of the diff-Net in context
        if(filterDiffPairedOnly) {
            result = await includeDiffPairNetNameInContext(result);
        }

        res.status(200).send({ payload: result } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


netRouter.post("/nets/update-nets", async (req: Request, res: Response) => {
    try {
        let netChangeInfo: NetMgmtCtx = req.body as NetMgmtCtx;
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;
        if (!netChangeInfo) {
            throw new Error(`Could not process net change operation because no valid data was provided for the operation`);
        }
        else if (!netChangeInfo.projectId || netChangeInfo.projectId === 'undefined' || netChangeInfo.projectId.trim().length === 0) {
            throw new Error(`Could not process net change operation because valid project info was provided for the operation`);
        }
        else if (!netChangeInfo.actionType || netChangeInfo.actionType.length === 0) {
            throw new Error(`Could not process net change operation because valid actionType was provided for the operation`);
        }

        netChangeInfo = await processNetChanges(netChangeInfo, user)
        res.status(200).send({ payload: netChangeInfo } as ResponseData);

    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
})


netRouter.post("/nets/automap", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let elementId : string = req.query.elementId?.toString() || ''

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!elementId || elementId === 'undefined' || elementId.trim().length === 0) {
            throw new Error(`Automap could not execute. A valid interface or netclass ID was not provided for automap process.`);
        }

        let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
        let ifRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION) 

        let netclasses: Netclass[] = []

        let ncl: Netclass = await ncRepo.GetWithId(elementId)
        if(ncl && ncl.projectId === projectId) { //checking projectId intentionally
            netclasses.push(ncl);
        }
        else {
            let ifc: Interface = await ifRepo.GetWithId(elementId)
            if(ifc && ifc.projectId === projectId) {  //checking projectId intentionally
                let filter = { interfaceId: ifc._id?.toString() as string } as Filter<Netclass>
                let ncList: Netclass[] = await ncRepo.GetAllByProjectID(ifc.projectId, filter)
                if(ncList && ncList.length > 0) { 
                    netclasses = Array.from(ncList) 
                }
            }
        }
        
        if(netclasses && netclasses.length > 0){
            await runAutoMapLogic(netclasses)
        }
        else {
            throw new Error(`Automap could not execute. Could not determine relevant interface and associated netclass(es) in order to process request.`);
        }

        res.status(200).send({ payload: true } as ResponseData);

    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
})


netRouter.post("/nets/clear-prop-values", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to retrieve c2c relation layout. Input 'projectId' cannot be null or empty or undefined`);
        }

        let result : boolean = await clearAllNetPropertyValues(projectId);
        
        res.status(200).send({ payload: result } as ResponseData);  
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


netRouter.get("/nets/get-summary-info", async (req: Request, res: Response) => {
    try {
        let excludeNetclassData = false;
        let projectId : string = req.query.projectId?.toString() || ''
        let exclInputStr : string = req.query.excludeNetclassData?.toString() || ''
        
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        if(exclInputStr.toLowerCase().trim() === "false") {
            excludeNetclassData = false;
        }
        else if(exclInputStr.toLowerCase().trim() === "true") {
            excludeNetclassData = true;
        }

        let netSummary = await getNetSummaryInfo(projectId, excludeNetclassData)

        res.status(200).send({ payload: netSummary } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
})












//===========================================================================================================
//===========================================================================================================


// async function handleIncomingChunk(projectId: string, chunk: any, fileKey: string, chunkNumber: number, totalChunks: number, originalname: string, filesInvolved: string[]) {
    
//     let buffer: Buffer|null = null;

//     const CHUNK_DIR_ROOT = path.resolve(`C:\\temp`);
//     const chunkDir = CHUNK_DIR_ROOT + `/chunks/${projectId}__${fileKey}`; 

//     if (!fs.existsSync(chunkDir)) {
//         fs.mkdirSync(chunkDir);
//     }

//     const chunkFilePath = `${chunkDir}/${originalname}.part_${chunkNumber}`;

//     await fs.promises.writeFile(chunkFilePath, chunk as any);
    
//     if (chunkNumber === totalChunks - 1) {
//         // If this is the last chunk, merge all chunks into a single file
//         buffer = await mergeChunks(originalname, totalChunks, chunkDir);
//         await fs.remove(chunkDir);

//     }

//     return buffer;
// }




// function chunkResponse(res: express.Response<any, Record<string, any>>, buffer: Buffer) {
//     let offset = 0;
//     const chunkSize = 1024 * 1024; //this is 1MB
//     function sendTheChunk() {
//         if (offset < buffer.length){
//             res.write(buffer.subarray(offset, offset + chunkSize));
//             offset += chunkSize;
//             process.nextTick(sendTheChunk);
//         }
//         else {
//             res.end();
//         }
//     }
//     sendTheChunk();

//     res.writeHead(200, {
//         'Content-Disposition': `attachment; filename="file.zip"`,
//         'Content-Type': 'application/octet-stream',
//         'Transfer-Encoding': 'chunked'
//     });

//     return buffer;
// }




// netRouter.post('/nets/upload-netlist2', upload.single("file"), async (req: Request, res: Response) => {
//     try {
//         let file = (req as any).file;

//         if(file) {
//             let projectId : string = (req as any)?.body?.projectId?.trim()
//             let forceCommit : string = (req as any)?.body?.forceCommit?.trim()

//             let response = await processNetUpload(file.buffer, file.originalname, projectId, forceCommit)
    
//             res.status(200).send({ payload: response } as ResponseData);
//         }
//         else {
//             throw new Error(`Could not process uploaded file content. Content was either invalid or empty`);
//         }
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// });


// netRouter.post('/nets/replace-netlist2', upload.array("files"), async (req: Request, res: Response) => {
//     try {
//         let files = (req as any).files;

//         if(files && files.length > 0) {
//             let netListFileName : string = (req as any)?.body?.netListFileName?.trim() ?? ""
//             let projectId : string = (req as any)?.body?.projectId?.trim()
    
//             let responseZip = await processNetReplacement(files, projectId, netListFileName)
//             if(responseZip) {
//                 res.writeHead(200, {
//                     'Content-Disposition': `attachment; filename="file.zip"`,
//                     'Content-Type': 'application/zip',
//                 })
//                 res.end(responseZip);
//                 return;
//             }
//             res.status(200).send({ payload: null } as ResponseData);
//         }
//         else {
//             throw new Error(`Could not process uploaded file content. Content was either invalid or empty`);
//         }
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// });


// netRouter.post('/nets/upload-net-properties2', upload.single("file"), async (req: Request, res: Response) => {
//     try {
//         let buf : Buffer = (req as any)?.file?.buffer
//         let projectId = (req as any)?.body?.projectId?.trim()
//         let aspect = (req as any)?.body?.aspect?.trim()
//         let fileName = (req as any)?.file?.originalname?.trim()

//         if(aspect.toLowerCase() === NetInfoUploadAspectEnum.LM.toLowerCase()) { aspect = NetInfoUploadAspectEnum.LM }
//         if(aspect.toLowerCase() === NetInfoUploadAspectEnum.CUSTOM_PROPS.toLowerCase()) { aspect = NetInfoUploadAspectEnum.CUSTOM_PROPS }
        
//         let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
//         if(!projectId || projectId === 'undefined' || projectId.trim().length === 0){
//             throw new Error(`Could not process net info file content. Input projectId is invalid`);
//         }

//         let project = await projRepo.GetWithId(projectId)
//         if(!project) {
//             throw new Error(`Could not find project in the system. project with ID '${projectId}' does not exist!`);
//         }

//         let updateStatus: boolean = await processNetPropertiesUpload(buf, project, aspect, fileName);

//         res.status(200).send({ payload: updateStatus } as ResponseData);
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// });

//====================================





//=========================================================

    // const CHUNK_DIR_ROOT = path.resolve(`C:\\temp`);
    // const chunkDir = CHUNK_DIR_ROOT + `/chunks/${projectId}__${fileKey}`; // Directory to save chunks
    // // const mergedFilePath = CHUNK_DIR_ROOT + `/merged_files/${projectId}__${pathKey}`;

    // if (!fs.existsSync(chunkDir)) {
    //     fs.mkdirSync(chunkDir);
    // }

    // const chunkFilePath = `${chunkDir}/${originalname}.part_${chunkNumber}`;

    // await fs.promises.writeFile(chunkFilePath, chunk as any);
    // // console.log(`Chunk ${chunkNumber}/${totalChunks} saved`);

    // if (chunkNumber === totalChunks - 1) {
    //     // If this is the last chunk, merge all chunks into a single file
    //     buffer = await mergeChunks(originalname, totalChunks, chunkDir)//, mergedFilePath);
    //     // console.log("File merged successfully");
    //     // fs.rm(chunkDir, { recursive: true, force: true } as any)
        
    //     await fs.remove(chunkDir)

    //     response = await processNetUpload(buffer, originalname, projectId, forceCommit)
    // }
    // else {
    //     response = true;
    // }

//=====================================

// , err => {
//     if (err){
//         return console.error(err);
//     }
//     console.log(`successfully deleted the following directory: ${chunkDir}`)
// })


// } catch (error) {
    //     console.error("Error saving chunk:", error);
    //     res.status(500).json({ error: "Error saving chunk" });
    // }


// const chunk = req.file.buffer;
    // const chunkIndex = parseInt(req.body.chunkIndex, 10);
    // const totalChunks = parseInt(req.body.totalChunks, 10);
  
    // // Process the chunk line by line
    // const lines = chunk.toString().split('\n');
    // lines.forEach((line) => {
    //   // Process each line
    //   console.log(line);
    // });
  
    // if (chunkIndex === totalChunks - 1) {
    //   // All chunks have been received and processed
    //   res.status(200).send('Upload complete');
    // } else {
    //   res.status(200).send('Chunk received');
    // }

























// netRouter.get("/nets/get-net-details", async (req: Request, res: Response) => {
//     try {
//         let netId : string = req.query.netId?.toString() || ''
//         if (!netId || netId === 'undefined' || netId.trim().length === 0) {
//             throw new Error(`Input 'netId' cannot be null or empty or undefined`);
//         }
//         let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
//         let net = await netRepo.GetWithId(netId)

//         if(!net) {
//             throw new Error("Net was not found in the system!")
//         }

//         res.status(200).send({ payload: net } as ResponseData);
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// });



// //TBD
// //TODO:
// //upload or update net information
// netRouter.post("/nets/upload-net-properties", async (req: Request, res: Response) => {
//     try {
        

//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// })


// //TBD
// //TODO:
// //download net information
// netRouter.get("/nets/download-net-properties", async (req: Request, res: Response) => {
//     try {
        

//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// })










// netRouter.get("/nets/get-property-settings", async (req: Request, res: Response) => {
//     try {
//         let projectId : string = req.query.projectId?.toString() ?? ''
//         let org: string = req.query.org?.toString() ?? ''

//         if (!org || org === 'undefined' || org.trim().length === 0) {
//             throw new Error(`Input 'org' cannot be null or empty or undefined`);
//         }

//         let constraintprops = await getNetPropertySettingsForOrg(org)
//         res.status(200).send({ payload: constraintprops ?? [] } as ResponseData);
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// });

