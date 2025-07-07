

// PLACEHOLDER FILE, with PLACEHOLDER CODE



import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { interfaceRouter } from "./InterfaceRouter";
// import { netclassRouter } from "./NetclassRouter";
// import { ruleAreaConstraintsRouter } from "./ruleAreaConstraintsRouter";
// import { netRouter } from "./netRouter";
// import { powerInfoRouter } from "./powerInfoRouter";
// import { projectRouter } from "./projectRouter";
// import { packageLayoutRouter } from "./packageLayoutRouter";

export const app_v2 = express();

//version 2
app_v2.use('/', interfaceRouter);
// app_v2.use('/', netclassRouter);
// appv1.use('/', netRouter);
// appv1.use('/', packageLayoutRouter);
// appv1.use('/', powerInfoRouter);
// appv1.use('/', projectRouter);
// appv1.use('/', ruleAreaConstraintsRouter);




