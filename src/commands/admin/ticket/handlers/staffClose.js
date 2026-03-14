import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";
import config from "../../../../config/config.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
  createTranscriptLogEmbed,
} from "../../../../features/ticketing/embeds.js";
import {
  checkStaffRole,
  formatDuration,
} from "../utils.js";
import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

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
  const isThread = interaction.channel.isThread();
  const requiredPerms = isThread
    ? PermissionFlagsBits.ManageThreads
    : PermissionFlagsBits.ManageChannels;

  if (!botMember.permissions.has(requiredPerms)) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `I don't have the **${isThread ? "Manage Threads" : "Manage Channels"}** permission in this server.\n\n` +
            `I need this permission to ${isThread ? "archive" : "delete"} the ticket channel when closing.`,
          "Missing Permissions",
          interaction.client,
        ),
      ],
    });
  }

  await ticketTranscript.initialize();
  const transcriptResult = await ticketTranscript.generateFromChannel({
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
        isThread
          ? "This ticket has been closed. Thread will be locked and archived shortly."
          : "This ticket has been closed. Channel will be deleted shortly.",
        "Ticket Closed",
        interaction.client,
      ),
    ],
  });

  // Handle log channel
  if (transcriptResult.success) {
    try {
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(
          interaction.guildId,
        );
      const logChannelId = settings?.ticketSettings?.transcriptChannelId;

      if (logChannelId) {
        const logChannel = await interaction.guild.channels
          .fetch(logChannelId)
          .catch(() => null);
        if (logChannel) {
          const attachment = new AttachmentBuilder(
            Buffer.from(transcriptResult.content),
            {
              name: `transcript-${ticket.ticketId.split("-").pop()}.html`,
            },
          );

          const logEmbed = createTranscriptLogEmbed({
            ticketId: ticket.ticketId,
            userName: ticket.userDisplayName || "Unknown",
            userId: ticket.userId,
            closedBy: interaction.user.tag,
            reason: reason || "No reason provided",
            duration: duration,
            messages: transcriptResult.transcript.messages,
            client: interaction.client,
          });

          const logRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("View in Browser")
              .setStyle(ButtonStyle.Link)
              .setURL(
                `${config.botInfo.apiUrl}/t/${transcriptResult.transcript.transcriptId}`,
              ),
          );

          await logChannel.send({
            embeds: [logEmbed],
            files: [attachment],
            components: [logRow],
          });
        }
      }
    } catch (err) {
      logger.debug(`Failed to send transcript to log channel: ${err.message}`);
    }
  }

  setTimeout(async () => {
    try {
      if (interaction.channel.isThread()) {
        await interaction.channel.edit({
          locked: true,
          archived: true,
          reason: "Ticket closed",
        });
      } else {
        await interaction.channel.delete("Ticket closed");
      }
    } catch (error) {
      logger.error("Failed to close ticket channel/thread:", error);
    }
  }, 2000);
}
