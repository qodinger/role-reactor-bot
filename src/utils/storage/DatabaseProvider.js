export class DatabaseProvider {
  constructor(dbManager, logger) {
    this.dbManager = dbManager;
    this.logger = logger;
  }

  async getRoleMappings() {
    return this.dbManager.roleMappings.getAll();
  }

  async getRoleMappingsPaginated(guildId, page = 1, limit = 4) {
    return this.dbManager.roleMappings.getByGuildPaginated(
      guildId,
      page,
      limit,
    );
  }

  async setRoleMapping(messageId, guildId, channelId, roles) {
    await this.dbManager.roleMappings.set(messageId, guildId, channelId, roles);
    return true;
  }

  async deleteRoleMapping(messageId) {
    await this.dbManager.roleMappings.delete(messageId);
    return true;
  }

  async cleanupExpiredRoles() {
    await this.dbManager.temporaryRoles.cleanupExpired();
  }

  async getTemporaryRoles() {
    return this.dbManager.temporaryRoles.getAll();
  }

  async addTemporaryRole(
    guildId,
    userId,
    roleId,
    expiresAt,
    notifyExpiry = false,
  ) {
    await this.dbManager.temporaryRoles.add(
      guildId,
      userId,
      roleId,
      expiresAt,
      notifyExpiry,
    );
    return true;
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    await this.dbManager.temporaryRoles.delete(guildId, userId, roleId);
    return true;
  }

  async getUserExperience(guildId, userId) {
    return this.dbManager.userExperience.getByUser(guildId, userId);
  }

  async setUserExperience(guildId, userId, userData) {
    await this.dbManager.userExperience.set(guildId, userId, userData);
    return true;
  }

  async getAllUserExperience() {
    return this.dbManager.userExperience.getAll();
  }

  async getUserExperienceByGuild(guildId) {
    return this.dbManager.userExperience.getByGuild(guildId);
  }

  async getUserExperienceLeaderboard(guildId, limit) {
    return this.dbManager.userExperience.getLeaderboard(guildId, limit);
  }

  async getUserRank(guildId, userId) {
    return this.dbManager.userExperience.getUserRank(guildId, userId);
  }

  // Supporter management methods
  async getSupporters() {
    try {
      return this.dbManager.guildSettings.getSupporters() || {};
    } catch (error) {
      this.logger.error("Failed to get supporters from database", error);
      return {};
    }
  }

  async setSupporters(supporters) {
    try {
      await this.dbManager.guildSettings.setSupporters(supporters);
      return true;
    } catch (error) {
      this.logger.error("Failed to set supporters in database", error);
      return false;
    }
  }

  // Poll management methods
  async getAllPolls() {
    return this.dbManager.polls.getAll();
  }

  async getPollById(pollId) {
    return this.dbManager.polls.getById(pollId);
  }

  async getPollsByGuild(guildId) {
    return this.dbManager.polls.getByGuild(guildId);
  }

  async getPollByMessageId(messageId) {
    return this.dbManager.polls.getByMessageId(messageId);
  }

  async createPoll(pollData) {
    return this.dbManager.polls.create(pollData);
  }

  async updatePoll(pollId, pollData) {
    return this.dbManager.polls.update(pollId, pollData);
  }

  async deletePoll(pollId) {
    return this.dbManager.polls.delete(pollId);
  }

  async cleanupEndedPolls() {
    return this.dbManager.polls.cleanupEndedPolls();
  }

  // Core Credits methods
  async getAllCoreCredits() {
    return this.dbManager.coreCredits.getAll();
  }

  async getCoreCredits(userId) {
    return this.dbManager.coreCredits.getByUserId(userId);
  }

  async setCoreCredits(userId, userData) {
    return this.dbManager.coreCredits.setByUserId(userId, userData);
  }

  async updateCoreCredits(userId, creditsChange) {
    return this.dbManager.coreCredits.updateCredits(userId, creditsChange);
  }

  async deleteCoreCredits(userId) {
    return this.dbManager.coreCredits.deleteByUserId(userId);
  }

  // Voice Control Roles methods
  async getVoiceControlRoles(guildId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.getByGuild(guildId);
    }
    return {
      guildId,
      disconnectRoleIds: [],
      muteRoleIds: [],
      deafenRoleIds: [],
      moveRoleMappings: {},
    };
  }

  async addVoiceDisconnectRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addDisconnectRole(
        guildId,
        roleId,
      );
    }
    return false;
  }

  async removeVoiceDisconnectRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeDisconnectRole(
        guildId,
        roleId,
      );
    }
    return false;
  }

  async addVoiceMuteRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addMuteRole(guildId, roleId);
    }
    return false;
  }

  async removeVoiceMuteRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeMuteRole(guildId, roleId);
    }
    return false;
  }

  async addVoiceDeafenRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addDeafenRole(guildId, roleId);
    }
    return false;
  }

  async removeVoiceDeafenRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeDeafenRole(guildId, roleId);
    }
    return false;
  }

  async addVoiceMoveRole(guildId, roleId, channelId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addMoveRole(
        guildId,
        roleId,
        channelId,
      );
    }
    return false;
  }

  async removeVoiceMoveRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeMoveRole(guildId, roleId);
    }
    return false;
  }

  // Guild Analytics methods
  async updateGuildAnalytics(guildId, date, type, amount) {
    if (this.dbManager?.guildAnalytics) {
      await this.dbManager.guildAnalytics.updateCounter(
        guildId,
        date,
        type,
        amount,
      );
      return true;
    }
    return false;
  }

  async getGuildAnalyticsHistory(guildId, startDate, endDate) {
    if (this.dbManager?.guildAnalytics) {
      return await this.dbManager.guildAnalytics.getHistory(
        guildId,
        startDate,
        endDate,
      );
    }
    return [];
  }

  async cleanupOldAnalytics(cutoffDate) {
    if (this.dbManager?.guildAnalytics) {
      return await this.dbManager.guildAnalytics.deleteOlderThan(cutoffDate);
    }
    return 0;
  }

  // Moderation methods
  async logModerationAction(actionData) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.create(actionData);
    }
    return false;
  }

  async getModerationHistory(guildId, userId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.getByUser(guildId, userId);
    }
    return [];
  }

  async getAllModerationHistory(guildId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.getByGuild(guildId);
    }
    return [];
  }

  async getWarnCount(guildId, userId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.getWarnCount(guildId, userId);
    }
    return 0;
  }

  async removeWarning(guildId, userId, caseId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.deleteWarning(
        guildId,
        userId,
        caseId,
      );
    }
    return false;
  }
}
