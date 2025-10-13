import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import { UIMessageType, ActionSceneEnum, SCENES_MAPPING, EnvTypeEnum } from './Constants';
import { ConfigItem, PropertyItem, LoggedInUser, LoadingSpinnerInfo, PageConfInfo, BasicProperty, Bucket } from './ServiceModels';
import { Draft, enableMapSet, produce, WritableDraft } from 'immer';
import { rfdcCopy } from '../BizLogicUtilities/UtilFunctions';
import { AppInfo } from './ServiceModels';

enableMapSet()


interface CStore {
    currentAppBasicInfo: BasicProperty | null;
    selectedEnvironment: EnvTypeEnum;
    selectedBucket: Bucket | null;
    loggedInUser: LoggedInUser | undefined;
    jsonConfigViewEnabled: boolean;
    isMenuCollapsed : boolean;
    isLoadingBackdropEnabled: boolean;
    themeMode : string;
    loadingSpinnerCtx: LoadingSpinnerInfo;
    menuCurrentScene: ActionSceneEnum;
    mainTitle: string;
    mainSubtitle: string;
    showMenu: boolean;
    initConfigs: ConfigItem[];
    pageConfInfoMap: Map<string, PageConfInfo>;
    
    displayQuickMessage: (type: UIMessageType, msg: string, timeout?: number) => void;
    
    setCurrentAppBasicInfo: (appInfo: AppInfo|null) => void;
    clearCurrentAppInfo: () => void; 

    setSelectedEnvironment: (selectedEnvironment: EnvTypeEnum) => void;
    setSelectedBucket: (selectedBucket: Bucket|null) => void;
    setLoggedInUser: (loggedInUser: LoggedInUser|undefined) => void;
    setJsonConfigViewEnabled : (jsonConfigViewEnabled: boolean) => void;
    setIsMenuCollapsed : (isMenuCollapsed: boolean) => void;
    setIsLoadingBackdropEnabled : (isLoadingBackdropEnabled: boolean) => void;
    setThemeMode : (themeMode: string) => void;
    setLoadingSpinnerCtx: (loadingSpinnerCtx: LoadingSpinnerInfo) => void;
    cancelLoadingSpinnerCtx: () => void;
    setMenuCurrentScene: (menuCurrentScene: ActionSceneEnum) => void;
    setMainTitle: (mainTitle: string) => void;
    setMainSubtitle: (mainSubtitle: string) => void;
    setShowMenu: (showMenu: boolean) => void;
    setPageConfInfoMap: (pageConfInfoMap: Map<string, PageConfInfo>) => void;
    
    setDisplayQuickMessage: (displayQuickMessage: (type: UIMessageType, msg: string, timeout?: number) => void) => void;
    
    setInitConfigs: (initConfigs: ConfigItem[]) => void;

    placePageTitle: (key: string) => void;
}


export const useCStore = create<CStore>()(
    immer((set, get) => ({
        currentAppBasicInfo: null,
        selectedEnvironment: EnvTypeEnum.DEVELOPMENT,
        selectedBucket: null,
        loggedInUser: undefined,
        jsonConfigViewEnabled: false,
        isMenuCollapsed : false,
        isLoadingBackdropEnabled: false,
        themeMode: 'dark',
        loadingSpinnerCtx: {enabled: false, text: ""},
        menuCurrentScene: ActionSceneEnum.ROOT,
        mainTitle: '',
        mainSubtitle: '',
        showMenu: false,
        initConfigs: [],
        pageConfInfoMap: new Map<string, PageConfInfo>(),
        displayQuickMessage: (type, msg) => {},
        
        setSelectedEnvironment: (selectedEnvironment) => set((state) => { state.selectedEnvironment = selectedEnvironment; }),
        setSelectedBucket: (selectedBucket) => set((state) => { state.selectedBucket = selectedBucket; }),
        setJsonConfigViewEnabled : (jsonConfigViewEnabled) => set((state) => { state.jsonConfigViewEnabled = jsonConfigViewEnabled; }),
        setIsMenuCollapsed : (isMenuCollapsed) => set((state) => { state.isMenuCollapsed = isMenuCollapsed; }),
        setIsLoadingBackdropEnabled : (isLoadingBackdropEnabled) => set((state) => { state.isLoadingBackdropEnabled = isLoadingBackdropEnabled; }),
        setThemeMode : (themeMode) => set((state) => { state.themeMode = themeMode; }),
        setLoadingSpinnerCtx: (loadingSpinnerCtx) => set((state) => { state.loadingSpinnerCtx = {...loadingSpinnerCtx}; }),
        setMenuCurrentScene: (menuCurrentScene) => set((state) => { state.menuCurrentScene = menuCurrentScene; }),
        setMainTitle: (mainTitle) => set((state) => { state.mainTitle = mainTitle; }),
        setMainSubtitle: (mainSubtitle) => set((state) => { state.mainSubtitle = mainSubtitle; }),
        setShowMenu: (showMenu) => set((state) => { state.showMenu = showMenu; }),
        setPageConfInfoMap: (pageConfInfoMap) => set((state) => { state.pageConfInfoMap = (rfdcCopy<Map<string, PageConfInfo>>(pageConfInfoMap) as Map<string, PageConfInfo>) }),
        
        setDisplayQuickMessage: (displayQuickMessage) => set((state) => { state.displayQuickMessage = displayQuickMessage; }),

        
        setInitConfigs: (initConfigs) => set((state) => { 
            let confs = (initConfigs ? Array.from(initConfigs) : initConfigs)
            state.initConfigs = confs;
        }),

        
        setLoggedInUser: (loggedInUser) => set((state) => { 
            state.loggedInUser = loggedInUser; 
            if(state.loggedInUser && state.currentAppBasicInfo && state.currentAppBasicInfo.id && state.currentAppBasicInfo.id.length > 0){
                state.showMenu = true;   //sometimes login processing might complete later than expected
            }
        }),
        
        setCurrentAppBasicInfo: (appInfo) => set((state) => { 
            state.currentAppBasicInfo = (appInfo) ? {id: appInfo?._id.toString() as string, name: appInfo?.name, value: appInfo.description} as BasicProperty : null; 
            if(state.loggedInUser && appInfo && appInfo._id && appInfo._id.length > 0){
                state.showMenu = true;
            }
        }),
        
        clearCurrentAppInfo: () => set((state) => {
            state.currentAppBasicInfo = null;
            state.initConfigs = [];
            state.showMenu = false;
        }),

        placePageTitle:(key: string) => set((state) => {
            let map = get().pageConfInfoMap as Map<string, PageConfInfo>
            let pageElement : PageConfInfo|undefined = map.get(key.toLowerCase());
            if(pageElement && pageElement.scene && SCENES_MAPPING.has(pageElement.scene.toLowerCase())) {
                state.menuCurrentScene = (SCENES_MAPPING.get(pageElement.scene.toLowerCase()) as ActionSceneEnum) || ''
                state.mainTitle = pageElement.title
                state.mainSubtitle = pageElement.subtitle
            }
            else {
                state.menuCurrentScene = ActionSceneEnum.ROOT
                state.mainTitle = "Constance"
                state.mainSubtitle = "Configuration Management Simplified"
            }
        }),

        cancelLoadingSpinnerCtx: () => set((state) => { 
            state.loadingSpinnerCtx = { enabled: false, text: ""} as LoadingSpinnerInfo; 
        }),
    }))
)



