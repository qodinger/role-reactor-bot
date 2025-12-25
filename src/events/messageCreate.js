import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getExperienceManager } from "../features/experience/ExperienceManager.js";
import { chatService } from "../utils/ai/index.js";
import { getUserData } from "../commands/general/core/utils.js";
import {
  checkAICredits,
  deductAICredits,
  getAICreditInfo,
} from "../utils/ai/aiCreditManager.js";
import { emojiConfig } from "../config/emojis.js";
import { EMOJIS } from "../config/theme.js";

const { customEmojis } = emojiConfig;

export const name = Events.MessageCreate;

export async function execute(message, client) {
  const logger = getLogger();

  if (!message) throw new Error("Missing message");
  if (!client) throw new Error("Missing client");

  try {
    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    // Ignore DMs (for now - could add DM support later)
    if (!message.guild) {
      return;
    }

    // Check if bot is mentioned
    const isBotMentioned = message.mentions.has(client.user.id);

    if (isBotMentioned) {
      // Extract message content without the mention
      let userMessage = message.content.trim();

      // Remove bot mention from message
      userMessage = userMessage
        .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
        .trim();

      // If message is empty or only whitespace after removing mention, use a default
      if (!userMessage || userMessage.length === 0) {
        userMessage = "Hello!";
      }

      // Check if AI service is enabled
      if (!chatService.aiService.isEnabled()) {
        await message.reply(
          "The AI chat service is currently disabled. Please use the `/ask` command or contact an administrator.",
        );
        return;
      }

      // Check if user has credits for AI request (0.1 Core per request)
      const creditCheck = await checkAICredits(message.author.id);
      if (!creditCheck.hasCredits) {
        const creditInfo = await getAICreditInfo(message.author.id);
        await message.reply(
          `❌ **Insufficient Credits**\n\nYou need **0.1 ${customEmojis.core}** to use AI chat!\n\n**Your Balance:** ${creditInfo.credits.toFixed(1)} ${customEmojis.core}\n**Cost:** 0.1 ${customEmojis.core} per request (1 ${customEmojis.core} = 10 requests)\n**Requests Available:** ${creditInfo.requestsRemaining}\n\nGet Cores: \`/core pricing\` or visit https://rolereactor.app/sponsor`,
        );
        return;
      }

      // Get user's Core data for rate limiting priority
      let coreUserData = null;
      try {
        const userData = await getUserData(message.author.id);
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

      // Atomically check and reserve rate limit (prevents race conditions)
      // This ensures only one request can pass the check and increment the counter
      const { concurrencyManager } = await import(
        "../utils/ai/concurrencyManager.js"
      );
      const rateLimitResult = concurrencyManager.checkAndReserveRateLimit(
        message.author.id,
        coreUserData,
      );
      if (rateLimitResult.rateLimited) {
        const windowMinutes = Math.ceil(
          concurrencyManager.userRateWindow / 60000,
        );
        const windowText = windowMinutes === 1 ? "minute" : "minutes";
        await message.reply(
          `You can make ${rateLimitResult.effectiveRateLimit} requests per ${windowMinutes} ${windowText}. Please wait a moment before making another request.`,
        );
        return;
      }

      // Deduct credits before generation (bundle system)
      const deductionResult = await deductAICredits(message.author.id);
      if (!deductionResult.success) {
        await message.reply("❌ Failed to process credits. Please try again.");
        return;
      }

      // Show typing indicator
      await message.channel.sendTyping().catch(() => {
        // Ignore errors (e.g., no permission to send typing)
      });

      // Declare replyMessage outside try block so it's accessible in catch block
      let replyMessage = null; // Status message - will be created by updateStatusMessage

      // Declare streaming variables outside try block for cleanup in catch
      let useStreaming = false;
      let updateTimer = null;

      try {
        // Note: Messages don't have locale, so we use guild's preferred locale or default to en-US
        const locale = message.guild?.preferredLocale || "en-US";

        // Check if streaming is enabled and supported
        const { STREAMING_ENABLED } = await import("../utils/ai/constants.js");
        useStreaming =
          STREAMING_ENABLED &&
          chatService.aiService.getTextProvider() &&
          ["openrouter", "openai", "selfhosted"].includes(
            chatService.aiService.getTextProvider(),
          );

        let response;

        // Store requestId for cancellation
        let currentRequestId = null;

        // Helper function to update status message (plain text, no embeds for mentions)
        const updateStatusMessage = async (
          status,
          description = null,
          requestId = null,
          _queuePosition = null, // Unused - kept for API consistency
        ) => {
          if (!message.channel || !message.channel.send) {
            logger.warn(
              `Cannot send status message: channel not available (DM or deleted channel)`,
            );
            return;
          }
          try {
            // Store requestId if provided
            if (requestId) {
              currentRequestId = requestId;
            }

            // Use plain text instead of embed for mention responses
            const statusText = description || `${EMOJIS.UI.LOADING} ${status}`;

            if (replyMessage) {
              await replyMessage.edit({
                content: statusText,
                embeds: [], // No embeds for mention responses
                components: [], // No cancel button - users can delete the message to cancel
              });
              // Register status message for cancellation on delete
              if (currentRequestId) {
                const { concurrencyManager } = await import(
                  "../utils/ai/concurrencyManager.js"
                );
                concurrencyManager.registerStatusMessage(
                  replyMessage.id,
                  currentRequestId,
                  message.author.id,
                );
              }
            } else {
              replyMessage = await message.reply({
                content: statusText,
                embeds: [], // No embeds for mention responses
                components: [], // No cancel button - users can delete the message to cancel
              });
              // Register status message for cancellation on delete
              if (currentRequestId) {
                const { concurrencyManager } = await import(
                  "../utils/ai/concurrencyManager.js"
                );
                concurrencyManager.registerStatusMessage(
                  replyMessage.id,
                  currentRequestId,
                  message.author.id,
                );
              }
            }
          } catch (error) {
            // Ignore edit errors (e.g., message deleted)
            logger.debug(
              "[messageCreate] Failed to update status message:",
              error,
            );
          }
        };

        if (useStreaming) {
          // Send initial status message
          await updateStatusMessage("Thinking about your message...");

          // Track if message was deleted to prevent further update attempts
          let messageDeleted = false;

          // Throttle message updates to avoid Discord rate limits
          // Discord allows 5 message edits per 5 seconds per channel
          // We'll update at most once per 1.5 seconds to stay well under the limit
          // Also only update when content changes significantly (50+ new characters)
          let lastUpdateTime = 0;
          const UPDATE_THROTTLE_MS = 1500; // 1.5 seconds between updates
          const MIN_CONTENT_CHANGE = 50; // Only update if 50+ new characters
          let pendingUpdate = null;
          let lastDisplayedContent = "";
          // updateTimer is declared above for cleanup in catch block

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
                  if (
                    parsed &&
                    typeof parsed === "object" &&
                    "message" in parsed
                  ) {
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
            queuePosition = null,
          ) => {
            if (!messageDeleted) {
              await updateStatusMessage(status, null, requestId, queuePosition);
            }
          };

          // Streaming callback - updates Discord message as chunks arrive
          const onChunk = async fullText => {
            // Don't try to update if message was deleted
            if (messageDeleted || !replyMessage) {
              return;
            }

            // Extract message from JSON if possible
            const messageText = extractMessage(fullText);
            // Truncate if too long (Discord message limit is 2000 characters)
            const displayText =
              messageText.length > 2000
                ? `${messageText.substring(0, 1997)}...`
                : messageText;

            // Only update if we have actual content (not just status)
            if (displayText && displayText.trim().length > 0) {
              // Check if content has changed significantly
              const contentChanged =
                !lastDisplayedContent ||
                displayText.length - lastDisplayedContent.length >=
                  MIN_CONTENT_CHANGE ||
                displayText.substring(0, lastDisplayedContent.length) !==
                  lastDisplayedContent;

              if (contentChanged) {
                // Store the latest text for update
                pendingUpdate = displayText;

                // Clear any existing timer
                if (updateTimer) {
                  clearTimeout(updateTimer);
                }

                // Check if we can update immediately (throttle check)
                const now = Date.now();
                const timeSinceLastUpdate = now - lastUpdateTime;

                if (timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
                  // Enough time has passed, update immediately
                  await performUpdate();
                } else {
                  // Schedule update after throttle period
                  const delay = UPDATE_THROTTLE_MS - timeSinceLastUpdate;
                  updateTimer = setTimeout(() => {
                    performUpdate();
                  }, delay);
                }
              }
            }
          };

          // Helper function to actually perform the message update
          const performUpdate = async () => {
            if (messageDeleted || !replyMessage || !pendingUpdate) {
              return;
            }

            try {
              // For streaming, update with plain text (no embeds for mention responses)
              // The final response will be converted to plain text
              await replyMessage.edit({
                content: pendingUpdate,
                embeds: [], // No embeds for mention responses
                components: [], // Remove cancel button when streaming starts
              });

              // Update last update time and track displayed content
              lastUpdateTime = Date.now();
              lastDisplayedContent = pendingUpdate;
              pendingUpdate = null;
            } catch (error) {
              // Handle specific Discord error codes
              if (error.code === 10008) {
                // Unknown Message - message was deleted, stop trying to update
                messageDeleted = true;
                logger.debug(
                  `[messageCreate] Message ${replyMessage?.id} was deleted, stopping updates`,
                );
              } else if (error.code === 50035) {
                // Invalid Form Body - usually means content is too long or invalid
                logger.debug(
                  "[messageCreate] Invalid form body when updating message:",
                  error.message,
                );
              } else if (error.code === 429) {
                // Rate limited - wait longer before next update
                logger.debug(
                  "[messageCreate] Rate limited when updating message, increasing throttle",
                );
                // Increase throttle time temporarily
                lastUpdateTime = Date.now() + 2000; // Wait 2 more seconds
              } else {
                // Other errors (network issues, etc.)
                logger.debug(
                  "[messageCreate] Failed to update streaming message:",
                  error.code || error.message,
                );
              }
            }
          };

          // Generate streaming AI response with real status updates
          try {
            response = await chatService.generateResponseStreaming(
              userMessage,
              message.guild,
              client,
              {
                userId: message.author.id,
                coreUserData,
                user: message.author,
                channel: message.channel,
                locale,
                rateLimitReserved: true,
                onChunk,
                onStatus, // Real status callback for processing steps
              },
            );
          } finally {
            // Always cleanup timer and flush pending updates, even if streaming fails
            if (updateTimer) {
              clearTimeout(updateTimer);
              updateTimer = null;
            }
            if (pendingUpdate && !messageDeleted && replyMessage) {
              try {
                await performUpdate();
              } catch (flushError) {
                // Ignore flush errors - message might be deleted or rate limited
                logger.debug(
                  "[messageCreate] Failed to flush pending update:",
                  flushError.code || flushError.message,
                );
              }
            }
          }
        } else {
          // Non-streaming mode - show real status updates tied to actual processing
          await updateStatusMessage("Thinking about your message...");

          // Status callback that will be called by chatService at actual processing steps
          const onStatus = async (
            status,
            requestId = null,
            queuePosition = null,
          ) => {
            await updateStatusMessage(status, null, requestId, queuePosition);
          };

          // Generate AI response (non-streaming) with real status callback
          // Pass rateLimitReserved: true since we already checked and reserved the rate limit
          response = await chatService.generateResponse(
            userMessage,
            message.guild,
            client,
            {
              userId: message.author.id,
              coreUserData,
              user: message.author,
              channel: message.channel,
              locale,
              rateLimitReserved: true, // Already checked and reserved in handler
              onStatus, // Real status callback - will be called at actual processing steps
            },
          );
        }

        // Handle response format (can be string or object with text, actions, and commandResponses)
        const responseText =
          typeof response === "string" ? response : response?.text || null;
        const actions =
          typeof response === "object" && response?.actions
            ? response.actions
            : [];
        const commandResponses =
          typeof response === "object" && response?.commandResponses
            ? response.commandResponses
            : [];

        // Delete status embed
        if (replyMessage) {
          try {
            // Unregister status message before deleting (request is completing)
            const { concurrencyManager } = await import(
              "../utils/ai/concurrencyManager.js"
            );
            concurrencyManager.unregisterStatusMessage(replyMessage.id);

            // Delete the status embed message
            await replyMessage.delete();
          } catch (error) {
            // Ignore delete errors (message might already be deleted)
            logger.debug(
              "[messageCreate] Failed to delete status message:",
              error,
            );
          }
        }

        // Step 1: Send AI's text message first (if it exists)
        if (responseText && responseText.trim().length > 0) {
          // Discord message limit is 2000 characters, truncate if needed
          let finalReplyText = responseText;
          if (responseText.length > 2000) {
            finalReplyText = `${responseText.substring(0, 1997)}...`;
            logger.warn(
              `AI response truncated for user ${message.author.id} (${responseText.length} -> ${finalReplyText.length} chars)`,
            );
          }

          try {
            await message.reply(finalReplyText);
          } catch (error) {
            logger.error(
              "[messageCreate] Failed to send final response:",
              error,
            );
          }
        }

        // Step 2: Execute actions in a second message (will appear below AI's text automatically)
        // Note: For streaming mode, actions are returned separately and executed here
        // For non-streaming mode, actions may have already been executed during generation
        // (for follow-up queries), so we check if actions array is non-empty before executing
        if (actions && actions.length > 0) {
          try {
            logger.info(
              `[messageCreate] Executing ${actions.length} action(s) after sending AI message`,
            );

            // Execute actions (command responses will appear below automatically)
            const actionResults = await chatService.executeStructuredActions(
              actions,
              message.guild,
              client,
              message.author,
              message.channel,
            );

            // Store action execution results in conversation history
            // This prevents the AI from retrying failed actions in future conversations
            if (actionResults && actionResults.results) {
              const { results } = actionResults;
              const executedCommands = results
                .filter(r => r.includes("Command Result:"))
                .map(r => r.replace(/Command Result: /, ""));
              const errorMessages = results.filter(
                r => r.includes("Error") || r.includes("Failed"),
              );

              // Store successful command executions
              if (executedCommands.length > 0) {
                const commandHistoryMessage = `[Action completed - do not retry: ${executedCommands.join(", ")}]`;
                await chatService.addToHistory(
                  message.author.id,
                  message.guild?.id || null,
                  {
                    role: "assistant",
                    content: commandHistoryMessage,
                  },
                );
              }

              // Store failed actions with completion marker (not retry needed)
              if (errorMessages.length > 0) {
                const errorHistoryMessage = `[Action completed with errors - do not retry: ${errorMessages.map(e => e.replace(/Command Error: /, "")).join("; ")}]`;
                await chatService.addToHistory(
                  message.author.id,
                  message.guild?.id || null,
                  {
                    role: "assistant",
                    content: errorHistoryMessage,
                  },
                );
              }
            }
          } catch (error) {
            logger.error("[messageCreate] Failed to execute actions:", error);
            // Store error as completed action to prevent retry
            const errorHistoryMessage = `[Action execution failed and completed - do not retry: ${error.message || "Unknown error"}]`;
            await chatService.addToHistory(
              message.author.id,
              message.guild?.id || null,
              {
                role: "assistant",
                content: errorHistoryMessage,
              },
            );
          }
        }

        // Send command responses as embeds (below AI's text message) - legacy support
        if (commandResponses.length > 0) {
          for (const cmdResponse of commandResponses) {
            try {
              // Import EmbedBuilder to reconstruct embeds if needed
              const { EmbedBuilder } = await import("discord.js");

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
                      if (embedData.footer)
                        newEmbed.setFooter(embedData.footer);
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

              // Send the command response as a separate message (below AI's text)
              // Check if channel exists and is sendable (not in DMs or deleted channels)
              if (message.channel && message.channel.send) {
                await message.channel.send(messageContent);
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
        logger.error("Error generating AI response for mention:", error);

        // Cleanup streaming timer if it exists (in case of error during streaming)
        if (useStreaming && updateTimer) {
          try {
            clearTimeout(updateTimer);
            updateTimer = null;
          } catch (timerError) {
            logger.debug(
              "[messageCreate] Failed to clear update timer:",
              timerError,
            );
          }
        }

        // Unregister status message on error (request failed)
        if (replyMessage) {
          try {
            const { concurrencyManager } = await import(
              "../utils/ai/concurrencyManager.js"
            );
            concurrencyManager.unregisterStatusMessage(replyMessage.id);
          } catch (unregisterError) {
            logger.debug(
              "[messageCreate] Failed to unregister status message on error:",
              unregisterError,
            );
          }
        }

        // Try to edit existing status message first, otherwise send new message
        const errorMessage =
          "Sorry, I encountered an error while processing your message. Please try again later or use the `/ask` command.";

        if (replyMessage) {
          try {
            await replyMessage.edit(errorMessage);
          } catch (editError) {
            // If edit fails, try to send a new message
            logger.debug(
              "[messageCreate] Failed to edit error message, sending new:",
              editError,
            );
            await message.reply(errorMessage).catch(() => {
              // Ignore reply errors
            });
          }
        } else {
          // No status message exists, send new error message
          await message.reply(errorMessage).catch(() => {
            // Ignore reply errors
          });
        }
      }
    }

    // Award XP for message activity
    // Level-up notifications are handled by LevelUpNotifier in ExperienceManager
    const experienceManager = await getExperienceManager();
    await experienceManager.awardMessageXP(
      message.guild.id,
      message.author.id,
      client,
    );
  } catch (error) {
    logger.error("Error processing message:", error);
  }
}
