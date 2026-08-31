import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

export const metadata = {
  name: "engine",
  category: "general",
  description:
    "Manage server Pro Engine status, Guild Core Reserve, and community fueling",
  keywords: [
    "engine",
    "pro",
    "vault",
    "fuel",
    "pool",
    "cores",
    "reserve",
    "tier",
  ],
  emoji: "⚡",
  helpFields: [
    {
      name: `How to Use`,
      value:
        "• `/engine status` — View server Pro Engine status\n• `/engine vault` — View Guild Core Reserve balance & top sponsors\n• `/engine fuel <cores>` — Deposit personal Cores into server Vault",
      inline: false,
    },
    {
      name: `Who Can Fuel?`,
      value: "Anyone in the community can fuel the server's Vault!",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• None required for status, vault, or fueling",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addSubcommand(subcommand =>
    subcommand
      .setName("status")
      .setDescription(
        "View server Pro Engine subscription status and active limits",
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("vault")
      .setDescription(
        "View Guild Core Reserve balance, funded weeks remaining, and top sponsors",
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("fuel")
      .setDescription("Deposit personal Cores into this server's Guild Vault")
      .addNumberOption(option =>
        option
          .setName("cores")
          .setDescription(
            "Amount of Paid Cores to deposit into Guild Vault (min 1)",
          )
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
