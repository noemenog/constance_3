
import * as ExcelJS from 'exceljs';
import { ServiceModelRepository } from '../Repository/ServiceModelRepository';
import { C2CRow, C2CRowSlot, DefaultConstraints, DefConEntry, Interface, Layer, LayerGroup, LayerGroupConstraints, Net, Netclass, PackageLayout, Project, RuleArea, StackupLayer } from '../Models/ServiceModels';
import { C2C_ROW_ALLCOLUMN_SLOT_NAME, ConstraintTypesEnum, DBCollectionTypeEnum, NET_RETRIEVAL_BATCH_SIZE, NETLIST_EXPORT_NETNAME_COL_HEADER, NETLIST_EXPORT_SHEET_NAME, ProjectPropertyCategoryEnum, StackupRoutingLayerTypeEnum, StackupConstants, ProjectDataDownloadContentTypeEnum } from '../Models/Constants';
import { sort } from 'fast-sort';
import exceljs from 'exceljs';
import { BasicProperty, ConstraintConfExportContext, PropertyItem, User } from '../Models/HelperModels';
import { Filter, Sort } from 'mongodb';
import { groupBy } from './UtilFunctions';
import { getClassRelationNameElementsForInterface } from './NetClassificationLogic';
import AdmZip from 'adm-zip';
import { organizeDefaultConstraints } from './DefaultConstraintsLogic';


//https://github.com/exceljs/exceljs/issues/960#issuecomment-1698549072
const { Workbook } = exceljs;


export async function producePdrdExportContent(project: Project, user: User|null, commonDesc: string, outputType: ProjectDataDownloadContentTypeEnum) : Promise<Buffer>{
    let projectId = project._id?.toString() as string;
    
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let pkg = await pkgRepo.GetOneByProjectID(projectId)
    if(!pkg) { throw new Error(`Cannot process constraints retrieval. Failed to retrieve valid layout info.`) }
    if(!pkg.stackupLayers || pkg.stackupLayers.length === 0) { throw new Error(`Cannot process constraints retrieval. Stackup layers not found.`) }
    if(!pkg.layerGroupSets || pkg.layerGroupSets.length === 0) { throw new Error(`Cannot process constraints retrieval. Layer groups not found.`) }
    
    let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
    let projection = { name: 1, createdOn: 1, createdBy: 1, associatedProperties: 1 }
    let interfaceList = await ifaceRepo.GetAllByProjectIDAndProjection(projectId, null, projection) ?? []
    
    let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
    let netclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []

    // https://github.com/exceljs/exceljs/issues/960#issuecomment-1698549072
    let workbook = new Workbook();  
    workbook.creator = user?.email || `Spider`;
    workbook.lastModifiedBy = user?.email || `Spider`;
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.company = "Intel Corporation"
    workbook.description = commonDesc;
    workbook.keywords = projectId;
    workbook.subject = outputType;

    const headerStyle = { 
        alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment, 
        font: { size: 12, bold: true, color: { argb: '000000' } } as ExcelJS.Font,
        fill : { type: 'pattern', pattern:'solid', fgColor: {argb:'87cefa'} } as ExcelJS.Fill,
        border: {
            top: {style:'thin', color: {argb:'b3b3b3'}},
            left: {style:'thin', color: {argb:'b3b3b3'}},
            bottom: {style:'thin', color: {argb:'b3b3b3'}},
            right: {style:'thin', color: {argb:'b3b3b3'}}
        }
    }
    const altHeaderStyle = { 
        alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment, 
        font: { size: 12, bold: true, color: { argb: '000000' } } as ExcelJS.Font,
        fill : { type: 'pattern', pattern:'solid', fgColor: {argb:'d3d3d3'} } as ExcelJS.Fill,
        border: {
            top: {style:'thin', color: {argb: 'f5f5f5'}},
            left: {style:'thin', color: {argb: 'f5f5f5'}},
            bottom: {style:'thin', color: {argb: 'f5f5f5'}},
            right: {style:'thin', color: {argb: 'f5f5f5'}}
        }
    }  

    const sectionHeaderStyle = { 
        alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment, 
        font: { size: 16, bold: true, color: { argb: '000000' } } as ExcelJS.Font,
        fill : { type: 'pattern', pattern: 'solid', fgColor: {argb: 'ededed'} } as ExcelJS.Fill
    };

    const offBlueTab = "8395c1";
    const purpleTab = "c7bbc9"
    const pinkTab = "e69aab"
    const greenTab = "9dba9a"
    const tealTab = "83adb5"
    const offGoldTab = "c1af83"

    const blockedCellFill = { type: 'pattern', pattern:'solid', fgColor: {argb:'333333'} } 
    const allColumnCellFill = { type: 'pattern', pattern:'solid', fgColor: {argb:'f2f2f2'} } 

    if(outputType === ProjectDataDownloadContentTypeEnum.NETINFO) {
        workbook = await handleNetListSheets(project, interfaceList, netclasses, workbook, pinkTab, headerStyle, altHeaderStyle);
    }
    else {
        workbook = await handleProjectDescriptionSheet(project, workbook, offBlueTab, headerStyle, altHeaderStyle);
        workbook = await handleStackupSheet(pkg, workbook, purpleTab, headerStyle, altHeaderStyle);
        workbook = await handleNetListSheets(project, interfaceList, netclasses, workbook, pinkTab, headerStyle, altHeaderStyle);
        workbook = await handleClassRelationsLayoutSheet(project, pkg, netclasses, workbook, greenTab, blockedCellFill, allColumnCellFill, headerStyle, altHeaderStyle, sectionHeaderStyle);
        workbook = await handleDefaultRoutingRulesSheet(project, pkg, netclasses, workbook, tealTab, headerStyle, altHeaderStyle, sectionHeaderStyle);
        workbook = await handleInterfaceSheets(project, pkg, interfaceList, netclasses, workbook, offGoldTab, headerStyle, altHeaderStyle, sectionHeaderStyle);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    let arrayBuffer = await blob.arrayBuffer();
    const outBuffer = Buffer.from(arrayBuffer);

    return outBuffer
}



async function handleProjectDescriptionSheet(project: Project, workbook: ExcelJS.Workbook, tabColor: string, headerStyle: any, altHeaderStyle: any) : Promise<ExcelJS.Workbook> {
    let projDescItems: Map<string, string> = new Map<string, string>([
        ["Project Name", project.name.trim()],
        ["Project Owner", project.owner.email],
        ["Created By", project.createdBy],
        ["Created On", new Date(project.createdOn).toString()],
        ["Division", project.org.toUpperCase()],
        // ["Maturity", project.maturity.trim()],
        ["Description", project.description.trim()]
    ]);
    let projKeyContactItems: Map<string, string> = new Map<string, string>();

    let exportableProps = project.profileProperties?.filter(a => (a.contextProperties && a.contextProperties.length > 0) && a.contextProperties.some(x => x.name.toLowerCase().trim() === "export_context"));
    for (let i = 0; i < exportableProps.length; i++) {
        let propItem = exportableProps[i] as PropertyItem;
        let exportSettings: ConstraintConfExportContext = propItem.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "export_context")?.value;
        if (exportSettings.exportEnabled && exportSettings.exportEnabled === true) {
            if (exportSettings && exportSettings.subType) {
                if (exportSettings.subType.toLowerCase().trim() === "project_description") {
                    projDescItems.set(propItem.displayName || propItem.name, propItem.value);
                }
                else if (exportSettings.subType.toLowerCase().trim() === "key_contacts") {
                    projKeyContactItems.set(propItem.displayName || propItem.name, propItem.value);
                }
            }
        }
    }

    let descRowCount = 0;
    const descWorksheet = workbook.addWorksheet('Project_Description', { properties: { tabColor: { argb: tabColor } } });

    descWorksheet.insertRow(++descRowCount, ["Project Information", ""]);
    descWorksheet.mergeCells(descRowCount, 1, descRowCount, 2);
    for (let cell of [`A${descRowCount}`, `B${descRowCount}`]) {
        descWorksheet.getCell(cell).alignment = headerStyle.alignment;
        descWorksheet.getCell(cell).fill = headerStyle.fill;
        descWorksheet.getCell(cell).font = headerStyle.font;
    }
    descWorksheet.insertRow(++descRowCount, ["Property", "Value"]);
    for (let cell of [`A${descRowCount}`, `B${descRowCount}`]) {
        descWorksheet.getCell(cell).alignment = altHeaderStyle.alignment;
        descWorksheet.getCell(cell).fill = altHeaderStyle.fill;
        descWorksheet.getCell(cell).font = altHeaderStyle.font;
        descWorksheet.getCell(cell).border = altHeaderStyle.border;
    }
    for (let [key, value] of projDescItems) {
        descWorksheet.insertRow(++descRowCount, [key, value]);
    }

    descWorksheet.insertRow(++descRowCount, ["", ""]);
    descWorksheet.insertRow(++descRowCount, ["", ""]);

    descWorksheet.insertRow(++descRowCount, [`Key Roles/Contacts`, ""]);
    descWorksheet.mergeCells(descRowCount, 1, descRowCount, 2);
    for (let cell of [`A${descRowCount}`, `B${descRowCount}`]) {
        descWorksheet.getCell(cell).alignment = headerStyle.alignment;
        descWorksheet.getCell(cell).fill = headerStyle.fill;
        descWorksheet.getCell(cell).font = headerStyle.font;
    }
    descWorksheet.insertRow(++descRowCount, ["Role", "Name"]);
    for (let cell of [`A${descRowCount}`, `B${descRowCount}`]) {
        descWorksheet.getCell(cell).alignment = altHeaderStyle.alignment;
        descWorksheet.getCell(cell).fill = altHeaderStyle.fill;
        descWorksheet.getCell(cell).font = altHeaderStyle.font;
        descWorksheet.getCell(cell).border = altHeaderStyle.border;
    }
    for (let [key, value] of projKeyContactItems) {
        descWorksheet.insertRow(++descRowCount, [key, value]);
    }

    descWorksheet.getColumn(1).width = 45;
    descWorksheet.getColumn(2).width = 50;

    return workbook
}



