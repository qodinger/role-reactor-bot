import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import {
  createInfoEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import { checkStaffRole } from "../utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket view
// ─────────────────────────────────────────────────────────────────────────────

export async function handleView(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ticketNumber = interaction.options
    .getString("ticket-id")
    .replace(/^#/, "");
  const guildId = interaction.guildId;
  const formattedId = ticketNumber.padStart(4, "0");

  const ticketManager = getTicketManager();
  await ticketManager.initialize();

  // Try canonical ID format first, then fall back to suffix search for backward compat
  let ticket = await ticketManager.getTicket(`TIX-${guildId}-${formattedId}`);
  if (!ticket) {
    const allTickets = await ticketManager.storage.getTicketsByGuild(guildId);
    ticket = allTickets.find(t => t.ticketId.endsWith(`-${formattedId}`));
  }

  if (!ticket) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Ticket #${formattedId} not found.`,
          "Ticket Not Found",
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
          "You can only view your own tickets.",
          "Permission Denied",
          interaction.client,
        ),
      ],
    });
  }

  const statusText =
    ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1);

  const fields = [
    {
      name: "Ticket",
      value: `\`#${ticket.ticketId.split("-").pop()}\``,
      inline: true,
    },
    {
      name: "Status",
      value: statusText,
      inline: true,
    },
    { name: "Created By", value: `<@${ticket.userId}>`, inline: true },
    {
      name: "Category",
      value: ticket.categoryId || "General",
      inline: true,
    },
    { name: "Messages", value: ticket.messages.toString(), inline: true },
    {
      name: "Participants",
      value: ticket.participants?.length?.toString() || "1",
      inline: true,
    },
    {
      name: "Opened",
      value: new Date(ticket.openedAt).toLocaleString(),
      inline: false,
    },
    {
      name: "Closed",
      value: ticket.closedAt
        ? new Date(ticket.closedAt).toLocaleString()
        : "Not closed",
      inline: false,
    },
  ];

  if (ticket.claimedBy) {
    fields.push({
      name: "Claimed By",
      value: `<@${ticket.claimedBy}>`,
      inline: true,
    });
  }

  if (ticket.closeReason) {
    fields.push({
      name: "Reason",
      value: ticket.closeReason,
      inline: false,
    });
  }

  const embed = createInfoEmbed(
    `Ticket #${formattedId}`,
    "Detailed information about this ticket.",
    interaction.client,
  ).addFields(fields);

  return interaction.editReply({ embeds: [embed] });
}
