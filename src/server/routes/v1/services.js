import express from "express";
import { getServices, getService } from "../services.js";

const router = express.Router();

router.get("/", getServices);
router.get("/:name", getService);

export default router;
