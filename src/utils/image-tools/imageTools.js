import { createImageToolsClient } from "./iloveApiClient.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Get the content type for a file extension
 * @param {string} ext - File extension (without dot)
 * @returns {string} MIME type
 */
function getContentType(ext) {
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext.toLowerCase()] || "image/jpeg";
}

/**
 * Get file extension from filename
 * @param {string} filename
 * @returns {string} Extension without dot
 */
function getExtension(filename) {
  return filename.split(".").pop()?.toLowerCase() || "jpg";
}

/**
 * Build output filename based on tool and options
 * @param {string} originalFilename
 * @param {string} tool
 * @param {Object} options
 * @returns {string} Output filename
 */
function buildOutputFilename(originalFilename, tool, options = {}) {
  const base = originalFilename.replace(/\.[^.]+$/, "");

  switch (tool) {
    case "upscale":
      return `${base}_upscaled_${options.multiplier || 2}x.${getExtension(originalFilename)}`;
    default:
      return originalFilename;
  }
}

/**
 * Upscale an image using AI
 * @param {Buffer} fileBuffer - Image buffer
 * @param {string} filename - Original filename
 * @param {Object} opts - Upscale options
 * @param {number} [opts.multiplier=2] - Upscale factor: 2 or 4
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string }>}
 */
export async function upscaleImage(fileBuffer, filename, opts = {}) {
  const client = createImageToolsClient();
  const multiplier = opts.multiplier || 2;

  const options = {
    multiplier,
  };

  const { buffer } = await client.processImage(
    "upscale",
    fileBuffer,
    filename,
    options,
  );

  return {
    buffer,
    filename: buildOutputFilename(filename, "upscale", { multiplier }),
    contentType: getContentType(getExtension(filename)),
  };
}

/**
 * Process an image with the specified tool (upscale only)
 * @param {string} tool - Tool name (upscale)
 * @param {Buffer} fileBuffer - Image buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Tool-specific options
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string }>}
 */
export async function processImage(tool, fileBuffer, filename, options = {}) {
  if (tool !== "upscale") {
    throw new Error(
      `processImage in imageTools.js only supports upscale. Use sharpProcessor.js for resize/compress/convert.`,
    );
  }

  logger.debug(`Processing image with ${tool}`, {
    filename,
    fileSize: fileBuffer.length,
    options,
  });

  return upscaleImage(fileBuffer, filename, options);
}
