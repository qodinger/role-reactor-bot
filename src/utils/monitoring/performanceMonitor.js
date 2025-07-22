import { getLogger } from "../logger.js";

class Metric {
  constructor() {
    this.count = 0;
    this.totalDuration = 0;
    this.minDuration = Infinity;
    this.maxDuration = 0;
  }

  record(duration) {
    this.count++;
    this.totalDuration += duration;
    this.minDuration = Math.min(this.minDuration, duration);
    this.maxDuration = Math.max(this.maxDuration, duration);
  }

  get averageDuration() {
    return this.count > 0 ? this.totalDuration / this.count : 0;
  }
}

class MetricManager {
  constructor() {
    this.metrics = new Map();
  }

  get(name) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, new Metric());
    }
    return this.metrics.get(name);
  }

  record(name, duration) {
    this.get(name).record(duration);
  }
}

class PerformanceMonitor {
  constructor() {
    this.logger = getLogger();
    this.startTime = Date.now();
    this.events = new MetricManager();
    this.commands = new MetricManager();
    this.database = {
      queries: 0,
      slowQueries: 0,
      errors: 0,
    };
    this.memorySamples = [];
    this.maxMemorySamples = 100;

    this.startMonitoring();
  }

  recordEvent(eventType, duration) {
    this.events.record(eventType, duration);
  }

  recordCommand(commandName, duration) {
    this.commands.record(commandName, duration);
  }

  recordDatabaseOperation(duration, isSlow = false, isError = false) {
    this.database.queries++;
    if (isSlow) this.database.slowQueries++;
    if (isError) this.database.errors++;
  }

  recordMemoryUsage() {
    const sample = {
      timestamp: Date.now(),
      heapUsed: process.memoryUsage().heapUsed,
    };
    this.memorySamples.push(sample);
    if (this.memorySamples.length > this.maxMemorySamples) {
      this.memorySamples.shift();
    }
  }

  getPerformanceSummary() {
    const uptime = Date.now() - this.startTime;
    const totalEvents = Array.from(this.events.metrics.values()).reduce(
      (sum, stats) => sum + stats.count,
      0,
    );
    const totalCommands = Array.from(this.commands.metrics.values()).reduce(
      (sum, stats) => sum + stats.count,
      0,
    );
    const avgEventDuration =
      totalEvents > 0
        ? Array.from(this.events.metrics.values()).reduce(
            (sum, stats) => sum + stats.totalDuration,
            0,
          ) / totalEvents
        : 0;
    const avgCommandDuration =
      totalCommands > 0
        ? Array.from(this.commands.metrics.values()).reduce(
            (sum, stats) => sum + stats.totalDuration,
            0,
          ) / totalCommands
        : 0;

    return {
      uptime: this.formatUptime(uptime),
      events: {
        total: totalEvents,
        avgDuration: `${avgEventDuration.toFixed(2)}ms`,
      },
      commands: {
        total: totalCommands,
        avgDuration: `${avgCommandDuration.toFixed(2)}ms`,
      },
      database: {
        queries: this.database.queries,
        slowQueries: this.database.slowQueries,
        errors: this.database.errors,
        errorRate:
          this.database.queries > 0
            ? `${((this.database.errors / this.database.queries) * 100).toFixed(
                2,
              )}%`
            : "0%",
      },
    };
  }

  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  startMonitoring() {
    setInterval(() => this.recordMemoryUsage(), 30000).unref();
    setInterval(
      () => {
        const summary = this.getPerformanceSummary();
        this.logger.info("Performance Snapshot", {
          uptime: summary.uptime,
          events: summary.events.total,
          commands: summary.commands.total,
          memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
            2,
          )} MB`,
          dbQueries: summary.database.queries,
        });
      },
      5 * 60 * 1000,
    ).unref();
  }
}

let performanceMonitor = null;

export function getPerformanceMonitor() {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}
