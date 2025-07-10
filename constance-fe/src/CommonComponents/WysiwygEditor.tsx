import { Divider, useTheme } from "@mui/material";
import { Box, Typography } from "@mui/material";
import { tokens } from "../theme";
import EditorJS from "@editorjs/editorjs";
import { memo, useCallback, useEffect, useRef } from "react";
import Embed from '@editorjs/embed'
import Table from '@editorjs/table'
import List from '@editorjs/list'
import Warning from '@editorjs/warning'
import Code from '@editorjs/code'
import LinkTool from '@editorjs/link'
import Raw from '@editorjs/raw'
import Header from '@editorjs/header'
import Quote from '@editorjs/quote'
import Marker from '@editorjs/marker'
import CheckList from '@editorjs/checklist'
import Delimiter from '@editorjs/delimiter'
import InlineCode from '@editorjs/inline-code'
// import SimpleImage from '@editorjs/simple-image'
import AttachesTool from "@editorjs/attaches";
import ImageTool from "@editorjs/image";
import { EditorNotesData } from "../DataModels/HelperModels";
import { deleteEditorNotesFile, uploadEditorNotesFiles } from "../BizLogicUtilities/FetchData";
import { useCStore } from "../DataModels/ZuStore";
import { UIMessageType } from "../DataModels/Constants";





// With a little help from our friends:  
// https://github.com/editor-js/image/issues/54#issuecomment-1510472147
class CustomImageTool extends ImageTool {
    removed() {
        //@ts-ignore
        let imageURL = this._data?.file?.url;
        if (imageURL && imageURL.length > 0) {
            let store = useCStore.getState();
            let projId = store.currentAppInfo?._id || ''
            deleteEditorNotesFile(projId, imageURL).then((res: boolean) => {
                if (res) {
                    store.displayQuickMessage(UIMessageType.SUCCESS_MSG, "Image deletion completed...")
                }
                else {
                    store.displayQuickMessage(UIMessageType.WARN_MSG, "Image not successfully deleted from storage system!")
                }
            })
        }
    }
}



const EDITOR_JS_TOOLS = {
    embed: Embed,
    table: Table,
    marker: Marker,
    list: List,
    warning: Warning,
    code: Code,
    linkTool: LinkTool,
    raw: Raw,
    header: Header,
    quote: Quote,
    checklist: CheckList,
    delimiter: Delimiter,
    inlineCode: InlineCode,
    // image: SimpleImage,
    // https://github.com/editor-js/image?tab=readme-ov-file#providing-custom-uploading-methods
    image: {
        class: CustomImageTool,
        config: {
            uploader: {
                uploadByFile(file: any) {
                    let store = useCStore.getState();
                    let projId = store.currentAppInfo?._id || ''
                    return uploadEditorNotesFiles(file, projId)
                },
                uploadByUrl(url: string) {
                    let store = useCStore.getState();
                    let projId = store.currentAppInfo?._id || ''
                    console.log(url);
                    // return uploadEditorNotesFiles(file, projId)

                    return {
                        success: 1,
                        file: {
                            url: "https://dtd-storage-dev.apps1-fm-int.icloud.intel.com/api/storage/?StorageName=Webtools&Tenant=Spider&Path=development/67868e4943b84e2be07757dc/GENERAL_NOTE_FILES&fileName=Screenshot-101_2025-01-16T19-36-02-408Z.png",
                            // any other image data you want to store, such as width, height, color, extension, etc
                        }
                    }
                },
            },
            features: {
                border: true,
                caption: 'optional',
                stretch: false
            }
        }
    },
    attaches: {
        class: AttachesTool,
        config: {
            uploader: {
                uploadByFile(file: any) {
                    let store = useCStore.getState();
                    let projId = store.currentAppInfo?._id || ''
                    return uploadEditorNotesFiles(file, projId)
                }
            }
        }
    }
}




interface WysiwygEditorProps {
    data: any,
    editorblock: any,
    editorWidth: number | string,
    editorHeight: number | string,
    editorBackgroundColor: string,
    onEditorReady?: () => void,
    onEditorDataChange: (api: any, data: EditorNotesData) => void
}

const WysiwygEditor = ({ data, editorblock, editorWidth, editorHeight, editorBackgroundColor, onEditorReady, onEditorDataChange }: WysiwygEditorProps) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const editorRef = useRef<EditorJS>();

    //with a little help from our friends:
    // https://medium.com/how-to-react/how-to-add-wysiwyg-editor-in-react-js-using-editor-js-cff90e2f3b75
    useEffect(() => {
        //Initialize editorjs if we don't have a reference
        if (!editorRef.current) {
            const editor = new EditorJS({
                holder: editorblock,
                //@ts-ignore
                tools: EDITOR_JS_TOOLS,
                data: data,
                onReady: () => { if (onEditorReady) { onEditorReady() } },
                onChange: async (api, event) => {
                    let currentDataSaved = await api.saver.save();
                    onEditorDataChange(api, currentDataSaved as EditorNotesData);
                }
            });
            editorRef.current = editor;
        }

        //handle cleanup whenever this view is unloaded
        return () => {
            if (editorRef.current && editorRef.current.destroy) {
                editorRef.current.destroy();
            }
        };
    }, []);



    return (
        <Box className="editor" sx={{ width: editorWidth, height: editorHeight, mt: 1, mb: 1, color: "black", overflowY: "scroll" }}  >
            <div style={{ width: "100%" }} id={editorblock} />
        </Box>
    );
}

export default memo(WysiwygEditor);

