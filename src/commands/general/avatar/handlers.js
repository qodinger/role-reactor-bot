import { AttachmentBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { generateAvatar as generateAIAvatar } from "../../../utils/ai/avatarService.js";
import { CreditManager } from "./utils/creditManager.js";
import { InteractionHandler } from "./utils/interactionHandler.js";
import { createLoadingSkeleton } from "./utils/imageUtils.js";
import {
  createErrorEmbed,
  createCreditEmbed,
  createHelpEmbed,
  createLoadingEmbed,
  createSuccessEmbed,
} from "./embeds.js";
import {
  validatePrompt,
  formatStyleOptions,
  formatGenerationTime,
} from "./utils.js";

const logger = getLogger();

/**
 * Handle avatar generation
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleAvatarGeneration(interaction, _client) {
  const startTime = Date.now();

  logger.debug(
    `Starting avatar generation for user ${interaction.user.id}, interaction age: ${Date.now() - interaction.createdTimestamp}ms`,
  );

  try {
    // Extract options
    const prompt = interaction.options.getString("prompt");
    const colorStyle = interaction.options.getString("color_style");
    const mood = interaction.options.getString("mood");
    const artStyle = interaction.options.getString("art_style");

    logger.debug(`Processing prompt: "${prompt}"`);
    logger.debug(
      `Style options - Color: ${colorStyle}, Mood: ${mood}, Art: ${artStyle}`,
    );

    // Validate prompt
    const validation = validatePrompt(prompt);
    if (!validation.isValid) {
      const errorEmbed = createErrorEmbed(
        interaction,
        "Invalid Prompt",
        validation.reason,
      );
      return await interaction.editReply({ embeds: [errorEmbed] });
    }

    // Check for help request
    if (prompt.toLowerCase().includes("help")) {
      const helpEmbed = createHelpEmbed();
      return await interaction.editReply({ embeds: [helpEmbed] });
    }

    // Check user credits
    const creditInfo = await CreditManager.checkUserCredits(
      interaction.user.id,
    );
    const { userData, creditsNeeded } = creditInfo;

    if (userData.credits < creditsNeeded) {
      const creditEmbed = createCreditEmbed(
        interaction,
        userData,
        creditsNeeded,
        prompt,
      );
      return await interaction.editReply({ embeds: [creditEmbed] });
    }

    // Create static loading image
    const loadingImage = createLoadingSkeleton();
    const loadingAttachment = new AttachmentBuilder(loadingImage, {
      name: `loading-${Date.now()}.png`,
    });

    // Send loading embed with static gradient image
    const loadingEmbed = createLoadingEmbed(prompt);
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
      { colorStyle, mood, artStyle }, // style options
      null, // No progress callback
      userData, // Core user data for rate limiting
    );

    // Animation cleanup not needed for static loading

    logger.debug(`AI generation took ${Date.now() - aiStartTime}ms`);

    if (!avatarData || !avatarData.imageBuffer) {
      throw new Error("Failed to generate avatar image");
    }

    // Deduct credits
    await CreditManager.deductCredits(interaction.user.id, creditsNeeded);

    // Create final attachment
    const attachment = new AttachmentBuilder(avatarData.imageBuffer, {
      name: `ai-avatar-${interaction.user.id}-${Date.now()}.png`,
    });

    // Send final result with success embed
    const successEmbed = createSuccessEmbed(interaction, prompt);
    await interaction.editReply({
      embeds: [successEmbed],
      files: [attachment],
    });

    logger.info(
      `Avatar generation completed in ${formatGenerationTime(startTime, Date.now())} for user ${interaction.user.id}`,
    );
    logger.debug(
      `Style options used: ${formatStyleOptions({ colorStyle, mood, artStyle })}`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error generating AI avatar after ${duration}ms:`, error);

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
