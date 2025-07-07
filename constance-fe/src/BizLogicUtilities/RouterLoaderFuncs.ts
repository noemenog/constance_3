import { Params, redirect } from "react-router";
import { CONFIGITEM__Page_Title_Settings, ActionSceneEnum, ErrorSeverityValue, ProjectPropertyCategoryEnum } from "../DataModels/Constants";
import { C2CRow, Interface, LayerGroupConstraints, Net, Netclass, Project, SnapshotContext } from "../DataModels/ServiceModels";
import { useSpiderStore } from "../DataModels/ZuStore";
import { fetchProjectDetails, fetchInitConfigs, fetchProjectList, getPkgLayout, getDefaultConstraints, fetchInterfaceList, fetchNetclassList, getSnapshots, 
    fetchInterfaceDetails, getInterfaceCollaterals, fetchClassRelationLayout, fetchPowerInfo, getNetSummaryInfo, getProjectStatusIndicators, getRelationNameElementsForIface } from "./FetchData";
import { BasicProperty, ConfigItem, NetSummary, PropertyItem, SPDomainData, User } from "../DataModels/HelperModels";
import { performBackendCall, rfdcCopy, sortByLastUpdatedDate, verifyNaming } from "./UtilFunctions";
import { LoadingSpinnerInfo, LoggedInUser, PageConfInfo } from "../DataModels/HelperModels";
import { getApproverWGName, getPreloadPermissions, loadAWGStatusForLoggedInUser } from "./Permissions";
import { DisplayError } from "../CommonComponents/ErrorDisplay";
import { sort } from "fast-sort";


export async function handleTheBasics(projectId: string|null, scene: ActionSceneEnum, forceRetrieveConfig : boolean = false) : Promise<SPDomainData> {
    const store = useSpiderStore.getState();

    let domainData : SPDomainData = {
        projectCollection: [],
        project: null,
        interfaceList: [],
        selectedIface: null,
        selectedIfaceCollaterals: [],
        selectedRuleArea: null,
        packageLayout: null,
        powerInfo: null,
        defaultConstraints: null,
        netclasses: [],
        snapshots: [],
        c2cColToIndexMap: new Map<string, number>(),
        clrRelationsMappingForCurrentIface: new Map<string, BasicProperty[]>()
    }
    
    if(projectId && projectId.length > 0) {
        //load approver WG information for current project
        //This handles scenario where user clicked a project from projectList page - or if we ever have a nav link from one proj to another
        store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving AWG permissions. Please wait..."} as LoadingSpinnerInfo)
        loadAWGStatusForLoggedInUser(store.loggedInUser as LoggedInUser, projectId).then((user: LoggedInUser) => {
            if(user) { store.setLoggedInUser(user); }
        }).finally(() => { store.cancelLoadingSpinnerCtx() })

        //fetch entire payload of current project
        let proj = await fetchProjectDetails(projectId as string)
        if(proj && proj._id) {
            forceRetrieveConfig = ((forceRetrieveConfig === true) || !store.initConfigs || (store.initConfigs.length === 0)) ? true : false;
            domainData.project = proj
        }
        else {
            let errMsg = `Project with the following ID was not found in the system: ${projectId}`
            DisplayError("204", ErrorSeverityValue.ERROR, errMsg);
            console.error(errMsg);
            throw redirect(`/projectlist`)
        }

        store.setBasicProjInfo(domainData.project)

        let permissionRoles : BasicProperty[] = domainData.project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.PERMISSION_ROLES && a.name === ProjectPropertyCategoryEnum.PERMISSION_ROLES))?.value ?? [] 
        store.setPermissionRoles(permissionRoles)
    }

    if(forceRetrieveConfig === true) {        
        store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving app configurations. Please wait..."} as LoadingSpinnerInfo)
        fetchInitConfigs(domainData?.project?._id || '').then((confs: ConfigItem[]) => {
            if(confs && confs.length > 0) {                
                store.setInitConfigs(confs)
                store.setMenuCurrentScene(scene); //Important! - This sets the default unless changed by configuration data (triggered in each page)

                let pageConfs : PageConfInfo[] = confs.find(a => a.configName === CONFIGITEM__Page_Title_Settings)?.configValue ?? []
                let map: Map<string, PageConfInfo> = new Map();
                pageConfs.forEach(pc => { map.set(pc.key.toLowerCase(), pc); });

                store.setPageConfInfoMap(map);
            }
        }).finally(() => { store.cancelLoadingSpinnerCtx()  })
    }

    return domainData;
}


