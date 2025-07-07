import * as React from 'react';
import TextField from '@mui/material/TextField';
import { Autocomplete, Box, Divider } from '@mui/material';
import { Cancel, Check } from '@mui/icons-material';
import { useContext, useMemo, useState } from "react";
import { ErrorOption, useForm } from 'react-hook-form';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MIN_DESCRIPTION_LENGTH, BASIC_NAME_VALIDATION_REGEX, ProjectPropertyCategoryEnum, SPECIAL_DARK_GOLD_COLOR, UIMessageType, NamingContentTypeEnum, SPECIAL_RED_COLOR, SPECIAL_BLUE_COLOR } from '../DataModels/Constants';
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { Project } from '../DataModels/ServiceModels';
import { BasicKVP, BasicProperty, DisplayOption, LoggedInUser, PropertyItem } from '../DataModels/HelperModels';
import { useSpiderStore } from '../DataModels/ZuStore';
import { MultiRegexCollection } from '../CommonComponents/MultiRegexCollection';
import { isUserApprovedForProjectRestrictorChangeAction } from '../BizLogicUtilities/Permissions';
import { verifyNaming } from '../BizLogicUtilities/UtilFunctions';
import { getSpecialAccessGuardKeyInfo } from '../BizLogicUtilities/FetchData';
import { sort } from 'fast-sort';
import { SpButton } from '../CommonComponents/SimplePieces';





const NONE_DISP_OPTION = { id: "N/A", label: "N/A" } as DisplayOption;

export interface ProjectSetupDialogProps {
    opened?: boolean,
    close?: () => void,
    onFormClosed: (contextualInfo: BasicKVP) => void,
    title: string,
    orgs: string[],
    maturityValues: string[],
    isUpdateScenario: boolean,
    contextualInfo: BasicKVP
}

