import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import { UIMessageType, ActionSceneEnum, SCENES_MAPPING, PermissionActionEnum, CONFIGITEM__Init_Display_Message } from './Constants';
import { ConfigItem, NetSummary, PropertyItem, SPDomainData, LoggedInUser, LoadingSpinnerInfo, PageConfInfo, BasicProperty, ActionPermissionContext, StatusIndicatorItem } from './HelperModels';
import { Draft, enableMapSet, produce, WritableDraft } from 'immer';
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
import { getPermActionSceneData } from '../BizLogicUtilities/Permissions';
import { Project } from './ServiceModels';
import { getSpecialAccessGuardKeyInfo } from '../BizLogicUtilities/FetchData';

enableMapSet()



interface SPStore {
    basicProjInfo: BasicProperty | null;
    loggedInUser: LoggedInUser | undefined;
    isMenuCollapsed : boolean;
    isLoadingBackdropEnabled: boolean;
    isAlphabeticalTreeNodeOrder : boolean;
    openNetclassTreeNodes: string[]|null;
    themeMode : string;
    heightForSidebar: number | string;
    loadingSpinnerCtx: LoadingSpinnerInfo;
    menuCurrentScene: ActionSceneEnum;
    mainTitle: string;
    mainSubtitle: string;
    showMenu: boolean;
    showRightElementOnGrid: boolean;
    initConfigs: ConfigItem[];
    pageConfInfoMap: Map<string, PageConfInfo>;
    specialAccessGuardPermInfoMap: Map<string, string>;
    permissionRoles: BasicProperty[];
    actionScenePermContextMap: Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>;
    netSummary: NetSummary | undefined;
    statusTimeLineInfo: StatusIndicatorItem[];
    displayQuickMessage: (type: UIMessageType, msg: string, timeout?: number) => void;
    
    setBasicProjInfo: (proj: Project|null) => void;
    clearBasicProjInfo: () => void; 

    setLoggedInUser: (loggedInUser: LoggedInUser|undefined) => void;
    setIsMenuCollapsed : (isMenuCollapsed: boolean) => void;
    setIsLoadingBackdropEnabled : (isLoadingBackdropEnabled: boolean) => void;
    setIsAlphabeticalTreeNodeOrder : (isAlphabeticalTreeNodeOrder: boolean) => void;
    setOpenNetclassTreeNodes: (openNetclassTreeNodes: string[]|null) => void;
    setThemeMode : (themeMode: string) => void;
    setHeightForSidebar: (heightForSidebar: string|number) => void;
    setLoadingSpinnerCtx: (loadingSpinnerCtx: LoadingSpinnerInfo) => void;
    cancelLoadingSpinnerCtx: () => void;
    setMenuCurrentScene: (menuCurrentScene: ActionSceneEnum) => void;
    setMainTitle: (mainTitle: string) => void;
    setMainSubtitle: (mainSubtitle: string) => void;
    setShowMenu: (showMenu: boolean) => void;
    setShowRightElementOnGrid: (showRightElementOnGrid: boolean) => void;
    setPageConfInfoMap: (pageConfInfoMap: Map<string, PageConfInfo>) => void;
    setSpecialAccessGuardPermInfoMap: (specialAccessGuardPermInfoMap: Map<string, string>) => void;
    setPermissionRoles: (permissionRoles: BasicProperty[]) => void;
    setActionScenePermContextMap: (actionScenePermContextMap: Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>) => void;
    setNetSummary: (netSummary: NetSummary|undefined) => void;
    setStatusTimeLineInfo: (statusTimeLineInfo: StatusIndicatorItem[]) => void;

    setDisplayQuickMessage: (displayQuickMessage: (type: UIMessageType, msg: string, timeout?: number) => void) => void;
    
    setInitConfigs: (initConfigs: ConfigItem[]) => void;

    placePageTitle: (key: string) => void;
}


