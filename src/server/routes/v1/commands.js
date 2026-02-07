import express from "express";
import { apiCommandUsage } from "../api.js";

const router = express.Router();

router.get("/usage", apiCommandUsage);

export default router;
