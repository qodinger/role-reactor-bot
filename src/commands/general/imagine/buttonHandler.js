import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { concurrencyManager } from "../../../utils/ai/concurrencyManager.js";
import { multiProviderAIService } from "../../../utils/ai/multiProviderAIService.js";
import {
  checkAIImageCredits,
  checkAndDeductAIImageCredits,
} from "../../../utils/ai/aiCreditManager.js";
import { getUserFacingErrorMessage } from "../../../utils/ai/errorMessages.js";
import {
  createImagineProcessingEmbed,
  createImagineResultEmbed,
  createImagineErrorEmbed,
  createRegenerateButton,
} from "./embeds.js";
import { enhancePromptIntelligently } from "../../../utils/ai/promptIntelligence.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

const logger = getLogger();

/**
 * Handle Imagine buttons (Regenerate, Upscale)
 */
export async function handleImagineButton(interaction) {
  const { customId } = interaction;

  // 1. Determine action
  const isUpscale = customId.startsWith("imagine_upscale_");

  if (isUpscale) {
    return handleUpscaleRequest(interaction);
  }

  // Handle Regenerate
  await interaction.deferReply({ ephemeral: false });

  // Format: imagine_regenerate_{aspectRatio}
  const match = customId.match(/^imagine_regenerate_(.+)$/);
  const aspectRatio = match ? match[1] : "1:1";

  // Extract original prompt from embed
  const originalEmbed = interaction.message.embeds[0];
  const promptMatch = originalEmbed?.description?.match(
    /\*\*Prompt Preview\*\*\n(.+?)(?:\n|$)/s,
  );
  const originalPrompt = promptMatch ? promptMatch[1].trim() : "AI Image";

  // Get current session model/provider if possible, otherwise use service defaults
  // For simplicity, we'll use the service's default logic for the current provider
  const isNSFW =
    originalEmbed?.fields?.some(
      f => f.name === "Content Type" && f.value === "`NSFW`",
    ) || false;
  const targetProvider = multiProviderAIService.getImageProvider(isNSFW);
  const targetModel = isNSFW
    ? "animagine-xl-4.0-opt.safetensors"
    : "sd3.5-large-turbo";

  const creditInfo = await checkAIImageCredits(
    interaction.user.id,
    targetProvider,
    targetModel,
  );
  const { userData, creditsNeeded, hasCredits } = creditInfo;

  if (!hasCredits) {
    const errorEmbed = createImagineErrorEmbed({
      interaction,
      prompt: originalPrompt,
      error: `Insufficient credits. You need **${creditsNeeded} Core** to regenerate. Your balance: **${userData.credits || 0} Core**.`,
    });
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  let processingEmbed = createImagineProcessingEmbed({
    prompt: originalPrompt,
    status: "🔄 Creating variations...",
    interaction,
  });
  await interaction.editReply({ embeds: [processingEmbed] });

  const progressCallbackFn = async status => {
    try {
      processingEmbed = createImagineProcessingEmbed({
        prompt: originalPrompt,
        status,
        interaction,
      });
      await interaction.editReply({ embeds: [processingEmbed] });
    } catch (error) {
      logger.debug(
        "[imagine button] Failed to update progress message:",
        error,
      );
    }
  };

  const requestId = `imagine-button-${interaction.id}`;
  const startTime = Date.now();

  try {
    // Re-enhance prompt (or keep original)
    const enhancedPrompt = enhancePromptIntelligently(
      originalPrompt,
      targetModel,
      { isNSFW },
    );

    const result = await concurrencyManager.queueRequest(
      requestId,
      async () =>
        multiProviderAIService.generate({
          type: "image",
          prompt: enhancedPrompt,
          provider: targetProvider,
          config: {
            safetyTolerance: 6,
            aspectRatio,
            isNSFW,
            model: targetModel,
          },
          progressCallback: progressCallbackFn,
        }),
      { userId: interaction.user.id },
    );

    if (!result?.imageBuffer) {
      throw new Error("Generation completed but no image was received.");
    }

    // Deduct credits
    await checkAndDeductAIImageCredits(
      interaction.user.id,
      targetProvider,
      targetModel,
    );

    const attachment = new AttachmentBuilder(result.imageBuffer, {
      name: `imagine-variation-${Date.now()}.png`,
    });

    const successEmbed = createImagineResultEmbed({
      prompt: originalPrompt,
      interaction,
      seed: result.seed,
      aspectRatio,
      model: targetModel,
      provider: result.provider,
      nsfw: isNSFW,
    });

    await interaction.editReply({
      embeds: [successEmbed],
      files: [attachment],
      components: [createRegenerateButton(aspectRatio)],
    });

    logger.info(
      `✅ Imagine variation completed for ${interaction.user.id} in ${Date.now() - startTime}ms`,
    );
  } catch (error) {
    logger.error(`❌ Imagine button failed: ${error.message}`);
    const errorEmbed = createImagineErrorEmbed({
      interaction,
      prompt: originalPrompt,
      error: getUserFacingErrorMessage(error),
    });
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Handle Upscale Request (Placeholder/Phase 4)
 */
async function handleUpscaleRequest(interaction) {
  const embed = new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.STATUS.WARNING} AI Upscaling (4K)`)
    .setDescription(
      "The **Ultra-HD 4K Upscaling** feature is currently undergoing maintenance to provide even better quality results.\n\nThis will be available to all users in the next update!",
    )
    .setFooter({ text: "Image Generator • Role Reactor" })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
