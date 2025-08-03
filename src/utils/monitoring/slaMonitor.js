import { getLogger } from "../logger.js";

/**
 * SLA Monitor for tracking service availability
 * Implements 99.5% uptime target as specified in Terms of Use
 */
class SLAMonitor {
  constructor() {
    this.logger = getLogger();
    this.startTime = Date.now();
    this.downtimeEvents = [];
    this.isOnline = true;
    this.targetUptime = 99.5; // 99.5% as specified in Terms of Use
    this.maintenanceWindows = [];
    this.emergencyMaintenance = [];

    // Track uptime continuously
    this.startUptimeTracking();
  }

  /**
   * Start uptime tracking
   */
  startUptimeTracking() {
    // Check status every minute
    setInterval(() => {
      this.checkSystemStatus();
    }, 60000).unref();

    // Log uptime statistics every hour
    setInterval(
      () => {
        this.logUptimeStats();
      },
      60 * 60 * 1000,
    ).unref();
  }

  /**
   * Check system status and update uptime
   */
  async checkSystemStatus() {
    try {
      // Check database connectivity
      const { getDatabaseManager } = await import(
        "../storage/databaseManager.js"
      );
      const dbManager = await getDatabaseManager();
      const dbHealthy = await dbManager.healthCheck();

      // Check Discord API connectivity
      const { checkDiscordAPI } = await import("./checkers/discordApi.js");
      const discordHealthy = await checkDiscordAPI();

      const currentStatus = dbHealthy && discordHealthy.status === "healthy";

      if (this.isOnline && !currentStatus) {
        // Service went down
        this.recordDowntime();
      } else if (!this.isOnline && currentStatus) {
        // Service came back up
        this.recordUptime();
      }

      this.isOnline = currentStatus;
    } catch (error) {
      this.logger.error("SLA monitoring error", error);
      if (this.isOnline) {
        this.recordDowntime();
        this.isOnline = false;
      }
    }
  }

  /**
   * Record downtime event
   */
  recordDowntime() {
    const downtimeEvent = {
      startTime: Date.now(),
      type: "unplanned",
      reason: "System failure",
    };

    this.downtimeEvents.push(downtimeEvent);

    this.logger.warn("Service downtime detected", {
      timestamp: new Date().toISOString(),
      totalDowntimeEvents: this.downtimeEvents.length,
    });
  }

  /**
   * Record uptime restoration
   */
  recordUptime() {
    if (this.downtimeEvents.length > 0) {
      const lastDowntime = this.downtimeEvents[this.downtimeEvents.length - 1];
      lastDowntime.endTime = Date.now();
      lastDowntime.duration = lastDowntime.endTime - lastDowntime.startTime;

      this.logger.info("Service restored", {
        downtimeDuration: lastDowntime.duration,
        totalDowntimeEvents: this.downtimeEvents.length,
      });
    }
  }

  /**
   * Schedule maintenance window
   * @param {Date} startTime - Maintenance start time
   * @param {Date} endTime - Maintenance end time
   * @param {string} reason - Maintenance reason
   */
  scheduleMaintenance(startTime, endTime, reason) {
    const maintenance = {
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      reason,
      type: "scheduled",
    };

    this.maintenanceWindows.push(maintenance);

    this.logger.info("Maintenance scheduled", {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      reason,
      totalMaintenanceWindows: this.maintenanceWindows.length,
    });
  }

  /**
   * Record emergency maintenance
   * @param {string} reason - Emergency maintenance reason
   */
  recordEmergencyMaintenance(reason) {
    const emergency = {
      startTime: Date.now(),
      reason,
      type: "emergency",
    };

    this.emergencyMaintenance.push(emergency);

    this.logger.warn("Emergency maintenance started", {
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate current uptime percentage
   * @returns {number} Uptime percentage
   */
  calculateUptime() {
    const totalTime = Date.now() - this.startTime;
    let totalDowntime = 0;

    // Calculate downtime from events
    for (const event of this.downtimeEvents) {
      const endTime = event.endTime || Date.now();
      totalDowntime += endTime - event.startTime;
    }

    // Subtract maintenance windows
    for (const maintenance of this.maintenanceWindows) {
      const endTime = maintenance.endTime || Date.now();
      if (endTime > maintenance.startTime) {
        totalDowntime -= Math.min(endTime - maintenance.startTime, totalTime);
      }
    }

    const uptime = Math.max(0, totalTime - totalDowntime);
    return (uptime / totalTime) * 100;
  }

  /**
   * Check if SLA target is being met
   * @returns {boolean} True if uptime meets target
   */
  isSLATargetMet() {
    const currentUptime = this.calculateUptime();
    return currentUptime >= this.targetUptime;
  }

  /**
   * Get SLA statistics
   * @returns {Object} SLA statistics
   */
  getSLAStats() {
    const currentUptime = this.calculateUptime();
    const totalTime = Date.now() - this.startTime;

    return {
      currentUptime: currentUptime.toFixed(2),
      targetUptime: this.targetUptime,
      slaMet: this.isSLATargetMet(),
      totalUptime: this.formatDuration(totalTime),
      downtimeEvents: this.downtimeEvents.length,
      maintenanceWindows: this.maintenanceWindows.length,
      emergencyMaintenance: this.emergencyMaintenance.length,
      startTime: new Date(this.startTime).toISOString(),
    };
  }

  /**
   * Log uptime statistics
   */
  logUptimeStats() {
    const stats = this.getSLAStats();

    this.logger.info("SLA Statistics", {
      uptime: `${stats.currentUptime}%`,
      target: `${stats.targetUptime}%`,
      slaMet: stats.slaMet,
      downtimeEvents: stats.downtimeEvents,
      maintenanceWindows: stats.maintenanceWindows,
    });

    if (!stats.slaMet) {
      this.logger.warn("SLA target not being met", {
        currentUptime: stats.currentUptime,
        targetUptime: stats.targetUptime,
        shortfall: (
          stats.targetUptime - parseFloat(stats.currentUptime)
        ).toFixed(2),
      });
    }
  }

  /**
   * Format duration in human-readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Get maintenance schedule
   * @returns {Array} Upcoming maintenance windows
   */
  getMaintenanceSchedule() {
    const now = Date.now();
    return this.maintenanceWindows.filter(
      maintenance => maintenance.startTime > now,
    );
  }

  /**
   * Check if currently in maintenance
   * @returns {boolean} True if in maintenance
   */
  isInMaintenance() {
    const now = Date.now();

    // Check scheduled maintenance
    for (const maintenance of this.maintenanceWindows) {
      if (now >= maintenance.startTime && now <= maintenance.endTime) {
        return true;
      }
    }

    // Check emergency maintenance
    for (const emergency of this.emergencyMaintenance) {
      if (!emergency.endTime) {
        return true;
      }
    }

    return false;
  }
}

let slaMonitor = null;

/**
 * Get the SLA monitor instance
 * @returns {SLAMonitor} SLA monitor instance
 */
export function getSLAMonitor() {
  if (!slaMonitor) {
    slaMonitor = new SLAMonitor();
  }
  return slaMonitor;
}

/**
 * Initialize SLA monitoring
 */
export function initializeSLAMonitoring() {
  const monitor = getSLAMonitor();
  monitor.logger.info("SLA monitoring initialized", {
    targetUptime: monitor.targetUptime,
    startTime: new Date(monitor.startTime).toISOString(),
  });
}
