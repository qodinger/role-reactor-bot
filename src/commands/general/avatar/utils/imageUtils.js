import { createCanvas } from "canvas";

// Removed background cache for simplicity - performance impact is minimal

/**
 * Create a static loading skeleton image for avatar generation
 * @returns {Buffer} PNG image buffer
 */
export function createLoadingSkeleton() {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext("2d");

  // Create vertical gradient background with cool Tokyo Midnight theme
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#1e1e2e"); // Dark navy (top)
  gradient.addColorStop(0.3, "#2d2d3d"); // Darker navy (middle-top)
  gradient.addColorStop(0.7, "#2d3d4d"); // Dark blue-gray (middle-bottom)
  gradient.addColorStop(1, "#1e2e3e"); // Deep cool blue (bottom)

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Add loading text with cool Tokyo Midnight neon accent
  ctx.fillStyle = "#00d4ff"; // Cool cyan neon accent
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Generating...", 256, 256);

  return canvas.toBuffer("image/png");
}
