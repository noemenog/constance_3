import {ActionSceneEnum, AGS_APP_APPROVER_GROUP_POSTFIX, AGS_APP_NAME, BASIC_NAME_VALIDATION_REGEX, CONF_PERMISSION_ROLES, CONFIGITEM__Permission_Action_Context, CONFIGITEM__Permission_Revoked_Actions, PermissionActionEnum, ProjectPropertyCategoryEnum, SCENES_MAPPING, UIMessageType } from "../DataModels/Constants";
import { LoggedInUser, QuickStatus, BasicProperty, User, ConfigItem, ActionPermissionContext, PropertyItem, LoadingSpinnerInfo, BasicKVP } from "../DataModels/HelperModels";
import { Project, Interface } from "../DataModels/ServiceModels";
import { delay, getEnumValuesAsMap, getEnvContext, rfdcCopy } from "./UtilFunctions";
import { createApproverWG, createEntitlements, deleteAWG, deleteEntitlements, deleteProject, fetchProjectDetails, getEntitlementInfoByName, getPermissionAWGItemsForCurrentUser, getPermissionEntitlementsForCurrentUser, manageProjectLock, updateEntitlementWithUser, updateKeyProjectAspect } from "./FetchData";
import { useSpiderStore } from "../DataModels/ZuStore";
import { sort } from "fast-sort";





export function getEntitlementName(projectId: string, roleId: string){ return getPermissionElementName(projectId, roleId) }
export function getApproverWGName(projectId: string) { return getPermissionElementName(projectId, AGS_APP_APPROVER_GROUP_POSTFIX) }
function getPermissionElementName(projectId: string, role: string) : string {
    //IMPORTANT!! -- Do Not Change!
    //If you change the naming scheme, you break the app - simple as that!
    if(!projectId || !role) { return ''; }
    let permEnv = getEnvContext().permContext
    let permElementName = AGS_APP_NAME + "_" + permEnv + "_" + projectId + "_" + role  
    permElementName = permElementName.toUpperCase()
    return permElementName;  //ex: SPIDER_DEV_PSL_65f8d8d0832e0afb107f2c82
}


export async function loadEntitlementsForLoggedInUser(loggedInUser: LoggedInUser) : Promise<LoggedInUser> {
    let mainPermMapResp: Map<string, string> = await getPermissionEntitlementsForCurrentUser(loggedInUser);
    if(mainPermMapResp && mainPermMapResp.size > 0) {
        loggedInUser.perms = mainPermMapResp; 
    }

    return loggedInUser;
}


