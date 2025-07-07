import { Box, Button, Divider } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi, GridOptions, ICellEditorParams, RowStyle } from 'ag-grid-community';
import { CONFIGITEM__Materials, PermissionActionEnum, STACKUP_ROUTING_DESIG_MIX, STACKUP_ROUTING_DESIG_NONE, STACKUP_ROUTING_DESIG_ROUTING, StackupLayerTypeEnum, UIMessageType } from "../../DataModels/Constants";
import styled from "@emotion/styled";
import { SegmentedCtrlCellRenderer, SegmentedCtrlCellRendererProps } from "../../CommonComponents/SegmentedCtrlCellRenderer";
import { BoltOutlined, Construction, ConstructionOutlined, HelpOutline, LibraryAddOutlined, PlaylistAddCheckCircleOutlined, RestartAltOutlined } from "@mui/icons-material";
import { DisplayOption, LoadingSpinnerInfo, LoggedInUser } from "../../DataModels/HelperModels";
import { useDisclosure } from "@mantine/hooks";
import SetupStackupWizardDialog, { SetupStackupWizardDialogProps } from "../../FormDialogs/StackupWizardDialog";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { BasicKVP, SPDomainData, User } from "../../DataModels/HelperModels";
import { PackageLayout, Project, StackupGenInfo, StackupLayer } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { createStackup, fetchProjectList, getPkgLayoutCollection, updateStackup } from "../../BizLogicUtilities/FetchData";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import { rfdcCopy } from "../../BizLogicUtilities/UtilFunctions";
import { sort } from "fast-sort";
import { SpButton } from "../../CommonComponents/SimplePieces";



interface StackupProps {
}

