import { getLogger } from "../logger.js";

/**
 * Export Controls for geographic restrictions and compliance
 * Implements export control compliance as specified in Terms of Use
 */
class ExportControls {
  constructor() {
    this.logger = getLogger();

    // Embargoed countries (example list - should be updated based on current regulations)
    this.embargoedCountries = [
      "CU", // Cuba
      "IR", // Iran
      "KP", // North Korea
      "SY", // Syria
      "VE", // Venezuela
    ];

    // Restricted regions for data processing
    this.restrictedRegions = [
      "RU", // Russia
      "BY", // Belarus
      "CN", // China (for certain data types)
    ];

    // High-risk jurisdictions
    this.highRiskJurisdictions = [
      "AF", // Afghanistan
      "SO", // Somalia
      "YE", // Yemen
    ];
  }

  /**
   * Check if a user is from a restricted location
   * @param {string} userId - Discord user ID
   * @param {Object} userData - User data from Discord
   * @returns {Object} Export control check result
   */
  async checkUserLocation(userId, userData = null) {
    try {
      // In a real implementation, you would check user's location
      // For now, we'll use a simplified approach based on available data
      const location = this.extractLocationFromUserData(userData);

      const result = {
        userId,
        location,
        isRestricted: false,
        isEmbargoed: false,
        isHighRisk: false,
        allowed: true,
        reason: null,
      };

      if (location) {
        result.isEmbargoed = this.embargoedCountries.includes(location);
        result.isHighRisk = this.highRiskJurisdictions.includes(location);
        result.isRestricted = this.restrictedRegions.includes(location);

        if (result.isEmbargoed) {
          result.allowed = false;
          result.reason = "User located in embargoed country";
        } else if (result.isHighRisk) {
          result.allowed = true; // Allow but monitor
          result.reason = "User located in high-risk jurisdiction";
        } else if (result.isRestricted) {
          result.allowed = true; // Allow but with restrictions
          result.reason = "User located in restricted region";
        }
      }

      this.logger.debug("Export control check", {
        userId,
        location: result.location,
        allowed: result.allowed,
        reason: result.reason,
      });

      return result;
    } catch (error) {
      this.logger.error("Export control check failed", error);
      return {
        userId,
        location: null,
        isRestricted: false,
        isEmbargoed: false,
        isHighRisk: false,
        allowed: true, // Default to allowed if check fails
        reason: "Check failed, defaulting to allowed",
      };
    }
  }

  /**
   * Extract location from user data
   * @param {Object} userData - User data from Discord
   * @returns {string|null} Country code or null
   */
  extractLocationFromUserData(userData) {
    // In a real implementation, you would extract location from:
    // - User's timezone
    // - IP address (if available)
    // - User's self-reported location
    // - Discord's location data (if available)

    if (!userData) {
      return null;
    }

    // This is a placeholder - real implementation would use actual location data
    return null;
  }

  /**
   * Check if data export is allowed for a user
   * @param {string} userId - Discord user ID
   * @param {string} dataType - Type of data being exported
   * @returns {Object} Export permission result
   */
  async checkDataExportPermission(userId, dataType = "general") {
    const locationCheck = await this.checkUserLocation(userId);

    const result = {
      userId,
      dataType,
      allowed: locationCheck.allowed,
      restrictions: [],
      reason: locationCheck.reason,
    };

    // Add data-specific restrictions
    if (dataType === "sensitive" && locationCheck.isRestricted) {
      result.allowed = false;
      result.restrictions.push(
        "Sensitive data export not allowed in restricted regions",
      );
      result.reason = "Sensitive data export restricted";
    }

    if (dataType === "bulk" && locationCheck.isHighRisk) {
      result.restrictions.push(
        "Bulk data export requires additional verification",
      );
      result.reason =
        "Bulk export requires verification in high-risk jurisdiction";
    }

    this.logger.info("Data export permission check", {
      userId,
      dataType,
      allowed: result.allowed,
      restrictions: result.restrictions.length,
      reason: result.reason,
    });

    return result;
  }

