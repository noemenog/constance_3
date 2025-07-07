import { useContext, useRef, useState, useEffect } from "react";
import { useSpiderStore } from "../../DataModels/ZuStore";




interface LogViewProps {
    
}


const LogView: React.FC<LogViewProps> = ({  }) => {
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);

    useEffect(() => {
        placePageTitle("Logs")
    }, []);

    return (
        <div>Project Logs</div>
    );
}


export default LogView