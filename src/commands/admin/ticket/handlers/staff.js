import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import {
  checkStaffRole,
  checkStaffRoleForMember,
  getStaffRoleId,
  formatDuration,
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

// ─────────────────────────────────────────────────────────────────────────────
// /ticket close
// ─────────────────────────────────────────────────────────────────────────────

export async function handleClose(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.options.getString("reason");
  const ticketManager = getTicketManager();
  const ticketTranscript = getTicketTranscript();
  await ticketManager.initialize();
  await ticketTranscript.initialize();

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

  const isOwner = ticket.userId === interaction.user.id;
  const isStaff = await checkStaffRole(interaction);

  if (!isOwner && !isStaff) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "You can only close your own tickets.",
          "Permission Denied",
          interaction.client,
        ),
      ],
    });
  }

  if (ticket.status === "closed") {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "This ticket is already closed.",
          "Ticket Already Closed",
          interaction.client,
        ),
      ],
    });
  }

  // Check bot permissions
  const botMember = await interaction.guild.members.me;
  if (!botMember.permissions.has("ManageChannels")) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "I don't have the **Manage Channels** permission in this server.\n\n" +
            "I need this permission to delete the ticket channel when closing.",
          "Missing Permissions",
          interaction.client,
        ),
      ],
    });
  }

  await ticketTranscript.initialize();
  await ticketTranscript.generateFromChannel({
    ticketId: ticket.ticketId,
    guildId: ticket.guildId,
    channel: interaction.channel,
    ticket,
    format: "html",
  });

  const success = await ticketManager.closeTicket(
    ticket.ticketId,
    interaction.user.id,
    reason,
  );

  if (!success) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Failed to close ticket.",
          "Close Failed",
          interaction.client,
        ),
      ],
    });
  }

  const duration = formatDuration(new Date(ticket.openedAt), new Date());

  const closeEmbed = createSuccessEmbed(
    `Closed by ${interaction.user}.\n**Duration:** ${duration}`,
    "Ticket Closed",
    interaction.client,
  );

  if (reason) {
    closeEmbed.addFields({ name: "Reason", value: reason, inline: false });
  }

  // Send close notification publicly so everyone sees it
  await interaction.channel.send({ embeds: [closeEmbed] });
  await interaction.editReply({
    embeds: [
      createSuccessEmbed(
        "This ticket has been closed. Channel will be deleted shortly.",
        "Ticket Closed",
        interaction.client,
      ),
    ],
  });

  setTimeout(async () => {
    try {
      await interaction.channel.delete("Ticket closed");
    } catch (error) {
      console.error("Failed to delete ticket channel:", error);
    }
  }, 5000);
}

// ─────────────────────────────────────────────────────────────────────────────
// /ticket add
// ─────────────────────────────────────────────────────────────────────────────

export async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userToAdd = interaction.options.getUser("user");
  const isStaff = await checkStaffRole(interaction);

  if (!isStaff) {
    const staffRoleId = await getStaffRoleId(interaction.guildId);
    const roleText = staffRoleId
      ? `the <@&${staffRoleId}> role`
      : "a staff role";
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `You need ${roleText} to add users.`,
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
          "Cannot add users to a closed ticket.",
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
          "Failed to add user.",
          "Add Failed",
          interaction.client,
        ),
      ],
    });
  }

  try {
    await interaction.channel.permissionOverwrites.edit(userToAdd, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  } catch (error) {
    console.error("Failed to add user permissions:", error);
  }

  // Notify everyone in the ticket
  await interaction.channel.send({
    embeds: [
      createSuccessEmbed(
        `${userToAdd} has been added to this ticket by ${interaction.user}.`,
        "User Added",
        interaction.client,
      ),
    ],
  });

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `${userToAdd} has been added to this ticket.`,
        "User Added",
        interaction.client,
      ),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /ticket transfer
// ─────────────────────────────────────────────────────────────────────────────

