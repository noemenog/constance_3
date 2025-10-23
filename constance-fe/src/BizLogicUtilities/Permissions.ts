import {ActionSceneEnum, AGS_APP_NAME, SCENES_MAPPING, UIMessageType, PermEntityTypeEnum, PermRolesEnum, EnvTypeEnum, PERM_ROLES_RELATED_DATA_MAP, CONFIGITEM__Permission_Revoked_Actions, PermissionAppLevelActionEnum, PermissionBucketLevelActionEnum, PermissionConfigLevelActionEnum} from "../DataModels/Constants";
import { LoggedInUser, QuickStatus, BasicProperty, User, ConfigItem, PropertyItem, LoadingSpinnerInfo, BasicKVP, Bucket, AppInfo } from "../DataModels/ServiceModels";
import { delay, getEnumValuesAsArray, getEnumValuesAsMap, getEnvContext, getRoleForEnv, rfdcCopy } from "./UtilFunctions";
import {  createApproverWG, createEntitlements, deleteAppInfo, deleteAWG, deleteBucket, deleteEntitlements, fetchAppDetails, getEntitlementInfoByName, getPermissionAWGItemsForCurrentUser, getPermissionEntitlementsForCurrentUser, manageAppInfoLock, updateEntitlementWithUser } from "./FetchData";
import { useCStore } from "../DataModels/ZuStore";
import { sort } from "fast-sort";



export function getEntitlementName(appID: string, permRole: PermRolesEnum, type: PermEntityTypeEnum, bucketId?: string ){
    //IMPORTANT!! -- Do Not Change! If you change the naming scheme, you break the app - simple as that!
    let entPostFix = PERM_ROLES_RELATED_DATA_MAP.get(permRole)?.[1] || ""
    if(entPostFix.trim().length === 0) {
        console.error("ERROR!!!  No Entitlement postfix found for provided permission category!!!!")
    }

    let value = (type == PermEntityTypeEnum.APP) 
        ? AGS_APP_NAME + "_" + appID + "_" + entPostFix 
        : AGS_APP_NAME + "_" + appID + "_" + bucketId?.slice(-17) + "_" + entPostFix 

    return value
}


export function getApproverWGName(appID: string) {
    //IMPORTANT!! -- Do Not Change! If you change the naming scheme, you break the app - simple as that!
    return AGS_APP_NAME + "_AWG_"+ appID; 
}


export async function loadEntitlementsForLoggedInUser(loggedInUser: LoggedInUser) : Promise<LoggedInUser> {
    let mainPermMapResp: Map<string, string> = await getPermissionEntitlementsForCurrentUser(loggedInUser);
    if(mainPermMapResp && mainPermMapResp.size > 0) {
        loggedInUser.perms = mainPermMapResp; 
    }
    return loggedInUser;
}


export async function loadAWGStatusForLoggedInUser(loggedInUser: LoggedInUser, ownerElementId: string) : Promise<LoggedInUser> {
    let awgName = getApproverWGName(ownerElementId as string);
    if(ownerElementId && (ownerElementId.trim().length > 0) && loggedInUser && loggedInUser.perms && (loggedInUser.perms.has(awgName) === false)) {
        let awgStatus : QuickStatus<any> = await getPermissionAWGItemsForCurrentUser(loggedInUser as LoggedInUser, ownerElementId);
        let awgName = awgStatus?.message;
        let newLoggedInUser = rfdcCopy<LoggedInUser>(loggedInUser as LoggedInUser) as LoggedInUser
        if(awgStatus && (awgStatus.isSuccessful === true) && (awgName.trim().length > 0)) {
            newLoggedInUser.perms.set(awgName, awgName) //This indicates we have looked up this AWG and found that currently logged in user belongs to the group
        }
        else {
            newLoggedInUser.perms.set(awgName, ""); //This indicates we have looked up this AWG and found nothing for logged in user
        }
            
        return newLoggedInUser;
    }
    else {
        return loggedInUser;
    }
}


