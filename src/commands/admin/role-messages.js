import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import { getAllRoleMappings } from "../../utils/roleManager.js";

const PAGE_SIZE = 5;

export default {
  data: new SlashCommandBuilder()
    .setName("role-messages")
    .setDescription(
      "List all current role-reaction messages and their message IDs",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction, _client) {
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
    const page = 0;
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
        .setTitle("🗂️ Role-Reaction Messages")
        .setDescription(
          `Page ${pageIdx + 1} of ${totalPages}\nList of all role-reaction messages.`,
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
          value: `${result.preview}\nMessage ID: \`${result.messageId}\``,
          inline: false,
        });
      });

      // No buttons or components
      return { embed, components: [] };
    };

    // Show first page
    const { embed, components } = await buildPage(page);
    await interaction.editReply({ embeds: [embed], components });
  },
};
