import { AttachmentBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { generateAvatar as generateAIAvatar } from "../../../utils/ai/avatarService.js";
import { multiProviderAIService } from "../../../utils/ai/multiProviderAIService.js";
import { CreditManager } from "./utils/creditManager.js";
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

function getUserFacingErrorMessage(error) {
  if (!error || !error.message) {
    return "Something went wrong. Please try again shortly.";
  }

  const message = error.message;

  if (/ai features are disabled/i.test(message)) {
    return "AI features are currently disabled. All providers are disabled in the configuration. Please contact the bot administrator.";
  }

  if (/rate limit/i.test(message)) {
    return "You're sending prompts too quickly. Please wait a moment before trying again.";
  }

  if (/api key not configured/i.test(message)) {
    return "The AI provider is not properly configured. Please contact the bot administrator.";
  }

  if (/queue is full/i.test(message)) {
    return "Generation queue is full right now. Please try again in a moment.";
  }

  if (/timed out/i.test(message)) {
    return "The AI provider took too long to respond. Try a shorter prompt or retry later.";
  }

  if (/content moderation/i.test(message)) {
    return "The AI provider blocked image generation due to content moderation. The prompt was detected as inappropriate. Try using a less explicit prompt.";
  }

  return message;
}

export async function handleAvatarGeneration(
  interaction,
  _client,
  _deferred = true,
  options = {},
) {
  const promptOption = interaction.options.getString("prompt", true);
  const artStyle = interaction.options.getString("art_style") || null;

  // Check if AI features are enabled
  if (!multiProviderAIService.isEnabled()) {
    const validationEmbed = createAvatarValidationEmbed(
      "AI features are currently disabled. All providers are disabled in the configuration. Please contact the bot administrator.",
    );
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  // Validate prompt
  const validation = validatePrompt(promptOption);
  if (!validation.isValid) {
    const validationEmbed = createAvatarValidationEmbed(validation.reason);
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  const prompt = validation.prompt;

  // Check for help request
  if (prompt.toLowerCase().includes("help")) {
    const helpEmbed = createHelpEmbed();
    await interaction.editReply({ embeds: [helpEmbed] });
    return;
  }

  // Check NSFW content and server settings
  const explicitNSFWKeywords = getExplicitNSFWKeywords();
  const promptLower = prompt.toLowerCase();
  const containsNSFWKeywords = explicitNSFWKeywords.some(keyword =>
    promptLower.includes(keyword),
  );

  // Calculate account age and channel NSFW status
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

    // If filter is enabled and channel is not NSFW, block the request
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
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // If channel is not NSFW but filter is disabled, warn but allow
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
      await interaction.editReply({ embeds: [warningEmbed] });
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
      await interaction.editReply({ embeds: [warningEmbed] });
      await new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 2000);
      });
    }
  }

  // Check user credits
  const creditInfo = await CreditManager.checkUserCredits(
    interaction.user.id,
    options,
  );
  const { userData, creditsNeeded } = creditInfo;

  if (userData.credits < creditsNeeded) {
    const coreEmbed = createCoreEmbed(
      interaction,
      userData,
      creditsNeeded,
      prompt,
    );
    await interaction.editReply({ embeds: [coreEmbed] });
    return;
  }

  // Send loading embed
  let loadingEmbed = createLoadingEmbed(interaction, prompt, artStyle);
  await interaction.editReply({
    embeds: [loadingEmbed],
  });

  // Progress callback to update embed with status messages
  const progressCallback = async status => {
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

    // Check for content moderation blocks
    if (avatarData.imageBuffer.length < 1000) {
      logger.error(
        `[avatar] Content moderation block detected for user ${interaction.user.id}: image buffer is only ${avatarData.imageBuffer.length} bytes`,
      );
      throw new Error(
        "The AI provider blocked image generation due to content moderation. The prompt was detected as inappropriate and the provider refused to generate the image. Try using a less explicit prompt.",
      );
    }

    // Deduct credits on success
    const deductionResult = await CreditManager.deductCredits(
      interaction.user.id,
      creditsNeeded,
      options,
    );
    const deductionBreakdown = deductionResult.deductionBreakdown;

    // Create attachment
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

    // For NSFW content in NSFW channels, send image as follow-up
    const shouldUseFollowUp = containsNSFWKeywords && channelNSFW;

    if (shouldUseFollowUp) {
      await interaction.editReply({ embeds: [successEmbed] });
      await interaction.followUp({ files: [attachment] });
    } else {
      await interaction.editReply({
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
      getUserFacingErrorMessage(error),
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
