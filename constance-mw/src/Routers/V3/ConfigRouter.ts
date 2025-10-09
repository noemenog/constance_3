import express, { Request, Response } from "express";
import * as mongo from "mongodb";
import { performConfigAdd, performConfigRetrieval, performConfigUpdate } from "../../Deprecated/midwareUtils";
import crypto from "crypto"
import { ErrorSeverityValue } from "../../Models/Constants";
import { ResponseData } from "../../Models/HelperModels";
import { ConfigItem } from "../../Models/ServiceModels";
import { getConfigCollection } from "../../dbConn";


export const configRouter = express.Router();

//======================== Available to External Apps =================================================
//========================================================================================================

//example: http://localhost:7000/api/v2/Dev/configs/get?appId=652edc617bf62deaf2ab3e66&bucketId=6532a93b70c6716199811fe6&key[]=something3&key[]=something4
configRouter.get("/:env/configs/get", async (req: Request, res: Response) => {
    try {
        let focusApp : string = req.query.appId?.toString() ?? ''
        if (!focusApp) {
            throw new Error(`Input 'appId' cannot be null or empty or undefined`);
        } 
        let focusBucket : string = req.query.bucketId?.toString() ?? ''
        if (!focusBucket) {
            throw new Error(`Input 'bucketId' cannot be null or empty or undefined`);
        }
        let configs = await performConfigRetrieval(req.params.env, focusApp, focusBucket, req.query) ?? new Array<ConfigItem>();

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
        const configs: ConfigItem[] = req.body as ConfigItem[];
        
        if (configs && configs.length > 0) {
            let addedConfs = await performConfigAdd(req.params.env, configs, false);
            res.status(200).send({ payload: addedConfs } as ResponseData);
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
    //WARNING:
    //WARNING: //WE need to update ONLY the items that have experienced change!!!!
    //WARNING:
    try {
        const configs: ConfigItem[] = req.body as ConfigItem[];

        if (configs && configs.length > 0) {
            const collection = getConfigCollection(req.params.env);
            let incomingConfIdArr: (string | mongo.ObjectId )[] = [];
            let incomingConfigNameArr: string[] = [];
            for (const item in configs) {
                const cid = configs[item]?._id ?? ""
                const cName = configs[item]?.name ?? ""
                
                if(cid && cid.toString().length > 0) {
                    incomingConfIdArr.push(new mongo.ObjectId(cid));
                }
                else if (cName && cName.toString().length > 0) {
                    incomingConfigNameArr.push(cName);
                }
                else {
                    throw new Error("Cannot update config item(s). All input configs items must have valid IDs")
                }
            }
            
            let expression = { $or: [ {_id: { $in: incomingConfIdArr } as any }, {configName: { $in: incomingConfigNameArr } as any } ]};
            const foundConfs = (await collection.find(expression).toArray()) as ConfigItem[];

            let foundIdStrs = foundConfs?.map((a, i) => a._id?.toString()) ?? [];
            let foundNames = foundConfs?.map((a, i) => a.name?.toString()) ?? [];
            
            let nonExistent = [];

            if(foundConfs && foundConfs.length > 0) {
                
                let incomingConfIdStrArr : string[] = incomingConfIdArr.map((a, i) => a.toString())
                for(let x = 0; x < incomingConfIdStrArr.length; x++) {
                    if(foundIdStrs.includes(incomingConfIdStrArr[x]) == false) {
                        nonExistent.push(foundConfs[x])  
                    }
                }
                
                for(let y = 0; y < incomingConfigNameArr.length; y++) {
                    if(foundNames.includes(incomingConfigNameArr[y]) == false) {
                        nonExistent.push(foundConfs[y])  
                    }
                }

                if (configs.length !== foundConfs.length) {
                    throw new Error("Cannot perform update. Input config(s) were not found in the system")
                }
                else if (nonExistent.length > 0) {
                    throw new Error("Cannot perform update. Input config(s) were not found in the system")
                }
                else {
                    for(let x = 0; x < configs.length; x++) {
                        if(!configs[x]._id){
                            let foundFltr = foundConfs.filter(a => a.name === configs[x].name)
                            if(foundFltr && foundFltr.length > 0){
                                configs[x]._id = foundFltr[0]._id;
                            }
                        }
                    }

                    let updatedConfigs = await performConfigUpdate(req.params.env, configs, false);
                    res.status(200).send({ payload: updatedConfigs } as ResponseData);
                }
            }
            else {
                throw new Error("Cannot update config item(s). All input configs items must already exist")
            }
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
            const collection = getConfigCollection(req.params.env);
            const deleteList = configs.map((x: ConfigItem) => new mongo.ObjectId(x._id?.toString() as string));

            collection.deleteMany({ _id: { $in: deleteList } as any }).then((delRes => {
                if (delRes && delRes.deletedCount > 0 && delRes.deletedCount === deleteList.length) {
                    res.status(200).send({ payload: true } as ResponseData);
                }
                else {
                    res.status(200).send({ payload: false } as ResponseData);
                }
            }));
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



