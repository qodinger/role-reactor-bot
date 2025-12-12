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

      // Get level-up channel - prioritize configured channel
      let levelUpChannel = null;

      // First, try to use the configured level-up channel
      if (guildSettings.experienceSystem.levelUpChannel) {
        const configuredChannel = guild.channels.cache.get(
          guildSettings.experienceSystem.levelUpChannel,
        );

        // Verify the channel exists and bot can send messages
        if (configuredChannel) {
          const botMember = guild.members.me;
          const permissions = configuredChannel.permissionsFor(botMember);

          // Check if bot can actually send messages (not just has permission, but also not blocked)
          if (
            permissions &&
            permissions.has("SendMessages") &&
            permissions.has("ViewChannel") &&
            permissions.has("EmbedLinks") &&
            !configuredChannel.isThread()
          ) {
            // Additional check: verify channel type is text-based
            if (configuredChannel.isTextBased()) {
              levelUpChannel = configuredChannel;
              this.logger.debug(
                `Using configured level-up channel: ${configuredChannel.name} (${configuredChannel.id})`,
              );
            } else {
              this.logger.warn(
                `Configured level-up channel ${configuredChannel.name} (${configuredChannel.id}) is not a text-based channel. Type: ${configuredChannel.type}`,
              );
            }
          } else {
            // Detailed permission logging
            const missingPerms = [];
            if (!permissions) {
              missingPerms.push("No permission data available");
            } else {
              if (!permissions.has("SendMessages"))
                missingPerms.push("SendMessages");
              if (!permissions.has("ViewChannel"))
                missingPerms.push("ViewChannel");
              if (!permissions.has("EmbedLinks"))
                missingPerms.push("EmbedLinks");
            }

            this.logger.warn(
              `Configured level-up channel ${configuredChannel.name} (${configuredChannel.id}) exists but bot cannot send messages. Missing permissions: ${missingPerms.join(", ") || "Unknown"}`,
            );
          }
        } else {
          this.logger.warn(
            `Configured level-up channel ${guildSettings.experienceSystem.levelUpChannel} not found in guild ${guild.id}. Channel may have been deleted.`,
          );
        }
      }

      // If no configured channel or it's invalid, don't fall back to other channels
      // This ensures level-up messages only go to the configured channel
      if (!levelUpChannel) {
        this.logger.warn(
          `No valid level-up channel configured for guild ${guild.id}. Level-up messages will not be sent. Please configure a level-up channel using /xp level-up.`,
        );
        return;
      }

      // Create level-up embed
      const embed = this.createLevelUpEmbed(user, oldLevel, newLevel, totalXP);

      // Send level-up message
      try {
        await levelUpChannel.send({
          content: `🎉 **${user.displayName || user.username}** leveled up!`,
          embeds: [embed],
        });

        this.logger.info(
          `🎉 Sent level-up notification for user ${user.id} in guild ${guild.id} (Level ${oldLevel} → ${newLevel}) to channel ${levelUpChannel.name}`,
        );
      } catch (sendError) {
        // Enhanced error detection and logging
        const errorCode = sendError.code;
        const errorMessage = sendError.message || "Unknown error";

        // Check for specific Discord error codes
        if (
          errorCode === 50013 ||
          errorMessage.includes("Missing Permissions")
        ) {
          this.logger.error(
            `❌ Cannot send level-up message to channel ${levelUpChannel.name} (${levelUpChannel.id}) in guild ${guild.id} (${guild.name}). Bot is missing permissions or is blocked.`,
            {
              errorCode,
              errorMessage,
              channelId: levelUpChannel.id,
              channelName: levelUpChannel.name,
              guildId: guild.id,
              guildName: guild.name,
              userId: user.id,
              username: user.tag,
              level: newLevel,
            },
          );
        } else if (
          errorCode === 50001 ||
          errorMessage.includes("Missing Access")
        ) {
          this.logger.error(
            `❌ Cannot access level-up channel ${levelUpChannel.name} (${levelUpChannel.id}) in guild ${guild.id} (${guild.name}). Bot may be blocked from this channel or channel was deleted.`,
            {
              errorCode,
              errorMessage,
              channelId: levelUpChannel.id,
              channelName: levelUpChannel.name,
              guildId: guild.id,
              guildName: guild.name,
              userId: user.id,
              username: user.tag,
              level: newLevel,
            },
          );
        } else if (
          errorCode === 10007 ||
          errorMessage.includes("Unknown Channel")
        ) {
          this.logger.error(
            `❌ Level-up channel ${levelUpChannel.id} was deleted or no longer exists in guild ${guild.id} (${guild.name}). Please reconfigure the level-up channel using /xp level-up.`,
            {
              errorCode,
              errorMessage,
              channelId: levelUpChannel.id,
              guildId: guild.id,
              guildName: guild.name,
            },
          );
        } else {
          this.logger.error(
            `❌ Error sending level-up message to channel ${levelUpChannel.name} (${levelUpChannel.id}) in guild ${guild.id} (${guild.name}):`,
            {
              errorCode,
              errorMessage,
              errorStack: sendError.stack,
              channelId: levelUpChannel.id,
              channelName: levelUpChannel.name,
              guildId: guild.id,
              guildName: guild.name,
              userId: user.id,
              username: user.tag,
              level: newLevel,
            },
          );
        }
        // Don't re-throw - we've logged the error
      }
    } catch (error) {
      this.logger.error(
        `Error processing level-up notification for user ${user.id} in guild ${guild.id}:`,
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
