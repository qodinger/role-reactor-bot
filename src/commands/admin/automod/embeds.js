import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS, UI_COMPONENTS } from "../../../config/theme.js";

export function createAutomodSettingsEmbed(
  settings,
  _isPro = false,
  guildName = "this server",
  client = null,
) {
  const filters = [
    {
      key: "badWords",
      label: "Bad Words",
      emoji: "🚫",
      description: "Block inappropriate language",
    },
    {
      key: "links",
      label: "Links",
      emoji: "🔗",
      description: "Block URLs in messages",
    },
    {
      key: "spam",
      label: "Spam",
      emoji: "🔄",
      description: "Detect repeated messages",
    },
    {
      key: "mentionSpam",
      label: "Mentions",
      emoji: "📣",
      description: "Block mass mentions",
    },
    {
      key: "inviteLink",
      label: "Invites",
      emoji: "📩",
      description: "Block Discord invite links",
    },
    {
      key: "capsLock",
      label: "Caps",
      emoji: "🔠",
      description: "Block ALL CAPS messages",
    },
  ];

  const activeCount = filters.filter(f => settings[f.key]?.enabled).length;
  const hasAnyFilter = activeCount > 0;

  const embed = new EmbedBuilder()
    .setTitle("Auto-Moderation")
    .setDescription(`Configure filters for **${guildName}**`)
    .setColor(hasAnyFilter ? THEME.SUCCESS : THEME.PRIMARY)
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Auto-Mod",
        client?.user?.displayAvatarURL() || null,
      ),
    );

  // Status field
  embed.addFields({
    name: hasAnyFilter ? "Status" : "Status",
    value: hasAnyFilter
      ? `${EMOJIS.STATUS.ONLINE} **${activeCount}** of **${filters.length}** filters enabled`
      : `${EMOJIS.STATUS.OFFLINE} No filters enabled`,
    inline: false,
  });

  // Filters field
  const filterStatus = filters.map(f => {
    const filterSettings = settings[f.key];
    const enabled = filterSettings?.enabled;
    const icon = enabled ? EMOJIS.STATUS.SUCCESS : EMOJIS.STATUS.OFFLINE;

    if (!enabled) {
      return `${icon} ${f.emoji} **${f.label}** — ${f.description}`;
    }

    const action = filterSettings?.action || "delete";
    const duration = filterSettings?.timeoutDuration || 5;
    const actionText = formatAction(action, duration);

    return `${icon} ${f.emoji} **${f.label}** — ${actionText}`;
  });

  embed.addFields({
    name: "Filters",
    value: filterStatus.join("\n"),
    inline: false,
  });

  // Getting started (only when no filters enabled)
  if (!hasAnyFilter) {
    embed.addFields({
      name: "Getting Started",
      value: [
        `${EMOJIS.NUMBERS.ONE} Click **⚙️ Configure** to set up each filter`,
        `${EMOJIS.NUMBERS.TWO} Click the filter button to edit settings`,
        `${EMOJIS.NUMBERS.THREE} Select an action from the dropdown`,
        `${EMOJIS.NUMBERS.FOUR} Toggle the filter ON when ready`,
        "",
        `Or click **⚡ Quick Setup** to enable all filters with default settings.`,
      ].join("\n"),
      inline: false,
    });
    return embed;
  }

  // Advanced settings
  const settingsRows = [];

  if (settings.logChannel) {
    settingsRows.push({
      name: "Log Channel",
      value: `${EMOJIS.UI.CHANNELS} <#${settings.logChannel}>`,
      inline: true,
    });
  }

  if (settings.ignoredRoles?.length > 0) {
    const roles = settings.ignoredRoles;
    const rolePreview =
      roles.length <= 3
        ? roles.map(r => `<@&${r}>`).join(", ")
        : `${roles
            .slice(0, 2)
            .map(r => `<@&${r}>`)
            .join(", ")} +${roles.length - 2} more`;
    settingsRows.push({
      name: "Ignored Roles",
      value: `${EMOJIS.FEATURES.ROLES} ${rolePreview}`,
      inline: true,
    });
  }

  if (settings.ignoredChannels?.length > 0) {
    const channels = settings.ignoredChannels;
    const channelPreview =
      channels.length <= 3
        ? channels.map(c => `<#${c}>`).join(", ")
        : `${channels
            .slice(0, 2)
            .map(c => `<#${c}>`)
            .join(", ")} +${channels.length - 2} more`;
    settingsRows.push({
      name: "Ignored Channels",
      value: `${EMOJIS.UI.CHANNELS} ${channelPreview}`,
      inline: true,
    });
  }

  if (settingsRows.length > 0) {
    embed.addFields({
      name: "Advanced Settings",
      value: "\u200B",
      inline: false,
    });
    embed.addFields(settingsRows);
  }

  return embed;
}

export function createAutomodStatsEmbed(analytics, guildName, client) {
  const embed = new EmbedBuilder()
    .setTitle("Auto-Mod Statistics")
    .setDescription(`Violation statistics for **${guildName}**`)
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Auto-Mod",
        client?.user?.displayAvatarURL() || null,
      ),
    );

  const totalViolations = analytics.totalViolations || 0;

  embed.addFields({
    name: "Total Violations",
    value: `${EMOJIS.SORT} **${totalViolations}**`,
    inline: true,
  });

  const violationsByType = [
    { key: "bad_words", label: "Bad Words", emoji: "🚫" },
    { key: "link", label: "Links", emoji: "🔗" },
    { key: "spam", label: "Spam", emoji: "🔄" },
    { key: "mention_spam", label: "Mentions", emoji: "📣" },
    { key: "invite_link", label: "Invites", emoji: "📩" },
    { key: "caps_lock", label: "Caps", emoji: "🔠" },
  ];

  const typeFields = violationsByType.map(v => ({
    name: v.label,
    value: `${v.emoji} **${analytics.violationsByType?.[v.key] || 0}**`,
    inline: true,
  }));

  embed.addFields(typeFields);

  return embed;
}

function formatAction(action, duration) {
  if (!action) return "Delete";

  const actions = Array.isArray(action) ? action : [action];

  return actions
    .map(a => {
      switch (a) {
        case "timeout":
          return `Timeout ${duration || 5}min`;
        case "kick":
          return "Kick";
        case "ban":
          return "Ban";
        case "delete":
        default:
          return "Delete";
      }
    })
    .join(" + ");
}