const Stackup: React.FC<StackupProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as SPDomainData;
    const pkglayout = domainData.packageLayout as PackageLayout;
    const interfaceList = domainData.interfaceList as any[];
    const project = domainData.project as Project

    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const initConfigs = useSpiderStore((state) => state.initConfigs);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled)

    

    const [stackupWizardDialogProps, setStackupWizardDialogProps] = useState<SetupStackupWizardDialogProps>()
    const [stackupWizardDialogModalState, stackupWizardDialogModalActioner] = useDisclosure(false);


    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();

    const [gridApi, setGridApi] = useState<GridApi>();
    const [valueChangeTracker, setValueChangeTracker] = useState<number>(0);
    const [originalSLMap, setOriginalSLMap] = useState<Map<string, StackupLayer>>(new Map<string, StackupLayer>());
    const [stkLayers, setStkLayers] = useState<StackupLayer[]>([])

    const thkTotal = useRef<number>(0);

    useEffect(() => {
        placePageTitle("Stackup")
    }, []);


    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const materials : BasicKVP[] = useMemo(() => {
        let matConf : any = initConfigs.filter(a => a.configName === CONFIGITEM__Materials)?.at(0)?.configValue ?? undefined
        if(matConf && matConf.length > 0) {
            let mats = matConf?.map((a: any, index: number) => ({key: a.name, value: a.type} as BasicKVP))
            return mats
        }
        else {
            return [""]
        }
    }, [initConfigs]);


    const getMainRowGridStyle = (params: any) => {
        if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.Metal) {
            return { background: 'rgba(153, 153, 153, 0.2)' };
        } 
        else if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.Dielectric) {
            return { background: "rgb(224,224,224, 0.2)" };
        } 
        else if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.SolderResist) {
            return { background: 'rgba(0, 153, 153, 0.2)' };
        }
        else if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.PTH) {
            return { background: "rgb(102,0,51, 0.2)" };
        }
    }

    const getStackupWizardRowGridStyle = (params: any) => {
        if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.Metal) {
            return { background: 'rgba(127, 127, 127, 0.2)'} as RowStyle;
        } 
        else if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.Dielectric) {
            return { background: 'rgba(54, 56, 77, 0.1)', color: colors.grey[300] } as RowStyle;
        } 
        else if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.SolderResist) {
            return { background: 'hsla(0, 21.00%, 69.20%, 0.2)', color: colors.grey[300]  } as RowStyle;
        }
        else if (!params.node.group && params.node.data.type && params.node.data.type === StackupLayerTypeEnum.PTH) {
            return { background: "rgba(209, 16, 16, 0.2)", color: colors.grey[300]  } as RowStyle;
        }
        else {
            return undefined
        }
    }

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
        },
        {
            headerName: "Thickness (microns)",
            field: 'thickness',
            resizable: false,
            filter: 'text',
            cellDataType: 'number',
            minWidth: 190,
            editable: true,
            sortable: false,
            onCellValueChanged: onThicknessValueChanged,
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'center' } },
            headerClass: 'ag-align-center-header'
        },
        {
            headerName: "Material",
            field: "material",
            rowGroup: false,
            resizable: true,
            minWidth: 250,
            width: 250,
            editable: true,
            sortable: false,
            cellEditorPopup: false,
            enableCellChangeFlash: false,
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: {
                values: getMaterialOptions,
            },
        },
        
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
        let stkLayerListCopy = rfdcCopy<StackupLayer[]>(stkLayers) as StackupLayer[]
        if(action === STACKUP_ROUTING_DESIG_ROUTING) {
            stkLayerListCopy.forEach(x => x.routingLayerType = STACKUP_ROUTING_DESIG_ROUTING)
        }
        else if (action === STACKUP_ROUTING_DESIG_NONE) {
            stkLayerListCopy.forEach(x => x.routingLayerType = STACKUP_ROUTING_DESIG_NONE)
        }
        setStkLayers(stkLayerListCopy);
    }


    async function getMaterialOptions(params: ICellEditorParams): Promise<string[]> {
        let type : string = params?.node.data.type?.trim()?.toLowerCase();
        let filteredMaterials: string[] = [];

        if (type && type.length > 0) {
            if (type === "dielectric" || type === "pocketdepth") {
                filteredMaterials = materials.filter(x => x.value === "dielectric").map(a => a.key);
            } 
            else if (type === "metal") {
                filteredMaterials = materials.filter(x => x.value === "metal").map(a => a.key);
            } 
            else if (type === "solderresist") {
                filteredMaterials = materials.filter(x => x.value === "sr").map(a => a.key);
            } 
            else if (type === "pth") {
                filteredMaterials = materials.filter(x => x.value === "core").map(a => a.key);
            } 
            else {
                filteredMaterials = [];
            }
        }
        return filteredMaterials;
    }


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
            thkTotal.current = calculateThickness(stkLayers)
        }
        
        setStkLayers(pkglayout?.stackupLayers as StackupLayer[])
        setOrigStkMappingInfo(pkglayout?.stackupLayers as StackupLayer[])
    }, []);


    function setOrigStkMappingInfo(stackupLayers: StackupLayer[]) {
        let map = new Map<string, StackupLayer>();
        let copy = rfdcCopy<StackupLayer[]>(stackupLayers) as StackupLayer[];  //Important to make a real 'copy'!
        copy.forEach(x => { map.set(x.id, x) })
        setOriginalSLMap(map);
    }


    function hasStackupDangerouslyChanged(): boolean {
        let changed = false;
        for(let stk of stkLayers) {
            let origLayer = originalSLMap.get(stk.id) as StackupLayer;
            if(stk.routingLayerType !== origLayer.routingLayerType || stk.thickness !== origLayer.thickness) {
                changed = true;
                break;
            }
        }
        return changed;
    }


    function onThicknessValueChanged(event: any): void {
        thkTotal.current = calculateThickness(stkLayers)
        setValueChangeTracker(valueChangeTracker + 1)
    }

    
    function calculateThickness(stkLayers: StackupLayer[]) {
        let total = 0;
        if (stkLayers.length > 0) {
            for (let i = 0; i < stkLayers.length; i++) {
                total += parseFloat((stkLayers[i].thickness ?? 0).toString())
            }
        }
        return total
    }


    function onStackupSetupAction(): void {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.CREATE_RECREATE_STACKUP) === false) { return; }
        if(stkLayers.length > 0 && interfaceList.length > 0) {
            let stackupRecreateConfirmData: ConfirmationDialogProps = {
                onFormClosed: onConfirmationDataAvailable,
                title: "Please Confirm",
                warningText_main: `WARNING: re-creating the stackup may result in different layer-grouping and changes to non-default constraint values `
                    + `(because the system might not be able to associate existing constraints to new layering scheme). ` 
                    + `If you choose to proceed, you assume full responsibility for verifying the correctness of all user-specified constraints after the stackup has changed. `
                    + `If you choose to proceed, you assume full responsibility for making any corrections to constraints if/where necessary. `
                    + `YOU HAVE BEEN WARNED.`,
                warningText_other: `Please understand the ramifications of proceeding with this action!`,
                actionButtonText: "OK, I understand it now",
                cancelButtonText: "Oh No! Exit Now!",
                upperCaseButtonText: false,
                setCautionActionButtonIntent: true,
                contextualInfo:  { key: "Recreate_Stackup", value: null },
            }
            setConfirmationDialogProps(stackupRecreateConfirmData)
            confirmationModalActioner.open()
            displayQuickMessage(UIMessageType.WARN_MSG, `WARNING! WARNING! WARNING! Recreating the stackup may result in unrecoverable changes to layer groups and routing constraints!`)
        }
        else{
            openStackupWizard();
        }
    }


    function onConfirmationDataAvailable(proceed: ConfirmationDialogActionType, contextualInfo: any): void {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "Recreate_Stackup" && proceed === ConfirmationDialogActionType.PROCEED) {
                openStackupWizard();
            }
            else if(contextualInfo.key === "Stackup_Save" && proceed === ConfirmationDialogActionType.PROCEED) {
                processStackupSave();
            }
        }
    }

    
    async function openStackupWizard(): Promise<void> {
        setLoadingSpinnerCtx({enabled: true, text: "Loading project information for stackup setup process. Please wait..."} as LoadingSpinnerInfo)
        let projList = await fetchProjectList().finally(() => { cancelLoadingSpinnerCtx() });
        projList = ((projList ?? []) as Project[]).filter(x => x._id.toString() !== project._id.toString());
        let projMap = new Map<string, Project>();
        for(let proj of projList) {
            projMap.set(proj._id.toString(), proj)
        }

        setLoadingSpinnerCtx({enabled: true, text: "Loading layout data for stackup setup process. Please wait..."} as LoadingSpinnerInfo)
        let pkgList = await getPkgLayoutCollection().finally(() => { cancelLoadingSpinnerCtx() });
        pkgList = ((pkgList ?? []) as PackageLayout[]).filter(x => 
            x.stackupGenInfo && x.stackupGenInfo.type && x.stackupGenInfo.technology && x.stackupGenInfo.projectId && x.stackupGenInfo.projectId.trim().length > 0);
        let pkgIdToStkInfoMap = new Map<string, [StackupGenInfo, StackupLayer[]]>();
        for(let item of pkgList) {
            pkgIdToStkInfoMap.set(item._id.toString(), [item.stackupGenInfo as StackupGenInfo, item.stackupLayers])
        }

        let dispoList = new Array<DisplayOption>();
        for(let pkg of pkgList) {
            if(projMap.has(pkg.projectId)) {
                let name = projMap.get(pkg.projectId)?.name || '';
                let org = projMap.get(pkg.projectId)?.org || '';
                if(name.trim().length > 0 && org.trim().length > 0) {
                    let dispo : DisplayOption = {id: pkg._id.toString(), label: projMap.get(pkg.projectId)?.name as string, type: projMap.get(pkg.projectId)?.org as string}
                    dispoList.push(dispo)
                }
            }
        }

        let sortedDispoList = sort(dispoList).asc([
            a => (a.type as string).toUpperCase(),
            a => a.label.toUpperCase()
        ])

        let stkWizDlgProps: SetupStackupWizardDialogProps = {
            onFormClosed : onStackupDataAvailable,
            title: (stkLayers.length > 0) ? "Recreate Stackup" : "Create New Stackup",
            projectId : pkglayout?.projectId ?? '',
            recScenarioExistingLayers : stkLayers ?? [],
            onGetStackupGridRowStyle: getStackupWizardRowGridStyle,
            projectInterFaceCount: interfaceList.length,
            sourceDisplayOptions: sortedDispoList,
            pkgIdToStackupInfoMap: pkgIdToStkInfoMap
        }
        setStackupWizardDialogProps(stkWizDlgProps)
        stackupWizardDialogModalActioner.open()
    } 


    async function onStackupDataAvailable(stkData: StackupGenInfo|null): Promise<void> {
        if(stkData) {
            setIsLoadingBackdropEnabled(true)
            let pkg : PackageLayout = await createStackup(stkData, false).finally(() => { setIsLoadingBackdropEnabled(false) });
            if(pkg) {
                pkg.stackupLayers = pkg.stackupLayers.sort((a, b) => a.index < b.index ? -1 : 1);
                thkTotal.current = calculateThickness(pkg.stackupLayers)
                setStkLayers(pkg.stackupLayers as StackupLayer[])
                displayQuickMessage(UIMessageType.SUCCESS_MSG, "Stackup setup process completed")
            }
        }
    }


    async function onSaveAction(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_STACKUP) === false) { return; }
        if(stkLayers && stkLayers.length > 0) {
            if(hasStackupDangerouslyChanged() && interfaceList.length > 0 && pkglayout.layerGroupSets && pkglayout.layerGroupSets.some(a => a.layerGroups.length > 0)) {
                let stackupSaveConfirmData: ConfirmationDialogProps = {
                    onFormClosed: onConfirmationDataAvailable,
                    title: "Please Confirm",
                    warningText_main: `WARNING: changing stackup layer thickness or redefining 'routing layers' may result in different layer-grouping and changes to non-default constraint values `
                        + `(because the system might not be able to associate existing constraints to new layering scheme). ` 
                        + `If you choose to proceed, you assume full responsibility for verifying the correctness of all user-specified constraints after the stackup has changed. `
                        + `If you choose to proceed, you assume full responsibility for making any corrections to constraints if/where necessary. `
                        + `YOU HAVE BEEN WARNED.`,
                    warningText_other: `Please understand the ramifications of proceeding with this action!`,
                    actionButtonText: "OK, I understand it now",
                    cancelButtonText: "Oh No! Exit Now!",
                    upperCaseButtonText: false,
                    setCautionActionButtonIntent: true,
                    contextualInfo:  { key: "Stackup_Save", value: null },
                }
                setConfirmationDialogProps(stackupSaveConfirmData)
                confirmationModalActioner.open()
                displayQuickMessage(UIMessageType.WARN_MSG, `WARNING! WARNING! WARNING! Changing the stackup may result in unrecoverable changes to layer groups and routing constraints!`)
            }
            else{
                processStackupSave();
            }
        }
    }


    async function processStackupSave() {
        let pkgToUpdate = {...pkglayout}
        pkgToUpdate.stackupLayers = stkLayers;

        setLoadingSpinnerCtx({enabled: true, text: "Performing stackup and layer-group reassessment. Please wait..."} as LoadingSpinnerInfo)
        let pkg : PackageLayout = await updateStackup(pkgToUpdate as PackageLayout).finally(() => { cancelLoadingSpinnerCtx() })
        if(pkg) {
            pkg.stackupLayers = pkg.stackupLayers.sort((a, b) => a.index < b.index ? -1 : 1);
            setStkLayers(pkg.stackupLayers as StackupLayer[])
            setOrigStkMappingInfo(pkg.stackupLayers)
            displayQuickMessage(UIMessageType.SUCCESS_MSG, "Stackup update process completed")
        }
    }

    
    let pinnedBorromRowData = [
        {
            name: (stkLayers.length && stkLayers.length > 0) 
                ? `${stkLayers.length.toString()} layers` 
                : `0 layers`,
            type: "",
            routingLayerType: "",
            thickness: thkTotal.current,
            material: ""
        }
    ]



    return (
        <Box flexDirection="column" alignItems="center">
            <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"100%", m: "1px"}}>
                <SpButton
                    onClick={onStackupSetupAction}
                    startIcon={(stkLayers.length > 0) ? <RestartAltOutlined /> : <ConstructionOutlined />}
                    sx={{ width:200 }}
                    label={(stkLayers.length > 0) ? "Recreate Stackup" : "Create Stackup"}
                    intent={(stkLayers.length > 0) ? "caution" : "plain"} 
                />
                
                <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />
                
                <SpButton
                    onClick={onSaveAction}
                    startIcon={(pkglayout.layerGroupSets && pkglayout.layerGroupSets.some(a => a.layerGroups.length > 0)) ? <BoltOutlined /> : <PlaylistAddCheckCircleOutlined />}
                    sx={{ width:200 }}
                    label="Save Changes" 
                    intent={(pkglayout.layerGroupSets && pkglayout.layerGroupSets.some(a => a.layerGroups.length > 0)) ? "caution" : "plain"} />
            </Box>
            
            <Box sx={{ overflowY: "scroll" }}>
                
                <div style={{ height: "83vh", marginRight: 10}}>
                    <AgGridReact
                        rowData={stkLayers ?? []}
                        animateRows={true}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        onGridReady={onGridReady}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={false}
                        suppressCsvExport={false}   
                        groupDisplayType='singleColumn'    
                        groupDefaultExpanded={1}
                        rowHeight={33}
                        cellSelection={true}
                        enableCharts={true}
                        pinnedBottomRowData={pinnedBorromRowData}
                        getRowStyle={getMainRowGridStyle}
                        domLayout="autoHeight"
                    />
                </div>

            </Box>
            
            {stackupWizardDialogModalState && <SetupStackupWizardDialog opened={stackupWizardDialogModalState} close={stackupWizardDialogModalActioner.close} {...stackupWizardDialogProps as SetupStackupWizardDialogProps} />}
            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }

        </Box>
    );
}

