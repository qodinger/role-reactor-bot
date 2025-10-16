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

    // Calculate credits from donation amount (10 credits per $1)
    const creditsToAdd = Math.floor(amount * 10);

    // Add credits as bonus credits (donation credits)
    const oldBonusCredits = userData.bonusCredits || 0;
    const newBonusCredits = oldBonusCredits + creditsToAdd;
    const oldTotalCredits = userData.credits;
    const newTotalCredits = oldTotalCredits + creditsToAdd;

    // Update user data
    userData.bonusCredits = newBonusCredits;
    userData.credits = newTotalCredits;
    userData.totalGenerated = (userData.totalGenerated || 0) + creditsToAdd;
    userData.lastUpdated = new Date().toISOString();

    // Add verification record
    userData.verifications = userData.verifications || [];
    userData.verifications.push({
      type: "donation",
      amount,
      credits: creditsToAdd,
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
      amount: creditsToAdd,
      oldAmount: oldBonusCredits,
      newAmount: newBonusCredits,
      reason: `Ko-fi donation: $${amount}${koFiUrl ? ` | ${koFiUrl}` : ""}`,
      operator: interaction.user,
      userData,
      creditType: "bonus",
      donationDetails: {
        amount,
        koFiUrl,
        creditsCalculated: creditsToAdd,
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
      creditsAdded: creditsToAdd,
      oldBonusCredits,
      newBonusCredits,
      oldTotalCredits,
      newTotalCredits,
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

    // Only manage bonus credits (donation credits)
    const oldBonusCredits = userData.bonusCredits || 0;
    const newBonusCredits = oldBonusCredits + amount;
    const oldTotalCredits = userData.credits;
    const newTotalCredits = oldTotalCredits + amount;

    // Update user data - only bonus credits
    userData.bonusCredits = newBonusCredits;
    userData.credits = newTotalCredits;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "add",
      targetUser,
      amount,
      oldAmount: oldBonusCredits,
      newAmount: newBonusCredits,
      reason,
      operator: interaction.user,
      creditType: "bonus",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Bonus credits added successfully", {
      targetUserId: targetUser.id,
      amount,
      oldBonusCredits,
      newBonusCredits,
      oldTotalCredits,
      newTotalCredits,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error adding bonus credits:", error);
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

    // Only manage bonus credits (donation credits)
    const oldBonusCredits = userData.bonusCredits || 0;
    const newBonusCredits = Math.max(0, oldBonusCredits - amount);
    const oldTotalCredits = userData.credits;
    const newTotalCredits = Math.max(0, oldTotalCredits - amount);

    // Update user data - only bonus credits
    userData.bonusCredits = newBonusCredits;
    userData.credits = newTotalCredits;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "remove",
      targetUser,
      amount,
      oldAmount: oldBonusCredits,
      newAmount: newBonusCredits,
      reason,
      operator: interaction.user,
      creditType: "bonus",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Bonus credits removed successfully", {
      targetUserId: targetUser.id,
      amount,
      oldBonusCredits,
      newBonusCredits,
      oldTotalCredits,
      newTotalCredits,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error removing bonus credits:", error);
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

    // Only manage bonus credits (donation credits)
    const oldBonusCredits = userData.bonusCredits || 0;
    const subscriptionCredits = userData.subscriptionCredits || 0;
    const newBonusCredits = amount;
    const newTotalCredits = subscriptionCredits + newBonusCredits;

    // Update user data - only bonus credits
    userData.bonusCredits = newBonusCredits;
    userData.credits = newTotalCredits;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "set",
      targetUser,
      amount,
      oldAmount: oldBonusCredits,
      newAmount: newBonusCredits,
      reason,
      operator: interaction.user,
      creditType: "bonus",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Bonus credits set successfully", {
      targetUserId: targetUser.id,
      amount,
      oldBonusCredits,
      newBonusCredits,
      subscriptionCredits,
      newTotalCredits,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error setting bonus credits:", error);
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

    logger.info("Core credits viewed successfully", {
      targetUserId: targetUser.id,
      totalCredits: userData.credits,
      subscriptionCredits: userData.subscriptionCredits || 0,
      bonusCredits: userData.bonusCredits || 0,
      operatorId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error viewing core credits:", error);
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
        "❌ **Core Management Failed**\nAn error occurred while managing Core credits. Please try again later.",
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