async function handleStackupSheet(pkg: PackageLayout, workbook: ExcelJS.Workbook, tabColor: string, headerStyle: any, altHeaderStyle: any) : Promise<ExcelJS.Workbook> {
    let stackupLayersSorted = sort(pkg.stackupLayers).asc(a => a.index);
    const stackupWorksheet = workbook.addWorksheet('Stackup', { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
    
    stackupWorksheet.columns = [
        { header: "Name", key: "name", width: 20 },
        { header: "Type", key: "type", width: 20, style: { alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment } },
        { header: "RoutingLayer", key: "routingLayerType", width: 20, style: { alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment } },
        { header: "Thickness", key: "thickness", width: 20, style: { alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment } },
        { header: "Material", key: "material", width: 40, style: { alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment } },
    ];

    stackupLayersSorted.forEach(a => {
        stackupWorksheet.addRow({
            name: a.name,
            type: a.type,
            routingLayerType: a.routingLayerType,
            thickness: a.thickness,
            material: a.material,
        });
    });

    stackupWorksheet.getRow(1).eachCell((cell, colNumber) => {
        if(typeof(cell.row) === 'number' && (colNumber <= stackupWorksheet.columns.length + 1)) {
            cell.fill = headerStyle.fill
            cell.font = headerStyle.font
            cell.alignment = headerStyle.alignment
            cell.border = headerStyle.border
        }
    });
    return workbook
}



async function handleNetListSheets(project: Project, interfaceList: Interface[], netclasses: Netclass[], workbook: ExcelJS.Workbook,  tabColor: string, headerStyle: any, altHeaderStyle: any): Promise<ExcelJS.Workbook> {
    //TODO: handle ConstraintClass

    const CHUNK_ROW_LIMIT = 1000000;  //hardcoded on purpose
    
    let projectId = project._id?.toString() as string;
    let ifaceIdToNameMapping = new Map<string, string>();
    for(let iface of interfaceList) {
        ifaceIdToNameMapping.set(iface._id?.toString() as string, iface.name)
    }
    
    let ncIdToNameMapping = new Map<string, string>();
    for(let nc of netclasses) {
        ncIdToNameMapping.set(nc._id?.toString() as string, nc.name)
    }

    let projectMGP = project.associatedProperties?.find(a => (
        a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))
    let matchGroupIdToNameMapping = new Map<string, string>();
    let matchGroupIdToValueMapping = new Map<string, string>();
    if(projectMGP && projectMGP.value && projectMGP.value.length > 0) {
        for(let mgp of (projectMGP.value as BasicProperty[])) {
            let mgpValueAsString = mgp.value?.toString()?.trim() || 0
            if(mgp.id && mgp.id.trim().length > 0 && mgp.name && mgp.name.trim().length > 0) {
                matchGroupIdToNameMapping.set(mgp.id, mgp.name);
                matchGroupIdToValueMapping.set(mgp.id, mgpValueAsString);
            }
        }
    }

    let columnSet = false
    let rowCount = 0;
    let currentSheetIndex = workbook.worksheets.length;
    let netsSheetNames = new Array<string>();
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let sortSpec : Sort = { interfaceId: 1, netclassId: 1 }
    let netCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, null, null, NET_RETRIEVAL_BATCH_SIZE, sortSpec)
    
    netsSheetNames.push(NETLIST_EXPORT_SHEET_NAME);
    workbook.addWorksheet(netsSheetNames[0], { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 4, ySplit: 1 }] });

    for await (let projNet of netCursor) {  
        let netProps = sort(projNet.associatedProperties).asc(a => a.name.toUpperCase());
    
        if(columnSet === false) {
            let initColNames = ["Interface", "ConstraintClass", "Netclass", NETLIST_EXPORT_NETNAME_COL_HEADER]
            let colNames = netProps.map(a => (a.displayName || a.name))
            let concat = initColNames.concat(colNames)
            let headerRow = workbook.worksheets[currentSheetIndex].insertRow(++rowCount, concat);
            headerRow.eachCell((cell, colNumber) => {
                if(typeof(cell.row) === 'number' && (colNumber <= concat.length + 1)) {
                    cell.fill = headerStyle.fill
                    cell.font = headerStyle.font
                    cell.alignment = headerStyle.alignment
                    cell.border = headerStyle.border
                }
            });
            columnSet = true;
        }

        let ifaceName = ifaceIdToNameMapping.get(projNet.interfaceId || '') || "ALL";
        let netclassName = ncIdToNameMapping.get(projNet.netclassId || '') || "DEFAULT";
        let constrClassName = ''; // consrClassIdToNameMapping.get(projNet.netclassId || '') || "ALL";
        let propValues = new Array<string>();
        for(let prop of netProps) {
            let pValue = prop.value.customValue || prop.value.defautlValue || prop.value.configValue || "";
            if(matchGroupIdToNameMapping.has(pValue)) {
                pValue = `${matchGroupIdToValueMapping.get(pValue)}  (${matchGroupIdToNameMapping.get(pValue)})`
            }
            propValues.push(pValue)
        }
        workbook.worksheets[currentSheetIndex].insertRow(++rowCount, [ifaceName, constrClassName, netclassName, projNet.name, ...propValues]);

        if ((rowCount % CHUNK_ROW_LIMIT === 0)){
            netsSheetNames.push(`${NETLIST_EXPORT_SHEET_NAME}_${netsSheetNames.length}`);
            workbook.addWorksheet(netsSheetNames[netsSheetNames.length - 1], { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 4, ySplit: 1 }] });
            currentSheetIndex = currentSheetIndex + 1
            columnSet = false;
            rowCount = 0
        }
    }

    for(let x = 0; x < netsSheetNames.length; x++) {
        let sheet = workbook.getWorksheet(netsSheetNames[x]) as ExcelJS.Worksheet
        let colCount = sheet.actualColumnCount
        for(let i = 1; i <= colCount; i++) {
            sheet.getColumn(i).width = 20;
        }
    }

    return workbook
}



