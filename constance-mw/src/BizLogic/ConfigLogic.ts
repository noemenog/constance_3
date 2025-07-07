
import { ObjectId } from "mongodb";
import { AppConfigConstants, AppConfigConstantsBucketType, ConstraintPropertyCategoryEnum, DBCollectionTypeEnum, NetclassNodeGenTypeEnum, SPIDER_DEV_EMAIL_CONTACT } from "../Models/Constants";
import { BasicProperty, ConfigItem, ConstraintConfExportContext, PropertyItem } from "../Models/HelperModels"
import { BaseNCNode, InterfaceTemplate, Project } from "../Models/ServiceModels";
import { BaseRepository } from "../Repository/BaseRepository";
import { ConstanceRepo } from "../Repository/ConstanceRepo";
import { getPropertiesFromConfigs } from "./UtilFunctions"
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";

//BYPASS.....................
// import { getMockOrgSpecificMainConfigs_V2 } from "../../CONFIGS_Mockup";
//BYPASS.....................


//=================================== BYPASS --> MOCK CONFIG =================================
// import HttpRequestMock from 'http-request-mock';
// import { getMockMainConfigs, getMockOrgConstraintConfigs, getMockOrgSpecificMainConfigs, getMockOrgInterfaceTemplateConfigs, getMockExportConfigs, getMockAppInfo, getMockOrgSpecificMainConfigs_V2} from "../../CONFIGS_Mockup";
// const mocker = HttpRequestMock.setup();

// mocker.get('https://constance-mw.app.intel.com/api/v2/dev/appinfo/get?appId=671a335237075b645fe75388', getMockAppInfo());
// mocker.get('https://constance-mw.app.intel.com/api/v2/dev/configs/get?appId=671a335237075b645fe75388&bucketId=671a335237075b645fe75389', getMockMainConfigs());
// mocker.get('https://constance-mw.app.intel.com/api/v2/dev/configs/get?appId=671a335237075b645fe75388&bucketId=671a335237075b645fe7538b', getMockOrgSpecificMainConfigs());
// mocker.get('https://constance-mw.app.intel.com/api/v2/dev/configs/get?appId=671a335237075b645fe75388&bucketId=671a335237075b645fe7538d', getMockOrgConstraintConfigs());
// mocker.get('https://constance-mw.app.intel.com/api/v2/dev/configs/get?appId=671a335237075b645fe75388&bucketId=671a335237075b645fe7538c', getMockOrgInterfaceTemplateConfigs());
// mocker.get('https://constance-mw.app.intel.com/api/v2/dev/configs/get?appId=671a335237075b645fe75388&bucketId=671a335237075b645fe7538a', getMockExportConfigs());
//=================================================================================




export async function getGenConfigs(projectId: string|null, org: string|null, mainBucketOnly: boolean) : Promise<ConfigItem[]>{   
    
    //BYPASS ----------
    // let processedGenConfigs_02: any[] = getMockOrgSpecificMainConfigs_V2().payload
    // return processedGenConfigs_02;
    // BYPASS ----------------
    
    let constanceRepo = new ConstanceRepo();
    let processedGenConfigs: ConfigItem[] = await constanceRepo.getConfigs(AppConfigConstants.BUCKETID__MAIN_GENERAL_CONFIG) ?? [];

    if(mainBucketOnly === false) {
        let totalConfigsMap = new Map<string, ConfigItem>();
        let orgBucketId = await getOrgBucketId(projectId, org, processedGenConfigs, AppConfigConstantsBucketType.BUCKET_TYPE_GENERAL_CONFIGS);
        let projOrgGenConfigs: ConfigItem[] = await constanceRepo.getConfigs(orgBucketId.trim()) ?? [];
        
        //now getting rid of duplicates...
        for(let x = 0; x < processedGenConfigs.length; x++) {
            totalConfigsMap.set(processedGenConfigs[x].configName, processedGenConfigs[x])
        }
        for(let x = 0; x < projOrgGenConfigs.length; x++) {
            totalConfigsMap.set(projOrgGenConfigs[x].configName, projOrgGenConfigs[x])
        }

        processedGenConfigs = Array.from(totalConfigsMap.values());
    }

    return processedGenConfigs;
}



