import {ActionSceneEnum, AGS_APP_APPROVER_GROUP_POSTFIX, AGS_APP_NAME, BASIC_NAME_VALIDATION_REGEX, SCENES_MAPPING, 
    UIMessageType, PermissionActionEnum, CONFIGITEM__Permission_Revoked_Actions } from "../DataModels/Constants";
import { LoggedInUser, QuickStatus, BasicProperty, User, ConfigItem, ActionPermissionContext, PropertyItem, LoadingSpinnerInfo, BasicKVP } from "../DataModels/HelperModels";
import { delay, getEnumValuesAsMap, getEnvContext, rfdcCopy } from "./UtilFunctions";
import {  fetchAppDetails, getPermissionAWGItemsForCurrentUser, getPermissionEntitlementsForCurrentUser, manageAppInfoLock, updateEntitlementWithUser } from "./FetchData";
import { useCStore } from "../DataModels/ZuStore";
import { sort } from "fast-sort";
import { AppInfo } from "../DataModels/ServiceModels";





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


// export function getInitPermRolesArray(permCtxConfigRoles: any[]) : Array<BasicProperty> {
//     let idChecker = new Set<string>();
//     let usersRolesArr = new Array<BasicProperty>()
//     if(permCtxConfigRoles && permCtxConfigRoles.length > 0) {
//         let confRoles = rfdcCopy(permCtxConfigRoles) as any
//         confRoles = confRoles.sort((a: any, b: any) => a.displayName < b.displayName ? -1 : 1);
//         for(let roleEntry of confRoles) {
//             if(roleEntry.id && roleEntry.id.trim().length > 0 && roleEntry.displayName && roleEntry.displayName.trim().length > 0 && (BASIC_NAME_VALIDATION_REGEX.test(roleEntry.id) === true) ) { 
//                 if(idChecker.has(roleEntry.id) === false) {
//                     let role: BasicProperty = { id: roleEntry.id, name: roleEntry.displayName, value: roleEntry.rank }
//                     usersRolesArr.push(role)
//                     idChecker.add(role.id);
//                 }
//             }
//         }
//     }
//     return usersRolesArr
// }



// export async function getPermActionSceneData(permissionRoles: BasicProperty[], confs: ConfigItem[]) : Promise<Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>> {
//     let finalMap = new Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>() //Important - at worst case, this will retuen a valid empty map - never null/undefined
    
//     const knownActions = getEnumValuesAsMap(PermissionActionEnum, true);
//     let permActionCtxConf : any = confs.find(a => a.configName === CONFIGITEM__Permission_Action_Context)?.configValue ?? undefined
    
//     if(permissionRoles && permissionRoles.length > 0) {
//         let roleIdSet = new Set<string>(permissionRoles.map(x => x.id.trim().toUpperCase()));
//         if(permActionCtxConf && permActionCtxConf.length > 0) {
//             for(let entry of permActionCtxConf) {
//                 let sceneActionsChecker = new Set<string>()
//                 if(SCENES_MAPPING.has(entry.scene.toString().toLowerCase())) {
//                     let scene = SCENES_MAPPING.get(entry.scene.toString().toLowerCase()) as ActionSceneEnum;
//                     if(entry.actions && entry.actions.length > 0) {
//                         for(let k = 0; k < entry.actions.length; k++) {
//                             let actionEntry = entry.actions[k]
//                             if(actionEntry.names && actionEntry.names.length > 0 && actionEntry.enabled && actionEntry.enabled.toString().trim().toLowerCase() === "true") {
//                                 for(let a = 0; a < actionEntry.names.length; a++) {
//                                     let actionNameStr = actionEntry.names[a]?.toString()?.trim()?.toUpperCase(); //IMPORTANT - this needs to remain as uppercase!!!
//                                     if(actionNameStr.trim().length > 0 && knownActions.has(actionNameStr) && (sceneActionsChecker.has(actionNameStr) === false)) {  //checking name with basic regex
//                                         let relevRoles = actionEntry.enabledRoles.map((x: string) => x.toUpperCase())
//                                         let rolesToSet = new Set<string>(relevRoles.filter((r: string) => roleIdSet.has(r)))
//                                         let apc : ActionPermissionContext = {
//                                             id: `${k}`,
//                                             category: scene,
//                                             name: actionNameStr as PermissionActionEnum,
//                                             enabled: actionEntry.enabled as boolean,
//                                             enabledRoles: rolesToSet
//                                         }

