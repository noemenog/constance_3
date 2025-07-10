import express, { Request, Response } from "express";
import { BaseUserInfo, BasicProperty, PropertyItem, ResponseData, User } from "../../Models/HelperModels";
import { AppConfigConstants, ErrorSeverityValue } from "../../Models/Constants";
import { isNumber, rfdcCopy } from "../../BizLogic/UtilFunctions";
// import { ChangeContext,  ConfigItem,  SnapshotContext } from "../../Models/ServiceModels";
import { sort } from "fast-sort";
import { Filter, ObjectId } from "mongodb";
import { ConstanceRepo } from "../../Repository/ConstanceRepo";
import { ConfigItem } from "../../Models/ServiceModels";





export const commonRouter = express.Router();


commonRouter.get("/init/get-configs", async (req: Request, res: Response) => {
    try {     
        let constanceRepo = new ConstanceRepo();
        let processedGenConfigs: ConfigItem[] = await constanceRepo.getConfigs(AppConfigConstants.BUCKETID__MAIN_GENERAL_CONFIG) ?? [];

        res.status(200).send({ payload: processedGenConfigs ?? [] } as ResponseData);
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




//==========================================================================================================================
//#region =========================================== FOR CORRECTIONS ======================================================
commonRouter.get("/corrections/execute", async (req: Request, res: Response) => {
    try {
        const exekey = req.headers.exekey?.toString()?.trim() || null;
        const host = req.headers.host?.toString()?.trim() || null;
        if(!exekey || exekey !== "6dba499d-d4ea-4e85-8978-fb26f7eb3083__5e24194a-105e-4133-bf5c-85b6cca8574c" || host !== "localhost:7000") {
            throw new Error(`Sorry buddy! Execution is unauthorized!`);
        }
        
        //do stuff here....

        res.status(200).send({ payload: "Process completed successfully!" } as ResponseData);
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
//#endregion ================================================================================================================









