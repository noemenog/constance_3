import { Box, Button, Divider, IconButton, InputBase, Link, Slide, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, tokens } from "../../theme";
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, FirstDataRenderedEvent, GridApi } from 'ag-grid-community';
import { CONFIGITEM__Maturity_Values, CONFIGITEM__Org_Settings, ActionSceneEnum, NamingContentTypeEnum, SPECIAL_RED_COLOR, UIMessageType, SPECIAL_DARKMODE_TEXTFIELD_COLOR, CONFIGITEM__Disabled_Projects, SPECIAL_BLUE_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_GOLD_COLOR } from "../../DataModels/Constants";
import styled from "@emotion/styled";
import { dark } from "@mui/material/styles/createPalette";
import { useDisclosure } from "@mantine/hooks";
import { LibraryAddOutlined, PlaylistAddCheckCircleOutlined, UnfoldLessDoubleOutlined, UnfoldMoreDoubleOutlined } from "@mui/icons-material";
import { Project } from "../../DataModels/ServiceModels";
import { BasicKVP, BasicProperty, PropertyItem, SPDomainData, User } from "../../DataModels/HelperModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { addNewProject } from "../../BizLogicUtilities/FetchData";
import { groupBy, performBackendCall, verifyNaming } from "../../BizLogicUtilities/UtilFunctions";
import { LoadingSpinnerInfo, LoggedInUser } from "../../DataModels/HelperModels";
import { setupPermissionsForNewProject } from "../../BizLogicUtilities/Permissions";
import ProjectSetupDialog, { ProjectSetupDialogProps } from "../../FormDialogs/ProjectSetupDialog";
import { SpButton } from "../../CommonComponents/SimplePieces";



interface ProjectListProps {
}

