import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getExperienceManager } from "../features/experience/ExperienceManager.js";
import { chatService } from "../utils/ai/index.js";
import { getUserData } from "../commands/general/core/utils.js";

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

      // Check rate limit
      const { concurrencyManager } = await import(
        "../utils/ai/concurrencyManager.js"
      );
      if (
        concurrencyManager.checkUserRateLimit(message.author.id, coreUserData)
      ) {
        // Calculate effective rate limit for error message
        const userData = concurrencyManager.userRequests.get(message.author.id);
        let effectiveRateLimit = concurrencyManager.userRateLimit;
        if (userData && userData.isCore && userData.coreTier) {
          const tierConfig =
            concurrencyManager.coreTierLimits[userData.coreTier];
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
        await message.reply(
          `You can make ${effectiveRateLimit} requests per ${windowMinutes} ${windowText}. Please wait a moment before making another request.`,
        );
        return;
      }

      // Show typing indicator
      await message.channel.sendTyping().catch(() => {
        // Ignore errors (e.g., no permission to send typing)
      });

      try {
        // Generate AI response
        // Note: Messages don't have locale, so we use guild's preferred locale or default to en-US
        const locale = message.guild?.preferredLocale || "en-US";
        const response = await chatService.generateResponse(
          userMessage,
          message.guild,
          client,
          {
            userId: message.author.id,
            coreUserData,
            user: message.author,
            channel: message.channel,
            locale,
          },
        );

        // Handle response format (can be string or object with text and commandResponses)
        let replyText = typeof response === "string" ? response : response.text;
        const commandResponses =
          typeof response === "object" && response.commandResponses
            ? response.commandResponses
            : [];

        // Don't send empty messages (e.g., when command already sent its response)
        if (!replyText || replyText.trim().length === 0) {
          // Command already sent its response, no need to send AI's message
          return;
        }

        // Discord message limit is 2000 characters, truncate if needed
        if (replyText.length > 2000) {
          replyText = `${replyText.substring(0, 1997)}...`;
        }

        // Reply to the message with plain text
        await message.reply(replyText);

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