const ProjectSetupDialog: React.FC<ProjectSetupDialogProps> = ({opened, title, orgs, maturityValues, isUpdateScenario, contextualInfo, close, onFormClosed}) => {
        
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const loggedInUser = useSpiderStore((state) => state.loggedInUser) as LoggedInUser
    const displayQuickMessage = useSpiderStore((state) => state.displayQuickMessage);
    const setIsLoadingBackdropEnabled = useSpiderStore((state) => state.setIsLoadingBackdropEnabled);
    const gateKeyPermInfooMap = useSpiderStore((state) => state.specialAccessGuardPermInfoMap);

    const [regExprData, setRegExprData] = useState<BasicKVP[]>();
    const [project, setProject] = useState<Project|undefined>();
    const [speciallAccessEntList, setSpeciallAccessEntList] = useState<DisplayOption[]>([NONE_DISP_OPTION]);
    const [selectedOrg, setSelectedOrg] = useState<string|null>(null);
    const [selectedMaturity, setSelectedMaturity] = useState<string|null>(null);
    
    const [specialAccessGuardEntity, setSpecialAccessGuardEntity] = useState<DisplayOption|null>(null);
    

    useMemo(() => {  
        if(gateKeyPermInfooMap && gateKeyPermInfooMap.size > 0) {
            let arr : DisplayOption[] = Array.from(gateKeyPermInfooMap).map(([key, value]) => ({ id: key, label: value } as DisplayOption))
            arr = sort(arr).asc(a => a.label.toUpperCase())
            setSpeciallAccessEntList([NONE_DISP_OPTION, ...arr]);
        }
        else if(speciallAccessEntList.length === 1) {
            setIsLoadingBackdropEnabled(true)
            getSpecialAccessGuardKeyInfo().then(resp => {
                if(resp.isSuccessful === false) {
                    displayQuickMessage(UIMessageType.ERROR_MSG, resp.message)
                }
                else {
                    if(resp.data && resp.data.size > 0) {
                        let arr : DisplayOption[] = Array.from(resp.data).map(([key, value]) => ({ id: key, label: value } as DisplayOption))
                        arr = sort(arr).asc(a => a.label.toUpperCase())
                        setSpeciallAccessEntList([NONE_DISP_OPTION, ...arr]);
                    }
                }
            })
            .finally(() => {
                setIsLoadingBackdropEnabled(false)
            })
        }
        
    }, []);


    useMemo(() => {  
        if(isUpdateScenario === true) {
            if(!contextualInfo.value || !(contextualInfo.value as Project)._id) {
                displayQuickMessage(UIMessageType.ERROR_MSG, "Invalid project data detected. Cannot proceed with update!");
                handleCancel();
            }
            else {
                let proj = contextualInfo.value as Project
                setProject(proj);
                setSelectedOrg(proj.org);
                setSelectedMaturity(proj.maturity);
            } 
        }
        else {
            let proj : Project = {
                _id: '',
                projectId: '',
                snapshotSourceId: '',
                contextProperties: [],
                enabled: true,
                lastUpdatedOn: new Date(),
                name: "",
                createdOn: new Date(),
                createdBy: '',
                org: "",
                description: '',
                maturity: '',
                owner: { email: loggedInUser.email, idsid: loggedInUser.idsid },
                lockedBy: null,
                notes: null,
                physicalLinkages: [],
                clearanceLinkages: [],
                clearanceRelationBrands: [],
                associatedProperties: [],
                constraintSettings: [],
                profileProperties: []      
            };

            setProject(proj);
        }
    }, []);


    const pwrNetsToIgnore : string[] = useMemo(() => {
        let igPNArr = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS && a.name === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS))?.value ?? []
        return igPNArr;
    }, [project]);


    const exisDiffIgnoreRegExpProp : BasicKVP[] = useMemo(() => {
        let diRegs = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA && a.name === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA))?.value ?? []
        return diRegs;
    }, [project]);


    const accessGuardItem : DisplayOption = useMemo(() => {
        let acg : string = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.ACCESS_GUARD && a.name === ProjectPropertyCategoryEnum.ACCESS_GUARD))?.value || "";
        if(acg && acg.length > 0 && speciallAccessEntList && speciallAccessEntList.length > 0) {
            let found = speciallAccessEntList.find(a => a.id === acg);
            if(found) {
                return found;
            }
        } 
        return NONE_DISP_OPTION;
    }, [project, speciallAccessEntList]);


    const { register, getValues, setError, clearErrors, handleSubmit, reset, setValue, formState: { errors } } = useForm({
        defaultValues: {
            orgField: (contextualInfo.value as Project)?.org ?? 'hello mar=s'  as string,
            nameField: (contextualInfo.value as Project)?.name ?? 'hello jupiter' as string,
            descriptionField: (contextualInfo.value as Project)?.description ?? "hello spain" as string,
            maturityField: (contextualInfo.value as Project)?.maturity?.toString() ?? "hello portugal" as string,
            netsToIgnoreLargeTextField: pwrNetsToIgnore?.join(", ") ?? '' as string,
            designField: '',
            specialAccessGuardField: accessGuardItem.label || ''
        }
    });


    useMemo(() => {  
        if(project && pwrNetsToIgnore && accessGuardItem) {
            reset({
                orgField : project?.org || "",
                nameField : project?.name || "",
                descriptionField : project?.description || "",
                maturityField : project?.maturity || "",
                netsToIgnoreLargeTextField :  pwrNetsToIgnore?.join(", ") ?? "",
                specialAccessGuardField : accessGuardItem.label || '',
            });
            setSpecialAccessGuardEntity(accessGuardItem);
        } 
    }, [project, pwrNetsToIgnore, accessGuardItem]);


    function determineIfToDisableRestrictorChange(): boolean {
        if(project) {
            let res = isUserApprovedForProjectRestrictorChangeAction(loggedInUser, project);
            return (res === true) ? false : true;
        }
        return true;
    }


    function processProjectPropertyUpdates(data: any) : PropertyItem[] {
        let pwrNetSet = new Set<string>();
        if(data.netsToIgnoreLargeTextField && data.netsToIgnoreLargeTextField.length > 0) {
            try { 
                let pnti : string[] = data.netsToIgnoreLargeTextField.split(",")?.map((a: string) => a.trim())
                verifyNaming(pnti, NamingContentTypeEnum.NET)
                pnti.forEach(a => pwrNetSet.add(a));
            }
            catch(err: any) {
                throw err;
            }
        }

        let pwrNetsToIgnore = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS && a.name === ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS))
        if(pwrNetsToIgnore) {
            pwrNetsToIgnore.value = Array.from(pwrNetSet);
        }
        else {
            pwrNetsToIgnore = {
                id: crypto.randomUUID(),
                name: ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS,
                displayName : ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS,
                category: ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS,
                editable: false,
                enabled: true,
                value: Array.from(pwrNetSet),
            } as PropertyItem
        }

        //Handle diff ignoration regex 
        let diffIgnoreRegExpProp = project?.associatedProperties?.find(a => (
            a.category === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA && a.name === ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA))
        if(diffIgnoreRegExpProp) {
            diffIgnoreRegExpProp.value = regExprData ?? [];
        }
        else {
            diffIgnoreRegExpProp = {
                id: crypto.randomUUID(),
                name: ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA,
                displayName : ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA,
                category: ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA,
                editable: false,
                enabled: true,
                value: regExprData ?? [],
            } as PropertyItem
        }

        //Handle special project access entitlements 
        let sagId = speciallAccessEntList.find(k => k.label === data.specialAccessGuardField)?.id || ""
        let sagProp = project?.associatedProperties?.find(a => (a.category === ProjectPropertyCategoryEnum.ACCESS_GUARD && a.name === ProjectPropertyCategoryEnum.ACCESS_GUARD))
        if(sagProp) {
            sagProp.value = sagId || "";
        }
        else {
            sagProp = {
                id: crypto.randomUUID(),
                name: ProjectPropertyCategoryEnum.ACCESS_GUARD,
                displayName : ProjectPropertyCategoryEnum.ACCESS_GUARD,
                category: ProjectPropertyCategoryEnum.ACCESS_GUARD,
                editable: false,
                enabled: true,
                value: sagId || "",
            } as PropertyItem
        }

        let projList = Array.from(project?.associatedProperties ?? []);
        
        let nonPNTI = projList.filter(x => x.category !== ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS && x.name !== ProjectPropertyCategoryEnum.IGNORABLE_POWER_NETS)
        projList = [pwrNetsToIgnore, ...nonPNTI];
        
        let nonDIRP = projList.filter(x => x.category !== ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA && x.name !== ProjectPropertyCategoryEnum.DIFFPAIR_EXCLUSION_CRITERIA)
        projList = [diffIgnoreRegExpProp, ...nonDIRP];

        let nonSAG = projList.filter(x => x.category !== ProjectPropertyCategoryEnum.ACCESS_GUARD && x.name !== ProjectPropertyCategoryEnum.ACCESS_GUARD)
        projList = [sagProp, ...nonSAG];

        return projList;
    }


    const handleFormSubmit = (data: any) => {
        try {
            let outputProject = {...project};

            if(!data.orgField || data.orgField.length === 0) {
                throw new Error(`Invalid org specified`);
            }
            if(!data.nameField || data.nameField.length === 0) {
                throw new Error(`Invalid project name specified`);
            }
            if(!data.descriptionField || data.descriptionField.length === 0) {
                throw new Error(`Invalid project description specified`);
            }
            if(!data.maturityField || data.maturityField.length === 0) {
                throw new Error(`Invalid project maturity specified`);
            }
            if(data.specialAccessGuardField || data.specialAccessGuardField.length > 0) {
                if(speciallAccessEntList.map(a => a.label).includes(data.specialAccessGuardField) === false) {
                    throw new Error(`Invalid access guard element selection`);
                }
            }

            try {
                verifyNaming([data.nameField.trim()], NamingContentTypeEnum.PROJECT)
            }
            catch(e: any) {
                throw new Error(e.message);
            }  

            if(isUpdateScenario === false) {
                outputProject.org = data.orgField.toUpperCase().trim();
                outputProject.createdBy = loggedInUser.email.trim();
                outputProject.createdOn = new Date();
            }

            outputProject.name = data.nameField.trim();
            outputProject.description = data.descriptionField.trim();
            outputProject.maturity = data.maturityField.trim();
            outputProject.lastUpdatedOn = new Date();
            outputProject.associatedProperties = processProjectPropertyUpdates(data);

            if (onFormClosed) {
                contextualInfo.value = outputProject;
                onFormClosed(contextualInfo);
            }

            handleReset();
            if(close){ close() }
        }
        catch(err: any) {
            displayQuickMessage(UIMessageType.ERROR_MSG, `Error encountered while processing input data ---- ${err.message}`)
            return;
        }
    };


    function handleCancel() {
        if (onFormClosed) {
            contextualInfo.value = null;
            onFormClosed(contextualInfo);
        }
        handleReset();
        if(close){ close() }
    };


    function handleReset() {
        reset();
        setRegExprData([]);
        setProject(undefined);
        setSpeciallAccessEntList([]);
        setSelectedOrg(null);
        setSelectedMaturity(null);
        setSpecialAccessGuardEntity(null); 
    }





    return (
        <Box>
            <Modal 
                opened={opened as boolean} 
                onClose={handleCancel}
                closeOnClickOutside={false}
                size={isUpdateScenario ? "calc(70vw - 3rem)" : "calc(35vw - 3rem)"}
                title={title}
                transitionProps={{ transition: 'fade', duration: 600 }}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 3,
                }}
                styles={{
                    title: { padding: 2, color: "#000000" },
                    header: { backgroundColor: colors.grey[100] },
                    body: { color: SPECIAL_RED_COLOR, backgroundColor: colors.primary[400] }
                }}>
                    <form onSubmit={handleSubmit(handleFormSubmit)}>
                        <Box sx={{ '& .MuiTextField-root': { width: '100%'} }}>
                            <Box sx={isUpdateScenario ? { height: "70vh", overflowY: "scroll" } : {}}>
                            <Divider />

                            <Autocomplete 
                                value={selectedOrg}
                                onChange={(event: any, newValue: string | null) => {
                                    setSelectedOrg(newValue);
                                }}
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                id="org-cb"
                                size="small"
                                sx={{ ml: 1, mr: 1, minWidth: 200, width: "97%", marginTop: 4 }}
                                options={['', ...orgs]}
                                renderInput={(params: any) => <TextField size="small" {...register("orgField", {
                                    required: 'Org is required',
                                })} {...params} 
                                    label="Select Org/Business Unit"
                                    error={(errors.orgField?.message && errors.orgField?.message.length > 0) ? true : false}
                                    helperText={errors.orgField?.message}
                                />}
                            />

                            <Box sx={{ ml: .9, width: "97%", marginTop: 4}}>
                                <TextField {...register("nameField", {
                                        required: 'Project name is required',
                                        minLength: { value: 3, message: 'Project name must have minimum of 3 characters' },
                                        pattern: {
                                            value: BASIC_NAME_VALIDATION_REGEX,
                                            message: "Invalid 'special' character"
                                        }
                                    })}
                                    id="proj-name-text"
                                    size="small"
                                    label="Specify Project Name"
                                    error={(errors.nameField?.message && errors.nameField?.message.length > 0) ? true : false}
                                    helperText={errors.nameField?.message}
                                    sx={{ alignSelf: "start", minWidth: 200 }} 
                                />

                                <TextField {...register("descriptionField", {
                                        required: 'Project description is required',
                                        minLength: { value: MIN_DESCRIPTION_LENGTH, message: `Please provide descriptive text for project. Minimum: ${MIN_DESCRIPTION_LENGTH} characters` },
                                        maxLength: 250
                                    })}
                                    id="conf-desc-text"
                                    label="Provide description for project"
                                    multiline
                                    maxRows={10}
                                    slotProps={{ htmlInput: { maxLength: 240 } }}
                                    error={(errors.descriptionField?.message && errors.descriptionField?.message.length > 0) ? true : false}
                                    helperText={errors.descriptionField?.message}
                                    sx={{ alignSelf: "start", minWidth: 200, marginTop: 4}} 
                                />

                            </Box>

                            <Autocomplete 
                                value={selectedMaturity}
                                onChange={(event: any, newValue: string | null) => {
                                    setSelectedMaturity(newValue);
                                }}
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                id="maturity-cb"
                                size="small"
                                sx={{ m: 1, minWidth: 200, width: "97%", marginTop: 4 }}
                                options={['', ...maturityValues]}
                                renderInput={(params: any) => <TextField size="small" {...register("maturityField", {
                                        required: 'Project maturity is required',
                                    })} {...params} 
                                    label="Select Project Maturity"
                                    error={(errors.maturityField?.message && errors.maturityField?.message.length > 0) ? true : false}
                                    helperText={errors.maturityField?.message}
                                />}
                            />

                            {/*=============Intended for IFS Entitlement check --- DISABLED FOR NOW ============================ */}
                            {/* <Autocomplete<DisplayOption>
                                value={specialAccessGuardEntity}
                                onChange={(event: any, newValue: DisplayOption | null) => {
                                    setSpecialAccessGuardEntity(newValue);
                                }}
                                key="restriction-sel-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="restriction-sel-cb"
                                options={speciallAccessEntList}
                                sx={{m: 1, minWidth: 200, width: "97%", marginTop: 4}}
                                disabled={isUpdateScenario ? determineIfToDisableRestrictorChange() : false}
                                getOptionLabel={(option) => option.label } //Important!
                                renderInput={(params) => <TextField {...register("specialAccessGuardField", {
                                    required: 'A selection is required',
                                    })} {...params} 
                                    label="Select IFS Project" 
                                    size="small" 
                                    sx={{ fieldset : { borderColor: SPECIAL_DARK_GOLD_COLOR } }}
                                    error={(errors.specialAccessGuardField?.message && errors.specialAccessGuardField?.message.length > 0) ? true : false}
                                    helperText={errors.specialAccessGuardField?.message}
                                />}
                            /> */}

                            {isUpdateScenario && 
                                <Box sx={{width: "97%", marginTop: 4}}>
                                    <Divider sx={{ ml: 1, mt: 2, mb: 3, width: "100%", backgroundColor: SPECIAL_BLUE_COLOR}}/>
                                    
                                    <TextField {...register("netsToIgnoreLargeTextField", {
                                            required: false
                                        })}
                                        id="lrg-txt-area"
                                        size="small"
                                        label="Specify Power Nets to Ignore (comma delimited)"
                                        multiline
                                        maxRows={10}
                                        error={(errors.netsToIgnoreLargeTextField?.message && errors.netsToIgnoreLargeTextField?.message.length > 0) ? true : false}
                                        helperText={errors.netsToIgnoreLargeTextField?.message}
                                        sx={{ m: 1, minWidth: 200}} 
                                    />
                            
                                    <Box sx={{ml: 1, mt: 4}}>
                                        <MultiRegexCollection 
                                            onExpressionAdded={(kvpArr) => setRegExprData(kvpArr)} 
                                            regexForValidation={BASIC_NAME_VALIDATION_REGEX}
                                            title="Specify criteria for nets that should be excluded during auto diff-pairing process"
                                            regexExprDefaultValues={exisDiffIgnoreRegExpProp ?? []} />
                                    </Box>
                                </Box>
                            }
                            </Box>
                        </Box>


                        <Divider sx={{ mt: 4, mb: 1 }}/>
                        
                        <SpButton
                            intent="cancel"
                            onClick={handleCancel}
                            startIcon={<Cancel />}
                            sx={{ m: 1, height: 32, width:200 }}
                            label="Cancel" />

                        <SpButton
                            intent="plain"
                            type="submit"
                            startIcon={<Check />}
                            sx={{ m: 1, height: 32, width:200 }}
                            label="Submit" />
                        
                    </form>

            </Modal>
        </Box>
    );
}

