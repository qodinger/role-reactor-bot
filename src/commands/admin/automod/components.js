import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function createAutomodSettingsComponents(settings) {
  const createToggle = (customId, label, enabled) =>
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Primary);

  return [
    new ActionRowBuilder().addComponents(
      createToggle(
        "automod_badwords_toggle",
        "Bad Words",
        settings.badWords?.enabled,
      ),
      createToggle("automod_links_toggle", "Links", settings.links?.enabled),
      createToggle("automod_spam_toggle", "Spam", settings.spam?.enabled),
      createToggle(
        "automod_mention_spam_toggle",
        "Mentions",
        settings.mentionSpam?.enabled,
      ),
      createToggle(
        "automod_invite_toggle",
        "Invites",
        settings.inviteLink?.enabled,
      ),
    ),
  ];
}