export async function projectListLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    const store = useSpiderStore.getState();
    store.clearBasicProjInfo()

    let forceGetConfig = (!store.initConfigs || (store.initConfigs.length === 0)) ? true : false;
    let domainData = await handleTheBasics(null, ActionSceneEnum.ROOT, forceGetConfig)
    
    let projList = await fetchProjectList() ?? [];
    domainData.projectCollection = projList;

    store.setBasicProjInfo(domainData.project) //domainData.project is set by handleTheBasics()
    return domainData
}


export async function projectDetailsLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = null; //WARNING: this is the state at the time this function is called.
    const store = useSpiderStore.getState(); 
    
    if (!params.tabInfo || (params.tabInfo.length === 0)) {
        throw redirect(`/${ActionSceneEnum.PROJECT}/${params.projectId}/overview`)
    }
    else if (params.tabInfo) {
        if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "overview") ) { //TODO: put this as an enum -no literal strings for these
            getProjectStatusIndicators(params.projectId as string).then((statusTimeLineInfo) => {
                store.setStatusTimeLineInfo(statusTimeLineInfo)
            })
            
            let refreshConfigs = (store.initConfigs && store.initConfigs.length > 0 && store.basicProjInfo && store.basicProjInfo.id && store.basicProjInfo.id === params.projectId) ? false : true;
            domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.PROJECT, refreshConfigs)
            
            let snapshotContexts = await getSnapshots(params.projectId as string, true);
            snapshotContexts = sortByLastUpdatedDate<SnapshotContext>(snapshotContexts);
            domainData.snapshots = snapshotContexts ?? []
        }
        else {
            domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.PROJECT)
        }
    }

    if(!store.netSummary) {
        getNetSummaryInfo(params.projectId as string, true).then((netSums) =>{
            if(netSums) {
                store.setNetSummary(netSums)
            }
        })
    }
    
    return domainData
}


export async function stackupLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.STACKUP)
    
    let interfaceList = await fetchInterfaceList(params.projectId as string) ?? []
    domainData.interfaceList = interfaceList

    let pkg = await getPkgLayout(params.projectId as string);
    domainData.packageLayout = pkg

    return domainData
}


export async function layerGroupsLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.LAYERGROUPS)

    let pkg = await getPkgLayout(params.projectId as string);
    domainData.packageLayout = pkg

    return domainData
}


export async function ruleAreaLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.RULEAREAS)

    let defaultConstrSet = await getDefaultConstraints(params.projectId as string, null, false, false)
    domainData.defaultConstraints = defaultConstrSet;
    
    let pkg = await getPkgLayout(params.projectId as string);
    domainData.packageLayout = pkg

    return domainData
}


export async function defaultConstraintsLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.DEFAULTCONSTRAINTS)
    
    //Notice 'excludeConstraintEntries' param is set to FALSE while 'performProlif' param is set to TRUE! This is intentional
    let defaultConstrSet = await getDefaultConstraints(params.projectId as string, null, false, true)
    domainData.defaultConstraints = defaultConstrSet;
    
    let pkg = await getPkgLayout(params.projectId as string)
    domainData.packageLayout = pkg
    
    return domainData
}


export async function netManagementLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = null;
    const store = useSpiderStore.getState();
    
    if (!params.tabInfo || (params.tabInfo.length === 0)) {
        throw redirect(`/${ActionSceneEnum.NETS}/${params.projectId}/netlist-upload`)
    }
    
    domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.NETS)

    let interfaceList = await fetchInterfaceList(params.projectId as string)
    domainData.interfaceList = interfaceList 

    let ncList = await fetchNetclassList(params.projectId as string)
    domainData.netclasses = ncList;

    let pkg = await getPkgLayout(params.projectId as string)
    domainData.packageLayout = pkg

    if(!store.netSummary || (params.tabInfo.toLowerCase().trim() === "stats")) {
        store.setLoadingSpinnerCtx({enabled: true, text: "Loading project net list management details. Please wait..."} as LoadingSpinnerInfo)
        let exclNCDetails = (params.tabInfo.toLowerCase().trim() === "stats") ? false : true;
        let netSums : NetSummary = await getNetSummaryInfo(params.projectId as string, exclNCDetails)
        if(netSums) {
            store.setNetSummary(netSums)
        }
        store.setLoadingSpinnerCtx({enabled: false, text: ""} as LoadingSpinnerInfo)
    }

    return domainData
}


