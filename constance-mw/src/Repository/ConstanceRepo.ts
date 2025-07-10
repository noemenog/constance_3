import { performBackendCall } from "../BizLogic/UtilFunctions";
import { AppConfigConstants } from "../Models/Constants";
import { ConfigItem } from "../Models/ServiceModels";


export class ConstanceRepo {

    private appInfoURLPrefix;
    private configGetURLPrefix;
    private configUpdateURLPrefix;
    private configAddURLPrefix;

    constructor(){
        let prefix = process.env.CONFIG_MGR_HOST  as string
        let env = process.env.NODE_ENV
        if(prefix.endsWith("/") == false) {
            prefix = prefix + "/"
        }
        if(env?.toLowerCase() === "local"){
            env = "dev"
        }

        this.appInfoURLPrefix = `${prefix}api/v2/${env}/appinfo/get?appId=${AppConfigConstants.APP_ID}`
        this.configGetURLPrefix = `${prefix}api/v2/${env}/configs/get?appId=${AppConfigConstants.APP_ID}`
        this.configUpdateURLPrefix = `${prefix}api/v2/${env}/configs/update`
        this.configAddURLPrefix = `${prefix}api/v2/${env}/configs/add`
    }



    async getAppInfo() {
        try{
            let result = await performBackendCall(this.appInfoURLPrefix, "GET", null)
            return result;
        }
        catch(e: any){
            throw new Error(`Failed to get app info from config management system. --- ${e.message}`)
        }
    }



    //example of retrieval: http://localhost:7000/api/v2/Dev/configs/get?appId=652edc617bf62deaf2ab3e66&bucketId=6532a93b70c6716199811fe6&key[]=something3&key[]=something4
    async getConfigs(bucketId: string, configItemNames: string[] = []) : Promise<ConfigItem[]>{
        let url: string = '';
        try{
            url = `${this.configGetURLPrefix}&bucketId=${bucketId}`;
            if(configItemNames && configItemNames.length > 0){
                let arr = []
                for(let item of configItemNames){
                    arr.push(`key[]=${item}`)
                }
                let joined = arr.join("&")
                url = `${url}&${joined}`
            }
            let resp = await performBackendCall(url, "GET", null);
            return resp;
        }
        catch(e: any){
            throw new Error(`Failed to get app info from config management system. --- ${e.message}`)
        }
    }


    
    async setConfigs(configs: ConfigItem[]) {
        let url: string = '';
        try{
            url = `${this.configAddURLPrefix}`;
            if(configs && configs.length > 0){
                let resp = await performBackendCall(url, "POST", configs)
                return resp
            }
            else {
                throw new Error(`No configs provided for upload`)
            }
        }
        catch(e: any){
            throw new Error(`Failed to upload configs to config management system. --- ${e.message}`)
        }
    }
}