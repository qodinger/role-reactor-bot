/**
 * Role Bundle Commands - Manage reusable role bundles
 * @module commands/admin/role-bundle/index
 */

import { SlashCommandBuilder } from 'discord.js';
import {
  handleCreate,
  handleDelete,
  handleList
} from './handlers.js';

/**
 * Role bundle command definition
 */
export const command = {
  name: 'role-bundle',
  description: 'Manage reusable role bundles',
  data: new SlashCommandBuilder()
    .setName('role-bundle')
    .setDescription('Manage reusable role bundles')
    
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new role bundle')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Bundle name (letters, numbers, spaces, hyphens, underscores)')
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(50)
        )
        .addStringOption(option =>
          option.setName('roles')
            .setDescription('Roles to include (e.g., @Role1 @Role2 @Role3)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a role bundle')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Bundle name to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all role bundles in this server')
    ),

  /**
   * Execute the role-bundle command
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async execute(interaction, client) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'create':
          await handleCreate(interaction);
          break;
        case 'delete':
          await handleDelete(interaction);
          break;
        case 'list':
          await handleList(interaction);
          break;
        default:
          await interaction.reply({
            content: 'Unknown subcommand',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('Role bundle command error:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing this command.',
          ephemeral: true
        });
      }
    }
  }
};

export default command;
