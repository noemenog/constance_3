import { createContext, useState, useMemo, useContext } from "react";
import { createTheme, Theme } from "@mui/material/styles";
import { colorSchemeDarkWarm, colorSchemeDarkBlue, themeQuartz } from "ag-grid-enterprise";


export const themeDarkBlue = themeQuartz.withPart(colorSchemeDarkBlue);
export const themeDarkWarm = themeQuartz.withPart(colorSchemeDarkWarm);
//ag-grid theme class selection
// export const agTheme = (mode: any) => {
//     return (mode === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz");
//     // return (mode === "dark" ? "ag-theme-alpine-dark" : "ag-theme-alpine");
// }

//color design tokens
export const tokens = (mode : any) => ({
    ...(mode === 'dark'
    ? {
        grey: {
            100: "#e0e0e0",
            200: "#c2c2c2",
            300: "#a3a3a3",
            400: "#858585",
        },
        primary: {
            // 100: "#d0d1d5",
            400: "#1f2a40",
            500: "#141b2d",
            600: "#101624",
        },
        greenAccent: {
            400: "#70d8bd",
            600: "#29705e",
            800: "#1e5245",
            // 300: "",
            // 400: ""
        },
        blueAccent: {
            100: "#228be6",
            200: "#146bb8",
            300: "#0f518a",
            400: "#0d4373",
            //=====
            500: "#868dfb",
            600: "#535ac8",
            // 700: "#3e4396",
            // 800: "#2a2d64",
            900: "#151632",
        }
    }
    : {
        grey: {
            100: "#141414",
            200: "#292929",
            300: "#3d3d3d",
            400: "#525252",
            // 500: "#666666",
            // 600: "#858585",
            // 700: "#a3a3a3",
            // 800: "#c2c2c2",
            // 900: "#e0e0e0",
        },
        primary: {
            // 100: "#040509",
            // 200: "#080b12",
            // 300: "#0c101b",
            400: "#f2f0f0",
            500: "#141b2d",
            600: "#434957",
            // 700: "#727681",
            // 800: "#a1a4ab",
            // 900: "#d0d1d5",
        },
        greenAccent: {
            // 100: "#0f2922",
            // 200: "#1e5245",
            // 300: "#2e7c67",
            400: "#3da58a",
            // 500: "#4cceac",
            // 600: "#70d8bd",
            // 700: "#94e2cd",
            800: "#b7ebde",
            // 900: "#dbf5ee",
        },
        blueAccent: {
            100: "#151632",
            200: "#2a2d64",
            300: "#3e4396",
            400: "#535ac8",
            // 500: "#6870fa",
            600: "#868dfb",
            // 700: "#a4a9fc",
            // 800: "#c3c6fd",
            900: "#e1e2fe",
        }
    }),
})


//mui theme settings
export const themeSettings = (mode: any) => {
    const colors = tokens(mode);
    const fontName = "intelclear"
    return {
        palette: {
            mode: mode,
            ...(mode === 'dark'
                ? {
                    primary:{
                        main: colors.blueAccent[100],
                    },
                    secondary: {
                        main:colors.greenAccent[400],
                    },
                    neutral: {
                        dark: colors.grey[300],
                        main: colors.grey[200],
                        light: colors.grey[100],
                    },
                    background: {
                        default: colors.primary[600],
                    }
                }
                : {
                    primary:{
                        main: colors.grey[100],
                    },
                    secondary: {
                        main: colors.greenAccent[800],
                    },
                    neutral: {
                        dark: colors.grey[100],
                        main: colors.grey[200],
                        light: colors.grey[300],
                    },
                    background: {
                        default: colors.blueAccent[100] //"#fcfcfc",
                    }
                }
            ),
        },
        typography: {
            fontFamily: [fontName].join(","),
            fontSize: 12,
            // allVariants: {
            //     color: "#ffffff"
            // },
            h1: {
                fontFamily: [fontName].join(","),
                fontSize: 40,
            },
            h2: {
                fontFamily: [fontName].join(","),
                fontSize: 32,
            },
            h3: {
                fontFamily: [fontName].join(","),
                fontSize: 24,
            },
            h4: {
                fontFamily: [fontName].join(","),
                fontSize: 20,
            },
            h5: {
                fontFamily: [fontName].join(","),
                fontSize: 16,
            },
            h6: {
                fontFamily: [fontName].join(","),
                fontSize: 14,
            },
        }
        
    }
}

//react context for the color mode
export const ColorModeContext = createContext({
    toggleColorMode: () => {}
});

export const useMode = () => {
    const [mode, setMode] = useState("dark");
    
    const colorMode : any = useMemo(
        () => ({
            toggleColorMode: () => setMode((prev) => (prev === "light" ? "dark" : "light")),
        })
    ,[]);

    const theme : any = useMemo(() => createTheme(themeSettings(mode)), [mode]);
    
    return [theme, colorMode];
}


//sx={{ textTransform: 'none', m: 1, minWidth: 150, height: 32, marginTop: 2, marginBottom: 1, color: 'white', backgroundColor: 'gray', ':hover': { bgcolor: 'darkgray' }}}
                        