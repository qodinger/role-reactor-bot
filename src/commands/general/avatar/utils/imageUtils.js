import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Canvas-free image generation utilities
 * Uses PNG files from assets directory instead of Canvas for better compatibility
 */

/**
 * Create a static loading skeleton image for avatar generation
 * @returns {Buffer} PNG image buffer
 */
export function createLoadingSkeleton() {
  // Get the directory of the current file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Path to the generating.png file in assets directory
  const imagePath = join(__dirname, "../../../../../assets/generating.png");

  // Read the PNG file and return as Buffer
  return readFileSync(imagePath);
}

/**
 * Create a simple loading image using PNG file
 * @param {string} _text - Loading text to display (not used in PNG approach)
 * @param {number} _size - Image size (not used in PNG approach)
 * @returns {Buffer} Image buffer
 */
export function createSimpleLoadingImage(_text = "Loading...", _size = 512) {
  // Use the same PNG for all loading states
  return createLoadingSkeleton();
}

/**
 * Create a progress bar image using PNG file
 * @param {number} _progress - Progress percentage (0-100) (not used in PNG approach)
 * @param {string} _text - Text to display (not used in PNG approach)
 * @param {number} _width - Image width (not used in PNG approach)
 * @param {number} _height - Image height (not used in PNG approach)
 * @returns {Buffer} Image buffer
 */
export function createProgressImage(
  _progress = 50,
  _text = "Processing...",
  _width = 400,
  _height = 100,
) {
  // Use the same PNG for all loading states
  return createLoadingSkeleton();
}
