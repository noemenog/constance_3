import { NET_REMAP_COL_ADDED_NETS, NET_REMAP_COL_DELETED_NETS, NET_REMAP_COL_RENAMING, DataMappingTypeEnum, DBCollectionTypeEnum, NetManagementActionTypeEnum, NET_RETRIEVAL_BATCH_SIZE, AppConfigConstants, DIFFNET_PROP_NAME, ConstraintPropertyCategoryEnum, NamingContentTypeEnum, NETLIST_EXPORT_NETNAME_COL_HEADER, NETLIST_EXPORT_SHEET_NAMING_REGEX_PATTERN, ProjectPropertyCategoryEnum, AUTOMAP_PATTERN_CHANNEL_INDICATOR, PendingProcessActionTypeEnum } from "../Models/Constants";
import { Interface, Net, Netclass, NetListImportDetail, Project } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { checkDuplicatesIgnoreCase, getDistinctById, isNotNullOrEmptyOrWS, isNumber, rfdcCopy, verifyNaming } from "./UtilFunctions";
import AdmZip from "adm-zip";
import { BasicKVP, BasicProperty, ConstraintConfDisplayContext, ConstraintConfExportContext, ConstraintValues, NCStats, NetMgmtCtx, NetSummary, PropertyItem, User } from "../Models/HelperModels";
import { handleProjectPendingProcessIndicator, updateProjectPropertyCategoryInFull } from "./ProjectLogic";
import { getGenConfigs } from "./ConfigLogic";
import { ObjectId, AnyBulkWriteOperation, Filter } from "mongodb";
import { BaseRepository } from "../Repository/BaseRepository";
import { AGG_QUERY_DIFF_PAIR_FORMATION, AGG_QUERY_NETCLASS_STATS } from "../Models/AggQueryConsts";
import * as ExcelJS from 'exceljs';
import exceljs from 'exceljs';
import { sort } from "fast-sort";
import { saveLatestChangeTrackingVersionsForCollection } from "./BasicCommonLogic";



//https://github.com/exceljs/exceljs/issues/960#issuecomment-1698549072
const { Workbook } = exceljs;



async function addNetListFileProjectPropertyInfo(project: Project, netListFileName: string, netListSize: number, promptedMod: boolean): Promise<Project> {
    if (!netListFileName) {
        throw new Error(`Input 'net-list-file-name' cannot be null or empty or undefined`);
    }

    let netListFileProp = project.associatedProperties?.find(a => (
        a.category === ProjectPropertyCategoryEnum.NET_FILE_IMPORT && a.name === ProjectPropertyCategoryEnum.NET_FILE_IMPORT))

    if(!netListFileProp)
    {
        netListFileProp = {
            id: crypto.randomUUID(),
            name: ProjectPropertyCategoryEnum.NET_FILE_IMPORT,
            displayName: ProjectPropertyCategoryEnum.NET_FILE_IMPORT,
            category: ProjectPropertyCategoryEnum.NET_FILE_IMPORT,
            value: [],
            editable: false,
            enabled: true
        } as PropertyItem;
    }

    let fileDetail : NetListImportDetail = {
        id: crypto.randomUUID(),
        fileName: netListFileName,
        date: new Date(),
        totalIncomming: netListSize,
        adjustment: promptedMod,
        tags: []
    }

    netListFileProp.value.push(fileDetail);

    let updated = await updateProjectPropertyCategoryInFull(project._id?.toString() as string, ProjectPropertyCategoryEnum.NET_FILE_IMPORT, netListFileProp)
    return updated; 
}



// //POTENTIALLY EXPENSIVE!
export async function assessNetWranglingScenarios(bufferInfoList: {name: string, buffer: Buffer}[], projectId: string, 
    netListFileName: string, forceCommit: boolean, isFreshNew: boolean) : Promise<Buffer|boolean|null> {
    /*
        Possible Scenarios:
        1) no existing nets
        2) nets already exist and we want to override existing nets (forceCommit = true)
        3) nets already exist and decision needs to be made regarding mapping/renaming (need to produce mapping file)
        4) nets already exist and mapping/replacement file was also supplied for assessment
    */
    let response : Buffer|boolean|null = null;
    try {
        let proceed: boolean = false;
        let promptedMod: boolean = false;
        let content = new Set<string>();
        let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
        let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

        if(!projectId || projectId === 'undefined' || projectId.trim().length === 0){
            throw new Error(`Could not process netlist file content. Input projectId is invalid`);
        }

        let project = await projRepo.GetWithId(projectId)
        if(!project) {
            throw new Error(`Could not find project in the system. project with ID '${projectId}' does not exist!`);
        }
        
        if(!bufferInfoList || bufferInfoList.length === 0) {
            throw new Error(`Could not process uploaded file content. Content was either invalid or empty`);
        }

        let netListFileBuffer; 
        let mappingFileBufferArr = new Array<Buffer>();
        for(let x = 0; x < bufferInfoList.length; x++) {
            if(bufferInfoList[x].name === netListFileName) {
                netListFileBuffer = bufferInfoList[x].buffer;
            }
            else {
                mappingFileBufferArr.push(bufferInfoList[x].buffer)
            }
        }

        let net = await netRepo.GetAnyOne(projectId, null)
        let projectHasValidNets = (net && net._id && net._id?.toString().trim().length > 0) ? true : false;
        
        if((projectHasValidNets === false) && (isFreshNew === true) && (forceCommit === false)) {
            // Handle scenario: 1
            let buffer = bufferInfoList[0].buffer
            if(buffer && buffer.length > 0) {
                content = await extractNetListFromFile(netListFileName, buffer);
                let retNum = await insertNewNets(project, content, true);
                proceed = retNum ? true : false;
            }
            response = proceed
        }
        else if ((projectHasValidNets === true) && (forceCommit === true) && (!mappingFileBufferArr || mappingFileBufferArr.length === 0)) { 
            // Handle scenario: 2
            if(!netListFileBuffer || netListFileBuffer.length === 0) {
                throw new Error(`Error occured while processing uploaded content. Please ensure input file is valid and non-empty`);
            }
            content = await extractNetListFromFile(netListFileName, netListFileBuffer);
            proceed = await handleNetReplacementProcess(project, content, [], true);
            response = proceed;
        }
        else if ((projectHasValidNets === true) && (isFreshNew === false) && (forceCommit === false) && (!mappingFileBufferArr || mappingFileBufferArr.length === 0)) { 
            // Handle scenario: 3
            if(mappingFileBufferArr.length !== bufferInfoList.length -1) {
                throw new Error(`Could not process uploaded content. Please make sure all files are valid and all file names are distinct`);
            }
            if(!netListFileBuffer || netListFileBuffer.length === 0) {
                throw new Error(`Error occured while processing uploaded content. Please ensure input file is valid and non-empty`);
            }
            content = await extractNetListFromFile(netListFileName, netListFileBuffer);
            let zipReturnContent : Buffer = await produceNetMappingZip(projectId, content)
            proceed = false;
            response = zipReturnContent;
        }
        else if ((projectHasValidNets === true) && (isFreshNew === false) && (forceCommit === false) && mappingFileBufferArr && (mappingFileBufferArr.length > 0)) { 
            // Handle scenario: 4
            if(!netListFileBuffer || netListFileBuffer.length === 0) {
                throw new Error(`Error occured while processing uploaded content. Please ensure input file is valid and non-empty`);
            }
            content = await extractNetListFromFile(netListFileName, netListFileBuffer);
            proceed = await handleNetReplacementProcess(project, content, mappingFileBufferArr, false)
            response = (proceed === true) ? Buffer.from("true") : null;
            promptedMod = true;
        }
        else {
            throw new Error(`Error occured while handling netlist import. Unexpected scenario encountered`);
        }

        if(proceed) { 
            let proj = await addNetListFileProjectPropertyInfo(project, netListFileName, content.size, promptedMod);
            try {
                runAutoDiffPairingLogic(proj)
                let netclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []
                if(netclasses.length > 0) {
                    runAutoMapLogic(netclasses)
                }
            }
            catch(error: any){
                console.error(error); //DiffPair and Automap logic are best-effort processes... 
            }
        }

        handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, false, false); //initiated outside of this function...
    }
    catch(error: any) {
        handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, true, false, error.message);
        throw error;
    }

    return response;
}




export async function extractNetListFromFile(netListFileName: string, netListFileBuffer: Buffer) {
    let content: Set<string>; //Important! - This MUST be a set object in order to avoid duplicates!!!
    let netExclusionList = new Set<string>();
    
    let genConfigs = await getGenConfigs(null, null, true);
    if(genConfigs && genConfigs.length > 0) {
        let excVal = genConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__Net_Extraction_Exclusions.toLowerCase())?.configValue ?? []
        if (excVal && excVal.length > 0) {
            netExclusionList = new Set(excVal.map((a: any) => a.toString().trim().toUpperCase()));
        }
    }
    
    if (netListFileName.toLowerCase().trim().endsWith(".kyn")) {
        content = extractKynNets(netListFileBuffer, netExclusionList);
    }
    else if (netListFileName.toLowerCase().trim().endsWith(".txt")) {
        content = extractTxtNets(netListFileBuffer, netExclusionList);
    }
    else {
        throw new Error("Input file is invalid. Please provide either 'kyn' or 'txt' netlist file.");
    }
    return content;
}



export function extractKynNets(netListFileBuffer: Buffer | null, netExclusionList: Set<string>): Set<string> {
    let netList = new Set<string>();
    let readingParts : boolean = false;
    let readingNets : boolean = false;
    let delimiterChars : RegExp = /[\t\r\f\v\n ]+/;   //{ ' ', '\t', '\r', '\f', '\v', '\n' };

    let netListFileContent = netListFileBuffer?.toString()
    if(netListFileContent && netListFileContent.trim().length > 0) {
        let dataLines = netListFileContent.split(/\r?\n/).filter(a => isNotNullOrEmptyOrWS(a))
        for (let i = 0; i < dataLines.length; i++) {
            let line = dataLines[i]
            try {
                if ((line.trimStart().startsWith("%Part") == true || readingParts) && line.trimStart().startsWith("%net") == false) {
                    readingParts = true;
                    readingNets = false;
                    if (isComment(line)) {
                        continue;
                    }
                }
                else if ((line.trimStart().startsWith("%net") == true || readingNets) && line.trimStart().startsWith("%Part") == false) {
                    readingNets = true;
                    if (isComment(line) === false) {
                        let netName = "";
                        line = line.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
                        let keyWords : string[] = line.split(delimiterChars);
                        if(keyWords && keyWords.length > 0 && keyWords[0] !== "*") {
                            netName = trimLeadingAndTrailing(keyWords[0], "\\").trim();
                        }
                        if(netName.length > 0) {
                            if(netExclusionList.has(netName.trim().toUpperCase()) === false) {
                                netList.add(netName.trim().toUpperCase());  //NOTE: ALL NET NAMES ARE UPPERCASED RIGHT HERE!!
                            }
                        }
                    }                  
                }
            }
            catch (e: any) {
                //do nothing useful... for now
            }
        }
    }
    else {
        throw new Error(`The uploaded net list file cannot be processed. File is either empty or invalid`)
    }

    function isComment(str: string) {
        return str.includes("%") || str.trim().length == 0 || str.includes(";;") || str.includes(";");
    }
    
    function trimLeadingAndTrailing(str: string, inputChars: string) {
        let start = 0;
        let size = str.length;
        let end = size - 1;

        while (start < size && -1 != inputChars.indexOf((str.at(start)) as string)) { ++start; } // trim leading
        while (end >= 0 && -1 != inputChars.indexOf((str.at(end)) as string)) { --end; } // trim trailing

        // return remaining characters or empty string if string is full of removable characters
        let retVal = (start <= end) ? str.substring(start, end + 1) : ""; 
        return retVal;  
    }

    return netList;
}


export function extractTxtNets(netListFileBuffer: Buffer | null, netExclusionList: Set<string>): Set<string> {
    let netsList = new Set<string>();

    if(netListFileBuffer && netListFileBuffer.length > 0) {
        let content: string = netListFileBuffer.toString()
        let dataLines = content.split(/\r?\n/).filter(a => isNotNullOrEmptyOrWS(a));
    
        let startIndex = -1;
        let endIndex = -1;

        for (let i = 0; i < dataLines.length; i++) {
            if (dataLines[i].startsWith("$NETS")) {
                startIndex = i;
                break;
            }
        }

        for (let x = 0; x < dataLines.length; x++) {
            if (dataLines[x].startsWith("$") && dataLines[x].length > 1) {
                if(x > startIndex) {
                    endIndex = x;
                    break;
                }
            }
        }

        if ((startIndex != -1) && (endIndex > startIndex + 1)) {
            let relevantSet : string[] = dataLines.slice(startIndex + 1, endIndex);
            if (relevantSet && relevantSet.length > 0) {
                netsList = new Set<string>();  //important to make sure set object is fresh!
                for (let k = 0; k < relevantSet.length; k++) {
                    let item = relevantSet[k]
                    if (item.startsWith("  ")) {
                        continue;
                    }

                    let lineItem : string = item.replaceAll("\n", "").replaceAll("'", "");
                    if (lineItem && lineItem.length > 0) {
                        let netName = lineItem.split(";")?.at(0)?.trim();
                        if(netName && netName.length > 0) {
                            if(netExclusionList.has(netName.trim().toUpperCase()) === false) {
                                netsList.add(netName.trim().toUpperCase());  //NOTE: ALL NET NAMES ARE UPPERCASED RIGHT HERE!!
                            }
                        }
                    }
                }
            }
        }
    }

    return netsList;
}



