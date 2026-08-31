# Changelog

> See [GitHub Releases](https://github.com/rolereactor/bot/releases) for full history.

## [Unreleased]

### Added

- **Live Reactor (Twitch Integration)**: Connect your Twitch channel to Discord with go-live alerts, real-time chat relay, customizable timers, stream commands, and quote system—perfect for streamers and communities.
- **Dual-Balance Economy**: Earn **Sparks** ⚡ through voting, referrals, and activity; purchase **Cores** for premium features. Two separate currencies make it clear which rewards are earned vs. purchased.
- **Core Gifting**: Transfer Cores to members using `/core gift` (a 10% transfer tax applies). Share your premium currency with your community and watch engagement grow.
- **Referral System**: Invite new members and earn rewards when they join. Grow your server while earning credits—a win-win referral flow.

### Changed

- **Vote Rewards Clarity**: Voting for the bot now explicitly grants **+5 Sparks** (earned currency). Members can see exactly what they get every 12 hours.
- **Streamlined Balance Tracking**: Core and Sparks balances are now tracked separately and reliably across the dashboard and bot commands.

### Fixed

- **Premium Subscription Reliability**: Fixed issues where subscription status and renewal logic were inconsistent between the web dashboard and Discord commands.
- **Balance Update Accuracy**: Resolved naming mismatches and missing balance updates so credits appear instantly and correctly when earned or purchased.

## [1.8.0] - 2026-07-23

### Added

- **Image Tools**: Introduced a suite of Image Tools to the web dashboard — **Resize**, **Compress**, **Convert**, and **Upscale**. Resize, Compress, and Convert include a free daily quota; additional usage and Upscale draw from your Core credits.
- **Timeout List**: New `/moderation timeouts` command to see all currently timed-out members in your server at a glance.
- **Starboard System**: New `/starboard` command to highlight the best messages in your server. Configure a dedicated channel, emoji, and reaction threshold. Starred messages are automatically posted with a dynamic heat-map embed color (gold → orange → red based on star count), reply context, image previews, and support for video, audio, and file attachments.

### Fixed

- **Schedule Role**: Fixed an issue where recurring schedules (`weekly`, `monthly`) failed to execute due to incorrect execution time comparisons, and corrected a display bug where they appeared as one-time "Pending" schedules showing `<t:NaN:F>`.

## [1.7.1] - 2026-04-01

### Security

- **API Security Hardening**: Improved protection against unauthorized access to the bot's API:
  - Added verification to ensure users can only access their own data
  - Added permission checks so only server managers can modify server settings
  - Added rate limits to prevent automated abuse
  - Improved secure communication between the website and bot

### Changed

- **Enhanced Security**: Protected all API endpoints from unauthorized access
- **Faster Monitoring**: Health check endpoint is now publicly accessible for monitoring tools

### Fixed

- Prevented unauthorized users from accessing sensitive API endpoints
- Secured payment creation to prevent fraudulent transactions
- Fixed potential data exposure in user account endpoints

## [1.7.0] - 2026-03-28

### Added

- **Giveaway System**: Complete `/giveaway` command with create, list, end, reroll, cancel, delete, and edit subcommands. Includes automatic timer-based ending, weighted random winner selection, bonus entries for roles/boosters, claim periods, account/server age requirements, and rate limiting.
- **Role Bundles**: Create reusable groups of roles with `/role-bundle create`, `/role-bundle delete`, and `/role-bundle list`. Use bundles directly in `/role-reactions setup` with the `bundle:` parameter and autocomplete support.
- **Web Dashboard Notifications**: Added a notification bell to the web dashboard for tracking Core balance changes, recent purchases, and Pro Engine status.
- **Voting Rewards**: Support the bot by voting on top.gg using the `/vote` command to earn 1 free Core Credit every 12 hours.
- **Ticketing System**: Complete support ticket system with `/ticket setup`, `/ticket info`, `/ticket claim`, `/ticket close`, `/ticket add`, and `/ticket remove` commands.
- **Ticket Panels**: Multiple custom panels with customizable titles, branding, and categorizations.
- **Scalable Transcripts**: High-performance transcript system supporting rich HTML layouts for Pro servers and Markdown for free servers, with user-accessible download logs.
- **Guild Data Purge**: Administrative tool to securely wipe all ticket history and reset the global counter from a simplified dashboard.
- **Multi-Role Reactions**: A single emoji can now grant multiple roles at once in role-reaction setups.
- **Interactive Help Menu**: All command names in the `/help` menu are now clickable slash command mentions, allowing you to directly trigger commands from the help guide.
- **High-Performance Leaderboards**: Complete refactor of the leaderboard system to use database-driven profile storage. Eliminates page load latency by removing sequential Discord API calls during rendering.
- **Bulk Member Enrichment**: Resolved issues where the bot would frequently hit Discord rate limits during leaderboard rendering, ensuring smoother and more consistent data displays.
- **Auto-Merging Mappings**: New backend system automatically identifies and merges duplicate role-emoji mappings for cleaner server configurations.

### Changed

- **Admin Command Styling**: Standardized the visual design and color schemes across all `/admin` command messages to provide a more cohesive and professional experience.

- **Pro Engine Benefits**: Unlock 10x monthly ticket capacity, HTML transcripts/exports, unlimited retention, and staff performance analytics.
- **Advanced Role Management**: 20x scheduled role capacity (500 active slots) and 10x bulk action targeting (250 members) for Pro servers.
- **Serverinfo Redesign**: `/serverinfo` command has been redesigned with a fresh look, including Pro Engine status display.
- **Goodbye System**: General performance improvements in goodbye message processing.
- **Core Balance Display**: `/core balance` now shows vote statistics, next vote countdown with Discord dynamic timestamps, server Pro Engine status, and quick-action buttons for "Vote & Earn" and "Upgrade Center."
- **Bulk Action Limits**: `/temp-roles` and `/schedule-role` now correctly support up to **250 users** per action on Pro Engine servers and **25 users** on Free servers (previously capped at 20 for all servers).
- **Faster Moderation**: `/moderation` bulk operations (timeout, warn, ban, kick) are now significantly faster and more responsive when processing user lists.

### Fixed

- **Bulk Action on Pro Servers**: Fixed an issue where `/temp-roles assign` and `/schedule-role create` would not process more than 20 users, even on Pro Engine servers entitled to 250 users.
- **Experience Calculations**: Fixed an error in the experience manager where leveling progress could occasionally fail to calculate correctly under specific conditions.
- **Leaderboard Search**: Improved the accuracy of leaderboard search filters, ensuring more reliable server discovery for the public index.


[Unreleased]: https://github.com/rolereactor/bot/compare/v1.8.0...HEAD
[1.8.0]: https://github.com/rolereactor/bot/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/rolereactor/bot/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/rolereactor/bot/compare/v1.6.3...v1.7.0