import { EmbedBuilder } from "discord.js";
import { getTicketManager } from "../../../features/ticketing/TicketManager.js";
import { getLogger } from "../../../utils/logger.js";
import {
  checkStaffRole,
  getStaffRoleId,
} from "../../../features/ticketing/helpers.js";
import {
  createTicketClaimedEmbed,
  createTicketActionButtons,
  createErrorEmbed,
  createSuccessEmbed,
} from "../../../features/ticketing/embeds.js";

const logger = getLogger();

/**
 * Handle ticket claim button (from inside thread or from staff alert)
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} [providedTicketId] - Optional ticket ID for external claiming
 */
export async function handleTicketClaim(interaction, providedTicketId) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const staffId = interaction.user.id;
    const channelId = interaction.channelId;
    const guild = interaction.guild;

    // Check staff role
    const isStaff = await checkStaffRole(interaction);
    if (!isStaff) {
      const staffRoleId = await getStaffRoleId(interaction.guildId);
      const roleText = staffRoleId
        ? `the <@&${staffRoleId}> role`
        : "a staff role";
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `You need ${roleText} to claim tickets.`,
            "Permission Denied",
            interaction.client,
          ),
        ],
      });
    }

    // Initialize manager
    const ticketManager = getTicketManager();
    await ticketManager.initialize();

    // Get ticket (using provided ID or current channel)
    let ticket;
    if (providedTicketId) {
      ticket = await ticketManager.getTicket(providedTicketId);
    } else {
      ticket = await ticketManager.getTicketByChannel(channelId);
    }

    if (!ticket) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "This ticket could not be found.",
            "Invalid Action",
            interaction.client,
          ),
        ],
      });
    }

    // Check if already claimed
    if (ticket.claimedBy) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `This ticket is already claimed by <@${ticket.claimedBy}>.`,
            "Ticket Already Claimed",
            interaction.client,
          ),
        ],
      });
    }

    // Claim ticket in database
    const success = await ticketManager.claimTicket(ticket.ticketId, staffId);
    if (!success) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to claim ticket.",
            "Claim Failed",
            interaction.client,
          ),
        ],
      });
    }

    // Find the actual ticket channel
    const ticketChannel = await guild.channels
      .fetch(ticket.channelId)
      .catch(() => null);
    if (!ticketChannel || !ticketChannel.isTextBased()) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "The ticket channel no longer exists.",
            "Channel Not Found",
            interaction.client,
          ),
        ],
      });
    }

    // 1. Add staff member to the thread/channel explicitly
    try {
      if (ticketChannel.isThread()) {
        await ticketChannel.members.add(staffId);
      } else {
        // @ts-ignore
        await ticketChannel.permissionOverwrites.edit(interaction.user, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
        });
      }
    } catch (err) {
      logger.error("Failed to update claim permissions/membership:", err);
    }

    // 2. Announce claim in ticket channel
    const claimedEmbed = createTicketClaimedEmbed(
      `<@${interaction.user.id}>`,
      interaction.client,
    );
    await ticketChannel.send({ embeds: [claimedEmbed] });

    // 3. Update buttons in the ticket channel (find the first message from the bot)
    try {
      const messages = await ticketChannel.messages.fetch({ limit: 10 });
      const welcomeMsg = messages.find(
        m => m.author.id === interaction.client.user.id && m.embeds.length > 0,
      );
      if (welcomeMsg) {
        const newButtons = createTicketActionButtons({
          canClaim: false,
          canClose: true,
          canAddUser: true,
          isClaimed: true,
        });
        // @ts-ignore
        await welcomeMsg.edit({ components: newButtons });
      }
    } catch (err) {
      logger.debug(`Failed to update welcome buttons: ${err.message}`);
    }

    // 4. Update the staff alert message if this was an external claim
    if (providedTicketId && interaction.channelId !== ticket.channelId) {
      try {
        const alertEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x3ba55c) // Green for claimed
          .addFields({
            name: "Status",
            value: `✅ Claimed by <@${staffId}>`,
            inline: false,
          });

        await interaction.message.edit({
          embeds: [alertEmbed],
          components: [], // Remove the claim button
        });
      } catch (err) {
        logger.debug(`Failed to update staff alert message: ${err.message}`);
      }
    }

    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `You have claimed this ticket: ${ticketChannel}\n` +
            `Ticket ID: \`#${ticket.ticketId.split("-").pop()}\``,
          "Ticket Claimed",
          interaction.client,
        ),
      ],
    });
  } catch (error) {
    logger.error("Ticket claim error:", error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to claim ticket: ${error.message}`,
          "Claim Failed",
          interaction.client,
        ),
      ],
    });
  }
}