export async function interfacesLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    const store = useSpiderStore.getState();
    let domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.INTERFACES)
    
    let interfaceList = await fetchInterfaceList(params.projectId as string)
    domainData.interfaceList = interfaceList 

    let pkg = await getPkgLayout(params.projectId as string)
    domainData.packageLayout = pkg
    
    if(params.interfaceId && params.interfaceId.length > 0) {
        let specificIface = await fetchInterfaceDetails(params.interfaceId) ?? null
        domainData.selectedIface = specificIface;
        
        if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "collaterals")) {
            store.setLoadingSpinnerCtx({enabled: true, text: "Loading interface collateral files. Please wait..."} as LoadingSpinnerInfo)
            let collaterals = await getInterfaceCollaterals(params.projectId as string, params.interfaceId as string)
            domainData.selectedIfaceCollaterals = collaterals ?? [];
            store.setLoadingSpinnerCtx({enabled: false, text: ""} as LoadingSpinnerInfo)
        }

        if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "clearance")) {
            let promises = new Array<Promise<any>>();
            let map = new Map<string, BasicProperty[]>();
            for(let raid of pkg.ruleAreas.map(a => a.id) ?? []) {
                promises.push(getRelationNameElementsForIface(params.projectId as string, params.interfaceId, raid));
            }
            store.setLoadingSpinnerCtx({enabled: true, text: "Loading clearance relations data for interface. Please wait..."} as LoadingSpinnerInfo)
            await Promise.all(promises)
            .then((promiseVals) => {
                if(promiseVals && promiseVals.length > 0) {
                    for(let prop of promiseVals) {
                        if(prop.id && prop.id.length > 0 && prop.name) {
                            map.set(prop.id, prop.value);
                        }
                    }
                }
            })
            .finally(() => { store.cancelLoadingSpinnerCtx() });
            domainData.clrRelationsMappingForCurrentIface = map;
        }
    }

    

    let ncList = await fetchNetclassList(params.projectId as string)
    domainData.netclasses = ncList;

    return domainData
}


export async function c2cLayoutLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.C2CLAYOUT)
    let pkg = await getPkgLayout(params.projectId as string)
    domainData.packageLayout = pkg
    
    let interfaceList = await fetchInterfaceList(params.projectId as string)
    domainData.interfaceList = interfaceList 

    let ncList = await fetchNetclassList(params.projectId as string)
    domainData.netclasses = ncList;

    let c2cColumnsToSlotIndexMap = new Map<string, number>();
    if(ncList && ncList.length > 0) {
        let c2cRowInfo: C2CRow[] = await fetchClassRelationLayout(params.projectId as string, null, 1, pkg.ruleAreas[0].id, ncList[0].interfaceId, ncList[0]._id.toString(), null, true) ?? []
        if (c2cRowInfo && c2cRowInfo.length > 0) {
            if (c2cRowInfo[0].slots && c2cRowInfo[0].slots.length > 0) {
                let ncMap = new Map<string, Netclass>();
                for(let nc of ncList) {
                    ncMap.set(nc._id?.toString() as string, nc)
                }
                        
                for (let i = 0; i < c2cRowInfo[0].slots.length; i++) {
                    let slotItem = c2cRowInfo[0].slots[i];
                    
                    if (slotItem.netclassId && ncMap.has(slotItem.netclassId) && ncMap.get(slotItem.netclassId)?.enableC2CColumn === false) {
                        continue; //skip item if column visibility is turned off for it
                    }

                    if(slotItem.name && slotItem.name.length > 0) {
                        c2cColumnsToSlotIndexMap.set(slotItem.name, i);
                    }
                    else {
                        let name = ncMap.get(slotItem.netclassId)?.name
                        c2cColumnsToSlotIndexMap.set(name ?? '', i)
                    }
                }
            }
        }
    }

    if(params.ruleAreaId && params.ruleAreaId.length > 0) {
        let ra = pkg.ruleAreas.find(a => a.id === params.ruleAreaId)
        if(ra && ra.ruleAreaName && ra.ruleAreaName.length > 0) {
            domainData.selectedRuleArea = ra;
        }
    }

    domainData.c2cColToIndexMap = c2cColumnsToSlotIndexMap;

    return domainData
}


export async function powerInfoLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    let domainData = null;
    if (!params.tabInfo || (params.tabInfo.length === 0)) {
        throw redirect(`/${ActionSceneEnum.POWERINFO}/${params.projectId}/rails`)
    }
    else if (params.tabInfo) {
        domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.POWERINFO)

        let powerInfo = await fetchPowerInfo(params.projectId as string)
        domainData.powerInfo = powerInfo;
    }

    return domainData
}