  /**
   * Validate data processing location
   * @param {string} processingLocation - Location where data is processed
   * @returns {Object} Processing location validation result
   */
  validateProcessingLocation(processingLocation) {
    const result = {
      location: processingLocation,
      allowed: true,
      restrictions: [],
      reason: null,
    };

    if (this.embargoedCountries.includes(processingLocation)) {
      result.allowed = false;
      result.reason = "Data processing not allowed in embargoed countries";
    } else if (this.restrictedRegions.includes(processingLocation)) {
      result.allowed = true;
      result.restrictions.push(
        "Additional safeguards required for restricted regions",
      );
      result.reason = "Processing in restricted region requires safeguards";
    }

    return result;
  }

  /**
   * Check if suspicious activity should be reported
   * @param {string} userId - Discord user ID
   * @param {string} activityType - Type of suspicious activity
   * @param {Object} activityData - Activity data
   * @returns {Object} Reporting decision
   */
  checkSuspiciousActivity(userId, activityType, activityData) {
    const result = {
      userId,
      activityType,
      shouldReport: false,
      reportLevel: "none",
      reason: null,
    };

    // Check for activities that require reporting
    if (activityType === "data_export" && activityData.volume > 1000) {
      result.shouldReport = true;
      result.reportLevel = "medium";
      result.reason = "Large volume data export";
    }

    if (activityType === "repeated_failures" && activityData.count > 10) {
      result.shouldReport = true;
      result.reportLevel = "high";
      result.reason = "Repeated access failures";
    }

    if (activityType === "unauthorized_access") {
      result.shouldReport = true;
      result.reportLevel = "critical";
      result.reason = "Unauthorized access attempt";
    }

    if (result.shouldReport) {
      this.logger.warn("Suspicious activity detected", {
        userId,
        activityType,
        reportLevel: result.reportLevel,
        reason: result.reason,
      });
    }

    return result;
  }

  /**
   * Get export control statistics
   * @returns {Object} Export control statistics
   */
  getExportControlStats() {
    return {
      embargoedCountries: this.embargoedCountries.length,
      restrictedRegions: this.restrictedRegions.length,
      highRiskJurisdictions: this.highRiskJurisdictions.length,
      totalRestrictedLocations:
        this.embargoedCountries.length +
        this.restrictedRegions.length +
        this.highRiskJurisdictions.length,
    };
  }

  /**
   * Update embargoed countries list
   * @param {Array} countries - New list of embargoed countries
   */
  updateEmbargoedCountries(countries) {
    this.embargoedCountries = countries;
    this.logger.info("Embargoed countries list updated", {
      count: countries.length,
      countries,
    });
  }

  /**
   * Update restricted regions list
   * @param {Array} regions - New list of restricted regions
   */
  updateRestrictedRegions(regions) {
    this.restrictedRegions = regions;
    this.logger.info("Restricted regions list updated", {
      count: regions.length,
      regions,
    });
  }

  /**
   * Log export control compliance
   * @param {string} action - Action being performed
   * @param {Object} details - Action details
   */
  logCompliance(action, details) {
    this.logger.info("Export control compliance", {
      action,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}

let exportControls = null;

/**
 * Get the export controls instance
 * @returns {ExportControls} Export controls instance
 */
export function getExportControls() {
  if (!exportControls) {
    exportControls = new ExportControls();
  }
  return exportControls;
}

/**
 * Check if user is allowed based on export controls
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>} Export control check result
 */
export async function checkUserExportCompliance(userId) {
  const controls = getExportControls();
  return await controls.checkUserLocation(userId);
}

/**
 * Check if data export is allowed
 * @param {string} userId - Discord user ID
 * @param {string} dataType - Type of data being exported
 * @returns {Promise<Object>} Export permission result
 */
export async function checkDataExportAllowed(userId, dataType) {
  const controls = getExportControls();
  return await controls.checkDataExportPermission(userId, dataType);
}

/**
 * Report suspicious activity
 * @param {string} userId - Discord user ID
 * @param {string} activityType - Type of activity
 * @param {Object} activityData - Activity data
 * @returns {Object} Reporting decision
 */
export function reportSuspiciousActivity(userId, activityType, activityData) {
  const controls = getExportControls();
  return controls.checkSuspiciousActivity(userId, activityType, activityData);
}
