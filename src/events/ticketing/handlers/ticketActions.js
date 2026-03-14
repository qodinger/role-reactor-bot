import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import {
  checkStaffRole,
  getStaffRoleId,
} from "../../../features/ticketing/helpers.js";
import { createErrorEmbed } from "../../../features/ticketing/embeds.js";

const logger = getLogger();

/**
 * Handle ticket add user button (shows modal)
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleTicketAddUser(interaction) {
  try {
    // Check staff role
    const isStaff = await checkStaffRole(interaction);
    if (!isStaff) {
      const staffRoleId = await getStaffRoleId(interaction.guildId);
      const roleText = staffRoleId
        ? `the <@&${staffRoleId}> role`
        : "a staff role";
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            `You need ${roleText} to add users.`,
            "Permission Denied",
            interaction.client,
          ),
        ],
        ephemeral: true,
      });
    }

    // Show modal
    const modal = new ModalBuilder()
      .setCustomId("ticket_add_user_modal")
      .setTitle("Add User to Ticket");

    const userIdInput = new TextInputBuilder()
      .setCustomId("user_id")
      .setLabel("User ID or Mention")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter user ID or @mention")
      .setRequired(true)
      .setMinLength(17)
      .setMaxLength(100);

    const actionRow = new ActionRowBuilder().addComponents(userIdInput);
    // @ts-ignore
    modal.addComponents(actionRow);

    return interaction.showModal(modal);
  } catch (error) {
    logger.error("Ticket add user error:", error);
    return interaction.reply({
      embeds: [
        createErrorEmbed(
          `Failed to add user: ${error.message}`,
          "Add User Failed",
          interaction.client,
        ),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle ticket transfer button (shows modal)
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleTicketTransfer(interaction) {
  try {
    // Check staff role
    const isStaff = await checkStaffRole(interaction);
    if (!isStaff) {
      const staffRoleId = await getStaffRoleId(interaction.guildId);
      const roleText = staffRoleId
        ? `the <@&${staffRoleId}> role`
        : "a staff role";
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            `You need ${roleText} to transfer tickets.`,
            "Permission Denied",
            interaction.client,
          ),
        ],
        ephemeral: true,
      });
    }

    // Show modal
    const modal = new ModalBuilder()
      .setCustomId("ticket_transfer_modal")
      .setTitle("Transfer Ticket");

    const staffIdInput = new TextInputBuilder()
      .setCustomId("staff_id")
      .setLabel("Staff User ID or Mention")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter staff user ID or @mention")
      .setRequired(true)
      .setMinLength(17)
      .setMaxLength(100);

    const actionRow = new ActionRowBuilder().addComponents(staffIdInput);
    // @ts-ignore
    modal.addComponents(actionRow);

    return interaction.showModal(modal);
  } catch (error) {
    logger.error("Ticket transfer error:", error);
    return interaction.reply({
      embeds: [
        createErrorEmbed(
          `Failed to transfer ticket: ${error.message}`,
          "Transfer Failed",
          interaction.client,
        ),
      ],
      ephemeral: true,
    });
  }
}