async function handleClassRelationsLayoutSheet(project: Project, pkg: PackageLayout, netclasses: Netclass[], workbook: ExcelJS.Workbook, 
    tabColor: string, blockedCellFill: any, allColumnCellFill: any, headerStyle: any, altHeaderStyle: any, sectionHeaderStyle: any): Promise<ExcelJS.Workbook> {
    let projectId = project._id?.toString() as string;
    
    let clrRelationIdToNameMap = new Map<string, string>();
    for(let clrRel of (project.clearanceRelationBrands ?? [])) {
        clrRelationIdToNameMap.set(clrRel.id, clrRel.name)
    }

    let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName.toUpperCase());
    
    let ncIdToNameMapping = new Map<string, string>();
    for(let nc of netclasses) {
        let ncid = nc._id?.toString() as string
        ncIdToNameMapping.set(ncid, nc.name)
    }

    for(let ruleArea of ruleAreasSorted) {
        let rowCount = 0;
        let headerInserted = false;
        let filter = {ruleAreaId: ruleArea.id} as Filter<C2CRow>
        let c2cRepo = new ServiceModelRepository<C2CRow>(DBCollectionTypeEnum.C2C_ROW_COLLECTION)
        let c2cData = await c2cRepo.GetAllByProjectID(projectId, filter)
        let sheetName = `C2C_${ruleArea.ruleAreaName.replaceAll(" ", "_")}`
        
        workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
        
        if(c2cData && c2cData.length > 0) {
            let c2cDataSorted = sort(c2cData).asc(x => ncIdToNameMapping.get(x.netclassId)?.toUpperCase());

            for(let c = 0; c < c2cDataSorted.length; c++) {
                let c2c = c2cDataSorted[c]
                let allSlot = c2c.slots.find(a => a.name === C2C_ROW_ALLCOLUMN_SLOT_NAME) as C2CRowSlot;
                let otherSlots = c2c.slots.filter(a => a.name !== C2C_ROW_ALLCOLUMN_SLOT_NAME)
                c2c.slots = [allSlot, ...(sort(otherSlots).asc(x => ncIdToNameMapping.get(x.netclassId)?.toUpperCase()))];
                
                if (headerInserted === false) {
                    let ruleAreaHeaderRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [ruleArea.ruleAreaName.toUpperCase()]);
                    (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).mergeCells(rowCount, 1, rowCount, 3);
                    ruleAreaHeaderRow.eachCell((cell, colNumber) => {
                        if(typeof(cell.row) === 'number' && (colNumber <= 3)) {
                            cell.fill = sectionHeaderStyle.fill,
                            cell.font = sectionHeaderStyle.font,
                            cell.alignment = sectionHeaderStyle.alignment
                        }
                    });
                    
                    let colNames = c2c.slots.map((a: C2CRowSlot) => ((a.name && a.name.trim().length > 0) ? a.name : (ncIdToNameMapping.get(a.netclassId) as string)));
                    let headerRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, ["", ...colNames]); //warning: blank is needed!!
                    headerRow.eachCell((cell, colNumber) => {
                        if(typeof(cell.row) === 'number' && (colNumber <= c2c.slots.length + 1)) {
                            cell.fill = headerStyle.fill
                            cell.font = headerStyle.font
                            cell.alignment = headerStyle.alignment
                            cell.border = headerStyle.border
                        }
                    });
                    
                    (workbook.getWorksheet(sheetName)?.getCell("A1") as ExcelJS.Cell).fill = { type: 'pattern', pattern:'solid', fgColor: {argb:'FFFFFF'} } as ExcelJS.Fill;
                    headerInserted = true;
                }

                let slotValues = c2c.slots.map(a => (clrRelationIdToNameMap.get(a.value) || ''));
                let row = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [ncIdToNameMapping.get(c2c.netclassId), ...slotValues]);
                row.eachCell((cell, colNumber) => {
                    if(typeof(cell.row) === 'number' && colNumber === 1 && ((cell.row as number) <= c2c.slots.length + 1)) {
                        cell.fill = headerStyle.fill
                        cell.font = headerStyle.font
                        cell.border = headerStyle.border
                    }
                    if(typeof(cell.row) === 'number' && colNumber === 2 && ((cell.row as number) <= c2c.slots.length + 1)) {
                        cell.fill = allColumnCellFill as ExcelJS.Fill
                        cell.border = headerStyle.border
                    }
                    if(colNumber > c + 3 && colNumber <= c2c.slots.length + 1) {
                        cell.fill = blockedCellFill as ExcelJS.Fill
                        cell.border = headerStyle.border
                    }
                })
            }

        }

        let colCount = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).actualColumnCount;
        for(let i = 1; i <= colCount; i++) {
            (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).getColumn(i).width = 20;
        }
    }
    
    return workbook
}



async function handleDefaultRoutingRulesSheet(project: Project, pkg: PackageLayout, netclasses: Netclass[], 
    workbook: ExcelJS.Workbook, tabColor: string, headerStyle: any, altHeaderStyle: any, sectionHeaderStyle: any): Promise<ExcelJS.Workbook> {  
    
    const sheetName = "ALL (Default)"
    const phyConstantNCName = `(Default)`
    const clearanceConstantRuleName = `(Default Rule)`

    let projectId = project._id?.toString() as string;
    let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	
    let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName.toUpperCase());

    let nonSolderResistLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() !== "solderresist")
    let allLayerNamesSorted = sort(nonSolderResistLayers).asc(a => a.index)?.map(x => x.name);
    let exportLayerMapping = new Map<string, StackupLayer>();
    for(let stkLyr of nonSolderResistLayers) {
        if(stkLyr.type.toLowerCase() === "metal"){
            exportLayerMapping.set(stkLyr.name, stkLyr)
        }
    }

    let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
    let defConList = await defConRepo.GetAllByProjectID(projectId);
    if(!defConList || defConList.length === 0) { 
        throw new Error(`Cannot process constraints retrieval. Default constrints were not found for the project.`) 
    }
    let defConGoldenId = defConList.find(a => (a.isGolden === true))?._id?.toString() as string
    let defConDataOrganized : Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>> = organizeDefaultConstraints(defConList);

    let rowCount = 0;
    let anyNcId = netclasses?.at(0)?._id?.toString() as string || ''  //cannot be null/undefined etc
    let anyClrRelId = project.clearanceRelationBrands?.at(0)?.id as string || ''  //cannot be null/undefined etc

    workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 3}] });
    
    //handle default physical rules ----------------------------------------
    let phyFilter = { constraintType: ConstraintTypesEnum.Physical, ownerElementId: anyNcId } as Filter<LayerGroupConstraints>
    let phyLgcList = await lgcRepo.GetAllByProjectID(projectId, phyFilter) ?? []
    let phyGroupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(phyLgcList, a => a.ruleAreaId)
    
    let phyResp = processRRLayersForExport(true, workbook, ruleAreasSorted, phyConstantNCName, ConstraintTypesEnum.Physical, allLayerNamesSorted, 
        phyGroupByRuleAreaMap, false, sheetName, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, "", 
        null, defConGoldenId, defConDataOrganized);

    rowCount = phyResp.rowCountVal; 


    (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);


    //handle default rules for interface ----------------------------------------
    let clrFilter = { constraintType: ConstraintTypesEnum.Clearance, ownerElementId: anyClrRelId } as Filter<LayerGroupConstraints>
    let clrLgcList = await lgcRepo.GetAllByProjectID(projectId, clrFilter) ?? []
    let clrGroupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(clrLgcList, a => a.ruleAreaId)

    let clrResp = processRRLayersForExport(true, workbook, ruleAreasSorted, clearanceConstantRuleName, ConstraintTypesEnum.Clearance, allLayerNamesSorted, 
        clrGroupByRuleAreaMap, false, sheetName, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, "", 
        null, defConGoldenId, defConDataOrganized);

    rowCount = clrResp.rowCountVal; 
    

    //set column widths ----------------------------------------
    let colCount = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).actualColumnCount;
    for(let i = 1; i <= colCount; i++) {
        (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).getColumn(i).width = 25;
    }

    return workbook
}



