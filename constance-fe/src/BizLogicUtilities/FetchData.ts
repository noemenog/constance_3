import axios from "axios";
import { getDateAppendedName, getEnvContext, isNotNullOrEmptyOrWS, performBackendCall } from "./UtilFunctions";
import { AppInfo, Bucket } from "../DataModels/ServiceModels";
import { BasicKVP, BasicProperty, ConfigItem } from "../DataModels/ServiceModels";
import { LoggedInUser, QuickStatus } from "../DataModels/ServiceModels";
import { AGS_APP_ACCESS_ENTITLEMENT, AGS_APP_IAPM_NUMBER, AGS_APP_NAME, AGS_APP_OWNER_WG, EnvTypeEnum, ErrorSeverityValue, MLCR_AUTH_AGS_URL_V2 } from "../DataModels/Constants";
import { FileWithPath } from "@mantine/dropzone";
import { Providers } from "@microsoft/mgt-react";
import { DisplayError } from "../CommonComponents/ErrorDisplay";
import { sort } from "fast-sort";
import { getApproverWGName } from "./Permissions";




export async function fetchInitConfigs() : Promise<ConfigItem[]>{
    let url = `${getEnvContext().mainAPIUrl}/init/get-configs`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}


//#region project
//================================ APP_INFO ============================================


export async function fetchAppList(env: EnvTypeEnum) {
    let url: string =  `${getEnvContext().mainAPIUrl}/${env}/appinfo/get-all`;
    let resp = await performBackendCall(url, "GET", null);
    if(resp && resp.length > 0) {
        if(resp) {
            resp = sort<AppInfo>(resp).by([
                { asc: p => p.owner.idsid?.toLowerCase() },
                { asc: p => p.name?.toUpperCase() }
            ]);
        }
    }
    return resp;
}

export async function fetchAppDetails(env: EnvTypeEnum, appId: string, includeBuckets: boolean): Promise<any> {
    let appInfoUrl: string = `${getEnvContext().mainAPIUrl}/${env}/appinfo/get-details?appId=${appId}&includeBuckets=${includeBuckets.toString()}`;
    let resp = await performBackendCall(appInfoUrl, "GET", null);
    return resp;
}

export async function addNewAppInfo(env: EnvTypeEnum, appInfo: AppInfo): Promise<AppInfo> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/appinfo/add`;
    let resp = await performBackendCall(url, "POST", appInfo);
    return resp;
}

export async function updateAppInfo(env: EnvTypeEnum, appInfo: AppInfo): Promise<AppInfo> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/appinfo/update`;
    let resp = await performBackendCall(url, "POST", appInfo);
    return resp;
}

export async function deleteAppInfo(env: EnvTypeEnum, appInfo: AppInfo, delEnv: string): Promise<EnvTypeEnum[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/appinfo/delete?appId=${appInfo._id.toString()}&delEnv=${delEnv}`;
    let resp = await performBackendCall(url, "DELETE", appInfo);
    return resp;
}


export async function manageAppInfoLock(env: EnvTypeEnum, appId: string, loggedInUser: LoggedInUser, isLockAction: boolean): Promise<AppInfo> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/manage-lock?appId=${appId}&user=${loggedInUser?.email || ''}&isLockAction=${isLockAction?.toString() ?? ''}`;
    let resp = await performBackendCall(url, "POST", null);
    return resp;
}

export async function exportAll(env: EnvTypeEnum, appId: string, source: EnvTypeEnum, dest: EnvTypeEnum): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/export-all?appId=${appId}&src=${source}&dest=${dest}`;
    let resp = await performBackendCall(url, "POST", null);
    return resp;
}


export async function cloneAppInfo(env: EnvTypeEnum, appId: string, newName: string): Promise<AppInfo> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/clone?appId=${appId}&newName=${newName}`;
    let resp = await performBackendCall(url, "POST", null);
    return resp;
}




//#region buckets
//================================= BUCKETS ============================================

