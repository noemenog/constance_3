import { AppConfigConstants, DBCollectionTypeEnum, PowerInfoAspectEnum } from "../Models/Constants";
import { BasicKVP, BasicProperty, ConfigItem, PropertyItem } from "../Models/HelperModels";
import { PowerInfo } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { getGenConfigs } from "./ConfigLogic";
import { getPropertiesFromConfigs, isNotNullOrEmptyOrWS } from "./UtilFunctions";


export async function saveOrCreatePowerInfo(inputPowerInfo: PowerInfo, replaceRails: boolean, replaceComponents: boolean) : Promise<PowerInfo> {
    if(!inputPowerInfo){
        throw new Error(`Failed to save power info. No data provided`);
    }
    if (!inputPowerInfo.projectId || inputPowerInfo.projectId === 'undefined' || inputPowerInfo.projectId.trim().length === 0) {
        throw new Error(`'projectId' for input powwerInfo cannot be null or empty or undefined`);
    }
    
    let focusPowerInfo : PowerInfo;
    let updatedPowerInfo : PowerInfo;

    let piRepo = new ServiceModelRepository<PowerInfo>(DBCollectionTypeEnum.POWER_INFO_COLLECTION)
    let existingPowerInfo = await piRepo.GetOneByProjectID(inputPowerInfo.projectId)
    
    if(!existingPowerInfo) {
        let newPI : PowerInfo = {
            projectId: inputPowerInfo.projectId,
            snapshotSourceId: "",
            contextProperties: [],
            lastUpdatedOn: new Date(),
            rails: [],
            components: [],
            associatedProperties: []
        }
        focusPowerInfo = newPI;
    }
    else {
        focusPowerInfo = {...existingPowerInfo}
        focusPowerInfo.lastUpdatedOn = new Date();
    }

    if(replaceRails) {
        focusPowerInfo.rails = inputPowerInfo.rails ?? []
    }
    if(replaceComponents) {
        focusPowerInfo.components = inputPowerInfo.components ?? []
    }

    if(existingPowerInfo && existingPowerInfo._id) {
        await piRepo.ReplaceOne(focusPowerInfo);
        updatedPowerInfo = await piRepo.GetOneByProjectID(focusPowerInfo.projectId)
    }
    else {
        if(focusPowerInfo._id) { delete focusPowerInfo['_id']; }
        updatedPowerInfo = await piRepo.CreateOne(focusPowerInfo)
        if(!updatedPowerInfo) {
            throw new Error("Error occured while updating PowerInfo for project")
        }
    }

    return updatedPowerInfo;
}




