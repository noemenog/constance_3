import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { GridColumn, GridColumnIcon } from "@glideapps/glide-data-grid";
import { useLoaderData, useLocation } from "react-router-dom";
import { mapKeys } from "lodash";
import { ArrowRight } from "@mui/icons-material";
import { Box } from "@mui/material";
import { useSpiderStore } from "../../DataModels/ZuStore";





interface FAQPageProps {
    
}


const FAQPage: React.FC<FAQPageProps> = ({  }) => {

    const placePageTitle = useSpiderStore((state) => state.placePageTitle);

    useEffect(() => {
        placePageTitle("Faqs")
    }, []);


    return (
        <Box>FAQ Page</Box>
    );
}

export default FAQPage






// {/* <NetsServerSideDataGrid 
//     dtHeight={"90vh"}
//     gridRef={gridRef} 
//     columns={columns} 
//     pageSize={50} 
//     maxConcurrency={1} /> */}




// const columns: GridColumn[] = useMemo(() => {
//     let arr = new Array<GridColumn>()
//     //TODO: make sure displayname is always set for net properties! this is required
    
//     let netNameCol : GridColumn = { 
//         id: "net_name", 
//         title: "Net Name", 
//         icon: GridColumnIcon.HeaderString
//     }
//     arr.push(netNameCol)

//     if(netPropNamesMap && netPropNamesMap.size > 0) {
//         let mapkeys = Array.from(netPropNamesMap.keys())
//         for(let i = 0; i < mapkeys.length; i++) {
//             let item : GridColumn = { 
//                 id: mapkeys[i], 
//                 title: netPropNamesMap.get(mapkeys[i]) ?? '', 
//                 icon: GridColumnIcon.HeaderString,
//             };
//             arr.push(item)
//         }
//     }

//     return arr
// }, []);