import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

export const disabled = false;

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
  name: "starboard",
  category: "admin",
  description:
    "Highlight the best messages in your server with a community-driven hall of fame",
  keywords: [
    "starboard",
    "star",
    "highlight",
    "hall of fame",
    "best messages",
    "featured",
  ],
  emoji: "⭐",
  helpFields: [
    {
      name: "How to Use",
      value: [
        "```/starboard setup channel:#starboard emoji:⭐ threshold:3```",
        "```/starboard enable```",
        "```/starboard disable```",
      ].join("\n"),
      inline: false,
    },
    {
      name: "Subcommands",
      value: [
        "**setup** - Configure the starboard channel, emoji, and reaction threshold",
        "**enable** - Enable the starboard feature",
        "**disable** - Disable the starboard feature",
      ].join("\n"),
      inline: false,
    },
    {
      name: "Permissions",
      value: "• **Manage Server** permission required",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName("starboard")
  .setDescription("Configure the server's starboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand
      .setName("setup")
      .setDescription("Configure starboard settings")
      .addChannelOption(option =>
        option
          .setName("channel")
          .setDescription("The channel to post starboard messages in")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("emoji")
          .setDescription("The emoji to use for starring (default: ⭐)")
          .setRequired(false),
      )
      .addIntegerOption(option =>
        option
          .setName("threshold")
          .setDescription("Number of reactions required to post (default: 3)")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand.setName("enable").setDescription("Enable the starboard feature"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("disable")
      .setDescription("Disable the starboard feature"),
  );

export { execute };
