import * as React from 'react';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, Checkbox, Divider, FormControlLabel, getOutlinedInputUtilityClass, ListItem, ListItemButton, ListItemIcon, ListItemText, Slide, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { CheckOutlined, CircleOutlined, LabelImportantOutlined, NavigateBeforeOutlined, NavigateNextOutlined, RadioButtonUncheckedOutlined } from '@mui/icons-material';
import { Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useFormState } from 'react-hook-form';
import { Modal, NumberInput, Stepper } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CONFIGITEM__Materials, CONFIGITEM__Separate_FrontSide_BackSide_Grouping, CONFIGITEM__Substrate_Technologies, SPECIAL_BLUE_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_RED_COLOR, STACKUP_ROUTING_DESIG_MIX, STACKUP_ROUTING_DESIG_NONE, STACKUP_ROUTING_DESIG_ROUTING, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { themeDarkBlue, tokens } from "../theme";
import { useSpiderStore } from '../DataModels/ZuStore';
import { BasicKVP, DisplayOption, LoadingSpinnerInfo } from '../DataModels/HelperModels';
import { PackageLayout, Project, StackupGenInfo, StackupLayer } from '../DataModels/ServiceModels';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, RowStyle } from 'ag-grid-community';
import SegmentedCtrlCellRenderer, { SegmentedCtrlCellRendererProps } from '../CommonComponents/SegmentedCtrlCellRenderer';
import { createStackup } from '../BizLogicUtilities/FetchData';
import { sort } from 'fast-sort';
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
import { SpButton } from '../CommonComponents/SimplePieces';



export interface SetupStackupWizardDialogProps {
    opened?: boolean,
    close?: () => void,
    title: string, 
    projectId: string,
    recScenarioExistingLayers: StackupLayer[],
    projectInterFaceCount: number,
    sourceDisplayOptions: DisplayOption[],
    pkgIdToStackupInfoMap: Map<string, [StackupGenInfo, StackupLayer[]]>,
    onGetStackupGridRowStyle: (params: any) => RowStyle | undefined,
    onFormClosed: (data: StackupGenInfo | null,) => void,
}

