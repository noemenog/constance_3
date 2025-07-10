import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { configRouter } from "./ConfigRouter";
import { appInfoRouter } from "./AppInfoRouter";
import { bucketRouter } from "./BucketRouter";
import { commonRouter } from "./CommonRouter";

export const app_v3 = express();

//version 2
app_v3.use('/', appInfoRouter);
app_v3.use('/', bucketRouter);
app_v3.use('/', configRouter);
app_v3.use('/', commonRouter);
