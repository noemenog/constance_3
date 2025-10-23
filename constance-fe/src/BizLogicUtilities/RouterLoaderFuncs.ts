import { Params, redirect } from "react-router";
import { ActionSceneEnum, CONFIGITEM__Page_Title_Settings, EnvTypeEnum, ErrorSeverityValue } from "../DataModels/Constants";
import { useCStore } from "../DataModels/ZuStore";
import { BasicProperty, ConfigItem, PropertyItem, CDomainData, User, Bucket } from "../DataModels/ServiceModels";
import { performBackendCall, rfdcCopy, sortByLastUpdatedDate, verifyNaming } from "./UtilFunctions";
import { LoadingSpinnerInfo, LoggedInUser, PageConfInfo } from "../DataModels/ServiceModels";
// import { getApproverWGName, getPreloadPermissions, loadAWGStatusForLoggedInUser } from "./Permissions";
import { DisplayError } from "../CommonComponents/ErrorDisplay";
import { sort } from "fast-sort";
import { fetchAppDetails, fetchAppList, fetchInitConfigs, getBucketList } from "./FetchData";
import { loadAWGStatusForLoggedInUser } from "./Permissions";


export async function handleTheBasics(appId: string|null, scene: ActionSceneEnum, forceRetrieveConfig : boolean = false) : Promise<CDomainData> {
    const store = useCStore.getState();

    let domainData : CDomainData = {
        appInfoCollection: [],
        appInfo: null,
        bucketList: [],
        selectedConfig: null,
        currentEnv: null,
        destEnv: null,
    }
    
    if(appId && appId.length > 0) {
        //load approver WG information for current project
        //This handles scenario where user clicked a project from projectList page - or if we ever have a nav link from one proj to another
        store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving AWG permissions. Please wait..."} as LoadingSpinnerInfo)
        loadAWGStatusForLoggedInUser(store.loggedInUser as LoggedInUser, appId).then((user: LoggedInUser) => {
            if(user) { store.setLoggedInUser(user); }
        }).finally(() => { store.cancelLoadingSpinnerCtx() })

        //fetch entire payload of current project
        let appInfo = await fetchAppDetails(store.selectedEnvironment, appId as string, false)
        if(appInfo && appInfo._id) {
            forceRetrieveConfig = ((forceRetrieveConfig === true) || !store.initConfigs || (store.initConfigs.length === 0)) ? true : false;
            domainData.appInfo = appInfo
        }
        else {
            let errMsg = `AppInfo with the following ID was not found in the system: ${appId}`
            DisplayError("204", ErrorSeverityValue.ERROR, errMsg);
            console.error(errMsg);
            throw redirect(`/list`)
        }

        store.setCurrentAppBasicInfo(domainData.appInfo)
    }

    if(forceRetrieveConfig === true) {        
        store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving app configurations. Please wait..."} as LoadingSpinnerInfo)
        fetchInitConfigs().then((confs: ConfigItem[]) => {
            if(confs && confs.length > 0) {                
                store.setInitConfigs(confs)
                store.setMenuCurrentScene(scene); //Important! - This sets the default unless changed by configuration data (triggered in each page)

                let pageConfs : PageConfInfo[] = confs.find(a => a.name === CONFIGITEM__Page_Title_Settings)?.value 
                    ?? (confs.find((a:any) => a.configName === CONFIGITEM__Page_Title_Settings) as any)?.configValue ?? []  //TODO: remove the deprecated configValue usage
                let map: Map<string, PageConfInfo> = new Map();
                pageConfs.forEach(pc => { map.set(pc.key.toLowerCase(), pc); });

                store.setPageConfInfoMap(map);
            }
        }).finally(() => { store.cancelLoadingSpinnerCtx()  })
    }

    return domainData;
}



export async function appInfoListLoader(request: Request, params: Params) : Promise<CDomainData|null> {
    let domainData = null; //WARNING: this is the state at the time this function is called.
    const store = useCStore.getState();
    store.clearCurrentAppInfo()

    let forceGetConfig = (!store.initConfigs || (store.initConfigs.length === 0)) ? true : false;
    domainData = await handleTheBasics(null, ActionSceneEnum.ROOT, forceGetConfig)
    
    let appList = await fetchAppList(EnvTypeEnum.DEVELOPMENT) ?? [];  //Always from dev!!!
    domainData.appInfoCollection = appList;

    store.setCurrentAppBasicInfo(domainData.appInfo) //domainData.project is set by handleTheBasics()
    return domainData
}


export async function appInfoDetailsLoader(request: Request, params: Params) : Promise<CDomainData|null> {
    let domainData = null;
    const store = useCStore.getState(); 
    
    if (!params.tabInfo || (params.tabInfo.length === 0)) {
        // throw redirect(`/${ActionSceneEnum.APPINFO}/${store.selectedEnvironment}/${params.appId}/overview`)
        throw redirect(`/${ActionSceneEnum.APPHOME}/${params.appId}/overview`)
    }
    else if (params.tabInfo) {
        if (params.tabInfo && (params.tabInfo.toLowerCase().trim() === "overview") ) { 

            let refreshConfigs = (
                store.initConfigs 
                && store.initConfigs.length > 0 
                && store.currentAppBasicInfo 
                && store.currentAppBasicInfo.id 
                && store.currentAppBasicInfo.id === params.appId
            ) ? false : true;

            domainData = await handleTheBasics(params.appId as string, ActionSceneEnum.APPHOME, refreshConfigs)
        }
        else {
            domainData = await handleTheBasics(params.appId as string, ActionSceneEnum.APPHOME)
        }

        let buckets = await getBucketList(store.selectedEnvironment, params.appId as string) ?? []
        domainData.bucketList = buckets;
    }
    return domainData
}


export async function bucketConfigLoader(request: Request, params: Params) : Promise<CDomainData|null> {
    const store = useCStore.getState(); 
    let domainData =await handleTheBasics(params.appId as string, ActionSceneEnum.CONFIGURATIONS)
    
    store.setLoadingSpinnerCtx({enabled: true, text: "Retrieving list of buckets for current app. Please wait..."} as LoadingSpinnerInfo)
    let buckets = (await getBucketList(store.selectedEnvironment, params.appId as string).finally(() => { store.cancelLoadingSpinnerCtx()  })) ?? []
    domainData.bucketList = buckets;

    if(params.bucketId && (params.bucketId.length > 0) && (buckets.length > 0)) {
        let paramBK = buckets.find(a => (a._id.toUpperCase().trim() === params.bucketId?.toUpperCase()?.trim()))
        if(paramBK && paramBK._id) {
            store.setSelectedBucket(paramBK);
        }
    }
    
    return domainData
}


// export async function comparisonLoader(request: Request, params: Params) : Promise<CDomainData|null> {
//     const store = useCStore.getState(); 
//     let domainData = await handleTheBasics(params.projectId as string, ActionSceneEnum.COMPARE)
    
//     let buckets = await getBucketList(store.selectedEnvironment, params.appId as string) ?? []
//     domainData.bucketList = buckets;

//     return domainData
// }



//---------------------------------------

export async function logsLoader(request: Request, params: Params) : Promise<CDomainData|null> {
    console.log("hello world8")
    return null
}



export async function baseRouteLoader(request: Request, params: Params) {
    //Do nothing here for now...
    return null;
}

