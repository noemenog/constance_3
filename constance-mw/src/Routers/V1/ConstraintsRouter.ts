import express, { Request, Response } from "express";
import multer from "multer";
import { DefaultConstraints, LayerGroupConstraints, Netclass, PackageLayout, Project } from "../../Models/ServiceModels";
import { ConstraintTypesEnum, DBCollectionTypeEnum, ErrorSeverityValue, NamingContentTypeEnum } from "../../Models/Constants";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { BasicKVP, ResponseData, User } from "../../Models/HelperModels";
import { getEnumValuesAsArray, isNumber, rfdcCopy, verifyNaming } from "../../BizLogic/UtilFunctions";
import { clearAllCustomLGCValues, processDefaultConstraintsContent, pushDefaultConstraints, retrieveAndFormatDefCon, verifyBeforeUpload } from "../../BizLogic/DefaultConstraintsLogic";
import { Filter, ObjectId } from "mongodb";
import { copyConstraintsToAnotherRuleArea, switchUpLayerGroupSet, updateLGC } from "../../BizLogic/ConstraintsMgmtLogic";
import { getClassRelationNameElementsForInterface } from "../../BizLogic/NetClassificationLogic";
import { createAutoGenSnapshot } from "../../BizLogic/SnapShotLogic";



const upload = multer({ storage: multer.memoryStorage() })

export const constraintsRouter = express.Router();