//                                         let val = (finalMap.get(scene) ?? new Map<PermissionActionEnum, ActionPermissionContext>()).set(apc.name, apc)
//                                         finalMap.set(scene, val)
//                                         sceneActionsChecker.add(actionNameStr);
//                                     }
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }

//     return finalMap;
// }



// export async function getPreloadPermissions(projectId: string, userRoles: BasicProperty[]) : Promise<Map<string, User[]>> {
//     let promises = new Array<Promise<any>>();
//     let entNameToRoleId = new Map<string, string>();
//     let finalMap = new Map<string, User[]>();

//     for(let roleItem of userRoles) {
//         let entitlementName: string = getEntitlementName(projectId, roleItem.id);
//         finalMap.set(roleItem.id, new Array<User>());
//         entNameToRoleId.set(entitlementName.toUpperCase(), roleItem.id);
//         promises.push(getEntitlementInfoByName(entitlementName, true));
//     }

//     await Promise.all(promises).then((promiseVals) => {
//         if(promiseVals && promiseVals.length > 0) {
//             for(let entitlementResp of promiseVals) {
//                 let personArr: User[] = [];
//                 if (entitlementResp && entitlementResp.displayName) {
//                     let roleId = entNameToRoleId.get(entitlementResp.displayName.trim().toUpperCase())
//                     if(roleId) {
//                         if(entitlementResp.members && entitlementResp.members.length > 0) {
//                             for(let x = 0; x < entitlementResp.members.length; x++){
//                                 let member = entitlementResp.members[x]
//                                 personArr.push({ idsid: '', email: member.userPrincipalName, wwid: member.jobTitle } as User);
//                             }
//                         }
//                         finalMap.set(roleId, personArr)
//                     }
//                 }
//             }
//         }
//     })

//     return finalMap
// }


// export async function setupPermissionsForNewProject(loggedInUser: LoggedInUser, project: Project, isClonedProject: boolean) : Promise<boolean> {
//     let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

//     if(project) {
//         let deleteAndBail = false
        
//         if(project.contextProperties && project.contextProperties.length > 0) {
//             let permRolesConfData = project.contextProperties.find(a => a.name.toUpperCase() === CONF_PERMISSION_ROLES)?.value //NOTE: for new project, perm context is added to contextProps
//             if(permRolesConfData && permRolesConfData.length > 0) {
//                 let usersPermRoleArray : BasicProperty[] = getInitPermRolesArray(permRolesConfData)
//                 store.setLoadingSpinnerCtx({enabled: true, text: `Now setting up roles and permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. Please wait...`} as LoadingSpinnerInfo)
//                 store.displayQuickMessage(UIMessageType.INFO_MSG, `Now setting up roles and permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. This can take up to one minute (approx). Please be patient...`, 50000)
//                 let permActionResult : QuickStatus<any> = await handleCreationOfNewProjectPerms(loggedInUser as LoggedInUser, project, usersPermRoleArray).finally(() => { store.cancelLoadingSpinnerCtx() })
//                 if(permActionResult.isSuccessful === true) {
//                     store.setLoadingSpinnerCtx({enabled: true, text: `Retrieving AWG permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. Please wait...`} as LoadingSpinnerInfo)
//                     store.displayQuickMessage(UIMessageType.INFO_MSG, `Now getting AWG permissions for newly ${isClonedProject ? 'cloned' : 'created'} project. This will take some time. Please be patient...`, 10000)
//                     //This handles scenario where project has just been created - we get the awg info right away before switching page to new proj
//                     let adjUser = await loadAWGStatusForLoggedInUser(loggedInUser as LoggedInUser, project._id.toString() as string).finally(() => { store.cancelLoadingSpinnerCtx() })
//                     if(adjUser) { 
//                         store.setLoggedInUser(adjUser); 
//                     }
//                 }
//                 else {
//                     store.displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}. Please try again`);
//                     deleteAndBail = true
//                 }
                
//             }
//             else {
//                 store.displayQuickMessage(UIMessageType.ERROR_MSG, `Project ${isClonedProject ? 'cloning' : 'creation'} was not successful. Permissions context was not retrieved.`);
//                 deleteAndBail = true
//             }
//         }
//         else {
//             store.displayQuickMessage(UIMessageType.ERROR_MSG, `Project ${isClonedProject ? 'cloning' : 'creation'} was not successful. Permissions were not setup due to missing contextual information.`);
//             deleteAndBail = true
//         }        
        
//         if(deleteAndBail) {
//             deleteProject(project._id.toString() as string);
//             return false;
//         }
//     }

//     store.cancelLoadingSpinnerCtx();  //for good measures
//     return true;
// }