export async function handleNetReplacementProcess(project: Project, content: Set<string>, mappingFileBuffers: Buffer[], isStraightReplaceScenario: boolean) : Promise<boolean> {
   
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

    let addSet = new Set<string>();
    let delSet = new Set<string>();
    let renameMap = new Map<string, string>();
    let newNameSet = new Set<string>();

    let existingNetNameSet = new Set<string>();
    let netCursor = netRepo.GetCursorByProjectIDAndProjection(project._id?.toString() as string, null, null, NET_RETRIEVAL_BATCH_SIZE)
    for await (let projNet of netCursor) {  
        existingNetNameSet.add(projNet.name);
    }

    if(isStraightReplaceScenario === true) {
        addSet = new Set([...content].filter(nt => (existingNetNameSet.has(nt) == false)))
        delSet = new Set([...existingNetNameSet].filter(nt => (content.has(nt) == false)))
    }
    else {
        let mappingFileContent: string = mappingFileBuffers.toString()
        if(!mappingFileContent || mappingFileContent.trim().length === 0) {
            throw new Error(`The uploaded net mapping file cannot be processed. File is either empty or invalid`)
        }
        
        let go = false;
        let dataLines = mappingFileContent.split(/\r?\n/)?.filter(a => isNotNullOrEmptyOrWS(a)) ?? []
        for (let i = 0; i < dataLines.length; i++) {
            let lineStr = dataLines[i]
            if(lineStr && lineStr.length > 0) {
                let splitStr = lineStr.split(",") ?? []
                if(splitStr.length >= 3) {
                    if(go === false) {
                        if (splitStr[0].trim().toUpperCase() === NET_REMAP_COL_ADDED_NETS) {
                            if (splitStr[1].trim().toUpperCase() === NET_REMAP_COL_DELETED_NETS) { 
                                if (splitStr[2].trim().toUpperCase() === NET_REMAP_COL_RENAMING) {
                                    go = true;
                                }
                            }
                        }
                    }
                    else {
                        let addedNet = splitStr[0].trim()
                        let deletedNet = splitStr[1].trim() 
                        let renameNet = splitStr[2].trim()

                        if(addedNet.length > 0) {
                            addSet.add(addedNet)
                        }
                        if(deletedNet.length > 0) {
                            delSet.add(deletedNet);
                        }
                        if(deletedNet.length > 0 && renameNet.length > 0) {
                            renameMap.set(deletedNet, renameNet);
                            newNameSet.add(renameNet);
                        }
                    }
                }
                else {
                    throw new Error(`Imported net mapping file is not formatted as expected. The CSV file should have three comma-delimited columns: `
                        + `${NET_REMAP_COL_ADDED_NETS}, ${NET_REMAP_COL_DELETED_NETS}, ${NET_REMAP_COL_RENAMING}. `)
                }
            }
        }

        let checkerAddedNets = new Set([...content].filter(nt => (existingNetNameSet.has(nt) == false)))
        let checkerDeletedNets = new Set([...existingNetNameSet].filter(nt => (content.has(nt) == false)))

        // each "Renamer netName must appear in list of added nets"
        if(renameMap.size > 0) {
            for(let item of newNameSet) {
                if(addSet.has(item) === false) {
                    throw new Error("Imported remap file is not acceptable. For renamed nets, all new names must exist as a new net in the initially-uploaded net-list file")
                }
            }
        }

        // each added net cannot appear in existing nets
        // based on existing nets and new 'content' make sure all added are really added
        if(addSet.size > 0) {
            for (let item of addSet) {
                if(existingNetNameSet.has(item) === true) {
                    throw new Error(`Imported remap file is not acceptable. Nets in the '${NET_REMAP_COL_ADDED_NETS}' column cannot already exist in the system. Problematic-net: '${item}'`)
                }
                if(checkerAddedNets.has(item) == false) {
                    throw new Error(`Imported remap file is not acceptable. Nets in the '${NET_REMAP_COL_ADDED_NETS}' must be truly new according to recently imported netlist file. Problematic-net: '${item}'`)
                }
            }
        }

        // each deleted net that is not being renamed must appear in existing nets
        // based on existing nets and new 'content' make sure all deleted are really deleted
        if(delSet.size > 0) {
            for (let item of delSet) {
                if(renameMap.has(item) === false) { //no mapping means it is a straight delete scenario for this net
                    if (existingNetNameSet.has(item) === false) { 
                        throw new Error(`Imported remap file is not acceptable. Nets marked for deletion must exist in the system. Problematic-net: '${item}'`)
                    }
                    if(checkerDeletedNets.has(item) == false) {
                        throw new Error(`Imported remap file is not acceptable. Nets in the '${NET_REMAP_COL_DELETED_NETS}' must truly not exist in recently imported netlist file. Problematic-net: '${item}'`)
                    }
                }
            }
        }
    }

    //help the garbage collector
    existingNetNameSet = new Set<string>();


    //WARNING: Important!! - rename must occur first. In general, order of execution matters henceforth!!
    if(renameMap.size > 0) {
        let netBatch = new Array<Net>();
        let renameNetInFilter = { name: { $in: Array.from(renameMap.keys()) } as any } as Filter<Net>;
        const cursor = netRepo.GetCursorByProjectIDAndProjection(project._id?.toString() as string, [renameNetInFilter], null, NET_RETRIEVAL_BATCH_SIZE)
        for await (let renameNet of cursor) { 
            if(renameMap.has(renameNet.name)) {
                renameNet.name = renameMap.get(renameNet.name) as string
            
                netBatch.push(renameNet);
                if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
                    netRepo.ReplaceMany([...netBatch])
                    netBatch = new Array<Net>()
                }
            }
        }

        if(netBatch.length > 0){
            netRepo.ReplaceMany(netBatch)
            netBatch = new Array<Net>()
        }
    }

    
    if(delSet.size > 0) {
        let diffPairedNets = new Array<Net>()
        let netBatch = new Array<Net>();
        let delSetMod = Array.from(delSet).filter(x => (renameMap.has(x) === false)) ?? [] //the check againt renameMap keys is important!
        let delNetInFilter = { name: { $in: delSetMod } as any } as Filter<Net>;
        const cursor = netRepo.GetCursorByProjectIDAndProjection(project._id?.toString() as string, [delNetInFilter], null, NET_RETRIEVAL_BATCH_SIZE)
        for await (let delNet of cursor) { 
            if(delSet.has(delNet.name)) {
                if(delNet.diffPairNet.trim().length > 0) {
                    diffPairedNets.push(delNet);
                }

                netBatch.push(delNet);
                if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
                    if(diffPairedNets.length > 0) {
                        await unpairDiffPairedNets(project, diffPairedNets)
                    }
                    netRepo.DeleteMany(netBatch.map(a => a._id?.toString() as string))
                    diffPairedNets = new Array<Net>();
                    netBatch = new Array<Net>()
                }
            }
        }

        if(netBatch.length > 0){
            if(diffPairedNets.length > 0) {
                await unpairDiffPairedNets(project, diffPairedNets)
            }
            netRepo.DeleteMany(netBatch.map(a => a._id?.toString() as string))
            diffPairedNets = new Array<Net>();
            netBatch = new Array<Net>()
        }
    }

    if(addSet.size > 0){
        let adderMod = new Set([...addSet].filter(x => newNameSet.has(x) === false))
        if(adderMod.size > 0) {
            insertNewNets(project, adderMod, false)
        }
    }

    return true;
}



export async function insertNewNets(project: Project, content: Set<string>, startWithFullWipe: boolean) : Promise<number> {
    let creationList = new Array<Net>()
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let projectId = project._id?.toString() as string

    // Handle scenario 3
    if(content && content.size > 0) {
        let netConstrProps = project.constraintSettings?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase())
        if(!netConstrProps || netConstrProps.length === 0) {
            throw new Error(`Net constraint settings were not found in config mgmt system! Please check configuration system! ORG: '${project.org}'`);
        }
        
        for(let netProp of netConstrProps) {
            let initValue : ConstraintValues = { id: crypto.randomUUID(), configValue: netProp.value, defautlValue: '', customValue: '' };
            netProp.value = initValue;
            netProp.contextProperties = [];  //remove configured contextproperties, they are not needed in DB
        }

        let netList = Array.from(content);
        netList = sort(netList).asc(n => n.toUpperCase()); //Important!!

        for(let p = 0; p < netList.length; p++) {
            let net : Net = {
                projectId: projectId,
                snapshotSourceId: "",
                contextProperties: [],
                lastUpdatedOn: new Date(),
                interfaceId: "",
                name: netList[p].toUpperCase().trim(),
                netclassMapType: DataMappingTypeEnum.Unmapped, //Important to set this initially!
                netclassId: "",
                constraintClassId: "",
                diffPairNet: "",
                diffPairMapType: DataMappingTypeEnum.Unmapped,
                tags: [],
                associatedProperties: netConstrProps,
            }

            creationList.push(net);
        }
    }

    if(creationList.length > 0) {
        if(startWithFullWipe) {
            await netRepo.DeleteManyByProjectId(projectId, null, true) 
        }
        else {
            let netBatch = new Array<string>();
            let delNetInFilter = { name: { $in: creationList.map(a => a.name) } as any } as Filter<Net>;
            const cursor = netRepo.GetCursorByProjectIDAndProjection(projectId, [delNetInFilter], null, NET_RETRIEVAL_BATCH_SIZE)
            for await (let delNet of cursor) { 
                netBatch.push(delNet._id?.toString() as string);
                
                if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
                    netRepo.DeleteMany(netBatch)
                    netBatch = new Array<string>()
                }
            }

            if(netBatch.length > 0){
                netRepo.DeleteMany(netBatch)
                netBatch = new Array<string>()
            }
        }

        //chunk it!
        for (let i = 0; i < creationList.length; i += NET_RETRIEVAL_BATCH_SIZE) {
            const chunk = creationList.slice(i, i + NET_RETRIEVAL_BATCH_SIZE);
            await netRepo.CreateMany(chunk, true)// Commit nets to DB
        }

        return creationList.length
    }
    else {
        throw new Error(`Error occured while creating/updating nets for project. Please make sure uploaded net info is valid`)
    }
}


export async function produceNetMappingZip(projectId: string, content: Set<string>) : Promise<Buffer> {
    let zip = new AdmZip();
    
    const CHUNK_ROW_LIMIT = 1000000;  //hardcoded on purpose
    
    let existingNetNameSet = new Set<string>();

    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let netCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, null, null, NET_RETRIEVAL_BATCH_SIZE)
    for await (let projNet of netCursor) {  
        existingNetNameSet.add(projNet.name);
    }

    let addedNets = [...content].filter(nt => (existingNetNameSet.has(nt) == false))
    let deletedNets = [...existingNetNameSet].filter(nt => (content.has(nt) == false))

    existingNetNameSet = new Set<string>();

    let maxLength = addedNets.length > deletedNets.length ? addedNets.length : deletedNets.length
    let csvContentMap = new Map<number, string>();
    let count = 0
    let csvContent = "";

    for(let p = 0; p < maxLength; p++) {
        let line = (count === 0) ? `${NET_REMAP_COL_ADDED_NETS},${NET_REMAP_COL_DELETED_NETS},${NET_REMAP_COL_RENAMING}\n` : ""
        if(addedNets.length > p){
            line = line + `${addedNets[p]},`
        }
        else {
            line = line + ","
        }

        if(deletedNets.length > p){
            line = line + `${deletedNets[p]},,\n`
        }
        else {
            line = line + ",,\n"
        }

        csvContent = csvContent + line;
        count  =  count + 1;

        if ((count % CHUNK_ROW_LIMIT === 0) || (p === maxLength - 1)){
            count = 0;
            csvContentMap.set(p, csvContent);
            csvContent = "";
        }
    }

    if(csvContentMap.size > 0) {
        let stringArr = Array.from(csvContentMap.values())
        for(let x = 0; x < stringArr.length; x++) {
            let content = stringArr[x]
            zip.addFile(`net-mapping_${x + 1}.csv`, Buffer.from(content, "utf8"), `net mapping content number ${x + 1}`);
        }
    }
    else {
        zip.addFile(`no_diff_in_nets.csv`, Buffer.from("There were no differences found between existing nets and new net list", "utf8"), `net mapping content`);
    }

    let zipFileContents = zip.toBuffer();
    return zipFileContents
}



export async function processNetChanges(netChangeInfo: NetMgmtCtx, user: User|null) : Promise<NetMgmtCtx> {
    validateNetsInvolvedInChangeRequest(netChangeInfo);  
    let allInputInvolvedNets: Net[] = await getNetsInvolvedInChangeRequest(netChangeInfo); 

    const idList = allInputInvolvedNets.map((x: Net) => new ObjectId(x._id?.toString()));
    let infilter = { _id: { $in: idList } as any };

    if(netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.RENAME_NET) {
        netChangeInfo = await execNetRename(netChangeInfo, allInputInvolvedNets);
    }
    else if(netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.UPDATE_WHOLE_NET) {  //rename, properties, etc
        netChangeInfo = await execWholeNetUpdate(netChangeInfo, infilter) 
    }
    else if(netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.UPDATE_NET_PROPERTY_VALUE) {  //single net expected
        netChangeInfo = await execNetPropertyValueUpdate(netChangeInfo, allInputInvolvedNets, infilter, user);
    }
    else if (netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.ASSIGN_NETS) {
        netChangeInfo = await execNetAssignment(netChangeInfo, allInputInvolvedNets, infilter);
    }
    else if (netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.REMOVE_NET_ASSIGNMENT) {
        netChangeInfo = await execNetAssignRemoval(netChangeInfo, allInputInvolvedNets, infilter);
    }
    else if (netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.ASSIGN_DIFF_PAIR) {
        if(allInputInvolvedNets && allInputInvolvedNets.length !== 2) {
            throw new Error(`Could not assign diff pairs. Exactly two valid nets should be specified for the operation.`);
        }
        let updatedNets = await executeDiffPairingAction(allInputInvolvedNets)
        netChangeInfo.status = "success";
        netChangeInfo.netsInvolved = updatedNets; //update the list that needs to go out -- important!
    }
    else if (netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.REMOVE_DIFF_PAIR) {
        if(allInputInvolvedNets[0].projectId !== netChangeInfo.projectId) { //checking projectId intentionally
            throw new Error(`Could not dissasociate diff-pair nets. ProjectId discrepancy detected in input data.`);
        }
        let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        let filter = { _id: new ObjectId(netChangeInfo.projectId as string) } as Filter<Project>;
        let projection = { name: 1, constraintSettings: 1 };
        let projectRes = await projRepo.GetByFilterAndProjection(filter, projection);
        let updatedNets = await unpairDiffPairedNets(projectRes[0] as Project, allInputInvolvedNets)
        netChangeInfo.status = "success";
        netChangeInfo.netsInvolved = updatedNets; //update the list that needs to go out -- important!
    }
    
    return netChangeInfo;
}


function validateNetsInvolvedInChangeRequest(netChangeInfo: NetMgmtCtx) : void {
    if (!netChangeInfo || !netChangeInfo.netsInvolved || netChangeInfo.netsInvolved.length === 0) {
        throw new Error(`Input net-change information is invalid`);
    }

    if (netChangeInfo.netsInvolved && netChangeInfo.netsInvolved.length > 150000) {
        throw new Error(`ERROR: net update functionality was not designed/intended for massive net payload beyond 150k nets!!`);
    }

    for (let i = 0; i < netChangeInfo.netsInvolved.length; i++) {
        let net = netChangeInfo.netsInvolved[i];
        if (!net || !net?._id || net?._id.toString().trim().length === 0 || net?._id.toString() === 'undefined') {
            throw new Error(`Input net cannot have null or empty or undefined 'id'`);
        }
        if (!net.projectId || net.projectId.trim().length === 0 || net.projectId === 'undefined') {  //important for all but especially for diffPairs logic
            throw new Error(`Input net cannot have null or empty or undefined 'projectId'`);
        }
        if(netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.UPDATE_WHOLE_NET || netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.RENAME_NET) {
            if (!net.name || net.name.trim().length === 0 || net.name === 'undefined') {
                throw new Error(`Input net cannot have null or empty or undefined 'name'`);
            }
        }
    }
}


async function getNetsInvolvedInChangeRequest(netChangeInfo: NetMgmtCtx) : Promise<Net[]> {
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION) 
    let allInputInvolvedNets: Net[] = [];
    const idList = netChangeInfo.netsInvolved.map((x: Net) => new ObjectId(x._id?.toString()));
    let infilter = { _id: { $in: idList } as any };
    allInputInvolvedNets = await netRepo.GetAllByProjectID(netChangeInfo.projectId, infilter);
    if (!allInputInvolvedNets || allInputInvolvedNets.length === 0 || allInputInvolvedNets.length !== netChangeInfo.netsInvolved.length) {
        throw new Error(`The input nets were not all present in the system. Net-based operation was not completed`);
    }

    return allInputInvolvedNets;
}


async function execNetRename(netChangeInfo: NetMgmtCtx, allInputInvolvedNets: Net[]) : Promise<NetMgmtCtx>{
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION);
    let newNetName : string = netChangeInfo.contextualInfo
    if (!newNetName || newNetName?.toString().trim().length === 0 || newNetName.toString() === 'undefined') {
        throw new Error(`Net rename was not processed. A valid name was not provided for the operation.`);
    }
    
    verifyNaming([newNetName], NamingContentTypeEnum.NET);

    if(allInputInvolvedNets && allInputInvolvedNets.length > 0 && allInputInvolvedNets[0].projectId === netChangeInfo.projectId) { //checking projectId intentionally
        allInputInvolvedNets[0].name = newNetName.toUpperCase().trim();
        allInputInvolvedNets[0].lastUpdatedOn = new Date();
        let result = await netRepo.ReplaceOne(allInputInvolvedNets[0]);
        if (result) {
            let updatedNet = await netRepo.GetWithId(allInputInvolvedNets[0]._id?.toString() as string);
            if (updatedNet) {
                netChangeInfo.status = "success";
                netChangeInfo.netsInvolved = [updatedNet]; //update the list that needs to go out -- important!
            }
            else {
                throw new Error(`Failed to get renamed net. An unspecified error may have occured while performing the operation`);
            }
        }
        else {
            throw new Error(`Failed to rename net. An unspecified error occured while performing the operation`);
        }
    }
    else {
        throw new Error(`Net rename was not processed. Could not determine relevant net to for the operation.`);
    }
    return netChangeInfo;
}


async function execWholeNetUpdate(netChangeInfo: NetMgmtCtx, infilter: Filter<Net>) : Promise<NetMgmtCtx> {
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION);
    let incomingNetsAsIs = netChangeInfo.netsInvolved;
    let names = incomingNetsAsIs.map(a => a.name)
    
    verifyNaming(names, NamingContentTypeEnum.NET);

    for(let i = 0; i < incomingNetsAsIs.length; i++) {
        let singleNet = incomingNetsAsIs[i]
        singleNet.lastUpdatedOn = new Date();
        singleNet.name = singleNet.name.trim();
        
        if (singleNet.associatedProperties.length === 0) {
            throw new Error(`No valid net properties found. At least one net property is required`);
        }

        //check duplicate prop names
        let propNames = singleNet.associatedProperties.map(a => a.name);
        let dupRes = checkDuplicatesIgnoreCase(propNames);
        if (dupRes === false) {
            throw new Error(`Duplicate property names are not allowed for net '${singleNet.name}'.`);
        }

        //ensure all properties have a uuid
        for (let i = 0; i < singleNet.associatedProperties.length; i++) {
            if ((!singleNet.associatedProperties[i].id) || (singleNet.associatedProperties[i].id.trim().length === 0)) {
                singleNet.associatedProperties[i].id = crypto.randomUUID();
            }
        }

        if (singleNet.associatedProperties && singleNet.associatedProperties.length > 0) {
            singleNet.associatedProperties = singleNet.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
        }
    }

    let result = await netRepo.ReplaceMany(incomingNetsAsIs);
    if (result) {
        let updatedNets = await netRepo.GetAllByProjectID(netChangeInfo.projectId, infilter);
        if (updatedNets && updatedNets.length > 0) {
            netChangeInfo.status = "success";
            netChangeInfo.netsInvolved = updatedNets; //update the list that needs to go out -- important!
        }
        else {
            throw new Error(`Failed to get updated net(s). An unspecified error may have occured while performing update operation`);
        }
    }
    else {
        throw new Error(`Failed to update net(s). An unspecified error occured while performing update operation`);
    }
    return netChangeInfo;
}


