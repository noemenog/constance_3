import axios from "axios";
import { getDateAppendedName, getEnvContext, isNotNullOrEmptyOrWS, performBackendCall } from "./UtilFunctions";
import { C2CRow, ChangeContext, DefaultConstraints, G2GRelationContext, Interface, InterfaceTemplate, LayerGroupConstraints, LinkageInfo, Net, Netclass, PackageLayout, PowerInfo, Project, RuleArea, SnapshotContext, StackupGenInfo, StackupLayer } from "../DataModels/ServiceModels";
import { BasicKVP, BasicProperty, ConfigItem, EditorNotesData, NetMgmtCtx, NetSummary, PropertyItem, StatusIndicatorItem, StorageCollateralInfo } from "../DataModels/HelperModels";
import { LoggedInUser, QuickStatus } from "../DataModels/HelperModels";
import { AGS_APP_ACCESS_ENTITLEMENT, AGS_APP_IAPM_NUMBER, AGS_APP_NAME, AGS_APP_OWNER_WG, ConstraintTypesEnum, ErrorSeverityValue, MLCR_AUTH_AGS_URL, MLCR_AUTH_AGS_URL_V2, NETCLASSES_PROP_NAME, PowerInfoAspectEnum, ProjectDataDownloadContentTypeEnum } from "../DataModels/Constants";
import { FileWithPath } from "@mantine/dropzone";
import { Providers } from "@microsoft/mgt-react";
import { getApproverWGName } from "./Permissions";
import { DisplayError } from "../CommonComponents/ErrorDisplay";
import { sort } from "fast-sort";




export async function fetchInitConfigs(projectId: string = '') : Promise<ConfigItem[]>{
    let url = `${getEnvContext().mainAPIUrl}/init/get-configs?projectId=${projectId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function fetchHistoricalChanges(projectId: string, uniqueId: string, limit: number) : Promise<ChangeContext>{
    let url: string = `${getEnvContext().mainAPIUrl}/history/get-latest-versions?projectId=${projectId}&uniqueId=${uniqueId}&limit=${limit.toString()}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}


//#region project
//================================ PROJECT ============================================
export async function fetchProjectList() {
    let url: string = `${getEnvContext().mainAPIUrl}/project/get-projectList`;
    let resp = await performBackendCall(url, "GET", null);
    if(resp && resp.length > 0) {
        resp = sort<Project>(resp).by([
            { asc: p => p.owner.idsid?.toLowerCase() },
            { asc: p => p.org?.toUpperCase() },
            { asc: p => p.name?.toUpperCase() }
        ]);
    }
    return resp;
}

export async function fetchProjectDetails(projectId: string, assocPropFocus: boolean = false): Promise<Project> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/get-project?projectId=${projectId}&assocPropFocus=${assocPropFocus?.toString() ?? ''}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function addNewProject(project: Project): Promise<Project> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/create`;
    let resp = await performBackendCall(url, "POST", project);
    return resp;
}

export async function updateProject(project: Project): Promise<Project> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/update`;
    let resp = await performBackendCall(url, "POST", project);
    return resp;
}

export async function updateKeyProjectAspect(projectId: string, aspect: string, data: PropertyItem|LinkageInfo[]|BasicProperty[]): Promise<Project> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/update-key-aspect?projectId=${projectId}`;
    let kvp : BasicKVP = { key: aspect,  value: data }
    let resp = await performBackendCall(url, "POST", kvp);
    return resp;
}

export async function manageProjectLock(projectId: string, loggedInUser: LoggedInUser, isLockAction: boolean): Promise<Project> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/manage-lock?projectId=${projectId}&user=${loggedInUser?.email || ''}&isLockAction=${isLockAction?.toString() ?? ''}`;
    let resp = await performBackendCall(url, "POST", null);
    return resp;
}