export default ProjectSetupDialog









// <Autocomplete 
//     value={selectedDesign}
//     onChange={(event: any, newValue: string | null) => {
//         setSelectedDesign(newValue);
//     }}
//     freeSolo={false}
//     filterSelectedOptions={true}
//     disablePortal
//     disableListWrap
//     id="helios-design-cb"
//     size="small"
//     sx={{ m: 1, minWidth: 200, width: "97%", marginTop: 4 }}
//     options={['', ]}
//     renderInput={(params: any) => <TextField size="small" {...register("designField", {
//             required: false,
//         })} {...params} 
//         label="Select Associated Design"
//         error={(errors.designField?.message && errors.designField?.message.length > 0) ? true : false}
//         helperText={errors.designField?.message}
//     />}
// />



//=====================================================

// reset({
//     orgField : project?.org || "",
//     nameField : project?.name || "",
//     descriptionField : project?.description || "",
//     maturityField : project?.maturity || "",
//     netsToIgnoreLargeTextField :  pwrNetsToIgnore?.join(", ") ?? "",
//     ifsGuardField : ifsGuardItem.label || '',
// });

// setValue("orgField", project?.org || '');
// setValue("nameField", project?.name || '');
// setValue("descriptionField", project?.description || '');
// setValue("maturityField", project?.maturity || '');
// setValue("netsToIgnoreLargeTextField",  pwrNetsToIgnore?.join(", ") ?? '');
// setValue("ifsGuardField", ifsGuardItem.label || ''); 

