import { AttachmentBuilder, MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { generateAvatar as generateAIAvatar } from "../../../utils/ai/avatarService.js";
import { CreditManager } from "./utils/creditManager.js";
import { InteractionHandler } from "./utils/interactionHandler.js";
import { createLoadingSkeleton } from "./utils/imageUtils.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { concurrencyManager } from "../../../utils/ai/concurrencyManager.js";
import {
  createErrorEmbed,
  createLoadingEmbed,
  createSuccessEmbed,
  createCreditEmbed,
  createHelpEmbed,
} from "./utils/embeds.js";

const logger = getLogger();

/**
 * Main command execution handler
 */
export async function execute(interaction) {
  try {
    await handleAIAvatarGenerate(interaction);
  } catch (error) {
    logger.error("Error executing ai-avatar command:", error);

    if (!InteractionHandler.handleApiError(error, interaction)) {
      return;
    }

    const errorEmbed = createErrorEmbed(
      interaction,
      "Avatar Generation Failed",
      "An unexpected error occurred while generating your avatar. Please try again later.",
    );

    await InteractionHandler.safeReply(interaction, { embeds: [errorEmbed] });
  }
}

/**
 * Handle AI avatar generation
 */
export async function handleAIAvatarGenerate(interaction) {
  const startTime = Date.now();
  logger.debug(
    `Starting avatar generation for user ${interaction.user.id}, interaction age: ${Date.now() - interaction.createdTimestamp}ms`,
  );

  // Safely defer the interaction as public (like Midjourney)
  if (
    !(await InteractionHandler.safeDefer(interaction, {
      flags: MessageFlags.None, // Public message
    }))
  ) {
    return;
  }

  const prompt = interaction.options.getString("prompt");

  logger.debug(`Processing prompt: "${prompt}"`);

  // Enhanced content filter with abuse prevention
  const inappropriateKeywords = [
    "nude",
    "naked",
    "explicit",
    "porn",
    "xxx",
    "nsfw",
    "sexual",
    "erotic",
    "fetish",
    "kink",
  ];
  const promptLower = prompt.toLowerCase();
  const hasInappropriateContent = inappropriateKeywords.some(keyword =>
    promptLower.includes(keyword),
  );

  if (hasInappropriateContent) {
    const errorEmbed = createErrorEmbed(
      interaction,
      "Inappropriate Content",
      "Your prompt contains content that violates our content policy. Please use appropriate descriptions for avatar generation.",
    );
    errorEmbed.fields = [
      {
        name: "Your Prompt",
        value: `"${prompt}"`,
        inline: false,
      },
      {
        name: "Suggestions",
        value:
          "Try describing the character's appearance with appropriate language:\n• 'beautiful woman with short hair'\n• 'elegant female with tanned skin'\n• 'attractive girl with short hair'\n• 'stunning woman with short hair'",
        inline: false,
      },
    ];

    await interaction.editReply({
      embeds: [errorEmbed],
      files: [], // Remove any loading images
    });
    return;
  }

  // Check for potential abuse patterns
  const suspiciousKeywords = [
    "sexy",
    "hot",
    "adult",
    "mature",
    "seductive",
    "provocative",
    "sultry",
    "alluring",
    "sensual",
    "tempting",
    "risque",
  ];
  const hasSuspiciousContent = suspiciousKeywords.some(keyword =>
    promptLower.includes(keyword),
  );

  // Track user's content policy violations
  if (hasSuspiciousContent) {
    const storage = await getStorageManager();
    const abuseData = (await storage.get("avatar_abuse_tracking")) || {};
    const userId = interaction.user.id;

    if (!abuseData[userId]) {
      abuseData[userId] = {
        violations: 0,
        lastViolation: null,
        blockedUntil: null,
      };
    }

    // Check if user is temporarily blocked
    if (
      abuseData[userId].blockedUntil &&
      Date.now() < abuseData[userId].blockedUntil
    ) {
      const remainingTime = Math.ceil(
        (abuseData[userId].blockedUntil - Date.now()) / (1000 * 60),
      );
      const errorEmbed = createErrorEmbed(
        interaction,
        "Temporarily Blocked",
        `You've been temporarily blocked from avatar generation due to repeated content policy violations.\n\n**Block Duration:** ${remainingTime} minutes remaining\n\n**Reason:** Multiple attempts with potentially inappropriate content\n\n**What you can do:**\n• Wait for the block to expire\n• Use more appropriate language in your prompts\n• Contact an administrator if you believe this is an error`,
      );

      await interaction.editReply({
        embeds: [errorEmbed],
        files: [], // Remove any loading images
      });
      return;
    }

    // Track this as a potential violation (will be confirmed if AI rejects)
    abuseData[userId].lastSuspiciousPrompt = prompt;
    abuseData[userId].lastSuspiciousTime = Date.now();
    await storage.set("avatar_abuse_tracking", abuseData);
  }

  // Check user credits
  const creditStartTime = Date.now();
  const creditInfo = await CreditManager.checkUserCredits(interaction.user.id);
  logger.debug(`Credit check took ${Date.now() - creditStartTime}ms`);

  if (!creditInfo.hasEnoughCredits) {
    const creditEmbed = createCreditEmbed(
      interaction,
      creditInfo.userData,
      creditInfo.creditsNeeded,
      prompt,
    );

    await interaction.editReply({
      embeds: [creditEmbed],
      files: [], // Remove any loading images
    });
    return;
  }

  try {
    // Create loading skeleton
    const loadingImageBuffer = await createLoadingSkeleton();
    const loadingAttachment = new AttachmentBuilder(loadingImageBuffer, {
      name: `loading-${interaction.user.id}-${Date.now()}.png`,
    });

    // Show loading message with queue status
    const queueStatus = concurrencyManager.getStatus();
    const loadingEmbed = createLoadingEmbed(prompt);
    loadingEmbed.image.url = `attachment://${loadingAttachment.name}`;

    // Add queue information to loading message
    if (queueStatus.queued > 0) {
      loadingEmbed.fields = [
        {
          name: "⏳ Queue Status",
          value: `Position: ${queueStatus.queued + 1} in queue\nActive: ${queueStatus.active}/${queueStatus.maxConcurrent}`,
          inline: true,
        },
      ];
    }

    await interaction.editReply({
      embeds: [loadingEmbed],
      files: [loadingAttachment],
    });

    // Generate the avatar
    const aiStartTime = Date.now();
    logger.debug(`Starting AI generation...`);
    const avatarData = await generateAIAvatar(
      prompt,
      false, // showDebugPrompt
      interaction.user.id,
    );
    logger.debug(`AI generation took ${Date.now() - aiStartTime}ms`);

    if (!avatarData || !avatarData.imageBuffer) {
      throw new Error("Failed to generate avatar image");
    }

    // Deduct credits after successful generation
    await CreditManager.deductCredits(
      interaction.user.id,
      creditInfo.creditsNeeded,
    );

    // Create success response (replace loading message)
    const attachment = new AttachmentBuilder(avatarData.imageBuffer, {
      name: `ai-avatar-${interaction.user.id}-${Date.now()}.png`,
    });

    const successEmbed = createSuccessEmbed(interaction, prompt);
    successEmbed.image.url = `attachment://${attachment.name}`;

    // Replace the loading message with the final result (Midjourney style)
    await interaction.editReply({
      embeds: [successEmbed],
      files: [attachment],
    });

    const totalTime = Date.now() - startTime;
    logger.info(
      `AI Avatar generated for user ${interaction.user.username} (${interaction.user.id}) in ${totalTime}ms`,
    );
  } catch (error) {
    logger.error("Error generating AI avatar:", error);

    let errorMessage = "Avatar Generation Failed";
    let errorDescription =
      "Sorry, I couldn't generate your AI avatar. This might be due to:\n\n• Invalid or inappropriate prompt\n• API service temporarily unavailable\n• Rate limit exceeded\n\nPlease try again with a different prompt or wait a few minutes.";
    let shouldRefundCredits = false;

    // Handle specific error types
    if (error.message.includes("payment requirements")) {
      errorMessage = "Service Temporarily Unavailable";
      errorDescription =
        "AI avatar generation is temporarily unavailable due to payment requirements.\n\n**What this means:**\n• The AI service needs credits to generate avatars\n• This is a server-side configuration issue\n\n**What you can do:**\n• Contact your bot administrator\n• Try again later when the service is restored\n• Your credits have been refunded";
      shouldRefundCredits = true;
    } else if (error.message.includes("Invalid OpenRouter API key")) {
      errorMessage = "API Key Error";
      errorDescription =
        "The OpenRouter API key is invalid or not configured.\n\n**To fix this:**\n• Contact your bot administrator\n• The API key needs to be properly configured\n\nThis is a server configuration issue.";
      shouldRefundCredits = true;
    } else if (error.message.includes("Rate limit exceeded")) {
      errorMessage = "Rate Limit Reached";
      errorDescription =
        "You've generated too many avatars recently.\n\n**Please wait:**\n• Wait a few minutes before trying again\n• Rate limit: 5 avatars per hour per user\n\nThis helps prevent abuse of the AI service.";
      shouldRefundCredits = false; // No refund for rate limit - user's responsibility
    } else if (
      error.message.includes("inappropriate") ||
      error.message.includes("content policy") ||
      error.message.includes("safety")
    ) {
      // Track content policy violations
      const storage = await getStorageManager();
      const abuseData = (await storage.get("avatar_abuse_tracking")) || {};
      const userId = interaction.user.id;

      if (!abuseData[userId]) {
        abuseData[userId] = {
          violations: 0,
          lastViolation: null,
          blockedUntil: null,
        };
      }

      // Increment violation count
      abuseData[userId].violations += 1;
      abuseData[userId].lastViolation = Date.now();

      // Progressive penalties
      if (abuseData[userId].violations >= 5) {
        // Block for 1 hour after 5 violations
        abuseData[userId].blockedUntil = Date.now() + 60 * 60 * 1000;
        errorMessage = "Account Temporarily Blocked";
        errorDescription = `You've been temporarily blocked from avatar generation due to repeated content policy violations.\n\n**Block Duration:** 1 hour\n**Violations:** ${abuseData[userId].violations}\n\n**What you can do:**\n• Wait for the block to expire\n• Use more appropriate language in your prompts\n• Contact an administrator if you believe this is an error`;
        shouldRefundCredits = false; // No refund for repeated violations
      } else if (abuseData[userId].violations >= 3) {
        // Warning after 3 violations
        errorMessage = "Content Policy Violation - Warning";
        errorDescription = `Your prompt was rejected by the AI service due to content policy violations.\n\n**Warning:** This is your ${abuseData[userId].violations}rd violation. Continued violations may result in temporary blocking.\n\n**What you can do:**\n• Try a more family-friendly description\n• Avoid suggestive or explicit language\n• Focus on character appearance and style`;
        shouldRefundCredits = false; // No refund - user passed our filters
      } else {
        // First few violations - be lenient
        errorMessage = "Content Policy Violation";
        errorDescription = `Your prompt was rejected by the AI service due to content policy violations.\n\n**What this means:**\n• The AI service found your prompt inappropriate\n• This is determined by the AI service, not our bot\n• Credits were charged for the API call\n\n**What you can do:**\n• Try a more family-friendly description\n• Avoid suggestive or explicit language\n• Focus on character appearance and style`;
        shouldRefundCredits = false; // No refund - user passed our filters
      }

      await storage.set("avatar_abuse_tracking", abuseData);
    }

    // Refund credits if the error was not user's fault
    if (shouldRefundCredits) {
      try {
        const creditInfo = await CreditManager.checkUserCredits(
          interaction.user.id,
        );
        const creditsToRefund = creditInfo.userData.isCore ? 1 : 2;

        // Add credits back
        const storage = await getStorageManager();
        const coreCredits = (await storage.get("core_credit")) || {};
        const userData = coreCredits[interaction.user.id] || {
          credits: 0,
          isCore: false,
          totalGenerated: 0,
          lastUpdated: new Date().toISOString(),
        };

        userData.credits += creditsToRefund;
        userData.lastUpdated = new Date().toISOString();
        coreCredits[interaction.user.id] = userData;
        await storage.set("core_credit", coreCredits);

        logger.info(
          `Refunded ${creditsToRefund} credits to user ${interaction.user.id} due to service error`,
        );
        errorDescription += `\n\n**Credits Refunded:** ${creditsToRefund} credits have been added back to your account.`;
      } catch (refundError) {
        logger.error("Error refunding credits:", refundError);
      }
    }

    const errorEmbed = createErrorEmbed(
      interaction,
      errorMessage,
      errorDescription,
    );
    errorEmbed.fields = [
      {
        name: "Your Prompt",
        value: `"${prompt}"`,
        inline: false,
      },
      {
        name: "Try Again",
        value: "Use `/avatar` with a different prompt",
        inline: false,
      },
    ];

    await interaction.editReply({
      embeds: [errorEmbed],
      files: [], // Remove any loading images
    });
  }
}

/**
 * Handle AI avatar button interactions
 */
export async function handleAIAvatarButton(interaction) {
  const { customId } = interaction;

  logger.debug(
    `Processing AI avatar button: ${customId}, age: ${Date.now() - interaction.createdTimestamp}ms`,
  );

  try {
    // Check if interaction is still valid
    if (!InteractionHandler.isValidInteraction(interaction)) {
      return;
    }

    // Safely defer the interaction as ephemeral
    if (
      !(await InteractionHandler.safeDefer(interaction, {
        flags: MessageFlags.Ephemeral,
      }))
    ) {
      return;
    }

    if (customId === "ai_avatar_help") {
      await handleHelp(interaction);
    } else {
      throw new Error("Unknown button interaction");
    }

    logger.debug(`Successfully processed AI avatar button: ${customId}`);
  } catch (error) {
    logger.error("Error handling AI avatar button:", error);

    if (!InteractionHandler.handleApiError(error, interaction)) {
      return;
    }

    const errorEmbed = createErrorEmbed(
      interaction,
      "Action Failed",
      "An error occurred while processing your request. Please try again.",
    );

    await InteractionHandler.safeReply(interaction, { embeds: [errorEmbed] });
  }
}

/**
 * Handle help button
 */
async function handleHelp(interaction) {
  const helpEmbed = createHelpEmbed();
  await interaction.editReply({ embeds: [helpEmbed] });
}
