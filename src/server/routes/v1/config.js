import express from "express";
import { apiGetConfig } from "../../controllers/ConfigController.js";
import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

// Get internal configuration (admin only)
router.get("/", internalAuth, apiGetConfig);

export default router;
