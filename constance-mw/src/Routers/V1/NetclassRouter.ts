import express, { Request, Response } from "express";
import { DBCollectionTypeEnum, ErrorSeverityValue, PendingProcessActionTypeEnum } from "../../Models/Constants";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { C2CRow, G2GRelationContext, Interface, Netclass, PackageLayout, Project } from "../../Models/ServiceModels";
import { BasicProperty, ResponseData, User } from "../../Models/HelperModels";
import { Filter } from "mongodb";
import { groupBy } from "../../BizLogic/UtilFunctions";
import { clearClassRelations, getClassRelationLayout, getClassRelationNameElementsForInterface, updateC2CRow, updateNetclassesForInterface } from "../../BizLogic/NetClassificationLogic";
import { sort } from "fast-sort";
import { updateG2GContext } from "../../BizLogic/InterfaceLogic";
import { handleProjectPendingProcessIndicator } from "../../BizLogic/ProjectLogic";




export const netclassRouter = express.Router();


netclassRouter.get("/netclass/get-netclass-list", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }

        let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
        let result = await ncRepo.GetAllByProjectID(projectId)

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


netclassRouter.post("/netclass/update-netclass-list", async (req: Request, res: Response) => {
    try {
        let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION);

        let netclasses: Netclass[] = req.body as Netclass[];
        if (netclasses && netclasses.length > 0) {
            let updatedNetclasses = new Array<Netclass>();
            
            for(let i = 0; i < netclasses.length; i++) {
                //must have same projectId
                if(!netclasses[0].projectId || netclasses[0].projectId.trim().length === 0 
                    || !netclasses[i].projectId || netclasses[i].projectId !== netclasses[0].projectId) {
                    throw new Error(`All netclasses must have same projectId`);
                }
            }

            let groupByIface : Map<string, Netclass[]> = groupBy(netclasses, a => a.interfaceId);
            for(let [ifaceId, ncList] of groupByIface) {
                let g2gIfaceFilter = {interfaceId: ifaceId} as Filter<G2GRelationContext>; 
                let existingG2GList = await g2gRepo.GetAllByProjectID(netclasses[0].projectId, g2gIfaceFilter);
                let resp = await updateNetclassesForInterface(netclasses[0].projectId, ifaceId, ncList, existingG2GList);
                resp.forEach(a => updatedNetclasses.push(a));
            }

            if(updatedNetclasses.length !== netclasses.length) {
                throw new Error(`Failed to update ALL specified netclasses. Error occured during the operation`);
            }

            res.status(200).send({ payload: updatedNetclasses } as ResponseData);
        }
        else {
            throw new Error(`Could not update netclasses because no valid data was provided for the operation`);
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


netclassRouter.get("/netclass/get-class-relation-layout", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let lastId : string = req.query.lastId?.toString() || ''
        let limit : string = req.query.limit?.toString() || ''

        let filterRuleAreaId : string = req.query.ruleAreaId?.toString()?.trim() || ''
        let filterinterfaceId : string = req.query.interfaceId?.toString()?.trim() || ''
        let filterNetclassId : string = req.query.netclassId?.toString()?.trim() || ''
        let filterNetclassName : string = req.query.netclassName?.toString()?.trim() || ''
        
        let performSortSlots: boolean = (req.query.performSortSlots?.toString().trim().toLowerCase() === "true") ? true : false;

        let result = await getClassRelationLayout(projectId, lastId, limit, filterRuleAreaId, filterinterfaceId, filterNetclassId, filterNetclassName, performSortSlots);

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


netclassRouter.post("/netclass/update-class-relation-layout", async (req: Request, res: Response) => {
    try {
        let c2cRowList: C2CRow[] = req.body as C2CRow[];
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;
        
        if (c2cRowList && c2cRowList.length > 0) {
            let updatedC2CRowItems = await updateC2CRow(c2cRowList, user);
            res.status(200).send({ payload: updatedC2CRowItems } as ResponseData);
        }
        else {
            throw new Error(`Could not update C2C relations data because no valid data was provided for the operation`);
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


netclassRouter.get("/netclass/get-class-relation-names-for-Interface", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let interfaceId : string = req.query.interfaceId?.toString() || ''
        let ruleAreaId: string|null = req.query.ruleAreaId?.toString() || ''
        if(!ruleAreaId || ruleAreaId.length === 0 || ruleAreaId.toLowerCase().trim() === "null" || ruleAreaId.toLowerCase().trim() === "undefined") { ruleAreaId = null; }

        //get the relevant project
        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let project = await projRepo.GetWithId(projectId);
        
        let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION);
        let pkg = await pkgRepo.GetOneByProjectID(projectId)

        let relsForIface = await getClassRelationNameElementsForInterface(project, interfaceId, ruleAreaId)
        
        let prop : BasicProperty = {
            id: ruleAreaId || '',
            name: ((ruleAreaId && ruleAreaId.length > 0) ? pkg.ruleAreas.find(a => a.id === ruleAreaId)?.ruleAreaName : '') || '',
            value: relsForIface
        };

        res.status(200).send({ payload: prop } as ResponseData);
        
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


netclassRouter.post("/netclass/clear-class-relations", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let ruleAreaId : string = req.query.ruleAreaId?.toString()?.trim() || ''
        let deleteAllRelationBrands: boolean = (req.query.deleteAllRelationBrands?.toString().trim().toLowerCase() === "true") ? true : false;

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to retrieve c2c relation layout. Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!ruleAreaId || ruleAreaId === 'undefined' || ruleAreaId.trim().length === 0) {  // IMPORTANT - this is a must have!!
            if(deleteAllRelationBrands === false) {
                throw new Error(`Failed to retrieve c2c relation layout. Input 'ruleAreaId' cannot be null or empty or undefined`);
            }
        }

        let result : boolean = await clearClassRelations(projectId, ruleAreaId, deleteAllRelationBrands);
        
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


netclassRouter.get("/netclass/get-g2g-list", async (req: Request, res: Response) => {
    try {
        let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION);
        let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
        
        let projectId : string = req.query.projectId?.toString() || ''
        let interfaceId : string = req.query.interfaceId?.toString() || ''

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        
        let result: G2GRelationContext[];
        
        if (interfaceId.trim().length > 0) {
            let iface = await ifaceRepo.GetWithId(interfaceId);
            if(!iface || !iface._id) {
                throw new Error(`Input 'interfaceId' is invalid. No such interface found in the system`);
            }
            let ifaceFilter = {interfaceId: interfaceId} as Filter<G2GRelationContext>;
            result = await g2gRepo.GetAllByProjectID(projectId, ifaceFilter);
        }
        else {
            result = await g2gRepo.GetAllByProjectID(projectId);
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


netclassRouter.post("/netclass/process-g2g-updates", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let g2gInfoList: G2GRelationContext[] = req.body as G2GRelationContext[];
        
        const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;

        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Failed to process group based C2C updates. Input 'projectId' cannot be null or empty or undefined`);
        }

        if (g2gInfoList && g2gInfoList.length > 0) {
            req.setTimeout( 1000 * 60 * 8 ); // eight minutes
            await handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.G2G_UPDATE, false, true);
            updateG2GContext(projectId, g2gInfoList, user);
            res.status(200).send({ payload: true } as ResponseData);
        }
        else {
            throw new Error(`Could not update C2C based on group-to-group relations. No valid data was provided for the operation`);
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











//=========================================================




// netclassRouter.get("/netclass/get-class-relation-layout", async (req: Request, res: Response) => {
//     try {
//         let c2crColl = getCollection(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
//         let c2crRepo = new ServiceModelRepository<C2CRow>(c2crColl)
        
//         // let ncColl = getCollection(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//         // let ncRepo = new ServiceModelRepository<Netclass>(ncColl)

//         let result = new Array<C2CRow>();

//         let projectId : string = req.query.projectId?.toString() ?? ''
//         let lastMarker : string = req.query.lastId?.toString() ?? ''
//         let limit : string = req.query.limit?.toString() ?? ''

//         let filterRuleAreaId : string = req.query.ruleAreaId?.toString()?.trim() ?? ''
//         let filterNetclassId : string = req.query.netclassId?.toString()?.trim() ?? ''
//         let filterNetclassName : string = req.query.netclassName?.toString()?.trim() ?? ''
//         // let filterExcludeSlots: boolean = (req.query.excludeSlots && req.query.excludeSlots?.toString().toLowerCase().trim() === "true") ? true : false
        
//         let hasLastMarker = (!lastMarker || lastMarker === 'undefined' || lastMarker.trim().length === 0) ? false : true;
//         let hasLimit = (!limit || limit === 'undefined' || limit.trim().length === 0) ? false : true;
//         // let filters = new Array<Filter<C2CRow>>();

//         // let projectionSpec = null;

//         if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
//             throw new Error(`Failed to retrieve netclass relation layout. Input 'projectId' cannot be null or empty or undefined`);
//         }
//         if (!filterRuleAreaId || filterRuleAreaId === 'undefined' || filterRuleAreaId.trim().length === 0) {  // IMPORTANT - this is a must have!!
//             throw new Error(`Failed to retrieve netclass relation layout. Input 'ruleAreaId' cannot be null or empty or undefined`);
//         }
//         if (hasLimit === false || (isNumber(limit) === false)) {
//             throw new Error(`Failed to retrieve netclass relation layout. Input 'limit' is required. Its value must be a valid number.`);
//         }
        
        
//         // let ncMap = new Map<string, Netclass>();
//         // let netclasses = await ncRepo.GetAllByProjectID(projectId)
//         // if(netclasses && netclasses.length > 0) {
//         //     for(let nc of netclasses) {
//         //         ncMap.set(nc._id?.toString() as string, nc)
//         //     }
//         // }
//         //=========================================================

//         // const regexRaid = new RegExp(`^${filterRuleAreaId}`, 'i');
//         // if(filterRuleAreaId && filterRuleAreaId.length > 0) {
//         //     filters.push({ ruleAreaId: regexRaid } as Filter<C2CRow>)
//         // }

//         // const regexNCId = new RegExp(`^${filterNetclassId}`, 'i');
//         // if(filterNetclassId && filterNetclassId.length > 0) {
//         //     filters.push({ netclassId: regexNCId } as Filter<C2CRow>)
//         // }

//         // const regexName = new RegExp(`^${filterNetclassName}`, 'i');
//         // if(filterNetclassName && filterNetclassName.length > 0) {
//         //     filters.push({ name: regexName } as Filter<C2CRow>)
//         // }

//         // if(filterExcludeSlots === true) {
//         //     projectionSpec = { slots: 0 }
//         // }


//         //==============================================================
//         // let sortSpec = {}
//         // if(hasLastId && hasLimit){
//         //     result = await c2crRepo.PaginationGetPageByProjectIDAndProjection(projectId, filters, lastId, parseInt(limit.trim(), 10), projectionSpec)
//         // }
//         // else if ((hasLastId === false) && hasLimit){
//         //     result = await c2crRepo.PaginationGetLastByProjectIDAndProjection(projectId, filters, parseInt(limit.trim(), 10), projectionSpec)
//         // }
//         // else {
//         //     result = await c2crRepo.GetAllByProjectIDAndProjection(projectId, filters, projectionSpec ?? {})
//         // }



//         let aggQueryAsString = AGG_QUERY_C2CROW_RETRIEVAL.replaceAll("####_PROJECTID_####", projectId)
//         aggQueryAsString = aggQueryAsString.replaceAll("####_RULEAREAID_####", filterRuleAreaId)
//         aggQueryAsString = aggQueryAsString.replaceAll("####_LIMIT_####", limit)

//         if(filterNetclassId && filterNetclassId.length > 0) {
//             aggQueryAsString = aggQueryAsString.replace("####_NETCLASSID_####", filterNetclassId)
//         }
//         else {
//             aggQueryAsString = aggQueryAsString.replace("####_NETCLASSID_####", ".*")
//         }

//         if(filterNetclassName && filterNetclassName.length > 0) {
//             aggQueryAsString = aggQueryAsString.replace("####_STARTSWITH_####", filterNetclassName)
//         }
//         else {
//             aggQueryAsString = aggQueryAsString.replace("####_STARTSWITH_####", ".*")
//         }

//         if(hasLastMarker){
//             aggQueryAsString = aggQueryAsString.replace("####_NC_NAME_LAST_ITEM_MARKER_####", lastMarker)
//         }
//         else {
//             aggQueryAsString = aggQueryAsString.replace("####_NC_NAME_LAST_ITEM_MARKER_####", "")
//         }

        
//         let c2cAggCursor = c2crRepo.RunAggregation(aggQueryAsString, true)
//         result = (await c2cAggCursor?.toArray() ?? []) as C2CRow[]

        


//         //==============================================================


//         res.status(200).send({ payload: result } as ResponseData);
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// });




//======================================


//000000000000000000000000

// let aggQueryAsString = AGG_QUERY_C2CROW_RETRIEVAL.replace("####_PROJECTID_####", projectId)


// let aggQueryAsString = AGG_QUERY_C2CROW_RETRIEVAL.replace("####_PROJECTID_####", projectId)

//         if(hasLastId && hasLimit){
//             let aggQueryAsString = AGG_QUERY_C2CROW_RETRIEVAL.replace("####_LASTID_####", projectId)
//             let aggQueryAsString = AGG_QUERY_C2CROW_RETRIEVAL.replace("####_LIMIT_####", projectId)
//             // result = await lgcRepo.PaginationGetPageByProjectIDAndProjection(projectId, filters, lastId, parseInt(limit.trim(), 10), projectionSpec)
//         }
//         else if ((hasLastId === false) && hasLimit){
//             // 000000000000000000000000  result = await lgcRepo.PaginationGetLastByProjectIDAndProjection(projectId, filters, parseInt(limit.trim(), 10), projectionSpec)
//         }
//         else {
//             result = await lgcRepo.GetAllByProjectIDAndProjection(projectId, filters, projectionSpec ?? {})
//         }


//         let aggCursor = netsRepo.RunAggregation(aggQueryAsString, true)

//         let retInfo = await aggCursor?.toArray() ?? []

//         if (retInfo.length > 0) {
//             for(let i = 0; i < retInfo.length; i++) {
//                 let netclassId = retInfo[i]._id?.trim()
//                 let autoTotal = retInfo[i].autoAssignedCount
//                 let manualTotal = retInfo[i].manualAssignedCount
//                 if(netclassId && netclassId.length > 0) {
//                     if (netclassStatMap.has(netclassId) === false) {
//                         throw new Error(`Netclass element returned in netclass stas query may not belong to project. Please check query accuracy!`);
//                     }
//                     let statObj = netclassStatMap.get(netclassId) as NCStats
//                     statObj.manuallyAssigned = manualTotal,
//                     statObj.autoAssigned = autoTotal,
//                     statObj.totalNetclassNets = (manualTotal + autoTotal)
//                     netclassStatMap.set(netclassId, statObj)
//                 }
//             }
//         }


//==================================================================





// netclassRouter.get("/netclass/replace-project-netclasses", async (req: Request, res: Response) => {
//     try {
//         let projectId : string = req.query.projectId?.toString() ?? ''
//         if (!projectId || projectId === 'undefined' || projectId.length === 0) {
//             throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
//         }

//         const netclasses: Netclass[] = req.body as Netclass[];
        
//         if (netclasses && netclasses.length > 0) {
//             let updatedNetclasses = await updateProjectNetclasses(projectId, netclasses);
//             res.status(200).send({ payload: updatedNetclasses } as ResponseData);
//         }
//         else {
//             throw new Error(`Could not update netclasses for project because no valid netclass was provided for the operation`);
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



//update netclass (rename, change pattern, change sequence num)

//move netclass to another interface






// export const AGG_QUERY_C2CROW_RETRIEVAL2 = `db.getCollection("Netclass").aggregate([
//     {
//       $lookup: {
//         from: "Interface",
//         let: { ncIdStr: { $toString: "$interfaceId" } },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $eq: [{ $toString: "$_id" }, "$$ncIdStr"]
//               }
//             }
//           }
//         ],
//         as: "ifaceDetails"
//       }
//     },
//     {
//       $unwind: "$ifaceDetails"
//     },
//     {
//       $addFields: {
//         ifaceName: "$ifaceDetails.name"
//       }
//     },
//     {
//       $sort: {
//         ifaceName: 1
//       }
//     },
//     {
//       $project: {
//         ifaceDetails: 0
//       }
//     }
//   ])`
  