export async function getPreloadPermissions(appId: string, bucketList: Bucket[]) : Promise<Map<string, Map<PermRolesEnum, User[]>>> {
    const chunkSize = 20;
    let promises = new Array<Promise<any>>();
    let entNameToOwnerElementId = new Map<string, string>();
    let entNameToRole = new Map<string, PermRolesEnum>();
    let finalMap = new Map<string, Map<PermRolesEnum, User[]>>();

    finalMap.set(appId, new Map());

    for(let appRoleItem of [PermRolesEnum.APP_ADMIN, PermRolesEnum.DEV_ENV_ACCESS, PermRolesEnum.PRE_ENV_ACCESS, PermRolesEnum.PROD_ENV_ACCESS]) {
        let appLevelEntitlementName: string = getEntitlementName(appId, appRoleItem, PermEntityTypeEnum.APP);
        finalMap.get(appId)!.set(appRoleItem, new Array<User>());
        entNameToOwnerElementId.set(appLevelEntitlementName.toUpperCase(), appId);
        entNameToRole.set(appLevelEntitlementName.toUpperCase(), appRoleItem);
        promises.push(getEntitlementInfoByName(appLevelEntitlementName, true));
    }

    for(let bucket of bucketList) {
        finalMap.set(bucket._id?.toString() as string, new Map());
        for(let bucketRoleItem of [PermRolesEnum.BUCKET_ADMIN, PermRolesEnum.BUCKET_READ_ONLY]) {
            let bucketLevelEntitlementName: string = getEntitlementName(appId, bucketRoleItem, PermEntityTypeEnum.BUCKET, bucket._id?.toString() as string);
            finalMap.get(bucket._id?.toString() as string)!.set(bucketRoleItem, new Array<User>());
            entNameToOwnerElementId.set(bucketLevelEntitlementName.toUpperCase(), bucket._id?.toString() as string);
            entNameToRole.set(bucketLevelEntitlementName.toUpperCase(), bucketRoleItem);
            promises.push(getEntitlementInfoByName(bucketLevelEntitlementName, true));
        }
    }
    
    for (let i = 0; i < promises.length; i += chunkSize) {
        const chunk = promises.slice(i, i + chunkSize);
        await Promise.all(chunk).then((promiseVals) => {
            if(promiseVals && promiseVals.length > 0) {
                for(let entitlementResp of promiseVals) {
                    let personArr: User[] = [];
                    if (entitlementResp && entitlementResp.displayName) {
                        let ownerId = entNameToOwnerElementId.get(entitlementResp.displayName.trim().toUpperCase())
                        let role = entNameToRole.get(entitlementResp.displayName.trim().toUpperCase())
                        if(ownerId && role) {
                            if(entitlementResp.members && entitlementResp.members.length > 0) {
                                for(let x = 0; x < entitlementResp.members.length; x++){
                                    let member = entitlementResp.members[x]
                                    personArr.push({ idsid: '', email: member.userPrincipalName, wwid: member.jobTitle } as User);
                                }
                            }
                            finalMap.get(ownerId)?.set(role, personArr)
                        }
                    }
                }
            }
        });
    }

    return finalMap
}