export const useSpiderStore = create<SPStore>()(
    immer((set, get) => ({
        basicProjInfo: null,
        loggedInUser: undefined,
        isMenuCollapsed : false,
        isLoadingBackdropEnabled: false,
        isAlphabeticalTreeNodeOrder: true,
        openNetclassTreeNodes: null,
        themeMode: 'dark',
        heightForSidebar: 0,
        loadingSpinnerCtx: {enabled: false, text: ""},
        menuCurrentScene: ActionSceneEnum.ROOT,
        mainTitle: '',
        mainSubtitle: '',
        showMenu: false,
        showRightElementOnGrid: true,
        initConfigs: [],
        pageConfInfoMap: new Map<string, PageConfInfo>(),
        specialAccessGuardPermInfoMap: new Map<string, string>(),
        permissionRoles: [],
        actionScenePermContextMap: new Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>(),
        netSummary: undefined,
        statusTimeLineInfo: [],
        displayQuickMessage: (type, msg) => {},
        
        setIsMenuCollapsed : (isMenuCollapsed) => set((state) => { state.isMenuCollapsed = isMenuCollapsed; }),
        setIsLoadingBackdropEnabled : (isLoadingBackdropEnabled) => set((state) => { state.isLoadingBackdropEnabled = isLoadingBackdropEnabled; }),
        setIsAlphabeticalTreeNodeOrder : (isAlphabeticalTreeNodeOrder) => set((state) => { state.isAlphabeticalTreeNodeOrder = isAlphabeticalTreeNodeOrder; }),
        setOpenNetclassTreeNodes: (openNetclassTreeNodes) => set((state) => { state.openNetclassTreeNodes = (openNetclassTreeNodes ? Array.from(openNetclassTreeNodes) : openNetclassTreeNodes); }),
        setThemeMode : (themeMode) => set((state) => { state.themeMode = themeMode; }),
        setHeightForSidebar: (heightForSidebar) => set((state) => { state.heightForSidebar = heightForSidebar; }),
        setLoadingSpinnerCtx: (loadingSpinnerCtx) => set((state) => { state.loadingSpinnerCtx = {...loadingSpinnerCtx}; }),
        setMenuCurrentScene: (menuCurrentScene) => set((state) => { state.menuCurrentScene = menuCurrentScene; }),
        setMainTitle: (mainTitle) => set((state) => { state.mainTitle = mainTitle; }),
        setMainSubtitle: (mainSubtitle) => set((state) => { state.mainSubtitle = mainSubtitle; }),
        setShowMenu: (showMenu) => set((state) => { state.showMenu = showMenu; }),
        setShowRightElementOnGrid: (showRightElementOnGrid) => set((state) => { state.showRightElementOnGrid = showRightElementOnGrid; }),
        setPageConfInfoMap: (pageConfInfoMap) => set((state) => { state.pageConfInfoMap = (rfdcCopy<Map<string, PageConfInfo>>(pageConfInfoMap) as Map<string, PageConfInfo>) }),
        setSpecialAccessGuardPermInfoMap: (specialAccessGuardPermInfoMap) => set((state) => { state.specialAccessGuardPermInfoMap = (rfdcCopy<Map<string, string>>(specialAccessGuardPermInfoMap) as Map<string, string>) }),
        setPermissionRoles: (permissionRoles) => set((state) => { state.permissionRoles = (permissionRoles ? Array.from(permissionRoles) : permissionRoles); }),
        setNetSummary: (netSummary) => set((state) => { state.netSummary = netSummary; }),
        setStatusTimeLineInfo: (statusTimeLineInfo) => set((state) => { state.statusTimeLineInfo = (statusTimeLineInfo ? Array.from(statusTimeLineInfo) : statusTimeLineInfo); }),
        
        setDisplayQuickMessage: (displayQuickMessage) => set((state) => { state.displayQuickMessage = displayQuickMessage; }),

        setActionScenePermContextMap: (actionScenePermContextMap) => set((state) => { 
            state.actionScenePermContextMap = (rfdcCopy<Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>>(actionScenePermContextMap) as Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>) 
        }),

        setInitConfigs: (initConfigs) => set((state) => { 
            let confs = (initConfigs ? Array.from(initConfigs) : initConfigs)
            state.initConfigs = confs;
            getPermActionSceneData(get().permissionRoles, state.initConfigs).then((data: Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>) => {
                if(data) {
                    get().setActionScenePermContextMap(data)
                }
            });
            getSpecialAccessGuardKeyInfo().then(resp => {
                if(resp.isSuccessful === true) {
                    if(resp.data && resp.data.size > 0) {
                        get().setSpecialAccessGuardPermInfoMap(resp.data as Map<string, string>);
                    }
                }
            })
        }),

        
        setLoggedInUser: (loggedInUser) => set((state) => { 
            state.loggedInUser = loggedInUser; 
            if(state.loggedInUser && state.basicProjInfo && state.basicProjInfo.id && state.basicProjInfo.id.length > 0){
                state.showMenu = true;   //sometimes login processing might complete later than expected
            }
        }),
        
        setBasicProjInfo: (project) => set((state) => { 
            state.basicProjInfo = {id: project?._id?.toString() || '', name: project?.name || '', value : project?.org || '' } as BasicProperty; 
            if(state.loggedInUser && project && project._id && project._id.length > 0){
                state.showMenu = true;
            }
        }),
        
        clearBasicProjInfo: () => set((state) => {
            state.basicProjInfo = null;
            state.initConfigs = [];
            state.showMenu = false;
            state.permissionRoles = [],
            state.actionScenePermContextMap = new Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>(),
            state.netSummary = undefined
        }),

        placePageTitle:(key: string) => set((state) => {
            let map = get().pageConfInfoMap
            let pageElement : PageConfInfo|undefined = map.get(key.toLowerCase());
            if(pageElement && pageElement.scene && SCENES_MAPPING.has(pageElement.scene.toLowerCase())) {
                state.menuCurrentScene = (SCENES_MAPPING.get(pageElement.scene.toLowerCase()) as ActionSceneEnum) || ''
                state.mainTitle = pageElement.title
                state.mainSubtitle = pageElement.subtitle
            }
            else {
                state.menuCurrentScene = ActionSceneEnum.ROOT
                state.mainTitle = ""
                state.mainSubtitle = ""
            }
        }),

        cancelLoadingSpinnerCtx: () => set((state) => { 
            state.loadingSpinnerCtx = { enabled: false, text: ""} as LoadingSpinnerInfo; 
        }),
    }))
)







