import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import {
  createCoreManagementEmbed,
  createDetailedCoreManagementEmbed,
} from "./embeds.js";

const logger = getLogger();

// ============================================================================
// CORE MANAGEMENT HANDLERS
// ============================================================================

async function handleRemoveTier(interaction, targetUser, deferred = true) {
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    const coreCredits = (await storage.get("core_credit")) || {};
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      coreTier: null,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      operations: [],
    };

    const oldTier = userData.coreTier || "None";
    const oldCoreStatus = userData.isCore;

    // Remove Core status and tier
    userData.isCore = false;
    userData.coreTier = null;
    userData.lastUpdated = new Date().toISOString();
    userData.operations = userData.operations || [];
    userData.operations.push({
      type: "tier_removed",
      oldTier,
      newTier: null,
      oldCoreStatus,
      newCoreStatus: false,
      reason,
      performedBy: interaction.user.username,
      performedAt: new Date().toISOString(),
    });

    coreCredits[userId] = userData;
    await storage.set("core_credit", coreCredits);

    const successEmbed = createCoreManagementEmbed(
      "warning",
      "Core Tier Removed",
      `Successfully removed ${targetUser.username}'s Core tier`,
      [
        {
          name: "Previous Tier",
          value: oldTier || "None",
          inline: true,
        },
        {
          name: "New Tier",
          value: "None",
          inline: true,
        },
        {
          name: "Core Status",
          value: "❌ Inactive",
          inline: true,
        },
        {
          name: "Reason",
          value: reason,
          inline: false,
        },
      ],
    );

    if (deferred) {
      await interaction.editReply({ embeds: [successEmbed] });
    } else {
      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    }

    logger.info(
      `Core tier removed for user ${userId}: ${oldTier} → None by ${interaction.user.username}`,
    );
  } catch (error) {
    logger.error("Error removing Core tier:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

async function handleSetTier(interaction, targetUser, deferred = true) {
  const tier = interaction.options.getString("tier");
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    // Get centralized credit data
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get current user data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      coreTier: null,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      operations: [],
    };

    const oldTier = userData.coreTier || "None";
    const oldCoreStatus = userData.isCore;

    if (tier === "none") {
      // Remove Core status
      userData.isCore = false;
      userData.coreTier = null;
    } else {
      // Set Core tier
      userData.isCore = true;
      userData.coreTier = tier;
    }

    userData.lastUpdated = new Date().toISOString();

    // Track operation
    userData.operations = userData.operations || [];
    userData.operations.push({
      type: "tier_change",
      oldTier,
      newTier: tier === "none" ? null : tier,
      oldCoreStatus,
      newCoreStatus: userData.isCore,
      reason,
      performedBy: interaction.user.username,
      performedAt: new Date().toISOString(),
    });

    // Update centralized data
    coreCredits[userId] = userData;

    // Save updated data
    await storage.set("core_credit", coreCredits);

    const successEmbed = createCoreManagementEmbed(
      "success",
      "Core Tier Updated",
      `Successfully updated ${targetUser.username}'s Core tier`,
      [
        {
          name: "Previous Tier",
          value: oldTier || "None",
          inline: true,
        },
        {
          name: "New Tier",
          value: tier === "none" ? "None" : tier,
          inline: true,
        },
        {
          name: "Core Status",
          value: userData.isCore ? "✅ Active" : "❌ Inactive",
          inline: true,
        },
        {
          name: "Reason",
          value: reason,
          inline: false,
        },
      ],
    );

    if (deferred) {
      await interaction.editReply({ embeds: [successEmbed] });
    } else {
      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    }

    logger.info(
      `Core tier updated for user ${userId}: ${oldTier} → ${tier === "none" ? "None" : tier} by ${interaction.user.username}`,
    );
  } catch (error) {
    logger.error("Error setting Core tier:", error);
    await handleCoreManagementError(interaction, error, deferred);
  }
}

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
      case "tier":
        await handleSetTier(interaction, targetUser, deferred);
        break;
      case "remove-tier":
        await handleRemoveTier(interaction, targetUser, deferred);
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
    const embed = await createDetailedCoreManagementEmbed({
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
    const embed = await createDetailedCoreManagementEmbed({
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
    const embed = await createDetailedCoreManagementEmbed({
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
      coreTier: null,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

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
