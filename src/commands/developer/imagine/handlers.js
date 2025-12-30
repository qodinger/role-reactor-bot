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
} from "./embeds.js";
import { validatePrompt } from "./utils.js";
import { ImagineGenerationHistory } from "./utils/generationHistory.js";

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

  // Safety tolerance: 6 = most permissive (default for Stability AI)
  const safetyTolerance = 6;

  if (!multiProviderAIService.isEnabled()) {
    const validationEmbed = createImagineValidationEmbed(
      "AI features are currently disabled. All providers are disabled in the configuration. Please contact the bot administrator.",
    );
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  const validation = validatePrompt(promptOption);
  if (!validation.isValid) {
    const validationEmbed = createImagineValidationEmbed(validation.reason);
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  const prompt = validation.prompt;

  const creditInfo = await checkAIImageCredits(interaction.user.id);
  const { userData, creditsNeeded, hasCredits } = creditInfo;

  if (!hasCredits) {
    const errorEmbed = createImagineErrorEmbed({
      interaction,
      prompt,
      error: `Insufficient credits. You need **${creditsNeeded} Core** to generate images. Your balance: **${userData.credits || 0} Core**.`,
    });
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  let processingEmbed = createImagineProcessingEmbed({
    prompt,
    interaction,
  });
  await interaction.editReply({
    embeds: [processingEmbed],
  });

  // Progress callback to update embed with status messages
  const progressCallback = async status => {
    try {
      processingEmbed = createImagineProcessingEmbed({
        prompt,
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

  try {
    const result = await concurrencyManager.queueRequest(
      requestId,
      async () =>
        multiProviderAIService.generate({
          type: "image",
          prompt,
          config: {
            safetyTolerance,
          },
          progressCallback,
        }),
      {
        userId: interaction.user.id,
      },
    );

    if (!result?.imageBuffer) {
      throw new Error("Image data was missing from the provider response.");
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

    const successEmbed = createImagineResultEmbed({
      prompt,
      interaction,
    });

    await interaction.editReply({
      embeds: [successEmbed],
      files: [attachment],
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
      prompt,
      error: getUserFacingErrorMessage(error, {
        includeContentModeration: false,
      }),
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