// setInitConfigs: (initConfigs) => set((state) => { 
//     let confs = (initConfigs ? Array.from(initConfigs) : initConfigs)
//     state.initConfigs = confs; 
//     getPermActionSceneData(state.initConfigs).then((data: [BasicProperty[], Map<ActionSceneEnum, Map<string, ActionPermissionContext>>]) => {
//         if(data && data.length > 0) {
//             // get().setConfPermissionRoles(data[0])
//             get().setActionScenePermContextMap(data[1])
//         }
//     })
// }),








        // setDomainData: (domainData) => set((state) => { 
        //     if (domainData === null) {
        //         state.domainData = domainData;
        //         get().setInitConfigs([])
        //         get().setConfConstraintProps([])
        //         get().setShowMenu(false)
        //     }
        //     else if(domainData) { 
        //         state.domainData = (rfdcCopy<SPDomainData>(domainData) as SPDomainData) // forcing a copy here due deep immutability issues being problem for aggrid, etc
        //         if(state.loggedInUser && domainData.project && domainData.project._id && domainData.project._id.length > 0){
        //             state.showMenu = true;
        //         }
        //     }
        // }),





        //TODO: all of this can be configured...
        // placePageTitle:(key: string) => set((state) => {
        //     let procStage = import.meta.env.VITE_STAGE ?? "DEV"
            
        //     if(key.toLowerCase() === "projectlist"){
        //         state.menuCurrentScene = MainScenePagesEnum.ROOT
        //         state.mainTitle = "Project List"
        //         state.mainSubtitle = `All projects in current '${procStage.toUpperCase()}' environment are listed here. Please select a project to view details.`
        //     }
        //     else if(key.toLowerCase() === "projectoverview"){
        //         state.menuCurrentScene = MainScenePagesEnum.PROJECT
        //         state.mainTitle = "Project Overview"
        //         state.mainSubtitle = `General details of selected project are displayed here. Select different tabs to navigate between info categories`
        //     }
        //     else if(key.toLowerCase() === "projectreports") {
        //         state.menuCurrentScene = MainScenePagesEnum.PROJECT
        //         state.mainTitle = "Project Reports"
        //         state.mainSubtitle = `Download data for records, analysis, or for import into external systems (Mentor, Cadence...)`
        //     }
        //     else if(key.toLowerCase() === "projectpermissions") {
        //         state.menuCurrentScene = MainScenePagesEnum.PROJECT
        //         state.mainTitle = "Project Permissions"
        //         state.mainSubtitle = `Define project team roles. Only members assigned to given role will have permission to perform activities for the role`
        //     }
        
        //     //================================================================
        //     else if(key.toLowerCase() === "stackup") {
        //         state.menuCurrentScene = MainScenePagesEnum.STACKUP
        //         state.mainTitle = "Stackup"
        //         state.mainSubtitle = `Define, and/or update project stackup. Note: Changes to thickness may reconfigure layer grouping`
        //     }
        //     else if(key.toLowerCase() === "layergroups") {
        //         state.menuCurrentScene = MainScenePagesEnum.LAYERGROUPS
        //         state.mainTitle = "Layer Groups"
        //         state.mainSubtitle = `Group stackup layers as necessary. Layer groups are an abstraction to aid in efficient constraint data entry`
        //     }
        //     else if(key.toLowerCase() === "ruleareas") {
        //         state.menuCurrentScene = MainScenePagesEnum.RULEAREAS
        //         state.mainTitle = "Rule Areas"
        //         state.mainSubtitle = `Define, or rename or update rule areas`
        //     }
            
        //     //================================================================
        //     else if(key.toLowerCase() === "defaultconstraints") {
        //         state.menuCurrentScene = MainScenePagesEnum.DEFAULTCONSTRAINTS
        //         state.mainTitle = "Default Constraints"
        //         state.mainSubtitle = `Upload default constraints '.Vbs' file and generate/manage editable copies of constraint dataset`
        //     }
        
        //     //================================================================
        //     else if(key.toLowerCase() === "interfaces") {
        //         state.menuCurrentScene = MainScenePagesEnum.INTERFACES
        //         state.mainTitle = "Interfaces"
        //         state.mainSubtitle = `Manage project interfaces`
        //     }
        //     else if(key.toLowerCase() === "interfaceoverview") {
        //         state.menuCurrentScene = MainScenePagesEnum.INTERFACES
        //         state.mainTitle = "Interface Overview"
        //         state.mainSubtitle = `General details of selected interface are displayed here. Select different tabs to navigate between info categories`
        //     }
        //     else if(key.toLowerCase() === "interfacephysicalrules") {
        //         state.menuCurrentScene = MainScenePagesEnum.INTERFACES
        //         state.mainTitle = "Physical Rules"
        //         state.mainSubtitle = `Manage physical rules for selected interface`
        //     }
        //     else if(key.toLowerCase() === "interfaceclearancerules") {
        //         state.menuCurrentScene = MainScenePagesEnum.INTERFACES
        //         state.mainTitle = "Clearance Rules"
        //         state.mainSubtitle = `Manage clearance rules for selected interface`
        //     }
        //     else if(key.toLowerCase() === "interfaceshadowvoid") {
        //         state.menuCurrentScene = MainScenePagesEnum.INTERFACES
        //         state.mainTitle = "Interfaces"
        //         state.mainSubtitle = `Add or remove shadow void data entries for the selected interface`
        //     }
        //     else if(key.toLowerCase() === "interfacecollaterals") {
        //         state.menuCurrentScene = MainScenePagesEnum.INTERFACES
        //         state.mainTitle = "Interfaces"
        //         state.mainSubtitle = `Manage interface collaterals (images, PDFs, and other associated content pertaining to interface should be kept here)`
        //     }
        //     else if(key.toLowerCase() === "interfacenotes") {
        //         state.menuCurrentScene = MainScenePagesEnum.INTERFACES
        //         state.mainTitle = "Interfaces"
        //         state.mainSubtitle = `Manage project interfaces`
        //     }
        
        //     //================================================================
        //     else if(key.toLowerCase() === "netlistupload") {
        //         state.menuCurrentScene = MainScenePagesEnum.NETS
        //         state.mainTitle = "Upload Nets"
        //         state.mainSubtitle = `Upload nets for project`
        //     }
        //     else if(key.toLowerCase() === "netstats") {
        //         state.menuCurrentScene = MainScenePagesEnum.NETS
        //         state.mainTitle = "Net Stats"
        //         state.mainSubtitle = `Net quantity and allocation summary`
        //     }
        //     else if(key.toLowerCase() === "netassignment") {
        //         state.menuCurrentScene = MainScenePagesEnum.NETS
        //         state.mainTitle = "Net Assignment"
        //         state.mainSubtitle = `Manage allocation nets to netclasses`
        //     }
        //     else if(key.toLowerCase() === "netdiffpairs") {
        //         state.menuCurrentScene = MainScenePagesEnum.NETS
        //         state.mainTitle = "Diff Pairs"
        //         state.mainSubtitle = `Manage diff pairs for project`
        //     }
        //     else if(key.toLowerCase() === "netlengthmatching") {
        //         state.menuCurrentScene = MainScenePagesEnum.NETS
        //         state.mainTitle = "Length Matching"
        //         state.mainSubtitle = `Manage length-matching net properties`
        //     }
        //     else if(key.toLowerCase() === "netcustomproperties") {
        //         state.menuCurrentScene = MainScenePagesEnum.NETS
        //         state.mainTitle = "Custom Net Properties"
        //         state.mainSubtitle = `Manage additional/custom properties for nets`
        //     }
        
        //     //================================================================
        //     else if(key.toLowerCase() === "c2clayout") {
        //         state.menuCurrentScene = MainScenePagesEnum.C2CLAYOUT
        //         state.mainTitle = "C2C Layout"
        //         state.mainSubtitle = `Manage class to class relations`
        //     }
        
        //     //================================================================
        //     else if(key.toLowerCase() === "links") {
        //         state.menuCurrentScene = MainScenePagesEnum.LINKS
        //         state.mainTitle = "Links"
        //         state.mainSubtitle = `Manage project linkages`
        //     }
            
        
        //     //================================================================
        //     else if(key.toLowerCase() === "powercomponents") {
        //         state.menuCurrentScene = MainScenePagesEnum.POWERINFO
        //         state.mainTitle = "Power Components"
        //         state.mainSubtitle = `Manage power components`
        //     }
        //     else if(key.toLowerCase() === "powerrails") {
        //         state.menuCurrentScene = MainScenePagesEnum.POWERINFO
        //         state.mainTitle = "Power Rails"
        //         state.mainSubtitle = `Manage power rails`
        //     }
        //     // else if(key.toLowerCase() === "powersheets") {
        //     //     state.menuCurrentScene = MainScenePagesEnum.POWERINFO
        //     //     state.mainTitle = "Power Sheets"
        //     //     state.mainSubtitle = `Manage power sheets`
        //     // }
        
            
        //     //================================================================
        //     else if(key.toLowerCase() === "validations") {
        //         state.menuCurrentScene = MainScenePagesEnum.VALIDATIONS
        //         state.mainTitle = "Validations"
        //         state.mainSubtitle = `View project validation results`
        //     }
        //     else if(key.toLowerCase() === "logs") {
        //         state.menuCurrentScene = MainScenePagesEnum.LOGS
        //         state.mainTitle = "Logs"
        //         state.mainSubtitle = `View logs`
        //     }
        //     else if(key.toLowerCase() === "faqs") {
        //         state.menuCurrentScene = MainScenePagesEnum.FAQS
        //         state.mainTitle = "FAQs"
        //         state.mainSubtitle = `View FAQs`
        //     } 
        
        
        
        //     //================================================================
            
        //     else{
        //         state.mainTitle = ""
        //         state.mainSubtitle = ""
        //     }
        
        // })


