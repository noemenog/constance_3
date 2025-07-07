import express, { Request, Response } from "express";
import { BaseUserInfo, BasicProperty, ConfigItem, PropertyItem, ResponseData, User } from "../../Models/HelperModels";
import { CommonPropertyCategoryEnum, ConstraintPropertyCategoryEnum, DBCollectionTypeEnum, ErrorSeverityValue, GOLDEN_INDICATOR_NAME, ProjectPropertyCategoryEnum } from "../../Models/Constants";
import { getConstraintSettingsForOrg, getGenConfigs } from "../../BizLogic/ConfigLogic";
import { isNumber, rfdcCopy } from "../../BizLogic/UtilFunctions";
import { getLatestVersions } from "../../BizLogic/BasicCommonLogic";
import { ChangeContext, DefaultConstraints, G2GRelationContext, Interface, LinkageInfo, Netclass, PackageLayout, Project, SnapshotContext } from "../../Models/ServiceModels";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { sort } from "fast-sort";
import { produceG2GInfoAndScaledNCListBasedOnChannelExpr } from "../../BizLogic/InterfaceLogic";
import { Filter, ObjectId } from "mongodb";
import { retrieveAndFormatDefCon } from "../../BizLogic/DefaultConstraintsLogic";
import { deleteProject } from "../../BizLogic/ProjectLogic";
import { runAutoDiffPairingLogic } from "../../BizLogic/NetListLogic";





export const commonRouter = express.Router();


