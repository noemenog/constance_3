import { Button, Divider, useTheme } from "@mui/material";
import { Box, Typography } from "@mui/material";
import { tokens } from "../theme";
import { useContext } from "react";
import styled from "@emotion/styled";


interface SpButtomProps {
    intent?: "plain" | "caution" | "cancel" | "gold_standard" | "disabled",
    type?: "submit" | "reset" | "button" | undefined
    label: string,
    startIcon?: any,
    endIcon?: any,
    onClick?: () => void,
    disabled?: boolean,
    sx?: any,
    bgColor?: string, 
    hoverColor?: string,
}

export const SpButton = ({ label, startIcon, endIcon, onClick, intent = "plain", type, disabled = false, sx = {} as any} : SpButtomProps) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    
    let style = {};

    if(intent.toLowerCase() == "plain")
    {
        style = {
            color: "#fff", 
            backgroundColor: colors.blueAccent[300], 
            ':hover': { bgcolor: colors.blueAccent[400]}, 
            ...sx 
        }
    }
    else if (intent.toLowerCase() == "caution")
    {
        style = {
            color: "#f2f2f2", 
            backgroundColor: "#990000", 
            ':hover': { bgcolor: "#b30000"}, 
            ...sx 
        }
    }
    else if (intent.toLowerCase() == "gold_standard")
    {
        style = {
            color: "#f2f2f2", 
            backgroundColor: "#AA6000", 
            ':hover': { bgcolor: "#AA7C00" }, //AA6C39
            ...sx 
        }
    }
    else if (intent.toLowerCase() == "cancel")
    {
        style = {
            color: "#000", 
            backgroundColor: colors.grey[300], 
            ':hover': { bgcolor: colors.grey[400]}, 
            ...sx 
        }
    }
    else if (intent.toLowerCase() == "disabled")
    {
        style = {
            color: "#000", 
            backgroundColor: "rgba(82, 82, 82)", 
            ':hover': { bgcolor: colors.grey[400]}, 
            ...sx 
        }
    }

    return (
        <Button
            type={type}
            size="small"
            variant="outlined"
            startIcon={startIcon ?? undefined}
            endIcon={endIcon ?? undefined}
            onClick={onClick}
            sx={style}
            disabled={disabled}
        >
            {label}
        </Button>
    );
}








//=============================================================================================================================================================

// https://github.com/glideapps/glide-data-grid/blob/5983dcabd2fb55b675009813709752008da6d424/packages/core/src/docs/examples/header-menus.stories.tsx#L39
export const SimpleMenu = styled.div`
    width: 200px;
    padding: 8px 0;
    border-radius: 6px;
    box-shadow:
        0px 0px 1px rgba(62, 65, 86, 0.7),
        0px 6px 12px rgba(62, 65, 86, 0.35);

    display: flex;
    flex-direction: column;

    background-color: white;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans",
        "Helvetica Neue", sans-serif;

    .danger {
        color: rgba(255, 40, 40, 0.8);
        :hover {
            color: rgba(255, 40, 40, 1);
        }
    }

    > div {
        padding: 6px 8px;
        color: rgba(0, 0, 0, 0.7);
        :hover {
            background-color: rgba(0, 0, 0, 0.2);
            color: rgba(0, 0, 0, 0.9);
        }
        transition: background-color 100ms;
        cursor: pointer;
    }
`;

