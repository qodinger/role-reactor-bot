import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import {
  createInfoEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import { checkStaffRole } from "../utils.js";
import {
  FREE_TIER,
  PRO_ENGINE,
} from "../../../../features/ticketing/config.js";
import config from "../../../../config/config.js";

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
    const embed = createInfoEmbed(
      `🎫 | Your ${status.charAt(0).toUpperCase() + status.slice(1)} Tickets`,
      `You don't have any${statusText} tickets in this server.`,
      interaction.client,
    );

    const isPro = await ticketManager.premiumManager.isFeatureActive(
      guildId,
      "pro_engine",
    );
    const retentionInfo = isPro
      ? "Transcripts stored forever"
      : "Transcripts expire in 7 days";

    embed.setFooter({
      text: retentionInfo,
      iconURL: interaction.guild.iconURL(),
    });

    return interaction.editReply({ embeds: [embed] });
  }

  // Format the ticket list for the description
  const ticketList = tickets
    .slice(0, 10)
    .map(ticket => {
      const ticketNum = ticket.ticketId.split("-").pop();
      const formattedId = `\`#${ticketNum.padStart(4, "0")}\``;
      const date = new Date(ticket.openedAt).toLocaleDateString();

      let statusIcon = "🟢"; // Open
      let statusDetail = "Open";

      if (ticket.status === "closed") {
        statusIcon = "🔴";
        statusDetail = "Closed";
      } else if (ticket.claimedBy) {
        statusIcon = "🤝";
        statusDetail = `Claimed by <@${ticket.claimedBy}>`;
      }

      return `${statusIcon} ${formattedId} | ${date} | ${statusDetail}`;
    })
    .join("\n");

  const isPro = await ticketManager.premiumManager.isFeatureActive(
    guildId,
    "pro_engine",
  );

  const retentionInfo = isPro
    ? "Transcripts stored forever"
    : "Transcripts expire in 7 days";

  const embed = createInfoEmbed(
    `🎫 | Your ${status.charAt(0).toUpperCase() + status.slice(1)} Tickets`,
    `Below is a list of your most recent tickets.\n\n${ticketList}`,
    interaction.client,
  );

  // Add metadata footer
  embed.setFooter({
    text: `${retentionInfo} • Showing ${Math.min(10, tickets.length)} of ${tickets.length}`,
    iconURL: interaction.guild.iconURL(),
  });

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
          "You do not have permission to view this transcript.",
          "Permission Denied",
          interaction.client,
        ),
      ],
    });
  }

  // Check if members are allowed to export their own transcripts
  if (isOwner && !isStaff) {
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    const allowUserTranscripts =
      settings?.ticketSettings?.allowUserTranscripts !== false;

    if (!allowUserTranscripts) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Access to ticket transcripts has been disabled for members in this server. Please contact a staff member if you need a copy of your chat history.",
            "Access Disabled",
            interaction.client,
          ),
        ],
      });
    }
  }

  // Check tier restrictions for format
  const tierInfo = await ticketManager.checkTicketLimit(guildId);
  const allowedFormats = tierInfo.isPro
    ? PRO_ENGINE.EXPORT_FORMATS
    : FREE_TIER.EXPORT_FORMATS;

  // Get format option, defaulting to the best available for the tier
  const formatInput = interaction.options.getString("format");
  const format = formatInput || (tierInfo.isPro ? "html" : "md");

  if (!allowedFormats.includes(format)) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `The **${format.toUpperCase()}** export format is only available with **Pro Engine**.\n\n` +
            "Upgrade your server to unlock HTML transcripts, data exports, and unlimited retention.",
          "Premium Feature",
          interaction.client,
        ),
      ],
    });
  }

  // Get transcript data
  const transcript = await ticketTranscript.storage.getTicketTranscriptByTicket(
    ticket.ticketId,
  );

  if (
    !transcript ||
    (!transcript.content &&
      (!transcript.messages || transcript.messages.length === 0))
  ) {
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

  // Determine content and filename
  let content = transcript.content;
  const filename = `transcript-${formattedId}.${format}`;

  // Regenerate if content is missing OR a different format is requested
  if ((!content || format !== transcript.format) && transcript.messages) {
    if (format === "json") {
      content = ticketTranscript.generateJSON(transcript.messages, {
        ...ticket,
        isTruncated: transcript.metadata?.isTruncated,
      });
    } else if (format === "md") {
      content = ticketTranscript.generateMarkdown(transcript.messages, {
        ...ticket,
        isTruncated: transcript.metadata?.isTruncated,
      });
    } else if (format === "html") {
      content = ticketTranscript.generateHTML(transcript.messages, {
        ...ticket,
        isTruncated: transcript.metadata?.isTruncated,
      });
    }
  }

  if (!content) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "The transcript content is currently unavailable. Please try again later.",
          "Content Error",
          interaction.client,
        ),
      ],
    });
  }

  const attachment = new AttachmentBuilder(Buffer.from(content), {
    name: filename,
  });

  const components = [];
  // Only show "View in Browser" button for HTML transcripts
  if (format === "html") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("View in Browser")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.botInfo.apiUrl}/t/${transcript.transcriptId}`),
    );
    components.push(row);
  }

  return interaction.editReply({
    content: `Here is the transcript for Ticket **#${formattedId}** in **${format.toUpperCase()}** format.`,
    embeds: [
      createInfoEmbed(
        `Ticket Transcript • #${formattedId}`,
        format === "html"
          ? "Use the button below to view the full chat history in your browser, or download the attached HTML file."
          : `Your transcript has been exported as a **${format.toUpperCase()}** file for your records.`,
        interaction.client,
      ),
    ],
    files: [attachment],
    components,
  });
}
