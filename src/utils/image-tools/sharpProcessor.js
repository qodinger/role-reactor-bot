/**
 * Sharp-based image processing utilities
 * Local processing for resize, compress, convert operations
 */

import sharp from "sharp";

/**
 * Build output filename based on tool and options
 * @param {string} originalFilename
 * @param {string} tool
 * @param {Object} options
 * @returns {string} Output filename
 */
function buildOutputFilename(originalFilename, tool, options = {}) {
  const base = originalFilename.replace(/\.[^.]+$/, "");
  const ext = originalFilename.split(".").pop()?.toLowerCase() || "jpg";

  switch (tool) {
    case "resize": {
      const suffix = options.width
        ? `${options.width}x${options.height || "auto"}`
        : `${options.percentage || 50}pct`;
      return `${base}_resized_${suffix}.${ext}`;
    }
    case "compress":
      return `${base}_compressed.${ext}`;
    case "convert": {
      const targetFormat = options.to || "jpg";
      return `${base}.${targetFormat}`;
    }
    default:
      return originalFilename;
  }
}

/**
 * Resize an image using Sharp
 * @param {Buffer} inputBuffer - Input image buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Resize options
 * @param {number} [options.width] - Target width
 * @param {number} [options.height] - Target height
 * @param {number} [options.percentage] - Scale by percentage
 * @param {boolean} [options.maintainRatio=true] - Maintain aspect ratio
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string }>}
 */
export async function resizeImage(inputBuffer, filename, options = {}) {
  const { width, height, percentage, maintainRatio = true } = options;

  let pipeline = sharp(inputBuffer);

  if (percentage) {
    const metadata = await sharp(inputBuffer).metadata();
    const scale = percentage / 100;
    pipeline = pipeline.resize({
      width: Math.round(metadata.width * scale),
      height: Math.round(metadata.height * scale),
      fit: maintainRatio ? "inside" : "fill",
    });
  } else if (width || height) {
    pipeline = pipeline.resize({
      width,
      height,
      fit: maintainRatio ? "inside" : "fill",
    });
  }

  const buffer = await pipeline.toBuffer();
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";

  return {
    buffer,
    filename: buildOutputFilename(filename, "resize", options),
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
  };
}

/**
 * Compress an image using Sharp
 * @param {Buffer} inputBuffer - Input image buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Compression options
 * @param {string} [options.level=recommended] - Compression level (low, recommended, extreme)
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string }>}
 */
export async function compressImage(inputBuffer, filename, options = {}) {
  const { level = "recommended" } = options;
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";

  const qualityMap = {
    low: 90,
    recommended: 75,
    extreme: 50,
  };

  const quality = qualityMap[level] || 75;
  let pipeline = sharp(inputBuffer);

  let outputExt = ext;
  let contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

  if (ext === "png") {
    // Sharp's PNG compression (0-9). Higher level = smaller file but slower.
    const pngLevel = level === "extreme" ? 9 : level === "recommended" ? 7 : 4;
    pipeline = pipeline.png({ compressionLevel: pngLevel, palette: true });
  } else if (ext === "webp") {
    pipeline = pipeline.webp({ quality });
  } else if (ext === "gif") {
    // Sharp gif output is very basic, but we pass it through
    pipeline = pipeline.gif();
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    outputExt = "jpg";
    contentType = "image/jpeg";
  }

  const buffer = await pipeline.toBuffer();

  // Custom filename since we might have forced a format
  const base = filename.replace(/\.[^.]+$/, "");
  const outputFilename = `${base}_compressed.${outputExt}`;

  return {
    buffer,
    filename: outputFilename,
    contentType,
  };
}

/**
 * Convert an image to a different format using Sharp
 * @param {Buffer} inputBuffer - Input image buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Conversion options
 * @param {string} [options.to=jpg] - Target format (jpg, png, gif, webp)
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string }>}
 */
export async function convertImage(inputBuffer, filename, options = {}) {
  const { to = "jpg" } = options;

  const formatMap = {
    jpg: "jpeg",
    jpeg: "jpeg",
    png: "png",
    gif: "gif",
    webp: "webp",
  };

  const format = formatMap[to.toLowerCase()] || "jpeg";

  let pipeline = sharp(inputBuffer);

  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: 85 });
      break;
    case "png":
      pipeline = pipeline.png({ compressionLevel: 6 });
      break;
    case "gif":
      pipeline = pipeline.gif();
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: 85 });
      break;
    default:
      pipeline = pipeline.jpeg({ quality: 85 });
  }

  const buffer = await pipeline.toBuffer();

  return {
    buffer,
    filename: buildOutputFilename(filename, "convert", options),
    contentType: `image/${format === "jpeg" ? "jpeg" : format}`,
  };
}

/**
 * Get image metadata using Sharp
 * @param {Buffer} inputBuffer - Input image buffer
 * @returns {Promise<Object>} Image metadata
 */
export async function getImageMetadata(inputBuffer) {
  const metadata = await sharp(inputBuffer).metadata();

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: inputBuffer.length,
    hasAlpha: metadata.hasAlpha,
  };
}
