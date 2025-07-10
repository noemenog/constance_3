import { useNavigate } from "react-router-dom";
import intelLogo from '../assets/intel-header-logo.svg';
import appNameStyledGear from '../assets/const-logo2.svg';
import {Alert, AlertColor, Box, IconButton, Snackbar, Typography, useTheme } from "@mui/material";
import { ColorModeContext, tokens } from "../theme";
import styled from '@emotion/styled';
import { useContext } from "react";
import { useCStore } from "../DataModels/ZuStore";





export const StyledIntelLogoImg = styled.img`
    width: 60px;
    height: 19px;
    margin-right: 1px;
    margin-left: 1px;
    margin-top: -2px;
    cursor: pointer; 
`

export const StyledLogoImg = styled.img`
    width:99px;
    height: 22px;
    margin-right: 1px;
    margin-left: -14px;
    margin-top: 1px;
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
                <StyledLogoImg src={appNameStyledGear} onClick={onLogoClick} alt="App-logo"></StyledLogoImg>
                
                {/*                 
                <Typography 
                    variant="h6" 
                    color={colors.grey[100]} 
                    style={{ cursor: "pointer" }}
                    onClick={onLogoClick}>
                    {appName?.toUpperCase()}
                </Typography> 
                */}
            </Box>
        </div>
    );
}

export default LogoComp



