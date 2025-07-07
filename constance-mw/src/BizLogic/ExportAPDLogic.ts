import AdmZip from "adm-zip";
import xmlFormat from 'xml-formatter';
import { DBCollectionTypeEnum, ConstraintPropertyCategoryEnum, AppConfigConstants, DataMappingTypeEnum, NET_RETRIEVAL_BATCH_SIZE, ConstraintTypesEnum, C2C_ROW_ALLCOLUMN_SLOT_NAME } from "../Models/Constants";
import { BasicKVP, BasicProperty, ConfigItem, ConstraintConfExportContext, ConstraintValues, StringBuilder, User } from "../Models/HelperModels";
import { C2CRow, DefaultConstraints, DefConEntry, Interface, Layer, LayerGroup, LayerGroupConstraints, Net, Netclass, PackageLayout, Project, RuleArea, StackupLayer } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { getGenConfigs, getImportExportConfigs } from "./ConfigLogic";
import { getDefconPropValue, organizeDefaultConstraints, pushDefaultConstraints } from "./DefaultConstraintsLogic";
import { Filter } from "mongodb";
import { sort } from "fast-sort";
import { groupBy } from "./UtilFunctions";
import { getLgcPropValue } from "./ConstraintsMgmtLogic";
import  hash_sum from "hash-sum"



interface APDConstrInfo {
    outString: string;
    mapping: Map<string, Map<string, string>>;
}


export async function produceAPDConstraintExportZip(project: Project, user: User|null, commonDesc: string) : Promise<Buffer> {
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
    let ncidToNetclassMapping = new Map<string, Netclass>();
    for(let nc of netclasses) {
        ncidToNetclassMapping.set(nc._id?.toString() as string, nc)
    }

    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let projection = { name: 1, createdOn: 1, createdBy: 1, associatedProperties: 1 }
    let interfaceList = await ifaceRepo.GetAllByProjectIDAndProjection(pkg.projectId, null, projection) ?? []
    let ifaceIdToNameMapping = new Map<string, string>();
    for(let iface of interfaceList) {
        ifaceIdToNameMapping.set(iface._id?.toString() as string, iface.name)
    }

    let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
    let defConList = await defConRepo.GetAllByProjectID(pkg.projectId);
    if(!defConList || defConList.length === 0) { 
        throw new Error(`Cannot process constraints retrieval. Default constrints were not found for the project.`) 
    }
    let defConGolden = defConList.find(a => (a.isGolden === true));
    let defConGoldenId = defConGolden?._id?.toString() as string
    let defConDataOrganized : Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>> = organizeDefaultConstraints(defConList);

    let clrRelationElements : BasicProperty[] = project.clearanceRelationBrands ?? []

    let netExportSettingsMap = new Map<string, ConstraintConfExportContext>()
    let phyAPDKeyToPropNameMapping = new Map<string, string>();
    let clrAPDKeyToPropNameMapping = new Map<string, string>();
    
    if(!project.constraintSettings || project.constraintSettings.length === 0){  //for good measures...
        throw new Error(`Could not process data export. Constraint properties were not found for the project.`)
    }

    for(let prop of project.constraintSettings) {
        if(prop.category) {
            //get the export config for the given prop item 
            let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "export_context")?.value
            
            if(exportSettings && exportSettings.apdKeys && exportSettings.apdKeys.length > 0) {
                if (prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
                    netExportSettingsMap.set(prop.name, exportSettings)
                }
                else if(prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase()) {
                    for(let expEntry of exportSettings.apdKeys) {
                        let expKey = expEntry.trim().replaceAll(" ", "").toUpperCase()
                        if(phyAPDKeyToPropNameMapping.has(expKey) && (phyAPDKeyToPropNameMapping.get(expKey) as string).trim().toLowerCase() !== prop.name.toLowerCase()) {
                            throw new Error(`Could not process data export. Same export keys assigned to multiple Constraint properties. `
                                + `PropertyType: '${prop.category}'. Conflicting Key: '${expEntry}'`)
                        }
                        else {
                            phyAPDKeyToPropNameMapping.set(expKey, prop.name)
                        }
                    }
                }
                else if(prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase()) {
                    for(let expEntry of exportSettings.apdKeys) {
                        let expKey = expEntry.replaceAll(" ", "").toUpperCase()
                        if(clrAPDKeyToPropNameMapping.has(expKey) && (clrAPDKeyToPropNameMapping.get(expKey) as string).trim().toLowerCase() !== prop.name.toLowerCase()) {
                            throw new Error(`Could not process data export. Same export keys assigned to multiple Constraint properties. `
                                + `PropertyType: '${prop.category}'. Conflicting Key: '${expEntry}'`)
                        }
                        else {
                            clrAPDKeyToPropNameMapping.set(expKey, prop.name)
                        }
                    }
                }
            }
        }
    }

    let lgSetToLayerToLayerGroupMapping = new Map<string, Map<string, {layer: Layer, lg: LayerGroup}>>();
    for(let lgSet of pkg.layerGroupSets) {
        let innerMap = new Map<string, {layer: Layer, lg: LayerGroup}>();
        for(let lg of lgSet.layerGroups) {
            for(let layer of lg.layers) {
                let name = layer.name.toUpperCase();
                innerMap.set(name, {layer: layer, lg: lg})
            }
        }
        lgSetToLayerToLayerGroupMapping.set(lgSet.id, innerMap);
    }

    let reslv = await Promise.all([getImportExportConfigs(), getGenConfigs(pkg.projectId, project.org, false)]);
    let importExportConfigs = reslv[0]
    let genConfigs = reslv[1]

    let xmodNameMapping = new Map<string, string>();

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

    let defPhysicalRAKey = (`DEFAULT_PHY_${hash_sum(crypto.randomUUID())}`).toUpperCase();
    let defClearanceRAKey = (`DEFAULT_SPC_${hash_sum(crypto.randomUUID())}`).toUpperCase();

    await pushDefaultConstraints(pkg.projectId, defConDataOrganized);

    let filesForZip = new Map<string, [string, string]>();

    let diffPairFN  = "export_diffpairs.csv";
    let netclassFN = "export_netclasses.csv";
    let physFN = `export_trace.csv`;
    let clrFN = `export_space.csv`;
    let raFN = "export_ruleareas.csv";
    
    let batExecLogFileName = "logger.log";
    let accxFileNamePrefix = "apd_batch";
    let accReportXmlFileNamePrefix = "./ACC_REPORT";
    let mcmFilePath = `.`;
    let ilFileName = "cadence_acc_load.il";
    let scrFileName = "cadence_skill_load.scr";
    let batFileName = "import.bat";
    let readmeFN = `README.txt`;


    //-------------------- constraints ------------------------
    let dpInfo = await getDiffPairExportStr(pkg.projectId, commonDesc, ifaceIdToNameMapping, importExportConfigs);
    
    let phyExport : APDConstrInfo = await getPhysicalConstraintExportStr(project, commonDesc, pkg, netclasses, lgSetToLayerToLayerGroupMapping, 
        phyAPDKeyToPropNameMapping, defConDataOrganized, defConGoldenId, xmodNameMapping, importExportConfigs, defPhysicalRAKey)
    
    let clrExport : APDConstrInfo = await getClearanceConstraintExportStr(project, commonDesc, pkg, clrRelationElements, lgSetToLayerToLayerGroupMapping, 
        clrAPDKeyToPropNameMapping, defConDataOrganized, defConGoldenId, xmodNameMapping, importExportConfigs, defClearanceRAKey)
    
    let netclassExport: string = await getNetclassExportStr(pkg.projectId, commonDesc, ifaceIdToNameMapping, ncidToNetclassMapping, dpInfo.dpNetclassMap, 
        phyExport.mapping.get(defPhysicalRAKey)?.get(defPhysicalRAKey) as string, clrExport.mapping.get(defClearanceRAKey)?.get(defClearanceRAKey) as string, importExportConfigs);
        
    let ruleAreaExport = await getRuleAreaExportStr(pkg.projectId, commonDesc, pkg, phyExport.mapping, clrExport.mapping, ncidToNetclassMapping, clrRelationElements);
    //---------------------------------------------------------
    

    let apdExportConstraints = new Array<[string, Map<string, string>]>();
    apdExportConstraints.push(["diffpairs", new Map<string, string>([ [diffPairFN, dpInfo.dpOutStr] ])])
    apdExportConstraints.push(["constraints", new Map<string, string>([ [physFN, phyExport.outString], [clrFN, clrExport.outString] ])])
    apdExportConstraints.push(["netclasses", new Map<string, string>([ [netclassFN, netclassExport] ])])
    apdExportConstraints.push(["ruleareas", new Map<string, string>([ [raFN, ruleAreaExport]])])
    


    //----------------- cadence export files etc --------------
    // get accx files
    let accxDefDict : BasicKVP[] = await getACCBatchingXMLDefinitions(accReportXmlFileNamePrefix, accxFileNamePrefix, mcmFilePath, apdExportConstraints);

    // write [acc_batch_load.il] string
    let ilScript : string = getACCBatchLoadILScript(accxDefDict);

    // write [load-constraints.scr] string
    let scrLoaderScript = getLoadConstrSCRScript(ilFileName);
    
    // write bat script
    let batScript = getDeploymentBatScript(scrFileName, batExecLogFileName, importExportConfigs);
    
    // write readme script
    let readme = getReadmeFile(project, batFileName, commonDesc, batExecLogFileName, accReportXmlFileNamePrefix, importExportConfigs);
    //---------------------------------------------------------
    

    filesForZip.set(diffPairFN, [dpInfo.dpOutStr, "diff pair definitions file"]);               //diff pairs
    filesForZip.set(netclassFN, [netclassExport, "netclass definition file"]);                  //netclasses
    filesForZip.set(physFN, [phyExport.outString, `physical constraints export file`]);         //physical|trace
    filesForZip.set(clrFN, [clrExport.outString, `clearance constraints export file`]);         //clearance|space
    filesForZip.set(raFN, [ruleAreaExport, `region constraints export file`]);                  //regions

    accxDefDict.forEach(a => filesForZip.set(a.key, [a.value, "accx batching xml def file"]));  //accx files

    filesForZip.set(ilFileName, [ilScript, "acc batch loader script file"]);                    //il loader script
    filesForZip.set(scrFileName, [scrLoaderScript, "constraint loader scr file"]);              //scr loader script
    filesForZip.set(batFileName, [batScript, "main import bat script"]);                        //bat script
    filesForZip.set(readmeFN, [readme, "apd import readme file"]);                              //readme file
    
    for (let [fileName, arr] of filesForZip) {
        zip.addFile(fileName, Buffer.from(arr[0] || '', "utf8"), arr[1]);
    }
    
    let zipFileContents = zip.toBuffer();
    return zipFileContents
}


