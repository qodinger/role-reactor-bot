# Role Reactor Bot - TODO

## 2026 Roadmap

## High Priority

- [x] Auto-moderation system (Rule-based, NO AI)

   #### FREE (Basic Auto-Mod)
   - [x] Bad words filter (simple word list)
   - [x] Link filter (basic URL blocking)
   - [x] Spam detection (3+ repeated messages)
   - [x] Auto-mod dashboard (interactive settings)
   - [x] Mention spam protection
   - [x] Invite link filter

  #### PREMIUM (Pro Engine)
  - [x] Domain allowlisting (whitelist trusted domains)
  - [x] Rate limiting (per user) - 5 messages per 5 seconds, configurable
  - [ ] Custom word lists with wildcards/regex
  - [ ] Per-channel filtering
  - [ ] Caps lock filter
  - [ ] Duplicate message detection (different from repeated)
  - [ ] Auto-mod analytics/stats
  - [ ] Export moderation logs

- [ ] Verification system
  - [ ] Email verification
  - [ ] Phone verification (Discord native)
  - [ ] Role-on-verify with captcha
- [ ] Improve slash command UX
  - [ ] Replace text commands with dropdowns
  - [ ] Add modal forms for complex configs

## Medium Priority

- [ ] Multi-language support
- [ ] Server templates (save/load configs)
- [ ] Analytics dashboard improvements
- [ ] Activity threads (Discord forum integration)

## Lower Priority

- [ ] Music playback
- [ ] Webhook integrations
  - [ ] Slack integration
  - [ ] Twitch notifications
  - [ ] YouTube notifications
- [ ] RSS feed parser

## Revenue Improvements

### Pro Engine Features (Monetization)

- [x] Domain allowlisting (Auto-Mod Pro)
- [ ] Custom welcome images (Welcome/Goodbye Pro)
  - [ ] Custom backgrounds, GIFs, video embeds
- [ ] Voice Roles Pro
  - [ ] Unlimited voice connections
  - [ ] Priority queue
- [ ] Ticket Pro
  - [ ] PDF/HTML transcript exports
  - [ ] Unlimited ticket storage
- [ ] Giveaways Pro
  - [ ] More winners (20+)
  - [ ] More entries (50K+)
  - [ ] More active giveaways (20+)
- [ ] XP Pro
  - [ ] Unlimited rewards
  - [ ] Custom rank cards/backgrounds
- [ ] Role Reactions Pro
  - [ ] More emojis (20+)
  - [ ] More menus (20+)
- [ ] Scheduled Roles Pro
  - [ ] More schedules (500+)
- [ ] Temp Roles Pro
  - [ ] More active roles (500+)

### Better Core Pricing

- [ ] Increase first-purchase bonus
- [ ] Add limited-time offers
- [ ] Add lifetime Pro deal
- [ ] Add guild bundles

## Technical Improvements

- [ ] TypeScript migration (partial or full)
- [ ] Add more automated tests
- [ ] Performance optimization
- [ ] Get Discord bot verified badge

## Current Feature Set

### General Commands

vote, support, poll, imagine, core, avatar, ask, userinfo, serverinfo, rps, ping, level, leaderboard, invite, 8ball, welcome, goodbye, help, premium

### Admin Commands

XP system, tickets, role reactions, role bundles, giveaways, voice roles, voice-status, moderation, temp roles, schedule roles, premium/Pro Engine, automod

### Premium Features

Pro Engine (subscription-based), Core credits system, Analytics tracking, Domain allowlisting

### Recent Updates (2026)

- Auto-moderation system (FREE: 5 filters | PRO: domain allowlisting, higher rate limits)
  - FREE: Bad Words, Links, Spam, Mention Spam, Invite Links
  - PRO: Domain allowlisting, configurable rate threshold
  - Features: Rate limiting (5 msgs/5s), repeated message detection, configurable actions
- Interactive automod settings (button-based toggle UI)
- Configurable automod (threshold, rate-threshold, action, timeout)
- /stats command (shows servers, users, commands, features)
- /moderation timeouts command (lists timed out members)
- /premium command (shows Free vs Pro features)
- Removed: /search, /voice-status, invite-roles, context menus
- Fixed: automod timeout bugs (duration calculation, links filter missing)

### Revenue Strategy

- AI Image Generation (credits system) - already monetizing
- Pro Engine subscription (domain allowlist, more limits)
- Core credits (AI usage) - already monetizing
- Welcome custom images (planned Pro)
- Ticket exports (planned Pro)
