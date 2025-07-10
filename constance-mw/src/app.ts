import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from 'compression';
import * as dbConn from './dbConn'
import { app_v2 } from "./Routers/V2/__index";
import { app_v3 } from "./Routers/V3/__index";
import fs from 'fs'
import path from "path"
import { processRouteIntercept } from "./BizLogic/BasicCommonLogic";
import { ConfigItem } from "./Models/ServiceModels";
import { ConstanceRepo } from "./Repository/ConstanceRepo";
import { AppConfigConstants } from "./Models/Constants";






dotenv.config();

const PORT: number = process.env.PORT ? parseInt(process.env.PORT as string, 10) : 3000;
const app = express();

//use compression
app.use(compression())


//use helmet
app.use(helmet());


//apply CORS policy
let constanceRepo = new ConstanceRepo();
let genConfigs: ConfigItem[] = await constanceRepo.getConfigs(AppConfigConstants.BUCKETID__MAIN_GENERAL_CONFIG) ?? [];
let originConf = genConfigs?.find(x => (x.name && x.name.toLowerCase() === "allowed_origins"))?.value;
let allowList : string[] = originConf?.allowedOrigins ?? [];
let allowUndefOrigin = originConf?.allowUndefinedOrigin?.toString().toLowerCase().trim() ?? "true";
if(allowList && allowList.length > 0){
    let corsOptions = {
        origin: function (origin: any, callback: any) {
            if((!origin) && (allowUndefOrigin === "true")) {
                return callback(null, true);
            }
            
            if (allowList.indexOf(origin) !== -1) {
                callback(null, true)
            } 
            else {
                callback(new Error(`The CORS policy for this site does not allow access from the specified Origin.`))
            }
        }
    }
    app.use(cors(corsOptions));
}
else {
    app.use(cors());
}


//handle payload size limits
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({limit: "1000mb", extended: true, parameterLimit: 50000}))


//middleware - the positioning for this is important! It needs top come before all the actual route defs
app.use(async (req, res, next) => {
    let retval = await processRouteIntercept(req, res);
    if(retval.proceed) {
        next();
    }
    else {
        res.status(500).json(retval.resp);
    }
});


//handle root route
app.get('/', (req, res) => { res.status(200).send('Hello & Welcome!'); });


// versioning
app.use('/api/v2', app_v2);
app.use('/api/v3', app_v3);


// handle mongo indexes
try { 
    dbConn.connectToMongo()
    .then(() => {
        dbConn.createMongoIndexes()
        .then(() => {
            console.log(`Index assessment completed... [ ${new Date().toISOString()} ]`);
            console.log("\n")
        }).catch(e => {
            console.error(e); process.exit();
        })
    }).catch(e => {
        console.error(e); process.exit();
    }) 
}
catch(e:any){ 
    console.error(e); process.exit(); 
}


//start listening
app.listen(PORT, () => {
    console.log("\n")
    console.log(`Listening on port ${PORT}`);
});
















// //handle CORS setup...
// let corsConfigured = false;
// getGenConfigs(null, null, true).then((genConfigs: ConfigItem[]) => {
//     let originConf = genConfigs?.find(x => x.configName.toLowerCase() === "allowed_origins")?.configValue;
//     let allowList : string[] = originConf?.allowedOrigins ?? [];
//     let allowUndefOrigin = originConf?.allowUndefinedOrigin?.toString().toLowerCase().trim() ?? "true";
//     if(allowList && allowList.length > 0){
//         let corsOptions = {
//             origin: function (origin: any, callback: any) {
//                 if((!origin) && (allowUndefOrigin === "true")) {
//                     return callback(null, true);
//                 }
                
//                 if (allowList.indexOf(origin) !== -1) {
//                     callback(null, true)
//                 } 
//                 else {
//                     callback(new Error(`The CORS policy for this site does not allow access from the specified Origin.`))
//                 }
//             }
//         }
//         app.use(cors(corsOptions));
//         corsConfigured = true;
//     }
//     else {
//         app.use(cors());
//         corsConfigured = true;
//     }
// })
// .finally(() => {
//     if(corsConfigured === false) { 
//         app.use(cors()); 
//     }
    
//     //start listening
//     app.listen(PORT, () => {
//         console.log("\n")
//         console.log(`Listening on port ${PORT}`);
//     });
// })












// //==========================================================

// import * as jsondiffpatch from 'jsondiffpatch';

// let dt = new Date()
// dt.setMonth(11);

// const p1 = {
//     firstName: "John",
//     lastName: "Doe",
//     age: 50, 
//     eyeColor: "blue",
//     faveDate: dt,
//     foods: ["pasta", "linguini", "ofe", "garri"],
//     langs: ["python", "c++", "java", "rust"]
// }
  

// const p2 = {
//     firstName: "John",
//     lastName: "Jamison",
//     age: 70, 
//     eyeColor: "blue",
//     faveDate: dt,
//     foods: ["pasta", "ofe", "linguini", "okra"],
//     langs: ["python", "c++", "rust", "java"]
// }


// const delta1 = jsondiffpatch.diff(p1, p2);

// let dt2 = new Date(dt);
// dt2.setMonth(7);

// const p3 = {
//     firstName: "John",
//     lastName: "Stammer",
//     age: 70, 
//     eyeColor: "red",
//     faveDate: dt2,
//     foods: ["pasta", "ofe", "linguini", "okra"],
//     langs: ["python", "c++", "rust", "java"],
//     state: "alaska"
// }

// const reverseDelta = jsondiffpatch.reverse(delta1);

// let d111 = jsondiffpatch.patch(p3, delta1);
// let d222 = jsondiffpatch.unpatch(p3, delta1)

// console.log(d222)
// //===================================================

// //============================================================================================





// import { Request, ParamsDictionary, Response } from "express-serve-static-core";
// import { ParsedQs } from "qs";

// //create http(s) server and start listening 
// https.createServer(certOptions, app).listen(PORT, () => {
//     console.log(`Listening on port ${PORT}`);
// });


