import { CORE_STATUS } from "../../features/premium/config.js";

/**
 * Creates a consistent Free vs Pro help field
 * @param {string} freeLimit - Description of free tier limit
 * @param {string} proLimit - Description of Pro Engine limit
 * @param {string} upgradeUrl - URL to upgrade (optional, defaults to rolereactor.app)
 * @returns {object} Help field object
 */
export function createFreeVsProField(
  freeLimit,
  proLimit,
  upgradeUrl = "rolereactor.app",
) {
  return {
    name: `⚡ ${CORE_STATUS.PRO.name} vs Free`,
    value: [
      `**Free:** ${freeLimit}`,
      `**${CORE_STATUS.PRO.name}:** ${proLimit}`,
      `Upgrade on **[${upgradeUrl}](https://${upgradeUrl})**`,
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
    free: "25 active schedules",
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
 * Creates upgrade prompt message when hitting limits
 * @param {string} featureName - Name of the feature
 * @param {string} freeLimit - Description of free limit
 * @returns {object} Embed for upgrade prompt
 */
export function createUpgradePrompt(featureName, freeLimit) {
  return {
    title: `${CORE_STATUS.PRO.emoji} Upgrade to ${CORE_STATUS.PRO.name}`,
    description: `You've reached the **free tier limit** for ${featureName}.`,
    fields: [
      {
        name: "Current Limit",
        value: freeLimit,
        inline: true,
      },
      {
        name: "Need More?",
        value: `Upgrade to ${CORE_STATUS.PRO.name} for unlimited!`,
        inline: true,
      },
    ],
    footer: `Enable ${CORE_STATUS.PRO.name} on rolereactor.app using Cores`,
  };
}