export async function getProjectStatusIndicators(projectId: string): Promise<StatusIndicatorItem[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/get-status-indicators?projectId=${projectId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function cloneProject(existingProjectId: string, newName: string): Promise<Project> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/clone?projectId=${existingProjectId}&newName=${newName}`;
    let resp = await performBackendCall(url, "POST", null);
    return resp;
}

export async function deleteProject(projectId: string): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/delete?projectId=${projectId}`;
    let resp = await performBackendCall(url, "DELETE", projectId);
    return resp;
}

export async function downloadProjectData(project: Project, contentType: ProjectDataDownloadContentTypeEnum): Promise<any> {
    let projectId = project._id?.toString() as string
    let pName = project.name.toUpperCase().replaceAll(" ", "_")
    let fileName = "";
    if(contentType === ProjectDataDownloadContentTypeEnum.PDRD || contentType === ProjectDataDownloadContentTypeEnum.NETINFO) {
        fileName = getDateAppendedName(`${pName}__${contentType}_`) + ".xlsx";
    }
    else {
        fileName = getDateAppendedName(`${pName}__${contentType}_`) + ".zip";
    }
    let url: string = `${getEnvContext().mainAPIUrl}/project/download-data?projectId=${projectId}&contentType=${contentType}`;
    let resp = await performBackendCall(url, "GET", null, true, fileName);
    return resp;
}

export async function saveProjectNotes(projectId: string, data: EditorNotesData): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/save-editor-notes?projectId=${projectId}`;
    let resp = await performBackendCall(url, "POST", data);
    return resp;
}

export async function uploadEditorNotesFiles(file: File, projectId: string): Promise<any> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/upload-editor-file`;
    let keyIdentifier = crypto.randomUUID();
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId || '')
    formData.append('keyIdentifier', keyIdentifier)
    let resp = await performBackendCall(url, "POST", formData);
    return resp;
}

export async function deleteEditorNotesFile(projectId: string, fileURL: string): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/project/delete-editor-file?projectId=${projectId}`;
    let resp = await performBackendCall(url, "DELETE", {fileURL: fileURL});
    return resp;
}

//#endregion


//#region snapshots
//================================= SNAPSHOTS ============================================
export async function getSnapshots(projectId: string, excludeConponentEntries: boolean): Promise<SnapshotContext[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/snapshot/get-snapshots?projectId=${projectId}&excludeConponentEntries=${excludeConponentEntries.toString()}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function createSnapshots(snapshotContext: SnapshotContext): Promise<SnapshotContext[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/snapshot/create-snapshot`;
    let resp = await performBackendCall(url, "POST", snapshotContext);
    return resp;
}

export async function restoreSnapshots(snapshotContext: SnapshotContext): Promise<SnapshotContext[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/snapshot/restore-snapshot`;
    let resp = await performBackendCall(url, "POST", snapshotContext);
    return resp;
}

export async function deleteSnapshots(snapshotContextList: Array<SnapshotContext>): Promise<SnapshotContext[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/snapshot/delete-snapshot`;
    let resp = await performBackendCall(url, "DELETE", snapshotContextList);
    return resp;
}
//#endregion


