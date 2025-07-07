import axios, { AxiosRequestConfig } from "axios";
import { StorageCollateralInfo } from "../Models/HelperModels";
import { getStorageEnvironmentSettings } from "./ConfigLogic";
import { getDateAppendedName, getFileExt, getFileNameWithoutExtension } from "./UtilFunctions";
import { GENERAL_NOTE_FILES_FOLDER_NAME } from "../Models/Constants";





export async function getCollaterals(projectId: string, interfaceId: string) : Promise<StorageCollateralInfo[]> {
    const storageEnvSettings = await getStorageEnvironmentSettings(projectId); //expected to error if not found
    const storagePath = storageEnvSettings.environment + "/" + projectId + "/" + interfaceId;
    const url = `${storageEnvSettings.urlPrefix}/getlisting?StorageName=${storageEnvSettings.storageName}&Tenant=${storageEnvSettings.tenant}&Path=${storagePath}`;
    let config: any = {
        method: 'get',
        maxBodyLength: Infinity,
        url: url,
        headers: { 'x-api-Version': '2' }
    }
    
    try {
        let response = await axios.request(config)
        if(response && response.status == 200 && response.data) {
            let responseCollaterals = new Array<StorageCollateralInfo>();
            let collaterals : any[] = (response.data?.files ?? []);
            if(collaterals && collaterals.length > 0) {
                for(let collat of collaterals) {
                    let sci : StorageCollateralInfo = {
                        id: collat.id,
                        projectId: projectId,
                        interfaceId: interfaceId,
                        name: collat.name,
                        size: (collat.size < 1000) 
                            ? collat.size.toString() + " B" 
                            : Math.floor(collat.size / 1000).toString() + " KB",
                        mediaType: collat.mediaType
                    }
                    responseCollaterals.push(sci)
                }
            }
            return responseCollaterals;
        }
        else {
            throw new Error(`Failed to get collateral files for interface`)
        }
    }
    catch(err: any) {
        throw new Error(`Failed to get collateral files for interface --- ${err.message}`)
    }
}


export async function downloadCollateral(projectId: string, interfaceId: string, fileName: string) : Promise<any> {
    const storageEnvSettings = await getStorageEnvironmentSettings(projectId); //expected to error if not found
    const storagePath = storageEnvSettings.environment + "/" + projectId + "/" + interfaceId;
    const url = `${storageEnvSettings.urlPrefix}/?StorageName=${storageEnvSettings.storageName}&Tenant=${storageEnvSettings.tenant}&Path=${storagePath}&fileName=${fileName}`;

    let config: AxiosRequestConfig = { responseType: "arraybuffer" }
    const response = await axios.get(url, config);

    return response
}


export async function uploadCollaterals(files: any[], projectId: string, interfaceId: string, renameMap?: Map<string, string>) : Promise<StorageCollateralInfo[]>{
    const storageEnvSettings = await getStorageEnvironmentSettings(projectId); //expected to error if nor found

    if(!files || files.length === 0) {
        throw new Error("No files provided for upload to storage context")
    }

    const formData = new FormData();
    for(let i = 0; i < files.length; i++) {
        const { buffer, originalname, mimetype } = files[i];
        const blob = new Blob([buffer], { type: mimetype });
        
        let finalName = (renameMap && (renameMap.size > 0) && renameMap.has(originalname)) 
            ? renameMap.get(originalname) as string
            : originalname;
        
        formData.append('files', blob, finalName);
    }

    const reqHeaders = {
        "Content-Type": "multipart/form-data",
    }

    const reqInfo = { 
        tenant: storageEnvSettings.tenant, 
        path: storageEnvSettings.environment + "/" + projectId + "/" + interfaceId, 
        overwrite: true, 
        storageNames: [storageEnvSettings.storageName]
    };

    formData.append("request", JSON.stringify(reqInfo));
    
    const url = `${storageEnvSettings.urlPrefix}`;

    const response = await axios.post(url, formData, { headers: reqHeaders } as AxiosRequestConfig);

    if (response && response.status == 200) {
        let collaterals = await getCollaterals(projectId, interfaceId);
        return collaterals;
    } 
    else {
        throw new Error(`Unspecified error occured while uploading collateral files for interface.`);
    }
}


