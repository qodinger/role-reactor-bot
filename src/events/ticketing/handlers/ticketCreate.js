import {
  ChannelType,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { getTicketManager } from "../../../features/ticketing/TicketManager.js";
import { getTicketPanel } from "../../../features/ticketing/TicketPanel.js";
import { getLogger } from "../../../utils/logger.js";
import {
  getStaffRoles,
  getStaffNotificationChannel,
} from "../../../features/ticketing/helpers.js";
import {
  createTicketWelcomeEmbed,
  createTicketActionButtons,
  createStaffAlertEmbed,
  createStaffAlertButtons,
  createErrorEmbed,
  createSuccessEmbed,
} from "../../../features/ticketing/embeds.js";

const logger = getLogger();

/**
 * Handle ticket creation from panel button
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} customId
 */
export async function handleTicketCreate(interaction, customId) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const categoryId = customId.replace("ticket_create_", "");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const guild = interaction.guild;

    // Initialize managers
    const ticketManager = getTicketManager();
    const ticketPanel = getTicketPanel();
    await ticketManager.initialize();
    await ticketPanel.initialize();

    // Check ticket limit
    const limitCheck = await ticketManager.checkTicketLimit(guildId);
    if (limitCheck.hasReachedLimit) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `Please wait before creating another ticket or close existing ones.`,
            "Ticket Limit Reached",
            interaction.client,
          ),
        ],
      });
    }

    // Check if user already has an open ticket
    const openTickets = await ticketManager.getUserTickets(
      userId,
      guildId,
      "open",
    );
    if (openTickets.length > 0) {
      const existingTicket = openTickets[0];
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `You already have an open ticket!\n\n` +
              `Ticket: \`#${existingTicket.ticketId.split("-").pop()}\`\n` +
              `Channel: <#${existingTicket.channelId}>\n\n` +
              `Please close your existing ticket before creating a new one.`,
            "Ticket Limit Reached",
            interaction.client,
          ),
        ],
      });
    }

    // Get panel info
    const panel = await ticketPanel.getPanelByMessage(interaction.message.id);
    if (!panel) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "This ticket panel is no longer valid. Please contact an administrator.",
            "Panel Not Found",
            interaction.client,
          ),
        ],
      });
    }

    // Get next ticket number from atomic counter (peek only, actual increment happens in TicketManager.createTicket)
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    const ticketNumber = (settings?.counters?.ticket || 0) + 1;
    const channelName = `ticket-${ticketNumber.toString().padStart(4, "0")}`;

    // Check bot permissions before creating thread
    const botMember = await guild.members.fetchMe();
    const panelChannelPermissions =
      interaction.channel.permissionsFor(botMember);

    if (
      !panelChannelPermissions?.has("CreatePrivateThreads") ||
      !panelChannelPermissions?.has("SendMessagesInThreads")
    ) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "I don't have permission to create private threads here.\n\n" +
              "Please make sure I have the **Create Private Threads** and **Send Messages in Threads** permissions enabled.",
            "Missing Permissions",
            interaction.client,
          ),
        ],
      });
    }

    let channel;
    let ticket;
    let staffRoles = [];

    try {
      staffRoles = await getStaffRoles(guild);

      if (!("threads" in interaction.channel)) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Tickets cannot be created here. This channel type does not support threads.",
              "Unsupported Channel",
              interaction.client,
            ),
          ],
        });
      }

      // Create private thread
      // @ts-ignore
      channel = await interaction.channel.threads.create({
        name: channelName,
        // @ts-ignore
        type: ChannelType.PrivateThread,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: `Support ticket created by ${interaction.user.tag}`,
      });

      // Add user to the thread explicitly
      await channel.members.add(userId);

      // Create ticket in database
      ticket = await ticketManager.createTicket({
        guildId,
        channelId: channel.id,
        userId,
        userDisplayName: interaction.user.displayName,
        categoryId: categoryId === "default" ? "default" : categoryId,
      });

      if (!ticket) {
        await channel.delete("Failed to create ticket in database");
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Failed to create ticket. Please try again.",
              "Ticket Creation Failed",
              interaction.client,
            ),
          ],
        });
      }
    } catch (error) {
      logger.error("Ticket create error:", error);

      let errorMessage = "Please try again or contact an administrator.";
      let errorTitle = "Failed to Create Ticket";

      if (error.code === 50013) {
        errorMessage =
          "I don't have enough permissions to create the ticket thread.\n\n" +
          "Please verify that I have the **Create Private Threads** permission in this channel.";
        errorTitle = "Missing Permissions";
      }

      return interaction.editReply({
        embeds: [
          createErrorEmbed(errorMessage, errorTitle, interaction.client),
        ],
      });
    }

    // Get category settings from panel structure
    const panelCategories = panel.categories || [];
    let selectedCategory = panelCategories.find(c => c.id === categoryId);

    // Provide safe defaults if the category was deleted or is the default
    if (!selectedCategory) {
      selectedCategory = {
        name: "General Support",
        description: "A staff member will arrive shortly to assist you.",
        emoji: "🎫",
        color: 0x5865f2,
        id: "default",
      };
    }

    // Send welcome message using specific category data
    const welcomeEmbed = createTicketWelcomeEmbed({
      ticketId: ticket.ticketId,
      ticketNumber: ticketNumber.toString().padStart(4, "0"),
      userName: `<@${userId}>`,
      category: selectedCategory,
      client: interaction.client,
    });

    const actionButtons = createTicketActionButtons({
      canClaim: true,
      canClose: true,
      canAddUser: true,
      isClaimed: false,
    });

    await channel.send({
      embeds: [welcomeEmbed],
      // @ts-ignore
      components: actionButtons,
    });

    // Notify user
    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `Your ticket has been created: ${channel}\n\n` +
            `Please describe your issue and our team will help you shortly.`,
          "Ticket Created",
          interaction.client,
        ),
      ],
    });

    // 🚀 Quiet Claim: Notify staff channel with a Claim button
    const staffChannel = await getStaffNotificationChannel(guild);
    if (staffChannel) {
      const staffAlertEmbed = createStaffAlertEmbed({
        ticketId: ticket.ticketId,
        ticketNumber: ticketNumber.toString().padStart(4, "0"),
        userName: interaction.user.tag,
        userId: interaction.user.id,
        channelId: channel.id,
        category: selectedCategory,
        client: interaction.client,
      });

      const staffAlertButtons = createStaffAlertButtons({
        ticketId: ticket.ticketId,
      });

      const staffMentionStr =
        staffRoles.length > 0
          ? staffRoles.map(role => `<@&${role.id}>`).join(" ")
          : "";

      await staffChannel.send({
        content: staffMentionStr || undefined,
        embeds: [staffAlertEmbed],
        components: staffAlertButtons,
        allowedMentions: { roles: staffRoles.map(r => r.id) },
      });
    }
  } catch (error) {
    logger.error("Ticket create error:", error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to create ticket: ${error.message}`,
          "Request Failed",
          interaction.client,
        ),
      ],
    });
  }
}
