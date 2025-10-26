# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Temp-Roles Removal Notifications: Added `notify` option to `/temp-roles remove` command to send DM notifications to users when their roles are manually removed
- Temp-Roles Notification System: Comprehensive notification system with removal details including who removed the role, reason, and timestamp

### Removed

- Schedule Role System: Removed `/schedule-role` command and all related functionality due to low usage and maintenance complexity
- Schedule Role Database: Removed `scheduled_roles` and `recurring_schedules` collections
- Schedule Role Background Processing: Removed RoleScheduler and all schedule execution logic
- Schedule Role Help Documentation: Removed all schedule-role references from help system

### Changed

- Webhook Server: Updated server architecture and default port configuration
- Core Management: Streamlined credit management with merged verification system
- Temp-Roles Database: Optimized for multi-user temporary role assignments
- Help System: Improved command categorization and descriptions

### Fixed

- Database Index Conflicts: Resolved MongoDB duplicate key errors in temp-roles
- Interaction Stability: Fixed bot stability issues and interaction timeouts
- Ko-fi Webhook Processing: Resolved webhook processing limitations
- Member Permission Errors: Fixed permission checking across commands
- Canvas Dependencies: Resolved Docker build issues
- Code Quality: Fixed linting and formatting issues

## [1.2.0] - 2025-10-15

### Added

- AI Avatar Generation: Complete AI-powered avatar generation system with `/avatar` command
- Avatar Content Filter: Advanced content filtering with 97.6% accuracy for inappropriate content detection
- Avatar Style Options: Multiple style choices including color_style, mood, and art_style parameters
- Core Credit System: New credit-based economy for avatar generation with Ko-fi integration
- Core Command: New `/core` command with clean UI and Core Energy branding
- Core Tier Benefits: Priority processing and increased rate limits for Core subscribers
- Poll System: Create and manage native Discord polls with `/poll` command
- Poll Commands: `/poll create`, `/poll list`, `/poll end`, `/poll delete` for full poll management
- Interactive Poll Creation: Easy-to-use forms for creating polls with custom duration and vote types

### Fixed

- Command Timeouts: Fixed "Unknown interaction" errors that occurred when commands took too long to respond
- Database Commands: Improved response times for /leaderboard and /level commands
- Role Parser: Fixed role parsing to properly strip @ symbol from role names (e.g., "@Gamer" → "Gamer")
- Button Interactions: Fixed "This interaction failed" errors on various system buttons

## [1.1.0] - 2025-10-05

### Added

- Goodbye System: Complete goodbye system with auto-goodbye messages when members leave
- Goodbye System Commands: Added `/goodbye` command with comprehensive configuration options
- Goodbye Message Placeholders: Support for {user}, {user.name}, {user.tag}, {user.id}, {server}, {server.id}, {memberCount}, {memberCount.ordinal}
- Goodbye Embed Support: Rich embed format for goodbye messages with member information
- Goodbye System Storage: Automatic saving of goodbye settings for each server
- Goodbye System Security: Enhanced permission checks for configuration access
- Goodbye System Features: Improved message formatting and placeholder support
- Channel Selection Dropdown: Interactive channel selection for goodbye system configuration
- Two-Step Configuration: Channel select → modal configuration flow for better UX
- Welcome System Improvements: Enhanced welcome system with better button layout and organization
- Welcome System Test: Real role assignment testing in welcome system test functionality
- Role List Pagination: Added page navigation for role lists (4 items per page)
- Server Validation: Improved server-specific data handling

### Removed

- Serverinfo Command: Removed `/serverinfo` command and all related files to reduce bot complexity and remove dependency on presence data

### Changed

- Welcome System Architecture: Consolidated welcome commands into unified `/welcome` command structure
- Welcome Button Layout: Reorganized button layout with Reset button moved to Configure page
- Welcome Test Functionality: Improved test accuracy by using real interaction.member instead of mock data
- Goodbye Message Format: Updated to modern format with bold user/server names and improved layout

### Fixed

