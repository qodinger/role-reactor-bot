import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function createAutomodSettingsComponents(settings) {
  const hasAnyFilter =
    settings.badWords?.enabled ||
    settings.links?.enabled ||
    settings.spam?.enabled ||
    settings.mentionSpam?.enabled ||
    settings.inviteLink?.enabled;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("automod_toggle_all")
      .setLabel(hasAnyFilter ? "Disable All" : "Enable All")
      .setStyle(hasAnyFilter ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("automod_badwords_toggle")
      .setLabel(settings.badWords?.enabled ? "Bad Words: On" : "Bad Words: Off")
      .setStyle(
        settings.badWords?.enabled
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
      ),
    new ButtonBuilder()
      .setCustomId("automod_links_toggle")
      .setLabel(settings.links?.enabled ? "Links: On" : "Links: Off")
      .setStyle(
        settings.links?.enabled ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("automod_spam_toggle")
      .setLabel(settings.spam?.enabled ? "Spam: On" : "Spam: Off")
      .setStyle(
        settings.spam?.enabled ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
    new ButtonBuilder()
      .setCustomId("automod_mention_spam_toggle")
      .setLabel(
        settings.mentionSpam?.enabled ? "Mentions: On" : "Mentions: Off",
      )
      .setStyle(
        settings.mentionSpam?.enabled
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
      ),
    new ButtonBuilder()
      .setCustomId("automod_invite_toggle")
      .setLabel(settings.inviteLink?.enabled ? "Invites: On" : "Invites: Off")
      .setStyle(
        settings.inviteLink?.enabled
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
      ),
  );

  return [row1, row2];
}
