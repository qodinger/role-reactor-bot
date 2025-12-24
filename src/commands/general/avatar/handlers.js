import { AttachmentBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { generateAvatar as generateAIAvatar } from "../../../utils/ai/avatarService.js";
import { multiProviderAIService } from "../../../utils/ai/multiProviderAIService.js";
import { CreditManager } from "./utils/creditManager.js";
import { InteractionHandler } from "./utils/interactionHandler.js";
import { GenerationHistory } from "./utils/generationHistory.js";
import {
  createErrorEmbed,
  createCoreEmbed,
  createHelpEmbed,
  createLoadingEmbed,
  createSuccessEmbed,
  createWarningEmbed,
} from "./embeds.js";
import {
  validatePrompt,
  formatGenerationTime,
  getExplicitNSFWKeywords,
} from "./utils.js";

const logger = getLogger();

/**
 * Handle avatar generation
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {Object} options - Optional dependencies for testing
 * @param {Function} options.getStorageManager - Optional storage manager getter
 */
export async function handleAvatarGeneration(
  interaction,
  _client,
  options = {},
) {
  const startTime = Date.now();
  const userId = interaction.user.id;
  const prompt = interaction.options.getString("prompt");
  const artStyle = interaction.options.getString("art_style") || null;

  logger.debug(
    `[avatar] Starting generation for user ${userId} | prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}" | style: ${artStyle || "none"}`,
  );

  try {
    // Check if AI features are enabled
    if (!multiProviderAIService.isEnabled()) {
      const errorEmbed = createErrorEmbed(
        interaction,
        "AI Features Disabled",
        "AI features are currently disabled. All providers are disabled in the configuration. Please contact the bot administrator.",
      );
      return await interaction.editReply({ embeds: [errorEmbed] });
    }

    // Validate prompt
    const validation = validatePrompt(prompt);
    if (!validation.isValid) {
      const errorEmbed = createErrorEmbed(
        interaction,
        "Check your prompt",
        validation.reason,
      );
      return await interaction.editReply({ embeds: [errorEmbed] });
    }

    // Check for help request
    if (prompt.toLowerCase().includes("help")) {
      const helpEmbed = createHelpEmbed();
      return await interaction.editReply({ embeds: [helpEmbed] });
    }

    // Check NSFW content and server settings
    const explicitNSFWKeywords = getExplicitNSFWKeywords();
    const promptLower = prompt.toLowerCase();
    const containsNSFWKeywords = explicitNSFWKeywords.some(keyword =>
      promptLower.includes(keyword),
    );

    // Calculate account age and channel NSFW status (used for NSFW checks and logging)
    const user = interaction.user;
    const guild = interaction.guild;
    const channelNSFW = interaction.channel?.nsfw === true;
    const accountAge = user.createdAt
      ? Date.now() - user.createdAt.getTime()
      : 0;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

    if (containsNSFWKeywords) {
      const isNewAccount = accountAgeDays < 30; // Less than 30 days old

      // Check server's explicit content filter
      // 0 = DISABLED, 1 = MEMBERS_WITHOUT_ROLES, 2 = ALL_MEMBERS
      const explicitContentFilter = guild?.explicitContentFilter ?? 0;
      const filterEnabled = explicitContentFilter > 0;

      // Check if server is a Community Server (cannot disable filter)
      const isCommunityServer = guild?.features?.includes("COMMUNITY") ?? false;

      // Build user settings message (only required settings)
      const userSettingsMessage = `\n**⚠️ Required user setting:**\nYour account must be **age-verified (18+)** to view NSFW content.\nIf not verified, visit: https://dis.gd/request`;

      // If filter is enabled and channel is not NSFW, block the request
      if (filterEnabled && !channelNSFW) {
        let errorMessage = `This server has **Explicit Content Filter** enabled, and this channel is not marked as NSFW.\n\n**To generate NSFW avatars:**\n1. **Use a channel marked as NSFW (🔞)** - This is the only option for Community Servers\n`;

        if (isCommunityServer) {
          errorMessage += `\n**⚠️ Community Server Limitation:**\nThis server is a **Community Server**, which means the Explicit Content Filter **cannot be disabled**. Discord requires Community Servers to filter content for safety.\n\n**Solution:** You must use an **NSFW channel (🔞)** to generate NSFW avatars. Mark a channel as NSFW in:\n**Channel Settings** → **Overview** → **Age-Restricted Channel** → **Enable**`;
        } else {
          errorMessage += `2. Ask a server administrator to disable the Explicit Content Filter in:\n   **Server Settings** → **Safety** → **Explicit Content Filter** → **Don't scan any media content**\n\n**Note:** Even with the filter disabled, NSFW content should only be generated in NSFW channels.`;
        }

        // Add user settings check if account is new
        if (isNewAccount) {
          errorMessage += `\n\n**⚠️ Your account is less than 30 days old.**\nMake sure your account is age-verified (18+).`;
        }

        errorMessage += userSettingsMessage;

        const errorEmbed = createErrorEmbed(
          interaction,
          "NSFW Content Not Allowed",
          errorMessage,
        );
        return await interaction.editReply({ embeds: [errorEmbed] });
      }

      // If channel is not NSFW but filter is disabled, warn but allow
      if (!channelNSFW && !filterEnabled) {
        let warningMessage = `You're generating NSFW content in a non-NSFW channel.\n\n**Recommendation:** Use a channel marked as NSFW (🔞) for NSFW content to avoid issues with Discord's content detection.`;

        // Add user settings check if account is new
        if (isNewAccount) {
          warningMessage += `\n\n**⚠️ Your account is less than 30 days old.**\nMake sure your account is age-verified (18+).`;
        }

        warningMessage += userSettingsMessage;

        const warningEmbed = createWarningEmbed(
          interaction,
          "NSFW Content Warning",
          warningMessage,
        );
        // Show warning but continue (don't return)
        await interaction.editReply({ embeds: [warningEmbed] });
        // Wait a moment for user to see the warning
        await new Promise(resolve => {
          setTimeout(() => resolve(), 2000);
        });
      } else if (channelNSFW && isNewAccount) {
        // Even in NSFW channels, warn new accounts about settings
        const warningEmbed = createWarningEmbed(
          interaction,
          "Account Verification Reminder",
          `**Your account is less than 30 days old.**\n\nTo ensure NSFW images display correctly, your account must be **age-verified (18+)**.\n\n${userSettingsMessage}`,
        );
        // Show warning but continue (don't return)
        await interaction.editReply({ embeds: [warningEmbed] });
        // Wait a moment for user to see the warning
        await new Promise(resolve => {
          setTimeout(() => resolve(), 2000);
        });
      }
    }

    // Check user credits (pass options for dependency injection)
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
      return await interaction.editReply({ embeds: [coreEmbed] });
    }

    // Send loading embed
    let loadingEmbed = createLoadingEmbed(interaction, prompt, artStyle);
    await interaction.editReply({
      embeds: [loadingEmbed],
    });

    // Progress callback to update embed with status messages
    const progressCallback = async status => {
      try {
        loadingEmbed = createLoadingEmbed(
          interaction,
          prompt,
          artStyle,
          status,
        );
        await interaction.editReply({
          embeds: [loadingEmbed],
        });
      } catch (error) {
        // Ignore edit errors (e.g., interaction expired)
        logger.debug(
          `[avatar] Progress update failed for user ${userId}:`,
          error.message,
        );
      }
    };

    // Generate the avatar
    const aiStartTime = Date.now();

    let avatarData;
    let generationSuccess = false;
    let generationError = null;
    let provider = null;
    let model = null;

    try {
      avatarData = await generateAIAvatar(
        prompt,
        false, // showDebugPrompt
        interaction.user.id,
        { artStyle }, // style options
        progressCallback, // Progress callback for status updates
        userData, // Core user data for rate limiting
      );

      if (!avatarData || !avatarData.imageBuffer) {
        throw new Error("Failed to generate avatar image");
      }

      // Validate image buffer
      if (!Buffer.isBuffer(avatarData.imageBuffer)) {
        throw new Error("Invalid image buffer: expected Buffer object");
      }

      if (avatarData.imageBuffer.length === 0) {
        throw new Error("Invalid image buffer: buffer is empty");
      }

      // Check for content moderation blocks (2-byte placeholder is common)
      // Valid images should be at least several KB
      if (avatarData.imageBuffer.length < 1000) {
        const sizeKB = (avatarData.imageBuffer.length / 1024).toFixed(2);
        logger.error(
          `[avatar] Content moderation block detected for user ${userId}: image buffer is only ${avatarData.imageBuffer.length} bytes (${sizeKB}KB)`,
        );
        throw new Error(
          "The AI provider blocked image generation due to content moderation. The prompt was detected as inappropriate and the provider refused to generate the image. Try using a less explicit prompt.",
        );
      }

      generationSuccess = true;
      provider = avatarData.provider || null;
      model = avatarData.model || null;
      const generationTime = Date.now() - aiStartTime;
      logger.debug(
        `[avatar] Generation completed for user ${userId} | provider: ${provider || "unknown"} | model: ${model || "unknown"} | time: ${generationTime}ms | size: ${(avatarData.imageBuffer.length / 1024).toFixed(1)}KB`,
      );
    } catch (error) {
      generationSuccess = false;
      generationError = error.message;
      logger.error(
        `[avatar] Generation failed for user ${userId} after ${Date.now() - aiStartTime}ms: ${error.message}`,
      );
      throw error;
    } finally {
      // Record generation history for debugging/support
      const processingTime = Date.now() - aiStartTime;
      await GenerationHistory.recordGeneration(interaction.user.id, {
        prompt,
        success: generationSuccess,
        error: generationError,
        processingTime,
        provider,
        model,
        config: { artStyle: artStyle || null },
        userTier: userData.isCore
          ? userData.coreTier || "Core Basic"
          : "Regular",
      });
    }

    // Deduct credits only on success
    let deductionBreakdown = null;
    if (generationSuccess) {
      const deductionResult = await CreditManager.deductCredits(
        interaction.user.id,
        creditsNeeded,
        options,
      );
      deductionBreakdown = deductionResult.deductionBreakdown;
    }

    // Create final attachment
    // Use a very generic filename for NSFW content to avoid detection
    // For NSFW content in NSFW channels, use the most generic filename possible
    const fileName =
      containsNSFWKeywords && channelNSFW
        ? `image.png` // Most generic name possible for NSFW in NSFW channels
        : `ai-avatar-${interaction.user.id}-${Date.now()}.png`; // Normal name otherwise

    const attachment = new AttachmentBuilder(avatarData.imageBuffer, {
      name: fileName,
    });

    // Mark as spoiler ONLY in non-NSFW channels
    // In NSFW channels, don't mark as spoiler - users expect to see NSFW content there
    // The spoiler flag causes blur and requires clicking to reveal, which we don't want in NSFW channels
    if (containsNSFWKeywords && !channelNSFW) {
      attachment.setSpoiler(true);
    }

    // Send final result with success embed
    const successEmbed = createSuccessEmbed(
      interaction,
      prompt,
      artStyle,
      deductionBreakdown,
      containsNSFWKeywords && channelNSFW,
    );

    // For NSFW content in NSFW channels, send image as follow-up to avoid detection
    // This mimics how users upload images (separate message) and may bypass Discord's scanning
    const shouldUseFollowUp = containsNSFWKeywords && channelNSFW;

    try {
      if (shouldUseFollowUp) {
        // Update loading message with success embed, then send image separately
        await interaction.editReply({ embeds: [successEmbed] });
        await interaction.followUp({ files: [attachment] });
        logger.debug(
          `[avatar] NSFW image sent as follow-up for user ${userId} | size: ${(avatarData.imageBuffer.length / 1024).toFixed(1)}KB`,
        );
      } else {
        // Normal flow: send embed and image together
        await interaction.editReply({
          embeds: [successEmbed],
          files: [attachment],
        });
      }

      // Log completion
      const imageSizeKB = (avatarData.imageBuffer.length / 1024).toFixed(1);
      if (containsNSFWKeywords) {
        logger.debug(
          `[avatar] Image sent for user ${userId} | NSFW: true | channel NSFW: ${channelNSFW} | spoiler: ${attachment.spoiler || false} | account age: ${accountAgeDays}d | size: ${imageSizeKB}KB`,
        );
      } else {
        logger.debug(
          `[avatar] Image sent for user ${userId} | size: ${imageSizeKB}KB | provider: ${provider || "unknown"}`,
        );
      }
    } catch (error) {
      // Handle Discord API errors (file size, content filter, etc.)
      const isFileError =
        error.message?.includes("file") ||
        error.message?.includes("size") ||
        error.message?.includes("invalid") ||
        error.code === 50035;

      if (isFileError) {
        logger.warn(
          `[avatar] Discord API rejected upload for user ${userId} | size: ${(avatarData.imageBuffer.length / 1024).toFixed(1)}KB | error: ${error.message}`,
        );
        // Try sending embed and file separately as fallback
        try {
          await interaction.editReply({ embeds: [successEmbed] });
          await interaction.followUp({ files: [attachment] });
          logger.debug(
            `[avatar] Sent image as follow-up fallback for user ${userId}`,
          );
        } catch (fallbackError) {
          logger.error(
            `[avatar] Fallback send failed for user ${userId}: ${fallbackError.message}`,
          );
          throw error;
        }
      } else if (interaction.deferred && !interaction.replied) {
        // Interaction expired, try followUp
        await interaction.followUp({
          embeds: [successEmbed],
          files: [attachment],
        });
      } else {
        throw error;
      }
    }

    const totalTime = formatGenerationTime(startTime, Date.now());
    logger.info(
      `[avatar] Completed for user ${userId} | total time: ${totalTime} | provider: ${provider || "unknown"}`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      `[avatar] Failed for user ${userId} after ${duration}ms: ${error.message}`,
      error,
    );

    if (!InteractionHandler.handleApiError(error, interaction)) {
      return;
    }

    const errorEmbed = createErrorEmbed(
      interaction,
      "Unable to generate avatar",
      "An unexpected error occurred while generating your avatar. Please try again later.",
    );

    await InteractionHandler.safeReply(interaction, { embeds: [errorEmbed] });
  }
}
