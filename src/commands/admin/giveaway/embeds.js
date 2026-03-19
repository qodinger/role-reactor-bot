/**
 * Giveaway Embeds - Create and format giveaway embeds
 * @module commands/admin/giveaway/embeds
 */

import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";

import { getMentionableCommand } from "../../../utils/commandUtils.js";

/**
 * Create a giveaway embed
 * @param {Object} giveaway - Giveaway data
 * @param {number} totalEntries - Total entry count
 * @param {Object} client - Discord client instance
 * @returns {EmbedBuilder}
 */
export function createGiveawayEmbed(giveaway, totalEntries = 0, client = null) {
  const embed = new EmbedBuilder()
    .setTitle(`🎉  ${giveaway.prize}`)
    .setDescription(giveaway.description || "Click the button below to enter!")
    .setColor(giveaway.color || THEME.PRIMARY)
    .addFields(
      {
        name: "Winners",
        value: `**${giveaway.winners}**`,
        inline: true,
      },
      {
        name: "Entries",
        value: `**${totalEntries.toLocaleString()}**`,
        inline: true,
      },
      {
        name: "Ends",
        value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
        inline: true,
      },
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Hosted by ${giveaway.hostUsername || "Server Staff"} • ID: ${giveaway.shortId || giveaway._id.toString().slice(-6)}`,
      ),
    )
    .setTimestamp(giveaway.startTime);

  if (giveaway.thumbnail) {
    embed.setThumbnail(giveaway.thumbnail);
  }

  // Add requirements if any
  const requirements = [];

  if (giveaway.requirements?.roles?.length > 0) {
    requirements.push("Specific roles required");
  }

  if (giveaway.requirements?.minAccountAge > 0) {
    const days = giveaway.requirements.minAccountAge / (1000 * 60 * 60 * 24);
    requirements.push(`Account age: ${days}+ days`);
  }

  if (giveaway.requirements?.minServerAge > 0) {
    const days = giveaway.requirements.minServerAge / (1000 * 60 * 60 * 24);
    requirements.push(`Server member: ${days}+ days`);
  }

  if (giveaway.requirements?.minLevel > 0) {
    requirements.push(`Minimum Level: **${giveaway.requirements.minLevel}**`);
  }

  if (giveaway.requirements?.requireVote) {
    requirements.push(
      `Must have voted via ${getMentionableCommand(client, "vote")} in the last 12h`,
    );
  }

  if (requirements.length > 0) {
    embed.addFields({
      name: "Requirements",
      value: requirements.map(r => `${r}`).join("\n"),
      inline: false,
    });
  }

  return embed;
}

/**
 * Create a giveaway winner announcement embed
 * @param {Object} giveaway - Giveaway data
 * @param {Array} winners - Array of winner objects with userId
 * @param {Object} client - Discord client for user lookup
 * @returns {Promise<EmbedBuilder>}
 */
export async function createWinnerEmbed(giveaway, winners, client) {
  const winnerMentions = [];

  for (const winner of winners) {
    try {
      const user = await client.users.fetch(winner.userId);
      winnerMentions.push(`<@${winner.userId}> (${user.tag})`);
    } catch {
      winnerMentions.push(`<@${winner.userId}> (Unknown)`);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 GIVEAWAY WINNER! 🏆")
    .setColor(THEME.SUCCESS)
    .addFields(
      {
        name: "🎁 Prize",
        value: giveaway.prize,
        inline: true,
      },
      {
        name: "🎉 Winners",
        value: winnerMentions.join("\n"),
        inline: false,
      },
      {
        name: "📊 Total Entries",
        value: `${giveaway.entries.reduce((sum, e) => sum + e.count, 0).toLocaleString()}`,
        inline: true,
      },
      {
        name: "👤 Host",
        value: giveaway.host ? `<@${giveaway.host}>` : "Server Staff",
        inline: true,
      },
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        giveaway.winnersData?.[0]?.claimed
          ? "Prize claimed ✓"
          : "Winners have 48 hours to claim their prize",
      ),
    )
    .setTimestamp();

  if (giveaway.thumbnail) {
    embed.setThumbnail(giveaway.thumbnail);
  }

  return embed;
}

/**
 * Create a giveaway ended embed (no winners)
 * @param {Object} giveaway - Giveaway data
 * @returns {EmbedBuilder}
 */
export function createNoEntriesEmbed(giveaway) {
  const embed = new EmbedBuilder()
    .setTitle("😔 GIVEAWAY ENDED")
    .setDescription("No one entered this giveaway.")
    .setColor(THEME.ERROR)
    .addFields(
      {
        name: "🎁 Prize",
        value: giveaway.prize,
        inline: true,
      },
      {
        name: "👤 Host",
        value: giveaway.host ? `<@${giveaway.host}>` : "Server Staff",
        inline: true,
      },
    )
    .setFooter(UI_COMPONENTS.createFooter("Better luck next time!"))
    .setTimestamp();

  return embed;
}

/**
 * Create a giveaway list embed
 * @param {Array} giveaways - Array of active giveaways
 * @returns {EmbedBuilder}
 */
/**
 * Create a giveaway list embed matching the schedule list design
 * @param {Array} giveaways - Array of giveaways to display
 * @param {Object} guild - Discord guild object
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {number} totalGiveaways - Total totalGiveaways count
 * @param {Object} client - Discord client
 * @param {boolean} showAll - Whether to show all including ended/cancelled
 * @returns {EmbedBuilder}
 */
export function createGiveawayListEmbed(
  giveaways,
  guild,
  currentPage,
  totalPages,
  totalGiveaways,
  client,
  showAll = false,
) {
  const embed = new EmbedBuilder()
    .setTitle("Giveaways")
    .setDescription(
      showAll
        ? `Showing **${totalGiveaways}** giveaway${totalGiveaways !== 1 ? "s" : ""} (including ended, completed, and cancelled)`
        : `Showing **${totalGiveaways}** active giveaway${totalGiveaways !== 1 ? "s" : ""}`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: `${guild.name} • Page ${currentPage} of ${totalPages || 1}`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (giveaways.length === 0) {
    embed.addFields({
      name: "No Giveaways Found",
      value: `No giveaways found. Use ${getMentionableCommand(client, "giveaway create")} to create a new giveaway.`,
      inline: false,
    });
    return embed;
  }

  for (const gw of giveaways) {
    const totalEntries = gw.entries.reduce((sum, e) => sum + e.count, 0);

    let statusText = "";
    let statusColor = "";
    switch (gw.status) {
      case "active":
        statusText = "Active";
        statusColor = "🟢";
        break;
      case "ended":
        statusText = "Ended";
        statusColor = "🔴";
        break;
      case "completed":
        statusText = "Completed";
        statusColor = "✅";
        break;
      case "cancelled":
        statusText = "Cancelled";
        statusColor = "❌";
        break;
      default:
        statusText = "Unknown";
        statusColor = "❓";
    }

    const timeString =
      gw.status === "active"
        ? `**Ends:** <t:${Math.floor(new Date(gw.endTime).getTime() / 1000)}:R>`
        : `**Ended:** <t:${Math.floor(new Date(gw.endTime).getTime() / 1000)}:R>`;

    embed.addFields({
      name: `${statusColor} ${gw.prize}`,
      value: `**ID:** \`${gw.shortId || gw.messageId || gw._id.toString()}\`\n**Status:** ${statusText}\n**Winners:** ${gw.winners}\n**Entries:** ${totalEntries}\n${timeString}`,
      inline: false,
    });
  }

  return embed;
}

