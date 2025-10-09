import React, { useEffect, useRef } from "react";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, Chip, Divider, FormControlLabel, Slide, Switch, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { Cancel, CancelOutlined, Check } from '@mui/icons-material';
import { Controller, ErrorOption, useForm } from 'react-hook-form';
import { Modal } from '@mantine/core';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { DiffEditor, Monaco, MonacoDiffEditor } from "@monaco-editor/react";
import { editor } from 'monaco-editor';
import { BasicKVP, ConfigItem } from "../DataModels/ServiceModels";
import { SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR } from "../DataModels/Constants";
import { SpButton } from "../CommonComponents/SimplePieces";
import EditorComp from "../CommonComponents/EditorComp";



export interface ComparisonDialogProps {
    title: string,
    subtitle: string,
    warningText?: string,
    opened?: boolean,
    close?: () => void,
    onFormClosed : (contextualInfo: BasicKVP) => void,
    
    darkMode?: boolean,
    disableMiniMap?: boolean,
    editorContentLanguage?: string,
    contextualInfo: any
}

const ComparisonDialog: React.FC<ComparisonDialogProps> = ({ title, subtitle, warningText, opened, close, onFormClosed, contextualInfo, darkMode = true, disableMiniMap = true, editorContentLanguage = 'json'}) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [origContent, setOrigContent] = React.useState('');
    const [modContent, setModContent] = React.useState('');

    const containerRef = useRef<any>();
    const currentConfEditorRef = useRef<null|editor.IStandaloneCodeEditor>(null);
    const otherEnvConfEditorRef = useRef<null|editor.IStandaloneCodeEditor>(null);


    let confListStr = JSON.stringify(contextualInfo?.value ?? []);




    // const editorRef = useRef<null|MonacoDiffEditor>(null);
    
    // let orgd = (originalData && originalData.length > 0) ? originalData : '';
    // let chd = (changedData && changedData.length > 0) ? changedData : '';

    // useEffect(() => {
    //     setTimeout(function () {
    //         if (editorRef?.current) {        

    //             try{
    //                 //This is required in order for below 'format' action to work. i dont know why...
    //                 (editorRef.current as MonacoDiffEditor).updateOptions({originalEditable: true });

    //                 (editorRef.current as MonacoDiffEditor).getOriginalEditor().trigger('', 'editor.action.formatDocument', '');
    //                 (editorRef.current as MonacoDiffEditor).getModifiedEditor().trigger('', 'editor.action.formatDocument','');
    //             }
    //             catch(e: any)
    //             {
    //                 console.error("Failed to format comparison editor content");
    //             }

    //             if (disableMiniMap) {
    //                 (editorRef.current as MonacoDiffEditor).updateOptions({
    //                     minimap: {
    //                         enabled: false
    //                     }
    //                 });
    //             }
                
    //             //trying to force editor to show the top of content
    //             (editorRef.current as MonacoDiffEditor).getOriginalEditor().revealLine(1, editor.ScrollType.Immediate);
    //             (editorRef.current as MonacoDiffEditor).getOriginalEditor().setScrollPosition({scrollTop: 0, scrollLeft: 0}, editor.ScrollType.Immediate);
                
    //         }
    //     }, 100);

    // });


    
    const handleCancel = () => {
        if(onFormClosed){
            onFormClosed(contextualInfo);
        }
        setOrigContent('');
        setModContent('');
        if(close){ close() }
    };

    
    

    
    return (
        <Box>
            <Modal 
                opened={opened as boolean} 
                onClose={handleCancel} 
                centered
                size="calc(100vw - 3rem)"
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 3,
                }}
                styles={{
                    title: { padding: 2, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: "red", backgroundColor: colors.primary[400] }
                }}>
                    <Box sx={{ '& .MuiTextField-root': { width: '100%'}, mr: 2 }}>
                        <Divider />
                            {(warningText && warningText.length > 0)
                                ?<Box sx={{ mb: 1}}>
                                    <Typography sx={{color: SPECIAL_RED_COLOR}}>
                                        {warningText ?? ''}
                                    </Typography>
                                </Box>
                                :<></>                              
                            }
                        <Divider />

                        <Box ref={containerRef} flexDirection="column" alignItems="left" justifyContent="left">
                            <Box sx={{display:"flex", flexDirection:"row", justifyContentsx: "center", width:"100%", m: 1, mt: 1}}>
                                
                                <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", mt: .5, width: '48%', mr: 1 }} >
                                    <Box sx={{  border: 1, borderColor: colors.grey[400], display:"flex", flexDirection:"column", alignItems:"center", width: '100%' }} >
                                        <EditorComp 
                                            darkMode={darkMode}
                                            editorHeight={"70vh"}
                                            disableMiniMap={disableMiniMap} 
                                            editorContentLanguage={editorContentLanguage} 
                                            editorContent={confListStr}
                                            ref={currentConfEditorRef.current}
                                        />
                                    </Box>
                                </Box>  
                                
                                <Slide timeout={{ enter: 600, exit: 400 }} direction="up" in={true} container={containerRef.current}>
                                    <Box sx={{ display: 'flex', alignItems: 'center'}} flexDirection={"row"}>
                                        <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                        <Divider orientation="vertical" sx={{ml: 2, mr: 2, height:"60vh"}} />
                                        <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                    </Box>
                                </Slide>

                                <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", mt: .5, width: '48%', ml: 1 }} >
                                    <Box sx={{ border: 1, borderColor: colors.grey[400], display:"flex", flexDirection:"column", alignItems:"center", width: '100%' }} >
                                        <EditorComp 
                                            darkMode={darkMode}
                                            editorHeight={"70vh"}
                                            disableMiniMap={disableMiniMap} 
                                            editorContentLanguage={editorContentLanguage} 
                                            editorContent={confListStr}
                                            ref={otherEnvConfEditorRef.current}
                                        />
                                    </Box>
                                </Box>         
                                
                            </Box>
                        </Box>
                    </Box>

                    <Divider sx={{ mt: 2, mb: 1 }}/>
                    
                    <Box>
                        <SpButton
                            intent="plain"
                            startIcon={<CancelOutlined />}
                            sx={{ m: 1, height: 32, width:200 }}
                            label={"Close"}
                            disabled={false}
                            onClick={handleCancel} />
                    </Box>

            </Modal>
        </Box>
    );
}


export default ComparisonDialog