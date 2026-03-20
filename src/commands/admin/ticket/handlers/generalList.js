import { MessageFlags } from "discord.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { createInfoEmbed } from "../../../../features/ticketing/embeds.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket list
// ─────────────────────────────────────────────────────────────────────────────

export async function handleList(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
