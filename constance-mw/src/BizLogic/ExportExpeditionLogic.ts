import { Filter } from "mongodb";
import { AppConfigConstants, C2C_ROW_ALLCOLUMN_SLOT_NAME, ConstraintPropertyCategoryEnum, ConstraintTypesEnum, DataMappingTypeEnum, DBCollectionTypeEnum, NET_RETRIEVAL_BATCH_SIZE, ProjectPropertyCategoryEnum, StackupConstants } from "../Models/Constants";
import { BasicProperty, ConfigItem, ConstraintConfExportContext, ConstraintValues, StringBuilder, User } from "../Models/HelperModels";
import { C2CRow, DefaultConstraints, DefConEntry, Layer, LayerGroup, LayerGroupConstraints, Net, Netclass, PackageLayout, Project } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { getImportExportConfigs } from "./ConfigLogic";
import { getDefconPropValue, organizeDefaultConstraints, pushDefaultConstraints } from "./DefaultConstraintsLogic";
import AdmZip from "adm-zip";
import { getDateStringForExport, groupBy } from "./UtilFunctions";
import { sort } from 'fast-sort';
import { getLgcPropValue, getMostAppropriateConstraintValue } from "./ConstraintsMgmtLogic";



export async function produceXpeditionConstraintExportZip(project: Project, user: User|null, commonDesc: string) : Promise<Buffer> {
    try {
        let zip = new AdmZip();
    
        let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
        let pkg = await pkgRepo.GetOneByProjectID(project._id?.toString() as string)
        if(!pkg) { 
            throw new Error(`Cannot process constraints retrieval. Failed to retrieve valid layout info.`) 
        }
        if(!pkg.stackupLayers || pkg.stackupLayers.length === 0) { 
            throw new Error(`Cannot process constraints retrieval. Stackup layers not found.`) 
        }
        if(!pkg.layerGroupSets || pkg.layerGroupSets.length === 0) { 
            throw new Error(`Cannot process constraints retrieval. Layer groups not found.`) 
        }
        
        let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
        let netclasses = await netclassRepo.GetAllByProjectID(pkg.projectId) ?? []
        if(!netclasses || netclasses.length === 0) { 
            throw new Error(`Cannot process constraints retrieval. No netclasses found in the system.`) 
        }
        
        let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
        let defConList = await defConRepo.GetAllByProjectID(pkg.projectId);
        if(!defConList || defConList.length === 0) { 
            throw new Error(`Cannot process constraints retrieval. Default constrints were not found for the project.`) 
        }
        let defConGoldenId = defConList.find(a => (a.isGolden === true))?._id?.toString() as string
        let defConDataOrganized : Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>> = organizeDefaultConstraints(defConList);

        let clrRelationElements : BasicProperty[] = project.clearanceRelationBrands ?? []

        let netExportSettingsMap = new Map<string, ConstraintConfExportContext>()
        let phyXpedKeyToPropNameMapping = new Map<string, string>();
        let clrXpedKeyToPropNameMapping = new Map<string, string>();
        
        if(!project.constraintSettings || project.constraintSettings.length === 0){  //for good measures...
            throw new Error(`Could not process data export. Constraint properties were not found for the project.`)
        }

        for(let prop of project.constraintSettings) {
            if(prop.category) {
                //get the export config for the given prop item 
                let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "export_context")?.value
                
                if(exportSettings && exportSettings.xpeditionKeys && exportSettings.xpeditionKeys.length > 0) {
                    if (prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
                        netExportSettingsMap.set(prop.name, exportSettings)
                    }
                    else if(prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase()) {
                        for(let expEntry of exportSettings.xpeditionKeys) {
                            let expKey = expEntry.trim().replaceAll(" ", "").toUpperCase()
                            if(phyXpedKeyToPropNameMapping.has(expKey) && (phyXpedKeyToPropNameMapping.get(expKey) as string).trim().toLowerCase() !== prop.name.toLowerCase()) {
                                throw new Error(`Could not process data export. Same export keys assigned to multiple Constraint properties. `
                                    + `PropertyType: '${prop.category}'. Conflicting Key: '${expEntry}'`)
                            }
                            else {
                                phyXpedKeyToPropNameMapping.set(expKey, prop.name)
                            }
                        }
                    }
                    else if(prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase()) {
                        for(let expEntry of exportSettings.xpeditionKeys) {
                            let expKey = expEntry.replaceAll(" ", "").toUpperCase()
                            if(clrXpedKeyToPropNameMapping.has(expKey) && (clrXpedKeyToPropNameMapping.get(expKey) as string).trim().toLowerCase() !== prop.name.toLowerCase()) {
                                throw new Error(`Could not process data export. Same export keys assigned to multiple Constraint properties. `
                                    + `PropertyType: '${prop.category}'. Conflicting Key: '${expEntry}'`)
                            }
                            else {
                                clrXpedKeyToPropNameMapping.set(expKey, prop.name)
                            }
                        }
                    }
                }
            }
        }

        let specialCaseMap = new Map<string, string>();
        let projectMGP = project.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))
        if(projectMGP && projectMGP.value && projectMGP.value.length > 0) {
            for(let mgp of (projectMGP.value as BasicProperty[])) {
                if(mgp.id && mgp.id.trim().length > 0 && mgp.name && mgp.name.trim().length > 0 && mgp.value) {
                    specialCaseMap.set(mgp.id, mgp.name);
                    specialCaseMap.set(mgp.name, mgp.value);
                }
            }
        }

        let lgSetLayerGroupToLayerMap = new Map<string, Map<string, Layer[]>>();
        for(let lgSet of pkg.layerGroupSets) {
            let lgMap = new Map<string, Layer[]>();
            for(let lg of lgSet.layerGroups) {
                lgMap.set(lg.id, lg.layers)
            }
            lgSetLayerGroupToLayerMap.set(lgSet.id, lgMap);
        }

        let lgSetLayerToLayerGroupMapping = new Map<string, Map<string, {layer: Layer, lg: LayerGroup}>>();
        for(let lgSet of pkg.layerGroupSets) {
            let innerMap = new Map<string, {layer: Layer, lg: LayerGroup}>();
            for(let lg of lgSet.layerGroups) {
                for(let layer of lg.layers) {
                    let name = layer.name.toUpperCase();
                    innerMap.set(name, {layer: layer, lg: lg})
                }
            }
            lgSetLayerToLayerGroupMapping.set(lgSet.id, innerMap);
        }
        
        let physFN = `export_trace.csv`;
        let clrFN = `export_space.csv`;
        let c2cRelFN = `export_relations.csv`;
        let netListFN = `export_nets.csv`;
        let vbsFN = `export_main.vbs`;
        let readmeFN = `README.txt`;
        
        let importExportConfigs = await getImportExportConfigs()

        await pushDefaultConstraints(pkg.projectId, defConDataOrganized);
        
        let phyConstr = await generateXpeditionPhysicalDataForExport(project, commonDesc, pkg, netclasses, lgSetLayerToLayerGroupMapping, phyXpedKeyToPropNameMapping, defConGoldenId, defConDataOrganized);
        let clrConstr = await generateXpeditionClearanceDataForExport(project, commonDesc, pkg, clrRelationElements, lgSetLayerToLayerGroupMapping, clrXpedKeyToPropNameMapping, defConGoldenId, defConDataOrganized);
        let c2cRelConstr = await generateXpeditionClassToClassDataForExport(project, commonDesc, pkg, netclasses, clrRelationElements);
        let netConstr = await generateXpeditionNetsDataForExport(project, commonDesc, netclasses);
        let vbsConstr = await generateXpeditionVBSDataForExport(project, commonDesc, physFN, clrFN, c2cRelFN, netListFN, netclasses, importExportConfigs, netExportSettingsMap, specialCaseMap);
        let readme = await generateXpeditionReadMeForExport(project, commonDesc, importExportConfigs);

        zip.addFile(physFN, Buffer.from(phyConstr || '', "utf8"), `physical constraints export file`);
        zip.addFile(clrFN, Buffer.from(clrConstr || '', "utf8"), `clearance constraints export file`);
        zip.addFile(c2cRelFN, Buffer.from(c2cRelConstr || '', "utf8"), `clearance relations export file`);
        zip.addFile(netListFN, Buffer.from(netConstr || '', "utf8"), `net constraints export file`);
        zip.addFile(vbsFN, Buffer.from(vbsConstr || '', "utf8"), `net setup vbs file`);
        zip.addFile(readmeFN, Buffer.from(readme || '', "utf8"), `readme file`);

        let zipFileContents = zip.toBuffer();
        return zipFileContents
    }
    catch(error: any) {
        throw new Error(`Error while generating export data. ${error.message}`)
    }
}