export default Stackup












// {stackupWizardDialogModalState && <SetupStackupWizardDialog opened={stackupWizardDialogModalState} 
// close={stackupWizardDialogModalActioner.close}
// onFormClosed={onStackupDataAvailable}
// title={(stkLayers.length > 0) ? "Recreate Stackup" : "Create New Stackup"}
// projectId={pkglayout?.projectId ?? ''}
// recScenarioExistingLayers={stkLayers ?? []} 
// onGetStackupGridRowStyle={getStackupWizardRowGridStyle}
// projectInterFaceCount={interfaceList.length} />
// }



    // if(gridApi) { gridApi.setGridOption('rowData', pkg.stackupLayers ?? []) }

    //=============================

    // function getArrangedGridData(): Array<StackupLayer> {
    //     let rowData: Array<StackupLayer> = []
    //     if(gridApi) { gridApi.forEachNode(node => rowData.push(node.data)) }
    //     if(rowData.length > 0) {
    //         return rowData;
    //     }
    //     else {
    //         return [];
    //     }
    // }


    
    // function getPinnedBorromRowData() {
    //     let prd = [
    //         {
    //             name: stkLayers.length.toString() + " layers",
    //             type: "",
    //             routingLayerType: "",
    //             // thickness: calculateThickness(),
    //             thickness: thkTotal.current,
    //             material: ""
    //         }
    //     ]
    //     return prd;
    // }