/**
 * Create a confirmation embed for giveaway actions
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @returns {EmbedBuilder}
 */
export function createConfirmationEmbed(title, description, type = "info") {
  const colors = {
    success: THEME.SUCCESS,
    error: THEME.ERROR,
    warning: THEME.WARNING,
    info: THEME.INFO,
  };

  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  const embed = new EmbedBuilder()
    .setTitle(`${icons[type]} ${title}`)
    .setDescription(description)
    .setColor(colors[type])
    .setTimestamp();

  return embed;
}

/**
 * Create an entry confirmation embed (ephemeral)
 * @param {Object} giveaway - Giveaway data
 * @param {number} userEntries - User's entry count
 * @param {number} totalEntries - Total entry count
 * @returns {EmbedBuilder}
 */
export function createEntryConfirmEmbed(giveaway, userEntries, totalEntries) {
  const embed = new EmbedBuilder()
    .setTitle("✅ Successfully Entered!")
    .setDescription(`You've entered the giveaway for **${giveaway.prize}**.`)
    .setColor(THEME.SUCCESS)
    .addFields(
      {
        name: "🎫 Your Entries",
        value: `${userEntries}`,
        inline: true,
      },
      {
        name: "📊 Total Entries",
        value: `${totalEntries.toLocaleString()}`,
        inline: true,
      },
      {
        name: "⏰ Ends",
        value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
        inline: false,
      },
    )
    .setFooter(UI_COMPONENTS.createFooter("Good luck! 🍀"))
    .setTimestamp();

  return embed;
}

/**
 * Create a winner DM embed
 * @param {Object} giveaway - Giveaway data
 * @param {string} guildName - Guild name
 * @returns {EmbedBuilder}
 */
export function createWinnerDmEmbed(giveaway, guildName) {
  const embed = new EmbedBuilder()
    .setTitle("🎉 Congratulations! You Won! 🎉")
    .setColor(THEME.PRIMARY)
    .setDescription(
      `You won the **${giveaway.prize}** giveaway in **${guildName}**!`,
    )
    .addFields(
      {
        name: "📋 Next Steps",
        value: "Contact the giveaway host to claim your prize!",
        inline: false,
      },
      {
        name: "⏰ Claim Period",
        value: "You have 48 hours to claim your prize.",
        inline: false,
      },
    )
    .setFooter(UI_COMPONENTS.createFooter("Congratulations again!"))
    .setTimestamp();

  return embed;
}