export async function processPowerInfoUpload(fileBuffer: Buffer, projectId: string, aspect: PowerInfoAspectEnum, fileName: string ) : Promise<PowerInfo> {
    let updatedPowerInfo : PowerInfo;
    
    if(fileBuffer && fileBuffer.length > 0) {
        if(!projectId || projectId === 'undefined' || projectId.trim().length === 0) {
            throw new Error(`Cannot process uploaded PowerInfo file. Input projectId is either invalid or empty`)
        }
        if(!aspect || aspect.trim().length === 0) {
            throw new Error(`Cannot process uploaded PowerInfo file. Uploaded PowerInfo aspect not identified properly`)
        }
        if(!fileName || fileName.trim().length === 0) {
            throw new Error(`Cannot process uploaded PowerInfo file. Could not determine file name`)
        }
        if(fileName.trim().toLowerCase().endsWith('.csv') === false) {
            throw new Error(`Cannot process uploaded PowerInfo file '${fileName}'. File type is not acceptable`)
        }
        
        let propArr = new Array<PropertyItem>();
        let genConfigs : ConfigItem[] = await getGenConfigs(projectId, null, false);
        if(aspect === PowerInfoAspectEnum.RAILS) {
            propArr = getPropertiesFromConfigs(genConfigs, AppConfigConstants.CONFIGITEM__Power_Rails_Columns, false)
        }
        else if (aspect === PowerInfoAspectEnum.COMPONENTS) {
            propArr = getPropertiesFromConfigs(genConfigs, AppConfigConstants.CONFIGITEM__Power_Components_Columns, false)
        }
        else {
            throw new Error(`Cannot process uploaded PowerInfo file. Uploaded PowerInfo aspect '${aspect}' is not supported`)
        }

        propArr = propArr.filter(a => (a.category.toUpperCase() === aspect.toString().toUpperCase()) && isNotNullOrEmptyOrWS(a.name) && (a.enabled === true))
        if(propArr.length === 0) {
            throw new Error(`Cannot process uploaded PowerInfo file. No configured and enabled columns were found for Power [${aspect}]`)
        }
        
        let propNameToDispNameMap = new Map<string, string>()
        let propDispNameToMainNameMap = new Map<string, string>()
        for(let prop of propArr) { 
            //WARNING: uppercasing should ONLY be applied to the keys here!!!
            propNameToDispNameMap.set(prop.name.trim().toUpperCase(), prop.displayName.trim());
            propDispNameToMainNameMap.set(prop.displayName.trim().toUpperCase(), prop.name.trim())
        }


        let content: string = fileBuffer.toString()
        if(content.length > 0) {
            let dataLines = content.split(/\r?\n/).filter(a => isNotNullOrEmptyOrWS(a))
            let headersMap = new Map<number, string>()
            let dataCollection = new Array<BasicProperty>();

            for (let i = 0; i < dataLines.length; i++) {
                let lineSplit: string[] = dataLines[i].split(",") ?? [];
                if(lineSplit.length > 0) {
                    if(i === 0) {
                        let checkerSet = new Set<string>();
                        for(let x = 0; x < lineSplit.length; x++) {
                            let hdr = lineSplit[x]
                            if(hdr.length > 0 && checkerSet.has(hdr) === false) { 
                                let hrdMod = hdr.trim().toUpperCase().replaceAll(`"`, "") //csv that is downloaded from aggrid will unnecessarily have quotes around each item 
                                if(propNameToDispNameMap.has(hrdMod) || propDispNameToMainNameMap.has(hrdMod)) { 
                                    headersMap.set(x, hrdMod)
                                    checkerSet.add(hdr)
                                }
                            }
                        }
                        checkerSet.clear();  //for good measures...
                    }
                    else {
                        let kvpArr = new Array<BasicKVP>();
                        for(let x = 0; x < lineSplit.length; x++) {
                            let element = lineSplit[x].trim()
                            if(element.length > 0 && headersMap.has(x)) {
                                let key = headersMap.get(x)?.toUpperCase() as string;
                                let elementMod = element.replaceAll(`"`, "") //csv that is downloaded from aggrid will unnecessarily have quotes around each item 
                                let keyMod = propDispNameToMainNameMap.get(key);
                                if(elementMod && keyMod) {
                                    let kvp : BasicKVP = { key: keyMod, value: elementMod}
                                    kvpArr.push(kvp)
                                }
                            }
                        }
                        if(kvpArr.length > 0) {
                            let rowEntry : BasicProperty = {
                                id: crypto.randomUUID(),
                                name: dataCollection.length.toString(),
                                value: kvpArr
                            }
                            dataCollection.push(rowEntry);
                        }
                    }
                } 
            }

            if(dataCollection.length > 0) {
                let newPI : PowerInfo = {
                    projectId: projectId,
                    snapshotSourceId: "",
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    rails: (aspect === PowerInfoAspectEnum.RAILS) ? dataCollection : [],
                    components: (aspect === PowerInfoAspectEnum.COMPONENTS) ? dataCollection: [],
                    associatedProperties: []
                }
                let replaceRails = (aspect === PowerInfoAspectEnum.RAILS) ? true: false;
                let replaceComponents = (aspect === PowerInfoAspectEnum.COMPONENTS) ? true: false;
                updatedPowerInfo = await saveOrCreatePowerInfo(newPI, replaceRails, replaceComponents);
                if(!updatedPowerInfo) {
                    throw new Error(`An unexpected error occured while saving new power info`)
                }
            }
            else {
                throw new Error(`The uploaded power info file was not processed as expected. No valid information was retrieved from the file`)
            }
        }
        else {
            throw new Error(`The uploaded power info file cannot be processed. File is either empty or invalid`)
        }
    }
    else {
        throw new Error(`Could not upload default-constraints data. File was either invalid or empty`);
    }

    return updatedPowerInfo;
}










                                    
// propArr.some(a => (a.name.trim().toUpperCase() === hrdMod) || (a.displayName.trim().toUpperCase() === hrdMod)))