export async function discardCollaterals(inputStorageCollateralList: StorageCollateralInfo[]) : Promise<StorageCollateralInfo[]> {
    let projectId: string = inputStorageCollateralList[0].projectId;
    let interfaceId: string = inputStorageCollateralList[0].interfaceId;
        
    if(inputStorageCollateralList && inputStorageCollateralList.length > 0) {
        let errorsArr = new Array<string>();

        let fileNames: string[] = inputStorageCollateralList.map(a => a.name)
    
        const storageEnvSettings = await getStorageEnvironmentSettings(projectId); //expected to error if nor found
        const storagePath = storageEnvSettings.environment + "/" + projectId + "/" + interfaceId;
        const urlWithoutFileName = `${storageEnvSettings.urlPrefix}/?StorageName=${storageEnvSettings.storageName}&Tenant=${storageEnvSettings.tenant}&Path=${storagePath}`;
        
        for(let fName of fileNames) {
            if(fName && fName.trim().length > 0) {
                try {
                    let url = urlWithoutFileName + `&fileName=${fName}`
                    let response = await axios.delete(url);
                    if(!response || !response.status || response.status < 200 || response.status > 299) {
                        throw new Error(`Failed to delete collateral file! ResponseStatus: '${response.status}'`)
                    }
                }
                catch(err: any) {
                    errorsArr.push(err.message + ` Errored File:  '${fName}'`)
                }
            }
        }
        
        if(errorsArr.length > 0) {
            throw new Error(errorsArr.join("--- "))
        }
    }

    //return remaining items after deletion
    let collaterals = await getCollaterals(projectId, interfaceId);
    return collaterals;

}
    

export async function uploadGenericNoteImageCollaterals(file: any, projectId: string, keyIdentifier: string): Promise<{ success: number; file: { url: string; }; }> {
    let map = new Map<string, string>()
    let ext = getFileExt(file.originalname)
    let fname = getFileNameWithoutExtension(file.originalname).replaceAll(".", "_")
    let newName = getDateAppendedName(fname) + ext
    map.set(file.originalname, newName);
    
    let resp = await uploadCollaterals([file], projectId, GENERAL_NOTE_FILES_FOLDER_NAME, map)
    if(resp.some(a => a.name === newName) === false) {
        throw new Error(`Failed to upload image file to storage system`)
    }

    const storageEnvSettings = await getStorageEnvironmentSettings(projectId); 
    const storagePath = storageEnvSettings.environment + "/" + projectId + "/" + GENERAL_NOTE_FILES_FOLDER_NAME;
    const retrUrl = `${storageEnvSettings.urlPrefix}/?StorageName=${storageEnvSettings.storageName}&Tenant=${storageEnvSettings.tenant}&Path=${storagePath}&fileName=${newName}`;
    
    return {success: 1, file: {url: retrUrl}}
}


export async function deleteGenericNoteImageCollaterals(projectId: string, fileURL: string): Promise<boolean> {
    let relevantCollaterals = await getCollaterals(projectId, GENERAL_NOTE_FILES_FOLDER_NAME);
    if(relevantCollaterals && relevantCollaterals.length > 0) {
        const storageEnvSettings = await getStorageEnvironmentSettings(projectId); 
        const storagePath = storageEnvSettings.environment + "/" + projectId + "/" + GENERAL_NOTE_FILES_FOLDER_NAME;
        for(let collat of relevantCollaterals) {
            let fileName = collat.name;
            let collatUrl = `${storageEnvSettings.urlPrefix}/?StorageName=${storageEnvSettings.storageName}&Tenant=${storageEnvSettings.tenant}&Path=${storagePath}&fileName=${fileName}`;
            if(collatUrl === fileURL) {
                await discardCollaterals([collat]);
                return true;
            }
        }        
    }
    
    return false
}