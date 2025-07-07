import { Filter, ObjectId } from "mongodb";
import { AppConfigConstants, CLONE_SOURCE_ID, DBCollectionTypeEnum, DataMappingTypeEnum, InterfaceInitTypeEnum, ConstraintChangeActionEnum, PendingProcessActionTypeEnum, C2C_ROW_ALLCOLUMN_SLOT_NAME, LINKAGE_ALL_RULEAREA_INDICATOR } from "../Models/Constants";
import { NET_RETRIEVAL_BATCH_SIZE, ProjectPropertyCategoryEnum, NamingContentTypeEnum, LGC_RETRIEVAL_BATCH_SIZE, ConstraintTypesEnum } from "../Models/Constants";
import { C2C_ROW_RETRIEVAL_BATCH_SIZE, DB_COLL_TYPE_CLONE_ORDER, CONF_PERMISSION_ROLES, GENERAL_NOTE_FILES_FOLDER_NAME, ConstraintPropertyCategoryEnum } from "../Models/Constants";
import { C2CRow, DefaultConstraints, G2GRelationContext, Interface, LayerGroupConstraints, LinkageInfo, Net, NetListImportDetail, Netclass, PackageLayout, PowerInfo, Project, RuleArea, ServiceModel, SnapshotContext } from "../Models/ServiceModels";
import { BaseRepository } from "../Repository/BaseRepository";
import { checkDuplicatesIgnoreCase, getEnumValuesAsArray, getPropertiesFromConfigs, isNumber, rfdcCopy, verifyNaming } from "./UtilFunctions";
import { BaseUserInfo, BasicProperty, ConfigItem, NCStats, PropertyItem, QuickStatus, StatusIndicatorItem, StorageCollateralInfo, User } from "../Models/HelperModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { getConstraintSettingsForOrg, getGenConfigs } from "./ConfigLogic";
import { randomUUID } from "crypto";
import { deleteSnapshots } from "./SnapShotLogic";
import { assessLinkageRelatedLGCs, performConstraintsAssessmentForClrRelationAction } from "./ConstraintsMgmtLogic";
import { pushDefaultConstraints } from "./DefaultConstraintsLogic";
import { discardCollaterals, getCollaterals } from "./StorageFilesLogic";
import { runAutoDiffPairingLogic } from "./NetListLogic";
import { cleanupG2GContextOnDataDeletion } from "./InterfaceLogic";
import { deepEqual } from 'fast-equals';
import { sort } from "fast-sort";



export async function createProject(project: Project, user: User) : Promise<Project>{
    let baseProjRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    let basePkgLayoutRepo = new BaseRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)

    //check required fields
    if(!project.name || project.name.trim().length < 3 || project.name.toLowerCase() === "undefined"){
        throw new Error(`Please use at least three characters for project name`)
    }
    if(!project.org || project.org.trim().length === 0 || project.org.toLowerCase() === "undefined"){
        throw new Error(`No valid Org specified for project`)
    } 
    
    //check valid org
    let genConfigs : ConfigItem[] = await getGenConfigs(null, project.org, false);
    if(genConfigs && genConfigs.length > 0) {
        let orgsConf : any = genConfigs.find(a => a.configName === AppConfigConstants.CONFIGITEM__Org_Settings)?.configValue ?? null
        if(orgsConf && orgsConf.length > 0) {
            let orgs = orgsConf.map((a: any) => a.name.toLowerCase())
            if((orgs as Array<string>).includes(project.org.toLowerCase()) == false) {
                throw new Error(`Org specified for new project is invalid`)
            }
        }
    }

    //check format of project name
    verifyNaming([project.name], NamingContentTypeEnum.PROJECT)

    //check if projectName already exists
    //NOTE: if a project exists in the system and is set to "disabled", it still count in name checking - no duplicates!
    let filter = {name : new RegExp('^' + project.name + '$', 'i')}
    const projects: Project[] = (await baseProjRepo.GetWithFilter(filter)) as Project[];
    if (projects && projects.length > 0) {
        throw new Error(`Cannot add new project '${project.name}'. 
            ${(projects && projects.length > 0 && projects[0].enabled === false) ? "A disabled project" : "A project"} with the same name already exists in the system`);
    }

    project.createdOn = new Date();
    project.lastUpdatedOn = new Date();
    project.lockedBy = null;
    project.org = project.org.trim()
    project.name = project.name.trim()

    //define packageLayout
    let pkg : PackageLayout = {
        projectId: "",
        snapshotSourceId: "",
        lastUpdatedOn: new Date(),
        contextProperties: [],
        ruleAreas: [],
        layerGroupSets: [],
        stackupLayers: [],
        stackupGenInfo: null
    }

    //add default rule areas for packagelayout
    if(genConfigs && genConfigs.length > 0) {
        let raConf : any = genConfigs.filter(a => a.configName === AppConfigConstants.CONFIGITEM__Rule_Area_Settings)?.at(0)?.configValue ?? null
        if(raConf && raConf.defaultRuleAreas && raConf.defaultRuleAreas.length > 0) {
            for(let x = 0; x < raConf.defaultRuleAreas.length; x++){
                let raName = raConf.defaultRuleAreas[x].ruleAreaName ?? ""
                let xmodName = raConf.defaultRuleAreas[x].xmodName ?? ""

                if(raName.length > 0 && xmodName.length > 0) {
                    let ruleArea : RuleArea = {
                        id: crypto.randomUUID(),
                        ruleAreaName: raName,
                        xmodName: xmodName,
                        isActive: true,
                        defaultConstraintId: "",
                        visibilityContext: [],
                        tags: []
                    }
                    pkg.ruleAreas.push(ruleArea);
                }
            }
        }
    }

    //set constraint settings for the project
    let allConstrProps: PropertyItem[] = await getConstraintSettingsForOrg(null, project.org, true);
    ([ConstraintPropertyCategoryEnum.Net, ConstraintPropertyCategoryEnum.Physical, ConstraintPropertyCategoryEnum.Clearance]).forEach(type => {
        let relevProps = allConstrProps?.filter(a =>  a.category && a.category.toLowerCase().trim() === type.toLowerCase())
        let nameSet = new Set<string>(relevProps.map(a => a.name.toLowerCase().trim()))
        if(nameSet.size !== relevProps.length){
            throw new Error(`Could not complete project creation process. ${type} constraint properties must have unique names. Check config mgmt system.`)
        }
        let displayNameSet = new Set<string>(relevProps.map(a => a.displayName.toLowerCase().trim()))
        if(displayNameSet.size !== relevProps.length){
            throw new Error(`Could not complete project creation process. ${type} constraint properties must have unique display names. Please check config mgmt system.`)
        }
    })
    project.constraintSettings = allConstrProps;

    //add default properties to project
    let propArr = getPropertiesFromConfigs(genConfigs, AppConfigConstants.CONFIGITEM__Default_Project_Properties, true)
    project.profileProperties = project.profileProperties.concat(propArr)
    
    //check duplicate assoc prop names
    let propNames = project.profileProperties.map(a => a.name)
    let dupNamesRes = checkDuplicatesIgnoreCase(propNames);
    if (dupNamesRes === false) {
        throw new Error(`Duplicate property names are not allowed for new project. Please check configured default project properties`)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = project.profileProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property names are not allowed for new project. Please check configured default project properties`)
    }

    //ensure all properties have a uuid
    for(let i = 0; i < project.profileProperties.length; i++){
        if(project.profileProperties[i].id && project.profileProperties[i].id.trim().length === 0) {
            project.profileProperties[i].id = crypto.randomUUID()
        }
    }

    if(project.profileProperties && project.profileProperties.length > 0) {
        project.profileProperties = project.profileProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
    }

    //Important - used for setting up permissions on newly created project
    let permRolesConf : any = genConfigs.find(a => a.configName === AppConfigConstants.CONFIGITEM__Permission_Roles)?.configValue ?? null
    let permConfRolesValueAsProperty : BasicProperty = { id: crypto.randomUUID(), name: CONF_PERMISSION_ROLES, value: null }
    if(permRolesConf && permRolesConf.length > 0) {
        const BASIC_NAME_VALIDATION_REGEX: RegExp = /^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/;
        permRolesConf = permRolesConf.filter((a: any) => 
            a.id 
            && a.id.trim().length > 0 
            && a.displayName 
            && a.displayName.trim().length > 0 
            && (BASIC_NAME_VALIDATION_REGEX.test(a.id) === true)
        ); 
        permConfRolesValueAsProperty.value = permRolesConf;
    }
    
    //remove any incoming ID before creating project in DB
    delete project['_id'];
    project.createdBy = user.email;
    
    let newProj : Project = await baseProjRepo.CreateOne(project);
    if(newProj && newProj._id){
        newProj.projectId = (newProj._id as ObjectId).toString()  //Important!
        await baseProjRepo.ReplaceOne(newProj);
        
        //create package layout in DB
        delete pkg['_id'];
        pkg.projectId = newProj.projectId
        let newPkg : PackageLayout = await basePkgLayoutRepo.CreateOne(pkg);
        if(!newPkg){
            throw new Error(`Failed to create pkgLayout entity for new project '${project.name}'`)
        }

        //Important - used for setting up permissions on newly created project
        newProj.contextProperties = newProj.contextProperties.filter(a => a.name !== CONF_PERMISSION_ROLES)
        newProj.contextProperties.push(permConfRolesValueAsProperty)

        return newProj;
    }
    else {
        throw new Error(`An unspecified error occured while creating new project`)
    }
}


export async function updateProject(project: Project) : Promise<Project>{
    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    
    //check required fields
    if(project.name.length < 3){
        throw new Error(`Please use at least three characters for project name`)
    } 
      
    if(project.org.length <= 0){
        throw new Error(`No valid Org specified for project`)
    } 
    
    if((!project._id) || project._id.toString().length <= 0){
        throw new Error(`No valid projectId specified`)
    } 
    if(project.owner.email.length <= 0){
        throw new Error(`No valid project owner email found`)
    }
    if(project.owner.idsid.length <= 0){
        throw new Error(`No valid project owner id found`)
    }

    //get any projects with same name
    let existingProject = await projRepo.GetWithId(project._id?.toString())
    if(!existingProject) {
        throw new Error(`Project update cannot proceed. A project with same ID was not found in the system.`);
    }

    //ensure that user cannot change the project name to one that already exists
    let projection = { name: 1 }
    let allExistingProjItems = await projRepo.GetByFilterAndProjection({}, projection)
    for(let snExProj of allExistingProjItems) {
        if(snExProj._id?.toString() !== project._id.toString()) {
            if(snExProj.name.toLowerCase().trim() === project.name.toLowerCase().trim()) {
                throw new Error(`A project with name '${project.name}' already exists.`)
            }
        }
    }

    //check format of project name
    verifyNaming([project.name], NamingContentTypeEnum.PROJECT)

    //make sure we cannot lock an already locked project
    if(existingProject.lockedBy && existingProject.lockedBy.length > 0 && project.lockedBy && project.lockedBy.length > 0) {
        if(existingProject.lockedBy.toLowerCase().trim() !== project.lockedBy.toLowerCase().trim()) {
            throw new Error(`Project with name '${project.name}' is already locked by [${existingProject.lockedBy}] `)
        }
    }

    //------------------

    //check duplicate profile prop names
    let profPropNames = project.profileProperties.map(a => a.name)
    let profDupRes = checkDuplicatesIgnoreCase(profPropNames);
    if (profDupRes === false) {
        throw new Error(`Duplicate confiogurable-property names are not allowed for project.`)
    }

    //check duplicate profile prop display names
    let profPropDisplayNames = project.profileProperties.map(a => a.displayName)
    let profDupDispNameRes = checkDuplicatesIgnoreCase(profPropDisplayNames.filter(a => a && a.trim().length > 0));
    if (profDupDispNameRes === false) {
        throw new Error(`Duplicate onfiogurable-property display-names are not allowed for project.`)
    }

    //ensure all profile properties have a uuid
    for(let i = 0; i < project.profileProperties.length; i++){
        if((!project.profileProperties[i].id) || (project.profileProperties[i].id.trim().length === 0)) {
            project.profileProperties[i].id = crypto.randomUUID()
        }
    }

    //sort all profile props
    if(project.profileProperties && project.profileProperties.length > 0) {
        project.profileProperties = project.profileProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
    }

    //-------------

    //check duplicate assoc prop names
    let propNames = project.associatedProperties.map(a => a.name)
    let dupRes = checkDuplicatesIgnoreCase(propNames);
    if (dupRes === false) {
        throw new Error(`Duplicate property names are not allowed for project.`)
    }

    //check duplicate assoc prop display names
    let propDisplayNames = project.associatedProperties.map(a => a.displayName)
    let dupDispNameRes = checkDuplicatesIgnoreCase(propDisplayNames.filter(a => a && a.trim().length > 0));
    if (dupDispNameRes === false) {
        throw new Error(`Duplicate property display-names are not allowed for project.`)
    }

    //ensure all assoc properties have a uuid
    for(let i = 0; i < project.associatedProperties.length; i++){
        if((!project.associatedProperties[i].id) || (project.associatedProperties[i].id.trim().length === 0)) {
            project.associatedProperties[i].id = crypto.randomUUID()
        }
    }

    //sort all assoc props
    if(project.associatedProperties && project.associatedProperties.length > 0) {
        project.associatedProperties = project.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
    }

    //------------------

    //ensure that this function is not used for updating linkages or CRBs
    if(deepEqual(existingProject.physicalLinkages, project.physicalLinkages) === false) {
        throw new Error(`Project update cannot proceed. Incoming project is expected to have same physical linkages. Please use alternative method provided specifically for updating linkages`)
    }
    if(deepEqual(existingProject.clearanceLinkages, project.clearanceLinkages) === false) {
        throw new Error(`Project update cannot proceed. Incoming project is expected to have same clearance linkages. Please use alternative method provided specifically for updating linkages`)
    }
    if(deepEqual(existingProject.clearanceRelationBrands, project.clearanceRelationBrands) === false) {
        throw new Error(`Project update cannot proceed. Incoming project is expected to have same CRBs. Please use alternative method provided specifically for updating relations`)
    }

    project.lastUpdatedOn = new Date();
    project.org = project.org.trim()
    project.name = project.name.trim()
    project.projectId = project._id.toString()
    
    let result = await projRepo.ReplaceOne(project);
    if(result) {
        let postCreationUpdatedProj = await projRepo.GetWithId(project.projectId)
        return postCreationUpdatedProj;
    }
    else {
        throw new Error(`Failed to update project '${project.name}'. An unspecified error occured while performing update operation`)
    }
}


export async function updateProjectPropertyCategoryInFull(projectId: string, propertyCategory: ProjectPropertyCategoryEnum, incomingProp: PropertyItem) : Promise<Project> {
    if((!projectId) || projectId.toString().length <= 0){ throw new Error(`No valid projectId specified`) } 
    let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
    let project = await projRepo.GetWithId(projectId);

    if(incomingProp.category.toLowerCase() !== propertyCategory.toLowerCase()) {
        throw new Error(`Update action cannot proceed. All supplied properties must have same 'category' value.`)
    }

    let others = project.associatedProperties.filter(a => a.category !== propertyCategory)
    let otherNames = others.map(a => a.name)
    let dupRes = checkDuplicatesIgnoreCase(otherNames.concat([incomingProp.name]));
    if (dupRes === false) {
        throw new Error(`Update action will result in duplicate property names. Duplicate names are not allowed for project.`)
    }

    let newProps = others.concat([incomingProp]) ?? []

    for(let i = 0; i < newProps.length; i++){
        if((!newProps[i].id) || (newProps[i].id.trim().length === 0)) {
            newProps[i].id = crypto.randomUUID()
        }
    }

    newProps = newProps.sort((a, b) => (a.category < b.category) ? -1 : 1);

    project.associatedProperties = newProps;
    let result = await projRepo.ReplaceOne(project);
    if(result) {
        if (propertyCategory === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA) {
            try {
                runAutoDiffPairingLogic(project)
            }
            catch(error: any){
                console.error(error); //DiffPair and Automap logic are best-effort processes... 
            }
        }

        let updatedProject = await projRepo.GetWithId(projectId)
        return updatedProject;
    }
    else {
        throw new Error(`Failed to update properties for project '${project.name}'. An unspecified error occured while performing update operation`)
    }   
}


export async function updateProjectClearanceRelationBrands(projectId: string, incomingClrRelationBrands: BasicProperty[]) : Promise<Project> {
    if (incomingClrRelationBrands) {
        if((!projectId) || projectId.toString().length <= 0){ throw new Error(`No valid projectId specified`) } 
        
        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let project = await projRepo.GetWithId(projectId);

        let existingClrRelationBrands = rfdcCopy<BasicProperty[]>(project.clearanceRelationBrands) as BasicProperty[];
        
        if(incomingClrRelationBrands.length > 0) {
            let incomingNames = incomingClrRelationBrands.map(a => a.name)
            let dupRes = checkDuplicatesIgnoreCase(incomingNames);
            if (dupRes === false) {
                throw new Error(`Duplicate names are not allowed for project's clearance relation names.`)
            }
        }

        project.clearanceRelationBrands = incomingClrRelationBrands ?? [];
        project.clearanceRelationBrands = sort(project.clearanceRelationBrands).asc(x => x.name.toUpperCase());
        let result = await projRepo.ReplaceOne(project);
        if(result) {
            
            //handle deleted CLr Relations
            let deleted = existingClrRelationBrands.filter(a => incomingClrRelationBrands.every(x => x.id !== a.id)) ?? []
            if(deleted.length > 0) {
                await performConstraintsAssessmentForClrRelationAction(projectId, ConstraintChangeActionEnum.CLEARANCE_RELATION_REMOVAL, deleted)
                await processLinkageDeletion(projectId, [], [], new Set<string>(deleted.map(a => a.id)), false); //assesment set to false because we run it below...
                await cleanupG2GContextOnDataDeletion(projectId, deleted, [], []);
            }

            //handle added Clr Relations. NOTE: //IMPORTANT: DO NOT add half-ass relations especially those where LGSet is not specified!
            let added = incomingClrRelationBrands.filter(a => existingClrRelationBrands.every(x => x.id !== a.id)) ?? []
            added = added.filter(a => a.id && a.id.length > 0 && a.name && a.name.length > 0 && a.value && a.value.length > 0) ?? []
            if(added.length > 0) {
                await performConstraintsAssessmentForClrRelationAction(projectId, ConstraintChangeActionEnum.CLEARANCE_RELATION_ADDITION, added)
            }

            assessLinkageRelatedLGCs(projectId, null, true); //Important to run this! - no need to wait
            pushDefaultConstraints(projectId) //Important!
            
            let finalUpdatedProject = await projRepo.GetWithId(projectId)
            return finalUpdatedProject;
        }
        else {
            throw new Error(`Failed to update clearance relation brands for project '${project.name}'. An unspecified error occured while performing update operation`)
        }   
    }
    else {
        throw new Error(`Failed to update clearance relation brands for current project. Input clearance ralations data is invalid`)
    }   
}


