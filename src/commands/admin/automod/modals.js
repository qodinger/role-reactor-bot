import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { THEME } from "../../../config/theme.js";

/**
 * Create bad words configuration modal
 * @param {Object} currentSettings - Current bad words settings
 * @returns {ModalBuilder}
 */
export function createBadwordsModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_badwords_modal")
    .setTitle("Configure Bad Words");

  const wordsInput = new TextInputBuilder()
    .setCustomId("badwords_words")
    .setLabel("Words (comma-separated)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("badword1,badword2,badword3")
    .setValue(currentSettings.words?.join(", ") || "")
    .setRequired(false);

  const timeoutInput = new TextInputBuilder()
    .setCustomId("badwords_timeout")
    .setLabel("Timeout minutes (if using timeout action)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("5")
    .setValue(String(currentSettings.timeoutDuration || 5))
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(wordsInput),
    new ActionRowBuilder().addComponents(timeoutInput),
  );

  return modal;
}

/**
 * Create links configuration modal
 * @param {Object} currentSettings - Current links settings
 * @returns {ModalBuilder}
 */
export function createLinksModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_links_modal")
    .setTitle("Configure Links");

  const domainsInput = new TextInputBuilder()
    .setCustomId("links_domains")
    .setLabel("Allowed Domains (comma-separated)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("discord.com,youtube.com")
    .setValue(currentSettings.allowedDomains?.join(", ") || "")
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(domainsInput));

  return modal;
}

/**
 * Create spam configuration modal
 * @param {Object} currentSettings - Current spam settings
 * @returns {ModalBuilder}
 */
export function createSpamModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_spam_modal")
    .setTitle("Configure Spam");

  const repeatedInput = new TextInputBuilder()
    .setCustomId("spam_repeated")
    .setLabel("Repeated Messages")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("3")
    .setValue(String(currentSettings.repeatedMessages || 3))
    .setRequired(false);

  const timeoutInput = new TextInputBuilder()
    .setCustomId("spam_timeout")
    .setLabel("Timeout minutes (if using timeout action)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("5")
    .setValue(String(currentSettings.timeoutDuration || 5))
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(repeatedInput),
    new ActionRowBuilder().addComponents(timeoutInput),
  );

  return modal;
}

/**
 * Create mention spam configuration modal
 * @param {Object} currentSettings - Current mention spam settings
 * @returns {ModalBuilder}
 */
export function createMentionsModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_mentions_modal")
    .setTitle("Configure Mention Spam");

  const countInput = new TextInputBuilder()
    .setCustomId("mentions_count")
    .setLabel("Mention Count")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("5")
    .setValue(String(currentSettings.mentionCount || 5))
    .setRequired(false);

  const timeoutInput = new TextInputBuilder()
    .setCustomId("mentions_timeout")
    .setLabel("Timeout minutes (if using timeout action)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("5")
    .setValue(String(currentSettings.timeoutDuration || 5))
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(countInput),
    new ActionRowBuilder().addComponents(timeoutInput),
  );

  return modal;
}

/**
 * Create caps lock configuration modal
 * @param {Object} currentSettings - Current caps lock settings
 * @returns {ModalBuilder}
 */
export function createCapslockModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_capslock_modal")
    .setTitle("Configure Caps Lock");

  const thresholdInput = new TextInputBuilder()
    .setCustomId("capslock_threshold")
    .setLabel("Threshold (50-100%)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("70")
    .setValue(String(currentSettings.threshold || 70))
    .setRequired(false);

  const minLengthInput = new TextInputBuilder()
    .setCustomId("capslock_minlength")
    .setLabel("Min Length")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("10")
    .setValue(String(currentSettings.minLength || 10))
    .setRequired(false);

  const timeoutInput = new TextInputBuilder()
    .setCustomId("capslock_timeout")
    .setLabel("Timeout minutes (if action = timeout)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("5")
    .setValue(String(currentSettings.timeoutDuration || 5))
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(thresholdInput),
    new ActionRowBuilder().addComponents(minLengthInput),
    new ActionRowBuilder().addComponents(timeoutInput),
  );

  return modal;
}

/**
 * Create domains configuration modal
 * @param {Object} currentSettings - Current links settings
 * @returns {ModalBuilder}
 */
export function createDomainsModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_domains_modal")
    .setTitle("Configure Allowed Domains");

  const domainsInput = new TextInputBuilder()
    .setCustomId("domains_list")
    .setLabel("Domains (comma-separated)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("discord.com, youtube.com")
    .setValue(currentSettings.allowedDomains?.join(", ") || "")
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(domainsInput));

  return modal;
}

/**
 * Create log channel configuration modal
 * @param {Object} currentSettings - Current automod settings
 * @returns {ModalBuilder}
 */
export function createLogChannelModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_logchannel_modal")
    .setTitle("Configure Log Channel");

  const channelInput = new TextInputBuilder()
    .setCustomId("log_channel_id")
    .setLabel("Channel ID")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("1234567890")
    .setValue(currentSettings.logChannel || "")
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(channelInput));

  return modal;
}

/**
 * Create ignored roles configuration modal
 * @param {Object} currentSettings - Current automod settings
 * @returns {ModalBuilder}
 */
export function createIgnoredRolesModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_ignoredroles_modal")
    .setTitle("Configure Ignored Roles");

  const rolesInput = new TextInputBuilder()
    .setCustomId("ignored_roles")
    .setLabel("Role IDs (comma-separated)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("1234567890, 9876543210")
    .setValue(currentSettings.ignoredRoles?.join(", ") || "")
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(rolesInput));

  return modal;
}

/**
 * Create ignored channels configuration modal
 * @param {Object} currentSettings - Current automod settings
 * @returns {ModalBuilder}
 */
export function createIgnoredChannelsModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("automod_ignoredchannels_modal")
    .setTitle("Configure Ignored Channels");

  const channelsInput = new TextInputBuilder()
    .setCustomId("ignored_channels")
    .setLabel("Channel IDs (comma-separated)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("1234567890, 9876543210")
    .setValue(currentSettings.ignoredChannels?.join(", ") || "")
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(channelsInput));

  return modal;
}