async function getDiffPairExportStr(projectId: string, commonDesc: string, ifaceIdToNameMapping: Map<string, string>, importExportConfigs: ConfigItem[]) : Promise<{dpOutStr: string, dpNetclassMap: Map<string, Set<string>>}>{
    let diffPairOutputSB = new StringBuilder();
    let dpNetIdtoNameMapping = new Map<string, [string, string, string]>();
    let dpNetclassToDPNameMapping = new Map<string, Set<string>>();

    let replPairs = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__CADENCE_IMPORT_NET_NAME_CHAR_REPL.toLowerCase())?.configValue ?? [] 

    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

    let dpNetfilters = [{ diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>]
    const dpNetCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, dpNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
    
    for await (const initDPNet of dpNetCursor) { 
        if(dpNetIdtoNameMapping.has(initDPNet.diffPairNet)) {
            dpNetIdtoNameMapping.set(initDPNet.diffPairNet, [initDPNet._id?.toString(), initDPNet.name, initDPNet.netclassId]);
        }
        else {
            dpNetIdtoNameMapping.set(initDPNet._id?.toString(), [initDPNet.diffPairNet, '', '']);
        }
    }
    
    dpNetCursor.rewind();

    for await (const dpNet of dpNetCursor) { 
        let correspNetName = dpNetIdtoNameMapping.get(dpNet._id?.toString())?.at(1) ?? dpNetIdtoNameMapping.get(dpNet.diffPairNet)?.at(1)
        let correspNetNCID = (dpNetIdtoNameMapping.get(dpNet._id?.toString())?.at(2) ?? dpNetIdtoNameMapping.get(dpNet.diffPairNet)?.at(2))?.trim() || ''
        let dpNetNCID = dpNet.netclassId?.trim() || ''
        
        if(correspNetName) {
            let interfaceName = (dpNet.interfaceId) ? ifaceIdToNameMapping.get(dpNet.interfaceId ) || '' : ''
            let combName = `${dpNet.name}_${correspNetName}`; 
            let dpName = `DP_${dpNet.name.slice(0, 13).replace(/_+$/, '')}_${hash_sum(combName)}`
            dpName = dpName.replaceAll("[", "_").replaceAll("]", "_").replaceAll("{", "_").replaceAll("}", "_").replaceAll(",", "_").trim().toUpperCase();  //important - special DiffPair cleanup
            
            if(dpNetNCID !== correspNetNCID) {  //Important!
                throw new Error(`Error on diff pair assessment. Diff pair net '${dpNet.name}' and its corresponding pair '${correspNetName}' must belong to the same netclass`) 
            }
            
            if(dpNetNCID && dpNetNCID.trim().length > 0) {
                if(dpNetclassToDPNameMapping.has(dpNetNCID)) {
                    let currSet = dpNetclassToDPNameMapping.get(dpNetNCID) as Set<string>
                    currSet.add(dpName)
                    dpNetclassToDPNameMapping.set(dpNetNCID, currSet)
                }
                else {
                    dpNetclassToDPNameMapping.set(dpNetNCID, new Set<string>([dpName]))
                }
            }            
            
            let net1Clean = handleSpecialNetChars(dpNet.name, replPairs as BasicKVP[]);
            let net2Clean = handleSpecialNetChars(correspNetName, replPairs as BasicKVP[]);

            let objName = `DP_DEF_${dpName}`;

            let sb = new StringBuilder();
            sb.clear();

            sb.appendLine(`Object,${objName},,,,,,,,`);
            sb.appendLine(`,Revision,1,,,,,,,`);
            sb.appendLine(`,Interface,${interfaceName},,,,,,,`);
            sb.appendLine(`,Created by,SPIDER,,,,,,,`);
            sb.appendLine(`,Description,Diff Pairs | ${commonDesc},,,,,,,`);

            sb.appendLine(`Header,Group,Name,Member Kind,Member,Type,Physical Rule,Spacing Rule,Count,`);
            sb.appendLine(`Data,DiffPair,${dpName},Net,${net1Clean},,,,,`);
            sb.appendLine(`,,,Net,${net2Clean},,,,,`);
            sb.appendLine(`End,,,,,,,,,`);

            diffPairOutputSB.appendLine(sb.toString());
            diffPairOutputSB.appendLine();
        }

        if(correspNetName) {
            dpNetIdtoNameMapping.delete(dpNet._id?.toString());
            dpNetIdtoNameMapping.delete(dpNet.diffPairNet);
        }
    }

    return {dpOutStr: diffPairOutputSB.toString(), dpNetclassMap: dpNetclassToDPNameMapping };
}


async function getNetclassExportStr(projectId: string, commonDesc: string, ifaceIdToNameMapping: Map<string, string>, ncidToNetclassMapping: Map<string, Netclass>, 
    dpNetclassMap: Map<string, Set<string>>, defPhyKeyStr: string, defClearanceKeyStr: string, importExportConfigs: ConfigItem[]) : Promise<string> {
    
    let replPairs = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__CADENCE_IMPORT_NET_NAME_CHAR_REPL.toLowerCase())?.configValue ?? [] 
    let netclassOutputSB = new StringBuilder();

    for(let [ncid, netclass] of ncidToNetclassMapping) {
        let sb = new StringBuilder();
        let initRowSet : boolean = false;
        let interfaceName = ifaceIdToNameMapping.get(netclass.interfaceId);
        let objName = `NC_DEF_${netclass.name}`;

        sb.clear();
        sb.appendLine(`Object,${objName},,,,,,,,`);
        sb.appendLine(`,Revision,1,,,,,,,`);
        sb.appendLine(`,Interface,${interfaceName},,,,,,,`);
        sb.appendLine(`,Created by,SPIDER,,,,,,,`);
        sb.appendLine(`,Description,Netclasses | ${commonDesc},,,,,,,`);
        sb.appendLine(`Header,Group,Name,Member Kind,Member,Type,Physical Rule,Spacing Rule,,`);

        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
        let netfilters = [{ diffPairMapType: DataMappingTypeEnum.Unmapped, netclassId: ncid } as Filter<Net>]
        const ncNetCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, netfilters, null, NET_RETRIEVAL_BATCH_SIZE)
        
        for await (const ncNet of ncNetCursor) { 
            let modNetName = handleSpecialNetChars(ncNet.name, replPairs as BasicKVP[]);
            let line = ''
            if(initRowSet === true) {
                line = `,,,Net,${modNetName},${netclass.name},${defPhyKeyStr},${defClearanceKeyStr},,`;
            }
            else {
                line = `Data,NetClass,${netclass.name},Net,${modNetName},${netclass.name},${defPhyKeyStr},${defClearanceKeyStr},,`
                initRowSet = true;
            }
            sb.appendLine(line);
        }

        let dpNames : Set<string> = dpNetclassMap.get(ncid) ?? new Set<string>();
        for(let dp of dpNames) {
            let line = ''
            if(initRowSet === true) {
                line = `,,,DiffPair,DP_${dp},${netclass.name},${defPhyKeyStr},${defClearanceKeyStr},,`;
            }
            else {
                line = `Data,NetClass,${netclass.name},DiffPair,DP_${dp},${netclass.name},${defPhyKeyStr},${defClearanceKeyStr},,`
                initRowSet = true;
            }
            sb.appendLine(line);
        }

        sb.appendLine(`End,,,,,,,,,`);

        netclassOutputSB.appendLine(sb.toString());
        netclassOutputSB.appendLine();
    }

    return netclassOutputSB.toString();
}


