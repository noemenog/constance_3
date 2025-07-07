import express, { Request, Response } from "express";
import { SnapshotContext } from "../../Models/ServiceModels";
import { ResponseData } from "../../Models/HelperModels";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { checkIncomingSnapshotContexts, createAutoGenSnapshot, createSnapshot, deleteSnapshots, restoreSnapshot } from "../../BizLogic/SnapShotLogic";
import { DBCollectionTypeEnum, ErrorSeverityValue } from "../../Models/Constants";
import { Filter, ObjectId } from "mongodb";


export const snapshotRouter = express.Router();


snapshotRouter.get("/snapshot/get-snapshots", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''       
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let excludeConponentEntries: boolean = (req.query.excludeConponentEntries?.toString().trim().toLowerCase() === "true") ? true : false;
        let filter = { enabled : true } as Filter<SnapshotContext>
        let snaps : SnapshotContext[] = new Array<SnapshotContext>();
        
        let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)

        if(excludeConponentEntries === true) {
            let projection = { components: 0 }  //as of now, there is never really a need to return components to UI
            snaps = await snapRepo.GetAllByProjectIDAndProjection(projectId, filter, projection)
        }
        else {
            snaps = await snapRepo.GetAllByProjectID(projectId, filter)
        }

        res.status(200).send({ payload: snaps ?? []} as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


snapshotRouter.post("/snapshot/create-snapshot", async (req: Request, res: Response) => {
    try {
        const snapInfo: SnapshotContext = req.body as SnapshotContext;
        checkIncomingSnapshotContexts([snapInfo], false);
        let snapContextList : SnapshotContext[] = await createSnapshot(snapInfo.projectId, snapInfo.name); 
        
        res.status(200).send({ payload: snapContextList } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


snapshotRouter.post("/snapshot/restore-snapshot", async (req: Request, res: Response) => {
    try {
        const snapInfo: SnapshotContext = req.body as SnapshotContext;
        checkIncomingSnapshotContexts([snapInfo])
        let snapCtxId = snapInfo._id?.toString() as string

        let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
        let snapCtxForRestore = await snapRepo.GetOneByProjectIDAndItemID(snapInfo.projectId, snapCtxId)

        if(snapCtxForRestore){
            req.setTimeout( 1000 * 60 * 8 ); // eight minutes
            await createAutoGenSnapshot(snapCtxForRestore.projectId); //intentionally not returning anything for now...
            let snapContextListPostRestore : SnapshotContext[] = await restoreSnapshot(snapCtxForRestore); 
            
            res.status(200).send({ payload: snapContextListPostRestore } as ResponseData);
        }
        else{
            throw new Error(`Could not find snapshot with the name '${snapInfo.name}. Restoration process cannot proceed`);
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


snapshotRouter.delete("/snapshot/delete-snapshot", async (req: Request, res: Response) => {
    try {
        const inputSnapCtxList = req.body as SnapshotContext[];
        checkIncomingSnapshotContexts(inputSnapCtxList)

        let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
        
        const snapIdList : ObjectId[] = inputSnapCtxList.map((x: SnapshotContext) => new ObjectId(x._id));
        let inFilter = { _id: { $in: snapIdList } as any } as Filter<SnapshotContext>
        let snapInfoList = await snapRepo.GetAllByProjectID(inputSnapCtxList[0].projectId, inFilter)
        
        let remainingSnapshotContexts = await deleteSnapshots(snapInfoList)
        res.status(200).send({ payload: remainingSnapshotContexts ?? [] } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});

