import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

export class FileProvider {
  constructor(logger, storagePath = "./data") {
    this.logger = logger;
    this.storagePath = storagePath;
    this._ensureDataDirectory();
  }

  _ensureDataDirectory() {
    if (!fsSync.existsSync(this.storagePath)) {
      fsSync.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  _getFilePath(collection) {
    return path.join(this.storagePath, `${collection}.json`);
  }

  async read(collection) {
    try {
      const filePath = this._getFilePath(collection);
      try {
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data);
      } catch (readError) {
        if (readError.code === "ENOENT") {
          return {};
        }

        if (readError instanceof SyntaxError) {
          this.logger.warn(
            `⚠️ Corrupted JSON file detected for ${collection}, attempting recovery...`,
          );

          try {
            const backupPath = `${filePath}.corrupted.${Date.now()}`;
            const data = await fs.readFile(filePath, "utf8");
            await fs.writeFile(backupPath, data, "utf8");
            this.logger.info(
              `📦 Created backup of corrupted file: ${backupPath}`,
            );

            const jsonMatch = data.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const recovered = JSON.parse(jsonMatch[0]);
                this.logger.info(
                  `✅ Successfully recovered data from corrupted ${collection} file`,
                );
                await fs.writeFile(
                  filePath,
                  JSON.stringify(recovered, null, 2),
                  "utf8",
                );
                return recovered;
              } catch (_recoverError) {
                this.logger.warn(
                  `⚠️ Could not recover data from ${collection}, resetting to empty object`,
                );
              }
            }

            this.logger.warn(
              `🔄 Resetting ${collection} to empty object due to corruption`,
            );
            await fs.writeFile(filePath, JSON.stringify({}, null, 2), "utf8");
            return {};
          } catch (recoveryError) {
            this.logger.error(
              `❌ Failed to recover corrupted ${collection} file:`,
              recoveryError,
            );
            return {};
          }
        }

        throw readError;
      }
    } catch (error) {
      this.logger.error(`❌ Failed to read ${collection} from file`, error);
      return {};
    }
  }

  async write(collection, data) {
    try {
      const filePath = this._getFilePath(collection);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to write ${collection} to file`, error);
      return false;
    }
  }

  async delete(collection) {
    try {
      const filePath = this._getFilePath(collection);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        this.logger.error(`❌ Failed to delete ${collection} file:`, error);
      }
      return false;
    }
  }

  async archive(collection) {
    try {
      const filePath = this._getFilePath(collection);
      const archivedPath = `${filePath}.migrated`;
      await fs.rename(filePath, archivedPath);
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        this.logger.error(`❌ Failed to archive ${collection} file:`, error);
      }
      return false;
    }
  }

  // --- Domain Specific Fallback Methods ---

  async getRoleMappings() {
    return await this.read("role_mappings");
  }

  async getRoleMappingsPaginated(guildId, page = 1, limit = 4) {
    const allMappings = await this.read("role_mappings");
    const guildMappings = Object.entries(allMappings)
      .filter(([, m]) => m.guildId === guildId)
      .sort((a, b) => {
        const aTime = a[1].updatedAt ? new Date(a[1].updatedAt).getTime() : 0;
        const bTime = b[1].updatedAt ? new Date(b[1].updatedAt).getTime() : 0;
        if (bTime === aTime) {
          return b[0].localeCompare(a[0]);
        }
        return bTime - aTime;
      });

    const totalItems = guildMappings.length;
    const totalPages = Math.ceil(totalItems / limit);
    const skip = (page - 1) * limit;
    const paginatedMappings = guildMappings.slice(skip, skip + limit);

    const mappings = {};
    for (const [messageId, mapping] of paginatedMappings) {
      mappings[messageId] = mapping;
    }

    return {
      mappings,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async setRoleMapping(messageId, guildId, channelId, roles) {
    const mappings = await this.read("role_mappings");
    mappings[messageId] = { guildId, channelId, roles };
    return this.write("role_mappings", mappings);
  }

  async deleteRoleMapping(messageId) {
    const mappings = await this.read("role_mappings");
    delete mappings[messageId];
    return this.write("role_mappings", mappings);
  }

  async cleanupExpiredRoles() {
    // Basic implementation could be added if needed
    return 0;
  }

  async getTemporaryRoles() {
    return await this.read("temporary_roles");
  }

  async addTemporaryRole(
    guildId,
    userId,
    roleId,
    expiresAt,
    notifyExpiry = false,
  ) {
    const tempRoles = await this.read("temporary_roles");
    if (!tempRoles[guildId]) tempRoles[guildId] = {};
    if (!tempRoles[guildId][userId]) tempRoles[guildId][userId] = {};
    tempRoles[guildId][userId][roleId] = { expiresAt, notifyExpiry };
    return this.write("temporary_roles", tempRoles);
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    const tempRoles = await this.read("temporary_roles");
    if (tempRoles[guildId]?.[userId]?.[roleId]) {
      delete tempRoles[guildId][userId][roleId];
      if (Object.keys(tempRoles[guildId][userId]).length === 0) {
        delete tempRoles[guildId][userId];
      }
      if (Object.keys(tempRoles[guildId]).length === 0) {
        delete tempRoles[guildId];
      }
      return this.write("temporary_roles", tempRoles);
    }
    return false;
  }

  async getAllPolls() {
    return await this.read("polls");
  }

  async getPollById(pollId) {
    const polls = await this.read("polls");
    return polls[pollId] || null;
  }

  async getPollsByGuild(guildId) {
    const polls = await this.read("polls");
    const guildPolls = {};
    for (const [pollId, poll] of Object.entries(polls)) {
      if (poll.guildId === guildId) {
        guildPolls[pollId] = poll;
      }
    }
    return guildPolls;
  }

  async getPollByMessageId(messageId) {
    const polls = await this.read("polls");
    for (const [, poll] of Object.entries(polls)) {
      if (poll.messageId === messageId) {
        return poll;
      }
    }
    return null;
  }

  async createPoll(pollData) {
    const polls = await this.read("polls");
    polls[pollData.id] = pollData;
    return this.write("polls", polls);
  }

  async updatePoll(pollId, pollData) {
    const polls = await this.read("polls");
    if (polls[pollId]) {
      polls[pollId] = { ...polls[pollId], ...pollData };
      return this.write("polls", polls);
    }
    return false;
  }

  async deletePoll(pollId) {
    const polls = await this.read("polls");
    if (polls[pollId]) {
      delete polls[pollId];
      return this.write("polls", polls);
    }
    return false;
  }

  async cleanupEndedPolls() {
    return 0;
  }

  async getVoiceControlRoles(guildId) {
    const data = await this.read("voice_control_roles");
    return (
      data[guildId] || {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      }
    );
  }

  async addVoiceDisconnectRole(guildId, roleId) {
    const data = await this.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].disconnectRoleIds.includes(roleId)) {
      data[guildId].disconnectRoleIds.push(roleId);
    }
    return this.write("voice_control_roles", data);
  }

  async removeVoiceDisconnectRole(guildId, roleId) {
    const data = await this.read("voice_control_roles");
    if (data[guildId]) {
      data[guildId].disconnectRoleIds = data[guildId].disconnectRoleIds.filter(
        id => id !== roleId,
      );
    }
    return this.write("voice_control_roles", data);
  }

  async addVoiceMuteRole(guildId, roleId) {
    const data = await this.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].muteRoleIds.includes(roleId)) {
      data[guildId].muteRoleIds.push(roleId);
    }
    return this.write("voice_control_roles", data);
  }

  async removeVoiceMuteRole(guildId, roleId) {
    const data = await this.read("voice_control_roles");
    if (data[guildId]) {
      data[guildId].muteRoleIds = data[guildId].muteRoleIds.filter(
        id => id !== roleId,
      );
    }
    return this.write("voice_control_roles", data);
  }

  async addVoiceDeafenRole(guildId, roleId) {
    const data = await this.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].deafenRoleIds.includes(roleId)) {
      data[guildId].deafenRoleIds.push(roleId);
    }
    return this.write("voice_control_roles", data);
  }

  async removeVoiceDeafenRole(guildId, roleId) {
    const data = await this.read("voice_control_roles");
    if (data[guildId]) {
      data[guildId].deafenRoleIds = data[guildId].deafenRoleIds.filter(
        id => id !== roleId,
      );
    }
    return this.write("voice_control_roles", data);
  }

  async addVoiceMoveRole(guildId, roleId, channelId) {
    const data = await this.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].moveRoleMappings) {
      data[guildId].moveRoleMappings = {};
    }
    data[guildId].moveRoleMappings[roleId] = channelId;
    return this.write("voice_control_roles", data);
  }

  async removeVoiceMoveRole(guildId, roleId) {
    const data = await this.read("voice_control_roles");
    if (data[guildId]?.moveRoleMappings) {
      delete data[guildId].moveRoleMappings[roleId];
    }
    return this.write("voice_control_roles", data);
  }

  async updateGuildAnalytics(guildId, date, type, amount) {
    const data = await this.read("guild_analytics");
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][date]) {
      data[guildId][date] = { joins: 0, leaves: 0, members: 0 };
    }
    data[guildId][date][type] += amount;
    return await this.write("guild_analytics", data);
  }

  async getGuildAnalyticsHistory(guildId, startDate, endDate) {
    const data = await this.read("guild_analytics");
    const guildData = data[guildId] || {};
    const history = [];

    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateKey = current.toISOString().split("T")[0];
      const dayData = guildData[dateKey] || { joins: 0, leaves: 0, members: 0 };
      history.push({
        date: dateKey,
        ...dayData,
      });
      current.setDate(current.getDate() + 1);
    }

    return history;
  }

  async cleanupOldAnalytics(cutoffDate) {
    const data = await this.read("guild_analytics");
    let modified = false;
    for (const guildId in data) {
      for (const dateKey in data[guildId]) {
        if (dateKey < cutoffDate) {
          delete data[guildId][dateKey];
          modified = true;
        }
      }
    }
    if (modified) {
      await this.write("guild_analytics", data);
    }
    return 0;
  }

  async getUserExperience(guildId, userId) {
    const data = await this.read("user_experience");
    return data[`${guildId}_${userId}`] || null;
  }

  async getUserExperienceByGuild(guildId) {
    const data = await this.read("user_experience");
    return Object.values(data).filter(u => u.guildId === guildId);
  }

  async setUserExperience(guildId, userId, userData) {
    const data = await this.read("user_experience");
    data[`${guildId}_${userId}`] = userData;
    return await this.write("user_experience", data);
  }

  async getUserExperienceLeaderboard(guildId, limit = 10) {
    const data = await this.read("user_experience");
    return Object.entries(data)
      .filter(([key]) => key.startsWith(`${guildId}_`))
      .map(([key, value]) => ({
        userId: key.split("_")[1],
        guildId,
        ...value,
      }))
      .sort((a, b) => (b.totalXP || b.xp || 0) - (a.totalXP || a.xp || 0))
      .slice(0, limit);
  }

  async getUserRank(guildId, userId) {
    const data = await this.read("user_experience");
    // Get all users in guild and sort by XP descending
    const sortedUsers = Object.entries(data)
      .filter(([key]) => key.startsWith(`${guildId}_`))
      .map(([, value]) => value)
      .sort((a, b) => (b.totalXP || 0) - (a.totalXP || 0));

    // Find index (rank is index + 1)
    const index = sortedUsers.findIndex(u => u.userId === userId);
    return index !== -1 ? index + 1 : 0;
  }

  async getCoreCredits(userId) {
    const data = await this.read("core_credit");
    return data[userId] || null;
  }

  async setCoreCredits(userId, userData) {
    const data = await this.read("core_credit");
    data[userId] = userData;
    return await this.write("core_credit", data);
  }

  async updateCoreCredits(userId, creditsChange) {
    const data = await this.read("core_credit");
    if (!data[userId]) {
      data[userId] = { credits: 0, lastUpdated: new Date().toISOString() };
    }
    data[userId].credits = (data[userId].credits || 0) + creditsChange;
    data[userId].lastUpdated = new Date().toISOString();
    return await this.write("core_credit", data);
  }

  async logModerationAction(actionData) {
    const moderationLogs = (await this.read("moderation_logs")) || {};
    if (!moderationLogs[actionData.guildId])
      moderationLogs[actionData.guildId] = {};
    if (!moderationLogs[actionData.guildId][actionData.userId])
      moderationLogs[actionData.guildId][actionData.userId] = [];

    const logEntry = {
      ...actionData,
      timestamp: actionData.timestamp || new Date().toISOString(),
    };
    moderationLogs[actionData.guildId][actionData.userId].push(logEntry);

    if (moderationLogs[actionData.guildId][actionData.userId].length > 100) {
      moderationLogs[actionData.guildId][actionData.userId] =
        moderationLogs[actionData.guildId][actionData.userId].slice(-100);
    }

    return await this.write("moderation_logs", moderationLogs);
  }

  async getModerationHistory(guildId, userId) {
    const moderationLogs = (await this.read("moderation_logs")) || {};
    return moderationLogs[guildId]?.[userId] || [];
  }

  async getAllModerationHistory(guildId) {
    const moderationLogs = (await this.read("moderation_logs")) || {};
    if (!moderationLogs[guildId]) return [];

    const allHistory = [];
    for (const [userId, userHistory] of Object.entries(
      moderationLogs[guildId],
    )) {
      for (const log of userHistory) {
        allHistory.push({ ...log, userId });
      }
    }
    return allHistory;
  }

  async getWarnCount(guildId, userId) {
    const history = await this.getModerationHistory(guildId, userId);
    return history.filter(log => log.action === "warn").length;
  }

  async removeWarning(guildId, userId, caseId) {
    const moderationLogs = (await this.read("moderation_logs")) || {};
    if (!moderationLogs[guildId]?.[userId]) return false;

    const initialLength = moderationLogs[guildId][userId].length;
    moderationLogs[guildId][userId] = moderationLogs[guildId][userId].filter(
      log => !(log.action === "warn" && log.caseId === caseId),
    );

    const removed = moderationLogs[guildId][userId].length < initialLength;
    if (removed) {
      await this.write("moderation_logs", moderationLogs);
    }
    return removed;
  }
}