//---------------------------------------

export async function validationsLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    console.log("hello world5")
    return null
}

export async function logsLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    console.log("hello world8")
    return null
}

export async function faqLoader(request: Request, params: Params) : Promise<SPDomainData|null> {
    console.log("hello world9")
    return null
}

export async function baseRouteLoader(request: Request, params: Params) {
    //Do nothing here for now...
    return null;
}













// if(domainData.project) {
//     if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "physical" || params.tabInfo.toLowerCase().trim() === "clearance")) {
//         let physPropsMap = new Map<string, string>();
//         let clrPropsMap = new Map<string, string>();
        
//         let physLGC: LayerGroupConstraints[] = await fetchConstraints(params.projectId as string, null, 1, null, null, null, null, null, ConstraintTypesEnum.Physical, false) ?? []
//         let clrLGC: LayerGroupConstraints[] = await fetchConstraints(params.projectId as string, null, 1, null, null, null, null, null, ConstraintTypesEnum.Clearance, false) ?? []
        
//         if (physLGC && physLGC.length > 0) {
//             if (physLGC[0].associatedProperties && physLGC[0].associatedProperties.length > 0) {
//                 for (let i = 0; i < physLGC[0].associatedProperties.length; i++) {
//                     if(physLGC[0].associatedProperties[i].enabled === true) {
//                         physPropsMap.set(physLGC[0].associatedProperties[i].name, physLGC[0].associatedProperties[i].displayName ?? '')
//                     }
//                 }
//             }
//         }
//         if (clrLGC && clrLGC.length > 0) {
//             if (clrLGC[0].associatedProperties && clrLGC[0].associatedProperties.length > 0) {
//                 for (let i = 0; i < clrLGC[0].associatedProperties.length; i++) {
//                     if(clrLGC[0].associatedProperties[i].enabled === true) {
//                         clrPropsMap.set(clrLGC[0].associatedProperties[i].name, clrLGC[0].associatedProperties[i].displayName ?? '')
//                     }
//                 }
//             }
//         }

//         domainData.physicalPropNamesMap = physPropsMap;
//         domainData.clearancePropNamesMap = clrPropsMap;
//     }
// }


// if(domainData.project) {
//     if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "length-matching" || params.tabInfo.toLowerCase().trim() === "net-props")) {
//         let netPropsMap = new Map<string, string>()
//         let nets: Net[] = await fetchNets(params.projectId as string, null, 1, null, null, null, false, false, false, false) ?? []
//         if (nets && nets.length > 0) {
//             if (nets[0].associatedProperties && nets[0].associatedProperties.length > 0) {
//                 for (let i = 0; i < nets[0].associatedProperties.length; i++) {
//                     if(nets[0].associatedProperties[i].enabled === true) {
//                         netPropsMap.set(nets[0].associatedProperties[i].name, nets[0].associatedProperties[i].displayName ?? '')
//                     }
//                 }
//             }
//         }
//         domainData.netPropNamesMap = netPropsMap;
//     }
// }


//fetch constraint props for the project's org settings
// if(!store.confConstraintProps || (store.confConstraintProps.length === 0)) {
//     store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving constraint configurations..."} as LoadingSpinnerInfo)
//     await getConstraintProperties(proj._id as string, proj.org).then((constrSettings : PropertyItem[]) => {
//         store.setConfConstraintProps(constrSettings ?? [])
//     }) 
//     .finally(() => { store.cancelLoadingSpinnerCtx() })
// }



// if(projectId && projectId.length > 0) {
//     let proj = await fetchProjectDetails(projectId as string)
//     if(proj && proj._id) {
//         domainData.project = proj
//     }
//     else {
//         DisplayError("204", ErrorSeverityValue.ERROR, `Project with the following ID was not found in the system. ${projectId}`);
//         throw redirect(`/projectlist`)
//     }

//     if(domainData.project && domainData.project._id) { 
//         setConf = ((forceRetrieveConfig === true) || !store.initConfigs || (store.initConfigs.length === 0)) ? true : false;
//         if(!store.confConstraintProps || (store.confConstraintProps.length === 0)) {
//             store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving constraint configurations..."} as LoadingSpinnerInfo)
//             getConstraintProperties(domainData.project._id as string, domainData.project?.org).then((constrSettings : PropertyItem[]) => {
//                 store.setConfConstraintProps(constrSettings ?? [])
//             })
//             .finally(() => {
//                 store.cancelLoadingSpinnerCtx()
//             })
//         }
//     } 
    