// setValue("orgField", project?.org || '');
// setValue("nameField", project?.name || '');
// setValue("descriptionField", project?.description || '');
// setValue("maturityField", project?.maturity || '');
// setValue("netsToIgnoreLargeTextField",  pwrNetsToIgnore?.join(", ") ?? '');
// setValue("ifsGuardField", ifsGuardItem.label || ''); 



{/* <Autocomplete<DisplayOption>
                                value={{
                                    id: lnkInfo.ruleAreaId, 
                                    label: ruleAreaMapping.get(lnkInfo.ruleAreaId)?.ruleAreaName as string ?? ''
                                }}
                                key="restriction-sel-CB"
                                freeSolo={false}
                                filterSelectedOptions={true}
                                disablePortal
                                disableListWrap
                                size="small"
                                id="restriction-sel-cb"
                                options={ruleAreaOptions}
                                disabled={determineIfToDisableRestrictorChange()}
                                getOptionLabel={(option) => option.label } //Important!
                                renderInput={(params) => <TextField {...register("maturityField", {
                                    required: 'A selection is required',
                                    })} {...params} 
                                    label="Select IFS Project" 
                                    size="small" 
                                    sx={{ fieldset : { borderColor: SPECIAL_DARK_GOLD_COLOR } }}
                                    error={(errors.maturityField?.message && errors.maturityField?.message.length > 0) ? true : false}
                                    helperText={errors.maturityField?.message}
                                />}
                            /> */}



