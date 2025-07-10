import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { validationsRouter } from "./ValidationsRouter";

export const app_v2 = express();

//version 2
app_v2.use('/', validationsRouter);