//#region packageLayout
//================================= PACKAGE LAYOUT ============================================
export async function getPkgLayout(projectId: string): Promise<PackageLayout> {
    let url: string = `${getEnvContext().mainAPIUrl}/layout/get-pkglayout?projectId=${projectId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp.at(0);
}

export async function getPkgLayoutCollection(): Promise<PackageLayout[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/layout/get-pkglayout`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function createStackup(stackupInfo: StackupGenInfo, previewMode: boolean): Promise<PackageLayout> {
    let url: string = `${getEnvContext().mainAPIUrl}/layout/create-stackup?projectId=${stackupInfo.projectId}&previewMode=${previewMode.toString()}`;
    let resp = await performBackendCall(url, "POST", stackupInfo);
    return resp;
}


export async function updateStackup(pkgLayout: PackageLayout): Promise<PackageLayout> {
    let url: string = `${getEnvContext().mainAPIUrl}/layout/update-stackup`;
    let resp = await performBackendCall(url, "POST", pkgLayout);
    return resp;
}

export async function updatelayerGroupSets(pkgLayout: PackageLayout): Promise<PackageLayout> {
    let url: string = `${getEnvContext().mainAPIUrl}/layout/update-layergroups`;
    let resp = await performBackendCall(url, "POST", pkgLayout);
    return resp;
}

export async function updateRuleAreas(pkgLayout: PackageLayout): Promise<PackageLayout> {
    let url: string = `${getEnvContext().mainAPIUrl}/layout/update-ruleareas`;
    let resp = await performBackendCall(url, "POST", pkgLayout);
    return resp;
}
//#endregion


//#region constraints
//=================================== CONSTRAINTS ====================================
export async function fetchConstraints(projectId: string, lastId: string|null, limit: number|null, 
    ruleAreaId: string|null, layergroupId: string|null, interfaceId: string|null, filterElementId: string|null,
    filterElementName: string|null, constraintType: ConstraintTypesEnum|null, excludeProps: boolean) : Promise<LayerGroupConstraints[]>{
        
        let urlPrefix = `${getEnvContext().mainAPIUrl}/constraints/get-constraints?projectId=${projectId}&lastId=${lastId ?? ''}`
        let params_1 = `&limit=${limit?.toString() ?? ''}&ruleAreaId=${ruleAreaId ?? ''}&layergroupId=${layergroupId ?? ''}`
        let params_2 = `&interfaceId=${interfaceId ?? ''}&filterElementId=${filterElementId ?? ''}`
        let params_3 = `&filterElementName=${filterElementName ?? ''}&constraintType=${constraintType ?? ''}&excludeProps=${excludeProps.toString() ?? ''}`;

        let url = `${urlPrefix}${params_1}${params_2}${params_3}`
        let resp = await performBackendCall(url, "GET", null);

    return resp;
}

export async function getConstraintsCount(projectId: string, 
    ruleAreaId: string|null, layergroupId: string|null, interfaceId: string|null, filterElementId: string|null,
    constraintType: ConstraintTypesEnum|null ) : Promise<number>{
        
        let urlPrefix = `${getEnvContext().mainAPIUrl}/constraints/get-constraint-count?projectId=${projectId}`
        let params_1 = `&ruleAreaId=${ruleAreaId ?? ''}&layergroupId=${layergroupId ?? ''}`
        let params_2 = `&interfaceId=${interfaceId ?? ''}&filterElementId=${filterElementId ?? ''}&constraintType=${constraintType ?? ''}`;

        let url = `${urlPrefix}${params_1}${params_2}`
        let resp = await performBackendCall(url, "GET", null);

    return resp;
}

export async function getDefaultConstraints(projectId: string, dataSetName: string|null, excludeConstraintEntries: boolean, performProlif: boolean): Promise<DefaultConstraints> {
    let url = `${getEnvContext().mainAPIUrl}/constraints/get-defaults?projectId=${projectId}&excludeConstraintEntries=${excludeConstraintEntries.toString()}&performProlif=${performProlif.toString()}`;
    if(dataSetName && dataSetName.length > 0) {
        url = url + `&dataSetName=${dataSetName}`
    }
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function uploadDefaultConstraints(file: File, projectId: string, nameIdentifier: string, adjustedRuleAreaXMods: Map<string, string>|null, previewMode: boolean): Promise<DefaultConstraints> {
    let url: string = `${getEnvContext().mainAPIUrl}/constraints/upload-defaults`;
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)
    formData.append('nameIdentifier', nameIdentifier)
    formData.append('previewMode', previewMode.toString())
    if(adjustedRuleAreaXMods && adjustedRuleAreaXMods.size > 0) {
        let xmodAdjustKVPs = new Array<BasicKVP>();
        for(let [raid, newXmodName] of adjustedRuleAreaXMods) {
            xmodAdjustKVPs.push({key: raid, value: newXmodName } as BasicKVP);
        }
        formData.append('xmodAdjustments', JSON.stringify(xmodAdjustKVPs))
    }

    let resp = await performBackendCall(url, "POST", formData);
    return resp;
}

export async function createEditableDefaultConstraints(data: DefaultConstraints): Promise<DefaultConstraints> {
    let url: string = `${getEnvContext().mainAPIUrl}/constraints/create-editable-defaults`;
    let resp = await performBackendCall(url, "POST", data);
    return resp;
}

export async function saveDefaultConstraints(data: DefaultConstraints): Promise<DefaultConstraints> {
    let url: string = `${getEnvContext().mainAPIUrl}/constraints/save-editable-defaults`;
    let resp = await performBackendCall(url, "POST", data);
    return resp;
}

export async function forceOverwriteWithDefaultConstraints(projectId: string): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/constraints/clear-custom-values?projectId=${projectId}`;
    let resp = await performBackendCall(url, "POST", undefined);
    return resp;
}

export async function updateRoutingConstraints(lgcList: LayerGroupConstraints[]) : Promise<LayerGroupConstraints[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/constraints/update`;
    let resp = await performBackendCall(url, "POST", lgcList);
    return resp;
}

export async function changeLGSetForConstraintElement(projectId: string, elementId: string, newLGSetId: string): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/constraints/switch-lgset?projectId=${projectId}&elementId=${elementId}&newLGSetId=${newLGSetId}`;
    let resp = await performBackendCall(url, "POST", undefined);
    return resp;
}

export async function copyOverConstraints(projectId: string, sourceRuleArea: RuleArea, 
    destinationRuleArea: RuleArea, constraintType: ConstraintTypesEnum, interfaceId: string|null) : Promise<boolean>{
    let url: string = `${getEnvContext().mainAPIUrl}/constraints/copyover-constraints?projectId=${projectId}&srcRuleAreaId=${sourceRuleArea.id}`
                            + `&destRuleAreaId=${destinationRuleArea.id}&constraintType=${constraintType ?? ''}&interfaceId=${interfaceId ?? ''}`;
    let resp = await performBackendCall(url, "POST", undefined);
    return resp;
}
//#endregion


//#region net
//=================================== NET ====================================
export async function uploadNetList(project: Project, file: File, forceCommit: boolean): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/nets/upload-netlist`;

    let map = new Map<string, Map<string, string>>();
    let innerMap = new Map<string, string>([
        ["projectId", project._id?.toString() || ""],
        ["forceCommit", forceCommit.toString() || ""],
    ])
    map.set(file.name, innerMap);

    let resp = await postChunkedFileList(url, [file], map)

    // const formData = new FormData()
    // formData.append('file', file)
    // formData.append('projectId', project._id?.toString() || "")
    // formData.append('forceCommit', forceCommit.toString() || "")
    // let resp = await performBackendCall(url, "POST", formData);
    return resp;
}

