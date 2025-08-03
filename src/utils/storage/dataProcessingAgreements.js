import { getLogger } from "../logger.js";

/**
 * Data Processing Agreements Manager
 * Implements formal data processing agreements as required by Privacy Policy
 */
class DataProcessingAgreements {
  constructor() {
    this.logger = getLogger();

    // Third-party processors and their agreements
    this.processors = {
      mongodb: {
        name: "MongoDB Atlas",
        purpose: "Database hosting and data storage",
        dataTypes: ["role_mappings", "temporary_roles", "user_preferences"],
        location: "Global (AWS, Google Cloud, Azure)",
        agreement: {
          type: "DPA",
          version: "2024.1",
          lastUpdated: "2024-01-01",
          status: "active",
        },
        safeguards: [
          "Encryption at rest and in transit",
          "Access controls and authentication",
          "Regular security audits",
          "Data residency options",
        ],
      },
      discord: {
        name: "Discord API",
        purpose: "Essential service integration",
        dataTypes: ["user_ids", "guild_ids", "role_ids", "message_ids"],
        location: "Global",
        agreement: {
          type: "Terms of Service",
          version: "Current",
          lastUpdated: "2024-01-01",
          status: "active",
        },
        safeguards: [
          "Discord's own security measures",
          "API rate limiting",
          "OAuth2 authentication",
          "Data minimization",
        ],
      },
      github: {
        name: "GitHub",
        purpose: "Issue tracking and support",
        dataTypes: ["anonymized_logs", "error_reports"],
        location: "Global",
        agreement: {
          type: "Terms of Service",
          version: "Current",
          lastUpdated: "2024-01-01",
          status: "active",
        },
        safeguards: [
          "Data anonymization before submission",
          "Limited data sharing",
          "Secure issue tracking",
          "Access controls",
        ],
      },
    };

    // Sub-processors
    this.subProcessors = {
      aws: {
        name: "Amazon Web Services",
        parent: "mongodb",
        purpose: "Cloud infrastructure for MongoDB Atlas",
        dataTypes: ["all_data_types"],
        location: "Global",
        agreement: {
          type: "MongoDB Atlas DPA",
          version: "2024.1",
          status: "active",
        },
      },
      google: {
        name: "Google Cloud Platform",
        parent: "mongodb",
        purpose: "Cloud infrastructure for MongoDB Atlas",
        dataTypes: ["all_data_types"],
        location: "Global",
        agreement: {
          type: "MongoDB Atlas DPA",
          version: "2024.1",
          status: "active",
        },
      },
    };
  }

