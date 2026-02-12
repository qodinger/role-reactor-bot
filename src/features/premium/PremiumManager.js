import { PremiumFeatures } from "./config.js";
import { getStorageManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";
import { getCommandHandler } from "../../utils/core/commandHandler.js";

const logger = getLogger();

export class PremiumManager {
  constructor() {
    this.client = null;
    this.sentWarnings = new Set(); // Simple in-memory cache to prevent spam within one session
  }

  /**
   * Set Discord client for notifications
   * @param {import('discord.js').Client} client
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Check if a guild has a specific premium feature active
   * @param {string} guildId - Discord guild ID
   * @param {string} featureId - Feature ID from config.js
   * @returns {Promise<boolean>}
   */
  async isFeatureActive(guildId, featureId) {
    try {
      const dbManager = await getStorageManager();
      const settings = await dbManager.guildSettings.getByGuild(guildId);

      const subscription = settings?.premiumFeatures?.[featureId];
      if (!subscription || !subscription.active) return false;

      // Check if it's expired (safety check, though scheduler should handle this)
      if (new Date(subscription.nextDeductionDate) < new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        `Error checking feature status for guild ${guildId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Activate a premium feature for a guild
   * @param {string} guildId - Discord guild ID
   * @param {string} featureId - Feature ID
   * @param {string} userId - User ID who is paying
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async activateFeature(guildId, featureId, userId) {
    const feature = Object.values(PremiumFeatures).find(
      f => f.id === featureId,
    );
    if (!feature) {
      return { success: false, message: "Invalid feature ID" };
    }

    try {
      const dbManager = await getStorageManager();

      // 1. Check user balance
      const credits = await dbManager.coreCredits.getByUserId(userId);
      const balance = credits?.credits || 0;

      if (balance < feature.cost) {
        return {
          success: false,
          message: `Insufficient Cores. You need ${feature.cost} Cores, but you only have ${balance}.`,
        };
      }

      // 2. Deduct credits
      const deducted = await dbManager.coreCredits.updateCredits(
        userId,
        -feature.cost,
      );
      if (!deducted) {
        return {
          success: false,
          message: "Failed to deduct Cores. Please try again.",
        };
      }

      // 3. Update guild settings
      const settings = await dbManager.guildSettings.getByGuild(guildId);
      const premiumFeatures = settings.premiumFeatures || {};

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + feature.periodDays);

      premiumFeatures[featureId] = {
        active: true,
        payerUserId: userId,
        activatedAt: new Date(),
        lastDeductionDate: new Date(),
        nextDeductionDate: nextDate,
        cost: feature.cost,
        period: feature.period,
      };

      await dbManager.guildSettings.set(guildId, {
        ...settings,
        premiumFeatures,
      });

      // Special logic: If pro engine is activated, sync existing disabled commands to Discord
      if (featureId === PremiumFeatures.PRO.id) {
        const commandHandler = getCommandHandler();
        const disabledCommands = settings.disabledCommands || [];
        await commandHandler.syncGuildCommands(guildId, disabledCommands);
      }

      logger.info(
        `✨ Premium feature ${featureId} activated for guild ${guildId} by user ${userId}`,
      );

      return {
        success: true,
        message: `Feature ${feature.name} activated successfully until ${nextDate.toLocaleDateString()}`,
      };
    } catch (error) {
      logger.error(`Failed to activate feature ${featureId}:`, error);
      return { success: false, message: "An internal error occurred." };
    }
  }

  /**
   * Process periodic renewals
   */
  async processRenewals() {
    logger.info("🔄 Checking for premium feature renewals...");
    try {
      const dbManager = await getStorageManager();
      // This is a bit inefficient if thousands of guilds, but fine for now.
      // Ideally we'd use a MongoDB query for guilds with active features and nextDate < now
      const guilds = await dbManager.guildSettings.collection
        .find({
          premiumFeatures: { $exists: true },
        })
        .toArray();

      const now = new Date();

      for (const settings of guilds) {
        const guildId = settings.guildId;
        const features = settings.premiumFeatures || {};

        for (const [featureId, sub] of Object.entries(features)) {
          if (!sub.active) continue;

          const deductionDate = new Date(sub.nextDeductionDate);
          const feature = Object.values(PremiumFeatures).find(
            f => f.id === featureId,
          );

          if (!feature) {
            // If feature no longer exists in config, deactivate it
            await this.disableFeature(guildId, featureId);
            continue;
          }

          // 1. Check for Low Balance (Warning)
          // If renewal is within 3 days and balance is insufficient
          const threeDaysFromNow = new Date();
          threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

          if (deductionDate <= threeDaysFromNow && deductionDate > now) {
            await this.checkAndWarnLowBalance(
              guildId,
              feature,
              sub.payerUserId,
            );
          }

          // 2. Process actual renewal
          if (deductionDate <= now) {
            // Time to renew!

            const credits = await dbManager.coreCredits.getByUserId(
              sub.payerUserId,
            );
            const balance = credits?.credits || 0;

            if (balance >= feature.cost) {
              // Deduct and renew
              await dbManager.coreCredits.updateCredits(
                sub.payerUserId,
                -feature.cost,
              );

              const nextDate = new Date(sub.nextDeductionDate);
              nextDate.setDate(nextDate.getDate() + feature.periodDays);

              sub.lastDeductionDate = now;
              sub.nextDeductionDate = nextDate;

              await dbManager.guildSettings.set(guildId, settings);
              logger.info(
                `✅ Renewed feature ${featureId} for guild ${guildId}`,
              );
            } else {
              // Fail
              await this.disableFeature(guildId, featureId);
              // TODO: Send DM to payer or system message to guild?
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error during premium renewal process:", error);
    }
  }

  /**
   * Check user balance and send a DM warning if it's too low for an upcoming renewal
   */
  async checkAndWarnLowBalance(guildId, feature, userId) {
    const warningKey = `${guildId}-${feature.id}-${userId}`;
    if (this.sentWarnings.has(warningKey)) return;

    try {
      const dbManager = await getStorageManager();
      const credits = await dbManager.coreCredits.getByUserId(userId);
      const balance = credits?.credits || 0;

      if (balance < feature.cost) {
        // Send DM
        if (this.client) {
          try {
            const user = await this.client.users.fetch(userId);
            if (user) {
              const guild = await this.client.guilds.fetch(guildId);
              const guildName = guild?.name || "Unknown Server";

              await user.send({
                embeds: [
                  {
                    title: "⚠️ Low Core Balance Warning",
                    description: `Your **${feature.name}** in **${guildName}** is set to renew soon, but you don't have enough Cores.`,
                    fields: [
                      {
                        name: "Feature",
                        value: feature.name,
                        inline: true,
                      },
                      {
                        name: "Required",
                        value: `${feature.cost} Cores`,
                        inline: true,
                      },
                      {
                        name: "Your Balance",
                        value: `${balance} Cores`,
                        inline: true,
                      },
                    ],
                    color: 0xffcc00, // Yellow/Orange
                    footer: {
                      text: "Refuel your Cores on the dashboard to keep this feature active!",
                    },
                  },
                ],
              });
              logger.info(`📧 Sent low balance DM to user ${userId}`);
              this.sentWarnings.add(warningKey);
            }
          } catch (dmError) {
            logger.warn(
              `Could not send low balance DM to user ${userId}:`,
              dmError.message,
            );
            // Still add to set to avoid constant retries if DMs are closed
            this.sentWarnings.add(warningKey);
          }
        }
      }
    } catch (error) {
      logger.error(`Error in checkAndWarnLowBalance:`, error);
    }
  }

  /**
   * Disable a feature (usually when Cores run out)
   * @param {string} guildId
   * @param {string} featureId
   */
  async disableFeature(guildId, featureId) {
    try {
      const dbManager = await getStorageManager();
      const settings = await dbManager.guildSettings.getByGuild(guildId);

      if (settings?.premiumFeatures?.[featureId]) {
        settings.premiumFeatures[featureId].active = false;
        await dbManager.guildSettings.set(guildId, settings);

        logger.info(
          `🚫 Premium feature ${featureId} disabled for guild ${guildId} due to insufficient Cores.`,
        );

        // Special logic: If pro engine is disabled, re-enable all commands in Discord UI
        if (featureId === PremiumFeatures.PRO.id) {
          const commandHandler = getCommandHandler();
          // Empty array means no commands are disabled
          await commandHandler.syncGuildCommands(guildId, []);

          // Note: we might also want to reset settings.disabledCommands = []
          // or just keep them hidden in DB but active in Discord.
          // Let's keep them in DB so if they resubscribe, their choices are still there.
        }
      }
    } catch (error) {
      logger.error(
        `Error disabling feature ${featureId} for guild ${guildId}:`,
        error,
      );
    }
  }
}

let instance = null;
export function getPremiumManager() {
  if (!instance) instance = new PremiumManager();
  return instance;
}
