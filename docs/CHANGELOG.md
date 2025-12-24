# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Voice Control Command: New `/voice-control` command to automatically manage users in voice channels based on roles
- Voice Control Subcommands: `/voice-control disconnect`, `/voice-control mute`, `/voice-control deafen`, `/voice-control move`, and `/voice-control list` subcommands for complete voice management
- Voice Control Auto-Apply: Voice control actions automatically apply to users already in voice channels when roles are first configured
- Voice Control List: View all configured voice control roles with indicators for deleted roles or channels that need cleanup
- Would You Rather Command: New `/wyr` command with interactive voting system for engaging server discussions
- WYR Interactive Voting: Users can vote on questions with real-time vote counts and percentages displayed
- WYR Question Database: 100+ curated questions organized into 6 categories (Funny, Superhero, Life Choices, Philosophical, Challenging, Pop Culture)
- WYR New Question Button: Get fresh questions without re-running the command
- Rock Paper Scissors Command: New `/rps` command to play Rock Paper Scissors against the bot or challenge other users
- RPS Multiplayer Challenges: Challenge other users to Rock Paper Scissors with interactive button responses
- AI Assistant Command: New `/ask` command to ask questions to an AI assistant about the bot or server
- AI Chat Mentions: Users can mention the bot in chat messages to interact with the AI assistant directly without using commands
- AI Server Context: AI assistant has access to server information, member lists, and bot commands
- AI Command Execution: AI can execute general bot commands on behalf of users
- AI Conversation Memory: AI remembers conversation history for better context-aware responses
- AI Response Optimization: Faster AI responses through conditional prompt building based on user queries

### Changed

- Userinfo Activity Display: Enhanced activity information display with better support for streaming activities and status types

### Removed

- Voice Restrictions: Removed automatic voice restriction enforcement feature. The bot no longer automatically disconnects or mutes users based on role permissions

### Fixed

- Serverinfo Member Counts: Fixed incorrect online member counts by properly separating human members from bots in status displays
- Temp Roles Notifications: Improved error handling for DM notification failures to prevent breaking role assignment process
- Voice Tracking: Fixed voice tracking not updating when voice control move actions fail, ensuring accurate XP tracking for users in voice channels
- OAuth Authentication: Fixed authentication failures by standardizing to DISCORD_CLIENT_ID environment variable for consistency

### Performance

- Voice Control Operations: Improved processing speed and reliability for voice control operations on large servers
- Voice Control Background Processing: Large operations now process in the background without blocking command responses

## [1.5.0] - 2025-12-15

### Added

- Moderation Commands: Complete moderation system with `/moderation` command supporting timeout, warn, ban, kick, unban, purge, history, remove-warn, and list-bans subcommands
- Moderation Bulk Operations: Support for moderating multiple users at once (up to 15 users) for timeout, warn, ban, kick, and unban actions with faster processing
- Moderation History: View moderation history for individual users or entire server with pagination support
- Moderation Logging: Comprehensive logging system with unique case IDs for all moderation actions
- Moderation Auto-Escalation: Automatic timeout or kick based on warning thresholds (configurable)
- Moderation DM Notifications: Users received direct messages when warned, timed out, banned, kicked, or unbanned
- Moderation Bot Protection: Moderation commands prevented moderating bots to avoid breaking bot functionality
- Warning System: Track and manage user warnings with automatic escalation to timeout or kick
- Userinfo Warning Display: Warning count now appears in `/userinfo` command for users with moderation history
- Userinfo Command: New `/userinfo` command to view detailed information about Discord users including account details, badges, roles, join date, timeout status, and current voice channel
- Serverinfo Command: Added `/serverinfo` command to view comprehensive server information including member statistics, channel counts, server description, and boost level
- Bot Statistics: Public bot statistics including server count and user count are now available
- Payment Integration: Added support for Buy Me a Coffee and cryptocurrency payments

### Changed

- Core Payment System: Updated Core payment system to only accept one-time cryptocurrency payments. Subscriptions are no longer available, and all payments are processed as one-time purchases that never expire. Updated `/core pricing` and `/core balance` commands to reflect the new payment model
- Minimum Payment Amount: Increased minimum payment amount from $1 to $10 for Core credit purchases

### Fixed

- Avatar Credit Breakdown: Restored credit deduction breakdown display in avatar generation success message. Users can now see how their Core credits were deducted (subscription vs bonus credits) after generating an avatar
- Level-Up Notifications: Improved error handling and diagnostics for level-up message posting. Bot now provides better error messages when it cannot post to the configured level-up channel, helping identify permission issues and blocked channels
- Payment Validation: Added minimum payment validation in crypto webhook to prevent credits from being granted for payments below $10
- Moderation Unban Operations: Improved speed of bulk unban operations

### Performance

- Bot Statistics: Improved response times by caching statistics for 24 hours

### Security

