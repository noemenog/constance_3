
// PLACEHOLDER FILE, with PLACEHOLDER CODE



import express, { Request, Response } from "express";


export const interfaceRouter = express.Router();

interfaceRouter.get("/get/iface", async (req: Request, res: Response) => {
    try {
        res.send('Hello! v2.0 of [interfaceRouter] operations is not yet implemented.... Stay tuned...');
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: "ERROR", message: e.message }
        }
        res.status(500).json(resp);
    }
});
