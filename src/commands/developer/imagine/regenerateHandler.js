import { AttachmentBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
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
import { enhanceImaginePrompt } from "../../../config/prompts/imagePrompts.js";
import { ImagineGenerationHistory } from "./utils/generationHistory.js";

const logger = getLogger();

export async function handleImagineRegenerate(interaction) {
  if (!isDeveloper(interaction.user.id)) {
    logger.warn("Permission denied for imagine regenerate command", {
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
    });
    await interaction.reply({
      content:
        "❌ **Permission Denied**\nYou need developer permissions to use this feature.",
      flags: 64, // Ephemeral
    });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  const customId = interaction.customId;
  // Format: imagine_regenerate_{aspectRatio}
  const match = customId.match(/^imagine_regenerate_(.+)$/);

  if (!match) {
    logger.error(`Invalid regenerate button customId format: ${customId}`);
    await interaction.editReply({
      content:
        "❌ An internal error occurred. Please try generating a new image.",
      flags: 64, // Ephemeral
    });
    return;
  }

  const aspectRatio = match[1];

  // Extract original prompt from embed description
  const originalEmbed = interaction.message.embeds[0];
  const promptMatch = originalEmbed?.description?.match(
    /\*\*Prompt Preview\*\*\n(.+?)(?:\n|$)/s,
  );
  const originalPrompt = promptMatch ? promptMatch[1].trim() : null;

  if (!originalPrompt) {
    logger.error("Could not extract prompt from embed");
    await interaction.editReply({
      content:
        "❌ Could not find the original prompt. Please try generating a new image.",
      flags: 64, // Ephemeral
    });
    return;
  }

  // Get provider and model for credit calculation
  let provider = "stability"; // Default
  let model = "sd3.5-large-turbo"; // Default

  try {
    const { getAIConfig } = await import("../../../config/ai.js");
    const aiConfig = getAIConfig();
    const feature = aiConfig.models?.features?.imagineGeneral; // Default to general for regenerate
    if (feature) {
      provider = feature.provider || provider;
      model = feature.model || model;
    }
  } catch (_error) {
    // Use defaults if config loading fails
  }

  const creditInfo = await checkAIImageCredits(
    interaction.user.id,
    provider,
    model,
  );
  const { userData, creditsNeeded, hasCredits } = creditInfo;

  // Log the credit calculation for transparency
  logger.info(
    `💰 Cost calculation for user ${interaction.user.id}: ${provider}/${model} = ${creditsNeeded} Core credits`,
  );

  if (!hasCredits) {
    const errorEmbed = createImagineErrorEmbed({
      interaction,
      prompt: originalPrompt,
      error: `Insufficient credits. You need **${creditsNeeded} Core** to generate images. Your balance: **${userData.credits || 0} Core**.`,
    });
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  let processingEmbed = createImagineProcessingEmbed({
    prompt: originalPrompt,
    status: "Regenerating image...",
    interaction,
  });
  await interaction.editReply({
    embeds: [processingEmbed],
  });

  const progressCallback = async status => {
    try {
      processingEmbed = createImagineProcessingEmbed({
        prompt: originalPrompt,
        status,
        interaction,
      });
      await interaction.editReply({
        embeds: [processingEmbed],
      });
    } catch (error) {
      logger.debug(
        "[imagine regenerate] Failed to update progress message:",
        error,
      );
    }
  };

  const requestId = `imagine-regenerate-${interaction.id}`;
  const startTime = Date.now();

  try {
    // Enhance prompt with quality improvements (preserves user intent)
    const enhancedPrompt = enhanceImaginePrompt(originalPrompt);

    const result = await concurrencyManager.queueRequest(
      requestId,
      async () =>
        multiProviderAIService.generate({
          type: "image",
          prompt: enhancedPrompt,
          config: {
            safetyTolerance: 6, // Same as initial generation
            useAvatarPrompts: false,
            aspectRatio,
            // Don't pass seed - let it generate a new random seed for variation
          },
          progressCallback,
        }),
      {
        userId: interaction.user.id,
      },
    );

    if (!result?.imageBuffer) {
      throw new Error(
        "Image regeneration completed but no image was received. Please try again.",
      );
    }

    // ONLY deduct credits after successful image generation and validation
    const deductionResult = await checkAndDeductAIImageCredits(
      interaction.user.id,
      provider,
      model,
    );
    if (!deductionResult.success) {
      logger.error(
        `Failed to deduct credits after successful regenerate for user ${interaction.user.id}: ${deductionResult.error}`,
      );
      // Continue anyway since image was generated successfully
    } else {
      logger.info(
        `✅ Deducted ${deductionResult.creditsDeducted} Core from user ${interaction.user.id} for ${provider}/${model} regeneration (${deductionResult.creditsRemaining} remaining)`,
      );
    }

    const attachment = new AttachmentBuilder(result.imageBuffer, {
      name: `imagine-regenerated-${interaction.user.id}-${Date.now()}.png`,
    });

    const durationMs = Date.now() - startTime;

    const successEmbed = createImagineResultEmbed({
      prompt: originalPrompt,
      interaction,
      seed: result.seed,
      aspectRatio,
    });

    // Add regenerate button
    const components = [createRegenerateButton(aspectRatio)];

    await interaction.editReply({
      embeds: [successEmbed],
      files: [attachment],
      components,
    });

    logger.info(
      `Imagine regenerate command completed in ${durationMs}ms for developer ${interaction.user.id}`,
      {
        userId: interaction.user.id,
        provider: result.provider,
        model: result.model,
        seed: result.seed,
        aspectRatio,
      },
    );

    // Record successful regeneration
    await ImagineGenerationHistory.recordGeneration(interaction.user.id, {
      prompt: enhancedPrompt,
      provider: result.provider,
      model: result.model,
      config: {
        safetyTolerance: 6,
        aspectRatio,
        seed: result.seed,
      },
    });
  } catch (error) {
    logger.error(
      `Imagine regenerate command failed for developer ${interaction.user.id}: ${error.message}`,
      error,
    );

    const errorEmbed = createImagineErrorEmbed({
      interaction,
      prompt: originalPrompt,
      error: getUserFacingErrorMessage(error, {
        includeContentModeration: false,
      }),
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