- Webhook Security: Enhanced webhook token verification to prevent security vulnerabilities

## [1.4.0] - 2025-11-09

### Added

- Schedule Role Command: Restored `/schedule-role` command with full functionality including one-time and recurring schedules
- Voice Restrictions: Automatic voice restriction enforcement when assigning/removing roles with Connect or Speak permissions disabled
- Voice Restrictions for Temp-Roles: Users are automatically disconnected or muted when assigned restrictive temporary roles
- Voice Restrictions for Schedule-Role: Automatic voice restriction enforcement for scheduled role assignments
- Voice Restrictions for Existing Members: Voice restrictions now apply to members who already have restrictive roles when they join voice channels
- Temp-Roles Bulk Targeting: Added support for targeting multiple users by role in `/temp-roles` command with Core member benefits

### Changed

- Temp-Roles Documentation: Updated to include voice restrictions feature

### Performance

- Voice Operations: Significantly improved voice restriction enforcement speed and efficiency, especially for servers with many members
- Voice Operations Queue: Optimized voice operation processing to handle high concurrency scenarios faster
- Voice Restrictions: Reduced delays and improved response times when muting or disconnecting users with restrictive roles

## [1.3.1] - 2025-11-02

### Fixed

- Role Reactions: Custom emojis (including animated) now correctly grant and remove roles. This fix ensures reactions using server emojis work the same as standard Unicode emojis, with no setup changes required.
- Core Credits Storage: Fixed issue where credits were not properly saved after donations and subscriptions, ensuring credits persist correctly
- Ko-fi Payments: Fixed payment processing issues that prevented payments from being processed correctly

## [1.3.0] - 2025-10-28

### Added

- Temp-Roles Removal Notifications: Added `notify` option to `/temp-roles remove` command to send DM notifications to users when their roles are manually removed
- Temp-Roles Notification System: Comprehensive notification system with removal details including who removed the role, reason, and timestamp
- Webhook Security: Enhanced webhook verification for improved security
- PNG Fallback System: Implemented PNG fallback image system after removing Canvas dependency

### Changed

- XP Command Structure: Converted `/xp` command to use `/xp settings` subcommand pattern for consistency with other admin commands
- Admin Command UI: Standardized button layouts across goodbye/welcome/xp commands with consistent ordering and styling
- Button Design: Removed emojis from configuration buttons and made back buttons icon-only across all admin commands
- Level-Up Messages Button: Updated to show "Enable"/"Disable" with primary/secondary color styling
- Help Documentation: Updated XP command examples to reflect new subcommand structure
- Welcome System Embeds: Redesigned welcome embeds and resolved interaction errors for better user experience
- Goodbye System Embeds: Redesigned goodbye embeds and resolved interaction errors for improved functionality
- General Command Embeds: Simplified invite, poll, 8ball, avatar, core, support, sponsor, ping, level, and leaderboard command embeds for cleaner design
- Help System: Simplified button layout and removed redundant buttons for better user experience
- Role-Reactions Color System: Updated color options with cyberpunk-themed colors and improved consistency
- Core Management: Merged `/verify` command into `/core-management` for streamlined credit management
- Temp-Roles Embeds: Enhanced embeds and simplified DM messages for better user experience

### Removed

- Schedule Role System: Removed `/schedule-role` command and all related functionality due to low usage and maintenance complexity
- Schedule Role Help Documentation: Removed all schedule-role references from help system
- Level-Up Messages Footer: Removed footer from Level-Up Messages configuration page for cleaner design

### Fixed

- Channel Display Logic: Fixed channel selection pages to properly show current channel status instead of always "Not Set"
- XP Button Navigation: Fixed "back_to_settings" button error that occurred after XP command simplification
- Temp-Roles Storage: Fixed storage conflicts that could prevent temporary roles from being saved correctly
- Interaction Stability: Fixed bot stability issues and interaction timeouts
- Ko-fi Webhook Processing: Resolved webhook processing limitations
- Member Permission Errors: Fixed permission checking across commands
- Help Command Examples: Fixed incorrect command examples in help system (removed quotes from parameters)
- Role Parsing: Resolved role parsing issue with emoji variation selectors

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
- Leaderboard and Level Commands: Improved response times for /leaderboard and /level commands
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
- Role List Pagination: Added page navigation for role lists (4 items per page)
- Server Validation: Improved server-specific data handling

### Removed

- Serverinfo Command: Removed `/serverinfo` command and all related files to reduce bot complexity and remove dependency on presence data

### Changed

- Welcome System Architecture: Consolidated welcome commands into unified `/welcome` command structure
- Welcome Button Layout: Reorganized button layout with Reset button moved to Configure page
- Goodbye Message Format: Updated to modern format with bold user/server names and improved layout

### Fixed

