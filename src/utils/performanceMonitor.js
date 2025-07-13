class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      events: new Map(),
      commands: new Map(),
      database: {
        queries: 0,
        slowQueries: 0,
        errors: 0,
      },
      memory: {
        samples: [],
        maxSamples: 100,
      },
      uptime: 0,
    };

    this.startMonitoring();
  }

  // Record event performance
  recordEvent(eventType, duration) {
    const eventStats = this.metrics.events.get(eventType) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastSeen: 0,
    };

    eventStats.count++;
    eventStats.totalDuration += duration;
    eventStats.avgDuration = eventStats.totalDuration / eventStats.count;
    eventStats.minDuration = Math.min(eventStats.minDuration, duration);
    eventStats.maxDuration = Math.max(eventStats.maxDuration, duration);
    eventStats.lastSeen = Date.now();

    this.metrics.events.set(eventType, eventStats);
  }

  // Record command performance
  recordCommand(commandName, duration) {
    const commandStats = this.metrics.commands.get(commandName) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastSeen: 0,
    };

    commandStats.count++;
    commandStats.totalDuration += duration;
    commandStats.avgDuration = commandStats.totalDuration / commandStats.count;
    commandStats.minDuration = Math.min(commandStats.minDuration, duration);
    commandStats.maxDuration = Math.max(commandStats.maxDuration, duration);
    commandStats.lastSeen = Date.now();

    this.metrics.commands.set(commandName, commandStats);
  }

  // Record database operation
  recordDatabaseOperation(duration, isSlow = false, isError = false) {
    this.metrics.database.queries++;

    if (isSlow) {
      this.metrics.database.slowQueries++;
    }

    if (isError) {
      this.metrics.database.errors++;
    }
  }

  // Record memory usage
  recordMemoryUsage() {
    const usage = process.memoryUsage();
    const sample = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };

    this.metrics.memory.samples.push(sample);

    // Keep only the last N samples
    if (this.metrics.memory.samples.length > this.metrics.memory.maxSamples) {
      this.metrics.memory.samples.shift();
    }
  }

  // Get current memory usage
  getCurrentMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  // Get memory trend
  getMemoryTrend() {
    if (this.metrics.memory.samples.length < 2) {
      return { trend: "stable", change: "0%" };
    }

    const recent = this.metrics.memory.samples.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const change = (
      ((newest.heapUsed - oldest.heapUsed) / oldest.heapUsed) *
      100
    ).toFixed(2);

    return {
      trend: change > 5 ? "increasing" : change < -5 ? "decreasing" : "stable",
      change: `${change}%`,
    };
  }

  // Get performance summary
  getPerformanceSummary() {
    const uptime = Date.now() - this.metrics.startTime;
    const uptimeHours = (uptime / 1000 / 60 / 60).toFixed(2);

    const totalEvents = Array.from(this.metrics.events.values()).reduce(
      (sum, stats) => sum + stats.count,
      0,
    );
    const totalCommands = Array.from(this.metrics.commands.values()).reduce(
      (sum, stats) => sum + stats.count,
      0,
    );

    const avgEventDuration =
      totalEvents > 0
        ? Array.from(this.metrics.events.values()).reduce(
            (sum, stats) => sum + stats.totalDuration,
            0,
          ) / totalEvents
        : 0;

    const avgCommandDuration =
      totalCommands > 0
        ? Array.from(this.metrics.commands.values()).reduce(
            (sum, stats) => sum + stats.totalDuration,
            0,
          ) / totalCommands
        : 0;

    return {
      uptime: {
        total: `${uptimeHours} hours`,
        formatted: this.formatUptime(uptime),
      },
      events: {
        total: totalEvents,
        avgDuration: `${avgEventDuration.toFixed(2)}ms`,
      },
      commands: {
        total: totalCommands,
        avgDuration: `${avgCommandDuration.toFixed(2)}ms`,
      },
      database: {
        queries: this.metrics.database.queries,
        slowQueries: this.metrics.database.slowQueries,
        errors: this.metrics.database.errors,
        errorRate:
          this.metrics.database.queries > 0
            ? `${((this.metrics.database.errors / this.metrics.database.queries) * 100).toFixed(2)}%`
            : "0%",
      },
      memory: {
        current: this.getCurrentMemoryUsage(),
        trend: this.getMemoryTrend(),
      },
    };
  }

  // Format uptime
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Get slow operations
  getSlowOperations(threshold = 1000) {
    const slowEvents = [];
    const slowCommands = [];

    for (const [eventType, stats] of this.metrics.events) {
      if (stats.avgDuration > threshold) {
        slowEvents.push({
          event: eventType,
          avgDuration: `${stats.avgDuration.toFixed(2)}ms`,
          count: stats.count,
        });
      }
    }

    for (const [commandName, stats] of this.metrics.commands) {
      if (stats.avgDuration > threshold) {
        slowCommands.push({
          command: commandName,
          avgDuration: `${stats.avgDuration.toFixed(2)}ms`,
          count: stats.count,
        });
      }
    }

    return { slowEvents, slowCommands };
  }

  // Start monitoring
  startMonitoring() {
    // Record memory usage every 30 seconds
    setInterval(() => {
      this.recordMemoryUsage();
    }, 30000).unref();

    // Log performance summary every 5 minutes
    setInterval(
      () => {
        const summary = this.getPerformanceSummary();
        console.log("📊 Performance Summary:", {
          uptime: summary.uptime.formatted,
          events: summary.events.total,
          commands: summary.commands.total,
          memory: summary.memory.current.heapUsed,
          dbQueries: summary.database.queries,
        });
      },
      5 * 60 * 1000,
    ).unref();
  }

  // Get detailed metrics
  getDetailedMetrics() {
    return {
      events: Object.fromEntries(this.metrics.events),
      commands: Object.fromEntries(this.metrics.commands),
      database: this.metrics.database,
      memory: {
        samples: this.metrics.memory.samples.length,
        current: this.getCurrentMemoryUsage(),
        trend: this.getMemoryTrend(),
      },
      uptime: this.formatUptime(Date.now() - this.metrics.startTime),
    };
  }
}

// Singleton instance
let performanceMonitor = null;

export function getPerformanceMonitor() {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}

export { PerformanceMonitor };
