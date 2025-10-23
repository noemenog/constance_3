import { AccordionDetails, AccordionSummary, Autocomplete, Box, Divider, FormControlLabel, IconButton, Slide, Switch, TextField, Typography } from "@mui/material";
import { ChangeEvent, Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import { useDisclosure } from "@mantine/hooks";
import { ActionSceneEnum, UIMessageType, SPECIAL_RED_COLOR, EnvTypeEnum, SPECIAL_DARK_GOLD_COLOR, SPECIAL_BLUE_COLOR, ConfigContentTypeEnum } from "../../DataModels/Constants";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { BasicKVP, BasicProperty, PropertyItem, LoadingSpinnerInfo, LoggedInUser, MenuInfo, CDomainData, ConfigItem } from "../../DataModels/ServiceModels";
import { useCStore } from "../../DataModels/ZuStore";
import { handleLockAction } from "../../BizLogicUtilities/Permissions";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import AsciiTextComp from "../../CommonComponents/AsciiText";
import { AppInfo, Bucket } from "../../DataModels/ServiceModels";
import { getEnviList, rfdcCopy } from "../../BizLogicUtilities/UtilFunctions";
import EditorViewComponent, { EditorViewComponentRef } from "./EditorViewComponent";
import { addConfigs, deleteConfigs, getBucketList, getConfigList, updateConfigs } from "../../BizLogicUtilities/FetchData";
import TableViewComponent, {TableViewComponentRef} from "./TableViewComponent";
import ConfigModComp from "../../CommonComponents/ConfigModComp";
import MultiTextEntryDialog, { MultiTextEntryDialogProps } from "../../FormDialogs/MultiTextEntryDialog";
import ComparisonDialog, { ComparisonDialogProps } from "../../FormDialogs/ComparisonDialog";





interface BucketConfigContainerProps {
}

const BucketConfigContainer: React.FC<BucketConfigContainerProps> = () => {
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
    const initConfigs = useCStore((state) => state.initConfigs);
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment);
    const setSelectedEnvironment = useCStore((state) => state.setSelectedEnvironment);
    const selectedBucket = useCStore((state) => state.selectedBucket);
    const setSelectedBucket = useCStore((state) => state.setSelectedBucket);
    const jsonConfigViewEnabled = useCStore((state) => state.jsonConfigViewEnabled);
    const setJsonConfigViewEnabled = useCStore((state) => state.setJsonConfigViewEnabled);

    const [appInfo, setAppInfo] = useState<AppInfo>(appObj as AppInfo);
    const [bucketList, setBucketList] = useState<Bucket[]>(buckets);
    const [configList, setConfigList] = useState<ConfigItem[]>([]);

    
    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>();

    const [multiTextEntryModalState, multiTextEntryModalActioner] = useDisclosure(false);
    const [multiTextEntryDialogProps, setMultiTextEntryDialogProps] = useState<MultiTextEntryDialogProps>();

    const [comparisonModalState, comparisonModalActioner] = useDisclosure(false);
    const [comparisonDialogProps, setComparisonDialogProps] = useState<ComparisonDialogProps>();

    const{ env, appId, bucketId } = useParams()

    const containerRef = useRef<HTMLElement>(null);  //important!
    const tableViewComponentRef = useRef<TableViewComponentRef>(null);
    const editorViewComponentRef = useRef<EditorViewComponentRef>(null);


    const NEW_CONF_ID_PREFIX = "PENDING::"



    useEffect(() => {
        if(selectedBucket) {
            if(jsonConfigViewEnabled) {
                placePageTitle(`EditorDetailView`);
            }
            else {
                placePageTitle(`ConfigTableView`);
            }
        }
        else {
            placePageTitle("Configurations");
        }
    }, []);



    useEffect(() => {
        if(selectedEnvironment && selectedBucket && appInfo) {
            getConfigList(selectedEnvironment, appInfo._id?.toString() as string, selectedBucket?._id?.toString() as string).then((currentConfigs) => {
                setConfigList(currentConfigs)
            });
        }
    }, [selectedEnvironment, selectedBucket]);
    

    const envOptions : EnvTypeEnum[] = useMemo(() => {
        let appEnvList = getEnviList(appInfo)
        let res = appEnvList.envListRawFormatArray.map(x => (x as EnvTypeEnum));
        return res;
    }, [appInfo])


    function getAltTextContent() : string {
        if(!selectedBucket && (bucketList && bucketList.length > 0))
            return `Please select a bucket...`
        else {
            return `Project has no buckets...`
        }
    }


    const asciiContentCtx : {asciiInfo: any, mapKey: any} = useMemo(() => {
        let asciiInfo = new Map<string, number>([
            ['Doh', 3],
            ['Broadway KB', 9],
            ['Cybermedium', 9],
            ['Dot Matrix', 4]
        ])
        let quickRand = Math.floor(Math.random() * asciiInfo.size);
        let mapKey = [...asciiInfo.keys()].at(quickRand) as any
        return {asciiInfo: asciiInfo, mapKey: mapKey}
    }, []);



    function onEnvironmentSelectionChanged(env: string|null) {
        if (env && env.toString().length > 0) {
            //Warning - It is expected that user will never select an environment where the app does not exist
            setSelectedEnvironment(env as EnvTypeEnum);
            if(selectedBucket && selectedBucket._id) {
                let bucketEnvList = getEnviList(selectedBucket)
                if(bucketEnvList.envListRawFormatArray.includes(env)) {
                    navigate(`/${ActionSceneEnum.CONFIGURATIONS}/${appInfo._id.toString()}/${env}/${selectedBucket._id.toString()}`, {replace: true} ); 
                    displayQuickMessage(UIMessageType.INFO_MSG, `Environment changed to '${env}'. Selected bucket: '${selectedBucket.name}' is available in the selected environment.`);
                }
                else {
                    setSelectedBucket(null);
                    navigate(`/${ActionSceneEnum.CONFIGURATIONS}/${appInfo._id.toString()}/${env}`, {replace: true} ); 
                    displayQuickMessage(UIMessageType.INFO_MSG, `Environment changed to '${env}'. Please select a bucket to view configurations.`);
                }
            }
        }
    }


    function onBucketSelectionChanged(bucket: Bucket|null) {
        if(selectedEnvironment && bucket) {
            setSelectedBucket(bucket);
            // navigate(`/${ActionSceneEnum.CONFIGS}/${selectedEnvironment}/${appInfo._id.toString()}/${bucket._id.toString()}`, {replace: true} ); 
        }
    }


    function onJSONConfigViewEnabled(checked: boolean): void {
        setJsonConfigViewEnabled(checked);
    }



    // const handleSelectionChange = (count: number) => {
    //     // setSelectedCount(count);
    // };



    //-----------------------------------------------------------

    async function onSaveAction() {
        let selectedConfigs = new Array<ConfigItem>();
        if(selectedEnvironment && selectedEnvironment.length > 0 && appInfo && appInfo._id && appInfo._id.toString().length > 0) {
            if(selectedBucket && selectedBucket._id && selectedBucket._id.toString().length > 0 && configList && configList.length > 0) {
                if(jsonConfigViewEnabled === true) {
                    selectedConfigs = getEditorViewConfigList(true);
                }
                else {
                    selectedConfigs = getTableViewSelectedRows(true, true);
                }

                if(selectedConfigs && selectedConfigs.length > 0) {
                    let newAdders = selectedConfigs.filter(x => x._id.toString().startsWith(NEW_CONF_ID_PREFIX));
                    let updItems = selectedConfigs.filter(x => (x._id.toString().startsWith(NEW_CONF_ID_PREFIX) === false));
                    let doRefresh = false;
                    if(updItems && updItems.length > 0) {
                        setLoadingSpinnerCtx({enabled: true, text: "Now updating existing configs. Please wait..."} as LoadingSpinnerInfo)
                        let updatedConfigs = await updateConfigs(selectedEnvironment as EnvTypeEnum, selectedConfigs).finally(() => { cancelLoadingSpinnerCtx() });
                        if(updatedConfigs && updatedConfigs.length > 0) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `${updatedConfigs.length} configuration(s) were successfully updated.`);
                            doRefresh = true;
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Configurations were not updated successfully.");
                        }
                    }

                    if(newAdders && newAdders.length > 0) {
                        setLoadingSpinnerCtx({enabled: true, text: "Now adding new configs. Please wait..."} as LoadingSpinnerInfo)
                        let addedConfigs = await addConfigs(selectedEnvironment as EnvTypeEnum, newAdders).finally(() => { cancelLoadingSpinnerCtx() });
                        if(addedConfigs && addedConfigs.length > 0) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `${addedConfigs.length} configuration(s) were successfully added.`);
                            doRefresh = true;
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Configurations were not added successfully.");
                        }
                    }

                    if(doRefresh === true) {
                        setLoadingSpinnerCtx({enabled: true, text: "Now refreshing config list. Please wait..."} as LoadingSpinnerInfo)
                        getConfigList(selectedEnvironment as EnvTypeEnum, appInfo._id?.toString() as string, selectedBucket?._id.toString() as string).then((confList) => {
                            if(confList) {
                                setConfigList(confList);
                            }
                            else {
                                displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to successfully refresh list of configurations.");
                            }
                        })
                        .finally(() => {
                            setLoadingSpinnerCtx({enabled: false, text: ``})
                        })
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, "No configurations were selected for the intended action.");
                }
            }
        }
    }


    
    async function onAddAction() {
        if(selectedEnvironment && selectedEnvironment.length > 0 && appInfo && appInfo._id && appInfo._id.toString().length > 0) {
            if(selectedBucket && selectedBucket._id && selectedBucket._id.toString().length > 0) {

                let newConf : ConfigItem = {
                    _id: NEW_CONF_ID_PREFIX + crypto.randomUUID(), //important. do not change formating
                    ownerElementId: appInfo._id?.toString() as string,
                    contextProperties: [],
                    lastUpdatedOn: new Date(),
                    name: "",
                    value: "",
                    bucketId: selectedBucket?._id.toString() as string,
                    description: "",
                    contentType: ConfigContentTypeEnum.JSON,
                    createdOn: new Date(),
                    createdBy: loggedInUser.email,
                    associatedProperties: []
                }

                let existingConfigs = rfdcCopy<ConfigItem[]>(configList) as ConfigItem[];
                let newConfigList = [newConf, ...existingConfigs];
                setConfigList(newConfigList);
            }
        }
    }

    
    async function onMoveAction(targetBucketId: string|null) {
        if(selectedEnvironment && selectedEnvironment.length > 0 && appInfo && appInfo._id && appInfo._id.toString().length > 0) {
            if(selectedBucket && selectedBucket._id && selectedBucket._id.toString().length > 0 && configList && configList.length > 0) {
                let bucket : Bucket|null = null;
                let buckMap = new Map(bucketList.map(a => [a._id.toString() as string, a]));
                let otherBucketOptions = bucketList.filter(x => (x._id?.toString() as string) !== (selectedBucket?._id?.toString() as string)).map(k => k.name) as string[];
                if(otherBucketOptions && otherBucketOptions.length > 0) {
                    let selectedConfigs = getTableViewSelectedRows(false) ?? []
                    if(selectedConfigs.length > 0) {
                        let currConfIdList = configList.map(c => c._id.toString() as string)
                        if(selectedConfigs.some(x => !x._id || x._id.length === 0 || (currConfIdList.includes(x._id.toString() as string) === false))) {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Newly added configs cannot be moved. Please save them first before attempting to move them.");
                            return;
                        }
                        if(targetBucketId && targetBucketId.length > 0) {
                            bucket = buckMap.get(targetBucketId) ?? null
                            if(bucket && bucket._id) {
                                let gic : GeneralInfoUIContext = {
                                    contextualInfo: {key: "MOVE_CONFIGS", value: selectedConfigs},
                                    selection: bucket.name
                                }
                                onGenInfoDataAvailable(gic);
                            }
                            else {
                                displayQuickMessage(UIMessageType.ERROR_MSG, "Specified target bucket is invalid.");
                            }
                        }
                        else {
                            let confirmDialogProps: GeneralInfoDialogProps = {
                                onFormClosed: onGenInfoDataAvailable,
                                title: "Select Target Bucket",
                                warningText: `Please select the target bucket where the configs should be moved to.`,
                                showSelectionCtrl: true,
                                selectionDefaultValue: otherBucketOptions[0],
                                selectionCtrlOptions: otherBucketOptions,
                                selectionLabel: "Target Bucket",
                                contextualInfo: { key: "MOVE_CONFIGS", value: selectedConfigs }
                            }
                            setGeneralInfoDialogProps(confirmDialogProps)
                            generalInfoModalActioner.open()
                        }
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "No configs selected for moving.");
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, "No other buckets exist. Configs cannot be relocated.");
                }
            }
        }
    }


    async function onCopyAction(targetBucketId: string|null) {
         if(selectedEnvironment && selectedEnvironment.length > 0 && appInfo && appInfo._id && appInfo._id.toString().length > 0) {
            if(selectedBucket && selectedBucket._id && selectedBucket._id.toString().length > 0 && configList && configList.length > 0) {
                let bucket : Bucket|null = null;
                let buckMap = new Map(bucketList.map(a => [a._id.toString() as string, a]));
                let otherBucketOptions = bucketList.filter(x => (x._id?.toString() as string) !== (selectedBucket?._id?.toString() as string)).map(k => k.name) as string[];
                if(otherBucketOptions && otherBucketOptions.length > 0) {
                    let selectedConfigs = getTableViewSelectedRows(false) ?? []
                    if(selectedConfigs.length > 0) {
                        let currConfIdList = configList.map(c => c._id.toString() as string)
                        if(selectedConfigs.some(x => !x._id || x._id.length === 0 || (currConfIdList.includes(x._id.toString() as string) === false))) {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Newly added configs cannot be copied. Please save them first before attempting to copy them.");
                            return;
                        }
                        if(targetBucketId && targetBucketId.length > 0) {
                            bucket = buckMap.get(targetBucketId) ?? null
                            if(bucket && bucket._id) {
                                let gic : GeneralInfoUIContext = {
                                    contextualInfo: {key: "COPY_CONFIGS", value: selectedConfigs},
                                    selection: bucket.name
                                }
                                onGenInfoDataAvailable(gic);
                            }
                            else {
                                displayQuickMessage(UIMessageType.ERROR_MSG, "Specified target bucket is invalid.");
                            }
                        }
                        else {
                            let confirmDialogProps: GeneralInfoDialogProps = {
                                onFormClosed: onGenInfoDataAvailable,
                                title: "Select Target Bucket",
                                warningText: `Please select the target bucket where the configs should be copied over to.`,
                                showSelectionCtrl: true,
                                selectionDefaultValue: otherBucketOptions[0],
                                selectionCtrlOptions: otherBucketOptions,
                                selectionLabel: "Target Bucket",
                                contextualInfo: { key: "COPY_CONFIGS", value: selectedConfigs }
                            }
                            setGeneralInfoDialogProps(confirmDialogProps)
                            generalInfoModalActioner.open()
                        }
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "No configs selected for copying.");
                    }
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, "No other buckets exist. Configs could not be copied over to another bucket.");
                }
            }
        }
    }

    
    async function onDeleteAction() {
         if(selectedEnvironment && selectedEnvironment.length > 0 && appInfo && appInfo._id && appInfo._id.toString().length > 0) {
            if(selectedBucket && selectedBucket._id && selectedBucket._id.toString().length > 0 && configList && configList.length > 0) {
                if(jsonConfigViewEnabled === false) {
                    let selectedConfigs = getTableViewSelectedRows(false) ?? [];
                    if(selectedConfigs.length > 0) {
                        let confIdStrList = configList.map(x => x._id.toString() as string)
                        let backendDelConfigs = selectedConfigs.filter(x => x._id && (x._id.length > 0) && confIdStrList.includes(x._id.toString() as string)) ?? []; 
                        let plainDelConfigs = selectedConfigs.filter(x => !x._id || x._id.length === 0 || !confIdStrList.includes(x._id.toString() as string)) ?? []; 
                        
                        let appDeleteConfirmData: ConfirmationDialogProps = {
                            onFormClosed: onConfirmationDataAvailable,
                            title: "Please Confirm",
                            warningText_main: `Please confirm deletion of configuration items`,
                            warningText_other: `WARNING: Configs might not be recoverable after deletion. Are you sure you want to completely delete selected configs?`,
                            actionButtonText: "Proceed",
                            contextualInfo: { key: "DELETE_CONFIGS", value: {beDel: backendDelConfigs, plainDel: plainDelConfigs} },
                        }
                        setConfirmationDialogProps(appDeleteConfirmData)
                        confirmationModalActioner.open()
                    } 
                }
            }
        }
    }


    async function onCompareAction(targetEnv: string|null) {
        let selectedConfigs = new Array<ConfigItem>();
        if(selectedEnvironment && selectedEnvironment.length > 0 && appInfo && appInfo._id && appInfo._id.toString().length > 0) {
            if(selectedBucket && selectedBucket._id && selectedBucket._id.toString().length > 0 && configList && configList.length > 0) {
                if(jsonConfigViewEnabled === true) {
                    selectedConfigs = getEditorViewConfigList(false);
                }
                else {
                    selectedConfigs = getTableViewSelectedRows(true, false);
                }

                if(selectedConfigs && selectedConfigs.length > 0) {
                    let cmpDialogProps: ComparisonDialogProps = {
                        onFormClosed: onMultiTextEntryDataAvailable,
                        title: "Compare Configuration Items",
                        subtitle: "",
                        contextualInfo: { key: "COMPARE_CONFIGS", value: selectedConfigs },
                    }
                    setComparisonDialogProps(cmpDialogProps)
                    comparisonModalActioner.open()
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, "No configurations were selected for the intended action.");
                }
            }
        }
    }


    async function onLockAction(): Promise<void> {
        let updatedApp = await handleLockAction(appInfo, loggedInUser)
        if(updatedApp && updatedApp._id) {
            setAppInfo(updatedApp);
        }
    }



    async function onSearchFieldTextChange(event: any) {
        throw new Error("Function not implemented.");
    }


    
    function onMultiTextEntryDataAvailable(contextualInfo: BasicKVP): void {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo.key === "ADD_CONFIGS") {
                let newNames = contextualInfo.value as Set<string>;
                if(newNames && newNames.size > 0) {
                    let newConfigList = new Array<ConfigItem>();
                    for(let name of newNames) {
                        let newConf : ConfigItem = {
                            _id: crypto.randomUUID(),
                            ownerElementId: appInfo._id?.toString() as string,
                            contextProperties: [],
                            lastUpdatedOn: new Date(),
                            name: name,
                            value: "",
                            bucketId: selectedBucket?._id.toString() as string,
                            description: "",
                            contentType: ConfigContentTypeEnum.JSON,
                            createdOn: new Date(),
                            createdBy: loggedInUser.email,
                            associatedProperties: []
                        }
                        newConfigList.push(newConf);
                    }

                    
                    let finalNewConfigs = rfdcCopy<ConfigItem[]>([...configList, ...newConfigList]) as ConfigItem[];
                    setConfigList(finalNewConfigs);
                    
                    displayQuickMessage(UIMessageType.INFO_MSG, `Configuration(s) are set in place. Please Add description and value as necessary then hit SAVE button to submit`, 6000);

                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, "No new names were specified for the intended action.");
                }
            }
        }
    }


    
    async function onConfirmationDataAvailable(proceed: ConfirmationDialogActionType, contextualInfo: any): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(proceed === ConfirmationDialogActionType.PROCEED) {
                if(contextualInfo.key === "DELETE_CONFIGS") {
                    let beDelConfigs = (contextualInfo?.value.beDel as ConfigItem[]) ?? [];
                    let plainDelConfigs = (contextualInfo?.value.plainDel as ConfigItem[]) ?? [];

                    if(plainDelConfigs.length === 0 && beDelConfigs.length === 0) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, "No configurations were selected for intended action.");
                        return;
                    }
                    
                    if(beDelConfigs.length > 0) {
                        setLoadingSpinnerCtx({enabled: true, text: "Now deleting configs. Please wait..."} as LoadingSpinnerInfo)
                        let beDelRes = await deleteConfigs(selectedEnvironment as EnvTypeEnum, beDelConfigs).finally(() => { setLoadingSpinnerCtx({enabled: false, text: ``}) });
                        if(beDelRes === true) {
                            let existingConfigs = rfdcCopy<ConfigItem[]>(configList) as ConfigItem[];
                            let plainDelIds = plainDelConfigs?.map(x => x._id.toString() as string) ?? [];
                            let beDelIds = beDelConfigs?.map(x => x._id.toString() as string) ?? [];
                            let allDelIds = [...plainDelIds, ...beDelIds];
                            let updConfigList = existingConfigs.filter(x => (allDelIds.includes(x._id.toString()) === false));
                            setConfigList(updConfigList);
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Configuration(s) were successfully deleted.`);
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Configurations were not deleted successfully.");
                        }                        
                    }
                    else if (plainDelConfigs.length > 0){
                        let existingConfigs = rfdcCopy<ConfigItem[]>(configList) as ConfigItem[];
                        let plainDelIds = plainDelConfigs?.map(x => x._id.toString() as string) ?? [];
                        let updConfigList = existingConfigs.filter(x => (plainDelIds.includes(x._id.toString()) === false));
                        setConfigList(updConfigList);
                        displayQuickMessage(UIMessageType.ERROR_MSG, "No configurations were selected for intended action.");
                    }
                }
            }
        }
    }
    

        
    async function onGenInfoDataAvailable(data: GeneralInfoUIContext | null): Promise<void> {
        if(data && data.contextualInfo) {
            if(data.contextualInfo.key === "MOVE_CONFIGS") {
                let targetBucket = bucketList.find(x => x.name.toUpperCase().trim() === (data.selection?.toUpperCase()?.trim() ?? ""));
                let selectedConfigs = data.contextualInfo?.value ?? [];
                if(targetBucket && targetBucket._id) {
                    setLoadingSpinnerCtx({enabled: true, text: "Now moving configs to target bucket. Please wait..."} as LoadingSpinnerInfo)
                    selectedConfigs.forEach((element: ConfigItem) => {
                        element.bucketId = targetBucket?._id?.toString() as string;
                    })
                    updateConfigs(selectedEnvironment as EnvTypeEnum, selectedConfigs).then((updateConfigs) => {
                        if(updateConfigs && updateConfigs.length > 0) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Configuration(s) were successfully moved at ${selectedEnvironment} environment.`);
                            setLoadingSpinnerCtx({enabled: true, text: "Now retrieving updated configs. Please wait..."} as LoadingSpinnerInfo)
                            getConfigList(selectedEnvironment as EnvTypeEnum, appInfo._id?.toString() as string, targetBucket?._id.toString() as string).then((confList) => {
                                if(confList) {
                                    setConfigList(confList);
                                }
                                else {
                                    displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to successfully refresh list of configurations.");
                                }
                            })
                            .finally(() => {
                                setLoadingSpinnerCtx({enabled: false, text: ``})
                            })
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Configurations were not moved successfully.");
                        }
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``})
                    })
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, "No configurations were selected for intended action.");
                }
            }
            else if(data.contextualInfo.key === "COPY_CONFIGS") {
                let targetBucket = bucketList.find(x => x.name.toUpperCase().trim() === (data.selection?.toUpperCase()?.trim() ?? ""));
                let selectedConfigs = rfdcCopy<ConfigItem[]>(data.contextualInfo?.value ?? []) as ConfigItem[];
                if(targetBucket && targetBucket._id) {
                    setLoadingSpinnerCtx({enabled: true, text: "Now moving configs to target bucket. Please wait..."} as LoadingSpinnerInfo)
                    selectedConfigs.forEach((element: ConfigItem) => {
                        element._id = crypto.randomUUID();
                        element.bucketId = targetBucket?._id?.toString() as string;
                    })
                    addConfigs(selectedEnvironment as EnvTypeEnum, selectedConfigs).then((copiedOverConfigs) => {
                        if(copiedOverConfigs && copiedOverConfigs.length > 0) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, `Configuration(s) were successfully copied at ${selectedEnvironment} environment to '${targetBucket.name}' bucket.`);
                            setLoadingSpinnerCtx({enabled: true, text: "Now retrieving updated configs. Please wait..."} as LoadingSpinnerInfo)
                            getConfigList(selectedEnvironment as EnvTypeEnum, appInfo._id?.toString() as string, targetBucket?._id.toString() as string).then((confList) => {
                                if(confList) {
                                    setConfigList(confList);
                                }
                                else {
                                    displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to successfully refresh list of configurations.");
                                }
                            })
                            .finally(() => {
                                setLoadingSpinnerCtx({enabled: false, text: ``})
                            })
                        }
                        else {
                            displayQuickMessage(UIMessageType.ERROR_MSG, "Configurations were not copied successfully.");
                        }
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``})
                    })
                }
                else {
                    displayQuickMessage(UIMessageType.ERROR_MSG, "No configurations were selected for intended action.");
                }
            }
        }
    }
    
    

    function getTableViewSelectedRows(defaultToSelectAll: boolean, forceGetCompleteValidDataOrGetNone: boolean = false): ConfigItem[]{
        let confItems: ConfigItem[] = [];
        if (tableViewComponentRef.current) {
            confItems = tableViewComponentRef.current.getSelectedRows(defaultToSelectAll, forceGetCompleteValidDataOrGetNone) ?? [];
        }
        return confItems
    };


    
    function getEditorViewConfigList(modifiedItemsOnly: boolean): ConfigItem[]{
        let confItems: ConfigItem[] = [];
        if (editorViewComponentRef.current) {
            confItems = editorViewComponentRef.current.getConfigsListWithModifications(modifiedItemsOnly) ?? [];
        }
        return confItems
    };





    return (
        <Box>
            <Box minWidth={1200}> 
                <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "left", alignItems: "left" }}>
                
                    <Box  height={50} sx={{ overflow: 'hidden', justifyContent: "center", display: "flex", flexDirection:"row", ml: 1 }} ref={containerRef}>
                        <Box flexDirection="row" display="flex" alignItems="center" sx={{  width:"100%", m: 0}}>
                            <Autocomplete 
                                value={selectedEnvironment ?? ""}
                                onChange={(event, value) => { onEnvironmentSelectionChanged(value as string); }}
                                key="env-sel-cb"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="env-sel-cb"
                                sx={{ mt:.7, minWidth: 220, borderColor: SPECIAL_DARK_GOLD_COLOR }}
                                options={envOptions}
                                renderInput={(params) => <TextField {...params} label="Select Environment" size="small" sx={{ fieldset : { borderColor: SPECIAL_DARK_GOLD_COLOR } }}/>}
                            /> 

                            <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 4 }} />
                            </Slide>

                            <Autocomplete<Bucket>
                                value={selectedBucket}
                                onChange={(event, value, reason, details) => onBucketSelectionChanged(value)}
                                key="bk-sel-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                disabled={(selectedEnvironment && selectedEnvironment.length > 0) ? false : true}
                                size="small"
                                id="bk-sel-cb"
                                sx={{ mt:.7, minWidth: 300, }}
                                options={bucketList}
                                getOptionLabel={(option) => option.name} //Important!
                                renderInput={(params) => <TextField {...params} label="Source Bucket" size="small" />}
                            />

                            <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 4, marginRight: 6 }} />
                            </Slide>

                            <Box sx={{ ml:1, padding: 0, maxHeight: 33, mb: .3, border:1, borderRadius: 1, minWidth: 100, borderColor: colors.grey[400]}}>
                                <FormControlLabel control={
                                    <Switch size="small"
                                        sx={{ ml: 2.5 }}
                                        checked={jsonConfigViewEnabled}
                                        onChange={(event, checked) => onJSONConfigViewEnabled(checked) }
                                        inputProps={{ 'aria-label': 'document view switch' }}
                                        disabled={(selectedBucket && selectedBucket._id) ? false : true}
                                    />
                                } label="Json" />
                            </Box>

                        </Box>
                    </Box>
  
                    <Divider sx={{ width: "100%",marginLeft: 0, marginRight: 0 }} />

                </Box>
                
                {(selectedBucket)
                ? (
                    <Box sx={{mt:1}}>
                        <Box ref={containerRef} flexDirection="column" alignItems="left" justifyContent="left">
                            <ConfigModComp 
                                    appInfo={appInfo}
                                    disableConfigDependentActions={(configList && configList.length > 0) ? false : true}
                                    disableConfigPlacementControls={(jsonConfigViewEnabled === true) ? true : false}
                                    onSaveAction={onSaveAction}
                                    onDeleteAction={onDeleteAction}
                                    onCompareAction={onCompareAction}
                                    onLockAction={onLockAction}
                                    onMoveAction={onMoveAction}
                                    onCopyAction={onCopyAction}
                                    onAddAction={onAddAction}
                                    onSearchFieldTextChange={onSearchFieldTextChange} />
                        </Box>
                        { (jsonConfigViewEnabled === true) 
                            ? <EditorViewComponent
                                ref={editorViewComponentRef}
                                currentConfigs={configList} />

                            : <TableViewComponent
                                ref={tableViewComponentRef}
                                currentConfigs={configList}
                                onSaveAction={onSaveAction}
                                onDeleteAction={onDeleteAction}
                                onCompareAction={onCompareAction}
                                onMoveAction={onMoveAction}
                                onCopyAction={onCopyAction}
                                onAddAction={onAddAction} /> 
                        }
                    </Box>
                )
                : <Box sx={{mt:20, ml: 5}}>
                    <AsciiTextComp 
                        text={getAltTextContent()} 
                        font={asciiContentCtx.mapKey} 
                        fontSize={asciiContentCtx.asciiInfo.get(asciiContentCtx.mapKey) as number}>
                    </AsciiTextComp>
                </Box>}
            </Box>
            
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}
            {multiTextEntryModalState && <MultiTextEntryDialog opened={multiTextEntryModalState} close={multiTextEntryModalActioner.close} {...multiTextEntryDialogProps as MultiTextEntryDialogProps} />}
            {comparisonModalState && <ComparisonDialog opened={comparisonModalState} close={comparisonModalActioner.close} {...comparisonDialogProps as ComparisonDialogProps} />}           
        </Box>
    )
}

