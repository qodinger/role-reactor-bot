import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { createDetailedCoreManagementEmbed } from "./embeds.js";
import { config } from "../../../config/config.js";
import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";

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

    // Route to appropriate handler
    switch (subcommand) {
      case "list-pending":
        await handleListPending(interaction, deferred);
        break;
      case "add":
      case "remove":
      case "set":
      case "view":
      case "add-donation":
      case "cancel-subscription":
      case "process-pending": {
        const targetUser = interaction.options.getUser("user");
        // Validate target user for commands that require it
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
          case "process-pending":
            await handleProcessPending(interaction, targetUser, deferred);
            break;
        }
        break;
      }
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
      username: targetUser.username || targetUser.globalName || null,
    };

    // Update username if available
    if (targetUser.username && targetUser.username !== userData.username) {
      userData.username = targetUser.username;
    } else if (
      !userData.username &&
      (targetUser.username || targetUser.globalName)
    ) {
      userData.username = targetUser.username || targetUser.globalName;
    }

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
      username: targetUser.username || targetUser.globalName || null,
    };

    // Update username if available
    if (targetUser.username && targetUser.username !== userData.username) {
      userData.username = targetUser.username;
    } else if (
      !userData.username &&
      (targetUser.username || targetUser.globalName)
    ) {
      userData.username = targetUser.username || targetUser.globalName;
    }

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
      oldTotalCores,
      newTotalCores,
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
      oldTotalCores,
      newTotalCores,
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
      oldTotalCores: userData.credits,
      newTotalCores,
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
      username: targetUser.username || targetUser.globalName || null,
    };

    // Update username if available
    if (targetUser.username && targetUser.username !== userData.username) {
      userData.username = targetUser.username;
    } else if (
      !userData.username &&
      (targetUser.username || targetUser.globalName)
    ) {
      userData.username = targetUser.username || targetUser.globalName;
    }

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
      username: targetUser.username || targetUser.globalName || null,
    };

    // Update username if available
    if (targetUser.username && targetUser.username !== userData.username) {
      userData.username = targetUser.username;
    } else if (
      !userData.username &&
      (targetUser.username || targetUser.globalName)
    ) {
      userData.username = targetUser.username || targetUser.globalName;
    }

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

// ============================================================================
// PENDING PAYMENTS HANDLERS
// ============================================================================

/**
 * List all pending Buy Me a Coffee payments
 * @param {import('discord.js').CommandInteraction} interaction - The interaction
 * @param {boolean} deferred - Whether the interaction was deferred
 */
async function handleListPending(interaction, deferred) {
  try {
    const storage = await getStorageManager();
    const storedPayments = await storage.get("pending_bmac_payments");

    // Ensure it's an array
    const pendingPayments = Array.isArray(storedPayments) ? storedPayments : [];

    if (pendingPayments.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("📋 Pending Payments")
        .setDescription("No pending payments found.")
        .setColor(THEME.SUCCESS)
        .setTimestamp();

      if (deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], flags: 64 });
      }
      return;
    }

    // Create embed with pending payments list
    const embed = new EmbedBuilder()
      .setTitle(`📋 Pending Payments (${pendingPayments.length})`)
      .setDescription(
        "These payments are waiting to be linked to Discord users.",
      )
      .setColor(THEME.PRIMARY)
      .setTimestamp();

    // Add fields for each pending payment (limit to 25 fields - Discord limit)
    const paymentsToShow = pendingPayments.slice(0, 25);
    paymentsToShow.forEach((payment, index) => {
      const cores =
        payment.type === "donation"
          ? Math.floor(payment.amount * config.corePricing.donation.rate)
          : payment.membershipTier
            ? config.corePricing.subscriptions[payment.membershipTier]?.cores ||
              0
            : 0;

      const date = new Date(payment.timestamp).toLocaleDateString();
      const value = `**Type:** ${payment.type === "donation" ? "💰 Donation" : "🔄 Subscription"}
**Amount:** $${payment.amount} ${payment.currency}
**Cores:** ${cores}
**From:** ${payment.supporterName}
**Email:** ${payment.email || "N/A"}
**Date:** ${date}
**Transaction ID:** \`${payment.transactionId}\``;

      embed.addFields({
        name: `${index + 1}. ${payment.supporterName} - $${payment.amount}`,
        value: value.substring(0, 1024), // Discord field value limit
        inline: false,
      });
    });

    if (pendingPayments.length > 25) {
      embed.setFooter({
        text: `Showing 25 of ${pendingPayments.length} pending payments`,
      });
    }

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Pending payments listed successfully", {
      count: pendingPayments.length,
      operatorId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error listing pending payments:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

/**
 * Process a pending Buy Me a Coffee payment
 * @param {import('discord.js').CommandInteraction} interaction - The interaction
 * @param {import('discord.js').User} targetUser - The user to link the payment to
 * @param {boolean} deferred - Whether the interaction was deferred
 */