//========================================================================================================


// if(!state.initConfigs || (state.initConfigs.length === 0)) {
//     fetchInitConfigs(domainData.project._id).then((confs: ConfigItem[]) => {
//         get().setInitConfigs(confs ?? [])
//     })
// }
// if(!state.confConstraintProps || (state.confConstraintProps.length === 0)) {
//     getConstraintProperties(domainData.project._id as string, domainData.project?.org).then((constrSettings : PropertyItem[]) => {
//         get().setConfConstraintProps(constrSettings ?? [])
//     })
// }




        // This has been made async!
        // setupDomainDataViaLoader: async (domainData) => set(async (state) => { 
        //     if(domainData) {
        //         //going to force a copy here due to the reference persisting and causing issues in aggrid tables
        //         get().setDomainData(rfdcCopy<SPDomainData>(domainData) as SPDomainData)
                
        //         if(domainData.project && domainData.project._id && domainData.project._id.length > 0){
        //             get().setShowMenu(true)
        //             if(!state.initConfigs || (state.initConfigs.length === 0)) {
        //                 let confs: ConfigItem[] = await fetchInitConfigs(domainData.project._id);
        //                 get().setInitConfigs(confs ?? [])
        //             }
        //             if(!state.constraintProps || (state.constraintProps.length === 0)) {
        //                 let constrSettings : PropertyItem[] = await getConstraintProperties(domainData.project._id as string, domainData.project?.org);
        //                 get().setConstraintProps(constrSettings ?? [])
        //             }
        //         }
        //     }
        //     else if(domainData === null) {
        //         get().setDomainData(null)
        //         get().setInitConfigs([])
        //         get().setConstraintProps([])
        //         state.showMenu = false
        //     }
        // }),
        

        // setupDomainDataViaLoader: (domainData) => set((state) => { 
        //     if(domainData) {
        //         //going to force a copy here due to the reference persisting and causing issues in aggrid tables
        //         get().setDomainData(rfdcCopy<SPDomainData>(domainData) as SPDomainData)
                
        //         if(domainData.project && domainData.project._id && domainData.project._id.length > 0){
        //             get().setShowMenu(true)
        //             if(!state.initConfigs || (state.initConfigs.length === 0)) {
        //                 fetchInitConfigs(domainData.project._id).then((confs: ConfigItem[]) => {
        //                     get().setInitConfigs(confs ?? [])
        //                 })
        //             }
        //             if(!state.constraintProps || (state.constraintProps.length === 0)) {
        //                 getConstraintProperties(domainData.project._id as string, domainData.project?.org).then((constrSettings : PropertyItem[]) => {
        //                     get().setConstraintProps(constrSettings ?? [])
        //                 })
        //             }
        //         }
        //     }
        // }),





 // if(confs && confs.length > 0) {
