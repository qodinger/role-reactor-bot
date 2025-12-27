import { getLogger } from "../logger.js";
import {
  getGeneralCommands,
  getAdminCommands,
  getDeveloperCommands,
} from "../ai/commandExecutor/commandDiscovery.js";
import { fileURLToPath } from "url";
import path from "path";

const logger = getLogger();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Centralized Command Registry
 *
 * Automatically discovers and manages command metadata from the file system.
 * This eliminates the need to manually update multiple files when adding/removing commands.
 *
 * Commands can optionally export metadata in their index.js:
 * ```javascript
 * export const metadata = {
 *   category: "general", // "general", "admin", or "developer"
 *   description: "Command description for help system and Discord",
 *   keywords: ["keyword1", "keyword2"], // For AI command suggestions
 *   emoji: "🎯", // Optional emoji for help display
 * };
 * ```
 */
class CommandRegistry {
  constructor() {
    this.metadataCache = new Map();
    this.initialized = false;
    this.initializing = false; // Prevent concurrent initializations
    this.client = null; // Track which client was used for initialization
  }

  /**
   * Initialize the registry by discovering all commands
   * @param {import('discord.js').Client} client - Discord client (optional)
   */
  async initialize(client = null) {
    // If already initialized with the same client, skip
    if (this.initialized && this.client === client) {
      return;
    }

    // If currently initializing, wait for it to complete
    if (this.initializing) {
      // Wait for initialization to complete (simple polling approach)
      while (this.initializing) {
        // Wait 50ms before checking again
        await new Promise(resolve => {
          setTimeout(resolve, 50);
        });
      }
      return;
    }

    this.initializing = true;
    this.client = client;

    try {
      // Clear cache before re-initializing
      this.metadataCache.clear();

      // Discover commands from file system
      const [generalCommands, adminCommands, developerCommands] =
        await Promise.all([
          getGeneralCommands(),
          getAdminCommands(),
          getDeveloperCommands(),
        ]);

      // Load metadata for each command
      await this.loadCommandMetadata(generalCommands, "general", client);
      await this.loadCommandMetadata(adminCommands, "admin", client);
      await this.loadCommandMetadata(developerCommands, "developer", client);

      this.initialized = true;
      logger.debug(
        `Command registry initialized with ${this.metadataCache.size} commands`,
      );
    } catch (error) {
      logger.error("Failed to initialize command registry:", error);
      // Clear cache on failure to prevent partial state
      this.metadataCache.clear();
      this.initialized = false;
      this.client = null;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Load metadata for a list of commands
   * @private
   */
  async loadCommandMetadata(commandNames, category, client) {
    for (const commandName of commandNames) {
      try {
        // Try to load metadata from command file
        const metadata = await this.loadCommandMetadataFromFile(
          commandName,
          category,
          client,
        );

        // Get description for keyword generation
        // Use description (preferred) or helpDescription (legacy) from metadata
        const description =
          metadata.description ||
          metadata.helpDescription ||
          this.getDefaultDescription(commandName, client);

        // Store with defaults if metadata not found
        // Note: name and category are removed from metadata before spreading
        // to ensure they match the file location, not metadata values
        // Spread metadata first, then override with explicit values to ensure correct order
        this.metadataCache.set(commandName, {
          // Spread remaining metadata properties first (name/category/helpDescription already removed)
          ...metadata,
          // Then override with explicit values to ensure correct priority
          name: commandName,
          category,
          // Keywords: use from metadata if provided, otherwise auto-generate
          keywords:
            metadata.keywords ||
            this.getDefaultKeywords(commandName, description),
          description,
          // Emoji: use from metadata if provided, otherwise null (help system will use default emoji)
          emoji: metadata.emoji || null,
        });
      } catch (error) {
        logger.debug(`Failed to load metadata for ${commandName}:`, error);
        // Use defaults
        const description = this.getDefaultDescription(commandName, client);
        this.metadataCache.set(commandName, {
          name: commandName,
          category,
          keywords: this.getDefaultKeywords(commandName, description),
          description,
          emoji: null, // Help system will use default emoji
        });
      }
    }
  }

  /**
   * Load metadata from command file
   * @private
   * @returns {Object} Metadata object with description and any custom metadata
   */
  async loadCommandMetadataFromFile(commandName, category, client) {
    const metadata = {};

    // Try to import the command and get its metadata and description
    try {
      // Use path resolution for dynamic import
      const commandPath = path.join(
        __dirname,
        `../../commands/${category}/${commandName}/index.js`,
      );
      const commandModule = await import(commandPath);

      // Get custom metadata if exported (includes keywords, name, description, emoji if provided)
      if (commandModule.metadata) {
        Object.assign(metadata, commandModule.metadata);

        // Use helpDescription as description if description not set (backward compatibility)
        if (metadata.helpDescription && !metadata.description) {
          metadata.description = metadata.helpDescription;
        }

        // Don't include name/category from metadata - they're determined by file location
        // These are only in metadata for command definition reference, not for registry
        delete metadata.name;
        delete metadata.category;
        delete metadata.helpDescription; // Remove helpDescription, we use description now
      }

      // Fallback: Get description from command definition if not in metadata
      if (!metadata.description && commandModule.data) {
        const cmdData =
          typeof commandModule.data.toJSON === "function"
            ? commandModule.data.toJSON()
            : commandModule.data;

        if (cmdData.description) {
          metadata.description = cmdData.description;
        }
      }
    } catch (_error) {
      // Command might not be importable, try client as fallback
      logger.debug(
        `Could not import command ${commandName}, trying client commands`,
      );
    }

    // Fallback: Try to get description from client if not found in file
    if (!metadata.description && client?.commands) {
      const command = client.commands.get(commandName);
      if (command?.data) {
        const cmdData =
          typeof command.data.toJSON === "function"
            ? command.data.toJSON()
            : command.data;

        if (cmdData.description) {
          metadata.description = cmdData.description;
        }
      }
    }

    return metadata;
  }

  /**
   * Generate keywords automatically from command name and description
   * @private
   */
  generateKeywordsFromCommand(commandName, description = "") {
    const keywords = new Set([commandName.toLowerCase()]);

    // Add command name variations
    if (commandName.includes("-")) {
      // Split hyphenated names: "role-reactions" -> ["role", "reactions"]
      commandName.split("-").forEach(part => {
        if (part.length > 2) keywords.add(part.toLowerCase());
      });
    }

    // Extract meaningful words from description
    if (description) {
      const descLower = description.toLowerCase();

      // Common stop words to skip
      const stopWords = new Set([
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "from",
        "as",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "should",
        "could",
        "may",
        "might",
        "must",
        "can",
        "this",
        "that",
        "these",
        "those",
        "about",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "up",
        "down",
        "out",
        "off",
        "over",
        "under",
        "again",
        "further",
        "then",
        "once",
        "here",
        "there",
        "when",
        "where",
        "why",
        "how",
        "all",
        "each",
        "every",
        "both",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
        "just",
        "now",
      ]);

      // Extract words from description (3+ characters, not stop words)
      const words = descLower.match(/\b\w{3,}\b/g) || [];

      words.forEach(word => {
        if (!stopWords.has(word) && word.length >= 3) {
          keywords.add(word);
        }
      });
    }

    // Limit to reasonable number of keywords (max 10)
    return Array.from(keywords).slice(0, 10);
  }

  /**
   * Get default keywords for a command
   * Tries to generate from command name and description, falls back to command name
   * @private
   */
  getDefaultKeywords(commandName, description = "") {
    return this.generateKeywordsFromCommand(commandName, description);
  }

  /**
   * Get default description for a command
   * Extracts description directly from command definition
   * @private
   */
  getDefaultDescription(commandName, client) {
    // Try to get from client first (most reliable)
    if (client?.commands) {
      const command = client.commands.get(commandName);
      if (command?.data) {
        const cmdData =
          typeof command.data.toJSON === "function"
            ? command.data.toJSON()
            : command.data;
        if (cmdData.description) {
          return cmdData.description;
        }
      }
    }

    // Generic fallback only if we can't find description anywhere
    return `Use the /${commandName} command`;
  }

  /**
   * Get all commands for a specific category
   * @param {string} category - "general", "admin", or "developer"
   * @returns {Array<Object>} Array of command metadata objects
   */
  getCommandsByCategory(category) {
    return Array.from(this.metadataCache.values())
      .filter(cmd => cmd.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get metadata for a specific command
   * @param {string} commandName - Name of the command
   * @returns {Object|null} Command metadata or null if not found
   */
  getCommandMetadata(commandName) {
    return this.metadataCache.get(commandName) || null;
  }

  /**
   * Get all command names
   * @returns {Array<string>} Array of command names
   */
  getAllCommandNames() {
    return Array.from(this.metadataCache.keys());
  }

  /**
   * Get keywords for command suggestion
   * @param {string} commandName - Name of the command
   * @returns {Array<string>} Array of keywords
   */
  getCommandKeywords(commandName) {
    const metadata = this.metadataCache.get(commandName);
    return metadata?.keywords || [commandName];
  }

  /**
   * Get all commands with their keywords for suggestion system
   * @returns {Map<string, Array<string>>} Map of command names to keywords
   */
  getAllCommandKeywords() {
    const keywordMap = new Map();
    for (const [name, metadata] of this.metadataCache.entries()) {
      keywordMap.set(name, metadata.keywords || [name]);
    }
    return keywordMap;
  }

  /**
   * Get command description for help/suggestions
   * @param {string} commandName - Name of the command
   * @returns {string} Command description
   */
  getCommandDescription(commandName) {
    const metadata = this.metadataCache.get(commandName);
    return metadata?.description || `Use the /${commandName} command`;
  }

  /**
   * Clear the cache (useful for testing or reloading)
   */
  clearCache() {
    this.metadataCache.clear();
    this.initialized = false;
    this.client = null;
    this.initializing = false;
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();
