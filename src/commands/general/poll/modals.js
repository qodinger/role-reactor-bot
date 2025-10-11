import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { EMOJIS, THEME } from "../../../config/theme.js";

// Duration mapping for display (Discord native polls support 1 hour to 7 days max)
const DURATION_MAP = {
  1: `${EMOJIS.TIME.CLOCK} 1 hour`, // 60 minutes
  2: `${EMOJIS.TIME.ALARM} 2 hours`, // 120 minutes
  4: `${EMOJIS.TIME.ALARM} 4 hours`, // 240 minutes
  6: `${EMOJIS.TIME.ALARM} 6 hours`, // 360 minutes
  8: `${EMOJIS.TIME.ALARM} 8 hours`, // 480 minutes
  12: `${EMOJIS.TIME.ALARM} 12 hours`, // 720 minutes
  24: `${EMOJIS.TIME.CALENDAR} 1 day`, // 1440 minutes
  48: `${EMOJIS.TIME.CALENDAR} 2 days`, // 2880 minutes
  72: `${EMOJIS.TIME.CALENDAR} 3 days`, // 4320 minutes
  120: `${EMOJIS.TIME.CALENDAR} 5 days`, // 7200 minutes
  168: `${EMOJIS.TIME.CALENDAR} 7 days`, // 10080 minutes (Discord's max)
};

// Vote type mapping for display
const VOTE_TYPE_MAP = {
  false: `${EMOJIS.UI.BUTTON} Single Choice`,
  true: `${EMOJIS.UI.CHECKMARK} Multiple Choice`,
};

/**
 * Create poll creation modal
 * @returns {ModalBuilder} The poll creation modal
 */
export function createPollCreationModal() {
  const modal = new ModalBuilder()
    .setCustomId("poll_creation_modal")
    .setTitle("Create Poll");

  // Poll question input
  const questionInput = new TextInputBuilder()
    .setCustomId("poll_question")
    .setLabel("Poll Question")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("What would you like to ask?")
    .setRequired(true)
    .setMaxLength(256);

  // Poll options input
  const optionsInput = new TextInputBuilder()
    .setCustomId("poll_options")
    .setLabel("Poll Options (separated by | or new lines)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      "🍎 Apple|🍌 Banana|🍇 Grape\nOption 1|Option 2|Option 3 (Emojis supported)",
    )
    .setRequired(true)
    .setMaxLength(1000);

  // Add inputs to modal
  modal.addComponents(
    new ActionRowBuilder().addComponents(questionInput),
    new ActionRowBuilder().addComponents(optionsInput),
  );

  return modal;
}

/**
 * Create poll creation menu with selection dropdowns
 * @returns {Object} Object containing embed and components
 */
