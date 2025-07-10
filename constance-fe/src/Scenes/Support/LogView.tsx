import { useContext, useRef, useState, useEffect } from "react";
import { useCStore } from "../../DataModels/ZuStore";




interface LogViewProps {
    
}


const LogView: React.FC<LogViewProps> = ({  }) => {
    const placePageTitle = useCStore((state) => state.placePageTitle);

    useEffect(() => {
        placePageTitle("Logs")
    }, []);

    return (
        <div>Project Logs</div>
    );
}


export default LogView