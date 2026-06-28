import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS, UI_COMPONENTS } from "../../../config/theme.js";

export function createAutomodSettingsEmbed(
  settings,
  _isPro = false,
  guildName = "this server",
  client = null,
) {
  const hasAnyFilter =
    settings.badWords?.enabled ||
    settings.links?.enabled ||
    settings.spam?.enabled ||
    settings.mentionSpam?.enabled ||
    settings.inviteLink?.enabled;

  const embed = new EmbedBuilder()
    .setTitle("Auto-Moderation")
    .setDescription(`Configure auto-mod filters for **${guildName}**`)
    .setColor(hasAnyFilter ? THEME.SUCCESS : THEME.PRIMARY)
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Auto-Mod",
        client?.user?.displayAvatarURL() || null,
      ),
    );

  embed.addFields([
    {
      name: "Status",
      value: hasAnyFilter
        ? `${EMOJIS.STATUS.SUCCESS} Enabled`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Filters",
      value: [
        `Bad Words: ${settings.badWords?.enabled ? "On" : "Off"}`,
        `Links: ${settings.links?.enabled ? "On" : "Off"}`,
        `Spam: ${settings.spam?.enabled ? "On" : "Off"}`,
        `Mentions: ${settings.mentionSpam?.enabled ? "On" : "Off"}`,
        `Invites: ${settings.inviteLink?.enabled ? "On" : "Off"}`,
      ].join("  |  "),
      inline: false,
    },
  ]);

  if (!hasAnyFilter) {
    return embed;
  }

  const configRows = [];

  if (settings.badWords?.enabled) {
    configRows.push({
      name: "Bad Words",
      value:
        settings.badWords.words?.length > 0
          ? `${settings.badWords.words.slice(0, 3).join(", ")}${settings.badWords.words.length > 3 ? ` +${settings.badWords.words.length - 3}` : ""}`
          : "None",
      inline: true,
    });
    configRows.push({
      name: "Action",
      value:
        settings.badWords.action === "timeout"
          ? `Timeout ${settings.badWords.timeoutDuration}min`
          : "Delete",
      inline: true,
    });
  }

  if (settings.links?.enabled) {
    configRows.push({
      name: "Links",
      value:
        settings.links.action === "timeout"
          ? `Timeout ${settings.links.timeoutDuration}min`
          : "Delete",
      inline: true,
    });
    configRows.push({
      name: "Ignore",
      value: settings.links.ignoreAdmins ? "Admins" : "None",
      inline: true,
    });
  }

  if (settings.spam?.enabled) {
    configRows.push({
      name: "Spam",
      value: `${settings.spam.repeatedMessages || 3}/5s`,
      inline: true,
    });
    configRows.push({
      name: "Action",
      value:
        settings.spam.action === "timeout"
          ? `Timeout ${settings.spam.timeoutDuration}min`
          : "Delete",
      inline: true,
    });
  }

  if (settings.mentionSpam?.enabled) {
    configRows.push({
      name: "Mentions",
      value: `${settings.mentionSpam.mentionCount || 5}`,
      inline: true,
    });
    configRows.push({
      name: "Action",
      value:
        settings.mentionSpam.action === "timeout"
          ? `Timeout ${settings.mentionSpam.timeoutDuration}min`
          : "Delete",
      inline: true,
    });
  }

  if (settings.inviteLink?.enabled) {
    configRows.push({
      name: "Invites",
      value:
        settings.inviteLink.action === "timeout"
          ? `Timeout ${settings.inviteLink.timeoutDuration}min`
          : "Delete",
      inline: true,
    });
  }

  if (configRows.length > 0) {
    embed.addFields(configRows);
  }

  return embed;
}
