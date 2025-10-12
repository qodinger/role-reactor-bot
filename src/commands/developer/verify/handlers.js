import { PermissionFlagsBits } from "discord.js";
import { EMOJIS, THEME } from "../../../config/theme.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

export async function execute(interaction) {
  // Defer the interaction immediately to prevent timeout
  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "donation":
        await handleDonationVerification(interaction);
        break;
      case "subscription":
        await handleSubscriptionVerification(interaction);
        break;
      case "manual":
        await handleManualCredits(interaction);
        break;
      default:
        await interaction.editReply({
          content: "❌ Unknown subcommand",
        });
    }
  } catch (error) {
    logger.error(`Error executing ai-avatar-verify ${subcommand}:`, error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Verification Error`,
      description: "An unexpected error occurred. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Verification • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleDonationVerification(interaction) {
  // Check if user has developer permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: "❌ You do not have permission to use this developer command.",
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const amount = interaction.options.getNumber("amount");
  const koFiUrl = interaction.options.getString("ko-fi-url");
  const notes = interaction.options.getString("notes");

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get current user data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      verifications: [],
    };

    // Calculate credits from donation amount ($0.05 per credit)
    const creditsToAdd = Math.floor(amount / 0.05);

    // Add credits
    userData.credits += creditsToAdd;
    userData.lastUpdated = new Date().toISOString();

    // Track verification
    userData.verifications = userData.verifications || [];
    userData.verifications.push({
      type: "donation",
      amount: amount || 0,
      credits: creditsToAdd,
      koFiUrl,
      notes,
      verifiedBy: interaction.user.username,
      verifiedAt: new Date().toISOString(),
    });

    // Update centralized data
    coreCredits[userId] = userData;

    // Save updated data
    await storage.set("core_credit", coreCredits);

    const successEmbed = {
      color: THEME.SUCCESS,
      title: `${EMOJIS.STATUS.SUCCESS} Donation Verified!`,
      description: `Successfully verified a **$${amount} donation** for ${targetUser.username} and added **${creditsToAdd} credits** for AI services.`,
      fields: [
        {
          name: `${EMOJIS.UI.USER} User`,
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Type`,
          value: "Donation",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Amount`,
          value: `$${amount}`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Credits Added`,
          value: `${creditsToAdd} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} New Balance`,
          value: `${userData.credits} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Verified By`,
          value: interaction.user.username,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Ko-fi URL`,
          value: koFiUrl || "Not provided",
          inline: false,
        },
        {
          name: `${EMOJIS.UI.INFO} Notes`,
          value: notes || "No additional notes",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Manual Verification",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error verifying donation:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Verification Failed`,
      description:
        "There was an error verifying the donation. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSubscriptionVerification(interaction) {
  // Check if user has developer permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: "❌ You do not have permission to use this developer command.",
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const koFiUrl = interaction.options.getString("ko-fi-url");
  const notes = interaction.options.getString("notes");

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get current user data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      verifications: [],
    };

    // Set Core status and add monthly credits
    userData.isCore = true;
    userData.credits += 50; // Monthly free credits for Core members
    userData.lastUpdated = new Date().toISOString();

    // Track verification
    userData.verifications = userData.verifications || [];
    userData.verifications.push({
      type: "subscription",
      amount: 0,
      credits: 50,
      koFiUrl,
      notes,
      verifiedBy: interaction.user.username,
      verifiedAt: new Date().toISOString(),
    });

    // Update centralized data
    coreCredits[userId] = userData;

    // Save updated data
    await storage.set("core_credit", coreCredits);

    const successEmbed = {
      color: THEME.SUCCESS,
      title: `${EMOJIS.STATUS.SUCCESS} Core Status Granted`,
      description: `Successfully granted Core membership to ${targetUser.username}!`,
      fields: [
        {
          name: `${EMOJIS.UI.USER} User`,
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Type`,
          value: "Subscription",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Status`,
          value: "⭐ Core Member",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Credits Added`,
          value: "50 credits (monthly)",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} New Balance`,
          value: `${userData.credits} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Verified By`,
          value: interaction.user.username,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Ko-fi URL`,
          value: koFiUrl || "Not provided",
          inline: false,
        },
        {
          name: `${EMOJIS.UI.INFO} Notes`,
          value: notes || "No additional notes",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Manual Verification",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error verifying subscription:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Verification Failed`,
      description:
        "There was an error verifying the subscription. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleManualCredits(interaction) {
  // Check if user has developer permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: "❌ You do not have permission to use this developer command.",
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const credits = interaction.options.getInteger("credits");
  const notes = interaction.options.getString("notes");

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get current user data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
      verifications: [],
    };

    // Add credits
    userData.credits += credits;
    userData.lastUpdated = new Date().toISOString();

    // Track verification
    userData.verifications = userData.verifications || [];
    userData.verifications.push({
      type: "manual",
      amount: 0,
      credits,
      koFiUrl: null,
      notes,
      verifiedBy: interaction.user.username,
      verifiedAt: new Date().toISOString(),
    });

    // Update centralized data
    coreCredits[userId] = userData;

    // Save updated data
    await storage.set("core_credit", coreCredits);

    const successEmbed = {
      color: THEME.SUCCESS,
      title: `${EMOJIS.STATUS.SUCCESS} Credits Added`,
      description: `Successfully added ${credits} credits to ${targetUser.username}!`,
      fields: [
        {
          name: `${EMOJIS.UI.USER} User`,
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Type`,
          value: "Manual",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Credits Added`,
          value: `${credits} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} New Balance`,
          value: `${userData.credits} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Added By`,
          value: interaction.user.username,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Notes`,
          value: notes || "No additional notes",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Manual Credits",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error adding manual credits:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Credit Addition Failed`,
      description: "There was an error adding credits. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