async function handleInterfaceSheets(project: Project, pkg: PackageLayout, interfaceList: Interface[], netclasses: Netclass[], 
    workbook: ExcelJS.Workbook, tabColor: string, headerStyle: any, altHeaderStyle: any, sectionHeaderStyle: any): Promise<ExcelJS.Workbook> {   
    let projectId = project._id?.toString() as string;
    let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
	
    let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName.toUpperCase());

    let nonSolderResistLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() !== "solderresist")
    let allLayerNamesSorted = sort(nonSolderResistLayers).asc(a => a.index)?.map(x => x.name);
    let exportLayerMapping = new Map<string, StackupLayer>();
    for(let stkLyr of nonSolderResistLayers) {
        if(stkLyr.type.toLowerCase() === "metal"){
            exportLayerMapping.set(stkLyr.name, stkLyr)
        }
    }

    let ifaceIdToNameMapping = new Map<string, string>();
    let ifaceIdToNetclassListMapping = new Map<string, Netclass[]>();
    for(let iface of interfaceList) {
        ifaceIdToNameMapping.set(iface._id?.toString() as string, iface.name)
        ifaceIdToNetclassListMapping.set(iface._id?.toString() as string, [])
    }

    let ncIdToNameMapping = new Map<string, string>();
    for(let nc of netclasses) {
        let ncid = nc._id?.toString() as string
        ncIdToNameMapping.set(ncid, nc.name)
        ifaceIdToNetclassListMapping.set(nc.interfaceId, (ifaceIdToNetclassListMapping.get(nc.interfaceId) ?? []).concat([nc]))
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

    for(let iface of interfaceList) {
        let isPhysicalHeaderInserted = false;
        let isClearanceHeaderInserted = false;
        let rowCount = 0;
        
        workbook.addWorksheet(iface.name, { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 3}] }); //, ySplit: 1 
        
        //handle interface physical rules ----------------------------------------
        let ifaceNetclasses = ifaceIdToNetclassListMapping.get(iface._id?.toString() as string) ?? new Array<Netclass>()
        let netclassesSorted = sort(ifaceNetclasses).asc(x => x.name.toUpperCase())
        
        for(let netclass of netclassesSorted) {
            let ncid = netclass._id?.toString() as string

            let filter = { constraintType: ConstraintTypesEnum.Physical, ownerElementId: ncid } as Filter<LayerGroupConstraints>
            let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
            let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId);

            let resp = processRRLayersForExport(false, workbook, ruleAreasSorted, netclass.name, ConstraintTypesEnum.Physical, allLayerNamesSorted, 
                groupByRuleAreaMap, isPhysicalHeaderInserted, iface.name, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, 
                netclass.layerGroupSetId, lgSetLayerToLayerGroupMapping, null, null);

            isPhysicalHeaderInserted = resp.headerInsertStatus;
            rowCount = resp.rowCountVal; 
        }
        

        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);


        //handle clearance rules for interface ----------------------------------------
        let relsForIface: BasicProperty[] = await getClassRelationNameElementsForInterface(project, iface._id?.toString() as string, null)
        let relsForIfaceSorted = sort(relsForIface).asc(x => x.name.toUpperCase())

        for(let relation of relsForIfaceSorted) {
            
            let filter = { constraintType: ConstraintTypesEnum.Clearance, ownerElementId: relation.id } as Filter<LayerGroupConstraints>
            let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
            let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId)

            let resp = processRRLayersForExport(false, workbook, ruleAreasSorted, relation.name, ConstraintTypesEnum.Clearance, allLayerNamesSorted, 
                groupByRuleAreaMap, isClearanceHeaderInserted, iface.name, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, 
                relation.value, lgSetLayerToLayerGroupMapping, null, null);

            isClearanceHeaderInserted = resp.headerInsertStatus;
            rowCount = resp.rowCountVal; 
        }


        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);


        //handle interface properties ----------------------------------------
        let ifaceDescItems: Map<string, string> = new Map<string, string>([
            ["Interface Name", iface.name.trim()],
            ["Created By", iface.createdBy],
            ["Created On", new Date(iface.createdOn).toString()],
        ]);
        
        let exportableProps = iface.associatedProperties?.filter(a => (a.contextProperties && a.contextProperties.length > 0) && a.contextProperties.some(x => x.name.toLowerCase().trim() === "export_context"));
        for (let i = 0; i < exportableProps.length; i++) {
            let propItem = exportableProps[i] as PropertyItem;
            let exportSettings: ConstraintConfExportContext = propItem.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "export_context")?.value;
            if (exportSettings.exportEnabled && exportSettings.exportEnabled === true) {
                if (exportSettings && exportSettings.subType) {
                    if (exportSettings.subType.toLowerCase().trim() === "interface_description") {
                        ifaceDescItems.set(propItem.displayName || propItem.name, propItem.value);
                    }
                }
            }
        }
    
        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, ["Interface Information", ""]);
        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).mergeCells(rowCount, 1, rowCount, 2);
        for (let cell of [`A${rowCount}`, `B${rowCount}`]) {
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).alignment = sectionHeaderStyle.alignment;
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).fill = sectionHeaderStyle.fill;
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).font = sectionHeaderStyle.font;
        }
        (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, ["Property", "Value"]);
        for (let cell of [`A${rowCount}`, `B${rowCount}`]) {
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).alignment = altHeaderStyle.alignment;
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).fill = headerStyle.fill;
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).font = headerStyle.font;
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).border = headerStyle.border;
        }
        for (let [key, value] of ifaceDescItems) {
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [key, value]);
        }


        //set column widths ----------------------------------------
        let colCount = (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).actualColumnCount;
        for(let i = 1; i <= colCount; i++) {
            (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getColumn(i).width = 25;
        }

    }

    return workbook
}