export async function getConstraintSettingsForOrg(projectId: string|null, org: string, errorOnUnfoundItem = true) : Promise<PropertyItem[]> {
    let constraintProps = new Array<PropertyItem>();
    let constanceRepo = new ConstanceRepo();
    let notFound = new Array<string>();

    let orgBucketId = await getOrgBucketId(projectId, org, null, AppConfigConstantsBucketType.BUCKET_TYPE_CONSTRAINT_SETTINGS);
    let constrSettings = await constanceRepo.getConfigs(orgBucketId) ?? [];

    if(!constrSettings || constrSettings.length === 0){  //This is a must have!
        throw new Error(`Could not complete process. Constraint properties were not retrieved from config management system.`)
    }

    let physProps = getPropertiesFromConfigs(constrSettings, AppConfigConstants.CONFIGITEM__Physical_Constraint_Properties, false);
    if(!physProps || physProps.length === 0) { notFound.push("Physical"); }

    let clrProps = getPropertiesFromConfigs(constrSettings, AppConfigConstants.CONFIGITEM__Clearance_Constraint_Properties, false);
    if(!clrProps || clrProps.length === 0) { notFound.push("Clearance"); }
    
    let netProps = getPropertiesFromConfigs(constrSettings, AppConfigConstants.CONFIGITEM__Net_Constraint_Properties, false);
    if(!netProps || netProps.length === 0) { notFound.push("Net"); }
    
    if (errorOnUnfoundItem && notFound && notFound.length > 0) {
        throw new Error(`[${notFound.join(", ")}] constraint settings were not found in config management system for ${org}!`);
    }

    constraintProps = physProps.concat(clrProps).concat(netProps)

    let phyXpedKeyToPropNameMapping = new Map<string, string>();
    let clrXpedKeyToPropNameMapping = new Map<string, string>();
    for(let prop of constraintProps) {
        if(prop.category) {
            //get the export config for the given prop item 
            let exportSettings : ConstraintConfExportContext = prop.contextProperties?.find((a: BasicProperty) => a.name.toLowerCase().trim() === "export_context")?.value
            
            if(exportSettings && exportSettings.xpeditionKeys && exportSettings.xpeditionKeys.length > 0) {
                if(prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Physical.toLowerCase()) {
                    for(let expEntry of exportSettings.xpeditionKeys) {
                        let expKey = expEntry.trim().replaceAll(" ", "").toUpperCase()
                        if(phyXpedKeyToPropNameMapping.has(expKey) && (phyXpedKeyToPropNameMapping.get(expKey) as string).trim().toLowerCase() !== prop.name.toLowerCase()) {
                            throw new Error(`Same constraint export keys was assigned to multiple Constraint properties. Please check comfig management system. `
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
                            throw new Error(`Same constraint export keys was assigned to multiple Constraint properties. Please check comfig management system. `
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

    return constraintProps;
}



export async function getImportExportConfigs() : Promise<ConfigItem[]>{
    let importExportConfigs = new Map<string, ConfigItem>();
    let constanceRepo = new ConstanceRepo();

    let confs: ConfigItem[] = await constanceRepo.getConfigs(AppConfigConstants.BUCKETID__IMPORT_EXPORT_CONFIG) ?? [];
    for(let i = 0; i < confs.length; i++) {
        importExportConfigs.set(confs[i].configName, confs[i])
    }

    if(importExportConfigs.size === 0) {
        throw new Error(`Could not find import/export configs. Please ensure necessary configurations are set in config management system!`)
    }

    let retConfs = Array.from(importExportConfigs.values());
    return retConfs;
}



export async function getInterfaceTemplatesForOrg(org: string) : Promise<{bucketId: string, bucketName: string, templates: InterfaceTemplate[]}>{
    let constanceRepo = new ConstanceRepo();
    let templates = new Array<InterfaceTemplate>();
    
    let orgBucketId = await getOrgBucketId(null, org, null, AppConfigConstantsBucketType.BUCKET_TYPE_INTERFACE_TEMPLATES);
    let bucketName = "";
    let templateConfigs = await constanceRepo.getConfigs(orgBucketId) ?? [];

    if(templateConfigs && templateConfigs.length > 0) {
        bucketName = templateConfigs[0].bucketName ?? "";

        for(let i = 0; i < templateConfigs.length; i++) {
            if(templateConfigs[i].configName && templateConfigs[i].configValue && templateConfigs[i].configValue.interfaceName) {
                let ncItemList : BaseNCNode[] = []
                if(templateConfigs[i].configValue.netClasses && templateConfigs[i].configValue.netClasses.length > 0) {
                    for(let x = 0; x < templateConfigs[i].configValue.netClasses.length; x++) {
                        let ncNode : BaseNCNode = {
                            name: templateConfigs[i].configValue.netClasses[x].name.trim(),
                            pattern: templateConfigs[i].configValue.netClasses[x].pattern?.trim() || '',
                            patternIndex: x,
                            segment: templateConfigs[i].configValue.netClasses[x].segment?.toUpperCase()?.trim() || '',
                            nodeType: NetclassNodeGenTypeEnum.Auto
                        }
                        ncItemList.push(ncNode)
                    }
                }
                let tpl : InterfaceTemplate = {
                    id:  templateConfigs[i]._id.toString().trim(),
                    org: org.trim(),
                    uniqueName: templateConfigs[i].configName.trim(),
                    interfaceName: templateConfigs[i].configValue.interfaceName.trim(),
                    owner: templateConfigs[i].configValue.contactEmail || SPIDER_DEV_EMAIL_CONTACT,
                    contextProperties: [],
                    netclasses: ncItemList
                }
                templates.push(tpl)
            }
        }
    }

    return {bucketId: orgBucketId, bucketName: bucketName, templates: templates};
}



export async function uploadInterfaceTemplate(projectId: string, template: InterfaceTemplate){
    let constanceRepo = new ConstanceRepo();
    const re1 = /\./gi;
    const re2 = /:/gi;
    let date: string = (new Date()).toISOString().replace(re1, "-").replace(re2, "-")

    if(template && template.netclasses.length > 0) {
        if (template.org && template.org.trim().length > 0) {
            let appInfo: any = await constanceRepo.getAppInfo();
            if (appInfo && appInfo.buckets && appInfo.buckets.length > 0) {
                let orgBucketId = await getOrgBucketId(projectId, template.org, null, AppConfigConstantsBucketType.BUCKET_TYPE_INTERFACE_TEMPLATES);
                let bucket = appInfo.buckets.find((a: any) => a._id.trim() === orgBucketId.trim());
                if (bucket) {
                    let ncInfoColl = template.netclasses.map((a: BaseNCNode) => {
                        let data : any = {
                            name: a.name,
                            pattern: a.pattern.trim()
                        }
                        return data;
                    })

                    let tplConfVal : any = {
                        interfaceName: template.interfaceName.trim(),
                        contactEmail: template.owner.trim(),
                        netClasses: ncInfoColl
                    }
                    
                    let templateConfig: ConfigItem = {
                        _id: "",
                        appId: appInfo._id?.toString(),
                        bucketId: bucket._id.toString(),
                        bucketName: bucket.name,
                        configName: template.uniqueName.trim(),
                        configValue: tplConfVal,
                        contentType: "JSON",
                        description: `Interface construct saved as template by [${template.owner}] -- ${date}`,
                        lastUpdatedOn: new Date(),
                        tags: []
                    }

                    let returnConfs = await constanceRepo.setConfigs([templateConfig])
                    if(!returnConfs || returnConfs.length === 0) {
                        throw new Error(`Error occored while adding interface template configs`)
                    }
                }
                else{
                    throw new Error(`Intended 'Bucket' was not found. Interface template upload cannot proceed. Org = '${template.org}`);
                }
            }
            else{
                throw new Error(`Intended 'AppInfo' was not found. Interface template upload cannot proceed. Org = '${template.org}`);
            }
        }
        else {
            throw new Error(`'Org' is required for any interface template intended for upload/update`);
        }
    }
}



export async function getStorageEnvironmentSettings(projectId: string) : Promise<any> {
    let env = process.env.NODE_ENV;
    if(env?.toLowerCase() === "local"){
        env = "development"
    }

    let stgEnvSettings : any = null;
    let genConfigs : ConfigItem[] = await getGenConfigs(projectId, null, true)
    let storageSettings = genConfigs.find(a => a.configName.toLowerCase() === AppConfigConstants.CONFIGITEM__Storage_Api_Settings.toLowerCase())?.configValue ?? []
    if(storageSettings && storageSettings.length > 0) {
        stgEnvSettings = storageSettings.find((a: any) => env && a && a.environment && a.environment.toLowerCase() === env.toLowerCase())
    }

    if(!stgEnvSettings) {
        throw new Error("Storage API settings were not found. Please check config management system!")
    }
    else if(!stgEnvSettings.urlPrefix || stgEnvSettings.urlPrefix.length === 0) {
        throw new Error(`'urlPrefix' for environment '${env}' were not found in storage API settings. Please check config management system!`);
    }
    else if(!stgEnvSettings.storageName || stgEnvSettings.storageName.length === 0) {
        throw new Error(`'storageName' for environment '${env}' were not found in storage API settings. Please check config management system!`);
    }
    else if(!stgEnvSettings.tenant || stgEnvSettings.tenant.length === 0) {
        throw new Error(`'tenant' for environment '${env}' were not found in storage API settings. Please check config management system!`);
    }
    
    return stgEnvSettings
}



async function getOrgBucketId(projectId: string | null, org: string | null, genConfigColl: ConfigItem[] | null, bucketType: AppConfigConstantsBucketType) : Promise<string> {
    let constanceRepo = new ConstanceRepo();
    let orgBucketId = '';
    let orgsConfValue: any;

    if(genConfigColl && genConfigColl.length > 0) {
        orgsConfValue = genConfigColl.find(a => a.configName === AppConfigConstants.CONFIGITEM__Org_Settings)?.configValue ?? null
    }
    else {
        let res = await constanceRepo.getConfigs(AppConfigConstants.BUCKETID__MAIN_GENERAL_CONFIG, [AppConfigConstants.CONFIGITEM__Org_Settings]);
        orgsConfValue = res?.at(0)?.configValue ?? null
    }

    if(!orgsConfValue) {
        throw new Error(`Cannot retrieve general configs. Valid 'org' settings were not found in config management system`)
    }

    if(org && org.trim().length > 0) {
        let found = orgsConfValue.find((a: any) => a.name.trim().toLowerCase() === org.trim().toLowerCase());
        if(bucketType === AppConfigConstantsBucketType.BUCKET_TYPE_GENERAL_CONFIGS) {
            orgBucketId = found?.generalConfigsBucketId; 
        }
        else if(bucketType === AppConfigConstantsBucketType.BUCKET_TYPE_CONSTRAINT_SETTINGS) {
            orgBucketId = found?.constraintSettingsBucketId; 
        }
        else if(bucketType === AppConfigConstantsBucketType.BUCKET_TYPE_INTERFACE_TEMPLATES) {
            orgBucketId = found?.interfaceTemplatesBucketId; 
        }
    }
    else {
        if(projectId && projectId.trim().length > 0) {
            let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
            let filter = { _id: new ObjectId(projectId) } as any;
            let projection = { name: 1, org: 1 };
            let projectInfo = await projRepo.GetByFilterAndProjection(filter, projection);
            if (projectInfo && projectInfo.length > 0 ) {
                orgBucketId = orgsConfValue.find((a: any) => a.name.trim().toLowerCase() === projectInfo[0].org.trim().toLowerCase())?.generalConfigsBucketId; 
            }
        }
    }
    
    if(!orgBucketId || orgBucketId.trim().length === 0) {
        throw new Error(`Cannot retrieve general configs. Valid 'projectId' or 'org' must be provided for config query`)
    }

    return orgBucketId.trim();
}



















 // let orgBucketId = await getOrgBucketId(projectId, template.org, null, AppConfigConstantsBucketType.BUCKET_TYPE_INTERFACE_TEMPLATES);
            
            // let tplSettings = await constanceRepo.getConfigs(orgBucketId) ?? [];
            // let bucketId = tplSettings?.at(0)?.bucketId;
            // let bucketName = tplSettings?.at(0)?.bucketName;

            // if(!bucketId || (bucketId.length === 0) || !bucketName || (bucketName.length === 0)) {
            //     throw new Error(`Intended 'Bucket' was not found. Interface template upload cannot proceed. Org = '${template.org}`);
            // }

            // let ncInfoColl = template.netclasses.map((a: BaseNCNode) => {
            //     let data : any = {
            //         name: a.name,
            //         pattern: a.pattern.trim()
            //     }
            //     return data;
            // })

            // let tplConfVal : any = {
            //     interfaceName: template.interfaceName.trim(),
            //     contactEmail: template.owner.trim(),
            //     netClasses: ncInfoColl
            // }
            
            // let templateConfig: ConfigItem = {
            //     _id: "",
            //     appId: appInfo._id?.toString(),
            //     bucketId: bucket._id.toString(),
            //     bucketName: bucket.name,
            //     configName: template.uniqueName.trim(),
            //     configValue: tplConfVal,
            //     contentType: "JSON",
            //     description: `Interface construct saved as template by [${template.owner}] -- ${date}`,
            //     lastUpdatedOn: new Date(),
            //     tags: []
            // }

            // let returnConfs = await constanceRepo.setConfigs([templateConfig])
            // if(!returnConfs || returnConfs.length === 0) {
            //     throw new Error(`Error occored while adding interface template configs`)
            // }






            // let appInfo: any = await constanceRepo.getAppInfo();
            // if (appInfo && appInfo.buckets && appInfo.buckets.length > 0) {
            //     let bucketName = (template.org + AppConfigConstants.BUCKET__BU_INTERFACE_TEMPLATES_POSTFIX).toLowerCase();
            //     let bucket = appInfo.buckets.filter((a: any) => a.name.toLowerCase().trim() === bucketName.toLowerCase().trim())?.at(0);
            //     if (bucket) {
            //         let ncInfoColl = template.netclasses.map((a: BaseNCNode) => {
            //             let data : any = {
            //                 name: a.name,
            //                 pattern: a.pattern.trim()
            //             }
            //             return data;
            //         })

            //         let tplConfVal : any = {
            //             interfaceName: template.interfaceName.trim(),
            //             contactEmail: template.owner.trim(),
            //             netClasses: ncInfoColl
            //         }
                    
            //         let templateConfig: ConfigItem = {
            //             _id: "",
            //             appId: appInfo._id?.toString(),
            //             bucketId: bucket._id.toString(),
            //             bucketName: bucket.name,
            //             configName: template.uniqueName.trim(),
            //             configValue: tplConfVal,
            //             contentType: "JSON",
            //             description: `Interface construct saved as template by [${template.owner}] -- ${date}`,
            //             lastUpdatedOn: new Date(),
            //             tags: []
            //         }

            //         let returnConfs = await constanceRepo.setConfigs([templateConfig])
            //         if(!returnConfs || returnConfs.length === 0) {
            //             throw new Error(`Error occored while adding interface template configs`)
            //         }
            //     }
            //     else{
            //         throw new Error(`Intended 'Bucket' was not found. Interface template upload cannot proceed. Org = '${template.org}`);
            //     }
            // }
            // else{
            //     throw new Error(`Intended 'AppInfo' was not found. Interface template upload cannot proceed. Org = '${template.org}`);
            // }







        // let orgsConf : any = processedGenConfigs.find(a => a.configName === AppConfigConstants.CONFIGITEM__Org_Settings)?.configValue ?? null
        // if(!orgsConf) {
        //     throw new Error(`Cannot retrieve general configs. Valid 'org' settings were not found in config management system`)
        // }

        // if(!org || org.trim().length === 0) {
        //     if(projectId && projectId.trim().length > 0) {
        //         let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        //         let filter = { _id: new ObjectId(projectId) } as any;
        //         let projection = { name: 1, org: 1 };
        //         let projectInfo = await projRepo.GetByFilterAndProjection(filter, projection);
        //         if (projectInfo && projectInfo.length > 0 ) {
        //             orgBucketId = orgsConf.find((a: any) => a.name.trim().toLowerCase() === projectInfo[0].org.trim().toLowerCase())?.genConfBucketId; 
        //         }
        //     }
        // }
        // else {
        //     orgBucketId = orgsConf.find((a: any) => a.name.trim().toLowerCase() === org.trim().toLowerCase())?.genConfBucketId; 
        // }

        // if(orgName && orgName.trim().length > 0) {
        //     orgBucketId = orgsConf.find((a: any) => a.name.trim().toLowerCase() === org.trim().toLowerCase())?.genConfBucketId; 
        // }

        // if(org && org.trim().length > 0) {
        //     orgBucketId = orgsConf.find((a: any) => a.name.trim().toLowerCase() === org.trim().toLowerCase())?.genConfBucketId; 
        // }
        // else if (projectId && projectId.trim().length > 0) {
        //     let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
        //     let filter = { _id: new ObjectId(projectId) } as any;
        //     let projection = { name: 1, org: 1 };
        //     let projectInfo = await projRepo.GetByFilterAndProjection(filter, projection);
        //     if (projectInfo && projectInfo.length > 0 ) {
        //         orgBucketId = orgsConf.find((a: any) => a.name.trim().toLowerCase() === projectInfo[0].org.trim().toLowerCase())?.genConfBucketId; 
        //     }
        // }
        // else {
        //     throw new Error(`Cannot retrieve general configs. Valid 'projectId' or 'org' must be provided for config query`)
        // }







// export async function getBucketConfigurations(bucketId: string, configItemNames: string[] = []) {
//     let constanceRepo = new ConstanceRepo();
//     let configs: ConfigItem[] = await constanceRepo.getConfigs(bucketId, configItemNames) ?? [];
//     return configs;
// }






// export function assessGenConfigs(genConfigs: ConfigItem[]) {
//     if (genConfigs && genConfigs.length > 0) {
//         let substrConf: any = genConfigs.filter(a => a.configName === AppConfigConstants.CONFIGITEM__Substrate_Technologies)?.at(0)?.configValue ?? null;
//         if (substrConf && substrConf.length > 0) {
//             let subsNames = substrConf.map((a: any) => a.name);
//             if (subsNames && subsNames.length > 0) {
//                 let res = checkDuplicatesIgnoreCase(subsNames);
//                 if (res === false) {
//                     throw new Error(`Duplicate names found in configured substrate technologies for stackup setup process. Please Correct configs!`);
//                 }
//             }
//         }

//         let mtrlConf: any = genConfigs.filter(a => a.configName === AppConfigConstants.CONFIGITEM__Materials)?.at(0)?.configValue ?? null;
//         if (mtrlConf && mtrlConf.length > 0) {
//             let matNames = mtrlConf.map((a: any) => a.name);
//             if (matNames && matNames.length > 0) {
//                 let res = checkDuplicatesIgnoreCase(matNames);
//                 if (res === false) {
//                     throw new Error(`Duplicate names found in configured materials for stackup setup process. Please Correct configs!`);
//                 }
//             }
//         }
//     }
// }



// let mainGenConfigs: ConfigItem[] = await constanceRepo.getConfigs(AppConfigConstants.BUCKETID__MAIN_GENERAL_CONFIG) ?? [];
    // for(let i = 0; i < mainGenConfigs.length; i++) {
    //     genConfigs.set(mainGenConfigs[i].configName, mainGenConfigs[i])
    // }

    // if(mainBucketOnly === false) {
    //     let appInfo: any = await constanceRepo.getAppInfo();
    //     if(org && org.trim().length > 0) {
    //         if (appInfo && appInfo.buckets && appInfo.buckets.length > 0) {
    //             let bucketName = (org + AppConfigConstants.BUCKET__BU_GEN_CONFIG_POSTFIX).toLowerCase();
    //             let bucket = appInfo.buckets.find((a: any) => a.name.toLowerCase().trim() == bucketName.toLowerCase().trim());
    //             if (bucket) {
    //                 let projOrgGenConfigs: ConfigItem[] = await constanceRepo.getConfigs(bucket._id.toString()) ?? [];
    //                 for(let x = 0; x < projOrgGenConfigs.length; x++) {
    //                     genConfigs.set(projOrgGenConfigs[x].configName, projOrgGenConfigs[x])
    //                 }
    //             }
    //         }
    //     }
    //     else if (projectId && projectId.trim().length > 0) {
    //         let projRepo = new BaseRepository<Project>(DBCollectionTypeEnum.PROJECT_COLLECTION);
    //         let filter = { _id: new ObjectId(projectId) } as any;
    //         let projection = { name: 1, org: 1 };
    //         let projectInfo = await projRepo.GetByFilterAndProjection(filter, projection);
    //         if (projectInfo && projectInfo.length > 0 && appInfo && appInfo.buckets && appInfo.buckets.length > 0) {
    //             let bucketName = (projectInfo[0].org + AppConfigConstants.BUCKET__BU_GEN_CONFIG_POSTFIX).toLowerCase();
    //             let bucket = appInfo.buckets.filter((a: any) => a.name.toLowerCase().trim() == bucketName.toLowerCase().trim())?.at(0);
    //             if (bucket) {
    //                 let projOrgGenConfigs: ConfigItem[] = await constanceRepo.getConfigs(bucket._id.toString()) ?? [];
    //                 for(let k = 0; k < projOrgGenConfigs.length; k++) {
    //                     genConfigs.set(projOrgGenConfigs[k].configName, projOrgGenConfigs[k])
    //                 }
    //             }
    //         }
    //     }
    //     else {
    //         throw new Error(`Cannot retrieve general configs. Valid 'projectId' or 'org' must be provided for config query`)
    //     }
    // }


    //==============================================



// export async function getConstraintSettingsForOrg(org: string) : Promise<PropertyItem[]> {
//     let constraintProps = new Array<PropertyItem>();
//     let constrSettings: ConfigItem[] = new Array<ConfigItem>();
//     let constanceRepo = new ConstanceRepo();
//     if (org && org.length > 0) {
//         let appInfo: any = await constanceRepo.getAppInfo();
//         if (appInfo && appInfo.buckets && appInfo.buckets.length > 0) {
//             let bucketName = (org + BucketConstants_GeneralConfigs.BUCKET__BU_CONSTRAINT_SETTINGS).toLowerCase();
//             let bucket = appInfo.buckets.filter((a: any) => a.name.toLowerCase().trim() === bucketName.toLowerCase().trim())?.at(0);
//             if (bucket) {
//                 constrSettings = await constanceRepo.getConfigs(bucket._id.toString()) ?? [];
//             }
//         }
//     }
//     if(constrSettings && constrSettings.length > 0) {
//         let physProps = getPropertiesFromConfigs(constrSettings, BucketConstants_GeneralConfigs.CONFIGITEM__Physical_Constraint_Properties);
//         if(!physProps || physProps.length === 0) {
//             throw new Error(`ORG: '${org}' --- Physical constraint settings not found in config management system! Please check configuration system!`);
//         }
//         let clrProps = getPropertiesFromConfigs(constrSettings, BucketConstants_GeneralConfigs.CONFIGITEM__Clearance_Constraint_Properties);
//         if(!clrProps || clrProps.length === 0) {
//             throw new Error(`ORG: '${org}' --- Clearance constraint settings not found in config management system! Please check configuration system!`);
//         }
//         constraintProps = physProps.concat(clrProps)
//     }

//     return constraintProps;
// }



// export async function getNetPropertySettingsForOrg(org: string) : Promise<PropertyItem[]> {
//     let netProps = new Array<PropertyItem>();
//     let constrSettings: ConfigItem[] = new Array<ConfigItem>();
//     let constanceRepo = new ConstanceRepo();
//     if (org && org.length > 0) {
//         let appInfo: any = await constanceRepo.getAppInfo();
//         if (appInfo && appInfo.buckets && appInfo.buckets.length > 0) {
//             let bucketName = (org + BucketConstants_GeneralConfigs.BUCKET__BU_CONSTRAINT_SETTINGS).toLowerCase();
//             let bucket = appInfo.buckets.filter((a: any) => a.name.toLowerCase().trim() === bucketName.toLowerCase().trim())?.at(0);
//             if (bucket) {
//                 constrSettings = await constanceRepo.getConfigs(bucket._id.toString()) ?? [];
//             }
//         }
//     }
//     if(constrSettings && constrSettings.length > 0) {
//         netProps = getPropertiesFromConfigs(constrSettings, BucketConstants_GeneralConfigs.CONFIGITEM__Net_Constraint_Properties);
//         if(!netProps || netProps.length === 0) {
//             throw new Error(`ORG: '${org}' --- Net property settings not found in config management system! Please check configuration system!`);
//         }
//     }

//     return netProps;
// }