import { useRef, useContext, useEffect } from "react";
import { useSpiderStore } from "../../DataModels/ZuStore";


interface ValidationsProps {
    
}


const Validations: React.FC<ValidationsProps> = ({  }) => {
    
    const placePageTitle = useSpiderStore((state) => state.placePageTitle);
    
    useEffect(() => {
        placePageTitle("Validations")
    }, []);
    
    return (
        <div>Project Validations</div>
    );
}


export default Validations