async function generateXpeditionPhysicalDataForExport(project: Project, commonDesc: string, pkg: PackageLayout, 
    netclasses: Netclass[], lgSetLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>, 
    xpeditionKeyToPropNameMapping: Map<string, string>, defConGoldenId: string, 
    defConDataOrganized:  Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>> ) : Promise<string> {
    
    let header1 = `Table;Traces;`;
    let header2 = `Display Units;um|Ohm;`;
    let header3 = `Name;Level;Scheme;Net class;Index;Type;Via Assignments;Route;Trace Width Minimum;`
        + `Trace Width Typical;Trace Width Expansion;Typical Impedance;Differential Typical Impedance;Differential Spacing;Differential Via Spacing;`;

    //Do not mess with this dictionary! Serious ramifications! ==========
    const MAIN_PHY_KEY_MAP = new Map<number, string>([
        [1, "Trace Width Minimum"],
        [2, "Trace Width Typical"],
        [3, "Trace Width Expansion"],
        [4, "Typical Impedance"],
        [5, "Differential Typical Impedance"],
        [6, "Differential Spacing"],
        [7, "Differential Via Spacing"]
    ]) 
    //===================================================================

    let exportLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() === "metal");
    let exportLayerNames = sort(exportLayers).asc(a => a.index)?.map(x => x.name.toUpperCase())
    let netclassesSorted = sort(netclasses).asc(x => x.interfaceId)

    let ruleAreaDefaultSBDataMap = new Map<string, StringBuilder>();
    let ruleAreaMainSBDataMap = new Map<string, StringBuilder>();
    let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName.toUpperCase());

    for(let ruleArea of ruleAreasSorted) {
        let raMainSB = new StringBuilder();
        let raDefSB = new StringBuilder();

		let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
		let rafilter = { ruleAreaId: ruleArea.id, constraintType: ConstraintTypesEnum.Physical } as Filter<LayerGroupConstraints>
        let lgcList = await lgcRepo.GetAllByProjectID(project._id?.toString() as string, rafilter) ?? []
		let lgcGroupedByNetclass : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId);
        let defaultEntrylayerTrackerSet = new Set<string>();

        for(let netclass of netclassesSorted) {
            
            for(let i = 0; i < exportLayerNames.length; i++) {
                let stkLayer = exportLayerNames[i]
                let layerIndex = i + 1;

                if(defaultEntrylayerTrackerSet.has(stkLayer) === false) {
                    let defConDataSetId = ruleArea.defaultConstraintId || defConGoldenId;
                    let propToDefConEntryMap = defConDataOrganized.get(defConDataSetId)?.get(ConstraintTypesEnum.Physical)?.get(ruleArea.xmodName.toUpperCase())?.get(stkLayer.toUpperCase())

                    let valArr = new Array<string>()
                    for(let p = 0; p < MAIN_PHY_KEY_MAP.size; p++) {
                        let expVal = getDefconPropValue(MAIN_PHY_KEY_MAP.get(p+1) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                        valArr.push(expVal) 
                    }

                    let defaultLayerText = `${stkLayer};Layer;${ruleArea.ruleAreaName};(Default);${layerIndex};Signal;;;${valArr.join(";")};`


                    // let twMin = getDefconPropValue(MAIN_PHY_KEY_MAP.get(1) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let twTyp = getDefconPropValue(MAIN_PHY_KEY_MAP.get(2) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let twExp = getDefconPropValue(MAIN_PHY_KEY_MAP.get(3) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let typImp = getDefconPropValue(MAIN_PHY_KEY_MAP.get(4) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let diffTypImp = getDefconPropValue(MAIN_PHY_KEY_MAP.get(5) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let diffSpc = getDefconPropValue(MAIN_PHY_KEY_MAP.get(6) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let diffViaSpc = getDefconPropValue(MAIN_PHY_KEY_MAP.get(7) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    
                    // let defaultLayerText = `${stkLayer};Layer;${ruleArea.ruleAreaName};(Default);${index};Signal;;;${twMin};${twTyp};${twExp};${typImp};${diffTypImp};${diffSpc};${diffViaSpc};`;
                    
                    raDefSB.appendLine(defaultLayerText);
                    defaultEntrylayerTrackerSet.add(stkLayer); //we want to execute this only once per layer, and consequently per rule area
                }
                
                let layerText = `${stkLayer};Layer;${ruleArea.ruleAreaName};${netclass.name};${layerIndex};Signal;;;;;;;;;;`;

                let lgToLayerMapForRelevantLGSet = lgSetLayerToLayerGroupMapping.get(netclass.layerGroupSetId)
                if(lgToLayerMapForRelevantLGSet) {
                    let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.layer;
                    let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.lg;
                    if(relevantLayer && relevantLG) {
                        let focusLGC = lgcGroupedByNetclass.get(netclass._id?.toString() as string)?.find(a => a.layerGroupId === relevantLG.id)
                        if(focusLGC)  {
                            let lgcPropsMap = new Map<string, ConstraintValues>()
                            focusLGC.associatedProperties.forEach(x => lgcPropsMap.set(x.name, x.value))
                            
                            let forceDefault = (relevantLayer.isActive && relevantLG.isActive && ruleArea.isActive) ? false : true;

                            let valArr = new Array<string>()
                            for(let p = 0; p < MAIN_PHY_KEY_MAP.size; p++) {
                                let expVal = getLgcPropValue(MAIN_PHY_KEY_MAP.get(p+1) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                                valArr.push(expVal) 
                            }

                            layerText = `${stkLayer};Layer;${ruleArea.ruleAreaName};${netclass.name};${layerIndex};Signal;;;${valArr.join(";")};`;
                            

                            // let twMin = getLgcPropValue(MAIN_PHY_KEY_MAP.get(1) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            // let twTyp = getLgcPropValue(MAIN_PHY_KEY_MAP.get(2) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            // let twExp = getLgcPropValue(MAIN_PHY_KEY_MAP.get(3) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            // let typImp = getLgcPropValue(MAIN_PHY_KEY_MAP.get(4) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            // let diffTypImp = getLgcPropValue(MAIN_PHY_KEY_MAP.get(5) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            // let diffSpc = getLgcPropValue(MAIN_PHY_KEY_MAP.get(6) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            // let diffViaSpc = getLgcPropValue(MAIN_PHY_KEY_MAP.get(7) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);

                            // layerText = `${stkLayer};Layer;${ruleArea.ruleAreaName};${netclass.name};${index};Signal;;;${twMin};${twTyp};${twExp};${typImp};${diffTypImp};${diffSpc};${diffViaSpc};`;
                        }
                    }
                }
                raMainSB.appendLine(layerText)
            }
        }
        ruleAreaDefaultSBDataMap.set(ruleArea.id, raDefSB);
        ruleAreaMainSBDataMap.set(ruleArea.id, raMainSB);
    }
 
    let sb = new StringBuilder();
    sb.appendLine(header1);
    sb.appendLine(header2);
    sb.appendLine(`Date;${getDateStringForExport()};`);
    sb.appendLine(`Description; ${commonDesc};`);
    sb.appendLine();
    sb.appendLine(header3);
    for(let ruleArea of ruleAreasSorted) {
        sb.appendLine(`${ruleArea.ruleAreaName};Scheme;;;;;;;;;;;;;;`);
        sb.appendLine(ruleAreaDefaultSBDataMap.get(ruleArea.id)?.toString()?.trim());
        sb.appendLine(ruleAreaMainSBDataMap.get(ruleArea.id)?.toString()?.trim());
    }

    let retVal = sb.toString();
    return retVal
}