//     get().setInitConfigs(confs)
// }
// else {
//     let msg = "Failed to load initial configs for proper app functionality. Please check network connection and also make sure configs are available and retrievable."
//     alert(msg)
// } 




// interface SPStore {
//     //UI
//     loggedInUser: LoggedInUser | undefined
//     isMenuCollapsed : boolean
//     themeMode : string
//     heightForSidebar: number | string
//     loadingSpinnerCtx: LoadingSpinnerInfo
//     menuCurrentScene: MainScenePagesEnum
//     mainTitle: string
//     mainSubtitle: string
//     initConfigs: ConfigItem[]
//     showMenu: boolean
//     displayQuickMessage: (type: UIMessageType, msg: string) => void;
    
    
//     // //DOMAIN
//     // project : Project | null;
//     // interfaceList : Interface[] | null;
//     // packageLayout: PackageLayout | null;
//     // powerInfo : PowerInfo | null;
//     // defaultConstraints : DefaultConstraints | null;
//     // projStats: ProjectStats | null;
//     // netclasses : Netclass[] | null;
//     // snapshots : SnapshotContext[] | null;
//     // netPropNamesMap: Map<string, string> | null;
//     // interfaceInFocus: Interface | null

//     //SETTERS - UI
//     setLoggedInUser: (loggedInUser: LoggedInUser|undefined) => void;
//     setIsMenuCollapsed : (isMenuCollapsed: boolean) => void;
//     setThemeMode : (themeMode: string) => void;
//     setHeightForSidebar: (heightForSidebar: string|number) => void;
//     setLoadingSpinnerCtx: (loadingSpinnerCtx: LoadingSpinnerInfo) => void;
//     setMenuCurrentScene: (menuCurrentScene: MainScenePagesEnum) => void;
//     setMainTitle: (mainTitle: string) => void;
//     setMainSubtitle: (mainSubtitle: string) => void;
//     setInitConfigs: (initConfigs: ConfigItem[]) => void;
//     setShowMenu: (showMenu: boolean) => void;
//     setDisplayQuickMessage: (displayQuickMessage: (type: UIMessageType, msg: string) => void) => void;
    