export async function verifyProjectLinkageContext(incomingPhysicalLinkages: LinkageInfo[], existingProject: Project, incomingClearanceLinkages: LinkageInfo[]) {
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let pkg = await pkgRepo.GetOneByProjectID(existingProject._id?.toString() as string)

    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION);
    let nClassProjection = { _id: 1, layerGroupSetId: 1, name: 1 };
    let netclassList = await netclassRepo.GetAllByProjectIDAndProjection(existingProject._id?.toString() as string, null, nClassProjection) ?? [];

    let exisPhyLinkIds = new Set(existingProject.physicalLinkages.map(x => x.id))
    let exisClrLinkIds = new Set(existingProject.clearanceLinkages.map(s => s.id))
    
    let newPhysLinkages : LinkageInfo[] = incomingPhysicalLinkages.filter(x => (exisPhyLinkIds.has(x.id) === false)) ?? [];
    let newClrLinkages : LinkageInfo[] = incomingClearanceLinkages.filter(p => (exisClrLinkIds.has(p.id) === false)) ?? [];
    let concatLinkages: LinkageInfo[] =  (incomingPhysicalLinkages ?? []).concat(incomingClearanceLinkages ?? [])

    let projCRBs = existingProject.clearanceRelationBrands;

    let prohibNames = new Set<string>(
        [existingProject.name]
            .concat(projCRBs.map(a => a.name))
            .concat(netclassList.map(a => a.name))
            .map(a => a.toUpperCase())
    );
    
    let possibleRuleAreaIndicators = new Set<string>(pkg.ruleAreas.map(a => a.id).concat([LINKAGE_ALL_RULEAREA_INDICATOR]) ?? []);

    for(let g = 0; g < concatLinkages.length; g++) {
        let lnk = concatLinkages[g];
        if(!lnk.id || lnk.id.trim().length === 0) {
            throw new Error(`All linkage elements must be valid and non-empty ID.`)
        }
        if (!lnk.name || lnk.name.trim().length === 0) {
            throw new Error(`All linkage names must be valid and non-empty.`);
        }
        if (!lnk.value || lnk.value.length < 2) {
            throw new Error(`Linkage '${lnk.name}' must have at least two link elements.`);
        }
        if (!lnk.sourceElementId || lnk.sourceElementId.length === 0) {
            throw new Error(`Linkage '${lnk.name}' cannot have empty data source element.`);
        }
        if (lnk.value.includes(lnk.sourceElementId) === false) {
            throw new Error(`Linkage '${lnk.name}' is invalid. The specified data source must be part of the linkage.`);
        }
        if (!lnk.ruleAreaId || lnk.ruleAreaId.trim().length === 0) {
            throw new Error(`Linkage '${lnk.name}' must have more than one link elements.`);
        }
        if(!pkg.ruleAreas || (possibleRuleAreaIndicators.has(lnk.ruleAreaId) === false)) {
            throw new Error(`Linkage '${lnk.name}' is invalid. Associated rule area is not valid.`)
        }
        if((lnk.confineToRuleArea === false) && (lnk.ruleAreaId === LINKAGE_ALL_RULEAREA_INDICATOR)) {
            throw new Error(`Linkage '${lnk.name}' is invalid. If rule-area confinement is disabled, source rule area must be a specific rule area known to the project.`)
        }
        if (prohibNames.has(lnk.name.trim().toUpperCase())) {
            throw new Error(`Prohibited linkage names found. Linkage entity cannot have same name as project, netclass, interface or channel`);
        }
    }

    for (let i = 0; i < newPhysLinkages.length; i++) {
        let physLnk = newPhysLinkages[i]
        let foundNetclasses = netclassList.filter(a => physLnk.value.includes(a._id.toString().trim()));
        if (!foundNetclasses || (foundNetclasses.length !== physLnk.value.length)) {
            throw new Error(`Cannot update project. Invalid link element found for physical linkage '${physLnk.name}'`);
        }
        if (!foundNetclasses[0].layerGroupSetId || (foundNetclasses[0].layerGroupSetId.trim().length === 0) || foundNetclasses.some(x => x.layerGroupSetId !== foundNetclasses[0].layerGroupSetId)) {
            throw new Error(`Cannot update project. Invalid linkage detected. All linked elements for physical linkage '${physLnk.name}' must have same layer group set.`);
        }
    }

    if(incomingPhysicalLinkages.length > 0) {
        for (let n = 0; n < netclassList.length; n++) {
            let nc = netclassList[n];
            let placesWhereNetclassIsFound = incomingPhysicalLinkages.filter(x => x.value.includes(nc._id.toString()));
            if (placesWhereNetclassIsFound && placesWhereNetclassIsFound.length > 1) {
                throw new Error(`Cannot update project. Invalid linkage data detected. For physial linkages, a netclass elements cannot be involved in more than one linkages`);
            }
        }
    }

    for (let t = 0; t < newClrLinkages.length; t++) {
        let clrLnk = newClrLinkages[t]
        let foundClrRels: BasicProperty[] = existingProject.clearanceRelationBrands.filter(x => clrLnk.value.includes(x.id)) ?? [];
        if (!foundClrRels || (foundClrRels.length !== clrLnk.value.length)) {
            throw new Error(`Cannot update project. Invalid link element found for clearance linkage '${clrLnk.name}'`);
        }
        if (!foundClrRels[0].value || (foundClrRels[0].value.trim().length === 0) || foundClrRels.some(x => x.value !== foundClrRels[0].value)) {
            throw new Error(`Cannot update project. Invalid linkage detected. All linked elements for clearance linkage '${clrLnk.name}' must have same layer group set.`);
        }
    }

    if(incomingClearanceLinkages.length > 0) {
        for (let k = 0; k < projCRBs.length; k++) {
            let clrRel = projCRBs[k]; 
            let placesWhereClrRelIsFound = incomingClearanceLinkages.filter(x => x.value.includes(clrRel.id));
            if (placesWhereClrRelIsFound && placesWhereClrRelIsFound.length > 1) {
                throw new Error(`Cannot update project. Invalid linkage data detected. For clearance linkages, a clearance-relation brand name cannot be involved in more than one linkages`);
            }
        }
    }

    let incomingAddedLinkages = (newPhysLinkages ?? []).concat(newClrLinkages ?? []);
    let existingLinkages = existingProject.physicalLinkages.concat(existingProject.clearanceLinkages);
    let incomingUpdateLinkages = concatLinkages.filter(z => existingLinkages.some(x => x.id === z.id));
    let toBeNames = (incomingAddedLinkages.concat(incomingUpdateLinkages)).map(a => a.name);
    if(toBeNames.length> 0) {
        verifyNaming(toBeNames, NamingContentTypeEnum.LINKAGE);
        let dupRes = checkDuplicatesIgnoreCase(toBeNames);
        if (dupRes === false) {
            throw new Error(`Cannot proceed. Project update operation will result in duplicate linkage names.`);
        }
    }
}



