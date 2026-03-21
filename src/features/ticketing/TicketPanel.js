import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getPremiumManager } from "../premium/PremiumManager.js";
import { getLogger } from "../../utils/logger.js";
import { FREE_TIER, PRO_ENGINE, DEFAULT_CATEGORY } from "./config.js";
import {
  createPanelEmbed,
  createPanelButtons,
  createSuccessEmbed,
  createErrorEmbed,
  createLimitReachedEmbed,
} from "./embeds.js";

const logger = getLogger();

/**
 * TicketPanel - Manage ticket panels
 */
export class TicketPanel {
  constructor() {
    this.storage = null;
    this.premiumManager = null;
    this._initialized = false;
  }

  /**
   * Initialize panel manager
   */
  async initialize() {
    if (this._initialized) return;
    this.storage = await getStorageManager();
    this.premiumManager = getPremiumManager();
    this._initialized = true;
    logger.info("🎫 TicketPanel initialized");
  }

  /**
   * Create a new ticket panel
   * @param {Object} options - Panel options
   * @returns {Promise<Object>} Result
   */
  async createPanel(options) {
    try {
      const {
        guildId,
        channelId,
        title,
        description,
        categories = [DEFAULT_CATEGORY],
        settings = {},
        styling = {},
      } = options;

      // Check panel limit
      const panelLimit = await this.checkPanelLimit(guildId);
      if (panelLimit.hasReachedLimit) {
        return {
          success: false,
          error: createLimitReachedEmbed({
            type: "panel",
            current: panelLimit.current,
            max: panelLimit.max,
            isPro: panelLimit.isPro,
          }),
        };
      }

      // Check category limit
      const isPro = await this.premiumManager.isFeatureActive(
        guildId,
        "pro_engine",
      );
      const maxCategories = isPro
        ? PRO_ENGINE.MAX_CATEGORIES
        : FREE_TIER.MAX_CATEGORIES;

      if (categories.length > maxCategories) {
        return {
          success: false,
          error: createErrorEmbed(
            `Maximum ${maxCategories} categories allowed.${!isPro ? " Upgrade to **Pro Engine ✨** for more! Enable it on our **[website](https://rolereactor.app)** using Cores." : ""}`,
          ),
        };
      }

      // Generate panel ID
      const panelNumber =
        await this.storage.dbManager.guildSettings.incrementCounter(
          guildId,
          "counters.panel",
        );
      const panelId = `PNL-${guildId}-${panelNumber.toString().padStart(3, "0")}`;

      // Create panel in database
      const panel = await this.storage.createTicketPanel({
        panelId,
        guildId,
        channelId,
        title,
        description,
        categories,
        settings: {
          ...settings,
          enabled: true,
        },
        styling: {
          color: styling.color || 0x5865f2,
          footer: isPro
            ? styling.footer || null
            : "Powered by Role Reactor Bot",
          proBranding: isPro,
        },
      });

      if (!panel) {
        return {
          success: false,
          error: createErrorEmbed("Failed to create panel in database"),
        };
      }

      logger.info(`Ticket panel created: ${panelId} for guild ${guildId}`);

      return {
        success: true,
        panel,
        message: createSuccessEmbed(
          `Ticket panel created successfully!\n\n**Panel ID:** \`${panelId}\``,
        ),
      };
    } catch (error) {
      logger.error("Failed to create panel:", error);
      return {
        success: false,
        error: createErrorEmbed(`Failed to create panel: ${error.message}`),
      };
    }
  }

  /**
   * Send panel message to channel
   * @param {Object} options - Send options
   * @returns {Promise<Object>} Result
   */
  async sendPanelMessage(options) {
    try {
      const { channel, panel } = options;

      // Create embed
      const embed = createPanelEmbed({
        title: panel.title,
        description: panel.description,
        color: panel.styling?.color || 0x5865f2,
        panelId: panel.panelId,
        footer: panel.styling?.footer
          ? { text: panel.styling.footer }
          : undefined,
      });

      // Create buttons
      const buttons = createPanelButtons(
        panel.categories || [DEFAULT_CATEGORY],
      );

      // Send message
      const message = await channel.send({
        embeds: [embed],
        components: buttons,
      });

      // Update panel with message reference
      await this.storage.updateTicketPanel(panel.panelId, {
        messageId: message.id,
      });

      logger.info(
        `Panel message sent: ${panel.panelId} in channel ${channel.id}`,
      );

      return {
        success: true,
        message,
      };
    } catch (error) {
      logger.error("Failed to send panel message:", error);
      return {
        success: false,
        error: createErrorEmbed(`Failed to send panel: ${error.message}`),
      };
    }
  }

  /**
   * Update existing panel
   * @param {string} panelId - Panel ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Result
   */
  async updatePanel(panelId, updateData) {
    try {
      const panel = await this.storage.getTicketPanel(panelId);
      if (!panel) {
        return {
          success: false,
          error: createErrorEmbed("Panel not found"),
        };
      }

      const success = await this.storage.updateTicketPanel(panelId, updateData);

      if (success) {
        logger.info(`Panel updated: ${panelId}`);
        return {
          success: true,
          message: createSuccessEmbed("Panel updated successfully!"),
        };
      }

      return {
        success: false,
        error: createErrorEmbed("Failed to update panel"),
      };
    } catch (error) {
      logger.error("Failed to update panel:", error);
      return {
        success: false,
        error: createErrorEmbed(`Failed to update panel: ${error.message}`),
      };
    }
  }