async function handleProcessPending(interaction, targetUser, deferred) {
  const transactionId = interaction.options.getString("transaction-id");
  const reason =
    interaction.options.getString("reason") ||
    "Processed from pending Buy Me a Coffee payment";

  try {
    const storage = await getStorageManager();
    const storedPayments = await storage.get("pending_bmac_payments");

    // Ensure it's an array
    const pendingPayments = Array.isArray(storedPayments) ? storedPayments : [];

    // Find the pending payment
    const paymentIndex = pendingPayments.findIndex(
      p => p.transactionId === transactionId,
    );

    if (paymentIndex === -1) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Payment Not Found")
        .setDescription(
          `No pending payment found with transaction ID: \`${transactionId}\``,
        )
        .setColor(THEME.ERROR)
        .setTimestamp();

      if (deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], flags: 64 });
      }
      return;
    }

    const payment = pendingPayments[paymentIndex];

    // Calculate cores based on payment type
    let coresToAdd = 0;
    let tier = null;

    if (payment.type === "donation") {
      coresToAdd = Math.floor(
        payment.amount * config.corePricing.donation.rate,
      );
    } else if (payment.type === "subscription") {
      // Map subscription amount to tier (same logic as webhook handler)
      // First try to use membershipTier from payment if available
      if (payment.membershipTier) {
        const tierName = payment.membershipTier.toLowerCase();
        if (tierName.includes("elite")) {
          tier = "Core Elite";
        } else if (tierName.includes("premium")) {
          tier = "Core Premium";
        } else if (tierName.includes("basic")) {
          tier = "Core Basic";
        }
      }

      // Fallback to amount-based mapping if tier not found
      if (!tier) {
        if (payment.amount >= 50) {
          tier = "Core Elite";
        } else if (payment.amount >= 25) {
          tier = "Core Premium";
        } else if (payment.amount >= 10) {
          tier = "Core Basic";
        } else {
          tier = "Core Basic"; // Default
        }
      }

      const tierInfo = config.corePricing.subscriptions[tier];
      coresToAdd = tierInfo ? tierInfo.cores : 0;
    }

    // Get user data
    const coreCredits = (await storage.get("core_credit")) || {};
    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      bonusCredits: 0,
      subscriptionCredits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      username: targetUser.username || targetUser.globalName || null,
    };

    // Update username if available
    if (targetUser.username && targetUser.username !== userData.username) {
      userData.username = targetUser.username;
    } else if (
      !userData.username &&
      (targetUser.username || targetUser.globalName)
    ) {
      userData.username = targetUser.username || targetUser.globalName;
    }

    const oldBonusCores = userData.bonusCredits || 0;
    const oldTotalCores = userData.credits || 0;

    // Process payment
    if (payment.type === "donation") {
      // Add as bonus credits (donations never expire)
      userData.bonusCredits = oldBonusCores + coresToAdd;
      userData.credits = oldTotalCores + coresToAdd;
    } else if (payment.type === "subscription") {
      // Set subscription credits
      const isFirstSubscription = !userData.bmacSubscription?.isActive;
      userData.subscriptionCredits = coresToAdd;
      userData.credits = coresToAdd + (userData.bonusCredits || 0);
      userData.isCore = true;
      userData.coreTier = tier;

      // Track subscription
      userData.bmacSubscription = {
        tier,
        isActive: true,
        transactionId: payment.transactionId,
        lastPayment: payment.timestamp,
        monthlyCredits: coresToAdd,
        subscriptionStartDate: isFirstSubscription
          ? payment.timestamp
          : userData.bmacSubscription?.subscriptionStartDate ||
            payment.timestamp,
        processedTransactions: [payment.transactionId],
      };
    }

    userData.totalGenerated = (userData.totalGenerated || 0) + coresToAdd;
    userData.lastUpdated = new Date().toISOString();

    // Save user data
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Remove from pending payments
    pendingPayments.splice(paymentIndex, 1);
    await storage.set("pending_bmac_payments", pendingPayments);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: payment.type === "donation" ? "add-donation" : "add",
      targetUser,
      amount: coresToAdd,
      oldAmount: payment.type === "donation" ? oldBonusCores : 0,
      newAmount:
        payment.type === "donation"
          ? userData.bonusCredits
          : userData.subscriptionCredits,
      reason: `${reason} | Transaction: ${transactionId}`,
      operator: interaction.user,
      userData,
      creditType: payment.type === "donation" ? "bonus" : "subscription",
      oldTotalCores,
      newTotalCores: userData.credits,
      donationDetails:
        payment.type === "donation"
          ? {
              amount: payment.amount,
              coresCalculated: coresToAdd,
            }
          : undefined,
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Pending payment processed successfully", {
      transactionId,
      targetUserId: targetUser.id,
      paymentType: payment.type,
      amount: payment.amount,
      coresAdded: coresToAdd,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error processing pending payment:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}
