import express, { Request, Response } from "express";
import { DBCollectionTypeEnum, ErrorSeverityValue, LGSET_TAG_SORT } from "../../Models/Constants";
import { ResponseData } from "../../Models/HelperModels";
import { Interface, LayerGroupSet, PackageLayout, Project, StackupGenInfo, StackupLayer } from "../../Models/ServiceModels";
import { ServiceModelRepository } from "../../Repository/ServiceModelRepository";
import { createStackup } from "../../BizLogic/StackupLogic";
import { evaluateLGSetsForStackupChangeScenario, processLGSetChanges } from "../../BizLogic/LayerGroupLogic";
import { processRuleAreaChanges } from "../../BizLogic/RuleAreaLogic";
import { rfdcCopy } from "../../BizLogic/UtilFunctions";
import { Filter } from "mongodb";

   

export const packageLayoutRouter = express.Router();

packageLayoutRouter.get("/layout/get-pkglayout", async (req: Request, res: Response) => {
    try {
        let projectId : string = req.query.projectId?.toString() || ''
        
        let pkgArr: PackageLayout[] = [];
        let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)

        if(projectId && projectId !== "undefined" && projectId.trim().length > 0) {
            let pkg = await pkgRepo.GetOneByProjectID(projectId)
            if(pkg) {
                pkg.ruleAreas = pkg.ruleAreas.sort((a, b) => a.ruleAreaName < b.ruleAreaName ? -1 : 1);
                for(let i = 0; i < pkg.layerGroupSets.length; i++) {
                    for(let j = 0; j < pkg.layerGroupSets[i].layerGroups.length; j++) {
                        pkg.layerGroupSets[i].layerGroups[j].layers = pkg.layerGroupSets[i].layerGroups[j].layers.sort((a, b) => a.name < b.name ? -1 : 1);
                    }

                    if(pkg.layerGroupSets[i].tags.includes(LGSET_TAG_SORT) === true) {
                        pkg.layerGroupSets[i].layerGroups = pkg.layerGroupSets[i].layerGroups.sort((a, b) => a.name < b.name ? -1 : 1);
                    }
                }
                pkg.layerGroupSets = pkg.layerGroupSets.sort((a, b) => a.name < b.name ? -1 : 1);
            }
            pkgArr = [pkg]
        }
        else {
            let filter = { stackupGenInfo: { $ne: null } }as Filter<PackageLayout>
            let projection = { projectId: 1, ruleAreas: 1, layerGroupSets: 1, stackupLayers: 1, stackupGenInfo: 1 }
            pkgArr = await pkgRepo.GetByFilterAndProjection(filter, projection)
        }

        res.status(200).send({ payload: pkgArr } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        res.status(500).json(resp);
    }
});