function processRRLayersForExport(defaultConstrDataSheetScenario: boolean, workbook: ExcelJS.Workbook, ruleAreas: RuleArea[], entityName: string, 
    constraintType: ConstraintTypesEnum, allLayerNamesSorted: string[], groupByRuleAreaMap: Map<string, LayerGroupConstraints[]>, headerInserted: boolean, 
    sheetName: string, rowCount: number, headerStyle: any, altHeaderStyle: any, sectionHeaderStyle: any, exportLayerMapping: Map<string, StackupLayer>, 
    layerGroupSetId: string, lgSetLayerToLayerGroupMapping: Map<string, Map<string, { layer: Layer; lg: LayerGroup; }>>|null,
    defConGoldenId: string | null, defConDataOrganized: Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>>|null) {
    
    for (let i = 0; i < allLayerNamesSorted.length; i++) {
        let stkLayer = allLayerNamesSorted[i];
        let raConcatDataSet = new Array<string>();

        for (let ruleArea of ruleAreas ?? []) {
            let relevantLGCs = groupByRuleAreaMap.get(ruleArea.id);

            if (relevantLGCs && relevantLGCs.length > 0) {
                if (headerInserted === false) {
                    let lgcProps = sort(relevantLGCs[0].associatedProperties).asc(a => a.name.toUpperCase()); //Important!
                    let entryName = constraintType === ConstraintTypesEnum.Physical ? "Netclass" : "RuleName";
                    let initColNames = [entryName, "Layer", "Routing"];
                    let colNames = lgcProps.map(a => (a.displayName || a.name));
                    let raHeader = new Array<string>();
                    let mainHeader = Array.from(initColNames);
                    let emptyRAHeaderEnt = Array<string>(colNames.length - 1).fill("");
                    initColNames.forEach(a => raHeader.push(""));

                    for (let ra of ruleAreas) {
                        raHeader = raHeader.concat([ra.ruleAreaName, ...emptyRAHeaderEnt]);
                        mainHeader = mainHeader.concat(colNames);
                    }

                    //Set the rule type
                    let ruleType = constraintType === ConstraintTypesEnum.Physical ? "PHYSICAL RULES" : "CLEARANCE RULES";
                    let typeHeaderRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [ruleType]);
                    (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).mergeCells(rowCount, 1, rowCount, 3);
                    typeHeaderRow.eachCell((cell, colNumber) => {
                        if(typeof(cell.row) === 'number' && (colNumber <= 3)) {
                            cell.fill = sectionHeaderStyle.fill,
                            cell.font = sectionHeaderStyle.font,
                            cell.alignment = sectionHeaderStyle.alignment
                        }
                    });

                    //Set the Rule Area row
                    let raHeaderRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, raHeader);
                    raHeaderRow.eachCell((cell, colNumber) => {
                        if(typeof(cell.row) === 'number' && (colNumber <= raHeader.length + 1)) {
                            cell.fill = altHeaderStyle.fill
                            cell.font = { size: 14, bold: false, color: { argb: 'D20808' } } as ExcelJS.Font,
                            cell.alignment = altHeaderStyle.alignment
                            cell.border = altHeaderStyle.border
                        }
                    });

                    //Set the Rule properties row
                    let mainHeaderRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, mainHeader);
                    mainHeaderRow.eachCell((cell, colNumber) => {
                        if(typeof(cell.row) === 'number' && (colNumber <= mainHeader.length + 1)) {
                            cell.fill = headerStyle.fill
                            cell.font = headerStyle.font,
                            cell.alignment = headerStyle.alignment
                            cell.border = headerStyle.border
                        }
                    });
                    
                    headerInserted = true;
                }

                if (exportLayerMapping.has(stkLayer)) {
                    if(defaultConstrDataSheetScenario === false) {  
                        let lgToLayerMapForRelevantLGSet = lgSetLayerToLayerGroupMapping?.get(layerGroupSetId);
                        if (lgToLayerMapForRelevantLGSet) {
                            let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.layer;
                            let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.lg;
                            if (relevantLayer && relevantLG) {
                                let focusLGC = relevantLGCs?.find(a => a.layerGroupId === relevantLG.id);
                                if (focusLGC) {
                                    let focusLgcProps = sort(focusLGC.associatedProperties).asc(a => a.name.toUpperCase()); //Important!
                                    let pValueArr = new Array<string>();
                                    for (let prop of focusLgcProps) {
                                        let pValue = prop.value.customValue || prop.value.defautlValue || prop.value.configValue || "";
                                        pValueArr.push(pValue);
                                    }
                                    raConcatDataSet = raConcatDataSet.concat(pValueArr);
                                }

                            }
                        }
                    }
                    else {
                        let defConDataSetId = ruleArea.defaultConstraintId || defConGoldenId;
                        if(defConDataOrganized && defConDataSetId) {
                            let propToDefConEntryMap : Map<string, DefConEntry[]> | undefined;
                            
                            if(constraintType === ConstraintTypesEnum.Physical) {
                                propToDefConEntryMap = defConDataOrganized.get(defConDataSetId)?.get(constraintType)?.get(ruleArea.xmodName.toUpperCase())?.get(stkLayer.toUpperCase())
                            }
                            else {
                                let lyrToPropNameAndDCEMap = defConDataOrganized.get(defConDataSetId)?.get(ConstraintTypesEnum.Clearance)?.get(ruleArea.xmodName.toUpperCase())
                                if(lyrToPropNameAndDCEMap && lyrToPropNameAndDCEMap.has(StackupConstants.SurfaceLayerName)) {
                                    propToDefConEntryMap = lyrToPropNameAndDCEMap.get(StackupConstants.SurfaceLayerName); 
                                }
                                else if (lyrToPropNameAndDCEMap && lyrToPropNameAndDCEMap.has(StackupConstants.LAYER_SURFACE_OUTER)) {
                                    propToDefConEntryMap = lyrToPropNameAndDCEMap?.get(StackupConstants.LAYER_SURFACE_OUTER);
                                }
                            }

                            let focusLgcProps = sort(relevantLGCs[0].associatedProperties).asc(a => a.name.toUpperCase()); //Important!
                            let pValueArr = new Array<string>();
                            for (let prop of focusLgcProps) {
                                let value = ""
                                if(prop.name && prop.name.trim().length > 0) {
                                    let dfe = propToDefConEntryMap?.get(prop.name.toUpperCase())?.at(0)
                                    if(dfe) {
                                        if(dfe.value && dfe.value.trim().length > 0) {
                                            value = dfe.value
                                        }
                                    }
                                }
                                pValueArr.push(value);
                            }
                            raConcatDataSet = raConcatDataSet.concat(pValueArr);
                        }
                    }
                }
            }
        }

        let isRoutingVal = "NO";
        if (exportLayerMapping.has(stkLayer)) {
            let val = exportLayerMapping.get(stkLayer)?.routingLayerType;
            if (val && val.length > 0 && (val !== StackupRoutingLayerTypeEnum.None)) {
                isRoutingVal = "YES";
            }
        }

        let initValues = [entityName, stkLayer, isRoutingVal];
        (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, initValues.concat(raConcatDataSet));
    }

    return { headerInsertStatus: headerInserted, rowCountVal: rowCount };
}

















    // let ifaceIdToNameMapping = new Map<string, string>();
    // let ifaceIdToNetclassListMapping = new Map<string, Netclass[]>();
    // for(let iface of interfaceList) {
    //     ifaceIdToNameMapping.set(iface._id?.toString() as string, iface.name)
    //     ifaceIdToNetclassListMapping.set(iface._id?.toString() as string, [])
    // }

    // let ncIdToNameMapping = new Map<string, string>();
    // for(let nc of netclasses) {
    //     let ncid = nc._id?.toString() as string
    //     ncIdToNameMapping.set(ncid, nc.name)
    //     ifaceIdToNetclassListMapping.set(nc.interfaceId, (ifaceIdToNetclassListMapping.get(nc.interfaceId) ?? []).concat([nc]))
    // }




// entityName
// groupByRuleAreaMap
// layerGroupSetId




    // // for(let iface of interfaceList) {
    //     let isPhysicalHeaderInserted = false;
    //     let isClearanceHeaderInserted = false;
    //     let rowCount = 0;
        
    //     workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 3}] });
        
    //     //handle default physical rules ----------------------------------------
    //     // let ifaceNetclasses = ifaceIdToNetclassListMapping.get(iface._id?.toString() as string) ?? new Array<Netclass>()
    //     // let netclassesSorted = sort(ifaceNetclasses).asc(x => x.name)
        
    //     // for(let netclass of netclassesSorted) {
    //         let ncid = netclasses[0]._id?.toString() as string

    //         let filter = { constraintType: ConstraintTypesEnum.Physical, ownerElementId: ncid } as Filter<LayerGroupConstraints>
    //         let lgc = await lgcRepo.GetOneByProjectID(projectId, filter)
    //         if(lgc) {
    //             // let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId);

    //             let resp = processRRLayersForExport(workbook, ruleAreasSorted, netclass.name, ConstraintTypesEnum.Physical, allLayerNamesSorted, groupByRuleAreaMap, 
    //                 isPhysicalHeaderInserted, sheetName, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, netclass.layerGroupSetId, lgSetLayerToLayerGroupMapping);

    //             isPhysicalHeaderInserted = resp.headerInsertStatus;
    //             rowCount = resp.rowCountVal; 
    //         }
    //     // }
        

    //     (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    //     (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    //     (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);


    //     //handle default rules for interface ----------------------------------------
    //     let relsForIface: BasicProperty[] = await getClassRelationsForInterface(project, iface._id?.toString() as string, null)
    //     let relsForIfaceSorted = sort(relsForIface).asc(x => x.name)

    //     for(let relation of relsForIfaceSorted) {
            
    //         let filter = { constraintType: ConstraintTypesEnum.Clearance, ownerElementId: relation.id } as Filter<LayerGroupConstraints>
    //         let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
    //         let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId)

    //         let resp = processRRLayersForExport(workbook, ruleAreasSorted, relation.name, ConstraintTypesEnum.Clearance, allLayerNamesSorted, groupByRuleAreaMap, 
    //             isClearanceHeaderInserted, sheetName, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, relation.value, lgSetLayerToLayerGroupMapping);

    //         isClearanceHeaderInserted = resp.headerInsertStatus;
    //         rowCount = resp.rowCountVal; 
    //     }

    //     //set column widths ----------------------------------------
    //     let colCount = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).actualColumnCount;
    //     for(let i = 1; i <= colCount; i++) {
    //         (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).getColumn(i).width = 25;
    //     }

    // // }