export async function getBucketList(env: EnvTypeEnum, appId: string): Promise<Bucket[]> {
    //___PERM___ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
    //if user does not have access to bucket (env + bucket access), return empty array
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/buckets/get-list?appId=${appId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}


export async function addBucketList(env: EnvTypeEnum, bucketList: Bucket[]): Promise<Bucket[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/buckets/add`;
    let resp = await performBackendCall(url, "POST", bucketList);
    return resp;
}

export async function updateBucket(env: EnvTypeEnum, bucket: Bucket): Promise<Bucket> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/buckets/update`;
    let resp = await performBackendCall(url, "POST", bucket);
    return resp;
}

export async function deleteBucket(env: EnvTypeEnum, bucket: Bucket, delEnv: string): Promise<EnvTypeEnum[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/buckets/delete?bucketId=${bucket._id.toString()}&delEnv=${delEnv}`;
    let resp = await performBackendCall(url, "DELETE", bucket);
    return resp;
}

export async function exportBucket(env: EnvTypeEnum, bucketId: string, source: EnvTypeEnum, dest: EnvTypeEnum): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/export-bucket?bucketId=${bucketId}&src=${source}&dest=${dest}`;
    let resp = await performBackendCall(url, "POST", null);
    return resp;
}

export async function cloneBucket(env: EnvTypeEnum, bucketId: string, newName: string): Promise<Bucket> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/clone?bucketId=${bucketId}&newName=${newName}`;
    let resp = await performBackendCall(url, "POST", null);
    return resp;
}
// //#endregion



//#region configItems
//================================= CONFIGITEMS ============================================

export async function getConfigList(env: EnvTypeEnum, appId: string, bucketId: string): Promise<ConfigItem[]> {
    //___PERM___ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
    //if user does not have access to bucket (env + bucket access), return empty array
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/configs/get-list?appId=${appId}&bucketId=${bucketId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function addConfigs(env: EnvTypeEnum, configList: ConfigItem[]): Promise<ConfigItem[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/configs/add`;
    let resp = await performBackendCall(url, "POST", configList);
    return resp;
}

export async function updateConfigs(env: EnvTypeEnum, configList: ConfigItem[]): Promise<ConfigItem[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/configs/update`;
    let resp = await performBackendCall(url, "POST", configList);
    return resp;
}

export async function deleteConfigs(env: EnvTypeEnum, configList: ConfigItem[]): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/${env}/configs/delete`;
    let resp = await performBackendCall(url, "DELETE", configList);
    return resp;
}

//#endregion





// //============================================================================================================
// //=========================================== SEND FILE CHUNKED ==============================================
// //============================================================================================================

export async function postChunkedFileList(url: string, fileList: FileWithPath[], additionalKVPs: Map<string, Map<string, string>>, isDownloadFileExpected = false, dlFileName = "content_download.zip"): Promise<any> {
    const CHUNK_SIZE = 1024 * 1024; // 1MB
    const getTotalChunks = (file: FileWithPath) => Math.ceil(file.size / CHUNK_SIZE);
    
    const filesInvolved = fileList.map(a => {
        let obj = { name: a.name, chunkCount: getTotalChunks(a) }
        return obj;
    })

    const fileKey = crypto.randomUUID();
    for (let k = 0; k < fileList.length; k++) {
        let file = fileList[k]
        const totalChunks = getTotalChunks(file)
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            
            const formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('chunkNumber', i.toString());
            formData.append('totalChunks', totalChunks.toString());
            formData.append("originalname", file.name);
            formData.append("fileKey", fileKey);
            formData.append("filesInvolved", JSON.stringify(filesInvolved));

            for(let [fname, map] of additionalKVPs) { 
                if(fname && fname === file.name && map && map.size > 0) {
                    for(let [key, value] of map) {
                        formData.append(key, value)
                    }
                }
            }

            let resp = await performBackendCall(url, "POST", formData, isDownloadFileExpected, dlFileName);
            
            if( (k === (fileList.length - 1)) && (i === (totalChunks - 1)) ) { 
                return resp; 
            }
        }
    }

    return null;
}

//-------------------------------------------------------------------------------------




//============================================================================================================
//=========================================== AGS/GRAPH FUNCTIONS ============================================
//============================================================================================================



export async function createApproverWG(awg: string, loggedInUser: LoggedInUser) : Promise<any>{
    let grpAdmins = [loggedInUser.idsid]
    let body = { "ApproverWGName": awg, "GroupAdmins": grpAdmins }

    let url = MLCR_AUTH_AGS_URL_V2 + "/apwg/create?appName=" + AGS_APP_NAME

    let config: any = {
        method: "post",
        maxBodyLength: Infinity,
        url: url,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        data: body,
    };

    let resp = await axios.request(config).catch((err) => { console.error(`Error encountered while creating approver workgroup [${awg}]`, err) })
    if(resp) {
        console.log(`Approver Group '${awg}' was created successfully`)
    }
    else {
        console.error(`Error encountered while creating approver workgroup`)
    }

    return resp;
}


