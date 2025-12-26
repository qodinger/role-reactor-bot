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
 * @param {string} aspectRatio - Aspect ratio string (e.g., "16:9", "1:1", "3:2")
 * @returns {[number, number]} [width, height]
 */
export function parseAspectRatio(aspectRatio) {
  // Common aspect ratios mapped to 512/768/1024 base sizes
  const ratioMap = {
    "1:1": [512, 512],
    "16:9": [768, 432],
    "9:16": [432, 768],
    "4:3": [640, 480],
    "3:4": [480, 640],
    "3:2": [768, 512],
    "2:3": [512, 768],
  };

  if (ratioMap[aspectRatio]) {
    return ratioMap[aspectRatio];
  }

  // Parse custom ratio (e.g., "16:9")
  const parts = aspectRatio.split(":");
  if (parts.length === 2) {
    const width = parseInt(parts[0], 10);
    const height = parseInt(parts[1], 10);
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      // Scale to reasonable size (base 512)
      const scale = 512 / Math.max(width, height);
      return [Math.round(width * scale), Math.round(height * scale)];
    }
  }

  // Default to 1:1
  return [512, 512];
}
