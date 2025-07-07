import { Box, Divider, Slide, Typography } from "@mui/material";
import { ChangeEvent, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "@emotion/styled";
import WysiwygEditor from "../../CommonComponents/WysiwygEditor";
import EditorJS from "@editorjs/editorjs";
import { Interface, Project } from "../../DataModels/ServiceModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { EditorNotesData, LoggedInUser, SPDomainData } from "../../DataModels/HelperModels";
import { saveInterfaceNotes, saveProjectNotes } from "../../BizLogicUtilities/FetchData";
import { PermissionActionEnum, SPECIAL_RED_COLOR, UIMessageType } from "../../DataModels/Constants";
import { isUserApprovedForCoreAction } from "../../BizLogicUtilities/Permissions";




interface ProjectNotesTabProps {

}

const ProjectNotesTab: React.FC<ProjectNotesTabProps> = ({ }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const domainData = useLoaderData() as SPDomainData;
    const project = domainData.project as Project;

    const containerRef = useRef<any>();

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser;
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);

    const [data, setData] = useState(() => {
        //https://medium.com/@jscodelover/using-functions-as-the-initial-state-in-the-usestate-hook-in-react-7069cdfcc6ed
        if(project && project.notes && project.notes.blocks && project.notes.blocks.length > 0) {
            let initData = (project.notes as EditorNotesData)
            return initData;
        }
        else{
            let initData = {
                time: new Date().getTime(),
                blocks: [
                    {
                        type: "header",
                        data: {
                            text: `Welcome :-) Here you can save project-level notes. Current Project: '${project?.name}'.`,
                            level: 4,
                        },
                    },
                ],
            }
            return initData;
        }
    })
    

    
    useEffect(() => {
        placePageTitle("ProjectNotes")
    }, []);


    
    async function handleEditorDataChange(api: any, data: EditorNotesData) {
        if (isUserApprovedForCoreAction(loggedInUser, project, PermissionActionEnum.EDIT_PROJECT_NOTES) === false) { return; }
        saveProjectNotes(project?._id as string, data).then((res: boolean) => {
            if(res === false) {
                displayQuickMessage(UIMessageType.ERROR_MSG, "ERROR: Failed to save recent update to project notes!!")
            }
        })
    }
    
    

    return (
        <Box ref={containerRef}>
            
            <WysiwygEditor
                editorWidth="100%"
                editorHeight="78vh"
                editorBackgroundColor="#e0e0e0"
                data={data}
                onEditorDataChange={handleEditorDataChange}
                editorblock="editorjs-container" />

            <Box display="flex" flexDirection={"column"} alignItems={"center"} justifyContent="center" sx={{ mb: 0, mt: 0  }}>
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

export default ProjectNotesTab;
