import { getLogger } from "../logger.js";
import { getDatabaseManager } from "../storage/databaseManager.js";

/**
 * Supporter Webhook Handler
 *
 * This module handles webhooks from donation platforms to automatically
 * assign supporter roles to users who donate.
 *
 * Supported platforms:
 * - GitHub Sponsors
 * - Ko-fi
 * - Buy Me a Coffee
 * - Custom webhooks
 */

class SupporterWebhookHandler {
  constructor() {
    this.logger = getLogger();
  }

  /**
   * Handle webhook from donation platform
   * @param {Object} webhookData - Webhook payload
   * @param {string} platform - Platform name (github, kofi, bmac, custom)
   * @returns {Promise<boolean>} Success status
   */
  async handleWebhook(webhookData, platform) {
    try {
      this.logger.info(
        `Processing ${platform} webhook for supporter role assignment`,
      );

      switch (platform) {
        case "github":
          return await this.handleGitHubWebhook(webhookData);
        case "kofi":
          return await this.handleKoFiWebhook(webhookData);
        case "bmac":
          return await this.handleBuyMeACoffeeWebhook(webhookData);
        case "custom":
          return await this.handleCustomWebhook(webhookData);
        default:
          this.logger.warn(`Unsupported webhook platform: ${platform}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Error handling ${platform} webhook`, error);
      return false;
    }
  }

  /**
   * Handle GitHub Sponsors webhook
   * @param {Object} webhookData - GitHub webhook payload
   */
  async handleGitHubWebhook(webhookData) {
    try {
      // GitHub Sponsors webhook structure
      const { action, sponsorship } = webhookData;

      if (action !== "created" && action !== "tier_changed") {
        this.logger.debug(
          `GitHub webhook action ${action} not relevant for supporter role`,
        );
        return true;
      }

      const sponsor = sponsorship.sponsor;
      const tier = sponsorship.tier;

      // Extract Discord user ID from sponsor metadata
      const discordUserId = await this.extractDiscordUserId(sponsor);
      if (!discordUserId) {
        this.logger.warn(
          `No Discord user ID found for GitHub sponsor: ${sponsor.login}`,
        );
        return false;
      }

      // Assign supporter role based on tier
      const success = await this.assignSupporterRole(discordUserId, {
        platform: "GitHub Sponsors",
        tier: tier.name,
        amount: tier.monthly_price_in_cents / 100,
        sponsor: sponsor.login,
        action,
      });

      return success;
    } catch (error) {
      this.logger.error("Error handling GitHub webhook", error);
      return false;
    }
  }

  /**
   * Handle Ko-fi webhook
   * @param {Object} webhookData - Ko-fi webhook payload
   */
  async handleKoFiWebhook(webhookData) {
    try {
      const { type, data } = webhookData;

      if (type !== "Donation") {
        this.logger.debug(
          `Ko-fi webhook type ${type} not relevant for supporter role`,
        );
        return true;
      }

      const { message, amount, fromName, fromEmail } = data;

      // Extract Discord user ID from message or email
      const discordUserId = await this.extractDiscordUserIdFromMessage(
        message,
        fromEmail,
      );
      if (!discordUserId) {
        this.logger.warn(
          `No Discord user ID found for Ko-fi donation from: ${fromName}`,
        );
        return false;
      }

      // Assign supporter role
      const success = await this.assignSupporterRole(discordUserId, {
        platform: "Ko-fi",
        tier: "Supporter",
        amount,
        sponsor: fromName,
        action: "donation",
      });

      return success;
    } catch (error) {
      this.logger.error("Error handling Ko-fi webhook", error);
      return false;
    }
  }

  /**
   * Handle Buy Me a Coffee webhook
   * @param {Object} webhookData - Buy Me a Coffee webhook payload
   */
  async handleBuyMeACoffeeWebhook(webhookData) {
    try {
      const { type, data } = webhookData;

      if (type !== "donation") {
        this.logger.debug(
          `Buy Me a Coffee webhook type ${type} not relevant for supporter role`,
        );
        return true;
      }

      const { supporter, amount, message } = data;

      // Extract Discord user ID from message or supporter data
      const discordUserId = await this.extractDiscordUserIdFromMessage(
        message,
        supporter.email,
      );
      if (!discordUserId) {
        this.logger.warn(
          `No Discord user ID found for Buy Me a Coffee donation from: ${supporter.name}`,
        );
        return false;
      }

      // Assign supporter role
      const success = await this.assignSupporterRole(discordUserId, {
        platform: "Buy Me a Coffee",
        tier: "Supporter",
        amount,
        sponsor: supporter.name,
        action: "donation",
      });

      return success;
    } catch (error) {
      this.logger.error("Error handling Buy Me a Coffee webhook", error);
      return false;
    }
  }

  /**
   * Handle custom webhook
   * @param {Object} webhookData - Custom webhook payload
   */
  async handleCustomWebhook(webhookData) {
    try {
      const { discordUserId, platform, tier, amount, sponsor, action } =
        webhookData;

      if (!discordUserId) {
        this.logger.warn("Custom webhook missing discordUserId");
        return false;
      }

      // Assign supporter role
      const success = await this.assignSupporterRole(discordUserId, {
        platform: platform || "Custom",
        tier: tier || "Supporter",
        amount: amount || 0,
        sponsor: sponsor || "Unknown",
        action: action || "webhook",
      });

      return success;
    } catch (error) {
      this.logger.error("Error handling custom webhook", error);
      return false;
    }
  }

  /**
   * Extract Discord user ID from various sources
   * @param {Object} sponsor - Sponsor/user data
   * @returns {Promise<string|null>} Discord user ID or null
   */
  async extractDiscordUserId(sponsor) {
    try {
      // Check if Discord ID is stored in sponsor metadata
      if (sponsor.metadata && sponsor.metadata.discord_id) {
        return sponsor.metadata.discord_id;
      }

      // Check if Discord username is stored
      if (sponsor.metadata && sponsor.metadata.discord_username) {
        // You could implement Discord username lookup here
        // For now, return null to indicate manual assignment needed
        return null;
      }

      // Check bio/description for Discord information
      if (sponsor.bio && sponsor.bio.includes("Discord:")) {
        const discordMatch = sponsor.bio.match(/Discord:\s*(\d{17,19})/);
        if (discordMatch) {
          return discordMatch[1];
        }
      }

      return null;
    } catch (error) {
      this.logger.error("Error extracting Discord user ID", error);
      return null;
    }
  }

  /**
   * Extract Discord user ID from donation message or email
   * @param {string} message - Donation message
   * @param {string} _email - Donor email
   * @returns {Promise<string|null>} Discord user ID or null
   */
  async extractDiscordUserIdFromMessage(message, _email) {
    try {
      // Check message for Discord ID
      if (message) {
        const discordMatch = message.match(
          /(?:Discord|Discord ID|Discord User):\s*(\d{17,19})/i,
        );
        if (discordMatch) {
          return discordMatch[1];
        }
      }

      // Check if email is linked to Discord account in your database
      // This would require implementing email-to-discord mapping
      if (_email) {
        const discordUserId = await this.lookupDiscordByEmail(_email);
        if (discordUserId) {
          return discordUserId;
        }
      }

      return null;
    } catch (error) {
      this.logger.error("Error extracting Discord user ID from message", error);
      return null;
    }
  }

  /**
   * Lookup Discord user ID by email (placeholder for future implementation)
   * @param {string} _email - Email address
   * @returns {Promise<string|null>} Discord user ID or null
   */
  async lookupDiscordByEmail(_email) {
    // TODO: Implement email-to-discord mapping
    // This could be done by:
    // 1. Storing user email when they link their Discord account
    // 2. Using a third-party service
    // 3. Manual mapping in database
    return null;
  }

  /**
   * Assign supporter role to user
   * @param {string} discordUserId - Discord user ID
   * @param {Object} donationInfo - Donation information
   * @returns {Promise<boolean>} Success status
   */
  async assignSupporterRole(discordUserId, donationInfo) {
    try {
      const dbManager = await getDatabaseManager();

      // Get all guilds where this user is a member
      const guilds = await this.getUserGuilds(discordUserId);

      let successCount = 0;

      for (const guild of guilds) {
        try {
          const settings = await dbManager.guildSettings.getByGuild(guild.id);

          if (!settings.supporterSystem?.enabled) {
            this.logger.debug(
              `Supporter system not enabled in guild: ${guild.name}`,
            );
            continue;
          }

          const supporterRole = guild.roles.cache.get(
            settings.supporterSystem.roleId,
          );
          if (!supporterRole) {
            this.logger.warn(
              `Supporter role not found in guild: ${guild.name}`,
            );
            continue;
          }

          const member = await guild.members.fetch(discordUserId);
          if (!member) {
            this.logger.debug(
              `User ${discordUserId} not found in guild: ${guild.name}`,
            );
            continue;
          }

          // Check if user already has the role
          if (member.roles.cache.has(supporterRole.id)) {
            this.logger.debug(
              `User ${discordUserId} already has supporter role in guild: ${guild.name}`,
            );
            continue;
          }

          // Add the role
          await member.roles.add(
            supporterRole,
            `Automatic assignment via ${donationInfo.platform} webhook`,
          );

          // Save supporter record
          await dbManager.temporaryRoles.addSupporter(
            guild.id,
            discordUserId,
            supporterRole.id,
            new Date(),
            `Automatic assignment via ${donationInfo.platform} webhook - ${donationInfo.tier}`,
          );

          // Log the action
          await this.logSupporterAction(
            guild,
            settings.supporterSystem.logChannelId,
            {
              action: "ADDED",
              user: member.user,
              role: supporterRole,
              platform: donationInfo.platform,
              tier: donationInfo.tier,
              amount: donationInfo.amount,
              sponsor: donationInfo.sponsor,
            },
          );

          successCount++;
          this.logger.info(
            `Successfully assigned supporter role to ${member.user.tag} in ${guild.name}`,
          );
        } catch (error) {
          this.logger.error(
            `Error assigning supporter role in guild ${guild.name}`,
            error,
          );
        }
      }

      return successCount > 0;
    } catch (error) {
      this.logger.error("Error assigning supporter role", error);
      return false;
    }
  }

  /**
   * Get all guilds where a user is a member
   * @param {string} _userId - Discord user ID
   * @returns {Promise<Array>} Array of guilds
   */
  async getUserGuilds(_userId) {
    // This is a placeholder - you'll need to implement this based on your bot's architecture
    // Options:
    // 1. Store guild memberships in database
    // 2. Use Discord API to fetch user's guilds (requires OAuth2)
    // 3. Check only guilds where your bot is present

    // For now, return empty array - implement based on your needs
    return [];
  }

  /**
   * Log supporter action to configured log channel
   * @param {Guild} guild - Discord guild
   * @param {string} logChannelId - Log channel ID
   * @param {Object} data - Action data
   */
  async logSupporterAction(guild, logChannelId, data) {
    if (!logChannelId) return;

    try {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const { EmbedBuilder } = await import("discord.js");

      const color = data.action === "ADDED" ? 0x00ff00 : 0xff0000;
      const actionText = data.action === "ADDED" ? "Added" : "Removed";

      const logEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`🏷️ Supporter Role ${actionText} (Auto)`)
        .setDescription(
          `${data.user} has had their supporter role ${actionText.toLowerCase()} automatically`,
        )
        .addFields(
          {
            name: "👤 User",
            value: `${data.user.tag} (${data.user.id})`,
            inline: true,
          },
          { name: "🏷️ Role", value: `${data.role}`, inline: true },
          {
            name: "🌐 Platform",
            value: data.platform || "Unknown",
            inline: true,
          },
          { name: "💎 Tier", value: data.tier || "Unknown", inline: true },
          {
            name: "💰 Amount",
            value: data.amount ? `$${data.amount}` : "Unknown",
            inline: true,
          },
          {
            name: "📝 Sponsor",
            value: data.sponsor || "Unknown",
            inline: true,
          },
        )
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      this.logger.error("Error logging supporter action", error);
    }
  }
}

// Export singleton instance
let webhookHandler = null;

export function getSupporterWebhookHandler() {
  if (!webhookHandler) {
    webhookHandler = new SupporterWebhookHandler();
  }
  return webhookHandler;
}

export default SupporterWebhookHandler;
