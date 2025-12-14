import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";
import { formatNumber, getChannelCounts, getMemberCounts } from "./utils.js";

/**
 * Create server info embed
 * @param {import('discord.js').Guild} guild - Guild instance
 * @param {import('discord.js').Client} client - Discord client
 * @param {boolean} membersFetched - Whether all members were successfully fetched
 * @returns {EmbedBuilder}
 */
export function createServerInfoEmbed(guild, client, membersFetched = false) {
  // Build description with server name and optional description
  // Discord embed description limit is 4096, but we'll truncate at 2000 for readability
  let description = `**${guild.name}**`;
  if (guild.description) {
    const maxDescLength = 2000 - description.length - 2; // Reserve space for name + newlines
    const truncatedDesc =
      guild.description.length > maxDescLength
        ? `${guild.description.substring(0, maxDescLength - 3)}...`
        : guild.description;
    description += `\n\n${truncatedDesc}`;
  }

  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle("Server Information")
    .setDescription(description)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
    .setTimestamp();

  const fields = [];

  // Basic Information - Row 1
  fields.push(
    {
      name: "Owner",
      value: guild.members.cache.get(guild.ownerId)?.user.tag || "Unknown",
      inline: true,
    },
    {
      name: "Created",
      value: guild.createdAt
        ? `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:R>`
        : "Unknown",
      inline: true,
    },
    {
      name: "Server ID",
      value: `\`${guild.id}\``,
      inline: true,
    },
  );

  // Member Statistics - Clear text labels
  const memberCounts = getMemberCounts(guild);
  const memberInfo = [
    `**Online:** ${formatNumber(memberCounts.online)}`,
    `**Idle:** ${formatNumber(memberCounts.idle)}`,
    `**DND:** ${formatNumber(memberCounts.dnd)}`,
    `**Offline:** ${formatNumber(memberCounts.offline)}`,
  ];

  memberInfo.push(
    `\n**Humans:** ${formatNumber(memberCounts.humans)}`,
    `**Bots:** ${formatNumber(memberCounts.bots)}`,
  );

  if (memberCounts.uncached > 0 && !membersFetched) {
    memberInfo.push(
      `\n*Presence data for ${formatNumber(memberCounts.cached)}/${formatNumber(memberCounts.total)} members*`,
    );
  }

  fields.push({
    name: `Members [${formatNumber(memberCounts.total)}]`,
    value: memberInfo.join("\n"),
    inline: true,
  });

  // Channel Statistics - Clear labels
  const channelCounts = getChannelCounts(guild);
  const channelInfo = [
    `**Text:** ${formatNumber(channelCounts.text)}`,
    `**Voice:** ${formatNumber(channelCounts.voice)}`,
    `**Forum:** ${formatNumber(channelCounts.forum)}`,
    `**Stage:** ${formatNumber(channelCounts.stage)}`,
    `**Categories:** ${formatNumber(channelCounts.category)}`,
    `**Threads:** ${formatNumber(channelCounts.threads)}`,
  ];

  fields.push({
    name: `Channels [${formatNumber(channelCounts.total)}]`,
    value: channelInfo.join("\n"),
    inline: true,
  });

  // Server Statistics - Row 3
  fields.push(
    {
      name: "Roles",
      value: formatNumber(guild.roles.cache.size),
      inline: true,
    },
    {
      name: "Emojis",
      value: formatNumber(guild.emojis.cache.size),
      inline: true,
    },
    {
      name: "Stickers",
      value: formatNumber(guild.stickers.cache.size),
      inline: true,
    },
  );

  // Boost Level (if applicable)
  if (guild.premiumSubscriptionCount > 0) {
    fields.push({
      name: "Server Boost",
      value: `Level ${guild.premiumTier} • ${guild.premiumSubscriptionCount} boost${guild.premiumSubscriptionCount !== 1 ? "s" : ""}`,
      inline: false,
    });
  }

  // Server banner
  if (guild.bannerURL()) {
    embed.setImage(guild.bannerURL({ size: 1024 }));
  }

  embed
    .addFields(fields)
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Server ID: ${guild.id}`,
        client.user.displayAvatarURL(),
      ),
    );

  return embed;
}

/**
 * Create error embed
 * @param {import('discord.js').User} user - User who triggered the error
 * @param {string} message - Error message
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed(user, message = null) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle("Error")
    .setDescription(
      message ||
        "Sorry! I couldn't retrieve server information right now.\n\n" +
          "This might be due to:\n" +
          "• Temporary Discord API issues\n" +
          "• Network connectivity problems\n" +
          "• Bot maintenance\n\n" +
          "Please try again in a few moments!",
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        "If this problem persists, contact support",
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}