//     // //SETTERS - DOMAIN
//     // setNetPropNamesMap: (netPropNamesMap: Map<string, string>) => void;
//     // setProject : (project: Project|null) => void;
//     // setInterfaceList : (interfaceList: Interface[]|null) => void;
//     // setPackageLayout: (packageLayout: PackageLayout|null) => void;
//     // setPowerInfo : (powerInfo: PowerInfo|null) => void;
//     // setDefaultConstraints : (defaultConstraints: DefaultConstraints|null) => void;
//     // setProjStats: (projStats: ProjectStats|null) => void;
//     // setNetclasses : (netclasses: Netclass[]|null) => void;
//     // setSnapshots : (snapshots: SnapshotContext[]|null) => void;
//     // setInterfaceInFocus : (interfaceInFocus: Interface|null) => void;

//     //REAL ACTIONS
//     // clearProjectDetailInfo: () => void;
//     placePageTitle: (key: string) => void;
// }


// export const useSpiderStore = create<SPStore>()(
//     immer((set, get) => ({
//         //UI
//         loggedInUser: undefined,
//         isMenuCollapsed : false,
//         themeMode: 'dark',
//         heightForSidebar: 0,
//         loadingSpinnerCtx: {enabled: false, text: ""},
//         menuCurrentScene: MainScenePagesEnum.ROOT,
//         mainTitle: '',
//         mainSubtitle: '',
//         initConfigs: [],
//         showMenu: false,
//         displayQuickMessage: (type, msg) => {},
//         netPropNamesMap: new Map<string, string>(),
//         // //DOMAIN
//         // project : null,
//         // interfaceList : [],
//         // packageLayout: null,
//         // powerInfo : null,
//         // defaultConstraints : null,
//         // projStats: null,
//         // netclasses : [],
//         // snapshots : [],
//         // interfaceInFocus: null,

//         //SETTERS - UI
//         setLoggedInUser: (loggedInUser) => set((state) => { state.loggedInUser = loggedInUser; }),
//         setIsMenuCollapsed : (isMenuCollapsed) => set((state) => { state.isMenuCollapsed = isMenuCollapsed; }),
//         setThemeMode : (themeMode) => set((state) => { state.themeMode = themeMode; }),
//         setHeightForSidebar: (heightForSidebar) => set((state) => { state.heightForSidebar = heightForSidebar; }),
//         setLoadingSpinnerCtx: (loadingSpinnerCtx) => set((state) => { state.loadingSpinnerCtx = {...loadingSpinnerCtx}; }),
//         setMenuCurrentScene: (menuCurrentScene) => set((state) => { state.menuCurrentScene = menuCurrentScene; }),
//         setMainTitle: (mainTitle) => set((state) => { state.mainTitle = mainTitle; }),
//         setMainSubtitle: (mainSubtitle) => set((state) => { state.mainSubtitle = mainSubtitle; }),
//         setInitConfigs: (initConfigs) => set((state) => { state.initConfigs = (initConfigs ? Array.from(initConfigs) : initConfigs); }),
//         setShowMenu: (showMenu) => set((state) => { state.showMenu = showMenu; }),
//         setDisplayQuickMessage: (displayQuickMessage) => set((state) => { state.displayQuickMessage = displayQuickMessage; }),
//         // setNetPropNamesMap: (netPropNamesMap) => set((state) => { state.netPropNamesMap = new Map<string, string>(netPropNamesMap); }),
//         // //SETTERS - DOMAIN
//         // setProject : (project) => set((state) => { 
//         //     state.project = project;
//         //     state.showMenu = true;
//         //     fetchInitConfigs(project?._id.toString()).then((confs: ConfigItem[]) => {
//         //         get().setInitConfigs(confs ?? [])
//         //     })
//         // }),
//         // setInterfaceList : (interfaceList) => set((state) => { state.interfaceList = (interfaceList ? Array.from(interfaceList) : interfaceList); }),
        
//         // setPackageLayout: (packageLayout: PackageLayout|null) => set(produce((state) => {
//         //     state.packageLayout = { ...state.packageLayout, ...packageLayout };
//         // })),
        
//         // // setPackageLayout: (packageLayout) => set((state) => { state.packageLayout = packageLayout; }),

