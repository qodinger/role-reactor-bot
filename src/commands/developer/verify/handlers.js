import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import {
  createDonationSuccessEmbed,
  createSubscriptionSuccessEmbed,
  createManualCreditsSuccessEmbed,
  createErrorEmbed,
  createPermissionDeniedEmbed,
} from "./embeds.js";
import {
  getUserData,
  saveUserData,
  calculateCreditsFromDonation,
  getMonthlyCreditsForTier,
  addVerificationRecord,
  createVerificationRecord,
  handleVerificationError,
} from "./utils.js";
import {
  validateDonationInputs,
  validateSubscriptionInputs,
  validateManualCreditsInputs,
  createValidationErrorEmbed,
} from "./validation.js";

const logger = getLogger();

export async function execute(interaction) {
  // Defer the interaction immediately to prevent timeout
  await interaction.deferReply({ ephemeral: true });

  // Check developer permissions
  if (!isDeveloper(interaction.user.id)) {
    logger.warn("Permission denied for verify command", {
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
    });

    const permissionEmbed = createPermissionDeniedEmbed(interaction.client);
    await interaction.editReply({ embeds: [permissionEmbed] });
    return;
  }

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
      default: {
        const errorEmbed = createErrorEmbed({
          title: "Unknown Subcommand",
          description: "The specified subcommand is not recognized.",
          footerText: "Core Verification • Error",
          client: interaction.client,
        });
        await interaction.editReply({ embeds: [errorEmbed] });
        break;
      }
    }
  } catch (error) {
    handleVerificationError(error, `verify ${subcommand}`, {
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
    });

    const errorEmbed = createErrorEmbed({
      title: "Verification Error",
      description: "An unexpected error occurred. Please try again later.",
      footerText: "Core Verification • Error",
      client: interaction.client,
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleDonationVerification(interaction) {
  // Validate inputs
  const validation = validateDonationInputs(interaction.options);
  if (!validation.valid) {
    const errorEmbed = createValidationErrorEmbed(
      validation.errors,
      interaction.client,
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const { user: targetUser, amount, koFiUrl, notes } = validation.data;
  const userId = targetUser.id;

  try {
    // Get current user data
    const userData = await getUserData(userId);

    // Calculate credits from donation amount
    const creditsToAdd = calculateCreditsFromDonation(amount);

    // Add credits
    userData.credits += creditsToAdd;

    // Create and add verification record
    const verificationRecord = createVerificationRecord("donation", {
      amount,
      credits: creditsToAdd,
      koFiUrl,
      notes,
      verifiedBy: interaction.user.username,
    });

    const updatedUserData = addVerificationRecord(userData, verificationRecord);

    // Save updated data
    await saveUserData(userId, updatedUserData);

    // Create success embed
    const successEmbed = createDonationSuccessEmbed({
      targetUser,
      amount,
      creditsToAdd,
      newBalance: updatedUserData.credits,
      koFiUrl,
      notes,
      verifiedBy: interaction.user.username,
      client: interaction.client,
    });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    handleVerificationError(error, "donation verification", {
      userId,
      amount,
      verifiedBy: interaction.user.username,
    });

    const errorEmbed = createErrorEmbed({
      title: "Verification Failed",
      description:
        "There was an error verifying the donation. Please try again later.",
      footerText: "Core Verification • Error",
      client: interaction.client,
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSubscriptionVerification(interaction) {
  // Validate inputs
  const validation = validateSubscriptionInputs(interaction.options);
  if (!validation.valid) {
    const errorEmbed = createValidationErrorEmbed(
      validation.errors,
      interaction.client,
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const { user: targetUser, koFiUrl, notes } = validation.data;
  const userId = targetUser.id;

  try {
    // Get current user data
    const userData = await getUserData(userId);

    // Set Core status and tier (default to Basic)
    userData.isCore = true;
    userData.coreTier = userData.coreTier || "Core Basic";

    // Add monthly credits for the tier
    const monthlyCredits = getMonthlyCreditsForTier(userData.coreTier);
    userData.credits += monthlyCredits;

    // Create and add verification record
    const verificationRecord = createVerificationRecord("subscription", {
      credits: monthlyCredits,
      tier: userData.coreTier,
      koFiUrl,
      notes,
      verifiedBy: interaction.user.username,
    });

    const updatedUserData = addVerificationRecord(userData, verificationRecord);

    // Save updated data
    await saveUserData(userId, updatedUserData);

    // Create success embed
    const successEmbed = createSubscriptionSuccessEmbed({
      targetUser,
      tier: updatedUserData.coreTier,
      creditsAdded: monthlyCredits,
      newBalance: updatedUserData.credits,
      koFiUrl,
      notes,
      verifiedBy: interaction.user.username,
      client: interaction.client,
    });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    handleVerificationError(error, "subscription verification", {
      userId,
      verifiedBy: interaction.user.username,
    });

    const errorEmbed = createErrorEmbed({
      title: "Verification Failed",
      description:
        "There was an error verifying the subscription. Please try again later.",
      footerText: "Core Verification • Error",
      client: interaction.client,
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleManualCredits(interaction) {
  // Validate inputs
  const validation = validateManualCreditsInputs(interaction.options);
  if (!validation.valid) {
    const errorEmbed = createValidationErrorEmbed(
      validation.errors,
      interaction.client,
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const { user: targetUser, credits, notes } = validation.data;
  const userId = targetUser.id;

  try {
    // Get current user data
    const userData = await getUserData(userId);

    // Add credits
    userData.credits += credits;

    // Create and add verification record
    const verificationRecord = createVerificationRecord("manual", {
      credits,
      notes,
      verifiedBy: interaction.user.username,
    });

    const updatedUserData = addVerificationRecord(userData, verificationRecord);

    // Save updated data
    await saveUserData(userId, updatedUserData);

    // Create success embed
    const successEmbed = createManualCreditsSuccessEmbed({
      targetUser,
      credits,
      newBalance: updatedUserData.credits,
      notes,
      addedBy: interaction.user.username,
      client: interaction.client,
    });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    handleVerificationError(error, "manual credits", {
      userId,
      credits,
      addedBy: interaction.user.username,
    });

    const errorEmbed = createErrorEmbed({
      title: "Credit Addition Failed",
      description: "There was an error adding credits. Please try again later.",
      footerText: "Core Verification • Error",
      client: interaction.client,
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