const SetupStackupWizardDialog: React.FC<SetupStackupWizardDialogProps> = ({ opened, close, title, projectId, recScenarioExistingLayers, 
    projectInterFaceCount, sourceDisplayOptions, pkgIdToStackupInfoMap, onGetStackupGridRowStyle, onFormClosed }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const initConfigs = useSpiderStore((state) => state.initConfigs);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled)
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);

    const [active, setActive] = useState(0);
    const [activeItemId, setActiveItemId] = useState(active);
    const [previousActiveItemId, setPreviousActiveItemId] = useState(active);
    const [highestStepVisited, setHighestStepVisited] = useState(active);
    const [steps, setSteps] = useState([
        {id: 0, label: "Technology", enabled: true},
        {id: 1, label: "Number of Layers", enabled: true},
        {id: 2, label: "Core Details", enabled: true},
        {id: 3, label: "Dielectric Details", enabled: true},
        {id: 4, label: "Solder Resist Details", enabled: true},
        {id: 5, label: "Metal Details", enabled: true},
        {id: 6, label: "Routing Layers", enabled: true},
        {id: 7, label: "Summary", enabled: true},
    ])
    
    const knownStackupTechnologyTypes = useMemo(() => { return getTechStacks(); }, [initConfigs]);
    const knownCoreMaterialTypes = useMemo(() => { return getMaterialsByType("core"); }, [initConfigs]);
    const knownDielectricMaterialTypes = useMemo(() => { return getMaterialsByType("dielectric"); }, [initConfigs]);
    const knownCorelessDielectricMaterialTypes = useMemo(() => { return getMaterialsByType("core"); }, [initConfigs]);
    const knownSolderResistMaterialTypes = useMemo(() => { return getMaterialsByType("sr"); }, [initConfigs]);
    const knownMetalTypes = useMemo(() => { return getMaterialsByType("metal"); }, [initConfigs]);
    const isFsBsSeparation = useMemo(() => { return getFSideBSideSeparationConfigValue(); }, [initConfigs]);

    const [techValue, setTechValue] = React.useState<string | null>(knownStackupTechnologyTypes.size > 0 ? [...knownStackupTechnologyTypes.keys()][0] : '');
    const [coreMaterial, setCoreMaterial] = React.useState<string | null>('');
    const [dielectricMaterial, setDielectricMaterial] = React.useState<string | null>('');
    const [corelessDielectricMaterial, setCorelessDielectricMaterial] = React.useState<string | null>('');
    const [solderResistMaterial, setSolderResistMaterial] = React.useState<string | null>('');
    const [metalType, setMetalType] = React.useState<string | null>(knownMetalTypes.length > 0 ? knownMetalTypes[0] : '');
    
    const [previewStackupData, setPreviewStackupData] = React.useState<StackupLayer[]>([]);
    const [selectedLoadSourceOption, setSelectedLoadSourceOption] = React.useState<DisplayOption|null>(null);

    const containerRef = useRef<HTMLElement>(null);

    const MIN_WIDTH = (activeItemId === 6) ? 1000 : 600;

    const { register, getValues, setValue, setError, clearErrors, handleSubmit, reset, control, formState: { errors } } = useForm({
        defaultValues: {
            technologyField: knownStackupTechnologyTypes.size > 0 ? [...knownStackupTechnologyTypes.keys()][0] : '',

            isEmibField: false,
            isAsymetricStackField: false,
            isBSRLayerField: true,
            separateFrontSideBackSideGroupingField: isFsBsSeparation,

            cZeroThicknessField: 1,

            frontSideMetalLayersField: 1,
            frontCoreMetalLayersField: 1,
            backCoreMetalLayersField: 1,
            backSideMetalLayersField: 1,
           
            corelessLayersField: 1,

            coreThicknessField: 0,
            coreMaterialField: '',

            dielectricOnCoreThicknessField: 0,
            dielectricThicknessField: 0,
            dielectricMaterialField: '',
            corelessDielectricThicknessField: 0,
            corelessDielectricMaterialField: '',

            solderResistThicknessField: 0,
            solderResistMaterialField: '',

            buildupMetalThicknessField: 0,
            corelessBuildupMetalThicknessField: 0,
            coreMetalThicknessField: 0,
            metalTypeField: knownMetalTypes.length > 0 ? knownMetalTypes[0] : '',
        }
    });


    useEffect(() => {
        let techType = knownStackupTechnologyTypes.get(techValue ?? '')?.toLowerCase()?.trim()
        let isCoreless = (techType && techType === "coreless") ? true: false;
        if(isCoreless){
            let newSteps = [...steps]
            for(let x = 0; x < newSteps.length; x++){
                if(newSteps[x].id === 2){
                    newSteps[x].enabled = false;
                    setSteps([...newSteps])
                    break;
                }
            }
        }
        else{
            let newSteps = [...steps]
            for(let x = 0; x < newSteps.length; x++){
                if(newSteps[x].id === 2){
                    newSteps[x].enabled = true;
                    setSteps([...newSteps])
                    break;
                }
            }
        }
    }, [techValue]);


    useEffect(() => {
        const fetchPreviewStackupData = async () => {
            let info = rollupData();
            setIsLoadingBackdropEnabled(true)
            let previewPkg = await createStackup(info, true).finally(() => { setIsLoadingBackdropEnabled(false) });
            return previewPkg.stackupLayers;
        };
      
        if(activeItemId === 6 && previousActiveItemId !== 7) {
            if(selectedLoadSourceOption === null) {
                fetchPreviewStackupData().then((data) => {
                    setPreviewStackupData(data ?? []);
                })
            }
        }
        else if(activeItemId < 6 && previewStackupData.length > 0) {
            if(selectedLoadSourceOption === null) {
                setPreviewStackupData([]);
            }
        }
    }, [activeItemId]);


    function getMaterialsByType(type : string) : string[] {
        let matConf : any = initConfigs?.filter(a => a.configName === CONFIGITEM__Materials)?.at(0)?.configValue ?? undefined
        if(type && matConf && matConf.length > 0) {
            let filterList = matConf.filter((a:any) => a.type.trim().toLowerCase() === type)
            if(filterList && filterList.length > 0) {
                let names : string[] = filterList.map((a:any) => a.name.trim())
                return names?.sort();
            }
            else {
                return new Array<string>()
            }
        }
        else {
            return new Array<string>()
        }
    }

    function getFSideBSideSeparationConfigValue() : boolean {
        let sepConfVal : any = initConfigs?.find(a => a.configName === CONFIGITEM__Separate_FrontSide_BackSide_Grouping)?.configValue?.toString() ?? undefined
        if(sepConfVal && sepConfVal.toString().length > 0) {
            if(sepConfVal.toString().trim().toLowerCase() === "true") {
                return true;
            }
        }
        return false; //default value
    }
    
    function getTechStacks() {
        let map = new Map<string, string>()
        let substechConf : any = initConfigs?.filter(a => a.configName === CONFIGITEM__Substrate_Technologies)?.at(0)?.configValue ?? undefined
        if(substechConf && substechConf.length > 0) {
            for(let i = 0; i < substechConf.length; i++) {
                if(substechConf[i].name && substechConf[i].type && substechConf[i].name.trim().length > 0 && substechConf[i].type.trim().length > 0) {
                    map.set(substechConf[i].name.trim(), substechConf[i].type.trim())
                }
            }
            return map;
        }
        else {
            return new Map<string, string>()
        }
    }


    function getRoutingLayerNames(stkLayers: StackupLayer[]) : string[] {
        let routinglayers = stkLayers.filter(a => 
            a.routingLayerType && a.routingLayerType.trim().length > 0 && a.routingLayerType.trim().toLowerCase() !== "none") ?? [];
        
        let res = routinglayers.map(a => a.name.trim());

        return res;
    }


    function getStackupCheckerContext() : { isRec: boolean, existNames: string[], allowNoRLChoices: boolean } {
        let isRecreateScenario = (recScenarioExistingLayers && (recScenarioExistingLayers.length > 0)) ? true : false;
        let existingRoutinglayers = getRoutingLayerNames(recScenarioExistingLayers ?? []);
        let allowZeroRoutingLayerSelection = ((projectInterFaceCount === 0) || (isRecreateScenario === false) || (existingRoutinglayers.length === 0)) ? true : false;
        let resp = {isRec: isRecreateScenario, existNames: existingRoutinglayers, allowNoRLChoices: allowZeroRoutingLayerSelection }
        return resp;
    }


    function rollupData(): StackupGenInfo {
        let rlInfo = new Array<BasicKVP>();
        if (previewStackupData.length > 0){
            for(let lyr of previewStackupData) {
                if(lyr.routingLayerType && lyr.routingLayerType.trim().length > 0 && lyr.routingLayerType.trim().toLowerCase() !== "none") {
                    rlInfo.push({key: lyr.name, value: lyr.routingLayerType })
                }
            }
        }

        let stackupGenInfo: StackupGenInfo = {
            projectId: projectId,
            type : knownStackupTechnologyTypes.get(getValues("technologyField")) ?? '',
            technology: getValues("technologyField"),
            isEmib: getValues("isEmibField"),
            isAsymetricStack: getValues("isAsymetricStackField"),
            isBSRLayer: getValues("isBSRLayerField"),
            separateFrontSideBackSideGrouping: getValues("separateFrontSideBackSideGroupingField"),

            cZeroThickness: getValues("cZeroThicknessField"),

            frontSideMetalLayers: getValues("frontSideMetalLayersField"),
            frontCoreMetalLayers: getValues("frontCoreMetalLayersField"),
            backCoreMetalLayers: getValues("backCoreMetalLayersField"),
            backSideMetalLayers: getValues("backSideMetalLayersField"),

            corelessLayers: getValues("corelessLayersField"),

            coreThickness: getValues("coreThicknessField"),
            coreMaterial: getValues("coreMaterialField"),

            dielectricOnCoreThickness: getValues("dielectricOnCoreThicknessField"),
            dielectricThickness: getValues("dielectricThicknessField"),
            dielectricMaterial: getValues("dielectricMaterialField"),
            corelessDielectricThickness: getValues("corelessDielectricThicknessField"),
            corelessDielectricMaterial: getValues("corelessDielectricMaterialField"),

            solderResistThickness: getValues("solderResistThicknessField"),
            solderResistMaterial: getValues("solderResistMaterialField"),

            buildupMetalThickness: getValues("buildupMetalThicknessField"),
            corelessBuildupMetalThickness: getValues("corelessBuildupMetalThicknessField"),
            coreMetalThickness: getValues("coreMetalThicknessField"),
            metalType: getValues("metalTypeField"),
            
            initialSelectedRoutingLayers: rlInfo,
            tags: []
        }

       return stackupGenInfo
    }


    const handleFormSubmit = (data: any) => {
        let stackupGenInfo = rollupData();
        let ctx = getStackupCheckerContext();
        if(ctx.isRec && (ctx.allowNoRLChoices === false) && stackupGenInfo.initialSelectedRoutingLayers.length === 0) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `For stackup re-creation scenario, 'routing layers' must be selected if interfaces exist, or if `
                + `routing-layer choices were made for the previous stackup. Please click the 'back' button and choose routing layers.`)
            return;
        }

        if (onFormClosed) {
            onFormClosed(stackupGenInfo);
        }

        performReset()
        if(close){ close() }
    };


    function performReset() {
        reset();
        setActive(0)
        setActiveItemId(steps?.at(0)?.id ?? 0)
        setHighestStepVisited(active)
        
        setTechValue(knownStackupTechnologyTypes.size > 0 ? [...knownStackupTechnologyTypes.keys()][0] : '');
        setCoreMaterial('');
        setDielectricMaterial('');
        setCorelessDielectricMaterial('');
        setSolderResistMaterial('');
        setMetalType(knownMetalTypes.length > 0 ? knownMetalTypes[0] : '');

        setPreviewStackupData([])
        setSelectedLoadSourceOption(null);
    }


    const handleCancel = () => {
        if (onFormClosed) {
            onFormClosed(null);
        }
        
        performReset()
        if(close){ close() }
    };


    const handleStepChange = (nextStep: number) => {
        const isOutOfBounds = nextStep > (enabledSteps.length - 1) || nextStep < 0;
        if (isOutOfBounds) { return; }

        setPreviousActiveItemId(enabledSteps[active].id)
        setActive(nextStep);
        setActiveItemId(enabledSteps[nextStep].id)
        setHighestStepVisited((hs) => Math.max(hs, nextStep));
    };


    function getTechnologyContent() {
        let techType = knownStackupTechnologyTypes.get(techValue ?? '')?.toLowerCase()?.trim()
        let isCoreless = (techType && techType === "coreless") ? true: false;

        
        function onLoadStackupDataFromExistingProject(event: any, checked: boolean, option: DisplayOption|null, isClearAllAction: boolean): void {
            if(checked === false || isClearAllAction){
                performReset();
                if(isClearAllAction) {
                    displayQuickMessage(UIMessageType.INFO_MSG, `Selection cleared. Default values re-applied....`);
                }
                else {
                    displayQuickMessage(UIMessageType.INFO_MSG, `Source project deselected. Default values re-applied....`);
                }
                return;
            }

            if(option && option.id) {
                if(pkgIdToStackupInfoMap && pkgIdToStackupInfoMap.size > 0 && pkgIdToStackupInfoMap.has(option.id)) {
                    let info = pkgIdToStackupInfoMap.get(option.id) as [StackupGenInfo, StackupLayer[]];
                    let stkInfo = info[0];
                    let layers = info[1];

                    setValue("technologyField", stkInfo.technology);
                    setTechValue(stkInfo.technology);

                    setValue("isEmibField", stkInfo.isEmib);
                    setValue("isAsymetricStackField", stkInfo.isAsymetricStack);
                    setValue("isBSRLayerField", stkInfo.isBSRLayer);
                    setValue("separateFrontSideBackSideGroupingField", stkInfo.separateFrontSideBackSideGrouping);
                    setValue("cZeroThicknessField", stkInfo.cZeroThickness);
                    setValue("frontSideMetalLayersField", stkInfo.frontSideMetalLayers);

        
                    setValue("frontSideMetalLayersField", stkInfo.frontSideMetalLayers);
                    setValue("frontCoreMetalLayersField", stkInfo.frontCoreMetalLayers);
                    setValue("backCoreMetalLayersField", stkInfo.backCoreMetalLayers);
                    setValue("backSideMetalLayersField", stkInfo.backSideMetalLayers);
                    setValue("corelessLayersField", stkInfo.corelessLayers);
                    setValue("coreThicknessField", stkInfo.coreThickness);
                    
                    setValue("coreMaterialField", stkInfo.coreMaterial);
                    setCoreMaterial(stkInfo.coreMaterial);

                    setValue("dielectricOnCoreThicknessField", stkInfo.dielectricOnCoreThickness);
                    setValue("dielectricThicknessField", stkInfo.dielectricThickness);
                    
                    setValue("dielectricMaterialField", stkInfo.dielectricMaterial);
                    setDielectricMaterial(stkInfo.dielectricMaterial);

                    setValue("corelessDielectricThicknessField", stkInfo.corelessDielectricThickness);
                    setValue("corelessDielectricMaterialField", stkInfo.corelessDielectricMaterial);
        
                    setValue("solderResistThicknessField", stkInfo.solderResistThickness);
                    
                    setValue("solderResistMaterialField", stkInfo.solderResistMaterial);
                    setSolderResistMaterial(stkInfo.solderResistMaterial);

                    setValue("buildupMetalThicknessField", stkInfo.buildupMetalThickness);
                    setValue("corelessBuildupMetalThicknessField", stkInfo.corelessBuildupMetalThickness);
                    setValue("coreMetalThicknessField", stkInfo.coreMetalThickness);
                    setValue("metalTypeField", stkInfo.metalType);
                    setMetalType(stkInfo.metalType);
                    
                    if(layers && layers.length > 0) {
                        setPreviewStackupData(layers);
                    }

                    setSelectedLoadSourceOption(option);

                    displayQuickMessage(UIMessageType.SUCCESS_MSG, `Stackup values loaded successfully....`);
                }
            }
        }


        return (
            <Box sx={{display: "flex", flexDirection:"column", justifyContent: "space-evenly"}} gap={8}>
                <Box>
                    <Typography color={colors.greenAccent[400]}>{`Load Stackup From Existing Project`}</Typography>
                    <Divider sx={{ mb: 1 }} />

                    <Box sx={{ padding: 1, mt: 0, ml: -1, overflowX: "hidden"}}>
                        <Autocomplete
                            multiple={false}
                            id="stk-load-selection"
                            size="small"
                            disabled={false}
                            sx={{minWidth: 310}}
                            value={selectedLoadSourceOption || {id: "", label: "", type: "" } as DisplayOption }
                            options={sourceDisplayOptions}
                            groupBy={(option) => option.type as string }
                            getOptionLabel={(option: DisplayOption) => option.label}
                            onChange={(event, value, reason, details) => {
                                if(reason.toLowerCase() === "clear") {
                                    onLoadStackupDataFromExistingProject(event, false, null, true)
                                }
                            }}
                            renderGroup={(params) => (
                                <Fragment key={params.key}>
                                    <ListItemButton
                                        sx={{ height: 32, ml: 0, backgroundColor: colors.primary[500] }}>
                                        <ListItemIcon>
                                            <LabelImportantOutlined />
                                        </ListItemIcon>
                                        <ListItemText sx={{ml: -3}} primary={params.group} />
                                    </ListItemButton>
                                        
                                    <div>{params.children}</div>
                                </Fragment>
                            )}
                            renderOption={(props: any, option: DisplayOption, { selected }: any) => {
                                const { key, ...optionProps } = props;
                                return (
                                    <ListItem key={key} {...optionProps}>
                                        <Checkbox 
                                            icon={<RadioButtonUncheckedOutlined fontSize="small" sx={{color: SPECIAL_BLUE_COLOR}}/>} 
                                            sx={{ height: 22, ml: 3 }} 
                                            checked={selected} 
                                            onChange={(event, checked) => onLoadStackupDataFromExistingProject(event, checked, option, false)} 
                                        />
                                        <Typography sx={{ fontSize:12 }} onClick={(event) => onLoadStackupDataFromExistingProject(event, true, option, false)} >
                                            {option.label}
                                        </Typography>
                                    </ListItem>
                                );
                            }}
                            renderInput={(params: any) => (
                                <TextField {...params} 
                                    label={"Existing Projects"}
                                    size="small"
                                    placeholder={undefined}
                                />
                            )}
                        />
                    </Box>
                </Box>


                <Box>
                    <Typography color={colors.greenAccent[400]}>{`Select Substrate Technology`}</Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Autocomplete 
                        value={techValue}
                        onChange={(event: any, newValue: string | null) => {
                            setTechValue(newValue);
                        }}
                        key="techCB"
                        freeSolo={false}
                        filterSelectedOptions={true}
                        disablePortal
                        disableListWrap
                        size="small"
                        id="tech-cb"
                        sx={{ mb: 1, minWidth: 300, mt: 1 }}
                        options={['', ...[...knownStackupTechnologyTypes.keys()]]}
                        renderInput={(params: any) => <TextField key="techTXT" size="small" {...register("technologyField", {
                            required: 'Stackup technology is required',
                        })} {...params} 
                            label="Select Technology"
                            error={(errors.technologyField?.message && errors.technologyField?.message.length > 0) ? true : false}
                            helperText={errors.technologyField?.message}
                        />}
                    />
                </Box>

                <Box sx={{display: "flex", flexDirection:"column"}} >
                    <Typography color={colors.greenAccent[400]}>{`Other Optional Settings`}</Typography>
                    <Divider sx={{ mb: 1 }} />

                    {
                        (isCoreless === false) && <Box sx={{ml: 1, mt: 0, display: "flex", flexDirection:"column" }}>
                            <Controller
                                key="contrEmib"
                                name="isEmibField"
                                control={control}
                                render={({ field: { onChange, value } }) => (
                                    <FormControlLabel
                                        control={<Switch key="emibswitch" checked={value} onChange={onChange} />}
                                        label="EMIB"
                                    />
                                )}
                            />
                            <Controller
                                key="asymStackCtrl"
                                name="isAsymetricStackField"
                                control={control}
                                render={({ field: { onChange, value } }) => (
                                    <FormControlLabel
                                        control={<Switch key="asymkey" checked={value} onChange={onChange} />}
                                        label="Asymmetric Stack"
                                    />
                                )}
                            />
                            <Controller
                                key="fsbsSeperationCtrl"
                                name="separateFrontSideBackSideGroupingField"
                                control={control}
                                render={({ field: { onChange, value } }) => (
                                    <FormControlLabel
                                        control={<Switch key="fsbsSeperationSwitch" checked={value} onChange={onChange} />}
                                        label="Separate FS/BS in layer grouping"
                                    />
                                )}
                            />
                        </Box>
                    }
                    {
                        (isCoreless) && <Box sx={{ml: 3, display: "flex", flexDirection:"column" }}>
                            <Controller
                                key="bsrCtrl1"
                                name="isBSRLayerField"
                                control={control}
                                render={({ field: { onChange, value } }) => (
                                    <FormControlLabel
                                        control={<Switch key="bsrswitch1" checked={value} onChange={onChange} />}
                                        label="With BSR Layer"
                                    />
                                )}
                            />
                        </Box>
                    }
                </Box>
            </Box>
        )
    }


    function getLayersContent() {
        let techType = knownStackupTechnologyTypes.get(techValue ?? '')?.toLowerCase()?.trim()
        let isCoreless = (techType && techType === "coreless") ? true: false;
        let isFullStack = (techType && techType === "fullstack") ? true: false;
        let isGlassCore = (techType && techType === "glasscore") ? true: false;
        
        return (
            <Box sx={{display: "flex", flexDirection:"column"}} gap={2.5}>
                <Typography color={colors.greenAccent[400]}>{`Enter Number of Layers`}</Typography>
                <Divider sx={{ mt: -2, mb: 1 }} />
                
                {(isCoreless === false) && <Controller
                    name="frontSideMetalLayersField"
                    key="fsmContr"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="fsm1"
                            key="fsm1"
                            label="Number of Front Side Metal Layers"
                            required={true}
                            min={1}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={(e) => {
                                let isAsy = getValues("isAsymetricStackField")
                                if(isAsy === false) {
                                    setValue("backSideMetalLayersField", e as number) 
                                }
                                onChange(e)
                            } }
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}

                {(isCoreless === false && isGlassCore === false) && <Controller
                    name="frontCoreMetalLayersField"
                    key="fcmetContr"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="fcm1"
                            key="fcm1"
                            label="Number of Front Core Metal Layers"
                            required={true}
                            min={1}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={(e) => {
                                let isAsy = getValues("isAsymetricStackField")
                                if(isAsy === false) {
                                    setValue("backCoreMetalLayersField", e as number) 
                                }
                                onChange(e)
                            } }
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}

                {(isCoreless === false && isGlassCore === false) && <Controller
                    name="backCoreMetalLayersField"
                    key="bcmContr"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="bcmetal"
                            key="bcmetal"
                            label="Number of Back Core Metal Layers"
                            required={true}
                            min={1}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={(e) => {
                                let isAsy = getValues("isAsymetricStackField")
                                if(isAsy === false) {
                                    setValue("frontCoreMetalLayersField", e as number) 
                                }
                                onChange(e)
                            } }
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}

                {(isCoreless === false) && <Controller
                    name="backSideMetalLayersField"
                    key="bsidemetCtrl"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="bsidemetal"
                            key="bsidemetal"
                            label="Number of Back Side Metal Layers"
                            required={true}
                            min={1}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={(e) => {
                                let isAsy = getValues("isAsymetricStackField")
                                if(isAsy === false) {
                                    setValue("frontSideMetalLayersField", e as number) 
                                }
                                onChange(e)
                            } }
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}

                {(isCoreless || isFullStack) && <Controller
                    name="corelessLayersField"
                    key="clsLayersCtrl"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="clsLayers"
                            key="clsLayers"
                            label="Number of Coreless Layers"
                            required={true}
                            min={1}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}
            </Box>

        )
    }


    function getCoreDetailsContent() { 
        return (
            <Box sx={{display: "flex", flexDirection:"column"}} gap={3}>
                <Typography color={colors.greenAccent[400]}>{`Enter Core Thickness and Materials`}</Typography>
                <Divider sx={{ mt: -2, mb: 1 }} />
                <Controller
                    name="coreThicknessField"
                    key="coreThCtrl"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="coreTh"
                            key="coreTh"
                            label="Core Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                            }}
                        />
                    )}
                />

                <Autocomplete 
                    key="coreMat"
                    value={coreMaterial}
                    onChange={(event: any, newValue: string | null) => {
                        setCoreMaterial(newValue);
                    }}
                    freeSolo={false}
                    filterSelectedOptions={true}
                    disablePortal
                    disableListWrap
                    size="small"
                    id="cm-cb"
                    sx={{ m: 1, minWidth: 200, marginTop: 3 }}
                    options={['', ...knownCoreMaterialTypes]}
                    renderInput={(params: any) => <TextField key="coreMetTxt" size="small" {...register("coreMaterialField", {
                        required: 'Core Material is required',
                    })} {...params} 
                        label="Select Core Material"
                        error={(errors.coreMaterialField?.message && errors.coreMaterialField?.message.length > 0) ? true : false}
                        helperText={errors.coreMaterialField?.message}
                        />}
                />

            </Box>

        )
    }
    

    function getDielectricContent() {
        let techType = knownStackupTechnologyTypes.get(techValue ?? '')?.toLowerCase()?.trim()
        let isCoreless = (techType && techType === "coreless") ? true: false;
        let isFullStack = (techType && techType === "fullstack") ? true: false;
        
        return (
            <Box sx={{display: "flex", flexDirection:"column"}} gap={2}>
                <Typography color={colors.greenAccent[400]}>{`Enter Dielectric Thickness and Materials`}</Typography>
                <Divider sx={{ mt: -2, mb: 1 }} />
                
                {(isCoreless === false) && <Controller
                    name="dielectricOnCoreThicknessField"
                    key="dielecCtrl"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="dielecCore"
                            key="dielecCore"
                            label="Dielectric on Core Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                            }}
                        />
                    )}
                />}

                {(isCoreless === false) && <Controller
                    name="dielectricThicknessField"
                    key="dielecThk"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="dielecThk1"
                            key="dielecThk1"
                            label="Dielectric Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                            }}
                        />
                    )}
                />}

                {(isCoreless === false) && <Autocomplete 
                    key="dielecMatCB"
                    value={dielectricMaterial}
                    onChange={(event: any, newValue: string | null) => {
                        setDielectricMaterial(newValue);
                    }}
                    freeSolo={false}
                    filterSelectedOptions={true}
                    disablePortal
                    disableListWrap
                    size="small"
                    id="de-cb"
                    sx={{ m: 1, minWidth: 200, marginTop: 3 }}
                    options={['', ...knownDielectricMaterialTypes]}
                    renderInput={(params: any) => <TextField key="dielecMatTxt" size="small" {...register("dielectricMaterialField", {
                        required: 'Dielectric Material is required',
                    })} {...params} 
                        label="Dielectric Material"
                        error={(errors.dielectricMaterialField?.message && errors.dielectricMaterialField?.message.length > 0) ? true : false}
                        helperText={errors.dielectricMaterialField?.message}
                        />}
                />}

                {(isCoreless || isFullStack) && <Controller
                    name="corelessDielectricThicknessField"
                    key="corelessdielecThk"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="corelessdielecThk1"
                            key="corelessdielecThk1"
                            label="[Coreless] Dielectric Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                            }}
                        />
                    )}
                />}

                {(isCoreless || isFullStack) && <Autocomplete 
                    key="corelessDielecMatCB"
                    value={corelessDielectricMaterial}
                    onChange={(event: any, newValue: string | null) => {
                        setCorelessDielectricMaterial(newValue);
                    }}
                    freeSolo={false}
                    filterSelectedOptions={true}
                    disablePortal
                    disableListWrap
                    size="small"
                    id="cde-cb"
                    sx={{ m: 1, minWidth: 200, marginTop: 3 }}
                    options={['', ...knownCorelessDielectricMaterialTypes]}
                    renderInput={(params: any) => <TextField key="corelessDielecMatTxt" size="small" {...register("corelessDielectricMaterialField", {
                        required: 'Dielectric Material is for Coreless is required',
                    })} {...params} 
                        label="[Coreless] Dielectric Material"
                        error={(errors.dielectricMaterialField?.message && errors.dielectricMaterialField?.message.length > 0) ? true : false}
                        helperText={errors.dielectricMaterialField?.message}
                        />}
                />}

            </Box>

        )
    }


    function getSolderResistContent() {
        return (
            <Box sx={{display: "flex", flexDirection:"column"}} gap={3}>
                <Typography color={colors.greenAccent[400]}>{`Enter Solder Resist Thickness and Materials`}</Typography>
                <Divider sx={{ mt: -2, mb: 1 }} />
                <Controller
                    name="solderResistThicknessField"
                    key="srthk"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="srthik1"
                            key="srthik1"
                            label="Solder Resist Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />

                <Autocomplete 
                    key="srmatCB"
                    value={solderResistMaterial}
                    onChange={(event: any, newValue: string | null) => {
                        setSolderResistMaterial(newValue);
                    }}
                    freeSolo={false}
                    filterSelectedOptions={true}
                    disablePortal
                    disableListWrap
                    size="small"
                    id="sr-cb"
                    sx={{ m: 1, minWidth: 200, marginTop: 3 }}
                    options={['', ...knownSolderResistMaterialTypes]}
                    renderInput={(params: any) => <TextField key="srMatTxt" size="small" {...register("solderResistMaterialField", {
                        required: "Solder Resist Material is required",
                    })} {...params} 
                        label="Solder Resist Material"
                        error={(errors.solderResistMaterialField?.message && errors.solderResistMaterialField?.message.length > 0) ? true : false}
                        helperText={errors.solderResistMaterialField?.message}
                        />}
                />

            </Box>

        )
    }


    function getMetalContent() {
        let techType = knownStackupTechnologyTypes.get(techValue ?? '')?.toLowerCase()?.trim()
        let isCoreless = (techType && techType === "coreless") ? true: false;
        let isFullStack = (techType && techType === "fullstack") ? true: false;
        
        return (
            <Box sx={{display: "flex", flexDirection:"column"}} gap={3}>
                <Typography color={colors.greenAccent[400]}>{`Enter Metal Thickness`}</Typography>
                <Divider sx={{ mt: -2, mb: 1 }} />
                {(isCoreless === false) && <Controller
                    key="buildupMetCtrl"
                    name="buildupMetalThicknessField"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="buildupMetThk1"
                            key="buildupMetThk1"
                            label="Buildup Metal Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}

                {(isCoreless === false) && <Controller
                    key="coreMetThk"
                    name="coreMetalThicknessField"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="coreMetThk1"
                            key="coreMetThk1"
                            label="Core Metal Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}

                {(isCoreless === false) && <Autocomplete 
                    key="metTypeCB"
                    value={metalType}
                    onChange={(event: any, newValue: string | null) => {
                        setMetalType(newValue);
                    }}
                    freeSolo={false}
                    filterSelectedOptions={true}
                    disablePortal
                    disableListWrap
                    size="small"
                    id="mt-cb"
                    sx={{ m: 1, minWidth: 200, marginTop: 3 }}
                    options={['', ...knownMetalTypes]}
                    renderInput={(params: any) => <TextField key="metTypeTXT" size="small" {...register("metalTypeField", {
                        required: 'Metal Type is required',
                    })} {...params} 
                        label="Metal Type"
                        error={(errors.metalTypeField?.message && errors.metalTypeField?.message.length > 0) ? true : false}
                        helperText={errors.metalTypeField?.message}
                        />}
                />}
                
                {(isFullStack || isCoreless) && <Controller
                    key="corelessBldMetThk"
                    name="corelessBuildupMetalThicknessField"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                        <NumberInput
                            id="corelessBldMetThk1"
                            key="corelessBldMetThk1"
                            label="[Coreless] Buildup Metal Thickness (um)"
                            required={true}
                            min={0}
                            max={9999}
                            defaultValue={1}
                            value={value} 
                            onChange={onChange}
                            allowNegative={false}
                            allowDecimal={false}
                            stepHoldDelay={500}
                            stepHoldInterval={100}
                            styles={{
                                input: { backgroundColor: colors.grey[100] },
                                label: {fontSize: 13}
                            }}
                        />
                    )}
                />}
            </Box>

        )
    }


    function getRoutingLayersContent() {
        const columnDefs: Array<ColDef | ColGroupDef> = [
            {
                headerName: "Layer",
                field: "name",
                resizable: true,
                filter: 'text',
                cellDataType: 'text',
                minWidth: 140,
                sortable: false,
                editable: false,
                cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left' } },
            },
            {
                headerName: "Type",
                field: 'type',
                resizable: true,
                filter: 'text',
                cellDataType: 'text',
                minWidth: 140,
                sortable: false,
                editable: false,
                cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left'} }
            },
            {
                headerName: "Routing Layer?",
                field: "routingLayerType",
                resizable: false,
                minWidth: 250,
                width: 250,
                maxWidth: 250,
                sortable: false,
                editable: false,
                mainMenuItems: (params: any) => {
                    return (params.defaultItems as any[]).concat(getColumnMenuItems())
                },
                cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left' } },
                cellRenderer: SegmentedCtrlCellRenderer,
                cellRendererParams: { selectorColor: colors.blueAccent[400], options: [
                    STACKUP_ROUTING_DESIG_NONE,
                    STACKUP_ROUTING_DESIG_ROUTING,
                    STACKUP_ROUTING_DESIG_MIX
                ] } as SegmentedCtrlCellRendererProps,             
            }
        ];
        
        function getColumnMenuItems() : any {
            let result = [
                'separator',
                {
                    name: `Set all layers to 'ROUTING'`,
                    icon: '<span class="ag-icon ag-icon-tick" unselectable="on" role="presentation"></span>',
                    action: () => handleSelectionAction(STACKUP_ROUTING_DESIG_ROUTING),
                    disabled: false,
                    tooltip: `Designate all layers as 'routing' layers`,
                    cssClasses: ['bold'],
                },
                {
                    name: `Set all layers to 'NONE'`,
                    icon: '<span class="ag-icon ag-icon-not-allowed" unselectable="on" role="presentation"></span>',
                    action: () => handleSelectionAction(STACKUP_ROUTING_DESIG_NONE),
                    disabled: false,
                    tooltip: `Set all layer routing designation to 'NONE'`,
                    cssClasses: ['bold'],
                }
            ];
            return result;
        }

        function handleSelectionAction(action: string) {
            let stkLayerListCopy = rfdcCopy<StackupLayer[]>(previewStackupData) as StackupLayer[]
            if(action === STACKUP_ROUTING_DESIG_ROUTING) {
                stkLayerListCopy.forEach(x => x.routingLayerType = STACKUP_ROUTING_DESIG_ROUTING)
            }
            else if (action === STACKUP_ROUTING_DESIG_NONE) {
                stkLayerListCopy.forEach(x => x.routingLayerType = STACKUP_ROUTING_DESIG_NONE)
            }
            setPreviewStackupData(stkLayerListCopy);
        }
    

        let ctx = getStackupCheckerContext();


        return (
            <Box sx={{display: "flex", flexDirection:"column"}} gap={3}>
                <Typography variant="h6" sx={{  color: colors.grey[100] }}>
                    <span style={{ color: `${colors.greenAccent[400]}`}}>Select Routing Layers </span>
                    <span>&nbsp;&nbsp;&nbsp;</span>
                    {(ctx.allowNoRLChoices === false) 
                    ? <span style={{color: `${SPECIAL_RED_COLOR}`}}>{`(required)`}</span>
                    : <span style={{color: `${colors.grey[200]}`}}>{`(optional)`}</span>}
                </Typography>
                <Divider sx={{ mt: -2, mb: 0 }} />
                {(ctx.allowNoRLChoices === false) && <Box>
                    <Typography variant="h6" sx={{  color: colors.grey[100] }}>
                        <span>Previous routing layers :</span>
                        <span>&nbsp;&nbsp;&nbsp;</span>
                        <span style={{fontSize: 11}}>{ctx.existNames.map(a => a.toUpperCase()).join(", ")}</span>
                    </Typography>
                </Box>}
                <Box sx={{ overflowY: "scroll" }}>
                    <div style={{ marginRight: 10, width: 750, height: "60vh", }}>            
                    <AgGridReact
                        rowData={previewStackupData ?? []}
                        animateRows={true}
                        columnDefs={columnDefs}
                        defaultColDef={{ flex: 1 }}
                        onGridReady={undefined}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={true}
                        suppressCsvExport={false}   
                        groupDisplayType='singleColumn'    
                        groupDefaultExpanded={1}
                        rowHeight={33}
                        cellSelection={true}
                        enableCharts={true}
                        getRowStyle={onGetStackupGridRowStyle}
                        domLayout="autoHeight"
                    />
                </div>
                </Box>
            </Box>
        );
    }



    function getSummaryContent() {
        let techType = knownStackupTechnologyTypes.get(techValue ?? '')?.toLowerCase()?.trim()
        let isCoreless = (techType && techType === "coreless") ? true: false;
        let isFullStack = (techType && techType === "fullstack") ? true: false;

        let summaryList = new Array<BasicKVP>();

        if(!techType) {
            return <>No summary to diaplay</> 
        }
        
        // Repetitive in some cases but ...that's fine - for clarity
        if(isCoreless){
            let summaryKVP : BasicKVP = { key: "Coreless Stackup Summary" as string, value: new Map<string, string>() } 
            summaryKVP.value.set("Technology", getValues("technologyField"))
            summaryKVP.value.set("BSR Layer Present", getValues("isBSRLayerField")?.toString())
            summaryKVP.value.set("Is Emib", getValues("isEmibField")?.toString())
            summaryKVP.value.set("Separate Fron-Side/Back-Side Layer Grouping", getValues("separateFrontSideBackSideGroupingField")?.toString())
            summaryKVP.value.set("Number of Metal Layers", getValues("corelessLayersField"))
            summaryKVP.value.set("Dielectric Thickness", getValues("corelessDielectricThicknessField"))
            summaryKVP.value.set("Dielectric Material", getValues("corelessDielectricMaterialField"))
            summaryKVP.value.set("Solder Resist Thickness (um)", getValues("solderResistThicknessField"))
            summaryKVP.value.set("Solder Resist Material", getValues("solderResistMaterialField"))
            summaryKVP.value.set("Buildup Metal Thickness (um)", getValues("buildupMetalThicknessField"))
            summaryKVP.value.set("Selected Routing Layers", getRoutingLayerNames(previewStackupData,).join(", "))
            summaryList.push(summaryKVP);
        }
        else if (isFullStack) {
            let commonSummaryKVP : BasicKVP = { key: "Common Values Summary" as string, value: new Map<string, string>() } 
            commonSummaryKVP.value.set("Technology", getValues("technologyField"))
            commonSummaryKVP.value.set("Is Emib", getValues("isEmibField")?.toString())
            commonSummaryKVP.value.set("Separate Fron-Side/Back-Side Layer Grouping", getValues("separateFrontSideBackSideGroupingField")?.toString())
            commonSummaryKVP.value.set("Solder Resist Thickness (um)", getValues("solderResistThicknessField"))
            commonSummaryKVP.value.set("Solder Resist Material", getValues("solderResistMaterialField"))
            commonSummaryKVP.value.set("Selected Routing Layers", getRoutingLayerNames(previewStackupData).join(", "))
            summaryList.push(commonSummaryKVP);

            let stdCoreSummaryKVP : BasicKVP = { key: "Standard Core Summary" as string, value: new Map<string, string>() } 
            stdCoreSummaryKVP.value.set("Is Asymmetrical", getValues("isAsymetricStackField")?.toString())
            stdCoreSummaryKVP.value.set("Number of Front Side Metal Layers", getValues("frontSideMetalLayersField"))
            stdCoreSummaryKVP.value.set("Number of Front Core Metal Layers", getValues("frontCoreMetalLayersField"))
            stdCoreSummaryKVP.value.set("Number of Back Core Metal Layers", getValues("backCoreMetalLayersField"))
            stdCoreSummaryKVP.value.set("Number of Back Side Metal Layers", getValues("backSideMetalLayersField"))
            stdCoreSummaryKVP.value.set("Core Thickness (um)", getValues("coreThicknessField"))
            stdCoreSummaryKVP.value.set("Core Material", getValues("coreMaterialField"))
            stdCoreSummaryKVP.value.set("Dielectric on Core Thickness (um)", getValues("dielectricOnCoreThicknessField"))
            stdCoreSummaryKVP.value.set("Dielectric Thickness (um)", getValues("dielectricThicknessField"))
            stdCoreSummaryKVP.value.set("Dielectric Material", getValues("dielectricMaterialField"))
            stdCoreSummaryKVP.value.set("Buildup Metal Thickness (um)", getValues("buildupMetalThicknessField"))
            stdCoreSummaryKVP.value.set("Core Metal Thickness (um)", getValues("coreMetalThicknessField"))
            summaryList.push(stdCoreSummaryKVP);

            let clsSummaryKVP : BasicKVP = { key: "Coreless Summary" as string, value: new Map<string, string>() } 
            clsSummaryKVP.value.set("Number of Metal Layers", getValues("corelessLayersField"))
            clsSummaryKVP.value.set("Dielectric Thickness (um)", getValues("corelessDielectricThicknessField"))
            clsSummaryKVP.value.set("Dielectric Material", getValues("corelessDielectricMaterialField"))
            clsSummaryKVP.value.set("Buildup Metal Thickness (um)", getValues("buildupMetalThicknessField"))
            summaryList.push(clsSummaryKVP);
        }
        else {
            let stdCoreSummaryKVP : BasicKVP = { key: "Standard Core Summary" as string, value: new Map<string, string>() } 
            stdCoreSummaryKVP.value.set("Technology", getValues("technologyField"))
            stdCoreSummaryKVP.value.set("Is Emib", getValues("isEmibField")?.toString())
            stdCoreSummaryKVP.value.set("Is Asymmetrical", getValues("isAsymetricStackField")?.toString())
            stdCoreSummaryKVP.value.set("Separate Fron-Side/Back-Side Layer Grouping", getValues("separateFrontSideBackSideGroupingField")?.toString())
            stdCoreSummaryKVP.value.set("Number of Front Side Metal Layers", getValues("frontSideMetalLayersField"))
            stdCoreSummaryKVP.value.set("Number of Front Core Metal Layers", getValues("frontCoreMetalLayersField"))
            stdCoreSummaryKVP.value.set("Number of Back Core Metal Layers", getValues("backCoreMetalLayersField"))
            stdCoreSummaryKVP.value.set("Number of Back Side Metal Layers", getValues("backSideMetalLayersField"))
            stdCoreSummaryKVP.value.set("Core Thickness (um)", getValues("coreThicknessField"))
            stdCoreSummaryKVP.value.set("Core Material", getValues("coreMaterialField"))
            stdCoreSummaryKVP.value.set("Dielectric on Core Thickness (um)", getValues("dielectricOnCoreThicknessField"))
            stdCoreSummaryKVP.value.set("Dielectric Thickness (um)", getValues("dielectricThicknessField"))
            stdCoreSummaryKVP.value.set("Dielectric Material", getValues("dielectricMaterialField"))
            stdCoreSummaryKVP.value.set("Solder Resist Thickness (um)", getValues("solderResistThicknessField"))
            stdCoreSummaryKVP.value.set("Solder Resist Material", getValues("solderResistMaterialField"))
            stdCoreSummaryKVP.value.set("Buildup Metal Thickness (um)", getValues("buildupMetalThicknessField"))
            stdCoreSummaryKVP.value.set("Core Metal Thickness (um)", getValues("coreMetalThicknessField"))
            stdCoreSummaryKVP.value.set("Selected Routing Layers", getRoutingLayerNames(previewStackupData).join(", "))
            summaryList.push(stdCoreSummaryKVP);
        }

        return (
            <Box key={`summaryView`}>
                {(summaryList).map((item: BasicKVP, index: number) => (
                    <Box key={`summary-item-${index}`} display="flex" sx={{ ml: 2, mr: 2, textAlign:"left"}} flexDirection="column">
                        <Typography color={colors.greenAccent[400]}>{item.key}</Typography>
                        <Divider sx={{ mt: 0, mb: 1 }} />
                        
                        <Table>
                            <TableHead>
                                <TableRow sx={{ padding: 0, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
                                    <TableCell size="small" sx={{ borderTopLeftRadius: 5, borderBottomLeftRadius: 5, paddingLeft: 1, PaddingRight: 1, borderBottom: 0}}>NAME</TableCell>
                                    <TableCell size="small" sx={{ borderTopRightRadius: 5, borderBottomRightRadius: 5, paddingLeft: 1, PaddingRight: 1, borderBottom: 0}}>VALUE</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {[...item.value.keys()].map((element: string, index: number) => (
                                    <TableRow key={`sry-kvp-${index}`}>
                                        <TableCell size="small" sx={{ paddingTop: 0, paddingBottom: 0, paddingLeft: 1, PaddingRight: 1, borderBottom: 0}}>
                                            <Typography sx={{minWidth: 210, fontSize: 12}}>{element || ''} : </Typography>
                                        </TableCell>
                                        <TableCell size="small" sx={{paddingTop: 0, paddingBottom: 0, paddingLeft: 1, PaddingRight: 1, borderBottom: 0}}>
                                            <Typography sx={{minWidth: 210, fontSize: 12}}>{item.value.get(element) || ''}</Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <Divider sx={{ mt: 2, mb: 2}} />
                    </Box>
                ))} 
            </Box>
        )
    }


    function getActiveContent() {
        switch (activeItemId) {
            case 0: return (getTechnologyContent());
            case 1: return (getLayersContent());
            case 2: return (getCoreDetailsContent());
            case 3: return (getDielectricContent());
            case 4: return (getSolderResistContent());
            case 5: return (getMetalContent());
            case 6: return (getRoutingLayersContent());
            case 7: return (getSummaryContent());
            default: return (<div>Yo... WTF happened? </div>);
        }
    }


    const shouldAllowSelectStep = (step: number) => highestStepVisited >= step && active !== step;

    let enabledSteps = steps.filter(a => (a.enabled === true))


    

    return (
        <Box>
            <Modal
                opened={opened as boolean}
                onClose={handleCancel}
                centered
                size="auto"
                title={title}
                closeOnClickOutside={false}
                closeOnEscape={false}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 3,
                }}
                styles={{
                    title: { padding: 2, color: "#000000", minWidth: MIN_WIDTH - 100 },
                    header: { backgroundColor: colors.grey[100], minWidth: MIN_WIDTH },
                    body: { backgroundColor: colors.primary[400], minWidth: MIN_WIDTH },
                }}>

                <Box ref={containerRef}>
                    <Divider />
                    <Box sx={{ mt: 2, mb: 1}}>
                        <form onSubmit={handleSubmit(handleFormSubmit)}>
                            <Box sx={{ display: "flex", mt: 2, mb: 1, ml: 2, minHeight: "50vh",  minWidth: 500, height: "auto" }}>
                                <Box flexDirection="column" display="flex"  alignItems="center">
                                    <Slide timeout={{ enter: 500, exit: 500 }} direction="down" in={true} container={containerRef.current}>
                                        <Stepper
                                            iconSize={22}
                                            active={active}
                                            onStepClick={(stepIndex: number) => handleStepChange(stepIndex)}
                                            orientation="vertical"
                                            styles={{
                                                stepLabel: { fontSize: 13 },
                                            }}>
                                            {
                                                enabledSteps.map((step, index) => (
                                                    <Stepper.Step key={`stk-step-${index}`} allowStepSelect={shouldAllowSelectStep(index)} label={step.label} />
                                                ))
                                            }
                                        </Stepper>
                                    </Slide>
                                    
                                </Box>
                                <Divider orientation='vertical' sx={{ height: "auto", ml: 2, mr: 5 }} />
                                <Box sx={{mr: 2}}>
                                    { getActiveContent() }
                                </Box>
                            </Box>
                            
                            <Divider sx={{ mt: 1, mb: 1 }} />
                        
                            <SpButton
                                intent="plain"
                                onClick={() => handleStepChange(active - 1)}
                                startIcon={<NavigateBeforeOutlined />}
                                sx={{ m: 1, height: 32, width: 200 }}
                                label="Back" />

                            {(active < enabledSteps.length -1) && <SpButton
                                intent="plain"
                                onClick={() => handleStepChange(active + 1)}
                                endIcon={<NavigateNextOutlined />}
                                sx={{ m: 1, height: 32, width: 200 }}
                                label="Next" />}

                            {(active >= enabledSteps.length -1) && <SpButton
                                type="submit"
                                intent="plain"
                                endIcon={<CheckOutlined />}
                                sx={{ m: 1, height: 32, width: 200 }}
                                label="Submit" />}
                        </form>
                            
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
}

export default SetupStackupWizardDialog











// <Box sx={{ml: 0, mr: 2, mt: 1, display: 'flex', flexDirection:'row', alignItems : "center"}}>
//     <RotatingLines
//         strokeColor={colors.greenAccent[400]}
//         strokeWidth="5"
//         animationDuration="0.75"
//         width="46"
//         visible={loadingSpinnerCtx.enabled}
//     />
// </Box>

// {loadingSpinnerCtx.enabled && 
//     <Box sx={{overflowWrap: "break-word", m: 1}}>
//         <span
//             style={{ width: 55, color: colors.grey[100],
//             fontSize: (loadingSpinnerCtx.text.length <= 22) ? 13 : 11 }}>
//             {loadingSpinnerCtx.text}
//         </span>
//     </Box>
// }



// const loadingSpinnerCtx = useSpiderStore((state) => state.loadingSpinnerCtx)
//     const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx)
//     const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx)





// let isRecreateScenario = (recScenarioExistingLayers && (recScenarioExistingLayers.length > 0)) ? true : false;
        // let existingRoutinglayers = getRoutingLayerNames(recScenarioExistingLayers ?? []);
        // let allowZeroRoutingLayerSelection = ((isRecreateScenario === false) || (existingRoutinglayers.length === 0) || (projectInterFaceCount === 0)) ? true : false;
        




// let stackupGenInfo: StackupGenInfo = {
//     projectId: projectId,
//     type : knownStackupTechnologyTypes.get(data.technologyField) ?? '',
//     technology: data.technologyField,
//     isEmib: data.isEmibField,
//     isAsymetricStack: data.isAsymetricStackField,
//     isBSRLayer: data.isBSRLayerField,
//     separateFrontSideBackSideGrouping: data.separateFrontSideBackSideGroupingField,

//     cZeroThickness: data.cZeroThicknessField,

//     frontSideMetalLayers: data.frontSideMetalLayersField,
//     frontCoreMetalLayers: data.frontCoreMetalLayersField,
//     backCoreMetalLayers: data.backCoreMetalLayersField,
//     backSideMetalLayers: data.backSideMetalLayersField,

//     corelessLayers: data.corelessLayersField,

//     coreThickness: data.coreThicknessField,
//     coreMaterial: data.coreMaterialField,

//     dielectricOnCoreThickness: data.dielectricOnCoreThicknessField,
//     dielectricThickness: data.dielectricThicknessField,
//     dielectricMaterial: data.dielectricMaterialField,
//     corelessDielectricThickness: data.corelessDielectricThicknessField,
//     corelessDielectricMaterial: data.corelessDielectricMaterialField,

//     solderResistThickness: data.solderResistThicknessField,
//     solderResistMaterial: data.solderResistMaterialField,

//     buildupMetalThickness: data.buildupMetalThicknessField,
//     corelessBuildupMetalThickness: data.corelessBuildupMetalThicknessField,
//     coreMetalThickness: data.coreMetalThicknessField,
//     metalType: data.metalTypeField,
//     tags: []
// }