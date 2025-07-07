import express, { Request, Response } from "express";
import { getInterfaceTemplatesForOrg } from "../../BizLogic/ConfigLogic";
import { EditorNotesData, ResponseData, StorageCollateralInfo } from "../../Models/HelperModels";
import { Interface } from "../../Models/ServiceModels";
import { DBCollectionTypeEnum, ErrorSeverityValue, InterfaceInitTypeEnum } from "../../Models/Constants";
import { addNetclassesToInterfaceContext, createInterface, deleteInterface, saveInterfaceSetupAsTemplate, updateInterface } from "../../BizLogic/InterfaceLogic";
import { BaseRepository } from "../../Repository/BaseRepository";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import multer from "multer";
import { getCollaterals, uploadCollaterals, discardCollaterals, downloadCollateral } from "../../BizLogic/StorageFilesLogic";



const upload = multer({ storage: multer.memoryStorage() })

export const interfaceRouter = express.Router();


interfaceRouter.get("/interface/get-interfacelist", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
        let projection = { name: 1 }
        let result = await ifaceRepo.GetAllByProjectIDAndProjection(projectId, null, projection)

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


interfaceRouter.get("/interface/get-interface", async (req: Request, res: Response) => {
    try {
        let interfaceId : string = req.query.interfaceId?.toString() || ''
        if (!interfaceId || interfaceId === 'undefined' || interfaceId.trim().length === 0) {
            throw new Error(`Input 'interfaceId' cannot be null or empty or undefined`);
        }
        let ifaceRepo = new BaseRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
        let iface = await ifaceRepo.GetWithId(interfaceId)

        if(!iface) {
            throw new Error("interface was not found in the system!")
        }
        
        iface = await addNetclassesToInterfaceContext(iface);
        
        res.status(200).send({ payload: iface } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.get("/interface/get-templates", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let org: string = req.query.org?.toString() || ''

        if (!org || org === 'undefined' || org.trim().length === 0) {
            throw new Error(`Input 'org' cannot be null or empty or undefined`);
        }

        let tplList = await getInterfaceTemplatesForOrg(org)
        res.status(200).send({ payload: tplList?.templates ?? [] } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.post("/interface/create", async (req: Request, res: Response) => {
    // REGARDING INTERFACE IMPORT:
    // TODO:  On the UI side we need to determine right off the bat if the source interface has clearance relations from self to other interface (The 'ACROSS' scenarios)
    // 		If so, we must warn the user that those relations will not carry over - mention the relations. 
    // 
    
    // NOTE: for now only external import is supported. 
    //      If we are to allow in-project copy, we have to change initializationType to something other than 'InterfaceInitTypeEnum.EXTERNAL_IMPORT'

    try {
        const iface: Interface = req.body as Interface;
        
        let userStr = req.headers.user?.toString()
        let user;
        if(userStr && userStr.length > 0){
            user = JSON.parse(userStr)
        }

        if (iface && iface.name.length > 0) {
            if(iface && iface.initializationType !== InterfaceInitTypeEnum.FRESH) {
                req.setTimeout( 1000 * 60 * 8 ); // eight minutes max
            }
            let insertedInterface = await createInterface(iface, user);
            
            insertedInterface = await addNetclassesToInterfaceContext(insertedInterface);
            
            res.status(200).send({ payload: insertedInterface } as ResponseData);
        }
        else {
            throw new Error(`Could not add new interface because no valid interface info was provided for the operation`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.post("/interface/update", async (req: Request, res: Response) => {
    try {
        const iface: Interface = req.body as Interface;

        if (iface && iface.name.length > 0) {
            let updatedInterface = await updateInterface(iface);
            updatedInterface = await addNetclassesToInterfaceContext(updatedInterface);

            res.status(200).send({ payload: updatedInterface } as ResponseData);
        }
        else {
            throw new Error(`Could not update interface because no valid interface info was provided for the operation`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.post("/interface/save-as-template", async (req: Request, res: Response) => {
    try {
        const iface: Interface = req.body as Interface;
        
        let userStr = req.headers.user?.toString()
        let user;
        if(userStr && userStr.length > 0){
            user = JSON.parse(userStr)
        }

        if (iface && iface.name.length > 0) {
            let template = await saveInterfaceSetupAsTemplate(iface, user);
            res.status(200).send({ payload: template } as ResponseData);
        }
        else {
            throw new Error(`Could not save interface setup as template because no valid info was provided for the operation`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.delete("/interface/delete", async (req: Request, res: Response) => {
    try {
        let interfaceId : string = req.query.interfaceId?.toString() || ''
        let projectId : string = req.query.projectId?.toString() || ''
        
        if (!interfaceId || interfaceId === 'undefined' || interfaceId.trim().length === 0) {
            throw new Error(`Input 'interfaceId' cannot be null or empty or undefined`);
        }
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let isDeleted : boolean = await deleteInterface(projectId, [interfaceId]);
        res.status(200).send({ payload: isDeleted } as ResponseData);
        
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.get('/interface/get-collaterals', async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let interfaceId : string = req.query.interfaceId?.toString() || ''

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!interfaceId || interfaceId === 'undefined' || interfaceId.trim().length === 0) {
            throw new Error(`Input 'interfaceId' cannot be null or empty or undefined`);
        }

        let response : StorageCollateralInfo[] = await getCollaterals(projectId, interfaceId)
        res.status(200).send({ payload: response } as ResponseData);
        
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.post('/interface/upload-collaterals', upload.array("files"), async (req: Request, res: Response) => {
    try {
        let files = (req as any).files;
        let projectId = (req as any)?.body?.projectId || req.query.projectId?.toString() || ''
        let interfaceId = (req as any)?.body?.interfaceId || req.query.interfaceId?.toString() || ''

        if(files) {
            if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
                throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
            }
            if (!interfaceId || interfaceId === 'undefined' || interfaceId.trim().length === 0) {
                throw new Error(`Input 'interfaceId' cannot be null or empty or undefined`);
            }

            let response : any[] = await uploadCollaterals(files, projectId, interfaceId)
            res.status(200).send({ payload: response } as ResponseData);
        }
        else {
            throw new Error(`Could not process uploaded file content. Content was either invalid or empty`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.delete('/interface/delete-collaterals', async (req: Request, res: Response) => {
    try {
        const inputStorageCollateralList = req.body as StorageCollateralInfo[];
        
        if(!inputStorageCollateralList || inputStorageCollateralList.length === 0){
            throw new Error(`Input interface collateral data cannot be null or empty or undefined`);
        }
    
        for(let i = 0; i < inputStorageCollateralList.length; i++) {
            let collat = inputStorageCollateralList[i]
            if(!collat.projectId || collat.projectId.trim().length === 0 || collat.projectId.toLowerCase() === "undefined"){
                throw new Error(`'projectId' for interface collateral item cannot be null or empty or undefined`);
            }
            if(!collat.interfaceId || collat.interfaceId.trim().length === 0 || collat.interfaceId.toLowerCase() === "undefined"){
                throw new Error(`'interfaceId' for interface collateral item cannot be null, empty, undefined`);
            }
            if(!collat.name || collat.name.trim().length === 0 || collat.name.toLowerCase() === "undefined"){
                throw new Error(`'name' for interface collateral item cannot be null, empty, undefined`);
            }
        }

        if(inputStorageCollateralList.every(a => a.projectId === inputStorageCollateralList[0].projectId) === false) {
            throw new Error(`All input interface collateral data must have same projectId`);
        }
        if(inputStorageCollateralList.every(a => a.interfaceId === inputStorageCollateralList[0].interfaceId) === false) {
            throw new Error(`All input interface collateral data must have same interfaceId`);
        }

        let remainingCollaterals = await discardCollaterals(inputStorageCollateralList)
        res.status(200).send({ payload: remainingCollaterals ?? [] } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.get('/interface/download-collaterals', async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let interfaceId : string = req.query.interfaceId?.toString() || ''
        let fileName: string = req.query.fileName?.toString() || ''

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!interfaceId || interfaceId === 'undefined' || interfaceId.trim().length === 0) {
            throw new Error(`Input 'interfaceId' cannot be null or empty or undefined`);
        }
        if (!fileName || fileName === 'undefined' || fileName.trim().length === 0) {
            throw new Error(`Input 'fileName' cannot be null or empty or undefined`);
        }

        let response = await downloadCollateral(projectId, interfaceId, fileName)
        
        if(response) {
            res.setHeader('Content-Type', response.headers['content-type']);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(response.data);
            return;
        }
        
        res.status(200).send({ payload: null } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


interfaceRouter.post("/interface/save-editor-notes", async (req: Request, res: Response) => {
    try {
        const notesData = req.body as EditorNotesData;
        let projectId : string = req.query.projectId?.toString() || ''
        let interfaceId : string = req.query.interfaceId?.toString() || ''

        if(!notesData){
            throw new Error(`Failed to save interace notes. No data provided`);
        }
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!interfaceId || interfaceId === 'undefined' || interfaceId.trim().length === 0) {
            throw new Error(`Input 'interfaceId' cannot be null or empty or undefined`);
        }

        let ifaceRepo = new BaseRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
        let iface = await ifaceRepo.GetWithId(interfaceId)

        if(!iface) {
            throw new Error("interface was not found in the system!")
        }

        let ifaceToUpdate = {...iface}
        ifaceToUpdate.notes = notesData;
        let isUpdated : boolean = await ifaceRepo.ReplaceOne(ifaceToUpdate);
        
        res.status(200).send({ payload: isUpdated } as ResponseData);
        
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});
















    // NOTE: Currently on the UI, user does not have option to make the system default numbers instead of setting a specific RA/LG mapping
    //		consider whether this is ok or not moving fwd....