//         // setPowerInfo : (powerInfo) => set((state) => { state.powerInfo = powerInfo; }),
//         // setDefaultConstraints : (defaultConstraints) => set((state) => { state.defaultConstraints = defaultConstraints; }),
//         // setProjStats: (projStats) => set((state) => { 
//         //     if(projStats) {
//         //         let totalPairs = ((projStats.totalNets ?? 0) - (projStats.totalNonPairedNets ?? 0) > 0)   //this calculation is important!
//         //             ? ((projStats.totalNets ?? 0) - (projStats.totalNonPairedNets ?? 0)) / 2
//         //             : 0
//         //         projStats.totalDiffPairs = totalPairs
//         //     }
//         //     state.projStats = projStats;  
//         // }),
//         // setNetclasses : (netclasses) => set((state) => { state.netclasses = (netclasses ? Array.from(netclasses) : netclasses); }),
//         // setSnapshots : (snapshots) => set((state) => { state.snapshots = (snapshots ? Array.from(snapshots) : snapshots); }),
//         // setInterfaceInFocus : (interfaceInFocus) => set((state) => { state.interfaceInFocus = interfaceInFocus; }),

//         // //REAL ACTIONS
//         // clearProjectDetailInfo: () => set((state) => {
//         //     state.project = null;
//         //     state.interfaceList = [];
//         //     state.interfaceInFocus = null;
//         //     state.packageLayout = null;
//         //     state.powerInfo = null;
//         //     state.defaultConstraints = null;
//         //     state.netclasses = [];
//         //     state.snapshots = [];
//         //     state.menuCurrentScene = MainScenePagesEnum.ROOT;
//         //     state.projStats = null;
//         //     state.netPropNamesMap = null;
//         //     state.showMenu = false;
//         // }),

//         //TODO: all of this can be configured...
//         placePageTitle:(key: string) => set((state) => {
//             let procStage = import.meta.env.VITE_STAGE ?? "DEV"
            
//             if(key.toLowerCase() === "projectlist"){
//                 state.menuCurrentScene = MainScenePagesEnum.ROOT
//                 state.mainTitle = "Project List"
//                 state.mainSubtitle = `All projects in current '${procStage.toUpperCase()}' environment are listed here. Please select a project to view Details.`
//             }
//             else if(key.toLowerCase() === "projectoverview"){
//                 state.menuCurrentScene = MainScenePagesEnum.PROJECT
//                 state.mainTitle = "Project Overview"
//                 state.mainSubtitle = `Project Name: [ ${state.project?.name} ]. General details of selected project are displayed here. Select different tabs to navigate between info categories`
//             }
//             else if(key.toLowerCase() === "projectreports") {
//                 state.menuCurrentScene = MainScenePagesEnum.PROJECT
//                 state.mainTitle = "Project Reports"
//                 state.mainSubtitle = `Download data for records, analysis, or for import into external systems (Mentor, Cadence...)`
//             }
//             else if(key.toLowerCase() === "projectpermissions") {
//                 state.menuCurrentScene = MainScenePagesEnum.PROJECT
//                 state.mainTitle = "Project Permissions"
//                 state.mainSubtitle = `Define project team roles. Only members assigned to given role will have permission to perform activities for the role`
//             }
        
//             //================================================================
//             else if(key.toLowerCase() === "stackup") {
//                 state.menuCurrentScene = MainScenePagesEnum.STACKUP
//                 state.mainTitle = "Stackup"
//                 state.mainSubtitle = `Define, and/or update project stackup. Note: Changes to thickness may reconfigure layer grouping`
//             }
//             else if(key.toLowerCase() === "layergroups") {
//                 state.menuCurrentScene = MainScenePagesEnum.LAYERGROUPS
//                 state.mainTitle = "Layer Groups"
//                 state.mainSubtitle = `Group stackup layers as necessary. Layer groups are an abstraction to aid in efficient constraint data entry`
//             }
//             else if(key.toLowerCase() === "ruleareas") {
//                 state.menuCurrentScene = MainScenePagesEnum.RULEAREAS
//                 state.mainTitle = "Rule Areas"
//                 state.mainSubtitle = `Define, or rename or update rule areas`
//             }
            
//             //================================================================
//             else if(key.toLowerCase() === "defaultconstraints") {
//                 state.menuCurrentScene = MainScenePagesEnum.DEFAULTCONSTRAINTS
//                 state.mainTitle = "Default Constraints"
//                 state.mainSubtitle = `Upload default constraints '.Vbs' file and generate/manage editable copies of constraint dataset`
//             }
        