//=====================================================




    //=========================================================================================================
    // let projectId = project._id?.toString() as string;
    // let lgcRepo = new ServiceModelRepository<LayerGroupConstraints>(DBCollectionTypeEnum.LAYERGROUP_CONSTRAINT_COLLECTION)
    
    // // let ruleAreasSorted = sort(pkg.ruleAreas).asc(x => x.ruleAreaName);

    // let nonSolderResistLayers = pkg.stackupLayers.filter(a => a.type.toLowerCase() !== "solderresist")
    // let allLayerNamesSorted = sort(nonSolderResistLayers).asc(a => a.index)?.map(x => x.name);
    // let exportLayerMapping = new Map<string, StackupLayer>();
    // for(let stkLyr of nonSolderResistLayers) {
    //     if(stkLyr.type.toLowerCase() === "metal"){
    //         exportLayerMapping.set(stkLyr.name, stkLyr)
    //     }
    // }

    // let defConRepo = new ServiceModelRepository<DefaultConstraints>(DBCollectionTypeEnum.DEFAULT_CONSTRAINTS_COLLECTION);
    // let defConList = await defConRepo.GetAllByProjectID(pkg.projectId);
    // if(!defConList || defConList.length === 0) { 
    //     throw new Error(`Cannot process constraints retrieval. Default constrints were not found for the project.`) 
    // }
    // let defConGoldenId = defConList.find(a => a.tags.includes(GOLDEN_INDICATOR_NAME))?._id?.toString() as string
    // let defConDataOrganized : Map<string, Map<string, Map<string, Map<string, Map<string, DefConEntry[]>>>>> = organizeDefaultConstraints(defConList);
    
    // let headerInserted = false;

    // let constraintType = ConstraintTypesEnum.Physical ;


    // for (let i = 0; i < allLayerNamesSorted.length; i++) {
    //     let stkLayer = allLayerNamesSorted[i];
    //     let raConcatDataSet = new Array<string>();

    //     for (let ruleArea of pkg.ruleAreas ?? []) {
    //         let defConDataSetId = ruleArea.defaultConstraintId || defConGoldenId;
    //         let propToDefConEntryMap = defConDataOrganized.get(defConDataSetId)?.get(ConstraintTypesEnum.Physical)?.get(ruleArea.xmodName.toUpperCase())?.get(stkLayer.toUpperCase())

    //         let filter = { constraintType: ConstraintTypesEnum.Physical, ownerElementId: ncid } as Filter<LayerGroupConstraints>
    //         let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
    //         let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId);

    //         if (headerInserted === false) {
    //             let lgcProps = sort(relevantLGCs[0].associatedProperties).asc(a => a.name); //Important!
    //             let entryName = constraintType === ConstraintTypesEnum.Physical ? "Netclass" : "RuleName";
    //             let initColNames = [entryName, "Layer", "Routing"];
    //             let colNames = lgcProps.map(a => (a.displayName || a.name));
    //             let raHeader = new Array<string>();
    //             let mainHeader = Array.from(initColNames);
    //             let emptyRAHeaderEnt = Array<string>(colNames.length - 1).fill("");
    //             initColNames.forEach(a => raHeader.push(""));

    //             for (let ra of pkg.ruleAreas) {
    //                 raHeader = raHeader.concat([ra.ruleAreaName, ...emptyRAHeaderEnt]);
    //                 mainHeader = mainHeader.concat(colNames);
    //             }

    //             //Set the rule type
    //             let ruleType = constraintType === ConstraintTypesEnum.Physical ? "PHYSICAL RULES" : "CLEARANCE RULES";
    //             let typeHeaderRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, [ruleType]);
    //             (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).mergeCells(rowCount, 1, rowCount, 3);
    //             typeHeaderRow.eachCell((cell, colNumber) => {
    //                 if(typeof(cell.row) === 'number' && (colNumber <= 3)) {
    //                     cell.fill = sectionHeaderStyle.fill,
    //                     cell.font = sectionHeaderStyle.font,
    //                     cell.alignment = sectionHeaderStyle.alignment
    //                 }
    //             });

    //             //Set the Rule Area row
    //             let raHeaderRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, raHeader);
    //             raHeaderRow.eachCell((cell, colNumber) => {
    //                 if(typeof(cell.row) === 'number' && (colNumber <= raHeader.length + 1)) {
    //                     cell.fill = altHeaderStyle.fill
    //                     cell.font = { size: 14, bold: false, color: { argb: 'D20808' } } as ExcelJS.Font,
    //                     cell.alignment = altHeaderStyle.alignment
    //                     cell.border = altHeaderStyle.border
    //                 }
    //             });

    //             //Set the Rule properties row
    //             let mainHeaderRow = (workbook.getWorksheet(sheetName) as ExcelJS.Worksheet).insertRow(++rowCount, mainHeader);
    //             mainHeaderRow.eachCell((cell, colNumber) => {
    //                 if(typeof(cell.row) === 'number' && (colNumber <= mainHeader.length + 1)) {
    //                     cell.fill = headerStyle.fill
    //                     cell.font = headerStyle.font,
    //                     cell.alignment = headerStyle.alignment
    //                     cell.border = headerStyle.border
    //                 }
    //             });
                
    //             headerInserted = true;
    //         }

    //             if (exportLayerMapping.has(stkLayer)) {
    //                 let lgToLayerMapForRelevantLGSet = lgSetLayerToLayerGroupMapping.get(layerGroupSetId);
    //                 if (lgToLayerMapForRelevantLGSet) {
    //                     let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.layer;
    //                     let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.lg;
    //                     if (relevantLayer && relevantLG) {
    //                         let focusLGC = relevantLGCs?.find(a => a.layergroupId === relevantLG.id);
    //                         if (focusLGC) {
    //                             let focusLgcProps = sort(focusLGC.associatedProperties).asc(a => a.name); //Important!
    //                             let pValueArr = new Array<string>();
    //                             for (let prop of focusLgcProps) {
    //                                 let pValue = prop.value.customValue || prop.value.defautlValue || prop.value.configValue || "";
    //                                 pValueArr.push(pValue);
    //                             }
    //                             raConcatDataSet = raConcatDataSet.concat(pValueArr);
    //                         }

    //                     }
    //                 }
    //             }
    //         }
    //     }

    //     let isRoutingVal = "NO";
    //     if (exportLayerMapping.has(stkLayer)) {
    //         let val = exportLayerMapping.get(stkLayer)?.routingLayerType;
    //         if (val && val.length > 0 && (val !== RoutingLayerTypeEnum.None)) {
    //             isRoutingVal = "YES";
    //         }
    //     }
    //     let initValues = [entityName, stkLayer, isRoutingVal];
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, initValues.concat(raConcatDataSet));
    // }



    // // let ifaceIdToNameMapping = new Map<string, string>();
    // // let ifaceIdToNetclassListMapping = new Map<string, Netclass[]>();
    // // for(let iface of interfaceList) {
    // //     ifaceIdToNameMapping.set(iface._id?.toString() as string, iface.name)
    // //     ifaceIdToNetclassListMapping.set(iface._id?.toString() as string, [])
    // // }

    // // let ncIdToNameMapping = new Map<string, string>();
    // // for(let nc of netclasses) {
    // //     let ncid = nc._id?.toString() as string
    // //     ncIdToNameMapping.set(ncid, nc.name)
    // //     ifaceIdToNetclassListMapping.set(nc.interfaceId, (ifaceIdToNetclassListMapping.get(nc.interfaceId) ?? []).concat([nc]))
    // // }

    // let lgSetLayerToLayerGroupMapping = new Map<string, Map<string, {layer: Layer, lg: LayerGroup}>>();
    // for(let lgSet of pkg.layerGroupSets) {
    //     let innerMap = new Map<string, {layer: Layer, lg: LayerGroup}>();
    //     for(let lg of lgSet.layerGroups) {
    //         for(let layer of lg.layers) {
    //             let name = layer.name.toUpperCase();
    //             innerMap.set(name, {layer: layer, lg: lg})
    //         }
    //     }
    //     lgSetLayerToLayerGroupMapping.set(lgSet.id, innerMap);
    // }

    // // for(let iface of interfaceList) {
    //     let isPhysicalHeaderInserted = false;
    //     let isClearanceHeaderInserted = false;
    //     let rowCount = 0;
        
    //     workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: tabColor } }, views: [{ state: 'frozen', xSplit: 3}] });
        
    //     //handle interface physical rules ----------------------------------------
    //     let ifaceNetclasses = ifaceIdToNetclassListMapping.get(iface._id?.toString() as string) ?? new Array<Netclass>()
    //     let netclassesSorted = sort(ifaceNetclasses).asc(x => x.name)
        
    //     for(let netclass of netclassesSorted) {
    //         let ncid = netclass._id?.toString() as string

    //         let filter = { constraintType: ConstraintTypesEnum.Physical, ownerElementId: ncid } as Filter<LayerGroupConstraints>
    //         let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
    //         let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId);

    //         let resp = processRRLayersForExport(workbook, ruleAreasSorted, netclass.name, ConstraintTypesEnum.Physical, allLayerNamesSorted, groupByRuleAreaMap, 
    //             isPhysicalHeaderInserted, iface, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, netclass.layerGroupSetId, lgSetLayerToLayerGroupMapping);

    //         isPhysicalHeaderInserted = resp.headerInsertStatus;
    //         rowCount = resp.rowCountVal; 
    //     }
        

    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);


    //     //handle clearance rules for interface ----------------------------------------
    //     let relsForIface: BasicProperty[] = await getClassRelationsForInterface(project, iface._id?.toString() as string, null)
    //     let relsForIfaceSorted = sort(relsForIface).asc(x => x.name)

    //     for(let relation of relsForIfaceSorted) {
            
    //         let filter = { constraintType: ConstraintTypesEnum.Clearance, ownerElementId: relation.id } as Filter<LayerGroupConstraints>
    //         let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
    //         let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId)

    //         let resp = processRRLayersForExport(workbook, ruleAreasSorted, relation.name, ConstraintTypesEnum.Clearance, allLayerNamesSorted, groupByRuleAreaMap, 
    //             isClearanceHeaderInserted, iface, rowCount, headerStyle, altHeaderStyle, sectionHeaderStyle, exportLayerMapping, relation.value, lgSetLayerToLayerGroupMapping);

    //         isClearanceHeaderInserted = resp.headerInsertStatus;
    //         rowCount = resp.rowCountVal; 
    //     }


    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [""]);


    //     //handle interface properties ----------------------------------------
    //     let ifaceDescItems: Map<string, string> = new Map<string, string>([
    //         ["Interface Name", iface.name.trim()],
    //         ["Created By", iface.createdBy],
    //         ["Created On", new Date(iface.createdOn).toString()],
    //     ]);
        
    //     let exportableProps = iface.associatedProperties?.filter(a => (a.contextProperties && a.contextProperties.length > 0) && a.contextProperties.some(x => x.name.toLowerCase() === "export_context"));
    //     for (let i = 0; i < exportableProps.length; i++) {
    //         let propItem = exportableProps[i] as PropertyItem;
    //         let exportSettings: ConstraintConfExportContext = propItem.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value;
    //         if (exportSettings.exportEnabled && exportSettings.exportEnabled === true) {
    //             if (exportSettings && exportSettings.subType) {
    //                 if (exportSettings.subType.toLowerCase() === "interface_description") {
    //                     ifaceDescItems.set(propItem.displayName || propItem.name, propItem.value);
    //                 }
    //             }
    //         }
    //     }
    
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, ["Interface Information", ""]);
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).mergeCells(rowCount, 1, rowCount, 2);
    //     for (let cell of [`A${rowCount}`, `B${rowCount}`]) {
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).alignment = sectionHeaderStyle.alignment;
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).fill = sectionHeaderStyle.fill;
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).font = sectionHeaderStyle.font;
    //     }
    //     (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, ["Property", "Value"]);
    //     for (let cell of [`A${rowCount}`, `B${rowCount}`]) {
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).alignment = altHeaderStyle.alignment;
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).fill = headerStyle.fill;
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).font = headerStyle.font;
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getCell(cell).border = headerStyle.border;
    //     }
    //     for (let [key, value] of ifaceDescItems) {
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, [key, value]);
    //     }


    //     //set column widths ----------------------------------------
    //     let colCount = (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).actualColumnCount;
    //     for(let i = 1; i <= colCount; i++) {
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getColumn(i).width = 25;
    //     }

    // // }

    // return workbook