export async function processLinkageDeletion(projectId: string, inputDeletionLinkageIDs: string[], 
    deletedRuleAreas: RuleArea[], deletedLinkageValueElementIDs: Set<string>, runAssessmentLogic: boolean = true) {
    
    let projectRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    let project = await projectRepo.GetWithId(projectId);
    let linkagesToDelete = new Array<string>();

    if (project) {
        if(deletedLinkageValueElementIDs && deletedLinkageValueElementIDs.size > 0) {
            //handle clearance linkage value elements
            if (project.clearanceLinkages && project.clearanceLinkages.length > 0) {
                for (let i = 0; i < project.clearanceLinkages.length; i++) {
                    for (let clrBrandId of project.clearanceLinkages[i].value) {
                        if (deletedLinkageValueElementIDs.has(clrBrandId)) {
                            project.clearanceLinkages[i].value = project.clearanceLinkages[i].value.filter(x => x !== clrBrandId);
                            if (project.clearanceLinkages[i].value.length < 2) {
                                linkagesToDelete.push(project.clearanceLinkages[i].id);
                            }
                        }
                    }
                }
            }

            //handle physical linkages value elements
            if (project.physicalLinkages && project.physicalLinkages.length > 0) {
                for (let i = 0; i < project.physicalLinkages.length; i++) {
                    for (let ncid of project.physicalLinkages[i].value) {
                        if (deletedLinkageValueElementIDs.has(ncid)) {
                            project.physicalLinkages[i].value = project.physicalLinkages[i].value.filter(x => x !== ncid);
                            if (project.physicalLinkages[i].value.length < 2) {
                                linkagesToDelete.push(project.physicalLinkages[i].id);
                            }
                        }
                    }
                }
            }
        }
        
        //handle rule area deletion scenario
        if(deletedRuleAreas && deletedRuleAreas.length > 0) {
            let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
		    let pkg = await pkgRepo.GetOneByProjectID(projectId)
        
            let delRaids = deletedRuleAreas.map(a => a.id);
            let aliveRuleArea = pkg.ruleAreas.find(a => delRaids.includes(a.id) === false)
            if(!aliveRuleArea){
                throw new Error("Cannot process linkage deletion as a result of rule area deletion. A rule area must always be associated to non-rule-area-confined linkage")
            }
            
            for(let x = 0; x < project.physicalLinkages.length; x++){
                if(delRaids.includes(project.physicalLinkages[x].ruleAreaId)) {
                    if(project.physicalLinkages[x].confineToRuleArea === false) {
                        //if linkage is to be proliferated to all rule area, then maybe we just assign another used rule area and move on.
                        project.physicalLinkages[x].ruleAreaId = aliveRuleArea.id;
                    }
                    else {
                        //If linkage is NOT to be proliferated to all rule areas, and the linkage mentions the deleted rule area, then we delete the linkage totally
                        linkagesToDelete.push(project.physicalLinkages[x].id);
                    }
                }
            }

            for(let x = 0; x < project.clearanceLinkages.length; x++){
                if(delRaids.includes(project.clearanceLinkages[x].ruleAreaId)) {
                    if(project.clearanceLinkages[x].confineToRuleArea === false) {
                        project.clearanceLinkages[x].ruleAreaId = aliveRuleArea.id;
                    }
                    else {
                        linkagesToDelete.push(project.clearanceLinkages[x].id);
                    }
                }
            }
        }
        
        //handle whole linkage entities
        let delLnkConcat = (inputDeletionLinkageIDs ?? []).concat(linkagesToDelete ?? [])
        project.clearanceLinkages = project.clearanceLinkages.filter(a => (delLnkConcat.includes(a.id) === false))
        project.physicalLinkages = project.physicalLinkages.filter(a => (delLnkConcat.includes(a.id) === false))

        //commit it
        projectRepo.ReplaceOne(project);

        if(runAssessmentLogic) {
            assessLinkageRelatedLGCs(projectId, null, true); //do not wait on this...
        }
    }
}



export async function deleteProject(projectId: string) : Promise<boolean>{
    let updateRes: boolean = false;
    let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    
    let project = await projRepo.GetWithId(projectId);

    if (project && project._id) {
        project.enabled = false;
        project.lastUpdatedOn = new Date();
        project.name = project.name.trim() + "__" + project._id?.toString()
        
        updateRes = await projRepo.ReplaceOne(project);
        if(updateRes === false) {
            throw new Error(`Unknown error occured while trying to disable project that was intended for deletion. Project: '${project.name.trim()}'`)
        }

        try {
            processWideRangingDeletions()  //NOTE: This is happening here!
        }
        catch (error: any) {
            throw new Error(`Project '${project.name.trim()}' was successfully disabled and therefore marked for deletion. `
                + `However, an error occured during wide-ranging deletions! --- ${error.message}`)
        }
    }
    
    return updateRes;
}


async function processWideRangingDeletions() : Promise<void> {
    try {
        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        
        let foundProjectsDueForDeletion: string[] = [];

        const _MS_PER_DAY = 1000 * 60 * 60 * 24;
        const today = new Date();
        const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    
        let maxDaysForDeletion : number = 30  //hardcoded default setting
            
        let genConfigs = await getGenConfigs(null, null, true)
        if(genConfigs && genConfigs.length > 0) {
            let maxDays : any = genConfigs.filter(a => a.configName === AppConfigConstants.CONFIGITEM__Max_Days_For_Deletion)?.at(0)?.configValue ?? ""
            if(isNumber(maxDays)) {
                maxDaysForDeletion = parseInt(maxDays.toString(), 10)
            }
        }

        let filter = { enabled: false }
        let projectionSpec = { name: 1, enabled: 1, createdOn: 1, lastUpdatedOn: 1, lockedBy: 1 }
        let possibleDelProjects = await projRepo.GetByFilterAndProjection(filter, projectionSpec)
        
        if(possibleDelProjects && possibleDelProjects.length > 0) {
            for(let disabledProj of possibleDelProjects) {
                const dt: Date = new Date(disabledProj.lastUpdatedOn);
                const utc = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
                let dif = Math.floor((utcToday - utc) / _MS_PER_DAY);
                if ((dif === 0 && maxDaysForDeletion === 0) || (dif > maxDaysForDeletion)) {
                    foundProjectsDueForDeletion.push(disabledProj._id.toString());
                }
            }
        }

        if(foundProjectsDueForDeletion.length > 0) {
            let allSystemCollectionNames = getEnumValuesAsArray(DBCollectionTypeEnum)
            for(let foundProjectId of foundProjectsDueForDeletion) {
                let snapshotRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
                let snapshotContextList = await snapshotRepo.GetAllByProjectID(foundProjectId) 
                if(snapshotContextList && snapshotContextList.length > 0) {
                    await deleteSnapshots(snapshotContextList)
                }

                for (let collectionName of allSystemCollectionNames) {
                    let repo = new ServiceModelRepository(collectionName as DBCollectionTypeEnum)
                    let delRes = await repo.DeleteManyByProjectId(foundProjectId, null, true);
                }

                //delete project-level collaterals
                try {
                    await getCollaterals(foundProjectId, GENERAL_NOTE_FILES_FOLDER_NAME).then((collats: StorageCollateralInfo[]) => {
                        if(collats && collats.length > 0) {
                            discardCollaterals(collats);
                        }
                    });
                }
                catch(error: any) { /* do nothing for now. this is best effort execution  */ }
            }
        }
    }
    catch(error: any) {
        throw error;
    }
}


export async function determineProjectStatus(projectId: string) : Promise<StatusIndicatorItem[]> {
    let returnSet = new Array<StatusIndicatorItem>();
    let genConfigs = await getGenConfigs(null, null, true)
    let progressConfValues : any[] = []
    if(genConfigs && genConfigs.length > 0) {
        progressConfValues = genConfigs.find(a => a.configName === AppConfigConstants.CONFIGITEM__Progress_Status_Display_Settings)?.configValue ?? ""
    }

    if(progressConfValues && progressConfValues.length > 0) {
        progressConfValues = progressConfValues.sort((a, b) => a.index < b.index ? -1 : 1); 

        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let project = await projRepo.GetWithId(projectId);
        
        let netListFileProp = project.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.NET_FILE_IMPORT && a.name === ProjectPropertyCategoryEnum.NET_FILE_IMPORT))
        
        let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
		let pkg = await pkgRepo.GetOneByProjectID(projectId)
		
        let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
        let lgcListProjection = { lastUpdatedOn: 1 }
        let lgcList = await lgcRepo.GetAllByProjectIDAndProjection(projectId, null, lgcListProjection) ?? []
        let lgcListSort = lgcList?.sort((a, b) => a.lastUpdatedOn < b.lastUpdatedOn ? -1 : 1); 

        let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
        let defConSetProjection = { lastUpdatedOn: 1 }
        let defConSet = await defConRepo.GetAllByProjectIDAndProjection(projectId, null, defConSetProjection) ?? []
        let defConSetSort = defConSet?.sort((a, b) => a.lastUpdatedOn < b.lastUpdatedOn ? -1 : 1); 
    
        let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
        let ifaceProjection = { name: 1, lastUpdatedOn: 1 }
        let ifaces = await ifaceRepo.GetAllByProjectIDAndProjection(projectId, null, ifaceProjection) ?? []
        let ifacesSort = ifaces?.sort((a, b) => a.lastUpdatedOn < b.lastUpdatedOn ? -1 : 1); 
        
        let snapRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)
        let snapContextsProjection = { lastUpdatedOn: 1 }
        let snapContexts = await snapRepo.GetAllByProjectIDAndProjection(projectId, null, snapContextsProjection) ?? []
        let snapContextsSort = snapContexts?.sort((a, b) => a.lastUpdatedOn < b.lastUpdatedOn ? -1 : 1); 
    
        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
        let filter = { netclassMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>
        let netsProjection = { name: 1, lastUpdatedOn: 1 }
        let netList = await netRepo.PaginationGetLastByProjectIDAndProjection(projectId, [filter], 1000, netsProjection)
        let netListSort = netList?.sort((a, b) => a.lastUpdatedOn < b.lastUpdatedOn ? -1 : 1); 

        let piRepo = new ServiceModelRepository<PowerInfo>(DBCollectionTypeEnum.POWER_INFO_COLLECTION)
        let powerInfo = await piRepo.GetOneByProjectID(projectId)

        for (let item of progressConfValues) {
            if(item.index && item.title && item.indicatorKey && item.indicatorKey.trim().length > 0) {
                let sii : StatusIndicatorItem = {
                    id: crypto.randomUUID(),
                    index: item.index || '',
                    title: item.title || '',
                    description: item.description || '',
                    lastUpdatedOn: new Date(),
                    isOk: false,
                    isProcessing: false,
                    message: ""
                };

                let defaultDateTime = project.createdOn ?? new Date();

                if(item.indicatorKey.toUpperCase() === "CREATE_STACKUP") {
                    sii.isOk = (pkg.stackupLayers.length > 0) ? true : false
                    sii.lastUpdatedOn = pkg.lastUpdatedOn
                }
                else if (item.indicatorKey.toUpperCase() === "IMPORT_DEFAULT_CONSTRAINTS") {
                    sii.isOk = (defConSet && defConSet.length > 0) ? true : false
                    sii.lastUpdatedOn = (defConSetSort && defConSetSort.length > 0) 
                        ? defConSetSort.at(defConSetSort.length - 1).lastUpdatedOn 
                        : defaultDateTime
                }
                else if (item.indicatorKey.toUpperCase() === "SETUP_RULE_AREAS") {
                    sii.isOk = (pkg.ruleAreas.length > 0) ? true : false
                    sii.lastUpdatedOn = pkg.lastUpdatedOn
                }
                else if (item.indicatorKey.toUpperCase() === "IMPORT_NETLIST") {
                    sii.isOk = (netListFileProp && netListFileProp.value && netListFileProp.value.length > 0) ? true : false
                    sii.lastUpdatedOn = project.lastUpdatedOn ?? defaultDateTime
                }
                else if (item.indicatorKey.toUpperCase() === "DEFINE_INTERFACES") {
                    sii.isOk = (ifacesSort && ifacesSort.length > 0) ? true : false
                    sii.lastUpdatedOn = (ifacesSort && ifacesSort.length > 0) 
                        ? (ifacesSort.at(ifacesSort.length - 1)?.lastUpdatedOn ?? defaultDateTime) 
                        : defaultDateTime
                }
                else if (item.indicatorKey.toUpperCase() === "MAP_NETS_TO_NETCLASSES") {
                    sii.isOk = (netListSort && netListSort.length > 0) ? true : false
                    sii.lastUpdatedOn = (netListSort && netListSort.length > 0) 
                        ? (netListSort.at(netListSort.length - 1)?.lastUpdatedOn ?? defaultDateTime) 
                        : defaultDateTime
                }
                else if (item.indicatorKey.toUpperCase() === "SET_ROUTING_RULES") {
                    sii.isOk = (lgcListSort && lgcListSort.length > 0) ? true : false
                    sii.lastUpdatedOn = (lgcListSort && lgcListSort.length > 0) 
                        ? (lgcListSort.at(lgcListSort.length - 1)?.lastUpdatedOn ?? defaultDateTime) 
                        : defaultDateTime
                }
                else if (item.indicatorKey.toUpperCase() === "SETUP_C2C_LAYOUT") {
                    sii.isOk = (project.clearanceRelationBrands && project.clearanceRelationBrands.length > 0) ? true : false
                    sii.lastUpdatedOn = project.lastUpdatedOn ?? defaultDateTime
                }
                else if (item.indicatorKey.toUpperCase() === "SETUP_POWER_INFO") {
                    sii.isOk = (powerInfo && ((powerInfo.rails && powerInfo.rails.length > 0) || (powerInfo.components && powerInfo.components.length > 0))) ? true : false
                    sii.lastUpdatedOn = powerInfo?.lastUpdatedOn ?? defaultDateTime  //WARNING: powerInfo might not exist for project - could be undefined
                }
                else if (item.indicatorKey.toUpperCase() === "SNAPSHOT") {
                    sii.isOk = (snapContextsSort && snapContextsSort.length > 0) ? true : false
                    sii.lastUpdatedOn = (snapContextsSort && snapContextsSort.length > 0) 
                        ? (snapContextsSort.at(snapContextsSort.length - 1)?.lastUpdatedOn ?? defaultDateTime) 
                        : defaultDateTime
                }
                else if (item.indicatorKey.toUpperCase() === "CHECK_VALIDATIONS") {
                    sii.isOk = false
                    sii.lastUpdatedOn = defaultDateTime
                }
                
                returnSet.push(sii);
            }
        }
    }

    return returnSet
}


