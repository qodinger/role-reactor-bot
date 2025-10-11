import { getLogger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../config/theme.js";

/**
 * Level Up Notification System
 * Handles sending level-up messages to users
 */
class LevelUpNotifier {
  constructor() {
    this.logger = getLogger();
    this.dbManager = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.dbManager = await getDatabaseManager();
    this.isInitialized = true;
    this.logger.info("🎉 Level Up Notifier initialized");
  }

  /**
   * Send level-up notification to user
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').User} user - Discord user
   * @param {number} oldLevel - Previous level
   * @param {number} newLevel - New level
   * @param {number} totalXP - Total XP
   */
  async sendLevelUpNotification(guild, user, oldLevel, newLevel, totalXP) {
    await this.initialize();

    try {
      // Check if level-up messages are enabled for this guild
      const guildSettings = await this.dbManager.guildSettings.getByGuild(
        guild.id,
      );
      if (
        !guildSettings.experienceSystem.enabled ||
        !guildSettings.experienceSystem.levelUpMessages
      ) {
        return;
      }

      // Get level-up channel (default to system channel or first text channel)
      let levelUpChannel = guild.systemChannel;
      if (guildSettings.experienceSystem.levelUpChannel) {
        levelUpChannel = guild.channels.cache.get(
          guildSettings.experienceSystem.levelUpChannel,
        );
      }

      if (!levelUpChannel) {
        levelUpChannel = guild.channels.cache.find(
          channel =>
            channel.type === 0 &&
            channel.permissionsFor(guild.members.me).has("SendMessages"),
        );
      }

      if (!levelUpChannel) {
        this.logger.warn(
          `No suitable channel found for level-up message in guild ${guild.id}`,
        );
        return;
      }

      // Create level-up embed
      const embed = this.createLevelUpEmbed(user, oldLevel, newLevel, totalXP);

      // Send level-up message
      await levelUpChannel.send({
        content: `🎉 **${user.displayName || user.username}** leveled up!`,
        embeds: [embed],
      });

      this.logger.info(
        `🎉 Sent level-up notification for user ${user.id} in guild ${guild.id} (Level ${oldLevel} → ${newLevel})`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending level-up notification for user ${user.id}:`,
        error,
      );
    }
  }

  /**
   * Create level-up embed
   * @param {import('discord.js').User} user - Discord user
   * @param {number} oldLevel - Previous level
   * @param {number} newLevel - New level
   * @param {number} totalXP - Total XP
   * @returns {import('discord.js').EmbedBuilder}
   */
  createLevelUpEmbed(user, oldLevel, newLevel, totalXP) {
    const progress = this.calculateProgress(totalXP, newLevel);
    const nextLevelXP = this.calculateXPForLevel(newLevel + 1);
    const xpNeeded = nextLevelXP - totalXP;

    return new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`🎉 Level Up!`)
      .setDescription(
        `**${user.displayName || user.username}** reached level **${newLevel}**!`,
      )
      .addFields([
        {
          name: `${EMOJIS.STATUS.INFO} Level Progress`,
          value: `**${oldLevel}** → **${newLevel}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.EXPERIENCE} Total XP`,
          value: `**${totalXP.toLocaleString()}** XP`,
          inline: true,
        },
        {
          name: `${EMOJIS.TIME.ALARM} Next Level`,
          value: `**${xpNeeded.toLocaleString()}** XP to go`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.PROGRESS} Progress Bar`,
          value: this.createProgressBar(progress),
          inline: false,
        },
      ])
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: `Keep chatting to earn more XP!`,
        iconURL: user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();
  }

  /**
   * Calculate XP progress to next level
   * @param {number} totalXP - Total XP
   * @param {number} currentLevel - Current level
   * @returns {number} Progress percentage
   */
  calculateProgress(totalXP, currentLevel) {
    const currentLevelXP = this.calculateXPForLevel(currentLevel);
    const nextLevelXP = this.calculateXPForLevel(currentLevel + 1);
    const xpInCurrentLevel = totalXP - currentLevelXP;
    const xpNeededForNextLevel = nextLevelXP - currentLevelXP;

    return Math.min(
      100,
      Math.max(0, (xpInCurrentLevel / xpNeededForNextLevel) * 100),
    );
  }

  /**
   * Calculate XP needed for a specific level
   * @param {number} level - The level to calculate XP for
   * @returns {number} XP required for that level
   */
  calculateXPForLevel(level) {
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  /**
   * Create a visual progress bar
   * @param {number} progress - Progress percentage (0-100)
   * @returns {string} Progress bar string
   */
  createProgressBar(progress) {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;

    return `\`${"█".repeat(filled)}${"░".repeat(empty)}\` ${progress.toFixed(1)}%`;
  }

  /**
   * Get level-up message configuration for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {object} Level-up configuration
   */
  async getLevelUpConfig(guildId) {
    await this.initialize();

    const guildSettings =
      await this.dbManager.guildSettings.getByGuild(guildId);
    return {
      enabled: guildSettings.experienceSystem.levelUpMessages || false,
      channel: guildSettings.experienceSystem.levelUpChannel || null,
    };
  }

  /**
   * Update level-up message configuration for a guild
   * @param {string} guildId - Discord guild ID
   * @param {object} config - New configuration
   */
  async updateLevelUpConfig(guildId, config) {
    await this.initialize();

    const guildSettings =
      await this.dbManager.guildSettings.getByGuild(guildId);
    guildSettings.experienceSystem.levelUpMessages = config.enabled;
    guildSettings.experienceSystem.levelUpChannel = config.channel;

    await this.dbManager.guildSettings.updateByGuild(guildId, guildSettings);
  }
}

let levelUpNotifier = null;

export async function getLevelUpNotifier() {
  if (!levelUpNotifier) {
    levelUpNotifier = new LevelUpNotifier();
    await levelUpNotifier.initialize();
  }
  return levelUpNotifier;
}
