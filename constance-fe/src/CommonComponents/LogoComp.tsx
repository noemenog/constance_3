import { useNavigate } from "react-router-dom";
import intelLogo from '../assets/intel-header-logo.svg';
import {Alert, AlertColor, Box, IconButton, Snackbar, Typography, useTheme } from "@mui/material";
import { ColorModeContext, tokens } from "../theme";
import styled from '@emotion/styled';
import { useContext } from "react";
import { useSpiderStore } from "../DataModels/ZuStore";





export const StyledIntelLogoImg = styled.img`
    width: 60px;
    height: 19px;
    margin-right: 1px;
    margin-left: 1px;
    margin-top: -2px;
    cursor: pointer; 
`


interface LogoCompProps {
    appName?: string, 
    appVersion?: string,
    onLogoClick: (event: any) => void 
}


const LogoComp: React.FC<LogoCompProps> = ({ appName, appVersion, onLogoClick }) => {
    const theme : any = useTheme();
    const colors : any = tokens(theme.palette.mode);


    return (
        <div>
            <Box display="flex" justifyContent="center" alignItems="center">
                <StyledIntelLogoImg src={intelLogo} alt="intel-logo" onClick={onLogoClick}></StyledIntelLogoImg>
                <Typography 
                    variant="h3" 
                    color={colors.grey[100]} 
                    style={{ cursor: "pointer" }}
                    onClick={onLogoClick}>
                    {appName?.toUpperCase()}
                </Typography>
            </Box>
        </div>
    );
}

export default LogoComp