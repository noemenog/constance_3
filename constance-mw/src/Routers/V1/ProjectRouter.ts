import multer from "multer";
import express, { Request, Response } from "express";
import { LinkageInfo, Project } from "../../Models/ServiceModels";
import { BaseRepository } from "../../Repository/BaseRepository";
import { BasicKVP, BasicProperty, EditorNotesData, PropertyItem, ResponseData, StatusIndicatorItem, User } from "../../Models/HelperModels";
import { cloneProject, createProject, deleteProject, determineProjectStatus, updateProject, updateProjectClearanceRelationBrands, updateProjectPropertyCategoryInFull, verifyProjectLinkageContext } from "../../BizLogic/ProjectLogic";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { DBCollectionTypeEnum, ErrorSeverityValue, KeyProjectAspectTypeEnum, ProjectDataDownloadContentTypeEnum, ProjectPropertyCategoryEnum } from "../../Models/Constants";
import { produceXpeditionConstraintExportZip } from "../../BizLogic/ExportExpeditionLogic";
import { produceAPDConstraintExportZip } from "../../BizLogic/ExportAPDLogic";
import { producePdrdExportContent } from "../../BizLogic/ExportPDRDLogic";
import { deleteGenericNoteImageCollaterals, uploadGenericNoteImageCollaterals } from "../../BizLogic/StorageFilesLogic";
import { getEnumValuesAsArray } from "../../BizLogic/UtilFunctions";
import { assessLinkageRelatedLGCs } from "../../BizLogic/ConstraintsMgmtLogic";
import { sort } from "fast-sort";
import { Filter, ObjectId } from "mongodb";



const upload = multer({ storage: multer.memoryStorage() })


export const projectRouter = express.Router();


