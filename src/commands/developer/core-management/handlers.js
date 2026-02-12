import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { formatCoreCredits } from "../../../utils/ai/aiCreditManager.js";
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

    // Route to appropriate handler
    switch (subcommand) {
      case "add":
      case "remove":
      case "set":
      case "view": {
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

async function handleAddCores(interaction, targetUser, deferred) {
  const amount = interaction.options.getInteger("amount");
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  try {
    const storage = await getStorageManager();
    const userData = (await storage.getCoreCredits(targetUser.id)) || {
      credits: 0,
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

    // Only manage total Cores (simplified)
    const oldTotalCores = userData.credits;
    const newTotalCores = oldTotalCores + amount;

    // Update user data
    userData.credits = formatCoreCredits(newTotalCores);
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    await storage.setCoreCredits(targetUser.id, userData);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "add",
      targetUser,
      amount,
      oldAmount: oldTotalCores,
      newAmount: newTotalCores,
      reason,
      operator: interaction.user,
      creditType: "total",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Cores added successfully", {
      targetUserId: targetUser.id,
      amount,
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
    const userData = (await storage.getCoreCredits(targetUser.id)) || {
      credits: 0,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Only manage total Cores (simplified)
    const oldTotalCores = userData.credits;
    const newTotalCores = Math.max(0, oldTotalCores - amount);

    // Update user data
    userData.credits = formatCoreCredits(newTotalCores);
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    await storage.setCoreCredits(targetUser.id, userData);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "remove",
      targetUser,
      amount,
      oldAmount: oldTotalCores,
      newAmount: newTotalCores,
      reason,
      operator: interaction.user,
      creditType: "total",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Cores removed successfully", {
      targetUserId: targetUser.id,
      amount,
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
    const userData = (await storage.getCoreCredits(targetUser.id)) || {
      credits: 0,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Only manage total Cores (simplified)
    const oldTotalCores = userData.credits;
    const newTotalCores = amount;

    // Update user data
    userData.credits = formatCoreCredits(newTotalCores);
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    await storage.setCoreCredits(targetUser.id, userData);

    // Create success embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "set",
      targetUser,
      amount,
      oldAmount: oldTotalCores,
      newAmount: newTotalCores,
      reason,
      operator: interaction.user,
      creditType: "total",
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Cores set successfully", {
      targetUserId: targetUser.id,
      amount,
      oldTotalCores,
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
    const userData = (await storage.getCoreCredits(targetUser.id)) || {
      credits: 0,
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

    // Create view embed
    const embed = await createDetailedCoreManagementEmbed({
      type: "view",
      targetUser,
      amount: userData.credits,
      oldAmount: userData.credits,
      newAmount: userData.credits,
      reason: "View request",
      operator: interaction.user,
      userData,
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Cores viewed successfully", {
      targetUserId: targetUser.id,
      totalCredits: userData.credits,
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

// ============================================================================
// PENDING PAYMENTS HANDLERS
// ============================================================================
// Removed: Buy Me a Coffee pending payment handlers (no longer supported)