- Welcome System: Fixed welcome system to properly assign roles during testing
- Goodbye Message Consistency: Fixed old goodbye message format across all components
- Back to Settings Button: Fixed 'Back to Settings' button to show actual settings interface
- Role Reactions Delete Command: Fixed "Message Not Found" error when deleting role reactions
- Permission Parameter Issues: Fixed incorrect permission parameter usage in temp-roles and welcome commands
- Button Router: Updated pagination button routing to use correct custom ID prefix (rolelist\_)
- Cache Invalidation: Fixed potential cache issues between list and delete commands
- Role Reactions Setup: Fixed permission errors in role-reactions setup command
- Channel Permission Validation: Added proper channel-specific permission checks for SendMessages and EmbedLinks

## [1.0.2] - 2025-09-16

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

## [0.4.0] - 2025-08-11

### Added

- Enhanced Avatar Command: Added direct download buttons for PNG, JPG, and WebP formats
- Experience (XP) System: Complete XP system with leveling, leaderboards, and user profiles
- New General Commands: Added `/8ball`, `/avatar`, `/leaderboard`, `/level`, `/serverinfo` for member engagement
- Interactive Leaderboard: Added time filters (All Time, Daily, Weekly, Monthly) with interactive buttons
- Message XP: Users earn 15-25 XP for messages with 60-second cooldown
- Command XP: Users earn 3-15 XP for command usage with 30-second cooldown
- Role XP: Users earn 50 XP for role assignments
- Server Rank Display: Level command now shows actual server rank instead of "Coming soon..."
- Welcome System: Complete welcome system with auto-welcome messages and auto-role assignment
- Auto-Welcome Messages: Automatically send welcome messages when new members join
- Custom Welcome Messages: Support for customizable welcome messages with placeholders
- Auto-Role Assignment: Automatically assign roles to new members upon joining
- Welcome System Commands: Added `/welcome setup` and `/welcome settings` for configuration
- Welcome Message Placeholders: Support for {user}, {user.name}, {user.tag}, {user.id}, {server}, {server.id}, {memberCount}, {memberCount.ordinal}
- Welcome Embed Support: Rich embed format for welcome messages with member information
- Welcome System Validation: Comprehensive permission and configuration validation

### Changed

- Avatar Command UI: Replaced interactive buttons with direct URL download buttons for better UX
- Avatar Command Colors: Changed embed color from SUCCESS to PRIMARY theme
- Avatar Command Information: Removed misleading image size claims and unnecessary download text
- Experience System Storage: Improved XP data storage reliability
- Leaderboard UI: Enhanced with time filters and cleaner presentation
- Theme Consistency: Fixed emoji display issues across all commands

### Fixed

- Avatar Download Formats: Fixed Discord CDN format parameters for proper PNG/JPG/WebP downloads
- Experience System Integration: Fixed XP data storage and retrieval issues
- Command XP Awarding: Fixed XP not being awarded when using commands
- Theme Emojis: Resolved "undefined" emoji display issues
- Leaderboard Display: Fixed leaderboard display errors

### Removed

- Avatar Command Redundancy: Removed unnecessary download options text and misleading image size information

## [0.3.1] - 2025-08-03

### Added

- Enhanced Role Parser: Improved parsing for role mentions with spaces and flexible formatting
- Timeout Protection: Added 10-second timeout for reaction adding process
- Automatic Reconnection: Bot now automatically reconnects when internet connection is restored
- Connection Monitoring: Enhanced connection monitoring with periodic health checks
- Network Interruptions: Improved handling of network interruptions without requiring manual restart

### Changed

- Simplified Setup-Roles Response: Removed setup guide button for cleaner UI
- Reduced Minimum Duration: Changed temporary role minimum from 5 minutes to 1 minute
- Improved Role Parser Logic: Better handling of spaces around colons and role mentions
- Enhanced Error Response: Role parser now returns empty array when errors exist
- Connection Reliability: Improved connection timeout and reliability settings
- Error Handling: Enhanced error handling for connection failures

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
- Improved logging with command and rate limit tracking

### Changed

- Enhanced command descriptions and usage examples
- Improved error handling and user feedback
- Enhanced command permissions and safety measures

### Fixed

- Updated help data to include all available commands
- Fixed command categorization in help system
- Fixed missing logger methods (logCommand, logRateLimit)
- Removed unused imports and functions after code cleanup

## [0.2.1] - 2025-01-22

### Added

- Dynamic external links in help command
- Improved component handling for help system

### Changed

### Fixed

## [0.2.0] - 2025-07-20

### Added

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
- Temp-Roles List: Fixed errors in `/list-temp-roles` command
- Fixed date parsing issues in temporary role display
- Temp-Roles Data: Fixed data handling issues for temporary roles

### Performance

- Command Response Times: Improved command response times with better error handling
- Data Sync: Added automatic data synchronization

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
- Persistent data storage
- Permission controls and validation
- Custom emoji support (Unicode and server emojis)
- Role categories and organization
- Comprehensive error handling and rate limiting
