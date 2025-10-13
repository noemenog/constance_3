import express, { Request, Response } from "express";
import crypto from "crypto"
import { EnvTypeEnum, ErrorSeverityValue } from "../../Models/Constants";
import { ResponseData, User } from "../../Models/HelperModels";
import { ConfigItem } from "../../Models/ServiceModels";
import { getConfigCollection } from "../../dbConn";
import { performConfigAdd, performConfigDelete, performConfigRetrieval, performConfigUpdate } from "../../BizLogic/ConfigItemLogic";
import { GetEnvironmentType } from "../../BizLogic/BasicCommonLogic";
import { ObjectId } from "mongodb";


export const configRouter = express.Router();

//======================== Available to External Apps =================================================
//========================================================================================================

//example: http://localhost:7000/api/v2/Dev/configs/get?appId=652edc617bf62deaf2ab3e66&bucketId=6532a93b70c6716199811fe6&key[]=something3&key[]=something4
configRouter.get("/:env/configs/get", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
        let appId : string = req.query.appId?.toString() ?? ''
        if (!appId || appId === 'undefined' || appId.trim().length === 0) {
            throw new Error(`Input 'appId' cannot be null or empty or undefined`);
        }
        else if (!ObjectId.isValid(appId)) {
            throw new Error(`Input 'appId' is not a valid id.Note app name is not a valid input`);
        }

        let bucketId : string = req.query.bucketId?.toString() ?? ''
        if (!bucketId) {
            throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
        }
        else if (!ObjectId.isValid(bucketId)) {
            throw new Error(`Input 'bucketId' is not a valid id.Note bucket name is not a valid input`);
        }

        const { key = [] } = req.query ?? new Array<string>();
        const queryConfigItemNames = (key as string[])?.map((x: string) => x.toLowerCase().trim()) ?? [];
        
        let configs = await performConfigRetrieval(env, appId, bucketId, queryConfigItemNames) ?? new Array<ConfigItem>();

        res.status(200).send({ payload: configs } as ResponseData);

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


configRouter.post("/:env/configs/add", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);

        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
        if(!user || !user.email || !user.idsid || user.email.trim().length === 0 || user.idsid.trim().length === 0) {
            throw new Error(`Could not update configs because user information is either invalid or not provided in the request`);
        }

        const configs: ConfigItem[] = req.body as ConfigItem[];
        if (configs && configs.length > 0) {
            let bucketConfigs = await performConfigAdd(env, configs, false, user);
            res.status(200).send({ payload: bucketConfigs } as ResponseData);
        }
        else {
            throw new Error(`Could not add new configs because no valid set of configs were provided for the operation`);
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


configRouter.post("/:env/configs/update", async (req: Request, res: Response) => {
    try {
        let env : EnvTypeEnum = GetEnvironmentType(req.params.env);

        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
        if(!user || !user.email || !user.idsid || user.email.trim().length === 0 || user.idsid.trim().length === 0) {
            throw new Error(`Could not update configs because user information is either invalid or not provided in the request`);
        }

        const configs: ConfigItem[] = req.body as ConfigItem[];
        if (configs && configs.length > 0) {

            let bucketConfigs = await performConfigUpdate(env, configs, false, user);
            res.status(200).send({ payload: bucketConfigs } as ResponseData);

        }
        else {
            throw new Error(`Could not update configs because no valid set of configs were provided for the operation`);
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
//========================================================================================================
//========================================================================================================


configRouter.delete("/:env/configs/delete", async (req: Request, res: Response) => {
    try {
        const configs: ConfigItem[] = req.body as ConfigItem[];
        if (configs && configs.length > 0) {
            let env : EnvTypeEnum = GetEnvironmentType(req.params.env);
            let isDeleted : boolean = await performConfigDelete(env, configs);
            res.status(200).send({ payload: isDeleted } as ResponseData);
        }
        else {
            throw new Error(`Could not delete configs because no valid set of configs were selected for the operation`);
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