packageLayoutRouter.post("/layout/create-stackup", async (req: Request, res: Response) => {
    try {
        const stackupInfo: StackupGenInfo = req.body as StackupGenInfo;
        let previewMode: boolean = (req.query.previewMode?.toString().trim().toLowerCase() === "true") ? true : false;

        if (stackupInfo) {
            if(stackupInfo.projectId && stackupInfo.projectId.length > 0) {
                let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
                let project = await projRepo.GetWithId(stackupInfo.projectId)
                if(!project) {
                    throw new Error("Failed to perform stackup update. System could not find a project pertaining to the stackup")
                }

                let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
                let existingPkg = await pkgRepo.GetOneByProjectID(stackupInfo.projectId)
                if(!existingPkg) {
                    throw new Error("Cannot create stackup. Layout container is expected to exist but was not found for the project")
                }

                let newStkLayers : StackupLayer[] = await createStackup(stackupInfo);
                let modPkg = rfdcCopy<PackageLayout>(existingPkg) as PackageLayout;
                let hasLayerGroupsAlready = (existingPkg.layerGroupSets && (existingPkg.layerGroupSets.length > 0) 
                    && existingPkg.layerGroupSets.some(x => (x.layerGroups && x.layerGroups.length > 0)));

                if(newStkLayers && newStkLayers.length > 0) {
                    if(previewMode) {
                        modPkg.stackupGenInfo = stackupInfo;
                        modPkg.stackupLayers = newStkLayers;
                        modPkg.layerGroupSets = []
                    }
                    else {
                        // non-preview mode starts here...
                        if(hasLayerGroupsAlready === true) {
                            //recreate scenario...

                            let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
                            let projection = { name: 1 }
                            let ifaces = await ifaceRepo.GetAllByProjectIDAndProjection(stackupInfo.projectId, null, projection) ?? [];

                            let isRecreateScenario = (existingPkg.stackupLayers && existingPkg.stackupLayers.length > 0 ) ? true : false; //i know... obviously true already...
                            let hasExistingRLs = existingPkg.stackupLayers.some(a => a.routingLayerType && a.routingLayerType.trim().length > 0 && a.routingLayerType.trim().toLowerCase() !== "none");
                            let allowZeroRoutingLayerSelection = ((ifaces.length === 0) || (isRecreateScenario === false) || (hasExistingRLs === false)) ? true : false;

                            if((allowZeroRoutingLayerSelection === false) && (!stackupInfo.initialSelectedRoutingLayers || stackupInfo.initialSelectedRoutingLayers.length === 0)) {
                                throw new Error(`No routing layers were selected. Routing layers are required for current stackup recreation scenario!`)
                            }

                            modPkg.stackupLayers = newStkLayers
                            modPkg.stackupGenInfo = stackupInfo;
                            modPkg.lastUpdatedOn = new Date(); 

                            if(stackupInfo.initialSelectedRoutingLayers && stackupInfo.initialSelectedRoutingLayers.length > 0) {
                                //set routing layers on new stackup
                                for(let rlInfo of stackupInfo.initialSelectedRoutingLayers) {
                                    for(let k = 0; k < newStkLayers.length; k++) {
                                        if(rlInfo.key.toLowerCase() === newStkLayers[k].name.toLowerCase()) {
                                            newStkLayers[k].routingLayerType = rlInfo.value;
                                            break;
                                        }
                                    }
                                }
                                let performSepFSBSGrouping : boolean = stackupInfo.separateFrontSideBackSideGrouping || false;
                                //note 'freshest' parameter is set to 'false'
                                modPkg = await evaluateLGSetsForStackupChangeScenario(newStkLayers, modPkg, project, performSepFSBSGrouping, false);   
                            }
                            else {
                                modPkg.layerGroupSets = new Array<LayerGroupSet>();
                            }

                            
                        }
                        else {
                            //fresh scenario - new stackup
                            modPkg.stackupLayers = newStkLayers
                            modPkg.stackupGenInfo = stackupInfo;
                            modPkg.lastUpdatedOn = new Date(); 

                            if(stackupInfo.initialSelectedRoutingLayers && stackupInfo.initialSelectedRoutingLayers.length > 0) {
                                //set routing layers on new stackup
                                for(let rlInfo of stackupInfo.initialSelectedRoutingLayers) {
                                    for(let k = 0; k < newStkLayers.length; k++) {
                                        if(rlInfo.key.toLowerCase() === newStkLayers[k].name.toLowerCase()) {
                                            newStkLayers[k].routingLayerType = rlInfo.value;
                                            break;
                                        }
                                    }
                                }
                                let performSepFSBSGrouping : boolean = stackupInfo.separateFrontSideBackSideGrouping || false;
                                modPkg = await evaluateLGSetsForStackupChangeScenario(newStkLayers, modPkg, project, performSepFSBSGrouping, true);   
                            }
                            else {
                                modPkg.layerGroupSets = new Array<LayerGroupSet>();
                            }
                        }

                        await pkgRepo.ReplaceOne(modPkg);
                        modPkg = await pkgRepo.GetOneByProjectID(stackupInfo.projectId)  

                    }
                }
                else {
                    throw new Error(`System failed to generate new stackup based on submitted data`);
                }

                res.status(200).send({ payload: modPkg } as ResponseData);

            }
            else {
                throw new Error(`Input stackup creation data must contain valid and non-empty 'projectId'`);
            }
        }
        else {
            throw new Error(`Could not setup new stackup. Invalid or incomplete stackup information was provided for the operation`);
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


packageLayoutRouter.post("/layout/update-stackup", async (req: Request, res: Response) => {
    try {
        const inputPkg : PackageLayout = req.body;

        if (inputPkg && inputPkg.projectId && inputPkg.projectId.length > 0 && inputPkg.stackupLayers && inputPkg.stackupLayers.length > 0) {
            
            let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
            let project = await projRepo.GetWithId(inputPkg.projectId)
            if(!project) {
                throw new Error("Failed to perform stackup update. System could not find a project pertaining to the stackup")
            }

            let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
            let existingPkg = await pkgRepo.GetOneByProjectID(inputPkg.projectId)

            if(existingPkg && existingPkg._id) {
                if(existingPkg.stackupLayers && existingPkg.stackupLayers.length > 0) {
                    existingPkg.stackupLayers = inputPkg.stackupLayers;
 
                    req.setTimeout(1000 * 60 * 8); // eight minutes
                    let performSepFSBSGrouping : boolean = existingPkg.stackupGenInfo?.separateFrontSideBackSideGrouping || false;
                    existingPkg = await evaluateLGSetsForStackupChangeScenario(inputPkg.stackupLayers, existingPkg, project, performSepFSBSGrouping, false);
                                    
                    await pkgRepo.ReplaceOne(existingPkg);
                    let finalPkg = await pkgRepo.GetOneByProjectID(inputPkg.projectId)
                    
                    res.status(200).send({ payload: finalPkg } as ResponseData);

                }
                else {
                    throw new Error(`Could not update stackup. The system found no existing stackup information to 'update'`);
                }
            }
            else {
                throw new Error("Cannot update stackup. Layout container is expected to exist but was not found for the project")
            }
        }
        else {
            throw new Error(`Could not update stackup. Invalid or incomplete information was provided for the operation`);
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


packageLayoutRouter.post("/layout/update-ruleareas", async (req: Request, res: Response) => {
    try {
        const inputPkg : PackageLayout = req.body;
        if (inputPkg && inputPkg.projectId && inputPkg.projectId.length > 0 && inputPkg.ruleAreas && inputPkg.ruleAreas.length > 0) {
                let pkg = await processRuleAreaChanges(inputPkg)
                if(!pkg) {
                    throw new Error("Unknown error occured while processing rule area changes")
                }

                res.status(200).send({ payload: pkg } as ResponseData);
        }
        else {
            throw new Error(`Could not update rule areas. Invalid or incomplete information was provided for the operation`);
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


packageLayoutRouter.post("/layout/update-layergroups", async (req: Request, res: Response) => {
    try {
        const inputPkg : PackageLayout = req.body;
        if (inputPkg && inputPkg.projectId && inputPkg.projectId.length > 0 && inputPkg.layerGroupSets && inputPkg.layerGroupSets.length > 0) {
                let pkg = await processLGSetChanges(inputPkg)
                if(!pkg) {
                    throw new Error("Unknown error occured while processing layer grouping changes")
                }

                res.status(200).send({ payload: pkg } as ResponseData);
        }
        else {
            throw new Error(`Could not update layer grouping. Invalid or incomplete information was provided for the operation`);
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



















        // if (!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
        //     throw new Error(`Input 'projectId' cannot be null or empty or undefined`);
        // }





        //determine if to retain routing layers
        //TODO:
        //actually the UI should force the user to select routing layers on the spot if its a recreate scenario.
        //      prepopulate the UI with layers that already exist and are set to be routed - that way user is just adjusting things if needed
        //      UI will send a dictionary of new routing layer info and we use that here
        //          UI should show routing layers for existing stackup - just to give user idea of what was there...


        //ensure that stackupInfo.initialSelectedRoutingLayers is not null or empty otherwise bail out with error!!!!
//         let isRecreateScenario = (recScenarioExistingLayers && (recScenarioExistingLayers.length > 0)) ? true : false;
// let existingRoutinglayers = getRoutingLayerNames(recScenarioExistingLayers ?? []);
// let allowZeroRoutingLayerSelection = ((isRecreateScenario === false) || (existingRoutinglayers.length === 0) || (projectInterFaceCount === 0)) ? true : false;


//         if(!stackupInfo.initialSelectedRoutingLayers || stackupInfo.initialSelectedRoutingLayers.length === 0) {
//             throw new Error(`No routing layers were selected. Routing layers are required for stackup recreation scenario!`)
//         }

//         let layerToRouteTypeMapping = new Map<string, string>(); // should only have layers where routing is selected, and their routing type: 'routing/mix'
    

//         modPkg.layerGroupSets = new Array<LayerGroupSet>()
//         modPkg.stackupGenInfo = stackupInfo;
//         modPkg.lastUpdatedOn = new Date();
    
//         //&& layerToRouteTypeMapping.size > 0)
//         //this is recreation scenario
//         req.setTimeout( 1000 * 60 * 8 ); // eight minutes
//         await createAutoGenSnapshot(stackupInfo.projectId);

//         let modNewStkLayers = rfdcCopy<StackupLayer[]>(newStkLayers) as StackupLayer[];
//         for(let x = 0; x < modNewStkLayers.length; x++) {
//             if(layerToRouteTypeMapping.has(modNewStkLayers[x].name.trim().toLowerCase())) {
//                 modNewStkLayers[x].routingLayerType = layerToRouteTypeMapping.get(modNewStkLayers[x].name.trim().toLowerCase()) as string;
//             }
//         }
//         req.setTimeout(1000 * 60 * 8); // eight minutes
//         let performSepFSBSGrouping : boolean = stackupInfo.separateFrontSideBackSideGrouping || false;
//         modPkg = await evaluateLGSetsForStackupChangeScenario(modNewStkLayers, modPkg, project, performSepFSBSGrouping, false);
//         modPkg.stackupLayers = modNewStkLayers; //Important to redo this assignment




    // if (freshest === true) {
    //     let newLayerGroups: LayerGroup[] = await generateLayerGroups(project, inputStackupLayers, performSepFSBSGrouping);
    //     let lgSet: LayerGroupSet = {
    //         id: crypto.randomUUID(),
    //         name: GOLDEN_INDICATOR_NAME,
    //         layerGroups: newLayerGroups,
    //         isPhysicalDefault: true,
    //         isClearanceDefault: true,
    //         tags: [GOLDEN_INDICATOR_NAME, LGSET_TAG_SORT], //important!!
    //     };
    //     pkg.layerGroupSets = [lgSet];
    // }






//===============================================


// packageLayoutRouter.post("/layout/create-stackup", async (req: Request, res: Response) => {
//     try {
//         const stackupInfo: StackupGenInfo = req.body as StackupGenInfo;
        
//         if (stackupInfo) {
//             if(stackupInfo.projectId && stackupInfo.projectId.length > 0) {
//                 let smRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
//                 let existingPkg = await smRepo.GetOneByProjectID(stackupInfo.projectId)

//                 if(existingPkg && existingPkg._id) {
//                     //necessary for determining new vs recreate scenario!
//                     let existingLayerGroups = new Array<LayerGroup>()
//                     for(let lgSet of existingPkg.layerGroupSets) {
//                         for (let lg of lgSet.layerGroups) {
//                             existingLayerGroups.push(lg)
//                         }
//                     }
                    
//                     let modPkg = {...existingPkg}

//                     let newStkLayers : StackupLayer[] = await createStackup(stackupInfo);
//                     modPkg.stackupLayers = newStkLayers
//                     modPkg.layerGroupSets = new Array<LayerGroupSet>() //in this case, always!
//                     modPkg.stackupGenInfo = stackupInfo;                   
                    
//                     let result = await smRepo.ReplaceOne(modPkg);
                    
//                     if(result === true && existingLayerGroups.length > 0) {
//                         req.setTimeout( 1000 * 60 * 8 ); // eight minutes
//                         await handleStackupRecreationShakeup(modPkg, existingLayerGroups)
//                     }
                    
//                     res.status(200).send({ payload: modPkg } as ResponseData);
//                 }
//                 else {
//                     throw new Error("Cannot create stackup. Layout container is expected to exist but was not found for the project")
//                 }
//             }
//             else {
//                 throw new Error(`Input stackup creation data must contain valid and non-empty 'projectId'`);
//             }
//         }
//         else {
//             throw new Error(`Could not setup new stackup. Invalid or incomplete stackup information was provided for the operation`);
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


//================================================================================



                
                // modPkg.stackupLayers = newStkLayers
                // modPkg.layerGroupSets = new Array<LayerGroupSet>() //in this case, always!
                // modPkg.stackupGenInfo = stackupInfo;                   
                
                // let result = await pkgRepo.ReplaceOne(modPkg);
                
                // if(result === true && existingLayerGroups.length > 0) {
                //     req.setTimeout( 1000 * 60 * 8 ); // eight minutes
                //     await handleStackupRecreationShakeup(modPkg, existingLayerGroups)
                // }
                    
                // res.status(200).send({ payload: modPkg } as ResponseData);
                
                
                // let modPkg = rfdcCopy<PackageLayout>(existingPkg);
                

                //============


                // //necessary for determining new vs recreate scenario!
                // let existingLayerGroups = new Array<LayerGroup>()
                // for(let lgSet of existingPkg.layerGroupSets) {
                //     for (let lg of lgSet.layerGroups) {
                //         existingLayerGroups.push(lg)
                //     }
                // }
                
                // let modPkg = {...existingPkg}

                // let newStkLayers : StackupLayer[] = await createStackup(stackupInfo);
                // modPkg.stackupLayers = newStkLayers
                // modPkg.layerGroupSets = new Array<LayerGroupSet>() //in this case, always!
                // modPkg.stackupGenInfo = stackupInfo;                   
                
                // let result = await smRepo.ReplaceOne(modPkg);
                
                // if(result === true && existingLayerGroups.length > 0) {
                //     req.setTimeout( 1000 * 60 * 8 ); // eight minutes
                //     await handleStackupRecreationShakeup(modPkg, existingLayerGroups)
                // }
                    
                // res.status(200).send({ payload: modPkg } as ResponseData);
                






//================================

// if(modPkg.stackupLayers && modPkg.stackupLayers.length > 0) {  //stackup already existed...
//     req.setTimeout( 1000 * 60 * 8 ); // eight minutes
//     possiblyRestructuredLayerGroupings = await handleStackupThicknessShakeup(modPkg, possiblyRestructuredLayerGroupings) 
// }



// if(modPkg.layerGroupSets?.some((a: LayerGroupSet) => a.tags.includes(GOLDEN_INDICATOR_NAME))) {
//     for(let i = 0; i < modPkg.layerGroupSets.length; i++) {
//         if(modPkg.layerGroupSets[i].tags.includes(GOLDEN_INDICATOR_NAME)) {
//             modPkg.layerGroupSets[i].layerGroups = possiblyRestructuredLayerGroupings;
//             break;
//         }
//     }
// }
// else {
//     let lgSet : LayerGroupSet = {
//         id: crypto.randomUUID(),
//         name: GOLDEN_INDICATOR_NAME,
//         layerGroups: possiblyRestructuredLayerGroupings,
//         isPhysicalDefault: true,
//         isClearanceDefault: true,
//         tags: [GOLDEN_INDICATOR_NAME, LGSET_TAG_SORT], //important!!
//     }
//     modPkg.layerGroupSets.push(lgSet)
// }