// let descProp : PropertyItem = {
//     id: crypto.randomUUID(),
//     name: PROJECT_PROP_DESCRIPTION,
//     displayName: PROJECT_PROP_DESCRIPTION,
//     value: "",
//     category: CommonPropertyCategoryEnum.GENERAL_FIXED_KEY,
//     editable: true,
//     enabled: true,
//     contextProperties: [
//         {
//             id: crypto.randomUUID(),
//             name: "export_context",
//             value: {
//                 subType: "PROJECT_DESCRIPTION",
//                 exportEnabled: true
//             }
//         } as BasicProperty
//     ]
// }

// let createdByProp : PropertyItem = {
//     id: crypto.randomUUID(),
//     name: PROJECT_PROP_CREATED_BY,
//     displayName: PROJECT_PROP_CREATED_BY,
//     value: loggedInUser?.email,
//     category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
//     editable: true,
//     enabled: true,
//     contextProperties: [
//         {
//             id: crypto.randomUUID(),
//             name: "export_context",
//             value: {
//                 subType: "PROJECT_DESCRIPTION",
//                 exportEnabled: true
//             }
//         } as BasicProperty
//     ]
// }

// let maturityProp : PropertyItem = {
//     id: crypto.randomUUID(),
//     name: PROJECT_PROP_MATURITY,
//     displayName: PROJECT_PROP_MATURITY,
//     value: "",
//     category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
//     editable: true,
//     enabled: true,
//     contextProperties: []
// }