async function execNetPropertyValueUpdate(netChangeInfo: NetMgmtCtx, allInputInvolvedNets: Net[], infilter: Filter<Net>, user: User|null) : Promise<NetMgmtCtx>{
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION);
    let netsBeforeUpdate = rfdcCopy<Net[]>(allInputInvolvedNets) as Net[];
    let mapBeforeUpdate = new Map<string, Map<string, any>>();
    for(let net of netsBeforeUpdate) {
        mapBeforeUpdate.set(net._id?.toString() as string, new Map<string, any>())
        for (let prop of net.associatedProperties) {
            mapBeforeUpdate.get(net._id?.toString() as string)?.set(prop.id, prop.value);
        }
    }

    if(!netChangeInfo.contextualInfo || netChangeInfo.contextualInfo.trim().length === 0) {
        throw new Error(`Cannot change net property. Property name was not provided.`);
    }

    let diffRelatedNetPropNames = new Set<string>()
    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
    let filter = { _id: new ObjectId(allInputInvolvedNets[0].projectId as string) } as Filter<Project>;
    let projection = { name: 1, constraintSettings: 1 };
    let projectObj = await projRepo.GetByFilterAndProjection(filter, projection);

    //assemble all the net properties that are related to diff pairs. these will need to be cleared
    for(let prop of (projectObj[0].constraintSettings ?? [])) {
        if (prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
            let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
            if(exportSettings && exportSettings.setToDiffPairEntity && exportSettings.setToDiffPairEntity === true) {
                diffRelatedNetPropNames.add(prop.name.toLowerCase())
            }
        }
    }

    for(let net of allInputInvolvedNets) { //NOTE: In case where user-updated net is a diff pair, UI is expected to send both nets for update
        if (net.associatedProperties.length === 0) {
            throw new Error(`Cannot perform net property update. No valid net properties found for relevant net.`);
        }
        let incomingRawNet = netChangeInfo.netsInvolved.find(a => a._id?.toString() === net._id?.toString())
        let incommingProp = incomingRawNet?.associatedProperties?.find(x => x.name.trim().toLowerCase() === netChangeInfo.contextualInfo.trim().toLowerCase())
        if(incommingProp) {
            let incPropNameLowerCase = incommingProp.name.trim().toLowerCase();
            
            //Important! - make sure diff prop change is only set on diff paired nets!
            if(diffRelatedNetPropNames.has(incPropNameLowerCase)) {
                if(net.diffPairMapType === DataMappingTypeEnum.Unmapped){
                    throw new Error("Changing value for a diffPair-related net property cannot be allowed if the relevant net is not actually paired");
                }
            }

            for (let i = 0; i < net.associatedProperties.length; i++) {
                if(net.associatedProperties[i].name.trim().toLowerCase() === incPropNameLowerCase) {
                    (net.associatedProperties[i].value as ConstraintValues).customValue = (incommingProp.value as ConstraintValues).customValue;
                    break;
                }
            }
        }
        net.lastUpdatedOn = new Date();
    }

    let result = await netRepo.ReplaceMany(allInputInvolvedNets, false);
    if (result) {
        let updatedNets = await netRepo.GetAllByProjectID(netChangeInfo.projectId, infilter);
        if (updatedNets && updatedNets.length > 0) {
            netChangeInfo.status = "success";
            netChangeInfo.netsInvolved = updatedNets; //update the list that needs to go out -- important!
            await saveLatestChangeTrackingVersionsForCollection(updatedNets[0].projectId, user, new Map<string, PropertyItem[]>(updatedNets.map(x => [x._id?.toString() as string, x.associatedProperties])), mapBeforeUpdate);
        }
        else {
            throw new Error(`Failed to get updated net(s). An unspecified error may have occured while performing update operation`);
        }
    }
    else {
        throw new Error(`Failed to update net(s). An unspecified error occured while performing update operation`);
    }
    return netChangeInfo;
}


async function execNetAssignment(netChangeInfo: NetMgmtCtx, allInputInvolvedNets: Net[], infilter: Filter<Net>) : Promise<NetMgmtCtx> {
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION);

    if(allInputInvolvedNets && allInputInvolvedNets.length > 0) {
        let ncid = netChangeInfo.contextualInfo
        if (!ncid || ncid?.toString().trim().length === 0 || ncid.toString() === 'undefined') {
            throw new Error(`Net assignment not performed. Input netclassId cannot be null or empty or undefined.`);
        }
        let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)  
        let netclass = await netclassRepo.GetWithId(ncid)

        if(netclass && netclass._id) {
            for(let i = 0; i < allInputInvolvedNets.length; i++) {
                allInputInvolvedNets[i].interfaceId = netclass.interfaceId;
                allInputInvolvedNets[i].netclassId = netclass._id.toString();
                allInputInvolvedNets[i].netclassMapType = DataMappingTypeEnum.Manual;   
            }
            let result = await netRepo.ReplaceMany(allInputInvolvedNets);
            if (result) {
                let updatedNets = await netRepo.GetAllByProjectID(netChangeInfo.projectId, infilter);
                if (updatedNets && updatedNets.length > 0) {
                    netChangeInfo.status = "success";
                    netChangeInfo.netsInvolved = updatedNets; //update the list that needs to go out -- important!
                }
                else {
                    throw new Error(`Failed to get updated net(s). An unspecified error may have occured while performing update operation`);
                }
            }
            else {
                throw new Error(`Failed to update net(s). An unspecified error occured while performing update operation`);
            }
        }
        else {
            throw new Error(`Net assignment not performed. Input netclass is invalid.`);
        }
    }
    else {
        throw new Error(`Net(s) could not be associated to netclass. The specified net(s) were not found in the system.`);
    } 
    return netChangeInfo; 
}


async function execNetAssignRemoval(netChangeInfo: NetMgmtCtx, allInputInvolvedNets: Net[], infilter: Filter<Net>) : Promise<NetMgmtCtx> {
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION);
    if(allInputInvolvedNets && allInputInvolvedNets.length > 0) {
        for(let i = 0; i < allInputInvolvedNets.length; i++) {
            allInputInvolvedNets[i].interfaceId = "";
            allInputInvolvedNets[i].netclassId = "";
            allInputInvolvedNets[i].netclassMapType = DataMappingTypeEnum.Unmapped;   
        }
        let result = await netRepo.ReplaceMany(allInputInvolvedNets);
        if (result) {
            let updatedNets = await netRepo.GetAllByProjectID(netChangeInfo.projectId, infilter);
            if (updatedNets && updatedNets.length > 0) {
                netChangeInfo.status = "success";
                netChangeInfo.netsInvolved = updatedNets; //update the list that needs to go out -- important!
            }
            else {
                throw new Error(`Failed to get updated net(s). An unspecified error may have occured while performing update operation`);
            }
        }
        else {
            throw new Error(`Failed to update net(s). An unspecified error occured while performing update operation`);
        }
    }
    else {
        throw new Error(`Net(s) could not be disassociated from netclass. The specified net(s) were not found in the system.`);
    }  
    return netChangeInfo;
}


async function executeDiffPairingAction(nets: Net[]) : Promise<Net[]>{
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let resultUpdateArr : Net[] = [];

    if(!nets || nets.length !== 2){
        throw new Error(`Could not process diff-pair action. 'Net' information was either invalid or not provided`);
    }
    if(nets[0]._id && nets[1]._id && (nets[0]._id.toString() === nets[1]._id.toString())){
        throw new Error(`The two nets provided for pairing cannot have the same Id`);
    }

    let toBeUpdated = [nets[0], nets[1]]
    for(let k = 0; k < toBeUpdated.length; k++) {
        toBeUpdated[k].diffPairMapType = DataMappingTypeEnum.Manual;
        toBeUpdated[k].diffPairNet = ((nets[k]?._id?.toString() === nets[0]?._id?.toString()) ? nets[1]?._id?.toString() : nets[0]?._id?.toString()) as string;
    }

    let res = await netRepo.ReplaceMany(toBeUpdated)
    if(res) {
        let diffNetIdList : ObjectId[] = toBeUpdated.map(x => new ObjectId(x._id?.toString())) ?? []
        let infilter = { _id: { $in: diffNetIdList } as any };
        resultUpdateArr = await netRepo.GetAllByProjectID(nets[0].projectId, infilter) ?? []
    }

    return resultUpdateArr;
}


async function unpairDiffPairedNets(project: Project, nets: Net[]) : Promise<Net[]>{
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let resultUpdateArr : Net[] = [];
    let updaterMapping = new Map<string, Net>();
    let projectId = project._id?.toString() as string;

    if(!nets || nets.length === 0){
        throw new Error(`Could not process diff-pair action. 'Net' information was either invalid or not provided`);
    }
    
    nets = getDistinctById<Net>(nets)

    let partnerNetIdList : ObjectId[] = nets.filter(a => a.diffPairNet && a.diffPairNet.trim().length > 0)?.map(x => new ObjectId(x.diffPairNet)) ?? []
    if(!partnerNetIdList || partnerNetIdList.length === 0) {
        throw new Error(`Could not process diff-pair removal action. Net(s) provided either were not diff-pairs, or were paired with nets that the system is unaware of`);
    }

    let infilter = { _id: { $in: partnerNetIdList } as any };
    let foundPartnerNets: Net[] = await netRepo.GetAllByProjectID(projectId, infilter) ?? []
    if(!foundPartnerNets || foundPartnerNets.length !== partnerNetIdList.length){
        throw new Error(`Could not process diff-pair removal action. Net(s) provided were paired with other nets that did not exist in the system`);
    }
    
    nets.forEach(a => updaterMapping.set(a._id?.toString() as string, a))
    foundPartnerNets.forEach(a => updaterMapping.set(a._id?.toString() as string, a))
    
    //assemble all the net properties that are related to diff pairs. these will need to be cleared
    let diffRelatedNetPropNames = new Set<string>()
    for(let prop of (project.constraintSettings ?? [])) {
        if (prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
            let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "export_context")?.value
            if(exportSettings && exportSettings.setToDiffPairEntity && exportSettings.setToDiffPairEntity === true) {
                diffRelatedNetPropNames.add(prop.name.toLowerCase())
            }
        }
    }

    for(let [idStr, netObj] of updaterMapping) {
        netObj.diffPairMapType = DataMappingTypeEnum.Unmapped;
        netObj.diffPairNet = "";
        
        //clear diff pair related properties for the given net object
        if(netObj.associatedProperties && diffRelatedNetPropNames.size > 0) {      
            for(let prop of netObj.associatedProperties) {
                if(diffRelatedNetPropNames.has(prop.name.toLowerCase())) {
                    (prop.value as ConstraintValues).customValue = ''
                }
            }
        }
    }
    
    let res = await netRepo.ReplaceMany(Array.from(updaterMapping.values()))
    if(res) {
        let diffNetIdList : ObjectId[] = [...updaterMapping.keys()].map(x => new ObjectId(x)) ?? []
        let infilter = { _id: { $in: diffNetIdList } as any };
        resultUpdateArr = await netRepo.GetAllByProjectID(projectId, infilter) ?? []

        let originalIdList : string[] = nets.map(a => a._id?.toString() as string);
        resultUpdateArr = resultUpdateArr.filter(a => originalIdList.includes(a?._id?.toString() as string))  //NOTE: returns only the items that were sent in
    }

    return resultUpdateArr;
}



//POTENTIALLY EXPENSIVE!
export async function runAutoMapLogic(netclasses: Netclass[]){ 
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let netBatch = new Array<Net>();

    if(netclasses && netclasses.length > 0) {
        try {   
            await handleProjectPendingProcessIndicator(netclasses[0].projectId, PendingProcessActionTypeEnum.AUTOMAP_EXEC, false, true); 
            
            netclasses = netclasses.sort((a, b) => a.patternIndex < b.patternIndex ? -1 : 1);
            
            for(let i = 0; i < netclasses.length; i++) {
                if(netclasses[i].interfaceId && netclasses[i].interfaceId.length > 0) {
                    let pattern = netclasses[i].pattern
                    let channel = netclasses[i].channel?.trim()
                    let filters = null

                    if(pattern && pattern.trim().length > 0) {
                        try {
                            //make replacement for channel indicator token
                            if(pattern.toUpperCase().includes(AUTOMAP_PATTERN_CHANNEL_INDICATOR.toUpperCase())) {
                                if(channel && channel.length > 0) {
                                    let searchRegExp = new RegExp(AUTOMAP_PATTERN_CHANNEL_INDICATOR, 'gi'); // 'g' for global, 'i' for case-insensitive
                                    pattern = pattern.replaceAll(searchRegExp, channel.trim());
                                }
                            }
                            const regexPattern = new RegExp(`${pattern.trim()}`, 'i');
                            filters = [{ netclassMapType: DataMappingTypeEnum.Unmapped, name: regexPattern } as Filter<Net>]
                        }
                        catch(error: any) {
                            console.error(`Failed to create regex element for automap logic. Netclass: '${netclasses[i].name}'. Supplied pattern: '${pattern}'`)
                            continue;  //Just move on to next netclass pattern!
                        }

                        //TODO: consider bulk execute --- https://www.mongodb.com/docs/manual/reference/method/Bulk.find.update/#std-label-example-bulk-find-update-agg
                        //https://stackoverflow.com/a/25077063
                        const cursor = netRepo.GetCursorByProjectIDAndProjection(netclasses[i].projectId, filters, null, NET_RETRIEVAL_BATCH_SIZE)
                        for await (const cursNet of cursor) {  //when iterating a cursor, be careful never to use the same name ("in this case: 'cursNet') in the same local context
                            cursNet.interfaceId = netclasses[i].interfaceId
                            cursNet.netclassId = netclasses[i]._id?.toString() as string
                            cursNet.netclassMapType = DataMappingTypeEnum.Auto

                            netBatch.push(cursNet);
                            if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
                                netRepo.ReplaceMany([...netBatch])
                                netBatch = new Array<Net>()
                            }
                        }

                        if(netBatch.length > 0){
                            netRepo.ReplaceMany(netBatch)
                            netBatch = new Array<Net>()
                        }
                    }
                }
            }
        
            handleProjectPendingProcessIndicator(netclasses[0].projectId, PendingProcessActionTypeEnum.AUTOMAP_EXEC, false, false);
        }
        catch(error: any) {
            handleProjectPendingProcessIndicator(netclasses[0].projectId, PendingProcessActionTypeEnum.AUTOMAP_EXEC, true, false, error.message);
            throw error;
        }

    }
}