export async function handleProjectPendingProcessIndicator(projectId: string, indicatorType: PendingProcessActionTypeEnum, isError: boolean, isProc: boolean, message?: string) : Promise<Project|null>{
    if(projectId && projectId.length > 0 && indicatorType) {
        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let project = await projRepo.GetWithId(projectId);
        
        let pendingItemsProp = project.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.PENDING_PROCESSES && a.name === ProjectPropertyCategoryEnum.PENDING_PROCESSES))

        if(!pendingItemsProp) {
            pendingItemsProp = {
                id: crypto.randomUUID(),
                name: ProjectPropertyCategoryEnum.PENDING_PROCESSES,
                displayName : ProjectPropertyCategoryEnum.PENDING_PROCESSES,
                category: ProjectPropertyCategoryEnum.PENDING_PROCESSES,
                editable: false,
                enabled: true,
                value: new Array<StatusIndicatorItem>(),
            } as PropertyItem
        }
    
        let sii : StatusIndicatorItem = pendingItemsProp.value.find((x: StatusIndicatorItem) => x.title === indicatorType);
        if(!sii) {
            sii = {
                id: crypto.randomUUID(),
                index: pendingItemsProp.value?.length ?? 1,
                title: indicatorType,
                description: indicatorType,
                lastUpdatedOn: new Date(),
                isOk: true,
                isProcessing: false,
                message: ""
            };
        }


        if(isError === true) {
            sii.lastUpdatedOn = new Date(),
            sii.isOk = false;
            sii.isProcessing = false;
            sii.message = (message && message.trim().length > 0) ? message : "Processing errored!!";
        }
        else if(isProc === true) {
            let descMsg = "Project has pending process(es)....";
            if(indicatorType === PendingProcessActionTypeEnum.NET_IMPORT) {
                descMsg = "Net import process is still running. Please give it some time." 
            }
            else if(indicatorType === PendingProcessActionTypeEnum.NET_PROP_UPLOAD) {
                descMsg = "Net properties upload process is still running. Please give it some time. "
            }
            else if(indicatorType === PendingProcessActionTypeEnum.AUTOMAP_EXEC) {
                descMsg = "Auto-net-mapping process is still running. Please give it some time. "
            }
            else if(indicatorType === PendingProcessActionTypeEnum.AUTODIFF_EXEC) {
                descMsg = "Auto-diff-pairing process is still running. Please give it some time. "
            }
            else if(indicatorType === PendingProcessActionTypeEnum.G2G_UPDATE) {
                descMsg = "G2G update process is still running. Please give it some time."
            }

            sii.lastUpdatedOn = new Date(),
            sii.isOk = true;
            sii.isProcessing = true;
            sii.message = descMsg;
        }
        else {
            sii.lastUpdatedOn = new Date(),
            sii.isOk = true;
            sii.isProcessing = false;
            sii.message = "Processing Completed";
        }


        pendingItemsProp.value = pendingItemsProp.value?.filter((a: StatusIndicatorItem) => a.title !== indicatorType) ?? [];  //remove existing sii
        (pendingItemsProp.value as Array<StatusIndicatorItem>).push(sii);  //add new sii

        project.associatedProperties = project.associatedProperties.filter(a => a.id !== pendingItemsProp.id);  //remove existing prop
        project.associatedProperties.push(pendingItemsProp); //add new prop
        
        
        let updatedProj = await updateProjectPropertyCategoryInFull(projectId, ProjectPropertyCategoryEnum.PENDING_PROCESSES, pendingItemsProp);
        return updatedProj;
    }

    return null
}


//#region -- cloning implementation functions
/* CLone process must ensure that the following areas are handled properly:
    // *project.projectId
    // *project.physicalLinkages  (sourceElementId & value)
    // *project.clearanceLinkages  (nothing to do here for now... we shall see in future...)
    // *PackageLayout.ruleArea.defaultConstraintId
    // *PackageLayout.stackupGenInfo.projectId
    // *G2GRelationContext.interfaceId
    // *Netclass.interfaceId
    // *Net.interfaceId
    // *Net.netclassId
    // *LayerGroupConstraints.ownerElementId (for netclasses only)
    // *C2CRow.netclassId
    // *C2CRow.slots.netclassId
*/
export async function cloneProject(existingProject: Project, newName: string, user: User) : Promise<Project>{
    let newProjectId = "";
    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    let allCollNames = [...DB_COLL_TYPE_CLONE_ORDER.entries()].sort(([key1], [key2]) => key1 - key2).map(x => x[1])
    
    try {
        //check format of project name
        verifyNaming([newName], NamingContentTypeEnum.PROJECT)
        
        //check if projectName already exists
        let filter = {name : new RegExp('^' + newName + '$', 'i')}
        const projects: Project[] = (await projRepo.GetWithFilter(filter)) as Project[];
        if (projects && projects.length > 0) {
            throw new Error(`Cannot add new project '${newName}'. 
                ${(projects && projects.length > 0 && projects[0].enabled === false) ? "A disabled project" : "A project"} with the same name already exists in the system`);
        }

        if(!existingProject || !existingProject._id) {
            throw new Error(`Failed to successfully create a clone named '${newName}' from existing project. Specified existing project is invalid.`)
        }

        let pCloneInf = await cloneProjectObject(existingProject, newName, user);
        let newProject = pCloneInf.project;
        let permConfRolesValueAsProperty = pCloneInf.rolesCtx;
        let newProjectId = newProject?._id?.toString() as string;

        let ifaceIdMapping = new Map<string, string>();
        let netclassIdMapping = new Map<string, string>();
        let defConIdMapping = new Map<string, string>();
        
        let omissionList =  new Set([DBCollectionTypeEnum.PROJECT_COLLECTION, DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION, DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION]);

        for (let x = 0; x < allCollNames.length; x++) {
            let collectionName : string = allCollNames[x];
            
            if(omissionList.has(collectionName as DBCollectionTypeEnum)){ 
                continue; //these items being skipped should never be cloned!
            }

            //DO NOT CHANGE ORDER!! DO NOT CHANGE ORDER!!!
            //Order is important - Ex: Netclass cloning needs to happen after interfaces have been cloned
            if(collectionName === DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION){
                defConIdMapping = await cloneDefCon(existingProject, newProjectId)
            }
            else if(collectionName === DBCollectionTypeEnum.INTERFACE_COLLECTION){
                ifaceIdMapping = await cloneInterfaces(existingProject, newProjectId, user);
            }
            else if(collectionName === DBCollectionTypeEnum.POWER_INFO_COLLECTION){
                let repo = new ServiceModelRepository<PowerInfo>(DBCollectionTypeEnum.POWER_INFO_COLLECTION)
                await cloneGenerically(existingProject, newProjectId, repo, DBCollectionTypeEnum.POWER_INFO_COLLECTION)
            }
            else if(collectionName === DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION){
                await clonePackageLayout(existingProject, newProjectId, defConIdMapping);
            } 
            else if(collectionName === DBCollectionTypeEnum.NETCLASS_COLLECTION){
                netclassIdMapping = await cloneNetclasses(existingProject, ifaceIdMapping, newProject);
            }
            else if(collectionName === DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION){
                await cloneG2GContexts(existingProject, ifaceIdMapping, newProject);
            }
            else if(collectionName === DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION){
                await cloneLGCs(existingProject, newProjectId, netclassIdMapping);
            }
            else if(collectionName === DBCollectionTypeEnum.C2C_ROW_COLLECTION){
                await cloneC2C(existingProject, newProjectId, netclassIdMapping);
            }
            else if(collectionName === DBCollectionTypeEnum.NET_COLLECTION){
                try {
                    await handleProjectPendingProcessIndicator(newProjectId, PendingProcessActionTypeEnum.NET_IMPORT, false, true);
                    cloneNets(existingProject, newProjectId, ifaceIdMapping, netclassIdMapping);
                    handleProjectPendingProcessIndicator(newProjectId, PendingProcessActionTypeEnum.NET_IMPORT, false, false);
                }
                catch(error: any) {
                    handleProjectPendingProcessIndicator(newProjectId, PendingProcessActionTypeEnum.NET_IMPORT, true, false, error.message);
                    throw error;
                }
            }
            else {
                throw new Error("Clone process not fully implemented! Please inform developer!!");
            }
        }

        //Important - used for setting up permissions on newly created project
        newProject.contextProperties = newProject.contextProperties.filter(a => a.name !== CONF_PERMISSION_ROLES)
        newProject.contextProperties.push(permConfRolesValueAsProperty)

        return newProject as Project;
    }
    catch(err: any)
    {
        try { 
            if(newProjectId && newProjectId.length > 0) { 
                deleteProject(newProjectId) 
            } 
        }
        catch {
            console.error(`Error occured while deleting cloned project after clone attempt failed! ID: ${newProjectId}`);
        }
        finally{ throw err; }
    }
}


function setCommonCloneState<T extends ServiceModel>(clone: T, newProjectId: string, setNewObjectId: boolean) : T{
    clone.projectId = newProjectId;
    clone.lastUpdatedOn = new Date();
    clone.contextProperties = clone.contextProperties.filter(a => a.name.toUpperCase() !== CLONE_SOURCE_ID) ?? [];
    clone.contextProperties.push({
        id: randomUUID(),
        name: CLONE_SOURCE_ID,
        value: clone._id?.toString() as string
    })
    
    if(setNewObjectId) {
        clone._id = new ObjectId();
    }

    return {...clone} as T
}


async function cloneGenerically<T extends ServiceModel>(existingProject: Project, newProjectId: string, repo: ServiceModelRepository<T>, collType: DBCollectionTypeEnum) {
    let items = await repo.GetAllByProjectID(existingProject?._id?.toString() as string);
    if(items && items.length > 0) {
        let oneItem = items[0]
        let clone = rfdcCopy<T>(oneItem) as T;
        clone = setCommonCloneState(clone, newProjectId, true)
        let created = await repo.CreateMany([clone])
        if(!created || created.length === 0) {
            throw new Error(`Failed to create copy of '${collType}' while cloning project`)
        }
    }
}


async function cloneProjectObject(existingProject: Project, newName: string, user: User) : Promise<{project: Project, rolesCtx: BasicProperty}> {
    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    let permConfRolesValueAsProperty : BasicProperty = { id: crypto.randomUUID(), name: CONF_PERMISSION_ROLES, value: null }

    let newId = new ObjectId();
    let clone = rfdcCopy<Project>(existingProject) as Project
    clone = setCommonCloneState(clone, newId.toString(), false)
    
    clone._id = newId;  //NOTE: this must happen after setting common items. Order matters!
    clone.name = newName;
    clone.createdOn = new Date();
    clone.lockedBy = null; //Important!
    clone.createdBy  = user.email || "";
    clone.owner = { email: user.email, idsid: user.idsid } as BaseUserInfo;
 
    //Important - used for setting up permissions on newly created project
    let genConfigs : ConfigItem[] = await getGenConfigs(null, clone.org, false);
    let permRolesConf : any = genConfigs.find(a => a.configName === AppConfigConstants.CONFIGITEM__Permission_Roles)?.configValue ?? null
    if(permRolesConf && permRolesConf.length > 0) {
        const BASIC_NAME_VALIDATION_REGEX: RegExp = /^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/;
        permRolesConf = permRolesConf.filter((a: any) => 
            a.id 
            && a.id.trim().length > 0 
            && a.displayName 
            && a.displayName.trim().length > 0 
            && (BASIC_NAME_VALIDATION_REGEX.test(a.id) === true)
        ); 
        permConfRolesValueAsProperty.value = permRolesConf;
    }

    //important!! - Its important to remove this. If permission setup in AGS is successful, UI will re-add this.
    clone.associatedProperties = clone.associatedProperties.filter(a => a.category !== ProjectPropertyCategoryEnum.PERMISSION_ROLES);

    let newProject = await projRepo.CreateOne(clone)
    if(!newProject || !newProject._id) {
        throw new Error(`Failed to successfully create a clone named '${newName}' from project '${existingProject.name}'.`)
    } 
    
    return {project: newProject, rolesCtx: permConfRolesValueAsProperty};
}


async function cloneDefCon(existingProject: Project, newProjectId: string) : Promise<Map<string, string>> {
    let repo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION)
    let defConIdMapping = new Map<string, string>();
    
    let items = await repo.GetAllByProjectID(existingProject?._id?.toString() as string);
    if(items && items.length > 0) {
        let clones = rfdcCopy<DefaultConstraints[]>(items) as DefaultConstraints[]
        for(let i = 0; i < clones.length; i++) {
            clones[i].createdOn = new Date();

            let oldId = clones[i]._id?.toString() as string;
            clones[i] = setCommonCloneState(clones[i], newProjectId, true)
            let newId = clones[i]._id?.toString() as string;
            defConIdMapping.set(oldId, newId)

            clones[i] = setCommonCloneState(clones[i], newProjectId, true)
        }
        let created = await repo.CreateMany(clones)
        if(!created || created.length === 0) {
            throw new Error("Failed to create copy of default constraints while cloning project")
        }
    }

    return defConIdMapping;
}


async function cloneInterfaces(existingProject: Project, newProjectId: string, user: User) : Promise<Map<string, string>> {
    let ifaceIdMapping = new Map<string, string>();
    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let ifaceItems = await ifaceRepo.GetAllByProjectID(existingProject?._id?.toString() as string);
    if(ifaceItems && ifaceItems.length > 0) {
        let clones = rfdcCopy<Interface[]>(ifaceItems) as Interface[]
        for(let i = 0; i < clones.length; i++) {
            let oldId = clones[i]._id?.toString() as string;
            clones[i].sourceInterfaceId = "";
            clones[i].sourceProjectId = "";
            clones[i].initializationType = InterfaceInitTypeEnum.PROJECT_CLONE;
            clones[i].createdOn = new Date();
            clones[i].createdBy = user.email;
            clones[i] = setCommonCloneState(clones[i], newProjectId, true)
            let newId = clones[i]._id?.toString() as string;
            ifaceIdMapping.set(oldId, newId)
        }

        let created = await ifaceRepo.CreateMany(clones)
        if(!created || created.length === 0) {
            throw new Error("Failed to create copy of interfaces while cloning project")
        }
    }
    return ifaceIdMapping;
}


