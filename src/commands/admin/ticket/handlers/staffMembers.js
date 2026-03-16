import { PermissionFlagsBits } from "discord.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import { checkStaffRole, getStaffRoleId } from "../utils.js";
import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

// ─────────────────────────────────────────────────────────────────────────────
// /ticket add
// ─────────────────────────────────────────────────────────────────────────────

export async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userToAdd = interaction.options.getUser("member");
  const isStaff = await checkStaffRole(interaction);
  const isAdmin = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageGuild,
  );

  if (!isStaff && !isAdmin) {
    const staffRoleId = await getStaffRoleId(interaction.guildId);
    const roleText = staffRoleId
      ? `the <@&${staffRoleId}> role`
      : "a staff role";
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `You need ${roleText} or administrator permissions to add members.`,
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

  if (ticket.status === "closed") {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Cannot add members to a closed ticket.",
          "Ticket Closed",
          interaction.client,
        ),
      ],
    });
  }

  if (ticket.participants?.includes(userToAdd.id)) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `${userToAdd} is already in this ticket.`,
          "Already In Ticket",
          interaction.client,
        ),
      ],
    });
  }

  const success = await ticketManager.addUserToTicket(
    ticket.ticketId,
    userToAdd.id,
  );

  if (!success) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Failed to add member.",
          "Add Failed",
          interaction.client,
        ),
      ],
    });
  }

  try {
    if (interaction.channel.isThread()) {
      await interaction.channel.members.add(userToAdd.id);
    } else {
      await interaction.channel.permissionOverwrites.edit(userToAdd, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    }
  } catch (error) {
    logger.error("Failed to add user permissions/membership:", error);
  }

  // Notify everyone in the ticket
  await interaction.channel.send({
    embeds: [
      createSuccessEmbed(
        `${userToAdd} has been added to this ticket by ${interaction.user}.`,
        "Member Added",
        interaction.client,
      ),
    ],
  });

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `${userToAdd} has been added to this ticket.`,
        "Member Added",
        interaction.client,
      ),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /ticket remove
// ─────────────────────────────────────────────────────────────────────────────

export async function handleRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userToRemove = interaction.options.getUser("member");
  const isStaff = await checkStaffRole(interaction);
  const isAdmin = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageGuild,
  );

  if (!isStaff && !isAdmin) {
    const staffRoleId = await getStaffRoleId(interaction.guildId);
    const roleText = staffRoleId
      ? `the <@&${staffRoleId}> role`
      : "a staff role";
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `You need ${roleText} or administrator permissions to remove members.`,
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

  if (ticket.status === "closed") {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Cannot remove members from a closed ticket.",
          "Ticket Closed",
          interaction.client,
        ),
      ],
    });
  }

  if (!ticket.participants?.includes(userToRemove.id)) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `${userToRemove} is not in this ticket.`,
          "Not In Ticket",
          interaction.client,
        ),
      ],
    });
  }

  const success = await ticketManager.removeUserFromTicket(
    ticket.ticketId,
    userToRemove.id,
  );

  if (!success) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Failed to remove member.",
          "Remove Failed",
          interaction.client,
        ),
      ],
    });
  }

  try {
    if (interaction.channel.isThread()) {
      await interaction.channel.members.remove(userToRemove.id);
    } else {
      await interaction.channel.permissionOverwrites.delete(userToRemove);
    }
  } catch (error) {
    logger.error("Failed to remove user permissions/membership:", error);
  }

  // Notify everyone in the ticket
  await interaction.channel.send({
    embeds: [
      createSuccessEmbed(
        `${userToRemove} has been removed from this ticket by ${interaction.user}.`,
        "Member Removed",
        interaction.client,
      ),
    ],
  });

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `${userToRemove} has been removed from this ticket.`,
        "User Removed",
        interaction.client,
      ),
    ],
  });
}