//     store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving AWG permissions. Please wait..."} as LoadingSpinnerInfo)
//     loadAWGStatusForLoggedInUser(store.loggedInUser as LoggedInUser, projectId).then((user: LoggedInUser) => {
//         if(user) {
//             store.setLoggedInUser(user);
//         }
//     }).finally(() => { store.cancelLoadingSpinnerCtx() })
//
//     store.setBasicProjInfo(domainData.project)
// }



// else {
//     // setConf = (!store.initConfigs || (store.initConfigs.length === 0)) ? true : false;
//     // let projList = await fetchProjectList() ?? [];
//     // domainData.projectCollection = projList;
// }



// else if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "permissions") ) {
        //     domainData = await getTheBasics(params.projectId as string)
        //     const store = useSpiderStore.getState(); //WARNING: this is the state at the time this function is called.
        //     let permCtxConf : any = store.initConfigs.find(a => a.configName === CONFIGITEM__Permission_Context)?.configValue ?? undefined
        //     if(permCtxConf && permCtxConf.roles && permCtxConf.roles.length > 0) {
        //         let ids = permCtxConf.roles.map((a: any) => a.id || '')
        //         try { verifyNaming(ids, NamingContentTypeEnum.PERMISSION_ROLE_ID) }
        //         catch(e: any){
        //             //displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
        //             return null //new Map<BasicProperty, User[]>();
        //         }

        //         store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving roles and permission assignments for current project. Please wait..."} as LoadingSpinnerInfo)
        //         getPreloadPermisssions(params.projectId as string, permCtxConf).then((usersPerRoleMapping: Map<BasicProperty, User[]>) => {
        //             return null;
        //         })
        //         .finally(() => { store.cancelLoadingSpinnerCtx() })  
        //     }
        // }







    //     //===========================================================================
    //     //=========================== REMOVE THIS LATER ================================================
   
    //     let resp: any = undefined
    //     let url: string = ''
    //     try {
    //         url = "https://constance-mw.app.intel.com/api/v2/development/configs/get?appId=671a335237075b645fe75388&bucketId=671a335237075b645fe75389";
    //         resp = await performBackendCall(url, "GET", null)
    //         console.warn("Resaponse from Constance call:", resp)
    //         alert(JSON.stringify(resp))
    //     }
    //     catch(error: any) {
    //         let msg = `Failed to get app info from config management system. This is a call from frontend --- Error: ${error.message}  --- Address: '${url}' --- response: ${resp}`
    //         alert(msg)
    //         throw new Error(msg)
    //     }
    // //=========================== REMOVE THIS LATER ================================================
    // //============================================================================
    
    



//on net loader
    // else if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "stats") ) {
    //     getTheBasics(store, params.projectId as string)
    //     //NOTE: stats page will get its own full and complete stats. do it here
    //     //TODO: find a way to make this more efficient
    // }
    // else {
    //     getTheBasics(store, params.projectId as string)

    //     if (!store.interfaceList || store.interfaceList.length === 0) {
    //         let interfaceList = await fetchInterfaceList(params.projectId as string)
    //         store.setInterfaceList(interfaceList ?? null);
    //     }

    //     if (!store.netclasses || store.netclasses.length === 0) {
    //         let ncList = await fetchNetclassList(params.projectId as string)
    //         store.setNetclasses(ncList);
    //     }

    //     else if ((params.tabInfo && (params.tabInfo.toLowerCase().trim() === "length-matching" || params.tabInfo.toLowerCase().trim() === "net-props"))
    //         || (store.projStats && store.projStats.hasNets && (!store.netPropNamesMap || store.netPropNamesMap.size === 0))) {
    //             let netPropsMap = new Map<string, string>()
    //             let nets: Net[] = await fetchNets(params.projectId as string, null, 1, null, null, null, false, false, false, false)
    //             if (nets && nets.length > 0) {
    //                 if (nets[0].associatedProperties && nets[0].associatedProperties.length > 0) {
    //                     for (let i = 0; i < nets[0].associatedProperties.length; i++) {
    //                         netPropsMap.set(nets[0].associatedProperties[i].name, nets[0].associatedProperties[i].displayName ?? '')
    //                     }
    //                 }
    //             }
    //             store.setNetPropNamesMap(netPropsMap);
    //     }
    // }
    // return null