// async function handleCreationOfNewProjectPerms(loggedInUser: LoggedInUser, project: Project, permRoleArray: BasicProperty[]) : Promise<QuickStatus<any>> {
//     try {
//         let projectId = project._id?.toString() as string;
//         let awgName = getApproverWGName(projectId)
//         let awgInfo: any = await createApproverWG(awgName, loggedInUser)
//         // if(awgInfo) {
//         //     let roleIdToEntNameMapping = new Map<string, string>()
            
//         //     for (let role of permRoleArray) {
//         //         let entName = getEntitlementName(projectId, role.id)
//         //         roleIdToEntNameMapping.set(role.id, entName)
//         //     }

//         //     if(roleIdToEntNameMapping.size > 0) {
//         //         let entNameToIdMapping = await createEntitlements(Array.from(roleIdToEntNameMapping.values()), awgName, project.name)
//         //         if(entNameToIdMapping && entNameToIdMapping.size > 0) {
//         //             let permRolesProperty = {
//         //                 id: crypto.randomUUID(),
//         //                 name: ProjectPropertyCategoryEnum.PERMISSION_ROLES,
//         //                 displayName: ProjectPropertyCategoryEnum.PERMISSION_ROLES,
//         //                 category: ProjectPropertyCategoryEnum.PERMISSION_ROLES,
//         //                 editable: false,
//         //                 enabled: true,
//         //                 value: permRoleArray,
//         //             } as PropertyItem
                     
//         //             let updatedProj = await updateKeyProjectAspect(project?._id.toString() as string, ProjectPropertyCategoryEnum.PERMISSION_ROLES, permRolesProperty)
//         //             if(!updatedProj) {
//         //                 return { isSuccessful: false, message: `Failed to setup permissions for new project. Could not persist roles defined for project` }
//         //             }
//         //         }
//         //         else {
//         //             return { isSuccessful: false, message: `Failed to setup permissions for new project. An unknown error occured during call to entitlement management system` }
//         //         }
//         //     }
//         // }
//     }
//     catch(error: any) {
//         deleteProjectPermissionElements(loggedInUser, project, permRoleArray);
//         return { isSuccessful: false, message: `Failed to setup permissions for new project.  ${error.message}` }
//     }

//     return { isSuccessful: true, message: "" }
// }



// export async function updateProjectPermissions(loggedInUser: LoggedInUser, project: Project, usersPerRoleMapping: Map<string, User[]>) : Promise<QuickStatus<any>> {
//     let errRoles = new Array<string>();
//     try {
//         let projectId = project._id?.toString() as string;
        
//         for (let [roleId, users] of usersPerRoleMapping) {
//             let entName = getEntitlementName(projectId, roleId)
//             let wwidList = users.map(a => a.wwid) ?? []

//             let entObj : any = await getEntitlementInfoByName(entName)
//             if(entObj && entObj.id && entObj.displayName.toUpperCase() === entName.toUpperCase()){
//                 let entId = entObj.id as string
//                 let existingEntMembers = entObj?.members?.map((member: any) => member.jobTitle) ?? new Array<string>()
                
//                 updateEntitlementWithUser(entName, entId, existingEntMembers, wwidList, loggedInUser);
//             } 
//             else {
//                 errRoles.push(roleId)
//             }
//         }
//     }
//     catch(error: any) {
//         return { isSuccessful: false, message: `Failed to update all permission elements for project --- ${error.message}` }
//     }

//     if(errRoles.length > 0) {
//         return { isSuccessful: false, message: `Failed to update all permission elements for project. Role-Ids: ${errRoles.join(", ")}` }
//     }
//     else {
//         return { isSuccessful: true, message: "" }
//     }
// }



// export async function deleteProjectPermissionElements(loggedInUser: LoggedInUser, project: Project, userRoles: BasicProperty[]) : Promise<QuickStatus<any>> {
//     try {
//         let projectId = project._id?.toString() as string;
//         let awgName = getApproverWGName(projectId)
//         await deleteAWG(awgName);

//         let entNameSet = new Set<string>();
//         for (let role of userRoles) {
//             let entName = getEntitlementName(projectId, role.id)
//             entNameSet.add(entName);
//         }

//         if (entNameSet && entNameSet.size > 0) {
//             deleteEntitlements(Array.from(entNameSet));
//         }

//         //TODO: delete any permissions from graph call that pertains to this project
//     }
//     catch(error: any) {
//         return { isSuccessful: false, message: `Failed to completely delete permission elements for project.  ${error.message}` }
//     }