export async function replaceNetList(project: Project, file: File, mappingFiles: File[]): Promise<any> {
    let url: string = `${getEnvContext().mainAPIUrl}/nets/replace-netlist`;
    let pName = project.name.toUpperCase().replaceAll(" ", "_")
    let netListAdjustFileName = getDateAppendedName(`${pName}__NetAdjust`) + ".zip";

    //============
    let map = new Map<string, Map<string, string>>();
    let innerMap = new Map<string, string>([
        ["projectId", project._id?.toString() || ""],
        ["netListFileName", file?.name || ""],
    ]);

    let allFiles = ([file]).concat(mappingFiles.filter(a => a.name.length > 0));
    allFiles.forEach(x => {
        map.set(x.name, innerMap);
    })

    let resp = await postChunkedFileList(url, allFiles, map, true, netListAdjustFileName)

    // const formData = new FormData()
    // formData.append('files', file) //do not specify name here
    // formData.append('netListFileName', file?.name || "")  //Important!
    // formData.append('projectId', project._id?.toString() as string || "")
    // for(let i = 0; i < mappingFiles.length; i++) {
    //     formData.append('files', mappingFiles[i]) //do not specify name here
    // }
    // let resp = await performBackendCall(url, "POST", formData, true, netListAdjustFileName);

    return resp;
}

export async function overrideNetPropertiesWithFileUpload(project: Project, file: File, aspect: string): Promise<any> {
    let url: string = `${getEnvContext().mainAPIUrl}/nets/upload-net-properties`;
    
    let map = new Map<string, Map<string, string>>();
    let innerMap = new Map<string, string>([
        ["projectId", project._id?.toString() || ""],
        ["aspect", aspect],
    ])
    map.set(file.name, innerMap);

    let resp = await postChunkedFileList(url, [file], map)

    
    // const formData = new FormData()
    // formData.append('projectId', project._id?.toString() as string || "")
    // formData.append('aspect', aspect)
    // formData.append('file', file) //do not specify name here
    // let resp = await performBackendCall(url, "POST", formData);
    return resp;
}

