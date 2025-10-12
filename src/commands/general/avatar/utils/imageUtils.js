import { createCanvas } from "canvas";

/**
 * Create a loading skeleton image for avatar generation
 * @returns {Buffer} PNG image buffer
 */
export function createLoadingSkeleton() {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext("2d");

  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(0.5, "#16213e");
  gradient.addColorStop(1, "#0f3460");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Add animated loading effect (static for now, but creates a nice skeleton)
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";

  // Add shimmer effect
  const shimmerGradient = ctx.createLinearGradient(0, 0, 512, 0);
  shimmerGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  shimmerGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
  shimmerGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = shimmerGradient;
  ctx.fillRect(0, 0, 512, 512);

  // Add loading text
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Generating...", 256, 256);

  return canvas.toBuffer("image/png");
}