async function clonePackageLayout(existingProject: Project, newProjectId: string, defConIdMapping: Map<string, string>) {
    let repo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let items = await repo.GetAllByProjectID(existingProject?._id?.toString() as string);
    if(items && items.length > 0) {
        let oneItem = items[0]
        let clone = rfdcCopy<PackageLayout>(oneItem) as PackageLayout
        clone = setCommonCloneState(clone, newProjectId, true)
        
        if(clone.stackupGenInfo) {
            clone.stackupGenInfo.projectId = newProjectId;
        }
        
        // handle default constraint designations in rule areas
        for(let k = 0; k < clone.ruleAreas.length; k++) {
            if(clone.ruleAreas[k].defaultConstraintId && clone.ruleAreas[k].defaultConstraintId.length > 0) {
                let newDefConId = defConIdMapping.get(clone.ruleAreas[k].defaultConstraintId);
                if(newDefConId && newDefConId.trim().length > 0){
                    clone.ruleAreas[k].defaultConstraintId = newDefConId;
                }
                else {
                    clone.ruleAreas[k].defaultConstraintId = "";  //set to default
                }
            }
        }

        let created = await repo.CreateMany([clone])
        if(!created || created.length === 0) {
            throw new Error("Failed to create copy of pkg layout while cloning project")
        }
    }
}


async function cloneNetclasses(existingProject: Project, ifaceIdMapping : Map<string, string>, newProject: Project) : Promise<Map<string, string>> {
    let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
    let netclassIdMapping = new Map<string, string>();
    
    let items = await ncRepo.GetAllByProjectID(existingProject?._id?.toString() as string);
    if(items && items.length > 0) {
        let clones = rfdcCopy<Netclass[]>(items) as Netclass[]
        for(let i = 0; i < clones.length; i++) {
            let newIfaceId = ifaceIdMapping.get(clones[i].interfaceId);
            if(!newIfaceId || newIfaceId?.trim().length === 0){
                throw new Error(`Error occured while cloning netclasses for project ${existingProject.name}. Could not determine interface for existing netclass '${clones[i].name}'`)
            }
            clones[i].interfaceId = newIfaceId;

            let oldId = clones[i]._id?.toString() as string;
            clones[i] = setCommonCloneState(clones[i], newProject?._id?.toString() as string, true)
            let newId = clones[i]._id?.toString() as string;
            netclassIdMapping.set(oldId, newId)
        }
        let created = await ncRepo.CreateMany(clones)
        if(!created || created.length === 0) {
            throw new Error("Failed to create copy of netclasses while cloning project")
        }

        //handle linkage cloning
        if(newProject.physicalLinkages && newProject.physicalLinkages.length > 0) {
            for(let x = 0; x < newProject.physicalLinkages.length; x++) {
                let newSrcElementId = netclassIdMapping.get(newProject.physicalLinkages[x].sourceElementId);
                if(!newSrcElementId || newSrcElementId?.trim().length === 0){
                    throw new Error(`Error occured while updating Physical Linkages for newly cloned project. `
                        + `Could not determine source netclass for existing linkage '${newProject.physicalLinkages[x].name}'`)
                }
                newProject.physicalLinkages[x].sourceElementId = newSrcElementId;
    
                if(newProject.physicalLinkages[x].value && newProject.physicalLinkages[x].value.length > 0) {
                    for(let j = 0; j < newProject.physicalLinkages[x].value.length; j++) {
                        let newValueItemId = netclassIdMapping.get(newProject.physicalLinkages[x].value[j]);
                        if(!newValueItemId || newValueItemId?.trim().length === 0){
                            throw new Error(`Error occured while updating Physical Linkages for newly cloned project. `
                                + `Could not determine member netclass for existing linkage '${newProject.physicalLinkages[x].name}'`)
                        }
                        newProject.physicalLinkages[x].value[j] = newValueItemId;
                    }
                }
            }

            await projRepo.ReplaceOne(newProject)
        }
    }
    return netclassIdMapping
}


async function cloneG2GContexts(existingProject: Project, ifaceIdMapping: Map<string, string>, newProject: Project) {
    let g2gRepo = new ServiceModelRepository<G2GRelationContext>(DBCollectionTypeEnum.G2G_RELATION_CONTEXT_COLLECTION)
    let g2gIdMapping = new Map<string, string>();

    let items = await g2gRepo.GetAllByProjectID(existingProject?._id?.toString() as string);
    if(items && items.length > 0) {
        let clones = rfdcCopy<G2GRelationContext[]>(items) as G2GRelationContext[]
        for(let i = 0; i < clones.length; i++) {
            let newIfaceId = ifaceIdMapping.get(clones[i].interfaceId);
            if(!newIfaceId || newIfaceId?.trim().length === 0){
                throw new Error(`Error occured while cloning G2G context for project ${existingProject.name}. Could not determine interface for existing G2G context.`)
            }
            clones[i].interfaceId = newIfaceId;

            let oldId = clones[i]._id?.toString() as string;
            clones[i] = setCommonCloneState(clones[i], newProject?._id?.toString() as string, true)
            let newId = clones[i]._id?.toString() as string;
            g2gIdMapping.set(oldId, newId)
        }

        //handle target sections
        for(let k = 0; k < clones.length; k++) {
            if(clones[k].across && clones[k].across.length > 0) {
                for(let j = 0; j < clones[k].across.length; j++) {
                    if(clones[k].across[j].targets && clones[k].across[j].targets.length > 0) {
                        for(let z = 0; z < clones[k].across[j].targets.length; z++) {
                            let oldVal = clones[k].across[j].targets[z];
                            clones[k].across[j].targets[z] = g2gIdMapping.get(oldVal) ?? "";
                        }
                    }
                }
            }
        }

        let created = await g2gRepo.CreateMany(clones)
        if(!created || created.length === 0) {
            throw new Error("Failed to create copy of G2G contexts while cloning project")
        }
    }
}


async function cloneLGCs(existingProject: Project, newProjectId: string, netclassIdMapping : Map<string, string>) {
    let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
    let lgcBatch = new Array<LayerGroupConstraints>();
    const lgcCursor = lgcRepo.GetCursorByProjectIDAndProjection(existingProject?._id?.toString() as string, null, null, LGC_RETRIEVAL_BATCH_SIZE)
    
    for await (let lgcItem of lgcCursor) {
        let clone = rfdcCopy<LayerGroupConstraints>(lgcItem) as LayerGroupConstraints
        clone = setCommonCloneState(clone, newProjectId, true)
        
        if(clone.constraintType === ConstraintTypesEnum.Physical) {
            let newNetclassId = netclassIdMapping.get(clone.ownerElementId);
            if(!newNetclassId || newNetclassId?.trim().length === 0){
                throw new Error(`Error occured while cloning constraint element for project '${existingProject.name}'. Could not determine existing netclass assigned to item`)
            }
            clone.ownerElementId = newNetclassId as string;
        }

        lgcBatch.push(clone);
        if(lgcBatch.length >= LGC_RETRIEVAL_BATCH_SIZE){
            let created = await lgcRepo.CreateMany([...lgcBatch])
            if(!created || created.length === 0) {
                throw new Error("Failed to create copy of layer group constraint elements while cloning project")
            }
            lgcBatch = new Array<LayerGroupConstraints>()
        }
    }

    if(lgcBatch.length > 0){
        let created = await lgcRepo.CreateMany([...lgcBatch])
        if(!created || created.length === 0) {
            throw new Error("Failed to create copy of layer group constraint elements while cloning project")
        }
        lgcBatch = new Array<LayerGroupConstraints>()
    }
}


async function cloneC2C(existingProject: Project, newProjectId: string, netclassIdMapping : Map<string, string>) {
    let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
    let c2crBatch = new Array<C2CRow>();
    const c2crCursor = c2crRepo.GetCursorByProjectIDAndProjection(existingProject?._id?.toString() as string, null, null, C2C_ROW_RETRIEVAL_BATCH_SIZE)
    
    for await (let c2cItem of c2crCursor) {
        let clone = rfdcCopy<C2CRow>(c2cItem) as C2CRow
        clone = setCommonCloneState(clone, newProjectId, true)
        
        let newNetclassId = netclassIdMapping.get(clone.netclassId);
        if(!newNetclassId || newNetclassId?.trim().length === 0){
            throw new Error(`Error occured while cloning C2CRow element for project '${existingProject.name}'. Could not determine existing netclass assigned to item`)
        }
        clone.netclassId = newNetclassId as string;

        for(let k = 0; k < clone.slots.length; k++) {
            if(clone.slots[k].netclassId && clone.slots[k].netclassId.trim().length > 0) {
                let newSlotNetclassId = netclassIdMapping.get(clone.slots[k].netclassId);
                if(!newSlotNetclassId || newSlotNetclassId?.trim().length === 0){
                    throw new Error(`Error occured while cloning C2CRow element for project '${existingProject.name}'. Could not determine existing netclass assigned to item`)
                }
                clone.slots[k].netclassId = newSlotNetclassId;
            }
        }

        c2crBatch.push(clone);
        if(c2crBatch.length >= C2C_ROW_RETRIEVAL_BATCH_SIZE){
            let created = await c2crRepo.CreateMany([...c2crBatch])
            if(!created || created.length === 0) {
                throw new Error("Failed to create copy of C2CRow elements while cloning project")
            }
            c2crBatch = new Array<C2CRow>()
        }
    }

    if(c2crBatch.length > 0){
        let created = await c2crRepo.CreateMany([...c2crBatch])
        if(!created || created.length === 0) {
            throw new Error("Failed to create copy of layer group constraint elements while cloning project")
        }
        c2crBatch = new Array<C2CRow>()
    }
}


