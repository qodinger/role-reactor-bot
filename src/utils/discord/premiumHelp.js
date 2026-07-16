import { CORE_STATUS } from "../../features/premium/config.js";
import { errorEmbed } from "./responseMessages.js";
import { getMentionableCommand } from "../commandUtils.js";
import { WEBSITE_URL } from "../../config/domains.js";

/**
 * Creates a consistent Free vs Pro help field
 * @param {string} freeLimit - Description of free tier limit
 * @param {string} proLimit - Description of Pro Engine limit
 * @returns {object} Help field object
 */
export function createFreeVsProField(freeLimit, proLimit) {
  return {
    name: `⚡ ${CORE_STATUS.PRO.name} vs Free`,
    value: [
      `**Free:** ${freeLimit}`,
      `**${CORE_STATUS.PRO.name}:** ${proLimit}`,
      `Upgrade on **[${WEBSITE_URL}](${WEBSITE_URL})**`,
    ].join("\n"),
    inline: false,
  };
}

/**
 * List of all commands with their free/pro limits for /premium command
 */
export const PREMIUM_FEATURES = [
  {
    command: "automod",
    name: "Auto-Moderation",
    emoji: "🛡️",
    free: "5 filters (bad words, links, spam, mentions, invites)",
    pro: "7 features (domain allowlist, caps lock, wildcard/regex, per-channel, analytics, export)",
  },
  {
    command: "schedule-role",
    name: "Scheduled Roles",
    emoji: "📅",
    free: "5 active schedules",
    pro: "500 active schedules",
  },
  {
    command: "temp-roles",
    name: "Temporary Roles",
    emoji: "⏰",
    free: "25 active, 25 bulk actions",
    pro: "500 active, 250 bulk actions",
  },
  {
    command: "role-bundle",
    name: "Role Bundles",
    emoji: "📦",
    free: "5 roles per bundle",
    pro: "15 roles per bundle",
  },
  {
    command: "role-reactions",
    name: "Role Reactions",
    emoji: "⭐",
    free: "10 emojis, 3 menus",
    pro: "20 emojis, 8 menus",
  },
  {
    command: "xp",
    name: "XP & Levels",
    emoji: "📈",
    free: "5 rewards, Stack mode only",
    pro: "Unlimited rewards, Replace mode",
  },
  {
    command: "giveaway",
    name: "Giveaways",
    emoji: "🎁",
    free: "2,500 entries, 5 winners, 3 active",
    pro: "50,000 entries, 20 winners, 20 active",
  },
  {
    command: "ticket",
    name: "Ticketing",
    emoji: "🎫",
    free: "Text transcripts (30 days)",
    pro: "HTML/JSON exports, unlimited storage",
  },
];

/**
 * Creates a consistent upgrade embed when a user hits a free tier limit.
 * Returns the same {embeds, flags} format as errorEmbed() for direct use in interaction.reply/editReply.
 * @param {object} options
 * @param {string} options.feature - Display name of the feature (e.g. "Role Reaction Menus")
 * @param {string} options.freeText - Free tier limit description (e.g. "3 menus")
 * @param {string} options.proText - Pro tier limit description (e.g. "20 menus")
 * @param {import('discord.js').Client} [options.client] - Discord client for mentionable /vote command
 * @returns {{embeds: import('discord.js').EmbedBuilder[], flags: number}}
 */
export function upgradeLimitEmbed({ feature, freeText, proText, client }) {
  const voteCmd = client ? getMentionableCommand(client, "vote") : "`/vote`";
  return errorEmbed({
    title: "Free Tier Limit Reached",
    description: `You've reached the **${feature}** limit for the free plan.`,
    fields: [
      { name: "Free Plan", value: freeText, inline: true },
      { name: `⚡ ${CORE_STATUS.PRO.name}`, value: proText, inline: true },
    ],
    solution: `Purchase Cores at **[${WEBSITE_URL}](${WEBSITE_URL})** · Earn free Cores with ${voteCmd}`,
    isPremium: true,
  });
}
