import { Autocomplete, Box, Button, Divider, IconButton, InputBase, Link, Slide, TextField, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, tokens } from "../../theme";
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, FirstDataRenderedEvent, GridApi, IDetailCellRendererParams } from 'ag-grid-community';
import { ActionSceneEnum, NamingContentTypeEnum, SPECIAL_RED_COLOR, UIMessageType, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_GOLD_COLOR, BUCKETLIST, CONFIGITEM__Disabled_Apps, EnvTypeEnum } from "../../DataModels/Constants";
import styled from "@emotion/styled";
import { dark } from "@mui/material/styles/createPalette";
import { useDisclosure } from "@mantine/hooks";
import { LibraryAddOutlined, PlaylistAddCheckCircleOutlined, UnfoldLessDoubleOutlined, UnfoldMoreDoubleOutlined } from "@mui/icons-material";
import { BasicKVP, BasicProperty, PropertyItem, CDomainData, User } from "../../DataModels/HelperModels";
import { useCStore } from "../../DataModels/ZuStore";
import { groupBy, performBackendCall, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { LoadingSpinnerInfo, LoggedInUser } from "../../DataModels/HelperModels";
import { SpButton } from "../../CommonComponents/SimplePieces";
import { AppInfo, Bucket } from "../../DataModels/ServiceModels";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import { addNewAppInfo } from "../../BizLogicUtilities/FetchData";



interface AppInfoListProps {
}

const AppInfoList: React.FC<AppInfoListProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as CDomainData;
    const appInfoColl = domainData.appInfoCollection;

    const placePageTitle = useCStore((state) => state.placePageTitle);
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const clearCurrentAppInfo = useCStore((state) => state.clearCurrentAppInfo);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);
    const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
    const initConfigs = useCStore((state) => state.initConfigs);
    const selectedEnvironment = useCStore((state) => state.selectedEnvironment);
    const setSelectedEnvironment = useCStore((state) => state.setSelectedEnvironment);

    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()

    const [appInfoList, setAppInfoList] = useState<AppInfo[]>([]);
    const [groupExpandValue, setGroupExpandValue] = useState<number>(0);

    const [gridApi, setGridApi] = useState<GridApi>();
    const [quickFilterText, setQuickFilterText] = useState('')
    
    const userHasProjectsIndicatorRef = useRef<boolean>(false);
    const containerRef = useRef<any>();


    useEffect(() => {
        placePageTitle("Applist")
    }, []);
    

    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const autoGroupColumnDef = {
        minWidth: 200,
        width: 200,
        maxWidth: 300,
        headerName: "Owner",
        resizable: true,
    }

    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "Num",
            valueGetter: "node.rowIndex + 1",
            minWidth: 120,
            width: 120,
            maxWidth: 120,
            resizable: false,
            editable: false,
            sort: "asc",
            cellRenderer: "agGroupCellRenderer"
        },
        {
            headerName: "App Name",
            field: "name",
            resizable: true,
            filter: 'text',
            minWidth: 200,
            // sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
            cellRenderer: function(params: any) {
                let agGridProjNameLinkColor = theme.palette.mode === 'dark' ? "#99ccff" : "#0000EE"
                let agGridProjNameLinkColorHover = theme.palette.mode === 'dark' ? "#66b3ff" : "#0000EE"
                return (
                    <Link 
                        sx={{fontSize: 14, color: agGridProjNameLinkColor, ':hover': { fontWeight: 'bold', color: agGridProjNameLinkColorHover }}} 
                        onClick={() => onAppInfoSelected(params.data._id.toString())} 
                        underline="hover">
                        {params.value}
                    </Link>
                )
            }
        },
        {
            headerName: "Owner",
            field: 'owner.idsid',
            rowGroup: false,
            hide: false,
            resizable: false,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 270,
            width: 270,
            maxWidth: 270,
            // sort: "asc",   //Important - DO NOT ENABLE THIS ... EVER!
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Created On",
            field: 'createdOn',
            resizable: false,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 270,
            width: 270,
            maxWidth: 270,
            // sort: "asc",
            sortable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left' } }
        },
        {
            headerName: "Description",
            field: "description",
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            editable: false,
            // sort: "asc",
            sortable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Lock",
            field: "lockedBy",
            rowGroup: false,
            resizable: false,
            filter: 'text',
            minWidth: 150,
            width: 150,
            maxWidth: 150,
            // sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            valueGetter: params => {
                if(params && params.node && params.node.group === true) {
                    return '';
                }
                else if(params && params.data) {
                    if(params.data.lockedBy && params.data.lockedBy.length > 0) {
                        return "ON"
                    }
                }
                return "OFF"
            },
            cellStyle: (params: any) => { 
                return { 
                    fontWeight: 'normal', 
                    color: (params.data && params.data.lockedBy && params.data.lockedBy.length > 0) ? SPECIAL_RED_COLOR : '', 
                    textAlign: 'left' 
                } 
            },
        },
        {
            headerName: "",
            field: "_id",
            hide: true  //Always keep hidden!
        }
    ];
    
    

    let detailCellRendererParams = {
        detailGridOptions: {
            columnDefs: [
                {
                    headerName: "#",
                    valueGetter: "node.rowIndex + 1",
                    minWidth: 120,
                    width: 120,
                    maxWidth: 120,
                    resizable: false,
                    editable: false,
                    sort: "asc",
                },
                {
                    headerName: "Bucket Name",
                    field: "name",
                    resizable: true,
                    filter: 'text',
                    minWidth: 200,
                    // sort: "asc",
                    sortable: true,
                    editable: false,
                    sortingOrder: ["asc", "desc"],
                    cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
                    cellRenderer: function(params: any) {
                        let agGridProjNameLinkColor = theme.palette.mode === 'dark' ? "#99ccff" : "#0000EE"
                        let agGridProjNameLinkColorHover = theme.palette.mode === 'dark' ? "#66b3ff" : "#0000EE"
                        return (
                            <Link 
                                sx={{fontSize: 14, color: agGridProjNameLinkColor, ':hover': { fontWeight: 'bold', color: agGridProjNameLinkColorHover }}} 
                                onClick={() => onAppInfoSelected(params.data._id.toString())} 
                                underline="hover">
                                {params.value}
                            </Link>
                        )}
                },
                {
                    headerName: "Description",
                    field: "description",
                    resizable: true,
                    filter: 'text',
                    cellDataType: 'text',
                    minWidth: 200,
                    editable: false,
                    // sort: "asc",
                    sortable: false,
                    sortingOrder: ["asc", "desc"],
                    cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left' } },
                },
                {
                    headerName: "ConfigCount",
                    field: "lockedBy",
                    resizable: false,
                    filter: 'text',
                    minWidth: 150,
                    width: 150,
                    maxWidth: 150,
                    // sort: "asc",
                    sortable: true,
                    editable: false,
                    sortingOrder: ["asc", "desc"],
                    valueGetter: params => {
                        if(params && params.node && params.node.group === true) {
                            return '';
                        }
                        else if(params && params.data) {
                            //return config count for the bucket
                            return "0"
                            // if(params.data.lockedBy && params.data.lockedBy.length > 0) {
                            //     return "ON"
                            // }
                        }
                        return "0"
                    },
                    cellStyle: (params: any) => { 
                        return { 
                            fontWeight: 'normal', 
                            color: (params.data && params.data.lockedBy && params.data.lockedBy.length > 0) ? SPECIAL_RED_COLOR : '', 
                            textAlign: 'left' 
                        } 
                    },
                },

                // { field: "id" },
                // { field: "name" },
                // { field: "value", minWidth: 150 },
            ],
            defaultColDef: {
                flex: 1,
            },
        },
        getDetailRowData: (params) => {
            let buckets = params?.data?.contextProperties?.find(a => a.name !== BUCKETLIST)?.value ?? []
            params.successCallback(buckets);
        },
    } as IDetailCellRendererParams<AppInfo, Bucket>
    


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }

        if(loggedInUser && loggedInUser.idsid && loggedInUser.idsid.trim().length > 0) {
            let userProjects = appInfoColl.filter(a => a.owner.idsid && (a.owner.idsid.toLowerCase().trim() === loggedInUser.idsid.toLowerCase().trim())) ?? [];
            let others = appInfoColl.filter(a => a.owner.idsid && (a.owner.idsid.toLowerCase().trim() !== loggedInUser.idsid.toLowerCase().trim())) ?? [];
            let combined = [...userProjects, ...others]
            setAppInfoList(combined)

            if(userProjects && userProjects.length > 0) {
                userHasProjectsIndicatorRef.current = true;
            }
        }
        else {
            setAppInfoList(appInfoColl)
        }
    }, []);
    

    function onSearchFieldTextChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
        setQuickFilterText(event.target.value)
    }



    async function onAppInfoSelected(appId: string) {
        if(initConfigs && initConfigs.length > 0) {
            let disabledAppList : string[] = initConfigs.find(a => a.configName === CONFIGITEM__Disabled_Apps)?.configValue ?? [];
            if(disabledAppList && disabledAppList.length > 0) {
                if(disabledAppList.some(x => x.trim().toUpperCase() === appId.trim().toUpperCase())) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Hey ${loggedInUser?.givenName}... the specific App you selected has been disabled. `
                        + `Access is not allowed at this time. Please contact developer or file a ticket. `);
                    return;
                }
            }
        }
        navigate(`/${ActionSceneEnum.APPINFO}/${selectedEnvironment}/${appId}`);               
    }

    
    function expandOnlyFirstGroupElement(event: FirstDataRenderedEvent<any, any>): void {
        let firstGroupNode = event.api.getDisplayedRowAtIndex(0);
        // Check if the node is a group and expand the first group
        if(firstGroupNode && userHasProjectsIndicatorRef.current === true) {
            if (firstGroupNode.group) {
                firstGroupNode.setExpanded(true);
                expandAllDescendants(firstGroupNode);
            }
        }
        function expandAllDescendants(node: any) {
            node.childrenAfterGroup.forEach((childNode: any) => {
                if (childNode.group) {
                    childNode.setExpanded(true);
                    expandAllDescendants(childNode);
                }
            });
        }
    }


    function handleExpandAll(event: any): void {
        setGroupExpandValue(2);
    }


    function handleCollapseAll(event: any): void {
        setGroupExpandValue(0);
        if(gridApi) {
            let firstGroupNode = gridApi.getDisplayedRowAtIndex(0);
            if(firstGroupNode) {
                if (firstGroupNode.group) {
                    firstGroupNode.setExpanded(false);
                }
            }
        }
    }

    

    // function onEnvironmentChanged(value: string | null) {
    //     if(value && value.length > 0) {
    //         setSelectedEnvironment(value as EnvTypeEnum);
    //         navigate(`/list/${value}`);  
    //     } 
    // }

    
    function handleNewAppInfoAction(): void {
        if(selectedEnvironment !== EnvTypeEnum.DEVELOPMENT) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `New AppInfo creation is only allowed under ${EnvTypeEnum.DEVELOPMENT} area.`);
            return;
        }
        let giDialogProps: GeneralInfoDialogProps = {
            onFormClosed: onGenInfoDataAvailable,
            title: "Add Application Info",
            textMainLabel: "Specify App Name", 
            largeTextLabel: "Specify App Description",
            largeTextAreaMinCharLength: 15,
            largeTextAreaValueRequired: true,
            showTextMainCtrl: true,
            showLargeTextCtrl: true,
            contextualInfo: { key: "ADD_APP_INFO", value: null }
        }
        setGeneralInfoDialogProps(giDialogProps)
        generalInfoModalActioner.open()
    }


    
    async function onGenInfoDataAvailable(data: GeneralInfoUIContext | null): Promise<void> {
        if(data && data.contextualInfo) {
            if(data.contextualInfo.key === "ADD_APP_INFO") {
                let name = data?.textMain?.trim()
                let desc = data?.largeText?.trim()
                if(name && name.length > 0 && desc && desc.length > 0) {
                    try { verifyNaming([name], NamingContentTypeEnum.APPINFO) }
                    catch (e: any) {
                        displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
                        return;
                    }
                    let newApp: AppInfo = {
                        _id: "",
                        contextProperties: [],
                        lastUpdatedOn: new Date(),
                        ownerElementId: "",
                        name: name,
                        enabled: false,
                        description: desc,
                        owner: { email: loggedInUser.email, idsid: loggedInUser.idsid },
                        createdOn: new Date(),
                        createdBy: loggedInUser.email,
                        lockedBy: null,
                        associatedProperties: []
                    }
                    setLoadingSpinnerCtx({enabled: true, text: "Now creating new app context. Please wait..."} as LoadingSpinnerInfo)      
                    let addedAppInfo = await addNewAppInfo(EnvTypeEnum.DEVELOPMENT, newApp).finally(() => { cancelLoadingSpinnerCtx() })
                    if(addedAppInfo) {
                        // let res = await setupPermissionsForNewProject(loggedInUser, addedAppInfo, false)
                        // if (res === true) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "New AppInfo added successfully!");
                            clearCurrentAppInfo();
                            navigate(`/${ActionSceneEnum.APPINFO}/${EnvTypeEnum.DEVELOPMENT}/${addedAppInfo._id}/overview`)
                        // }
                    }
                    else{
                        clearCurrentAppInfo();
                        navigate(`/list`);  
                    }
                }
            }
        }
    }



    return (
        <Box ref={containerRef} flexDirection="column" alignItems="center">
            <Box flexDirection="row" display="flex"  alignItems="center" sx={{  width:"100%", m: "1px"}}>
                
                {/* <Box flexDirection="row" display="flex" justifyContent="space-between" alignItems="center" >
                    <Autocomplete 
                        value={selectedEnvironment}
                        onChange={(event: any, value: string | null) => { onEnvironmentChanged(value)}}
                        key="ra-sel-cb"
                        freeSolo={false}
                        filterSelectedOptions={true}
                        disablePortal
                        disableListWrap
                        size="small"
                        id="ra-sel-cb"
                        sx={{ mt:.7, minWidth: 350 }}
                        options={[ EnvTypeEnum.DEVELOPMENT, EnvTypeEnum.PREVIEW, EnvTypeEnum.PRODUCTION ]}
                        renderInput={(params) => <TextField {...params} 
                            label="Select Rule Area" 
                            size="small" 
                            sx={{ '& .MuiInputBase-input': { fontSize: 12.5 } }}
                        />}
                    /> 

                </Box>
                
                <Divider orientation="vertical" sx={{height: 50, marginLeft: 8, marginRight:8, }} />
                 */}
                <Box display="flex" sx={{ backgroundColor: colors.primary[400],  width:"66%"}}>
                    <InputBase size="small" sx={{ ml: 2, flex: 1}}  placeholder="Search" onChange={onSearchFieldTextChange}/>
                    <IconButton sx={{ p: '5px' }}>
                        <SearchIcon />
                    </IconButton>
                </Box>
                
                <Divider orientation="vertical" sx={{height: 50, marginLeft: 8, marginRight:8, }} />
                
                <Box flexDirection="row" display="flex" justifyContent="space-between" alignItems="center" sx={{width: "30%"}}>
                    <SpButton
                        onClick={handleNewAppInfoAction}
                        key={`newapp-button-1`}
                        startIcon={<LibraryAddOutlined />}
                        sx={{ width:250 }}
                        label="Setup New App" 
                    />

                    {(appInfoList && appInfoList.length > 0) && 
                        <Slide timeout={{ enter: 300, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                            <Box flexDirection="row" display="flex" sx={{textAlign:"right", ml: 5 }} >
                                <Tooltip placement="top" title={`Expand All`}>
                                    <IconButton onClick={handleExpandAll} sx={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
                                        <UnfoldMoreDoubleOutlined color="secondary"/>
                                    </IconButton>
                                </Tooltip>
                                <Divider orientation="vertical" sx={{height: 20, marginLeft: 2, marginRight: 2, alignSelf: "center" }} />
                                <Tooltip placement="top" title={`Collapse All`}>
                                    <IconButton onClick={handleCollapseAll} sx={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
                                        <UnfoldLessDoubleOutlined color="secondary" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Slide>
                    }

                </Box>

            </Box>
            <div style={{ height: "80vh" }}>
                
                <AgGridReact
                    rowData={appInfoList ?? []}
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
                    groupDefaultExpanded={groupExpandValue}
                    quickFilterText={quickFilterText}   
                    rowHeight={35}
                    includeHiddenColumnsInQuickFilter={true}
                    onFirstDataRendered={expandOnlyFirstGroupElement}
                    masterDetail={true}
                    detailCellRendererParams={detailCellRendererParams}
                />
            </div>

            <Typography sx={{ml: 1, color: SPECIAL_GOLD_COLOR, fontSize: 11}}>{`Total=${appInfoList.length}`}</Typography>
            
            {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}
           
        </Box>
    );
}

export default AppInfoList