  /**
   * Delete panel
   * @param {string} panelId - Panel ID
   * @returns {Promise<Object>} Result
   */
  async deletePanel(panelId) {
    try {
      const panel = await this.storage.getTicketPanel(panelId);
      if (!panel) {
        return {
          success: false,
          error: createErrorEmbed("Panel not found"),
        };
      }

      const success = await this.storage.deleteTicketPanel(panelId);

      if (success) {
        logger.info(`Panel deleted: ${panelId}`);
        return {
          success: true,
          message: createSuccessEmbed("Panel deleted successfully!"),
        };
      }

      return {
        success: false,
        error: createErrorEmbed("Failed to delete panel"),
      };
    } catch (error) {
      logger.error("Failed to delete panel:", error);
      return {
        success: false,
        error: createErrorEmbed(`Failed to delete panel: ${error.message}`),
      };
    }
  }

  /**
   * Get all panels for guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of panels
   */
  async getGuildPanels(guildId) {
    try {
      return await this.storage.getTicketPanelsByGuild(guildId);
    } catch (error) {
      logger.error("Failed to get guild panels:", error);
      return [];
    }
  }

  /**
   * Check panel limit
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Limit check result
   */
  async checkPanelLimit(guildId) {
    try {
      const isPro = await this.premiumManager.isFeatureActive(
        guildId,
        "pro_engine",
      );
      const maxPanels = isPro ? PRO_ENGINE.MAX_PANELS : FREE_TIER.MAX_PANELS;

      const panels = await this.storage.getTicketPanelsByGuild(guildId);
      const current = panels.length;

      return {
        hasReachedLimit: current >= maxPanels,
        current,
        max: maxPanels,
        isPro,
      };
    } catch (error) {
      logger.error("Failed to check panel limit:", error);
      return {
        hasReachedLimit: false,
        current: 0,
        max: FREE_TIER.MAX_PANELS,
        isPro: false,
      };
    }
  }

  /**
   * Get panel by ID
   * @param {string} panelId - Panel ID
   * @returns {Promise<Object|null>} Panel or null
   */
  async getPanel(panelId) {
    try {
      return await this.storage.getTicketPanel(panelId);
    } catch (error) {
      logger.error("Failed to get panel:", error);
      return null;
    }
  }

  /**
   * Get panel by message ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object|null>} Panel or null
   */
  async getPanelByMessage(messageId) {
    try {
      return await this.storage.getTicketPanelByMessage(messageId);
    } catch (error) {
      logger.error("Failed to get panel by message:", error);
      return null;
    }
  }

  /**
   * Enable/disable panel
   * @param {string} panelId - Panel ID
   * @param {boolean} enabled - Enable status
   * @returns {Promise<Object>} Result
   */
  async setPanelEnabled(panelId, enabled) {
    try {
      const success = await this.storage.updateTicketPanel(panelId, {
        "settings.enabled": enabled,
      });

      if (success) {
        logger.info(`Panel ${enabled ? "enabled" : "disabled"}: ${panelId}`);
        return {
          success: true,
          message: createSuccessEmbed(
            `Panel ${enabled ? "enabled" : "disabled"} successfully!`,
          ),
        };
      }

      return {
        success: false,
        error: createErrorEmbed("Failed to update panel"),
      };
    } catch (error) {
      logger.error("Failed to set panel enabled:", error);
      return {
        success: false,
        error: createErrorEmbed(`Failed to update panel: ${error.message}`),
      };
    }
  }

  /**
   * Refresh the panel message in Discord
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {string} panelId - Panel ID
   * @returns {Promise<Object>} Result
   */
  async refreshPanelMessage(guild, panelId) {
    try {
      const panel = await this.storage.getTicketPanel(panelId);
      if (!panel || !panel.messageId || !panel.channelId) {
        return { success: false, error: "Panel message not found" };
      }

      const channel = await guild.channels.fetch(panel.channelId);
      if (!channel?.isTextBased()) {
        return { success: false, error: "Channel not found" };
      }

      const message = await channel.messages.fetch(panel.messageId);
      if (!message) {
        return { success: false, error: "Message not found" };
      }

      const embed = createPanelEmbed({
        title: panel.title,
        description: panel.description,
        color: panel.styling?.color || 0x5865f2,
        panelId: panel.panelId,
        footer: panel.styling?.footer ? { text: panel.styling.footer } : null,
      });

      const buttons = createPanelButtons(
        panel.categories || [DEFAULT_CATEGORY],
      );

      await message.edit({
        embeds: [embed],
        components: buttons,
      });

      return { success: true };
    } catch (error) {
      logger.error(`Failed to refresh panel message ${panelId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
let instance = null;

export function getTicketPanel() {
  if (!instance) {
    instance = new TicketPanel();
  }
  return instance;
}