// proj.associatedProperties.push(descProp)
// proj.associatedProperties.push(createdByProp)
// proj.associatedProperties.push(maturityProp)


// const descDefaultVal : string = useMemo(() => {
//     let defVal = project?.associatedProperties?.find(x => x.name.toLowerCase() === PROJECT_PROP_DESCRIPTION.toLowerCase())?.value?.toString() ?? ''
//     return defVal;
// }, [project]);


// const matDefaultVal : string = useMemo(() => {
//     let defVal = project?.associatedProperties?.find(x => x.name.toLowerCase() === PROJECT_PROP_MATURITY.toLowerCase())?.value ?? ''
//     return defVal;
// }, [project]);






//========================================================================


// let proj : Project = {
//     _id: '',
//     projectId: '',
//     snapshotSourceId: '',
//     contextProperties: [],
//     enabled: true,
//     lastUpdatedOn: new Date(),
//     name: data.nameField,
//     createdOn: new Date(),
//     createdBy: '',
//     org: data.orgField,
//     owner: { email: loggedInUser.email, idsid: loggedInUser.idsid },
//     lockedBy: null,
//     notes: null,
//     physicalLinkages: [],
//     clearanceLinkages: [],
//     clearanceRelationBrands: [],
//     associatedProperties: [],
//     constraintSettings: []
// };