export async function setupPermissionsForNewElement(loggedInUser: LoggedInUser, elementList: AppInfo[]|Bucket[], type: PermEntityTypeEnum, isClonedElement: boolean) : Promise<boolean> {
    let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)
    let itemTypeStr = type === PermEntityTypeEnum.APP ? "AppInfo" : "Bucket";
    
    if(loggedInUser && elementList && (elementList.length > 0)) {
        let deleteAndBail = false
        store.setLoadingSpinnerCtx({enabled: true, text: `Now setting up roles and permissions for newly ${isClonedElement ? 'cloned' : 'created'} ${itemTypeStr}. Please wait...`} as LoadingSpinnerInfo)
        store.displayQuickMessage(UIMessageType.INFO_MSG, `Now setting up roles and permissions for newly ${isClonedElement ? 'cloned' : 'created'} ${itemTypeStr}. This can take up to one minute (approx). Please be patient...`, 50000)
        let permActionResult : QuickStatus<any> = await handleCreationOfNewPerms(loggedInUser as LoggedInUser, elementList, type).finally(() => { store.cancelLoadingSpinnerCtx() })
        if(permActionResult.isSuccessful === true) {
            store.setLoadingSpinnerCtx({enabled: true, text: `Retrieving AWG permissions for newly ${isClonedElement ? 'cloned' : 'created'} ${itemTypeStr}. Please wait...`} as LoadingSpinnerInfo)
            store.displayQuickMessage(UIMessageType.INFO_MSG, `Now getting AWG permissions for newly ${isClonedElement ? 'cloned' : 'created'} ${itemTypeStr}. This will take some time. Please be patient...`, 10000)
            
            if(type === PermEntityTypeEnum.APP) { 
                //This handles scenario where element has just been created - we get the awg info right away before switching page to new elem
                let elementId: string = elementList[0]._id.toString() as string;
                let adjUser = await loadAWGStatusForLoggedInUser(loggedInUser as LoggedInUser, elementId).finally(() => { store.cancelLoadingSpinnerCtx() })
                if(adjUser) { 
                    store.setLoggedInUser(adjUser); 
                }
            }
        }
        else {
            store.displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}. Please try again`);
            deleteAndBail = true
        }
    }

    store.cancelLoadingSpinnerCtx();  //for good measures
    return true;
}



async function handleCreationOfNewPerms(loggedInUser: LoggedInUser, elementList: AppInfo[]|Bucket[], type: PermEntityTypeEnum) : Promise<QuickStatus<any>> {
    let awgName = getApproverWGName(elementList[0].ownerElementId);
    let roleIdToEntNameMapping = new Map<PermRolesEnum, Array<[string, string]>>()  //{role, [entitlementName, appName]}

    try {
        if(type === PermEntityTypeEnum.APP) {
            let appRoleArr = [PermRolesEnum.APP_ADMIN, PermRolesEnum.DEV_ENV_ACCESS, PermRolesEnum.PRE_ENV_ACCESS, PermRolesEnum.PROD_ENV_ACCESS]
            let awgInfo = await createApproverWG(awgName, loggedInUser)
            if(awgInfo) {
                for(let appRoleItem of appRoleArr) {
                    roleIdToEntNameMapping.set(appRoleItem, new Array<[string, string]>());
                    for(let inputElem of elementList as AppInfo[]) {
                        let appLevEntName = getEntitlementName(inputElem._id?.toString() as string, appRoleItem, type)
                        roleIdToEntNameMapping.get(appRoleItem)?.push([appLevEntName, inputElem.name]);
                    }
                }
            }
        }
    
        if(type === PermEntityTypeEnum.BUCKET) {
            let buckRoleArr = [PermRolesEnum.BUCKET_ADMIN, PermRolesEnum.BUCKET_READ_ONLY]
            for(let bucketRoleItem of buckRoleArr) {
                roleIdToEntNameMapping.set(bucketRoleItem, new Array<[string, string]>());
                for(let inputElem of elementList as Bucket[]) {
                    let bucketLevEntName = getEntitlementName(inputElem.ownerElementId, bucketRoleItem, type, inputElem._id?.toString() as string)
                    roleIdToEntNameMapping.get(bucketRoleItem)?.push([bucketLevEntName, inputElem.name]);
                }
            }
        }

        if(roleIdToEntNameMapping.size > 0) {
            let map  = new Map<string, string>(Array.from(roleIdToEntNameMapping.values()).flat().map(([entName, appName]) => [entName, appName]));
            let entNameToIdMapping = await createEntitlements(map, awgName)
            if(!entNameToIdMapping || entNameToIdMapping.size === 0) {
                throw new Error("Entitlement creation failed - no entitlement IDs were returned from entitlement management system");
            }
        }
    }
    catch(error: any) {
        elementList.forEach(element => deletePermissionElements(element, type));
        return { isSuccessful: false, message: `Failed to setup permissions for ${type === PermEntityTypeEnum.APP ? "app" : "bucket"} item(s).  ${error.message}` }
    }
    
    return { isSuccessful: true, message: "" }
}



export async function updateOwnerElementPermissions(loggedInUser: LoggedInUser, appInfo: AppInfo, usersPerRoleMapping: Map<string, Map<PermRolesEnum, User[]>>) : Promise<QuickStatus<any>> {
    let errRoles = new Array<string>();
    try {
        let inputElemId = appInfo._id?.toString() as string;
        
        for (let [ownerElementId, roleToUserMap] of usersPerRoleMapping) {
            let entityType = (ownerElementId === appInfo._id?.toString() as string) ? PermEntityTypeEnum.APP : PermEntityTypeEnum.BUCKET;
            let optionalBucketId = (ownerElementId === appInfo._id?.toString() as string) ? undefined : ownerElementId
            for (let [role, users] of roleToUserMap) {
                let entName = getEntitlementName(inputElemId, role, entityType, optionalBucketId)
                let wwidList = users.map(a => a.wwid) ?? []

                let entObj : any = await getEntitlementInfoByName(entName, true)
                if(entObj && entObj.id && entObj.displayName.toUpperCase() === entName.toUpperCase()){
                    let entId = entObj.id as string
                    let existingEntMembers = entObj?.members?.map((member: any) => member.jobTitle) ?? new Array<string>()
                    
                    let res = await updateEntitlementWithUser(entName, entId, existingEntMembers, wwidList, loggedInUser);
                    if(res.isSuccessful === false) {
                        errRoles.push(`${ownerElementId}:${role}`)
                    }
                } 
                else {
                    errRoles.push(`${ownerElementId}:${role}`)
                }
            }
        }
    }
    catch(error: any) {
        return { isSuccessful: false, message: `Failed to update all permission elements for appInfo --- ${error.message}` }
    }

    if(errRoles.length > 0) {
        return { isSuccessful: false, message: `Failed to update all permission elements for appInfo. Errored Roles: ${errRoles.join(", ")}` }
    }
    else {
        return { isSuccessful: true, message: "" }
    }
}



export async function deletePermissionElements(element: AppInfo|Bucket, type: PermEntityTypeEnum) : Promise<QuickStatus<any>> {
    try {
        let inputElemId = element._id?.toString() as string;
        
        let entNameSet = new Set<string>();
        let optionalBucketId = (type === PermEntityTypeEnum.APP) ? undefined : inputElemId;
        let roleArr = (type === PermEntityTypeEnum.APP) 
            ? [PermRolesEnum.APP_ADMIN, PermRolesEnum.DEV_ENV_ACCESS, PermRolesEnum.PRE_ENV_ACCESS, PermRolesEnum.PROD_ENV_ACCESS] 
            : [PermRolesEnum.BUCKET_ADMIN, PermRolesEnum.BUCKET_READ_ONLY];
        
        for (let role of roleArr) {
            let entName = getEntitlementName(inputElemId, role, type, optionalBucketId)
            entNameSet.add(entName);
        }

        if (entNameSet && entNameSet.size > 0) {
            await deleteEntitlements(Array.from(entNameSet));
        }

        if(type === PermEntityTypeEnum.APP) {
            try {
                let awgName = getApproverWGName(element.ownerElementId);
                await deleteAWG(awgName);
            }
            catch(error: any) {
                try {
                    setTimeout(() => {
                        deleteAWG(getApproverWGName(element.ownerElementId)).catch(() => {});
                    }, 5 * 60 * 1000);
                }
                catch {}
                finally {
                    console.error(`Failed to delete AWG for appInfo ${element.name}. Will possibly retry in 5 minutes. Error: ${error.message}`);
                    return { isSuccessful: true, message: "" }
                }
            }
        }
    }
    catch(error: any) {
        return { isSuccessful: false, message: `Failed to delete all permission elements for ${type === PermEntityTypeEnum.APP ? "appInfo" : "bucket"} --- ${error.message}` }
    }

    return { isSuccessful: true, message: "" }
}


//====================================================================================================================
export function isUserInApproverWGForOwnerElement(loggedInUser: LoggedInUser|undefined, appInfo: AppInfo) : boolean {
    if(appInfo && appInfo._id) {
        let awgName = getApproverWGName(appInfo._id?.toString() as string)
        if(awgName) {
            if(loggedInUser) {
                if(loggedInUser.perms.has(awgName)){
                    let awgEntryVal = loggedInUser.perms.get(awgName) || ''
                    if(awgEntryVal.trim().length > 0) {
                        return true;
                    }
                }
            }
        }
    }
    return false
}


export function isUserApprovedForCoreAction(loggedInUser: LoggedInUser, appInfo: AppInfo, 
    actionType: PermissionAppLevelActionEnum | PermissionBucketLevelActionEnum | PermissionConfigLevelActionEnum, 
    considerAWG: boolean = true, sourceBucket: Bucket | null = null, 
    targetEnv: string | EnvTypeEnum | null = null, targetBucketId: string | null = null) : boolean {

    let appId = appInfo._id?.toString() as string;
    let isInvalidRootScene = false;
    let wtfMode = false;
    let neededAppRoleList = new Set<string>();
    let neededConfigRoleList = new Set<string>();

    let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

    if(loggedInUser && loggedInUser.perms) {
        
        //check for blocked actions and also check if user is in AWG
        let { isSuccessful, message } = checkBlockadeAndApproverWG(loggedInUser, appInfo, actionType, considerAWG);
        if (isSuccessful === false && message && message.trim().length > 0) {
            store.displayQuickMessage(UIMessageType.ERROR_MSG, message);
            return false;
        }
        else if(isSuccessful === true) {
            return true;
        }

        //check normal role based permission
        if(store.menuCurrentScene) {
            if(store.menuCurrentScene !== ActionSceneEnum.ROOT) {

                let appLevActions = getEnumValuesAsArray(PermissionAppLevelActionEnum);
                let bucketLevActions = getEnumValuesAsArray(PermissionBucketLevelActionEnum);
                let configLevActions = getEnumValuesAsArray(PermissionConfigLevelActionEnum);

                let appAdminEntName = getEntitlementName(appId, PermRolesEnum.APP_ADMIN, PermEntityTypeEnum.APP)

                if(appLevActions.has(actionType)) {
                    neededAppRoleList.add(PermRolesEnum.APP_ADMIN)
                    if(loggedInUser.perms.has(appAdminEntName)) {
                        return true
                    }
                }
                
                else if(bucketLevActions.has(actionType) || configLevActions.has(actionType)) {
                    if(sourceBucket && sourceBucket._id) {     
                        neededAppRoleList.add(PermRolesEnum.APP_ADMIN)
                        if(loggedInUser.perms.has(appAdminEntName)) {
                            return true
                        }
                        
                        let srcEnvRole = getRoleForEnv(store.selectedEnvironment)
                        if(srcEnvRole) {
                            let srcEnvEntName = getEntitlementName(appId, srcEnvRole, PermEntityTypeEnum.APP)
                            let srcBuckAdminEntName = getEntitlementName(appId, PermRolesEnum.BUCKET_ADMIN, PermEntityTypeEnum.BUCKET, sourceBucket._id?.toString() as string)
                            
                            if(actionType === PermissionBucketLevelActionEnum.VIEW_BUCKET_CONTENTS) {
                                neededAppRoleList.add(srcEnvRole)
                                neededConfigRoleList.add(PermRolesEnum.BUCKET_READ_ONLY)
                                let buckReadOnlyEntName = getEntitlementName(appId, PermRolesEnum.BUCKET_READ_ONLY, PermEntityTypeEnum.BUCKET, sourceBucket._id?.toString() as string)
                                if(loggedInUser.perms.has(srcEnvEntName) && (loggedInUser.perms.has(srcBuckAdminEntName) || loggedInUser.perms.has(buckReadOnlyEntName))) {
                                    return true
                                }
                            }
                            else if(actionType === PermissionBucketLevelActionEnum.EXPORT_BUCKET) {
                                if(targetEnv && targetEnv.toString().trim().length > 0) {
                                    let tgtEnvRole = getRoleForEnv(targetEnv)
                                    if(tgtEnvRole) {
                                        neededAppRoleList.add(srcEnvRole)
                                        neededAppRoleList.add(tgtEnvRole)
                                        neededConfigRoleList.add(PermRolesEnum.BUCKET_ADMIN)

                                        let tgtEnvEntName = getEntitlementName(appId, tgtEnvRole, PermEntityTypeEnum.APP)
                                        if(loggedInUser.perms.has(srcEnvEntName) && loggedInUser.perms.has(tgtEnvEntName) && loggedInUser.perms.has(srcBuckAdminEntName)) {
                                            return true
                                        }
                                    }
                                }
                            }
                            else if(actionType === PermissionConfigLevelActionEnum.MOVE_CONFIG) {
                                if(targetBucketId && targetBucketId.toString().trim().length > 0) {
                                    neededAppRoleList.add(srcEnvRole)
                                    neededConfigRoleList.add(PermRolesEnum.BUCKET_ADMIN)

                                    let tgtBuckEntName = getEntitlementName(appId, PermRolesEnum.BUCKET_ADMIN, PermEntityTypeEnum.BUCKET, targetBucketId)
                                    if(loggedInUser.perms.has(srcEnvEntName) && loggedInUser.perms.has(srcBuckAdminEntName) && loggedInUser.perms.has(tgtBuckEntName)) {
                                        return true
                                    }
                                }
                            }
                            else if(actionType === PermissionConfigLevelActionEnum.COMPARE_CONFIG) {
                                if(targetEnv && targetEnv.toString().trim().length > 0) {
                                    let tgtEnvRole = getRoleForEnv(targetEnv)
                                    if(tgtEnvRole) {
                                        neededAppRoleList.add(srcEnvRole)
                                        neededAppRoleList.add(tgtEnvRole)
                                        neededConfigRoleList.add(PermRolesEnum.BUCKET_ADMIN)
                                        neededConfigRoleList.add(PermRolesEnum.BUCKET_READ_ONLY)

                                        let tgtEnvEntName = getEntitlementName(appId, tgtEnvRole, PermEntityTypeEnum.APP)
                                        let srcBuckReadOnlyEntName = getEntitlementName(appId, PermRolesEnum.BUCKET_READ_ONLY, PermEntityTypeEnum.BUCKET, sourceBucket._id?.toString() as string)
                            
                                        if(loggedInUser.perms.has(srcEnvEntName) && loggedInUser.perms.has(tgtEnvEntName)) { 
                                            if(loggedInUser.perms.has(srcBuckAdminEntName) || loggedInUser.perms.has(srcBuckReadOnlyEntName)) {
                                                return true
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                if(loggedInUser.perms.has(srcBuckAdminEntName)) {
                                    return true
                                }
                            }
                        }
                    }
                }
            }
            else {
                isInvalidRootScene = true
            }
        }
        else {
            wtfMode = true
        }
    }
    else {
        wtfMode = true
    }

    if(wtfMode) {
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `Uh oh... the system could not determine if user has permission for the intended action. `
            + `Please wait a few seconds and retry action. If this issue becomes frequent, please raise a ticket / notify dev team`);
    }
    else if(isInvalidRootScene) {
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `INVALID PERMISSION ASSESSMENT SCENARIO !! - Permission check at root scene is invalid/unexpected!!`);
    }
    else {
        let narListStr = neededAppRoleList.size > 0 ? `App level: [ ${Array.from(neededAppRoleList).join(", ")} ]` : "None";
        let ncrListStr = neededConfigRoleList.size > 0 ? `; Others: [ ${Array.from(neededConfigRoleList).join(", ")} ]` : "";
        let addedMsg = (neededAppRoleList.size > 0 || neededConfigRoleList.size > 0) 
            ? `Please request access from App owner. One or mores roles are necessary from the following set(s). ${narListStr} ${ncrListStr}`
            : ` Please wait a few seconds and retry. System might not have fully retrieved the necessary permissions context data. If error continues, please request access from App owner. `
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you did not have permission for the intended operation. ${addedMsg}`);
    }

    return false;
}



