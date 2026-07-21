import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
  logRequest,
} from "../utils/responseHelpers.js";
import { processImage } from "../../utils/image-tools/imageTools.js";
import {
  resizeImage,
  compressImage,
  convertImage,
} from "../../utils/image-tools/sharpProcessor.js";
import {
  getImageToolConfig,
  isAllowedFileType,
  isAllowedFileSize,
  getImageToolCost,
  FREE_DAILY_QUOTA,
} from "../../config/imageTools.js";
import { checkAndDeductSpecificCredits } from "../../utils/ai/aiCreditManager.js";
import {
  checkAndConsumeFreeTier,
  getFreeQuota,
} from "../../utils/image-tools/freeQuotaManager.js";

const logger = getLogger();

// Allowed tools
const ALLOWED_TOOLS = ["resize", "compress", "convert", "upscale"];

// Tools that use Sharp (free - no API cost)
const SHARP_TOOLS = ["resize", "compress", "convert"];

/**
 * POST /api/v1/image-tools/process
 * Process an image with the specified tool
 */
export async function apiProcessImage(req, res) {
  logRequest(logger, "Image Tools Process", req, "🖼️");

  try {
    const userId = req.user?.id;
    if (!userId) {
      const { statusCode, response } = createErrorResponse(
        "Unauthorized: User ID required",
        401,
      );
      return res.status(statusCode).json(response);
    }

    // Parse multipart form data (set by multer middleware)
    const file = req.file;
    const tool = req.body.tool;
    const optionsRaw = req.body.options;

    if (!file) {
      const { statusCode, response } = createErrorResponse(
        "No file provided",
        400,
        "Upload an image file (JPG, PNG, or WebP)",
      );
      return res.status(statusCode).json(response);
    }

    if (!tool || !ALLOWED_TOOLS.includes(tool)) {
      const { statusCode, response } = createErrorResponse(
        `Invalid tool. Allowed: ${ALLOWED_TOOLS.join(", ")}`,
        400,
      );
      return res.status(statusCode).json(response);
    }

    // Validate file type
    if (!isAllowedFileType(tool, file.mimetype)) {
      const config = getImageToolConfig(tool);
      const { statusCode, response } = createErrorResponse(
        `Invalid file type. ${tool} supports: ${config.allowedTypes.join(", ")}`,
        400,
      );
      return res.status(statusCode).json(response);
    }

    // Validate file size
    if (!isAllowedFileSize(tool, file.size)) {
      const config = getImageToolConfig(tool);
      const { statusCode, response } = createErrorResponse(
        `File too large. Maximum size for ${tool} is ${config.maxFileSizeMB}MB`,
        400,
      );
      return res.status(statusCode).json(response);
    }

    // Parse options
    let options = {};
    if (optionsRaw) {
      try {
        options = typeof optionsRaw === "string" ? JSON.parse(optionsRaw) : optionsRaw;
      } catch {
        const { statusCode, response } = createErrorResponse(
          "Invalid options JSON",
          400,
        );
        return res.status(statusCode).json(response);
      }
    }

    // ── Credit / free-tier check ───────────────────────────────────────────
    const toolConfig = getImageToolConfig(tool);
    const creditCost = getImageToolCost(tool);

    let creditsDeducted = 0;
    let creditsRemaining = null;
    let freeRemaining = null;

    if (toolConfig.freeDaily) {
      // Try to consume one free operation
      const freeResult = await checkAndConsumeFreeTier(userId);

      if (freeResult.allowed) {
        // Free — no cores deducted
        creditsDeducted = 0;
        freeRemaining = freeResult.remaining;
      } else {
        // Quota exhausted — fall back to charging cores
        const deduction = await checkAndDeductSpecificCredits(userId, creditCost);
        if (!deduction.success) {
          const { statusCode, response } = createErrorResponse(
            "Insufficient credits",
            402,
            `Free quota exhausted. This tool costs ${creditCost} cores. You have ${deduction.creditsRemaining} cores.`,
          );
          return res.status(statusCode).json(response);
        }
        creditsDeducted = deduction.creditsDeducted;
        creditsRemaining = deduction.creditsRemaining;
        freeRemaining = 0;
      }
    } else {
      // Paid-only tool (upscale)
      const deduction = await checkAndDeductSpecificCredits(userId, creditCost);
      if (!deduction.success) {
        const { statusCode, response } = createErrorResponse(
          "Insufficient credits",
          402,
          `This tool costs ${creditCost} cores. You have ${deduction.creditsRemaining} cores.`,
        );
        return res.status(statusCode).json(response);
      }
      creditsDeducted = deduction.creditsDeducted;
      creditsRemaining = deduction.creditsRemaining;
    }

    // Process the image
    let result;

    if (SHARP_TOOLS.includes(tool)) {
      // Use Sharp for basic operations
      switch (tool) {
        case "resize":
          result = await resizeImage(file.buffer, file.originalname, options);
          break;
        case "compress":
          result = await compressImage(file.buffer, file.originalname, options);
          break;
        case "convert":
          result = await convertImage(file.buffer, file.originalname, options);
          break;
        default:
          result = await compressImage(file.buffer, file.originalname, options);
      }
    } else {
      // Use iLoveAPI for AI operations
      result = await processImage(tool, file.buffer, file.originalname, options);
    }

    // Return the processed file
    const responseHeaders = {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "X-Credits-Deducted": String(creditsDeducted),
      "X-Processing-Method": SHARP_TOOLS.includes(tool) ? "sharp" : "iloveapi",
    };
    if (creditsRemaining !== null) {
      responseHeaders["X-Credits-Remaining"] = String(creditsRemaining);
    }
    if (freeRemaining !== null) {
      responseHeaders["X-Free-Remaining"] = String(freeRemaining);
    }

    res.set(responseHeaders);
    return res.send(result.buffer);
  } catch (error) {
    logger.error("Image tools processing error:", error);

    const { statusCode, response } = createErrorResponse(
      "Failed to process image",
      500,
      "The image processing service may be temporarily unavailable. Please try again.",
      error.message,
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * GET /api/v1/image-tools/config
 * Get image tools configuration and pricing
 */
export async function apiGetImageToolsConfig(req, res) {
  logRequest(logger, "Image Tools Config", req, "🖼️");

  try {
    const configs = {};
    for (const tool of ALLOWED_TOOLS) {
      const config = getImageToolConfig(tool);
      configs[tool] = {
        name: config.name,
        description: config.description,
        userCores: config.userCores,
        freeDaily: config.freeDaily ?? false,
        freeDailyQuota: config.freeDaily ? FREE_DAILY_QUOTA : null,
        allowedTypes: config.allowedTypes,
        maxFileSizeMB: config.maxFileSizeMB,
      };
    }

    return res.json(createSuccessResponse({ tools: configs, freeDailyQuota: FREE_DAILY_QUOTA }));
  } catch (error) {
    logger.error("Failed to get image tools config:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve configuration",
      500,
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * GET /api/v1/image-tools/free-quota
 * Get the current user's remaining free operations for today
 */
export async function apiGetFreeQuota(req, res) {
  logRequest(logger, "Image Tools Free Quota", req, "🖼️");

  try {
    const userId = req.user?.id;
    if (!userId) {
      const { statusCode, response } = createErrorResponse("Unauthorized: User ID required", 401);
      return res.status(statusCode).json(response);
    }

    const quota = await getFreeQuota(userId);
    return res.json(createSuccessResponse(quota));
  } catch (error) {
    logger.error("Failed to get free quota:", error);
    const { statusCode, response } = createErrorResponse("Failed to retrieve quota", 500);
    return res.status(statusCode).json(response);
  }
}

