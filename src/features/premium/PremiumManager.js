import { PremiumFeatures } from "./config.js";
import { getStorageManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";
import { getCommandHandler } from "../../utils/core/commandHandler.js";

const logger = getLogger();

/**
 * Grace period in days after expiration before disabling the feature.
 * During the grace period, the feature remains active but the user is warned.
 */
const GRACE_PERIOD_DAYS = 3;

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

      // Allow access during grace period
      const graceDeadline = new Date(subscription.nextDeductionDate);
      graceDeadline.setDate(graceDeadline.getDate() + GRACE_PERIOD_DAYS);

      if (graceDeadline < new Date()) {
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

      // 3. Log the transaction
      await this._logTransaction(dbManager, {
        guildId,
        userId,
        featureId,
        featureName: feature.name,
        type: "activation",
        amount: -feature.cost,
      });

      // 4. Update guild settings
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
   * Cancel a premium feature for a guild
   * The feature remains active until the current billing cycle ends (nextDeductionDate).
   * @param {string} guildId - Discord guild ID
   * @param {string} featureId - Feature ID
   * @param {string} userId - User ID requesting cancellation
   * @returns {Promise<{success: boolean, message: string, expiresAt?: string}>}
   */
  async cancelFeature(guildId, featureId, userId) {
    try {
      const dbManager = await getStorageManager();
      const settings = await dbManager.guildSettings.getByGuild(guildId);

      const subscription = settings?.premiumFeatures?.[featureId];
      if (!subscription || !subscription.active) {
        return {
          success: false,
          message: "This feature is not currently active.",
        };
      }

      // Only the payer or a guild admin should be able to cancel
      // For now, we allow the payer
      if (subscription.payerUserId !== userId) {
        return {
          success: false,
          message: "Only the user who activated this feature can cancel it.",
        };
      }

      // Mark as cancelled — it stays active until nextDeductionDate
      subscription.cancelledAt = new Date();
      subscription.cancelledBy = userId;
      subscription.autoRenew = false;

      await dbManager.guildSettings.set(guildId, settings);

      // Log the cancellation
      const feature = Object.values(PremiumFeatures).find(
        f => f.id === featureId,
      );
      await this._logTransaction(dbManager, {
        guildId,
        userId,
        featureId,
        featureName: feature?.name || featureId,
        type: "cancellation",
        amount: 0,
      });

      const expiresAt = new Date(
        subscription.nextDeductionDate,
      ).toLocaleDateString();

      logger.info(
        `🚫 Premium feature ${featureId} cancelled for guild ${guildId} by user ${userId}. Active until ${expiresAt}.`,
      );

      return {
        success: true,
        message: `Subscription cancelled. ${feature?.name || "Feature"} will remain active until ${expiresAt}.`,
        expiresAt: subscription.nextDeductionDate,
      };
    } catch (error) {
      logger.error(
        `Error cancelling feature ${featureId} for guild ${guildId}:`,
        error,
      );
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
      const guilds = await dbManager.guildSettings.collection
        .find({
          premiumFeatures: { $exists: true },
        })
        .toArray();

      const now = new Date();
      let renewed = 0;
      let disabled = 0;
      let warned = 0;

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
            disabled++;
            continue;
          }

          // Skip renewal if user cancelled
          if (sub.cancelledAt || sub.autoRenew === false) {
            // If past the expiration date, disable
            if (deductionDate <= now) {
              await this.disableFeature(guildId, featureId, {
                reason: "cancelled",
              });
              disabled++;
            }
            continue;
          }

          // 1. Check for Low Balance (Warning)
          const threeDaysFromNow = new Date();
          threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

          if (deductionDate <= threeDaysFromNow && deductionDate > now) {
            const didWarn = await this.checkAndWarnLowBalance(
              guildId,
              feature,
              sub.payerUserId,
            );
            if (didWarn) warned++;
          }

          // 2. Process actual renewal
          if (deductionDate <= now) {
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

              // Log the renewal transaction
              await this._logTransaction(dbManager, {
                guildId,
                userId: sub.payerUserId,
                featureId,
                featureName: feature.name,
                type: "renewal",
                amount: -feature.cost,
              });

              renewed++;
              logger.info(
                `✅ Renewed feature ${featureId} for guild ${guildId}`,
              );
            } else {
              // Grace period check
              const graceDeadline = new Date(sub.nextDeductionDate);
              graceDeadline.setDate(
                graceDeadline.getDate() + GRACE_PERIOD_DAYS,
              );

              if (now < graceDeadline) {
                // Still within grace period — warn but don't disable yet
                await this._sendGracePeriodWarning(
                  guildId,
                  feature,
                  sub.payerUserId,
                  graceDeadline,
                  balance,
                );
                warned++;
              } else {
                // Grace period expired — disable
                await this.disableFeature(guildId, featureId, {
                  reason: "insufficient_balance",
                });
                disabled++;
              }
            }
          }
        }
      }

      logger.info(
        `🔄 Premium renewal check complete: ${renewed} renewed, ${disabled} disabled, ${warned} warned`,
      );
    } catch (error) {
      logger.error("Error during premium renewal process:", error);
    }
  }

  /**
   * Check user balance and send a DM warning if it's too low for an upcoming renewal
   * @returns {Promise<boolean>} Whether a warning was sent
   */
  async checkAndWarnLowBalance(guildId, feature, userId) {
    const warningKey = `${guildId}-${feature.id}-${userId}`;
    if (this.sentWarnings.has(warningKey)) return false;

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
                      {
                        name: "Grace Period",
                        value: `You have a **${GRACE_PERIOD_DAYS}-day grace period** after expiration to top up your Cores before the feature is disabled.`,
                        inline: false,
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
              return true;
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
      return false;
    } catch (error) {
      logger.error(`Error in checkAndWarnLowBalance:`, error);
      return false;
    }
  }

  /**
   * Send a grace period warning DM
   */
  async _sendGracePeriodWarning(
    guildId,
    feature,
    userId,
    graceDeadline,
    balance,
  ) {
    const warningKey = `grace-${guildId}-${feature.id}-${userId}`;
    if (this.sentWarnings.has(warningKey)) return;

    if (!this.client) return;

    try {
      const user = await this.client.users.fetch(userId);
      if (!user) return;

      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      const guildName = guild?.name || "Unknown Server";

      const daysLeft = Math.max(
        0,
        Math.ceil((graceDeadline - new Date()) / (1000 * 60 * 60 * 24)),
      );

      await user.send({
        embeds: [
          {
            title: "🚨 Grace Period — Top Up Required",
            description: `Your **${feature.name}** subscription in **${guildName}** has expired, but it's still active during the ${GRACE_PERIOD_DAYS}-day grace period.`,
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
              {
                name: "⏰ Time Remaining",
                value: `**${daysLeft} day${daysLeft !== 1 ? "s" : ""}** before the feature is disabled.`,
                inline: false,
              },
            ],
            color: 0xff4444, // Red
            footer: {
              text: "Top up your Cores on the dashboard to keep this feature active!",
            },
          },
        ],
      });

      logger.info(`🚨 Sent grace period warning DM to user ${userId}`);
      this.sentWarnings.add(warningKey);
    } catch (dmError) {
      logger.warn(
        `Could not send grace period DM to user ${userId}:`,
        dmError.message,
      );
      this.sentWarnings.add(`grace-${guildId}-${feature.id}-${userId}`);
    }
  }

  /**
   * Disable a feature (usually when Cores run out or user cancels)
   * @param {string} guildId
   * @param {string} featureId
   * @param {object} options
   * @param {string} options.reason - "insufficient_balance" or "cancelled"
   */
  async disableFeature(guildId, featureId, options = {}) {
    const { reason = "insufficient_balance" } = options;

    try {
      const dbManager = await getStorageManager();
      const settings = await dbManager.guildSettings.getByGuild(guildId);

      if (settings?.premiumFeatures?.[featureId]) {
        const sub = settings.premiumFeatures[featureId];
        const payerUserId = sub.payerUserId;

        sub.active = false;
        sub.disabledAt = new Date();
        sub.disableReason = reason;

        await dbManager.guildSettings.set(guildId, settings);

        // Log the disablement
        const feature = Object.values(PremiumFeatures).find(
          f => f.id === featureId,
        );
        await this._logTransaction(dbManager, {
          guildId,
          userId: payerUserId,
          featureId,
          featureName: feature?.name || featureId,
          type: "disabled",
          amount: 0,
          reason,
        });

        logger.info(
          `🚫 Premium feature ${featureId} disabled for guild ${guildId}. Reason: ${reason}`,
        );

        // Special logic: If pro engine is disabled, re-enable all commands in Discord UI
        if (featureId === PremiumFeatures.PRO.id) {
          const commandHandler = getCommandHandler();
          // Empty array means no commands are disabled
          await commandHandler.syncGuildCommands(guildId, []);
        }

        // Send deactivation DM to the payer
        await this._sendDeactivationDM(
          guildId,
          feature || { name: featureId, cost: 0 },
          payerUserId,
          reason,
        );
      }
    } catch (error) {
      logger.error(
        `Error disabling feature ${featureId} for guild ${guildId}:`,
        error,
      );
    }
  }

  /**
   * Send a deactivation DM to the payer
   */
  async _sendDeactivationDM(guildId, feature, userId, reason) {
    if (!this.client) return;

    try {
      const user = await this.client.users.fetch(userId);
      if (!user) return;

      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      const guildName = guild?.name || "Unknown Server";

      const reasonText =
        reason === "cancelled"
          ? "You cancelled the subscription and the billing cycle has ended."
          : `Your Core balance was too low to renew (needed ${feature.cost} Cores) and the ${GRACE_PERIOD_DAYS}-day grace period has expired.`;

      await user.send({
        embeds: [
          {
            title: "❌ Premium Feature Deactivated",
            description: `**${feature.name}** has been deactivated for **${guildName}**.`,
            fields: [
              {
                name: "Reason",
                value: reasonText,
                inline: false,
              },
              {
                name: "What happens now?",
                value:
                  "Premium features are no longer available for this server. You can re-activate at any time from the dashboard.",
                inline: false,
              },
            ],
            color: 0xff4444, // Red
            footer: {
              text: "Visit the dashboard to re-activate or top up your Cores.",
            },
          },
        ],
      });

      logger.info(
        `📧 Sent deactivation DM to user ${userId} for feature ${feature.name} in guild ${guildId}`,
      );
    } catch (dmError) {
      logger.warn(
        `Could not send deactivation DM to user ${userId}:`,
        dmError.message,
      );
    }
  }

  /**
   * Log a premium transaction to the database for audit trail
   * @param {object} dbManager - Database manager instance
   * @param {object} transaction - Transaction details
   */
  async _logTransaction(dbManager, transaction) {
    try {
      // Use the payments collection to store premium transactions
      if (dbManager.payments) {
        await dbManager.payments.create({
          paymentId: `premium_${transaction.type}_${transaction.guildId}_${Date.now()}`,
          discordId: transaction.userId,
          provider: "premium_system",
          type: transaction.type, // "activation", "renewal", "cancellation", "disabled"
          status: "completed",
          amount: 0, // No real money involved, just Cores
          currency: "CORES",
          coresGranted: transaction.amount, // Negative for deductions
          tier: transaction.featureId,
          metadata: {
            guildId: transaction.guildId,
            featureName: transaction.featureName,
            reason: transaction.reason || null,
          },
        });
      }
    } catch (error) {
      // Don't fail the main operation if logging fails
      logger.warn(`Failed to log premium transaction: ${error.message}`);
    }
  }

  /**
   * Get premium subscription status for a guild (used by API)
   * @param {string} guildId - Discord guild ID
   * @param {string} featureId - Feature ID
   * @returns {Promise<object|null>} Subscription details
   */
  async getSubscriptionStatus(guildId, featureId) {
    try {
      const dbManager = await getStorageManager();
      const settings = await dbManager.guildSettings.getByGuild(guildId);
      const sub = settings?.premiumFeatures?.[featureId];

      if (!sub) return null;

      return {
        active: sub.active,
        payerUserId: sub.payerUserId,
        activatedAt: sub.activatedAt,
        nextDeductionDate: sub.nextDeductionDate,
        cost: sub.cost,
        period: sub.period,
        cancelled: !!sub.cancelledAt,
        cancelledAt: sub.cancelledAt || null,
        autoRenew: sub.autoRenew !== false,
      };
    } catch (error) {
      logger.error(
        `Error getting subscription status for guild ${guildId}:`,
        error,
      );
      return null;
    }
  }
}

let instance = null;
export function getPremiumManager() {
  if (!instance) instance = new PremiumManager();
  return instance;
}
