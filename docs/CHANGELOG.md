# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Welcome System Commands: Added `/setup-welcome` and `/welcome-settings` for configuration
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

- Legal Documentation: Removed `docs/legal/privacy-policy.md` and `docs/legal/terms-of-use.md` as they were intended for end users rather than developers
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
- Legal documentation (Terms of Use and Privacy Policy)
- Improved logging with command and rate limit tracking

### Changed

- Updated documentation structure and organization
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
- Enhanced documentation with developer command system details
- Improved command visibility and permission handling
- Streamlined README.md organization
- Consolidated deployment guides (merged VPS_DEPLOYMENT.md)
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
