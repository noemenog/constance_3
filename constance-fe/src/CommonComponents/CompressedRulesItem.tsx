import { Box, Divider, Tooltip, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext, tokens } from "../theme";
import { useTheme } from "@mui/material/styles";
import styled from "@emotion/styled";
import { RuleArea } from "../DataModels/ServiceModels";
import { ConstraintTypesEnum, SPECIAL_PUPRLE_COLOR, SPECIAL_RED_COLOR, UIMessageType } from "../DataModels/Constants";
import { EmojiObjects } from "@mui/icons-material";






interface CompressedRulesItemProps {
    ruleArea: RuleArea,
    constraintType: ConstraintTypesEnum,
    contentCount: number,
    onClick: (clickedItem: RuleArea) => void,
}

const CompressedRulesItem: React.FC<CompressedRulesItemProps> = ({ ruleArea, constraintType, contentCount, onClick }) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    function onComponentClick(ruleArea: RuleArea) {
        if(onClick) {
            onClick(ruleArea);
        }
    }

    const RA_NAME_CHECKER_CHAR_LENGTH = 44;


    function getRAStatusIconInfo() {
        let resp = {expandable: false, desc: "", color: colors.grey[100]}
       
        if(ruleArea.isActive === false){
            resp.desc = 'This rule area is disabled';
            resp.color = SPECIAL_RED_COLOR;
        }
        else if(contentCount === 0) {
            resp.desc = 'This rule area has no constraints to display';
            resp.color = SPECIAL_PUPRLE_COLOR;
        }
        else {
            resp.expandable = true,
            resp.desc = 'This rule area is enabled';
            resp.color = colors.greenAccent[400];
        }

        return resp;
    }
    
    



    
    return (
        <Box sx={{overflow: "hidden" }}>
            <Box 
                sx={{ display: 'flex', alignItems: 'center' }} 
                display="flex" 
                height="8" 
                justifyContent="space-between"
            >

                <table style={{ backgroundColor: colors.primary[400] }}>
                    <tbody>
                        <tr>
                            <td style={{ minWidth: 400, width: "90%", cursor: "pointer" }} onClick={() => onComponentClick(ruleArea)}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }} flexDirection={"row"}>
                                    <Tooltip placement="top-start" title={(getRAStatusIconInfo().expandable === false) ? getRAStatusIconInfo().desc : ''} >
                                        <span>
                                            <Typography sx={{ ml: 1, mr: 1, fontSize: ruleArea.ruleAreaName.length > RA_NAME_CHECKER_CHAR_LENGTH ? 12.5 : undefined }}> 
                                                {ruleArea.ruleAreaName.toUpperCase() }
                                            </Typography>
                                        </span>
                                    </Tooltip>
                                </Box>
                            </td>
                            <td style={{minWidth:60}}>
                                <Box sx={{ display: 'flex', alignItems: 'center'}} flexDirection={"row"}>
                                    <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                    <Divider orientation="vertical" sx={{ml: 2, mr: 2, height:66}} />
                                    <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                </Box>
                            </td>
                            <td style={{minWidth:125}}>
                                <Box>
                                    <Box display="flex" sx={{ ml: 2, mr: 2, fontSize: 12, minWidth: 325}} flexDirection="row">
                                        <Typography sx={{ width: 170, fontSize: 12, color: colors.blueAccent[100]}}>
                                            <span>{constraintType === ConstraintTypesEnum.Physical ? "PHY rules (netclasses) :" : "SPC rules (relations) :"}</span>
                                            <span>&nbsp;&nbsp;</span>
                                            <span>{contentCount}</span>
                                        </Typography>
                                    </Box>
                
                                    <Box display="flex" sx={{ ml: 2, mr: 2, fontSize: 12, minWidth: 325}} flexDirection="row">
                                        <Typography sx={{ width: 170, fontSize: 12, color: colors.blueAccent[100]}}>
                                            <span>{"RuleArea status :"}</span>
                                            <span>&nbsp;&nbsp;&nbsp;</span>
                                            <span>{ruleArea.isActive ? "Enabled" : "Disabled"}</span>
                                        </Typography>
                                    </Box>
                                </Box>
                            </td>
                            <td style={{minWidth:60}}>
                                <Box sx={{ display: 'flex', alignItems: 'center'}} flexDirection={"row"}>
                                    <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                    <Divider orientation="vertical" sx={{ml: 2, mr: 2, height:66}} />
                                    <Divider sx={{width: 10, mt: 2, mb: 2}} />
                                </Box>
                            </td>
                            <td style={{minWidth:130, textAlign:"right"}}>
                                <Tooltip placement="top" title={getRAStatusIconInfo().desc} >
                                    <EmojiObjects sx={{ mr: 3, color: getRAStatusIconInfo().color}} />
                                </Tooltip>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
            </Box>
        </Box>
    );
};

export default CompressedRulesItem








{/* <Switch
    size={"small"}
    style={{ color: colors.grey[100] }}
    checked={switchEnabled}
    onChange={(e, checked) => onComponentSwitchToggled(checked)}
/> */}