async function getPhysicalConstraintExportStr(project: Project, commonDesc: string, pkg: PackageLayout, netclasses: Netclass[], 
    lgSetToLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>, 
    apdKeyToPropNameMapping: Map<string, string>, defConDataOrganized: Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>, 
    defConGoldenId: string, xmodNameMapping: Map<string, string>, importExportConfigs: ConfigItem[], defPhysicalRAKey: string) : Promise<APDConstrInfo> {
    
    let projectId = project._id?.toString() as string;
    let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	
    let data = new Map<string, Map<string, Map<number, string[]>>>();  //ruleArea, <netclass, <layerIndex, values[]>>>

    const MAIN_PHY_KEY_MAP = new Map<number, string>([
        [1, "MIN_LINE_WIDTH"],
        [2, "MAX_LINE_WIDTH"],
        [3, "DIFFP_PRIMARY_GAP"],
        [4, "MIN_NECK_WIDTH"],
        [5, "MAXIMUM_NECK_LENGTH"],
        [6, "DIFFP_MIN_SPACE"],
        [7, "DIFFP_NECK_GAP"],
        [8, "DIFFP_COUPLED_PLUS"],
        [9, "DIFFP_COUPLED_MINUS"],
        [10, "VIA_LIST"],
        [11, "MIN_BVIA_STAGGER"],
        [12, "MAX_BVIA_STAGGER"],
        [13, "PAD_PAD_DIRECT_CONNECT"],
        [14, "ALLOW_ON_ETCH_SUBCLASS"],
        [15, "TS_ALLOWED"],
    ]);

    let exportLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() === "metal");
    let exportLayersSorted = sort(exportLayers).asc(a => a.index);
    let netclassesSorted = sort(netclasses).asc(x => x.interfaceId)
    let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName.toUpperCase());

    for(let ruleArea of ruleAreasSorted) {
        
        let rafilter = { ruleAreaId: ruleArea.id, constraintType: ConstraintTypesEnum.Physical } as Filter<LayerGroupConstraints>
        let lgcList = await lgcRepo.GetAllByProjectID(projectId, rafilter) ?? []
		let lgcGroupedByNetclass : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId);

        for(let netclass of netclassesSorted) {
            let ncid = netclass._id?.toString() as string
            data = processConstraints(exportLayersSorted, ruleArea, ncid, netclass.name, netclass.layerGroupSetId, data, lgcGroupedByNetclass, 
                MAIN_PHY_KEY_MAP, apdKeyToPropNameMapping, lgSetToLayerToLayerGroupMapping);
        }
    }

    data = addDefaultConstraintSet(ConstraintTypesEnum.Physical, defPhysicalRAKey, exportLayersSorted, ruleAreasSorted, defConGoldenId, 
        MAIN_PHY_KEY_MAP, data, apdKeyToPropNameMapping, defConDataOrganized, xmodNameMapping, importExportConfigs)
    
    let info : APDConstrInfo = formatCSetData(ConstraintTypesEnum.Physical, commonDesc, MAIN_PHY_KEY_MAP, defPhysicalRAKey, data) 

    return info
}


async function getClearanceConstraintExportStr(project: Project, commonDesc: string, pkg: PackageLayout, clrRelationElements: BasicProperty[], 
    lgSetToLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>, 
    apdKeyToPropNameMapping: Map<string, string>, defConDataOrganized: Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>, 
    defConGoldenId: string, xmodNameMapping: Map<string, string>, importExportConfigs: ConfigItem[], defClearanceRAKey: string) : Promise<APDConstrInfo> {
    
    let projectId = project._id?.toString() as string;
    let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	
    let data = new Map<string, Map<string, Map<number, string[]>>>();  //ruleArea, <ruleName, <layerIndex, values[]>>>
    
    const MAIN_CLR_KEY_MAP = new Map<number, string>([
        [1, "THRUVIA_TO_THRUVIA_SPACING"],
        [2, "BBV_TO_THRUVIA_SPACING"],
        [3, "TESTVIA_TO_THRUVIA_SPACING"],
        [4, "MVIA_TO_THRUVIA_SPACING"],
        [5, "BBV_TO_BBV_SPACING"],
        [6, "BBV_TO_TESTVIA_SPACING"],
        [7, "MVIA_TO_BBV_SPACING"],
        [8, "MVIA_TO_TESTVIA_SPACING"],
        [9, "MVIA_TO_MVIA_SPACING"],
        [10, "TESTVIA_TO_TESTVIA_SPACING"],
        [11, "SMDPIN_TO_THRUVIA_SPACING"],
        [12, "BBV_TO_SMDPIN_SPACING"],
        [13, "SMDPIN_TO_TESTVIA_SPACING"],
        [14, "MVIA_TO_SMDPIN_SPACING"],
        [15, "SHAPE_TO_THRUVIA_SPACING"],
        [16, "BBV_TO_SHAPE_SPACING"],
        [17, "MVIA_TO_SHAPE_SPACING"],
        [18, "SHAPE_TO_TESTVIA_SPACING"],
        [19, "LINE_TO_THRUVIA_SPACING"],
        [20, "BBV_TO_LINE_SPACING"],
        [21, "LINE_TO_TESTVIA_SPACING"],
        [22, "MVIA_TO_LINE_SPACING"],
        [23, "LINE_TO_LINE_SPACING"],
        [24, "LINE_TO_SMDPIN_SPACING"],
        [25, "LINE_TO_SHAPE_SPACING"],
        [26, "LINE_TO_THRUPIN_SPACING"],
        [27, "LINE_TO_TESTPIN_SPACING"],
        [28, "SHAPE_TO_SHAPE_SPACING"],
        [29, "THRUPIN_TO_THRUVIA_SPACING"],
        [30, "BBV_TO_THRUPIN_SPACING"],
        [31, "TESTVIA_TO_THRUPIN_SPACING"],
        [32, "TESTPIN_TO_THRUVIA_SPACING"],
        [33, "BBV_TO_TESTPIN_SPACING"],
        [34, "TESTPIN_TO_TESTVIA_SPACING"],
        [35, "MVIA_TO_TESTPIN_SPACING"],
        [36, "THRUPIN_TO_SHAPE_SPACING"],
        [37, "SHAPE_TO_SMDPIN_SPACING"],
        [38, "SHAPE_TO_TESTPIN_SPACING"],
        [39, "THRUPIN_TO_THRUPIN_SPACING"],
        [40, "THRUPIN_TO_SMDPIN_SPACING"],
        [41, "TESTPIN_TO_THRUPIN_SPACING"],
        [42, "MVIA_TO_THRUPIN_SPACING"],
        [43, "SMDPIN_TO_SMDPIN_SPACING"],
        [44, "SMDPIN_TO_TESTPIN_SPACING"],
        [45, "TESTPIN_TO_TESTPIN_SPACING"],
    ]);
    
    let exportLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() === "metal");
    let exportLayersSorted = sort(exportLayers).asc(a => a.index);
    let clrRelationsSorted = sort(clrRelationElements).asc(x => x.name?.toUpperCase())
    let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName.toUpperCase());

    for(let ruleArea of ruleAreasSorted) {
        
        let rafilter = { ruleAreaId: ruleArea.id, constraintType: ConstraintTypesEnum.Clearance } as Filter<LayerGroupConstraints>
        let lgcList = await lgcRepo.GetAllByProjectID(projectId, rafilter) ?? []
		let lgcGroupedByClearanceRelation : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId);

        for(let relation of clrRelationsSorted) {
            data = processConstraints(exportLayersSorted, ruleArea, relation.id, relation.name, relation.value, data, lgcGroupedByClearanceRelation, 
                MAIN_CLR_KEY_MAP, apdKeyToPropNameMapping, lgSetToLayerToLayerGroupMapping);
        }
    }

    data = addDefaultConstraintSet(ConstraintTypesEnum.Clearance, defClearanceRAKey, exportLayersSorted, ruleAreasSorted, defConGoldenId, MAIN_CLR_KEY_MAP, data, 
        apdKeyToPropNameMapping, defConDataOrganized, xmodNameMapping, importExportConfigs)

    let info: APDConstrInfo = formatCSetData(ConstraintTypesEnum.Clearance, commonDesc, MAIN_CLR_KEY_MAP, defClearanceRAKey, data) 

    return info
}


function processConstraints(exportLayersSorted: StackupLayer[], ruleArea: RuleArea, elementId: string, elementName: string, elementLGSetID: string, 
    data: Map<string, Map<string, Map<number, string[]>>>, lgcGrouped: Map<string, LayerGroupConstraints[]>, keyMap: Map<number, string>, 
    apdKeyToPropNameMapping: Map<string, string>, lgSetToLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>) : Map<string, Map<string, Map<number, string[]>>>{
    
    for(let i = 0; i < exportLayersSorted.length; i++) {
        let stkLayer = exportLayersSorted[i]

        //regarding 'data' --> //ruleArea, <netclass, <layerIndex, values[]>>>

        if(data.has(ruleArea.ruleAreaName) === false) {
            data.set(ruleArea.ruleAreaName, new Map<string, Map<number, string[]>>());
        }
        
        if((data.get(ruleArea.ruleAreaName) as any).has(elementName) === false) {
            data.get(ruleArea.ruleAreaName)?.set(elementName, new Map<number, string[]>());
        }

        if((data.get(ruleArea.ruleAreaName)?.get(elementName) as any).has(stkLayer.index) === false) {
            data.get(ruleArea.ruleAreaName)?.get(elementName)?.set(stkLayer.index, new Array<string>());
        }

        let lgToLayerMapForRelevantLGSet = lgSetToLayerToLayerGroupMapping.get(elementLGSetID)
        if(lgToLayerMapForRelevantLGSet) {
            let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.name.toUpperCase())?.layer;
            let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.name.toUpperCase())?.lg;
            if(relevantLayer && relevantLG) {
                let focusLGC = lgcGrouped.get(elementId)?.find(a => a.layerGroupId === relevantLG.id)
                if(focusLGC)  {
                    let lgcPropsMap = new Map<string, ConstraintValues>()
                    focusLGC.associatedProperties.forEach(x => lgcPropsMap.set(x.name, x.value))
                    
                    let forceDefault = (relevantLayer.isActive && relevantLG.isActive && ruleArea.isActive) ? false : true;

                    let valArr = new Array<string>()
                    for(let p = 0; p < keyMap.size; p++) {
                        let expVal = getLgcPropValue(keyMap.get(p+1) as string, forceDefault, apdKeyToPropNameMapping, lgcPropsMap);
                        valArr.push(expVal) 
                    }

                    data.get(ruleArea.ruleAreaName)?.get(elementName)?.set(stkLayer.index, valArr);
                    
                }
            }
        }
    }
    return data
} 


