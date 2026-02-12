import express from "express";
import { apiCommandUsage } from "../../controllers/StatsController.js";

const router = express.Router();

router.get("/usage", apiCommandUsage);

export default router;