projectRouter.get("/project/get-projectlist", async (req: Request, res: Response) => {
    try {
        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        let filter = { enabled : true } as Filter<Project>
        let projection = { name: 1, org: 1, owner: 1, createdOn: 1, lockedBy: 1, description: 1 }
        let result = await projRepo.GetByFilterAndProjection(filter, projection)
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


projectRouter.get("/project/get-project", async (req: Request, res: Response) => {
    try {
        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        
        let projectId : string = req.query.projectId?.toString() || ''
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        
        let assocPropFocus: boolean = (req.query.assocPropFocus?.toString()?.trim()?.toLowerCase() === "true") ? true : false;

        let proj : Project;
        if(assocPropFocus) {
            let projFilter = { _id: new ObjectId(projectId) } as Filter<Project>;
            let projection = { _id: 1, name: 1, associatedProperties: 1 }
            proj = (await projRepo.GetByFilterAndProjection(projFilter, projection))?.at(0)
        }
        else {
            proj = await projRepo.GetWithId(projectId)
        }

        res.status(200).send({ payload: proj } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


projectRouter.post("/project/create", async (req: Request, res: Response) => {
    let insertedProject : Project|null = null;
    try {
        const project: Project = req.body as Project;
        
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
        
        if(!user || !user.email || !user.idsid || user.email.trim().length === 0 || user.idsid.trim().length === 0) {
            throw new Error(`Could not add new project because user information is either invalid or not provided in the request`);
        }
        if (project && project.name.length > 0) {
            insertedProject = await createProject(project, user);
            res.status(200).send({ payload: insertedProject } as ResponseData);
        }
        else {
            throw new Error(`Could not add new project because no vali project info was provided for the operation`);
        }
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        if(insertedProject) { deleteProject(insertedProject._id?.toString() as string); }
        res.status(500).json(resp);
    }
});


projectRouter.post("/project/update", async (req: Request, res: Response) => {
    try {
        const project: Project = req.body as Project;
        
        if (project && project.name.length > 0) {
            let updatedProject = await updateProject(project);
            res.status(200).send({ payload: updatedProject } as ResponseData);
        }
        else {
            throw new Error(`Could not update project because no valid project info was provided for the operation`);
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


projectRouter.post("/project/update-key-aspect", async (req: Request, res: Response) => {
    try {
        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        let updatedProject : Project;

        let projectId : string = req.query.projectId?.toString().trim() || ''
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        let inputKVP: BasicKVP = req.body as BasicKVP;
        if (!inputKVP || !inputKVP.value) {
            throw new Error(`Input data is invalid. System cannot proceed with updates.`);
        }

        let aspect : string = inputKVP.key?.toString().trim() || ''
        if (!aspect || aspect === 'undefined' || aspect.trim().length === 0) {
            throw new Error(`Input 'aspect' cannot be null or empty or undefined`);
        }

        let project = await projRepo.GetWithId(projectId)
        if(!project) {
            throw new Error(`Project update cannot proceed. A project with same ID was not found in the system.`);
        }
        
        let projPropCategs = getEnumValuesAsArray(ProjectPropertyCategoryEnum, true);
        if(projPropCategs.includes(aspect.toUpperCase())) {
            let prop = inputKVP.value as PropertyItem
            if (prop) {
                updatedProject = await updateProjectPropertyCategoryInFull(projectId, aspect as ProjectPropertyCategoryEnum, prop);
            }
            else {
                throw new Error(`Could not update project properties because no valid properties were provided for the operation`);
            }
        }
        else if(aspect.toUpperCase() === KeyProjectAspectTypeEnum.CRB_DATA) {
            let crbProps: BasicProperty[] = inputKVP.value as BasicProperty[];
            if (crbProps) {
                updatedProject = await updateProjectClearanceRelationBrands(projectId, crbProps)
            }
            else {
                throw new Error(`Could not update project CRBs because no valid info was provided for the operation`);
            }
        }
        else if(aspect.toUpperCase() === KeyProjectAspectTypeEnum.PHY_LNK) {
            let lnkItems: LinkageInfo[] = inputKVP.value as LinkageInfo[];
            if(!lnkItems) { throw new Error(`Could not update project physical linkages because no valid info was provided for the operation`); }
            await verifyProjectLinkageContext(lnkItems, project, project.clearanceLinkages);
            project.physicalLinkages = lnkItems;
            project.physicalLinkages = sort(project.physicalLinkages).asc(x => x.name.toUpperCase());
            await projRepo.ReplaceOne(project)
            await assessLinkageRelatedLGCs(projectId, null, true);
            updatedProject = await projRepo.GetWithId(projectId)
        }
        else if(aspect.toUpperCase() === KeyProjectAspectTypeEnum.CLR_LNK) {
            let lnkItems: LinkageInfo[] = inputKVP.value as LinkageInfo[];
            if(!lnkItems) { throw new Error(`Could not update project clearance linkages because no valid info was provided for the operation`); }
            await verifyProjectLinkageContext(project.physicalLinkages, project, lnkItems);
            project.clearanceLinkages = lnkItems;
            project.clearanceLinkages = sort(project.clearanceLinkages).asc(x => x.name.toUpperCase());
            await projRepo.ReplaceOne(project)
            await assessLinkageRelatedLGCs(projectId, null, true);
            updatedProject = await projRepo.GetWithId(projectId)
        }
        else {
            throw new Error(`Pailed to perform operation. The input project 'aspect' is invalid`)
        }

        res.status(200).send({ payload: updatedProject } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


projectRouter.post("/project/manage-lock", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let userEmail : string = req.query.user?.toString() || ''
        let isLockAction: boolean = (req.query.isLockAction?.toString()?.trim()?.toLowerCase() === "true") ? true : false;

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to retrieve C2C relation layout. Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!userEmail || userEmail === 'undefined' || userEmail.trim().length === 0) {
            throw new Error(`Failed to retrieve C2C relation layout. Input 'projectId' cannot be null or empty or undefined`);
        }

        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        let project = await projRepo.GetWithId(projectId)
        if (project) {
            const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
            if(user?.email.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
                throw new Error(`Could not update project lock status. Indicated user must be same as program executor`);
            }
            
            if(isLockAction) {
                project.lockedBy = userEmail.trim().toLowerCase();
            }
            else {
                project.lockedBy = null;
            }

            let updatedProject = await updateProject(project);
            res.status(200).send({ payload: updatedProject } as ResponseData);
        }
        else {
            throw new Error(`Could not update project lock status because no such project was found in the system`);
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


projectRouter.get("/project/get-status-indicators", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let statusIndicators : StatusIndicatorItem[] = await determineProjectStatus(projectId);
        res.status(200).send({ payload: statusIndicators } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


projectRouter.post("/project/clone", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let newName : string = req.query.newName?.toString() || ''
        
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;

        if(!user || !user.email || !user.idsid || user.email.trim().length === 0 || user.idsid.trim().length === 0) {
            throw new Error(`Could not clone project because user information is either invalid or not provided in the request`);
        }
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!newName || newName === 'undefined' || newName.trim().length === 0) {
            throw new Error(`A new name is required for cloned project. New name cannot be null or empty or undefined`);
        }

        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        let project = await projRepo.GetWithId(projectId)

        if (project && project.name.length > 0) {
            let newCloneProj = await cloneProject(project, newName, user);
            res.status(200).send({ payload: newCloneProj } as ResponseData);
        }
        else {
            throw new Error(`Could not clone project. Please ensure project exists in the system (with a valid name).`);
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


projectRouter.delete("/project/delete", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let deleteCompleted : boolean = await deleteProject(projectId);
        res.status(200).send({ payload: deleteCompleted } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


projectRouter.get("/project/download-data", async (req: Request, res: Response) => {
    try {
        req.setTimeout( 1000 * 60 * 8 ); // ten minutes

        let projectId : string = req.query.projectId?.toString()?.trim() || ''
        let contentType : string = req.query.contentType?.toString()?.trim() || ''
        
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null
        
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!contentType || contentType === 'undefined' || contentType.trim().length === 0) {
            throw new Error(`Input 'elementId' cannot be null or empty or undefined`);
        }
        
        let projectRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        let project = await projectRepo.GetWithId(projectId)
        if(!project) { 
            throw new Error(`Constraints download cannot proceed. Project with given ID was not found in the system`); 
        }
        
        let responseContent : Buffer | null = null;
        let respOutHeader = {
            'Content-Disposition': `attachment; filename="file.zip"`,
            'Content-Type': 'application/zip',
        }

        let commonDesc = `Spider ${contentType} Export | ProjectName=[${project.name}] | ProjectId=[${project._id?.toString()}] | Intel Confidential`; //No commas or semicolon in the description!!
        
        if (contentType.toLowerCase() === ProjectDataDownloadContentTypeEnum.XPEDITION.toLowerCase()) {
            responseContent = await produceXpeditionConstraintExportZip(project, user, commonDesc)
        }
        else if(contentType.toLowerCase() === ProjectDataDownloadContentTypeEnum.APD.toLowerCase()) {
            responseContent = await produceAPDConstraintExportZip(project, user, commonDesc)
        }
        else if (contentType.toLowerCase() === ProjectDataDownloadContentTypeEnum.PDRD.toLowerCase()) {
            responseContent = await producePdrdExportContent(project, user, commonDesc, ProjectDataDownloadContentTypeEnum.PDRD)
            respOutHeader["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        else if (contentType.toLowerCase() === ProjectDataDownloadContentTypeEnum.NETINFO.toLowerCase()) {
            responseContent = await producePdrdExportContent(project, user, commonDesc, ProjectDataDownloadContentTypeEnum.NETINFO)
            respOutHeader["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        else if (contentType.toLowerCase() === ProjectDataDownloadContentTypeEnum.FULLZIP.toLowerCase()) {
            throw new Error("This capability is not yet implemented")
        }

        if(responseContent) {
            res.writeHead(200, respOutHeader)
            res.end(responseContent);
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


projectRouter.post("/project/save-editor-notes", async (req: Request, res: Response) => {
    try {
        const notesData = req.body as EditorNotesData;
        let projectId : string = req.query.projectId?.toString() || ''

        if(!notesData){
            throw new Error(`Failed to save project notes. No data provided`);
        }
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let projectRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        let project = await projectRepo.GetWithId(projectId)
        if(!project) { throw new Error(`Could not save project notes. Project with given ID was not found in the system`); }

        project.notes = notesData;
        let isUpdated : boolean = await projectRepo.ReplaceOne(project);
        
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


projectRouter.post("/project/upload-editor-file", upload.single("file"), async (req: Request, res: Response) => {
    try {
        let file = (req as any).file;
        let projectId = (req as any)?.body?.projectId || req.query.projectId?.toString() || ''
        let keyIdentifier = (req as any)?.body?.keyIdentifier || req.query.keyIdentifier?.toString() || ''

        if(file) {
            if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
                throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
            }
            if (!keyIdentifier || keyIdentifier === 'undefined' || keyIdentifier.trim().length === 0) {
                throw new Error(`Input 'keyIdentifier' cannot be null or empty or undefined`);
            }

            let response : {success: number, file: {url: string}} = await uploadGenericNoteImageCollaterals(file, projectId, keyIdentifier)

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


projectRouter.delete("/project/delete-editor-file", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let fileURL : string = (req.body as any)?.fileURL?.trim();

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        if (!fileURL || fileURL === 'undefined' || fileURL.trim().length === 0) {
            throw new Error(`Input 'imageURL' cannot be null or empty or undefined`);
        }

        let response : boolean = await deleteGenericNoteImageCollaterals(projectId, fileURL)
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
















// associatedProperties: {$elemMatch: {name: "Description"}} 



// projectRouter.post("/project/replace-project-prop-category", async (req: Request, res: Response) => {
//     try {
//         let projectId : string = req.query.projectId?.toString().trim() || ''
//         if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
//             throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
//         }

//         let category : string = req.query.category?.toString().trim() || ''
//         if (!category || category === 'undefined' || category.trim().length === 0) {
//             throw new Error(`Input 'category' cannot be null or empty or undefined`);
//         }

//         const prop: PropertyItem = req.body as PropertyItem;
//         if (prop) {
//             let updatedProject : Project = await updateProjectPropertyCategoryInFull(projectId, category as ProjectPropertyCategoryEnum, prop);
//             res.status(200).send({ payload: updatedProject } as ResponseData);
//         }
//         else {
//             throw new Error(`Could not update project properties because no valid properties were provided for the operation`);
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





// let arrayofClrProps = {
//     "THRUVIA_TO_THRUVIA_SPACING": "8",
//     "BBV_TO_THRUVIA_SPACING": "8",
//     "TESTVIA_TO_THRUVIA_SPACING": "8",
//     "MVIA_TO_THRUVIA_SPACING": "8",
//     "BBV_TO_BBV_SPACING": "8",
//     "BBV_TO_TESTVIA_SPACING": "8",
//     "MVIA_TO_BBV_SPACING": "8",
//     "MVIA_TO_TESTVIA_SPACING": "8",
//     "MVIA_TO_MVIA_SPACING": "8",
//     "TESTVIA_TO_TESTVIA_SPACING": "8",
//     "SMDPIN_TO_THRUVIA_SPACING": "10",
//     "BBV_TO_SMDPIN_SPACING": "10",
//     "SMDPIN_TO_TESTVIA_SPACING": "10",
//     "MVIA_TO_SMDPIN_SPACING": "10",
//     "SHAPE_TO_THRUVIA_SPACING": "9",
//     "BBV_TO_SHAPE_SPACING": "9",
//     "MVIA_TO_SHAPE_SPACING": "9",
//     "SHAPE_TO_TESTVIA_SPACING": "9",
//     "LINE_TO_THRUVIA_SPACING": "2",
//     "BBV_TO_LINE_SPACING": "2",
//     "LINE_TO_TESTVIA_SPACING": "2",
//     "MVIA_TO_LINE_SPACING": "2",
//     "LINE_TO_LINE_SPACING": "0",
//     "LINE_TO_SMDPIN_SPACING": "4",
//     "LINE_TO_SHAPE_SPACING": "3",
//     "LINE_TO_THRUPIN_SPACING": "1",
//     "LINE_TO_TESTPIN_SPACING": "1",
//     "SHAPE_TO_SHAPE_SPACING": "11",
//     "THRUPIN_TO_THRUVIA_SPACING": "6",
//     "BBV_TO_THRUPIN_SPACING": "6",
//     "TESTVIA_TO_THRUPIN_SPACING": "6",
//     "TESTPIN_TO_THRUVIA_SPACING": "6",
//     "BBV_TO_TESTPIN_SPACING": "6",
//     "TESTPIN_TO_TESTVIA_SPACING": "6",
//     "MVIA_TO_TESTPIN_SPACING": "6",
//     "THRUPIN_TO_SHAPE_SPACING": "7",
//     "SHAPE_TO_SMDPIN_SPACING": "7",
//     "SHAPE_TO_TESTPIN_SPACING": "7",
//     "THRUPIN_TO_THRUPIN_SPACING": "5",
//     "THRUPIN_TO_SMDPIN_SPACING": "5",
//     "TESTPIN_TO_THRUPIN_SPACING": "5",
//     "MVIA_TO_THRUPIN_SPACING": "5",
//     "SMDPIN_TO_SMDPIN_SPACING": "5",
//     "SMDPIN_TO_TESTPIN_SPACING": "5",
//     "TESTPIN_TO_TESTPIN_SPACING": "5",
//     "BONDPAD_TO_LINE_SPACING": "",
//     "THRUPIN_TO_BONDPAD_SPACING": "",
//     "SMDPIN_TO_BONDPAD_SPACING": "",
//     "BONDPAD_TO_TESTPIN_SPACING": "",
//     "BONDPAD_TO_THRUVIA_SPACING": "",
//     "BONDPAD_TO_BBV_SPACING": "",
//     "BONDPAD_TO_MVIA_SPACING": "",
//     "BONDPAD_TO_TESTVIA_SPACING": "",
//     "BONDPAD_TO_SHAPE_SPACING": "",
//     "BONDPAD_TO_BONDPAD_SPACING": "",
//     "HOLE_TO_LINE_SPACING": "",
//     "HOLE_TO_PIN_SPACING": "",
//     "HOLE_TO_VIA_SPACING": "",
//     "HOLE_TO_SHAPE_SPACING": "",
//     "HOLE_TO_HOLE_SPACING": "",
//     "MIN_BVIA_GAP": ""
// }

// let arr = []
// for (let i = 0; i < Object.keys(arrayofClrProps).length; i++) {
//     let item = Object.keys(arrayofClrProps).at(i)
//     let entry = {
//         "id": (i+ 1).toString(),
//         "name": item?.toString().toUpperCase(),
//         "displayName": item?.toString(),
//         "value": "",
//         "category": "Clearance",
//         "editable": true,
//         "enabled": true,
//         "contextProperties": [
//             {
//                 "id": `${i+1}-1`,
//                 "name": "export_context",
//                 "value": {
//                     "subType": "Clearance",
//                     "exportEnabled": true,
//                     "defConKeys": [
                        
//                     ],
//                     "extraKeys": [],
//                     "apdKeyss": [],
//                     "xpeditionKeys": [
                        
//                     ]
//                 }
//             },
//             {
//                 "id": `${i+1}-2`,
//                 "name": "display_context",
//                 "value": {
//                     "subType": "Clearance",
//                     "valueSource": "",
//                     "columnCellKind": "number",
//                     "contentAlign": "center",
//                     "allowOverlay": true,
//                     "allowWrapping": true,
//                     "icon": "headerNumber",
//                     "setHighLighted": false
//                 }
//             }
//         ]
//     }

//     arr.push(entry)
// }

// console.log(JSON.stringify(arr))








// if (proj) {
//     let aggSummary = getProjectStats(proj._id?.toString() as string)
//     proj.aggregateSummary = aggSummary;
// }