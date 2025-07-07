import { Box, Button, Divider, IconButton, InputBase, Link, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, DragEvent, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, tokens } from "../../theme";
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { CONFIGITEM__Rule_Area_Settings, NamingContentTypeEnum, PermissionActionEnum, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import styled from "@emotion/styled";
import { Cancel, CancelOutlined, CheckOutlined, PlaylistAddCheckCircleOutlined, PlaylistAddOutlined } from "@mui/icons-material";
import { assessAllDefaultConstraintNames, checkDuplicatesIgnoreCase, getXmodSelectableOptions, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { PackageLayout, Project, RuleArea } from "../../DataModels/ServiceModels";
import { css } from '@emotion/react'
import { ColDef, ColGroupDef, GridApi } from "ag-grid-community";
import { useDisclosure } from "@mantine/hooks";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import { LoadingSpinnerInfo, LoggedInUser, SPDomainData } from "../../DataModels/HelperModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { updateRuleAreas } from "../../BizLogicUtilities/FetchData";
import { AgGridReact } from "ag-grid-react";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";
import { sort } from "fast-sort";
import { SpButton } from "../../CommonComponents/SimplePieces";



interface RuleAreasProps {
}

const RuleAreas: React.FC<RuleAreasProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as SPDomainData;
    const pkglayout = domainData.packageLayout;
    const project = domainData.project as Project;
    const defCons = domainData.defaultConstraints;

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const initConfigs = useSpiderStore((state) => state.initConfigs);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    
    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()

    const [defaultConstraintNames, setDefaultConstraintNames] = useState<Map<string, string>>(new Map<string, string>())
    const [ruleAreas, setRuleAreas] = useState<RuleArea[]>([])

    const [gridApi, setGridApi] = useState<GridApi>();
 

    useEffect(() => {
        placePageTitle("RuleAreas")
    }, []);
    

    const xmodOptions = useMemo(() => {
        let res : string[] = getXmodSelectableOptions(initConfigs, defCons);
        return res;
    }, [initConfigs]);

    
    useMemo(() => {
        let defconNamesMap = assessAllDefaultConstraintNames(defCons);
        setDefaultConstraintNames(defconNamesMap)
    }, []);


    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "#",
            valueGetter: "node.rowIndex + 1",
            minWidth: 58,
            width: 58,
            maxWidth: 58,
            resizable: false,
            editable: false,
            sort: "asc",
        },
        {
            headerName: "Remove",
            resizable: false,
            autoHeight: true,
            minWidth: 150,
            width: 150,
            maxWidth: 150,
            sortable: false,
            editable: false,
            hide: false,
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left'} },
            cellRenderer: function(params: any) {
                return (
                    <Tooltip key={`ra-${params.data.ruleAreaName}`} placement="top" title={`Delete rule area '${params.data.ruleAreaName}'`}>
                        <span>
                            <IconButton onClick={(e) => onRemoveRuleArea(e, params.data as RuleArea)}>
                                <Cancel sx={{color: SPECIAL_RED_COLOR }} key={`lg-rem-${params.data.ruleAreaName}`}/>
                            </IconButton>
                        </span>
                    </Tooltip>
                )
            },            
        },
        {
            headerName: "Enabled?",
            field: "isActive",
            resizable: false,
            cellDataType: 'boolean',
            autoHeight: true,
            minWidth: 150,
            width: 150,
            maxWidth: 150,
            sortable: false,
            editable: true,
            hide: false,
            cellStyle: (params: any) => { return { fontWeight: 'Bold', textAlign: 'left', color: "white"} },          
        },
        {
            headerName: "Rule Area",
            field: "ruleAreaName",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 150,
            width: 150,
            autoHeight: true,
            sortable: true,
            editable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "XMod",
            field: "xmodName",
            rowGroup: false,
            resizable: true,
            minWidth: 250,
            width: 250,
            editable: true,
            cellEditorPopup: false,
            enableCellChangeFlash: false,
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: {
                values: xmodOptions,
            },
        },
        {
            headerName: "Default Constraints Set",
            field: "defaultConstraintId",
            rowGroup: false,
            resizable: true,
            minWidth: 250,
            width: 250,
            editable: true,
            cellEditorPopup: false,
            enableCellChangeFlash: false,
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: {
                values: Array.from(defaultConstraintNames.values())
            },
            valueGetter: (params: any) => {
                return defaultConstraintNames?.get((params.data as RuleArea).defaultConstraintId) ?? '';
            },
            valueSetter: (params: any) => {
                const filtered = [...defaultConstraintNames.entries()].filter(([key, value]) => value === params.newValue);
                (params.data as RuleArea).defaultConstraintId = filtered[0][0];
                return true;
            },
        },
    ];
    

    function onRemoveRuleArea(event: any, ruleArea: RuleArea): void {
        let others = [...ruleAreas].filter(a => a.id !== ruleArea.id)
        setRuleAreas(others)
    }


    function handleRuleAreaAdd(): void {
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Select name and type of new rule area",
            selectionLabel: "Select Rule Area Type", 
            textMainLabel: "Specify Rule Area Name", 
            selectionCtrlOptions: xmodOptions,
            showSelectionCtrl: true,
            showTextMainCtrl: true,
            contextualInfo: { key: "Add_RuleArea", value: null }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }


    function onGenInfoDataAvailable(data: GeneralInfoUIContext | null): void {
        if(data && data.contextualInfo) {
            if(data.contextualInfo.key === "Add_RuleArea") {
                let name = data?.textMain?.trim()
                let xmod = data?.selection
                if(name && name.length > 0 && xmod && xmod.length > 0) {
                    try { verifyNaming([name], NamingContentTypeEnum.RULE_AREA) }
                    catch (e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    let existingNames = ruleAreas.map(a => a.ruleAreaName) ?? []
                    let result = checkDuplicatesIgnoreCase([name, ...existingNames])
                    if(result == false) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `Cannot add new rule area. A rule area with the name '${name}' already exists`);
                    }
                    else{
                        let newRA : RuleArea = {
                            id: "",
                            ruleAreaName: name,
                            xmodName: xmod,
                            isActive: true,
                            defaultConstraintId: "",
                            visibilityContext: [],
                            tags: []
                        }
                        let newRuleAreaList = [...ruleAreas, newRA]
                        setRuleAreas(newRuleAreaList)
                    }
                }
            }
        }
    }


    async function handleSaveRuleAreas(): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPDATE_RULE_AREAS) === false) { return; }
        if(ruleAreas && ruleAreas.length > 0) {
            let pkgToUpdate = {...pkglayout}
            pkgToUpdate.ruleAreas = ruleAreas;
            try { verifyNaming(ruleAreas.map(a => a.ruleAreaName), NamingContentTypeEnum.RULE_AREA) }
            catch (e: any) {
                displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                return;
            }
            setLoadingSpinnerCtx({enabled: true, text: "Now processing rule area updates. Please wait..."} as LoadingSpinnerInfo)
            let pkg : PackageLayout = await updateRuleAreas(pkgToUpdate as PackageLayout).finally(() => { cancelLoadingSpinnerCtx() })
            if(pkg) {
                pkg.ruleAreas = pkg.ruleAreas.sort((a, b) => a.ruleAreaName < b.ruleAreaName ? -1 : 1);
                setRuleAreas(pkg.ruleAreas as RuleArea[])
                displayQuickMessage(UIMessageType.SUCCESS_MSG, "RuleArea update process completed")
            }
        }
    }


    const onGridReady = useCallback((params: any) => {
            setGridApi(params.api as GridApi);
            let raSorted = sort(pkglayout?.ruleAreas ?? []).asc(x => x.ruleAreaName);
            setRuleAreas(raSorted);
    }, []);


    return (
        <Box>
            <Box flexDirection="column" alignItems="center">
                <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"100%", m: "1px"}}>
                    <SpButton
                        onClick={handleRuleAreaAdd}
                        key={`rabutton-1`}
                        startIcon={<PlaylistAddOutlined />}
                        sx={{ width:250 }}
                        label="Add Rule Area" />
                    
                    <Divider orientation="vertical" sx={{height: 50, marginLeft: 3, marginRight: 3 }} />
                    
                    <SpButton
                        onClick={handleSaveRuleAreas}
                        key={`rabutton-2`}
                        startIcon={<PlaylistAddCheckCircleOutlined />}
                        sx={{ width:250 }}
                        label="Save" />
                </Box>

                <Box>
                    <div style={{ height: "80vh"}}> 
                        <AgGridReact
                            rowData={ruleAreas ?? []}
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
                            domLayout={"normal"}
                        />
                    </div>
                </Box>
            </Box>

            {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}

        </Box>
    );
}

export default RuleAreas




/*
<RuleAreaGrid
    setGridApi={setGridApi}
    ruleAreas={gridPkgLayout?.ruleAreas ?? []}
    onChangeRuleAreaStatus={onChangeRuleAreaStatus}
    onRemoveRuleArea={onRemoveRuleArea}
    gridType={CustomGridTypes.RuleArea}
    gridHeight={"80vh"}
    hideEnabledColumn={false}
    hideRemovalColumn={false}
    gridDomLayout="normal" 
    defaultConstraintNames={defaultConstraintNames}
    defaultXmods={defaultXmods} /> 
*/
    