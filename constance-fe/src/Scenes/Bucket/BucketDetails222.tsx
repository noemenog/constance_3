import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { GridColumn, GridColumnIcon } from "@glideapps/glide-data-grid";
import { useLoaderData, useLocation } from "react-router-dom";
import { mapKeys } from "lodash";
import { ArrowRight } from "@mui/icons-material";
import { Box } from "@mui/material";
import { useCStore } from "../../DataModels/ZuStore";





interface BucketDetails222Props {
    
}


const BucketDetails222: React.FC<BucketDetails222Props> = ({  }) => {

    const placePageTitle = useCStore((state) => state.placePageTitle);

    useEffect(() => {
        placePageTitle("Faqs")
    }, []);


    return (
        <Box>Hello 100</Box>
    );
}

export default BucketDetails222




