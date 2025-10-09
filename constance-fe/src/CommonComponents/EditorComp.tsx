import {Alert, AlertColor, Box, useTheme } from "@mui/material";
import { tokens } from "../theme";
import styled from '@emotion/styled';
import { useCStore } from "../DataModels/ZuStore";
import { Editor, Monaco } from "@monaco-editor/react";
import { LoadingSpinnerInfo, LoggedInUser } from "../DataModels/ServiceModels";
import { useEffect, useRef, useState } from "react";
import { editor } from "monaco-editor";





interface EditorCompProps {
    ref?: editor.IStandaloneCodeEditor | null,
    darkMode?: boolean,
    disableMiniMap?: boolean,
    editorContentLanguage?: string, 
    editorHeight?: string,
    editorContent: string,
}



const EditorComp: React.FC<EditorCompProps> = ({ ref, darkMode = true, disableMiniMap = true, 
    editorContentLanguage = 'json', editorHeight = "78vh", editorContent = ''}) => {
    
    const theme : any = useTheme();
    const colors : any = tokens(theme.palette.mode);

    const loggedInUser = useCStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useCStore((state) => state.setIsLoadingBackdropEnabled);
    const setLoadingSpinnerCtx = useCStore((state) => state.setLoadingSpinnerCtx);
    const cancelLoadingSpinnerCtx = useCStore((state) => state.cancelLoadingSpinnerCtx);

    const [content, setContent] =  useState(editorContent);

    const editorRef = useRef<null|editor.IStandaloneCodeEditor>(ref || null);
    const colorMode: string = darkMode ? "vs-dark" : "light";



    
    useEffect(() => {
        formatContent(100);
    },[content]);


    async function formatContent(sleepTime: number){
        if (editorRef?.current) {
            (editorRef.current as editor.IStandaloneCodeEditor).getAction('editor.action.formatDocument')?.run();
            setTimeout(function () {
            
                (editorRef.current as editor.IStandaloneCodeEditor).getAction('editor.action.formatDocument')?.run();

                if (disableMiniMap) {
                    (editorRef.current as editor.IStandaloneCodeEditor).updateOptions({
                        minimap: {
                            enabled: false
                        }
                    });
                }
                
                //trying to force editor to show the top of content
                (editorRef.current as editor.IStandaloneCodeEditor).revealLine(1, editor.ScrollType.Immediate);
                (editorRef.current as editor.IStandaloneCodeEditor).setScrollPosition({scrollTop: 0, scrollLeft: 0}, editor.ScrollType.Immediate);
                
            }, sleepTime);
        }
    }
    


    //******************************************************************************************** */
    function handleEditorChange(value: any, event: any) {
        //Is there something to do here or not? maybe disregard and rely on controll buttons component
        console.log("editorChange: the editor changed");
    }

    function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
        setLoadingSpinnerCtx({enabled: true, text: "Now formatting content. Please wait..."} as LoadingSpinnerInfo)        
        // console.log("onMount: the editor instance:", editor);
        // console.log("onMount: the monaco instance:", monaco);
        editorRef.current = editor; //IMPORTANT
        formatContent(1000).finally(() => { 
            console.log("Editor did mount. Content formatting completed");
            cancelLoadingSpinnerCtx() 
        })
    }

    function handleEditorWillMount(monaco: Monaco) {
        console.log("beforeMount: now mounting editor...");
    }

    function handleEditorValidation(markers: any) {
        markers.forEach((marker: any) => console.log('onValidate:', marker.message));
    }
    //******************************************************************************************** */


    
    return (
        <Box width="100%" flexGrow={1}>                
            <Box flexGrow={1} height="100%">
                <Editor
                    height={editorHeight}
                    width={"100%"}
                    theme={colorMode}
                    defaultLanguage={editorContentLanguage}
                    defaultValue={JSON.stringify([])}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    beforeMount={handleEditorWillMount}
                    onValidate={handleEditorValidation}
                    value={content}
                />
            </Box>
        </Box>
    );
}

export default EditorComp



