import { EmbedBuilder } from "discord.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { getLogger } from "../../../utils/logger.js";
import { THEME } from "../../../config/theme.js";

const logger = getLogger();

export async function handleSearch(interaction, client) {
  const query = interaction.options.getString("query");
  const channel = interaction.options.getChannel("channel");
  const limit = interaction.options.getInteger("limit") || 10;

  const guild = interaction.guild;
  const rest = client.rest;

  let endpoint = `/guilds/${guild.id}/messages/search?query=${encodeURIComponent(query)}&limit=${limit}`;

  if (channel) {
    endpoint += `&channel_id=${channel.id}`;
  }

  try {
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
    logger.error("Error searching messages:", error);

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

export async function handleSearchCommand(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  await handleSearch(interaction, client);
}
