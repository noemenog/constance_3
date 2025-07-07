import { Button, Divider, useTheme } from "@mui/material";
import { Box, Typography } from "@mui/material";
import { tokens } from "../theme";
import { useContext } from "react";
import { useSpiderStore } from "../DataModels/ZuStore";



interface PageTitleProps {
    mainTitle: string,
    mainSubtitle: string
}

const PageTitle: React.FC<PageTitleProps> = ({ mainTitle, mainSubtitle }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    
    return (
        <Box mt="1px" mb="5px" ml="20px" width="98%">
            <Typography variant="h6" color={colors.grey[100]} fontWeight="normal" >{mainTitle?.toUpperCase() ?? ''}</Typography>
            <Typography color={colors.greenAccent[400]} sx={{fontStyle: 'italic', fontSize: 13, mt: -.5}}>{mainSubtitle ?? ''}</Typography>
            <Divider />
        </Box>
    );
}


export default PageTitle
