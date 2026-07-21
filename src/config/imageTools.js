/**
 * Image tools configuration and pricing
 *
 * Hybrid approach:
 *   - Basic operations (resize, compress, convert) use Sharp (local processing)
 *   - AI operations (upscale) use iLoveAPI (cloud processing)
 *
 * Free tier: Sharp tools are free up to FREE_DAILY_QUOTA per user per day.
 * When the quota is exhausted the user is charged userCores per operation.
 */

/** Shared free-ops quota per user per calendar day (UTC). */
export const FREE_DAILY_QUOTA = 10;

const IMAGE_TOOLS = {
  resize: {
    name: "Resize",
    description: "Resize images by pixels or percentage",
    processor: "sharp",
    iloveapiCredits: 0,
    userCores: 0.5,
    freeDaily: true,
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    maxFileSizeMB: 20,
  },
  compress: {
    name: "Compress",
    description: "Reduce image file size",
    processor: "sharp",
    iloveapiCredits: 0,
    userCores: 0.5,
    freeDaily: true,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeMB: 20,
  },
  convert: {
    name: "Convert",
    description: "Convert between image formats",
    processor: "sharp",
    iloveapiCredits: 0,
    userCores: 0.5,
    freeDaily: true,
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    outputFormats: ["jpg", "png", "gif", "webp"],
    maxFileSizeMB: 20,
  },
  upscale: {
    name: "Upscale",
    description: "Increase image resolution with AI",
    processor: "iloveapi",
    iloveapiCredits: 20,
    userCores: 5,
    freeDaily: false,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeMB: 10,
  },
};

/**
 * Get config for a specific image tool
 * @param {string} tool - Tool name (resize, compress, convert, upscale)
 * @returns {Object|null} Tool config or null if not found
 */
export function getImageToolConfig(tool) {
  return IMAGE_TOOLS[tool] || null;
}

/**
 * Get all image tool configs
 * @returns {Object} All tool configs keyed by tool name
 */
export function getAllImageToolConfigs() {
  return { ...IMAGE_TOOLS };
}

/**
 * Get user core cost for a tool
 * @param {string} tool - Tool name
 * @returns {number} Core credits needed, or 0 if unknown tool
 */
export function getImageToolCost(tool) {
  return IMAGE_TOOLS[tool]?.userCores || 0;
}

/**
 * Validate file type for a given tool
 * @param {string} tool - Tool name
 * @param {string} mimeType - File MIME type
 * @returns {boolean} Whether the file type is allowed
 */
export function isAllowedFileType(tool, mimeType) {
  const config = IMAGE_TOOLS[tool];
  if (!config) return false;
  return config.allowedTypes.includes(mimeType);
}

/**
 * Validate file size for a given tool
 * @param {string} tool - Tool name
 * @param {number} sizeBytes - File size in bytes
 * @returns {boolean} Whether the file size is within limits
 */
export function isAllowedFileSize(tool, sizeBytes) {
  const config = IMAGE_TOOLS[tool];
  if (!config) return false;
  return sizeBytes <= config.maxFileSizeMB * 1024 * 1024;
}
