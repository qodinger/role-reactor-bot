const {
  Events,
  OAuth2Scopes,
  PermissionFlagsBits,
  ActivityType,
} = require("discord.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    // Professional startup logging
    console.log(
      "╔══════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                    RoleReactor Bot v1.0.0                    ║"
    );
    console.log(
      "║                    Role Management System                    ║"
    );
    console.log(
      "╚══════════════════════════════════════════════════════════════╝"
    );
    console.log("");
    console.log(`✅ Bot Status: ONLINE`);
    console.log(`🤖 Bot Name: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`📊 Servers: ${client.guilds.cache.size.toLocaleString()}`);
    console.log(`👥 Total Users: ${client.users.cache.size.toLocaleString()}`);
    console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
    console.log(
      `💾 Memory Usage: ${(
        process.memoryUsage().heapUsed /
        1024 /
        1024
      ).toFixed(2)} MB`
    );
    console.log("");

    // Set professional bot status
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
      permissions: [
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ViewChannel,
      ],
    });

    console.log("🔗 Bot Invite Link:");
    console.log(inviteLink);
    console.log("");
    console.log("📋 Required Permissions:");
    console.log("   • Manage Roles");
    console.log("   • Manage Messages");
    console.log("   • Add Reactions");
    console.log("   • Read Message History");
    console.log("   • View Channel");
    console.log("");
    console.log("🚀 Bot is ready to serve!");
    console.log("");
  },
};
