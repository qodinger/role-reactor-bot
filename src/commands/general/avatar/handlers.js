import { AttachmentBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { generateAvatar as generateAIAvatar } from "../../../utils/ai/avatarService.js";
import { multiProviderAIService } from "../../../utils/ai/multiProviderAIService.js";
import {
  checkAIImageCredits,
  checkAndDeductAIImageCredits,
} from "../../../utils/ai/aiCreditManager.js";
import { getUserFacingErrorMessage } from "../../../utils/ai/errorMessages.js";
import { GenerationHistory } from "./utils/generationHistory.js";
import {
  createErrorEmbed,
  createCoreEmbed,
  createHelpEmbed,
  createLoadingEmbed,
  createSuccessEmbed,
  createWarningEmbed,
  createAvatarValidationEmbed,
} from "./embeds.js";
import { validatePrompt, getExplicitNSFWKeywords } from "./utils.js";

const logger = getLogger();

/**
 * Helper function to reply to an interaction based on deferral status
 * @param {import('discord.js').Interaction} interaction - The interaction to reply to
 * @param {boolean} deferred - Whether the interaction was deferred
 * @param {Object} options - Reply options (embeds, files, etc.)
 */
async function replyToInteraction(interaction, deferred, options) {
  if (deferred) {
    await interaction.editReply(options);
  } else {
    await interaction.reply(options);
  }
}

export async function handleAvatarGeneration(
  interaction,
  _client,
  _deferred = true,
  _options = {},
) {
  const promptOption = interaction.options.getString("prompt", true);
  const artStyle = interaction.options.getString("art_style") || null;

  if (promptOption) {
    logger.debug(
      `[avatar] Received prompt (${promptOption.length} chars): "${promptOption.substring(0, 100)}${promptOption.length > 100 ? "..." : ""}"`,
    );
  }

  if (!multiProviderAIService.isEnabled()) {
    const validationEmbed = createAvatarValidationEmbed(
      "AI features are currently disabled. All providers are disabled in the configuration. Please contact the bot administrator.",
    );
    await replyToInteraction(interaction, _deferred, {
      embeds: [validationEmbed],
    });
    return;
  }

  const validation = await validatePrompt(promptOption);
  if (!validation.isValid) {
    logger.warn(
      `[avatar] Prompt validation failed for user ${interaction.user.id}: "${promptOption.substring(0, 100)}..." - Reason: ${validation.reason}`,
    );
    const validationEmbed = createAvatarValidationEmbed(validation.reason);
    await replyToInteraction(interaction, _deferred, {
      embeds: [validationEmbed],
    });
    return;
  }

  const prompt = validation.prompt;

  if (prompt.toLowerCase().includes("help")) {
    const helpEmbed = createHelpEmbed();
    await replyToInteraction(interaction, _deferred, { embeds: [helpEmbed] });
    return;
  }

  const explicitNSFWKeywords = getExplicitNSFWKeywords();
  const promptLower = prompt.toLowerCase();
  const containsNSFWKeywords = explicitNSFWKeywords.some(keyword =>
    promptLower.includes(keyword),
  );

  const user = interaction.user;
  const guild = interaction.guild;
  const channelNSFW = interaction.channel?.nsfw === true;
  const accountAge = user.createdAt ? Date.now() - user.createdAt.getTime() : 0;
  const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

  if (containsNSFWKeywords) {
    const isNewAccount = accountAgeDays < 30;
    const explicitContentFilter = guild?.explicitContentFilter ?? 0;
    const filterEnabled = explicitContentFilter > 0;
    const isCommunityServer = guild?.features?.includes("COMMUNITY") ?? false;
    const userSettingsMessage = `\n**⚠️ Required user setting:**\nYour account must be **age-verified (18+)** to view NSFW content.\nIf not verified, visit: https://dis.gd/request`;

    if (filterEnabled && !channelNSFW) {
      let errorMessage = `This server has **Explicit Content Filter** enabled, and this channel is not marked as NSFW.\n\n**To generate NSFW avatars:**\n1. **Use a channel marked as NSFW (🔞)** - This is the only option for Community Servers\n`;

      if (isCommunityServer) {
        errorMessage += `\n**⚠️ Community Server Limitation:**\nThis server is a **Community Server**, which means the Explicit Content Filter **cannot be disabled**. Discord requires Community Servers to filter content for safety.\n\n**Solution:** You must use an **NSFW channel (🔞)** to generate NSFW avatars. Mark a channel as NSFW in:\n**Channel Settings** → **Overview** → **Age-Restricted Channel** → **Enable**`;
      } else {
        errorMessage += `2. Ask a server administrator to disable the Explicit Content Filter in:\n   **Server Settings** → **Safety** → **Explicit Content Filter** → **Don't scan any media content**\n\n**Note:** Even with the filter disabled, NSFW content should only be generated in NSFW channels.`;
      }

      if (isNewAccount) {
        errorMessage += `\n\n**⚠️ Your account is less than 30 days old.**\nMake sure your account is age-verified (18+).`;
      }

      errorMessage += userSettingsMessage;

      const errorEmbed = createErrorEmbed(
        interaction,
        "NSFW Content Not Allowed",
        errorMessage,
      );
      await replyToInteraction(interaction, _deferred, {
        embeds: [errorEmbed],
      });
      return;
    }

    if (!channelNSFW && !filterEnabled) {
      let warningMessage = `You're generating NSFW content in a non-NSFW channel.\n\n**Recommendation:** Use a channel marked as NSFW (🔞) for NSFW content to avoid issues with Discord's content detection.`;

      if (isNewAccount) {
        warningMessage += `\n\n**⚠️ Your account is less than 30 days old.**\nMake sure your account is age-verified (18+).`;
      }

      warningMessage += userSettingsMessage;

      const warningEmbed = createWarningEmbed(
        interaction,
        "NSFW Content Warning",
        warningMessage,
      );
      await replyToInteraction(interaction, _deferred, {
        embeds: [warningEmbed],
      });
      await new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 2000);
      });
    } else if (channelNSFW && isNewAccount) {
      const warningEmbed = createWarningEmbed(
        interaction,
        "Account Verification Reminder",
        `**Your account is less than 30 days old.**\n\nTo ensure NSFW images display correctly, your account must be **age-verified (18+)**.\n\n${userSettingsMessage}`,
      );
      await replyToInteraction(interaction, _deferred, {
        embeds: [warningEmbed],
      });
      await new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 2000);
      });
    }
  }

  const creditInfo = await checkAIImageCredits(interaction.user.id);
  const { userData, creditsNeeded, hasCredits } = creditInfo;

  if (!hasCredits) {
    const coreEmbed = createCoreEmbed(
      interaction,
      userData,
      creditsNeeded,
      prompt,
    );
    await replyToInteraction(interaction, _deferred, { embeds: [coreEmbed] });
    return;
  }

  // Send loading embed
  let loadingEmbed = createLoadingEmbed(interaction, prompt, artStyle);
  await replyToInteraction(interaction, _deferred, {
    embeds: [loadingEmbed],
  });

  const progressCallback = async status => {
    if (!_deferred) return; // Can't update if not deferred
    try {
      loadingEmbed = createLoadingEmbed(interaction, prompt, artStyle, status);
      await interaction.editReply({
        embeds: [loadingEmbed],
      });
    } catch (error) {
      // Ignore edit errors (e.g., interaction expired)
      logger.debug(
        `[avatar] Failed to update progress message:`,
        error.message,
      );
    }
  };

  const startTime = Date.now();

  try {
    const avatarData = await generateAIAvatar(
      prompt,
      false, // showDebugPrompt
      interaction.user.id,
      { artStyle }, // style options
      progressCallback, // Progress callback for status updates
      userData, // Core user data for rate limiting
    );

    if (!avatarData?.imageBuffer) {
      throw new Error("Image data was missing from the provider response.");
    }

    // Validate image buffer
    if (!Buffer.isBuffer(avatarData.imageBuffer)) {
      throw new Error("Invalid image buffer: expected Buffer object");
    }

    if (avatarData.imageBuffer.length === 0) {
      throw new Error("Invalid image buffer: buffer is empty");
    }

    if (avatarData.imageBuffer.length < 1000) {
      logger.error(
        `[avatar] Content moderation block detected for user ${interaction.user.id}: image buffer is only ${avatarData.imageBuffer.length} bytes`,
      );
      throw new Error(
        "The AI provider blocked image generation due to content moderation. The prompt was detected as inappropriate and the provider refused to generate the image. Try using a less explicit prompt.",
      );
    }

    const deductionResult = await checkAndDeductAIImageCredits(
      interaction.user.id,
    );
    if (!deductionResult.success) {
      logger.error(
        `Failed to deduct credits after successful generation for user ${interaction.user.id}: ${deductionResult.error}`,
      );
    } else {
      logger.debug(
        `Deducted ${deductionResult.creditsDeducted} Core from user ${interaction.user.id} for image generation (${deductionResult.creditsRemaining} remaining)`,
      );
    }
    const deductionBreakdown = deductionResult.deductionBreakdown;

    const fileName = `avatar-${interaction.user.id}-${Date.now()}.png`;

    const attachment = new AttachmentBuilder(avatarData.imageBuffer, {
      name: fileName,
    });

    // Mark as spoiler ONLY in non-NSFW channels
    if (containsNSFWKeywords && !channelNSFW) {
      attachment.setSpoiler(true);
    }

    const durationMs = Date.now() - startTime;

    const successEmbed = createSuccessEmbed(
      interaction,
      prompt,
      artStyle,
      deductionBreakdown,
      containsNSFWKeywords && channelNSFW,
    );

    const shouldUseFollowUp = containsNSFWKeywords && channelNSFW;

    if (shouldUseFollowUp && _deferred) {
      await interaction.editReply({ embeds: [successEmbed] });
      await interaction.followUp({ files: [attachment] });
    } else {
      await replyToInteraction(interaction, _deferred, {
        embeds: [successEmbed],
        files: [attachment],
      });
    }

    logger.info(
      `Avatar command completed in ${durationMs}ms for user ${interaction.user.id}`,
      {
        userId: interaction.user.id,
        provider: avatarData.provider,
        model: avatarData.model,
      },
    );

    // Record successful generation
    await GenerationHistory.recordGeneration(interaction.user.id, {
      prompt,
      provider: avatarData.provider,
      model: avatarData.model,
      config: {
        artStyle: artStyle || null,
      },
      success: true,
      processingTime: durationMs,
      userTier: userData.isCore ? userData.coreTier || "Core Basic" : "Regular",
    });
  } catch (error) {
    logger.error(
      `Avatar command failed for user ${interaction.user.id}: ${error.message}`,
      error,
    );

    // Record failed generation
    await GenerationHistory.recordGeneration(interaction.user.id, {
      prompt,
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
      config: {
        artStyle: artStyle || null,
      },
      userTier: userData.isCore ? userData.coreTier || "Core Basic" : "Regular",
    });

    const errorEmbed = createErrorEmbed(
      interaction,
      "Unable to generate avatar",
      getUserFacingErrorMessage(error, { includeContentModeration: true }),
    );

    await replyToInteraction(interaction, _deferred, { embeds: [errorEmbed] });
  }
}
