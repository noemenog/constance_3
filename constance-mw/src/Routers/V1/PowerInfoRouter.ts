import multer from "multer";
import express, { Request, Response } from "express";
import { DBCollectionTypeEnum, ErrorSeverityValue, PowerInfoAspectEnum } from "../../Models/Constants";
import { ResponseData } from "../../Models/HelperModels";
import { PowerInfo } from "../../Models/ServiceModels";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { processPowerInfoUpload, saveOrCreatePowerInfo } from "../../BizLogic/PowerinfoLogic";



const upload = multer({ storage: multer.memoryStorage() })

export const powerInfoRouter = express.Router();



powerInfoRouter.get("/power/get-powerinfo", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        
        let piRepo = new ServiceModelRepository<PowerInfo>(DBCollectionTypeEnum.POWER_INFO_COLLECTION)
        let result = await piRepo.GetOneByProjectID(projectId)

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



powerInfoRouter.post('/power/upload-data', upload.single("file"), async (req: Request, res: Response) => {
    try {
        let buf : Buffer = (req as any)?.file?.buffer
        let projectId = (req as any)?.body?.projectId?.trim()
        let aspect = (req as any)?.body?.aspect?.trim()
        let fileName = (req as any)?.file?.originalname?.trim()

        if(aspect.toLowerCase() === PowerInfoAspectEnum.RAILS.toLowerCase()) { aspect = PowerInfoAspectEnum.RAILS }
        if(aspect.toLowerCase() === PowerInfoAspectEnum.COMPONENTS.toLowerCase()) { aspect = PowerInfoAspectEnum.COMPONENTS }
            
        let updatedPowerInfo: PowerInfo = await processPowerInfoUpload(buf, projectId, aspect, fileName);

        res.status(200).send({ payload: updatedPowerInfo } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
    
});



powerInfoRouter.post("/power/save-powerinfo", async (req: Request, res: Response) => {
    try {
        const inputPowerInfo = req.body as PowerInfo;
        
        let replaceAll: boolean = (req.query.replaceAll && req.query.replaceAll?.toString().toLowerCase().trim() === "true") ? true : false
        let replaceRails: boolean = (req.query.replaceRails && req.query.replaceRails?.toString().toLowerCase().trim() === "true") ? true : false
        let replaceComponents: boolean = (req.query.replaceComponents && req.query.replaceComponents?.toString().toLowerCase().trim() === "true") ? true : false
        
        let updatedPowerInfo : PowerInfo;
        if(replaceAll === true) {
            updatedPowerInfo = await saveOrCreatePowerInfo(inputPowerInfo, true, true)
        }
        else {
            updatedPowerInfo = await saveOrCreatePowerInfo(inputPowerInfo, replaceRails, replaceComponents)
        }
        
        res.status(200).send({ payload: updatedPowerInfo } as ResponseData);

    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});