function addDefaultConstraintSet(constraintType: ConstraintTypesEnum, defaultCSetKey: string, exportLayersSorted: StackupLayer[], ruleAreasSorted: RuleArea[], defConGoldenId: string, 
    keyMap: Map<Number, string>, data: Map<string, Map<string, Map<number, string[]>>>, apdKeyToPropNameMapping: Map<string, string>, 
    defConDataOrganized:  Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>, 
    xmodNameMapping: Map<string, string>, importExportConfigs: ConfigItem[]): Map<string, Map<string, Map<number, string[]>>> {
    
    let confDefaultRegionName = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__CADENCE_IMPORT_DEFAULT_REGION.toLowerCase())?.configValue || ''
    
    for(let i = 0; i < exportLayersSorted.length; i++) {
        let stkLayer = exportLayersSorted[i]

        //regarding 'data' --> //ruleArea, <netclass, <layerIndex, values[]>>>

        if(data.has(defaultCSetKey) === false) {
            data.set(defaultCSetKey, new Map<string, Map<number, string[]>>());
        }
        
        if((data.get(defaultCSetKey) as any).has(defaultCSetKey) === false) {
            data.get(defaultCSetKey)?.set(defaultCSetKey, new Map<number, string[]>());
        }

        if((data.get(defaultCSetKey)?.get(defaultCSetKey) as any).has(stkLayer.index) === false) {
            data.get(defaultCSetKey)?.get(defaultCSetKey)?.set(stkLayer.index, new Array<string>());
        }

        let xmodInit = (confDefaultRegionName && xmodNameMapping.has(confDefaultRegionName)) ? xmodNameMapping.get(confDefaultRegionName) : confDefaultRegionName;
        let defaultXmodName = (xmodInit && ruleAreasSorted.some(a => (a.xmodName === xmodInit))) ? xmodInit : "DEFAULT";

        let propToDefConEntryMap = defConDataOrganized.get(defConGoldenId)?.get(constraintType)?.get(defaultXmodName.toUpperCase())?.get(stkLayer.name.toUpperCase())

        let valArr = new Array<string>()
        for(let p = 0; p < keyMap.size; p++) {
            let expVal = getDefconPropValue(keyMap.get(p+1) as string, apdKeyToPropNameMapping, propToDefConEntryMap);
            valArr.push(expVal) 
        }

        data.get(defaultCSetKey)?.get(defaultCSetKey)?.set(stkLayer.index, valArr);
    }

    return data
}


function formatCSetData(constraintType: ConstraintTypesEnum, commonDesc: string, keyMap: Map<number, string>, 
    defaultCSetKey: string, data: Map<string, Map<string, Map<number, string[]>>>) : APDConstrInfo {
    
    let outputSB = new StringBuilder();
    let avoidRuleAreaNames = new Array<string>();
    let regionSetupMapping = new Map<string, Map<string, string>>();

    for(let [raName, raMapping] of data) {     //ruleArea, <netclass|ruleName, <layerIndex, values[]>>>

        let objName = (constraintType === ConstraintTypesEnum.Clearance) ? `SPC_DEF_${raName}` : `PHY_DEF_${raName}`;
        let objType = (constraintType === ConstraintTypesEnum.Clearance) ? "SpacingRule" : "PhysicalRule";
        
        let headerLine = `Header,Layer Index,`;
        let propLine = `,,`;

        let propCount = 0;
        let dataBylayer = new Map<number, string>();

        regionSetupMapping.set(raName, new Map<string, string>());

        for(let [name, ownerElementMapping] of raMapping) {
            let typeName = '';
            if(raName === defaultCSetKey) {
                typeName = defaultCSetKey;
                headerLine = headerLine + `Rule=${defaultCSetKey}`;
            }
            else {
                let srtNameInf = shortenNameForAPD(`${raName}_${name}`, avoidRuleAreaNames);
                typeName = srtNameInf.retStr
                avoidRuleAreaNames = srtNameInf.avoidanceList
                headerLine = headerLine + `Rule=${typeName}`;
            }

            for (let [key, value] of keyMap) {
                propLine = propLine + value + ",";
                headerLine = headerLine + ",";
                propCount++;
            }

            for(let [layerIndex, values] of ownerElementMapping) {
                let str = (dataBylayer.get(layerIndex) || '') + values.join(",") + ",";
                dataBylayer.set(layerIndex, str);
            }

            regionSetupMapping.get(raName)?.set(name, `${objName}:${typeName}`);
        }

        let mapArray : [number, string][] = Array.from(dataBylayer).sort((a, b) => a[0] - b[0]);
        let tempSB = new StringBuilder();
        for (let item of mapArray) {
            if (item[0] === 1)
                tempSB.appendLine(`Data,${item[0].toString()},${item[1]}`);
            else
                tempSB.appendLine(`,${item[0].toString()},${item[1]}`);
        }

        objName = objName.replaceAll("(", "").replaceAll(")", "");

        outputSB.appendLine(`${objType},${objName},` + (",".repeat(propCount)));
        outputSB.appendLine(`,Revision,1` + (",".repeat(propCount)));
        outputSB.appendLine(`,Units,um` + (",".repeat(propCount)));
        outputSB.appendLine(`,Created by,SPIDER` + (",".repeat(propCount)));
        outputSB.appendLine(`,Description,${objType} | ${commonDesc}` + (",".repeat(propCount)));

        outputSB.appendLine(headerLine);
        outputSB.appendLine(propLine.replaceAll(" ", ''));
        outputSB.appendLine(tempSB.toString().trim());
        outputSB.appendLine(`End,,` + (",".repeat(propCount)));

        outputSB.appendLine();
        outputSB.appendLine();
    }

    let retInfo: APDConstrInfo = {
        outString: outputSB.toString(),
        mapping: regionSetupMapping
    }

    return retInfo;
}


async function getRuleAreaExportStr(projectId: string, commonDesc: string, pkg: PackageLayout, phyMapping: Map<string, Map<string, string>>, 
    clrMapping: Map<string, Map<string, string>>, ncidToNetclassMapping: Map<string, Netclass>, clrRelationElements: BasicProperty[]) : Promise<string> {
    
    let ruleAreaOutputSB = new StringBuilder();
    let raToTypeNameMapping = new Map<string, string>();

    if (pkg && pkg.ruleAreas && pkg.ruleAreas.length > 0) {
        ruleAreaOutputSB.clear();

        let defsData = handleRuleAreaDefs(commonDesc, pkg.ruleAreas, raToTypeNameMapping);
        ruleAreaOutputSB.appendLine(defsData.sb.toString());
        raToTypeNameMapping = defsData.retMap;

        let phyData = handleRuleAreaPhyCSETMappings(commonDesc, phyMapping, raToTypeNameMapping);
        ruleAreaOutputSB.appendLine(phyData.toString());

        let clrData = await handleRuleAreaClrCSETMappings(projectId, commonDesc, clrMapping, raToTypeNameMapping, ncidToNetclassMapping, clrRelationElements);
        ruleAreaOutputSB.appendLine(clrData.toString());
    }

    let retStr = ruleAreaOutputSB.toString();

    return retStr;
}


function handleRuleAreaDefs(commonDesc: string, prjRuleAreas: RuleArea[], 
    raToTypeNameMapping: Map<string, string>) : {sb: StringBuilder, retMap: Map<string, string>} {
    
    let sb = new StringBuilder();
    let avoidRuleAreaNames = new Array<string>();

    let objName = "RA_DEF_REGIONS";
    sb.appendLine(`Object,${objName},,,,,`);
    sb.appendLine(`,Revision,1,,,,`);
    sb.appendLine(`,Interface,,,,,`);
    sb.appendLine(`,Created by,SPIDER,,,,`);
    sb.appendLine(`,Description,Regions | ${commonDesc},,,,`);
    sb.appendLine(`Header,Group,Name,Type,Physical Rule,Spacing Rule,`);

    for(let ra of prjRuleAreas) {
        let resp = shortenNameForAPD(ra.ruleAreaName, avoidRuleAreaNames, true);
        avoidRuleAreaNames = resp.avoidanceList;
        let rgnTypeName = `RA_${resp.retStr}`;
        raToTypeNameMapping.set(ra.ruleAreaName, rgnTypeName);
        sb.appendLine(`Data,Region,${ra.ruleAreaName},${rgnTypeName},,,`);
    }

    sb.appendLine(`End,,,,,,`);
    sb.appendLine();
    sb.appendLine();

    return { sb: sb, retMap: raToTypeNameMapping };
}


function handleRuleAreaPhyCSETMappings(commonDesc: string, phyMapping: Map<string, Map<string, string>>, 
    raToTypeNameMapping: Map<string, string>) : StringBuilder {
    
    let sb = new StringBuilder();

    let phyHeaderLine = "Header,Type,Physical Rule,";
    let ruleTypeLine = ",,,";
    let defaultVal = "";
    let endCommaCount = 0;

    let phyMappingOrigKeys = Array.from(phyMapping.keys());
    let phyMappingKeysSorted = sort(phyMappingOrigKeys).asc(x => x.toUpperCase());
    let netClassNames = Array.from(phyMapping.get(phyMappingKeysSorted[0])?.keys() ?? [])
    
    for(let name of netClassNames) {
        phyHeaderLine = phyHeaderLine + `Type=NC_${name},`;
        ruleTypeLine = ruleTypeLine + `Physical Rule,`;
        endCommaCount++;
    }

    let tempSB = new StringBuilder();
    let index = 0;
    raToTypeNameMapping.forEach((value, key) => {
        let lineStr = (index == 0) ? `Data,${value},${defaultVal},` : `,${value},${defaultVal},`;
        let csetInfoForRA = phyMapping.get(key) as Map<string, string>;
        let csetInfoForRAOrigKeys = Array.from(csetInfoForRA.keys());
        let csetInfoForRAKeysSorted = sort(csetInfoForRAOrigKeys).asc(x => x.toUpperCase());
        for(let key of csetInfoForRAKeysSorted) {
            lineStr = lineStr + `${csetInfoForRA.get(key)},`;
        }

        tempSB.appendLine(lineStr);
        index = index + 1
    });

    let phyObjName = "RA_DEF_PHY_REGION_CONSTRAINTS";
    sb.appendLine(`ObjectRule,${phyObjName},,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Revision,1,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Interface,,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Created by,SPIDER,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Description,Region:Physical | ${commonDesc},` + (",".repeat(endCommaCount)));
    sb.appendLine(phyHeaderLine);
    sb.appendLine(ruleTypeLine);
    sb.appendLine(tempSB.toString().trim());
    sb.appendLine(`End,,,` + (",".repeat(endCommaCount)));
    sb.appendLine();
    sb.appendLine();

    return sb;
}


