import { EmbedBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { chatService } from "../../../utils/ai/chatService.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { getUserData } from "../../general/core/utils.js";
import {
  checkAICredits,
  getAICreditInfo,
} from "../../../utils/ai/aiCreditManager.js";
import { emojiConfig } from "../../../config/emojis.js";
import { STREAMING_ENABLED } from "../../../utils/ai/constants.js";

const logger = getLogger();
const { customEmojis } = emojiConfig;

/**
 * Handle chat command execution
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function execute(interaction, client) {
  // Store requestId for cancellation (declared outside try block for error handling)
  let currentRequestId = null;

  try {
    const question = interaction.options.getString("message", true);

    // Jailbreak / prompt-injection detection
    // These patterns try to override system instructions, impersonate admins, or bypass rules.
    // Detected early — before any credits are consumed or API calls are made.
    const JAILBREAK_PATTERNS = [
      /ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|rules?|guidelines?|prompts?|system)/i,
      /disregard\s+(your|all|the)\s+(previous|prior|instructions?|rules?|guidelines?)/i,
      /you\s+are\s+now\s+(in\s+)?(developer|admin|god|unlimited|unrestricted|jailbreak|override)\s*mode/i,
      /pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(admin|owner|developer|unrestricted|different\s+ai)/i,
      /act\s+as\s+(an?\s+)?(unrestricted|uncensored|admin|developer|jailbroken)/i,
      /bypass\s+(your\s+)?(restrictions?|rules?|guidelines?|filters?|safety)/i,
      /\bDAN\b.*mode/i,   // "Do Anything Now" jailbreak variant
      /\bjailbreak\b/i,
      /\bprompt\s+injection\b/i,
      /override\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)/i,
      /you\s+have\s+no\s+(restrictions?|rules?|guidelines?|limits?)/i,
      /forget\s+(you\s+are|that\s+you('re|\s+are))\s+a\s+bot/i,
    ];

    if (JAILBREAK_PATTERNS.some(p => p.test(question))) {
      logger.warn(
        `[chat] Jailbreak attempt detected from user ${interaction.user.id}: "${question.substring(0, 100)}"`,
      );
      const errorResponse = errorEmbed({
        title: "Request Not Allowed",
        description:
          "That type of request isn't supported. I'm here to help with server management, roles, and bot features!",
      });
      await interaction.reply(errorResponse);
      return;
    }

    // Check if a text-capable provider is available (not just any AI feature)
    if (!chatService.aiService.getTextProvider()) {
      const errorResponse = errorEmbed({
        title: "AI Unavailable",
        description:
          "AI chat is not available. Please set `OPENROUTER_API_KEY` and ensure `aiChat` is enabled in the bot configuration.",
      });
      await interaction.reply(errorResponse);
      return;
    }

    // Check if user has credits for AI request
    const creditCheck = await checkAICredits(interaction.user.id);
    if (!creditCheck.hasCredits) {
      const creditInfo = await getAICreditInfo(interaction.user.id);
      const chatCost = creditCheck.creditsNeeded; // Use creditsNeeded from check (already has fallback in aiCreditManager)
      const requestsPerCore = Math.floor(1 / chatCost);
      const errorResponse = errorEmbed({
        title: "Insufficient Energy",
        description: `You need **${chatCost} ${customEmojis.core}** to use AI chat!\n\n**Your Balance:** ${creditInfo.credits.toFixed(2)} ${customEmojis.core}\n**Cost:** ${chatCost} ${customEmojis.core} per request (1 ${customEmojis.core} = ${requestsPerCore} requests)\n**Requests Available:** ${creditInfo.requestsRemaining}\n\nGet Cores: Visit [rolereactor.app/sponsor](https://rolereactor.app/sponsor)`,
      });
      await interaction.reply(errorResponse);
      return;
    }

    // Get user's Core data for rate limiting priority (before deferring)
    let coreUserData = null;
    try {
      const userData = await getUserData(interaction.user.id);
      // Simplified: Check if user has credits (Core package user)
      if (userData.credits > 0) {
        coreUserData = {
          hasCredits: true,
          credits: userData.credits,
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

    await interaction.deferReply();

    // Check if streaming is enabled and supported
    const useStreaming =
      STREAMING_ENABLED &&
      chatService.aiService.getTextProvider() &&
      ["openrouter", "selfhosted"].includes(
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
            text: `Asked by ${interaction.user.displayName} • Role Reactor`,
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
            logger.debug("[chat] Failed to register status message:", error);
          }
        }
      } catch (error) {
        // Ignore edit errors (e.g., interaction expired)
        logger.debug("[chat] Failed to update status embed:", error);
      }
    };

    const RESPONSE_TIMEOUT_MS = 90_000; // 90 seconds — well within Discord's 15-min window

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
                    text: `Asked by ${interaction.user.displayName} • Role Reactor`,
                  })
                  .setTimestamp(),
              ],
              components: [], // Remove cancel button when streaming starts
            });
          } catch (error) {
            // Ignore edit errors (e.g., interaction expired)
            logger.debug("[chat] Failed to update streaming message:", error);
          }
        }
      };

      // Generate streaming AI response with real status updates
      response = await Promise.race([
        chatService.generateResponseStreaming(
          question,
          interaction.guild,
          client,
          {
            userId: interaction.user.id,
            channelId: interaction.channelId,
            coreUserData,
            user: interaction.user,
            channel: interaction.channel,
            locale: interaction.locale || interaction.guildLocale || "en-US",
            rateLimitReserved: true,
            onChunk,
            onStatus, // Real status callback for processing steps
          },
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("AI response timed out. Please try again.")),
            RESPONSE_TIMEOUT_MS,
          ),
        ),
      ]);
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
      response = await Promise.race([
        chatService.generateResponse(
          question,
          interaction.guild,
          client,
          {
            userId: interaction.user.id,
            channelId: interaction.channelId,
            coreUserData,
            user: interaction.user,
            channel: interaction.channel,
            locale: interaction.locale || interaction.guildLocale || "en-US",
            rateLimitReserved: true, // Already checked and reserved in handler
            onStatus, // Real status callback - will be called at actual processing steps
          },
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("AI response timed out. Please try again.")),
            RESPONSE_TIMEOUT_MS,
          ),
        ),
      ]);
    }

    // Handle response format (can be string or object with text, actions, and commandResponses)
    const responseText =
      typeof response === "string" ? response : response?.text || null;
    const responseActions =
      typeof response === "object" && Array.isArray(response?.actions)
        ? response.actions
        : [];
    const commandResponses =
      typeof response === "object" && response?.commandResponses
        ? response.commandResponses
        : [];

    // Execute actions if present (for streaming mode, actions are returned but not executed)
    if (responseActions.length > 0 && interaction.guild) {
      try {
        const { ActionExecutor } = await import(
          "../../../utils/ai/actionExecutor.js"
        );
        // Execute actions - commands send their responses directly to the channel
        await ActionExecutor.executeStructuredActions(
          responseActions,
          interaction.guild,
          client,
          interaction.user,
          interaction.channel,
        );
        logger.debug(
          `[chat] Executed ${responseActions.length} action(s) from streaming response`,
        );
      } catch (actionError) {
        logger.error("[chat] Failed to execute actions:", actionError);
        // Continue - don't fail the entire request if actions fail
      }
    }

    // If response is empty (e.g., command already sent its response), show a brief confirmation
    if (!responseText || responseText.trim().length === 0) {
      try {
        // Unregister status message (request is completing)
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
              "[chat] Failed to unregister status message:",
              unregisterError,
            );
          }
        }

        // Show a brief "Done" confirmation so the user knows the action completed
        const doneEmbed = new EmbedBuilder()
          .setColor(THEME.SUCCESS || THEME.PRIMARY)
          .setDescription(`✅ Done!`)
          .setFooter({
            text: `Asked by ${interaction.user.displayName} • Role Reactor`,
          })
          .setTimestamp();
        await interaction.editReply({ embeds: [doneEmbed], components: [] });
      } catch {
        // Ignore — command response was already sent to the channel
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
        text: `Asked by ${interaction.user.displayName} • Role Reactor`,
      })
      .setTimestamp();

    const replyMessage = await interaction.editReply({
      embeds: [embed],
    });

    // Unregister status message (request is complete)
    if (currentRequestId && replyMessage && replyMessage.id) {
      try {
        const { concurrencyManager } = await import(
          "../../../utils/ai/concurrencyManager.js"
        );
        concurrencyManager.unregisterStatusMessage(replyMessage.id);
      } catch (error) {
        logger.debug("[chat] Failed to unregister status message:", error);
      }
    }

    // Credits are now deducted per API call in chatService, not per command
    // This ensures users pay for each API call (including re-queries)

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
          "[chat] Failed to unregister status message on error:",
          unregisterError,
        );
      }
    }

    const { getUserFacingErrorMessage } = await import(
      "../../../utils/ai/errorMessages.js"
    );
    const errorMessage = getUserFacingErrorMessage(error, {
      includeContentModeration: false,
    });

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
