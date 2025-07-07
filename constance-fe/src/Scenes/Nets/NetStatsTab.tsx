import { Box, Button, Divider, IconButton, InputBase, Link, Slide, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, themeDarkBlue, tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import { NetSummary, SPDomainData } from "../../DataModels/HelperModels";
import { useSpiderStore } from "../../DataModels/ZuStore";
import { Interface, Netclass, Project } from "../../DataModels/ServiceModels";



interface NetStatsTabProps {
    netSummary: NetSummary,
    interfaceList: Interface[], 
    netclasses: Netclass[]
}

const NetStatsTab: React.FC<NetStatsTabProps> = ({ netSummary, interfaceList, netclasses }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);

    const [gridApi, setGridApi] = useState<GridApi>();
    
    const [quickFilterText, setQuickFilterText] = useState('')
    
    const containerRef = useRef<any>();

    useEffect(() => {
        placePageTitle("NetStats")
    }, []);
    
    
    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
        };
    }, []);


    const autoGroupColumnDef = {
        minWidth: 200,
        width: 200,
        maxWidth: 300,
        headerName: "Interface",
        resizable: true,
        cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
    }

    const columnDefs: Array<ColDef | ColGroupDef> = [
        {
            headerName: "Interface",
            field: "interfaceName",
            rowGroup: true,
            hide: true,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 250,
            // autoHeight: true,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'Bold', textAlign: 'left' } },
        },
        {
            headerName: "Netclass",
            field: 'netclassName',
            rowGroup: false,
            hide: false,
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 200,
            width: 200,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left'} }
        },
        {
            headerName: "Manually Assigned",
            field: 'manuallyAssigned',
            resizable: true,
            filter: 'text',
            cellDataType: 'text',
            minWidth: 180,
            width: 180,
            maxWidth: 270,
            sort: "asc",
            sortable: true,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight : 'normal', textAlign: 'left' } }
        },
        {
            headerName: "Auto Assigned",
            field: "autoAssigned",
            rowGroup: false,
            resizable: true,
            filter: 'text',
            minWidth: 180,
            width: 180,
            maxWidth: 270,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
        },
        {
            headerName: "Total Nets",
            field: "totalNetclassNets",
            rowGroup: false,
            resizable: true,
            filter: 'text',
            minWidth: 150,
            width: 150,
            maxWidth: 270,
            sort: "asc",
            sortable: true,
            editable: false,
            sortingOrder: ["asc", "desc"],
            cellStyle: (params: any) => { return { fontSize: '11px', fontWeight: 'normal', textAlign: 'left' } },
        },
       
    ];
    
    
    const onGridReady = useCallback((params: any) => {
        if(setGridApi) {
            setGridApi(params.api as GridApi);
        }
    }, []);
    

    return (
        <Box ref={containerRef}>
            <Box display="flex" justifyContent="center" sx={{ mt: 1 }}>
                <Box display="flex" justifyContent="center" width="100%" flexDirection="column">
                    <Box display="flex" width="20vw" justifyContent="center" flexDirection="column">
                        <table width={"100%"}>
                            <tbody>
                                <tr>
                                    <td style={{ width: 300 }}><Typography variant='overline'>Total Interfaces</Typography></td>
                                    <td style={{ width: 100 }}><Typography style={{ color: colors.greenAccent[400] }}>{interfaceList?.length ?? 0}</Typography></td>
                                </tr>
                                <tr>
                                    <td><Typography variant='overline'>Total Net Classes</Typography></td>
                                    <td><Typography style={{ color: colors.greenAccent[400] }}>{netclasses?.length ?? 0}</Typography></td>
                                </tr>
                                <tr>
                                    <td><Typography variant='overline'>Total Project Nets</Typography></td>
                                    <td><Typography style={{ color: colors.greenAccent[400] }}>{netSummary?.totalNets ?? 0}</Typography></td>
                                </tr>
                                <tr>
                                    <td><Typography variant='overline'>Total Assigned Nets</Typography></td>
                                    <td><Typography style={{ color: colors.greenAccent[400] }}>{netSummary?.totalAssignedNets ?? 0}</Typography></td>
                                </tr>
                                <tr>
                                    <td><Typography variant='overline'>Total Unassigned Nets</Typography></td>
                                    <td><Typography style={{ color: colors.greenAccent[400] }}>{netSummary?.totalUnassignedNets ?? 0}</Typography></td>
                                </tr>
                                <tr>
                                    <td><Typography variant='overline'>Total Diff-Paired Nets</Typography></td>
                                    <td><Typography style={{ color: colors.greenAccent[400] }}>{netSummary?.totalDiffPairedNets ?? 0}</Typography></td>
                                </tr>
                                
                            </tbody>
                        </table>
                        
                        <Slide timeout={{ enter: 400, exit: 400 }} direction="down" in={true} container={containerRef.current}>
                            <Divider sx={{width: "67vw", mt: 1, mb: 2}} />
                        </Slide>
                    </Box>

                    <div style={{ height: "61vh" }}>
                        <AgGridReact
                            rowData={netSummary?.netclassStats ?? []}
                            animateRows={true}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            autoGroupColumnDef={autoGroupColumnDef}
                            onGridReady={onGridReady}
                            theme={themeDarkBlue}
                            rowSelection={{ mode: "singleRow", checkboxes: false }}
                            suppressExcelExport={false}
                            suppressCsvExport={false}   
                            groupDisplayType='singleColumn'    
                            groupDefaultExpanded={1} 
                            quickFilterText={quickFilterText} 
                            rowHeight={25}
                            headerHeight={28}
                        />
                    </div>
                </Box>
            </Box>
        </Box>
    );
}

export default NetStatsTab



// const project = useSpiderStore((state) => state.project);
    // const projStats = useSpiderStore((state) => state.projStats);
    // const setProjStats = useSpiderStore((state) => state.setProjStats);

    

    // useEffect(() => {
    //     getProjectStats(project?._id?.toString() as string).then((netStats: ProjectStats) => {
    //         if(netStats) {
    //             setProjStats(netStats);
    //         }
    //     });
    // }, []);