import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import { UIMessageType, ActionSceneEnum, SCENES_MAPPING, PermissionActionEnum, EnvTypeEnum } from './Constants';
import { ConfigItem, PropertyItem, LoggedInUser, LoadingSpinnerInfo, PageConfInfo, BasicProperty, ActionPermissionContext, StatusIndicatorItem } from './HelperModels';
import { Draft, enableMapSet, produce, WritableDraft } from 'immer';
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
// import { getPermActionSceneData } from '../BizLogicUtilities/Permissions';
import { AppInfo } from './ServiceModels';

enableMapSet()



interface CStore {
    currentAppInfo: AppInfo | null;
    selectedEnvironment: EnvTypeEnum;
    loggedInUser: LoggedInUser | undefined;
    isMenuCollapsed : boolean;
    isLoadingBackdropEnabled: boolean;
    themeMode : string;
    heightForSidebar: number | string;
    loadingSpinnerCtx: LoadingSpinnerInfo;
    menuCurrentScene: ActionSceneEnum;
    mainTitle: string;
    mainSubtitle: string;
    showMenu: boolean;
    initConfigs: ConfigItem[];
    pageConfInfoMap: Map<string, PageConfInfo>;
    permissionRoles: BasicProperty[];
    actionScenePermContextMap: Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>;
    displayQuickMessage: (type: UIMessageType, msg: string, timeout?: number) => void;
    
    setCurrentAppInfo: (appInfo: AppInfo|null) => void;
    clearCurrentAppInfo: () => void; 

    setSelectedEnvironment: (selectedEnvironment: EnvTypeEnum) => void;
    setLoggedInUser: (loggedInUser: LoggedInUser|undefined) => void;
    setIsMenuCollapsed : (isMenuCollapsed: boolean) => void;
    setIsLoadingBackdropEnabled : (isLoadingBackdropEnabled: boolean) => void;
    setThemeMode : (themeMode: string) => void;
    setHeightForSidebar: (heightForSidebar: string|number) => void;
    setLoadingSpinnerCtx: (loadingSpinnerCtx: LoadingSpinnerInfo) => void;
    cancelLoadingSpinnerCtx: () => void;
    setMenuCurrentScene: (menuCurrentScene: ActionSceneEnum) => void;
    setMainTitle: (mainTitle: string) => void;
    setMainSubtitle: (mainSubtitle: string) => void;
    setShowMenu: (showMenu: boolean) => void;
    setPageConfInfoMap: (pageConfInfoMap: Map<string, PageConfInfo>) => void;
    setPermissionRoles: (permissionRoles: BasicProperty[]) => void;
    setActionScenePermContextMap: (actionScenePermContextMap: Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>) => void;
    
    setDisplayQuickMessage: (displayQuickMessage: (type: UIMessageType, msg: string, timeout?: number) => void) => void;
    
    setInitConfigs: (initConfigs: ConfigItem[]) => void;

    placePageTitle: (key: string) => void;
}


export const useCStore = create<CStore>()(
    immer((set, get) => ({
        currentAppInfo: null,
        selectedEnvironment: EnvTypeEnum.DEVELOPMENT,
        loggedInUser: undefined,
        isMenuCollapsed : false,
        isLoadingBackdropEnabled: false,
        themeMode: 'dark',
        heightForSidebar: 0,
        loadingSpinnerCtx: {enabled: false, text: ""},
        menuCurrentScene: ActionSceneEnum.ROOT,
        mainTitle: '',
        mainSubtitle: '',
        showMenu: false,
        initConfigs: [],
        pageConfInfoMap: new Map<string, PageConfInfo>(),
        permissionRoles: [],
        actionScenePermContextMap: new Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>(),
        displayQuickMessage: (type, msg) => {},
        
        setSelectedEnvironment: (selectedEnvironment) => set((state) => { state.selectedEnvironment = selectedEnvironment; }),
        setIsMenuCollapsed : (isMenuCollapsed) => set((state) => { state.isMenuCollapsed = isMenuCollapsed; }),
        setIsLoadingBackdropEnabled : (isLoadingBackdropEnabled) => set((state) => { state.isLoadingBackdropEnabled = isLoadingBackdropEnabled; }),
        setThemeMode : (themeMode) => set((state) => { state.themeMode = themeMode; }),
        setHeightForSidebar: (heightForSidebar) => set((state) => { state.heightForSidebar = heightForSidebar; }),
        setLoadingSpinnerCtx: (loadingSpinnerCtx) => set((state) => { state.loadingSpinnerCtx = {...loadingSpinnerCtx}; }),
        setMenuCurrentScene: (menuCurrentScene) => set((state) => { state.menuCurrentScene = menuCurrentScene; }),
        setMainTitle: (mainTitle) => set((state) => { state.mainTitle = mainTitle; }),
        setMainSubtitle: (mainSubtitle) => set((state) => { state.mainSubtitle = mainSubtitle; }),
        setShowMenu: (showMenu) => set((state) => { state.showMenu = showMenu; }),
        setPageConfInfoMap: (pageConfInfoMap) => set((state) => { state.pageConfInfoMap = (rfdcCopy<Map<string, PageConfInfo>>(pageConfInfoMap) as Map<string, PageConfInfo>) }),
        setPermissionRoles: (permissionRoles) => set((state) => { state.permissionRoles = (permissionRoles ? Array.from(permissionRoles) : permissionRoles); }),
        
        setDisplayQuickMessage: (displayQuickMessage) => set((state) => { state.displayQuickMessage = displayQuickMessage; }),

        setActionScenePermContextMap: (actionScenePermContextMap) => set((state) => { 
            state.actionScenePermContextMap = (rfdcCopy<Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>>(actionScenePermContextMap) as Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>) 
        }),

        setInitConfigs: (initConfigs) => set((state) => { 
            let confs = (initConfigs ? Array.from(initConfigs) : initConfigs)
            state.initConfigs = confs;
            // getPermActionSceneData(get().permissionRoles, state.initConfigs).then((data: Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>) => {
            //     if(data) {
            //         get().setActionScenePermContextMap(data)
            //     }
            // });
        }),

        
        setLoggedInUser: (loggedInUser) => set((state) => { 
            state.loggedInUser = loggedInUser; 
            if(state.loggedInUser && state.currentAppInfo && state.currentAppInfo._id && state.currentAppInfo._id.length > 0){
                state.showMenu = true;   //sometimes login processing might complete later than expected
            }
        }),
        
        setCurrentAppInfo: (appInfo) => set((state) => { 
            state.currentAppInfo = appInfo as AppInfo; 
            if(state.loggedInUser && appInfo && appInfo._id && appInfo._id.length > 0){
                state.showMenu = true;
            }
        }),
        
        clearCurrentAppInfo: () => set((state) => {
            state.currentAppInfo = null;
            state.initConfigs = [];
            state.showMenu = false;
            state.permissionRoles = [],
            state.actionScenePermContextMap = new Map<ActionSceneEnum, Map<PermissionActionEnum, ActionPermissionContext>>()
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



