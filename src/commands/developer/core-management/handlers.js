import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { createDetailedCoreManagementEmbed } from "./embeds.js";

const logger = getLogger();

// ============================================================================
// CORE MANAGEMENT HANDLERS
// ============================================================================

export async function handleCoreManagement(
  interaction,
  _client,
  deferred = true,
) {
  try {
    // Check developer permissions
    if (!isDeveloper(interaction.user.id)) {
      logger.warn("Permission denied for core-management command", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      const response = {
        content:
          "❌ **Permission Denied**\nYou need developer permissions to use this command.",
        flags: 64,
      };

      if (deferred) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("user");

    // Validate target user
    if (!targetUser) {
      const response = {
        content: "❌ **Invalid User**\nPlease specify a valid user.",
        flags: 64,
      };

      if (deferred) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
      return;
    }

    // Route to appropriate handler
    switch (subcommand) {
      case "add":
        await handleAddCores(interaction, targetUser, deferred);
        break;
      case "remove":
        await handleRemoveCores(interaction, targetUser, deferred);
        break;
      case "set":
        await handleSetCores(interaction, targetUser, deferred);
        break;
      case "view":
        await handleViewCores(interaction, targetUser, deferred);
        break;
      case "add-donation":
        await handleAddDonation(interaction, targetUser, deferred);
        break;
      case "cancel-subscription":
        await handleCancelSubscription(interaction, targetUser, deferred);
        break;
      default: {
        const response = {
          content: "❌ **Unknown Subcommand**\nPlease use a valid subcommand.",
          flags: 64,
        };

        if (deferred) {
          await interaction.editReply(response);
        } else {
          await interaction.reply(response);
        }
        break;
      }
    }
  } catch (error) {
    logger.error("Error in core management:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

// ============================================================================
// CORE OPERATION HANDLERS
// ============================================================================

async function handleAddDonation(interaction, targetUser, deferred) {
  const amount = interaction.options.getNumber("amount");
  const koFiUrl = interaction.options.getString("ko-fi-url");
  const reason =
    interaction.options.getString("reason") || "Ko-fi donation verification";

  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      subscriptionCredits: 0,
      bonusCredits: 0,
    };

    // Calculate Cores from donation amount (10 Cores per $1)
    const coresToAdd = Math.floor(amount * 10);

    // Add Cores as bonus Cores (donation Cores)
    const oldBonusCores = userData.bonusCredits || 0;
    const newBonusCores = oldBonusCores + coresToAdd;
    const oldTotalCores = userData.credits;
    const newTotalCores = oldTotalCores + coresToAdd;

    // Update user data
    userData.bonusCredits = newBonusCores;
    userData.credits = newTotalCores;
    userData.totalGenerated = (userData.totalGenerated || 0) + coresToAdd;
    userData.lastUpdated = new Date().toISOString();

    // Add verification record
    userData.verifications = userData.verifications || [];
    userData.verifications.push({
      type: "donation",
      amount,
      credits: coresToAdd,
      koFiUrl,
      reason,
      verifiedBy: interaction.user.username,
      verifiedAt: new Date().toISOString(),
    });

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "add-donation",
      targetUser,
      amount: coresToAdd,
      oldAmount: oldBonusCores,
      newAmount: newBonusCores,
      reason: `Ko-fi donation: $${amount}${koFiUrl ? ` | ${koFiUrl}` : ""}`,
      operator: interaction.user,
      userData,
      creditType: "bonus",
      donationDetails: {
        amount,
        koFiUrl,
        coresCalculated: coresToAdd,
      },
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Donation verification completed successfully", {
      targetUserId: targetUser.id,
      amount,
      coresAdded: coresToAdd,
      oldBonusCores,
      newBonusCores,
      oldTotalCores,
      newTotalCores,
      operatorId: interaction.user.id,
      koFiUrl,
      reason,
    });
  } catch (error) {
    logger.error("Error verifying donation:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

async function handleAddCores(interaction, targetUser, deferred) {
  const amount = interaction.options.getInteger("amount");
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      subscriptionCredits: 0,
      bonusCredits: 0,
    };

    // Only manage bonus Cores (donation Cores)
    const oldBonusCores = userData.bonusCredits || 0;
    const newBonusCores = oldBonusCores + amount;
    const oldTotalCores = userData.credits;
    const newTotalCores = oldTotalCores + amount;

    // Update user data - only bonus Cores
    userData.bonusCredits = newBonusCores;
    userData.credits = newTotalCores;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "add",
      targetUser,
      amount,
      oldAmount: oldBonusCores,
      newAmount: newBonusCores,
      reason,
      operator: interaction.user,
      creditType: "bonus",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Bonus Cores added successfully", {
      targetUserId: targetUser.id,
      amount,
      oldBonusCores,
      newBonusCores,
      oldTotalCores,
      newTotalCores,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error adding bonus Cores:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

async function handleRemoveCores(interaction, targetUser, deferred) {
  const amount = interaction.options.getInteger("amount");
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      subscriptionCredits: 0,
      bonusCredits: 0,
    };

    // Only manage bonus Cores (donation Cores)
    const oldBonusCores = userData.bonusCredits || 0;
    const newBonusCores = Math.max(0, oldBonusCores - amount);
    const oldTotalCores = userData.credits;
    const newTotalCores = Math.max(0, oldTotalCores - amount);

    // Update user data - only bonus Cores
    userData.bonusCredits = newBonusCores;
    userData.credits = newTotalCores;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "remove",
      targetUser,
      amount,
      oldAmount: oldBonusCores,
      newAmount: newBonusCores,
      reason,
      operator: interaction.user,
      creditType: "bonus",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Bonus Cores removed successfully", {
      targetUserId: targetUser.id,
      amount,
      oldBonusCores,
      newBonusCores,
      oldTotalCores,
      newTotalCores,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error removing bonus Cores:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

async function handleSetCores(interaction, targetUser, deferred) {
  const amount = interaction.options.getInteger("amount");
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      subscriptionCredits: 0,
      bonusCredits: 0,
    };

    // Only manage bonus Cores (donation Cores)
    const oldBonusCores = userData.bonusCredits || 0;
    const subscriptionCredits = userData.subscriptionCredits || 0;
    const newBonusCores = amount;
    const newTotalCores = subscriptionCredits + newBonusCores;

    // Update user data - only bonus Cores
    userData.bonusCredits = newBonusCores;
    userData.credits = newTotalCores;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "set",
      targetUser,
      amount,
      oldAmount: oldBonusCores,
      newAmount: newBonusCores,
      reason,
      operator: interaction.user,
      creditType: "bonus",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Bonus Cores set successfully", {
      targetUserId: targetUser.id,
      amount,
      oldBonusCores,
      newBonusCores,
      subscriptionCredits,
      newTotalCores,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error setting bonus Cores:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

async function handleViewCores(interaction, targetUser, deferred) {
  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      isCore: false,
      coreTier: null,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      subscriptionCredits: 0,
      bonusCredits: 0,
    };

    // Create view embed with credit breakdown
    const embed = await createDetailedCoreManagementEmbed({
      type: "view",
      targetUser,
      amount: userData.credits,
      oldAmount: userData.credits,
      newAmount: userData.credits,
      reason: "View request",
      operator: interaction.user,
      userData,
      showCreditBreakdown: true,
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Core Cores viewed successfully", {
      targetUserId: targetUser.id,
      totalCredits: userData.credits,
      subscriptionCredits: userData.subscriptionCredits || 0,
      bonusCredits: userData.bonusCredits || 0,
      operatorId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error viewing Core Cores:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

async function handleCoreManagementError(interaction, error, deferred) {
  logger.error("Core management command error:", error);

  try {
    const errorResponse = {
      content:
        "❌ **Core Management Failed**\nAn error occurred while managing Core Cores. Please try again later.",
      flags: 64,
    };

    if (deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  } catch (replyError) {
    logger.error("Failed to send core management error response:", replyError);
  }
}

/**
 * Handle manual subscription cancellation
 * @param {import('discord.js').CommandInteraction} interaction - The interaction
 * @param {import('discord.js').User} targetUser - The user to cancel subscription for
 * @param {boolean} deferred - Whether the interaction was deferred
 */
async function handleCancelSubscription(interaction, targetUser, deferred) {
  const reason =
    interaction.options.getString("reason") ||
    "Manual cancellation by developer";

  try {
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      subscriptionCredits: 0,
      bonusCredits: 0,
    };

    // Check if user has an active subscription
    if (!userData.isCore || !userData.koFiSubscription?.isActive) {
      const embed = await createDetailedCoreManagementEmbed({
        type: "cancel-subscription",
        targetUser,
        amount: 0,
        oldAmount: 0,
        newAmount: 0,
        reason: "No active subscription found",
        operator: interaction.user,
        userData,
        creditType: "subscription",
        showCreditBreakdown: false,
      });

      if (deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], flags: 64 });
      }
      return;
    }

    // Store previous state for logging
    const previousCoreStatus = userData.isCore;
    const previousTier = userData.coreTier;
    const previousSubscriptionCredits = userData.subscriptionCredits || 0;

    // Cancel the subscription
    userData.isCore = false;
    userData.coreTier = null;
    userData.subscriptionCredits = 0;
    userData.lastUpdated = new Date().toISOString();

    // Update subscription status
    if (userData.koFiSubscription) {
      userData.koFiSubscription.isActive = false;
      userData.koFiSubscription.cancelledAt = new Date().toISOString();
      userData.koFiSubscription.cancelledBy = interaction.user.username;
      userData.koFiSubscription.cancellationReason = reason;
    }

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "cancel-subscription",
      targetUser,
      amount: 0,
      oldAmount: previousSubscriptionCredits,
      newAmount: 0,
      reason: `Manual cancellation: ${reason}`,
      operator: interaction.user,
      userData,
      creditType: "subscription",
      showCreditBreakdown: true,
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Manual subscription cancellation completed successfully", {
      targetUserId: targetUser.id,
      previousCoreStatus,
      previousTier,
      previousSubscriptionCredits,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error cancelling subscription:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}
