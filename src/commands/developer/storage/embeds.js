import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";

// ============================================================================
// STORAGE EMBED BUILDER
// ============================================================================

export async function createStorageEmbed(client, user) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle("Storage Status")
    .setDescription("Current storage configuration and statistics")
    .setFooter({
      text: `Requested by ${user.tag}`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp();

  try {
    const storageManager = await getStorageManager();
    const databaseManager = await getDatabaseManager();

    // Get storage statistics
    const storageStats = await getStorageStatistics(storageManager);
    const dbHealth = await getDatabaseHealth(databaseManager);
    const storageType = getStorageType(storageManager);

    // Storage Type and Status
    embed.addFields(
      {
        name: "Storage Type",
        value: storageType,
        inline: true,
      },
      {
        name: "Database Status",
        value: dbHealth.status,
        inline: true,
      },
      {
        name: "Role Mappings",
        value: `${storageStats.roleMappings} active mappings`,
        inline: true,
      },
      {
        name: "Temporary Roles",
        value: `${storageStats.tempRoles} active temporary roles`,
        inline: true,
      },
    );

    // Data Retention Information
    embed.addFields({
      name: "Data Retention",
      value: [
        "• **Role mappings**: Until manually removed",
        "• **Temporary roles**: Auto-expire",
        "• **Logs**: 30 days",
        "• **Cache**: 5 minutes",
      ].join("\n"),
      inline: false,
    });

    // Storage Recommendations
    const recommendations = getStorageRecommendations(
      storageType,
      dbHealth,
      storageStats,
    );
    if (recommendations.length > 0) {
      embed.addFields({
        name: "Recommendations",
        value: recommendations.join("\n"),
        inline: false,
      });
    }

    // Database Details (if available)
    if (dbHealth.details) {
      embed.addFields({
        name: "Database Details",
        value: dbHealth.details,
        inline: false,
      });
    }

    // Storage Performance
    const performance = await getStoragePerformance(storageManager);
    if (performance) {
      embed.addFields({
        name: "Performance Metrics",
        value: [
          `**Read Operations**: ${performance.readOps}/min`,
          `**Write Operations**: ${performance.writeOps}/min`,
          `**Average Response**: ${performance.avgResponse}ms`,
          `**Cache Hit Rate**: ${performance.cacheHitRate}%`,
        ].join("\n"),
        inline: false,
      });
    }
  } catch (_error) {
    // Fallback if storage systems are unavailable
    embed.addFields({
      name: "Storage Systems Unavailable",
      value:
        "Unable to retrieve storage information. Please check system logs.",
      inline: false,
    });

    // Basic system info as fallback
    embed.addFields({
      name: "Basic System Info",
      value: [
        `**Platform**: ${process.platform}`,
        `**Node Version**: ${process.version}`,
        `**Memory**: ${formatMemory(process.memoryUsage().heapUsed)}`,
        `**Uptime**: ${formatUptime(process.uptime())}`,
      ].join("\n"),
      inline: false,
    });
  }

  return embed;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getStorageStatistics(storageManager) {
  try {
    const roleMappings = await storageManager.getRoleMappings();
    const tempRoles = await storageManager.getTemporaryRoles();

    const mappingCount = Object.keys(roleMappings).length;
    const tempRoleCount = Object.values(tempRoles).reduce(
      (total, guildRoles) => {
        return (
          total +
          Object.values(guildRoles).reduce((guildTotal, userRoles) => {
            return guildTotal + Object.keys(userRoles).length;
          }, 0)
        );
      },
      0,
    );

    return {
      roleMappings: mappingCount,
      tempRoles: tempRoleCount,
    };
  } catch (_error) {
    return {
      roleMappings: 0,
      tempRoles: 0,
    };
  }
}

async function getDatabaseHealth(databaseManager) {
  try {
    const isHealthy = await databaseManager.healthCheck();
    return {
      status: isHealthy ? "✅ Connected" : "❌ Disconnected",
      details: isHealthy
        ? "Database connection is stable and responsive"
        : "Database connection failed",
    };
  } catch (_error) {
    return {
      status: "❌ Error",
      details: `Health check failed: ${_error.message}`,
    };
  }
}

function getStorageType(storageManager) {
  try {
    const providerName = storageManager.provider.constructor.name;
    return providerName === "DatabaseProvider" ? "Database" : "Local Files";
  } catch (_error) {
    return "Unknown";
  }
}

function getStorageRecommendations(storageType, dbHealth, stats) {
  const recommendations = [];

  if (storageType === "Local Files") {
    recommendations.push(
      "• Consider migrating to database storage for better scalability",
    );
    recommendations.push(
      "• Implement regular backup procedures for local files",
    );
  }

  if (dbHealth.status.includes("❌")) {
    recommendations.push(
      "• Investigate database connection issues immediately",
    );
    recommendations.push("• Check database server status and credentials");
  }

  if (stats.roleMappings > 1000) {
    recommendations.push(
      "• Large number of role mappings detected - consider cleanup",
    );
  }

  if (stats.tempRoles > 500) {
    recommendations.push(
      "• Many temporary roles active - monitor expiration system",
    );
  }

  return recommendations;
}

async function getStoragePerformance(_storageManager) {
  // This would typically come from a performance monitoring system
  // For now, return null to indicate no performance data available
  return null;
}

function formatMemory(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
