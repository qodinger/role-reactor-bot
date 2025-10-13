import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

/**
 * Progress tracking system for AI generation
 */
export class ProgressTracker {
  constructor(interaction, prompt) {
    this.interaction = interaction;
    this.prompt = prompt;
    this.startTime = Date.now();
    this.currentStep = 0;
    this.totalSteps = 6;
    this.isActive = true;
    this.updateInterval = null;
  }

  /**
   * Start progress tracking with real-time updates
   */
  async start() {
    this.updateInterval = setInterval(async () => {
      if (this.isActive) {
        await this.updateProgress();
      }
    }, 2000); // Update every 2 seconds
  }

  /**
   * Stop progress tracking
   */
  stop() {
    this.isActive = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update to next step
   */
  nextStep(stepName) {
    this.currentStep++;
    logger.debug(
      `Progress step ${this.currentStep}/${this.totalSteps}: ${stepName}`,
    );
  }

  /**
   * Get elapsed time
   */
  getElapsedTime() {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get current step description
   */
  getCurrentStepDescription() {
    const steps = [
      "Initializing AI service...",
      "Building enhanced prompt...",
      "Connecting to AI provider...",
      "Generating image (this may take 30-60s)...",
      "Processing image data...",
      "Finalizing result...",
    ];

    return steps[this.currentStep] || "Processing...";
  }

  /**
   * Update the Discord message with current progress
   */
  async updateProgress() {
    try {
      const progressEmbed = this.createProgressEmbed();
      await this.interaction.editReply({ embeds: [progressEmbed] });
    } catch (error) {
      logger.warn("Failed to update progress:", error);
    }
  }

  /**
   * Create progress embed
   */
  createProgressEmbed() {
    const elapsed = this.getElapsedTime();
    const stepDesc = this.getCurrentStepDescription();

    return {
      color: 0x5865f2, // Discord blurple
      title: "🎨 Generating Your Avatar...",
      description: `**"${this.prompt}"**\n\n${stepDesc}`,
      fields: [
        {
          name: "Time Elapsed",
          value: `${elapsed}s`,
          inline: true,
        },
        {
          name: "Status",
          value:
            this.currentStep < this.totalSteps
              ? "🔄 Processing..."
              : "✅ Complete!",
          inline: true,
        },
      ],
      footer: {
        text: "Avatar Generator • Powered by AI",
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create final success embed
   */
  createSuccessEmbed(_imageBuffer) {
    return {
      color: 0x00ff00, // Green
      title: "✨ Avatar Complete!",
      description: `**"${this.prompt}"**\n\n🎉 *Your unique anime avatar has been generated*`,
      image: {
        url: `attachment://ai-avatar-${this.interaction.user.id}-${Date.now()}.png`,
      },
      fields: [
        {
          name: "Generation Time",
          value: `${this.getElapsedTime()}s`,
          inline: true,
        },
        {
          name: "Status",
          value: "✅ Complete!",
          inline: true,
        },
      ],
      footer: {
        text: `Generated for ${this.interaction.user.username} • AI Avatar Generator`,
        icon_url: this.interaction.user.displayAvatarURL(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