//POTENTIALLY EXPENSIVE!
export async function runAutoDiffPairingLogic(proj: Project) {
    
    if(!proj || !proj._id || !proj.org || proj.org.trim().length === 0) {
        throw new Error(`Diff Pair logic could not be executed. Could not determine project org from supplied project element.`);
    }
    let projectId = proj._id?.toString() as string;

    try {
        await handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTODIFF_EXEC, false, true); 

        const placeHolder = "PL_" + crypto.randomUUID();
        let confDiffs = new Set<BasicKVP>()
        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

        let diffIgnoreRegExpProp = proj.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA && a.name === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA))
        let diffIgnoreRegexCriterias : BasicKVP[] = (diffIgnoreRegExpProp && diffIgnoreRegExpProp.value && diffIgnoreRegExpProp.value.length > 0) ? diffIgnoreRegExpProp.value : []
        
        
        let genConfigs = await getGenConfigs(null, proj.org, false);
        
        if(genConfigs && genConfigs.length > 0) {
            let diffSettings = genConfigs.filter(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__Diff_Pair_Settings.toLowerCase())?.at(0)?.configValue ?? null
            
            let diffQueryAsString : string = JSON.stringify(AGG_QUERY_DIFF_PAIR_FORMATION) || '';
            diffQueryAsString = diffQueryAsString.replace("####_PROJECTID_####", projectId) //Important!
        
            if(diffSettings) {
                if(diffSettings.presetDiffPairs && diffSettings.presetDiffPairs.length > 0) {
                    for(let i = 0; i < diffSettings.presetDiffPairs.length; i++) {
                        let net1 = diffSettings.presetDiffPairs[i].net1
                        let net2 = diffSettings.presetDiffPairs[i].net2
                        confDiffs.add({key: net1, value: net2} as BasicKVP)
                    }
                }

                if(diffSettings.netExclusionCriteria) {
                    let startsWithReplVal = placeHolder
                    if(diffSettings.netExclusionCriteria.startsWith && diffSettings.netExclusionCriteria.startsWith.length > 0) {
                        let startsWithArr = diffSettings.netExclusionCriteria.startsWith;
                        startsWithReplVal = startsWithArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
                    }
                    diffQueryAsString = diffQueryAsString.replace("####_STARTSWITH_####", startsWithReplVal)

                    let containsArrReplVal = placeHolder
                    if(diffSettings.netExclusionCriteria.contains && diffSettings.netExclusionCriteria.contains.length > 0) {
                        let containsArr = diffSettings.netExclusionCriteria.contains;
                        containsArrReplVal = containsArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
                    }
                    diffQueryAsString = diffQueryAsString.replace("####_CONTAINS_####", containsArrReplVal)
                
                    let endsWithArrReplVal = placeHolder
                    if(diffSettings.netExclusionCriteria.endsWith && diffSettings.netExclusionCriteria.endsWith.length > 0) {
                        let endsWithArr = diffSettings.netExclusionCriteria.endsWith;
                        endsWithArrReplVal = endsWithArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
                    }
                    diffQueryAsString = diffQueryAsString.replace("####_ENDSWITH_####", endsWithArrReplVal)
                } 

                let tokenPairList = (diffSettings.autoDiffPairTokens as Array<Array<string>>) ?? [];
                
                for(let k = 0; k < tokenPairList.length; k++) {
                    let tokenSet = tokenPairList[k]
                    if(tokenSet.length === 2 && tokenSet[0].trim().length === 1 && tokenSet[1].trim().length === 1) {
                        let aggPipeline : string = diffQueryAsString; //Important: looping from here on out, we will use copy of the string
                        
                        let tokOne = tokenSet[0].toString().trim().toUpperCase()
                        let tokTWO = tokenSet[1].toString().trim().toUpperCase()
                        let classVal = `${tokOne}${tokTWO}${tokOne.toLowerCase()}${tokTWO.toLowerCase()}`

                        aggPipeline = aggPipeline.replace("####_TOKEN_CLASS_####", classVal)
                        aggPipeline = aggPipeline.replace("####_TOKEN_ONE_####", tokOne)
                        aggPipeline = aggPipeline.replace("####_TOKEN_TWO_####",tokTWO)

                        if(k === 0) {
                            aggPipeline = aggPipeline.replace("####_DIFFPAIR_MAP_TYPE_####", ".*")
                        }
                        else {
                            aggPipeline = aggPipeline.replace("####_DIFFPAIR_MAP_TYPE_####", DataMappingTypeEnum.Unmapped)
                        }

                        let aggCursor = netRepo.RunAggregation(aggPipeline, true, NET_RETRIEVAL_BATCH_SIZE)
                        
                        let updateOperations: Array<AnyBulkWriteOperation<Net>> = [];

                        for await (const cursAggElement of aggCursor) { 
                            let firstNetId : string = cursAggElement.items[0]._id.toString()
                            let secondNetId : string = cursAggElement.items[1]._id.toString()
                            
                            let firstNetName : string = cursAggElement.items[0].name.toString()
                            let secondNetName : string = cursAggElement.items[1].name.toString()
                            
                            let firstNetExistingMapType = cursAggElement.items[0].diffPairMapType as DataMappingTypeEnum
                            let secondNetExistingMapType = cursAggElement.items[1].diffPairMapType as DataMappingTypeEnum
                            
                            if(firstNetExistingMapType !== DataMappingTypeEnum.Manual && secondNetExistingMapType !== DataMappingTypeEnum.Manual) {
                                let skipDP = false;
                                for(let crit of diffIgnoreRegexCriterias) {
                                    if(crit.value && crit.value.toString().length > 0) {
                                        try {
                                            let regex = new RegExp(crit.value.toString());
                                            if((regex.test(firstNetName) === true) || (regex.test(secondNetName) === true)) {
                                                skipDP = true
                                                break;
                                            }
                                        }
                                        catch(err: any) {
                                            console.log("Failed to create regex during diff pair excusion assessment")
                                        }
                                    }
                                }
                                
                                if(skipDP === false) {
                                    let operFirstNet : AnyBulkWriteOperation<Net> = { 
                                        updateOne: { 
                                            "filter": { _id: new ObjectId(firstNetId) }, 
                                            "update": { $set: { diffPairNet: secondNetId, diffPairMapType: DataMappingTypeEnum.Auto } } 
                                        } 
                                    }

                                    let operSecondNet : AnyBulkWriteOperation<Net> = { 
                                        updateOne: { 
                                            "filter": { _id: new ObjectId(secondNetId) }, 
                                            "update": { $set: { diffPairNet: firstNetId, diffPairMapType: DataMappingTypeEnum.Auto } } 
                                        } 
                                    }

                                    updateOperations.push(operFirstNet);
                                    updateOperations.push(operSecondNet);
                                }
                            }

                            if(updateOperations.length >= 1000){
                                let res = await netRepo.BulkWrite([...updateOperations])
                                updateOperations = []
                            }
                        }

                        if(updateOperations.length > 0){
                            let res = await netRepo.BulkWrite([...updateOperations])
                            updateOperations = []
                        }
                    }
                }
            }
            else {
                throw new Error(`Diff Pair logic could not be executed. Failed to retrieve diff pair configurations from config management system.`);
            }
        }
        else {
            throw new Error(`Diff Pair logic could not be executed. Failed to retrieve main configs from config management system.`);
        }


        //Important!! - go through auto diff list again to make sure...
        let netBatch = new Array<Net>();
        let dpNetfilters = [{ diffPairMapType : DataMappingTypeEnum.Auto.toString() } as Filter<Net>]
        const autoDPNetCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, dpNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
            
        for await (const autoDPNet of autoDPNetCursor) { 
            for(let crit of diffIgnoreRegexCriterias) {
                if(crit.value && crit.value.toString().length > 0) {
                    try {
                        let regex = new RegExp(crit.value.toString());
                        if(regex.test(autoDPNet.name) === true) {
                            netBatch.push(autoDPNet);
                        
                            if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
                                await unpairDiffPairedNets(proj, [...netBatch]) 
                                netBatch = new Array<Net>()
                            }
                            
                            break;
                        }
                    }
                    catch(err: any) {
                        console.log("Failed to process diff pair excusion during auto diff assessment")
                    }
                }
            }
        }

        if(netBatch.length > 0){
            unpairDiffPairedNets(proj, [...netBatch]) 
            netBatch = new Array<Net>();
        }
    
        handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTODIFF_EXEC, false, false);
    }
    catch(error: any) {
        handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTODIFF_EXEC, true, false, error.message);
        throw error;
    }         
}



export async function getNetSummaryInfo(projectId: string, excludeNetclassData: boolean) : Promise<NetSummary>{
    let ifaceMap = new Map<string, string>();
    let netclassStatMap = new Map<string, NCStats>();
    
    let netSummary : NetSummary = {
        projectId: projectId,
        hasNets: false,
        totalNets: 0,
        totalNonPairedNets: 0,
        totalDiffPairedNets: 0,
        totalAssignedNets: 0,
        totalUnassignedNets: 0,
        netclassStats: []
    }

    let netsRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    
    netSummary.totalNets = await netsRepo.GetCountByProjectId(projectId, null) ?? 0
    
    let npnFilter = {diffPairMapType: DataMappingTypeEnum.Unmapped} as Filter<Net>;
    netSummary.totalNonPairedNets = await netsRepo.GetCountByProjectId(projectId, [npnFilter]) ?? 0

    let dpFilter = { diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>;
    netSummary.totalDiffPairedNets = await netsRepo.GetCountByProjectId(projectId, [dpFilter]) ?? 0
    
    netSummary.hasNets = (netSummary.totalNets > 0) ? true : false;
    
    let orphanNetfilter = {netclassMapType: DataMappingTypeEnum.Unmapped} as Filter<Net>;
    netSummary.totalUnassignedNets = await netsRepo.GetCountByProjectId(projectId, [orphanNetfilter]) ?? 0

    netSummary.totalAssignedNets = (netSummary.totalNets > 0) ? (netSummary.totalNets - netSummary.totalUnassignedNets) : 0
    

    if(excludeNetclassData === false) {
        let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
        let nClassProjection = { interfaceId: 1, name: 1 }
        let netclassList = await netclassRepo.GetAllByProjectIDAndProjection(projectId, null, nClassProjection)

        let ifaceSMRepo = new ServiceModelRepository<Interface>(DBCollectionTypeEnum.INTERFACE_COLLECTION)
        let ifaceProjection = { name: 1 }
        let interfaceList = await ifaceSMRepo.GetAllByProjectIDAndProjection(projectId, null, ifaceProjection)



        if (interfaceList && interfaceList.length > 0) {
            for (let p = 0; p < interfaceList.length; p++) {
                let ifaceId = (interfaceList[p]._id.toString());
                let ifaceName = interfaceList[p].name;
                ifaceMap.set(ifaceId, ifaceName);
            }
        }

        if (netclassList && netclassList.length > 0) {
            for (let x = 0; x < netclassList.length; x++) {
                if (ifaceMap.has(netclassList[x].interfaceId) === false) {
                    throw new Error(`Netclass '${netclassList[x].name}' belongs to interface with id '${netclassList[x].interfaceId}' that was not found in the system`);
                }
                let ncStatObj: NCStats = {
                    interfaceId: netclassList[x].interfaceId,
                    interfaceName: ifaceMap.get(netclassList[x].interfaceId) ?? "",
                    netclassId: netclassList[x]._id?.toString(),
                    netclassName: netclassList[x].name,

                    manuallyAssigned: 0,
                    autoAssigned: 0,
                    totalNetclassNets: 0
                };
                netclassStatMap.set(netclassList[x]._id?.toString(), ncStatObj);
            }

            if(netSummary.hasNets) {
                let aggQueryAsString = AGG_QUERY_NETCLASS_STATS.replace("####_PROJECTID_####", projectId)

                let aggCursor = netsRepo.RunAggregation(aggQueryAsString, true)

                let retInfo = await aggCursor?.toArray() ?? []

                if (retInfo.length > 0) {
                    for(let i = 0; i < retInfo.length; i++) {
                        let netclassId = retInfo[i]._id?.trim()
                        let autoTotal = retInfo[i].autoAssignedCount
                        let manualTotal = retInfo[i].manualAssignedCount
                        if(netclassId && netclassId.length > 0) {
                            if (netclassStatMap.has(netclassId) === false) {
                                throw new Error(`Netclass element returned in netclass stas query may not belong to project. Please check query accuracy!`);
                            }
                            let statObj = netclassStatMap.get(netclassId) as NCStats
                            statObj.manuallyAssigned = manualTotal,
                            statObj.autoAssigned = autoTotal,
                            statObj.totalNetclassNets = (manualTotal + autoTotal)
                            netclassStatMap.set(netclassId, statObj)
                        }
                    }
                }
            }

            if (netclassStatMap.size > 0) {
                netSummary.netclassStats = Array.from(netclassStatMap.values());
            }
        }
    }

    return netSummary;
}




export async function includeDiffPairNetNameInContext(nets: Net[]): Promise<Net[]> {
    let returnNetList = Array<Net>();
    if(nets && nets.length > 0) {
        let initVal = setDiffNetContextProp(nets);
        returnNetList = initVal.modNets;
        
        if(initVal.secondAttemptList && initVal.secondAttemptList.length > 0) {
            let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
            let infilter = { _id: { $in: initVal.secondAttemptList } as any } as Filter<Net>;
            let secondSetNets = await netRepo.GetAllByProjectID(nets[0].projectId, infilter);

            if(secondSetNets.length > 0) {
                let secVal = setDiffNetContextProp(nets);
                secVal.modNets.forEach(x => returnNetList.push(x))
            }
        }
        return returnNetList;
    }
    else {
        return nets;
    }
}
    


function setDiffNetContextProp(nets: Net[]) : {modNets: Net[], secondAttemptList: ObjectId[]} {
    let secondAttemptList = new Array<ObjectId>();
    let returnNetMap = new Map<string, Net>();

    let map = new Map<string, string>();
    for(let i = 0; i < nets.length; i++) {
        map.set(nets[i]._id?.toString() as string, nets[i].name)           
        if(nets[i].projectId !== nets[0].projectId){
            throw new Error(`Could not process association of diff nets to net context. All supplied nets must belong to same project.`); 
        }
    }

    for(let i = 0; i < nets.length; i++) {
        if(nets[i].diffPairNet && nets[i].diffPairNet.trim().length > 0) {
            if(map.has(nets[i].diffPairNet)) {
                let pairedNetName = map.get(nets[i].diffPairNet);
                let prop : BasicProperty = {
                    id: nets[i].diffPairNet,
                    name: DIFFNET_PROP_NAME,
                    value: pairedNetName
                }

                nets[i].contextProperties = nets[i].contextProperties.filter(a => a.name !== DIFFNET_PROP_NAME)
                nets[i].contextProperties.push(prop)
                
                returnNetMap.set(nets[i]._id?.toString() as string, nets[i])
            }
            else {
                secondAttemptList.push(new ObjectId(nets[i]._id))
            }
        }
    }

    return {modNets: Array.from(returnNetMap.values()), secondAttemptList: secondAttemptList}
}


//POTENTIALLY EXPENSIVE!
export async function processNetPropertiesUpload(fileBuffer: Buffer, project: Project, aspect: string, fileName: string): Promise<boolean> {
    try {
        let projectId = project?._id?.toString() as string;

        await handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_PROP_UPLOAD, false, true);
        
        let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

        if(fileBuffer && fileBuffer.length > 0) {
            throw new Error(`Could not process uploaded content. The uploaded content is either invalid or empty`);
        }
        if(!aspect || aspect.trim().length === 0) {
            throw new Error(`Cannot process uploaded net info file. Uploaded 'aspect' not identified properly`)
        }
        if(!fileName || fileName.trim().length === 0) {
            throw new Error(`Cannot process uploaded net info file. Could not determine file name`)
        }
        if(fileName.trim().toLowerCase().endsWith('.xlsx') === false) {
            throw new Error(`Cannot process uploaded net info file '${fileName}'. File type is not acceptable`)
        }
        
        let netPropNameMap = new Map<string, string>();
        let netPropNameToDisplayNameMap = new Map<string, string>();
        let mgRelatedPropDispNameSet = new Set<string>();
        let netPropValueTypeMap = new Map<string, string>();
        let diffRelatedNetPropNames = new Set<string>()

    
    
        for(let prop of (project.constraintSettings ?? [])) {
            if (prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
                let dispNameUpperCase = prop.displayName.toUpperCase().trim()
                netPropNameMap.set(dispNameUpperCase, prop.name)
                netPropNameToDisplayNameMap.set(prop.name.toUpperCase(), prop.displayName)

                let displaySettings : ConstraintConfDisplayContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "display_context")?.value
                if(displaySettings) {
                    if(displaySettings.columnCellKind && displaySettings.columnCellKind.length > 0) {
                        netPropValueTypeMap.set(dispNameUpperCase, displaySettings.columnCellKind)
                    }
                    if(displaySettings.valueSource?.toLowerCase()?.trim() === "length_match_group") {
                        mgRelatedPropDispNameSet.add(dispNameUpperCase)
                    }
                }

                let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
                if(exportSettings && exportSettings.setToDiffPairEntity && exportSettings.setToDiffPairEntity === true) {
                    diffRelatedNetPropNames.add(prop.name)
                }
            }
        }
        if(!netPropNameMap || netPropNameMap.size === 0) {
            throw new Error(`Net constraint settings were not found! Please check configuration system! ORG: '${project.org}'`);
        }

        let addedMatchGrpMap = new Map<string, BasicProperty>();
        let existingMatchGrpMap = new Map<string, BasicProperty>();
        let projectMGP = project.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.MATCH_GROUP && a.name === ProjectPropertyCategoryEnum.MATCH_GROUP))
        if(projectMGP && projectMGP.value && projectMGP.value.length > 0) {
            for(let mgp of (projectMGP.value as BasicProperty[])) {
                if(mgp.id && mgp.id.trim().length > 0 && mgp.name && mgp.name.trim().length > 0 && mgp.value) {
                    existingMatchGrpMap.set(mgp.name.toUpperCase(), mgp);  //important!! --- key is upperCased for a reason!!
                }
            }
        }
        
        let dpNetNameMap = new Map<string, string>();
        let dpNetIdtoNameMapping = new Map<string, [string, string, string]>();
        let dpNetfilters = [{ diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>]
        const theDPNetCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, dpNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
        
        for await (const curNet of theDPNetCursor) { 
            if(dpNetIdtoNameMapping.has(curNet.diffPairNet)) {
                let exisName = dpNetIdtoNameMapping.get(curNet.diffPairNet)?.at(1) as string;
                dpNetIdtoNameMapping.set(curNet.diffPairNet, [curNet._id?.toString(), exisName, curNet.name]);
            }
            else {
                dpNetIdtoNameMapping.set(curNet._id?.toString(), [curNet.diffPairNet, curNet.name, '']);
            }
        }

        dpNetIdtoNameMapping.forEach(((value, key) => {
            dpNetNameMap.set(value[1], value[2]);
            dpNetNameMap.set(value[2], value[1])
        }));

        dpNetIdtoNameMapping.clear(); //not needed anymore

        const workbook = new Workbook();
        await workbook.xlsx.load(fileBuffer);

        if(workbook.worksheets.length > 0) {
            let relevantNetListSheets = workbook.worksheets.filter(a => NETLIST_EXPORT_SHEET_NAMING_REGEX_PATTERN.test(a.name))
            if(relevantNetListSheets.length > 0) {
                for (let worksheet of relevantNetListSheets) {
                    let colHeaderMap = new Map<number, string>();
                    let colHeaderCorrespondingKeyNames = new Array<string>();
                    let netUpdateInfo = new Map<string, Map<string, string>>();
                    let netNameColIndex = 0;
                    let netNameToRowNumberMap = new Map<string, number>();

                    let rowCount = worksheet.rowCount
                    for(let r = 0; r < rowCount; r++) {
                        let rowNumber = r + 1;
                        let row = worksheet.findRow(rowNumber) as ExcelJS.Row;
                        
                        if(rowNumber === 1) {
                            row.eachCell((cell, colNumber) => {
                                let cellVal = cell.value?.toString() as string
                                let cellValInUpperCase = cellVal.toUpperCase();
                                colHeaderMap.set(colNumber, cellVal)
                                
                                if(netPropNameMap.has(cellValInUpperCase) && (netPropNameMap.get(cellValInUpperCase) as string).length > 0) {
                                    colHeaderCorrespondingKeyNames.push(netPropNameMap.get(cellValInUpperCase) as string)
                                }

                                if(cellValInUpperCase === NETLIST_EXPORT_NETNAME_COL_HEADER.toUpperCase()){
                                    netNameColIndex = colNumber;
                                }
                            });
                        }
                        else if(rowNumber > 1) {
                            let netNameCell = row.findCell(netNameColIndex) as ExcelJS.Cell;
                            if (netNameCell.value && netNameCell.value.toString().trim().length > 0) {
                                netNameToRowNumberMap.set(netNameCell.value.toString(), rowNumber);
                            }
                        }
                    }

                    for(let r = 0; r < rowCount; r++) {
                        let rowNumber = r + 1;
                        let row = worksheet.findRow(rowNumber) as ExcelJS.Row;
                        let rowDataMap = new Map<string, string>();

                        if(rowNumber > 1) {
                            let netNameCell = row.findCell(netNameColIndex) as ExcelJS.Cell;
                            let netName = netNameCell.text.trim()

                            if (netName && netName.length > 0) {
                                let rowProcInfo = processDocRowInfo(row, colHeaderMap, netPropValueTypeMap, mgRelatedPropDispNameSet, 
                                    existingMatchGrpMap, addedMatchGrpMap, diffRelatedNetPropNames, netPropNameMap, colHeaderCorrespondingKeyNames);
                                rowDataMap = rowProcInfo.retMap;
                                let dpRelRowDataMap = rowProcInfo.retDPRelPropMap;
                                addedMatchGrpMap = rowProcInfo.retMGInfo;

                                if(dpNetNameMap.has(netName)) {
                                    //this is diff pair scenario....
                                    let partnerRowNumber = netNameToRowNumberMap.get(dpNetNameMap.get(netName) as string) as number
                                    let partnerRow = worksheet.findRow(partnerRowNumber) as ExcelJS.Row;
                                    let partnerNetNameCell = partnerRow.findCell(netNameColIndex) as ExcelJS.Cell;
                                    let partnerNetName = partnerNetNameCell.text.trim()
                                    let partnerDPRelRowDataMap = new Map<string, string>();

                                    if (partnerNetName && partnerNetName.length > 0) {
                                        let partnerNetRowProcInfo = processDocRowInfo(partnerRow, colHeaderMap, netPropValueTypeMap, mgRelatedPropDispNameSet, 
                                            existingMatchGrpMap, addedMatchGrpMap, diffRelatedNetPropNames, netPropNameMap, colHeaderCorrespondingKeyNames);
                                        let partnerRowDataMap = partnerNetRowProcInfo.retMap;
                                        partnerDPRelRowDataMap = partnerNetRowProcInfo.retDPRelPropMap;
                                        addedMatchGrpMap = partnerNetRowProcInfo.retMGInfo;
                                    }

                                    if(dpRelRowDataMap && dpRelRowDataMap.size > 0) {
                                        for(let [key, value] of dpRelRowDataMap) {
                                            let partnerVal = partnerDPRelRowDataMap.get(key);
                                            if(value.trim() !== partnerVal?.trim()) {
                                                let propDispName = netPropNameToDisplayNameMap.get(key.toUpperCase()) || '';
                                                throw new Error(`Invalid value detected in uploaded content. Net-names: '${netName}' and '${partnerNetName}'. `
                                                    + `See rows: ${rowNumber} and ${partnerRowNumber}. Property: ${propDispName}. Diff-paired nets must have the SAME value for a diffpair-related net properties. `
                                                    + `The system could not determine which value to use for both nets. `);
                                            }
                                        }
                                    }
                                }
                                else {
                                    for(let [key, value] of dpRelRowDataMap) {
                                        if(value && value.trim().length > 0) {
                                            let propDispName = netPropNameToDisplayNameMap.get(key.toUpperCase()) || '';
                                            throw new Error(`Changing value for a diffPair-related net property cannot be allowed if the relevant net is not actually paired. `
                                                + `See row: ${rowNumber}, net-name: '${netName}', net-property: '${propDispName}' `
                                            )
                                        }
                                    }
                                }
                    

                            }

                            if(netName.length > 0 && rowDataMap.size > 0) {
                                netUpdateInfo.set(netName, rowDataMap);
                                if(netUpdateInfo.size >= NET_RETRIEVAL_BATCH_SIZE){
                                    let res = await netRepo.BulkUpdateWithMap(projectId, netUpdateInfo, false)
                                    if(res) {
                                        netUpdateInfo.clear();
                                    }
                                }
                            }
                        }
                    }

                    if(netUpdateInfo.size > 0){
                        await netRepo.BulkUpdateWithMap(projectId, netUpdateInfo, false)
                        netUpdateInfo.clear();
                    }
                }
            }
            else {
                throw new Error(`Could not process uploaded content. No valid sheets found in document (${fileName}). Please make sure sheets are named as expected`);
            }
        }

        if(addedMatchGrpMap.size > 0) {
            let newMatchGroupsProperty : PropertyItem;
            let mgProps = Array.from(existingMatchGrpMap.values()).concat(Array.from(addedMatchGrpMap.values()));
            mgProps = mgProps.sort((a, b) => a.name < b.name ? -1 : 1); 

            if(existingMatchGrpMap.size > 0) {
                newMatchGroupsProperty = {...(projectMGP as PropertyItem)};
                newMatchGroupsProperty.value = mgProps;
            }
            else {
                newMatchGroupsProperty = {
                    id: crypto.randomUUID(),
                    name: ProjectPropertyCategoryEnum.MATCH_GROUP,
                    displayName : ProjectPropertyCategoryEnum.MATCH_GROUP,
                    category: ProjectPropertyCategoryEnum.MATCH_GROUP,
                    editable: false,
                    enabled: true,
                    value: mgProps,
                } as PropertyItem
            }
            
            await updateProjectPropertyCategoryInFull(project._id?.toString() as string, ProjectPropertyCategoryEnum.MATCH_GROUP, newMatchGroupsProperty)
        }

        handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_PROP_UPLOAD, false, false);
    
    }
    catch(error: any) {
        handleProjectPendingProcessIndicator(project._id?.toString() as string, PendingProcessActionTypeEnum.NET_PROP_UPLOAD, true, false, error.message);
        throw error;
    }

    return true;
}



