import {Alert, AlertColor, Box, useTheme } from "@mui/material";
import { tokens } from "../theme";
import styled from '@emotion/styled';
import { useCStore } from "../DataModels/ZuStore";
import { Editor, Monaco } from "@monaco-editor/react";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { editor } from "monaco-editor";





interface EditorCompProps {
    darkMode?: boolean,
    disableMiniMap?: boolean,
    editorContentLanguage?: string, 
    editorHeight?: string,
    editorContent: string,
    initFontSize?: number,
    onEditorContentChanged: (event: any, value: any) => void,
}


// Interface for methods exposed to parent components
interface EditorCompRef {
    getValue: () => string | undefined;
    setValue: (value: string) => void;
    executeEdits: (edits: editor.IIdentifiedSingleEditOperation[]) => boolean;
    getModel: () => editor.ITextModel | null;
    focus: () => void;
    formatDocument: () => void;
    insertTextAtCursor: (text: string) => void;
    getEditor: () => editor.IStandaloneCodeEditor | null;
    setLanguage: (language: string) => void;
    getLanguage: () => string | undefined;
}


const EditorComp = forwardRef<EditorCompRef, EditorCompProps>(({ onEditorContentChanged, darkMode = true, disableMiniMap = true, 
    editorContentLanguage = 'json', editorHeight = "78vh", editorContent = '', initFontSize = 16}, ref) => {
    
    const theme : any = useTheme();
    const colors : any = tokens(theme.palette.mode);

    const [content, setContent] =  useState(editorContent);

    const monacoRef = useRef<Monaco | null>(null);
    const editorRef = useRef<null|editor.IStandaloneCodeEditor>(null);
    const actionsRegisteredRef = useRef<boolean>(false);
    const disposablesRef = useRef<any[]>([]);
    
    const colorMode: string = darkMode ? "vs-dark" : "light";



    
    useEffect(() => {
        formatContent(100);
    },[content]);

    // Expose editor methods to parent components
    useImperativeHandle(ref, () => ({
        getValue: () => editorRef.current?.getValue(),
        setValue: (value: string) => editorRef.current?.setValue(value),
        executeEdits: (edits: editor.IIdentifiedSingleEditOperation[]) => 
            editorRef.current?.executeEdits('external', edits) || false,
        getModel: () => editorRef.current?.getModel() || null,
        focus: () => editorRef.current?.focus(),
        formatDocument: () => editorRef.current?.getAction('editor.action.formatDocument')?.run(),
        insertTextAtCursor: (text: string) => {
            const editor = editorRef.current;
            if (editor) {
                const position = editor.getPosition();
                if (position) {
                    editor.executeEdits('external', [{
                        range: {
                            startLineNumber: position.lineNumber,
                            startColumn: position.column,
                            endLineNumber: position.lineNumber,
                            endColumn: position.column
                        },
                        text: text
                    }]);
                }
            }
        },
        getEditor: () => editorRef.current,
        setLanguage: (language: string) => {
            const model = editorRef.current?.getModel();
            if (model && monacoRef.current) {
                // Use the stored Monaco instance for better reliability
                monacoRef.current.editor.setModelLanguage(model, language);
            } else if (model) {
                // Fallback to global Monaco if available
                const monaco = (window as any).monaco;
                if (monaco) {
                    monaco.editor.setModelLanguage(model, language);
                }
            }
        },
        getLanguage: () => {
            const model = editorRef.current?.getModel();
            return model?.getLanguageId();
        }
    }));


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
    

    const registerInstanceActions = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        // Prevent duplicate registration for this instance
        if (actionsRegisteredRef.current) {
            return;
        }

        // Use editor.addAction instead of monaco.editor.addEditorAction
        editor.addAction({
            id: 'instance.zoom.in',
            label: 'Zoom In',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal],
            contextMenuGroupId: 'view',
            contextMenuOrder: 1,
            run: (editor: editor.IStandaloneCodeEditor) => {
                const currentSize = editor.getOption(monaco.editor.EditorOption.fontSize);
                editor.updateOptions({ fontSize: Math.min(currentSize + 1, 40) });
            }
        });

        editor.addAction({
            id: 'instance.zoom.out',
            label: 'Zoom Out',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus],
            contextMenuGroupId: 'view',
            contextMenuOrder: 2,
            run: (editor: editor.IStandaloneCodeEditor) => {
                const currentSize = editor.getOption(monaco.editor.EditorOption.fontSize);
                editor.updateOptions({ fontSize: Math.max(currentSize - 1, 8) });
            }
        });

        editor.addAction({
            id: 'instance.zoom.reset',
            label: 'Reset Zoom',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0],
            contextMenuGroupId: 'view',
            contextMenuOrder: 3,
            run: (editor: editor.IStandaloneCodeEditor) => {
                editor.updateOptions({ fontSize: 14 });
            }
        });

        actionsRegisteredRef.current = true;
    }, []);




    //******************************************************************************************** */
    function handleEditorChange(value: any, event: any) {
        //Is there something to do here or not? maybe disregard and rely on controll buttons component
        console.log("editorChange: the editor changed");
        if(onEditorContentChanged) {
            onEditorContentChanged(event, value);
        }
    }
        

    const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {     
        editorRef.current = editor; //IMPORTANT
        monacoRef.current = monaco; //Store Monaco instance for later use
        
        formatContent(1000).finally(() => { 
            console.log("Editor did mount. Content formatting completed");
        })

        // Store disposables for cleanup
        const disposables = [];

        // Add event listeners and store their disposables
        const onContentChange = editor.onDidChangeModelContent(() => {
        console.log('Content changed');
        });
        disposables.push(onContentChange);

        const onCursorChange = editor.onDidChangeCursorPosition(() => {
        console.log('Cursor position changed');
        });
        disposables.push(onCursorChange);

        const onFocusChange = editor.onDidFocusEditorText(() => {
        console.log('Editor focused');
        });
        disposables.push(onFocusChange);

        // Store all disposables
        disposablesRef.current = disposables;

        registerInstanceActions(editor, monaco)
    }, []);


    function handleEditorWillMount(monaco: Monaco) {
        console.log("beforeMount: now mounting editor...");
    }


    function handleEditorValidation(markers: any) {
        markers.forEach((marker: any) => console.log('onValidate:', marker.message));
    }
    //******************************************************************************************** */


    // Comprehensive cleanup
    const cleanup = useCallback(() => {
        console.log('Starting Monaco Editor cleanup...');

        // Dispose all event listeners
        if (disposablesRef.current.length > 0) {
            disposablesRef.current.forEach(disposable => {
                if (disposable && typeof disposable.dispose === 'function') {
                    disposable.dispose();
                }
            });
            disposablesRef.current = [];
            console.log('Event listeners disposed');
        }

        // Dispose editor instance
        if (editorRef.current) {
            try {
                editorRef.current.dispose();
                console.log('Editor instance disposed');
            } catch (error) {
                console.error('Error disposing editor:', error);
            }
            editorRef.current = null;
        }

        // Clear monaco reference
        monacoRef.current = null;

        console.log('Monaco Editor cleanup completed');
    }, []);



    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);





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
                    options={{
                        fontSize: initFontSize,
                        quickSuggestions: true,
                        parameterHints: { enabled: true },
                        contextmenu: true,
                    }}
                />
            </Box>
        </Box>
    );
});

export default EditorComp;
export type { EditorCompRef };



