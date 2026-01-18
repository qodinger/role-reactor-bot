import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
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
  createImagineValidationEmbed,
  createNSFWValidationEmbed,
  createRegenerateButton,
} from "./embeds.js";
import { validatePrompt, parseInlineParameters } from "./utils.js";
import { ImagineGenerationHistory } from "./utils/generationHistory.js";
import {
  enhanceImaginePrompt,
  getImagineNegativePrompt,
} from "../../../config/prompts/imagePrompts.js";
import {
  validateNSFWProduction,
  logNSFWGeneration,
} from "../../../utils/discord/nsfwSafety.js";
import {
  enhancePromptIntelligently,
  analyzeNSFWContent,
  getPromptSuggestions,
} from "../../../utils/ai/promptIntelligence.js";

/**
 * Get preferred provider for NSFW content generation
 * Prefers ComfyUI/RunPod for detailed control and permissive content policies
 * @returns {string|null} Preferred provider or null for auto-selection
 */
function getPreferredNSFWProvider() {
  // For NSFW: prefer ComfyUI (self-hosted, most control) > RunPod (serverless ComfyUI)
  return null; // Let the system auto-select from ComfyUI/RunPod based on availability
}

/**
 * Get preferred provider for safe content generation
 * Prefers Stability AI/OpenRouter for clean, fast, professional results
 * @returns {string|null} Preferred provider or null for auto-selection
 */
function getPreferredSafeProvider() {
  // For safe content: prefer Stability AI (fast, clean) > OpenRouter (versatile)
  return null; // Let the system auto-select from Stability/OpenRouter based on availability
}

const logger = getLogger();