export async function createEntitlements(entitlementNames: string[], awg: string, projName: string) : Promise<Map<string, string>>{
    let mapping = new Map<string, string>();
    let entArr: any[] = [];

    const entAppDetails = {
        "iapId": AGS_APP_IAPM_NUMBER,
        "ownerWG": AGS_APP_OWNER_WG,
        "approverWGName": "Approver-"+ awg,
        "tenant": "AZAD-CORP",
        "certificationInterval": "None"
    }

    for(let i = 0; i < entitlementNames.length; i++){
        let entName = entitlementNames[i]
        let descStr = (`${AGS_APP_NAME} entitlement for managing permissions - ${projName || ''}`).trim()
        entArr.push( { name: entName, displayName: entName, desc: descStr })
    }

    const payload = { "entitlements": entArr, ...entAppDetails };
    let url = MLCR_AUTH_AGS_URL_V2 + "/ent/create?appName=" + AGS_APP_NAME

    let config: any = {
        method: 'post',
        maxBodyLength: Infinity,
        url: url,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        data: payload
    }

    let resp = await axios.request(config).catch((err) => { console.error(`Error encountered while creating entitlement(s) [${entitlementNames.join(", ")}]`, err) })
    if(resp && resp.data && resp.data.length > 0){
        for(let i = 0; i < resp.data.length; i++) {
            let item = resp.data[i]
            let entId = item.fullName
            let entName = item.displayName
            mapping.set(entName, entId);
        }
        // console.log(`Entitlement creation was successfull for project ${projName}.`)
    }
    else {
        console.error(`Error encountered while creating entitlement(s) for project '${projName}`)
    }

    return mapping;
}


export async function getEntitlementInfoByName(entName: string, expandMemberDetails: boolean = false) : Promise<any>{
    let entitlement: any;
    let urpPostfix = (expandMemberDetails === true)
        ? `/groups?$filter=startswith(displayName,'${entName}')&$expand=members($select=id,displayName,userPrincipalName,jobTitle)&$select=id,displayName,members`
        : `/groups?$filter=startswith(displayName,'${entName}')&$expand=members($select=id)&$select=id,displayName`
    try {
        await Providers.globalProvider
            .graph
            .api(urpPostfix)
            .header("ConsistencyLevel", "eventual")
            .get()
            .then((response:any) => {
                let entObj = response["value"].find((ent: any) => (ent.displayName.toUpperCase() === entName.toUpperCase()) )
                entitlement = entObj
            })
            .catch((err:any)=>{ 
                console.error("Error while getting entitlement info by name: ", err) 
            })
        
        return entitlement
    } 
    catch (error: any) {
      return error
    }
}


//-----------------------------------------------------
export async function updateEntitlementWithUser(entName: string, entId: string, existingEntMemberWwidList: string[], usersWWIDs: string[], loggedInUser: LoggedInUser){
    let baseUrl = MLCR_AUTH_AGS_URL_V2 + "/ent/update?appName=" + AGS_APP_NAME
    
    let addNewUsers: string[] = []
    let removeUsers: string[] = []
    let operations: any[] = []

    usersWWIDs.forEach((wwid: string) => {
        if(!existingEntMemberWwidList.includes(wwid)){
            addNewUsers.push(wwid)
        }
    })

    existingEntMemberWwidList.forEach((wwid: string) => {
        if(!usersWWIDs.includes(wwid)){
            removeUsers.push(wwid)
        }
    })

    if(addNewUsers.length > 0){
        let ent_add_new_users_payload = { 
            "entitlementId" : entId, 
            "requestedForIds" : addNewUsers,
            "operationType" : "add",
            "requestedBy" :  loggedInUser.wwid,
            "justification" : (`Add users for entitlement ${entName}`).trim()
        }
        operations.push(ent_add_new_users_payload)
    }

    if(removeUsers.length > 0){
        let ent_remove_users_payload = { 
            "entitlementId" : entId, 
            "requestedForIds" : removeUsers,
            "operationType" : "remove",
            "requestedBy" :  loggedInUser.wwid,
            "justification" : (`Remove users for entitlement ${entName}`).trim()
        }
        operations.push(ent_remove_users_payload)
    }

    operations.forEach( (entPayload:any) => {
        let config: any = {
            method: 'post',
            maxBodyLength: Infinity,
            url: baseUrl,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            data: entPayload
        }

        axios.request(config).then(async resp => {
            
            if(resp.data.s.length > 0){
                let count = 0;
                resp.data.s.forEach((status:Boolean) => {
                    count++
                });
                console.log(entPayload["operationType"]+"ing "+count+" members")
            }

            if(resp.data.f.length > 0){
                resp.data.f.forEach((status:string) => {
                    console.error("There was a failure while updating the user, please read the msg carefully ", status)
                });
            }
            else {
                // console.log("Entitlement successfully updated!")
            }

        }).catch((err:any)=>{
            console.error(`Error while updating the following entitlement: [${entName}]. Error: ${err}`)
        })
    });   
}


