import { Events, OAuth2Scopes, ActivityType } from "discord.js";
import {
  requiredPermissions,
  formatPermissionName,
} from "../utils/permissions.js";
import {
  createSpinner,
  createInfoBox,
  createSuccessMessage,
  printBotStats,
  createWelcomeBox,
} from "../utils/terminal.js";
import { BOT_VERSION } from "../utils/version.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Create a beautiful startup spinner
    const spinner = createSpinner("Initializing RoleReactor Bot...");
    spinner.start();

    // Simulate a brief loading time for visual effect
    await new Promise(resolve => {
      setTimeout(resolve, 1500);
    });

    spinner.succeed("Bot initialized successfully!");

    // Welcome section using terminal.js utility
    const titleText = `🤖 RoleReactor Bot v${BOT_VERSION} 🤖`;
    const titleBox = createWelcomeBox(titleText, "cristal");
    console.log("");
    console.log(titleBox);
    console.log("");

    // Print bot statistics
    const stats = {
      botName: client.user.tag,
      botId: client.user.id,
      servers: client.guilds.cache.size,
      users: client.users.cache.size,
      startTime: new Date().toLocaleString(),
      memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    };

    printBotStats(stats);

    // Set bot status
    const activities = [
      { name: "role reactions", type: ActivityType.Watching },
      { name: "/help for commands", type: ActivityType.Playing },
      {
        name: `${client.guilds.cache.size} servers`,
        type: ActivityType.Watching,
      },
    ];

    let activityIndex = 0;
    client.user.setActivity(activities[activityIndex]);

    // Rotate status every 30 seconds
    setInterval(() => {
      activityIndex = (activityIndex + 1) % activities.length;
      client.user.setActivity(activities[activityIndex]);
    }, 30000);

    // Generate and log OAuth2 invite link with required permissions
    const inviteLink = client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: requiredPermissions,
    });

    // Create invite link section
    const inviteSection = [
      `🔗 Bot Invite Link:`,
      inviteLink,
      "",
      `📋 Required Permissions:`,
      ...requiredPermissions.map(perm => `   • ${formatPermissionName(perm)}`),
    ];

    const inviteBox = createInfoBox("🔗 Invitation Details", inviteSection, {
      borderColor: "green",
    });

    console.log("");
    console.log(inviteBox);
    console.log("");

    // Final success message
    const successMessage = createSuccessMessage("🚀 Bot is ready to serve!");
    console.log(successMessage);
    console.log("");
  },
};