  /**
   * Get all data processing agreements
   * @returns {Object} All processors and their agreements
   */
  getAllAgreements() {
    return {
      processors: this.processors,
      subProcessors: this.subProcessors,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get agreement for a specific processor
   * @param {string} processorId - Processor identifier
   * @returns {Object|null} Processor agreement or null
   */
  getProcessorAgreement(processorId) {
    return this.processors[processorId] || null;
  }

  /**
   * Check if a processor has valid agreement
   * @param {string} processorId - Processor identifier
   * @returns {boolean} True if agreement is valid
   */
  hasValidAgreement(processorId) {
    const processor = this.processors[processorId];
    if (!processor) return false;

    return processor.agreement.status === "active";
  }

  /**
   * Get data types processed by a processor
   * @param {string} processorId - Processor identifier
   * @returns {Array} Array of data types
   */
  getProcessorDataTypes(processorId) {
    const processor = this.processors[processorId];
    return processor ? processor.dataTypes : [];
  }

  /**
   * Check if data type is allowed for processor
   * @param {string} processorId - Processor identifier
   * @param {string} dataType - Data type to check
   * @returns {boolean} True if allowed
   */
  isDataTypeAllowed(processorId, dataType) {
    const dataTypes = this.getProcessorDataTypes(processorId);
    return dataTypes.includes(dataType) || dataTypes.includes("all_data_types");
  }

  /**
   * Get processor safeguards
   * @param {string} processorId - Processor identifier
   * @returns {Array} Array of safeguards
   */
  getProcessorSafeguards(processorId) {
    const processor = this.processors[processorId];
    return processor ? processor.safeguards : [];
  }

  /**
   * Validate data processing for compliance
   * @param {string} processorId - Processor identifier
   * @param {string} dataType - Type of data being processed
   * @param {string} purpose - Purpose of processing
   * @returns {Object} Validation result
   */
  validateProcessing(processorId, dataType, purpose) {
    const result = {
      processorId,
      dataType,
      purpose,
      allowed: false,
      validAgreement: false,
      allowedDataType: false,
      appropriatePurpose: false,
      safeguards: [],
      reason: null,
    };

    // Check if processor exists and has valid agreement
    const processor = this.processors[processorId];
    if (!processor) {
      result.reason = "Processor not found";
      return result;
    }

    result.validAgreement = this.hasValidAgreement(processorId);
    if (!result.validAgreement) {
      result.reason = "No valid agreement with processor";
      return result;
    }

    // Check if data type is allowed
    result.allowedDataType = this.isDataTypeAllowed(processorId, dataType);
    if (!result.allowedDataType) {
      result.reason = "Data type not allowed for this processor";
      return result;
    }

    // Check if purpose is appropriate
    result.appropriatePurpose = this.isPurposeAppropriate(processorId, purpose);
    if (!result.appropriatePurpose) {
      result.reason = "Purpose not appropriate for this processor";
      return result;
    }

    // Get safeguards
    result.safeguards = this.getProcessorSafeguards(processorId);

    // All checks passed
    result.allowed = true;
    result.reason = "Processing allowed";

    this.logger.info("Data processing validation", {
      processorId,
      dataType,
      purpose,
      allowed: result.allowed,
      safeguards: result.safeguards.length,
    });

    return result;
  }

  /**
   * Check if purpose is appropriate for processor
   * @param {string} processorId - Processor identifier
   * @param {string} purpose - Purpose of processing
   * @returns {boolean} True if appropriate
   */
  isPurposeAppropriate(processorId, purpose) {
    const processor = this.processors[processorId];
    if (!processor) return false;

    const allowedPurposes = [
      "service_provision",
      "data_storage",
      "error_resolution",
      "support_services",
    ];

    return allowedPurposes.includes(purpose);
  }

  /**
   * Get sub-processors for a main processor
   * @param {string} processorId - Main processor identifier
   * @returns {Array} Array of sub-processors
   */
  getSubProcessors(processorId) {
    const subProcessors = [];

    for (const [id, subProcessor] of Object.entries(this.subProcessors)) {
      if (subProcessor.parent === processorId) {
        subProcessors.push({
          id,
          ...subProcessor,
        });
      }
    }

    return subProcessors;
  }

  /**
   * Log data processing activity
   * @param {string} processorId - Processor identifier
   * @param {string} dataType - Type of data processed
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   */
  logProcessingActivity(processorId, dataType, action, details = {}) {
    this.logger.info("Data processing activity", {
      processorId,
      dataType,
      action,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  /**
   * Get compliance report
   * @returns {Object} Compliance report
   */
  getComplianceReport() {
    const report = {
      totalProcessors: Object.keys(this.processors).length,
      totalSubProcessors: Object.keys(this.subProcessors).length,
      activeAgreements: 0,
      inactiveAgreements: 0,
      processors: {},
    };

    for (const [id, processor] of Object.entries(this.processors)) {
      const isActive = this.hasValidAgreement(id);
      report.processors[id] = {
        name: processor.name,
        active: isActive,
        dataTypes: processor.dataTypes.length,
        safeguards: processor.safeguards.length,
      };

      if (isActive) {
        report.activeAgreements++;
      } else {
        report.inactiveAgreements++;
      }
    }

    return report;
  }

  /**
   * Update processor agreement
   * @param {string} processorId - Processor identifier
   * @param {Object} agreement - New agreement details
   */
  updateProcessorAgreement(processorId, agreement) {
    if (this.processors[processorId]) {
      this.processors[processorId].agreement = {
        ...this.processors[processorId].agreement,
        ...agreement,
        lastUpdated: new Date().toISOString(),
      };

      this.logger.info("Processor agreement updated", {
        processorId,
        agreement: agreement.type,
        version: agreement.version,
        status: agreement.status,
      });
    }
  }

  /**
   * Add new processor
   * @param {string} processorId - Processor identifier
   * @param {Object} processor - Processor details
   */
  addProcessor(processorId, processor) {
    this.processors[processorId] = {
      ...processor,
      agreement: {
        type: "DPA",
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        status: "active",
      },
    };

    this.logger.info("New processor added", {
      processorId,
      name: processor.name,
      purpose: processor.purpose,
    });
  }

  /**
   * Remove processor
   * @param {string} processorId - Processor identifier
   */
  removeProcessor(processorId) {
    if (this.processors[processorId]) {
      delete this.processors[processorId];

      this.logger.info("Processor removed", {
        processorId,
      });
    }
  }
}

let dataProcessingAgreements = null;

/**
 * Get the data processing agreements instance
 * @returns {DataProcessingAgreements} Data processing agreements instance
 */
export function getDataProcessingAgreements() {
  if (!dataProcessingAgreements) {
    dataProcessingAgreements = new DataProcessingAgreements();
  }
  return dataProcessingAgreements;
}

/**
 * Validate data processing for compliance
 * @param {string} processorId - Processor identifier
 * @param {string} dataType - Type of data being processed
 * @param {string} purpose - Purpose of processing
 * @returns {Object} Validation result
 */
export function validateDataProcessing(processorId, dataType, purpose) {
  const agreements = getDataProcessingAgreements();
  return agreements.validateProcessing(processorId, dataType, purpose);
}

/**
 * Get all data processing agreements
 * @returns {Object} All agreements
 */
export function getAllDataProcessingAgreements() {
  const agreements = getDataProcessingAgreements();
  return agreements.getAllAgreements();
}

/**
 * Log data processing activity
 * @param {string} processorId - Processor identifier
 * @param {string} dataType - Type of data processed
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
export function logDataProcessingActivity(
  processorId,
  dataType,
  action,
  details,
) {
  const agreements = getDataProcessingAgreements();
  agreements.logProcessingActivity(processorId, dataType, action, details);
}
