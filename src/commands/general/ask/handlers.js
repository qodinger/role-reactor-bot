import { EmbedBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { chatService } from "../../../utils/ai/chatService.js";
import { THEME } from "../../../config/theme.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { getUserData } from "../../general/core/utils.js";

const logger = getLogger();

/**
 * Handle ask command execution
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function execute(interaction, client) {
  try {
    const question = interaction.options.getString("question", true);

    // Check if AI is enabled
    if (!chatService.aiService.isEnabled()) {
      const errorResponse = errorEmbed({
        title: "AI Unavailable",
        description:
          "AI chat is not available. Please enable a text-capable AI provider in the bot configuration.",
      });
      await interaction.reply(errorResponse);
      return;
    }

    // Get user's Core data for rate limiting priority (before deferring)
    let coreUserData = null;
    try {
      const userData = await getUserData(interaction.user.id);
      if (userData.isCore) {
        coreUserData = {
          isCore: userData.isCore,
          coreTier: userData.coreTier,
        };
      }
    } catch (error) {
      logger.debug("Failed to fetch Core user data:", error);
      // Continue without Core data
    }

    // Check rate limit BEFORE deferring (so we can send immediate error if rate limited)
    const { concurrencyManager } = await import(
      "../../../utils/ai/concurrencyManager.js"
    );
    if (
      concurrencyManager.checkUserRateLimit(interaction.user.id, coreUserData)
    ) {
      // Calculate effective rate limit for error message
      const userData = concurrencyManager.userRequests.get(interaction.user.id);
      let effectiveRateLimit = concurrencyManager.userRateLimit;
      if (userData && userData.isCore && userData.coreTier) {
        const tierConfig = concurrencyManager.coreTierLimits[userData.coreTier];
        if (tierConfig) {
          effectiveRateLimit = Math.floor(
            concurrencyManager.userRateLimit * tierConfig.multiplier,
          );
        }
      }

      const windowMinutes = Math.ceil(
        concurrencyManager.userRateWindow / 60000,
      );
      const windowText = windowMinutes === 1 ? "minute" : "minutes";
      const errorResponse = errorEmbed({
        title: "Rate Limit Exceeded",
        description: `You can make ${effectiveRateLimit} requests per ${windowMinutes} ${windowText}. Please wait a moment before making another request.`,
      });
      await interaction.reply(errorResponse);
      return;
    }

    // Defer reply since AI generation may take time
    await interaction.deferReply();

    // Generate AI response (with user and channel for command execution)
    const response = await chatService.generateResponse(
      question,
      interaction.guild,
      client,
      {
        userId: interaction.user.id,
        coreUserData,
        user: interaction.user,
        channel: interaction.channel,
        locale: interaction.locale || interaction.guildLocale || "en-US",
      },
    );

    // Handle response format (can be string or object with text and commandResponses)
    const responseText =
      typeof response === "string" ? response : response.text;
    const commandResponses =
      typeof response === "object" && response.commandResponses
        ? response.commandResponses
        : [];

    // If response is empty (e.g., command already sent its response), don't send an empty embed
    if (!responseText || responseText.trim().length === 0) {
      // Command already sent its response directly to channel, no need to send AI's message
      // Just delete the "thinking..." message - don't show any message
      try {
        await interaction.deleteReply();
      } catch {
        // If delete fails (e.g., message already deleted or interaction expired), just return silently
        // Don't send any message - the command already sent its response
      }
      return;
    }

    // Create embed with response
    const embed = new EmbedBuilder()
      .setColor(THEME.PRIMARY)
      .setDescription(responseText)
      .setFooter({
        text: `Asked by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    // Discord embed description limit is 4096, but we'll be safe with 2000
    if (responseText.length > 2000) {
      embed.setDescription(`${responseText.substring(0, 1997)}...`);
      logger.warn(
        `AI response truncated for user ${interaction.user.id} (${responseText.length} chars)`,
      );
    }

    await interaction.editReply({ embeds: [embed] });

    // Send command responses as separate messages (embeds) to make it look like commands were actually executed
    if (commandResponses.length > 0) {
      for (const cmdResponse of commandResponses) {
        try {
          // Prepare message content
          const messageContent = {
            content: cmdResponse.response?.content || null,
          };

          // Handle embeds
          if (
            cmdResponse.response?.embeds &&
            Array.isArray(cmdResponse.response.embeds)
          ) {
            const embeds = cmdResponse.response.embeds
              .map(embed => {
                // If it's already an EmbedBuilder, use it
                if (embed instanceof EmbedBuilder) {
                  return embed;
                }
                // If it's a plain object, reconstruct it
                if (typeof embed === "object" && embed !== null) {
                  const embedData = embed.data || embed;
                  const newEmbed = new EmbedBuilder();
                  if (embedData.title) newEmbed.setTitle(embedData.title);
                  if (embedData.description)
                    newEmbed.setDescription(embedData.description);
                  if (embedData.color) newEmbed.setColor(embedData.color);
                  if (embedData.fields && Array.isArray(embedData.fields)) {
                    newEmbed.addFields(embedData.fields);
                  }
                  if (embedData.footer) newEmbed.setFooter(embedData.footer);
                  if (embedData.thumbnail)
                    newEmbed.setThumbnail(embedData.thumbnail);
                  if (embedData.image) newEmbed.setImage(embedData.image);
                  if (embedData.timestamp)
                    newEmbed.setTimestamp(embedData.timestamp);
                  return newEmbed;
                }
                return null;
              })
              .filter(e => e !== null);

            if (embeds.length > 0) {
              messageContent.embeds = embeds;
            }
          }

          // Handle components (buttons, dropdowns, etc.) - important for commands like /help
          if (
            cmdResponse.response?.components &&
            Array.isArray(cmdResponse.response.components)
          ) {
            // Components are already in the correct format (ActionRowBuilder, etc.)
            // Just use them directly
            messageContent.components = cmdResponse.response.components;
          }

          // Send the command response as a separate message
          await interaction.channel.send(messageContent);
        } catch (error) {
          logger.error(
            `Error sending command response for ${cmdResponse.command}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    logger.error("Ask command error:", error);

    let errorMessage =
      "Failed to generate AI response. Please try again later.";

    if (error.message.includes("Rate limit exceeded")) {
      errorMessage = error.message;
    } else if (error.message.includes("not available")) {
      errorMessage = error.message;
    } else if (error.message.includes("disabled")) {
      errorMessage = error.message;
    }

    const errorResponse = errorEmbed({
      title: "Error",
      description: errorMessage,
    });

    try {
      // Check if interaction was already replied to
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    } catch (replyError) {
      // If all else fails, try followUp
      try {
        await interaction.followUp(errorResponse);
      } catch (_followUpError) {
        logger.error("Failed to send error message:", replyError);
      }
    }
  }
}
