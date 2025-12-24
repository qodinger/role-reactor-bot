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

      try {
        // Note: Messages don't have locale, so we use guild's preferred locale or default to en-US
        const locale = message.guild?.preferredLocale || "en-US";

        // Check if streaming is enabled and supported
        const { STREAMING_ENABLED } = await import("../utils/ai/constants.js");
        const useStreaming =
          STREAMING_ENABLED &&
          chatService.aiService.getTextProvider() &&
          ["openrouter", "openai", "selfhosted"].includes(
            chatService.aiService.getTextProvider(),
          );

        let response;
        let replyMessage = null;

        if (useStreaming) {
          // Send initial "thinking..." message
          replyMessage = await message.reply("🤔 Thinking...");

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

          // Streaming callback - updates Discord message as chunks arrive
          const onChunk = async fullText => {
            // Extract message from JSON if possible
            const messageText = extractMessage(fullText);
            const displayText =
              messageText.length > 2000
                ? `${messageText.substring(0, 1997)}...`
                : messageText;

            try {
              if (replyMessage) {
                await replyMessage.edit(displayText || "🤔 Thinking...");
              }
            } catch (error) {
              // Ignore edit errors (e.g., message deleted)
              logger.debug(
                "[messageCreate] Failed to update streaming message:",
                error,
              );
            }
          };

          // Generate streaming AI response
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
            },
          );
        } else {
          // Generate AI response (non-streaming)
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
            },
          );
        }

        // Handle response format (can be string or object with text and commandResponses)
        let replyText = typeof response === "string" ? response : response.text;
        const commandResponses =
          typeof response === "object" && response.commandResponses
            ? response.commandResponses
            : [];

        // Don't send empty messages (e.g., when command already sent its response)
        if (!replyText || replyText.trim().length === 0) {
          // Command already sent its response, no need to send AI's message
          // Delete the "thinking..." message if it exists
          if (replyMessage) {
            try {
              await replyMessage.delete();
            } catch {
              // Ignore delete errors
            }
          }
          return;
        }

        // Discord message limit is 2000 characters, truncate if needed
        if (replyText.length > 2000) {
          replyText = `${replyText.substring(0, 1997)}...`;
        }

        // Update or send the final message
        if (replyMessage && useStreaming) {
          // Update the streaming message with final text
          try {
            await replyMessage.edit(replyText);
          } catch (error) {
            // If edit fails, send a new message
            logger.debug(
              "[messageCreate] Failed to edit streaming message, sending new:",
              error,
            );
            await message.reply(replyText);
          }
        } else {
          // Reply to the message with plain text (non-streaming)
          await message.reply(replyText);
        }

        // Send command responses as separate messages (embeds) to make it look like commands were actually executed
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

              // Send the command response as a separate message
              await message.channel.send(messageContent);
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
        await message
          .reply(
            "Sorry, I encountered an error while processing your message. Please try again later or use the `/ask` command.",
          )
          .catch(() => {
            // Ignore reply errors
          });
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
