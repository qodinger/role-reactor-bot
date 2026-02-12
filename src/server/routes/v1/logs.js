import express from "express";
import { apiGetLogs } from "../../controllers/LogController.js";
import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

// Get system logs (internal only)
router.get("/", internalAuth, apiGetLogs);

export default router;
