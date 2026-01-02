/**
 * Shared utility functions for AI providers
 */

const fetch = globalThis.fetch;

/**
 * Make an API request with error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function makeApiRequest(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`API error: ${response.status} - ${errorMessage}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Create common headers for API requests
 * @param {string} apiKey - API key for authentication
 * @param {string} provider - Provider name for custom headers
 * @returns {Object} Headers object
 */
export function createHeaders(apiKey, provider = "openrouter") {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.BOT_WEBSITE_URL || "https://rolereactor.app";
    headers["X-Title"] = process.env.BOT_NAME || "Role Reactor Bot";
  }

  return headers;
}

/**
 * Extract image URL from API response
 * @param {Object} data - API response data
 * @returns {string|null} Image URL or null if not found
 */
export function extractImageUrl(data) {
  // Check for standard image generation response format
  if (data.choices?.[0]?.message?.images?.[0]) {
    const image = data.choices[0].message.images[0];
    return image.image_url?.url || image.url || image.data;
  }

  // Check for content-based image response
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    if (content.startsWith("data:image/")) {
      return content;
    }
    if (/^[A-Za-z0-9+/=]+$/.test(content)) {
      return `data:image/png;base64,${content}`;
    }
    if (content.startsWith("http://") || content.startsWith("https://")) {
      return content;
    }
  }

  // Check for parts-based response (Gemini format)
  const parts =
    data.choices?.[0]?.message?.content?.parts ||
    data.candidates?.[0]?.content?.parts;
  if (parts) {
    const imagePart = parts.find(part => part.inline_data || part.url);
    if (imagePart) {
      return imagePart.url || imagePart.inline_data?.data;
    }
  }

  // Check for direct image response
  if (data.images?.[0]) {
    return data.images[0].url || data.images[0].data;
  }

  return null;
}

/**
 * Parse aspect ratio string to width and height
 * Uses the most commonly used sizes for each aspect ratio
 * (dimensions are multiples of 64 for Stable Diffusion efficiency when possible)
 * @param {string} aspectRatio - Aspect ratio string (e.g., "16:9", "1:1", "3:2")
 * @returns {[number, number]} [width, height]
 */
export function parseAspectRatio(aspectRatio) {
  // Optimal base sizes for 2-stage workflow (base -> upscale to 1024)
  // Using 832 as base allows faster generation, then upscales to 1024
  // All sizes are multiples of 64 (SDXL requirement) and optimized for speed + quality
  const ratioMap = {
    "1:1": [832, 832], // Base size, upscales to 1024x1024 (faster generation)
    "16:9": [1088, 640], // Base 16:9, upscales to ~1337x752
    "9:16": [640, 1088], // Base 9:16, upscales to ~787x1338
    "4:3": [960, 704], // Base 4:3, upscales to ~1180x866
    "3:4": [704, 960], // Base 3:4, upscales to ~866x1180
    "3:2": [960, 640], // Base 3:2, upscales to ~1180x787
    "2:3": [640, 960], // Base 2:3, upscales to ~787x1180
  };

  if (ratioMap[aspectRatio]) {
    return ratioMap[aspectRatio];
  }

  // Parse custom ratio
  const parts = aspectRatio.split(":");
  if (parts.length === 2) {
    const width = parseInt(parts[0], 10);
    const height = parseInt(parts[1], 10);
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      // Scale to base size (~690K pixels, similar to 832×832)
      // Target total pixels around 692,224 (832²) for faster generation
      const targetPixels = 832 * 832;
      const aspectRatioValue = width / height;
      let scaledHeight = Math.sqrt(targetPixels / aspectRatioValue);
      let scaledWidth = scaledHeight * aspectRatioValue;

      // Round to nearest multiple of 64 for SD efficiency
      scaledWidth = Math.round(scaledWidth / 64) * 64;
      scaledHeight = Math.round(scaledHeight / 64) * 64;

      // Ensure minimum 768 (reasonable minimum for quality)
      if (scaledWidth < 768) {
        scaledHeight = 768 / aspectRatioValue;
        scaledWidth = 768;
        scaledHeight = Math.round(scaledHeight / 64) * 64;
      }
      if (scaledHeight < 768) {
        scaledWidth = 768 * aspectRatioValue;
        scaledHeight = 768;
        scaledWidth = Math.round(scaledWidth / 64) * 64;
      }

      return [scaledWidth, scaledHeight];
    }
  }

  // Default to 1:1 (832x832 base - upscales to 1024x1024)
  return [832, 832];
}