//POTENTIALLY EXPENSIVE!
function processDocRowInfo(row: ExcelJS.Row, colHeaderMap: Map<number, string>, netPropValueTypeMap: Map<string, string>, matchGroupRelatedPropDispNameSet: Set<string>, 
    existingMatchGrpMap: Map<string, BasicProperty>, addedMatchGrpMap: Map<string, BasicProperty>, diffRelatedNetPropNames: Set<string>, 
    netPropNameMap: Map<string, string>, colHeaderCorrespondingKeyNames: string[]) : { retMap: Map<string, string>, retDPRelPropMap: Map<string, string>, retMGInfo: Map<string, BasicProperty> } {

    let map = new Map<string, string>(colHeaderCorrespondingKeyNames.map(keyName => [keyName, '']));  //important initialization!!
    let diffRelatedPropMap = new Map<string, string>();

    row.eachCell((cell, colNumber) => {
        if (colHeaderMap.size > 0 && colHeaderMap.has(colNumber)) {
            let relevHdr = colHeaderMap.get(colNumber);
            if (relevHdr && relevHdr.length > 0) {
                let relevHdrUpperCase = relevHdr.toUpperCase().trim();
                let rawCellValue = cell.value?.toString() || '';

                let propValInfo = determineCellValueInfo(rawCellValue, relevHdrUpperCase, netPropValueTypeMap, matchGroupRelatedPropDispNameSet, existingMatchGrpMap, row.number, colNumber);

                if (propValInfo.newMGInfo && propValInfo.newMGInfo.id && propValInfo.newMGInfo.name && propValInfo.newMGInfo.value) {
                    addedMatchGrpMap.set(propValInfo.newMGInfo.name.toUpperCase(), propValInfo.newMGInfo); //Important - note the uppercasing!
                }

                if (netPropNameMap.has(relevHdrUpperCase)) {
                    let propName = netPropNameMap.get(relevHdrUpperCase) as string;
                    map.set(propName, propValInfo.propVal);

                    if(diffRelatedNetPropNames.has(propName)) {
                        diffRelatedPropMap.set(propName, propValInfo.propVal)
                    }
                }
            }
        }
    });

    return { retMap: map, retDPRelPropMap: diffRelatedPropMap, retMGInfo: addedMatchGrpMap };
}



function determineCellValueInfo(rawCellValue: string, relevHdrUpperCase: string, netPropValueTypeMap: Map<string, string>, matchGroupRelatedPropDispNameSet: Set<string>, 
    matchGrpMap: Map<string, BasicProperty>, rowNumber: number, colNumber: number) : { propVal: string, newMGInfo: BasicProperty|null } {
    
    let result : { propVal: string, newMGInfo: BasicProperty|null } = { propVal: rawCellValue, newMGInfo: null } 

    if(rawCellValue && rawCellValue.trim().length > 0) {
        if(matchGroupRelatedPropDispNameSet.has(relevHdrUpperCase)) {
            //  If matchGroup already exists, user must either specify: "<value> (mgName)"  or  "(mgName)" or "mgName"
            //  else: if MG does not already exist, user must specify "<value> (mgName)" and system will create the new MG accordingly

            let split : string[] = rawCellValue.split(" ").map(a => a.trim())

            if(split.length === 1) {
                let singleMGName = split[0].replaceAll("(", "").replaceAll(")", "").trim();
                let singleMGNameUpperCase = singleMGName.toUpperCase()
                if(matchGrpMap.has(singleMGNameUpperCase)) {
                    result.propVal = matchGrpMap.get(singleMGNameUpperCase)?.id as string
                }
                else {
                    throw new Error(`Invalid value detected in uploaded content at row: ${rowNumber}, col: ${colNumber}. MatchGroup named '${singleMGName}' does not exist in the system`)
                }
            }
            else if (split.length === 2) {
                let mgNumberVal = split[0]
                let mgNameStr = split[1].replaceAll("(", "").replaceAll(")", "").trim();
                let mgNameUpperCase = mgNameStr.toUpperCase()
                
                if(isNumber(mgNumberVal) === true) {    
                    if(matchGrpMap.has(mgNameUpperCase)) {
                        if(matchGrpMap.get(mgNameUpperCase)?.value.toString() === mgNumberVal) {
                            result.propVal = matchGrpMap.get(mgNameUpperCase)?.id as string
                        }
                        else {
                            throw new Error(`Invalid value detected in uploaded content at row: ${rowNumber}, col: ${colNumber}. Value uploaded did not match the actual value for existing MatchGroup named '${mgNameStr}'`)
                        }        
                    }
                    else {
                        verifyNaming([mgNameStr], NamingContentTypeEnum.MATCH_GROUP);
                        
                        let newMGPropItem: BasicProperty = {
                            id: crypto.randomUUID(),
                            name: mgNameStr,
                            value: Number(mgNumberVal), //important - must be a number!! 
                        }

                        result.propVal = newMGPropItem.id
                        result.newMGInfo = newMGPropItem
                    }
                }
                else {
                    throw new Error(`Invalid value detected in uploaded content at row: ${rowNumber}, col: ${colNumber}. value for MatchGroup named '${mgNameStr}' is not a valid number`)
                }
            }
            else {
                throw new Error(`Invalid value detected in uploaded content at row: ${rowNumber}, col: ${colNumber}`)
            }
        }
        else {
            if(relevHdrUpperCase && netPropValueTypeMap.has(relevHdrUpperCase)) {
                let valueKind = netPropValueTypeMap.get(relevHdrUpperCase)?.toLowerCase()?.trim() as string
                if (valueKind === "boolean") {
                    if (rawCellValue.toString().toLowerCase() !== "true" && rawCellValue.toString().toLowerCase() !== "false") {
                        throw new Error(`Invalid value detected in uploaded content at row: ${rowNumber}, col: ${colNumber}. Value must be either 'true' or 'false'`)
                    } 
                }
                else if (valueKind === "number") {
                    if(isNumber(rawCellValue) === false) {
                        throw new Error(`Invalid value detected in uploaded content at row: ${rowNumber}, col: ${colNumber}. Value must be a number`)
                    }
                }
                else {
                    if (((typeof rawCellValue === "string")  === false) || (rawCellValue.length === 0)){
                        throw new Error(`Invalid value detected in uploaded content at row: ${rowNumber}, col: ${colNumber}. Value must be a valid and non-empty string`)
                    }
                }
            }
        }
    }
    
    return result
}



//POTENTIALLY EXPENSIVE!
export async function clearAllNetProperties(projectId: string): Promise<boolean> {
    let netBatch = new Array<Net>();
    
    let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
    
    let project = await projRepo.GetWithId(projectId);
    if(!project) { throw new Error(`Could not perform net prop reset operation. Project not found for provided ID.`); }
        
    let netConstrProps = project.constraintSettings?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase())
    if(!netConstrProps || netConstrProps.length === 0) {
        throw new Error(`Net constraint settings were not found in config mgmt system! Please check configuration system! ORG: '${project.org}'`);
    }
    
    for(let netProp of netConstrProps) {
        let initValue : ConstraintValues = { id: crypto.randomUUID(), configValue: netProp.value, defautlValue: '', customValue: '' };
        netProp.value = initValue;
        netProp.contextProperties = [];  //remove configured contextproperties, they are not needed in DB
    }

    const netCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, null, null, NET_RETRIEVAL_BATCH_SIZE)
    for await (const clearableNet of netCursor) {
        clearableNet.associatedProperties = netConstrProps;
        
        netBatch.push(clearableNet);
        if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
            netRepo.ReplaceMany([...netBatch])
            netBatch = new Array<Net>()
        }
    }

    if(netBatch.length > 0){
        netRepo.ReplaceMany(netBatch)
        netBatch = new Array<Net>()
    }
    
    return true;
}













        // await handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTOMAP_EXEC, false, true);
        // await handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTODIFF_EXEC, false, true);
            

        // handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTOMAP_EXEC, true, false, error.message);
        // handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTODIFF_EXEC, true, false, error.message);


//==================================================================================


// //POTENTIALLY EXPENSIVE!
// export async function processNetUpload(buffer: any, originalname: string, projectId: string, forceCommit: string) {
//     let response : boolean = false
    
//     try {
//         let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
//         let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)
//         let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)

//         if(!projectId || projectId === 'undefined' || projectId.trim().length === 0){
//             throw new Error(`Could not process netlist file content. Input projectId is invalid`);
//         }

//         let project = await projRepo.GetWithId(projectId)
//         if(!project) {
//             throw new Error(`Could not find project in the system. project with ID '${projectId}' does not exist!`);
//         }