//     return { isSuccessful: true, message: "" }
// }



export function isUserInApproverWGForProject(loggedInUser: LoggedInUser|undefined, app: AppInfo) : boolean {
    if(app && app._id) {
        let awgName = getApproverWGName(app._id?.toString() as string)
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



export function isUserApprovedForCoreAction(loggedInUser: LoggedInUser, appInfo: AppInfo, actionType: PermissionActionEnum, considerAWG: boolean = true) : boolean {
    let isInvalidRootScene = false;
    let wtfMode = false;
    let roleIdList = new Array<string>();
    let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

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
            let isInAWG = isUserInApproverWGForProject(loggedInUser, appInfo);
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
                            let ent = getEntitlementName(appInfo._id?.toString() as string, roleId)
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
            ? `Please request access from App owner. Accepted role Ids: [ ${roleIdList.join(", ")} ]`
            : ` Please wait a few seconds and retry. System might not have fully retrieved the necessary permissions context data. If error continues, please request access from project owner. `
        store.displayQuickMessage(UIMessageType.ERROR_MSG, `NO PERMISSION !! - Hey ${loggedInUser?.givenName}, you did not have permission for the intended operation. ${addedMsg}`);
    }

    return false;
}



export async function isUserApprovedForUnlockAction(loggedInUser: LoggedInUser, appInfo: AppInfo) : Promise<boolean> {
    let wtfmode = false;
    let noEntityMode = false;
    let store = useCStore.getState(); //in this func, store is expected to always be defined (not null and not undefined)

    if(loggedInUser && loggedInUser.perms) {
        let isInAWG = isUserInApproverWGForProject(loggedInUser, appInfo);
        if(isInAWG) { 
            return true; 
        }

        let freshProj = await fetchAppDetails(store.selectedEnvironment, appInfo._id.toString() as string);
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
            + `Please contact owner to unlock the project. Project owner: [${appInfo.owner.email}] `);
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
        if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.LOCK_APPINFO) === false) { return; }
        isLockAction = true;
    }
    
    let actionMsg = isLockAction ? "Lock" : "Unlock";
    store.setLoadingSpinnerCtx({enabled: true, text: `${actionMsg}ing project. Please wait...`})
    let updatedProj = await manageAppInfoLock(store.selectedEnvironment, appInfoId, loggedInUser, isLockAction).finally(() => { store.cancelLoadingSpinnerCtx() })
    if(updatedProj && updatedProj._id) {
        store.displayQuickMessage(UIMessageType.WARN_MSG, `Project ${actionMsg} triggered by user: ${loggedInUser?.idsid}. Timestamp: ${(new Date()).toISOString()}`)
        return updatedProj;   
    }
    else {
        return undefined;
    }
}





// export function getHighestProjectPermRoleForLoggedInUser(project: Project, loggedInUser: LoggedInUser): BasicKVP {
//     let defValue = { key: "Unknown", value: "Unknown"} as BasicKVP
//     let projectId = project._id.toString() as string;

//     if(loggedInUser && loggedInUser.perms) {
//         let isInAWG = isUserInApproverWGForProject(loggedInUser, project);
//         if(isInAWG) { 
//             return { key: getApproverWGName(projectId), value: "Admin" } as BasicKVP; 
//         }

//         let permissionRoles : BasicProperty[] = project?.associatedProperties?.find(a => (
//             a.category === ProjectPropertyCategoryEnum.PERMISSION_ROLES && a.name === ProjectPropertyCategoryEnum.PERMISSION_ROLES))?.value
        
//         if(permissionRoles && permissionRoles.length > 0) {
//             let permData = permissionRoles.map(x => ({key: getEntitlementName(projectId, x.id), value: x.value} as BasicKVP))
//             let relevantItems = permData.filter(a => loggedInUser.perms.has(a.key)) ?? [];
//             if(relevantItems && relevantItems.length > 0) {
//                 let sorted = sort(relevantItems).asc(a => a.value)
//                 return sorted[0]
//             }
//         }
//     }   

//     return defValue
// }



// export function isUserApprovedForProjectRestrictorChangeAction(loggedInUser: LoggedInUser, project: Project) : boolean {
//     if(loggedInUser) {
//         if(project && project._id && project.owner) {
//             if(project.owner.email.toLowerCase().trim() === loggedInUser.email.toLowerCase().trim()
//             || project.owner.idsid.toLowerCase().trim() === loggedInUser.idsid.toLowerCase().trim()) {
//                 return true;
//             }
//         }
//     }

//     return false;
// }









//========================================================