const ProjectList: React.FC<ProjectListProps> = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const navigate = useNavigate();
    const domainData = useLoaderData() as SPDomainData;
    const projList = domainData.projectCollection;

    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const clearBasicProjInfo = useSpiderStore((state) => state.clearBasicProjInfo);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useSpiderStore((state) => state.cancelLoadingSpinnerCtx);
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const initConfigs = useSpiderStore((state) => state.initConfigs);
    
    const [projectSetupModalState, projectSetupModalActioner] = useDisclosure(false);
    const [projectSetupDialogProps, setProjectSetupDialogProps] = useState<ProjectSetupDialogProps>();

    const [projectList, setProjectList] = useState<Project[]>([]);
    const [groupExpandValue, setGroupExpandValue] = useState<number>(0);
    const [totalByOrg, setTotalbyOrg] = useState<Map<string, number>>(new Map());
    const [totaStr, setTotalStr] = useState<string>("");

    const [gridApi, setGridApi] = useState<GridApi>();
    const [opened, { open, close }] = useDisclosure(false);
    const [quickFilterText, setQuickFilterText] = useState('')
    
    const userHasProjectsIndicatorRef = useRef<boolean>(false);
    const containerRef = useRef<any>();
    const orgsArrRef = useRef<string[]>([]);


    useEffect(() => {
        placePageTitle("ProjectList")
    }, []);
    

    useMemo(() => {
        let map = new Map<string, number>();
        let orgConf: any[] = initConfigs?.find(a => a.configName === CONFIGITEM__Org_Settings)?.configValue;
        let orgArr = orgConf?.map((a: any) => a.name.trim().toUpperCase()) ?? []
        orgsArrRef.current = orgArr;

        if(projectList && projectList.length > 0) {
            let grpByOrg = groupBy(projectList, a => a.org.trim().toUpperCase());
            for(let org of orgArr) {
                map.set(org, 0)
                if(grpByOrg.has(org)) {
                    map.set(org, Number(grpByOrg.get(org)?.length));
                }
            }
        }
        if(map.size > 0) {
            let total = Array.from(map).concat([["Total", projectList.length]]).map(x => `${x[0]}=${x[1]}`).join(" | ")
            setTotalStr(total);
            setTotalbyOrg(map);
        }
    }, [initConfigs]);


    const maturityValues : string[] = useMemo(() => {
        let maturVals : string[] = initConfigs?.find(a => a.configName === CONFIGITEM__Maturity_Values)?.configValue
        return maturVals ?? []
    }, [initConfigs]);
    

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
            headerName: "Owner",
            field: 'owner.idsid',
            rowGroup: true,
            hide: true,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 120,
            width: 120,
            // sort: "asc",   //Important - DO NOT ENABLE THIS ... EVER!
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Org",
            field: "org",
            rowGroup: true,
            hide: true,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            // sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontWeight: 'normal', textAlign: 'left'} },
        },
        
        {
            headerName: "Project Name",
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
                        onClick={() => onProjectSelected(params.data._id.toString())} 
                        underline="hover">
                        {params.value}
                    </Link>
                )}
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
    
    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }

        if(loggedInUser && loggedInUser.idsid && loggedInUser.idsid.trim().length > 0) {
            let userProjects = projList.filter(a => a.owner.idsid && (a.owner.idsid.toLowerCase().trim() === loggedInUser.idsid.toLowerCase().trim())) ?? [];
            let others = projList.filter(a => a.owner.idsid && (a.owner.idsid.toLowerCase().trim() !== loggedInUser.idsid.toLowerCase().trim())) ?? [];
            let combined = [...userProjects, ...others]
            setProjectList(combined)

            if(userProjects && userProjects.length > 0) {
                userHasProjectsIndicatorRef.current = true;
            }
        }
        else {
            setProjectList(projList)
        }
    }, []);
    

    function onSearchFieldTextChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
        setQuickFilterText(event.target.value)
    }



    async function onProjectSelected(projectId: string) {
        if(initConfigs && initConfigs.length > 0) {
            let disabledProjList : string[] = initConfigs.find(a => a.configName === CONFIGITEM__Disabled_Projects)?.configValue ?? [];
            if(disabledProjList && disabledProjList.length > 0) {
                if(disabledProjList.some(x => x.trim().toUpperCase() === projectId.trim().toUpperCase())) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Hey ${loggedInUser?.givenName}... the specific project you selected has been disabled. `
                        + `Access is not allowed at this time. Please contact developer or file a ticket. `);
                    return;
                }
            }
        }

        navigate(`/${ActionSceneEnum.PROJECT}/${projectId}`);               
    }

    
    function handleNewProjectAction(): void {
        if(!orgsArrRef || !orgsArrRef.current || orgsArrRef.current.length === 0) {
            displayQuickMessage(UIMessageType.ERROR_MSG, "Failed to retrieve configured org list. Please refresh the UI to retry or check config management system.");
            return;
        }

        let psdProps: ProjectSetupDialogProps = {
            onFormClosed: onProjectSetupDataAvailable,
            title: "Create New Project",
            isUpdateScenario: false,
            orgs: orgsArrRef.current,
            maturityValues: maturityValues,
            contextualInfo: { key: "CREATE_PROJECT", value: undefined },
        }
        
        setProjectSetupDialogProps(psdProps)
        projectSetupModalActioner.open()
    }
  

    async function onProjectSetupDataAvailable(contextualInfo: BasicKVP|null): Promise<void> {
        if(contextualInfo && contextualInfo.value) {
            if(contextualInfo.key && contextualInfo.key === "CREATE_PROJECT") {
                let newProj: Project = contextualInfo.value;
                setLoadingSpinnerCtx({enabled: true, text: "Now creating new project. Please wait..."} as LoadingSpinnerInfo)      
                let proj = await addNewProject(newProj).finally(() => { cancelLoadingSpinnerCtx() })
                if(proj) {
                    let res = await setupPermissionsForNewProject(loggedInUser, proj, false)
                    if (res === true) {
                        displayQuickMessage(UIMessageType.SUCCESS_MSG, "New project added successfully!");
                        clearBasicProjInfo();
                        navigate(`/${ActionSceneEnum.PROJECT}/${proj._id}/overview`)
                    }
                }
                else{
                    clearBasicProjInfo();
                    navigate(`/projectlist`)
                }
            }
        }
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
                        onClick={handleNewProjectAction}
                        key={`newproj-button-1`}
                        startIcon={<LibraryAddOutlined />}
                        sx={{ width:250 }}
                        label="Create New Project" 
                    />

                    {(projectList && projectList.length > 0) && 
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
                    rowData={projectList ?? []}
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
                />
            </div>

            <Typography sx={{ml: 1, color: SPECIAL_GOLD_COLOR, fontSize: 11}}>{totaStr}</Typography>
            
            {projectSetupModalState && <ProjectSetupDialog opened={projectSetupModalState} close={projectSetupModalActioner.close} {...projectSetupDialogProps as ProjectSetupDialogProps} />}
        </Box>
    );
}

export default ProjectList

























// async function onNewProjectDataAvailable(newProj: Project|null) {
//     if(newProj && newProj.name.trim().length > 0) {
//         try { verifyNaming([newProj.name], NamingContentTypeEnum.PROJECT) }
//         catch(e: any){
//             displayQuickMessage(UIMessageType.ERROR_MSG, e.message)
//             return;
//         }
        
//         setLoadingSpinnerCtx({enabled: true, text: "Now creating new project. Please wait..."} as LoadingSpinnerInfo)      
//         let proj = await addNewProject(newProj).finally(() => { cancelLoadingSpinnerCtx() })
//         if(proj) {
//             let res = await setupPermissionsForNewProject(loggedInUser, proj, false)
//             if (res === true) {
//                 displayQuickMessage(UIMessageType.SUCCESS_MSG, "New project added successfully!");
//                 clearBasicProjInfo();
//                 navigate(`/${ActionSceneEnum.PROJECT}/${proj._id}/overview`)
//             }
//         }
//         else{
//             clearBasicProjInfo();
//             navigate(`/projectlist`)
//         }
//     }
// }




// function handleNewProjectAction(): void {
//     let newProjDlg: NewProjectDialogProps = {
//         onFormClosed: onNewProjectDataAvailable,
//         orgs: Array.from(totalByOrg.keys()), 
//         maturityValues: maturityValues
//     }
//     setNewProjectDialogProps(newProjDlg)
//     newProjectDialogModalActioner.open()
// }




// valueGetter: params => {
//     if(params && params.data && params.data.associatedProperties && params.data.associatedProperties.length > 0) {
//         let descPropValue = params.data.associatedProperties.filter((a:PropertyItem) => a.name === PROJECT_PROP_DESCRIPTION)?.at(0)?.value ?? ''
//         return descPropValue
//     }
// }






// className={agTheme(theme.palette.mode)} 





                // let deleteAndBail = false
                // if(proj.contextProperties && proj.contextProperties.length > 0) {
                //     let permRolesConfData = proj.contextProperties.find(a => a.name.toUpperCase() === CONF_PERMISSION_ROLES)?.value //NOTE: for new project, perm context is added to contextProps
                //     if(permRolesConfData && permRolesConfData.length > 0) {
                //         let usersPermRoleArray : BasicProperty[] = getInitPermRolesArray(permRolesConfData)
                //         setLoadingSpinnerCtx({enabled: true, text: "Now setting up roles and permissions for newly created project. Please wait..."} as LoadingSpinnerInfo)
                //         displayQuickMessage(UIMessageType.INFO_MSG, "Now setting up roles and permissions for newly created project. This will take some time. Please be patient...", 45000)
                //         let permActionResult : QuickStatus = await setupPermissionsForNewProject(loggedInUser as LoggedInUser, proj, usersPermRoleArray).finally(() => { cancelLoadingSpinnerCtx() })
                //         if(permActionResult.isSuccessful === false) {
                //             displayQuickMessage(UIMessageType.ERROR_MSG, `${permActionResult.message}`);
                //             deleteAndBail = true
                //         }
                //     }
                //     else {
                //         displayQuickMessage(UIMessageType.ERROR_MSG, `Project creation was not successful. Permissions context was not retrieved.`);
                //         deleteAndBail = true
                //     }
                // }
                // else {
                //     displayQuickMessage(UIMessageType.ERROR_MSG, `Project creation was not successful. Permissions were not setup due to missing contextual information.`);
                //     deleteAndBail = true
                // }
                
                // if(deleteAndBail) {
                //     deleteProject(proj._id.toString() as string);
                //     return;
                // }
                // else {
                //     displayQuickMessage(UIMessageType.SUCCESS_MSG, "New project added successfully!");
                //     clearBasicProjInfo();
                //     navigate(`/${ActionSceneEnum.PROJECT}/${proj._id}/overview`)
                // }
                
                // //for good measures
                // cancelLoadingSpinnerCtx();



    // //===========================================================================
    // useEffect(() => {
    //     const initSteps = async () => {
    //         let resp: any = undefined
    //         let url: string = ''
    //         try {
    //             url = "https://constance-mw.app.intel.com/api/v2/development/configs/get?appId=671a335237075b645fe75388&bucketId=671a335237075b645fe75389";
    //             resp = await performBackendCall(url, "GET", null)
    //             console.warn("Resaponse from Constance call:", resp)
    //             alert(resp.data)
    //         }
    //         catch(error: any) {
    //             let msg = `Failed to get app info from config management system. This is a call from frontend --- Error: ${error.message}  --- Address: '${url}' --- response: ${resp}`
    //             alert(msg)
    //             throw new Error(msg)
    //         }
    //     }
    //     initSteps()
    // }, []);
    

    // //============================================================================



// //#region - every page or component has a variation of this section
// const theme = useTheme();
// const colors = tokens(theme.palette.mode);
// const navigate = useNavigate();
// const context = useContext(SpiderContext)
// const location = useLocation()
// const ld : LoaderData = (useLoaderData() as LoaderData); 
// useEffect(() => {
//     placePageTitle(context, location, "ProjectList")
// }, []);
// useMemo(() => {
//     if(ld.pkgLayout && ld.pkgLayout._id.length > 0) {
//         context.PackageLayout = ld.pkgLayout;
//         if(ld.project && ld.project._id.length > 0){
//             context.Project = ld.project;
//         }
//         context.enableShowProjectMenu(true);
//     }
// }, [ld]);
// //#endregion