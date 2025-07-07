import React from 'react'
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
import "@glideapps/glide-data-grid/dist/index.css";
import "@glideapps/glide-data-grid-cells/dist/index.css";
import 'react-confirm-alert/src/react-confirm-alert.css';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';


import { LoaderFunctionArgs, Params, redirect } from 'react-router';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Error404Page from './CommonComponents/ErrorDisplay';
import { ActionSceneEnum } from './DataModels/Constants';
import C2CLayoutView from './Scenes/C2CLayout/C2CLayoutView';
import DefaultConstraintsView from './Scenes/DefaultConstraints/DefaultConstraintsView';
import InterfacesView from './Scenes/Interface/InterfacesView';
import NetManagementView from './Scenes/Nets/NetManagementView';
import RuleAreas from './Scenes/PkgLayout/RuleAreas';
import Stackup from './Scenes/PkgLayout/Stackup';
import PowerInfoView from './Scenes/Power/PowerInfoView';
import ProjectDetails from './Scenes/Project/ProjectDetails';
import ProjectList from './Scenes/Project/ProjectList';
import FAQPage from './Scenes/Support/FAQPage';
import LogView from './Scenes/Support/LogView';
import Validations from './Scenes/Support/Validations';
import { baseRouteLoader, projectListLoader, projectDetailsLoader, defaultConstraintsLoader, netManagementLoader, interfacesLoader, 
    c2cLayoutLoader, powerInfoLoader, validationsLoader, logsLoader, faqLoader, ruleAreaLoader, layerGroupsLoader, stackupLoader } from './BizLogicUtilities/RouterLoaderFuncs';
import LayerGroups from './Scenes/PkgLayout/LayerGroups';




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


//Define react routes
const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        errorElement: <Error404Page />,
        loader: ({ request, params }: LoaderFunctionArgs) => baseRouteLoader(request, params),
        // hydrateFallbackElement: <Typography noWrap component="div" sx={{ mt: 3, ml: 2, color: "black", fontStyle: "italic"}}> {`Almost done loading...`} </Typography>,
        children: [
            {
                path: "projectlist",
                element: <ProjectList />,
                loader: ({ request, params }: LoaderFunctionArgs) => projectListLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.PROJECT}/:projectId/:tabInfo`,
                element: <ProjectDetails />,
                loader: ({ request, params }: LoaderFunctionArgs) => projectDetailsLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.PROJECT}/:projectId`,
                element: <ProjectDetails />,
                loader: ({ request, params }: LoaderFunctionArgs) => projectDetailsLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.STACKUP}/:projectId`,
                element: <Stackup />,
                loader: ({ request, params }: LoaderFunctionArgs) => stackupLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.LAYERGROUPS}/:projectId`,
                element: <LayerGroups />,
                loader: ({ request, params }: LoaderFunctionArgs) => layerGroupsLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.RULEAREAS}/:projectId`,
                element: <RuleAreas />,
                loader: ({ request, params }: LoaderFunctionArgs) => ruleAreaLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.DEFAULTCONSTRAINTS}/:projectId`,
                element: <DefaultConstraintsView />,
                loader: ({ request, params }: LoaderFunctionArgs) => defaultConstraintsLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.NETS}/:projectId/:tabInfo`,
                element: <NetManagementView />,
                loader: ({ request, params }: LoaderFunctionArgs) => netManagementLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.NETS}/:projectId`,
                element: <NetManagementView />,
                loader: ({ request, params }: LoaderFunctionArgs) => netManagementLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.INTERFACES}/:projectId`,
                element: <InterfacesView />,
                loader: ({ request, params }: LoaderFunctionArgs) => interfacesLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.INTERFACES}/:projectId/:interfaceId`,
                element: <InterfacesView />,
                loader: ({ request, params }: LoaderFunctionArgs) => interfacesLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.INTERFACES}/:projectId/:interfaceId/:tabInfo`,
                element: <InterfacesView />,
                loader: ({ request, params }: LoaderFunctionArgs) => interfacesLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.C2CLAYOUT}/:projectId`,
                element: <C2CLayoutView />,
                loader: ({ request, params }: LoaderFunctionArgs) => c2cLayoutLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.C2CLAYOUT}/:projectId/:ruleAreaId`,
                element: <C2CLayoutView />,
                loader: ({ request, params }: LoaderFunctionArgs) => c2cLayoutLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.POWERINFO}/:projectId/:tabInfo`,
                element: <PowerInfoView />,
                loader: ({ request, params }: LoaderFunctionArgs) => powerInfoLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.POWERINFO}/:projectId`,
                element: <PowerInfoView />,
                loader: ({ request, params }: LoaderFunctionArgs) => powerInfoLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.VALIDATIONS}/:projectId`,
                element: <Validations />,
                loader: ({ request, params }: LoaderFunctionArgs) => validationsLoader(request, params),
            },
            {
                path: `${ActionSceneEnum.LOGS}/:projectId`,
                element: <LogView />,
                loader: ({ request, params }: LoaderFunctionArgs) => logsLoader(request, params),
            },
            {
                path: "faq",
                element: <FAQPage />,
                loader: ({ request, params }: LoaderFunctionArgs) => faqLoader(request, params),
            },
        ],
    },
]);





ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>,
)





//=============================================================


// import { MsalProvider } from '@azure/msal-react';
// import { Configuration, PublicClientApplication } from '@azure/msal-browser';


// const msalConfig = {
//     auth: {
//         clientId: "your-client-id",
//         authority: "https://login.microsoftonline.com/your-tenant-id",
//         redirectUri: "http://localhost:3000"
//     }
// };

// export const msalInstance = new PublicClientApplication(msalConfig);

// ReactDOM.createRoot(document.getElementById('root')!).render(
//     <MsalProvider instance={Providers.globalProvider.publicClientApplication}><React.StrictMode>
//         <RouterProvider router={router} />
//     </React.StrictMode></MsalProvider>
// )



// import { MsalProvider } from '@azure/msal-react';
// import { Configuration, PublicClientApplication } from '@azure/msal-browser';


// MSAL configuration
// const configuration: Configuration = {
//     auth: {
//         clientId: 'a7f7c6ed-36da-44d2-9779-68d0fe2aca12',
//         authority: "https://login.microsoftonline.com/46c98d88-e344-4ed4-8496-4ed7712e255d",
//         redirectUri: "/"
//     }
// };


// const silentRequest = {
//     scopes: ["user.read", "mail.send"]
// };
// const pca = new PublicClientApplication(configuration);

// pca.acquireTokenSilent(silentRequest)
// .then(response => {
//     console.log("Access token acquired silently: ", response.accessToken);
// })
// .catch(error => {
//     console.error("Silent token acquisition failed: ", error);
//     // Fallback to interactive method if needed
// });

// async function initializeMsal() {
//     await pca.initialize();
// }

// initializeMsal().then(() => {
//     // Now you can safely call other MSAL APIs
// });

// ReactDOM.createRoot(document.getElementById('root')!).render(
//     <React.StrictMode>
//         <MsalProvider instance={pca}><RouterProvider router={router} /></MsalProvider>
//     </React.StrictMode>,
// )