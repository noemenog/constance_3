import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, Typography } from "@mui/material";
import { useContext, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import { editor } from 'monaco-editor';
import { useCStore } from "../../DataModels/ZuStore";
import { AppInfo, Bucket, CDomainData, ConfigItem, LoadingSpinnerInfo, LoggedInUser } from "../../DataModels/ServiceModels";
import GeneralInfoDialog, { GeneralInfoDialogProps } from "../../FormDialogs/GeneralInfoDialog";
import { useDisclosure } from "@mantine/hooks";
import ConfirmationDialog, { ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { ConfigContentTypeEnum, MIN_DESCRIPTION_LENGTH, NamingContentTypeEnum } from "../../DataModels/Constants";
import { getEnumValuesAsArray, getEnumValuesAsMap, validateConfigValueAndType, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useNavigate } from "react-router-dom";
import EditorComp from "../../CommonComponents/EditorComp";



interface EditorCompProps {
    currentConfigs: ConfigItem[],
    darkMode?: boolean,
    disableMiniMap?: boolean,
    editorContentLanguage?: string,
}

interface EditorViewComponentRef {
    getConfigsListWithModifications: (modifiedItemsOnly: boolean) => ConfigItem[];
}

const EditorViewComponent = forwardRef<EditorViewComponentRef, EditorCompProps>(({ currentConfigs, darkMode = true, disableMiniMap = false, editorContentLanguage = 'json' }, ref) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as CDomainData;
    const appObj = domainData.appInfo;
    const buckets = domainData.bucketList ?? [];
    
    
    const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useCStore((state) => state.setIsLoadingBackdropEnabled);
    const placePageTitle = useCStore((state) => state.placePageTitle);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);

    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
        
    const [configList, setConfigList] = useState<ConfigItem[]>(currentConfigs);

    const editorRef = useRef<null|editor.IStandaloneCodeEditor>(null);

    const colorMode: string = darkMode ? "vs-dark" : "light";


    
    useImperativeHandle(ref, () => ({
        getConfigsListWithModifications(modifiedItemsOnly) {
            return getEditorViewConfigItems(modifiedItemsOnly);
        }
    }));


    useEffect(() => {
        placePageTitle("Configs")
    }, []);



    async function onValidateAndSaveConfigChanges() {
        if (editorRef?.current) {
            let editorValue = (editorRef?.current as editor.IStandaloneCodeEditor).getValue();
            if(editorValue && editorValue.length > 0) {
                let confDataArr: ConfigItem[] = new Array<ConfigItem>();
                if (editorValue && editorValue.length > 0) {
                    try{
                        confDataArr = JSON.parse(editorValue) as ConfigItem[];
                    }
                    catch(e: any){
                        let msg = "Editor content is not in the expected format. Each configuration entity must adhere to expected formatting!";
                        let errConfirmDlgProps: ConfirmationDialogProps = {
                            onFormClosed: (action, contextualInfo) => {},
                            title: "Error!",
                            warningText_main: `Error! Invalid data format`,
                            warningText_other: `${msg}`,
                            actionButtonText: "Ok",
                            contextualInfo: { key: "CONTENT_ERROR", value: null },
                        }
                        setConfirmationDialogProps(errConfirmDlgProps)
                        confirmationModalActioner.open()
                    }
                    
                    if(confDataArr.length > 0){
                        //let revData = convertInnerJsonToString(data);
                        const result = ValidateDataBeforeSave(confDataArr);
                        if (result === true) {
                            // updateConfigs(selectedEnvironment, confDataArr).then((confArray: ConfigItem[]) => {
                            //     if(confArray){
                            //         context.refreshConfigList(context.env, context.app, context.bucket, confArray)
                            //         displayUIMessage(context, UIMessageType.SUCCESS_MSG, "Configs Successfully Saved!");
                            //     }
                            //     else{
                            //         displayUIMessage(context, UIMessageType.ERROR_MSG, "Configs were not updated!");
                            //     }
                            // });
                            
                            // processConfigSave(confDataArr, state);
                        }
                    }
                }
            }
        }
    }


    function ValidateDataBeforeSave(validationConfigArr: ConfigItem[]): boolean {
        if (configList && configList.length > 0 && validationConfigArr && validationConfigArr.length > 0) {
            let msg = '';
            try {
                let valTypes: Map<string,string> = getEnumValuesAsMap(ConfigContentTypeEnum);
                
                let originalIDs: string[] = configList.map((x: ConfigItem, i: number) => x._id) ?? [];
                let currentIds: string[] = validationConfigArr.map((x: ConfigItem, i: number) => x._id) ?? [];
                let unique = [...new Set(currentIds)];
                
                if(unique.length !== currentIds.length) {
                    msg = 'Duplicate config item Ids are not allowed';
                    throw new Error(msg);
                }
    
                if(unique.length !== originalIDs.length){
                    msg = 'Error... Please ensure that no config item is deleted. Deletion is not currently supported on current view';
                    throw new Error(msg);
                }
    
                for (let item of validationConfigArr) {
                    if (originalIDs.includes(item._id) === false) {
                        msg = `Id field for one of the items has changed. Id change is not acceptable`;
                    }
                    else if (item.ownerElementId !== configList[0].ownerElementId) {
                        msg = `appId field for one of the items has changed. 'appId' change is not acceptable`;
                    }
                    else if (buckets && buckets.map((x: Bucket, i: Number) => x._id.toString()).includes(item.bucketId) === false) {
                        msg = `Bucket specified for config item '${item.name}' is unacceptable for the current app`;
                    }
                    else if (valTypes.has(item.contentType.toString().toUpperCase()) === false) {
                        msg = `The 'value-type' specified for config item name '${item.name}' is invalid`;
                    }
                    else if (validateConfigValueAndType(item.name, item.contentType) === false) {
                        msg = `Value specified for config item '${item.name}' is not a proper '${item.contentType}'`;
                    }
                    else if ((item.description && item.description.length > 15) === false) {
                        msg = `Description for config item '${item.name}' should have a minimum of ${MIN_DESCRIPTION_LENGTH} characters`
                    }
    
                    try {
                        verifyNaming([item.name], NamingContentTypeEnum.CONFIGITEM);
                    }
                    catch( e: any) {
                        msg = `Conf Naming error: ${e.message}`;
                    }

                    try {
                        verifyNaming([item.name], NamingContentTypeEnum.CONFIGITEM);
                    }
                    catch( e: any) {
                        msg = `Conf Naming error: ${e.message}`;
                    }

                    if(msg && msg.length > 0) {
                        throw new Error(msg);
                    }
                }
                return true;
    
            }
            catch (e: any) {
                let errConfirmDlgProps: ConfirmationDialogProps = {
                    onFormClosed: (action, contextualInfo) => {/* do nothing intentionally */},
                    title: "Error!",
                    warningText_main: `Error! Please revise editor content`,
                    warningText_other: `${msg}`,
                    actionButtonText: "Ok",
                    contextualInfo: { key: "CONTENT_ERROR", value: null },
                }
                setConfirmationDialogProps(errConfirmDlgProps)
                confirmationModalActioner.open()
            }
        }
    
        return false;
    }

    
    
    function getEditorViewConfigItems(modifiedItemsOnly: boolean): any {
        console.error("Function not implemented.");
    }




    return (
        <Box>
            <EditorComp darkMode={darkMode} disableMiniMap={disableMiniMap} editorContentLanguage={editorContentLanguage} editorContent={JSON.stringify(configList ?? [])} />
            
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            
        </Box>
    );
})


export default EditorViewComponent
export type { EditorViewComponentRef };
















/************************************************************************************* */





// <Box flexGrow={1}>                
//                 <Box height="100%">

//                     <Editor
//                         height="83vh"
//                         width="100%"
//                         theme={colorMode}
//                         defaultLanguage={editorContentLanguage}
//                         defaultValue={JSON.stringify([])}
//                         onChange={handleEditorChange}
//                         onMount={handleEditorDidMount}
//                         beforeMount={handleEditorWillMount}
//                         onValidate={handleEditorValidation}
//                         value={JSON.stringify(configs ?? [])}
//                     />

//                 </Box>
//             </Box>