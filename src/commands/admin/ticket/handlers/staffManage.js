import { PermissionFlagsBits, MessageFlags } from "discord.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from "../../../../features/ticketing/embeds.js";
import {
  checkStaffRole,
  checkStaffRoleForMember,
  getStaffRoleId,
} from "../utils.js";
import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

// ─────────────────────────────────────────────────────────────────────────────
// /ticket transfer
// ─────────────────────────────────────────────────────────────────────────────

export async function handleTransfer(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const staffToTransfer = interaction.options.getUser("staff");
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
          `You need ${roleText} or administrator permissions to transfer tickets.`,
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
          "Cannot transfer a closed ticket.",
          "Ticket Closed",
          interaction.client,
        ),
      ],
    });
  }

  const targetMember = await interaction.guild.members.fetch(
    staffToTransfer.id,
  );
  const isTargetStaff = await checkStaffRoleForMember(
    targetMember,
    interaction.guild.id,
  );

  if (!isTargetStaff) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `${staffToTransfer} is not a staff member.`,
          "Not Staff Member",
          interaction.client,
        ),
      ],
    });
  }

  // Prevent transferring to the same person already handling it
  if (ticket.claimedBy === staffToTransfer.id) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `${staffToTransfer} is already handling this ticket.`,
          "Redundant Transfer",
          interaction.client,
        ),
      ],
    });
  }

  const success = await ticketManager.transferTicket(
    ticket.ticketId,
    staffToTransfer.id,
  );

  if (!success) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Failed to transfer ticket.",
          "Transfer Failed",
          interaction.client,
        ),
      ],
    });
  }

  // Sync Discord permissions for the new staff member
  try {
    if (interaction.channel.isThread()) {
      await interaction.channel.members.add(staffToTransfer.id);
    } else {
      await interaction.channel.permissionOverwrites.edit(staffToTransfer, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
    }
  } catch (err) {
    logger.debug(
      `Failed to update transfer permissions/membership: ${err.message}`,
    );
  }

  const wasClaimed = !!ticket.claimedBy;
  const actionText = wasClaimed ? "transferred to" : "assigned to";
  const titleText = wasClaimed ? "Ticket Transferred" : "Ticket Assigned";

  // Notify everyone in the ticket with a clear mention
  await interaction.channel.send({
    content: `${staffToTransfer}`,
    embeds: [
      createSuccessEmbed(
        `This ticket has been ${actionText} ${staffToTransfer} by ${interaction.user}.`,
        titleText,
        interaction.client,
      ),
    ],
  });

  // Also send a DM to the assigned staff member with a direct link
  // Don't send DM if transferring to self
  if (staffToTransfer.id !== interaction.user.id) {
    try {
      const guildName = interaction.guild.name;
      const channelLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}`;

      await staffToTransfer.send({
        embeds: [
          createInfoEmbed(
            `📫 **New Ticket Assignment**`,
            `You have been ${actionText} a ticket in **${guildName}**.\n\n` +
              `**Ticket ID:** \`#${ticket.ticketId.split("-").pop()}\`\n` +
              `**Assigned By:** ${interaction.user}\n\n` +
              `**[Go to Ticket Channel](${channelLink})**`,
            interaction.client,
          ),
        ],
      });
    } catch (error) {
      // If DMs are closed, we just log it and move on
      logger.debug(
        `Could not send assignment DM to ${staffToTransfer.tag}: ${error.message}`,
      );
    }
  }

  return interaction.editReply({
    content: `Successfully ${wasClaimed ? "transferred" : "assigned"} to ${staffToTransfer}.`,
    embeds: [
      createSuccessEmbed(
        `${wasClaimed ? "Transferred" : "Assigned"} to ${staffToTransfer}.`,
        titleText,
        interaction.client,
      ),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /ticket rename
// ─────────────────────────────────────────────────────────────────────────────

export async function handleRename(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const newName = interaction.options.getString("name");
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
          `You need ${roleText} or administrator permissions to rename tickets.`,
          "Permission Denied",
          interaction.client,
        ),
      ],
    });
  }

  // Check bot permissions
  const botMember = await interaction.guild.members.me;
  const isThread = interaction.channel.isThread();
  const requiredPerms = isThread
    ? PermissionFlagsBits.ManageThreads
    : PermissionFlagsBits.ManageChannels;

  if (!botMember.permissions.has(requiredPerms)) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `I don't have the **${isThread ? "Manage Threads" : "Manage Channels"}** permission in this server.\n\n` +
            `I need this permission to rename the ticket ${isThread ? "thread" : "channel"}.`,
          "Missing Permissions",
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

  try {
    await interaction.channel.setName(newName);
    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `The channel has been renamed to \`${newName}\`.`,
          "Ticket Renamed",
          interaction.client,
        ),
      ],
    });
  } catch (error) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to rename channel: ${error.message}`,
          "Rename Failed",
          interaction.client,
        ),
      ],
    });
  }
}
