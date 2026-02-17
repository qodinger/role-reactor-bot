import { GlobalFonts, createCanvas, loadImage } from "@napi-rs/canvas";
import { getLogger } from "../../utils/logger.js";
import { EMOJIS, THEME } from "../../config/theme.js";

const logger = getLogger();

// Register fonts if needed (using system fonts for now)
// GlobalFonts.registerFromPath('./fonts/Inter-Bold.ttf', 'Inter');

/**
 * Rank Card Generator
 * Creates beautiful image cards for user levels using @napi-rs/canvas
 */
export class RankCardGenerator {
  constructor() {
    this.width = 930;
    this.height = 280;
    this.padding = 40;
  }

  /**
   * Generate a rank card image buffer
   * @param {Object} user - Discord user object
   * @param {Object} userData - User experience data (level, xp, totalXP)
   * @param {number} rank - User's rank position
   * @param {Object} options - Customization options (colors, bg, etc.)
   * @returns {Promise<Buffer>} PNG image buffer
   */
  async generate(user, userData, rank, options = {}) {
    const startTime = Date.now();

    try {
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d");

      // 1. Background
      await this.drawBackground(ctx, options);

      // 2. Avatar
      await this.drawAvatar(ctx, user);

      // 3. Progress Bar & Text
      this.drawProgress(ctx, userData, rank);

      // 4. Branding/Overlay
      this.drawOverlay(ctx);

      const buffer = await canvas.encode("png");

      logger.debug(
        `Generated rank card for ${user.tag} in ${Date.now() - startTime}ms`,
      );
      return buffer;
    } catch (error) {
      logger.error(`Failed to generate rank card for ${user.tag}:`, error);
      throw error;
    }
  }

  /**
   * Draw the background (customizable)
   */
  async drawBackground(ctx, options) {
    // Fill with dark theme color
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, this.width, this.height);

    // Add gradient glow
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, "#1a1a1a");
    gradient.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw some subtle geometric shapes (cyberpunk style)
    ctx.save();
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.width - 200, 0);
    ctx.lineTo(this.width, 200);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, this.height - 100);
    ctx.lineTo(200, this.height);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw the user's avatar with a frame
   */
  async drawAvatar(ctx, user) {
    const avatarUrl = user.displayAvatarURL({
      extension: "png",
      size: 256,
      forceStatic: true,
    });

    try {
      const avatarImage = await loadImage(avatarUrl);
      const size = 180;
      const x = this.padding + 10;
      const y = (this.height - size) / 2;
      const radius = size / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImage, x, y, size, size);
      ctx.restore();

      // Draw border
      ctx.beginPath();
      ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2, true);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#00f0ff"; // Cyan accent
      ctx.stroke();
      ctx.closePath();
    } catch (error) {
      logger.warn(
        "Failed to load avatar for rank card, using placeholder",
        error,
      );
      // Draw placeholder circle
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(this.padding + 100, this.height / 2, 90, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw progress bar and text stats
   */
  drawProgress(ctx, userData, rank) {
    // Calculate stats
    const currentLevel = userData.level || 0;
    const currentXP = userData.xp || 0; // Usage of 'xp' field which is usually current level XP in some systems,
    // but let's re-calculate based on totalXP if needed.
    // Actually ExperienceManager likely passes calculated 'currentXP' and 'requiredXP'.

    // We need xpForNextLevel. Let's assume userData has it or we calculate it.
    // For now, let's use a simple calculation matching ExperienceManager
    const xpForCurrentLevel = Math.floor(100 * Math.pow(currentLevel, 1.5));
    const xpForNextLevel = Math.floor(100 * Math.pow(currentLevel + 1, 1.5));
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    const xpIntoLevel = userData.totalXP - xpForCurrentLevel;

    // Clamp progress
    const progress = Math.min(Math.max(xpIntoLevel / xpNeeded, 0), 1);

    const x = 260; // Start after avatar
    const y = 180;
    const barWidth = 600;
    const barHeight = 30;

    // Draw Bar Background
    ctx.fillStyle = "#333333";
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 15);
    ctx.fill();

    // Draw Progress Fill
    const gradient = ctx.createLinearGradient(x, 0, x + barWidth, 0);
    gradient.addColorStop(0, "#00f0ff"); // Cyan
    gradient.addColorStop(1, "#7000ff"); // Purple
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth * progress, barHeight, 15);
    ctx.fill();

    // Text: Username
    ctx.font = "bold 40px Sans-Serif"; // Fallback to sans-serif
    ctx.fillStyle = "#ffffff";
    // Prefer username from Discord user object, fallback to stored data
    const displayName = user.username || userData.username || "User";
    ctx.fillText(displayName, x, 80);

    // Text: Rank & Level
    ctx.font = "30px Sans-Serif";
    ctx.fillStyle = "#aaaaaa";
    const rankText = `RANK #${rank}`;
    const levelText = `LEVEL ${currentLevel}`;

    ctx.fillText(rankText, x, 130);

    // Level text aligned right
    const levelWidth = ctx.measureText(levelText).width;
    ctx.fillStyle = "#00f0ff";
    ctx.fillText(levelText, x + barWidth - levelWidth, 80); // Top right

    // XP Text (Current / Next)
    const xpText = `${Math.floor(xpIntoLevel).toLocaleString()} / ${Math.floor(xpNeeded).toLocaleString()} XP`;
    ctx.font = "20px Sans-Serif";
    ctx.fillStyle = "#ffffff";
    const xpWidth = ctx.measureText(xpText).width;
    ctx.fillText(xpText, x + barWidth - xpWidth, 130); // Above bar, right aligned
  }

  drawOverlay(ctx) {
    // Add shine effect
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}

// Singleton
let instance = null;
export function getRankCardGenerator() {
  if (!instance) {
    instance = new RankCardGenerator();
  }
  return instance;
}