export async function handleTransfer(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const staffToTransfer = interaction.options.getUser("staff");
  const isStaff = await checkStaffRole(interaction);

  if (!isStaff) {
    const staffRoleId = await getStaffRoleId(interaction.guildId);
    const roleText = staffRoleId
      ? `the <@&${staffRoleId}> role`
      : "a staff role";
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `You need ${roleText} to transfer tickets.`,
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
// /ticket remove
// ─────────────────────────────────────────────────────────────────────────────

export async function handleRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userToRemove = interaction.options.getUser("user");
  const isStaff = await checkStaffRole(interaction);

  if (!isStaff) {
    const staffRoleId = await getStaffRoleId(interaction.guildId);
    const roleText = staffRoleId
      ? `the <@&${staffRoleId}> role`
      : "a staff role";
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `You need ${roleText} to remove users.`,
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
          "Cannot remove users from a closed ticket.",
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
          "Failed to remove user.",
          "Remove Failed",
          interaction.client,
        ),
      ],
    });
  }

  try {
    await interaction.channel.permissionOverwrites.delete(userToRemove);
  } catch (error) {
    console.error("Failed to remove user permissions:", error);
  }

  // Notify everyone in the ticket
  await interaction.channel.send({
    embeds: [
      createSuccessEmbed(
        `${userToRemove} has been removed from this ticket by ${interaction.user}.`,
        "User Removed",
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

// ─────────────────────────────────────────────────────────────────────────────
// /ticket rename
// ─────────────────────────────────────────────────────────────────────────────

export async function handleRename(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const newName = interaction.options.getString("name");
  const isStaff = await checkStaffRole(interaction);

  if (!isStaff) {
    const staffRoleId = await getStaffRoleId(interaction.guildId);
    const roleText = staffRoleId
      ? `the <@&${staffRoleId}> role`
      : "a staff role";
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `You need ${roleText} to rename tickets.`,
          "Permission Denied",
          interaction.client,
        ),
      ],
    });
  }

  // Check bot permissions
  const botMember = await interaction.guild.members.me;
  if (!botMember.permissions.has("ManageChannels")) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "I don't have the **Manage Channels** permission in this server.\n\n" +
            "I need this permission to rename the ticket channel.",
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

// ─────────────────────────────────────────────────────────────────────────────
// /ticket alert
// ─────────────────────────────────────────────────────────────────────────────

export async function handleAlert(interaction) {
  await interaction.deferReply({ ephemeral: true });

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
          "Cannot alert users in a closed ticket.",
          "Ticket Closed",
          interaction.client,
        ),
      ],
    });
  }

  const isOwner = ticket.userId === interaction.user.id;
  const isClaimedByMe = ticket.claimedBy === interaction.user.id;

  if (isOwner) {
    if (!ticket.claimedBy) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "This ticket hasn't been claimed by any staff yet. Please wait patiently for a response.",
            "Not Claimed",
            interaction.client,
          ),
        ],
      });
    }

    try {
      await interaction.channel.send({
        content: `🔔 <@${ticket.claimedBy}> - The ticket creator is requesting your attention!`,
      });
      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            "Staff have been alerted to this ticket.",
            "Alert Sent",
            interaction.client,
          ),
        ],
      });
    } catch {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to send alert.",
            "Alert Failed",
            interaction.client,
          ),
        ],
      });
    }
  }

  if (isClaimedByMe) {
    try {
      await interaction.channel.send({
        content: `🔔 <@${ticket.userId}> - Please check this ticket, staff are waiting for your response!`,
      });
      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            "The ticket creator has been alerted.",
            "Alert Sent",
            interaction.client,
          ),
        ],
      });
    } catch {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to send alert.",
            "Alert Failed",
            interaction.client,
          ),
        ],
      });
    }
  }

  return interaction.editReply({
    embeds: [
      createErrorEmbed(
        "You must be the ticket creator or the claimed staff member to use this command.",
        "Permission Denied",
        interaction.client,
      ),
    ],
  });
}
