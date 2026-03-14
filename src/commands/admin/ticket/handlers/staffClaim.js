import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import {
  checkStaffRole,
  getStaffRoleId,
} from "../utils.js";
import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

// ─────────────────────────────────────────────────────────────────────────────
// /ticket claim
// ─────────────────────────────────────────────────────────────────────────────

export async function handleClaim(interaction) {
  await interaction.deferReply({ ephemeral: true });

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

  const ticketManager = getTicketManager();
  await ticketManager.initialize();

  const ticket = await ticketManager.getTicketByChannel(interaction.channelId);

  if (!ticket) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "This is not a ticket channel.",
          "Invalid Context",
          interaction.client,
        ),
      ],
    });
  }

  if (ticket.claimedBy) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Already claimed by <@${ticket.claimedBy}>.`,
          "Already Claimed",
          interaction.client,
        ),
      ],
    });
  }

  const success = await ticketManager.claimTicket(
    ticket.ticketId,
    interaction.user.id,
  );

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

  // Sync Discord permissions or thread membership
  try {
    if (interaction.channel.isThread()) {
      await interaction.channel.members.add(interaction.user.id);
    } else {
      await interaction.channel.permissionOverwrites.edit(interaction.user, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
    }
  } catch (err) {
    logger.debug(`Failed to update claim permissions/membership: ${err.message}`);
  }

  // Notify everyone in the ticket
  await interaction.channel.send({
    embeds: [
      createSuccessEmbed(
        `${interaction.user} is now handling this ticket.`,
        "Ticket Claimed",
        interaction.client,
      ),
    ],
  });

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `You are now handling this ticket.`,
        "Ticket Claimed",
        interaction.client,
      ),
    ],
  });
}