async function cloneNets(existingProject: Project, newProjectId: string, ifaceIdMapping : Map<string, string>, netclassIdMapping : Map<string, string>) {
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let exisProjectId = existingProject?._id?.toString() as string;
    let dpNetIdMapping = new Map<string, ObjectId>();

    let dpNetfilters = [{ diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>]
    const dpNetCursor = netRepo.GetCursorByProjectIDAndProjection(exisProjectId, dpNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
    
    for await (const currDPNet of dpNetCursor) { 
        if(dpNetIdMapping.has(currDPNet.diffPairNet) === false) {
            dpNetIdMapping.set(currDPNet.diffPairNet, new ObjectId());
        }
        if(dpNetIdMapping.has(currDPNet._id.toString()) === false) {
            dpNetIdMapping.set(currDPNet._id.toString(), new ObjectId());
        }
    }
    
    const cursor = netRepo.GetCursorByProjectIDAndProjection(existingProject?._id?.toString() as string, null, null, NET_RETRIEVAL_BATCH_SIZE)
    let netBatch = new Array<Net>();
    
    for await (const cursNetForClone of cursor) {  //when iterating a cursor, be careful never to use the same name ("in this case: 'cursNetForClone') in the same local context
        let clone = rfdcCopy<Net>(cursNetForClone as Net) as Net
        
        //handle classified nets
        if(clone.interfaceId && clone.interfaceId.length > 0 && clone.netclassId && clone.netclassId.length > 0) {
            let newIfaceId = ifaceIdMapping.get(clone.interfaceId);
            let newNetclassId = netclassIdMapping.get(clone.netclassId);
            if(!newIfaceId || newIfaceId?.trim().length === 0){
                throw new Error(`Error occured while cloning a mapped Net for project '${existingProject.name}'. Could not determine existing interface assigned to net '${clone.name}'`)
            }
            if(!newNetclassId || newNetclassId?.trim().length === 0){
                throw new Error(`Error occured while cloning a mapped Net for project '${existingProject.name}'. Could not determine existing netclass assigned to net '${clone.name}'`)
            }
            clone.interfaceId = newIfaceId
            clone.netclassId = newNetclassId
        }
        
        //handle diff pairs
        if(clone.diffPairMapType !== DataMappingTypeEnum.Unmapped && clone.diffPairNet && clone.diffPairNet.trim().length > 0) {
            let newSelfId = dpNetIdMapping.get(clone._id?.toString() as string)
            let newPartnerId = dpNetIdMapping.get(clone.diffPairNet)

            if(!newSelfId){
                throw new Error(`Error occured while cloning diff paired Net for project '${existingProject.name}'. Could not determine new id for cloned net '${clone.name}'`)
            }
            if(!newPartnerId){
                throw new Error(`Error occured while cloning diff paired Net for project '${existingProject.name}'. Could not determine new id for net's partner. Net: '${clone.name}'`)
            }
            clone._id = newSelfId;
            clone.diffPairNet = newPartnerId.toString();
            clone = setCommonCloneState(clone, newProjectId, false)
        }
        else {
            clone = setCommonCloneState(clone, newProjectId, true)
        }

        netBatch.push(clone);
        if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE) {
            netRepo.CreateMany([...netBatch])
            netBatch = new Array<Net>()
        }
    }
    
    if(netBatch.length > 0){
        netRepo.CreateMany(netBatch)
        netBatch = new Array<Net>()
    }
}

//#endregion











// throw new Error(`Error occured while updating designated default constraint set for rule area '${clone.ruleAreas[k].ruleAreaName}' of the newly cloned project. `
//     + `Could not determine source default constraint set`)

                


// if(isInsertAction === false) {
//             pendingItemsProp.value = pendingItemsProp.value?.filter((a: StatusIndicatorItem) => a.title !== indicatorType) ?? [];
//             project.associatedProperties = project.associatedProperties.filter(a => a.id !== pendingItemsProp.id);
//             project.associatedProperties.push(pendingItemsProp);
//         }



// //handle g2g context on interface cloning - wherever an interfaceId is indicated
// let modified: boolean = false;
// for(let q = 0; q < created.length; q++) {
//     if(created[q].groupRelationContexts && created[q].groupRelationContexts.length > 0) {
//         for(let x = 0; x < created[q].groupRelationContexts.length; x++) {
//             let oldG2GId = created[q].groupRelationContexts[x].id;
//             let res = getSectionsFromIdString(oldG2GId);
//             if((res.isSuccessful === false)) {
//                 throw new Error(`Error occured while updating G2G context for newly cloned project. ${res.message}`);
//             }
//             let oldIfaceId = res?.data?.ifaceId || "";
//             if(!oldIfaceId || (oldIfaceId.trim().length === 0) || (ifaceIdMapping.has(oldIfaceId) === false)){
//                 throw new Error(`Error occured while updating G2G context for newly cloned project. Could not determine source interface for existing G2G context data`);
//             }
//             let newIfaceId = ifaceIdMapping.get(oldIfaceId) as string;
//             created[q].groupRelationContexts[x].id = oldG2GId.replace(oldIfaceId, newIfaceId);
//             modified = true;

//             if(created[q].groupRelationContexts[x].targets && created[q].groupRelationContexts[x].targets.length > 0) {
//                 for(let j = 0; j < created[q].groupRelationContexts[x].targets.length; j++) {
//                     let oldValue = created[q].groupRelationContexts[x].targets[j];
//                     let valRes = getSectionsFromIdString(oldValue);
//                     if((valRes.isSuccessful === false)) {
//                         throw new Error(`Error occured while updating G2G target group info for newly cloned project. ${valRes.message}`);
//                     }
//                     let oldValIfaceId = valRes?.data?.ifaceId || "";
//                     if(!oldValIfaceId || (oldValIfaceId.trim().length === 0) || (ifaceIdMapping.has(oldValIfaceId) === false)){
//                         throw new Error(`Error occured while updating G2G target group info for newly cloned project. Could not determine source interface for existing G2G context data`);
//                     }
//                     let newValIfaceId = ifaceIdMapping.get(oldValIfaceId) as string;
//                     created[q].groupRelationContexts[x].targets[j] = oldValue.replace(oldValIfaceId, newValIfaceId);
//                     modified = true;
//                 }
//             }
//         }
//     }
// }

// if(modified === true) {
//     await ifaceRepo.ReplaceMany(created);
// }



//====================================================================================================================

// let incPhyLnkIdList = project.physicalLinkages.map(a => a.id);
//     let incClrLnkIdList = project.clearanceLinkages.map(a => a.id);
//     let incCrbIdList = project.clearanceRelationBrands.map(a => a.id);
//     if((existingProject.physicalLinkages.length !== project.physicalLinkages.length) || existingProject.physicalLinkages.some(x => (incPhyLnkIdList.includes(x.id) === false))) {
//         throw new Error(`Project update cannot proceed. Incoming project is expected to have same physical linkages. Please use alternative method provided specifically for updating linkages`)
//     }
//     if((existingProject.clearanceLinkages.length !== project.clearanceLinkages.length) || existingProject.clearanceLinkages.some(x => (incClrLnkIdList.includes(x.id) === false))) {
//         throw new Error(`Project update cannot proceed. Incoming project is expected to have same clearance linkages. Please use alternative method provided specifically for updating linkages`)
//     }
//     if((existingProject.clearanceRelationBrands.length !== project.clearanceRelationBrands.length) || existingProject.clearanceRelationBrands.some(x => (incCrbIdList.includes(x.id) === false))) {
//         throw new Error(`Project update cannot proceed. Incoming project is expected to have same CRBs. Please use alternative method provided specifically for updating relations`)
//     }
//     project.clearanceLinkages = existingProject.clearanceLinkages;
//     project.physicalLinkages = existingProject.physicalLinkages;
//     project.clearanceRelationBrands = existingProject.clearanceRelationBrands;

    


//=====================================================================================================================================================================


// export async function cloneProject(existingProject: Project, newName: string) : Promise<Project>{
//     let newProject : Project|undefined = undefined;
//     let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
//     let allCollNames = [...DB_COLL_TYPE_CLONE_ORDER.entries()].sort(([key1], [key2]) => key1 - key2).map(x => x[1])

//     let ifaceIdMapping = new Map<string, string>();
//     let netclassIdMapping = new Map<string, string>();
    
//     let permConfRolesValueAsProperty : BasicProperty = { id: crypto.randomUUID(), name: CONF_PERMISSION_ROLES, value: null }

//     //check format of project name
//     verifyNaming([newName], NamingContentTypeEnum.PROJECT)
    
//     //check if projectName already exists
//     let filter = {name : new RegExp('^' + newName + '$', 'i')}
//     const projects: Project[] = (await projRepo.GetWithFilter(filter)) as Project[];
//     if (projects && projects.length > 0) {
//         throw new Error(`Cannot add new project '${newName}'. 
//             ${(projects && projects.length > 0 && projects[0].enabled === false) ? "A disabled project" : "A project"} with the same name already exists in the system`);
//     }

//     if(existingProject && existingProject._id) {
//         let newId = new ObjectId();
//         let clone = rfdcCopy<Project>(existingProject) as Project
//         clone = setCommonCloneState(clone, newId.toString(), false)
        
//         clone._id = newId;  //NOTE: this must happen after setting common items. Order matters!
//         clone.name = newName;
//         clone.createdOn = new Date();
//         clone.lockedBy = null; //Important!

//         //Important - used for setting up permissions on newly created project
//         let genConfigs : ConfigItem[] = await getGenConfigs(null, clone.org, false);
//         let permRolesConf : any = genConfigs.find(a => a.configName === AppConfigConstants.CONFIGITEM__Permission_Roles)?.configValue ?? null
//         if(permRolesConf && permRolesConf.length > 0) {
//             const BASIC_NAME_VALIDATION_REGEX: RegExp = /^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/;
//             permRolesConf = permRolesConf.filter((a: any) => 
//                 a.id 
//                 && a.id.trim().length > 0 
//                 && a.displayName 
//                 && a.displayName.trim().length > 0 
//                 && (BASIC_NAME_VALIDATION_REGEX.test(a.id) === true)
//             ); 
//             permConfRolesValueAsProperty.value = permRolesConf;
//         }

//         //important!! - Its important to remove this. If permission setup in AGS is successful, UI will re-add this.
//         clone.associatedProperties = clone.associatedProperties.filter(a => a.category !== ProjectPropertyCategoryEnum.PERMISSION_ROLES);

//         newProject = await projRepo.CreateOne(clone)
//         if(!newProject || !newProject._id) {
//             throw new Error(`Failed to successfully create a clone named '${newName}' from project '${existingProject.name}'.`)
//         }
//     }
//     else {
//         throw new Error(`Failed to successfully create a clone named '${newName}' from existing project. Specified existing project is invalid.`)
//     }

//     let newProjectId = newProject?._id?.toString() as string;
//     try {
//         for (let x = 0; x < allCollNames.length; x++) {
            
//             let collectionName : string = allCollNames[x];

//             //DO NOT CHANGE ORDER!! DO NOT CHANGE ORDER!!!
//             if(collectionName === DBCollectionTypeEnum.PROJECT_COLLECTION){
//                 continue; //already completed by the time we get to this point. see above...
//             }
//             else if(collectionName === DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION){
//                 continue; //We do NOT clone snapshots!!
//             }
//             else if (collectionName === DBCollectionTypeEnum.CHANGE_CONTEXT_COLLECTION) {
//                 continue; //We do NOT clone change history data!!
//             }

//             else if(collectionName === DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION){
//                 let repo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION)
//                 let items = await repo.GetAllByProjectID(existingProject?._id?.toString() as string);
//                 if(items && items.length > 0) {
//                     let clones = rfdcCopy<DefaultConstraints[]>(items) as DefaultConstraints[]
//                     for(let i = 0; i < clones.length; i++) {
//                         clones[i].createdOn = new Date();
//                         clones[i] = setCommonCloneState(clones[i], newProjectId, true)
//                     }
//                     let created = await repo.CreateMany(clones)
//                     if(!created || created.length === 0) {
//                         throw new Error("Failed to create copy of default constraints while cloning project")
//                     }
//                 }
//             }
//             else if(collectionName === DBCollectionTypeEnum.INTERFACE_COLLECTION){
//                 //TODO: need to handle links
//                 let repo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
//                 let items = await repo.GetAllByProjectID(existingProject?._id?.toString() as string);
//                 if(items && items.length > 0) {
//                     let clones = rfdcCopy<Interface[]>(items) as Interface[]
//                     for(let i = 0; i < clones.length; i++) {
//                         let oldId = clones[i]._id?.toString() as string;
//                         clones[i].sourceInterfaceId = "";
//                         clones[i].sourceProjectId = "";
//                         clones[i].initializationType = InterfaceInitTypeEnum.PROJECT_CLONE;
//                         clones[i].createdOn = new Date();
//                         clones[i] = setCommonCloneState(clones[i], newProjectId, true)
//                         let newId = clones[i]._id?.toString() as string;
//                         ifaceIdMapping.set(oldId, newId)
//                     }
//                     let created = await repo.CreateMany(clones)
//                     if(!created || created.length === 0) {
//                         throw new Error("Failed to create copy of interfaces while cloning project")
//                     }
//                 }


//                 // HANDLE G2G CONTEXTS IFACE ID CONVERSION 
//             }
//             else if(collectionName === DBCollectionTypeEnum.POWER_INFO_COLLECTION){
//                 let repo = new ServiceModelRepository<PowerInfo>(DBCollectionTypeEnum.POWER_INFO_COLLECTION)
//                 let items = await repo.GetAllByProjectID(existingProject?._id?.toString() as string);
//                 if(items && items.length > 0) {
//                     let oneItem = items[0]
//                     let clone = rfdcCopy<PowerInfo>(oneItem) as PowerInfo
//                     clone = setCommonCloneState(clone, newProjectId, true)
//                     let created = await repo.CreateMany([clone])
//                     if(!created || created.length === 0) {
//                         throw new Error("Failed to create copy of power info while cloning project")
//                     }
//                 }
//             }
//             else if(collectionName === DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION){
//                 let repo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
//                 let items = await repo.GetAllByProjectID(existingProject?._id?.toString() as string);
//                 if(items && items.length > 0) {
//                     let oneItem = items[0]
//                     let clone = rfdcCopy<PackageLayout>(oneItem) as PackageLayout
//                     clone = setCommonCloneState(clone, newProjectId, true)
//                     let created = await repo.CreateMany([clone])
//                     if(!created || created.length === 0) {
//                         throw new Error("Failed to create copy of pkg layout while cloning project")
//                     }
//                 }
//             } 
//             else if(collectionName === DBCollectionTypeEnum.NETCLASS_COLLECTION){
//                 //NOTE: order is important - This needs to happen after interfaces have been cloned
//                 let ncRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//                 let items = await ncRepo.GetAllByProjectID(existingProject?._id?.toString() as string);
//                 if(items && items.length > 0) {
//                     let clones = rfdcCopy<Netclass[]>(items) as Netclass[]
//                     for(let i = 0; i < clones.length; i++) {
//                         let newIfaceId = ifaceIdMapping.get(clones[i].interfaceId);
//                         if(!newIfaceId || newIfaceId?.trim().length === 0){
//                             throw new Error(`Error occured while cloning netclasses for project ${existingProject.name}. Could not determine interface for existing netclass '${clones[i].name}'`)
//                         }
//                         clones[i].interfaceId = newIfaceId;

//                         let oldId = clones[i]._id?.toString() as string;
//                         clones[i] = setCommonCloneState(clones[i], newProjectId, true)
//                         let newId = clones[i]._id?.toString() as string;
//                         netclassIdMapping.set(oldId, newId)
//                     }
//                     let created = await ncRepo.CreateMany(clones)
//                     if(!created || created.length === 0) {
//                         throw new Error("Failed to create copy of netclasses while cloning project")
//                     }
//                 }


//                 // HANDLE LINKAGE DATA IFACE ID CONVERSION 

//             }
//             else if(collectionName === DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION){
//                 let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
//                 let lgcBatch = new Array<LayerGroupConstraints>();
//                 const lgcCursor = lgcRepo.GetCursorByProjectIDAndProjection(existingProject?._id?.toString() as string, null, null, LGC_RETRIEVAL_BATCH_SIZE)
                
//                 for await (let lgcItem of lgcCursor) {
//                     let clone = rfdcCopy<LayerGroupConstraints>(lgcItem) as LayerGroupConstraints
//                     clone = setCommonCloneState(clone, newProjectId, true)
                    
//                     if(clone.constraintType === ConstraintTypesEnum.Physical) {
//                         let newNetclassId = netclassIdMapping.get(clone.ownerElementId);
//                         if(!newNetclassId || newNetclassId?.trim().length === 0){
//                             throw new Error(`Error occured while cloning constraint element for project '${existingProject.name}'. Could not determine existing netclass assigned to item`)
//                         }
//                         clone.ownerElementId = newNetclassId as string;
//                     }

//                     lgcBatch.push(clone);
//                     if(lgcBatch.length >= LGC_RETRIEVAL_BATCH_SIZE){
//                         let created = await lgcRepo.CreateMany([...lgcBatch])
//                         if(!created || created.length === 0) {
//                             throw new Error("Failed to create copy of layer group constraint elements while cloning project")
//                         }
//                         lgcBatch = new Array<LayerGroupConstraints>()
//                     }
//                 }

//                 if(lgcBatch.length > 0){
//                     let created = await lgcRepo.CreateMany([...lgcBatch])
//                     if(!created || created.length === 0) {
//                         throw new Error("Failed to create copy of layer group constraint elements while cloning project")
//                     }
//                     lgcBatch = new Array<LayerGroupConstraints>()
//                 }
//             }
//             else if(collectionName === DBCollectionTypeEnum.C2C_ROW_COLLECTION){
//                 let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
//                 let c2crBatch = new Array<C2CRow>();
//                 const c2crCursor = c2crRepo.GetCursorByProjectIDAndProjection(existingProject?._id?.toString() as string, null, null, C2C_ROW_RETRIEVAL_BATCH_SIZE)
                
//                 for await (let c2cItem of c2crCursor) {
//                     let clone = rfdcCopy<C2CRow>(c2cItem) as C2CRow
//                     clone = setCommonCloneState(clone, newProjectId, true)
                    
//                     let newNetclassId = netclassIdMapping.get(clone.netclassId);
//                     if(!newNetclassId || newNetclassId?.trim().length === 0){
//                         throw new Error(`Error occured while cloning C2CRow element for project '${existingProject.name}'. Could not determine existing netclass assigned to item`)
//                     }
//                     clone.netclassId = newNetclassId as string;

//                     for(let k = 0; k < clone.slots.length; k++) {
//                         if(clone.slots[k].netclassId && clone.slots[k].netclassId.trim().length > 0) {
//                             let newSlotNetclassId = netclassIdMapping.get(clone.slots[k].netclassId);
//                             if(!newSlotNetclassId || newSlotNetclassId?.trim().length === 0){
//                                 throw new Error(`Error occured while cloning C2CRow element for project '${existingProject.name}'. Could not determine existing netclass assigned to item`)
//                             }
//                             clone.slots[k].netclassId = newSlotNetclassId;
//                         }
//                     }

//                     c2crBatch.push(clone);
//                     if(c2crBatch.length >= C2C_ROW_RETRIEVAL_BATCH_SIZE){
//                         let created = await c2crRepo.CreateMany([...c2crBatch])
//                         if(!created || created.length === 0) {
//                             throw new Error("Failed to create copy of C2CRow elements while cloning project")
//                         }
//                         c2crBatch = new Array<C2CRow>()
//                     }
//                 }

//                 if(c2crBatch.length > 0){
//                     let created = await c2crRepo.CreateMany([...c2crBatch])
//                     if(!created || created.length === 0) {
//                         throw new Error("Failed to create copy of layer group constraint elements while cloning project")
//                     }
//                     c2crBatch = new Array<C2CRow>()
//                 }
//             }
//             else if(collectionName === DBCollectionTypeEnum.NET_COLLECTION){
//                 let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
//                 let exisProjectId = existingProject?._id?.toString() as string;
//                 let dpNetIdMapping = new Map<string, ObjectId>();

//                 let dpNetfilters = [{ diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>]
//                 const dpNetCursor = netRepo.GetCursorByProjectIDAndProjection(exisProjectId, dpNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
                
//                 for await (const currDPNet of dpNetCursor) { 
//                     if(dpNetIdMapping.has(currDPNet.diffPairNet) === false) {
//                         dpNetIdMapping.set(currDPNet.diffPairNet, new ObjectId());
//                     }
//                     if(dpNetIdMapping.has(currDPNet._id.toString()) === false) {
//                         dpNetIdMapping.set(currDPNet._id.toString(), new ObjectId());
//                     }
//                 }
                
                
                
                
//                 const cursor = netRepo.GetCursorByProjectIDAndProjection(existingProject?._id?.toString() as string, null, null, NET_RETRIEVAL_BATCH_SIZE)
//                 let netBatch = new Array<Net>();
                
//                 for await (const cursNetForClone of cursor) {  //when iterating a cursor, be careful never to use the same name ("in this case: 'cursNetForClone') in the same local context
//                     let clone = rfdcCopy<Net>(cursNetForClone as Net) as Net
                    
//                     //handle classified nets
//                     if(clone.interfaceId && clone.interfaceId.length > 0 && clone.netclassId && clone.netclassId.length > 0) {
//                         let newIfaceId = ifaceIdMapping.get(clone.interfaceId);
//                         let newNetclassId = netclassIdMapping.get(clone.netclassId);
//                         if(!newIfaceId || newIfaceId?.trim().length === 0){
//                             throw new Error(`Error occured while cloning a mapped Net for project '${existingProject.name}'. Could not determine existing interface assigned to net '${clone.name}'`)
//                         }
//                         if(!newNetclassId || newNetclassId?.trim().length === 0){
//                             throw new Error(`Error occured while cloning a mapped Net for project '${existingProject.name}'. Could not determine existing netclass assigned to net '${clone.name}'`)
//                         }
//                         clone.interfaceId = newIfaceId
//                         clone.netclassId = newNetclassId
//                     }
                    
//                     //handle diff pairs
//                     if(clone.diffPairMapType !== DataMappingTypeEnum.Unmapped && clone.diffPairNet && clone.diffPairNet.trim().length > 0) {
//                         let newSelfId = dpNetIdMapping.get(clone._id?.toString() as string)
//                         let newPartnerId = dpNetIdMapping.get(clone.diffPairNet)

//                         if(!newSelfId){
//                             throw new Error(`Error occured while cloning diff paired Net for project '${existingProject.name}'. Could not determine new id for cloned net '${clone.name}'`)
//                         }
//                         if(!newPartnerId){
//                             throw new Error(`Error occured while cloning diff paired Net for project '${existingProject.name}'. Could not determine new id for net's partner. Net: '${clone.name}'`)
//                         }
//                         clone._id = newSelfId;
//                         clone.diffPairNet = newPartnerId.toString();
//                         clone = setCommonCloneState(clone, newProjectId, false)
//                     }
//                     else {
//                         clone = setCommonCloneState(clone, newProjectId, true)
//                     }

//                     netBatch.push(clone);
//                     if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE) {
//                         netRepo.CreateMany([...netBatch])
//                         netBatch = new Array<Net>()
//                     }
//                 }
                
//                 if(netBatch.length > 0){
//                     netRepo.CreateMany(netBatch)
//                     netBatch = new Array<Net>()
//                 }
//             }
//             else {
//                 throw new Error("Clone process not fully implemented! Please inform developer!!");
//             }
            
//         }
//     }
//     catch(err: any)
//     {
//         try{ if(newProjectId) { deleteProject(newProjectId) } }
//         catch {}
//         finally{ throw err; }
//     }
    
//     //Important - used for setting up permissions on newly created project
//     newProject.contextProperties = newProject.contextProperties.filter(a => a.name !== CONF_PERMISSION_ROLES)
//     newProject.contextProperties.push(permConfRolesValueAsProperty)

//     return newProject as Project;
// }







//==================================================================================================================================================================





    // let newPhysLinkages : LinkageInfo[] = incomingProject.physicalLinkages.filter(x => existingProject.physicalLinkages.every(z => z.id !== x.id)) ?? [];
    // let newClrLinkages : LinkageInfo[] = incomingProject.clearanceLinkages.filter(p => existingProject.clearanceLinkages.every(c => c.id !== p.id)) ?? [];
    
    // if (newPhysLinkages.length > 0) {
    //     for (let physLnk of newPhysLinkages) {
    //         let foundNetclasses = netclassList.filter(a => physLnk.value.includes(a._id.toString().trim()));
    //         if (!foundNetclasses || (foundNetclasses.length !== physLnk.value.length)) {
    //             throw new Error(`Cannot update project. Invalid link element found for physical linkage '${physLnk.name}'`);
    //         }
    //         if (!foundNetclasses[0].layerGroupSetId || (foundNetclasses[0].layerGroupSetId.trim().length === 0) || foundNetclasses.some(x => x.layerGroupSetId !== foundNetclasses[0].layerGroupSetId)) {
    //             throw new Error(`Cannot update project. Invalid linkage detected. All linked elements for physical linkage '${physLnk.name}' must have same layer group set.`);
    //         }
    //     }

    //     for (let nc of netclassList) {
    //         let placesWhereNetclassIsFound = incomingProject.physicalLinkages.filter(x => x.value.includes(nc._id.toString()));
    //         if (placesWhereNetclassIsFound && placesWhereNetclassIsFound.length > 1) {
    //             throw new Error(`Cannot update project. Invalid linkage data detected. For physial linkages, a netclass elements cannot be involved in more than one linkages`);
    //         }
    //     }
    // }

    // if (newClrLinkages.length > 0) {
    //     for (let clrLnk of newClrLinkages) {
    //         let foundClrRels: BasicProperty[] = existingProject.clearanceRelationBrands.filter(x => clrLnk.value.includes(x.id)) ?? [];
    //         if (!foundClrRels || (foundClrRels.length !== clrLnk.value.length)) {
    //             throw new Error(`Cannot update project. Invalid link element found for clearance linkage '${clrLnk.name}'`);
    //         }
    //         if (!foundClrRels[0].value || (foundClrRels[0].value.trim().length === 0) || foundClrRels.some(x => x.value !== foundClrRels[0].value)) {
    //             throw new Error(`Cannot update project. Invalid linkage detected. All linked elements for clearance linkage '${clrLnk.name}' must have same layer group set.`);
    //         }
    //     }

    //     for (let clrRel of incomingProject.clearanceRelationBrands) {
    //         let placesWhereClrRelIsFound = incomingProject.clearanceLinkages.filter(x => x.value.includes(clrRel.id));
    //         if (placesWhereClrRelIsFound && placesWhereClrRelIsFound.length > 1) {
    //             throw new Error(`Cannot update project. Invalid linkage data detected. For clearance linkages, a clearance-relation brand name cannot be involved in more than one linkages`);
    //         }
    //     }
    // }




    // let incomingAddedLinkages = (newPhysLinkages ?? []).concat(newClrLinkages ?? []);
    // for (let lnk of incomingAddedLinkages) {
    //     if (!lnk.name || lnk.name.trim().length === 0) {
    //         throw new Error(`All linkage names must be valid and non-empty.`);
    //     }
    //     if (!lnk.value || lnk.value.length === 0) {
    //         throw new Error(`Linkage '${lnk.name}' cannot have empty set of linked elements.`);
    //     }
    //     if (lnk.value.length < 2) {
    //         throw new Error(`Linkage '${lnk.name}' must have more than one link elements.`);
    //     }
    //     if (!lnk.sourceElementId || lnk.sourceElementId.length === 0) {
    //         throw new Error(`Linkage '${lnk.name}' cannot have empty data source element.`);
    //     }
    //     if (lnk.value.includes(lnk.sourceElementId) === false) {
    //         throw new Error(`Linkage '${lnk.name}' is invalid. The specified data source must be part of the linkage.`);
    //     }
    //     if(pkg.ruleAreas && pkg.ruleAreas.every(x => lnk.ruleAreaId !== x.id)) {
    //         throw new Error(`Linkage '${lnk.name}' is invalid. Associated rule area is not valid.`)
    //     }

    //     let prohibNames = new Set<string>(
    //         [incomingProject.name]
    //             .concat(incomingProject.clearanceRelationBrands.map(a => a.name))
    //             .concat(netclassList.map(a => a.name))
    //             .map(a => a.toUpperCase())
    //     );

    //     if (prohibNames.has(lnk.name.trim().toUpperCase())) {
    //         throw new Error(`Prohibited linkage names found. Linkage entity cannot have same name as project, netclass, interface or channel`);
    //     }
    // }





// if(!physLnk.value || physLnk.value.length === 0) {
                //     throw new Error(`Physical linkage '${physLnk.name}' cannot have empty set of linked elements.`)
                // }
                // else if(!physLnk.initDataSourceEntity || physLnk.initDataSourceEntity.length === 0) {
                //     throw new Error(`Physical linkage '${physLnk.name}' cannot have empty data source element.`)
                // }
                // if(physLnk.value.includes(physLnk.initDataSourceEntity) === false) {
                //     throw new Error(`Physical linkage '${physLnk.name}' is invalid. Data source element must be part of the linkage.`)
                // }

                // if(!clrLnk.value || clrLnk.value.length === 0) {
                //     throw new Error(`Clearance linkage '${clrLnk.name}' cannot have empty set of linked elements.`)
                // }
                // else if(!clrLnk.initDataSourceEntity || clrLnk.initDataSourceEntity.length === 0) {
                //     throw new Error(`Clearance linkage '${clrLnk.name}' cannot have empty data source element.`)
                // }
                // if(clrLnk.value.includes(clrLnk.initDataSourceEntity) === false) {
                //     throw new Error(`Clearance linkage '${clrLnk.name}' is invalid. Data source element must be part of the linkage.`)
                // }
                
                



// export async function getProjectAggregateSummary(projectId: string, netInfoOnly: boolean) : Promise<AggregateSummary>{
//     let ifaceMap = new Map<string, string>();
//     let netclassStatMap = new Map<string, NCStats>();
    
//     let statsInfo: AggregateSummary = {
//         projectId: "",
//         totalInterfaces: 0,
//         totalNetclasses: 0,
//         totalStackupLayers: 0,
//         totalRuleAreas: 0,
//         totalLayerGroupSets: 0,
//         totalLayerGroups: 0,
//         totalSnapShots: 0,
//         totalDefaultConstraintSets: 0,
//         hasNets: false,
//         totalNets: 0,
//         totalNonPairedNets: 0,
//         totalDiffPairs: 0,
//         totalAssignedNets: 0,
//         totalUnassignedNets: 0,
//         netclassStats: []
//     }

//     let nClassSMRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//     let nClassProjection = { interfaceId: 1, name: 1 }
//     let netclassList = await nClassSMRepo.GetAllByProjectIDAndProjection(projectId, null, nClassProjection)

//     let ifaceSMRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
//     let ifaceProjection = { name: 1 }
//     let interfaceList = await ifaceSMRepo.GetAllByProjectIDAndProjection(projectId, null, ifaceProjection)

//     let pkgSMRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
//     let existingPkg = await pkgSMRepo.GetOneByProjectID(projectId)

//     let netsRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
//     let defConSMRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION)
//     let snapSMRepo = new ServiceModelRepository<SnapshotContext>(DBCollectionTypeEnum.SNAPSHOT_CONTEXT_COLLECTION)

//     statsInfo.projectId = projectId;

//     statsInfo.totalInterfaces = (interfaceList && interfaceList.length > 0) ? interfaceList.length : 0;
//     statsInfo.totalNetclasses = (netclassList && netclassList.length > 0) ? netclassList.length : 0;

//     statsInfo.totalStackupLayers = (existingPkg && existingPkg.stackupLayers ) ? existingPkg.stackupLayers.length : 0;
//     statsInfo.totalRuleAreas = (existingPkg && existingPkg.ruleAreas ) ? existingPkg.ruleAreas.length : 0;
//     statsInfo.totalLayerGroupSets = (existingPkg && existingPkg.layerGroupSets ) ? existingPkg.layerGroupSets.length : 0;
    
//     let golden = existingPkg?.layerGroupSets?.find(a => a.tags.includes(GOLDEN_INDICATOR_NAME))
//     statsInfo.totalLayerGroups = (golden && golden.layerGroups) ? golden.layerGroups.length : 0;

//     statsInfo.totalSnapShots = await snapSMRepo.GetCountByProjectId(projectId, null) ?? 0
//     statsInfo.totalDefaultConstraintSets = await defConSMRepo.GetCountByProjectId(projectId, null) ?? 0
    
//     statsInfo.totalNets = await netsRepo.GetCountByProjectId(projectId, null) ?? 0
    
//     let npnFilter = {diffPairMapType: DataMappingTypeEnum.Unmapped} as Filter<Net>;
//     statsInfo.totalNonPairedNets = await netsRepo.GetCountByProjectId(projectId, [npnFilter]) ?? 0

//     let dpFilter = { diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>;
//     statsInfo.totalDiffPairs = await netsRepo.GetCountByProjectId(projectId, [dpFilter]) ?? 0
    
//     statsInfo.hasNets = (statsInfo.totalNets > 0) ? true : false;
    
//     let orphanNetfilter = {netclassMapType: DataMappingTypeEnum.Unmapped} as any;
//     statsInfo.totalUnassignedNets = await netsRepo.GetCountByProjectId(projectId, [orphanNetfilter]) ?? 0

//     statsInfo.totalAssignedNets = (statsInfo.totalNets > 0) ? (statsInfo.totalNets - statsInfo.totalUnassignedNets) : 0
    
//     if (interfaceList && interfaceList.length > 0) {
//         for (let p = 0; p < interfaceList.length; p++) {
//             let ifaceId = (interfaceList[p]._id.toString());
//             let ifaceName = interfaceList[p].name;
//             ifaceMap.set(ifaceId, ifaceName);
//         }
//     }

//     if (netclassList && netclassList.length > 0) {
//         for (let x = 0; x < netclassList.length; x++) {
//             if (ifaceMap.has(netclassList[x].interfaceId) === false) {
//                 throw new Error(`Netclass '${netclassList[x].name}' belongs to interface with id '${netclassList[x].interfaceId}' that was not found in the system`);
//             }
//             let ncStatObj: NCStats = {
//                 interfaceId: netclassList[x].interfaceId,
//                 interfaceName: ifaceMap.get(netclassList[x].interfaceId) ?? "",
//                 netclassId: netclassList[x]._id?.toString(),
//                 netclassName: netclassList[x].name,

//                 manuallyAssigned: 0,
//                 autoAssigned: 0,
//                 totalNetclassNets: 0
//             };
//             netclassStatMap.set(netclassList[x]._id?.toString(), ncStatObj);
//         }

//         if(statsInfo.hasNets) {
//             let aggQueryAsString = AGG_QUERY_NETCLASS_STATS.replace("####_PROJECTID_####", projectId)

//             let aggCursor = netsRepo.RunAggregation(aggQueryAsString, true)

//             let retInfo = await aggCursor?.toArray() ?? []

//             if (retInfo.length > 0) {
//                 for(let i = 0; i < retInfo.length; i++) {
//                     let netclassId = retInfo[i]._id?.trim()
//                     let autoTotal = retInfo[i].autoAssignedCount
//                     let manualTotal = retInfo[i].manualAssignedCount
//                     if(netclassId && netclassId.length > 0) {
//                         if (netclassStatMap.has(netclassId) === false) {
//                             throw new Error(`Netclass element returned in netclass stas query may not belong to project. Please check query accuracy!`);
//                         }
//                         let statObj = netclassStatMap.get(netclassId) as NCStats
//                         statObj.manuallyAssigned = manualTotal,
//                         statObj.autoAssigned = autoTotal,
//                         statObj.totalNetclassNets = (manualTotal + autoTotal)
//                         netclassStatMap.set(netclassId, statObj)
//                     }
//                 }
//             }
//         }

//         if (netclassStatMap.size > 0) {
//             statsInfo.netclassStats = Array.from(netclassStatMap.values());
//         }
//     }

//     return statsInfo;
// }




//===================================================================================================================


// for(let ruleArea of (clone.ruleAreas ?? [])) {
//     for (let p = 0; p < ruleArea.physicalInterfaceExclusionList.length; p++) {
//         let oldVal = ruleArea.physicalInterfaceExclusionList[p];
//         if(ifaceIdMapping.has(oldVal)) {
//             ruleArea.physicalInterfaceExclusionList[p] = ifaceIdMapping.get(oldVal) as string
//         }
//         else {
//             ruleArea.physicalInterfaceExclusionList = ruleArea.physicalInterfaceExclusionList.filter(a => a !== oldVal)
//         }
//     }
//     for (let c = 0; c < ruleArea.clearanceInterfaceExclusionList.length; c++) {
//         let oldVal = ruleArea.clearanceInterfaceExclusionList[c];
//         if(ifaceIdMapping.has(oldVal)) {
//             ruleArea.clearanceInterfaceExclusionList[c] = ifaceIdMapping.get(oldVal) as string
//         }
//         else {
//             ruleArea.clearanceInterfaceExclusionList = ruleArea.clearanceInterfaceExclusionList.filter(a => a !== oldVal)
//         }
//     }
// }



//=================================================



// let netListFileProps = project.associatedProperties?.filter(a => a.category === ProjectPropertyCategoryEnum.NET_FILE_IMPORT) ?? []
                
    // project.lastUpdatedOn = new Date();
    
    // let netListDetail : NetListImportDetail = {
    //     date: new Date(),
    //     totalIncomming: netListSize,
    //     adjustment: promptedMod
    // }

    // let netFileHistoryProp : PropertyItem = {
    //     name: `Entry_${netListFileProps.length}__${netListFileName}`, //NOTE: properties must have unique names!
    //     displayName: netListFileName,
    //     value: netListDetail,
    //     category: ProjectPropertyCategoryEnum.NET_FILE_IMPORT,
    //     id: crypto.randomUUID(),
    //     editable: false,
    //     enabled: true
    // }

    // project.associatedProperties.push(netFileHistoryProp)
    // project.associatedProperties = project.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);

    // let projColl = getCollection(DBCollectionTypeEnum.PROJECT_COLLECTION)
    // let baseProjRepo = new BaseRepository<Project>(projColl)

    // let result = await baseProjRepo.ReplaceOne(project);
    // if(result) {
    //     let updated = baseProjRepo.GetWithId(project.projectId)
    //     return updated;
    // }
    // else {
    //     throw new Error(`Failed to update project '${project.name}'. An unspecified error occured while performing update operation`)
    // }



//===================================================================================

                    // if(created && created.length > 0) {
                    //     for(let x = 0; x < created.length; x++) {
                    //         let srcId = created[x].contextProperties.find(a => a.name.toUpperCase() === CLONE_SOURCE_ID) 
                    //         if(srcId && srcId.value && srcId.value.length > 0){
                    //             netclassIdMapping.set(srcId.value, created[x]._id?.toString() as string)
                    //         }
                    //     } 
                    // }
                    // else {
                    //     throw new Error("Failed to create copy of netclasses while cloning project")
                    // }





//===============================================================================================================================================




                    




    // if(genConfigs && genConfigs.length > 0) {
    //     let cName = `${project.org}__${BucketConstants_GeneralConfigs.CONFIGITEM__Default_Project_Properties}`
    //     let projPropConf : any = genConfigs.filter(a => a.configName.toLowerCase() === cName.toLowerCase())?.at(0)?.configValue ?? null
        
    //     if(projPropConf && projPropConf.length > 0) {
    //         for(let x = 0; x < projPropConf.length; x++){
    //             let prop = (projPropConf[x] as PropertyItem);
                
    //             let name = prop?.name ?? ""
    //             let value = prop?.value ?? ""
    //             let categ = prop?.category ?? ""
    //             let enabled = prop?.enabled ?? false
    //             let editable = prop?.editable ?? false

    //             if(prop && name.length > 0 && enabled === true) {
    //                 if(editable){
    //                     prop.category = CommonPropertyCategoryEnum.GENERAL_CONFIGURED_FIXED_KEY
    //                 }
    //                 else {
    //                     prop.category = CommonPropertyCategoryEnum.GENERAL_CONFIGURED_NON_EDITABLE
    //                 }
    //                 prop.value = value.toString() //allowing only string values from config
    //                 project.associatedProperties.push(prop)
    //             }
    //         }
    //     }
    // }



    //=======================================================



    
    // if (excludeNetDetailedStats === false) {
    //     let ifaceMap = new Map<string, string>();
    //     let netclassStatMap = new Map<string, NCStats>();
        
    //     //TODO: make db call in paralllel
    //     //TODO: use aggregation for this whole thing 
    //     if (ifaces && ifaces.length > 0) {
    //         for (let p = 0; p < ifaces.length; p++) {
    //             let ifaceId = (ifaces[p]._id.toString());
    //             let ifaceName = ifaces[p].name;
    //             ifaceMap.set(ifaceId, ifaceName);
    //         }
    //     }

    //     if (nClassList && nClassList.length > 0) {
    //         for (let x = 0; x < nClassList.length; x++) {
    //             if (ifaceMap.has(nClassList[x].interfaceId) === false) {
    //                 throw new Error(`Netclass '${nClassList[x].name}' belongs to interface with id '${nClassList[x].interfaceId}' that was not found in the system`);
    //             }
    //             let ncStatObj: NCStats = {
    //                 interfaceId: nClassList[x].interfaceId,
    //                 interfaceName: ifaceMap.get(nClassList[x].interfaceId) ?? "",
    //                 netclassId: nClassList[x]._id?.toString(),
    //                 netclassName: nClassList[x].name,

    //                 manuallyAssigned: 0,
    //                 autoAssigned: 0,
    //                 totalNetclassNets: 0
    //             };
    //             netclassStatMap.set(nClassList[x]._id?.toString(), ncStatObj);
    //         }
    //     }


    //     let netProjection = { name: 1, interfaceId: 1, netclassMapType: 1, netclassId: 1 };
    //     const cursor = netSMRepo.GetCursorByProjectIDAndProjection(projectId, null, netProjection, NET_RETRIEVAL_BATCH_SIZE)

    //     for await (const cursNet of cursor) {
    //         if (cursNet.netclassMapType === DataMappingTypeEnum.Auto) {
    //             if (cursNet.netclassId && cursNet.netclassId.length > 0) {
    //                 if (netclassStatMap.has(cursNet.netclassId)) {
    //                     let stat: NCStats = (netclassStatMap.get(cursNet.netclassId) as NCStats);
    //                     stat.autoAssigned = stat.autoAssigned + 1;
    //                     stat.totalNetclassNets = stat.totalNetclassNets + 1;
    //                     netclassStatMap.set(cursNet.netclassId, stat);
    //                 }
    //                 else {
    //                     throw new Error(`Net '${cursNet.name}' belongs to netclass with id '${cursNet.netclassId}' that was not found in the system`);
    //                 }
    //             }
    //             else {
    //                 throw new Error(`Net '${cursNet.name}' has mapping type set to ${DataMappingTypeEnum.Auto} but net is not actually mapped to a netclass`);
    //             }
    //         }
    //         else if (cursNet.netclassMapType === DataMappingTypeEnum.Manual) {
    //             if (cursNet.netclassId && cursNet.netclassId.length > 0) {
    //                 if (netclassStatMap.has(cursNet.netclassId)) {
    //                     let stat: NCStats = (netclassStatMap.get(cursNet.netclassId) as NCStats);
    //                     stat.manuallyAssigned = stat.manuallyAssigned + 1;
    //                     stat.totalNetclassNets = stat.totalNetclassNets + 1;
    //                     netclassStatMap.set(cursNet.netclassId, stat);
    //                 }
    //                 else {
    //                     throw new Error(`Net '${cursNet.name}' belongs to netclass with id '${cursNet.netclassId}' that was not found in the system`);
    //                 }
    //             }
    //             else {
    //                 throw new Error(`Net '${cursNet.name}' has mapping type set to ${DataMappingTypeEnum.Manual} but net is not actually mapped to a netclass`);
    //             }
    //         }
    //         else {
    //             if (cursNet.netclassId && cursNet.netclassId.length > 0) {
    //                 throw new Error(`Net '${cursNet.name}' is mapped to netclass with Id '${cursNet.netclassId}' however mapping type is not set.`);
    //             }
    //         }
    //     }
        
    //     if (netclassStatMap.size > 0) {
    //         statsInfo.netclassStats = Array.from(netclassStatMap.values());
    //     }
        
    // }