//         if(originalname && originalname.length > 0) {
//             /*
//             Possible Scenarios:
//                 1) no existing nets
//                 3) nets already exist and we want to override existing nets (forceCommit = true)
//             */
//             if(buffer && buffer.length > 0) {
//                 let content: Set<string> = await extractNetListFromFile(originalname, buffer);
//                 let net = await netRepo.GetAnyOne(projectId, null)
//                 let noValidNets : boolean = (!net || !net._id) ? true : false;
//                 if (noValidNets === true || forceCommit.toLowerCase().trim() === "true") { 
//                     // This handles BOTH scenarios: 1 and 3
//                     let ret = await insertNewNets(project, content, true)
//                     if(ret) { 
//                     let proj = await addNetListFileProjectPropertyInfo(project, originalname, content.size, false)
                        
//                     try {
//                         runAutoDiffPairingLogic(proj)
//                         let netclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []
//                         if(netclasses.length > 0) {
//                             runAutoMapLogic(netclasses)
//                         }
//                     }
//                     catch(error: any){
//                         console.error(error); //DiffPair and Automap logic are best-effort processes... 
//                     }

//                     response = true 
//                 }
//                 }
//                 else {
//                     throw new Error(`Error occured while processing uploaded content. Unexpected scenario encountered. To replace existing netlist, 'forceCommit' flag is required`);
//                 }  
//             }
//             else {
//                 throw new Error(`Error occured while processing uploaded content. Please ensure input file is valid and non-empty`);
//             }
//         }
//         else {
//             throw new Error(`Could not process uploaded file content. Input info is invalid`);
//         }
    
//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, false, false);
//     }
//     catch(error: any) {
//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, true, false, error.message);
//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTOMAP_EXEC, true, false, error.message);
//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTODIFF_EXEC, true, false, error.message);
//         throw error;
//     }

//     return response;
// }


// //POTENTIALLY EXPENSIVE!
// export async function processNetReplacement(bufferInfoList: {name: string, buffer: Buffer}[], projectId: string, netListFileName: string) {
//     let response : Buffer|null = null;
//     try {
//         if(bufferInfoList && bufferInfoList.length > 0) {
//             let netListFileBuffer; 
//             let mappingFileBufferArr = new Array<Buffer>();

//             let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
//             let netclassRepo = new ServiceModelRepository<Netclass>(DBCollectionTypeEnum.NETCLASS_COLLECTION)

//             if(!projectId || projectId === 'undefined' || projectId.trim().length === 0){
//                 throw new Error(`Could not process netlist file content. Input projectId is invalid`);
//             }

//             let project = await projRepo.GetWithId(projectId)
//             if(!project) {
//                 throw new Error(`Could not find project in the system. project with ID '${projectId}' does not exist!`);
//             }

//             for(let x = 0; x < bufferInfoList.length; x++) {
//                 if(bufferInfoList[x].name === netListFileName) {
//                     netListFileBuffer = bufferInfoList[x].buffer;
//                 }
//                 else {
//                     mappingFileBufferArr.push(bufferInfoList[x].buffer)
//                 }
//             }

//             if(mappingFileBufferArr.length !== bufferInfoList.length -1) {
//                 throw new Error(`Could not process uploaded content. Please make sure all files are valid and all file names are distinct`);
//             }

//             /*
//             Possible Scenarios:
//                 2) nets already exist and decision needs to be made regarding mapping/renaming, etc
//                 4) nets already exist and mapping/replacement file was also supplied for assessment
//             */
//             if(netListFileBuffer && netListFileBuffer.length > 0) {
//                 let content: Set<string> = await extractNetListFromFile(netListFileName, netListFileBuffer);

//                 let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
//                 let net = await netRepo.GetAnyOne(projectId, null)
//                 let projectHasValidNets = (net && net._id && net._id?.toString().trim().length > 0) ? true : false;

//                 if (projectHasValidNets) { 
//                     if(!mappingFileBufferArr || mappingFileBufferArr.length === 0) { 
//                         // Handle scenario: 2
//                         let zipReturnContent : Buffer = await produceNetMappingZip(projectId, content)
//                         response = zipReturnContent;
//                     }
//                     else {
//                         // Handle scenario: 4
//                         let result = await processNetMappings(project, content, mappingFileBufferArr)
//                         if(result) { 
//                             let proj = await addNetListFileProjectPropertyInfo(project, netListFileName, content.size, true)
                            
//                             try {
//                                 runAutoDiffPairingLogic(proj)
//                                 let netclasses = await netclassRepo.GetAllByProjectID(projectId) ?? []
//                                 if(netclasses.length > 0) {
//                                     runAutoMapLogic(netclasses)
//                                 }
//                             }
//                             catch(error: any){
//                                 console.error(error); //DiffPair and Automap logic are best-effort processes... 
//                             }

//                             response = Buffer.from("true")
//                         }
//                     }
//                 }
//                 else {
//                     throw new Error(`Error occured while processing uploaded content. Unexpected scenario encountered`);
//                 }
//             }
//             else {
//                 throw new Error(`Error occured while processing uploaded content. Please ensure input file is valid and non-empty`);
//             }
//         }
//         else {
//             throw new Error(`Could not process uploaded file content. Content was either invalid or empty`);
//         }

//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, false, false);
//     }
//     catch(error: any) {
//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.NET_IMPORT, true, false, error.message);
//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTOMAP_EXEC, true, false, error.message);
//         handleProjectPendingProcessIndicator(projectId, PendingProcessActionTypeEnum.AUTODIFF_EXEC, true, false, error.message);
//         throw error;
//     }

//     return response;
// }

// /=============================================================================================




 // if(renameMap.has(renameNet.name)) {
        //     renameNet.name = renameMap.get(renameNet.name) as string
        
        //     netBatch.push(renameNet);
        //     if(netBatch.length >= NET_RETRIEVAL_BATCH_SIZE){
        //         netRepo.ReplaceMany([...netBatch])
        //         netBatch = new Array<Net>()
        //     }
        // }

        // let dpNetfilters = [{ diffPairMapType : DataMappingTypeEnum.Auto.toString() } as Filter<Net>]
    // const autoDPNetCursor = netRepo.GetCursorByProjectIDAndProjection(projectId, dpNetfilters, null, NET_RETRIEVAL_BATCH_SIZE)
        
    // for await (const autoDPNet of autoDPNetCursor) { 
    //     if(dpNetIdToNameMapping.has(initDPNet.diffPairNet)) {
    //         dpNetIdToNameMapping.set(initDPNet.diffPairNet, [initDPNet._id?.toString(), initDPNet.name, initDPNet.netclassId]);
    //     }
    //     else {
    //         dpNetIdToNameMapping.set(initDPNet._id?.toString(), [initDPNet.diffPairNet, '', '']);
    //     }
    // }



//====================================================================================


// if(workbook.worksheets.length > 0) {
//     let relevantNetListSheets = workbook.worksheets.filter(a => NETLIST_EXPORT_SHEET_NAMING_REGEX_PATTERN.test(a.name))
//     if(relevantNetListSheets.length > 0) {
//         for (let worksheet of relevantNetListSheets) {
//             let colHeaderMap = new Map<number, string>();
//             let colHeaderCorrespondingKeyNames = new Array<string>();
//             let netUpdateInfo = new Map<string, Map<string, string>>();
//             let netNameColIndex = 0;

//             let rowCount = worksheet.rowCount
//             for(let r = 0; r < rowCount; r++) {
//                 let rowNumber = r + 1;
//                 let row = worksheet.findRow(rowNumber) as ExcelJS.Row;
                
//                 if(rowNumber === 1) {
//                     row.eachCell((cell, colNumber) => {
//                         let cellVal = cell.value?.toString() as string
//                         let cellValInUpperCase = cellVal.toUpperCase();
//                         colHeaderMap.set(colNumber, cellVal)
                        
//                         if(netPropNameMap.has(cellValInUpperCase) && (netPropNameMap.get(cellValInUpperCase) as string).length > 0) {
//                             colHeaderCorrespondingKeyNames.push(netPropNameMap.get(cellValInUpperCase) as string)
//                         }

//                         if(cellValInUpperCase === NETLIST_EXPORT_NETNAME_COL_HEADER.toUpperCase()){
//                             netNameColIndex = colNumber;
//                         }
//                     });
//                 }
//                 else if(rowNumber > 1) {
//                     let netName = "";
//                     let map = new Map<string, string>(colHeaderCorrespondingKeyNames.map(keyName => [keyName, '']));  //important initialization!!
//                     let netNameCell = row.findCell(netNameColIndex) as ExcelJS.Cell;

//                     if (netNameCell.value && netNameCell.value.toString().trim().length > 0) {
//                         row.eachCell((cell, colNumber) => {
//                             if(colHeaderMap.size > 0 && colHeaderMap.has(colNumber)) {
//                                 let relevHdr = colHeaderMap.get(colNumber)
//                                 if(relevHdr && relevHdr.length > 0) {
//                                     let relevHdrUpperCase = relevHdr.toUpperCase().trim()
//                                     let rawCellValue = cell.value?.toString() || ''

//                                     let propValInfo = determineCellValueInfo(rawCellValue, relevHdrUpperCase, netPropValueTypeMap, matchGroupRelatedPropDispNameSet, existingMatchGrpMap, row.number, colNumber)
                                
//                                     if(propValInfo.newMGInfo && propValInfo.newMGInfo.id && propValInfo.newMGInfo.name && propValInfo.newMGInfo.value) {
//                                         addedMatchGrpMap.set(propValInfo.newMGInfo.name.toUpperCase(), propValInfo.newMGInfo);  //Important - note the uppercasing!
//                                     }
                                    
//                                     if(netPropNameMap.has(relevHdrUpperCase)){
//                                         let propName = netPropNameMap.get(relevHdrUpperCase) as string;
//                                         map.set(propName, propValInfo.propVal) 
//                                     }
//                                     else {
//                                         if(colNumber === netNameColIndex) {
//                                             netName = cell.value?.toString() || ''
//                                         }
//                                     }
//                                 }
//                             }
//                         });
//                     }

//                     if(netName.length > 0 && map.size > 0) {
//                         netUpdateInfo.set(netName, map);
//                         if(netUpdateInfo.size >= NET_RETRIEVAL_BATCH_SIZE){

//                             //do something here

//                             let res = await netRepo.BulkUpdateWithMap(projectId, netUpdateInfo, false)
//                             if(res) {
//                                 netUpdateInfo.clear();
//                             }
//                         }
//                     }
//                 }
//             }

//             if(netUpdateInfo.size > 0){

                
//                 //do something here


                
//                 await netRepo.BulkUpdateWithMap(projectId, netUpdateInfo, false)
//                 netUpdateInfo.clear();
//             }
//         }
//     }
//     else {
//         throw new Error(`Could not process uploaded content. No valid sheets found in document (${fileName}). Please make sure sheets are named as expected`);
//     }
// }


//=====================================================================================================================


// let filters = new Array<Filter<Net>>();
// let regexList = Array.from(netUpdateInfo.keys()).map(name => new RegExp(`^${name}$`, 'i'));
// filters.push({ name: { $in: regexList } } as Filter<Net>);
// filters.push({ diffPairMapType : { $ne: DataMappingTypeEnum.Unmapped.toString() } } as Filter<Net>)
// let finalFilter = { $and: [ { projectId: projectId }, ...filters ] }
// let projection = { _id: 1, name: 1, diffPairNet: 1 };
// let relevNets = await netRepo.GetByFilterAndProjection(finalFilter, projection);
// if(relevNets && relevNets.length > 0) {
//     console.log("sadasdasdasdasd")
// }


//===========================================================


                    
                    // if(diffRelatedNetPropNames.has(net.associatedProperties[i].name.toLowerCase())) {
                    //     if(!net.diffPairNet || net.diffPairMapType === DataMappingTypeEnum.Unmapped) {
                    //         throw new Error("Changing value for a diffPair-related net property cannot be allowed if the relevant net is not actually paired");
                    //     } 
                    // }

//============================================================


// for(let c = 0; c < row.cellCount; c++) {
//     let colNumber = c + 1;  //IMPORTANT - columns are NOT zero-based indexing
//     let netNameCell = row.findCell(netNameColIndex) as ExcelJS.Cell;
//     let cell = row.findCell(colNumber) as ExcelJS.Cell;
    
//     if(netNameCell.value && netNameCell.value.toString().trim().length > 0) {
//         if(cell && colHeaderMap.size > 0 && colHeaderMap.has(colNumber)) {
//             let relevHdr = colHeaderMap.get(colNumber)
//             if(relevHdr && relevHdr.length > 0) {
//                 let relevHdrUpperCase = relevHdr.toUpperCase().trim()
//                 let rawCellValue = cell.value?.toString() || ''

//                 try {
//                     let propValInfo = determineCellValueInfo(rawCellValue, relevHdrUpperCase, netPropValueTypeMap, matchGroupRelatedPropDispNameSet, existingMatchGrpMap, row.number, colNumber)
                
//                     if(propValInfo.newMGInfo && propValInfo.newMGInfo.id && propValInfo.newMGInfo.name && propValInfo.newMGInfo.value) {
//                         addedMatchGrpMap.set(propValInfo.newMGInfo.name.toUpperCase(), propValInfo.newMGInfo);  //Important - note the uppercasing!
//                     }
                    
//                     if(netPropNameMap.has(relevHdrUpperCase)){
//                         let propName = netPropNameMap.get(relevHdrUpperCase) as string;
//                         map.set(propName, propValInfo.propVal) 
//                     }
//                     else {
//                         if(colNumber === netNameColIndex) {
//                             netName = cell.value?.toString() || ''
//                         }
//                     }
//                 }
//                 catch(error: any) {
//                     throw new Error(error.message)  
//                 }
//             }
//         }
//     }
// }



//=======================================================================

// propArr.some(a => (a.name.trim().toUpperCase() === hrdMod) || (a.displayName.trim().toUpperCase() === hrdMod)))


// else if(netChangeInfo.actionType.toUpperCase() === NetManagementActionTypeEnum.UPDATE_NET) {  //rename, properties, etc
//     let incomingNetsAsIs = netChangeInfo.netsInvolved;

//     let names = incomingNetsAsIs.map(a => a.name)
//     verifyNaming(names, NamingContentTypeEnum.NET);
    
//     // let diffRelatedNetPropNames = new Set<string>()
//     // if(netChangeInfo.contextualInfo && netChangeInfo.contextualInfo.trim().length > 0) {
//     //     let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
//     //     let filter = { _id: new ObjectId(incomingNetsAsIs[0].projectId as string) } as Filter<Project>;
//     //     let projection = { name: 1, constraintSettings: 1 };
//     //     let projectRes = await projRepo.GetByFilterAndProjection(filter, projection);

//     //     //assemble all the net properties that are related to diff pairs. these will need to be cleared
//     //     for(let prop of (projectRes[0].constraintSettings ?? [])) {
//     //         if (prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
//     //             let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
//     //             if(exportSettings && exportSettings.setToDiffPairEntity && exportSettings.setToDiffPairEntity === true) {
//     //                 diffRelatedNetPropNames.add(prop.name.toLowerCase())
//     //             }
//     //         }
//     //     }
//     // }

//     for(let i = 0; i < incomingNetsAsIs.length; i++) {
//         let singleNet = incomingNetsAsIs[i]
//         singleNet.lastUpdatedOn = new Date();
//         singleNet.name = singleNet.name.trim();
        
//         if (singleNet.associatedProperties.length === 0) {
//             throw new Error(`No valid net properties found. At least one net property is required`);
//         }

//         //check duplicate prop names
//         let propNames = singleNet.associatedProperties.map(a => a.name);
//         let dupRes = checkDuplicatesIgnoreCase(propNames);
//         if (dupRes === false) {
//             throw new Error(`Duplicate property names are not allowed for net '${singleNet.name}'.`);
//         }

//         //ensure all properties have a uuid
//         for (let i = 0; i < singleNet.associatedProperties.length; i++) {
//             if ((!singleNet.associatedProperties[i].id) || (singleNet.associatedProperties[i].id.trim().length === 0)) {
//                 singleNet.associatedProperties[i].id = crypto.randomUUID();
//             }

//             // //important section!
//             // if(netChangeInfo.contextualInfo && netChangeInfo.contextualInfo.trim().length > 0) {
//             //     if(diffRelatedNetPropNames.has(singleNet.associatedProperties[i].name.toLowerCase())){
//             //         if(!singleNet.diffPairNet || singleNet.diffPairMapType === DataMappingTypeEnum.Unmapped) {
//             //             throw new Error("Changing value for a diffPair-related net property cannot be allowed if the relevant net is not actually paired");
//             //         } 
//             //     }
//             // }
//         }

//         if (singleNet.associatedProperties && singleNet.associatedProperties.length > 0) {
//             singleNet.associatedProperties = singleNet.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
//         }
//     }

