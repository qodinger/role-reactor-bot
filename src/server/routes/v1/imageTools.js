import express from "express";
import multer from "multer";
import {
  apiProcessImage,
  apiGetImageToolsConfig,
  apiGetFreeQuota,
} from "../../controllers/ImageToolsController.js";
import { apiRateLimiter } from "../../middleware/rateLimiter.js";

const router = express.Router();

// Configure multer for memory storage (buffer only, no temp files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max (resize/compress/convert)
    files: 1, // One file at a time
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Upload JPG, PNG, GIF, WebP, or HEIC."));
    }
  },
});

// GET /api/v1/image-tools/config — Get tool configurations and pricing
router.get("/config", apiRateLimiter, apiGetImageToolsConfig);

// GET /api/v1/image-tools/free-quota — Get the current user's remaining free operations for today
router.get("/free-quota", apiRateLimiter, apiGetFreeQuota);

// POST /api/v1/image-tools/process — Process an image
router.post(
  "/process",
  apiRateLimiter,
  upload.single("file"),
  apiProcessImage,
);

export default router;
