import express from "express";
import { apiGetConfig } from "../../controllers/ConfigController.js";
import { internalAuth } from "../../middleware/internalAuth.js";
import { requireAuth } from "../../middleware/authentication.js";
import { requireAdmin } from "../../middleware/userAuthorization.js";

const router = express.Router();

// Get internal configuration (admin only)
router.get("/", internalAuth, requireAuth, requireAdmin, apiGetConfig);

export default router;
