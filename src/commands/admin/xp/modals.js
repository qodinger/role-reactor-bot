import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

/**
 * Create basic XP configuration modal (5 fields max)
 * @param {Object} xpSettings - Current XP settings
 * @returns {ModalBuilder}
 */
export function createXpConfigModal(xpSettings) {
  const modal = new ModalBuilder()
    .setCustomId("xp_config_modal")
    .setTitle("Basic XP Configuration");

  // Message XP configuration
  const messageMinInput = new TextInputBuilder()
    .setCustomId("message_xp_min")
    .setLabel("Minimum Message XP")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter minimum XP (1-100)")
    .setValue(xpSettings.messageXPAmount.min.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  const messageMaxInput = new TextInputBuilder()
    .setCustomId("message_xp_max")
    .setLabel("Maximum Message XP")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter maximum XP (1-100)")
    .setValue(xpSettings.messageXPAmount.max.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  // Command XP configuration
  const commandXpInput = new TextInputBuilder()
    .setCustomId("command_xp_amount")
    .setLabel("Command XP Amount")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter base XP for commands (1-100)")
    .setValue(xpSettings.commandXPAmount.base.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  // Role XP configuration
  const roleXpInput = new TextInputBuilder()
    .setCustomId("role_xp_amount")
    .setLabel("Role XP Amount")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter XP for role assignments (1-1000)")
    .setValue(xpSettings.roleXPAmount.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(4);

  // Voice XP configuration
  const voiceXpInput = new TextInputBuilder()
    .setCustomId("voice_xp_amount")
    .setLabel("Voice XP Amount")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter XP for voice chat (1-50)")
    .setValue("5")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2);

  // Cooldown configurations removed due to Discord 5 ActionRow limit

  // Add all inputs to the modal (Discord limit: 5 ActionRows max)
  modal.addComponents(
    new ActionRowBuilder().addComponents(messageMinInput),
    new ActionRowBuilder().addComponents(messageMaxInput),
    new ActionRowBuilder().addComponents(commandXpInput),
    new ActionRowBuilder().addComponents(roleXpInput),
    new ActionRowBuilder().addComponents(voiceXpInput),
  );

  return modal;
}

/**
 * Create advanced XP configuration modal (cooldowns and advanced settings)
 * @param {Object} xpSettings - Current XP settings
 * @returns {ModalBuilder}
 */
export function createXpAdvancedConfigModal(xpSettings) {
  const modal = new ModalBuilder()
    .setCustomId("xp_advanced_config_modal")
    .setTitle("Advanced XP Configuration");

  // Message cooldown
  const messageCooldownInput = new TextInputBuilder()
    .setCustomId("message_cooldown")
    .setLabel("Message Cooldown (seconds)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter cooldown in seconds (10-300)")
    .setValue(xpSettings.messageCooldown.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  // Command cooldown
  const commandCooldownInput = new TextInputBuilder()
    .setCustomId("command_cooldown")
    .setLabel("Command Cooldown (seconds)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter cooldown in seconds (5-120)")
    .setValue(xpSettings.commandCooldown.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  // Voice XP interval (how often to award voice XP)
  const voiceXpIntervalInput = new TextInputBuilder()
    .setCustomId("voice_xp_interval")
    .setLabel("Voice XP Interval (minutes)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter interval in minutes (1-60)")
    .setValue("5")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2);

  // Add all inputs to the modal (removed level-up fields as they're handled by Level-Up Messages button)
  modal.addComponents(
    new ActionRowBuilder().addComponents(messageCooldownInput),
    new ActionRowBuilder().addComponents(commandCooldownInput),
    new ActionRowBuilder().addComponents(voiceXpIntervalInput),
  );

  return modal;
}

/**
 * Create level-up message configuration modal
 * @param {Object} xpSettings - Current XP settings
 * @returns {ModalBuilder}
 */
export function createLevelUpConfigModal(xpSettings) {
  const modal = new ModalBuilder()
    .setCustomId("xp_levelup_config_modal")
    .setTitle("Configure Level-Up Messages");

  // Level-up message toggle
  const enabledInput = new TextInputBuilder()
    .setCustomId("levelup_enabled")
    .setLabel("Enable Level-Up Messages (true/false)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter true or false")
    .setValue(xpSettings.levelUpMessages.toString())
    .setRequired(true)
    .setMinLength(4)
    .setMaxLength(5);

  // Channel ID input
  const channelInput = new TextInputBuilder()
    .setCustomId("levelup_channel")
    .setLabel("Level-Up Channel ID (optional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter channel ID or leave empty for system channel")
    .setValue(xpSettings.levelUpChannel || "")
    .setRequired(false)
    .setMaxLength(20);

  // Add inputs to the modal
  modal.addComponents(
    new ActionRowBuilder().addComponents(enabledInput),
    new ActionRowBuilder().addComponents(channelInput),
  );

  return modal;
}
