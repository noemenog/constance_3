import { DefConEntry, DefaultConstraints, Layer, LayerGroupConstraints, Netclass, PackageLayout, Project, StackupLayer } from "../Models/ServiceModels";
import { getFileExt, groupBy, isNotNullOrEmptyOrWS, rfdcCopy } from "./UtilFunctions";
import { BasicProperty, ConfigItem, ConstraintConfExportContext, ConstraintValues, PropertyItem, User } from "../Models/HelperModels";
import { AppConfigConstants, ConstraintPropertyCategoryEnum, ConstraintTypesEnum, DBCollectionTypeEnum, GOLDEN_INDICATOR_NAME, LGC_RETRIEVAL_BATCH_SIZE, RELATED_DEFAULT_CONSTRAINTS_PROP_NAME } from "../Models/Constants";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { getGenConfigs } from "./ConfigLogic";
import { saveLatestChangeTrackingVersionsForCollection } from "./BasicCommonLogic";
import { ObjectId } from "mongodb";




//============================ do not F with these ====================================================
const CES_VBS_SPLITTERS : string[] = [ "call CESImport.SetRuleValue", "call CESImport.CreateSchemea" ]  
const PHYSICAL_RULES_INDICATORS : string[] = [ "EXP_", "MIN_", "TYP_" ];
enum CES_FromToIndex { FROM = 0, TO = 2 };
enum CES_LINE_SPLIT_INDEXES { RULE_LAYER_SEG = 0, REGION_SEG = 1, RULE_STR_SEG = 2, VALUE = 3 }
//===================================================================================================


export async function retrieveAndFormatDefCon(projectId: string, dataSetName: string, excludeConstraintEntries: boolean) : Promise<DefaultConstraints|null> {
    let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
    let defConResult : DefaultConstraints|null = null;
    let relativesInfo = await getDefConRelatives(projectId, dataSetName);
    
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let pkg = await pkgRepo.GetOneByProjectID(projectId)
    if(!pkg) { 
        throw new Error(`Failed to retrieve valid layout info.`) 
    }

    if(relativesInfo.idName && relativesInfo.idName.length > 0){
        let filter = { nameIdentifier: new RegExp('^' + relativesInfo.idName + '$', 'i') }
        if(excludeConstraintEntries === true) {
            let projection = { constraints: 0 }
            let arr = await defConRepo.GetAllByProjectIDAndProjection(projectId, filter, projection)
            defConResult = arr?.at(0)
        }
        else {
            defConResult = await defConRepo.GetOneByProjectID(projectId, filter)
        }
        
        if(defConResult && defConResult?._id){
            let relsProp : BasicProperty = {
                id: crypto.randomUUID(),
                name: RELATED_DEFAULT_CONSTRAINTS_PROP_NAME, 
                value: relativesInfo.relatives,
            }
            defConResult?.contextProperties?.push(relsProp);
        }
    }

    //make sure rule areas are in sync with defCons that exist for project
    if(relativesInfo.allDefConIds && relativesInfo.allDefConIds.length > 0) {
        let pkgChange = false;
        for(let i = 0; i < pkg.ruleAreas.length; i++) {
            if(pkg.ruleAreas[i].defaultConstraintId && pkg.ruleAreas[i].defaultConstraintId.trim().length > 0) {
                if(relativesInfo.allDefConIds.includes(pkg.ruleAreas[i].defaultConstraintId.trim()) === false) {
                    pkg.ruleAreas[i].defaultConstraintId = "";
                    pkgChange = true;
                }
            }
        }
        
        if(pkgChange === true) {
            await pkgRepo.ReplaceOne(pkg);
            pushDefaultConstraints(projectId)
        }
    }

    return defConResult
}


async function getDefConRelatives(projectId: string, focusItemName: string) {
    let filterName = '';
    let dcRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
    let projection = { _id: 1, fileName: 1, nameIdentifier: 1, isGolden: 1, tags: 1 };
    let projDefConItems = (await dcRepo.GetAllByProjectIDAndProjection(projectId, null, projection) as DefaultConstraints[]) ?? [];

    let golden = projDefConItems.find(a => (a.isGolden === true))
    if(projDefConItems && (projDefConItems.length > 0) && (!golden)) {
        throw new Error("Could not determine golden default constraints for current project!");
    }

    if(focusItemName && focusItemName.length > 0) {
        filterName = focusItemName
    }
    else {
        filterName = golden?.nameIdentifier as string
    }

    let relativesData = projDefConItems.filter(a => a.nameIdentifier.toLowerCase() !== filterName.toLowerCase()) ?? []
    let relIds = relativesData.map(a => (a._id?.toString() as string));
    let fullIdList = golden ? [golden?._id?.toString() as string, ...relIds] : []

    return { idName: filterName, gldItem: golden, relatives: relativesData, allDefConIds: fullIdList};
}


export function verifyBeforeUpload(projectId: string, nameIdentifier: string, fileName: string) {
    if(!projectId|| projectId === 'undefined' || projectId.trim().length === 0) {
        throw new Error(`Cannot process uploaded file. Input projectId is either invalid or empty`)
    }
    if(!nameIdentifier || nameIdentifier.trim().length === 0) {
        throw new Error(`Cannot process uploaded file. The unique name specified for the data is either invalid or empty`)
    }
    if(!fileName || fileName.trim().length === 0) {
        throw new Error(`Cannot process uploaded file. Could not determine file name`)
    }
    if((fileName.trim().toLowerCase().endsWith('.vbs') === false) && (fileName.trim().toLowerCase().endsWith('.csv') === false)) {
        throw new Error(`Cannot process uploaded file '${fileName}'. File type is not acceptable`)
    }
}