//     let result = await netRepo.ReplaceMany(incomingNetsAsIs);
//     if (result) {
//         let updatedNets = await netRepo.GetAllByProjectID(netChangeInfo.projectId, infilter);
//         if (updatedNets && updatedNets.length > 0) {
//             netChangeInfo.status = "success";
//             netChangeInfo.netsInvolved = updatedNets; //update the list that needs to go out -- important!
//         }
//         else {
//             throw new Error(`Failed to get updated net(s). An unspecified error may have occured while performing update operation`);
//         }
//     }
//     else {
//         throw new Error(`Failed to update net(s). An unspecified error occured while performing update operation`);
//     }
// }

//--------------------------------------------------------------------------------

// async function syncDiffPairRelatedNetProperties(project: Project, nets: Net[]) {
//     let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
    
//     if(!nets || nets.length === 0 || nets.length > 2){
//         throw new Error(`Could not sync diffPair-related net properties. 'Net' information was either invalid or not provided`);
//     }

//     let netSet = Array.from(nets);
//     if(nets.length === 1) {
//         if(!nets[0].diffPairNet || nets[0].diffPairNet.trim().length === 0) {
//             throw new Error(`Could not sync diffPair-related net properties. Provided net '${nets[0].name}' is not a diff pair`);
//         }
//         let otherNet = await netRepo.GetWithId(nets[0].diffPairNet);
//         if(!otherNet) {
//             throw new Error(`Could not sync diffPair-related net properties. The system does not have a corresponding diff-pair net as expected for primary net '${nets[0].name}'`);
//         }
//         else {
//             netSet.push(otherNet);
//         }
//     }

//     let netExportSettingsMap = new Map<string, ConstraintConfExportContext>()
//     for(let prop of (project.constraintSettings ?? [])) {
//         if (prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase()) {
//             let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase() === "export_context")?.value
//             if(exportSettings && exportSettings.setToDiffPairEntity && exportSettings.setToDiffPairEntity === true) {
//                 netExportSettingsMap.set(prop.name, exportSettings)
//             }
//         }
//     }
// }





// //POTENTIALLY EXPENSIVE!
// export async function runAutoDiffPairingLogic(projectInfo: Project | string) {
//     const placeHolder = "PL_" + crypto.randomUUID();
//     let diffQueryAsString : string = '';
//     let confDiffs = new Set<BasicKVP>()
//     let genConfigs = new Array<ConfigItem>();
//     let projectId : string = placeHolder
    
    
//     if(projectInfo) {
//         if(typeof projectInfo === "string") { 
//             let projRepo = new ServiceModelRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION)
//             let projFilter = { _id: new ObjectId(projectInfo) } as any;
//             let projection = { name: 1, org: 1 };
//             let project = (await projRepo.GetByFilterAndProjection(projFilter, projection) as any[])?.at(0);
//             if (project && project.org && project.org.length > 0) {
//                 genConfigs = await getGenConfigs(null, project.org, false);
//                 projectId = project._id?.toString()
//             }
//         }
//         else {
//             if (projectInfo.org && projectInfo.org.length > 0) {
//                 genConfigs = await getGenConfigs(null, projectInfo.org, false);
//                 projectId = projectInfo._id?.toString() as string
//             }
//         }
//     }

//     if(genConfigs && genConfigs.length > 0) {
//         let diffSettings = genConfigs.filter(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__Diff_Pair_Settings.toLowerCase())?.at(0)?.configValue ?? null
//         let diffQuery = genConfigs.filter(a => a.configName.toLowerCase() === "diff_pair_formation_aggregation".toLowerCase())?.at(0)?.configValue ?? null

//         if(!diffQuery) {
//             throw new Error(`Diff Pair logic was not executed. Failed to retrieve query specification required for auto diff-pairing process. Please check config management system.`);
//         }
//         else {
//             diffQueryAsString = JSON.stringify(diffQuery);
//             diffQueryAsString = diffQueryAsString.replace("####_PROJECTID_####", projectId) //Important!
//         }

//         if(diffSettings) {
//             if(diffSettings.presetDiffPairs && diffSettings.presetDiffPairs.length > 0) {
//                 for(let i = 0; i < diffSettings.presetDiffPairs.length; i++) {
//                     let net1 = diffSettings.presetDiffPairs[i].net1
//                     let net2 = diffSettings.presetDiffPairs[i].net2
//                     confDiffs.add({key: net1, value: net2} as BasicKVP)
//                 }
//             }

//             if(diffSettings.netExclusionCriteria) {
//                 let startsWithReplVal = placeHolder
//                 if(diffSettings.netExclusionCriteria.startsWith && diffSettings.netExclusionCriteria.startsWith.length > 0) {
//                     let startsWithArr = diffSettings.netExclusionCriteria.startsWith;
//                     startsWithReplVal = startsWithArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
//                 }
//                 diffQueryAsString = diffQueryAsString.replace("####_STARTSWITH_####", startsWithReplVal)

//                 let containsArrReplVal = placeHolder
//                 if(diffSettings.netExclusionCriteria.contains && diffSettings.netExclusionCriteria.contains.length > 0) {
//                     let containsArr = diffSettings.netExclusionCriteria.contains;
//                     containsArrReplVal = containsArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
//                 }
//                 diffQueryAsString = diffQueryAsString.replace("####_CONTAINS_####", containsArrReplVal)
            
//                 let endsWithArrReplVal = placeHolder
//                 if(diffSettings.netExclusionCriteria.endsWith && diffSettings.netExclusionCriteria.endsWith.length > 0) {
//                     let endsWithArr = diffSettings.netExclusionCriteria.endsWith;
//                     endsWithArrReplVal = endsWithArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
//                 }
//                 diffQueryAsString = diffQueryAsString.replace("####_ENDSWITH_####", endsWithArrReplVal)
//             } 
//         }

//         // let netColl = (getCollection(DBCollectionTypeEnum.NET_COLLECTION) as Collection<Net>)
//         // let pipeline : Document[] = JSON.parse(diffQueryAsString);
//         // const addOptions = { allowDiskUse: true, batchSize: NET_RETRIEVAL_BATCH_SIZE }
//         // const aggCursor = netColl.aggregate(pipeline, addOptions)

//         let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
//         let aggCursor = netRepo.RunAggregation(diffQueryAsString, true, NET_RETRIEVAL_BATCH_SIZE)
        
//         let updateOperations: Array<AnyBulkWriteOperation<Net>> = [];

//         for await (const cursAggElement of aggCursor) { 
//             let firstNetId : string = cursAggElement.items[0]._id.toString()
//             let secondNetId : string = cursAggElement.items[1]._id.toString()
//             let firstNetExistingMapType = cursAggElement.items[0].diffPairMapType as DataMappingTypeEnum
//             let secondNetExistingMapType = cursAggElement.items[1].diffPairMapType as DataMappingTypeEnum
            
//             if(firstNetExistingMapType !== DataMappingTypeEnum.Manual && secondNetExistingMapType !== DataMappingTypeEnum.Manual) {
//                 let operFirstNet : AnyBulkWriteOperation<Net> = { 
//                     updateOne: { 
//                         "filter": { _id: new ObjectId(firstNetId) }, 
//                         "update": { $set: { diffPairNet: secondNetId, diffPairMapType: DataMappingTypeEnum.Auto } } 
//                     } 
//                 }
//                 let operSecondNet : AnyBulkWriteOperation<Net> = { 
//                     updateOne: { 
//                         "filter": { _id: new ObjectId(secondNetId) }, 
//                         "update": { $set: { diffPairNet: firstNetId, diffPairMapType: DataMappingTypeEnum.Auto } } 
//                     } 
//                 }

//                 updateOperations.push(operFirstNet);
//                 updateOperations.push(operSecondNet);
//             }

//             if(updateOperations.length >= 1000){
//                 let res = await netRepo.BulkWrite([...updateOperations])
//                 updateOperations = []
//             }
//         }

//         if(updateOperations.length > 0){
//             let res = await netRepo.BulkWrite([...updateOperations])
//             updateOperations = []
//         }
//     }
//     else {
//         throw new Error(`Diff Pair logic could not be executed. Failed to retrieve diff pair configurations from config management system.`);
//     }
// }







//=====================================================================================================

// export function assessNetMappings(existingNets: Net[], content: Set<string>, 
//     mappingFileBuffers: Buffer[]) : { deletedNetNames: Set<string>, retainedNetMapping: Map<string, string> } {
//     //NOTE: mapping must contain all nets for scenarios 1 & 2: --> both renamed and non-renamed nets that are retained
//     let finalMappper =  new Map<string, string>();
    
//     let addSet = new Set<string>();
//     let delSet = new Set<string>();
//     let renameMap = new Map<string, string>();
    
//     let go = false;

    
//     let mappingFileContent: string = mappingFileBuffers.toString()
//     if(mappingFileContent.length > 0) {
//         let dataLines = mappingFileContent.split(/\r?\n/).filter(a => isNotNullOrEmptyOrWS(a))
//         for (let i = 0; i < dataLines.length; i++) {
//             let lineStr = dataLines[i]
//             if(lineStr && lineStr.length > 0) {
//                 let splitStr = lineStr.split(",") ?? []
//                 if(splitStr.length >= 3) {
//                     if(go === false) {
//                         if (splitStr[0].trim().toUpperCase() === NET_REMAP_COL_ADDED_NETS) {
//                             if (splitStr[1].trim().toUpperCase() === NET_REMAP_COL_DELETED_NETS) { 
//                                 if (splitStr[2].trim().toUpperCase() === NET_REMAP_COL_RENAMING) {
//                                     go = true;
//                                 }
//                             }
//                         }
//                     }
//                     else {
//                         let addedNet = splitStr[0].trim()
//                         let deletedNet = splitStr[1].trim() 
//                         let renameNet = splitStr[2].trim()
    
//                         if(addedNet.length > 0) {
//                             addSet.add(addedNet)
//                         }
//                         if(deletedNet.length > 0) {
//                             delSet.add(deletedNet);
//                         }
//                         if(deletedNet.length > 0 && renameNet.length > 0) {
//                             renameMap.set(deletedNet, renameNet)
//                         }
//                     }
//                 }
//                 else {
//                     throw new Error(`Imported net mapping file is not formatted as expected. The CSV file should have three comma-delimited columns: `
//                      + `${NET_REMAP_COL_ADDED_NETS}, ${NET_REMAP_COL_DELETED_NETS}, ${NET_REMAP_COL_RENAMING}. `)
//                 }
//             }
//         }
//     }
//     else {
//         throw new Error(`The uploaded net mapping file cannot be processed. File is either empty or invalid`)
//     }


//     let existingNetNameSet = new Set<string>();
//     for(let n = 0; n < existingNets.length; n++) {
//         existingNetNameSet.add(existingNets[n].name);
//     }

//     let checkerAddedNets = new Set([...content].filter(nt => (existingNetNameSet.has(nt) == false)))
//     let checkerDeletedNets = new Set([...existingNetNameSet].filter(nt => (content.has(nt) == false)))
//     let retainedSet = new Set([...existingNetNameSet].filter(nt => (checkerDeletedNets.has(nt) == false)))


//     // each "Renamer netName must appear in list of added nets"
//     if(renameMap.size > 0) {
//         let renameVals = Array.from(renameMap.values())
//         for(let x = 0; x < renameVals.length; x++) {
//             if(addSet.has(renameVals[x]) === false) {
//                 throw new Error("Imported remap file is not acceptable. For renamed nets, all new names must exist as a new net in the initially-uploaded net-list file")
//             }
//         }
//     }

//     // each added net cannot appear in existing nets
//     // based on existing nets and new 'content' make sure all added are really added
//     if(addSet.size > 0) {
//         for (let item of addSet) {
//             if(existingNetNameSet.has(item) === true) {
//                 throw new Error(`Imported remap file is not acceptable. Nets in the '${NET_REMAP_COL_ADDED_NETS}' column cannot already exist in the system. Problematic-net: '${item}'`)
//             }
//             if(checkerAddedNets.has(item) == false) {
//                 throw new Error(`Imported remap file is not acceptable. Nets in the '${NET_REMAP_COL_ADDED_NETS}' must be truly new according to recently imported netlist file. Problematic-net: '${item}'`)
//             }
//         }
//     }

//     // each deleted net that is not being renamed must appear in existing nets
//     // based on existing nets and new 'content' make sure all deleted are really deleted
//     if(delSet.size > 0) {
//         for (let item of delSet) {
//             if(renameMap.has(item) === false) { //no mapping means it is a straight delete scenario for this net
//                 if (existingNetNameSet.has(item) === false) { 
//                     throw new Error(`Imported remap file is not acceptable. Nets marked for deletion must exist in the system. Problematic-net: '${item}'`)
//                 }
//                 if(checkerDeletedNets.has(item) == false) {
//                     throw new Error(`Imported remap file is not acceptable. Nets in the '${NET_REMAP_COL_DELETED_NETS}' must truly not exist in recently imported netlist file. Problematic-net: '${item}'`)
//                 }
//             }
//         }
//     }

    
//     if(retainedSet.size > 0) {
//         for (let item of retainedSet) {
//             finalMappper.set(item, item)
//         }
//     }

//     if(renameMap.size > 0) {
//         for (let [key, value] of renameMap) {
//             if(key && key.length > 0 && value && value.length > 0) {
//                 finalMappper.set(key, value)
//                 checkerAddedNets.delete(value) //Important!
//             }
//         }
//     }

//     if(checkerAddedNets.size > 0) {
//         for (let item of checkerAddedNets) {
//             finalMappper.set(item, item)
//         }
//     }

//     return { deletedNetNames: delSet, retainedNetMapping: finalMappper };
// }








/* Scenarios to handle:
 1) nets that are retained as is
 2) nets that are renamed
 3) nets that are added
 4) nets that are deleted
*/
//NOTE: mapping must contain all nets for scenarios 1 & 2: --> both renamed and non-renamed nets that are retained

// export async function setNetList(project: Project, existingNets: Net[], content: Set<string>, 
//     mappingOfRetainedNets : { deletedNetNames: Set<string>, retainedNetMapping: Map<string, string> }|null) : Promise<number> {
    
//     let creationList = new Array<Net>()
//     let nsSMRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
//     let placedNetCount = 0
//     let projectId = project._id?.toString() as string

//     // Handle scrnarios 1 & 2
//     if(existingNets && existingNets.length > 0 && mappingOfRetainedNets && mappingOfRetainedNets.size > 0) {  
//         for(let i = 0; i < existingNets.length; i++) {
//             let net = existingNets[i]
//             if(mappingOfRetainedNets.has(net.name)) {
//                 let mappedName = mappingOfRetainedNets.get(net.name)
//                 if(mappedName && mappedName.length > 0) {
//                     net.name = mappedName
//                     creationList.push(net);
//                 }
//             }
//         }
//     }
    
//     // Handle scenario 3
//     if(content && content.size > 0) {
//         let allConstrProps: PropertyItem[] = await getConstraintSettingsForOrg(projectId, project.org, false);
//         let netConstrProps = allConstrProps?.filter(a => a.category && a.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Net.toLowerCase())
//         if(!netConstrProps || netConstrProps.length === 0) {
//             throw new Error(`Net constraint settings were not found in config mgmt system! Please check configuration system! ORG: '${project.org}'`);
//         }
        
//         for(let netProp of netConstrProps) {
//             let initValue : ConstraintValues = { id: crypto.randomUUID(), configValue: netProp.value, defautlValue: '', customValue: '' };
//             netProp.value = initValue;
//             netProp.contextProperties = [];  //remove configured contextproperties, they are not needed in DB
//         }

//         let netList = Array.from(content);
//         for(let p = 0; p < netList.length; p++) {
//             if(!mappingOfRetainedNets || !(mappingOfRetainedNets.get(netList[p]))) {
//                 let net : Net = {
//                     projectId: projectId,
//                     snapshotSourceId: "",
//                     contextProperties: [],
//                     lastUpdatedOn: new Date(),
//                     interfaceId: "",
//                     name: netList[p],
//                     netclassMapType: DataMappingTypeEnum.Unmapped, //Important to set this initially!
//                     netStatus: NetStatusEnum.ACTIVE,
//                     netclassId: "",
//                     diffPairNet: "",
//                     diffPairMapType: DataMappingTypeEnum.Unmapped,
//                     associatedProperties: netConstrProps,
//                 }

//                 creationList.push(net);
//             }
//         }
//     }

//     if(creationList.length > 0) {
//         // Handle scenario 4
//         await nsSMRepo.DeleteManyByProjectId(projectId, null, true).then(async (res) => {
//             await nsSMRepo.CreateMany(creationList, true).then((res) => {  // Commit nets to DB
//                 placedNetCount = creationList.length
//             })
//         })