- Welcome System Test: Fixed test functionality to use authentic user data and enable real role assignment
- Goodbye Message Consistency: Fixed old goodbye message format across all components
- Back to Settings Button: Fixed 'Back to Settings' button to show actual settings interface
- Role Reactions Delete Command: Fixed "Message Not Found" error by properly validating guildId in getRoleMapping function
- Permission Parameter Issues: Fixed incorrect permission parameter usage in temp-roles and welcome commands
- Button Router: Updated pagination button routing to use correct custom ID prefix (rolelist\_)
- Cache Invalidation: Fixed potential cache issues between list and delete commands
- Role Reactions Setup Permission Error: Fixed Discord API Error 50013 (Missing Permissions) in role-reactions setup command
- Channel Permission Validation: Added proper channel-specific permission checks for SendMessages and EmbedLinks

## [1.0.2] - 2025-09-16

### Added

- Ko-fi Funding Support: Added Ko-fi funding option to GitHub FUNDING.yml for additional support channels
- Comprehensive Deployment Solution: Added new deployment scripts and solutions to fix version mismatch issues
- Enhanced Docker Update Scripts: Improved docker update scripts for more reliable deployments
- Quick Deployment Guide: Added QUICK-DEPLOY.md for streamlined deployment process

### Changed

- Documentation Structure: Reorganized deployment documentation by moving DEPLOYMENT.md and QUICK-DEPLOY.md to docs/ directory
- Documentation Consolidation: Updated DEPLOYMENT.md with latest content and improved organization
- Package Configuration: Updated package.json with latest dependencies and configuration
- Bot Invite System: Enhanced invite functionality for better bot setup experience

### Fixed

- Bot Permissions: Added missing bot permissions for full functionality
- Permission Detection: Improved permission handling and validation system

## [1.0.1] - 2025-09-16

### Fixed

- Role Reactions Permission Error: Fixed "Unknown Permission" error in role-reactions setup command when bot member data is unavailable
- Permission Error Messages: Enhanced error messages with detailed permission explanations and step-by-step fix instructions
- Bot Permission Detection: Improved getMissingBotPermissions() to return all required permissions when guild.members.me is unavailable

## [1.0.0] - 2025-09-07

### Added

- Schedule Role System: Comprehensive role scheduling with one-time and recurring assignments
- Natural Language Scheduling: Support for human-readable time formats like "tomorrow 9am" and "monday 6pm"
- Smart 8ball System: Intelligent question analysis with sentiment detection and context-aware responses
- Bulk Role Removal: Enhanced temp-roles remove command with comprehensive multi-user support
- Interactive Sponsor Button: Direct "Become a Sponsor" button linking to sponsor page
- Interactive Support Buttons: Discord support server and GitHub repository buttons
- Modular Command Architecture: All commands refactored into organized folder structures with dedicated handlers, embeds, and utilities
- Enhanced Help System: Comprehensive help documentation with autocomplete, interactive UI, and dynamic content generation
- XP Settings Management: Interactive XP system configuration with real-time embed updates
- Role Reactions Consolidation: Unified role-reaction management under single command with setup, list, update, and delete subcommands

### Changed

- Command Structure: All commands now follow modular pattern with dedicated files for handlers, embeds, utils, and components
- Help Command: Complete redesign with autocomplete support, interactive dropdowns, and comprehensive command documentation
- Role Reactions System: Consolidated from multiple commands into single `/role-reactions` command with subcommands
- Temporary Role System: Modernized embeds, improved user experience, and enhanced bulk operations
- XP Settings Interface: Buttons now update embeds in place instead of sending separate confirmation messages
- 8ball Command Design: Redesigned with mystical theme and intelligent response system
- Sponsor Command: Updated to focus on development support rather than premium features
- Support Command: Enhanced with interactive buttons for better user engagement
- Interaction System: Centralized interaction management with dedicated button and modal routers

### Fixed

- Help Command Undefined Emojis: Fixed missing emoji constants causing "undefined" placeholders in help output
- Button Emoji Visibility: Fixed black emojis not visible in Discord dark theme
- Temporary Role Expiration Notifications: Fixed DM notifications not being sent when roles expire
- 8ball Response Selection: Fixed bug in response selection logic
- Command Placeholder Content: Replaced placeholder text with actual useful content in sponsor and support commands
- XP Settings Button Behavior: Fixed buttons sending new messages instead of updating the original embed
- Temporary Role Bulk Removal: Fixed "Invalid User List" error in multi-user removal operations

## [0.4.1] - 2025-01-22

### Changed

- XP System Configuration: Simplified from complex command-based configuration to button-driven toggles
- XP System Default: XP system is now disabled by default and requires admin activation
- Experience Manager: Now checks guild settings before awarding XP
- Development Tools: Enhanced testing and build processes

