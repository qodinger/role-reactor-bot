import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS, EMOJIS } from "../../../config/theme.js";
import { CORE_STATUS } from "../../../features/premium/config.js";
import { formatNumber, getChannelCounts, getMemberCounts } from "./utils.js";

/**
 * Create server info embed
 * @param {import('discord.js').Guild} guild - Guild instance
 * @param {import('discord.js').Client} client - Discord client
 * @param {boolean} membersFetched - Whether all members were successfully fetched
 * @param {Object} proEngine - Pro Engine status information
 * @returns {EmbedBuilder}
 */
export function createServerInfoEmbed(
  guild,
  client,
  membersFetched = false,
  proEngine = { active: false },
) {
  const memberCounts = getMemberCounts(guild);
  const channelCounts = getChannelCounts(guild);

  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setAuthor(
      UI_COMPONENTS.createAuthor(guild.name, guild.iconURL({ size: 128 })),
    )
    .setTitle("Server Information")
    .setTimestamp();

  // Guild description
  if (guild.description) {
    embed.setDescription(
      `> ${guild.description.length > 500 ? guild.description.substring(0, 497) + "..." : guild.description}`,
    );
  }

  // Row 1: General Info
  embed.addFields(
    {
      name: "Owner",
      value: `**${guild.members.cache.get(guild.ownerId)?.user.tag || "Unknown"}**\nCreated <t:${Math.floor(guild.createdAt.getTime() / 1000)}:R>`,
      inline: true,
    },
    {
      name: "Server ID",
      value: `\`${guild.id}\``,
      inline: true,
    },
    {
      name: "Engine Tier",
      value: proEngine.active
        ? `${CORE_STATUS.PRO.label} ${CORE_STATUS.PRO.emoji}`
        : `${CORE_STATUS.REGULAR.label}`,
      inline: true,
    },
  );

  // Row 2: Members & Channels
  embed.addFields(
    {
      name: `Members (${formatNumber(memberCounts.total)})`,
      value: `Humans: ${formatNumber(memberCounts.humans)}\nBots: ${formatNumber(memberCounts.bots)}${memberCounts.uncached > 0 && !membersFetched ? `\n\n*Cached data for ${formatNumber(memberCounts.cached)} members*` : ""}`,
      inline: true,
    },
    {
      name: `Channels (${formatNumber(channelCounts.text + channelCounts.voice + channelCounts.forum + channelCounts.stage + channelCounts.category)})`,
      value: [
        `Text: ${formatNumber(channelCounts.text)}`,
        `Voice: ${formatNumber(channelCounts.voice)}`,
        channelCounts.forum > 0
          ? `Forum: ${formatNumber(channelCounts.forum)}`
          : null,
        channelCounts.stage > 0
          ? `Stage: ${formatNumber(channelCounts.stage)}`
          : null,
        `Categories: ${formatNumber(channelCounts.category)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      inline: true,
    },
  );

  // Row 3: Meta Information
  embed.addFields({
    name: "Assets",
    value: [
      `Roles: ${formatNumber(guild.roles.cache.size)}`,
      guild.emojis.cache.size > 0
        ? `Emojis: ${formatNumber(guild.emojis.cache.size)}`
        : null,
      guild.stickers.cache.size > 0
        ? `Stickers: ${formatNumber(guild.stickers.cache.size)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    inline: true,
  });

  // Boost Level
  if (guild.premiumSubscriptionCount > 0) {
    embed.addFields({
      name: "Server Boost",
      value: `Level ${guild.premiumTier} • ${guild.premiumSubscriptionCount} Boosts`,
      inline: false,
    });
  }

  // Banner
  if (guild.bannerURL()) {
    embed.setImage(guild.bannerURL({ size: 1024 }));
  }

  embed.setFooter(
    UI_COMPONENTS.createFooter(
      `Intelligence Data Generated`,
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