//================================================================================================================


    
    // stackupWorksheet.getRow(1)..alignment = headerStyle.alignment;
    // stackupWorksheet.getRow(1).fill = headerStyle.fill;
    // stackupWorksheet.getRow(1).font = headerStyle.font;
    // stackupWorksheet.getRow(1).border = headerStyle.border


            
            // workbook.worksheets[currentSheetIndex].getRow(1).alignment = headerStyle.alignment;
            // workbook.worksheets[currentSheetIndex].getRow(1).fill = headerStyle.fill;
            // workbook.worksheets[currentSheetIndex].getRow(1).font = headerStyle.font;


//==========================================



// export async function produceNetListExportContent(project: Project) : Promise<Buffer>{
//     //TODO: set some document properties, author etc....

//     let projectId = project._id?.toString() as string;
    
//     let ifaceRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
//     let projection = { name: 1 }
//     let interfaceList = await ifaceRepo.GetAllByProjectIDAndProjection(projectId, null, projection) ?? []
    
//     let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//     let netclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []

//     // https://github.com/exceljs/exceljs/issues/960#issuecomment-1698549072
//     let workbook = new Workbook();  
    
//     const headerStyle = { 
//         alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment, 
//         font: { size: 12, bold: true, color: { argb: '000000' } } as ExcelJS.Font,
//         fill : { type: 'pattern', pattern:'solid', fgColor: {argb:'87cefa'} } as ExcelJS.Fill
//     }
//     const altHeaderStyle = { 
//         alignment: { vertical: 'middle', horizontal: "center" } as ExcelJS.Alignment, 
//         font: { size: 12, bold: true, color: { argb: '000000' } } as ExcelJS.Font,
//         fill : { type: 'pattern', pattern:'solid', fgColor: {argb:'d3d3d3'} } as ExcelJS.Fill
//     }  

//     let offBlueTab = "8395c1";
//     let greenTab = "9dba9a"
//     let purpleTab = "c7bbc9"
//     let tealTab = "83adb5"
//     let pinkTab = "e69aab"
//     let offGoldTab = "c1af83"

//     workbook = await handleNetListSheets(project, interfaceList, netclasses, workbook, tabColor, headerStyle, altHeaderStyle);
    
//     const buffer = await workbook.xlsx.writeBuffer();
//     const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

//     let arrayBuffer = await blob.arrayBuffer();
//     const outBuffer = Buffer.from(arrayBuffer);

//     return outBuffer
// }


//===============================================


                    // (workbook.getWorksheet(sheetName)?.getColumn(1) as ExcelJS.Column).fill = altHeaderStyle.fill;
                    // (workbook.getWorksheet(sheetName)?.getColumn(1) as ExcelJS.Column).font = headerStyle.font;


// c2cData = c2cData.sort((a, b) => ((ncIdToNameMapping.get(a.netclassId) as string) < (ncIdToNameMapping.get(b.netclassId) as string)) ? -1 : 1);



