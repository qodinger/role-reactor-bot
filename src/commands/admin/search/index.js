import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { THEME } from "../../../config/theme.js";

export const metadata = {
  name: "search",
  category: "admin",
  description: "Search for messages in the server",
  keywords: ["search", "find", "messages", "log", "moderation"],
  emoji: "🔍",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/search query:spammer channel:#general limit:10```",
      inline: false,
    },
    {
      name: `Parameters`,
      value: [
        "**query** - Text to search for (required)",
        "**channel** - Channel to search in (optional, defaults to all)",
        "**limit** - Number of results (1-25, default: 10)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Messages** permission required",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(opt =>
    opt.setName("query").setDescription("Text to search for").setRequired(true),
  )
  .addChannelOption(opt =>
    opt
      .setName("channel")
      .setDescription("Channel to search in")
      .setRequired(false),
  )
  .addIntegerOption(opt =>
    opt
      .setName("limit")
      .setDescription("Number of results (1-25)")
      .setMinValue(1)
      .setMaxValue(25)
      .setRequired(false),
  );

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description: "You need admin permissions to search messages.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    await interaction.deferReply({ ephemeral: true });

    const query = interaction.options.getString("query");
    const channel = interaction.options.getChannel("channel");
    const limit = interaction.options.getInteger("limit") || 10;

    const guild = interaction.guild;
    const rest = client.rest;

    let endpoint = `/guilds/${guild.id}/messages/search?query=${encodeURIComponent(query)}&limit=${limit}`;

    if (channel) {
      endpoint += `&channel_id=${channel.id}`;
    }

    const results = await rest.get(endpoint);

    if (!results || results.messages?.length === 0) {
      return interaction.editReply({
        content: `No messages found matching "${query}"`,
      });
    }

    const messages = results.messages.flat();
    const displayMessages = messages.slice(0, limit);

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search Results for "${query}"`)
      .setColor(THEME.INFO)
      .setDescription(`Found ${messages.length} message(s)`)
      .setTimestamp();

    for (const msg of displayMessages) {
      const channelName =
        guild.channels.cache.get(msg.channel_id)?.name || "Unknown";
      const author = msg.author;
      const content = msg.content?.slice(0, 200) || "(embed/attachment)";
      const timestamp = msg.timestamp;

      embed.addFields({
        name: `${author.username}#${author.discriminator} in #${channelName}`,
        value: `${content}\n<t:${Math.floor(new Date(timestamp).getTime() / 1000)}>`,
        inline: false,
      });
    }

    return interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    logger.error("Error in search command:", error);

    if (error.code === 160001) {
      return interaction.editReply({
        content:
          "Search is not available for this server yet. The server needs to be indexed first.",
      });
    }

    return interaction.editReply(
      errorEmbed({
        title: "Search Failed",
        description: "Could not search messages. Please try again.",
      }),
    );
  }
}