export function createPollCreationMenu(client) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.UI.PROGRESS} Create a Poll`)
    .setDescription(
      "Configure your poll settings using the dropdowns below, then click **Continue to Details** to fill in the poll information.",
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Poll System",
      iconURL: client.user.displayAvatarURL(),
    });

  // Duration selection (Discord native polls support 1 hour to 7 days max)
  const durationSelect = new StringSelectMenuBuilder()
    .setCustomId("poll_duration_select")
    .setPlaceholder(`${EMOJIS.TIME.CLOCK} Select poll duration`)
    .addOptions([
      {
        label: "1 hour",
        value: "1",
        emoji: EMOJIS.TIME.CLOCK,
        description: "Standard poll",
      },
      {
        label: "2 hours",
        value: "2",
        emoji: EMOJIS.TIME.ALARM,
        description: "Short poll",
      },
      {
        label: "4 hours",
        value: "4",
        emoji: EMOJIS.TIME.ALARM,
        description: "Extended poll",
      },
      {
        label: "6 hours",
        value: "6",
        emoji: EMOJIS.TIME.ALARM,
        description: "Half day poll",
      },
      {
        label: "8 hours",
        value: "8",
        emoji: EMOJIS.TIME.ALARM,
        description: "Work day poll",
      },
      {
        label: "12 hours",
        value: "12",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Half day poll",
      },
      {
        label: "1 day",
        value: "24",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Daily poll",
      },
      {
        label: "2 days",
        value: "48",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Weekend poll",
      },
      {
        label: "3 days",
        value: "72",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Extended poll",
      },
      {
        label: "5 days",
        value: "120",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Weekly poll",
      },
      {
        label: "7 days",
        value: "168",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Maximum duration",
      },
    ]);

  // Multiple choice selection
  const multipleChoiceSelect = new StringSelectMenuBuilder()
    .setCustomId("poll_multiple_choice_select")
    .setPlaceholder(`${EMOJIS.UI.PROGRESS} Select vote type`)
    .addOptions([
      {
        label: "Single Choice",
        value: "false",
        emoji: EMOJIS.UI.SINGLE_CHOICE,
        description: "Users can select only one option",
      },
      {
        label: "Multiple Choice",
        value: "true",
        emoji: EMOJIS.UI.MULTIPLE_CHOICE,
        description: "Users can select multiple options",
      },
    ]);

  // Action buttons
  const continueButton = new ButtonBuilder()
    .setCustomId("poll_continue_to_modal")
    .setLabel("Continue to Details")
    .setStyle(ButtonStyle.Primary)
    .setEmoji(EMOJIS.ACTIONS.FORWARD)
    .setDisabled(true);

  const cancelButton = new ButtonBuilder()
    .setCustomId("poll_cancel_creation")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.ACTIONS.DELETE);

  const components = [
    new ActionRowBuilder().addComponents(durationSelect),
    new ActionRowBuilder().addComponents(multipleChoiceSelect),
    new ActionRowBuilder().addComponents(continueButton, cancelButton),
  ];

  return { embed, components };
}

/**
 * Create poll creation menu with current selections
 * @param {Object} selections - Current selections
 * @param {import("discord.js").Interaction} interaction - The interaction
 * @returns {Object} Object containing embed and components
 */
export function createPollCreationMenuWithSelections(
  selections,
  _interaction,
  client,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.UI.PROGRESS} Create a Poll`)
    .setDescription(
      "Configure your poll settings using the dropdowns below, then click **Continue to Details** to fill in the poll information.",
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Poll System",
      iconURL: client.user.displayAvatarURL(),
    });

  // Add current selections to description
  if (selections.duration || selections.allowMultiple !== undefined) {
    const selectionText = [];
    if (selections.duration) {
      selectionText.push(
        `**Duration:** ${DURATION_MAP[selections.duration] || `${selections.duration}h`}`,
      );
    }
    if (selections.allowMultiple !== undefined) {
      selectionText.push(
        `**Vote Type:** ${VOTE_TYPE_MAP[selections.allowMultiple]}`,
      );
    }
    embed.addFields({
      name: "Current Selections",
      value: selectionText.join("\n"),
      inline: false,
    });
  }

  // Duration selection
  const durationSelect = new StringSelectMenuBuilder()
    .setCustomId("poll_duration_select")
    .setPlaceholder(
      selections.duration
        ? DURATION_MAP[selections.duration] || `${selections.duration}h`
        : `${EMOJIS.TIME.CLOCK} Select poll duration`,
    )
    .addOptions([
      {
        label: "1 hour",
        value: "1",
        emoji: EMOJIS.TIME.CLOCK,
        description: "Standard poll",
      },
      {
        label: "2 hours",
        value: "2",
        emoji: EMOJIS.TIME.ALARM,
        description: "Short poll",
      },
      {
        label: "4 hours",
        value: "4",
        emoji: EMOJIS.TIME.ALARM,
        description: "Extended poll",
      },
      {
        label: "6 hours",
        value: "6",
        emoji: EMOJIS.TIME.ALARM,
        description: "Half day poll",
      },
      {
        label: "8 hours",
        value: "8",
        emoji: EMOJIS.TIME.ALARM,
        description: "Work day poll",
      },
      {
        label: "12 hours",
        value: "12",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Half day poll",
      },
      {
        label: "1 day",
        value: "24",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Daily poll",
      },
      {
        label: "2 days",
        value: "48",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Weekend poll",
      },
      {
        label: "3 days",
        value: "72",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Extended poll",
      },
      {
        label: "5 days",
        value: "120",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Weekly poll",
      },
      {
        label: "7 days",
        value: "168",
        emoji: EMOJIS.TIME.CALENDAR,
        description: "Maximum duration",
      },
    ]);

  // Multiple choice selection
  const multipleChoiceSelect = new StringSelectMenuBuilder()
    .setCustomId("poll_multiple_choice_select")
    .setPlaceholder(
      selections.allowMultiple !== undefined
        ? VOTE_TYPE_MAP[selections.allowMultiple]
        : `${EMOJIS.UI.PROGRESS} Select vote type`,
    )
    .addOptions([
      {
        label: "Single Choice",
        value: "false",
        emoji: EMOJIS.UI.SINGLE_CHOICE,
        description: "Users can select only one option",
      },
      {
        label: "Multiple Choice",
        value: "true",
        emoji: EMOJIS.UI.MULTIPLE_CHOICE,
        description: "Users can select multiple options",
      },
    ]);

  // Action buttons
  const continueButton = new ButtonBuilder()
    .setCustomId("poll_continue_to_modal")
    .setLabel("Continue to Details")
    .setStyle(ButtonStyle.Primary)
    .setEmoji(EMOJIS.ACTIONS.FORWARD)
    .setDisabled(
      !selections.duration || selections.allowMultiple === undefined,
    );

  const cancelButton = new ButtonBuilder()
    .setCustomId("poll_cancel_creation")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.ACTIONS.DELETE);

  const components = [
    new ActionRowBuilder().addComponents(durationSelect),
    new ActionRowBuilder().addComponents(multipleChoiceSelect),
    new ActionRowBuilder().addComponents(continueButton, cancelButton),
  ];

  return { embed, components };
}