export default BucketConfigContainer









                // let mteDialogProps: MultiTextEntryDialogProps = {
                //     onFormClosed: onMultiTextEntryDataAvailable,
                //     title: "Add New Configs",
                //     warningText: `Please specify name(s) for new configuration items (comma separated).`,
                //     textArrayLabel: "New Config Names (comma separated)",
                //     textArrayProhibitedValues: configList?.map(x => x.name) ?? [],
                //     textArrayInputMinWidth: 100,
                //     contextualInfo: { key: "ADD_CONFIGS", value: null }
                // }
                // setMultiTextEntryDialogProps(mteDialogProps)
                // multiTextEntryModalActioner.open()





// let confirmDialogProps: ConfirmationDialogProps = {
//                 onFormClosed: onGenInfoDataAvailable,
//                 title: "Delete Configurations",
//                 textMainLabel: "Specify App Name", 
//                 largeTextLabel: "Specify App Description",
//                 largeTextAreaMinCharLength: 15,
//                 largeTextAreaValueRequired: true,
//                 showSelectionCtrl: true,
//                 selec: true,
//                 contextualInfo: { key: "DELETE_CONFIGS", value: null }
//             }
//             setGeneralInfoDialogProps(confirmDialogProps)
//             generalInfoModalActioner.open()



    // const enableAdd = (state.app && state.bucket && state.bucket.name.length > 0) && (dialogOpen === false) ? true : false;
    // const enableSave = (state.configs && state.configs.length > 0) && (dialogOpen === false);
    // const enableDelete = (state.configs && state.configs.length > 0) && (dialogOpen === false);
    // const enableCompare = (state.configs && state.configs.length > 0) && (dialogOpen === false);
    // const enableContextMenuCompare = state.configs && state.configs.length > 0;
    
    





    
    
    // function processConfigAdd(configs: ConfigItem[] | null) {
    //     if (configs) {
    //         // configs = formatConfigValue(configs)
    //         // addConfigs(context.env, configs).then((confArray: ConfigItem[]) => {
    //         //     if(confArray && context.bucket && context.bucket._id.length > 0){
    //         //         if(context.refreshConfigList) {
    //         //             context.refreshConfigList(context.env, context.app, context.bucket)
    //         //         }
    //         //     }
    //         //     displayUIMessage(context, UIMessageType.SUCCESS_MSG, "Config Successfully Added!");
    //         // });
    //     }
    // }

    // function processConfigSave(configs: ConfigItem[]) {
    //     if (configs) {
    //         // updateConfigs(context.env, configs).then((confArray: ConfigItem[]) => {
    //         //     if(confArray){
    //         //         context.refreshConfigList(context.env, context.app, context.bucket, confArray)
    //         //         displayUIMessage(context, UIMessageType.SUCCESS_MSG, "Configs Successfully Saved!");
    //         //     }
    //         //     else{
    //         //         displayUIMessage(context, UIMessageType.ERROR_MSG, "Configs were not updated!");
    //         //     }
    //         // });
    //     }
    // }

    // function processConfigDelete(configs: ConfigItem[]) {
    //     if (configs) {
    //         // deleteConfigs(context.env, configs).then((res: boolean) => {
    //         //     if (res === true) {
    //         //         context.refreshConfigList(context.env, context.app, context.bucket)
    //         //         displayUIMessage(context, UIMessageType.SUCCESS_MSG, "Config deleted successfully!");
    //         //     }
    //         //     else {
    //         //         displayUIMessage(context, UIMessageType.ERROR_MSG, "Config deletion was not successful!");
    //         //     }
    //         //     return res;
    //         // });
    //     }
    // }
    
    
    // async function processCompareAction(targetEnv: string) { 
    //     // let compareBucketPerm = CheckUserHasPermissionsForBucket(state.loggedInUser, targetEnv, state.app, state.bucket, [PermCategoryType.ADMIN, PermCategoryType.READ_WRITE, PermCategoryType.READ_ONLY], true)
    //     // if(compareBucketPerm) {
    //     //     const selected = getSelectedRowData(true);
    //     //     let compData: ConfigItem[] = await processCompareInfoRetrieval(targetEnv, selected, state.app, state.bucket, state);
            
    //     //     setCurrentEnvComparisonData([...selected]);
    //     //     setOtherEnvComparisonData([...compData]);
            
    //     //     setComparisonTargetEnv(targetEnv);
    //     //     setCompareDialogOpen(true);
    //     // }
    // }







    
    // function onEnvironmentSelectionChanged(env: string|null) {
    //     if (env && env.toString().length > 0) {
    //         //Warning - It is expecgted that user will never select an environment where the app does not exist
    //         setSelectedEnvironment(env as EnvTypeEnum);

    //         if(selectedBucket && selectedBucket._id) {
    //             let bucketEnvList = getEnviList(selectedBucket)
    //             if(bucketEnvList.envListRawFormatArray.includes(env)) {
    //                 navigate(`/${ActionSceneEnum.CONFIGS}/${env}/${appInfo._id.toString()}/${selectedBucket._id.toString()}`, {replace: true} ); 
    //             }
    //             else {
    //                 setSelectedBucket(null);
    //                 navigate(`/${ActionSceneEnum.CONFIGS}/${env}/${appInfo._id.toString()}`, {replace: true} ); 
    //             }
    //         }


    //         // getBucketList(env as EnvTypeEnum, appInfo._id.toString()).then((bucks) => {
    //         //     if(bucks) {
    //         //         setBucketList(bucks);
    //         //         if(selectedBucket && selectedBucket._id && bucks.some(a => a._id.toString().trim() === selectedBucket._id.toString())) {
    //         //             let bucketEnvList = getEnviList(selectedBucket)
    //         //             if(bucketEnvList.envListRawStr.includes(env)) {
    //         //                 navigate(`/${ActionSceneEnum.CONFIGS}/${env}/${appInfo._id.toString()}/${selectedBucket._id.toString()}`); 
    //         //             }
    //         //             else {
    //         //                 setSelectedBucket(null);
    //         //                 setConfigList([]);
    //         //                 navigate(`/${ActionSceneEnum.CONFIGS}/${env}/${appInfo._id.toString()}`); 
    //         //             }
    //         //         }
    //         //         else {
    //         //             setConfigList([]);
    //         //             setSelectedBucket(null);
    //         //             navigate(`/${ActionSceneEnum.CONFIGS}/${env}/${appInfo._id.toString()}`); 
    //         //         }
    //         //     }
    //         //     else {
    //         //         //No buckets for selected app
    //         //         setBucketList([]);
    //         //         setConfigList([]);
    //         //         setSelectedBucket(null);
    //         //         navigate(`/${ActionSceneEnum.CONFIGS}/${env}/${appInfo._id.toString()}`); 
    //         //         displayQuickMessage(UIMessageType.INFO_MSG, `App '${appInfo.name}' has no buckets in selected environment '${env}'.`);
    //         //     }
    //         // }); 
    //     }
    // }






    
    // function getSubMenuItems() : Array<MenuInfo> {
    //     let menuArr = new Array<MenuInfo>();
        
    //     menuArr.push({
    //         label: "Delete Selected Configs",
    //         icon: <DeleteForeverOutlined />,
    //         callbackAction: (kvp: BasicKVP) => { }
    //     });

    //     menuArr.push({
    //         label: "Copy Selected Configs to Another Bucket",
    //         icon: <CopyAllOutlined />,
    //         callbackAction: (kvp: BasicKVP) => { }
    //     });

    //     menuArr.push({
    //         label: "Move Selected Configs to Another Bucket",
    //         icon: <DriveFileMoveOutlined />,
    //         callbackAction: (kvp: BasicKVP) => { }
    //     });

    //     menuArr.push({
    //         label: "Compare Bucket Configs",
    //         icon: <CompareOutlined />,
    //         callbackAction: (kvp: BasicKVP) => { }
    //     });

    //     menuArr.push({
    //         label: (appInfo && appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock App`: `Lock App`,
    //         icon: (appInfo && appInfo.lockedBy && appInfo.lockedBy.length > 0)
    //             ? <LockOutlined fontSize="large" sx={{ color: SPECIAL_RED_COLOR}} />
    //             : <LockOpenOutlined fontSize="large" color="secondary"/>,
    //         callbackAction: (kvp: BasicKVP) => { handleAppLockAndUnlockAction() }
    //     });

    //     return menuArr;
    // }