export async function loadAWGStatusForLoggedInUser(loggedInUser: LoggedInUser, projectId: string) : Promise<LoggedInUser> {
    let awgName = getApproverWGName(projectId as string);
    if(projectId && (projectId.trim().length > 0) && loggedInUser && loggedInUser.perms && (loggedInUser.perms.has(awgName) === false)) {
        let awgStatus : QuickStatus<any> = await getPermissionAWGItemsForCurrentUser(loggedInUser as LoggedInUser, projectId);
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


export function getInitPermRolesArray(permCtxConfigRoles: any[]) : Array<BasicProperty> {
    let idChecker = new Set<string>();
    let usersRolesArr = new Array<BasicProperty>()
    if(permCtxConfigRoles && permCtxConfigRoles.length > 0) {
        let confRoles = rfdcCopy(permCtxConfigRoles) as any
        confRoles = confRoles.sort((a: any, b: any) => a.displayName < b.displayName ? -1 : 1);
        for(let roleEntry of confRoles) {
            if(roleEntry.id && roleEntry.id.trim().length > 0 && roleEntry.displayName && roleEntry.displayName.trim().length > 0 && (BASIC_NAME_VALIDATION_REGEX.test(roleEntry.id) === true) ) { 
                if(idChecker.has(roleEntry.id) === false) {
                    let role: BasicProperty = { id: roleEntry.id, name: roleEntry.displayName, value: roleEntry.rank }
                    usersRolesArr.push(role)
                    idChecker.add(role.id);
                }
            }
        }
    }
    return usersRolesArr
}



export async function getPermActionSceneData(permissionRoles: BasicProperty[], confs: ConfigItem[]) : Promise<Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>> {
    let finalMap = new Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>() //Important - at worst case, this will retuen a valid empty map - never null/undefined
    
    const knownActions = getEnumValuesAsMap(PermissionActionEnum, true);
    let permActionCtxConf : any = confs.find(a => a.configName === CONFIGITEM__Permission_Action_Context)?.configValue ?? undefined
    
    if(permissionRoles && permissionRoles.length > 0) {
        let roleIdSet = new Set<string>(permissionRoles.map(x => x.id.trim().toUpperCase()));
        if(permActionCtxConf && permActionCtxConf.length > 0) {
            for(let entry of permActionCtxConf) {
                let sceneActionsChecker = new Set<string>()
                if(SCENES_MAPPING.has(entry.scene.toString().toLowerCase())) {
                    let scene = SCENES_MAPPING.get(entry.scene.toString().toLowerCase()) as ActionSceneEnum;
                    if(entry.actions && entry.actions.length > 0) {
                        for(let k = 0; k < entry.actions.length; k++) {
                            let actionEntry = entry.actions[k]
                            if(actionEntry.names && actionEntry.names.length > 0 && actionEntry.enabled && actionEntry.enabled.toString().trim().toLowerCase() === "true") {
                                for(let a = 0; a < actionEntry.names.length; a++) {
                                    let actionNameStr = actionEntry.names[a]?.toString()?.trim()?.toUpperCase(); //IMPORTANT - this needs to remain as uppercase!!!
                                    if(actionNameStr.trim().length > 0 && knownActions.has(actionNameStr) && (sceneActionsChecker.has(actionNameStr) === false)) {  //checking name with basic regex
                                        let relevRoles = actionEntry.enabledRoles.map((x: string) => x.toUpperCase())
                                        let rolesToSet = new Set<string>(relevRoles.filter((r: string) => roleIdSet.has(r)))
                                        let apc : ActionPermissionContext = {
                                            id: `${k}`,
                                            category: scene,
                                            name: actionNameStr as PermissionActionEnum,
                                            enabled: actionEntry.enabled as boolean,
                                            enabledRoles: rolesToSet
                                        }

                                        let val = (finalMap.get(scene) ?? new Map<PermissionActionEnum, ActionPermissionContext>()).set(apc.name, apc)
                                        finalMap.set(scene, val)
                                        sceneActionsChecker.add(actionNameStr);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return finalMap;
}



export async function getPreloadPermissions(projectId: string, userRoles: BasicProperty[]) : Promise<Map<string, User[]>> {
    let promises = new Array<Promise<any>>();
    let entNameToRoleId = new Map<string, string>();
    let finalMap = new Map<string, User[]>();

    for(let roleItem of userRoles) {
        let entitlementName: string = getEntitlementName(projectId, roleItem.id);
        finalMap.set(roleItem.id, new Array<User>());
        entNameToRoleId.set(entitlementName.toUpperCase(), roleItem.id);
        promises.push(getEntitlementInfoByName(entitlementName, true));
    }

    await Promise.all(promises).then((promiseVals) => {
        if(promiseVals && promiseVals.length > 0) {
            for(let entitlementResp of promiseVals) {
                let personArr: User[] = [];
                if (entitlementResp && entitlementResp.displayName) {
                    let roleId = entNameToRoleId.get(entitlementResp.displayName.trim().toUpperCase())
                    if(roleId) {
                        if(entitlementResp.members && entitlementResp.members.length > 0) {
                            for(let x = 0; x < entitlementResp.members.length; x++){
                                let member = entitlementResp.members[x]
                                personArr.push({ idsid: '', email: member.userPrincipalName, wwid: member.jobTitle } as User);
                            }
                        }
                        finalMap.set(roleId, personArr)
                    }
                }
            }
        }
    })

    return finalMap
}


export async function setupPermissionsForNewProject(loggedInUser: LoggedInUser, project: Project, isClonedProject: boolean) : Promise<boolean> {
    let store = useSpiderStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

    if(project) {
        let deleteAndBail = false
        
        if(project.contextProperties && project.contextProperties.length > 0) {
            let permRolesConfData = project.contextProperties.find(a => a.name.toUpperCase() === CONF_PERMISSION_ROLES)?.value //NOTE: for new project, perm context is added to contextProps
            if(permRolesConfData && permRolesConfData.length > 0) {
                let usersPermRoleArray : BasicProperty[] = getInitPermRolesArray(permRolesConfData)
                store.setLoadingSpinnerCtx({enabled: true, text: `Now setting up roles and permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. Please wait...`} as LoadingSpinnerInfo)
                store.displayQuickMessage(UIMessageType.INFO_MSG, `Now setting up roles and permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. This can take up to one minute (approx). Please be patient...`, 50000)
                let permActionResult : QuickStatus<any> = await handleCreationOfNewProjectPerms(loggedInUser as LoggedInUser, project, usersPermRoleArray).finally(() => { store.cancelLoadingSpinnerCtx() })
                if(permActionResult.isSuccessful === true) {
                    store.setLoadingSpinnerCtx({enabled: true, text: `Retrieving AWG permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. Please wait...`} as LoadingSpinnerInfo)
                    store.displayQuickMessage(UIMessageType.INFO_MSG, `Now getting AWG permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. This will take some time. Please be patient...`, 10000)
                    //This handles scenario where project has just been created - we get the awg info right away before switching page to new proj
                    let adjUser = await loadAWGStatusForLoggedInUser(loggedInUser as LoggedInUser, project._id.toString() as string).finally(() => { store.cancelLoadingSpinnerCtx() })
                    if(adjUser) { 
                        store.setLoggedInUser(adjUser); 
                    }
                }
                else {
                    store.displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}. Please try again`);
                    deleteAndBail = true
                }
                
            }
            else {
                store.displayQuickMessage(UIMessageType.ERROR_MSG, `Project ${isClonedProject ? 'cloning' : 'creation'} was not successful. Permissions context was not retrieved.`);
                deleteAndBail = true
            }
        }
        else {
            store.displayQuickMessage(UIMessageType.ERROR_MSG, `Project ${isClonedProject ? 'cloning' : 'creation'} was not successful. Permissions were not setup due to missing contextual information.`);
            deleteAndBail = true
        }        
        
        if(deleteAndBail) {
            deleteProject(project._id.toString() as string);
            return false;
        }
    }

    store.cancelLoadingSpinnerCtx();  //for good measures
    return true;
}



async function handleCreationOfNewProjectPerms(loggedInUser: LoggedInUser, project: Project, permRoleArray: BasicProperty[]) : Promise<QuickStatus<any>> {
    try {
        let projectId = project._id?.toString() as string;
        let awgName = getApproverWGName(projectId)
        let awgInfo: any = await createApproverWG(awgName, loggedInUser)
        if(awgInfo) {
            let roleIdToEntNameMapping = new Map<string, string>()
            
            for (let role of permRoleArray) {
                let entName = getEntitlementName(projectId, role.id)
                roleIdToEntNameMapping.set(role.id, entName)
            }

            if(roleIdToEntNameMapping.size > 0) {
                let entNameToIdMapping = await createEntitlements(Array.from(roleIdToEntNameMapping.values()), awgName, project.name)
                if(entNameToIdMapping && entNameToIdMapping.size > 0) {
                    let permRolesProperty = {
                        id: crypto.randomUUID(),
                        name: ProjectPropertyCategoryEnum.PERMISSION_ROLES,
                        displayName: ProjectPropertyCategoryEnum.PERMISSION_ROLES,
                        category: ProjectPropertyCategoryEnum.PERMISSION_ROLES,
                        editable: false,
                        enabled: true,
                        value: permRoleArray,
                    } as PropertyItem
                     
                    let updatedProj = await updateKeyProjectAspect(project?._id.toString() as string, ProjectPropertyCategoryEnum.PERMISSION_ROLES, permRolesProperty)
                    if(!updatedProj) {
                        return { isSuccessful: false, message: `Failed to setup permissions for new project. Could not persist roles defined for project` }
                    }
                }
                else {
                    return { isSuccessful: false, message: `Failed to setup permissions for new project. An unknown error occured during call to entitlement management system` }
                }
            }
        }
    }
    catch(error: any) {
        deleteProjectPermissionElements(loggedInUser, project, permRoleArray);
        return { isSuccessful: false, message: `Failed to setup permissions for new project.  ${error.message}` }
    }

    return { isSuccessful: true, message: "" }
}



export async function updateProjectPermissions(loggedInUser: LoggedInUser, project: Project, usersPerRoleMapping: Map<string, User[]>) : Promise<QuickStatus<any>> {
    let errRoles = new Array<string>();
    try {
        let projectId = project._id?.toString() as string;
        
        for (let [roleId, users] of usersPerRoleMapping) {
            let entName = getEntitlementName(projectId, roleId)
            let wwidList = users.map(a => a.wwid) ?? []

            let entObj : any = await getEntitlementInfoByName(entName)
            if(entObj && entObj.id && entObj.displayName.toUpperCase() === entName.toUpperCase()){
                let entId = entObj.id as string
                let existingEntMembers = entObj?.members?.map((member: any) => member.jobTitle) ?? new Array<string>()
                
                updateEntitlementWithUser(entName, entId, existingEntMembers, wwidList, loggedInUser);
            } 
            else {
                errRoles.push(roleId)
            }
        }
    }
    catch(error: any) {
        return { isSuccessful: false, message: `Failed to update all permission elements for project --- ${error.message}` }
    }

    if(errRoles.length > 0) {
        return { isSuccessful: false, message: `Failed to update all permission elements for project. Role-Ids: ${errRoles.join(", ")}` }
    }
    else {
        return { isSuccessful: true, message: "" }
    }
}



export async function deleteProjectPermissionElements(loggedInUser: LoggedInUser, project: Project, userRoles: BasicProperty[]) : Promise<QuickStatus<any>> {
    try {
        let projectId = project._id?.toString() as string;
        let awgName = getApproverWGName(projectId)
        await deleteAWG(awgName);

        let entNameSet = new Set<string>();
        for (let role of userRoles) {
            let entName = getEntitlementName(projectId, role.id)
            entNameSet.add(entName);
        }

        if (entNameSet && entNameSet.size > 0) {
            deleteEntitlements(Array.from(entNameSet));
        }

        //TODO: delete any permissions from graph call that pertains to this project
    }
    catch(error: any) {
        return { isSuccessful: false, message: `Failed to completely delete permission elements for project.  ${error.message}` }
    }

    return { isSuccessful: true, message: "" }
}



export function isUserInApproverWGForProject(loggedInUser: LoggedInUser|undefined, project: Project) : boolean {
    if(project && project._id) {
        let awgName = getApproverWGName(project._id?.toString() as string)
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



export function isUserApprovedForCoreAction(loggedInUser: LoggedInUser, project: Project, actionType: PermissionActionEnum, considerAWG: boolean = true) : boolean {
    let isInvalidRootScene = false;
    let wtfMode = false;
    let roleIdList = new Array<string>();
    let store = useSpiderStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

    if(loggedInUser && loggedInUser.perms) {
        //check for app wide blockage
        if(store.initConfigs && store.initConfigs.length > 0) {
            let praList : string[] = store.initConfigs.find(a => a.configName === CONFIGITEM__Permission_Revoked_Actions)?.configValue ?? [];
            if(praList && praList.length > 0) {
                if(praList.some(x => x.trim().toUpperCase() === actionType.trim().toUpperCase())) {
                    store.displayQuickMessage(UIMessageType.ERROR_MSG, `Hey ${loggedInUser?.givenName}... the intended action [${actionType.toUpperCase()}] has been disabled `
                    + `entirely. Please contact developer or file a ticket. `);
                    return false;
                }
            }
        }

        //check for approver WG
        if(considerAWG === true) {
            let isInAWG = isUserInApproverWGForProject(loggedInUser, project);
            if(isInAWG) { 
                return true; 
            }
        }
        
        //check normal role based permission
        if(store.menuCurrentScene) {
            if(store.menuCurrentScene !== ActionSceneEnum.ROOT) {
                if(store.actionScenePermContextMap && store.actionScenePermContextMap.has(store.menuCurrentScene)) {
                    let actionPermCtx: ActionPermissionContext|undefined = store.actionScenePermContextMap.get(store.menuCurrentScene)?.get(actionType);
                    if(actionPermCtx && actionPermCtx.enabled && actionPermCtx.enabledRoles && actionPermCtx.enabledRoles.size > 0) {
                        for(let roleId of actionPermCtx.enabledRoles) {
                            roleIdList.push(roleId)
                            let ent = getEntitlementName(project._id?.toString() as string, roleId)
                            if(loggedInUser.perms.has(ent)) {
                                return true
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
        let addedMsg = (roleIdList.length > 0) 
            ? `Please request access from project owner. Accepted role Ids: [ ${roleIdList.join(", ")} ]`
            : ` Please wait a few seconds and retry. System might not have fully retrieved the necessary permissions context data. If error continues, please request access from project owner. `
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you did not have permission for the intended operation. ${addedMsg}`);
    }

    return false;
}



export async function isUserApprovedForUnlockAction(loggedInUser: LoggedInUser, project: Project) : Promise<boolean> {
    let wtfmode = false;
    let noEntityMode = false;
    let store = useSpiderStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

    if(loggedInUser && loggedInUser.perms) {
        let isInAWG = isUserInApproverWGForProject(loggedInUser, project);
        if(isInAWG) { 
            return true; 
        }

        let freshProj = await fetchProjectDetails(project._id.toString() as string);
        if(freshProj) {
            if(freshProj.lockedBy?.trim().toLowerCase() === loggedInUser.email.trim().toLowerCase()) {
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
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `INVALID PERMISSION ASSESSMENT SCENARIO !! - Could not load project to determine its lock/unlock status!!`);
    }
    else {
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you do not have permission for the intended operation. `
            + `Please contact owner to unlock the project. Project owner: [${project.owner.email}] `);
    }

    return false;
}



export async function handleLockAction(project: Project, loggedInUser: LoggedInUser): Promise<Project|undefined> {
    let projectId = project._id.toString() as string
    let store = useSpiderStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)
    let isLockAction = false;

    if(project.lockedBy && project.lockedBy.length > 0) {
        //unlock Scenario
        if((await isUserApprovedForUnlockAction(loggedInUser, project)) === false) { return; }
        isLockAction = false;
    }
    else {
        //lock scenario
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.LOCK_PROJECT) === false) { return; }
        isLockAction = true;
    }
    
    let actionMsg = isLockAction ? "Lock" : "Unlock";
    store.setLoadingSpinnerCtx({enabled: true, text: `${actionMsg}ing project. Please wait...`})
    let updatedProj = await manageProjectLock(projectId, loggedInUser, isLockAction).finally(() => { store.cancelLoadingSpinnerCtx() })
    if(updatedProj && updatedProj._id) {
        store.displayQuickMessage(UIMessageType.WARN_MSG, `Project ${actionMsg} triggered by user: ${loggedInUser?.idsid}. Timestamp: ${(new Date()).toISOString()}`)
        return updatedProj;   
    }
    else {
        return undefined;
    }
}





export function getHighestProjectPermRoleForLoggedInUser(project: Project, loggedInUser: LoggedInUser): BasicKVP {
    let defValue = { key: "Unknown", value: "Unknown"} as BasicKVP
    let projectId = project._id.toString() as string;

    if(loggedInUser && loggedInUser.perms) {
        let isInAWG = isUserInApproverWGForProject(loggedInUser, project);
        if(isInAWG) { 
            return { key: getApproverWGName(projectId), value: "Admin" } as BasicKVP; 
        }

        let permissionRoles : BasicProperty[] = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.PERMISSION_ROLES && a.name === ProjectPropertyCategoryEnum.PERMISSION_ROLES))?.value
        
        if(permissionRoles && permissionRoles.length > 0) {
            let permData = permissionRoles.map(x => ({key: getEntitlementName(projectId, x.id), value: x.value} as BasicKVP))
            let relevantItems = permData.filter(a => loggedInUser.perms.has(a.key)) ?? [];
            if(relevantItems && relevantItems.length > 0) {
                let sorted = sort(relevantItems).asc(a => a.value)
                return sorted[0]
            }
        }
    }   

    return defValue
}



export function isUserApprovedForProjectRestrictorChangeAction(loggedInUser: LoggedInUser, project: Project) : boolean {
    if(loggedInUser) {
        if(project && project._id && project.owner) {
            if(project.owner.email.toLowerCase().trim() === loggedInUser.email.toLowerCase().trim()
            || project.owner.idsid.toLowerCase().trim() === loggedInUser.idsid.toLowerCase().trim()) {
                return true;
            }
        }
    }

    return false;
}









//========================================================



// export function isUserApprovedForCoreAction(loggedInUser: LoggedInUser|undefined, project: Project, 
//     actionType: PermissionActionEnum, considerAWG: boolean = false) : boolean {
//     let store = useSpiderStore.getState();
//     let roleIdList = new Array<string>();

//     function performCheck() : {checkResult: boolean, isInvalidRootScene: boolean} {
//         roleIdList = [];
//         if(loggedInUser && loggedInUser.perms) {
//             if(considerAWG === true) {
//                 let isInAWG = isUserInApproverWGForProject(loggedInUser, project);
//                 if(isInAWG) { 
//                     return {checkResult: true, isInvalidRootScene: false}; 
//                 }
//             }
            
//             // let roleIdList = new Array<string>();
//             let store = useSpiderStore.getState();
    
//             if(store) {
//                 if(store.menuCurrentScene) {
//                     if(store.menuCurrentScene !== ActionSceneEnum.ROOT) {
//                         if(store.actionScenePermContextMap && store.actionScenePermContextMap.has(store.menuCurrentScene)) {
//                             let actionPermCtx: ActionPermissionContext|undefined = store.actionScenePermContextMap.get(store.menuCurrentScene)?.get(actionType);
//                             if(actionPermCtx && actionPermCtx.enabled && actionPermCtx.enabledRoles && actionPermCtx.enabledRoles.size > 0) {
//                                 for(let roleId of actionPermCtx.enabledRoles) {
//                                     roleIdList.push(roleId)
//                                     let ent = getEntitlementName(project._id?.toString() as string, roleId)
//                                     if(loggedInUser.perms.has(ent)) {
//                                         return {checkResult: true, isInvalidRootScene: false}
//                                     }
//                                 }
//                             }
//                         }
//                     }
//                     else {
//                         return {checkResult: false, isInvalidRootScene: true}
//                     }
//                 }
//             } 
//         }
//         return {checkResult: false, isInvalidRootScene: false}
//     }

//     let res = performCheck();
//     let isSecondaryActionFinished = false;

//     if(res.checkResult === false) {
//         store.setIsLoadingBackdropEnabled(true)
//         delay(10000).then(() => {
//             let secondRes = performCheck();
//             if(secondRes.checkResult === true) {
//                 return true;
//             }
//             else if(secondRes.isInvalidRootScene) {
//                 store.displayQuickMessage(UIMessageType.ERROR_MSG, `INVALID PERMISSION ASSESSMENT SCENARIO !! - Permission check at root scene is invalid/unexpected!!`);
//             }
//             else {
//                 store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you do not have permission for the intended operation. `
//                     + `Please request access from project owner. Accepted role Ids: [ ${roleIdList.join(", ")} ]`);
//             }
//             return false;
//         })
//         .finally(() => {
//             store.setIsLoadingBackdropEnabled(false);
//             isSecondaryActionFinished = true;
//             return false
//         });
//     }

//     // while (!isSecondaryActionFinished) {
//     //     // Blocking the event loop (not recommended)
//     //     //but... well F it... i need to ensuure this thing runs!
//     // }

//     // return false;

// }


//=================================================================




    // if(loggedInUser && loggedInUser.perms) {
    //     if(considerAWG === true) {
    //         let isInAWG = isUserInApproverWGForProject(loggedInUser, project);
    //         if(isInAWG) { 
    //             return true; 
    //         }
    //     }
        
    //     let roleIdList = new Array<string>();
    //     let isInvalidRootScene = false;

    //     if(store) {
    //         if(store.menuCurrentScene) {
    //             if(store.menuCurrentScene !== ActionSceneEnum.ROOT) {
    //                 if(store.actionScenePermContextMap && store.actionScenePermContextMap.has(store.menuCurrentScene)) {
    //                     let actionPermCtx: ActionPermissionContext|undefined = store.actionScenePermContextMap.get(store.menuCurrentScene)?.get(actionType);
    //                     if(actionPermCtx && actionPermCtx.enabled && actionPermCtx.enabledRoles && actionPermCtx.enabledRoles.size > 0) {
    //                         for(let roleId of actionPermCtx.enabledRoles) {
    //                             roleIdList.push(roleId)
    //                             let ent = getEntitlementName(project._id?.toString() as string, roleId)
    //                             if(loggedInUser.perms.has(ent)) {
    //                                 return true;
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //             else {
    //                 isInvalidRootScene = true;
    //             }
    //         }
    //     }

    //     store.setIsLoadingBackdropEnabled(true)
    //     delay(10000).then(() => {
    //         if(isInvalidRootScene) {
    //             store.displayQuickMessage(UIMessageType.ERROR_MSG, `INVALID PERMISSION ASSESSMENT SCENARIO !! - Permission check at root scene is invalid/unexpected!!`);
    //         }
    //         else {
    //             store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you do not have permission for the intended operation. `
    //                 + `Please request access from project owner. Accepted role Ids: [ ${roleIdList.join(", ")} ]`);
    //         }
    //     }).finally(() => store.setIsLoadingBackdropEnabled(false));
        
    // }


    // return false;


    





// if(isInvalidRootScene) {
        //     store.displayQuickMessage(UIMessageType.ERROR_MSG, `INVALID PERMISSION ASSESSMENT SCENARIO !! - Permission check at root scene is invalid/unexpected!!`);
        // }
        // else {
        //     store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you do not have permission for the intended operation. `
        //         + `Please request access from project owner. Accepted role Ids: [ ${roleIdList.join(", ")} ]`);
        // }




// if((loggedInUser.email && loggedInUser.email === ifaceForUpdate.lockedBy) 
//     || (loggedInUser.idsid && loggedInUser.idsid === ifaceForUpdate.lockedBy)) {

// }



// let appEntName = '';
// let retVal = false;





//======================================================

// export async function getPermActionSceneData(confs: ConfigItem[]) : Promise<[BasicProperty[], Map<ActionSceneEnum, Map<string, ActionPermissionContext>>]> {
//     let usersPermRolesArray = new Array<BasicProperty>(); //Important - at worst case, this will retuen a valid empty array - never null/undefined
//     let finalMap = new Map<ActionSceneEnum, Map<string, ActionPermissionContext>>() //Important - at worst case, this will retuen a valid empty map - never null/undefined
    
//     let roleIdSet = new Set<string>();
//     const knownActions = getEnumValuesAsMap(PermissionActionEnum, true);
    
//     let permRolesConf : any = confs.find(a => a.configName === CONFIGITEM__Permission_Roles)?.configValue ?? undefined
//     let permActionCtxConf : any = confs.find(a => a.configName === CONFIGITEM__Permission_Action_Context)?.configValue ?? undefined
    
//     if(permRolesConf && permRolesConf.length > 0) {
//         if(permActionCtxConf && permActionCtxConf.length > 0) {
            
//             usersPermRolesArray = getInitPermRolesArray(permRolesConf)
//             roleIdSet = new Set<string>(usersPermRolesArray.map(x => x.id.trim().toUpperCase()));
            
//             for(let entry of permActionCtxConf) {
//                 let sceneActionsChecker = new Set<string>()
//                 if(SCENES_MAPPING.has(entry.scene.toString().toLowerCase())) {
//                     let scene = SCENES_MAPPING.get(entry.scene.toString().toLowerCase()) as ActionSceneEnum;
//                     if(entry.actions && entry.actions.length > 0) {
//                         for(let k = 0; k < entry.actions.length; k++) {
//                             let actionEntry = entry.actions[k]
//                             if(actionEntry.names && actionEntry.names.length > 0 && actionEntry.enabled && actionEntry.enabled.toString().trim().toLowerCase() === "true") {
//                                 for(let a = 0; a < actionEntry.names.length; a++) {
//                                     let actionName = actionEntry.names[a]?.toString()?.trim()?.toUpperCase(); //IMPORTANT - this needs to remain as uppercase!!!
//                                     if(actionName.trim().length > 0 && knownActions.has(actionName) && (sceneActionsChecker.has(actionName) === false)) {  //checking name with basic regex
//                                         let relevRoles = actionEntry.enabledRoles.map((x: string) => x.toUpperCase())
//                                         let rolesToSet = new Set<string>(relevRoles.filter((r: string) => roleIdSet.has(r)))
//                                         let apc : ActionPermissionContext = {
//                                             id: `${k}`,
//                                             category: scene,
//                                             name: actionName,
//                                             enabled: actionEntry.enabled as boolean,
//                                             enabledRoles: rolesToSet
//                                         }

//                                         let val = (finalMap.get(scene) ?? new Map<string, ActionPermissionContext>()).set(apc.name, apc)
//                                         finalMap.set(scene, val)
//                                         sceneActionsChecker.add(actionName);
//                                     }
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }

//     return [usersPermRolesArray, finalMap];
// }

//==========================================================








// await new Promise(resolve => setTimeout(resolve, 1000));  //Knowingly doing this!

// for (let [entName, wwidList] of entNameToWWIDMapping) {
//     wwidList = [...new Set(wwidList)];   //get distinct
//     let entId = entNameToIdMapping.get(entName) as string;
//     await updateEntitlementWithUser(entName, entId, new Array<string>(), wwidList, loggedInUser);
// }

//=========================



    
    // //TODO: remove this dummy code
    // for (let item of ["ndubuisi.emenogu@intel.com", "aman.negi@intel.com", "yamini.kurra@intel.com"]) {
    //     usersPerRoleMapping.get([...usersPerRoleMapping.keys()][0])?.push({ idsid: '', email: item, wwid: "1111" } as User)
    // }



// export async function getAllUsersInApproverWG(awg: string) {
//     let url = MLCR_AUTH_AGS_URL + "/apwg/get?fullName=" + awg + "&type=Approver&appName=" + AGS_APP_NAME
//     let users: any [] = []
//     let config: any = {
//         method: "get",
//         maxBodyLength: Infinity,
//         url: url,
//         headers: {
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         }
//       };
//       await axios.request(config).then(resp => {
//             console.log("Successfully fetched all users of the approval workgroup ", awg)
//             users = resp.data.members
//       }).catch((err) => {
//             console.error("Error while fetching users in approver workgroup ", err)
//       })
//     return users;    
// }





        




/*
PERMISSIONS:


On navigation:
    On User login: getListOfPermissionsWhereUserHasAnyAccess()
    apps list: all apps
    buckets list: show only buckets where user has access for bucket and app (at selected environment)
        FilterBucketsWhereUserhasAccessForEnv()

On App setup button: 
    if app already selected - check that user is approver for selected app, otherwise only allow new app scenario
    if no app selected - no check
        IsUserInApproverWGForApp(): boolean

On Config Handling:
    *config right click change bucket:           has approverWG, admin, readWrite (for other bucket)
    *config right click copy to another bucket:  has approverWG, admin, readwrite (for other bucket)
    *config add:                                 has approverWG, admin, readWrite (for currrent bucket)
    *config save:                                has approverWG, admin, readWrite 
    *config delete:                              has approverWG, admin
    config compareTo:                            has access to other environment and any access to other bucket

        CheckUserHasPermissionsForBucket()


App Management dialog submit:
    perform permissions add, update, delete as necessary
    This part will call the AGS functions below as needed...
        might also need this somewhere: CheckUserHasPermissionForApp()
*/


//===============================================================================




// export async function getEntitlementInfoByName2(entName: string){
//     let entitlement: any;
    
//     try {
//         await Providers.globalProvider
//         .graph
//         .api(`/groups?$filter=startswith(displayName,'${entName}')&$expand=members($select=id,displayName,userPrincipalName,jobTitle)&$select=id,displayName,members`)
//         .header("ConsistencyLevel", "eventual")
//         .get()
//         .then((response:any) => {
//              let entObj = response["value"].find((ent: any)=> {
//                 return ent.displayName.toUpperCase() === entName.toUpperCase()
//              })
//              entitlement = entObj
//         }).catch((err:any)=>{
//             console.log("Error while getting entitlement info by name: ", err)
//         })
//         return entitlement
//     } catch (error) {
//       return error
//     }
// }



//===============================================================================



// export function CheckUserHasPermissionsForBucket(loggedInUser: any, project: any, arg4: any[], arg5: boolean) {
//     console.error("Function not implemented.");
//     return true
// }

//============================================================================================================
//=========================================== ACTION CHECK CALLS =============================================
//============================================================================================================

// export function FilterBucketsWhereUserhasAccessForApp(env: string, loggedInUser: User, initBucketList: Bucket[]) : Bucket[] {   
//     let bucketPermissions: string[] = []
//     let finalBucketMap: Map<string, Bucket> = new Map<string, Bucket>()
//     let appId = initBucketList[0].appId

//     if(initBucketList && initBucketList.length > 0) {
//         //Note: all incoming buckets are expected to belong to same App (same appID)
//         if(IsUserInApproverWGForApp(loggedInUser, appId)) {
//             return initBucketList
//         }

//         let isEnvApproved = IsUserApprovedForEnvironment(env, appId, loggedInUser, false)
//         if(isEnvApproved === false) {
//             return [];
//         }
        
//         if(loggedInUser.perms.size > 0) {
//             for (const [key, value] of loggedInUser.perms.entries()) {
//                 if (key.endsWith(PermCategoryType.READ_ONLY) || key.endsWith(PermCategoryType.READ_WRITE) || key.endsWith(PermCategoryType.ADMIN)) {
//                     bucketPermissions.push(key);
//                 }
//             }
//         }

//         for(let i = 0; i < initBucketList.length; i++) {
//             let bucket: Bucket = initBucketList[i]
//             for(let x = 0; x < BucketPermissionTypes.length; x++) {
//                 let permType: PermCategoryType = BucketPermissionTypes[x]
                
//                 let bucketEntName = getEntitlementName(bucket.appId, permType, PermEntityType.BUCKET, bucket._id)
//                 if(bucketPermissions.includes(bucketEntName)) {
//                     finalBucketMap.set(bucket._id, bucket)
//                 }
//             }
//         }
//     }
        
//     return [...finalBucketMap.values()]
// }


// export function CheckUserHasPermissionsForBucket(loggedInUser: User, tgtEnv: string, app: AppInfo, tgtBucket: Bucket, bucketPermsCategList: PermCategoryType[], isAWGSufficient: boolean) : boolean {
//     if(isAWGSufficient){
//         if(IsUserInApproverWGForApp(loggedInUser, app._id)){
//             return true;
//         }
//     }

//     let isEnvApproved = IsUserApprovedForEnvironment(tgtEnv, app._id, loggedInUser, false)
//     if(isEnvApproved === false) {
//         return false;
//     }
    
//     for(let i = 0; i < bucketPermsCategList.length; i++ ){
//         let perm = bucketPermsCategList[i]
//         let bucketEntName = getEntitlementName(tgtBucket.appId, perm, PermEntityType.BUCKET, tgtBucket._id)
//         if(loggedInUser.perms.has(bucketEntName)){
//             return true;
//         }
//     } 
  
//     return false;
// }


// export function IsUserInApproverWGForApp(loggedInUser: User, appId: string | undefined) : boolean {
//     if(appId && appId.length > 0) {
//         let awgName = getApproverWGName(appId)
//         if(loggedInUser) {
//             if(loggedInUser.perms.has(awgName)){
//                 return true;
//             }
//         }
//     }
//     return false
// }


// export function IsUserApprovedForEnvironment(env: string, appId: string, loggedInUser: User, considerAWG: boolean) : boolean{
//     let appEntName = '';
//     let retVal = false;

//     if(considerAWG) {
//         if(IsUserInApproverWGForApp(loggedInUser, appId)) {
//             return true
//         }
//     }

//     if(env === DEVELOPMENT) {
//         appEntName = getEntitlementName(appId,PermCategoryType.DEV_ACCESS, PermEntityType.APP)
//     }
//     else if(env === PREVIEW) {
//         appEntName = getEntitlementName(appId,PermCategoryType.PRE_ACCESS, PermEntityType.APP)
//     }
//     else if(env === PRODUCTION) {
//         appEntName = getEntitlementName(appId,PermCategoryType.PROD_ACCESS, PermEntityType.APP)
//     }

//     if(appEntName.length > 0 && loggedInUser.perms.size > 0) {
//         if(loggedInUser.perms.has(appEntName)) {
//             retVal = true;
//         }
//     }

//     return retVal;
// }
    