async function generateXpeditionClearanceDataForExport(project: Project, commonDesc: string, pkg: PackageLayout, 
    clrRelationElements: BasicProperty[], lgSetLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>, 
    xpeditionKeyToPropNameMapping: Map<string, string>, defConGoldenId: string, 
    defConDataOrganized:  Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>) : Promise<string> {
    
    let header1 = `Table;Clearance rules;`;
    let header2 = `Display Units;um|Ohm;`;
    let header3 = `Name;Level;Scheme;Clearance rule;Index;Type;Trace To Trace;Trace To Pad;Trace To Via;Trace To Plane;Trace To SMD Pad;`
    + `Pad To Pad;Pad To Via;Pad To Plane;Via To Via;Via To Plane;Via To SMD Pad;Plane To Plane;Embedded Resistor To Trace;Embedded Resistor To Pad;`
    + `Embedded Resistor To Via;Embedded Resistor To Resistor;EP Mask To Trace;EP Mask To Pad;EP Mask To Via;EP Mask To Resistor;`
    + `Bond Finger To Bond Finger;Bond Finger To Trace;Bond Finger To Pad;Bond Finger To Via;Bond Finger To Plane;Bond Finger To SMD Pad;`;

    //Do not mess with this dictionary! Serious ramifications! ==========
    const MAIN_CLR_KEY_MAP = new Map<number, string>([
        [1, "Trace To Trace"],
        [2, "Trace To Pad"],
        [3, "Trace To Via"],
        [4, "Trace To Plane"],
        [5, "Trace To SMD Pad"],
        [6, "Pad To Pad"],
        [7, "Pad To Via"],
        [8, "Pad To Plane"],
        [9, "Via To Via"],
        [10, "Via To Plane"],
        [11, "Via To SMD Pad"],
        [12, "Plane To Plane"],
        [13, "Embedded Resistor To Trace"],
        [14, "Embedded Resistor To Pad"],
        [15, "Embedded Resistor To Via"],
        [16, "Embedded Resistor To Resistor"],
        [17, "EP Mask To Trace"],
        [18, "EP Mask To Pad"],
        [19, "EP Mask To Via"],
        [20, "EP Mask To Resistor"],
        [21, "Bond Finger To Bond Finger"],
        [22, "Bond Finger To Trace"],
        [23, "Bond Finger To Pad"],
        [24, "Bond Finger To Via"],
        [25, "Bond Finger To Plane"],
        [26, "Bond Finger To SMD Pad"],
    ])
    //====================================================================

    let exportLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() === "metal");
    let exportLayerNames = sort(exportLayers).asc(a => a.index)?.map(x => x.name.toUpperCase())
    let clrRelationsSorted = sort(clrRelationElements).asc(x => x.name.toUpperCase())

    let ruleAreaDefaultSBDataMap = new Map<string, StringBuilder>();
    let ruleAreaMainSBDataMap = new Map<string, StringBuilder>();
    let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName.toUpperCase());

    const getDefConDataLine = (propToDefConEntryMap: Map<string, DefConEntry[]> | undefined): string => {
        let t2t = getDefconPropValue(MAIN_CLR_KEY_MAP.get(1) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let t2pad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(2) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let t2via = getDefconPropValue(MAIN_CLR_KEY_MAP.get(3) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let t2plane = getDefconPropValue(MAIN_CLR_KEY_MAP.get(4) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let t2smdpad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(5) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let pad2pad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(6) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let pad2via = getDefconPropValue(MAIN_CLR_KEY_MAP.get(7) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let pad2plane = getDefconPropValue(MAIN_CLR_KEY_MAP.get(8) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let via2via = getDefconPropValue(MAIN_CLR_KEY_MAP.get(9) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let via2plane = getDefconPropValue(MAIN_CLR_KEY_MAP.get(10) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let via2smdpad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(11) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let plane2plane = getDefconPropValue(MAIN_CLR_KEY_MAP.get(12) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let eres2trace = getDefconPropValue(MAIN_CLR_KEY_MAP.get(13) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let eres2pad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(14) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let eres2via = getDefconPropValue(MAIN_CLR_KEY_MAP.get(15) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let eres2res = getDefconPropValue(MAIN_CLR_KEY_MAP.get(16) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let emask2trace = getDefconPropValue(MAIN_CLR_KEY_MAP.get(17) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let emask2pad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(18) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let emask2via = getDefconPropValue(MAIN_CLR_KEY_MAP.get(19) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let emask2res = getDefconPropValue(MAIN_CLR_KEY_MAP.get(20) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let bf2bf = getDefconPropValue(MAIN_CLR_KEY_MAP.get(21) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let bf2trace = getDefconPropValue(MAIN_CLR_KEY_MAP.get(22) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let bf2pad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(23) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let bf2via = getDefconPropValue(MAIN_CLR_KEY_MAP.get(24) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let bf2plane = getDefconPropValue(MAIN_CLR_KEY_MAP.get(25) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);
        let bf2smdpad = getDefconPropValue(MAIN_CLR_KEY_MAP.get(26) as string, xpeditionKeyToPropNameMapping, propToDefConEntryMap);

        let secondSet = `${t2t};${t2pad};${t2via};${t2plane};${t2smdpad};${pad2pad};${pad2via};${pad2plane};${via2via};`
        let thirdSet = `${via2plane};${via2smdpad};${plane2plane};${eres2trace};${eres2pad};${eres2via};${eres2res};`
        let fourthSet = `${emask2trace};${emask2pad};${emask2via};${emask2res};${bf2bf};${bf2trace};${bf2pad};${bf2via};${bf2plane};${bf2smdpad};`;
        
        let returnString = `${secondSet}${thirdSet}${fourthSet}`
        return returnString;
    }

    for(let ruleArea of ruleAreasSorted) {
        let raMainSB = new StringBuilder();
        let raDefSB = new StringBuilder();

		let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
		let rafilter = { ruleAreaId: ruleArea.id, constraintType: ConstraintTypesEnum.Clearance } as Filter<LayerGroupConstraints>
        let lgcList = await lgcRepo.GetAllByProjectID(project._id?.toString() as string, rafilter) ?? []
		let lgcGroupedByClearanceRelation : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId);
        let defaultEntrylayerTrackerSet = new Set<string>();

        for(let relation of clrRelationsSorted) {
            let defConDataSetId = ruleArea.defaultConstraintId || defConGoldenId;
            let lyrToPropNameAndDCEMap = defConDataOrganized.get(defConDataSetId)?.get(ConstraintTypesEnum.Clearance)?.get(ruleArea.xmodName.toUpperCase())

            let surfaceToDefConEntryMap : Map<string, DefConEntry[]> | undefined;
            if(lyrToPropNameAndDCEMap && lyrToPropNameAndDCEMap.has(StackupConstants.SurfaceLayerName)) {
                surfaceToDefConEntryMap = lyrToPropNameAndDCEMap.get(StackupConstants.SurfaceLayerName); 
            }
            else if (lyrToPropNameAndDCEMap && lyrToPropNameAndDCEMap.has(StackupConstants.LAYER_SURFACE_OUTER)) {
                surfaceToDefConEntryMap = lyrToPropNameAndDCEMap?.get(StackupConstants.LAYER_SURFACE_OUTER);
            }

            let clearRuleLineFirstSet = `${relation.name.trim()};ClearRule;${ruleArea.ruleAreaName};;;;`
            let clearRuleLinePostFixStr = getDefConDataLine(surfaceToDefConEntryMap)
            let clearRuleLineRuleAreaFinalText = `${clearRuleLineFirstSet}${clearRuleLinePostFixStr}`

            raMainSB.appendLine(clearRuleLineRuleAreaFinalText)
            
            for(let i = 0; i < exportLayerNames.length; i++) {
                let stkLayer = exportLayerNames[i]
                let index = i + 1;

                if(defaultEntrylayerTrackerSet.has(stkLayer) === false) {
                    let propToDefConEntryMap = lyrToPropNameAndDCEMap?.get(stkLayer.toUpperCase())

                    let firstSet = `${stkLayer};Layer;${ruleArea.ruleAreaName};(Default Rule);${index};Signal;`
                    let postFixStr = getDefConDataLine(propToDefConEntryMap)
                    let defaultLayerText = `${firstSet}${postFixStr}`

                    raDefSB.appendLine(defaultLayerText);
                    defaultEntrylayerTrackerSet.add(stkLayer); //we want to execute this only once per layer, and consequently per rule area
                }
                
                let layerText = `${stkLayer};Layer;${ruleArea.ruleAreaName};${relation.name};${index};Signal;;;;;;;;;;;;;;;;;;;;;;;;;;;`;

                let lgToLayerMapForRelevantLGSet = lgSetLayerToLayerGroupMapping.get(relation.value)
                if(lgToLayerMapForRelevantLGSet) {
                    let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.layer;
                    let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.lg;
                    if(relevantLayer && relevantLG) {
                        let focusLGC = lgcGroupedByClearanceRelation.get(relation.id?.toString() as string)?.find(a => a.layerGroupId === relevantLG.id)
                        if(focusLGC)  {
                            let lgcPropsMap = new Map<string, ConstraintValues>()
                            focusLGC.associatedProperties.forEach(x => lgcPropsMap.set(x.name, x.value))
                            
                            let forceDefault = (relevantLayer.isActive && relevantLG.isActive && ruleArea.isActive) ? false : true;

                            let t2t = getLgcPropValue(MAIN_CLR_KEY_MAP.get(1) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let t2pad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(2) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let t2via = getLgcPropValue(MAIN_CLR_KEY_MAP.get(3) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let t2plane = getLgcPropValue(MAIN_CLR_KEY_MAP.get(4) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let t2smdpad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(5) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let pad2pad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(6) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let pad2via = getLgcPropValue(MAIN_CLR_KEY_MAP.get(7) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let pad2plane = getLgcPropValue(MAIN_CLR_KEY_MAP.get(8) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let via2via = getLgcPropValue(MAIN_CLR_KEY_MAP.get(9) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let via2plane = getLgcPropValue(MAIN_CLR_KEY_MAP.get(10) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let via2smdpad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(11) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let plane2plane = getLgcPropValue(MAIN_CLR_KEY_MAP.get(12) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let eres2trace = getLgcPropValue(MAIN_CLR_KEY_MAP.get(13) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let eres2pad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(14) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let eres2via = getLgcPropValue(MAIN_CLR_KEY_MAP.get(15) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let eres2res = getLgcPropValue(MAIN_CLR_KEY_MAP.get(16) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let emask2trace = getLgcPropValue(MAIN_CLR_KEY_MAP.get(17) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let emask2pad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(18) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let emask2via = getLgcPropValue(MAIN_CLR_KEY_MAP.get(19) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let emask2res = getLgcPropValue(MAIN_CLR_KEY_MAP.get(20) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let bf2bf = getLgcPropValue(MAIN_CLR_KEY_MAP.get(21) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let bf2trace = getLgcPropValue(MAIN_CLR_KEY_MAP.get(22) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let bf2pad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(23) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let bf2via = getLgcPropValue(MAIN_CLR_KEY_MAP.get(24) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let bf2plane = getLgcPropValue(MAIN_CLR_KEY_MAP.get(25) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);
                            let bf2smdpad = getLgcPropValue(MAIN_CLR_KEY_MAP.get(26) as string, forceDefault, xpeditionKeyToPropNameMapping, lgcPropsMap);

                            let firstSet = `${stkLayer};Layer;${ruleArea.ruleAreaName};${relation.name};${index};Signal;`
                            let secondSet = `${t2t};${t2pad};${t2via};${t2plane};${t2smdpad};${pad2pad};${pad2via};${pad2plane};${via2via};`
                            let thirdSet = `${via2plane};${via2smdpad};${plane2plane};${eres2trace};${eres2pad};${eres2via};${eres2res};`
                            let fourthSet = `${emask2trace};${emask2pad};${emask2via};${emask2res};${bf2bf};${bf2trace};${bf2pad};${bf2via};${bf2plane};${bf2smdpad};`;
                            
                            layerText = `${firstSet}${secondSet}${thirdSet}${fourthSet}`
                            
                        }
                    }
                }
                raMainSB.appendLine(layerText)
            }
        }
        ruleAreaDefaultSBDataMap.set(ruleArea.id, raDefSB);
        ruleAreaMainSBDataMap.set(ruleArea.id, raMainSB);
    }

    let sb = new StringBuilder();
    sb.appendLine(header1);
    sb.appendLine(header2);
    sb.appendLine(`Date;${getDateStringForExport()};`);
    sb.appendLine(`Description; ${commonDesc};`);
    sb.appendLine();
    sb.appendLine(header3);
    for(let ruleArea of ruleAreasSorted) {
        sb.appendLine(`${ruleArea.ruleAreaName};Scheme;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;`);
        sb.appendLine(ruleAreaDefaultSBDataMap.get(ruleArea.id)?.toString()?.trim());
        sb.appendLine(ruleAreaMainSBDataMap.get(ruleArea.id)?.toString()?.trim());
    }

    let retVal = sb.toString();
    return retVal
}



async function generateXpeditionClassToClassDataForExport(project: Project, commonDesc: string, pkg: PackageLayout, netclasses: Netclass[], clrRelationElements: BasicProperty[]) : Promise<string> {
    try {
        let sb = new StringBuilder();

        let header1 = `Table;Class to class clearances;`;
        let header2 = `Display Units;;`;
        let header3 = `Scheme;From Net Class;To Net Class;Clearance rule;`;

        sb.appendLine(header1);
        sb.appendLine(header2);
        sb.appendLine(`Date;${getDateStringForExport()};`);
        sb.appendLine(`Description; ${commonDesc};`);
        sb.appendLine();
        sb.appendLine(header3);

        let netclassNameMapping = new Map<string, string>();
        for(let nc of netclasses) {
            netclassNameMapping.set(nc._id?.toString() as string, nc.name);
        }

        let clrRelationNameMapping = new Map<string, string>();
        for(let rel of clrRelationElements) {
            clrRelationNameMapping.set(rel.id?.toString() as string, rel.name);
        }

        let c2crRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)

        for(let ruleArea of pkg.ruleAreas) {
            let filter = { ruleAreaId: ruleArea.id }
            let c2crList = await c2crRepo.GetAllByProjectID(project?._id?.toString() as string, filter);
            if(c2crList && c2crList.length > 0) {
                let c2crListSorted = sort(c2crList).asc(x => netclassNameMapping.get(x.netclassId)?.toUpperCase())
                for(let c2cr of c2crListSorted) {
                    if(c2cr.slots && c2cr.slots.length > 0) {
                        let netclassName = netclassNameMapping.get(c2cr.netclassId)
                        for(let slot of c2cr.slots) {
                            if(slot.value && slot.value.length > 0) {
                                let slotName = (slot.name === C2C_ROW_ALLCOLUMN_SLOT_NAME) 
                                    ? "(All)"   //Important This is not all uppercase - the 'ALL' is not acceptable to Expedition/CES
                                    : netclassNameMapping.get(slot.netclassId);

                                let relName = clrRelationNameMapping.get(slot.value)
                                sb.appendLine(`${ruleArea.ruleAreaName};${netclassName};${slotName || ''};${relName || ''};`);
                            }
                        }
                    }
                }
            }
        }

        let retVal = sb.toString();
        return retVal;
    }
    catch (error: any) {
        throw new Error(`Failed to generate class-to-class relation data for export. --- ${error.message}`);
    }
}



async function generateXpeditionNetsDataForExport(project: Project, commonDesc: string, netclasses: Netclass[]) : Promise<string> {
    try {
        let sb = new StringBuilder();

        let header1 = `Table;Nets;`;
        let header2 = `Display Units;um|Ohm|V|ns|mA/th^2|A;`;
        let header3 = `Name;Level;Constraint class;Differential pair;Electrical net;Physical net;Pins;`
            + `Net class;Length or TOF Delay Type;Length or TOF Delay Min;Length or TOF Delay Max;Length or TOF Delay Match;`
            + `Length or TOF Delay Tol;Template Name;Template Status;Topology Type;Topology Ordered; Analog;Bus;`
            + `Stub Length Max;# Vias Max;Max Restricted Layer Length External;Max Restricted Layer Length Internal;`
            + `From To Constraints Layer;From To Constraints Trace Width;From To Constraints Z0;Formula;Static Low Overshoot Max;`
            + `Static High Overshoot Max;Dynamic Low Overshoot Max;Dynamic High Overshoot Max;Ringback Margin High Min;`
            + `Ringback Margin Low Min;Non-Monotonic Edge;Single Ended Characteristic Impedance Value;`
            + `Single Ended Characteristic Impedance Tol;Simulated Delay Edge;Simulated Delay Min;Simulated Delay Max;Simulated Delay Max Range;`
            + `Simulated Delay Match To;Simulated Delay Match;Simulated Delay Offset;Simulated Delay Tol;Differential Pair Tol Max;`
            + `Differential Pair Phase Tol Max;Differential Pair Phase Tol Distance Max;Convergence Tolerance Max;`
            + `Distance to Convergence Max;Separation Distance Max;Differential Spacing;Differential Impedance Target;`
            + `Differential Impedance Tolerance;I/O Standard;Power Net Constraints Supply Voltage;Power Net Constraints Max Voltage Drop;`
            + `Power Net Constraints Max Current Density;Power Net Constraints Max Via Current;`;

        sb.appendLine(header1);
        sb.appendLine(header2);
        sb.appendLine(`Date;${getDateStringForExport()};`);
        sb.appendLine(`Description; ${commonDesc};`);
        sb.appendLine();
        sb.appendLine(header3);

        let netclassNameMapping = new Map<string, string>();
        for(let nc of netclasses) {
            netclassNameMapping.set(nc._id?.toString() as string, nc.name);
        }

        let pwrNetsToIgnore = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS && a.name === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS))
        
        let netsToIgnore : Set<string> = (pwrNetsToIgnore && pwrNetsToIgnore.value) 
            ? new Set(pwrNetsToIgnore.value?.map((x: string) => x.toLowerCase()) ?? []) 
            : new Set();

        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

        const netCursor = netRepo.GetCursorByProjectIDAndProjection(project._id?.toString() as string, null, null, NET_RETRIEVAL_BATCH_SIZE)
        
        for await (let oneNet of netCursor) { 
            if(netsToIgnore.has(oneNet.name.toLowerCase()) === false) {
                let ncName = `(Default)`;
                if(oneNet.netclassId && oneNet.netclassId.trim().length > 0) {
                    if (netclassNameMapping.has(oneNet.netclassId)) {
                        ncName = netclassNameMapping.get(oneNet.netclassId) as string;
                    }
                }
                sb.appendLine(`${oneNet.name};ElecNet;${ncName};;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;`);
            }
        }

        let retVal = sb.toString();
        return retVal;
    }
    catch (error: any) {
        throw new Error(`Failed to generate Nets constraints data for export. --- ${error.message}`);
    }
}



async function generateXpeditionVBSDataForExport(project: Project, commonDesc: string, physFN: string, clrFN: string, c2cRelFN: string, netListFN: string, 
    netclasses: Netclass[], importExportConfigs: ConfigItem[], netExportSettingsMap: Map<string, ConstraintConfExportContext>, specialCaseMap: Map<string, string>) : Promise<string> {
    try {
        let ncCreateSB = new StringBuilder();
        let ncAssignSB = new StringBuilder();
        let dpSetupSB = new StringBuilder();
        let dpConstrSB = new StringBuilder();
        let ruleSetupSB = new StringBuilder();

        let projectId = project._id?.toString() as string;
        let vbsContent : string = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__XPEDITION_VBS_TEMPLATE.toLowerCase())?.configValue?.trim() ?? null
        if(!vbsContent || vbsContent.length === 0) {
            throw new Error(`Could not find template for exportable vbs content. Check config management system!`)
        } 

        vbsContent = vbsContent.replaceAll("####_REPL_COMMON_DESCRIPTION_####", commonDesc);

        vbsContent = vbsContent.replaceAll("####_REPL_PHYS_CONSTR_FILE_NAME_####", physFN);
        vbsContent = vbsContent.replaceAll("####_REPL_CLR_CONSTR_FILE_NAME_####", clrFN);
        vbsContent = vbsContent.replaceAll("####_REPL_NETS_CONSTR_FILE_NAME_####", netListFN);
        vbsContent = vbsContent.replaceAll("####_REPL_CLASS_RELATIONS_CONSTR_FILE_NAME_####", c2cRelFN);

        ncCreateSB.appendLine(`call CESImport.GetHierClass(\"(Default)\", true, true)`);

        let netclassNameMapping = new Map<string, string>();
        let dpNetIdToNameMapping = new Map<string, [string, string, string]>();

        for(let nc of netclasses) {
            ncCreateSB.appendLine(`call CESImport.CreateNetClass(\"${nc.name}\")`);
            ncCreateSB.appendLine(`call CESImport.GetHierClass(\"${nc.name}\", true, true)`);
            netclassNameMapping.set(nc._id?.toString() as string, nc.name);
        }

        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

        let dpNetfilters = [{ diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>]
        const dpNetCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, dpNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
        
        for await (const initDPNet of dpNetCursor) { 
            if(dpNetIdToNameMapping.has(initDPNet.diffPairNet)) {
                dpNetIdToNameMapping.set(initDPNet.diffPairNet, [initDPNet._id?.toString(), initDPNet.name, initDPNet.netclassId]);
            }
            else {
                dpNetIdToNameMapping.set(initDPNet._id?.toString(), [initDPNet.diffPairNet, '', '']);
            }
        }
        
        dpNetCursor.rewind();

        for await (const dpNet of dpNetCursor) { 
            if(dpNet.netclassId && dpNet.netclassId.length > 0) {
                let netclassName = netclassNameMapping.get(dpNet.netclassId) as string
                ncAssignSB.appendLine(`call CESImport.AssignNetToNetClass(\"${dpNet.name}\",\"${netclassName}\")`);
            }

            let correspNetName = dpNetIdToNameMapping.get(dpNet._id?.toString())?.at(1) ?? dpNetIdToNameMapping.get(dpNet.diffPairNet)?.at(1)
            let correspNetNCID = (dpNetIdToNameMapping.get(dpNet._id?.toString())?.at(2) ?? dpNetIdToNameMapping.get(dpNet.diffPairNet)?.at(2))?.trim() || ''
            let dpNetNCID = dpNet.netclassId?.trim() || ''
            let dpEntityName : string = "";
            
            if(correspNetName) {
                let sorted = sort([dpNet.name, correspNetName]).asc(x => x.toUpperCase())
                dpEntityName = `${sorted[0]}___${sorted[1]}`
                dpSetupSB.appendLine(`call CESImport.CreateDiffPair(\"${dpNet.name}\",\"${correspNetName}\",\"${dpEntityName}\")`);

                if(dpNetNCID !== correspNetNCID) {  //Important!
                    throw new Error(`Error on diff pair assessment. Diff pair net '${dpNet.name}' and its corresponding pair '${correspNetName}' must belong to the same netclass`) 
                }
            }

            let netPropInfoMap = new Map<string, ConstraintValues>();
            for(let prop of dpNet.associatedProperties ?? []) {
                netPropInfoMap.set(prop.name, prop.value);
            }
            
            for(let [propName, exportCtx] of netExportSettingsMap) {
                let propValElement = netPropInfoMap.get(propName)
                let propValue = getMostAppropriateConstraintValue(propValElement);
                let expKeyItemStr = exportCtx.xpeditionKeys?.at(0);
                let extraKeyItemStr = exportCtx.extraKeys?.at(0) || '';

                if (expKeyItemStr) {
                    if(correspNetName && exportCtx.setToDiffPairEntity && exportCtx.setToDiffPairEntity === true) {
                        dpConstrSB.appendLine(`call CESImport.SetRuleValue(\"ENET\",\"${dpEntityName}\",\"${expKeyItemStr}\",\"${propValue}\")`);
                    }
                    
                    if(expKeyItemStr?.toUpperCase() === "MATCH_GROUP" ) {
                        let mgName : string = '', mgValue : string = ''
                        if(specialCaseMap.has(propValue)) {
                            mgName = specialCaseMap.get(propValue)  || '';
                        }
                        if(mgName && specialCaseMap.has(mgName)) {
                            mgValue = specialCaseMap.get(mgName) || '';
                            ruleSetupSB.appendLine(`call CESImport.SetRuleValue(\"ENET\",\"${dpNet.name}\",\"${expKeyItemStr}\",\"${mgName}\")`);
                            ruleSetupSB.appendLine(`call CESImport.SetRuleValue(\"ENET\",\"${dpNet.name}\",\"${extraKeyItemStr}\",\"${mgValue}\")`);
                        }
                    }
                    else {
                        if(propValue && propValue.length > 0) {
                            ruleSetupSB.appendLine(`call CESImport.SetRuleValue(\"ENET\",\"${dpNet.name}\",\"${expKeyItemStr}\",\"${propValue}\")`);
                        }
                    }
                }
            }

            if(correspNetName) {
                dpNetIdToNameMapping.delete(dpNet._id?.toString());
                dpNetIdToNameMapping.delete(dpNet.diffPairNet);
            }
        }

        //-------------------------------------------------------------

        let regNetfilters = [{ diffPairMapType: DataMappingTypeEnum.Unmapped } as Filter<Net>]
        const regNetCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, regNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
        
        for await (const regNet of regNetCursor) { 
            if(regNet.netclassId && regNet.netclassId.length > 0) {
                let netclassName = netclassNameMapping.get(regNet.netclassId) as string
                ncAssignSB.appendLine(`call CESImport.AssignNetToNetClass(\"${regNet.name}\",\"${netclassName}\")`);
            }

            let netPropInfoMap = new Map<string, ConstraintValues>();
            for(let prop of regNet.associatedProperties ?? []) {
                netPropInfoMap.set(prop.name, prop.value);
            }
            
            for(let [propName, exportCtx] of netExportSettingsMap) {
                let propValElement = netPropInfoMap.get(propName)
                let propValue = getMostAppropriateConstraintValue(propValElement);
                let expKeyItemStr = exportCtx.xpeditionKeys?.at(0);
                let extraKeyItemStr = exportCtx.extraKeys?.at(0) || '';

                if (expKeyItemStr) {
                    if(expKeyItemStr?.toUpperCase() === "MATCH_GROUP" ) {
                        let mgName : string = '', mgValue : string = ''
                        if(specialCaseMap.has(propValue)) {
                            mgName = specialCaseMap.get(propValue) || '';
                        }
                        if(mgName && specialCaseMap.has(mgName)) {
                            mgValue = specialCaseMap.get(mgName) || '';
                            ruleSetupSB.appendLine(`call CESImport.SetRuleValue(\"ENET\",\"${regNet.name}\",\"${expKeyItemStr}\",\"${mgName}\")`);
                            ruleSetupSB.appendLine(`call CESImport.SetRuleValue(\"ENET\",\"${regNet.name}\",\"${extraKeyItemStr}\",\"${mgValue}\")`);
                        }
                    }
                    else {
                        if(propValue && propValue.length > 0) {
                            ruleSetupSB.appendLine(`call CESImport.SetRuleValue(\"ENET\",\"${regNet.name}\",\"${expKeyItemStr}\",\"${propValue}\")`);
                        }
                    }
                }
            }
        }
        
        ncCreateSB.appendLine();
        ncAssignSB.appendLine();
        dpSetupSB.appendLine();
        dpConstrSB.appendLine();
        ruleSetupSB.appendLine()

        let retVal = ncCreateSB.toString().concat(ncAssignSB.toString(), dpSetupSB.toString(), dpConstrSB.toString(), ruleSetupSB.toString());
        vbsContent = vbsContent.replace("####_REPL_SET_CONTENT_####", retVal);

        return vbsContent;
    
    }
    catch (error: any) {
        throw new Error(`An error occured while creating VBS data for export --- ${error.message}`);
    }
}



async function generateXpeditionReadMeForExport(project: Project, commonDesc: string, importExportConfigs: ConfigItem[]) : Promise<string> {
    let readmeContent : string = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__XPEDITION_IMPORT_README.toLowerCase())?.configValue?.trim() ?? null
    if(!readmeContent || readmeContent.trim().length === 0) {
        throw new Error(`Could not find template for exportable readme file. Check config management system!`)
    } 

    readmeContent = readmeContent.replaceAll("####_REPL_COMMON_DESCRIPTION_####", commonDesc);
    readmeContent = readmeContent.replaceAll("####_REPL_PROJECT_ID_####", project._id?.toString() as string);
    readmeContent = readmeContent.replaceAll("####_REPL_PROJECT_NAME_####", project.name);

    return readmeContent;
}










// let expKey = exportSettings.xpeditionKeys.replaceAll(" ", "").toUpperCase()
//                     clrXpedKeyToPropNameMapping.set(expKey, prop.name)

//TODO: generateXpeditionNetsDataForExport() -- Log non-fatal error when netclass is indicated but non existent
//console.error(`Net item [${net.Name}] is assigned to a Netclass. However the Netclass is unknown or invalid within current project!`);



//===================================================================


                    // let t2t = getDefconPropValue("Trace To Trace", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let t2pad = getDefconPropValue("Trace To Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let t2via = getDefconPropValue("Trace To Via", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let t2plane = getDefconPropValue("Trace To Plane", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let t2smdpad = getDefconPropValue("Trace To SMD Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let pad2pad = getDefconPropValue("Pad To Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let pad2via = getDefconPropValue("Pad To Via", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let pad2plane = getDefconPropValue("Pad To Plane", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let via2via = getDefconPropValue("Via To Via", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let via2plane = getDefconPropValue("Via To Plane", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let via2smdpad = getDefconPropValue("Via To SMD Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let plane2plane = getDefconPropValue("Plane To Plane", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let eres2trace = getDefconPropValue("Embedded Resistor To Trace", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let eres2pad = getDefconPropValue("Embedded Resistor To Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let eres2via = getDefconPropValue("Embedded Resistor To Via", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let eres2res = getDefconPropValue("Embedded Resistor To Resistor", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let emask2trace = getDefconPropValue("EP Mask To Trace", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let emask2pad = getDefconPropValue("EP Mask To Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let emask2via = getDefconPropValue("EP Mask To Via", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let emask2res = getDefconPropValue("EP Mask To Resistor", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let bf2bf = getDefconPropValue("Bond Finger To Bond Finger", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let bf2trace = getDefconPropValue("Bond Finger To Trace", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let bf2pad = getDefconPropValue("Bond Finger To Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let bf2via = getDefconPropValue("Bond Finger To Via", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let bf2plane = getDefconPropValue("Bond Finger To Plane", xpeditionKeyToPropNameMapping, propToDefConEntryMap);
                    // let bf2smdpad = getDefconPropValue("Bond Finger To SMD Pad", xpeditionKeyToPropNameMapping, propToDefConEntryMap);

                    // let firstSet = `${stkLayer};Layer;${ruleArea.ruleAreaName};(Default Rule);${index};Signal;`
                    // let secondSet = `${t2t};${t2pad};${t2via};${t2plane};${t2smdpad};${pad2pad};${pad2via};${pad2plane};${via2via};`
                    // let thirdSet = `${via2plane};${via2smdpad};${plane2plane};${eres2trace};${eres2pad};${eres2via};${eres2res};`
                    // let fourthSet = `${emask2trace};${emask2pad};${emask2via};${emask2res};${bf2bf};${bf2trace};${bf2pad};${bf2via};${bf2plane};${bf2smdpad};`;
                    
                    // let defaultLayerText = `${firstSet}${secondSet}${thirdSet}${fourthSet}`

//======================================================================




    // let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    // let projection = { name: 1, link: 1 }
    // let interfaceList = await ifaceRepo.GetAllByProjectIDAndProjection(pkg.projectId, null, projection)

    //get all clearance relations for the project





// && (ruleArea.physicalInterfaceExclusionList.includes(netclass.interfaceId) === false)

// && (ruleArea.clearanceInterfaceExclusionList.includes(relation.interfaceId) === false)


// let netConstrProps = allConstrProps?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase())
//     for(let prop of netConstrProps) {
//         let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
//         if(exportSettings && exportSettings.xpeditionKey && exportSettings.xpeditionKey.length > 0) {
//             netExportSettingsMap.set(prop.name, exportSettings)
//         }
//     }



// const person = {
//     name: "John",
//     age: 20
// };
// const person2 = {
//     name: "Howard",
//     age: 42
// };
// const admin = {
//     division: "admissions",
//     age: 60,
//     specialty: "none",
//     email: "admin@admissionsdept.com",
//     hireDate: new Date()
// };
// const student1 = {
//     firstName: "Jack",
//     rollNo: 22,
//     faceClass: "Chemistry"
// };
// const student2 = {
//     firstName: "Penny",
//     rollNo: 33,
//     faceClass: "Philosophy"
// };
// const student3 = {
//     firstName: "Tyrone",
//     rollNo: 44,
//     faceClass: "Biology"
// };
// const student4 = {
//     firstName: "Julius",
//     rollNo: 55,
//     faceClass: "Math"
// };

// let data = [person, person2, admin, student1, student2, student3, student4]
// var csv = Papa.unparse(data);