import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleDisconnectAdd,
  handleDisconnectRemove,
  handleMuteAdd,
  handleMuteRemove,
  handleDeafenAdd,
  handleDeafenRemove,
  handleMoveAdd,
  handleMoveRemove,
  handleList,
} from "./handlers.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "voice-control",
  category: "admin",
  description:
    "Manage roles that automatically control users in voice channels (disconnect/mute/deafen/move)",
  keywords: [
    "voice-control",
    "voice control",
    "voice",
    "vc",
    "disconnect",
    "mute",
    "deafen",
    "move",
  ],
  emoji: "🎤",
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommandGroup(group =>
    group
      .setName("disconnect")
      .setDescription("Manage roles that disconnect users from voice channels")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription(
            "Add a role that will disconnect users from voice channels",
          )
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role that will disconnect users from voice")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove a role from the disconnect list")
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role to remove from the disconnect list")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("mute")
      .setDescription("Manage roles that mute users in voice channels")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription("Add a role that will mute users in voice channels")
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role that will mute users in voice")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove a role from the mute list")
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role to remove from the mute list")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("deafen")
      .setDescription("Manage roles that deafen users in voice channels")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription("Add a role that will deafen users in voice channels")
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role that will deafen users in voice")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove a role from the deafen list")
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role to remove from the deafen list")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("move")
      .setDescription("Manage roles that move users to specific voice channels")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription(
            "Add a role that will move users to a specific voice channel",
          )
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role that will move users")
              .setRequired(true),
          )
          .addChannelOption(option =>
            option
              .setName("channel")
              .setDescription("The voice channel to move users to")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove a role from the move list")
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role to remove from the move list")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("list")
      .setDescription("List all roles configured for voice control"),
  );

export async function execute(interaction) {
  const logger = getLogger();

  try {
    // Check user permissions
    if (!hasAdminPermissions(interaction.member)) {
      const response = errorEmbed({
        title: "Permission Denied",
        description:
          "You need Administrator permissions to manage voice control roles.",
        solution: "Contact a server administrator for assistance.",
      });

      return interaction.reply({ embeds: [response], flags: 64 });
    }

    // Check bot permissions
    const botMember = interaction.guild.members.me;
    const hasMoveMembers = botMember?.permissions.has(
      PermissionFlagsBits.MoveMembers,
    );
    const hasMuteMembers = botMember?.permissions.has(
      PermissionFlagsBits.MuteMembers,
    );
    const hasDeafenMembers = botMember?.permissions.has(
      PermissionFlagsBits.DeafenMembers,
    );

    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(false);

    // Check permissions based on operation
    if (subcommandGroup === "disconnect" && !hasMoveMembers) {
      const response = errorEmbed({
        title: "Missing Bot Permission",
        description:
          "I need the **Move Members** permission to disconnect users from voice channels.",
        solution: "Please grant me the Move Members permission and try again.",
      });

      return interaction.reply({ embeds: [response], flags: 64 });
    }

    if (subcommandGroup === "mute" && !hasMuteMembers) {
      const response = errorEmbed({
        title: "Missing Bot Permission",
        description:
          "I need the **Mute Members** permission to mute users in voice channels.",
        solution: "Please grant me the Mute Members permission and try again.",
      });

      return interaction.reply({ embeds: [response], flags: 64 });
    }

    if (subcommandGroup === "deafen" && !hasDeafenMembers) {
      const response = errorEmbed({
        title: "Missing Bot Permission",
        description:
          "I need the **Deafen Members** permission to deafen users in voice channels.",
        solution:
          "Please grant me the Deafen Members permission and try again.",
      });

      return interaction.reply({ embeds: [response], flags: 64 });
    }

    if (subcommandGroup === "move" && !hasMoveMembers) {
      const response = errorEmbed({
        title: "Missing Bot Permission",
        description:
          "I need the **Move Members** permission to move users between voice channels.",
        solution: "Please grant me the Move Members permission and try again.",
      });

      return interaction.reply({ embeds: [response], flags: 64 });
    }

    if (subcommand === "list") {
      await handleList(interaction);
      return;
    }

    if (subcommandGroup === "disconnect") {
      if (subcommand === "add") {
        await handleDisconnectAdd(interaction);
      } else if (subcommand === "remove") {
        await handleDisconnectRemove(interaction);
      }
    } else if (subcommandGroup === "mute") {
      if (subcommand === "add") {
        await handleMuteAdd(interaction);
      } else if (subcommand === "remove") {
        await handleMuteRemove(interaction);
      }
    } else if (subcommandGroup === "deafen") {
      if (subcommand === "add") {
        await handleDeafenAdd(interaction);
      } else if (subcommand === "remove") {
        await handleDeafenRemove(interaction);
      }
    } else if (subcommandGroup === "move") {
      if (subcommand === "add") {
        await handleMoveAdd(interaction);
      } else if (subcommand === "remove") {
        await handleMoveRemove(interaction);
      }
    } else {
      const response = errorEmbed({
        title: "Unknown Subcommand",
        description: `The subcommand "${subcommand}" is not recognized.`,
        solution: "Use disconnect, mute, deafen, move, or list as subcommands.",
      });
      await interaction.reply({ embeds: [response], flags: 64 });
    }
  } catch (error) {
    logger.error("Error in voice-control command:", error);
    const response = errorEmbed({
      title: "Error",
      description: "Failed to process voice-control command.",
      solution: "Please try again or contact support if the issue persists.",
    });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [response], flags: 64 });
    } else if (interaction.deferred) {
      await interaction.editReply({ embeds: [response] });
    }
  }
}
