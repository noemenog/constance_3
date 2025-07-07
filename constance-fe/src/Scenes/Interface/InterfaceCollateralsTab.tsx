import { Box, Divider, IconButton, Slide, Tooltip, Typography } from "@mui/material";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { themeDarkBlue, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import FileDropZone from "../../CommonComponents/FileDropZone";
import { FileRejection, FileWithPath, IMAGE_MIME_TYPE, MIME_TYPES, MS_EXCEL_MIME_TYPE, MS_POWERPOINT_MIME_TYPE, MS_WORD_MIME_TYPE, PDF_MIME_TYPE } from "@mantine/dropzone";
import { ColDef, ColGroupDef, GridApi } from "ag-grid-community";
import { ArticleOutlined, AudioFileOutlined, Cancel, CloudDownload, DescriptionOutlined, DownloadForOfflineOutlined, FolderZipOutlined, InsertDriveFileOutlined, IntegrationInstructionsOutlined, PictureAsPdfOutlined, TextSnippetOutlined, VideoFileOutlined } from "@mui/icons-material";
import { Interface, Project } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { PermissionActionEnum, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { BasicKVP, SPDomainData, StorageCollateralInfo, LoadingSpinnerInfo, LoggedInUser } from "../../DataModels/HelperModels";
import { deleteInterfaceCollaterals, downloadInterfaceCollaterals, uploadInterfaceCollaterals } from "../../BizLogicUtilities/FetchData";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import { useDisclosure } from "@mantine/hooks";
import { getFileExtensionWithoutDot } from "../../BizLogicUtilities/UtilFunctions";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";





const OK_FILE_TYPES = new Set([
    "text/plain",  "application/json", "application/xhtml+xml", "application/xml", "text/csv",
    "application/zip", "application/x-zip-compressed", 
    "image/png", "image/gif", "image/jpeg", "image/bmp", "image/svg+xml",
    "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"
])



interface InterfaceCollateralsTabProps {
    iface: Interface|null,
    project: Project|null
}

const InterfaceCollateralsTab: React.FC<InterfaceCollateralsTabProps> = ({ iface, project }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as SPDomainData;
    const collats = domainData.selectedIfaceCollaterals;

    const [gridApi, setGridApi] = useState<GridApi>();
    const [quickFilterText, setQuickFilterText] = useState('')

    const [collaterals, setCollaterals] = useState<StorageCollateralInfo[]>(collats ?? [])
    
    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const containerRef = useRef<any>();
    
    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);

    
    useEffect(() => {
        placePageTitle("InterfaceCollaterals")
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
            headerName: "File Name",
            field: "name",
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 250,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Type",
            field: 'name',
            rowGroup: false,
            hide: false,
            resizable: false,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            width: 200,
            maxWidth: 200,
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} },
            valueGetter: params => {
                return  getFileExtensionWithoutDot(params.data.name)?.toUpperCase() || '';
            }
        },
        {
            headerName: "Size",
            field: 'size',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            width: 200,
            maxWidth: 200,
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Download",
            resizable: false,
            autoHeight: true,
            minWidth: 150,
            width: 150,
            maxWidth: 150,
            sortable: false,
            editable: false,
            hide: false,
            cellStyle: (params: any) => { return { fontWeight : 'normal', textAlign: 'left'} },
            cellRenderer: function (params: any) {
                return (
                    <Tooltip key={`dl-tt-rem-${params.data.name}`} placement="left" title={`Download file: '${params.data.name}'`}>
                        <span>
                            <IconButton onClick={(e) => onFileDownloadAction(e, params.data as StorageCollateralInfo)}>
                                <DownloadForOfflineOutlined fontSize="medium" sx={{color: colors.greenAccent[400] }} key={`coll-dl-${params.data.name}`} />
                            </IconButton>
                        </span>
                    </Tooltip>
                )
            }
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
            cellRenderer: function (params: any) {
                return (
                    <Tooltip key={`rem-tt-rem-${params.data.name}`} placement="left" title={`Delete file: '${params.data.name}'`}>
                        <span>
                            <IconButton onClick={(e) => onFileRemovalAction(e, params.data)}>
                                <Cancel fontSize="medium" sx={{color: SPECIAL_RED_COLOR }} key={`coll-rem-${params.data.name}`} />
                            </IconButton>
                        </span>
                    </Tooltip>
                )
            }      
        },

    ];
    
    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);   
        }
    }, []);

    
    async function onSuccessfulDrop(files: FileWithPath[]): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project as Project, PermissionActionEnum.UPLOAD_COLLATERALS) === false) { return; }
        if(files && files.length > 0) {
            if(files[0].size > 0) {
                displayQuickMessage(UIMessageType.INFO_MSG, `${files.length} file${files.length > 0 ? "s" : ""} retrieved. Now attempting upload....`)
            }

            setLoadingSpinnerCtx({enabled: true, text: `Now uploading interface collateral file. Please be patient. This may take some time...`})
            uploadInterfaceCollaterals(project?._id?.toString() as string, iface?._id?.toString() as string, files).then((resultCollats : StorageCollateralInfo[]) => {
                if(resultCollats && resultCollats.length > 0) {
                    setCollaterals(resultCollats)
                    displayQuickMessage(UIMessageType.SUCCESS_MSG, "interface collaterals upload process has completed")
                }
            })
            .finally(() => {
                setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
            })
            
        }
    }


    async function onFileRejected(fileRejections: FileRejection[]): Promise<void> {
        let names = fileRejections.map(a => a.file.name).join(", ")
        displayQuickMessage(UIMessageType.ERROR_MSG, `File(s) rejected:  '${names}'`)
    }


    function onFileDownloadAction(event: any, data: StorageCollateralInfo): void {
        if (isUserApprovedForCoreAction(loggedInUser, project as Project, PermissionActionEnum.DOWNLOAD_COLLATERALS) === false) { return; }
        setLoadingSpinnerCtx({enabled: true, text: `Now downloading interface collateral file. Please be patient. This may take some time...`})
        downloadInterfaceCollaterals(project?._id?.toString() as string, iface?._id?.toString() as string, data).then((dlHandler: any) => {
            if(dlHandler) {
                let link = dlHandler as HTMLAnchorElement;
                link.click(); //this triggers file download process on browser
                link.remove();
            } 
        })
        .finally(() => {
            setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
        })
    }


    function onFileRemovalAction(event: any, fileInfo: StorageCollateralInfo): void {
        if (isUserApprovedForCoreAction(loggedInUser, project as Project, PermissionActionEnum.DELETE_COLLATERALS) === false) { return; }
        if(fileInfo) {
            let delConfirmData: ConfirmationDialogProps = {
                onFormClosed: onConfirmationDataAvailable,
                title: "Please Confirm",
                warningText_main: `Are you sure you want to delete the file: '${fileInfo.name}' ?`,
                warningText_other: "File will be removed permanently! The system does not maintain a backup for deleted files.",
                actionButtonText: "Proceed",
                enableSecondaryActionButton: false,
                secondaryActionButtonText: "",
                contextualInfo:  { key: "DELETE_COLLAT", value: fileInfo },
            }
            setConfirmationDialogProps(delConfirmData)
            confirmationModalActioner.open()
        }
    }

    
    async function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP) {
        if(contextualInfo && contextualInfo.key) {
            if(contextualInfo.key === "DELETE_COLLAT") {
                if(action === ConfirmationDialogActionType.PROCEED) {
                    let fileInfo: StorageCollateralInfo = contextualInfo.value
                    setLoadingSpinnerCtx({enabled: true, text: `Now deleting interface collateral file. Please be patient. This may take some time...`})
                    deleteInterfaceCollaterals([fileInfo]).then((remainingCollats: StorageCollateralInfo[]) => {
                        if(remainingCollats) {
                            setCollaterals(remainingCollats)
                        }
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
                    })              
                }
            }
        }
    }


    
    return (
        <Box ref={containerRef}>
            <Box>
                <Box>
                    <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
                        <Box width="70%">
                            <FileDropZone
                                height={170} 
                                acceptableMimeTypes={Array.from(OK_FILE_TYPES)}
                                onSuccessfulDrop={onSuccessfulDrop} 
                                onFileRejected={onFileRejected} 
                                multipleFilesAllowed={true}
                            />
                        </Box>
                    </Box>
                </Box>
                
                <Box display="flex" flexDirection={"column"} alignItems={"center"} justifyContent="center" sx={{ mb: 4, mt: 4  }}>
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{ width: "80%" }} />
                    </Slide>
                    <Typography sx={{ fontStyle: "italic", color: SPECIAL_RED_COLOR }}>
                        Please do not upload senstive data. Spider does not have ERM protection. Any document can be downloaded by anyone on the team (and used beyond intended use cases).
                    </Typography>
                    <Slide timeout={{ enter: 800, exit: 400 }} direction="down" in={true} container={containerRef.current}>
                        <Divider sx={{ width: "80%" }} />
                    </Slide>
                </Box>

                <div style={{ height: "44vh" }}>  
                    <AgGridReact
                        rowData={collaterals ?? []}
                        animateRows={true}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        onGridReady={onGridReady}
                        theme={themeDarkBlue}
                        rowSelection={{ mode: "singleRow", checkboxes: false }}
                        suppressExcelExport={false}
                        suppressCsvExport={false}   
                        groupDisplayType='singleColumn'    
                        groupDefaultExpanded={0} 
                        quickFilterText={quickFilterText} 
                        rowHeight={33}
                        headerHeight={28} 
                    />
                </div> 
            </Box>

            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            
        </Box>
    );
}

export default InterfaceCollateralsTab;


