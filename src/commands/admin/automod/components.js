import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { BUTTON_STYLES, EMOJIS } from "../../../config/theme.js";

export function createAutomodSettingsComponents(settings) {
  const createToggle = (customId, label, emoji, enabled) =>
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setEmoji(emoji)
      .setStyle(enabled ? BUTTON_STYLES.SUCCESS : BUTTON_STYLES.SECONDARY);

  return [
    new ActionRowBuilder().addComponents(
      createToggle(
        "automod_badwords_toggle",
        "Bad Words",
        "🚫",
        settings.badWords?.enabled,
      ),
      createToggle(
        "automod_links_toggle",
        "Links",
        "🔗",
        settings.links?.enabled,
      ),
      createToggle("automod_spam_toggle", "Spam", "🔄", settings.spam?.enabled),
    ),
    new ActionRowBuilder().addComponents(
      createToggle(
        "automod_mention_spam_toggle",
        "Mentions",
        "📣",
        settings.mentionSpam?.enabled,
      ),
      createToggle(
        "automod_invite_toggle",
        "Invites",
        "📩",
        settings.inviteLink?.enabled,
      ),
      createToggle(
        "automod_capslock_toggle",
        "Caps",
        "🔠",
        settings.capsLock?.enabled,
      ),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("automod_quick_setup")
        .setLabel("Quick Setup")
        .setEmoji(EMOJIS.ACTIONS.QUICK)
        .setStyle(BUTTON_STYLES.SUCCESS),
      new ButtonBuilder()
        .setCustomId("automod_configure")
        .setLabel("Configure")
        .setEmoji(EMOJIS.ACTIONS.SETTINGS)
        .setStyle(BUTTON_STYLES.PRIMARY),
      new ButtonBuilder()
        .setCustomId("automod_enable_all")
        .setLabel("Enable All")
        .setEmoji(EMOJIS.STATUS.SUCCESS)
        .setStyle(BUTTON_STYLES.SECONDARY),
      new ButtonBuilder()
        .setCustomId("automod_disable_all")
        .setLabel("Disable All")
        .setEmoji(EMOJIS.STATUS.OFFLINE)
        .setStyle(BUTTON_STYLES.DANGER),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("automod_configure_logchannel")
        .setLabel("Log Channel")
        .setEmoji(EMOJIS.UI.CHANNELS)
        .setStyle(BUTTON_STYLES.SECONDARY),
      new ButtonBuilder()
        .setCustomId("automod_configure_ignoredroles")
        .setLabel("Ignored Roles")
        .setEmoji(EMOJIS.FEATURES.ROLES)
        .setStyle(BUTTON_STYLES.SECONDARY),
      new ButtonBuilder()
        .setCustomId("automod_configure_ignoredchannels")
        .setLabel("Ignored Channels")
        .setEmoji(EMOJIS.UI.CHANNELS)
        .setStyle(BUTTON_STYLES.SECONDARY),
    ),
  ];
}