constraintsRouter.get("/constraints/get-defaults", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let dataSetName : string = req.query.dataSetName?.toString() || ''
        let excludeConstraintEntries: boolean = (req.query.excludeConstraintEntries?.toString()?.trim()?.toLowerCase() === "true") ? true : false;
        let performProlif: boolean = (req.query.performProlif?.toString()?.trim()?.toLowerCase() === "true") ? true : false;

        let finalDefCon = await retrieveAndFormatDefCon(projectId, dataSetName, excludeConstraintEntries)

        if(performProlif === true) {
            pushDefaultConstraints(projectId); //never await on this call right here!!
        }
        
        res.status(200).send({ payload: finalDefCon } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


constraintsRouter.post('/constraints/upload-defaults', upload.single("file"), async (req: Request, res: Response) => {
    try {
        let buf : Buffer = (req as any)?.file?.buffer
        let projectId = (req as any)?.body?.projectId
        let nameIdentifier = (req as any)?.body?.nameIdentifier
        let previewMode = ((req as any)?.body?.previewMode && (req as any).body.previewMode.toString().trim().toLowerCase() === 'true') ? true : false;
        let xmodAdjustments = ((req as any)?.body?.xmodAdjustments && (req as any).body.xmodAdjustments.toString().trim().length > 0) 
            ? JSON.parse((req as any)?.body?.xmodAdjustments) as BasicKVP[] 
            : null;
        let fileName = (req as any)?.file?.originalname

        if(buf && buf.length > 0) {
            verifyBeforeUpload(projectId, nameIdentifier, fileName);
            verifyNaming([nameIdentifier], NamingContentTypeEnum.DEFAULT_CONSTRAINTS)
            
            let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
            let pkg = await pkgRepo.GetOneByProjectID(projectId)
            if(!pkg) { throw new Error(`Failed to retrieve valid layout info.`) }

            let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
            let filter = { _id: new ObjectId(projectId as string) } as Filter<Project>;
            let projection = { name: 1, org: 1, constraintSettings: 1 };
            let projectRes = await projRepo.GetByFilterAndProjection(filter, projection);

            let defConFinal: DefaultConstraints|null = await processDefaultConstraintsContent(buf, projectRes[0] as Project, nameIdentifier, fileName, previewMode);
            if(!defConFinal) {
                throw new Error(`An unexpected error occured while processing default-constraints data upload.`);
            }
            
            if(defConFinal && previewMode === false) {
                defConFinal = await retrieveAndFormatDefCon(projectId, nameIdentifier, false);

                //this will adjust xmod - for scenarios where new file does not have xmod name that user selected from previous file
                if(xmodAdjustments && xmodAdjustments.length > 0) {
                    for(let xmodAdj of xmodAdjustments) {
                        for(let i = 0; i < pkg.ruleAreas.length; i++) {
                            if(pkg.ruleAreas[i].id === xmodAdj.key) {
                                pkg.ruleAreas[i].xmodName = xmodAdj.value;
                                break;
                            }
                        }
                    }
                    pkgRepo.ReplaceOne(pkg);
                }
            }
            
            res.status(200).send({ payload: defConFinal } as ResponseData);
        }
        else {
            throw new Error(`Could not upload default-constraints data. File was either invalid or empty`);
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


constraintsRouter.post('/constraints/create-editable-defaults', async (req: Request, res: Response) => {
    try {
        const defcon: DefaultConstraints = req.body as DefaultConstraints;
        
        let defconRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION)

        if (defcon.projectId && defcon.projectId.length > 0) {
            if (defcon && defcon.nameIdentifier.length > 0) {
                verifyNaming([defcon.nameIdentifier], NamingContentTypeEnum.DEFAULT_CONSTRAINTS)
            
                let projection = { _id: 1, nameIdentifier: 1};
                let limitedSrcResult = await defconRepo.GetAllByProjectIDAndProjection(defcon.projectId, null, projection);
                if(limitedSrcResult && limitedSrcResult.length > 0) {
                    if(limitedSrcResult.some(a => a.nameIdentifier === defcon.nameIdentifier)) {
                        throw new Error(`Could not create editable version of default constraints. The name '${defcon.nameIdentifier}' already exists`);
                    }
                }

                if (defcon.sourceDefaultConstraintsId && defcon.sourceDefaultConstraintsId.length > 0) {
                    let srcDefConData = await defconRepo.GetWithId(defcon.sourceDefaultConstraintsId)
                    if(srcDefConData) {
                        let newDefCon : DefaultConstraints = rfdcCopy(srcDefConData) as DefaultConstraints;
 
                        newDefCon.contextProperties = [];
                        newDefCon.createdOn = new Date();
                        newDefCon.isGolden = false;
                        newDefCon.lastUpdatedOn = new Date();
                        newDefCon.nameIdentifier = defcon.nameIdentifier;
                        newDefCon.snapshotSourceId = '';
                        newDefCon.sourceDefaultConstraintsId = defcon.sourceDefaultConstraintsId;
                        newDefCon.tags = []

                        delete newDefCon['_id']

                        let finalResult = await defconRepo.CreateOne(newDefCon)

                        if(finalResult && finalResult?._id){
                            let editableDefCon = await retrieveAndFormatDefCon(defcon.projectId, defcon.nameIdentifier, false)

                            res.status(200).send({ payload: editableDefCon } as ResponseData);
                        }
                        else {
                            throw new Error(`Unknown error occured while trying to save new editable version of default constraints`);
                        }

                    }
                    else {
                        throw new Error(`Could not create editable version of default constraints. Supplied source default-constraints Id is invalid`);
                    }
                }
                else {
                    throw new Error(`Could not create editable version of default constraints. Supplied source default-constraints Id is either emprty or invalid`);
                }
            }
            else {
                throw new Error(`Could not create editable version of default constraints. The unique name specified for the data is either invalid or not provided`)
            }
        }
        else {
            throw new Error(`Could not create editable version of default constraints. Supplied projectId is either emprty or invalid`);
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


constraintsRouter.post('/constraints/save-editable-defaults', async (req: Request, res: Response) => {
    try {
        const defcon: DefaultConstraints = req.body as DefaultConstraints;
    
        if (defcon && defcon.nameIdentifier.length > 0) {
            verifyNaming([defcon.nameIdentifier], NamingContentTypeEnum.DEFAULT_CONSTRAINTS)
            
            if (defcon.projectId && defcon.projectId.length > 0) {
                if (defcon.sourceDefaultConstraintsId && defcon.sourceDefaultConstraintsId.length > 0) {
                    if(defcon.constraints && defcon.constraints.length > 0) {
                        let dcSMRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION)
                        
                        let projection = { _id: 1, nameIdentifier: 1};
                        let limitedSrcResult = await dcSMRepo.GetAllByProjectIDAndProjection(defcon.projectId, null, projection);
                        if(limitedSrcResult && limitedSrcResult.length > 0) {
                            if(limitedSrcResult.some(a => ((a.nameIdentifier === defcon.nameIdentifier) && (a._id.toString() !== defcon._id?.toString())))) {
                                throw new Error(`Could not save editable version of default constraints. The name '${defcon.nameIdentifier}' already exists`);
                            }
                        }

                        defcon.contextProperties = []  //Important!!
                        defcon.lastUpdatedOn = new Date()
                        let result = await dcSMRepo.ReplaceOne(defcon)

                        if(result){
                            let filter = { nameIdentifier: new RegExp('^' + defcon.nameIdentifier + '$', 'i') }
                            let finalResult = await dcSMRepo.GetOneByProjectID(defcon.projectId, filter)
                            if(finalResult && finalResult?._id){
                                let editableDefCon: DefaultConstraints|null = await retrieveAndFormatDefCon(defcon.projectId, defcon.nameIdentifier, false)
                                if(editableDefCon) {
                                    pushDefaultConstraints(editableDefCon.projectId) //no need to wait on this
                                }
                                
                                res.status(200).send({ payload: editableDefCon } as ResponseData);
                            }
                            else {
                                throw new Error(`Unknown error occured while trying to retrieve saved editable version of default constraints`);
                            }
                        }
                        else {
                            throw new Error(`Unknown error occured while trying to save new editable version of default constraints`);
                        }
                    }
                    else {
                        throw new Error(`Could not save editable version of default constraints. constraint set is invalid or empty`);
                    }
                }
                else {
                    throw new Error(`Could not save editable version of default constraints. Supplied source default-constraints Id is either emprty or invalid`);
                }
            }
            else {
                throw new Error(`Could not save editable version of default constraints. Supplied projectId is either emprty or invalid`);
            }
        }
        else {
            throw new Error(`Could not save editable version of default constraints. The unique name specified for the data is either invalid or not provided`)
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


constraintsRouter.post("/constraints/clear-custom-values", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to retrieve constraints. Input 'projectId' cannot be null or empty or undefined`);
        }

        await pushDefaultConstraints(projectId);
        await createAutoGenSnapshot(projectId);
        let result = await clearAllCustomLGCValues(projectId, user);
        
        res.status(200).send({ payload: result } as ResponseData);

        //Note: no need to process project Linkages here because everything should go to default anyway...
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


constraintsRouter.get("/constraints/get-constraints", async (req: Request, res: Response) => {
    try {
        let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
        let result = new Array<LayerGroupConstraints>();

        let projectId : string = req.query.projectId?.toString() || ''
        let lastId : string = req.query.lastId?.toString() || ''
        let limit : string = req.query.limit?.toString() || ''

        let filterRuleAreaId : string = req.query.ruleAreaId?.toString()?.trim() || ''
        let filterLayerGroupId : string = req.query.layergroupId?.toString()?.trim() || ''
        let filterElementId: string = req.query.filterElementId?.toString()?.trim() || ''
        let filterConstraintType: string = req.query.constraintType?.toString()?.trim() || ''
        let filterExcludeProps: boolean = (req.query.excludeProps && req.query.excludeProps?.toString().toLowerCase().trim() === "true") ? true : false
        
        //these two are a bit special -- handled differently...
        let filterInterfaceId : string = req.query.interfaceId?.toString()?.trim() || ''
        let filterElementName: string = req.query.filterElementName?.toString()?.trim() || ''
        
        
        let hasLastId = (!lastId || lastId === 'undefined' || lastId.trim().length === 0) ? false : true;
        let hasLimit = (!limit || limit === 'undefined' || limit.trim().length === 0) ? false : true;
        let filters = new Array<Filter<LayerGroupConstraints>>();
        let typesAsStrArr = getEnumValuesAsArray(ConstraintTypesEnum)
        let projectionSpec = null;

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to retrieve constraints. Input 'projectId' cannot be null or empty or undefined`);
        }
        if (hasLimit && (isNumber(limit) === false)) {
            throw new Error(`Failed to retrieve constraints. Input 'limit' must be a valid number.`);
        }
        if(hasLastId && (hasLimit === false)) {
            throw new Error(`Failed to retrieve constraints. Input 'limit' is required when last/exclusionary constraint element is provided.`);
        }
        if(filterInterfaceId && filterInterfaceId.length > 0) {
            if (!filterConstraintType || filterConstraintType === 'undefined' || filterConstraintType.trim().length === 0 || typesAsStrArr.every(a => a.toLowerCase() !== filterConstraintType.toLowerCase())) {
                throw new Error(`Failed to retrieve constraints. If 'interfaceId' is supplied for filtering, then 'constraintType' must be supplied.`);
            }
        }
        if(filterElementName && filterElementName.length > 0) {
            if (!filterConstraintType || filterConstraintType === 'undefined' || filterConstraintType.trim().length === 0 || typesAsStrArr.every(a => a.toLowerCase() !== filterConstraintType.toLowerCase())) {
                throw new Error(`Failed to retrieve constraints. If 'filterElementName' is supplied for filtering, then 'constraintType' must be supplied.`);
            }
        }

        //=========================================================
        if(filterRuleAreaId && filterRuleAreaId.length > 0) {
            const regexRaid = new RegExp(`^${filterRuleAreaId}`, 'i');
            filters.push({ ruleAreaId: regexRaid } as Filter<LayerGroupConstraints>)
        }

        if(filterLayerGroupId && filterLayerGroupId.length > 0) {
            const regexLgId = new RegExp(`^${filterLayerGroupId}`, 'i');
            filters.push({ netclassId: regexLgId } as Filter<LayerGroupConstraints>)
        }
        
        if(filterElementId && filterElementId.length > 0) {
            const regexElementId = new RegExp(`^${filterElementId}`, 'i');
            filters.push({ ownerElementId: regexElementId } as Filter<LayerGroupConstraints>)
        }
        
        if(filterConstraintType && filterConstraintType.length > 0) {
            const regexConstrType = new RegExp(`^${filterConstraintType}`, 'i');
            if(filterConstraintType.toLowerCase() === ConstraintTypesEnum.Physical.toLowerCase()) { filterConstraintType = ConstraintTypesEnum.Physical }
            if(filterConstraintType.toLowerCase() === ConstraintTypesEnum.Clearance.toLowerCase()) { filterConstraintType = ConstraintTypesEnum.Clearance }
            filters.push({ constraintType: regexConstrType } as Filter<LayerGroupConstraints>)
        }

        if(filterExcludeProps === true) {
            projectionSpec = { associatedProperties: 0 }
        }
        //==============================================================
        

        if(hasLastId && hasLimit){
            result = await lgcRepo.PaginationGetPageByProjectIDAndProjection(projectId, filters, lastId, parseInt(limit.trim(), 10), projectionSpec)
        }
        else if ((hasLastId === false) && hasLimit){
            result = await lgcRepo.PaginationGetLastByProjectIDAndProjection(projectId, filters, parseInt(limit.trim(), 10), projectionSpec)
        }
        else {
            result = await lgcRepo.GetAllByProjectIDAndProjection(projectId, filters, projectionSpec ?? {})
        }

        //==============================================================

        let projectNetclasses = new Array<Netclass>();

        //handling  supplied interface id
        if(filterInterfaceId && filterInterfaceId.length > 0) {
            if(filterConstraintType && filterConstraintType === ConstraintTypesEnum.Physical) {
                if(projectNetclasses.length === 0) {
                    let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
                    projectNetclasses = await ncRepo.GetAllByProjectID(projectId) ?? [];
                }
                let netclassesGrouped = new Map<string, string>()
                for(let nc of projectNetclasses) {
                    netclassesGrouped.set(nc._id?.toString() as string, nc.interfaceId)
                }
                let filteredData = result.filter(a => netclassesGrouped.has(a.ownerElementId) && netclassesGrouped.get(a.ownerElementId) === filterInterfaceId) ?? []
                result = filteredData;
            }
            if(filterConstraintType && filterConstraintType === ConstraintTypesEnum.Clearance){
                if (!filterRuleAreaId || filterRuleAreaId === 'undefined' || filterRuleAreaId.trim().length === 0) {
                    throw new Error(`Failed to retrieve constraints. If 'interfaceId' and constraintType '${filterConstraintType} is supplied for filtering, then 'ruleAreaId' must be supplied.`);
                }
                
                let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
                let project = await projRepo.GetWithId(projectId);
                let relevantRelations = await getClassRelationNameElementsForInterface(project, filterInterfaceId, filterRuleAreaId)
                let clrRelSet = new Set<string>()
                for(let rel of relevantRelations) {
                    clrRelSet.add(rel.id)
                }
                let filteredData = result.filter(a => clrRelSet.has(a.ownerElementId)) ?? []
                result = filteredData;
            }
        }

        //handle supplied element name
        if(filterElementName && filterElementName.length > 0) {
            if(filterConstraintType && filterConstraintType === ConstraintTypesEnum.Physical) {
                if(projectNetclasses.length === 0) {
                    let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
                    projectNetclasses = await ncRepo.GetAllByProjectID(projectId) ?? [];
                }
                let netclassesGrouped = new Map<string, string>()
                for(let nc of projectNetclasses) {
                    netclassesGrouped.set(nc._id?.toString() as string, nc.name.toUpperCase())
                }
                let filteredData = result.filter(a => netclassesGrouped.has(a.ownerElementId) && netclassesGrouped.get(a.ownerElementId)?.startsWith(filterElementName.toUpperCase())) ?? []
                result = filteredData;
            }
            if(filterConstraintType && filterConstraintType === ConstraintTypesEnum.Clearance){
                //TODO: we need to resolve this aspect for clearance data retrieval...
            }
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


constraintsRouter.get("/constraints/get-constraint-count", async (req: Request, res: Response) => {
    try {
        let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)

        let projectId : string = req.query.projectId?.toString() || ''
        
        let filterRuleAreaId : string = req.query.ruleAreaId?.toString()?.trim() || ''
        let filterLayerGroupId : string = req.query.layergroupId?.toString()?.trim() || ''
        let filterElementId: string = req.query.filterElementId?.toString()?.trim() || ''
        let filterConstraintType: string = req.query.constraintType?.toString()?.trim() || ''
        let filterInterfaceId : string = req.query.interfaceId?.toString()?.trim() || ''      
    
        let filters = new Array<Filter<LayerGroupConstraints>>();
        let typesAsStrArr = getEnumValuesAsArray(ConstraintTypesEnum)

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to retrieve constraints. Input 'projectId' cannot be null or empty or undefined`);
        }
        if(filterInterfaceId && filterInterfaceId.length > 0) {
            if (!filterConstraintType || filterConstraintType === 'undefined' || filterConstraintType.trim().length === 0 || typesAsStrArr.every(a => a.toLowerCase() !== filterConstraintType.toLowerCase())) {
                throw new Error(`Failed to retrieve constraints. If 'interfaceId' is supplied for filtering, then 'constraintType' must be supplied.`);
            }
        }
        //=========================================================

        const regexRaid = new RegExp(`^${filterRuleAreaId}`, 'i');
        if(filterRuleAreaId && filterRuleAreaId.length > 0) {
            filters.push({ ruleAreaId: regexRaid } as Filter<LayerGroupConstraints>)
        }

        const regexLgId = new RegExp(`^${filterLayerGroupId}`, 'i');
        if(filterLayerGroupId && filterLayerGroupId.length > 0) {
            filters.push({ netclassId: regexLgId } as Filter<LayerGroupConstraints>)
        }

        const regexElementId = new RegExp(`^${filterElementId}`, 'i');
        if(filterElementId && filterElementId.length > 0) {
            filters.push({ ownerElementId: regexElementId } as Filter<LayerGroupConstraints>)
        }

        const regexConstrType = new RegExp(`^${filterConstraintType}`, 'i');
        if(filterConstraintType && filterConstraintType.length > 0) {
            if(filterConstraintType.toLowerCase() === ConstraintTypesEnum.Physical.toLowerCase()) { filterConstraintType = ConstraintTypesEnum.Physical }
            if(filterConstraintType.toLowerCase() === ConstraintTypesEnum.Clearance.toLowerCase()) { filterConstraintType = ConstraintTypesEnum.Clearance }
            filters.push({ constraintType: regexConstrType } as Filter<LayerGroupConstraints>)
        }

        // special case - handling  supplied interface id
        if(filterInterfaceId && filterInterfaceId.length > 0) {
            if(filterConstraintType && filterConstraintType === ConstraintTypesEnum.Physical) {
                let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
                let ncQueryFilter = {interfaceId: filterInterfaceId}
                let ifaceNetclasses = await ncRepo.GetAllByProjectID(projectId, ncQueryFilter)
                
                const idStrList = ifaceNetclasses.map((x: Netclass) => x._id?.toString());
                let infilter = { ownerElementId: { $in: idStrList } as any } as Filter<LayerGroupConstraints>;
                filters.push(infilter);
            }
            if(filterConstraintType && filterConstraintType === ConstraintTypesEnum.Clearance){
                //TODO: we need to resolve this aspect for clearance data retrieval...
            }
        }

        //==============================================================
        
        let result = await lgcRepo.GetCountByProjectId(projectId, filters) ?? 0

        //==============================================================

        
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


constraintsRouter.post("/constraints/update", async (req: Request, res: Response) => {
    try {
        let lgcList: LayerGroupConstraints[] = req.body as LayerGroupConstraints[];
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;

        if (lgcList && lgcList.length > 0) {
            let updatedConstraints = await updateLGC(lgcList, user);
            res.status(200).send({ payload: updatedConstraints } as ResponseData);
        }
        else {
            throw new Error(`Could not update layer group constraints because no valid constraint element(s) were provided for the operation`);
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


constraintsRouter.post("/constraints/switch-lgset", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString()?.trim() || ''
        let elementId : string = req.query.elementId?.toString()?.trim() || ''
        let newLGSetId : string = req.query.newLGSetId?.toString()?.trim() || ''
        
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!elementId || elementId === 'undefined' || elementId.trim().length === 0) {
            throw new Error(`Input 'elementId' cannot be null or empty or undefined`);
        }
        if (!newLGSetId || newLGSetId === 'undefined' || newLGSetId.trim().length === 0) {
            throw new Error(`Input 'newLGSetId' cannot be null or empty or undefined`);
        }

        let result : boolean = await switchUpLayerGroupSet(projectId, elementId, newLGSetId);
        
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


constraintsRouter.post("/constraints/copyover-constraints", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let interfaceId: string = req.query.interfaceId?.toString()?.trim() || ''
        let srcRuleAreaId : string = req.query.srcRuleAreaId?.toString()?.trim() || ''
        let destRuleAreaId: string = req.query.destRuleAreaId?.toString()?.trim() || ''
        let constraintType: string = req.query.constraintType?.toString()?.trim() || ''

        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Cannot process constraints copy-over. Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!srcRuleAreaId || srcRuleAreaId === 'undefined' || srcRuleAreaId.trim().length === 0) {  // IMPORTANT - this is a must have!!
            throw new Error(`Cannot process constraints copy-over. Input 'srcRuleAreaId' cannot be null or empty or undefined`);
        }
        if (!destRuleAreaId || destRuleAreaId === 'undefined' || destRuleAreaId.trim().length === 0) {  // IMPORTANT - this is a must have!!
            throw new Error(`Cannot process constraints copy-over. Input 'destRuleAreaId' cannot be null or empty or undefined`);
        }
        if (!constraintType || constraintType === 'undefined' || constraintType.trim().length === 0) {  // IMPORTANT - this is a must have!!
            throw new Error(`Cannot process constraints copy-over. Input 'constraintType' cannot be null or empty or undefined`);
        }

        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let project = await projRepo.GetWithId(projectId);
        if(!project) { 
            throw new Error(`Cannot process constraints copy-over. No project found for specified Id.`) 
        }

        let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
        let pkg = await pkgRepo.GetOneByProjectID(project._id?.toString() as string)
        if(!pkg) { 
            throw new Error(`Cannot process constraints copy-over. Failed to retrieve valid layout info.`) 
        }

        if(!pkg.ruleAreas || pkg.ruleAreas.length === 0) { 
            throw new Error(`Cannot process constraints copy-over. Rule areas were not found.`) 
        }

        let srcRA = pkg.ruleAreas.find(a => a.id === srcRuleAreaId)
        let destRA = pkg.ruleAreas.find(a => a.id === destRuleAreaId)

        if(!srcRA || !destRA) { 
            throw new Error(`Cannot process constraints copy-over. Specified rule areas were not found for the project.`) 
        }

        if(constraintType && constraintType.length > 0) {
            if(constraintType.toLowerCase() === ConstraintTypesEnum.Physical.toLowerCase()) { constraintType = ConstraintTypesEnum.Physical }
            if(constraintType.toLowerCase() === ConstraintTypesEnum.Clearance.toLowerCase()) { constraintType = ConstraintTypesEnum.Clearance }
        }

        if(constraintType === ConstraintTypesEnum.Physical) {
            if (!interfaceId || interfaceId === 'undefined' || interfaceId.trim().length === 0) {
                throw new Error(`Cannot process constraints copy-over. `
                    + `Input 'interfaceId' cannot be null, or empty, or undefined if 'constraintType is ${ConstraintTypesEnum.Physical}`);
            }
        }

        let result : boolean = await copyConstraintsToAnotherRuleArea(user, project, srcRA, destRA, constraintType as ConstraintTypesEnum, interfaceId);
        
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















//===================================================================================


// let relativesInfo = await getDefConRelatives(defcon.projectId, defcon.nameIdentifier);
//                             let relsProp : BasicProperty = {
//                                 id: crypto.randomUUID(),
//                                 name: RELATED_DEFAULT_CONSTRAINTS_PROP_NAME, 
//                                 value: relativesInfo.relatives,
//                             }
//                             finalResult?.contextProperties?.push(relsProp);



// let relativesInfo = await getDefConRelatives(defcon.projectId, defcon.nameIdentifier);
// let relsProp : BasicProperty = {
//     id: crypto.randomUUID(),
//     name: RELATED_DEFAULT_CONSTRAINTS_PROP_NAME, 
//     value: relativesInfo.relatives,
// }
// finalResult?.contextProperties?.push(relsProp);

// res.status(200).send({ payload: finalResult } as ResponseData);


// constraintsRouter.get("/constraints/get-property-settings", async (req: Request, res: Response) => {
//     try {
//         let projectId : string = req.query.projectId?.toString() ?? ''
//         let org: string = req.query.org?.toString() ?? ''

//         if (!org || org === 'undefined' || org.trim().length === 0) {
//             throw new Error(`Input 'org' cannot be null or empty or undefined`);
//         }

//         let constraintprops = await getConstraintSettingsForOrg(org)
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
