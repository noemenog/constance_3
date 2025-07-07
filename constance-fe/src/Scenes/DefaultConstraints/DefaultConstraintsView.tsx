import { Autocomplete, AutocompleteChangeReason, Box, Button, Divider, IconButton, InputBase, Link, Slide, TextField, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, tokens } from "../../theme";
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi, GridOptions, ICellRendererParams, SuppressKeyboardEventParams, ValueFormatterParams } from 'ag-grid-community';
import { NamingContentTypeEnum, PermissionActionEnum, SPECIAL_DARK_GOLD_COLOR, UIMessageType } from "../../DataModels/Constants";
import styled from "@emotion/styled";
import FileDropZone from "../../CommonComponents/FileDropZone";
import { FileWithPath, FileRejection } from "@mantine/dropzone";
import { assessAllDefaultConstraintNames, getDateAppendedName, getHumanReadableByteSize, getXmodSelectableOptions, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import SimpleTextDialog, { SimpleTextDialogProps } from "../../FormDialogs/SimpleTextDialog";
import { useDisclosure } from "@mantine/hooks";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { CheckOutlined, CopyAllOutlined, FileCopyOutlined, GradingOutlined, NextPlanOutlined } from "@mui/icons-material";
import { createEditableDefaultConstraints, forceOverwriteWithDefaultConstraints, getDefaultConstraints, getPkgLayout, saveDefaultConstraints, uploadDefaultConstraints } from "../../BizLogicUtilities/FetchData";
import { DefaultConstraints, DefConEntry, PackageLayout, Project } from "../../DataModels/ServiceModels";
import { BasicKVP, LoadingSpinnerInfo, LoggedInUser, QuickStatus, SPDomainData } from "../../DataModels/HelperModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import { SpButton } from "../../CommonComponents/SimplePieces";



interface DefaultConstraintsViewProps {
}

const DefaultConstraintsView: React.FC<DefaultConstraintsViewProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as SPDomainData;
    const pkg = domainData.packageLayout;
    const project = domainData.project as Project;
    const incomingGoldenDefCon = domainData.defaultConstraints;

    const containerRef = useRef<HTMLElement>(null);  //important!
    
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const initConfigs = useSpiderStore((state) => state.initConfigs);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    
    const [simpleTextModalState, simpleTextModalActioner] = useDisclosure(false);
    const [simpleTextDialogProps, setSimpleTextDialogProps] = useState<SimpleTextDialogProps>()
    
    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [pkgLayout, setPkgLayout] = useState<PackageLayout>(pkg as PackageLayout);
    const [defaultConstraintNames, setDefaultConstraintNames] = useState<Map<string, string>>();
    const [focusDefCon, setFocusDefCon] = useState<DefaultConstraints|null>(incomingGoldenDefCon)
    const [goldenDefCon, setGoldenDefCon] = useState<DefaultConstraints|null>(incomingGoldenDefCon)

    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()
    
    const [isGoldenSelected, setIsGoldenSelected] = useState<boolean>();
    const [allowEdit, setAllowEdit] = useState<boolean>();
    const [gridApi, setGridApi] = useState<GridApi>();

    
    useEffect(() => {
        placePageTitle("DefaultConstraints")
    }, []);
    

    useMemo(() => {
        let defconNamesMap = assessAllDefaultConstraintNames(incomingGoldenDefCon);
        setDefaultConstraintNames(defconNamesMap)  //set initial list of names
    }, []);


    useMemo(() => {
        let value = (focusDefCon && focusDefCon.nameIdentifier && (focusDefCon.nameIdentifier === goldenDefCon?.nameIdentifier)) ? true : false;
        setIsGoldenSelected(value);
    }, [focusDefCon, allowEdit]);


    useMemo(() => {
        if(!focusDefCon || focusDefCon === null) { return false; } 
        if(!goldenDefCon || goldenDefCon === null) { return false; } 
        let value = (focusDefCon && focusDefCon.nameIdentifier && (focusDefCon.nameIdentifier !== goldenDefCon?.nameIdentifier)) ? true : false;
        setAllowEdit(value);
    }, [focusDefCon, goldenDefCon, defaultConstraintNames]);


    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const autoGroupColumnDef = {
        flex: 1,
        minWidth: 190,
        width: 190,
        cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
    }


    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "Region",
            field: "xmodName",
            rowGroup: true,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            // autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Layer",
            field: 'layerName',
            rowGroup: true,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 120,
            width: 120,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Constraint Type",
            field: 'constraintType',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 120,
            width: 120,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Rule Name",
            field: 'name',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 120,
            width: 120,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Value",
            field: 'value',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 120,
            width: 120,
            sort: "asc",
            sortable: true,
            editable: allowEdit,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} },
            valueSetter: (params: any) => { 
                let valCheckResult : boolean = verifyEditableDefConValueChange(params.data, params.newValue)
                if(valCheckResult === true) {
                    params.data.value = params.newValue
                    return true;
                }
                else {
                    return true;
                }
            },
        },
        
    ];
    
    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
    }, []);

    
        
    function verifyEditableDefConValueChange(existingData: DefConEntry, newValue: string): boolean {
        if(allowEdit === true) {
            let relevantXMods = pkgLayout?.ruleAreas.map(a => a.xmodName.toUpperCase()) ?? []
            let goldenCopyDCEntry = goldenDefCon?.constraints.find(a => a.id === existingData.id)
            if(existingData && goldenCopyDCEntry) {
                let gldNum = parseFloat(goldenCopyDCEntry.value)
                let newNum = parseFloat(newValue)
                if(newNum < gldNum) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `New value [${newNum}] cannot be less than corresponding value in golden copy [${gldNum}]`)
                    return false;
                }
                if(relevantXMods.includes(existingData.xmodName.toUpperCase()) === false) {
                    //this is mainly for APD export. We dont want the user to get the idea that the "DEFAULT" region in editable dataset will determine "default" rules that are assigned on the nets/netclasses/DPs level.
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Region [${existingData.xmodName}] is not currently relevant for this project. Values for this region are not editable`)
                    return false;
                }
                else {
                    return true
                }
            }
        }
        
        return false;
    }


    async function onSuccessfulFileDrop(files: FileWithPath[]): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPLOAD_DEFCON_FILE) === false) { return; }
        let datasetName = getDateAppendedName(`Default`)
        let noNoValues : string[] = [project?.name as string]
        let warning = "";
        if(defaultConstraintNames && defaultConstraintNames.size > 0) {
            noNoValues = noNoValues.concat(Array.from(defaultConstraintNames.values()))
            warning = `Warning! All previous editable and non-editable default-constraint datasets will be deleted!`;
        }
        if(files && files.length > 0) {
            //NOTE: file extention check is also handled at middleware
            if(files[0].name.toLowerCase().trim().endsWith(".vbs") === false) {
                if(files[0].name.toLowerCase().trim().endsWith(".csv") === false) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Error! file type/extension is not acceptable. FileName: '${files[0].name}'`)
                    return;
                }
            }
            
            if(files[0].size > 0) {
                displayQuickMessage(UIMessageType.INFO_MSG, `File provided: '${files[0].name}'. File size: ${getHumanReadableByteSize(files[0].size)}'`)
            }

            let simpleTextDialogProps: SimpleTextDialogProps = {
                onFormClosed: onSimpleTextDataAvailable,
                title: "Specify unique name for default-constraint set",
                warningText: warning,
                defaultValue: datasetName,
                unacceptbleValues: noNoValues,
                contextualInfo: { key: "Upload_DefCon", value: files },
            }
            setSimpleTextDialogProps(simpleTextDialogProps)
            simpleTextModalActioner.open()
        }
        else{
            displayQuickMessage(UIMessageType.ERROR_MSG, "Error! Could not process file upload.")
        }
    }


    async function onFileRejected(fileRejections: FileRejection[]): Promise<void> {
        let name = fileRejections.map(a => a.file.name).at(0)
        displayQuickMessage(UIMessageType.ERROR_MSG, `File '${name}' was rejected.`)
    }


    function onNameIdentifierSelection(event: any, value: any, reason: AutocompleteChangeReason, details: any): void {
        if(value && value.length > 0 && project) {
            getDefaultConstraints(project._id.toString(), value, false, false).then((dc: DefaultConstraints) => {
                setFocusDefCon(dc)
            })
        }
    }


    async function onSaveEditableData(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_EDITABLE_DEFCON_COPY) === false) { return; }
        if(allowEdit) {
            if(focusDefCon && focusDefCon?.constraints && focusDefCon?.constraints.length > 0) {
                let resultDefConstr : DefaultConstraints = await saveDefaultConstraints(focusDefCon)
                if(resultDefConstr) {
                    setFocusDefCon(resultDefConstr)
                    displayQuickMessage(UIMessageType.SUCCESS_MSG, "Default constraints 'save' action completed")
                }
            }
        }
    }

    function onCreateEditableCopy(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CREATE_EDITABLE_DEFCON_COPY) === false) { return; }
        if(isGoldenSelected === true && allowEdit === false) {
            let noNoValues : string[] = [project?.name as string]
            if(defaultConstraintNames && defaultConstraintNames.size > 0) {
                noNoValues = noNoValues.concat(Array.from(defaultConstraintNames.values()))
            }
            let datasetName = getDateAppendedName(`Editable`)
            let simpleTextDialogProps: SimpleTextDialogProps = {
                onFormClosed: onSimpleTextDataAvailable,
                title: "Specify unique name for editable default-constraints dataset",
                defaultValue: datasetName,
                unacceptbleValues: noNoValues,
                contextualInfo: { key: "New_Editable", value: null },
            }
            setSimpleTextDialogProps(simpleTextDialogProps)
            simpleTextModalActioner.open()
        }
    }


    async function checkAndHandleOrphanedRuleAreas(file: FileWithPath, datasetName: string) : Promise<boolean> {
        let resultDefCon : DefaultConstraints = await uploadDefaultConstraints(file, project?._id?.toString() as string, datasetName, null, true);
         if(resultDefCon) {
            let res = getXmodSelectableOptions(initConfigs, resultDefCon);
            let uppercaseUniqeVals = new Set<string>(res.map(a => a.toUpperCase() ??[]));
            let orphanRAs = pkgLayout?.ruleAreas.filter(a => uppercaseUniqeVals.has(a.xmodName.toUpperCase()) === false)
            if(orphanRAs && orphanRAs.length > 0) {
                displayQuickMessage(UIMessageType.INFO_MSG, "To accept the imported default constraints file, Xmod selection must be corrected for some rule areas")
                let nameBasedMap = new Map<string, string[]>();
                let nameToIdMap = new Map<string, string>();
                orphanRAs.forEach(a => {
                    nameBasedMap.set(a.ruleAreaName, res);
                    nameToIdMap.set(a.ruleAreaName, a.id);
                });
                orphanRAs.forEach(a => nameBasedMap.set(a.ruleAreaName, res))
                let giDialogProps: GeneralInfoDialogProps = {
                    title: "Select xmod for rule area",
                    showMapperCtrl: true,
                    mapperItems: nameBasedMap,
                    contextualInfo: { key: "ADJUST_XMOD", value: null },
                    onFormClosed: async (data: GeneralInfoUIContext | null) => {
                        if (data && data.contextualInfo) {
                            if (data.contextualInfo.key === "ADJUST_XMOD") {
                                if(data.mapper && data.mapper.size > 0 && Array.from(data.mapper.values()).every(x => x && x.trim().length > 0)) {
                                    let submissionMap = new Map<string, string>();
                                    data.mapper.forEach((value: string, key: string) => {
                                        submissionMap.set(nameToIdMap.get(key) as string, value)
                                    });
                                    await processNewDefConData(file, datasetName, submissionMap);
                                    getPkgLayout(project._id.toString() as string).then((newPkg) => {
                                        if(newPkg) {
                                            setPkgLayout(newPkg);
                                        }
                                    })
                                }
                                else {
                                    displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot accept default constraints content. `
                                        + `Could not determine Xmod selections for the following rule areas: ${Array.from(nameBasedMap.keys()).join(", ")}`);
                                }
                            }
                        }
                    }
                }

                setGeneralInfoDialogProps(giDialogProps)
                generalInfoModalActioner.open()
                return false;
            }
        }
        return true;
    }
    

    async function processNewDefConData(file: FileWithPath, datasetName: string, adjustedRuleAreaXMods: Map<string, string>|null) {
        let resultDefCon : DefaultConstraints = await uploadDefaultConstraints(file, project?._id?.toString() as string, datasetName, adjustedRuleAreaXMods, false);
        if(resultDefCon) {
            if(gridApi) { gridApi.setGridOption('rowData', resultDefCon?.constraints ?? []) }
            let names = assessAllDefaultConstraintNames(resultDefCon)  //Important!
            setDefaultConstraintNames(names)  //Important!
            setGoldenDefCon(resultDefCon)
            setFocusDefCon(resultDefCon)
            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Default constraints upload process completed")
        }
    }

    
    async function onSimpleTextDataAvailable(datasetName: string | null, contextualInfo: BasicKVP): Promise<void> {
        if(contextualInfo && contextualInfo.key && datasetName && datasetName.length > 0) {
            try { verifyNaming([datasetName], NamingContentTypeEnum.DEFAULT_CONSTRAINTS ) }
            catch(e: any){
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }
            if(contextualInfo.key === "Upload_DefCon") {
                let files: FileWithPath[] = contextualInfo.value
                if(files && files.length > 0) {
                    setLoadingSpinnerCtx({enabled: true, text: "Now processing default constraints content...."} as LoadingSpinnerInfo)
                    let res = await checkAndHandleOrphanedRuleAreas(files[0], datasetName).finally(() => { cancelLoadingSpinnerCtx() });
                    if (res === true) {
                        setLoadingSpinnerCtx({enabled: true, text: "Now processing default constraints content. Please wait..."} as LoadingSpinnerInfo)
                        await processNewDefConData(files[0], datasetName, null).finally(() => { cancelLoadingSpinnerCtx() });
                    }
                }
            }
            if(contextualInfo.key === "New_Editable") {
                if(goldenDefCon && goldenDefCon.constraints && goldenDefCon.constraints.length > 0) {
                    let defConPayload: DefaultConstraints = {
                        _id: "", 
                        fileName: "",
                        nameIdentifier: datasetName,
                        description: "",
                        sourceDefaultConstraintsId: goldenDefCon._id.toString(),
                        createdOn: new Date(),
                        constraints: [],
                        isGolden: false,
                        tags: [],
                        projectId: goldenDefCon.projectId,
                        snapshotSourceId: "",
                        contextProperties: [],
                        lastUpdatedOn: new Date()
                    }

                    setLoadingSpinnerCtx({enabled: true, text: "Now creating editable copy of default constraints data...."} as LoadingSpinnerInfo)
                    let resultDefCon : DefaultConstraints = await createEditableDefaultConstraints(defConPayload).finally(() => { cancelLoadingSpinnerCtx() });
                    if(resultDefCon) {
                        if(gridApi) { gridApi.setGridOption('rowData', resultDefCon?.constraints ?? []) }
                        let names = assessAllDefaultConstraintNames(resultDefCon)  //Important!
                        setDefaultConstraintNames(names)  //Important!
                        setFocusDefCon(resultDefCon)
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Editable default-constraints data creation process completed")
                    }
                }
            }
        }
    }
    

    function onOverwriteAllValuesWithDefaults(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.OVERWRITE_WITH_DEFCON_VALUES) === false) { return; }
        let ovConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `By proceeding with this action, all user-entered physical AND clearance routing rules will be replaced by default constraint values!!`,
            warningText_other: `WARNING: Are you sure you want to do this?`,
            actionButtonText: "Overwrite",
            enableSecondaryActionButton: false,
            secondaryActionButtonText: "",
            contextualInfo:  { key: "FORCE_OVERWRITE", value: null },
        }
        setConfirmationDialogProps(ovConfirmData)
        confirmationModalActioner.open()
    }


    async function onConfirmationDataAvailable(proceed: ConfirmationDialogActionType, contextualInfo: any): Promise<void> {
        if(contextualInfo && contextualInfo.key) {
            if(proceed === ConfirmationDialogActionType.PROCEED) {
                if(contextualInfo.key === "FORCE_OVERWRITE") {
                    let result = await forceOverwriteWithDefaultConstraints(project?._id.toString() as string)
                    if(result) {
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "Custom routing rules cleared. Default values established. Carry on...")
                    }
                }
            }
        }
    }




    return (
        <Box flexDirection="column" alignItems="center" ref={containerRef}>
            <FileDropZone 
                height={70} 
                acceptableMimeTypes={[]}
                onSuccessfulDrop={onSuccessfulFileDrop} 
                onFileRejected={onFileRejected} 
                multipleFilesAllowed={false}
            />

            <Slide direction="left" in={true} container={containerRef.current}>
                <Box flexDirection="row" display="flex"  alignItems="center" sx={{  minWidth: 400, width:"100%", m: "1px"}}>
                    <SpButton
                        onClick={onOverwriteAllValuesWithDefaults}
                        key={`override-defcon`}
                        startIcon={<NextPlanOutlined />}
                        sx={{ width:200, minWidth: 125, ml:0, mb:0 }}
                        label="Overwrite with defaults" 
                        intent="caution"
                        disabled={focusDefCon && focusDefCon.constraints && focusDefCon.constraints.length > 0 ? false : true} />
                    
                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />
                    
                    {(allowEdit === true) && <SpButton
                        onClick={onSaveEditableData}
                        key={`save-defcon`}
                        startIcon={<CheckOutlined />}
                        sx={{ width:175, minWidth: 125, ml:0, mb:0 }}
                        label="Save Changes" 
                        disabled={focusDefCon && focusDefCon.constraints && focusDefCon.constraints.length > 0 ? false : true} />}

                    {(isGoldenSelected === true) && <SpButton
                        onClick={onCreateEditableCopy}
                        key={`create-editable`}
                        startIcon={<CopyAllOutlined />}
                        sx={{ width:175, minWidth: 125, ml:0, mb:0 }}
                        label="Create Editable Copy" 
                        disabled={focusDefCon && focusDefCon.constraints && focusDefCon.constraints.length > 0 ? false : true} />}
                    
                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />

                    <Autocomplete 
                        onChange={onNameIdentifierSelection}
                        freeSolo={false}
                        filterSelectedOptions={true}
                        disablePortal
                        disableListWrap
                        disableClearable
                        size="small"
                        id="cb-defConstr"
                        sx={{ minWidth: 295, marginTop: 0, marginBottom: 0 }}
                        options={ (defaultConstraintNames && defaultConstraintNames.size > 0) 
                            ? Array.from(defaultConstraintNames.values())
                            : []
                        }
                        value={focusDefCon?.nameIdentifier ?? ''}
                        renderInput={(params: any) => 
                            <TextField {...params} size="small" label="Select Default Constraint Set" />
                        } 
                        disabled={focusDefCon && focusDefCon.constraints && focusDefCon.constraints.length > 0 ? false : true} />

                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />

                    <Typography color={colors.greenAccent[400]} sx={{ fontSize: 10 }}>{focusDefCon?.fileName ?? ''}</Typography>

                </Box>
            </Slide>
            <Box sx={{ padding: isGoldenSelected ? .2 : 0, backgroundColor: isGoldenSelected ? SPECIAL_DARK_GOLD_COLOR : undefined}} >
                <div style={{ height: "70vh" }}>
                    <AgGridReact
                        rowData={focusDefCon?.constraints ?? []}
                        animateRows={true}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        autoGroupColumnDef={autoGroupColumnDef}
                        onGridReady={onGridReady}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={false}
                        suppressCsvExport={false}   
                        groupDisplayType='singleColumn'    
                        groupDefaultExpanded={1}
                        rowHeight={25}
                        headerHeight={28}
                    />
                </div>
            </Box>

            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}
            {simpleTextModalState && <SimpleTextDialog opened={simpleTextModalState} close={simpleTextModalActioner.close} {...simpleTextDialogProps as SimpleTextDialogProps}  />}
            
        </Box>
    );
}

export default DefaultConstraintsView






// {simpleTextModalState && <SimpleTextDialog opened={simpleTextModalState} close={simpleTextModalActioner.close} {...simpleTextDialogProps as SimpleTextDialogProps}  />}
// {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
// {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}
// {axisVisibilityModalState && <C2CAxisVisibilityDialog opened={axisVisibilityModalState} close={axisVisibilityModalActioner.close} {...axisVisibilityDialogProps as C2CAxisVisibilityDialogProps} />}
// {g2gLayoutModalState && <G2GLayoutDialog opened={g2gLayoutModalState} close={g2gLayoutModalActioner.close} {...g2gLayoutDialogProps as G2GLayoutDialogProps} />}
// {constraintEditorDialogModalState && <ConstraintEditorDialog opened={constraintEditorDialogModalState} close={constraintEditorDialogModalActioner.close} {...constraintEditorDialogProps as ConstraintEditorDialogProps} />}
// {linkageManagementModalState && <LinkageManagementDialog opened={linkageManagementModalState} close={linkageManagementModalActioner.close} {...linkageManagementDialogProps as LinkageManagementDialogProps} />}
// {simpleTextModalState && <SimpleTextDialog opened={simpleTextModalState} close={simpleTextModalActioner.close} {...simpleTextDialogProps as SimpleTextDialogProps}  />}