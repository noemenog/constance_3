import * as React from 'react';
import { Box, Divider, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ConstraintTypesEnum, SPECIAL_RED_COLOR, UIMessageType } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { BasicKVP, PropertyItem } from '../DataModels/HelperModels';
import { useSpiderStore } from '../DataModels/ZuStore';
import ExpandedRulesItem from '../CommonComponents/ExpandedRulesItem';
import { PackageLayout, Project, RuleArea } from '../DataModels/ServiceModels';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { GridDropDownOption } from '../CommonComponents/BaseGlideGrid';
import { getLGSetMapping, getLGSetOptions, getMaxLGCount, getRelevantProps } from '../BizLogicUtilities/BasicCommonLogic';
import { SpButton } from '../CommonComponents/SimplePieces';





export interface ConstraintEditorDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (contextualInfo: BasicKVP) => void,
    title: string,
    project: Project,
    packageLayout: PackageLayout,
    constraintType: ConstraintTypesEnum,
    ruleArea: RuleArea,
    associatedInterfaceId: string,
    exclusiveElementIdSet: Set<string>,
    enableLinkageBasedRefresh?: boolean,
    contextualInfo: BasicKVP
}

const ConstraintEditorDialog: React.FC<ConstraintEditorDialogProps> = ({ title, opened, close, onFormClosed, 
    project, packageLayout, constraintType, ruleArea, associatedInterfaceId, exclusiveElementIdSet, enableLinkageBasedRefresh, contextualInfo}) => {
    
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [relevantProps, setRelevantProps] = useState<Map<string, PropertyItem>>(new Map<string, PropertyItem>())
    
    const containerRef = useRef<HTMLElement>(null);  //important!

    const showRightElementOnGrid = useSpiderStore((state) => state.showRightElementOnGrid);
    const setShowRightElementOnGrid = useSpiderStore((state) => state.setShowRightElementOnGrid);
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);

    const sectionStyle = useMemo(() => (
        { padding: 2, borderTopLeftRadius: 0, borderTopRightRadius: 200, borderBottomLeftRadius: 0, borderBottomRightRadius: 200, backgroundColor: colors.primary[400] }
    ), []);


    const handleClose = () => {
        if (onFormClosed) {
            onFormClosed(contextualInfo);
        }
        if(close){ close() }
    };


    //============== For RR tabs =====================================
    useMemo(() => {         
        let res = getRelevantProps(project, constraintType)
        if(res.isSuccessful === false) {
            displayQuickMessage(UIMessageType.ERROR_MSG, res.message);
        }
        setRelevantProps(res.data as Map<string, PropertyItem>);
    }, [project]);


    const lgSetOptions : GridDropDownOption[] = useMemo(() => {   
        let opts = getLGSetOptions(packageLayout); 
        return opts;
    }, []);


    const lgSetMapping = useMemo(() => { 
        let map = getLGSetMapping(packageLayout); 
        return map;
    }, []);


    const maxLGCount = useMemo(() => {         
        let max = getMaxLGCount(packageLayout)
        return max;
    }, []);




    return (
        <Box>
            <Modal 
                opened={opened as boolean}
                onClose={handleClose} 
                centered
                closeOnClickOutside={false}
                closeOnEscape={false}
                size="auto"
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 8,
                }}
                styles={{                 
                    title: { padding: 0, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: SPECIAL_RED_COLOR, backgroundColor: colors.primary[400] }
                }}>
                    
                <Box ref={containerRef} flexDirection="column" sx={{ '& .MuiTextField-root': { width: '100%'}, }}>
                                    
                    <Box justifyContent="center" alignItems="center" sx={{padding: 1, minWidth: "85vw"}}>
                        <Divider sx={{mt: 0, mb: .5}} />

                        <ExpandedRulesItem ruleArea={ruleArea} interfaceId={associatedInterfaceId} project={project as Project} lgSetMapping={lgSetMapping} 
                            lgSetOptions={lgSetOptions} maxLGCount={maxLGCount} relevantPropMap={relevantProps} 
                            constraintType={constraintType} enableSearchField={false} enableLinkageBasedRefresh={enableLinkageBasedRefresh} exclusiveElementIdSet={exclusiveElementIdSet} onClick={(ra) => {}} /> 

                    </Box>
                
                </Box>

                <Divider sx={{ mt: .7, mb: .5 }}/>

                <Box sx={{display: "flex", flexDirection:"row", justifyContent: "space-between", alignItems:"center"}}>
                    <Box sx={{display: "flex", flexDirection:"row"}}>
                        <SpButton
                            intent="cancel"
                            onClick={handleClose}
                            startIcon={<Cancel />}
                            sx={{ mr: 1, mt: 1, height: 32, width:200 }}
                            label="Close" />
                    </Box>
                    
                    <Box sx={{display: "flex", flexDirection:"row", justifyContent: "center", alignItems:"center"}}>
                        <Divider sx={{ width: 33 }}/>
                        <Divider orientation="vertical" sx={{height: 35, marginLeft: 2, marginRight: 2 }} />
                        <Divider sx={{ width: 33 }}/>
                    </Box>

                    <Tooltip placement="top" title={(showRightElementOnGrid) ? `Hide right panel on grid` : `Show right panel on grid`}>
                        <FormControlLabel sx={{ backgroundColor: colors.blueAccent[300], ':hover': { bgcolor: colors.blueAccent[400]}, padding: .4, borderRadius: 2, ml: 0, mr: .5, mt: 1}} control={<Switch 
                            size="small"
                            sx={{ ml: .5 }} 
                            checked={showRightElementOnGrid}
                            onChange={(e, checked) => setShowRightElementOnGrid(checked) } 
                        />} label={<Typography sx={{mr: 1, color: colors.grey[100], fontSize: 12}}>{ showRightElementOnGrid ? `Hide History Panel` : 'Show History Panel' }</Typography>} />
                    </Tooltip>

                </Box>
            </Modal>
        </Box>
    );
}

export default ConstraintEditorDialog














// let relInfo = await getRelationNameElementsForIface(projectId, iface._id as string, null)
// let res = await onCommonRoutingRulesGridInitialDataFetch(constraintType, relevDataMappingRef.current, lgSetMapping, projectId, Number.MAX_SAFE_INTEGER, ruleArea.id, iface._id, null, true)



{/* <Box className="staggered-list-content">
    {visibleRuleAreas && 
        <ul className="list">
            {visibleRuleAreas.map((ra: RuleArea, i: number) => {
                return (
                    <li key={`itm-${i}`} style={{ minWidth: 400}}>
                        {((focusRA && focusRA.id === ra.id))
                            ? <ExpandedRulesItem key={`exp-${i}`} ruleArea={focusRA} iface={iface}
                                project={project as Project} lgSetMapping={lgSetMapping} lgSetOptions={lgSetOptions} 
                                maxLGCount={maxLGCount} relevantPropMap={relevantPropMap}
                                constraintType={ConstraintTypesEnum.Clearance} onClick={handleOnClick} onLGSetChange={onLGSetChange}/> 

                            : <CompressedRulesItem 
                                key={`cpr-${i}`} 
                                ruleArea={ra} 
                                onClick={handleOnClick} 
                                constraintType={ConstraintTypesEnum.Clearance} 
                                contentCount={clrRelMappingInfo.get(ra.id)?.length ?? 0 }/>
                        }
                    </li>
                );
            })}
        </ul>
    }  
</Box> */}