//         return placedNetCount
//     }
//     else {
//         throw new Error(`Error occured while creating/updating nets for project. Please make sure uploaded net info is valid`)
//     }
// }


//====================================================================

// //main parsing of mapping files
// for(let i = 0; i < mappingFileBuffers.length; i++) {
//     let buf =  mappingFileBuffers[i]
//     let iter = pipe(
//         buf, // your buffer object
//         split(a => a === 10), // = 0x0A code for \n
//         map((m, index) => {
//             let lineStr = Buffer.from(m).toString()?.trim()
//             processMappingFileLine(lineStr, index)
//         }) 
//     );
// }

//===========================================================


// function processMappingFileLine(lineStr: string, index: number) {
//     if(lineStr && lineStr.length > 0) {
//         let splitStr = lineStr.split(",") ?? []
//         if(splitStr.length >= 3) {
//             if(go === false) {
//                 if (splitStr[0].trim().toUpperCase() === NET_REMAP_COL_ADDED_NETS) {
//                     if (splitStr[1].trim().toUpperCase() === NET_REMAP_COL_DELETED_NETS) { 
//                         if (splitStr[2].trim().toUpperCase() === NET_REMAP_COL_RENAMING) {
//                             go = true;
//                         }
//                     }
//                 }
//             }
//             else {
//                 let addedNet = splitStr[0].trim()
//                 let deletedNet = splitStr[1].trim() 
//                 let renameNet = splitStr[2].trim()

//                 if(addedNet.length > 0) {
//                     addSet.add(addedNet)
//                 }
//                 if(deletedNet.length > 0) {
//                     delSet.add(deletedNet);
//                 }
//                 if(deletedNet.length > 0 && renameNet.length > 0) {
//                     renameMap.set(deletedNet, renameNet)
//                 }
//             }
//         }
//         else {
//             throw new Error(`Imported net mapping file is not formatted as expected. The CSV file should have three comma-delimited columns: `
//              + `${NET_REMAP_COL_ADDED_NETS}, ${NET_REMAP_COL_DELETED_NETS}, ${NET_REMAP_COL_RENAMING}. `)
//         }
//     }
// }


//================================================================================






// //POTENTIALLY EXPENSIVE!
// export async function runAutoDiffPairingLogic(project: Project) {
//     const placeHolder = "PL_" + crypto.randomUUID();
//     // let diffQueryAsString : string = '';
//     let confDiffs = new Set<BasicKVP>()
//     let genConfigs = new Array<ConfigItem>();
    
//     let netsColl = getCollection(DBCollectionTypeEnum.NET_COLLECTION)
//     let netsRepo = new ServiceModelRepository<Net>(netsColl)

//     if(!project) {
//         throw new Error(`Diff Pair logic could not be executed. Could not determine project that the logic should be executed for.`);
//     }
//     if (!project.org || project.org === 'undefined' || project.org.trim().length === 0) {
//         throw new Error(`Diff Pair logic could not be executed. Could not determine 'org' for project '${project.name}'`);
//     }

//     genConfigs = await getGenConfigs(null, project.org, false);
//     if(genConfigs && genConfigs.length > 0) {
//         let diffSettings = genConfigs.filter(a => a.configName.toLowerCase() === BucketConstants_GeneralConfigs.CONFIGITEM__Diff_Pair_Settings.toLowerCase())?.at(0)?.configValue ?? null
        
//         let diffQueryAsString = AGG_QUERY_DIFF_PAIR_FORMATION.replace("####_PROJECTID_####", project._id?.toString() as string)
        
//         if(diffSettings) {
//             if(diffSettings.presetDiffPairs && diffSettings.presetDiffPairs.length > 0) {
//                 for(let i = 0; i < diffSettings.presetDiffPairs.length; i++) {
//                     let net1 = diffSettings.presetDiffPairs[i].net1
//                     let net2 = diffSettings.presetDiffPairs[i].net2
//                     confDiffs.add({key: net1, value: net2} as BasicKVP)
//                 }
//             }

//             if(diffSettings.netExclusionCriteria) {
//                 let startsWithReplVal = placeHolder
//                 if(diffSettings.netExclusionCriteria.startsWith && diffSettings.netExclusionCriteria.startsWith.length > 0) {
//                     let startsWithArr = diffSettings.netExclusionCriteria.startsWith;
//                     startsWithReplVal = startsWithArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
//                 }
//                 diffQueryAsString = diffQueryAsString.replace("####_STARTSWITH_####", startsWithReplVal)

//                 let containsArrReplVal = placeHolder
//                 if(diffSettings.netExclusionCriteria.contains && diffSettings.netExclusionCriteria.contains.length > 0) {
//                     let containsArr = diffSettings.netExclusionCriteria.contains;
//                     containsArrReplVal = containsArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
//                 }
//                 diffQueryAsString = diffQueryAsString.replace("####_CONTAINS_####", containsArrReplVal)
            
//                 let endsWithArrReplVal = placeHolder
//                 if(diffSettings.netExclusionCriteria.endsWith && diffSettings.netExclusionCriteria.endsWith.length > 0) {
//                     let endsWithArr = diffSettings.netExclusionCriteria.endsWith;
//                     endsWithArrReplVal = endsWithArr?.map((a: string) => a.trim())?.join('|') ?? placeHolder
//                 }
//                 diffQueryAsString = diffQueryAsString.replace("####_ENDSWITH_####", endsWithArrReplVal)
//             } 
//         }

//         let aggCursor = netsRepo.RunAggregation(diffQueryAsString, true, NET_RETRIEVAL_BATCH_SIZE)
//         let updateOperations: Array<AnyBulkWriteOperation<Net>> = [];

//         for await (const cursAggElement of aggCursor) { 
//             let firstNetId : string = cursAggElement.items[0]._id.toString()
//             let secondNetId : string = cursAggElement.items[1]._id.toString()
//             let firstNetExistingMapType = cursAggElement.items[0].diffPairMapType as DataMappingTypeEnum
//             let secondNetExistingMapType = cursAggElement.items[1].diffPairMapType as DataMappingTypeEnum
            
//             if(firstNetExistingMapType !== DataMappingTypeEnum.Manual && secondNetExistingMapType !== DataMappingTypeEnum.Manual) {
//                 let operFirstNet : AnyBulkWriteOperation<Net> = { 
//                     updateOne: { 
//                         "filter": { _id: new ObjectId(firstNetId) }, 
//                         "update": { $set: { diffPairNet: secondNetId, diffPairMapType: DataMappingTypeEnum.Auto } } 
//                     } 
//                 }
//                 let operSecondNet : AnyBulkWriteOperation<Net> = { 
//                     updateOne: { 
//                         "filter": { _id: new ObjectId(secondNetId) }, 
//                         "update": { $set: { diffPairNet: firstNetId, diffPairMapType: DataMappingTypeEnum.Auto } } 
//                     } 
//                 }

//                 updateOperations.push(operFirstNet);
//                 updateOperations.push(operSecondNet);
//             }

//             if(updateOperations.length >= 1000){
//                 let res = await netsRepo.BulkWrite([...updateOperations])
//                 updateOperations = []
//             }
//         }

//         if(updateOperations.length > 0){
//             let res = await netsRepo.BulkWrite([...updateOperations])
//             updateOperations = []
//         }
//     }
//     else {
//         throw new Error(`Diff Pair logic could not be executed. Failed to retrieve diff pair configurations from config management system.`);
//     }
// }







      
    // let secondFindDiffNetIdList = new Array<ObjectId>();
    // let secondFindNets = new Array<Net>();
        
        // let projectId = nets[0].projectId;
        
        // for(let i = 0; i < nets.length; i++) {
        //     map.set(nets[i]._id?.toString() as string, nets[i].name)           
        //     if(nets[i].projectId !== projectId){
        //         throw new Error(`Could not process association of diff nets to net context. All supplied nets must belong to same project.`); 
        //     }
        // }

        // for(let i = 0; i < nets.length; i++) {
        //     if(nets[i].diffPairNet && nets[i].diffPairNet.trim().length > 0) {
        //         if(map.has(nets[i].diffPairNet)) {
        //             let pairedNetName = map.get(nets[i].diffPairNet);
        //             let prop : BasicProperty = {
        //                 id: nets[i].diffPairNet,
        //                 name: DIFFNET_PROP_NAME,
        //                 value: pairedNetName
        //             }

        //             nets[i].contextProperties = nets[i].contextProperties.filter(a => a.name !== DIFFNET_PROP_NAME)
        //             nets[i].contextProperties.push(prop)
                    
        //             returnNetList.set(nets[i]._id?.toString() as string, nets[i])
        //         }
        //         else {
        //             // secondFindNets.push(nets[i])
        //             // secondFindDiffNetIdList.push(new ObjectId(nets[i].diffPairNet))
        //             secondAttemptList.push(new ObjectId(nets[i]._id))
        //         }
        //     }
        // }


        // if(secondAttemptList.length > 0) {


        // }


        // if(secondFindNets.length > 0) {
        //     let netRepo = new ServiceModelRepository<Net>(DBCollectionTypeEnum.NET_COLLECTION)
        //     let infilter = { _id: { $in: secondFindDiffNetIdList } as any };
        //     let otherPullDiffNets = await netRepo.GetAllByProjectID(projectId, infilter);

        //     if(otherPullDiffNets && otherPullDiffNets.length > 0) {
        //         for(let i = 0; i < otherPullDiffNets.length; i++) {
        //             map.set(otherPullDiffNets[i]._id?.toString() as string, otherPullDiffNets[i].name)
        //         }

        //         for(let x = 0; x < secondFindNets.length; x++) {
        //             if(secondFindNets[x].diffPairNet && secondFindNets[x].diffPairNet.length > 0) {
        //                 if(map.has(secondFindNets[x].diffPairNet)) {
        //                     let pairedNetName2 = map.get(nets[x].diffPairNet);
        //                     let prop : BasicProperty = {
        //                         id: secondFindNets[x].diffPairNet,
        //                         name: DIFFNET_PROP_NAME,
        //                         value: pairedNetName2
        //                     }
        //                     secondFindNets[x].contextProperties.push(prop)
        //                     returnNetList.set(secondFindNets[x]._id?.toString() as string, secondFindNets[x])
        //                 }
        //                 else {
        //                     throw new Error(`Unexpected error occured while associating diff pairs to net context.`); 
        //                 }
        //             }
        //         }
        //     }
        // }

        // return Array.from(returnNetList.values())
    // }
    // else{
    //     return nets;
    // }
// }


//====================================================================================










// if(typeof project === "string") { 
//     let projColl = getCollection(DBCollectionTypeEnum.PROJECT_COLLECTION)
//     let projRepo = new ServiceModelRepository<Project>(projColl)
//     let projFilter = { _id: new ObjectId(project) } as any;
//     let projection = { name: 1, org: 1 };
//     let project = (await projRepo.GetByFilterAndProjection(projFilter, projection) as any[])?.at(0);
//     if (project && project.org && project.org.length > 0) {
//         genConfigs = await getGenConfigs(null, project.org, false);
//         projectId = project._id?.toString()
//     }
// }
// else {
//     if (project.org && project.org.length > 0) {
//         genConfigs = await getGenConfigs(null, project.org, false);
//         projectId = project._id?.toString() as string
//     }
// }




//===================================
        // let constrSettingsConfigs : ConfigItem[] = await getConstraintSettingsForOrg(project.org);  //getGenConfigs(projectId, null, false);
        // let defaultNetProps: PropertyItem[] = getPropertiesFromGenConfigs(constrSettingsConfigs, BucketConstants_GeneralConfigs.CONFIGITEM__Default_Net_Properties)
        
        //TODO: make sure displayname is always set for net properties! this is required
//=====================





// async function checkNetsBeforeChangeCommit(existingNets: Net[], inputNets: Net[], extensive: boolean) {
//     let names = inputNets.map(a => a.name)
//     verifyNaming(names, "Net name is invalid. Please adhere to standard and acceptable naming convention.");

//     if(extensive === true) {
//         for(let i = 0; i < inputNets.length; i++) {
//             let net = inputNets[i]
            
//             if (net.associatedProperties.length === 0) {
//                 throw new Error(`No valid net properties found. At least one net property is required`);
//             }

//             net.lastUpdatedOn = new Date();
//             net.name = net.name.trim();

//             //check duplicate prop names
//             let propNames = net.associatedProperties.map(a => a.name);
//             let dupRes = checkDuplicatesIgnoreCase(propNames);
//             if (dupRes === false) {
//                 throw new Error(`Duplicate property names are not allowed for net '${net.name}'.`);
//             }

//             //ensure all properties have a uuid
//             for (let i = 0; i < net.associatedProperties.length; i++) {
//                 if ((!net.associatedProperties[i].id) || (net.associatedProperties[i].id.trim().length === 0)) {
//                     net.associatedProperties[i].id = crypto.randomUUID();
//                 }
//             }

//             if (net.associatedProperties && net.associatedProperties.length > 0) {
//                 net.associatedProperties = net.associatedProperties.sort((a, b) => (a.category < b.category) ? -1 : 1);
//             }

//         }
//     }
// }


//=================================================================================================================
//=================================================================================================================
//=================================================================================================================



    // let existingNetsArr = new Array<Net>();
    // for(let i = 0; i < existingNetSets.length; i++) {
    //     existingNetsArr = existingNetsArr.concat(existingNetSets[i].nets)
    // }

    // let combinedNetNameSet = new Set(existingNetsArr.map(a => a.name))


    // ====================================================================
/*
Possible Scenarios for upload (1, 3) and replacement (2, 4) function:
    1) no existing nets
    2) nets already exist and decision needs to be made regarding mapping/renaming, etc 
    3) nets already exist and we want to override existing nets (forceCommit = true)
    4) nets already exist and mapping/replacement file was also supplied for assessment
*/

// =======================================================

        //*****************
        
        // let bufferStream = new stream.PassThrough();
        // bufferStream.end(netListFileBuffer);
        // let rl = readline.createInterface({ input: stream.Readable.from(netListFileBuffer) })
        // let count = 0;
        // rl.on('line', function (line) {
        //     console.log('this is ' + (++count) + ' line, content = ' + line);
        // });
        
        //with a little help fromour friends: https://stackoverflow.com/a/70159997
        // const i = pipe(
        //     netListFileBuffer, // your buffer object
        //     split(a => a === 10), // = 0x0A code for \n
        //     map(m => {
        //         let lineStr = Buffer.from(m).toString()
        //         processLine(lineStr)
        //     }) 
        // );
        
        // const lineArr = [...i]; 

        // let dataLines = content.split(/\r?\n/).filter(a => isNotNullOrEmptyOrWS(a));
        
        // for (let i = 0; i < dataLines.length; i++) {
            
        // }
    

//==========================================================================================



    //TODO: check this for performance
    // let count = 0
    // let csvContent = `ADDED_NETS,DELETED_NETS,`;
    // for(let x = 0; x < combinedNetArray.length; x++) {
    //     let net = combinedNetArray[x]
    //     csvContent
    //     if(count % CHUNK_ROW_LIMIT === 0) {

    //     }
            
    // }

    // for (let c = 0; c < combinedNetArray.length; c += CHUNK_ROW_LIMIT) {
    //     let chunk = combinedNetArray.slice(c, c + CHUNK_ROW_LIMIT);
    //     let nSet : NetSet = {
    //         projectId: projectId,
    //         snapshotSourceId: "",
    //         contextProperties: [],
    //         lastUpdatedOn: new Date(),
    //         page: currentChunkNum,
    //         size: chunk.length,
    //         totalPages: 0,
    //         tags: [],
    //         nets: chunk,  
    //     }
    //     newNetSets.push(nSet)
    //     currentChunkNum = currentChunkNum + 1;
    // }
    // if(csvContentMap.size > 0) {
    //     let stringArr = Array.from(csvContentMap.values())

    //     for(let x = 0; x < stringArr.length; x++) {
    //         let content = stringArr[x]
    //         zip.addFile(`net-mapping_${x + 1}.`, Buffer.from(content, "utf8"), `content number ${x + 1}`);
    //     }
    // }
    


    // let content1 = "FIRST content of the file";
    // zip.addFile("test-1.txt", Buffer.from(content1, "utf8"), "first entry comment goes here");

    // let content2 = "SECOND content of the file";
    // zip.addFile("test-2.txt", Buffer.from(content2, "utf8"), "second entry comment goes here");

    // get everything as a buffer
    
    
    // let zipFileContents = zip.toBuffer();


    // const fileName = 'uploads.zip';
    // const fileType = 'application/zip';
    // res.writeHead(200, {
    //     'Content-Disposition': `attachment; filename="${fileName}"`,
    //     'Content-Type': fileType,
    // })
    // return res.end(zipFileContents);
    // res.status(200).send({ payload: res.end(zipFileContents) } as ResponseData);