//==========================================================



    // for(let iface of interfaceList) {
    //     let physicalHeadersSet = false;
    //     let rowCount = 0;
        
    //     workbook.addWorksheet(iface.name, { properties: { tabColor: { argb: tabColor } } });
        
    //     let ifaceNetclasses = ifaceIdToNetclassListMapping.get(iface._id?.toString() as string) ?? new Array<Netclass>()
    //     let netclassesSorted = sort(ifaceNetclasses).asc(x => x.name)
        
    //     for(let netclass of netclassesSorted) {
    //         let ncid = netclass._id?.toString() as string

    //         let filter = { constraintType: ConstraintTypesEnum.Physical, ownerElementId: ncid } as Filter<LayerGroupConstraints>
    //         let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
    //         let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId)

    //         for(let i = 0; i < allLayerNamesSorted.length; i++) {
    //             let stkLayer = allLayerNamesSorted[i]
    //             let raConcatDataSet = new Array<string>();

    //             for(let ruleArea of pkg.ruleAreas ?? []) {
    //                 let relevantLGCs = groupByRuleAreaMap.get(ruleArea.id)
                    
    //                 if(relevantLGCs && relevantLGCs.length > 0) {
    //                     if(physicalHeadersSet === false) {
    //                         let lgcProps = sort(relevantLGCs[0].associatedProperties).asc(a => a.name); //Important!
    //                         let initColNames = ["Netclass", "Layer", "Routing"]
    //                         let colNames = lgcProps.map(a => (a.displayName || a.name))
    //                         let raHeader = new Array<string>()
    //                         let mainHeader = Array.from(initColNames)
    //                         let emptyRAHeaderEnt = Array<string>(colNames.length - 1).fill("")
    //                         initColNames.forEach(a => raHeader.push(""));
                            
    //                         for(let ra of pkg.ruleAreas){
    //                             raHeader = raHeader.concat([ra.ruleAreaName, ...emptyRAHeaderEnt]);
    //                             mainHeader = mainHeader.concat(colNames);
    //                         }

    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, raHeader);
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(1).alignment = altHeaderStyle.alignment;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(1).fill = altHeaderStyle.fill;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(1).font = altHeaderStyle.font;

    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, mainHeader);
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(2).alignment = headerStyle.alignment;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(2).fill = headerStyle.fill;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(2).font = headerStyle.font;
    //                         physicalHeadersSet = true;
    //                     }

    //                     if(exportLayerMapping.has(stkLayer)) {
    //                         let lgToLayerMapForRelevantLGSet = lgSetLayerToLayerGroupMapping.get(netclass.layerGroupSetId)
    //                         if(lgToLayerMapForRelevantLGSet) {
    //                             let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.layer;
    //                             let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.lg;
    //                             if(relevantLayer && relevantLG) {
    //                                 let focusLGC = relevantLGCs?.find(a => a.layergroupId === relevantLG.id)
    //                                 if(focusLGC)  {
    //                                     let focusLgcProps = sort(focusLGC.associatedProperties).asc(a => a.name); //Important!
    //                                     let pValueArr = new Array<string>()
    //                                     for(let prop of focusLgcProps) {
    //                                         let pValue = prop.value.customValue || prop.value.defautlValue || prop.value.configValue || "";
    //                                         pValueArr.push(pValue);
    //                                     }
    //                                     raConcatDataSet = raConcatDataSet.concat(pValueArr)
    //                                 }

    //                             }
    //                         }
    //                     }
    //                 }
    //             }

    //             let isRoutingVal = "NO";
    //             if(exportLayerMapping.has(stkLayer)) {
    //                 let val =  exportLayerMapping.get(stkLayer)?.routingLayerType;
    //                 if(val && val.length > 0 && (val !== RoutingLayerTypeEnum.None)) {
    //                     isRoutingVal = "YES"
    //                 }
    //             } 
    //             let initValues = [netclass.name, stkLayer, isRoutingVal];
    //             (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, initValues.concat(raConcatDataSet));
    //         }
    //     }
        
    //     let colCount = (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).actualColumnCount;
    //     for(let i = 1; i <= colCount; i++) {
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getColumn(i).width = 25;
    //     }

    // }


    // for(let iface of interfaceList) {
    //     let rowCount = 0;
    //     let clearanceHeadersSet = false;

    //     let relsForIface: BasicProperty[] = await getClassRelationsForInterface(project, iface._id?.toString() as string, null)
    //     let relsForIfaceSorted = sort(relsForIface).asc(x => x.name)
        
    //     for(let relation of relsForIfaceSorted) {
            
    //         let filter = { constraintType: ConstraintTypesEnum.Clearance, ownerElementId: relation.id } as Filter<LayerGroupConstraints>
    //         let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
    //         let groupByRuleAreaMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ruleAreaId)

    //         for(let i = 0; i < allLayerNamesSorted.length; i++) {
    //             let stkLayer = allLayerNamesSorted[i]
    //             let raConcatDataSet = new Array<string>();

    //             for(let ruleArea of pkg.ruleAreas ?? []) {
    //                 let relevantLGCs = groupByRuleAreaMap.get(ruleArea.id)
                    
    //                 if(relevantLGCs && relevantLGCs.length > 0) {
    //                     if(clearanceHeadersSet === false) {
    //                         let lgcProps = sort(relevantLGCs[0].associatedProperties).asc(a => a.name); //Important!
    //                         let initColNames = ["RuleName", "Layer", "Routing"]
    //                         let colNames = lgcProps.map(a => (a.displayName || a.name))
    //                         let raHeader = new Array<string>()
    //                         let mainHeader = Array.from(initColNames)
    //                         let emptyRAHeaderEnt = Array<string>(colNames.length - 1).fill("")
    //                         initColNames.forEach(a => raHeader.push(""));
                            
    //                         for(let ra of pkg.ruleAreas){
    //                             raHeader = raHeader.concat([ra.ruleAreaName, ...emptyRAHeaderEnt]);
    //                             mainHeader = mainHeader.concat(colNames);
    //                         }

    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, raHeader);
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(1).alignment = altHeaderStyle.alignment;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(1).fill = altHeaderStyle.fill;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(1).font = altHeaderStyle.font;

    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, mainHeader);
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(2).alignment = headerStyle.alignment;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(2).fill = headerStyle.fill;
    //                         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getRow(2).font = headerStyle.font;
    //                         clearanceHeadersSet = true;
    //                     }

    //                     if(exportLayerMapping.has(stkLayer)) {
    //                         let lgToLayerMapForRelevantLGSet = lgSetLayerToLayerGroupMapping.get(relation.value)
    //                         if(lgToLayerMapForRelevantLGSet) {
    //                             let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.layer;
    //                             let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.lg;
    //                             if(relevantLayer && relevantLG) {
    //                                 let focusLGC = relevantLGCs?.find(a => a.layergroupId === relevantLG.id)
    //                                 if(focusLGC)  {
    //                                     let focusLgcProps = sort(focusLGC.associatedProperties).asc(a => a.name); //Important!
    //                                     let pValueArr = new Array<string>()
    //                                     for(let prop of focusLgcProps) {
    //                                         let pValue = prop.value.customValue || prop.value.defautlValue || prop.value.configValue || "";
    //                                         pValueArr.push(pValue);
    //                                     }
    //                                     raConcatDataSet = raConcatDataSet.concat(pValueArr)
    //                                 }

    //                             }
    //                         }
    //                     }
    //                 }
    //             }

    //             let isRoutingVal = "NO";
    //             if(exportLayerMapping.has(stkLayer)) {
    //                 let val =  exportLayerMapping.get(stkLayer)?.routingLayerType;
    //                 if(val && val.length > 0 && (val !== RoutingLayerTypeEnum.None)) {
    //                     isRoutingVal = "YES"
    //                 }
    //             } 
    //             let initValues = [netclass.name, stkLayer, isRoutingVal];
    //             (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).insertRow(++rowCount, initValues.concat(raConcatDataSet));
    //         }
    //     }
        
    //     let colCount = (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).actualColumnCount;
    //     for(let i = 1; i <= colCount; i++) {
    //         (workbook.getWorksheet(iface.name) as ExcelJS.Worksheet).getColumn(i).width = 25;
    //     }

    // }





//====================================================






        // for(let ruleArea of pkg.ruleAreas ?? []) {
        //     let filter = { constraintType: ConstraintTypesEnum.Physical, ruleAreaId: ruleArea.id } as Filter<LayerGroupConstraints>
        //     let lgcList = await lgcRepo.GetAllByProjectID(projectId, filter) ?? []
		//     let groupByOwnerElementMap : Map<string, LayerGroupConstraints[]> = groupBy(lgcList, a => a.ownerElementId)
            

        //     for(let netclass of netclassesSorted) {
        //         let ncid = netclass._id?.toString() as string
        //         let relevantLGCs = groupByOwnerElementMap.get(ncid)
                
        //         if(relevantLGCs && relevantLGCs.length > 0) {
        //             if(columnSet === false) {
        //                 let lgcProps = sort(relevantLGCs[0].associatedProperties).asc(a => a.name);
        //                 let initColNames = ["Netclass", "Layer", "Routing"]
        //                 let colNames = lgcProps.map(a => (a.displayName || a.name))
        //                 let raHeader = new Array<string>()
        //                 let mainHeader = Array.from(initColNames)
        //                 let emptyRAHeaderEnt = Array<string>(colNames.length - 1).fill("")
        //                 initColNames.forEach(a => raHeader.push(""));
                        
        //                 for(let ra of pkg.ruleAreas){
        //                     raHeader = raHeader.concat([ra.ruleAreaName, ...emptyRAHeaderEnt]);
        //                     mainHeader = mainHeader.concat(colNames);
        //                 }

        //                 workbook.worksheets[currentSheetIndex].insertRow(++rowCount, raHeader);
        //                 workbook.worksheets[currentSheetIndex].getRow(1).alignment = headerStyle.alignment;
        //                 workbook.worksheets[currentSheetIndex].getRow(1).fill = headerStyle.fill;
        //                 workbook.worksheets[currentSheetIndex].getRow(1).font = headerStyle.font;

        //                 workbook.worksheets[currentSheetIndex].insertRow(++rowCount, mainHeader);
        //                 workbook.worksheets[currentSheetIndex].getRow(1).alignment = headerStyle.alignment;
        //                 workbook.worksheets[currentSheetIndex].getRow(1).fill = headerStyle.fill;
        //                 workbook.worksheets[currentSheetIndex].getRow(1).font = headerStyle.font;
        //                 columnSet = true;
        //             }

                    
        //             for(let i = 0; i < allLayerNamesSorted.length; i++) {
        //                 let stkLayer = allLayerNamesSorted[i]
        //                 let lgToLayerMapForRelevantLGSet = lgSetLayerToLayerGroupMapping.get(netclass.layerGroupSetId)
        //                 if(lgToLayerMapForRelevantLGSet) {
        //                     let relevantLayer = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.layer;
        //                     let relevantLG = lgToLayerMapForRelevantLGSet.get(stkLayer.toUpperCase())?.lg;
        //                     if(relevantLayer && relevantLG) {
        //                         let focusLGC = lgcGroupedByNetclass.get(netclass._id?.toString() as string)?.find(a => a.layergroupId === relevantLG.id)
        //                         if(focusLGC)  {
        //                             let focusLgcProps = sort(focusLGC.associatedProperties).asc(a => a.name);
        //                             focusLGC.associatedProperties.forEach(x => lgcPropsMap.set(x.name, x.value))

        //                         }

        //                     }

        //                 }

        //             }
        //         }
        //     }
        // }
        