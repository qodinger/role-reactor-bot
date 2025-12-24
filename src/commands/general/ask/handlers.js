import { EmbedBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { chatService } from "../../../utils/ai/chatService.js";
import { THEME } from "../../../config/theme.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { getUserData } from "../../general/core/utils.js";
import {
  checkAICredits,
  deductAICredits,
  getAICreditInfo,
} from "../../../utils/ai/aiCreditManager.js";
import { emojiConfig } from "../../../config/emojis.js";
import { STREAMING_ENABLED } from "../../../utils/ai/constants.js";

const logger = getLogger();
const { customEmojis } = emojiConfig;

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

    // Check if user has credits for AI request (0.1 Core per request)
    const creditCheck = await checkAICredits(interaction.user.id);
    if (!creditCheck.hasCredits) {
      const creditInfo = await getAICreditInfo(interaction.user.id);
      const errorResponse = errorEmbed({
        title: "Insufficient Credits",
        description: `You need **0.1 ${customEmojis.core}** to use AI chat!\n\n**Your Balance:** ${creditInfo.credits.toFixed(1)} ${customEmojis.core}\n**Cost:** 0.1 ${customEmojis.core} per request (1 ${customEmojis.core} = 10 requests)\n**Requests Available:** ${creditInfo.requestsRemaining}\n\nGet Cores: \`/core pricing\` or visit [rolereactor.app/sponsor](https://rolereactor.app/sponsor)`,
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

    // Atomically check and reserve rate limit BEFORE deferring (prevents race conditions)
    // This ensures only one request can pass the check and increment the counter
    const { concurrencyManager } = await import(
      "../../../utils/ai/concurrencyManager.js"
    );
    const rateLimitResult = concurrencyManager.checkAndReserveRateLimit(
      interaction.user.id,
      coreUserData,
    );
    if (rateLimitResult.rateLimited) {
      const windowMinutes = Math.ceil(
        concurrencyManager.userRateWindow / 60000,
      );
      const windowText = windowMinutes === 1 ? "minute" : "minutes";
      const errorResponse = errorEmbed({
        title: "Rate Limit Exceeded",
        description: `You can make ${rateLimitResult.effectiveRateLimit} requests per ${windowMinutes} ${windowText}. Please wait a moment before making another request.`,
      });
      await interaction.reply(errorResponse);
      return;
    }

    // Defer reply since AI generation may take time
    await interaction.deferReply();

    // Deduct credits before generation (bundle system)
    const deductionResult = await deductAICredits(interaction.user.id);
    if (!deductionResult.success) {
      const errorResponse = errorEmbed({
        title: "Error",
        description: "Failed to process credits. Please try again.",
      });
      await interaction.editReply(errorResponse);
      return;
    }

    // Check if streaming is enabled and supported
    const useStreaming =
      STREAMING_ENABLED &&
      chatService.aiService.getTextProvider() &&
      ["openrouter", "openai", "selfhosted"].includes(
        chatService.aiService.getTextProvider(),
      );

    let response;

    if (useStreaming) {
      // Create initial "thinking..." message
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(THEME.PRIMARY)
            .setDescription("🤔 Thinking...")
            .setFooter({
              text: `Asked by ${interaction.user.tag}`,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            }),
        ],
      });

      // Helper function to extract message from JSON
      const extractMessage = text => {
        if (!text || typeof text !== "string") {
          return text || "";
        }

        try {
          // Try to parse as JSON
          let jsonString = text.trim();
          // Remove markdown code blocks if present
          jsonString = jsonString.replace(/^```json\s*/i, "");
          jsonString = jsonString.replace(/^```\s*/i, "");
          jsonString = jsonString.replace(/\s*```$/i, "");
          jsonString = jsonString.trim();

          // Try to extract JSON object (handles incomplete JSON during streaming)
          const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed && typeof parsed === "object" && "message" in parsed) {
                // Extract message field (handle null/undefined)
                const message =
                  typeof parsed.message === "string"
                    ? parsed.message
                    : String(parsed.message || "");
                // If message is extracted, return it; otherwise continue to fallback
                if (message) {
                  return message;
                }
              }
            } catch (_parseError) {
              // JSON might be incomplete during streaming - try to extract partial message
              const messageMatch = jsonString.match(
                /"message"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/,
              );
              if (messageMatch) {
                return messageMatch[1]
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, "\\");
              }
              // Try to find message field even if value is incomplete
              const partialMatch = text.match(/"message"\s*:\s*"([^"]*)/);
              if (partialMatch) {
                return partialMatch[1]
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, "\\");
              }
            }
          }
        } catch {
          // If parsing fails, return original text
        }
        return text;
      };

      // Streaming callback - updates Discord message as chunks arrive
      const onChunk = async fullText => {
        // Extract message from JSON if possible
        const messageText = extractMessage(fullText);
        // Truncate if too long (Discord limit is 4096 for embed description)
        const displayText =
          messageText.length > 2000
            ? `${messageText.substring(0, 1997)}...`
            : messageText;

        try {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(THEME.PRIMARY)
                .setDescription(displayText || "🤔 Thinking...")
                .setFooter({
                  text: `Asked by ${interaction.user.tag}`,
                  iconURL: interaction.user.displayAvatarURL({
                    dynamic: true,
                  }),
                })
                .setTimestamp(),
            ],
          });
        } catch (error) {
          // Ignore edit errors (e.g., interaction expired)
          logger.debug("[ask] Failed to update streaming message:", error);
        }
      };

      // Generate streaming AI response
      response = await chatService.generateResponseStreaming(
        question,
        interaction.guild,
        client,
        {
          userId: interaction.user.id,
          coreUserData,
          user: interaction.user,
          channel: interaction.channel,
          locale: interaction.locale || interaction.guildLocale || "en-US",
          rateLimitReserved: true,
          onChunk,
        },
      );
    } else {
      // Generate AI response (non-streaming)
      // Pass rateLimitReserved: true since we already checked and reserved the rate limit
      response = await chatService.generateResponse(
        question,
        interaction.guild,
        client,
        {
          userId: interaction.user.id,
          coreUserData,
          user: interaction.user,
          channel: interaction.channel,
          locale: interaction.locale || interaction.guildLocale || "en-US",
          rateLimitReserved: true, // Already checked and reserved in handler
        },
      );
    }

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
