import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import {
  getAllRoleMappings,
  removeRoleMapping,
} from "../../utils/roleManager.js";

const PAGE_SIZE = 5;

export default {
  data: new SlashCommandBuilder()
    .setName("manage-roles")
    .setDescription("List and manage all role-reaction messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction, client) {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        content: "❌ You need administrator permissions to use this command!",
        ephemeral: true,
      });
    }

    // Use deferReply to handle processing time gracefully
    await interaction.deferReply({ ephemeral: true });

    const allMappings = await getAllRoleMappings();
    const messageIds = Object.keys(allMappings);
    if (messageIds.length === 0) {
      return interaction.editReply({
        content: "No active role-reaction messages found.",
        ephemeral: true,
      });
    }

    // Pagination logic
    let page = 0;
    const totalPages = Math.ceil(messageIds.length / PAGE_SIZE);
    const getPage = pageIdx => {
      const start = pageIdx * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      return messageIds.slice(start, end);
    };

    // Helper to build embed and components for a page
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
          } catch {
            // Message not found in this channel, continue to next
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

      // Buttons for each message
      const row = new ActionRowBuilder();
      ids.forEach((messageId, idx) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`remove_roles_${messageId}`)
            .setLabel(`Remove #${pageIdx * PAGE_SIZE + idx + 1}`)
            .setStyle(ButtonStyle.Danger)
        );
      });
      // Remove All button
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`remove_roles_all`)
          .setLabel("Remove All")
          .setStyle(ButtonStyle.Secondary)
      );

      // Pagination buttons if needed
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

    // Show first page
    const { embed, components } = await buildPage(page);
    await interaction.editReply({ embeds: [embed], components });
  },
};
