import { Box, Divider, Slide } from "@mui/material";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { themeDarkBlue, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import FileDropZone from "../../CommonComponents/FileDropZone";
import { FileRejection, FileWithPath, MIME_TYPES } from "@mantine/dropzone";
import { ColDef, ColGroupDef, GridApi } from "ag-grid-community";
import { getHumanReadableByteSize } from "../../BizLogicUtilities/UtilFunctions";
import { PermissionActionEnum, UIMessageType } from "../../DataModels/Constants";
import { replaceNetList, uploadNetList } from "../../BizLogicUtilities/FetchData";
import { useDisclosure } from "@mantine/hooks";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../../FormDialogs/ConfirmationDialog";
import FileCaptureDialog, { FileCaptureDialogProps } from "../../FormDialogs/FileCaptureDialog";
import { NetListImportDetail, Project } from "../../DataModels/ServiceModels";
import { BasicKVP, NetSummary, LoadingSpinnerInfo, LoggedInUser } from "../../DataModels/HelperModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";


interface NetListUploadTabProps {
    project: Project,
    netSummary: NetSummary,
    netFileInfoList: NetListImportDetail[]
    onNetsUpdated: () => void
}

interface fileContextInfo {downloadHandler: any, uploadedFile: FileWithPath }

const NetListUploadTab: React.FC<NetListUploadTabProps> = ({ project, netSummary, netFileInfoList, onNetsUpdated }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setLoadingSpinnerCtx = useSpiderStore((state) => state.setLoadingSpinnerCtx);

    const [gridApi, setGridApi] = useState<GridApi>();
    
    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const [fileCaptureModalState, fileCaptureModalActioner] = useDisclosure(false);
    const [fileCaptureDialogProps, setFileCaptureDialogProps] = useState<FileCaptureDialogProps>();

    const [netListActionTakenTracker, setNetListActionTakenTracker] = useState<number>(0);

    const containerRef = useRef<any>();


    useEffect(() => {
        placePageTitle("NetListUpload")
    }, []);
    

    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    useEffect(() => {
        if(netListActionTakenTracker) {
            if(onNetsUpdated) {
                onNetsUpdated()
            }
        }
    }, [netListActionTakenTracker]);
    

    const autoGroupColumnDef = {
        minWidth: 200,
        width: 200,
        maxWidth: 300,
        resizable: true,
        cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
    }

    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "#",
            valueGetter: "node.rowIndex + 1",
            minWidth: 58,
            width: 58,
            maxWidth: 58,
            resizable: false,
            editable: false,
            // sort: "asc",
        },
        {
            headerName: "File Name",
            field: "fileName",
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 250,
            // sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'Bold', textAlign: 'left' } },
        },
        {
            headerName: "Upload Date",
            field: 'date',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            width: 200,
            sort: "desc", //intentional (the default sorted col)
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Total Incomming Nets",
            field: 'totalIncomming',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 180,
            width: 180,
            // sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Prompted Adjustment",
            field: 'adjustment',
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 180,
            width: 180,
            maxWidth: 270,
            // sort: "asc",
            sortable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left' } }
        }

    ];
    
    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
    }, []);

    
     //TODO: we need loading indicator here and message when done
    async function onSuccessfulDrop(files: FileWithPath[]): Promise<void> {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.UPLOAD_NETLIST_FILE) === false) { return; }
        if(files && files.length > 0) {
            let focusFile = files[0];
            if(focusFile.name.toLowerCase().trim().endsWith(".txt") === false) {
                if(focusFile.name.toLowerCase().trim().endsWith(".kyn") === false) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Error! file type/extension is not acceptable. FileName: '${focusFile.name}'`)
                    return;
                }
            }
            
            if(focusFile.size > 0) {
                displayQuickMessage(UIMessageType.INFO_MSG, `File provided: '${focusFile.name}'. File size: ${getHumanReadableByteSize(focusFile.size)}'`)
            }

            if(netSummary && netSummary.hasNets === true && netSummary.totalNets > 0) {
                setLoadingSpinnerCtx({enabled: true, text: `Now uploading net-list. Please be patient. This may take some time...`})
                processNetListReplacement(focusFile, null).then((dlHandler: any) => {
                    if(dlHandler) {
                        let ctx : fileContextInfo = {downloadHandler: dlHandler, uploadedFile: focusFile}
                        handleNetListReplacementActionRequest(ctx)
                    } 
                })
                .finally(() => {
                    setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
                })
            }
            else {
                // No existing nets (basically Scenatio #1)
                setLoadingSpinnerCtx({enabled: true, text: `Now uploading net-list. Please be patient. This may take some time...`})
                processNetListUpload(focusFile, false).then((res) => {
                    if(res) {
                        setNetListActionTakenTracker(netListActionTakenTracker + 1)
                    }
                })
                .finally(() => {
                    setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
                })
            }
        }
        else{
            displayQuickMessage(UIMessageType.ERROR_MSG, "Error! Could not process file upload.")
        }
    }


    async function onFileRejected(fileRejections: FileRejection[]): Promise<void> {
        let name = fileRejections.map(a => a.file.name).at(0)
        displayQuickMessage(UIMessageType.ERROR_MSG, `File '${name}' was rejected.`)
    }


    function handleNetListReplacementActionRequest(ctx: fileContextInfo): void {
        let nlConfirmData: ConfirmationDialogProps = {
            onFormClosed: onConfirmationDataAvailable,
            title: "Please Confirm",
            warningText_main: `The current project already has Nets. Incremental buildup of net-list is not allowed 
            (user is expected to bring in a complete set of nets every time). You may DOWNLOAD existing nets (as CSV) for remapping/renaming & reupload, 
            or you can choose to outright REPLACE existing nets with the incoming set. `,
            warningText_other: `WARNING: 'Overwrite' action is permanent! Net properties will be removed along with any deleted nets. `,
            actionButtonText: "Overwrite",
            enableSecondaryActionButton: true,
            setCautionActionButtonIntent: true,
            secondaryActionButtonText: "Download Mapping Data",
            contextualInfo:  { key: "Net_List_Action", value: ctx },
        }
        setConfirmationDialogProps(nlConfirmData)
        confirmationModalActioner.open()
    }


    function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): void {
        if(contextualInfo && contextualInfo.key && contextualInfo.value) {
            if(contextualInfo.key === "Net_List_Action") {
                let ctx = contextualInfo.value as fileContextInfo
                if(action === ConfirmationDialogActionType.PROCEED) {
                    // Scenario 3) nets already exist and we want to override existing nets (forceCommit = true)
                    if(ctx.uploadedFile) {
                        setLoadingSpinnerCtx({enabled: true, text: `Now processing net-list upload. Please be patient. This may take some time...`})
                        processNetListUpload(ctx.uploadedFile, true).then((res) => {
                            if(res) {
                                setNetListActionTakenTracker(netListActionTakenTracker + 1)
                            }
                        })
                        .finally(() => {
                            setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
                        })
                    }
                    else {
                        displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to execute Net-list upload! Reference to content file not retained!`)
                    }
                }
                else if (action === ConfirmationDialogActionType.SECONDARY_ACTION) {
                    // Scenario 2) nets already exist and decision needs to be made regarding mapping/renaming, etc 
                    if(ctx.downloadHandler) {
                        let link = ctx.downloadHandler as HTMLAnchorElement;
                        link.click(); //this triggers file download process on browser
                        link.remove();
                        handleMappingFileDropScenario(ctx.uploadedFile);
                    }
                }
            }
        }
        else {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Failed to execute Net-mappinfg content download! Reference to download link was not retained!`)
        }
    }
    

    function handleMappingFileDropScenario(uploadedFile: FileWithPath): void {
        let fileCaptureDialogProps: FileCaptureDialogProps = {
            onFormClosed: onFileCaptureDataAvailable,
            title: "Upload Net Mapping file(s)",
            warningText: `Net mapping files have been download via browser.  
            If the recent net-list import was intended to rename existing nets, please modify and upload the downloaded csv file(s). 
            Each included csv file must have the expected column headers (same as what was downloaded)`,
            finishButtonText: "Submit",
            acceptedFileTypes: [MIME_TYPES.csv],
            contextualInfo: { key: "Net_List_Mapping_Files", value: uploadedFile },
        }
        setFileCaptureDialogProps(fileCaptureDialogProps)
        fileCaptureModalActioner.open()
    }


    function onFileCaptureDataAvailable(mappingFiles: FileWithPath[] | null, contextualInfo: BasicKVP): void {
        if(contextualInfo && contextualInfo.key && contextualInfo.value) {
            if(contextualInfo.key === "Net_List_Mapping_Files") {
                let uploadedNetlistFile = contextualInfo.value;
                if(mappingFiles && mappingFiles.length > 0) {
                    // Scenario 4) nets already exist and mapping/replacement file was also supplied for assessment

                    for(let i = 0; i < mappingFiles.length; i++) {
                        let focusFile = mappingFiles[i];
                        if(focusFile.name.toLowerCase().trim().endsWith(".csv") === false) {
                            displayQuickMessage(UIMessageType.ERROR_MSG, `Error! Net-mapping file type/extension is not acceptable. FileName: '${focusFile.name}'`)
                            return;
                        }
                    }

                    setLoadingSpinnerCtx({enabled: true, text: `Now processing net-list/mapping content. Please be patient. This may take some time...`})
                    processNetListReplacement(uploadedNetlistFile, mappingFiles).then((res: any) => {
                        if(res) {
                            setNetListActionTakenTracker(netListActionTakenTracker + 1)
                        } 
                    })
                    .finally(() => {
                        setLoadingSpinnerCtx({enabled: false, text: ``} as LoadingSpinnerInfo)
                    })
                }
            }
        }
    }

    
    async function processNetListUpload(netListFile: FileWithPath, forceCommit: boolean) {
        if(netListFile) {
            let result : boolean = await uploadNetList(project, netListFile, forceCommit)
            if(result) {
                displayQuickMessage(UIMessageType.SUCCESS_MSG, "Net List upload completed")
                return result;
            }
            else {
                displayQuickMessage(UIMessageType.ERROR_MSG, "Net List upload was not successful!")
                return null;
            }
        }
        return null
    }


    async function processNetListReplacement(netListFile: FileWithPath, mappingFiles: FileWithPath[] | null) {
        if(netListFile) {
            let mapFilesToSend : FileWithPath[] = (mappingFiles && mappingFiles.length > 0) 
                ? mappingFiles 
                : [new File([""], "", { type: "text/plain" })];
            let result = await replaceNetList(project, netListFile, mapFilesToSend)
            if(result) {
                displayQuickMessage(UIMessageType.SUCCESS_MSG, "Net management operation completed")
                return result;
            }
            else {
                displayQuickMessage(UIMessageType.ERROR_MSG, "Net management operation was not successful!")
                return null;
            }
        }
        return null;
    }



    return (
        <Box ref={containerRef}>
            <Box>
                <Box display="flex" justifyContent="center" sx={{ mt: 8 }}>
                    <Box width="70%">
                        <FileDropZone
                            height={200} 
                            acceptableMimeTypes={[]} 
                            onSuccessfulDrop={onSuccessfulDrop} 
                            onFileRejected={onFileRejected} 
                            multipleFilesAllowed={false}
                        />
                    </Box>
                </Box>
            </Box>
            
            <Box display="flex" justifyContent="center" sx={{ mb: 5, mt: 5  }}>
                <Slide timeout={{ enter: 500, exit: 500 }} direction="down" in={true} container={containerRef.current}>
                    <Divider sx={{ width: "80%" }} />
                </Slide>
            </Box>
            <div style={{ height: "42vh" }}>
                <AgGridReact
                    rowData={netFileInfoList}
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
                    groupDefaultExpanded={0}
                />
            </div> 

            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            {fileCaptureModalState && <FileCaptureDialog opened={fileCaptureModalState} close={fileCaptureModalActioner.close} {...fileCaptureDialogProps as FileCaptureDialogProps} />}

        </Box>
    );
}

export default NetListUploadTab







    // function updateNetImportHistory() {
    //     fetchProjectDetails(project?._id.toString() as string).then((proj: Project) => {
    //         if(proj) {
    //             setProject(proj);
    //             setRetrievedNetFileInfo(proj);
    //         }
    //     })
    // }
    

    // function setRetrievedNetFileInfo(proj: Project) {
    //     let netListFileProp = proj.associatedProperties?.find(a => (
    //         a.category === ProjectPropertyCategoryEnum.NET_FILE_IMPORT && a.name === ProjectPropertyCategoryEnum.NET_FILE_IMPORT))
        
    //     if(netListFileProp && netListFileProp.value) {
    //         setNetFileInfoList(Array.from(netListFileProp.value));
    //     }

    //     // if(gridApi) { gridApi.setGridOption('rowData', netFilePropList ?? []) }
    // }
    