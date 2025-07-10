import {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getAllRoleMappings, removeRoleMapping } from "../utils/roleManager.js";

const PAGE_SIZE = 5;

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isButton()) return;
    const { customId } = interaction;
    console.log("Button handler triggered:", customId);
    if (
      !customId.startsWith("remove_roles_") &&
      ![
        "manage_roles_prev",
        "manage_roles_next",
        "remove_roles_confirm",
        "remove_roles_cancel",
      ].includes(customId)
    )
      return;

    try {
      // Get current page from message embed footer (if present)
      let page = 0;
      const embed = interaction.message.embeds[0];
      if (embed && embed.description) {
        const match = embed.description.match(/Page (\d+) of (\d+)/);
        if (match) page = parseInt(match[1], 10) - 1;
      }

      // Helper to build embed and components for a page
      const allMappings = await getAllRoleMappings();
      const messageIds = Object.keys(allMappings);
      const totalPages = Math.ceil(messageIds.length / PAGE_SIZE);
      const getPage = pageIdx => {
        const start = pageIdx * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return messageIds.slice(start, end);
      };
      const buildPage = async pageIdx => {
        const ids = getPage(pageIdx);
        const embed = new EmbedBuilder()
          .setTitle("🗂️ Manage Role-Reaction Messages")
          .setDescription(
            `Page ${pageIdx + 1} of ${totalPages}\nSelect a message to remove or use Remove All.`
          )
          .setColor(0x0099ff)
          .setTimestamp();

        // Fetch all messages in parallel for better performance
        const messagePromises = ids.map(async messageId => {
          let preview = `ID: \`${messageId}\``;
          let channelMention = "";
          let found = false;

          // Try to find the message in any channel
          for (const [, channel] of interaction.guild.channels.cache) {
            if (!channel.isTextBased?.()) continue;
            try {
              const msg = await channel.messages.fetch(messageId);
              preview = msg.embeds[0]?.title
                ? `**${msg.embeds[0].title}**`
                : preview;
              channelMention = channel.toString();
              found = true;
              break;
            } catch (err) {
              if (err.code === 10008) {
                // Message not found in this channel
              } else {
                console.error(
                  `Failed to fetch message ${messageId} in channel ${channel.id}:`,
                  err
                );
              }
            }
          }

          if (!found) {
            preview += " (Message not found)";
          }

          return { messageId, preview, channelMention, found };
        });

        const messageResults = await Promise.all(messagePromises);

        // Add fields to embed
        messageResults.forEach((result, idx) => {
          embed.addFields({
            name: `#${idx + 1} ${result.channelMention}`,
            value: result.preview,
            inline: false,
          });
        });

        const row = new ActionRowBuilder();
        ids.forEach((messageId, idx) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`remove_roles_${messageId}`)
              .setLabel(`Remove #${pageIdx * PAGE_SIZE + idx + 1}`)
              .setStyle(ButtonStyle.Danger)
          );
        });
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`remove_roles_all`)
            .setLabel("Remove All")
            .setStyle(ButtonStyle.Secondary)
        );
        let navRow = null;
        if (totalPages > 1) {
          navRow = new ActionRowBuilder();
          navRow.addComponents(
            new ButtonBuilder()
              .setCustomId("manage_roles_prev")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pageIdx === 0),
            new ButtonBuilder()
              .setCustomId("manage_roles_next")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pageIdx === totalPages - 1)
          );
        }
        return { embed, components: navRow ? [row, navRow] : [row] };
      };

      // Pagination
      if (customId === "manage_roles_prev" && page > 0) {
        const { embed, components } = await buildPage(page - 1);
        return interaction.update({ embeds: [embed], components });
      }
      if (customId === "manage_roles_next" && page < totalPages - 1) {
        const { embed, components } = await buildPage(page + 1);
        return interaction.update({ embeds: [embed], components });
      }

      // Remove All (confirmation)
      if (customId === "remove_roles_all") {
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("remove_roles_confirm")
            .setLabel("Confirm Remove All")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("remove_roles_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        );
        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚠️ Confirm Remove All")
              .setDescription(
                "Are you sure you want to remove **all** role-reaction messages? This cannot be undone."
              )
              .setColor(0xff0000),
          ],
          components: [confirmRow],
        });
      }
      if (customId === "remove_roles_cancel") {
        // Go back to current page
        const { embed, components } = await buildPage(page);
        return interaction.update({ embeds: [embed], components });
      }
      if (customId === "remove_roles_confirm") {
        // Remove all
        for (const messageId of messageIds) {
          try {
            for (const [, channel] of interaction.guild.channels.cache) {
              if (!channel.isTextBased?.()) continue;
              try {
                const msg = await channel.messages.fetch(messageId);
                await msg.delete();
                console.log(
                  `Deleted message ${messageId} in channel ${channel.id}`
                );
                break;
              } catch (err) {
                console.error(
                  `Failed to delete message ${messageId} in channel ${channel.id}:`,
                  err
                );
              }
            }
          } catch (err) {
            console.error(`Error searching for message ${messageId}:`, err);
          }
          await removeRoleMapping(messageId);
        }
        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ All Role-Reaction Messages Removed!")
              .setDescription(
                "All role-reaction messages and mappings have been removed."
              )
              .setColor(0x00ff00),
          ],
          components: [],
        });
      }

      // Remove single message
      if (
        customId.startsWith("remove_roles_") &&
        customId !== "remove_roles_all"
      ) {
        const messageId = customId.replace("remove_roles_", "");
        let deleted = false;
        let foundChannel = null;
        for (const [, channel] of interaction.guild.channels.cache) {
          if (!channel.isTextBased?.()) continue;
          try {
            console.log(
              `Attempting to fetch message ${messageId} in channel ${channel.id}`
            );
            const msg = await channel.messages.fetch(messageId);
            await msg.delete();
            console.log(
              `Deleted message ${messageId} in channel ${channel.id}`
            );
            deleted = true;
            foundChannel = channel;
            break;
          } catch (err) {
            if (err.code === 10008) {
              // Message not found in this channel, not a real error
            } else {
              console.error(
                `Failed to delete message ${messageId} in channel ${channel.id}:`,
                err
              );
            }
          }
        }
        await removeRoleMapping(messageId);
        // Rebuild current page (may have fewer items now)
        const newAllMappings = await getAllRoleMappings();
        const newMessageIds = Object.keys(newAllMappings);
        if (newMessageIds.length === 0) {
          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ All Role-Reaction Messages Removed!")
                .setDescription(
                  "All role-reaction messages and mappings have been removed."
                )
                .setColor(0x00ff00),
            ],
            components: [],
          });
        }
        const newTotalPages = Math.ceil(newMessageIds.length / PAGE_SIZE);
        const newPage = Math.min(page, newTotalPages - 1);
        // Rebuild embed for new page
        const getNewPage = pageIdx => {
          const start = pageIdx * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          return newMessageIds.slice(start, end);
        };
        const buildNewPage = async pageIdx => {
          const ids = getNewPage(pageIdx);
          const embed = new EmbedBuilder()
            .setTitle("🗂️ Manage Role-Reaction Messages")
            .setDescription(
              `Page ${pageIdx + 1} of ${newTotalPages}\nSelect a message to remove or use Remove All.`
            )
            .setColor(0x0099ff)
            .setTimestamp();

          // Fetch all messages in parallel for better performance
          const messagePromises = ids.map(async messageId => {
            let preview = `ID: \`${messageId}\``;
            let channelMention = "";
            let found = false;

            // Try to find the message in any channel
            for (const [, channel] of interaction.guild.channels.cache) {
              if (!channel.isTextBased?.()) continue;
              try {
                const msg = await channel.messages.fetch(messageId);
                preview = msg.embeds[0]?.title
                  ? `**${msg.embeds[0].title}**`
                  : preview;
                channelMention = channel.toString();
                found = true;
                break;
              } catch (err) {
                if (err.code === 10008) {
                  // Message not found in this channel
                } else {
                  console.error(
                    `Failed to fetch message ${messageId} in channel ${channel.id}:`,
                    err
                  );
                }
              }
            }

            if (!found) {
              preview += " (Message not found)";
            }

            return { messageId, preview, channelMention, found };
          });

          const messageResults = await Promise.all(messagePromises);

          // Add fields to embed
          messageResults.forEach((result, idx) => {
            embed.addFields({
              name: `#${idx + 1} ${result.channelMention}`,
              value: result.preview,
              inline: false,
            });
          });

          const row = new ActionRowBuilder();
          ids.forEach((messageId, idx) => {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`remove_roles_${messageId}`)
                .setLabel(`Remove #${pageIdx * PAGE_SIZE + idx + 1}`)
                .setStyle(ButtonStyle.Danger)
            );
          });
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`remove_roles_all`)
              .setLabel("Remove All")
              .setStyle(ButtonStyle.Secondary)
          );
          let navRow = null;
          if (newTotalPages > 1) {
            navRow = new ActionRowBuilder();
            navRow.addComponents(
              new ButtonBuilder()
                .setCustomId("manage_roles_prev")
                .setLabel("Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pageIdx === 0),
              new ButtonBuilder()
                .setCustomId("manage_roles_next")
                .setLabel("Next")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pageIdx === newTotalPages - 1)
            );
          }
          return { embed, components: navRow ? [row, navRow] : [row] };
        };
        const { embed, components } = await buildNewPage(newPage);
        let notice = null;
        if (!deleted) {
          notice = {
            name: "⚠️ Notice",
            value:
              "The message was already deleted, but the mapping has been cleaned up.",
            inline: false,
          };
          embed.addFields(notice);
        }
        return interaction.update({ embeds: [embed], components });
      }
    } catch (err) {
      console.error("Button handler error:", err);
      try {
        await interaction.update({
          content: "❌ An error occurred while processing your request.",
          components: [],
          embeds: [],
        });
      } catch (updateErr) {
        console.error("Failed to update interaction after error:", updateErr);
      }
    }
  },
};
