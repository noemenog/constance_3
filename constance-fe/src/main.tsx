import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { Providers } from '@microsoft/mgt-element';
import { Msal2Provider } from '@microsoft/mgt-msal2-provider';

import { AllEnterpriseModule, LicenseManager, ModuleRegistry } from "ag-grid-enterprise";
import { AgChartsCommunityModule } from 'ag-charts-community';

//CSS files
import './index.css';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.min.css';
// import 'ag-grid-community/styles/ag-theme-quartz.min.css';
// import "@glideapps/glide-data-grid/dist/index.css";
// import "@glideapps/glide-data-grid-cells/dist/index.css";
import 'react-confirm-alert/src/react-confirm-alert.css';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';


import { LoaderFunctionArgs, Params, redirect, useNavigate } from 'react-router';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Error404Page from './CommonComponents/ErrorDisplay';
import { ActionSceneEnum } from './DataModels/Constants';
import AppInfoContainer from './Scenes/AppInfo/AppInfoContainer';
import AppInfoList from './Scenes/AppInfo/AppInfoList';
import LogView from './Scenes/Support/LogView';
import { baseRouteLoader, appInfoListLoader, appInfoDetailsLoader as appInfoDetailsLoader, logsLoader, bucketConfigLoader } from './BizLogicUtilities/RouterLoaderFuncs';
import BucketConfigContainer from './Scenes/BucketConfig/BucketConfigContainer';





ModuleRegistry.registerModules([AllEnterpriseModule.with(AgChartsCommunityModule)]);


// LicenseManager.setLicenseKey("CompanyName=SHI International Corp._on_behalf_of_INTEL Corporation,LicensedGroup=Dtdtools,LicenseType=MultipleApplications,LicensedConcurrentDeveloperCount=4,LicensedProductionInstancesCount=0,AssetReference=AG-025614,ExpiryDate=19_July_2023_[v2]_MTY4OTcyMTIwMDAwMA==077464c082638b0d389fb7885d0e809");
LicenseManager.setLicenseKey("Using_this_{AG_Grid}_Enterprise_key_{AG-056106}_in_excess_of_the_licence_granted_is_not_permitted___Please_report_misuse_to_legal@ag-grid.com___For_help_with_changing_this_key_please_contact_info@ag-grid.com___{Intel_Corporation}_is_granted_a_{Multiple_Applications}_Developer_License_for_{3}_Front-End_JavaScript_developers___All_Front-End_JavaScript_developers_need_to_be_licensed_in_addition_to_the_ones_working_with_{AG_Grid}_Enterprise___This_key_has_not_been_granted_a_Deployment_License_Add-on___This_key_works_with_{AG_Grid}_Enterprise_versions_released_before_{5_April_2025}____[v3]_[01]_MTc0MzgwNzYwMDAwMA==ad05ff75a735e41c4c9b209fb4352c7d")


// Handle msal necessities
Providers.globalProvider = new Msal2Provider({
    clientId: 'a7f7c6ed-36da-44d2-9779-68d0fe2aca12',
    authority: "https://login.microsoftonline.com/46c98d88-e344-4ed4-8496-4ed7712e255d",
    scopes: ['user.read', 'openid', 'profile', 'user.readbasic.all', 'group.read.all'],
    redirectUri: "/"
})



function Redirector(props: any) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`${props.path}`);
  }, [navigate]);

  return null; // Optionally, you can return a loading spinner or message
}

//Define react routes
const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        errorElement: <Error404Page />,
        loader: ({ request, params }: LoaderFunctionArgs) => baseRouteLoader(request, params),
        children: [
            {
                path: "list",
                element: <AppInfoList />,
                loader: ({ request, params }: LoaderFunctionArgs) => appInfoListLoader(request, params),
            },
            //NON Env ================================================================================
            {
                path: `${ActionSceneEnum.APPHOME}/:appId/:tabInfo`,
                element: <AppInfoContainer />,
                loader: ({ request, params }: LoaderFunctionArgs) => appInfoDetailsLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.APPHOME}/:appId`,
                element: <AppInfoContainer />,
                loader: ({ request, params }: LoaderFunctionArgs) => appInfoDetailsLoader(request, params),
            },
            //ENV RELATED =============================================================================
            {
                path: `${ActionSceneEnum.CONFIGURATIONS}/:appId/:env/:bucketId/:configId/:version`,
                element: <BucketConfigContainer />,
                loader: ({ request, params }: LoaderFunctionArgs) => bucketConfigLoader(request, params),
            },
            // {
            //     path: `${ActionSceneEnum.CONFIGURATIONS}/:appId/:env/:bucketId/:destEnv`,
            //     element: <BucketConfigContainer />,
            //     loader: ({ request, params }: LoaderFunctionArgs) => comparisonLoader(request, params),
            // },
            {
                path: `${ActionSceneEnum.CONFIGURATIONS}/:appId/:env/:bucketId`,
                element: <BucketConfigContainer />,
                loader: ({ request, params }: LoaderFunctionArgs) => bucketConfigLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.CONFIGURATIONS}/:appId/:env`,
                element: <BucketConfigContainer />,
                loader: ({ request, params }: LoaderFunctionArgs) => bucketConfigLoader(request, params),
            },
            //OTHERS====================================================================================
            {
                path: `${ActionSceneEnum.LOGS}/:appId/:env`,
                element: <LogView />,
                loader: ({ request, params }: LoaderFunctionArgs) => logsLoader(request, params),
            }
        ],
    },
]);





ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>,
)