//             //================================================================
//             else if(key.toLowerCase() === "interfaces") {
//                 state.menuCurrentScene = MainScenePagesEnum.INTERFACES
//                 state.mainTitle = "Interfaces"
//                 state.mainSubtitle = `Manage project interfaces`
//             }
//             else if(key.toLowerCase() === "interfaceoverview") {
//                 state.menuCurrentScene = MainScenePagesEnum.INTERFACES
//                 state.mainTitle = "Interface Overview"
//                 state.mainSubtitle = `General details of selected interface are displayed here. Select different tabs to navigate between info categories`
//             }
//             else if(key.toLowerCase() === "interfacephysicalrules") {
//                 state.menuCurrentScene = MainScenePagesEnum.INTERFACES
//                 state.mainTitle = "Physical Rules"
//                 state.mainSubtitle = `Manage physical rules for selected interface`
//             }
//             else if(key.toLowerCase() === "interfaceclearancerules") {
//                 state.menuCurrentScene = MainScenePagesEnum.INTERFACES
//                 state.mainTitle = "Clearance Rules"
//                 state.mainSubtitle = `Manage clearance rules for selected interface`
//             }
//             else if(key.toLowerCase() === "interfaceshadowvoid") {
//                 state.menuCurrentScene = MainScenePagesEnum.INTERFACES
//                 state.mainTitle = "Interfaces"
//                 state.mainSubtitle = `Add or remove shadow void data entries for the selected interface`
//             }
//             else if(key.toLowerCase() === "interfacecollaterals") {
//                 state.menuCurrentScene = MainScenePagesEnum.INTERFACES
//                 state.mainTitle = "Interfaces"
//                 state.mainSubtitle = `Manage interface collaterals (images, PDFs, and other associated content pertaining to interface should be kept here)`
//             }
//             else if(key.toLowerCase() === "interfacenotes") {
//                 state.menuCurrentScene = MainScenePagesEnum.INTERFACES
//                 state.mainTitle = "Interfaces"
//                 state.mainSubtitle = `Manage project interfaces`
//             }
        
//             //================================================================
//             else if(key.toLowerCase() === "netlistupload") {
//                 state.menuCurrentScene = MainScenePagesEnum.NETS
//                 state.mainTitle = "Upload Nets"
//                 state.mainSubtitle = `Upload nets for project`
//             }
//             else if(key.toLowerCase() === "netstats") {
//                 state.menuCurrentScene = MainScenePagesEnum.NETS
//                 state.mainTitle = "Net Stats"
//                 state.mainSubtitle = `Net quantity and allocation summary`
//             }
//             else if(key.toLowerCase() === "netassignment") {
//                 state.menuCurrentScene = MainScenePagesEnum.NETS
//                 state.mainTitle = "Net Assignment"
//                 state.mainSubtitle = `Manage allocation nets to netclasses`
//             }
//             else if(key.toLowerCase() === "netdiffpairs") {
//                 state.menuCurrentScene = MainScenePagesEnum.NETS
//                 state.mainTitle = "Diff Pairs"
//                 state.mainSubtitle = `Manage diff pairs for project`
//             }
//             else if(key.toLowerCase() === "netlengthmatching") {
//                 state.menuCurrentScene = MainScenePagesEnum.NETS
//                 state.mainTitle = "Length Matching"
//                 state.mainSubtitle = `Manage length-matching net properties`
//             }
//             else if(key.toLowerCase() === "netcustomproperties") {
//                 state.menuCurrentScene = MainScenePagesEnum.NETS
//                 state.mainTitle = "Custom Net Properties"
//                 state.mainSubtitle = `Manage additional/custom properties for nets`
//             }
        
//             //================================================================
//             else if(key.toLowerCase() === "c2clayout") {
//                 state.menuCurrentScene = MainScenePagesEnum.C2CLAYOUT
//                 state.mainTitle = "C2C Layout"
//                 state.mainSubtitle = `Manage clearance relations`
//             }
        
//             //================================================================
//             else if(key.toLowerCase() === "links") {
//                 state.menuCurrentScene = MainScenePagesEnum.LINKS
//                 state.mainTitle = "Links"
//                 state.mainSubtitle = `Manage project linkages`
//             }
            
        
//             //================================================================
//             else if(key.toLowerCase() === "powercapscomponents") {
//                 state.menuCurrentScene = MainScenePagesEnum.POWERINFO
//                 state.mainTitle = "Power Components"
//                 state.mainSubtitle = `Manage Power Caps Components`
//             }
//             else if(key.toLowerCase() === "powerrails") {
//                 state.menuCurrentScene = MainScenePagesEnum.POWERINFO
//                 state.mainTitle = "Power Rails"
//                 state.mainSubtitle = `Manage power Rails`
//             }
//             else if(key.toLowerCase() === "powersheets") {
//                 state.menuCurrentScene = MainScenePagesEnum.POWERINFO
//                 state.mainTitle = "Power Sheets"
//                 state.mainSubtitle = `Manage power sheets`
//             }
        
            
//             //================================================================
//             else if(key.toLowerCase() === "validations") {
//                 state.menuCurrentScene = MainScenePagesEnum.VALIDATIONS
//                 state.mainTitle = "Validations"
//                 state.mainSubtitle = `View project validation results`
//             }
//             else if(key.toLowerCase() === "logs") {
//                 state.menuCurrentScene = MainScenePagesEnum.LOGS
//                 state.mainTitle = "Logs"
//                 state.mainSubtitle = `View logs`
//             }
//             else if(key.toLowerCase() === "faqs") {
//                 state.menuCurrentScene = MainScenePagesEnum.FAQS
//                 state.mainTitle = "FAQs"
//                 state.mainSubtitle = `View FAQs`
//             } 
        
        
        
//             //================================================================
            
//             else{
//                 state.mainTitle = ""
//                 state.mainSubtitle = ""
//             }
        
//         })
//     }))
// )