## [0.4.0] - 2025-08-11

### Added

- Enhanced Avatar Command: Added direct download buttons for PNG, JPG, and WebP formats
- Experience (XP) System: Complete XP system with leveling, leaderboards, and user profiles
- New General Commands: Added `/8ball`, `/avatar`, `/leaderboard`, `/level`, `/serverinfo` for member engagement
- Interactive Leaderboard: Added time filters (All Time, Daily, Weekly, Monthly) with interactive buttons
- Message XP: Users earn 15-25 XP for messages with 60-second cooldown
- Command XP: Users earn 3-15 XP for command usage with 30-second cooldown
- Role XP: Users earn 50 XP for role assignments
- Database Integration: XP data stored in MongoDB with UserExperienceRepository
- Server Rank Display: Level command now shows actual server rank instead of "Coming soon..."
- Welcome System: Complete welcome system with auto-welcome messages and auto-role assignment
- Auto-Welcome Messages: Automatically send welcome messages when new members join
- Custom Welcome Messages: Support for customizable welcome messages with placeholders
- Auto-Role Assignment: Automatically assign roles to new members upon joining
- Welcome System Commands: Added `/welcome setup` and `/welcome settings` for configuration
- Welcome Message Placeholders: Support for {user}, {user.name}, {user.tag}, {user.id}, {server}, {server.id}, {memberCount}, {memberCount.ordinal}
- Welcome Embed Support: Rich embed format for welcome messages with member information
- Welcome System Database: MongoDB integration for storing welcome settings per guild
- Welcome System Validation: Comprehensive permission and configuration validation
- Welcome System Utilities: Dedicated utility functions for message processing and embed creation

### Changed

- Avatar Command UI: Replaced interactive buttons with direct URL download buttons for better UX
- Avatar Command Colors: Changed embed color from SUCCESS to PRIMARY theme
- Avatar Command Information: Removed misleading image size claims and unnecessary download text
- Experience System Storage: Migrated XP data from file storage to MongoDB database
- Leaderboard UI: Enhanced with time filters and cleaner presentation
- Theme Consistency: Fixed all hardcoded emojis to use centralized theme.js exports

### Fixed

- Avatar Download Formats: Fixed Discord CDN format parameters for proper PNG/JPG/WebP downloads
- Experience System Integration: Fixed storage manager to use database for XP data
- Command Handler: Fixed interactionCreate to use commandHandler for proper XP awarding
- Theme Emojis: Resolved "undefined" emoji issues by using proper theme.js references
- Leaderboard Linter Errors: Fixed string concatenation and variable usage issues
- Database Migration: Successfully migrated existing XP data from files to MongoDB

### Removed

- Storage Command Cleanup Features: Removed "Cleanup Expired Roles" and "Test Auto Cleanup" buttons from developer storage command for improved security
- Avatar Command Redundancy: Removed unnecessary download options text and misleading image size information

## [0.3.1] - 2025-08-03

### Added

- Enhanced Role Parser: Improved parsing for role mentions with spaces and flexible formatting
- Comprehensive Test Coverage: Added 48 test cases for role parsing edge cases
- Timeout Protection: Added 10-second timeout for reaction adding process
- Automatic MongoDB Reconnection: Bot now automatically reconnects to MongoDB when internet connection is restored
- Enhanced connection monitoring with periodic health checks every 30 seconds
- Intelligent retry logic with exponential backoff (up to 5 attempts)
- Connection state tracking and logging for better debugging
- Graceful handling of network interruptions without requiring manual restart

### Changed

- Simplified Setup-Roles Response: Removed setup guide button for cleaner UI
- Reduced Minimum Duration: Changed temporary role minimum from 5 minutes to 1 minute
- Improved Role Parser Logic: Better handling of spaces around colons and role mentions
- Enhanced Error Response: Role parser now returns empty array when errors exist
- Updated MongoDB connection configuration with enhanced reconnection options
- Improved connection timeout and heartbeat settings for better reliability
- Enhanced error handling for database connection failures
- Standardized unit test file naming to consistent camelCase convention
- Improved test reliability with proper timeout configurations and cleanup

### Fixed

- Role Parser Edge Cases: Fixed parsing issues with spaces around colons
- Setup-Roles Interaction: Added timeout protection to prevent hanging
- Temporary Role Duration: Fixed minimum duration validation logic

## [0.3.0] - 2025-08-03

### Added