// let descProp : PropertyItem = {
//     id: crypto.randomUUID(),
//     name: PROJECT_PROP_DESCRIPTION,
//     displayName: PROJECT_PROP_DESCRIPTION,
//     value: data.descriptionField,
//     category: CommonPropertyCategoryEnum.GENERAL_FIXED_KEY,
//     editable: true,
//     enabled: true,
//     contextProperties: [
//         {
//             id: crypto.randomUUID(),
//             name: "export_context",
//             value: {
//                 subType: "PROJECT_DESCRIPTION",
//                 exportEnabled: true
//             }
//         } as BasicProperty
//     ]
// }

// let createdByProp : PropertyItem = {
//     id: crypto.randomUUID(),
//     name: PROJECT_PROP_CREATED_BY,
//     displayName: PROJECT_PROP_CREATED_BY,
//     value: loggedInUser?.email,
//     category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
//     editable: true,
//     enabled: true,
//     contextProperties: [
//         {
//             id: crypto.randomUUID(),
//             name: "export_context",
//             value: {
//                 subType: "PROJECT_DESCRIPTION",
//                 exportEnabled: true
//             }
//         } as BasicProperty
//     ]
// }



// let maturityProp : PropertyItem = {
//     id: crypto.randomUUID(),
//     name: PROJECT_PROP_MATURITY,
//     displayName: PROJECT_PROP_MATURITY,
//     value: data.maturityField,
//     category: CommonPropertyCategoryEnum.GENERAL_NON_EDITABLE,
//     editable: true,
//     enabled: true,
//     contextProperties: []
// }

// proj.associatedProperties.push(descProp)
// proj.associatedProperties.push(createdByProp)
// proj.associatedProperties.push(maturityProp)
