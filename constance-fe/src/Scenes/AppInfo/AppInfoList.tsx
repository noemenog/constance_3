import { Autocomplete, Box, Button, Divider, IconButton, InputBase, Link, Slide, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, themeDarkWarm, tokens } from "../../theme";
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, FirstDataRenderedEvent, GridApi, ICellRendererComp, ICellRendererParams, IDetailCellRendererParams, RowStyle } from 'ag-grid-community';
import { ActionSceneEnum, NamingContentTypeEnum, SPECIAL_RED_COLOR, UIMessageType, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_GOLD_COLOR, BUCKETLIST, CONFIGITEM__Disabled_Apps, EnvTypeEnum, PermEntityTypeEnum } from "../../DataModels/Constants";
import styled from "@emotion/styled";
import { dark } from "@mui/material/styles/createPalette";
import { useDisclosure } from "@mantine/hooks";
import { LibraryAddOutlined, PlaylistAddCheckCircleOutlined, UnfoldLessDoubleOutlined, UnfoldMoreDoubleOutlined } from "@mui/icons-material";
import { BasicKVP, BasicProperty, PropertyItem, CDomainData, User } from "../../DataModels/ServiceModels";
import { useCStore } from "../../DataModels/ZuStore";
import { groupBy, performBackendCall, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { LoadingSpinnerInfo, LoggedInUser } from "../../DataModels/ServiceModels";
import { SpButton } from "../../CommonComponents/SimplePieces";
import { AppInfo, Bucket } from "../../DataModels/ServiceModels";
import GeneralInfoDialog, { GeneralInfoDialogProps, GeneralInfoUIContext } from "../../FormDialogs/GeneralInfoDialog";
import { addNewAppInfo } from "../../BizLogicUtilities/FetchData";
import { renderToStaticMarkup } from "react-dom/server"
import { setupPermissionsForNewElement } from "../../BizLogicUtilities/Permissions";

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

    const [generalInfoModalState, generalInfoModalActioner] = useDisclosure(false);
    const [generalInfoDialogProps, setGeneralInfoDialogProps] = useState<GeneralInfoDialogProps>()

    const [appInfoList, setAppInfoList] = useState<AppInfo[]>([]);

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
    


    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }

        if(loggedInUser && loggedInUser.idsid && loggedInUser.idsid.trim().length > 0) {
            let userAppInfos = appInfoColl.filter(a => a.owner.idsid && (a.owner.idsid.toLowerCase().trim() === loggedInUser.idsid.toLowerCase().trim())) ?? [];
            let others = appInfoColl.filter(a => a.owner.idsid && (a.owner.idsid.toLowerCase().trim() !== loggedInUser.idsid.toLowerCase().trim())) ?? [];
            
            let userAppInfosSorted = userAppInfos.sort((a, b) => a.name.localeCompare(b.name));
            let othersSorted = others.sort((a, b) => a.name.localeCompare(b.name));
            
            let combined = [...userAppInfosSorted, ...othersSorted]
            setAppInfoList(combined)

            if(userAppInfos && userAppInfos.length > 0) {
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
            let disabledAppList : string[] = initConfigs.find(a => a.name === CONFIGITEM__Disabled_Apps)?.value ?? [];
            if(disabledAppList && disabledAppList.length > 0) {
                if(disabledAppList.some(x => x.trim().toUpperCase() === appId.trim().toUpperCase())) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Hey ${loggedInUser?.givenName}... the specific App you selected has been disabled. `
                        + `Access is not allowed at this time. Please contact developer or file a ticket. `);
                    return;
                }
            }
        }
        navigate(`/${ActionSceneEnum.APPHOME}/${appId}`);               
    }

    
    function onFirstDataRendered(event: FirstDataRenderedEvent<any, any>): void {        
        //do nothing for now...
    }

    
    function handleNewAppInfoAction(): void {
        //___PERM___ if (isUserApprovedForCoreAction(loggedInUser, appInfo, PermissionActionEnum.CLONE_APPINFO) === false) { return; }
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
                        let res = await setupPermissionsForNewElement(loggedInUser, addedAppInfo, PermEntityTypeEnum.APP, false)
                        if (res[0] === true) {
                            displayQuickMessage(UIMessageType.SUCCESS_MSG, "New AppInfo added successfully!");
                            clearCurrentAppInfo();
                            navigate(`/${ActionSceneEnum.APPHOME}/${addedAppInfo._id}/overview`)
                        }
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
                </Box>

            </Box>
            <div id="applist-detail-grid" style={{ height: "80vh"}}>
                
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
                    quickFilterText={quickFilterText}   
                    rowHeight={35}
                    headerHeight={35}
                    includeHiddenColumnsInQuickFilter={true}
                    onFirstDataRendered={onFirstDataRendered}
                />
            </div>

            <Typography sx={{ml: 1, color: SPECIAL_GOLD_COLOR, fontSize: 11}}>{`Total=${appInfoList.length}`}</Typography>
            
            {generalInfoModalState && <GeneralInfoDialog opened={generalInfoModalState} close={generalInfoModalActioner.close} {...generalInfoDialogProps as GeneralInfoDialogProps} />}
           
        </Box>
    );
}

export default AppInfoList










    // const getRowStyle : any = (params: any) => {
    //     if (params.node.detail) {
    //         return { backgroundColor: 'red' };
    //     }
    //     return { color: 'blue' };
    // };



    {/* {(appInfoList && appInfoList.length > 0) && 
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
    } */}







// function onFirstDataRendered(event: FirstDataRenderedEvent<any, any>): void {        
//         let firstGroupNode = event.api.getDisplayedRowAtIndex(0);
//         // Check if the node is a group and expand the first group
//         if(firstGroupNode && userHasProjectsIndicatorRef.current === true) {
//             if (firstGroupNode.group) {
//                 firstGroupNode.setExpanded(true);
//                 expandAllDescendants(firstGroupNode);
//             }
//         }
//         function expandAllDescendants(node: any) {
//             node.childrenAfterGroup.forEach((childNode: any) => {
//                 if (childNode.group) {
//                     childNode.setExpanded(true);
//                     expandAllDescendants(childNode);
//                 }
//             });
//         }
//     }




//    class DetailCellRenderer implements ICellRendererComp {
//         eGui!: HTMLElement;
//         content: JSX.Element;

//         init(params: ICellRendererParams) {
//             let buckets = params?.data?.contextProperties?.find((a:any) => a.name !== BUCKETLIST)?.value ?? []
            
//             this.content = (
//                 <Box sx={{ m: 14, minWidth: 550, alignSelf: "flex-start", overflowY: "auto", maxHeight: 380 }}>
//                     <Box sx={{ ml: 22, mr: 1, }}>
//                         <Table stickyHeader border={1} sx={{ borderTopLeftRadius: 12, backgroundColor: "rgba(102, 153, 153, 0.07)"}}>
//                             <TableHead>
//                                 <TableRow sx={{ padding: 0, backgroundColor: colors.blueAccent[400]}}>
//                                     <TableCell size="small" sx={{ backgroundColor: colors.blueAccent[400], borderTopLeftRadius: 12, minWidth: 200, padding: 0.5, fontSize: 13, textAlign: "center", whiteSpace: "pre-line"}}>
//                                         {`Bucket`}
//                                     </TableCell>

//                                     <TableCell size="small" sx={{ backgroundColor: colors.blueAccent[400], minWidth: 200, padding: 0.5, fontSize: 13, textAlign: "center", whiteSpace: "pre-line"}}>
//                                         {`Config Count`}
//                                     </TableCell>
//                                 </TableRow>
                                
//                             </TableHead>
//                             <TableBody>
//                                 {buckets.map((bucket: Bucket, index: number) => (
//                                     <Fragment key={`bk-frag-${index}`}>
//                                         <TableRow key={`bk-tr-${index}`} >
                                        
//                                             <TableCell size="small" sx={{ minWidth: 30, width: "20%", padding: 0, textAlign: "center" }}>
//                                                 <Tooltip placement="top-start" title={bucket.name}>
//                                                     <Box sx={{ padding: 0, overflowX: "clip"}}>
//                                                         <Typography sx={{ fontSize: 13 }}>{`${bucket.name}`}</Typography> 
//                                                     </Box>
//                                                 </Tooltip>
//                                             </TableCell>

//                                             <TableCell size="small" sx={{ minWidth: 30, width: "20%", padding: 0, textAlign: "center" }}>
//                                                 <Tooltip placement="top-start" title={bucket.description}>
//                                                     <Box sx={{ padding: 0, overflowX: "clip"}}>
//                                                         <Typography sx={{ fontSize: 13 }}>{`${bucket.description}`}</Typography> 
//                                                     </Box>
//                                                 </Tooltip>
//                                             </TableCell>

//                                         </TableRow>

//                                     </Fragment>
//                                 ))}
//                             </TableBody>
//                         </Table>
//                     </Box>
//                 </Box>
//             );


//             this.eGui = document.createElement('div');
//             const staticElement = renderToStaticMarkup(this.content)
//             this.eGui.innerHTML = staticElement

//             // this.eGui.setAttribute('role', 'gridcell');
//             // this.eGui.className = 'cell-renderer-outer';
//             // this.eGui.innerHTML =
//             //     '<form>' +
//             //     '  <div>' +
//             //     '  <div>' +
//             //     '    <label>' +
//             //     '      Call Id:<br>' +
//             //     '    <input type="text" value="' +
//             //     firstRecord.callId +
//             //     '">' +
//             //     '    </label>' +
//             //     '  </div>' +
//             //     '  <div>' +
//             //     '    <label>' +
//             //     '      Number:<br>' +
//             //     '    <input type="text" value="' +
//             //     firstRecord.number +
//             //     '">' +
//             //     '    </label>' +
//             //     '  </div>' +
//             //     '  <div>' +
//             //     '    <label>' +
//             //     '      Direction:<br>' +
//             //     '    <input type="text" value="' +
//             //     firstRecord.direction +
//             //     '">' +
//             //     '    </label>' +
//             //     '  </div>' +
//             //     '</form>' +
//             //     '</div>';
//         }

//         getGui() {
//             return this.eGui;
//         }

//         refresh(params: ICellRendererParams): boolean {
//             return false;
//         }
//     }
