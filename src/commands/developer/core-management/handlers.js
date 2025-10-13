import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { createCoreManagementEmbed } from "./embeds.js";

const logger = getLogger();

// ============================================================================
// CORE MANAGEMENT HANDLERS
// ============================================================================

export async function handleCoreManagement(
  interaction,
  client,
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
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[targetUser.id] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    const oldAmount = userData.credits;
    const newAmount = oldAmount + amount;

    // Update user data
    userData.credits = newAmount;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createCoreManagementEmbed({
      type: "add",
      targetUser,
      amount,
      oldAmount,
      newAmount,
      reason,
      operator: interaction.user,
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Core credits added successfully", {
      targetUserId: targetUser.id,
      amount,
      oldAmount,
      newAmount,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error adding core credits:", error);
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
    };

    const oldAmount = userData.credits;
    const newAmount = Math.max(0, oldAmount - amount);

    // Update user data
    userData.credits = newAmount;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createCoreManagementEmbed({
      type: "remove",
      targetUser,
      amount,
      oldAmount,
      newAmount,
      reason,
      operator: interaction.user,
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Core credits removed successfully", {
      targetUserId: targetUser.id,
      amount,
      oldAmount,
      newAmount,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error removing core credits:", error);
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
    };

    const oldAmount = userData.credits;
    const newAmount = amount;

    // Update user data
    userData.credits = newAmount;
    userData.lastUpdated = new Date().toISOString();

    // Save to storage
    coreCredits[targetUser.id] = userData;
    await storage.set("core_credit", coreCredits);

    // Create success embed
    const embed = await createCoreManagementEmbed({
      type: "set",
      targetUser,
      amount,
      oldAmount,
      newAmount,
      reason,
      operator: interaction.user,
    });

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info("Core credits set successfully", {
      targetUserId: targetUser.id,
      amount,
      oldAmount,
      newAmount,
      operatorId: interaction.user.id,
      reason,
    });
  } catch (error) {
    logger.error("Error setting core credits:", error);
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
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Create view embed
    const embed = await createCoreManagementEmbed({
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

    logger.info("Core credits viewed successfully", {
      targetUserId: targetUser.id,
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
