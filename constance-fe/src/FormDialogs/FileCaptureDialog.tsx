import * as React from 'react';
import { Autocomplete, Box, DialogContent, Divider, IconButton, List, ListItem, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material';
import { ArticleOutlined, AudioFileOutlined, Cancel, Check, DescriptionOutlined, FolderZipOutlined, InsertDriveFileOutlined, IntegrationInstructionsOutlined, PictureAsPdfOutlined, TextSnippetOutlined, VideoFileOutlined } from '@mui/icons-material';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import FileDropZone from '../CommonComponents/FileDropZone';
import { FileRejection, FileWithPath } from '@mantine/dropzone';
import { BasicKVP } from '../DataModels/HelperModels';
import { useSpiderStore } from '../DataModels/ZuStore';
import { SpButton } from '../CommonComponents/SimplePieces';





export interface FileCaptureDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (data: FileWithPath[] | null, contextualInfo: BasicKVP) => void,
    title: string,
    warningText?: string,
    finishButtonText?: string,
    acceptedFileTypes: string[],
    maxFileCount?: number,
    contextualInfo: BasicKVP,
}

const FileCaptureDialog: React.FC<FileCaptureDialogProps> = ({ title, warningText, finishButtonText, 
    acceptedFileTypes, opened, maxFileCount = 10, contextualInfo, close, onFormClosed }) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [addedFiles, setAddedFiles] = React.useState<FileWithPath[]>(new Array<FileWithPath>())

    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);

    const handleCancel = () => {
        if (onFormClosed) {
            onFormClosed(null, contextualInfo);
        }
        setAddedFiles(new Array<FileWithPath>());
        if(close){ close() }
    };


    const onTextSubmit = () => {
        if (onFormClosed) {
            onFormClosed(addedFiles, contextualInfo);
        }
        setAddedFiles(new Array<FileWithPath>());
        if(close){ close() }
    }


    async function onSuccessfulDrop(files: FileWithPath[]): Promise<void> {
        if(files && files.length > 0) {
            if(!acceptedFileTypes || acceptedFileTypes.length === 0) {
                displayQuickMessage(UIMessageType.ERROR_MSG, `Error! Could not process file. Could not determine expected file type/extension.`)
                return;
            }
            else {
                for(let x = 0; x < files.length; x++) {
                    let checkRes = acceptedFileTypes.some(a => files[x].type.toLowerCase().trim() === a)
                    if(checkRes === false){
                        displayQuickMessage(UIMessageType.ERROR_MSG, `Error! Could not process file '${files[x].name}'. File type/extension is not acceptable`)
                        return;
                    }
                }
                
                let totalFileArr = [...addedFiles]
                let existingNames = totalFileArr.map(a => a.name.toLowerCase().trim())
                let inFilesWithExistingNames = files.filter(a => existingNames.includes(a.name.toLowerCase().trim()))
                let inDifferentlyNamedFiles = files.filter(a => (existingNames.includes(a.name.toLowerCase().trim()) === false))

                if((totalFileArr.length + inDifferentlyNamedFiles.length) > maxFileCount) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, `Error! Could not process file. Number of added files cannot exceed ${maxFileCount}.`)
                    return;
                }

                for(let i = 0; i < inFilesWithExistingNames.length; i++) {
                    for(let p = 0; p < totalFileArr.length; p++) {
                        if(inFilesWithExistingNames[i].name.toLowerCase().trim() === totalFileArr[p].name.toLowerCase().trim()) {
                            totalFileArr[p] = inFilesWithExistingNames[i];
                            break;
                        }
                    }
                }

                for(let n = 0; n < inDifferentlyNamedFiles.length; n++) {
                    totalFileArr.push(inDifferentlyNamedFiles[n])
                }
                
                setAddedFiles(totalFileArr);
            }
        }
        else {
            displayQuickMessage(UIMessageType.ERROR_MSG, "Error! Could not process file.")
        }
    }


    async function onFileRejected(fileRejections: FileRejection[]): Promise<void> {
        let name = fileRejections.map(a => a.file.name).at(0)
        displayQuickMessage(UIMessageType.ERROR_MSG, `File '${name}' was rejected.`)
    }



    function onFileRemovalAction(e: any, file: FileWithPath): void {
        if(addedFiles && addedFiles.length > 0) {
            let filterFileArr = addedFiles.filter(a => a.name.toLowerCase().trim() !== file.name.toLowerCase().trim())
            setAddedFiles([...filterFileArr]);
        }
        else {
            displayQuickMessage(UIMessageType.ERROR_MSG, "Error! Could not remove file. File is not registered to the system. Please refresh screen.")
        }
    }

    function getFileIcon(file: FileWithPath) : any {
        let modFN = file.name.toLowerCase().trim()
        let clr = colors.greenAccent[400]
        let contentTag;

        if (modFN.endsWith(".zip")) {
            contentTag = (<FolderZipOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }
        else if (modFN.endsWith(".csv")) {
            contentTag = (<TextSnippetOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }
        else if (modFN.endsWith(".txt")) {
            contentTag = (<DescriptionOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }
        else if (modFN.endsWith(".vbs")) {
            contentTag = (<IntegrationInstructionsOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }
        else if (modFN.endsWith(".json")) {
            contentTag = (<ArticleOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }
        else if (modFN.endsWith(".mp3")) {
            contentTag = (<AudioFileOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }
        else if (modFN.endsWith(".mp4")) {
            contentTag = (<VideoFileOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }  
        else if (modFN.endsWith(".pdf")) {
            contentTag = (<PictureAsPdfOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        }  
        else {
            contentTag = (<InsertDriveFileOutlined sx={{color: clr, padding: 0, ml: 3}}/>)
        } 

        return contentTag
    }



    return (
        <Box>
            <Modal
                opened={opened as boolean}
                onClose={handleCancel}
                centered
                closeOnClickOutside={false}
                closeOnEscape={false}
                size="calc(70vw - 3rem)"
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 13,
                }}
                styles={{
                    title: { padding: 6, marginRight: 10, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: SPECIAL_RED_COLOR, backgroundColor: colors.primary[400] }
                }}>

                    <Box>
                        <Divider />
                        <Box sx={{ marginBottom: 1 }}>
                            {(warningText && warningText.length > 0)
                            ?<Typography sx={{marginTop:1}}>
                                {warningText ?? ''}
                            </Typography>
                            :<></>}
                        </Box>
                        
                        <Box>
                            <Box display="flex" justifyContent="center" sx={{ mt: 5, mb: 2}}>
                                <Box width="78%">
                                    <FileDropZone
                                        height={160} 
                                        acceptableMimeTypes={acceptedFileTypes}
                                        onSuccessfulDrop={onSuccessfulDrop} 
                                        onFileRejected={onFileRejected} 
                                        multipleFilesAllowed={true}
                                    />
                                </Box>
                            </Box>
                        </Box>
                        
                        <Box sx={{display:"flex", justifyContent:"center", flexDirection:"column"}}>
                            {(addedFiles.length > 0) && <Typography sx={{ mt: 0.5, color: colors.grey[100] }}>
                                Added Files ({addedFiles.length}):
                            </Typography>}
                            
                            <List key={`file-list-1`} dense={true}>
                                {
                                    addedFiles.map((file, index) => (
                                        <ListItem key={`li-${index}`} sx={{padding: 0.5, ml: 4}}>
                                            <Tooltip sx={{padding: 0}} key={`tt-${index}`} placement="top" title={`Remove added file: '${file.name}'`}>
                                                <IconButton onClick={(e) => onFileRemovalAction(e, file as FileWithPath)}>
                                                    <Cancel sx={{color: SPECIAL_RED_COLOR }} key={`rem-${index}`}/>
                                                </IconButton>
                                            </Tooltip>
                                            <ListItemIcon >
                                                {getFileIcon(file)}
                                            </ListItemIcon>
                                            <ListItemText secondary={file.name} />
                                        </ListItem>
                                    ))
                                }
                            </List>
                        </Box>

                        <Divider />

                        <Box>
                            <SpButton
                                intent="cancel"
                                onClick={handleCancel}
                                startIcon={<Cancel />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label="Cancel" />

                            <SpButton
                                intent="plain"
                                startIcon={<Check />}
                                sx={{ m: 1, height: 32, width:200 }}
                                label={finishButtonText ?? "Ok"}
                                disabled={(addedFiles.length > 0) ? false : true}
                                onClick={onTextSubmit} />
                        </Box>
                    </Box>

            </Modal>
        </Box>
    );
}

export default FileCaptureDialog