- Enhanced help system with interactive components
- Improved command categorization and metadata
- Added ping command for latency checking
- Automated update script with backup functionality
- Data export functionality for GDPR compliance (developer only)
- Enhanced storage command with privacy features
- Manual data management through admin commands

- Improved logging with command and rate limit tracking

### Changed

- Enhanced command descriptions and usage examples
- Improved error handling and user feedback
- Simplified storage command to export-only (removed dangerous delete functionality)
- Updated privacy policy to reflect admin command-based data deletion
- Enhanced command permissions and safety measures

### Fixed

- Updated help data to include all available commands
- Fixed command categorization in help system
- Fixed missing logger methods (logCommand, logRateLimit)
- Removed unused imports and functions after code cleanup

## [0.2.2] - 2025-07-23

### Added

- Health check server configuration with configurable port settings
- Global error handlers for unhandled promise rejections and uncaught exceptions

### Changed

- Enhanced Discord API integration tests with updated imports and better test coverage
- Improved error handling in health monitoring systems

### Fixed

- Resolved issues with health check server port conflicts
- Fixed test imports after utility reorganization
- Fixed CI workflow pnpm executable error by reordering setup steps
- Fixed pnpm lockfile compatibility by updating to pnpm v9 in workflows
- Fixed CI test failures by adding required environment variables for config validation
- Fixed release workflow pnpm executable error by reordering setup steps

## [0.2.1] - 2025-01-22

### Added

- Dynamic external links in help command
- Improved component handling for help system

### Changed

- Modularized monitoring, storage, and global utilities
- Organized utilities into subdirectories for better structure
- Improved GitHub Actions release workflow with modern practices
- Enhanced release workflow with better error handling and validation

### Fixed

- Resolved post-refactor bugs in developer commands
- Fixed imports after utility reorganization

## [0.2.0] - 2025-07-20

### Added

- Developer command system with runtime permission checks
- `/storage` command for storage status monitoring
- Runtime permission checks using `DEVELOPERS` environment variable
- Discord command visibility controls (`setDefaultMemberPermissions(0n)`, `setDMPermission(false)`)
- Component-based help system architecture
- Environment-based command deployment filtering
- GitHub Actions automated release workflow
- Persistent data storage for temporary roles
- Enhanced role management validation
- Automated bot update script

### Changed

- Renamed "bot owner" to "developer" throughout codebase
- Added "🔒 [DEVELOPER ONLY]" descriptions to developer commands
- Simplified deployment scripts (reduced from 8 to 4 commands: `deploy:dev`, `deploy:prod`, `deploy:global`, `delete:commands`)
- Updated ephemeral usage from `ephemeral: true` to `flags: 64` (Discord deprecation fix)

- Improved command visibility and permission handling

- Enhanced database manager error handling
- Improved scheduler cleanup process
- Better error messages and validation

### Fixed

- Fixed Discord deprecation warnings by updating ephemeral usage
- Fixed developer command visibility issues in Discord UI
- Fixed deployment script logic for proper environment-based command filtering
- Enhanced permission checking and feedback for developer commands
- Fixed `list-temp-roles` command (`getExpiredTemporaryRoles` error)
- Fixed date parsing issues in temporary role display
- Added cache clearing to prevent stale data
- Fixed data structure handling for temporary roles

### Security

- Added runtime permission checks for developer commands
- Implemented environment-based command filtering
- Enhanced command visibility controls to prevent unauthorized access

### Performance

- Optimized command deployment with environment-based filtering
- Reduced deployment script complexity from 8 to 4 essential commands
- Improved command response times with better error handling
- Implemented 5-minute cache timeout
- Added automatic data sync between storage methods
- Enhanced error handling and logging

## [0.1.0] - 2025-07-10

### Added

- Initial Discord role reactor bot implementation
- Self-assignable roles through reactions
- Temporary role system with auto-expiration
- Role management commands (`/setup-roles`, `/update-roles`, `/delete-roles`, `/list-roles`)
- Temporary role commands (`/assign-temp-role`, `/list-temp-roles`, `/remove-temp-role`)
- Health monitoring and performance metrics (`/health`, `/performance`)
- Structured logging system with file output
- Docker deployment support
- MongoDB integration for data persistence
- Permission controls and validation
- Custom emoji support (Unicode and server emojis)
- Role categories and organization
- Developer management commands (`/health`, `/performance`)
- Comprehensive error handling and rate limiting