commonRouter.get("/init/get-configs", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let genConfigs: ConfigItem[] = []
        
        if(projectId && (projectId.trim().length > 0) && (projectId.trim().toLowerCase() !== "undefined")){
            genConfigs = await getGenConfigs(projectId, null, false);
        }
        else {
            genConfigs = await getGenConfigs(null, null, true);
        }

        res.status(200).send({ payload: genConfigs ?? [] } as ResponseData);
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


commonRouter.get("/history/get-latest-versions", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        let uniqueId : string = req.query.uniqueId?.toString() || ''
        let limit : string = req.query.limit?.toString() || ''
        
        if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        }
        if (!uniqueId || uniqueId === 'undefined' || uniqueId.trim().length === 0) {
            throw new Error(`Input 'uniqueId' cannot be null or empty or undefined`);
        }
        if (!limit || limit.toString().trim() === 'undefined' || limit.toString().trim().length === 0) {
            throw new Error(`Input 'limit' cannot be null or empty or undefined`);
        }
        else if(isNumber(limit) === false || Number(limit) <= 0) {
            throw new Error(`Input 'limit' must be a valid number that is greater than 0`);
        }

        let latest : ChangeContext = await getLatestVersions(projectId, uniqueId, Number(limit));

        res.status(200).send({ payload: latest } as ResponseData);
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




commonRouter.get("/corrections/execute", async (req: Request, res: Response) => {
    try {
        const exekey = req.headers.exekey?.toString()?.trim() || null;
        const host = req.headers.host?.toString()?.trim() || null;
        if(!exekey || exekey !== "6dba499d-d4ea-4e85-8978-fb26f7eb3083__5e24194a-105e-4133-bf5c-85b6cca8574c" || host !== "localhost:7000") {
            throw new Error(`Sorry buddy! Execution is unauthorized!`);
        }
        
        //-------------------------------------------------
        // #region  -----     Q2,2025 - 05232024
        //-------------------------------------------------
        /*
            Deployment Notes
                • INTERFACE:
                    ○ Rename template org from dcai to 'SERVERS'
                    
                • G2G:
                    ○ Add "G2G element as necessary for each interface
                    
                • NETCLASS:
                    ○ Add channel to netclass - should be blank string if no channeling
                    ○ Add Segment to netclass - should be blank string if no segmenting
                    
                • PROJECT:
                    ○ Add following to Project:
                        • physicalLinkages: LinkageInfo[];
                        • clearanceLinkages: LinkageInfo[];
                        • clearanceRelationBrands: BasicProperty[];
                            □ Move CLEARANCE_RELATION additionalProperties value to the project.clearanceRelationBrands
                    ○ Move configured project properties to a new member called "profileProperties"
                    ○ Move description and maturity to root of project
                    ○ Ensure createdBy is at root level
                    ○ Add "IFS_GUARD" property in project's associatedProperties list
                    
                • NETS DB:
                    ○ Delete ChangeContext collection from nets DB
                    
                • CONFIGURATION IN CONSTANCE:
                    ○ Add new permission roles: 
                        § COPY_OVER_PHY_RULES
                        § G2G_ACTION
                
                    ○ Add the following to 'org_settings' in Constance
                        § generalConfigsBucketId
                        § constraintSettingsBucketId
                        § interfaceTemplatesBucketId
                    
                    ○ For all DCAI projects, change the org to "Server"
                    ○ Remove "genConfBucketId" from "org_settings" in Constance --- once depl changes are in and it's no longer needed
                    ○ Potentially rearrange the clearance constraints in Constance to suit DCAI needs
        */
        //--------------------------------------------------------------------

        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION);
        let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
        let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION);
        let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
        let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
        let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
                
        let projFilter = { enabled: true } as Filter<Project>;
        let projects : Project[] = (await projRepo.GetWithFilter(projFilter)) ?? [] //if all else fails, just use this basic GetWithFilter call
        projects = sort(projects).desc(x => x.lastUpdatedOn)

        for (let proj of projects) {
            
            let snaps = (await snapRepo.GetAllByProjectID(proj.projectId)) ?? [];
            let interfaceList = (await ifaceRepo.GetAllByProjectID(proj.projectId)) ?? [];
            let netclassList = (await netclassRepo.GetAllByProjectID(proj.projectId)) ?? [];
            let defConList = (await defConRepo.GetAllByProjectID(proj.projectId)) ?? [];
            let pkg = await pkgRepo.GetOneByProjectID(proj.projectId);

            let newG2GList = new Array<G2GRelationContext>();

            //if no PKG, just go ahead and delete the project!
            if(!pkg) {
                await deleteProject(proj.projectId);
                continue;
            }

            //run something for specific project
            // if(["67ec0146cdb80f2629bb1b01", "684c30eded9de9cb8e1215b8"].includes(proj._id?.toString() as string)) {
            //     await runAutoDiffPairingLogic(proj)
            // }


            for(let iface of interfaceList) {
                //handle G2G specifications
                let g2gIfaceFilter = {interfaceId: iface._id?.toString() as string} as Filter<G2GRelationContext>; 
                let existingIfaceG2G = (await g2gRepo.GetAllByProjectID(proj.projectId, g2gIfaceFilter)) ?? [];
                if(existingIfaceG2G.length === 0) {
                    let ifaceNCList = netclassList.filter(a => (a.interfaceId === (iface._id?.toString() as string)))
                    let resultG2GinfoArray = produceG2GInfoAndScaledNCListBasedOnChannelExpr(iface, "", ifaceNCList, false)?.resultG2GinfoArray ?? [];
                    resultG2GinfoArray.forEach(x => newG2GList.push(x))
                }

                //rename template org from dcai to servers
                if(iface.sourceTemplate.org.toLowerCase().trim() === "dcai") {
                    iface.sourceTemplate.org = "SERVERS";
                }

            }


            //handle channnel & segment for netclasses
            for(let ncItem of netclassList) {
                if(!ncItem.channel) {
                    ncItem.channel = "";
                }
                if(!ncItem.segment) {
                    ncItem.segment = "";
                }
            }

            //handle relocarion of clearance relation brands
            let crbList = proj.associatedProperties.find(a => (a.category === "CLEARANCE_RELATION"))
            if(crbList && crbList.value && crbList.value.length > 0) {
                proj.clearanceRelationBrands = crbList.value;
                proj.associatedProperties = proj.associatedProperties.filter(x => x.category !== "CLEARANCE_RELATION")
            }
            else if(!proj.clearanceRelationBrands) {
                proj.clearanceRelationBrands = []
            }


            //handle relocation of description, maturity, createdBy
            let desc = proj.associatedProperties.find(a => (a.name === "Description"))
            if(desc !== undefined) {
                proj.description = desc.value || "";
                proj.associatedProperties = proj.associatedProperties.filter(x => x.name !== "Description")
            }
            else if(!proj.description){
                proj.description = ""
            }

            let maturity = proj.associatedProperties.find(a => (a.name === "Maturity"))
            if(maturity !== undefined) {
                proj.maturity = maturity.value || "0";
                proj.associatedProperties = proj.associatedProperties.filter(x => x.name !== "Maturity")
            }
            else if(!proj.maturity){
                proj.maturity = "0"
            }

            let createdBy = proj.associatedProperties.find(a => (a.name === "Created By"))
            if(createdBy !== undefined) {
                proj.createdBy = createdBy.value || "ndubuisi.emenogu@intel.com";
                proj.associatedProperties = proj.associatedProperties.filter(x => x.name !== "Created By")
            }
            else if (!proj.createdBy){
                proj.createdBy = proj.owner.email || "ndubuisi.emenogu@intel.com";
            }


            //set correct project owner info
            if(!proj.owner.email || !proj.owner.idsid) {
                let ownerInfo : BaseUserInfo = {
                    email: proj.createdBy,
                    idsid: proj.owner.toString()
                };
                proj.owner = ownerInfo
            }


            //handle linkage properties
            if(!proj.physicalLinkages) {
                proj.physicalLinkages = new Array<LinkageInfo>();
            }
            if(!proj.clearanceLinkages) {
                proj.clearanceLinkages = new Array<LinkageInfo>();
            }

            //change dcai org type to servers
            if(proj.org.trim().toLowerCase() === "dcai") {
                proj.org = "SERVERS";
            }


            //handle IFS Guard property
            let exisSAGProp = proj.associatedProperties.find(a => (a.category === ProjectPropertyCategoryEnum.ACCESS_GUARD))
            if(!exisSAGProp) {
                let newSAGProp : PropertyItem = {
                    id: crypto.randomUUID(),
                    name: ProjectPropertyCategoryEnum.ACCESS_GUARD,
                    displayName : ProjectPropertyCategoryEnum.ACCESS_GUARD,
                    category: ProjectPropertyCategoryEnum.ACCESS_GUARD,
                    editable: false,
                    enabled: true,
                    value: "",
                }
                proj.associatedProperties.push(newSAGProp);
            }


            //handle diff exclusion criteria property
            let diffex = proj.associatedProperties.find(a => (a.category === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA))
            if(!diffex) {
                let newDiffexProp : PropertyItem = {
                    id: crypto.randomUUID(),
                    name: ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA,
                    displayName : ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA,
                    category: ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA,
                    editable: false,
                    enabled: true,
                    value: [],
                }
                proj.associatedProperties.push(newDiffexProp);
            }


            //handle diff exclusion criteria property
            let pendProc = proj.associatedProperties.find(a => (a.category === ProjectPropertyCategoryEnum.PENDING_PROCESSES))
            if(!pendProc) {
                let newPendProcProp : PropertyItem = {
                    id: crypto.randomUUID(),
                    name: ProjectPropertyCategoryEnum.PENDING_PROCESSES,
                    displayName : ProjectPropertyCategoryEnum.PENDING_PROCESSES,
                    category: ProjectPropertyCategoryEnum.PENDING_PROCESSES,
                    editable: false,
                    enabled: true,
                    value: [],
                }
                proj.associatedProperties.push(newPendProcProp);
            }


            //handle profile properties
            if(!proj.profileProperties || proj.profileProperties.length === 0) {
                proj.profileProperties = new Array<PropertyItem>();
                let profileProps = proj.associatedProperties.filter(a => (a.category === CommonPropertyCategoryEnum.GENERAL_CONFIGURED_FIXED_KEY)) ?? []
                profileProps.forEach(k => proj.profileProperties.push(k));
                proj.associatedProperties = proj.associatedProperties.filter(a => (a.category !== CommonPropertyCategoryEnum.GENERAL_CONFIGURED_FIXED_KEY));
            }


            //Constraint Properties:  handle change in clearance net properties
            let allConstrProps: PropertyItem[] = await getConstraintSettingsForOrg(null, proj.org, true);
            ([ConstraintPropertyCategoryEnum.Net, ConstraintPropertyCategoryEnum.Physical, ConstraintPropertyCategoryEnum.Clearance]).forEach(type => {
                let relevProps = allConstrProps?.filter(a =>  a.category && a.category.toLowerCase().trim() === type.toLowerCase())
                let nameSet = new Set<string>(relevProps.map(a => a.name.toLowerCase().trim()))
                if(nameSet.size !== relevProps.length){
                    throw new Error(`Error: ${type} constraint properties must have unique names. Check config mgmt system.`)
                }
                let displayNameSet = new Set<string>(relevProps.map(a => a.displayName.toLowerCase().trim()))
                if(displayNameSet.size !== relevProps.length){
                    throw new Error(`Error: ${type} constraint properties must have unique display names. Please check config mgmt system.`)
                }
            })
            proj.constraintSettings = allConstrProps;


            //handle all default constraints "isGolden" field
            if(defConList && defConList.length > 0) {
                for(let d = 0; d < defConList.length; d++) {
                    if(defConList[d].tags.includes(GOLDEN_INDICATOR_NAME)) {
                        defConList[d].isGolden = true;
                    }
                    else {
                        defConList[d].isGolden = false;
                    }
                }
            }

            //handle all default LGSet "isGolden" field
            if(pkg && pkg.layerGroupSets && pkg.layerGroupSets.length > 0) {
                for(let s = 0; s < pkg.layerGroupSets.length; s++) {
                    if(pkg.layerGroupSets[s].tags.includes(GOLDEN_INDICATOR_NAME)) {
                        pkg.layerGroupSets[s].isGolden = true;
                    }
                    else {
                        pkg.layerGroupSets[s].isGolden = false;
                    }
                }
            }

            // //commit changes to DB
            // if(interfaceList.length > 0) {
            //     await ifaceRepo.ReplaceMany(interfaceList);
            // }
            // if(netclassList.length > 0) {
            //     await netclassRepo.ReplaceMany(netclassList);
            // }
            // if(newG2GList.length > 0) {
            //     await g2gRepo.CreateMany(newG2GList);
            // }
            // if(proj) {
            //     await projRepo.ReplaceOne(proj);
            // }
            // if(snaps && snaps.length > 0) {
            //     snaps.forEach(x => { x.enabled = false} )
            //     await snapRepo.ReplaceMany(snaps); //this will disable all snapshots!
            // }
            // if(pkg && pkg.layerGroupSets) {
            //     await pkgRepo.ReplaceOne(pkg)
            // }
            // if(defConList && defConList.length > 0) {  //IMPORTANT! do this one last - because pkg might be updated within retrieveAndFormatDefCon()!
            //     await defConRepo.ReplaceMany(defConList)
            //     let gldName = defConList.find(x => (x.isGolden === true))?.nameIdentifier as string
            //     await retrieveAndFormatDefCon(proj.projectId, gldName, true) //this will reset any ruleArea where defCon is unknown ID
            // }
            
        }

        //#endregion --- Q2,2025
        //-------------------------------------------------


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















//================================================================================================================================

// let infilter = { projectId: projectId, "slots.netclassId" : { $in: remActionNCIds } as any } as Filter<C2CRow>;





// commonRouter.post("/history/save-version", async (req: Request, res: Response) => {
//     try {
//         const changeCtx: ChangeContext = req.body as ChangeContext;
//         const user = (req.headers.user) ? JSON.parse(req.headers.user as string) as User : null;

//         if (!changeCtx) {
//             throw new Error(`Could not save version information. The required data is either invalid or not provided`);
//         }
//         if (!changeCtx.data) {
//             throw new Error(`Could not save version information. 'data' provided for ChangeContext cannot be null or undefined`);
//         }
//         if (!changeCtx.uniqueId || changeCtx.uniqueId === 'undefined' || changeCtx.uniqueId.trim().length === 0) {
//             throw new Error(`Could not save version information. 'uniqueId' for ChangeContext cannot be null or empty or undefined`);
//         }
//         if (!changeCtx.projectId || changeCtx.projectId.toString().trim() === 'undefined' || changeCtx.projectId.toString().trim().length === 0) {
//             throw new Error(`Could not save version information. 'projectId' for ChangeContext cannot be null or empty or undefined`);
//         }
            
//         let latest : ChangeContext = await saveLatestVersion(changeCtx, user);

//         res.status(200).send({ payload: latest } as ResponseData);
        
//     }
//     catch (e: any) {
//         let resp = {
//             payload: undefined,
//             error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
//         }
//         res.status(500).json(resp);
//     }
// });






// initRouter.get("/init/get-constraint-config-properties", async (req: Request, res: Response) => {
//     try {
//         let projectId : string = req.query.projectId?.toString() || ''
//         let org: string = req.query.org?.toString() || ''

//         if (!org || org === 'undefined' || org.trim().length === 0) {
//             throw new Error(`Input 'org' cannot be null or empty or undefined`);
//         }

//         let constraintprops = await getConstraintSettingsForOrg(projectId, org)
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




// const relevantItems = new Set<string>([
//     AppConfigConstants.CONFIGITEM__Shadow_Void_Columns,
//     AppConfigConstants.CONFIGITEM__Rule_Area_Settings,
//     AppConfigConstants.CONFIGITEM__Materials,
//     AppConfigConstants.CONFIGITEM__Substrate_Technologies,
//     AppConfigConstants.CONFIGITEM__Orgs,
//     AppConfigConstants.CONFIGITEM__Power_Components_Columns,
//     AppConfigConstants.CONFIGITEM__Power_Rails_Columns,
//     AppConfigConstants.CONFIGITEM__Maturity_Values,
//     AppConfigConstants.CONFIGITEM__Page_Title_Settings,
//     AppConfigConstants.CONFIGITEM__Permission_Context,
// ])

// genConfigs = genConfigs.filter(a => relevantItems.has(a.configName))