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
  createImagineValidationEmbed,
  createRegenerateButton,
} from "./embeds.js";
import { validatePrompt, parseInlineParameters } from "./utils.js";
import { ImagineGenerationHistory } from "./utils/generationHistory.js";
import { enhanceImaginePrompt } from "../../../config/prompts/imagePrompts.js";

const logger = getLogger();

export async function handleImagineCommand(
  interaction,
  _client,
  deferred = true,
) {
  if (!isDeveloper(interaction.user.id)) {
    logger.warn("Permission denied for imagine command", {
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
    });

    const response = {
      content:
        "❌ **Permission Denied**\nYou need developer permissions to use this command.",
      flags: 64, // Ephemeral
    };

    if (deferred) {
      await interaction.editReply(response);
    } else {
      await interaction.reply(response);
    }
    return;
  }

  const promptOption = interaction.options.getString("prompt", true);

  // Parse inline parameters (--ar, --seed, etc.)
  const {
    prompt: rawPrompt,
    aspectRatio,
    seed,
  } = parseInlineParameters(promptOption);

  // Safety tolerance: 6 = most permissive (default for Stability AI)
  const safetyTolerance = 6;

  if (!multiProviderAIService.isEnabled()) {
    const validationEmbed = createImagineValidationEmbed(
      "AI features are currently disabled. All AI services are unavailable.",
    );
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  const validation = validatePrompt(rawPrompt);
  if (!validation.isValid) {
    const validationEmbed = createImagineValidationEmbed(validation.reason);
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  // Enhance prompt with quality improvements (preserves user intent)
  const prompt = enhanceImaginePrompt(validation.prompt);
  // Use original prompt for display in embeds (not the enhanced one)
  const originalPrompt = validation.prompt;

  const creditInfo = await checkAIImageCredits(interaction.user.id);
  const { userData, creditsNeeded, hasCredits } = creditInfo;

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
    interaction,
  });
  await interaction.editReply({
    embeds: [processingEmbed],
  });

  // Progress callback to update embed with status messages
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
      // Ignore edit errors (e.g., interaction expired)
      logger.debug("[imagine] Failed to update progress message:", error);
    }
  };

  const startTime = Date.now();
  const requestId = `imagine-${interaction.id}`;

  logger.info(
    `[IMAGINE] User: ${interaction.user.id} | Original: "${validation.prompt}" | Enhanced: "${prompt}" | Safety: ${safetyTolerance}`,
  );

  try {
    const result = await concurrencyManager.queueRequest(
      requestId,
      async () =>
        multiProviderAIService.generate({
          type: "image",
          prompt,
          config: {
            safetyTolerance,
            useAvatarPrompts: false, // Don't use avatar-specific prompts from imagePrompts.js
            aspectRatio: aspectRatio || "1:1", // Default to 1:1 (square) for versatility
            seed: seed !== null ? seed : undefined, // Only set if provided
          },
          progressCallback,
        }),
      {
        userId: interaction.user.id,
      },
    );

    if (!result?.imageBuffer) {
      throw new Error(
        "Image generation completed but no image was received. Please try again.",
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

    const attachment = new AttachmentBuilder(result.imageBuffer, {
      name: `imagine-${interaction.user.id}-${Date.now()}.png`,
    });

    const durationMs = Date.now() - startTime;

    // Get seed from result if available, otherwise use the provided seed or generate one
    const generatedSeed =
      result.seed !== undefined ? result.seed : seed !== null ? seed : null;
    const currentAspectRatio = aspectRatio || "1:1";

    const successEmbed = createImagineResultEmbed({
      prompt: originalPrompt,
      interaction,
      seed: generatedSeed,
      aspectRatio: currentAspectRatio,
    });

    // Add regenerate button
    const { ActionRowBuilder } = await import("discord.js");
    const components = [
      new ActionRowBuilder().addComponents(
        createRegenerateButton(currentAspectRatio).components[0],
      ),
    ];

    await interaction.editReply({
      embeds: [successEmbed],
      files: [attachment],
      components,
    });

    logger.info(
      `Imagine command completed in ${durationMs}ms for developer ${interaction.user.id}`,
      {
        userId: interaction.user.id,
        provider: result.provider,
        model: result.model,
      },
    );

    // Record successful generation
    await ImagineGenerationHistory.recordGeneration(interaction.user.id, {
      prompt,
      provider: result.provider,
      model: result.model,
      config: {
        safetyTolerance,
      },
    });
  } catch (error) {
    logger.error(
      `Imagine command failed for developer ${interaction.user.id}: ${error.message}`,
      error,
    );

    const errorEmbed = createImagineErrorEmbed({
      interaction,
      prompt: originalPrompt,
      error: getUserFacingErrorMessage(error, {
        includeContentModeration: false,
      }),
    });

    try {
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (editError) {
      // If edit fails, try a new reply instead
      logger.error(
        `Failed to edit reply with error embed: ${editError.message}`,
      );
      try {
        await interaction.followUp({ embeds: [errorEmbed] });
      } catch (followUpError) {
        logger.error(
          `Failed to send error message via followUp: ${followUpError.message}`,
        );
      }
    }
  }
}
