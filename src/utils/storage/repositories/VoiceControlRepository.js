import { BaseRepository } from "./BaseRepository.js";

export class VoiceControlRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "voice_control_roles", cache, logger);
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return (
        settings || {
          guildId,
          disconnectRoleIds: [],
          muteRoleIds: [],
          deafenRoleIds: [],
          moveRoleMappings: {}, // roleId -> channelId
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get voice control roles for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addDisconnectRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $addToSet: { disconnectRoleIds: roleId },
          $set: { guildId, updatedAt: new Date() },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice disconnect role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeDisconnectRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $pull: { disconnectRoleIds: roleId },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice disconnect role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addMuteRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $addToSet: { muteRoleIds: roleId },
          $set: { guildId, updatedAt: new Date() },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice mute role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeMuteRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $pull: { muteRoleIds: roleId },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice mute role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addDeafenRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $addToSet: { deafenRoleIds: roleId },
          $set: { guildId, updatedAt: new Date() },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice deafen role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeDeafenRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $pull: { deafenRoleIds: roleId },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice deafen role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addMoveRole(guildId, roleId, channelId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $set: {
            [`moveRoleMappings.${roleId}`]: channelId,
            guildId,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice move role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeMoveRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $unset: { [`moveRoleMappings.${roleId}`]: "" },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice move role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getAll() {
    try {
      return await this.collection.find({}).toArray();
    } catch (error) {
      this.logger.error("Failed to get all voice control roles", error);
      throw error;
    }
  }
}