export async function handleImagineCommand(interaction, _client) {
  const promptOption = interaction.options.getString("prompt", true);
  const selectedModel = interaction.options.getString("model");
  const selectedAspectRatio = interaction.options.getString("aspect_ratio");
  const attachment = interaction.options.getAttachment("image");

  // Parse inline parameters (--ar, --model, --nsfw)
  const {
    prompt: rawPrompt,
    aspectRatio: inlineAspectRatio,
    model: inlineModel,
    nsfw: userRequestedNSFW,
  } = parseInlineParameters(promptOption);

  // Merge slash command options with inline parameters (slash options take precedence)
  const model = selectedModel || inlineModel;
  const aspectRatio = selectedAspectRatio || inlineAspectRatio;

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

  // Validate NSFW content with production safety checks
  // If user explicitly requested NSFW with --nsfw flag, treat as NSFW content
  const nsfwValidation = await validateNSFWProduction(
    validation.prompt,
    interaction.channel,
    interaction.guild,
    userRequestedNSFW, // Pass user's explicit NSFW request
  );
  if (!nsfwValidation.isAllowed) {
    let embed;
    if (nsfwValidation.severity === "PROHIBITED") {
      embed = new EmbedBuilder()
        .setColor(THEME.ERROR)
        .setTitle(`${EMOJIS.STATUS.ERROR} Content Policy Violation`)
        .setDescription(nsfwValidation.reason)
        .addFields([
          {
            name: "⚠️ Policy Reminder",
            value:
              "Content that violates platform policies or laws cannot be generated. Please modify your prompt to comply with our content guidelines.",
            inline: false,
          },
        ])
        .setFooter({ text: "Image Generator • Role Reactor" })
        .setTimestamp();
    } else if (nsfwValidation.severity === "SERVER_NOT_AGE_RESTRICTED") {
      embed = new EmbedBuilder()
        .setColor(THEME.WARNING)
        .setTitle(`${EMOJIS.STATUS.WARNING} Age-Restricted Server Required`)
        .setDescription(nsfwValidation.reason)
        .addFields([
          {
            name: "💡 For Server Administrators",
            value:
              "Enable age-restriction in Discord's Server Settings > Safety Setup > Age-Restricted Server to allow NSFW image generation.",
            inline: false,
          },
        ])
        .setFooter({ text: "Image Generator • Role Reactor" })
        .setTimestamp();
    } else {
      embed = createNSFWValidationEmbed(nsfwValidation.reason);
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Intelligently enhance the user's prompt for better results
  // This helps users who don't know proper prompt formatting or model-specific keywords
  const modelName = model || "animagine"; // Default to animagine for premium feel
  const intelligentlyEnhanced = enhancePromptIntelligently(
    validation.prompt,
    modelName,
    {
      isNSFW: nsfwValidation.isNSFW,
      aspectRatio: aspectRatio,
    },
  );

  // Analyze if user might need NSFW flag (educational purposes)
  const nsfwAnalysis = analyzeNSFWContent(validation.prompt);
  if (nsfwAnalysis.needsNSFW && !userRequestedNSFW) {
    logger.info(`[IMAGINE] User prompt may need NSFW flag:`, {
      prompt: validation.prompt,
      confidence: nsfwAnalysis.confidence,
      reasons: nsfwAnalysis.reasons,
    });
  }

  // Enhance prompt with quality improvements (preserves user intent)
  // Use NSFW-specific enhancements if content is NSFW
  const prompt = enhanceImaginePrompt(
    intelligentlyEnhanced, // Use the intelligently enhanced prompt
    nsfwValidation.isNSFW,
  );
  // Use original prompt for display in embeds (not the enhanced one)
  const originalPrompt = validation.prompt;

  // Smart provider routing based on content type
  let preferredProvider = null;
  let featureName = null;
  if (nsfwValidation.isNSFW) {
    // For NSFW content: check if NSFW feature is enabled
    featureName = "imagineNSFW";
    const nsfwFeature =
      multiProviderAIService.providerManager?.getFeatureConfig(featureName);
    if (!nsfwFeature || !nsfwFeature.enabled) {
      const errorEmbed = createImagineErrorEmbed({
        interaction,
        prompt: originalPrompt,
        error:
          "NSFW image generation is currently disabled. Only safe content can be generated at this time.",
      });
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
    preferredProvider = getPreferredNSFWProvider();
  } else {
    // For non-NSFW content: prefer Stability AI/OpenRouter (clean, fast, professional)
    preferredProvider = getPreferredSafeProvider();
    featureName = "imagineGeneral";
  }

  logger.info(
    `[IMAGINE] Content type: ${nsfwValidation.isNSFW ? "NSFW" : "Safe"}, Feature: ${featureName}, Preferred provider: ${preferredProvider || "auto"}, User requested NSFW: ${userRequestedNSFW}`,
  );

  // Resolve provider and model for credit calculation BEFORE generation
  let targetProvider = interaction.options.getString("provider"); // Hidden option maybe? No, let's use the service's logic
  if (!targetProvider) {
    targetProvider = multiProviderAIService.getImageProvider(
      nsfwValidation.isNSFW,
    );
  }

  // Get model from feature config (matches MultiProviderAIService logic)
  let targetModel = model;
  if (!targetModel) {
    try {
      const { getAIConfig } = await import("../../../config/ai.js");
      const aiConfig = getAIConfig();
      const feature = nsfwValidation.isNSFW
        ? aiConfig.models.features.imagineNSFW
        : aiConfig.models.features.imagineGeneral;
      targetModel = feature?.model;
      targetProvider =
        feature?.provider !== "auto" ? feature?.provider : targetProvider;
    } catch (_error) {
      targetModel = nsfwValidation.isNSFW
        ? "animagine-xl-4.0-opt.safetensors"
        : "sd3.5-large-turbo";
    }
  }

  // Handle image attachment for image-to-image
  let imageBuffer = null;
  if (attachment) {
    try {
      // Use logger for initial feedback since progressCallbackFn isn't defined yet
      logger.info(
        `[IMAGINE] Downloading source image for user ${interaction.user.id}...`,
      );
      const response = await fetch(attachment.url);
      if (response.ok) {
        imageBuffer = Buffer.from(await response.arrayBuffer());
        logger.info(
          `[IMAGINE] Downloaded source image: ${imageBuffer.length} bytes`,
        );
      }
    } catch (error) {
      logger.error("[IMAGINE] Failed to download attachment:", error);
    }
  }

  const creditInfo = await checkAIImageCredits(
    interaction.user.id,
    targetProvider,
    targetModel,
  );
  const { userData, creditsNeeded, hasCredits } = creditInfo;

  // Log the credit calculation for transparency
  logger.info(
    `💰 Credit calculation for user ${interaction.user.id}: ${targetProvider}/${targetModel} = ${creditsNeeded} Core credits`,
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
    interaction,
  });
  await interaction.editReply({
    embeds: [processingEmbed],
  });

  // Progress callback to update embed with status messages
  const progressCallbackFn = async status => {
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
    `[IMAGINE] User: ${interaction.user.id} | Original: "${validation.prompt}" | Model: ${targetModel} | Provider: ${targetProvider} | NSFW: ${nsfwValidation.isNSFW}`,
  );

  try {
    const result = await concurrencyManager.queueRequest(
      requestId,
      async () =>
        multiProviderAIService.generate({
          type: "image",
          prompt,
          provider: targetProvider,
          config: {
            safetyTolerance,
            useAvatarPrompts: false,
            aspectRatio: aspectRatio || "1:1",
            negativePrompt: getImagineNegativePrompt(nsfwValidation.isNSFW),
            isNSFW: nsfwValidation.isNSFW,
            featureName,
            model: targetModel,
            imageBuffer, // Pass the downloaded attachment buffer
            strength: 0.7, // High strength for better "Anime-ify" results
            jobInfo: {
              userId: interaction.user.id,
              guildId: interaction.guild?.id,
              channelId: interaction.channel?.id,
              interactionId: interaction.id,
              prompt: originalPrompt,
            },
          },
          progressCallback: progressCallbackFn,
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

    // ONLY deduct credits after successful image generation and validation
    const deductionResult = await checkAndDeductAIImageCredits(
      interaction.user.id,
      targetProvider,
      targetModel,
    );
    if (!deductionResult.success) {
      logger.error(
        `Failed to deduct credits after successful generation for user ${interaction.user.id}: ${deductionResult.error}`,
      );
      // Continue anyway since image was generated successfully
    } else {
      logger.info(
        `✅ Deducted ${deductionResult.creditsDeducted} Core from user ${interaction.user.id} for ${targetProvider}/${targetModel} generation (${deductionResult.creditsRemaining} remaining)`,
      );
    }

    const attachment = new AttachmentBuilder(result.imageBuffer, {
      name: `imagine-${interaction.user.id}-${Date.now()}.png`,
    });

    const durationMs = Date.now() - startTime;

    // Get seed from result if available, otherwise null
    const generatedSeed = result.seed !== undefined ? result.seed : null;
    const currentAspectRatio = aspectRatio || "1:1";

    // Get suggestions for improving future prompts (only for simple prompts)
    const suggestions = getPromptSuggestions(originalPrompt, modelName);
    const limitedSuggestions = suggestions.slice(0, 2); // Limit to 2 suggestions to avoid clutter

    const successEmbed = createImagineResultEmbed({
      prompt: originalPrompt,
      interaction,
      seed: generatedSeed,
      aspectRatio: currentAspectRatio,
      model: targetModel,
      provider: result.provider,
      nsfw: nsfwValidation.isNSFW,
      suggestions: limitedSuggestions,
    });

    // Log NSFW generation for audit purposes
    if (nsfwValidation.isNSFW) {
      logNSFWGeneration({
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        channelId: interaction.channel?.id,
        prompt, // Enhanced prompt
        originalPrompt, // Original user prompt
        seed: generatedSeed,
        aspectRatio: currentAspectRatio,
        provider: result.provider,
        timestamp: new Date().toISOString(),
      });
    }

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
