import express, { Request, Response } from "express";
import { ErrorSeverityValue } from "../../Models/Constants";


export const validationsRouter = express.Router();



validationsRouter.get("/validation/get-data", async (req: Request, res: Response) => {
    try {
        res.send('Hello!! v1.0 Validations GET API is not yet implemented');
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});
