import { AttachmentBuilder } from "discord.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import {
  createInfoEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import { checkStaffRole } from "../utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket list
// ─────────────────────────────────────────────────────────────────────────────

export async function handleList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const status = interaction.options.getString("status") || "open";
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const ticketManager = getTicketManager();
  await ticketManager.initialize();

  const tickets = await ticketManager.getUserTickets(userId, guildId, status);

  if (tickets.length === 0) {
    const statusText = status === "all" ? "" : ` ${status}`;
    return interaction.editReply({
      embeds: [
        createInfoEmbed(
          "Your Tickets",
          `You don't have any${statusText} tickets.`,
          interaction.client,
        ),
      ],
    });
  }

  const ticketList = tickets
    .slice(0, 10)
    .map(ticket => {
      const openedDate = new Date(ticket.openedAt).toLocaleDateString();
      const claimedInfo = ticket.claimedBy
        ? ` • Claimed: <@${ticket.claimedBy}>`
        : " • Unclaimed";
      return `**#${ticket.ticketId.split("-").pop()}** - ${openedDate}${claimedInfo}`;
    })
    .join("\n");

  const embed = createInfoEmbed(
    "Your Tickets",
    "List of your tickets in this server.",
    interaction.client,
  ).addFields({
    name: `Tickets (${tickets.length})`,
    value: ticketList,
    inline: false,
  });

  if (tickets.length > 10) {
    embed.addFields({
      name: "Note",
      value: `Showing first 10 of ${tickets.length} tickets.`,
      inline: false,
    });
  }

  return interaction.editReply({ embeds: [embed] });
}

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

// ─────────────────────────────────────────────────────────────────────────────
// /ticket transcript
// ─────────────────────────────────────────────────────────────────────────────

export async function handleTranscript(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ticketNumber = interaction.options
    .getString("ticket-id")
    .replace(/^#/, "");
  const guildId = interaction.guildId;
  const formattedId = ticketNumber.padStart(4, "0");

  const ticketManager = getTicketManager();
  const ticketTranscript = getTicketTranscript();
  await ticketManager.initialize();
  await ticketTranscript.initialize();

  // Find ticket record first
  let ticket = await ticketManager.getTicket(`TIX-${guildId}-${formattedId}`);
  if (!ticket) {
    const allTickets = await ticketManager.storage.getTicketsByGuild(guildId);
    ticket = allTickets.find(t => t.ticketId.endsWith(`-${formattedId}`));
  }

  if (!ticket) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Ticket #${formattedId} not found in our records.`,
          "Ticket Not Found",
          interaction.client,
        ),
      ],
    });
  }

  // Permission Check
  const isOwner = ticket.userId === interaction.user.id;
  const isStaff = await checkStaffRole(interaction);

  if (!isOwner && !isStaff) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "You can only view transcripts for your own tickets.",
          "Permission Denied",
          interaction.client,
        ),
      ],
    });
  }

  // Get transcript data
  const transcript = await ticketTranscript.storage.getTicketTranscriptByTicket(
    ticket.ticketId,
  );

  if (!transcript || !transcript.content) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `No transcript data found for ticket #${formattedId}. It might have expired or was never generated.`,
          "Transcript Missing",
          interaction.client,
        ),
      ],
    });
  }

  const attachment = new AttachmentBuilder(Buffer.from(transcript.content), {
    name: `transcript-${formattedId}.html`,
  });

  return interaction.editReply({
    content: `Here is the transcript for Ticket **#${formattedId}**.`,
    files: [attachment],
  });
}
