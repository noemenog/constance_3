import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { interfaceRouter } from "./InterfaceRouter";
import { netclassRouter } from "./NetclassRouter";
import { constraintsRouter } from "./ConstraintsRouter";
import { netRouter } from "./NetRouter";
import { powerInfoRouter } from "./PowerInfoRouter";
import { projectRouter } from "./ProjectRouter";
import { packageLayoutRouter } from "./PackageLayoutRouter";
import { commonRouter } from "./CommonRouter";
import { snapshotRouter } from "./SnapshotRouter";
import { validationsRouter } from "./ValidationsRouter";

export const app_v1 = express();

//version 1
app_v1.use('/', commonRouter);
app_v1.use('/', interfaceRouter);
app_v1.use('/', netclassRouter);
app_v1.use('/', netRouter);
app_v1.use('/', packageLayoutRouter);
app_v1.use('/', powerInfoRouter);
app_v1.use('/', projectRouter);
app_v1.use('/', constraintsRouter);
app_v1.use('/', snapshotRouter);
app_v1.use('/', validationsRouter);
