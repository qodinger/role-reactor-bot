/**
 * List of all commands with their free/pro limits for /premium command
 */
export const PREMIUM_FEATURES = [
  {
    command: "automod",
    name: "Auto-Moderation",
    emoji: "🛡️",
    free: "Bad words, links, spam filters",
    pro: "Domain allowlisting (whitelist trusted domains)",
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
    pro: "20 emojis, 20 menus",
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
    free: "Basic text transcripts",
    pro: "HTML/JSON exports, unlimited storage",
  },
  {
    command: "invite-roles",
    name: "Invite Tracking",
    emoji: "🎟️",
    free: "Basic invites",
    pro: "Advanced analytics & roles",
  },
  {
    command: "voice-status",
    name: "Voice Channel Status",
    emoji: "🎤",
    free: "Standard status",
    pro: "Custom statuses & branding",
  },
];