async function handleRuleAreaClrCSETMappings(projectId: string, commonDesc: string, clrMapping: Map<string, Map<string, string>>, raToTypeNameMapping: Map<string, string>, 
    ncidToNetclassMapping: Map<string, Netclass>, clrRelationElements: BasicProperty[]) : Promise<StringBuilder> {
    
    let sb = new StringBuilder();
    let clearanceRuleNameToTypeNameMapping = new Map<string, Set<string>>();

    let clrRelationIdToNameMap = new Map<string, string>();
    for(let clrRel of (clrRelationElements ?? [])) {
        clrRelationIdToNameMap.set(clrRel.id, clrRel.name)
    }

    let c2cRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION);
    let c2cRowList = await c2cRepo.GetAllByProjectID(projectId);
    if(c2cRowList && c2cRowList.length > 0) { 
        for (let c2cr of c2cRowList) {
            let frmNC = ncidToNetclassMapping.get(c2cr.netclassId);
            if(frmNC && frmNC.name && frmNC.name.trim().length > 0) {
                for(let slot of c2cr.slots) {
                    if(slot.value && slot.value.trim().length > 0) {
                        let clrRelName = clrRelationIdToNameMap.get(slot.value);  //clearance relation name assigned in this slot
                        if(clrRelName && clrRelName.trim().length > 0) {
                            if(clearanceRuleNameToTypeNameMapping.has(clrRelName) === false) {
                                clearanceRuleNameToTypeNameMapping.set(clrRelName, new Set<string>())
                            }

                            if(slot.name && slot.name === C2C_ROW_ALLCOLUMN_SLOT_NAME) {
                                clearanceRuleNameToTypeNameMapping.get(clrRelName)?.add(`NC_${frmNC.name.trim()}`)
                            }
                            else {
                                let toNC = ncidToNetclassMapping.get(slot.netclassId);
                                if(toNC && toNC.name && toNC.name.trim().length > 0) {
                                    clearanceRuleNameToTypeNameMapping.get(clrRelName)?.add(`NC_${frmNC.name.trim()}:NC_${toNC.name.trim()}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let spcHeaderLine = "Header,Type,Spacing Rule,";
    let ruleTypeLine = ",,,";
    let defaultVal = "";
    let endCommaCount = 0;

    let crNameToTypeNameMapOrigKeys = Array.from(clearanceRuleNameToTypeNameMapping.keys());
    let crNameToTypeNameMapKeysSorted = sort(crNameToTypeNameMapOrigKeys).asc(x => x.toUpperCase());

    for(let key of crNameToTypeNameMapKeysSorted) {
        let typeNameArray = sort(Array.from(clearanceRuleNameToTypeNameMapping.get(key) as Set<string>)).asc(s => s.toUpperCase())
        for(let tName of typeNameArray) {
            spcHeaderLine = spcHeaderLine + `Type=${tName},`;
            ruleTypeLine = ruleTypeLine + "Spacing Rule,";
            endCommaCount++;
        }
    }
    
    let tempSB = new StringBuilder();
    let index = 0;

    for(let [raRealNameKey, raTypeNameValue] of raToTypeNameMapping) {
        let lineStr = (index == 0) ? `Data,${raTypeNameValue},${defaultVal},` : `,${raTypeNameValue},${defaultVal},`;

        for(let sortCrNameKey of crNameToTypeNameMapKeysSorted) {
            let typeNameArray = sort(Array.from(clearanceRuleNameToTypeNameMapping.get(sortCrNameKey) as Set<string>)).asc(s => s.toUpperCase())
            for(let k = 0; k < typeNameArray.length; k++) {
                let csetName : string = clrMapping.get(raRealNameKey)?.get(sortCrNameKey) as string;
                lineStr = lineStr + `${csetName},`;
            }
        }

        tempSB.appendLine(lineStr);
        index = index + 1
    }


    let spcObjName = "RA_DEF_SPC_REGION_CONSTRAINTS";
    sb.appendLine(`ObjectRule,${spcObjName},,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Revision,1,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Interface,,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Created by,SPIDER,` + (",".repeat(endCommaCount)));
    sb.appendLine(`,Description,Region:Clearance | ${commonDesc},` + (",".repeat(endCommaCount)));
    sb.appendLine(spcHeaderLine);
    sb.appendLine(ruleTypeLine);
    sb.appendLine(tempSB.toString().trim());
    sb.appendLine(`End,,,` + (",".repeat(endCommaCount)));
    sb.appendLine();
    sb.appendLine();

    return sb;
}


function getACCBatchingXMLDefinitions(accReportXmlFileNamePrefix: string, accxFileNamePrefix: string, mcmFilePath: string, constraintFileDict: Array<[string, Map<string, string>]>) : Array<BasicKVP> {
    let retInfo = new Array<BasicKVP>(); //ORDER IS IMPORTANT here due to dependency. diffpairs, netclasses, then trace/space, and then regions
    
    const APD_ACCX_XML = `
        <cft:root xmlns:cft="http://www.cadence.com/xsd/cft" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <cft:xml Name="acc_input">
                <root xmlns="http://www.cadence.com/xsd/acc_input">
                    <folder path="####_REPL_EXPORT_MCM_PATH_####" type="global">
                        <files>
                            ####_REPL_EXPORT_FILES_####
                        </files>
                    </folder>
                    <options>
                        <enable>
                            <!--<o>Update only auto-generated objects</o>-->
                            <!--<o>Update only auto-generated constraints</o>-->
                            <o>Use Differential Pairs when updating groups</o>
                            <o>Create empty Net Classes</o>
                        </enable>
                    </options>
                    <reportSettings>
                        <reportFile>
                            ####_REPL_EXPORT_LOGFILE_ELEMENT_####
                        </reportFile>
                    </reportSettings>
                </root>
            </cft:xml>
        </cft:root>`;

    for(let [reportInfo, mapping] of constraintFileDict) {
        let sb = new StringBuilder();
        let xmlMod = APD_ACCX_XML;
        xmlMod = xmlMod.replace("####_REPL_EXPORT_MCM_PATH_####", `${mcmFilePath}`)

        let xmlLogFileName = accReportXmlFileNamePrefix + "_" + reportInfo.toUpperCase() + ".xml";
        xmlMod = xmlMod.replace("####_REPL_EXPORT_LOGFILE_ELEMENT_####", `<f xmlns="">${xmlLogFileName}</f>`)
        
        for(let fileName of mapping.keys()) {
            sb.appendLine(`<f>${fileName}</f>`)
        }

        let accxFileName = accxFileNamePrefix + "_" + reportInfo + ".accx";
        
        xmlMod = xmlMod.replace("####_REPL_EXPORT_FILES_####", sb.toString())
        
        try{
            xmlMod = xmlFormat(xmlMod.trim())
        }
        catch(error: any) {
            throw new Error("ACC-Batching xml content is not well-formed xml!")
        }

        retInfo.push({key: accxFileName, value: xmlMod} as BasicKVP);
    }

    return retInfo;
}


function getACCBatchLoadILScript(accxDefDict: BasicKVP[]): string {
    let sb = new StringBuilder();
    for(let kvp of accxDefDict) {
        sb.appendLine(`cmxlCompile(design, "./${kvp.key}")`);
    }

    let accLoadScript =
        `procedure(acc_batch_load()
            axlCMDBInit()
            design = cmxlFindObject(REDS_DESIGN_OBJ)
            when(design
                cmxlDBSkillInit(design)
                ####_REPL_EXPORT_ACCX_FILES_####
            )
            axlCMDBExit()
        )
        acc_batch_load`;

    accLoadScript = accLoadScript.replace("####_REPL_EXPORT_ACCX_FILES_####", sb.toString().trim());
    accLoadScript = accLoadScript.replaceAll("    ", '');

    return accLoadScript;
}


function getLoadConstrSCRScript(ilFileName: string) : string {
    let sb = new StringBuilder()
    sb.appendLine(`skill load("${ilFileName}")`)
    sb.appendLine(`exit`);

    return sb.toString();
}


function getDeploymentBatScript(scriptFileName: string, batExecLogFileName: string, importExportConfigs: ConfigItem[]) : string {
    let batScript = '';
    if(importExportConfigs && importExportConfigs.length > 0) {
        let apdBatConf : string = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__CADENCE_IMPORT_BAT_SCRIPT.toLowerCase())?.configValue?.trim() ?? null
        if(!apdBatConf || apdBatConf.trim().length === 0) {
            throw new Error(`Could not find template for exportable APD bat file. Check config management system!`)
        } 

        batScript = apdBatConf.trim();
        batScript = batScript.replaceAll("[####_SCR_FILE_NAME_####]", scriptFileName);
        batScript = batScript.replaceAll("[####_BAT_LOG_FILE_NAME_####]", batExecLogFileName);
        batScript = batScript.replaceAll("    ", '');
    }
    else {
        throw new Error(`Could not retrieve export-related configs for APD. Check config management system!`)
    }
    
    return batScript;
}


function getReadmeFile(project: Project, batFileName: string, commonDesc: string, batExecLogFileName: string, accReportXmlFileNamePrefix: string, importExportConfigs: ConfigItem[]) : string {
    let readmeContent : string = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__CADENCE_IMPORT_README.toLowerCase())?.configValue?.trim() ?? null
    if(!readmeContent || readmeContent.trim().length === 0) {
        throw new Error(`Could not find template for APD readme file. Check config management system!`)
    } 

    readmeContent = readmeContent.replaceAll("####_REPL_COMMON_DESCRIPTION_####", commonDesc);
    readmeContent = readmeContent.replaceAll("####_REPL_PROJECT_ID_####", project._id?.toString() as string);
    readmeContent = readmeContent.replaceAll("####_REPL_PROJECT_NAME_####", project.name);

    readmeContent = readmeContent.replaceAll("####_REPL_ACC_REPORT_FILE_NAME_####", accReportXmlFileNamePrefix);
    readmeContent = readmeContent.replaceAll("####_REPL_BAT_LOG_FILE_NAME_####", batExecLogFileName);
    readmeContent = readmeContent.replaceAll("####_REPL_BAT_FILE_NAME_####", batFileName);

    return readmeContent;
}



//===========================================================================================================================
//=================================================== Helper functions ======================================================

function shortenNameForAPD(value: string, avoidables: string[], skipLengthCheck: boolean = false) : {retStr: string, avoidanceList: string[] } {
    let str = value;
    let avoidArr = Array.from(avoidables ?? [])
    try {
        str = str.replaceAll(",", "__");
        str = str.replaceAll(" ", "_");

        for (let item of ["(", ")", "#", "@", "!", "\\", "/", "$" ]) {
            str = str.replaceAll(item, '');
        }

        if (skipLengthCheck == false) {
            if (str.length > 25) {
    
                str = str.replace(new RegExp("RESTRICTED", "ig"), "RTD");
                str = str.replace(new RegExp("NECKING", "ig"), "NECK");
                str = str.replace(new RegExp("REGION", "ig"), "RGN");
                str = str.replace(new RegExp("MASTER", "ig"), "MAST");
                str = str.replace(new RegExp("_INTER_", "ig"), "_INT_");
                str = str.replace(new RegExp("CONSTRAINT", "ig"), "CST");
                str = str.replace(new RegExp("_Across_ALL_ALL", "ig"), "_ACROSS");
                str = str.replace(new RegExp("_ALL_ALL", "ig"), "_WITHIN");

                if (str.length > 25) {
                    let init = str.substring(0, 10);
                    let last = str.substring(str.length - 11);
                    let count = 1;
                    while (true) {
                        let newStr = `${init}_${last}_${count}`;
                        if (avoidArr && avoidArr.length > 0 && avoidArr.includes(newStr)) {
                            count++;
                        }
                        else {
                            str = newStr;
                            avoidArr?.push(str);
                            break;
                        }
                    }
                }
            }
        }
    }
    catch (error: any) {
        let msg = `Failed to shorten name '${value}' -- ` + error.message;
        throw new Error(msg)
    }

    return {retStr: str, avoidanceList: avoidArr } 
}


function handleSpecialNetChars(netName: string, netNameReplKVPs: BasicKVP[]): string {
    let sanitizedNetName = netName.replaceAll("[", "\\[").replaceAll("]", "\\]");

    if (netNameReplKVPs && netNameReplKVPs.length > 0) {
        for (let kvp of netNameReplKVPs) {
            let regEx = new RegExp(kvp.key, 'g');
            sanitizedNetName = sanitizedNetName.replaceAll(regEx, kvp.value);
        }
    }

    return sanitizedNetName;
}


















//============================================================================================================


// function getClassRelationsExportStr(commonDesc: string) {
//     let sb = new StringBuilder();

//     let spcHeaderLine = "Header,Type,Spacing Rule,";
//     let ruleTypeLine = ",,,";
//     let defaultVal = "";
//     let endCommaCount = 0;

//     let tempSB = new StringBuilder();

//     // let crNameToTypeNameMapOrigKeys = Array.from(clearanceRuleNameToTypeNameMapping.keys());
//     // let crNameToTypeNameMapKeysSorted = sort(crNameToTypeNameMapOrigKeys).asc(x => x.toUpperCase());
//     // for(let key of crNameToTypeNameMapKeysSorted) {
//     //     let nameToTypeNameInfo = clearanceRuleNameToTypeNameMapping.get(key) as string[]
//     //     for(let name of nameToTypeNameInfo) {
//     //         spcHeaderLine = spcHeaderLine + `Type=${name},`;
//     //         ruleTypeLine = ruleTypeLine + "Spacing Rule,";
//     //         endCommaCount++;
//     //     }
//     // }
    
//     //
//     // let index = 0;
//     // raToTypeNameMapping.forEach((value, key) => {
//     //     let lineStr = (index == 0) ? `Data,${value},${defaultVal},` : `,${value},${defaultVal},`;

//     //     for(let sortCrNameKey of crNameToTypeNameMapKeysSorted) {
//     //         let nameToTypeNameInfo = clearanceRuleNameToTypeNameMapping.get(key) as string[]
//     //         for(let k = 0; k < nameToTypeNameInfo.length; k++) {
//     //             let csetName : string = clrMapping.get(key)?.get(sortCrNameKey) as string;
//     //             lineStr = lineStr + `${csetName},`;
//     //         }
//     //     }

//     //     tempSB.appendLine(lineStr);
//     //     index = index + 1
//     // });


//     let spcObjName = "C2C_DEF_C2C_RELATIONS";
//     sb.appendLine(`ObjectRule,${spcObjName},,` + (",".repeat(endCommaCount)));
//     sb.appendLine(`,Revision,1,` + (",".repeat(endCommaCount)));
//     sb.appendLine(`,Interface,,` + (",".repeat(endCommaCount)));
//     sb.appendLine(`,Created by,SPIDER,` + (",".repeat(endCommaCount)));
//     sb.appendLine(`,Description,C2C_Relations,` + (",".repeat(endCommaCount)));
//     sb.appendLine(spcHeaderLine);
//     sb.appendLine(ruleTypeLine);
//     sb.appendLine(tempSB.toString().trim());
//     sb.appendLine(`Note,1,${commonDesc},` + (",".repeat(endCommaCount)));
//     sb.appendLine(`End,,,` + (",".repeat(endCommaCount)));
//     sb.appendLine();
//     sb.appendLine();

//     let retVal = sb.toString();
//     return retVal;
// }





//===========================================================================

// let specialCaseMap = new Map<string, string>();
    // let projectMGP = project.associatedProperties?.find(a => (
    //     a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))
    // if(projectMGP && projectMGP.value && projectMGP.value.length > 0) {
    //     for(let mgp of (projectMGP.value as BasicProperty[])) {
    //         if(mgp.id && mgp.id.trim().length > 0 && mgp.name && mgp.name.trim().length > 0 && mgp.value) {
    //             specialCaseMap.set(mgp.id, mgp.name);
    //             specialCaseMap.set(mgp.name, mgp.value);
    //         }
    //     }
    // }

    // let lgSetLayerGroupToLayerMap = new Map<string, Map<string, Layer[]>>();
    // for(let lgSet of pkg.layerGroupSets) {
    //     let lgMap = new Map<string, Layer[]>();
    //     for(let lg of lgSet.layerGroups) {
    //         lgMap.set(lg.id, lg.layers)
    //     }
    //     lgSetLayerGroupToLayerMap.set(lgSet.id, lgMap);
    // }

//================================================================================







// function formatCSetData(constraintType: ConstraintTypesEnum, commonDesc: string, keyMap: Map<number, string>, data: Map<string, Map<string, Map<number, string[]>>>) {
//     let outputSB = new StringBuilder();
//     let avoidRuleAreaNames = new Array<string>();
//     for(let [raName, raMapping] of data) {     //ruleArea, <netclass|ruleName, <layerIndex, values[]>>>

//         // let ownerElementNames = raMapping.keys();
//         let objName = (constraintType === ConstraintTypesEnum.Clearance) ? `SPC_DEF_${raName}` : `PHY_DEF_${raName}`;
//         let objType = (constraintType === ConstraintTypesEnum.Clearance) ? "SpacingRule" : "PhysicalRule";

        
//         let headerLine = `Header,Layer Index,`;
//         let propLine = `,,`;

//         let propCount = 0;
//         let dataBylayer = new Map<number, string>();

//         // regionSetupMapping.Add(raName, new());
//         // let tempSB = new StringBuilder();
//         for(let [name, ownerElementMapping] of raMapping) {
//             let srtNameInf = shortenNameForAPD(`${raName}_${name}`, avoidRuleAreaNames);
//             let typeName = srtNameInf.retStr
//             avoidRuleAreaNames = srtNameInf.avoidanceList
//             headerLine = headerLine + `Rule=${typeName}`;

//             for (let [key, value] of keyMap) {
//                 propLine = propLine + value + ",";
//                 headerLine = headerLine + ",";
//                 propCount++;
//             }

//             for(let [layerIndex, values] of ownerElementMapping) {
//                 let str = (dataBylayer.get(layerIndex) || '') + values.join(",") + ",";
//                 dataBylayer.set(layerIndex, str)
                
//                 // if (tempSB.lineCount() === 0) {
//                 //     tempSB.appendLine(`Data,${layerIndex},${values.join(",")}`);
//                 // }
//                 // else {
//                 //     tempSB.appendLine(`,${layerIndex},${values.join(",")}`);
//                 // }
//             }
//         }

//         let mapArray : [number, string][] = Array.from(dataBylayer).sort((a, b) => a[0] - b[0]);
//         let tempSB = new StringBuilder();
//         for (let item of mapArray) {
//             if (item[0] === 1)
//                 tempSB.appendLine(`Data,${item[0].toString()},${item[1]}`);
//             else
//                 tempSB.appendLine(`,${item[0].toString()},${item[1]}`);
//         }

//         // for(let name of ownerElementNames) {
//         //     let retInf = shortenNameForAPD(`${raName}_${name}`, avoidRuleAreaNames);
//         //     let typeName = retInf.retStr
//         //     avoidRuleAreaNames = retInf.avoidanceList
//         //     headerLine = headerLine + `Rule=${typeName}`;

//         //     for (let [key, value] of keyMap) {
//         //         propLine = propLine + value + ",";
//         //         headerLine = headerLine + ",";
//         //         propCount++;
//         //     }

//         //     var layerInfoDict = raMapping.get(name) ?? new Map<number, string[]>()

//         //     for (let [layerIndex, valuesArr] of layerInfoDict) {
//         //         if (dataBylayer.has(layerIndex) == false) {
//         //             dataBylayer.set(layerIndex, '');
//         //         }
//         //         let numStr : string = '';
//         //         // for (let item of dataItems) {
//         //         //     numStr = numStr + valuesArr.at(Convert.ToInt32(item.Value)) + ",";
//         //         // }
//         //         dataBylayer.set(layerIndex, dataBylayer.get(layerIndex) + numStr);
//         //     }

//         //     // regionSetupMapping[raName].Add(name, $"{objName}:{typeName}");
//         // }


//         // var dictAsList = dataBylayer.OrderBy(a => a.Key).ToList();
//         // let tempSB = new StringBuilder();
//         // for (let item of dictAsList)
//         // {
//         //     if (item.Key == 1)
//         //         tempSB.appendLine(`Data,${item.Key.ToString()},${item.Value}`);
//         //     else
//         //         tempSB.appendLine(`,${item.Key.ToString()},${item.Value}`);
//         // }

//         objName = objName.replaceAll("(", "").replaceAll(")", "");

//         outputSB.appendLine(`${objType},${objName},` + (",".repeat(propCount)));
//         outputSB.appendLine(`,Revision,1` + (",".repeat(propCount)));
//         outputSB.appendLine(`,Units,um` + (",".repeat(propCount)));
//         outputSB.appendLine(`,Created by,SPIDER` + (",".repeat(propCount)));
//         outputSB.appendLine(`,Description,` + (",".repeat(propCount)));

//         outputSB.appendLine(headerLine);
//         outputSB.appendLine(propLine.replaceAll(" ", ''));
//         outputSB.appendLine(tempSB.toString().trim());
//         outputSB.appendLine(`Note,1,${commonDesc}` + (",".repeat(propCount)));
//         outputSB.appendLine(`End,,` + (",".repeat(propCount)));

//         outputSB.appendLine();
//         outputSB.appendLine();
//     }
//     return outputSB.toString();
// }

//=====================================================================

// for(let i = 0; i < exportLayersSorted.length; i++) {
    //     let stkLayer = exportLayersSorted[i]
    //     let layerIndex = i + 1;

    //     if(data.has(defRegMapKey) === false) {
    //         data.set(defRegMapKey, new Map<string, Map<number, string[]>>([[defRegMapKey, new Map<number, string[]>([[layerIndex, []]])]]));
    //     }

    //     let xmodInit = (confDefaultRegionName && xmodNameMapping.has(confDefaultRegionName)) ? xmodNameMapping.get(confDefaultRegionName) : confDefaultRegionName;
    //     let defaultXmodName = (xmodInit && ruleAreasSorted.some(a => (a.xmodName === xmodInit))) ? xmodInit : "DEFAULT";

    //     let propToDefConEntryMap = defConDataOrganized.get(defConGoldenId)?.get(ConstraintTypesEnum.Physical)?.get(defaultXmodName.toUpperCase())?.get(stkLayer.name.toUpperCase())

    //     let valArr = new Array<string>()
    //     for(let p = 0; p < MAIN_PHY_KEY_MAP.size; p++) {
    //         let expVal = getDefconPropValue(MAIN_PHY_KEY_MAP.get(p+1) as string, apdKeyToPropNameMapping, propToDefConEntryMap);
    //         valArr.push(expVal) 
    //     }

    //     data.get(defRegMapKey)?.get(defRegMapKey)?.set(layerIndex, valArr);
    // }


    // return ""//{phy: "", clr: ""}

//======================================================

//([[elementName, new Map<number, string[]>([[stkLayer.index, []]])]]));

        //data.set(ruleArea.ruleAreaName, new Map<string, Map<number, string[]>>([[elementName, new Map<number, string[]>([[stkLayer.index, []]])]]));




//========================================================================================
//=========================================================================================================







// async function getPhysicalConstraintExportStr(project: Project, commonDesc: string, pkg: PackageLayout, 
//     netclasses: Netclass[], lgSetToLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>, 
//     apdKeyToPropNameMapping: Map<string, string>, defConDataOrganized:  Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>,
//     defConGoldenId: string, xmodNameMapping: Map<string, string>, importExportConfigs: ConfigItem[]) : Promise<string> {
    
//     let projectId = project._id?.toString() as string;
//     let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
// 	let confDefaultRegionName = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__CADENCE_IMPORT_DEFAULT_REGION.toLowerCase())?.configValue || ''
    
//     let data = new Map<string, Map<string, Map<number, string[]>>>();  //ruleArea, <netclass, <layerIndex, values[]>>>
//     const defRegMapKey = `DEFAULT_${crypto.randomUUID()}`
//     const MAIN_PHY_KEY_MAP = new Map<number, string>([
//         [1, "MIN_LINE_WIDTH"],
//         [2, "MAX_LINE_WIDTH"],
//         [3, "DIFFP_PRIMARY_GAP"],
//         [4, "MIN_NECK_WIDTH"],
//         [5, "MAXIMUM_NECK_LENGTH"],
//         [6, "DIFFP_MIN_SPACE"],
//         [7, "DIFFP_NECK_GAP"],
//         [8, "DIFFP_COUPLED_PLUS"],
//         [9, "DIFFP_COUPLED_MINUS"],
//         [10, "VIA_LIST"],
//         [11, "MIN_BVIA_STAGGER"],
//         [12, "MAX_BVIA_STAGGER"],
//         [13, "PAD_PAD_DIRECT_CONNECT"],
//         [14, "ALLOW_ON_ETCH_SUBCLASS"],
//         [15, "TS_ALLOWED"],
//     ]);

//     let exportLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() === "metal");
//     let exportLayersSorted = sort(exportLayers).asc(a => a.index);
//     let netclassesSorted = sort(netclasses).asc(x => x.interfaceId)
//     let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName);

//     for(let ruleArea of ruleAreasSorted) {
        
//         let rafilter = { ruleAreaId: ruleArea.id, constraintType: ConstraintTypesEnum.Physical } as Filter<LayerGroupConstraints>
//         let lgcList = await lgcRepo.GetAllByProjectID(projectId, rafilter) ?? []
// 		let lgcGroupedByNetclass : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId);

//         for(let netclass of netclassesSorted) {

//             for(let i = 0; i < exportLayersSorted.length; i++) {
//                 let stkLayer = exportLayersSorted[i]
//                 let layerIndex = i + 1;

//                 if(data.has(ruleArea.ruleAreaName) === false) {
//                     data.set(ruleArea.ruleAreaName, new Map<string, Map<number, string[]>>([[netclass.name, new Map<number, string[]>([[layerIndex, []]])]]));
//                 }

//                 let lgToLayerMapForRelevantLGSet = lgSetToLayerToLayerGroupMapping.get(netclass.layerGroupSetId)
//                 if(lgToLayerMapForRelevantLGSet) {
//                     let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.name.toUpperCase())?.layer;
//                     let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.name.toUpperCase())?.lg;
//                     if(relevantLayer && relevantLG) {
//                         let focusLGC = lgcGroupedByNetclass.get(netclass._id?.toString() as string)?.find(a => a.layergroupId === relevantLG.id)
//                         if(focusLGC)  {
//                             let lgcPropsMap = new Map<string, ConstraintValues>()
//                             focusLGC.associatedProperties.forEach(x => lgcPropsMap.set(x.name, x.value))
                            
//                             let forceDefault = (relevantLayer.isActive && relevantLG.isActive && ruleArea.isActive) ? false : true;

//                             let valArr = new Array<string>()
//                             for(let p = 0; p < MAIN_PHY_KEY_MAP.size; p++) {
//                                 let expVal = getLgcPropValue(MAIN_PHY_KEY_MAP.get(p+1) as string, forceDefault, apdKeyToPropNameMapping, lgcPropsMap);
//                                 valArr.push(expVal) 
//                             }

//                             data.get(ruleArea.ruleAreaName)?.get(netclass.name)?.set(layerIndex, valArr);
                            
//                         }
//                     }
//                 }
//             }
//         }
//     }

//     for(let i = 0; i < exportLayersSorted.length; i++) {
//         let stkLayer = exportLayersSorted[i]
//         let layerIndex = i + 1;

//         if(data.has(defRegMapKey) === false) {
//             data.set(defRegMapKey, new Map<string, Map<number, string[]>>([[defRegMapKey, new Map<number, string[]>([[layerIndex, []]])]]));
//         }

//         let xmodInit = (confDefaultRegionName && xmodNameMapping.has(confDefaultRegionName)) ? xmodNameMapping.get(confDefaultRegionName) : confDefaultRegionName;
//         let defaultXmodName = (xmodInit && ruleAreasSorted.some(a => (a.xmodName === xmodInit))) ? xmodInit : "DEFAULT";

//         let propToDefConEntryMap = defConDataOrganized.get(defConGoldenId)?.get(ConstraintTypesEnum.Physical)?.get(defaultXmodName.toUpperCase())?.get(stkLayer.name.toUpperCase())

//         let valArr = new Array<string>()
//         for(let p = 0; p < MAIN_PHY_KEY_MAP.size; p++) {
//             let expVal = getDefconPropValue(MAIN_PHY_KEY_MAP.get(p+1) as string, apdKeyToPropNameMapping, propToDefConEntryMap);
//             valArr.push(expVal) 
//         }

//         data.get(defRegMapKey)?.get(defRegMapKey)?.set(layerIndex, valArr);
//     }


//     return ""//{phy: "", clr: ""}
// }



// async function getClearanceConstraintExportStr(project: Project, commonDesc: string, pkg: PackageLayout, 
//     clrRelationElements: BasicProperty[], lgSetToLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>, 
//     apdKeyToPropNameMapping: Map<string, string>, defConDataOrganized:  Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>,
//     defConGoldenId: string, xmodNameMapping: Map<string, string>, importExportConfigs: ConfigItem[]) : Promise<string> {
    
//     let projectId = project._id?.toString() as string;
//     let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
// 	let confDefaultRegionName = importExportConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__CADENCE_IMPORT_DEFAULT_REGION.toLowerCase())?.configValue || ''
    
//     let data = new Map<string, Map<string, Map<number, string[]>>>();  //ruleArea, <netclass, <layerIndex, values[]>>>
//     const defRegMapKey = `DEFAULT_${crypto.randomUUID()}`
//     const MAIN_CLR_KEY_MAP = new Map<Number, string>([
//         [1, "THRUVIA_TO_THRUVIA_SPACING"],
//         [2, "BBV_TO_THRUVIA_SPACING"],
//         [3, "TESTVIA_TO_THRUVIA_SPACING"],
//         [4, "MVIA_TO_THRUVIA_SPACING"],
//         [5, "BBV_TO_BBV_SPACING"],
//         [6, "BBV_TO_TESTVIA_SPACING"],
//         [7, "MVIA_TO_BBV_SPACING"],
//         [8, "MVIA_TO_TESTVIA_SPACING"],
//         [9, "MVIA_TO_MVIA_SPACING"],
//         [10, "TESTVIA_TO_TESTVIA_SPACING"],
//         [11, "SMDPIN_TO_THRUVIA_SPACING"],
//         [12, "BBV_TO_SMDPIN_SPACING"],
//         [13, "SMDPIN_TO_TESTVIA_SPACING"],
//         [14, "MVIA_TO_SMDPIN_SPACING"],
//         [15, "SHAPE_TO_THRUVIA_SPACING"],
//         [16, "BBV_TO_SHAPE_SPACING"],
//         [17, "MVIA_TO_SHAPE_SPACING"],
//         [18, "SHAPE_TO_TESTVIA_SPACING"],
//         [19, "LINE_TO_THRUVIA_SPACING"],
//         [20, "BBV_TO_LINE_SPACING"],
//         [21, "LINE_TO_TESTVIA_SPACING"],
//         [22, "MVIA_TO_LINE_SPACING"],
//         [23, "LINE_TO_LINE_SPACING"],
//         [24, "LINE_TO_SMDPIN_SPACING"],
//         [25, "LINE_TO_SHAPE_SPACING"],
//         [26, "LINE_TO_THRUPIN_SPACING"],
//         [27, "LINE_TO_TESTPIN_SPACING"],
//         [28, "SHAPE_TO_SHAPE_SPACING"],
//         [29, "THRUPIN_TO_THRUVIA_SPACING"],
//         [30, "BBV_TO_THRUPIN_SPACING"],
//         [31, "TESTVIA_TO_THRUPIN_SPACING"],
//         [32, "TESTPIN_TO_THRUVIA_SPACING"],
//         [33, "BBV_TO_TESTPIN_SPACING"],
//         [34, "TESTPIN_TO_TESTVIA_SPACING"],
//         [35, "MVIA_TO_TESTPIN_SPACING"],
//         [36, "THRUPIN_TO_SHAPE_SPACING"],
//         [37, "SHAPE_TO_SMDPIN_SPACING"],
//         [38, "SHAPE_TO_TESTPIN_SPACING"],
//         [39, "THRUPIN_TO_THRUPIN_SPACING"],
//         [40, "THRUPIN_TO_SMDPIN_SPACING"],
//         [41, "TESTPIN_TO_THRUPIN_SPACING"],
//         [42, "MVIA_TO_THRUPIN_SPACING"],
//         [43, "SMDPIN_TO_SMDPIN_SPACING"],
//         [44, "SMDPIN_TO_TESTPIN_SPACING"],
//         [45, "TESTPIN_TO_TESTPIN_SPACING"],
//     ]);
    

//     let exportLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() === "metal");
//     let exportLayersSorted = sort(exportLayers).asc(a => a.index);
//     let clrRelationsSorted = sort(clrRelationElements).asc(x => x.name)
//     let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName);

//     for(let ruleArea of ruleAreasSorted) {
        
//         let rafilter = { ruleAreaId: ruleArea.id, constraintType: ConstraintTypesEnum.Clearance } as Filter<LayerGroupConstraints>
//         let lgcList = await lgcRepo.GetAllByProjectID(projectId, rafilter) ?? []
// 		let lgcGroupedByClearanceRelation : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId);

//         //refactor for relation id, name, lgsetID (and MAIN_PHY_KEY_MAP) -- vs netclass
//         for(let relation of clrRelationsSorted) {

//             for(let i = 0; i < exportLayersSorted.length; i++) {
//                 let stkLayer = exportLayersSorted[i]
//                 let layerIndex = i + 1;

//                 if(data.has(ruleArea.ruleAreaName) === false) {
//                     data.set(ruleArea.ruleAreaName, new Map<string, Map<number, string[]>>([[relation.name, new Map<number, string[]>([[layerIndex, []]])]]));
//                 }

//                 let lgToLayerMapForRelevantLGSet = lgSetToLayerToLayerGroupMapping.get(relation.value)
//                 if(lgToLayerMapForRelevantLGSet) {
//                     let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.name.toUpperCase())?.layer;
//                     let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.name.toUpperCase())?.lg;
//                     if(relevantLayer && relevantLG) {
//                         let focusLGC = lgcGroupedByClearanceRelation.get(relation.id?.toString() as string)?.find(a => a.layergroupId === relevantLG.id)
//                         if(focusLGC)  {
//                             let lgcPropsMap = new Map<string, ConstraintValues>()
//                             focusLGC.associatedProperties.forEach(x => lgcPropsMap.set(x.name, x.value))
                            
//                             let forceDefault = (relevantLayer.isActive && relevantLG.isActive && ruleArea.isActive) ? false : true;

//                             let valArr = new Array<string>()
//                             for(let p = 0; p < MAIN_CLR_KEY_MAP.size; p++) {
//                                 let expVal = getLgcPropValue(MAIN_CLR_KEY_MAP.get(p+1) as string, forceDefault, apdKeyToPropNameMapping, lgcPropsMap);
//                                 valArr.push(expVal) 
//                             }

//                             data.get(ruleArea.ruleAreaName)?.get(relation.name)?.set(layerIndex, valArr);
                            
//                         }
//                     }
//                 }
//             }
//         }
//     }

//     //refactor for ConstraintTypesEnum.Clearance
//     for(let i = 0; i < exportLayersSorted.length; i++) {
//         let stkLayer = exportLayersSorted[i]
//         let layerIndex = i + 1;

//         if(data.has(defRegMapKey) === false) {
//             data.set(defRegMapKey, new Map<string, Map<number, string[]>>([[defRegMapKey, new Map<number, string[]>([[layerIndex, []]])]]));
//         }

//         let xmodInit = (confDefaultRegionName && xmodNameMapping.has(confDefaultRegionName)) ? xmodNameMapping.get(confDefaultRegionName) : confDefaultRegionName;
//         let defaultXmodName = (xmodInit && ruleAreasSorted.some(a => (a.xmodName === xmodInit))) ? xmodInit : "DEFAULT";

//         let propToDefConEntryMap = defConDataOrganized.get(defConGoldenId)?.get(ConstraintTypesEnum.Clearance)?.get(defaultXmodName.toUpperCase())?.get(stkLayer.name.toUpperCase())

//         let valArr = new Array<string>()
//         for(let p = 0; p < MAIN_CLR_KEY_MAP.size; p++) {
//             let expVal = getDefconPropValue(MAIN_CLR_KEY_MAP.get(p+1) as string, apdKeyToPropNameMapping, propToDefConEntryMap);
//             valArr.push(expVal) 
//         }

//         data.get(defRegMapKey)?.get(defRegMapKey)?.set(layerIndex, valArr);
//     }


//     return ""//{phy: "", clr: ""}
// }





//======================================================================

// if(raConf && raConf.defaultXMod && raConf.defaultXMod.length > 0) {
//     let defName = raConf.xmodConversion?.find((a: any) => a.sourceXmodName.toUpperCase() === raConf.defaultXMod.toUpperCase())?.targetXmodName || raConf.defaultXMod
//     if(raConf.xmods && raConf.xmods.includes(defName) === false) {
//         throw new Error(`Configured default xmod '${defName} was not found in list of valid xmods. Please check config management system`)
//     }
//     defaultXModContextProp = defName;
// }





// for(let prop of project.constraintSettings) {
    //     if(prop.category) {
    //         //get the export config for the given prop item 
    //         let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
            
    //         if(exportSettings && exportSettings.xpeditionKeys && exportSettings.xpeditionKeys.length > 0) {
    //             if (prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
    //                 netExportSettingsMap.set(prop.name, exportSettings)
    //             }
    //             else if(prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase()) {
    //                 for(let expEntry of exportSettings.xpeditionKeys) {
    //                     let expKey = expEntry.replaceAll(" ", "").toUpperCase()
    //                     if(phyXpedKeyToPropNameMapping.has(expKey)) {
    //                         phyXpedKeyToPropNameMapping.get(expKey)?.push(prop.name)
    //                     }
    //                     else {
    //                         phyXpedKeyToPropNameMapping.set(expKey, [prop.name])
    //                     }
    //                 }
    //             }
    //             else if(prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase()) {
    //                 for(let expEntry of exportSettings.xpeditionKeys) {
    //                     let expKey = expEntry.replaceAll(" ", "").toUpperCase()
    //                     if(clrXpedKeyToPropNameMapping.has(expKey)) {
    //                         clrXpedKeyToPropNameMapping.get(expKey)?.push(prop.name)
    //                     }
    //                     else {
    //                         clrXpedKeyToPropNameMapping.set(expKey, [prop.name])
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }