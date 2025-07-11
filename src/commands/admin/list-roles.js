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
    .setName("list-roles")
    .setDescription("List all role-reaction messages")
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

    // Only include role-reaction messages for the current guild
    const allMappings = await getAllRoleMappings();
    const messageIds = Object.keys(allMappings).filter(messageId => {
      const mapping = allMappings[messageId];
      // If mapping has a guildId, filter by it
      if (mapping && typeof mapping === "object" && mapping.guildId) {
        return mapping.guildId === interaction.guild.id;
      }
      // Fallback: old logic (check if message exists in this guild's channels)
      for (const [, channel] of interaction.guild.channels.cache) {
        if (!channel.isTextBased?.()) continue;
        try {
          const msg = channel.messages.cache.get(messageId);
          if (msg && msg.guildId === interaction.guild.id) return true;
        } catch {}
      }
      return false;
    });
    if (messageIds.length === 0) {
      return interaction.editReply({
        content: "No active role-reaction messages found for this server.",
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

      // For each message, show roles and their limits/quotas
      for (let idx = 0; idx < messageResults.length; idx++) {
        const result = messageResults[idx];
        const messageId = result.messageId;
        const mapping = allMappings[messageId];

        // Build role information
        let roleInfo = "";
        if (mapping) {
          // Support new structure: { guildId, roles }
          const rolesObj = mapping.roles ? mapping.roles : mapping;
          const roleEntries = [];

          for (const [emoji, roleConfig] of Object.entries(rolesObj)) {
            let roleName, limit;
            if (typeof roleConfig === "string") {
              roleName = roleConfig;
              limit = null;
            } else {
              roleName =
                roleConfig.roleName || roleConfig.role || roleConfig.name;
              limit = roleConfig.limit;
            }

            const role = interaction.guild.roles.cache.find(
              r => r.name === roleName,
            );
            const currentCount = role ? role.members.size : 0;
            const limitText = limit
              ? `${currentCount}/${limit} users`
              : `${currentCount} users`;
            roleEntries.push(`${emoji} **${roleName}** (${limitText})`);
          }

          if (roleEntries.length > 0) {
            roleInfo = `\n**Roles:** ${roleEntries.join(", ")}`;
          }
        }

        embed.addFields({
          name: `#${idx + 1} ${result.channelMention}`,
          value: `${result.preview}${roleInfo}\nMessage ID: \`${result.messageId}\``,
          inline: false,
        });
      }

      // No buttons or components
      return { embed, components: [] };
    };

    // Show first page
    const { embed, components } = await buildPage(page);
    await interaction.editReply({ embeds: [embed], components });
  },
};