export async function processDefaultConstraintsContent(buffer: Buffer, project: Project, nameIdentifier: string, fileName: string, previewMode: boolean) : Promise<DefaultConstraints> {
    let finalDefonEntries = new Array<DefConEntry>();
    let projectId = project._id?.toString() as string;
    let org = project.org

    let content: string = buffer.toString()
    if(content.length === 0) {
        throw new Error(`The uploaded default-constraints file cannot be processed. File is either empty or invalid`)
    }
    
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let pkg = await pkgRepo.GetOneByProjectID(projectId)

    if((!pkg) || (!pkg.stackupLayers) || pkg.stackupLayers.length === 0) {
        throw new Error(`Required stackup data was not found. Please setup stackup before importing default constraints`)
    }

    if(!project.constraintSettings || project.constraintSettings.length === 0){  //for good measures...
        throw new Error(`Could not process default constraints file. Constraint properties were not retrieved from config management system.`)
    }
        
    let initDefconEntries = new Array<DefConEntry>();
    let ext = getFileExt(fileName)?.toLowerCase()
    if(ext && ext === ".vbs") {
        initDefconEntries = processVBSDefCon(content);
    }
    else if (ext && ext === ".csv") {
        pkg.stackupLayers = pkg.stackupLayers.sort((a, b) => a.index < b.index ? -1 : 1); //Important!!!
        initDefconEntries = processCSVDefCon(pkg.stackupLayers, content);
    }

    //handle data mappings according to config (this part should take care of bidirectionality since both directions should appear in config)
    let phyPropMapping = new Map<string, string>();
    let clrPropMapping = new Map<string, string>();
    let xmodNameMapping = new Map<string, string>();

    for(let confItem of project.constraintSettings) {
        if(confItem.category && confItem.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase())  {
            if(confItem.contextProperties && confItem.contextProperties.length > 0) {
                let tgtName = confItem.name;
                let expCtx = confItem.contextProperties.find(x => x.name.toLowerCase().trim() === "export_context")?.value;
                if(expCtx && tgtName && tgtName.length > 0) {
                    let defConkeys = (expCtx as ConstraintConfExportContext).defConKeys ?? [];
                    defConkeys.forEach(a => phyPropMapping.set(a.trim().toUpperCase(), tgtName.trim().toUpperCase()))
                }
            }
        }
        else if( confItem.category && confItem.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase()) {
            if(confItem.contextProperties && confItem.contextProperties.length > 0) {
                let tgtName = confItem.name;
                let expCtx = confItem.contextProperties.find(x => x.name.toLowerCase().trim() === "export_context")?.value;
                if(expCtx && tgtName && tgtName.length > 0) {
                    let defConkeyItems = (expCtx as ConstraintConfExportContext).defConKeys ?? [];
                    defConkeyItems.forEach(a => clrPropMapping.set(a.trim().toUpperCase(), tgtName.trim().toUpperCase()))
                }
            }
        }
    }
        
    let genConfigs : ConfigItem[] = await getGenConfigs(projectId, org, false);
    if(genConfigs && genConfigs.length > 0) {
        let raConf : any = genConfigs.filter(a => a.configName === AppConfigConstants.CONFIGITEM__Rule_Area_Settings)?.at(0)?.configValue ?? null
        if(raConf && raConf.xmodConversion && raConf.xmodConversion.length > 0) {
            for(let x = 0; x < raConf.xmodConversion.length; x++){
                let srcXmod = raConf.xmodConversion[x].sourceXmodName || '';
                let tgtXmod = raConf.xmodConversion[x].targetXmodName || '';
                if(srcXmod.length > 0 && tgtXmod.length > 0) {
                    xmodNameMapping.set(srcXmod.trim().toUpperCase(), tgtXmod.trim());
                }
            }
        }
    }

    if(phyPropMapping.size === 0 && clrPropMapping.size === 0) {
        throw new Error(`Default constraints were not obtained from file. `
            + `Configured physical and clearance properties were either invalid or did not indicate default-constraint correspondents.`);
    }
      
    let filterData = new Map<string, Map<string, Map<string, Map<string, Set<string>>>>>();   //constrType, xmodName, layer, confPropName, values[]>

    for(let entry of initDefconEntries) {
        let name = entry.name.trim().toUpperCase();
        let xmod = entry.xmodName.trim().toUpperCase();

        //Important - Must handle xmod mapping first!
        if(xmodNameMapping.has(xmod)) {
            entry.xmodName = xmodNameMapping.get(xmod) as string;
        }

        if(entry.constraintType === ConstraintTypesEnum.Physical) {
            if(phyPropMapping.has(name)) {
                filterData = assessEntryForDataSet(filterData, entry, phyPropMapping, name, initDefconEntries);
            }
        }
        else if(entry.constraintType === ConstraintTypesEnum.Clearance) {
            if(clrPropMapping.has(name)) {
                filterData = assessEntryForDataSet(filterData, entry, clrPropMapping, name, initDefconEntries);
            }
        } 
    }

    for(let [cType, cTypeMapping] of filterData){
        if(cTypeMapping && cTypeMapping.size > 0) {
            for (let [xmod, xmodMapping] of cTypeMapping) {
                if(xmodMapping && xmodMapping.size > 0) {
                    for(let [layer, layerMapping] of xmodMapping) {
                        if(layerMapping && layerMapping.size > 0) {
                            for(let [propName, values] of layerMapping) {
                                if(values && values.size > 0) {
                                    let dfe: DefConEntry = {
                                        id: crypto.randomUUID(),
                                        xmodName: xmod.trim(),
                                        layerName: layer.trim(),
                                        constraintType: cType,
                                        name: propName.trim(),
                                        value: Array.from(values)?.at(0)?.trim() || ''
                                    }

                                    finalDefonEntries.push(dfe);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if(finalDefonEntries.length === 0) {
        throw new Error(`Error occured while handling default-constraints data upload. Constraints were not obtained from file. Please check configurations`);
    }

    let defcons : DefaultConstraints = {
        projectId: projectId,
        snapshotSourceId: "",
        contextProperties: [],
        lastUpdatedOn: new Date(),
        fileName: fileName,
        nameIdentifier: nameIdentifier,
        description: "",
        sourceDefaultConstraintsId: "",
        createdOn: new Date(),
        isGolden: true,
        tags: [GOLDEN_INDICATOR_NAME],  //!IMPORTANT
        constraints: finalDefonEntries,
    }

    
    if(previewMode) {
        return defcons;
    }
    else {
        let createdDefCon: DefaultConstraints;
        let dcSMRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION)
        
        let delRes: boolean = await dcSMRepo.DeleteManyByProjectId(projectId, null, true)
        if(delRes === true) {
            createdDefCon = await dcSMRepo.CreateOne(defcons) 

            await pushDefaultConstraints(createdDefCon.projectId)
        }
        else {
            throw new Error(`Error occured while processing default-constraints data upload. Previous data was not successfully deleted`);
        }

        return createdDefCon
    }
}


function assessEntryForDataSet(data: Map<string, Map<string, Map<string, Map<string, Set<string>>>>>, entry: DefConEntry, propMapping: Map<string, string>, 
    name: string, initDefconEntries: DefConEntry[]) : Map<string, Map<string, Map<string, Map<string, Set<string>>>>> {
    if (data.has(entry.constraintType) === false) {
        data.set(entry.constraintType, new Map<string, Map<string, Map<string, Set<string>>>>());
    }
    if (data.get(entry.constraintType)?.has(entry.xmodName.toUpperCase()) === false) {
        data.get(entry.constraintType)?.set(entry.xmodName.toUpperCase(), new Map<string, Map<string, Set<string>>>());
    }
    if (data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.has(entry.layerName.toUpperCase()) === false) {
        data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.set(entry.layerName.toUpperCase(), new Map<string, Set<string>>());
    }

    let entryNameMod = propMapping.get(name) as string;

    let currentVal = data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.get(entry.layerName.toUpperCase())?.get(entryNameMod.toUpperCase()) ?? new Set<string>();
    let combine = new Set<string>(Array.from(currentVal).concat([entry.value]));

    if (combine.size > 1) {
        let problemEntries = initDefconEntries.filter(a => propMapping.get(a.name.trim().toUpperCase()) === entryNameMod) ?? [];
        let problematicEntryNames = new Set<string>(problemEntries.map(a => a.name) ?? []);
        let probRuleEntriesStr = `${Array.from(problematicEntryNames).join(", ")}`;
        throw new Error(`Unacceptable scenario detected in imported file. The following rule entries cannot have different values (according to configurations).  `
            + `Type: ${entry.constraintType}. Region: ${entry.xmodName.toUpperCase()}. Layer: ${entry.layerName.toUpperCase()}. Rule Entries: [${probRuleEntriesStr}]`);
    }
    else {
        data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.get(entry.layerName.toUpperCase())?.set(entryNameMod.toUpperCase(), combine);
    }

    return data
}


function processVBSDefCon(content: string) : Array<DefConEntry> {
    let defConEntries = new Array<DefConEntry>();
    let dataLines = content.split(/\r?\n/).filter(a => isNotNullOrEmptyOrWS(a)).filter(x => isValidLine(x, CES_VBS_SPLITTERS)).map(x => sanitize(x));
    
    for (let i = 0; i < dataLines.length; i++) {
        try {
            let lineItem = dataLines[i];
            let splits = sanitizeReplace(lineItem, "", ["\\", "\""]).split(",").filter(q => q.trim());

            if (splits.length > 1) {
                let regionStr = splits[CES_LINE_SPLIT_INDEXES.REGION_SEG].trim();
                let ruleStringstr = splits[CES_LINE_SPLIT_INDEXES.RULE_STR_SEG].trim();
                let str = splits[CES_LINE_SPLIT_INDEXES.VALUE].trim();
                let value = removeDelim(str, ")").at(0);
                let res = getRegionLayerRuleType(regionStr);
                let fromTo = getFromTo(ruleStringstr);

                let lineDCE: DefConEntry = {
                    id: crypto.randomUUID(),
                    xmodName: res.xmodName,
                    layerName: res.layerName,
                    constraintType: fromTo.ctype,
                    name: ruleStringstr,
                    value: value || ''
                };

                defConEntries.push(lineDCE);
            }
        }
        catch (e: any) {
            console.warn(e.Message);
        }
    }

    return defConEntries
}


function processCSVDefCon(stkLayers: StackupLayer[], content: string) : Array<DefConEntry> {
    let constraintList = new Array<DefConEntry>();
    let startIndex = 0;
    let headerIndex = 0;
    let dataIndex = 0;
    let endIndex = 0;
    let ctype = '';
    let raHeader = new Array<string>();
    let constHeader = new Array<string>();
    let raHeaderMapping = new Map<string, string>();

    let dataLines = content.split(/\r?\n/).filter(a => isNotNullOrEmptyOrWS(a))

    for (let i = 0; i < dataLines.length; i++) {
        let lineSplit: string[] = dataLines[i].split(",") ?? [];

        if ((lineSplit[0].toLowerCase() === "rule") && i >= startIndex) {
            startIndex = i;
            ctype = lineSplit[1];
        }
        else if ((lineSplit[0].toLowerCase() === "header") && i > headerIndex) {
            headerIndex = i;
            raHeader = Array.from(lineSplit);
        }
        else if ((headerIndex != 0) && (i == headerIndex + 1)) {
            raHeaderMapping.clear();
            let currentRA = "";
            constHeader = Array.from(lineSplit);
            for (let x = 0; x < constHeader.length; x++) {
                if (constHeader[x] && constHeader[x].trim().length > 0) {
                    if (x >= raHeader.length) {
                        raHeaderMapping.set(x.toString(), currentRA);
                    }
                    else if (raHeader[x] && raHeader[x].trim().length > 0) {
                        let raSplit = raHeader[x].split("=");
                        currentRA = (raSplit.length < 2) ? raSplit[0].trim() : raSplit[1].trim();
                        raHeaderMapping.set(x.toString(), currentRA);
                    }
                    else {
                        raHeaderMapping.set(x.toString(), currentRA);
                    }
                }
            }
        }
        else if ((lineSplit[0].toLowerCase() === "data") && i > dataIndex) {
            dataIndex = i;
            endIndex = 0;  //Important!
            let constraints : DefConEntry[] = processDataLine(lineSplit, constHeader, stkLayers, raHeaderMapping, ctype);
            constraintList = [...constraintList, ...constraints]
        }
        else if ((lineSplit[0].toLowerCase() === "end") && i > endIndex) {
            endIndex = i;
        } 
        else if ((dataIndex != 0) && (i > dataIndex) && (endIndex == 0 || i < endIndex)) //core area
        {
            let constraints : DefConEntry[] = processDataLine(lineSplit, constHeader, stkLayers, raHeaderMapping, ctype);
            constraintList = [...constraintList, ...constraints]
        }
        
    }
    
    return constraintList
}


function processDataLine(lineData: string[], constHeaderData: string[], stkLayers: StackupLayer[], raMapping: Map<string, string>, ctype: string) : DefConEntry[] {
    let constArr = new Array<DefConEntry>();
    if ((ctype.toUpperCase() === "PHY") || (ctype.toUpperCase() === "SPC")) {
        //NOTE: in defCon file, layers start with 1 which is 'SURFACE', but in Spider case, layers start with 0 which is 'FSR'
        // hence it is fine for us to use defcon file index in out list of stkLayers. index 1 will be our zero-based indexing SUFACE layer
        let stkIndex : number = parseInt(lineData[1]);
        let layerName : string = stkLayers[stkIndex]?.name;
        let constrType : ConstraintTypesEnum = (ctype.toUpperCase() === "PHY") ? ConstraintTypesEnum.Physical : ConstraintTypesEnum.Clearance;

        for (let i = 2; i < lineData.length; i++) {
            if(lineData.length > 2) {
                if (lineData[i] && lineData[i].trim().length > 0) {
                    let rgn : string = raMapping.get(i.toString()) as string;
                    let ruleName : string = constHeaderData[i];
                    let value : string = lineData[i]?.trim();

                    let csr: DefConEntry = {
                        id: crypto.randomUUID(),
                        xmodName: rgn.trim(),
                        layerName: layerName.trim(),
                        constraintType: constrType,
                        name: ruleName.trim(),
                        value: value?.trim() || ''
                    }

                    constArr.push(csr);
                }
            }
        }
    }
    return constArr;
} 


export async function pushDefaultConstraints(projectId: string, defConDataOrganized?: Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>) {
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let pkg = await pkgRepo.GetOneByProjectID(projectId)          
    if(!pkg) {
        throw new Error("Cannot update layer grouping. Layout container is expected to exist but was not found for the project")
    }

    let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
    let defConList = await defConRepo.GetAllByProjectID(projectId);
    
    let mainDefConMap = (defConDataOrganized && defConDataOrganized.size > 0) ? defConDataOrganized : organizeDefaultConstraints(defConList);
    if(mainDefConMap.size > 0) {
        
        if(defConList && defConList.length > 0) {
            let gldElement = defConList.find(a => (a.isGolden === true))
            if(!gldElement || !gldElement._id) {
                throw new Error("Cannot process default constraints! Golden default constraint data not found among known data sets!!")
            }

            let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
            let lgcCursor = await lgcRepo.GetCursorByProjectIDAndProjection(projectId, null, null, LGC_RETRIEVAL_BATCH_SIZE);
            
            let hasLGC = await lgcCursor.hasNext()
            if(hasLGC) {
                let raToDefConMap = new Map<string, string>();
                let raToXModMap = new Map<string, string>();
                let lgSetMapping = new Map<string, Map<string, Layer[]>>();
                let netclassToLGSetMap = new Map<string, string>();
                let clrRelToLGSetMap = new Map<string, string>();

                for (let ruleArea of pkg.ruleAreas) {
                    //determine which defcon dataset should be used for each rule area
                    if(ruleArea.defaultConstraintId && ruleArea.defaultConstraintId.length > 0 && mainDefConMap.has(ruleArea.defaultConstraintId)) {
                        raToDefConMap.set(ruleArea.id, ruleArea.defaultConstraintId)
                    }
                    else {
                        raToDefConMap.set(ruleArea.id, gldElement._id?.toString())
                    }
                    //set mapping of rule area id to xmod name
                    raToXModMap.set(ruleArea.id, ruleArea.xmodName.toUpperCase())  //IMPORTANT - UpperCasing is crucial!!!!
                }

                //set mapping of layergroupSet to layerGroups and corresponding layers
                for(let lgSet of pkg.layerGroupSets) {
                    let lgMap = new Map<string, Layer[]>();
                    for(let lg of lgSet.layerGroups) {
                        lgMap.set(lg.id, lg.layers)
                    }
                    lgSetMapping.set(lgSet.id, lgMap);
                }

                //set mapping of netclass to layerGroupSet
                let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
                let netclasses = await netclassRepo.GetAllByProjectID(pkg.projectId) ?? []
                netclasses.forEach(a => netclassToLGSetMap.set(a._id?.toString() as string, a.layerGroupSetId))

                //set mapping of clearance-relation to layerGroupSet
                let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
                let project = await projRepo.GetWithId(projectId);
                project.clearanceRelationBrands?.filter(a => a.value && a.value.length > 0)?.forEach(x => clrRelToLGSetMap.set(x.id, x.value));

                //----------------------------------------------------
                //Remainder of processing
                let lgcBatch = new Array<LayerGroupConstraints>();
                for await (let lgcElement of lgcCursor) { 
                    let defConSetId = raToDefConMap.get(lgcElement.ruleAreaId) as string;
                    let xmodName = raToXModMap.get(lgcElement.ruleAreaId)?.toUpperCase() as string;

                    let layerList : Layer[] = [];
                    if(lgcElement.constraintType === ConstraintTypesEnum.Physical) {
                        let lgSetId = netclassToLGSetMap.get(lgcElement.ownerElementId);
                        if(lgSetId && lgSetId.trim().length > 0) {
                            layerList = lgSetMapping.get(lgSetId)?.get(lgcElement.layerGroupId) ?? []
                        }
                    }
                    else if(lgcElement.constraintType === ConstraintTypesEnum.Clearance) {
                        let lgSetId = clrRelToLGSetMap.get(lgcElement.ownerElementId);
                        if(lgSetId && lgSetId.trim().length > 0) {
                            layerList = lgSetMapping.get(lgSetId)?.get(lgcElement.layerGroupId) ?? []
                        }
                    }

                    for(let k = 0; k < lgcElement.associatedProperties.length; k++) {
                        (lgcElement.associatedProperties[k].value as ConstraintValues).defautlValue = "";  //clear the default constraint first before setting new value
                        
                        let valueList = new Array<number>();
                        for(let layer of layerList) {
                            
                            let dfe = mainDefConMap.get(defConSetId)?.get(lgcElement.constraintType)?.get(xmodName)?.get(layer.name.toUpperCase())?.get(lgcElement.associatedProperties[k].name.toUpperCase());
                            
                            if(dfe && dfe.length > 0 && dfe[0].value && dfe[0].value.length > 0) {
                                valueList.push(Number(dfe[0].value));
                            }
                        }
                        
                        if(valueList.length > 0) {
                            (lgcElement.associatedProperties[k].value as ConstraintValues).defautlValue = Math.max(...valueList).toString();
                        }
                        
                    }

                    lgcBatch.push(lgcElement);
                    if(lgcBatch.length >= LGC_RETRIEVAL_BATCH_SIZE){
                        await lgcRepo.ReplaceMany([...lgcBatch])
                        lgcBatch = new Array<LayerGroupConstraints>()
                    }
                }
            
                if(lgcBatch.length > 0){
                    await lgcRepo.ReplaceMany(lgcBatch)
                    lgcBatch = new Array<LayerGroupConstraints>()
                }

            }
        }
    }   
}



export function organizeDefaultConstraints(defConList: DefaultConstraints[]) : Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>> {
    // What is represented in this map object: 
    //                          <defConSetID, constrType, xmodName, layer, propName, DefConEntry[]>
    let mainDefConMap = new Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>();
        
    if(defConList.length > 0) {
        for(let defCon of defConList) {    
            // What is represented in this map object: <constrType, xmodName, layer, propName, DefConEntry[]> 
            let defConSetMap = new Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>(); 
            let constrTypeMap = groupBy(defCon.constraints, a => a.constraintType)
            for(let [constrTypeKey, constrTypeValues] of constrTypeMap) { 
                defConSetMap.set(constrTypeKey, new Map<string, Map<string, Map<string, DefConEntry[]>>>())
                let xmodMap = groupBy(constrTypeValues, b => b.xmodName);
                for(let [xmodNameKey, xmodNameValues] of xmodMap) {
                    let xmodNameKeyModified = xmodNameKey.toUpperCase(); // NOTE the xmodName upper casing here!!
                    defConSetMap.get(constrTypeKey)?.set(xmodNameKeyModified, new Map<string, Map<string, DefConEntry[]>>())
                    let layerMap = groupBy(xmodNameValues, c => c.layerName);
                    for(let [layerKey, layerValues] of layerMap) {
                        let layerKeyModified = layerKey.toUpperCase(); // NOTE the layerName upper casing here!!
                        defConSetMap.get(constrTypeKey)?.get(xmodNameKeyModified)?.set(layerKeyModified, new Map<string, DefConEntry[]>())
                        let propMap = groupBy(layerValues, c => c.name);
                        for(let [propKey, propValueDefConEntry] of propMap) {
                            let propKeyModified = propKey.toUpperCase(); // NOTE the propName upper casing here!! 
                            defConSetMap.get(constrTypeKey)?.get(xmodNameKeyModified)?.get(layerKeyModified)?.set(propKeyModified, propValueDefConEntry);
                        }
                    }
                }
            }
            mainDefConMap.set(defCon._id?.toString() as string, defConSetMap)
        }
    }
    return mainDefConMap;
}


export async function clearAllCustomLGCValues(projectId: string, user: User|null) : Promise<boolean> {
    let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
    let lgcCursor = await lgcRepo.GetCursorByProjectIDAndProjection(projectId, null, null, LGC_RETRIEVAL_BATCH_SIZE);

    let lgcBatch = new Array<LayerGroupConstraints>();
    let mapBeforeUpdate = new Map<string, Map<string, any>>();
    for await (let ovLgcElement of lgcCursor) { 
        for(let constrProp of ovLgcElement.associatedProperties) {
            
            if(constrProp.value.customValue && constrProp.value.customValue.trim().length > 0) {
                if(mapBeforeUpdate.has(ovLgcElement._id?.toString() as string) === false) {
                    mapBeforeUpdate.set(ovLgcElement._id?.toString() as string, new Map<string, any>())
                }
                mapBeforeUpdate.get(ovLgcElement._id?.toString() as string)?.set(constrProp.id, rfdcCopy<ConstraintValues>(constrProp.value) as ConstraintValues);       
            }

            constrProp.value.customValue = "";
        }

        lgcBatch.push(ovLgcElement);
        if(lgcBatch.length >= LGC_RETRIEVAL_BATCH_SIZE){
            let result = await lgcRepo.ReplaceMany([...lgcBatch])
            let updatedLGCs : LayerGroupConstraints[] = [];
            if (result === true) {
                let idList = lgcBatch.map((x: LayerGroupConstraints) => new ObjectId(x._id?.toString()));
                let infilter = { _id: { $in: idList } as any };
                updatedLGCs = await lgcRepo.GetAllByProjectID(projectId, infilter);
                if (updatedLGCs && updatedLGCs.length > 0) {
                    await saveLatestChangeTrackingVersionsForCollection(updatedLGCs[0].projectId, user, new Map<string, PropertyItem[]>(updatedLGCs.map(x => [x._id?.toString() as string, x.associatedProperties])), mapBeforeUpdate);
                }
            }

            lgcBatch = new Array<LayerGroupConstraints>()
            mapBeforeUpdate = new Map<string, Map<string, any>>();
        }
    }

    if(lgcBatch.length > 0){
        let result = await lgcRepo.ReplaceMany(lgcBatch)
        let updatedLGCs : LayerGroupConstraints[] = [];
        if (result === true) {
            let idList = lgcBatch.map((x: LayerGroupConstraints) => new ObjectId(x._id?.toString()));
            let infilter = { _id: { $in: idList } as any };
            updatedLGCs = await lgcRepo.GetAllByProjectID(projectId, infilter);
            if (updatedLGCs && updatedLGCs.length > 0) {
                await saveLatestChangeTrackingVersionsForCollection(updatedLGCs[0].projectId, user, new Map<string, PropertyItem[]>(updatedLGCs.map(x => [x._id?.toString() as string, x.associatedProperties])), mapBeforeUpdate);
            }
        }

        lgcBatch = new Array<LayerGroupConstraints>()
        mapBeforeUpdate = new Map<string, Map<string, any>>();
    }

    return true;
}



export function getDefconPropValue(columnName: string, keyToPropNameMapping: Map<string, string>, propToDefConEntryMap: Map<string, DefConEntry[]>|undefined) : string {
    //Example of columnName:  "Trace Width Minimum"
    let finalValue = "";
    if(columnName && propToDefConEntryMap && propToDefConEntryMap.size > 0 && keyToPropNameMapping && keyToPropNameMapping.size > 0) {
        let columnNameMod = columnName.replaceAll(" ", "").toUpperCase()
        let propName = keyToPropNameMapping.get(columnNameMod);
        if(propName && propName.trim().length > 0 && propToDefConEntryMap.has(propName)) {
            let dfe = propToDefConEntryMap.get(propName)?.at(0)
            if(dfe) {
                finalValue = dfe.value
            }
        }
    }
    return finalValue;
}


//=============================================== Helper Funcions =============================================


function sanitize(str: string): string {
    let index = str.indexOf('(');
    if (index > 0) {
        let endIndex = str.lastIndexOf(')');
        let modified: string = str.slice(index +1, endIndex)
        return modified;
    }
    throw new Error("Incorrect formating within vbs file content.");
}

function sanitizeReplace(str: string, replaceWith: string, delimArray: string[]): string {
    if (isNotNullOrEmptyOrWS(str) == false) { return str; }// return same string as nothing to be replaced.
    for(let i = 0; i < delimArray.length; i ++) {
        str = str.replaceAll(delimArray[i], replaceWith);
    }
    return str.trim();
}

function getFromTo(str: string): {from: string, to: string, ctype: ConstraintTypesEnum} {
    let fromVal = "", toVal = "";
    let ctypeVal : ConstraintTypesEnum = ConstraintTypesEnum.Undefined
    let temp = PHYSICAL_RULES_INDICATORS.filter(x => str.startsWith(x))
    ctypeVal = (temp && temp.length > 0) ? ConstraintTypesEnum.Physical : ConstraintTypesEnum.Clearance;
   
    if (ctypeVal === ConstraintTypesEnum.Clearance)
    {
        let splits: string[] = str.split("_").filter(x => x.trim());
        fromVal = splits[CES_FromToIndex.FROM as number];
        toVal = splits[CES_FromToIndex.TO as number];
    }
    return {from: fromVal, to: toVal, ctype: ctypeVal };
}

function isValidLine(str: string, splitters: string[]): boolean {
    if ((isNotNullOrEmptyOrWS(str) == false) || splitters.length <= 0) {
        return false;
    }
    if(splitters.every(a => (str.includes(a) === false))) {
        return false
    }
    return true;
}

function removeDelim(original: string, delim: string): string[] {
    if (original != null && original.length > 0) {
        let items : string[] = original.split(delim).filter(i => i?.trim())
        return items;
    }
    else {
        return []
    }
}

function getRegionLayerRuleType(strValue: string) : {xmodName: string, ruleType: string, layerName: string} {
    let regionSplits: string[] = strValue.split("/").filter(i => i.trim());
    let rgn = removeExtras(regionSplits[0]);
    let ruletype = removeExtras(regionSplits[1]);
    let layer = removeExtras(regionSplits[2]);
    return { xmodName: rgn, ruleType: ruletype, layerName: layer };
}

function removeExtras(str: string): string {
    return str.replaceAll("\"", "").replaceAll("'", "").trim();
}















//============================================================================================================================


// if(hasLGC) {
//     let raToDefConMap = new Map<string, string>();
//     let raToXModMap = new Map<string, string>();
//     let lgSetMapping = new Map<string, Map<string, Layer[]>>();
//     let netclassToLGSetMap = new Map<string, string>();
//     let clrRelToLGSetMap = new Map<string, string>();

//     for (let ruleArea of pkg.ruleAreas) {
//         //determine which defcon dataset should be used for each rule area
//         if(ruleArea.defaultConstraintId && ruleArea.defaultConstraintId.length > 0 && mainDefConMap.has(ruleArea.defaultConstraintId)) {
//             raToDefConMap.set(ruleArea.id, ruleArea.defaultConstraintId)
//         }
//         else {
//             raToDefConMap.set(ruleArea.id, gldElement._id?.toString())
//         }
//         //set mapping of rule area id to xmod name
//         raToXModMap.set(ruleArea.id, ruleArea.xmodName.toUpperCase())  //IMPORTANT - UpperCasing is crucial!!!!
//     }

//     //set mapping of layergroupSet to layerGroups and corresponding layers
//     for(let lgSet of pkg.layerGroupSets) {
//         let lgMap = new Map<string, Layer[]>();
//         for(let lg of lgSet.layerGroups) {
//             lgMap.set(lg.id, lg.layers)
//         }
//         lgSetMapping.set(lgSet.id, lgMap);
//     }

//     //set mapping of netclass to layerGroupSet
//     let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//     let netclasses = await netclassRepo.GetAllByProjectID(pkg.projectId) ?? []
//     netclasses.forEach(a => netclassToLGSetMap.set(a._id?.toString() as string, a.layerGroupSetId))

//     //set mapping of clearance-relation to layerGroupSet
//     let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
//     let project = await projRepo.GetWithId(projectId);
    
//     project.clearanceRelationBrands?.filter(a => a.value && a.value.length > 0)?.forEach(x => clrRelToLGSetMap.set(x.id, x.value));

//     let lgcBatch = new Array<LayerGroupConstraints>();
//     for await (const lgcElement of lgcCursor) { 
//         let defConSetId = raToDefConMap.get(lgcElement.ruleAreaId) as string;
//         let xmodName = raToXModMap.get(lgcElement.ruleAreaId)?.toUpperCase() as string;

//         let layerList : Layer[] = [];
//         if(lgcElement.constraintType === ConstraintTypesEnum.Physical) {
//             let lgSetId = netclassToLGSetMap.get(lgcElement.ownerElementId);
//             if(lgSetId && lgSetId.trim().length > 0) {
//                 layerList = lgSetMapping.get(lgSetId)?.get(lgcElement.layerGroupId) ?? []
//             }
//         }
//         else if(lgcElement.constraintType === ConstraintTypesEnum.Clearance) {
//             let lgSetId = clrRelToLGSetMap.get(lgcElement.ownerElementId);
//             if(lgSetId && lgSetId.trim().length > 0) {
//                 layerList = lgSetMapping.get(lgSetId)?.get(lgcElement.layerGroupId) ?? []
//             }
//         }

//         for(let constrProp of lgcElement.associatedProperties) {
//             (constrProp.value as ConstraintValues).defautlValue = "";  //clear the default constraint first before setting new value
            
//             // for(let layer of layerList) {
//             //     let dfe = mainDefConMap.get(defConSetId)?.get(lgcElement.constraintType)?.get(xmodName)?.get(layer.name.toUpperCase())?.get(constrProp.name.toUpperCase());
//             //     if(dfe && dfe.length > 0 && dfe[0].value && dfe[0].value.length > 0) {
//             //         (constrProp.value as ConstraintValues).defautlValue = dfe[0].value;
//             //         continue;
//             //     }
//             // }

//             let valueList = new Array<any>();
//             for(let layer of layerList) {
//                 let dfe = mainDefConMap.get(defConSetId)?.get(lgcElement.constraintType)?.get(xmodName)?.get(layer.name.toUpperCase())?.get(constrProp.name.toUpperCase());
//                 if(dfe && dfe.length > 0 && dfe[0].value && dfe[0].value.length > 0) {
//                     valueList.push(Number(dfe[0].value));
//                 }
//             }
//             if(valueList.length > 0) {
//                 (constrProp.value as ConstraintValues).defautlValue = Math.max(...valueList).toString();
//             }
            
//         }

//         lgcBatch.push(lgcElement);
//         if(lgcBatch.length >= LGC_RETRIEVAL_BATCH_SIZE){
//             await lgcRepo.ReplaceMany([...lgcBatch])
//             lgcBatch = new Array<LayerGroupConstraints>()
//         }
//     }

//     if(lgcBatch.length > 0){
//         await lgcRepo.ReplaceMany(lgcBatch)
//         lgcBatch = new Array<LayerGroupConstraints>()
//     }
    
// }



//=====================================================================================================================================














    // let mainDefConMap = new Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>()
    // if(defConDataOrganized && defConDataOrganized.size > 0) {
    //     mainDefConMap = defConDataOrganized;
    // }
    // else {
    //     mainDefConMap = organizeDefaultConstraints(defConList);
    // }
    






// if(data.has(entry.constraintType) === false) { 
//     data.set(entry.constraintType, new Map<string, Map<string, Map<string, Set<string>>>>());
// }
// if(data.get(entry.constraintType)?.has(entry.xmodName.toUpperCase()) === false) { 
//     data.get(entry.constraintType)?.set(entry.xmodName.toUpperCase(), new Map<string, Map<string, Set<string>>>()) 
// }
// if(data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.has(entry.layerName.toUpperCase()) === false) { 
//     data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.set(entry.layerName.toUpperCase(), new Map<string, Set<string>>()) 
// }

// let entryNameMod = phyPropMapping.get(name) as string;
// let currentVal = data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.get(entry.layerName.toUpperCase())?.get(entryNameMod.toUpperCase()) ?? new Set<string>()
// let combine = new Set<string>(Array.from(currentVal).concat([entry.value]))

// if(combine.size > 1) {
//     let problemEntries = initDefconEntries.filter(a => phyPropMapping.get(a.name.trim().toUpperCase()) === entryNameMod) ?? []
//     let problematicEntryNames = new Set<string>(problemEntries.map(a => a.name) ?? [])
//     let probRuleEntriesStr = `${Array.from(problematicEntryNames).join(", ")}`
//     throw new Error(`Unacceptable scenario detected in imported file. The following rule entries cannot have different values (according to configurations).  `
//         + `Type: ${entry.constraintType}. Region: ${entry.xmodName.toUpperCase()}. Layer: ${entry.layerName.toUpperCase()}. Rule Entries: [${probRuleEntriesStr}]`)
// }
// else {
//     data.get(entry.constraintType)?.get(entry.xmodName.toUpperCase())?.get(entry.layerName.toUpperCase())?.set(entryNameMod.toUpperCase(), combine)
//     entry.name = entryNameMod;
// }




    // let defcons : DefaultConstraints = {
    //     _id : "",  //Important!
    //     projectId: projectId,
    //     snapshotSourceId: "",
    //     contextProperties: [],
    //     lastUpdatedOn: new Date(),
    //     fileName: fileName,
    //     nameIdentifier: nameIdentifier,
    //     description: "",
    //     sourceDefaultConstraintsId: "",
    //     createdOn: new Date(),
    //     tags: [GOLDEN_INDICATOR_NAME],  //!IMPORTANT
    //     constraints: initDefconEntries,
    // }

    // let tempDefConMap = organizeDefaultConstraints([defcons]);




// // What is represented in this map object: <defConSetID, constrType, xmodName, layer, propName, DefConEntry[]>
    // let mainDefConMap = new Map<String, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>();
    
    // for(let defCon of defConList) {    
            //     // What is represented in this map object: <constrType, xmodName, layer, propName, DefConEntry[]> 
            //     let defConSetMap = new Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>(); 
            //     let constrTypeMap = groupBy(defCon.constraints, a => a.constraintType)
            //     for(let [constrTypeKey, constrTypeValues] of constrTypeMap) { 
            //         defConSetMap.set(constrTypeKey, new Map<string, Map<string, Map<string, DefConEntry[]>>>())
            //         let xmodMap = groupBy(constrTypeValues, b => b.xmodName);
            //         for(let [xmodNameKey, xmodNameValues] of xmodMap) {
            //             let xmodNameKeyModified = xmodNameKey.toUpperCase(); // NOTE the upper casing here!!
            //             defConSetMap.get(constrTypeKey)?.set(xmodNameKeyModified, new Map<string, Map<string, DefConEntry[]>>())
            //             let layerMap = groupBy(xmodNameValues, c => c.layerName);
            //             for(let [layerKey, layerValues] of layerMap) {
            //                 let layerKeyModified = layerKey.toUpperCase(); // NOTE the upper casing here!!
            //                 defConSetMap.get(constrTypeKey)?.get(xmodNameKeyModified)?.set(layerKeyModified, new Map<string, DefConEntry[]>())
            //                 let propMap = groupBy(layerValues, c => c.name);
            //                 for(let [propKey, propValueDefConEntry] of propMap) {
            //                     let propKeyModified = propKey.toUpperCase(); // NOTE the upper casing here!! 
            //                     defConSetMap.get(constrTypeKey)?.get(xmodNameKeyModified)?.get(layerKeyModified)?.set(propKeyModified, propValueDefConEntry);
            //                 }
            //             }
            //         }
            //     }
            //     mainDefConMap.set(defCon._id?.toString() as string, defConSetMap)
            // }



//=============================================================================

// let defconExample = {
//     "_id" : "6705ab0d14ac572a8beedf88",
//     "projectId" : "67049aeb9d7a184dbc98d1e2",
//     "snapshotSourceId" : "",
//     "contextProperties" : [

//     ],
//     "lastUpdatedOn" : "2024-10-08T21:58:37.695+0000",
//     "fileName" : "Spec_K10329_PLA12_6_2_22_PM_7_28_2020_ces.vbs",
//     "nameIdentifier" : "Default_2024-10-08T21-58-36-145Z",
//     "description" : "",
//     "sourceDefaultConstraintsId" : "",
//     "createdOn" : "2024-10-08T21:58:37.695+0000",
//     "tags" : [
//         "Golden"
//     ],
//     "constraints" : [
//         {
//             "id" : "708e92d1-9bbe-4beb-8afe-d0c41ace1097",
//             "xmodName" : "(Master)",
//             "layerName" : "SURFACE",
//             "constraintType" : "Physical",
//             "name" : "EXP_TRACE_WIDTH",
//             "value" : "200"
//         },
//         {
//             "id" : "00825e8a-d903-42a3-a203-f6945280df37",
//             "xmodName" : "(Master)",
//             "layerName" : "L2",
//             "constraintType" : "Physical",
//             "name" : "EXP_TRACE_WIDTH",
//             "value" : "200"
//         }
//     ]


// }



// export interface DefaultConstraints extends ServiceModel {
//     fileName: string;
//     nameIdentifier: string;
//     description: string;
//     sourceDefaultConstraintsId: string;
//     createdOn: Date;
//     constraints: DefConEntry[];
//     tags: string[];
// }

// export interface DefConEntry extends BasicProperty{
//     xmodName: string;
//     layerName: string;
//     constraintType: string;
// }

// export interface LayerGroupConstraints extends ServiceModel {
//     ownerElementId: string,
//     ruleAreaId: string;
//     layergroupId: string;
//     constraintType: ConstraintTypesEnum;
//     associatedProperties: PropertyItem[];
// }
