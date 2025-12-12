import { AttachmentBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { concurrencyManager } from "../../../utils/ai/concurrencyManager.js";
import { multiProviderAIService } from "../../../utils/ai/multiProviderAIService.js";
import {
  createImagineProcessingEmbed,
  createImagineResultEmbed,
  createImagineErrorEmbed,
  createImagineValidationEmbed,
} from "./embeds.js";
import { validatePrompt } from "./utils.js";

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

  return message;
}

export async function handleImagineCommand(
  interaction,
  _client,
  deferred = true,
) {
  // Check developer permissions
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

  // Check if AI features are enabled
  if (!multiProviderAIService.isEnabled()) {
    const validationEmbed = createImagineValidationEmbed(
      "AI features are currently disabled. All providers are disabled in the configuration. Please contact the bot administrator.",
    );
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  // Validate prompt
  const validation = validatePrompt(promptOption);
  if (!validation.isValid) {
    const validationEmbed = createImagineValidationEmbed(validation.reason);
    await interaction.editReply({ embeds: [validationEmbed] });
    return;
  }

  const prompt = validation.prompt;

  await interaction.editReply({
    embeds: [
      createImagineProcessingEmbed({
        prompt,
      }),
    ],
  });

  const startTime = Date.now();
  const requestId = `imagine-${interaction.id}`;

  try {
    const result = await concurrencyManager.queueRequest(
      requestId,
      async () =>
        multiProviderAIService.generate({
          type: "image",
          prompt,
          config: {},
        }),
      {
        userId: interaction.user.id,
      },
    );

    if (!result?.imageBuffer) {
      throw new Error("Image data was missing from the provider response.");
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
  } catch (error) {
    logger.error(
      `Imagine command failed for developer ${interaction.user.id}: ${error.message}`,
      error,
    );

    const errorEmbed = createImagineErrorEmbed({
      prompt,
      error: getUserFacingErrorMessage(error),
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