export async function fetchNets(projectId: string, lastId: string|null, limit: number|null, 
    filterNetName: string|null, filterInterfaceId: string|null, filterNetclassId: string|null, nonClassifiedNetsOnly: boolean, 
    excludeProps: boolean, diffPairedOnly: boolean, nonDiffNetsOnly: boolean) : Promise<Net[]>{
        let urlPrefix: string = `${getEnvContext().mainAPIUrl}/nets/get-nets?projectId=${projectId}&lastId=${lastId ?? ''}`
        let params_1 = `&limit=${limit?.toString() ?? ''}&filterNetName=${filterNetName ?? ''}&filterInterfaceId=${filterInterfaceId ?? ''}`
        let params_2 = `&filterNetclassId=${filterNetclassId ?? ''}&nonClassifiedNetsOnly=${nonClassifiedNetsOnly.toString() ?? ''}`
        let params_3 = `&excludeProps=${excludeProps.toString() ?? ''}&diffPairedOnly=${diffPairedOnly.toString() ?? ''}&nonDiffNetsOnly=${nonDiffNetsOnly.toString() ?? ''}`;
        let url = `${urlPrefix}${params_1}${params_2}${params_3}`
        let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function updateNets(netUpdateContext: NetMgmtCtx): Promise<NetMgmtCtx> {
    let url: string = `${getEnvContext().mainAPIUrl}/nets/update-nets`;
    let resp = await performBackendCall(url, "POST", netUpdateContext);
    return resp;
}

export async function runAutomapper(projectId: string, elementId: string): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/nets/automap?projectId=${projectId}&elementId=${elementId}`;
    let resp = await performBackendCall(url, "POST", undefined);
    return resp;
}

export async function clearAllNetPropertyValues(projectId: string, ): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/nets/clear-prop-values?projectId=${projectId}`;
    let resp = await performBackendCall(url, "POST", undefined);
    return resp;
}
export async function getNetSummaryInfo(projectId: string, excludeNetclassData: boolean): Promise<NetSummary> {
    let url: string = `${getEnvContext().mainAPIUrl}/nets/get-summary-info?projectId=${projectId}&excludeNetclassData=${excludeNetclassData.toString()}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}
//#endregion


//#region netclass
//=================================== NETCLASS ====================================
export async function fetchNetclassList(projectId: string) : Promise<Netclass[]>{
    let url: string = `${getEnvContext().mainAPIUrl}/netclass/get-netclass-list?projectId=${projectId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function updateNetclasses(netclasses: Netclass[]) : Promise<Netclass[]>{
    let url: string = `${getEnvContext().mainAPIUrl}/netclass/update-netclass-list`;
    let resp = await performBackendCall(url, "POST", netclasses);
    return resp;
}

export async function fetchClassRelationLayout(projectId: string, lastId: string|null, limit: number|null, 
    ruleAreaId: string|null, interfaceId: string|null, netclassId: string|null, netclassName: string|null, performSortSlots: boolean) : Promise<C2CRow[]> {
        
    let urlPrefix = `${getEnvContext().mainAPIUrl}/netclass/get-class-relation-layout?projectId=${projectId}&lastId=${lastId ?? ''}&limit=${limit?.toString() ?? ''}`
    let params_1 = `&ruleAreaId=${ruleAreaId ?? ''}&interfaceId=${interfaceId ?? ''}&netclassId=${netclassId ?? ''}&netclassName=${netclassName ?? ''}&performSortSlots=${performSortSlots.toString()}`;

    let url = `${urlPrefix}${params_1}`
    let resp = await performBackendCall(url, "GET", null);

    return resp;
}

export async function updateClassRelationLayout(c2cRowList: C2CRow[]) : Promise<C2CRow[]>{
    let url: string = `${getEnvContext().mainAPIUrl}/netclass/update-class-relation-layout`;
    let resp = await performBackendCall(url, "POST", c2cRowList);
    return resp;
}

export async function getRelationNameElementsForIface(projectId: string, interfaceId: string, ruleAreaId: string|null) : Promise<BasicProperty>{
    let raPart = (ruleAreaId && ruleAreaId.length > 0) ? `&ruleAreaId=${ruleAreaId}` : '';
    let url: string = `${getEnvContext().mainAPIUrl}/netclass/get-class-relation-names-for-Interface?projectId=${projectId}&interfaceId=${interfaceId}${raPart}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function clearClassRelationsForRuleArea(projectId: string, ruleArea: RuleArea, deleteAllRelationBrands: boolean) : Promise<boolean>{
    let url: string = `${getEnvContext().mainAPIUrl}/netclass/clear-class-relations?projectId=${projectId}&ruleAreaId=${ruleArea.id}&deleteAllRelationBrands=${deleteAllRelationBrands.toString()}`;
    let resp = await performBackendCall(url, "POST", undefined);
    return resp;
}

export async function fetchG2GContextList(projectId: string, interfaceId?: string) : Promise<G2GRelationContext[]>{
    let url: string = `${getEnvContext().mainAPIUrl}/netclass/get-g2g-list?projectId=${projectId}&interfaceId=${interfaceId || ""}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function processG2GUpdates(projectId: string, g2gRelationCtxList: G2GRelationContext[]) : Promise<boolean>{
    let url: string = `${getEnvContext().mainAPIUrl}/netclass/process-g2g-updates?projectId=${projectId}`;
    let resp = await performBackendCall(url, "POST", g2gRelationCtxList);
    return resp;
}
//#endregion


//#region interface
//=================================== INTERFACE ====================================
export async function fetchInterfaceList(projectId: string) : Promise<Interface[]>{
    let url: string = `${getEnvContext().mainAPIUrl}/interface/get-interfaceList?projectId=${projectId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function fetchInterfaceDetails(interfaceId: string): Promise<Interface> {
    let url: string = `${getEnvContext().mainAPIUrl}/interface/get-interface?interfaceId=${interfaceId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function getInterfaceTemplates(projectId: string, org: string): Promise<InterfaceTemplate[]> {
    let url = `${getEnvContext().mainAPIUrl}/interface/get-templates?projectId=${projectId}&org=${org}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function createInterface(iface: Interface): Promise<Interface> {
    let url: string = `${getEnvContext().mainAPIUrl}/interface/create`;
    let resp = await performBackendCall(url, "POST", iface);
    return resp;
}

export async function deleteInterface(iface: Interface): Promise<boolean> {
    let interfaceId = iface?._id?.toString() as string
    let url: string = `${getEnvContext().mainAPIUrl}/interface/delete?projectId=${iface.projectId}&interfaceId=${interfaceId}`;
    let resp = await performBackendCall(url, "DELETE", { projectId: iface.projectId });
    return resp;
}

export async function updateInterface(iface: Interface, excludeNetclassUpdates: boolean): Promise<Interface> {
    let ifaceItem = {...iface}
    if(excludeNetclassUpdates === true) {
        ifaceItem.contextProperties = ifaceItem.contextProperties.filter(a => a.name !== NETCLASSES_PROP_NAME) 
    }
    let url: string = `${getEnvContext().mainAPIUrl}/interface/update`;
    let resp = await performBackendCall(url, "POST", ifaceItem);
    return resp;
}

export async function saveAsTemplate(iface: Interface): Promise<InterfaceTemplate> {
    let url: string = `${getEnvContext().mainAPIUrl}/interface/save-as-template`;
    let resp = await performBackendCall(url, "POST", iface);
    return resp;
}

export async function getInterfaceCollaterals(projectId: string, interfaceId: string): Promise<StorageCollateralInfo[]> {
    let url = `${getEnvContext().mainAPIUrl}/interface/get-collaterals?projectId=${projectId}&interfaceId=${interfaceId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function uploadInterfaceCollaterals(projectId: string, interfaceId: string, files: FileWithPath[]|File[]): Promise<StorageCollateralInfo[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/interface/upload-collaterals`;
    const formData = new FormData()
    if (files && files.length > 0) {
        files.forEach((fi: File) => { formData.append('files', fi) });  // Use the same key 'files' for each file
    }
    formData.append('projectId', projectId || "")
    formData.append('interfaceId', interfaceId || "")
    let resp = await performBackendCall(url, "POST", formData);
    return resp;
}

export async function deleteInterfaceCollaterals(ifaceCollaterals: Array<StorageCollateralInfo>): Promise<StorageCollateralInfo[]> {
    let url: string = `${getEnvContext().mainAPIUrl}/interface/delete-collaterals`;
    let resp = await performBackendCall(url, "DELETE", ifaceCollaterals);
    return resp;
}

export async function downloadInterfaceCollaterals(projectId: string, interfaceId: string, collateral: StorageCollateralInfo) {
    let url = `${getEnvContext().mainAPIUrl}/interface/download-collaterals?projectId=${projectId}&interfaceId=${interfaceId}&fileName=${collateral.name}`;
    let resp = await performBackendCall(url, "GET", null, true, collateral.name);
    return resp;
}

export async function saveInterfaceNotes(projectId: string, interfaceId: string, data: EditorNotesData): Promise<boolean> {
    let url: string = `${getEnvContext().mainAPIUrl}/interface/save-editor-notes?projectId=${projectId}&interfaceId=${interfaceId}`;
    let resp = await performBackendCall(url, "POST", data);
    return resp;
}
//#endregion


//#region powerinfo
//=================================== POWER INFO ====================================
export async function fetchPowerInfo(projectId: string): Promise<PowerInfo> {
    let url: string = `${getEnvContext().mainAPIUrl}/power/get-powerinfo?projectId=${projectId}`;
    let resp = await performBackendCall(url, "GET", null);
    return resp;
}

export async function replacePowerInfo(powerInfo: PowerInfo, replaceRails: boolean, replaceComponents: boolean): Promise<PowerInfo> {   
    let url: string = `${getEnvContext().mainAPIUrl}/power/save-powerinfo`
    if(replaceRails === true && replaceComponents === true) {
        url = url + `?replaceAll=true`;
    }
    else {
        url = url + `?replaceRails=${replaceRails.toString()}&replaceComponents=${replaceComponents.toString()}`;
    }
    let resp = await performBackendCall(url, "POST", powerInfo);
    return resp;
}

export async function uploadPowerInfo(file: File, projectId: string, powerInfoAspect: PowerInfoAspectEnum): Promise<PowerInfo> {
    let url: string = `${getEnvContext().mainAPIUrl}/power/upload-data`;
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)
    formData.append('aspect', powerInfoAspect.toString())
    let resp = await performBackendCall(url, "POST", formData);
    return resp;
}
//#endregion




//============================================================================================================
//=========================================== SEND FILE CHUNKED ==============================================
//============================================================================================================

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

    let url = MLCR_AUTH_AGS_URL + "/apwg/create?appName=" + AGS_APP_NAME

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
    let url = MLCR_AUTH_AGS_URL + "/ent/create?appName=" + AGS_APP_NAME

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
    let baseUrl = MLCR_AUTH_AGS_URL + "/ent/update?appName=" + AGS_APP_NAME
    
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

    let url = MLCR_AUTH_AGS_URL + "/ent/delete?appName=" + AGS_APP_NAME

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
    let permEnv = getEnvContext().permContext.toUpperCase()
    
    let apiUrlPrefix = `/users/${loggedInUser.id}/memberOf/microsoft.graph.group?$count=true&$orderby=displayName&`
    let apiUrlFilterSection = `$filter=startswith(displayName,'${AGS_APP_NAME}_${permEnv}_') or startswith(displayName,'${AGS_APP_ACCESS_ENTITLEMENT}')&$select=displayName,id`
    let apiUrl = apiUrlPrefix + apiUrlFilterSection;
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


export async function getPermissionAWGItemsForCurrentUser(loggedInUser: LoggedInUser, projectId: string) : Promise<QuickStatus<string>> {
    let awgName = ''
    try {
        if(projectId && projectId.trim().length > 1){
            awgName = getApproverWGName(projectId)
            if(awgName) {
                let awgUsers: any [] = []
                
                let url = MLCR_AUTH_AGS_URL + "/apwg/get?fullName=" + awgName + "&type=Approver&appName=" + AGS_APP_NAME
                
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
        let errMsg = `Failed to get approver work group members for current project: ${projectId}. --- ${error.message}`
        console.error(errMsg)
        DisplayError("500", ErrorSeverityValue.ERROR, errMsg);
    }

    return {isSuccessful: false, message: awgName } as QuickStatus<string>
}



export async function getSpecialAccessGuardKeyInfo() : Promise<QuickStatus<Map<string, string>>> {
    
    let res = {isSuccessful: false, message: "", data: new Map<string, string>() } as QuickStatus<Map<string, string>>;
    
    try {
        // let url = MLCR_AUTH_AGS_URL + "/v2/ent/getIFSList"
        // let config: any = {
        //     method: "post",
        //     maxBodyLength: Infinity,
        //     url: url,
        //     headers: {
        //     "Content-Type": "application/json",
        //     Accept: "application/json",
        //     }
        // };

        // await axios.request(config).then(resp => {
        //     if(resp && resp.data && resp.data.payload && resp.data.payload.length > 0) {
        //         let map = new Map<string, string>();
        //         (resp.data.payload as Array<any>).forEach(x => {
        //             map.set(x.id, x.displayName)
        //         });
        //         res = {isSuccessful: true, message: "", data: map } as QuickStatus<Map<string, string>>
        //     }
        //     else {
        //         throw new Error("Invalid or empty response. No data retrieved")
        //     }
        // })
        // .catch((err) => {
        //     throw new Error(err.message)
        // })
    }
    catch(error: any) {
        let errMsg = `Failed to retrieve special access entitlement list --- ${error.message}`
        console.error(errMsg)
        res.message = errMsg;
    }

    return res
}

//============================================================================================================
//============================================================================================================
























// export async function replaceProjectProperty(projectId: string, category: string, prop: PropertyItem): Promise<Project> {
//     let url: string = `${getEnvContext().mainAPIUrl}/project/replace-project-prop-category?projectId=${projectId}&category=${category}`;
//     let resp = await performBackendCall(url, "POST", prop);
//     return resp;
// }


//==================================================================================
//==================================================================================


// export async function postFileChunked(url: string, file: FileWithPath, additionalKVPs: Map<string, string>): Promise<any> {
//     const CHUNK_SIZE = 1024 * 1024; // 1MB
//     const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
//     const fileKey = crypto.randomUUID();
//     for (let i = 0; i < totalChunks; i++) {
//         const start = i * CHUNK_SIZE;
//         const end = Math.min(start + CHUNK_SIZE, file.size);
//         const chunk = file.slice(start, end);

//         const formData = new FormData();
//         formData.append('chunk', chunk);
//         formData.append('chunkNumber', i.toString());
//         formData.append('totalChunks', totalChunks.toString());
//         formData.append("originalname", file.name);
//         formData.append("fileKey", fileKey);
//         for(let [key, value] of additionalKVPs) { formData.append(key, value) }
        
//         let resp = await performBackendCall(url, "POST_CHUNK", formData);
        
//         if(i === (totalChunks - 1)) { 
//             return resp; 
//         }
//         // await axios.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data'} });
//     }

//     return null;
// }




//==================================================================================
//==================================================================================

// export async function getConstraintProperties(projectId: string, org: string): Promise<PropertyItem[]> {
//     let url = `${getEnvContext().mainAPIUrl}/init/get-constraint-config-properties?projectId=${projectId}&org=${org}`;
//     let resp = await performBackendCall(url, "GET", null);
//     return resp;
// }




// export async function replaceProjectNetclasses(projectId: string, projectNetclasses: Netclass[]) : Promise<Netclass[]>{
//     let url: string = `${getEnvContext().mainAPIUrl}/netclass/replace-project-netclasses?projectId=${projectId}`;
//     let resp = await performBackendCall(url, "POST", projectNetclasses);
//     return resp;
// }




// import HttpRequestMock from 'http-request-mock'; //TODO: Remember to remove this
// import { MOCK_CONSTRAINT_SETTINGS_CONFIG, MOCK_INIT_CONFIG } from "../DataModels/DUMMYConfigs"; //TODO: Remember to remove this



// //TODO: Remember to remove this
// //WARNING / DANGER : mock Data injected here
// const mocker = HttpRequestMock.setup();
// mocker.get(url, MOCK_CONSTRAINT_SETTINGS_CONFIG)
// //============ END MOCK DATA ====================
    




//======================================================================================
// export async function uploadNetList(file: File, projectId: string, hasExistingNets: boolean, mappingFile: File, forceCommit: boolean): Promise<BasicProperty> {
//     let url: string = `${getEnvURLPrefix().mainAPIUrl}/netset/upload-netlist`;
//     let expectZip = ((!mappingFile || !(mappingFile.name) || (mappingFile.name.length == 0)) && hasExistingNets) ? true : false
//     let netListAdjustFileName = expectZip ? getDateAppendedName("NetList_Adjust") : "";
    
//     const data = new FormData()
//     data.append('files', file) //do not specify name here
//     data.append('files', mappingFile) //do not specify name here
//     data.append('netListFileName', file?.name || "")  //Important!
//     data.append('projectId', projectId || "")
//     data.append('forceCommit', forceCommit.toString() || "")
//     let resp = await performBackendCall(url, "POST", data, expectZip, netListAdjustFileName);
//     return resp;
// }



// export async function uploadFileInChunks(context: SpiderStore, file: FileWithPath, url: string) {
//     if (!file) {
//       context.DisplayQuickMessage(UIMessageType.ERROR_MSG, "No file provided for upload.");
//       return;
//     }

//     const chunkSize = 10 * 1024 * 1024; // 10MB (adjust based on your requirements)
//     const totalChunks = Math.ceil(file.size / chunkSize);
//     const chunkProgress = 100 / totalChunks;
//     let chunkNumber = 0;
//     let start = 0;
//     let end = 0;

//     const uploadNextChunk = async () => {
//       if (end <= file.size) {
//         const chunk = file.slice(start, end);
//         const formData = new FormData();
//         formData.append("file", chunk);
//         formData.append("chunkNumber", chunkNumber.toString());
//         formData.append("totalChunks", totalChunks.toString());
//         formData.append("originalName", file.name);

//         fetch(url, { method: "POST", body: formData })
//           .then((response) => response.json())
//           .then((data) => {
//             // const temp = `Chunk ${
//             //   chunkNumber + 1
//             // }/${totalChunks} uploaded successfully`;
//             // setStatus(temp);
//             // setProgress(Number((chunkNumber + 1) * chunkProgress));
//             // console.log(temp);
//             chunkNumber++;
//             start = end;
//             end = start + chunkSize;
//             uploadNextChunk();
//           })
//           .catch((error) => {
//             context.DisplayQuickMessage(UIMessageType.ERROR_MSG, `Error uploading chunk: ${error}`);
//           });
//       } 
//       else {
//         // setProgress(100);
//         // setFile(null);
//         context.DisplayQuickMessage(UIMessageType.SUCCESS_MSG, `File upload completed.`);
//       }
//     };

//     uploadNextChunk();
//   };






  
    // let url2: string = `${getEnvURLPrefix().mainAPIUrl}/netset/zip`;
    // let resp = await performBackendCall(url2, "POST", data);
    // let xxx = resp.data



    // axios.post(url2, data, {
    //     responseType: 'blob',
    //     headers: {
    //         'Content-Type': 'multipart/form-data'
    //     }
    // })
    // .then(res => {
    //     const url = window.URL.createObjectURL(new Blob([res.data]));
    //     const link = document.createElement('a');
    //     link.href = url;
    //     link.setAttribute('download', 'some_file_name.zip');
    //     document.body.appendChild(link);
    //     link.click();
    //     link.remove();
    // })


    // resp.data.blob().then(function(blobber: any) {
    //     saveAs(blobber, "fake-zipper.zip");
    //     console.log("APD data downloaded: ", "fake-zipper.zip");
    // });

    // console.log("adfadasdasd")
    //  let cccx: BasicProperty = {
    //      name: "STATUS",
    //      value: true
    //  }
    //  return cccx;
