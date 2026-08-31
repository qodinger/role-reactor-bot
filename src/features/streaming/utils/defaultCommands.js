/**
 * Twitch chat commands available in every connected channel.
 * Channel-specific commands are stored in twitch_commands.
 *
 * userlevel: "everyone" | "subscriber" | "vip" | "moderator" | "owner"
 * Higher levels inherit lower permissions (owner can run subscriber commands, etc.).
 */
export const GLOBAL_DEFAULT_TWITCH_COMMANDS = [
  {
    name: "bot",
    response: "⚡ RoleReactor is online! Type !commands to see what I can do.",
    description: "Bot status — is RoleReactor online",
    userlevel: "everyone",
  },
  {
    name: "commands",
    response: "📋 Commands: {commands}",
    description: "List available commands",
    userlevel: "everyone",
  },
  {
    name: "uptime",
    response: "⏱️ {uptime}",
    description: "How long the stream has been live",
    userlevel: "everyone",
  },
  {
    name: "title",
    response: "📺 {title}",
    description: "Current stream title (!title <text> = mod only)",
    userlevel: "everyone",
  },
  {
    name: "game",
    response: "🎮 {game}",
    description: "Current game/category (!game <name> = mod only)",
    userlevel: "everyone",
  },
  {
    name: "quote",
    response: null, // handled by special logic
    description: "Random quote (!quote add = mod only)",
    userlevel: "everyone",
  },
  {
    name: "so",
    response: null, // handled by special logic
    description: "Shoutout a viewer (!so <user> = mod only)",
    userlevel: "moderator",
  },
  {
    name: "poll",
    response: null, // handled by special logic
    description: 'Start a poll (!poll "Q" | "A" | "B" = mod only)',
    userlevel: "moderator",
  },
  {
    name: "timeout",
    response: null, // handled by special logic
    description: "Timeout a user (!timeout <user> [seconds] = mod only)",
    userlevel: "moderator",
  },
  {
    name: "untimeout",
    response: null, // handled by special logic
    description: "Remove timeout (!untimeout <user> = mod only)",
    userlevel: "moderator",
  },
  {
    name: "ban",
    response: null, // handled by special logic
    description: "Ban a user (!ban <user> [reason] = mod only)",
    userlevel: "moderator",
  },
];
