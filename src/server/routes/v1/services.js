import express from "express";
import { getServices, getService } from "../services.js";
import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

router.get("/", internalAuth, getServices);
router.get("/:name", internalAuth, getService);

export default router;
