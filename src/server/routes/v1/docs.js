import express from "express";
import { getSwaggerUI, getOpenAPISpec } from "../docs.js";

const router = express.Router();

router.get("/", getSwaggerUI);
router.get("/openapi.json", getOpenAPISpec);

export default router;