export async function deleteEntitlements(entNames: string[]) : Promise<any>{
    let entIds: string[] = []
    
    let promises = new Array<Promise<any>>();
    for(let name of entNames) {
        promises.push(getEntitlementInfoByName(name));
    }
    
    await Promise.all(promises).then((promiseVals) => {
        if(promiseVals && promiseVals.length > 0) {
            for(let entitlementResp of promiseVals) {
                entIds.push(entitlementResp.id)
            }
        }
    })

    let url = MLCR_AUTH_AGS_URL_V2 + "/ent/delete?appName=" + AGS_APP_NAME

    let retValue: any

    let config: any = {
        method: "delete",
        maxBodyLength: Infinity,
        url: url,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        data: { "entitlements": entIds }
    };

    if(entIds.length === entNames.length){
        await axios.request(config).then(resp => {
            console.log(`Entitlement deletion process initiated successfully`)
            retValue = resp.data
        })
        .catch((err) => {
            console.log("Error while deleting a entitlement ", err)
            retValue = err
        })
    }

    return retValue;  //Need to change as per the response
}


export async function deleteAWG(awg: string) : Promise<any>{
    let url = MLCR_AUTH_AGS_URL_V2 + "/apwg/delete?wgToDelete=Approver-" + awg + "&appName=" + AGS_APP_NAME
    let resp : any 
    let config: any = {
        method: "post",
        url: url,
    };
    await axios.request(config).then(response => {
        console.log("Successfully deleted approval workgroup, status: ", response.status)
        console.log("Response returned while deleting approver work-group ", response.data)
        resp = response

    }).catch((err) => {
        resp = {
            "msg" : err.response.data.msg.message,
            "code" : err.response.data.msg.code,
            "serviceCode" : err.response.data.msg.serviceCode
        }
        //when there is no awg, serviceCode returns "WorkgroupNotFound"
        console.error("Error while deleting AWG: ", resp.serviceCode)  
    })
    return resp
}

//-------------------------------------------------------------------------------------


export async function getPermissionEntitlementsForCurrentUser(loggedInUser: LoggedInUser) : Promise<Map<string, string>> {
    let entitlementMapping = new Map<string, string>();
    
    let apiUrlPrefix = `/users/${loggedInUser.id}/memberOf/microsoft.graph.group?$count=true&$orderby=displayName&`
    let apiUrlFilterSection = `$filter=startswith(displayName,'${AGS_APP_NAME}_') or startswith(displayName,'${AGS_APP_ACCESS_ENTITLEMENT}')&$select=displayName,id`
    let apiUrl = apiUrlPrefix + apiUrlFilterSection + "&$top=999";  // Add $top=999 to request up to 999 entries (max allowed by Graph API is 999)
    try {
        await Providers.globalProvider
        .graph
        .api(apiUrl)
        .header("ConsistencyLevel", "eventual")
        .get()
        .then((response:any) => {
             let entList = response["value"]
             for(let i=0; i< entList.length; i++){
                let name = entList[i]['displayName']
                let id = entList[i]['id']
                entitlementMapping.set(name, id)
             }
        }).catch((err:any)=>{
            console.error("Error while getting list of user's relevant permissions", err)
        })

    } 
    catch (error) {
        let errMsg = `Error occured while getting user permissions:  ${error}`
        console.error(errMsg)
        DisplayError("500", ErrorSeverityValue.ERROR, errMsg);
    }

    return entitlementMapping
}


export async function getPermissionAWGItemsForCurrentUser(loggedInUser: LoggedInUser, ownerElementId: string) : Promise<QuickStatus<string>> {
    let awgName = ''
    try {
        if(ownerElementId && ownerElementId.trim().length > 1){
            awgName = getApproverWGName(ownerElementId)
            if(awgName) {
                let awgUsers: any [] = []
                
                let url = MLCR_AUTH_AGS_URL_V2 + "/apwg/get?fullName=" + awgName + "&type=Approver&appName=" + AGS_APP_NAME
                
                let config: any = {
                    method: "get",
                    maxBodyLength: Infinity,
                    url: url,
                    headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    }
                };
                await axios.request(config).then(resp => {
                        // console.log("Successfully fetched all users of the approval workgroup ", awgName)
                        awgUsers = resp.data.members
                }).catch((err) => {
                        console.error("Error while fetching users in approver workgroup ", err)
                })

                if(awgUsers && awgUsers.length > 0) {
                    let filterList = awgUsers.filter((x: any) => (x.id.length > 0 && x.id === loggedInUser.wwid))
                    if(filterList && filterList.length > 0){
                        return {isSuccessful: true, message: awgName } as QuickStatus<string>;
                    }
                }
            }
        }
    }
    catch(error: any) {
        let errMsg = `Failed to get approver work group members for current project: ${ownerElementId}. --- ${error.message}`
        console.error(errMsg)
        DisplayError("500", ErrorSeverityValue.ERROR, errMsg);
    }

    return {isSuccessful: false, message: awgName } as QuickStatus<string>
}


