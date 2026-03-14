import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";
import config from "../../../config/config.js";
import { getTicketManager } from "../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../features/ticketing/TicketTranscript.js";
import { getLogger } from "../../../utils/logger.js";
import {
  checkStaffRole,
  formatDuration,
} from "../../../features/ticketing/helpers.js";
import {
  createTicketClosedEmbed,
  createErrorEmbed,
  createSuccessEmbed,
  createTranscriptLogEmbed,
} from "../../../features/ticketing/embeds.js";

const logger = getLogger();

/**
 * Handle ticket close button
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleTicketClose(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    // Initialize managers
    const ticketManager = getTicketManager();
    const ticketTranscript = getTicketTranscript();
    await ticketManager.initialize();
    await ticketTranscript.initialize();

    // Get ticket
    const ticket = await ticketManager.getTicketByChannel(channelId);
    if (!ticket) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "This is not a ticket channel.",
            "Invalid Action",
            interaction.client,
          ),
        ],
      });
    }

    // Check authorization
    const isOwner = ticket.userId === userId;
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

    // Check bot permissions
    const botMember = await interaction.guild.members.fetchMe();
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

    // Generate transcript
    const transcriptResult = await ticketTranscript.generateFromChannel({
      ticketId: ticket.ticketId,
      guildId: ticket.guildId,
      channel: interaction.channel,
      ticket,
      format: "html",
    });

    // Close ticket
    const success = await ticketManager.closeTicket(
      ticket.ticketId,
      userId,
      "Closed via button",
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

    // Calculate duration
    const duration = formatDuration(new Date(ticket.openedAt), new Date());

    // Send close message
    const closeEmbed = createTicketClosedEmbed({
      ticketNumber: ticket.ticketId.split("-").pop(),
      closedBy: `<@${interaction.user.id}>`,
      reason: "Closed via button",
      duration,
      client: interaction.client,
    });

    // Send close notification publicly so everyone sees it
    await interaction.channel.send({ embeds: [closeEmbed] });
    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          interaction.channel.isThread()
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
              reason: "Closed via button",
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
        logger.debug(
          `Failed to send transcript to log channel: ${err.message}`,
        );
      }
    }

    // Delete channel or archive thread after delay
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
        logger.error("Failed to delete/archive ticket channel/thread:", error);
      }
    }, 2000);
  } catch (error) {
    logger.error("Ticket close error:", error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to close ticket: ${error.message}`,
          "Close Failed",
          interaction.client,
        ),
      ],
    });
  }
}
