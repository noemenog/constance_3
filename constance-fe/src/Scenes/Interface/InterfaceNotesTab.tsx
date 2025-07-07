import { Box, Divider, Slide, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import WysiwygEditor from "../../CommonComponents/WysiwygEditor";
import EditorJS from "@editorjs/editorjs";
import { Interface, Project } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { EditorNotesData, LoggedInUser } from "../../DataModels/HelperModels";
import { saveInterfaceNotes } from "../../BizLogicUtilities/FetchData";
import { PermissionActionEnum, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";




interface InterfaceNotesTabProps {
    iface: Interface|null,
    project: Project
}

const InterfaceNotesTab: React.FC<InterfaceNotesTabProps> = ({iface, project}) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const containerRef = useRef<any>();

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);

    const [data, setData] = useState(() => {
        //https://medium.com/@jscodelover/using-functions-as-the-initial-state-in-the-usestate-hook-in-react-7069cdfcc6ed
        if(iface && iface.notes && iface.notes.blocks && iface.notes.blocks.length > 0) {
            let initData = (iface.notes as EditorNotesData)
            return initData;
        }
        else{
            let initData = {
                time: new Date().getTime(),
                blocks: [
                    {
                        type: "header",
                        data: {
                            text: `Welcome :-) Here you can save notes pertaining to '${iface?.name}' interface.`,
                            level: 4,
                        },
                    },
                ],
            }
            return initData;
        }
    })
    

    
    useEffect(() => {
        placePageTitle("InterfaceNotes")
    }, []);


    
    async function handleEditorDataChange(api: any, data: EditorNotesData) {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.EDIT_INTERFACE_NOTES) === false) { return; }
        saveInterfaceNotes(iface?.projectId as string, iface?._id as string, data).then((res) => {
            if(res === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, "ERROR: Failed to save recent update to interface notes!!")
            }
        })
    }
    
    

    return (
        <Box>
            
            <WysiwygEditor
                editorWidth="100%"
                editorHeight="75vh"
                editorBackgroundColor="#e0e0e0"
                data={data}
                onEditorDataChange={handleEditorDataChange}
                editorblock="editorjs-container" />

            <Box display="flex" flexDirection={"column"} alignItems={"center"} justifyContent="center" sx={{ mb: 0, mt: -.2  }}>
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
        </Box>
    )
}

export default InterfaceNotesTab;
