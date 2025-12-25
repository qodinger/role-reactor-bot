import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { chatService } from "../../../utils/ai/chatService.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
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
  // Store requestId for cancellation (declared outside try block for error handling)
  let currentRequestId = null;

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

    // Helper function to update status embed
    const updateStatusEmbed = async (
      status,
      description = null,
      requestId = null,
      _queuePosition = null, // Unused - kept for API consistency
    ) => {
      try {
        // Store requestId if provided
        if (requestId) {
          currentRequestId = requestId;
        }

        const embed = new EmbedBuilder()
          .setColor(THEME.PRIMARY)
          .setDescription(description || `${EMOJIS.UI.LOADING} ${status}`)
          .setFooter({
            text: `Asked by ${interaction.user.tag} • Role Reactor`,
          })
          .setTimestamp();

        const reply = await interaction.editReply({
          embeds: [embed],
          components: [], // No cancel button - users can delete the message to cancel
        });

        // Register status message for cancellation on delete
        if (currentRequestId && reply && reply.id) {
          try {
            const { concurrencyManager } = await import(
              "../../../utils/ai/concurrencyManager.js"
            );
            concurrencyManager.registerStatusMessage(
              reply.id,
              currentRequestId,
              interaction.user.id,
            );
          } catch (error) {
            logger.debug("[ask] Failed to register status message:", error);
          }
        }
      } catch (error) {
        // Ignore edit errors (e.g., interaction expired)
        logger.debug("[ask] Failed to update status embed:", error);
      }
    };

    if (useStreaming) {
      // Create initial status message
      await updateStatusEmbed("Thinking about your question...");

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

      // Status callback for real processing steps (before streaming starts)
      const onStatus = async (
        status,
        requestId = null,
        _queuePosition = null,
      ) => {
        await updateStatusEmbed(status, null, requestId, _queuePosition);
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

        // Only update if we have actual content (not just status)
        if (displayText && displayText.trim().length > 0) {
          try {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(THEME.PRIMARY)
                  .setDescription(displayText)
                  .setFooter({
                    text: `Asked by ${interaction.user.tag} • Role Reactor`,
                  })
                  .setTimestamp(),
              ],
              components: [], // Remove cancel button when streaming starts
            });
          } catch (error) {
            // Ignore edit errors (e.g., interaction expired)
            logger.debug("[ask] Failed to update streaming message:", error);
          }
        }
      };

      // Generate streaming AI response with real status updates
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
          onStatus, // Real status callback for processing steps
        },
      );
    } else {
      // Non-streaming mode - show real status updates tied to actual processing
      await updateStatusEmbed("Thinking about your question...");

      // Status callback that will be called by chatService at actual processing steps
      const onStatus = async (
        status,
        requestId = null,
        queuePosition = null,
      ) => {
        await updateStatusEmbed(status, null, requestId, queuePosition);
      };

      // Generate AI response (non-streaming) with real status callback
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
          onStatus, // Real status callback - will be called at actual processing steps
        },
      );
    }

    // Handle response format (can be string or object with text and commandResponses)
    const responseText =
      typeof response === "string" ? response : response?.text || null;
    const commandResponses =
      typeof response === "object" && response?.commandResponses
        ? response.commandResponses
        : [];

    // If response is empty (e.g., command already sent its response), don't send an empty embed
    if (!responseText || responseText.trim().length === 0) {
      // Command already sent its response directly to channel, no need to send AI's message
      // Just delete the "thinking..." message - don't show any message
      try {
        // Unregister status message before deleting (request is completing)
        if (currentRequestId) {
          try {
            const reply = await interaction.fetchReply().catch(() => null);
            if (reply && reply.id) {
              const { concurrencyManager } = await import(
                "../../../utils/ai/concurrencyManager.js"
              );
              concurrencyManager.unregisterStatusMessage(reply.id);
            }
          } catch (unregisterError) {
            logger.debug(
              "[ask] Failed to unregister status message:",
              unregisterError,
            );
          }
        }

        await interaction.deleteReply();
      } catch {
        // If delete fails (e.g., message already deleted or interaction expired), just return silently
        // Don't send any message - the command already sent its response
      }
      return;
    }

    // Discord embed limits:
    // - Description: 4096 chars max
    // - Total embed: ~6000 chars (rarely hit)
    // Use 4000 as safe limit for description
    const maxDescriptionLength = 4000;

    // Truncate response text if needed (before creating embed)
    let finalResponseText = responseText;
    if (responseText.length > maxDescriptionLength) {
      finalResponseText = `${responseText.substring(0, maxDescriptionLength - 3)}...`;
      logger.warn(
        `AI response truncated for user ${interaction.user.id} (${responseText.length} -> ${finalResponseText.length} chars)`,
      );
    }

    // Create embed with response
    const embed = new EmbedBuilder()
      .setColor(THEME.PRIMARY)
      .setDescription(finalResponseText)
      .setFooter({
        text: `Asked by ${interaction.user.tag} • Role Reactor`,
      })
      .setTimestamp();

    // Create feedback buttons
    const feedbackRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ai_feedback_positive_${interaction.id}`)
        .setLabel("Helpful")
        .setEmoji("👍")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ai_feedback_negative_${interaction.id}`)
        .setLabel("Not Helpful")
        .setEmoji("👎")
        .setStyle(ButtonStyle.Secondary),
    );

    const replyMessage = await interaction.editReply({
      embeds: [embed],
      components: [feedbackRow],
    });

    // Unregister status message (request is complete)
    if (currentRequestId && replyMessage && replyMessage.id) {
      try {
        const { concurrencyManager } = await import(
          "../../../utils/ai/concurrencyManager.js"
        );
        concurrencyManager.unregisterStatusMessage(replyMessage.id);
      } catch (error) {
        logger.debug("[ask] Failed to unregister status message:", error);
      }
    }

    // Store message ID and context for feedback in database
    if (replyMessage && typeof replyMessage === "object" && replyMessage.id) {
      try {
        const { getDatabaseManager } = await import(
          "../../../utils/storage/databaseManager.js"
        );
        const db = await getDatabaseManager();
        if (db && db.aiFeedback) {
          await db.aiFeedback.setFeedbackContext(replyMessage.id, {
            userId: interaction.user.id,
            guildId: interaction.guild?.id || null,
            userMessage: question,
            aiResponse: responseText,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        // Fallback to in-memory storage if database fails
        logger.debug(
          "Failed to store feedback context in DB, using memory:",
          error,
        );
        global.aiFeedbackContext = global.aiFeedbackContext || new Map();
        global.aiFeedbackContext.set(replyMessage.id, {
          userId: interaction.user.id,
          guildId: interaction.guild?.id || null,
          userMessage: question,
          aiResponse: responseText,
          timestamp: Date.now(),
        });
      }
    }

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
          // Check if channel exists and is sendable (not in DMs or deleted channels)
          if (interaction.channel && interaction.channel.send) {
            await interaction.channel.send(messageContent);
          } else {
            logger.warn(
              `Cannot send command response: channel not available (DM or deleted channel)`,
            );
          }
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

    // Unregister status message on error (request failed)
    if (currentRequestId) {
      try {
        const reply = await interaction.fetchReply().catch(() => null);
        if (reply && reply.id) {
          const { concurrencyManager } = await import(
            "../../../utils/ai/concurrencyManager.js"
          );
          concurrencyManager.unregisterStatusMessage(reply.id);
        }
      } catch (unregisterError) {
        logger.debug(
          "[ask] Failed to unregister status message on error:",
          unregisterError,
        );
      }
    }

    let errorMessage =
      "Failed to generate AI response. Please try again later.";

    if (error?.message) {
      if (error.message.includes("Rate limit exceeded")) {
        errorMessage = error.message;
      } else if (error.message.includes("not available")) {
        errorMessage = error.message;
      } else if (error.message.includes("disabled")) {
        errorMessage = error.message;
      }
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