function checkBlockadeAndApproverWG(loggedInUser: LoggedInUser, appInfo: AppInfo, 
    actionType: PermissionAppLevelActionEnum | PermissionBucketLevelActionEnum | PermissionConfigLevelActionEnum, considerAWG: boolean) : QuickStatus<any> {

    let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)
    //check for app wide blockage
    if(store.initConfigs && store.initConfigs.length > 0) {
        let praList : string[] = store.initConfigs.find(a => a.name === CONFIGITEM__Permission_Revoked_Actions)?.value ?? [];
        if(praList && praList.length > 0) {
            if(praList.some(x => x.trim().toUpperCase() === actionType.trim().toUpperCase())) {
                let errMsg =`Hey ${loggedInUser?.givenName}... the intended action [${actionType.toUpperCase()}] has been disabled entirely. Please contact developer or file a ticket. `;
                return {isSuccessful: false, message: errMsg}
            }
        }
    }

    //check for approver WG
    if(considerAWG === true) {
        let isInAWG = isUserInApproverWGForOwnerElement(loggedInUser, appInfo);
        if(isInAWG) { 
            return { isSuccessful: true, message: "" };
        }
    }

    return { isSuccessful: false, message: "" };
}



export async function isUserApprovedForUnlockAction(loggedInUser: LoggedInUser, appInfo: AppInfo) : Promise<boolean> {
    let wtfmode = false;
    let noEntityMode = false;
    let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

    if(loggedInUser && loggedInUser.perms) {
        let isInAWG = isUserInApproverWGForOwnerElement(loggedInUser, appInfo);
        if(isInAWG) { 
            return true; 
        }

        let freshAppInfo = await fetchAppDetails(store.selectedEnvironment, appInfo._id.toString() as string, false);
        if(freshAppInfo) {
            if(freshAppInfo.lockedBy?.trim().toLowerCase() === loggedInUser.email.trim().toLowerCase()) {
                return true;
            }
        }
        else {
            noEntityMode = true
        }
    }
    else {
        wtfmode = true;
    }

    if(wtfmode) {
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `Uh oh... the system could not determine if user has permission for the intended action. `
            + `Please wait a few seconds and retry action. If this issue becomes frequent, please raise a ticket / notify dev team`);
    }
    else if (noEntityMode) {
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `INVALID PERMISSION ASSESSMENT SCENARIO !! - Could not load appInfo to determine its lock/unlock status!!`);
    }
    else {
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you do not have permission for the intended operation. `
            + `Please contact owner to unlock the appInfo entity. owner: [${appInfo.owner.email}] `);
    }

    return false;
}



export async function handleLockAction(appInfo: AppInfo, loggedInUser: LoggedInUser): Promise<AppInfo|undefined> {
    let appInfoId = appInfo._id.toString() as string
    let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)
    let isLockAction = false;

    if(appInfo.lockedBy && appInfo.lockedBy.length > 0) {
        //unlock Scenario
        if((await isUserApprovedForUnlockAction(loggedInUser, appInfo)) === false) { return; }
        isLockAction = false;
    }
    else {
        //lock scenario
        if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionAppLevelActionEnum.LOCK_APPINFO) === false) { return; }
        isLockAction = true;
    }
    
    let actionMsg = isLockAction ? "Lock" : "Unlock";
    store.setLoadingSpinnerCtx({enabled: true, text: `${actionMsg}ing AppInfo. Please wait...`})
    let updatedProj = await manageAppInfoLock(store.selectedEnvironment, appInfoId, loggedInUser, isLockAction).finally(() => { store.cancelLoadingSpinnerCtx() })
    if(updatedProj && updatedProj._id) {
        store.displayQuickMessage(UIMessageType.WARN_MSG, `AppInfo ${actionMsg} triggered by user: ${loggedInUser?.idsid}. Timestamp: ${(new Date()).toISOString()}`)
        return updatedProj;
    }
    else {
        return undefined;
    }
}


















//============================================================================================================================================================

//============================================================================================================================================================