// interface InterfaceClearanceRulesTabProps {
//     iface: Interface //passed in for a reason! 
//     netclasses: Netclass[], //passed in for a reason!
//     projStats: ProjectStats //passed in for a reason!
//     focusRA: RuleArea|null|undefined, 
//     setFocusRA: any,
// }

// const InterfaceClearanceRulesTab: React.FC<InterfaceClearanceRulesTabProps> = ({ iface, focusRA, setFocusRA, netclasses, projStats }) => {
//     const theme = useTheme();
//     const colors = tokens(theme.palette.mode);
    
//     const domainData = useLoaderData() as SPDomainData;
//     const project = domainData.project;
//     const packageLayout = domainData.packageLayout;
//     const clearancePropNamesMap = domainData.clearancePropNamesMap;

//     const confConstraintProps = useSpiderStore((state) => state.confConstraintProps);
//     const placePageTitle = useSpiderStore((state) => state.placePageTitle);
//     const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);


//     useEffect(() => {
//         placePageTitle("InterfaceClearanceRules")
//     }, []);


//     const confRelevantProps = useMemo(() => {         
//         let relevantProps = new Map<string, PropertyItem>();
//         if(confConstraintProps && confConstraintProps.length > 0) {
//             for(let i = 0; i < confConstraintProps.length; i++) {
//                 let prop = confConstraintProps[i] as PropertyItem
//                 if(prop.category && prop.category.toLowerCase().trim() === ConstraintPropertyCategoryEnum.Clearance.toLowerCase()) {
//                     relevantProps.set(prop.name, prop)
//                 }
//             }
//         }

//         if(relevantProps.size === 0) {
//             displayQuickMessage(UIMessageType.ERROR_MSG, `Configured clearance rule properties were not found. Please check config management system for '${CONFIGITEM__Clearance_Constraint_Properties}'`)
//         }

//         return relevantProps
//     }, []);


//     const lgSetOptions : GridDropDownOption[]= useMemo(() => {         
//         let opts = new Array<GridDropDownOption>();
//         for(let lgSet of packageLayout?.layerGroupSets ?? []) {
//             if(lgSet.name && lgSet.id && lgSet.name.length > 0) {
//                 opts.push({label: lgSet.name, value: lgSet.id} as GridDropDownOption) 
//             }
//         }
//         return opts;
//     }, []);


//     const lgSetMapping = useMemo(() => {         
//         let map = new Map<string, {lgSetObj: LayerGroupSet, lgMapping: Map<string, LayerGroup>}>();
//         for(let lgSet of packageLayout?.layerGroupSets ?? []) {
//             let lgMap = new Map<string, LayerGroup>();
//             for(let lg of lgSet.layerGroups) {
//                 lgMap.set(lg.id, lg)
//             }
//             map.set(lgSet.id, {lgSetObj: lgSet, lgMapping: lgMap})
//         }
//         return map;
//     }, []);


//     const maxLGCount = useMemo(() => {         
//         let max = 0;
//         for(let lgSet of packageLayout?.layerGroupSets ?? []) {
//             if(lgSet.layerGroups && lgSet.layerGroups.length > max) {
//                 max = lgSet.layerGroups.length;
//             }
//         }
//         return max;
//     }, []);


//     function handleOnClick (clickedRuleArea: RuleArea) {
//         if(clickedRuleArea) {
//             if(focusRA && clickedRuleArea && focusRA.id === clickedRuleArea.id)
//             {
//                 setFocusRA(null) 
//             }
//             else {
//                 setFocusRA({...clickedRuleArea} as RuleArea) 
//             }
//         }
//     }

//     function onLGSetChange (clickedRuleArea: RuleArea) {
//         if(clickedRuleArea) {
//             if(focusRA && clickedRuleArea && focusRA.id === clickedRuleArea.id)
//             {
//                 //do nothing for now...
//             }
//         }
//     }
    
//     return (
//         <>
//             <Box className="staggered-list-content">
//                 {(packageLayout && packageLayout.ruleAreas && packageLayout.ruleAreas.length > 0) && 
//                     <ul className="list">
//                         {packageLayout.ruleAreas.map((ra: RuleArea, i: number) => {
//                             return (
//                                 <li key={`itm-${i}`} style={{ minWidth: 400}}>
//                                     {((focusRA && focusRA.id === ra.id))
//                                         ? <ExpandedRulesItem key={`exp-${i}`} ruleArea={focusRA} iface={iface}
//                                         project={project as Project} projStats={projStats as ProjectStats} lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} confRelevantProps={confRelevantProps} 
//                                         lcgPropNamesMap={clearancePropNamesMap} constraintType={ConstraintTypesEnum.Clearance} onClick={handleOnClick} onLGSetChange={onLGSetChange}/> 

//                                         : <CompressedRulesItem key={`cpr-${i}`} ruleArea={ra} onClick={handleOnClick} constraintType={ConstraintTypesEnum.Physical} />
//                                     }
//                                 </li>
//                             );
//                         })}
//                     </ul>
//                 }  
//             </Box>
//         </>
//     )
// }

// export default InterfaceClearanceRulesTab