# Voice Channel Disconnect/Mute Permissions Verification

## Discord.js API Requirements

Based on Discord.js documentation and Discord API specifications, here's what's required for voice channel operations:

### 1. `member.voice.disconnect()`

**Required Permission:**

- **`MoveMembers`** (Guild-level permission)

**Permission Type:**

- Guild-level permission (NOT voice channel-specific)
- Set in Server Settings → Roles → [Bot's Role] → General Permissions

**Documentation:**

- Discord.js uses the Discord API endpoint: `PATCH /guilds/{guild.id}/members/{user.id}`
- This requires the `MOVE_MEMBERS` permission flag at the guild level
- Does NOT require voice channel-specific permissions

**What it does:**

- Moves the member from their current voice channel to no channel (disconnects them)
- Works regardless of voice channel permission overrides

### 2. `member.voice.setMute(true)`

**Required Permission:**

- **`MuteMembers`** (Guild-level permission)

**Permission Type:**

- Guild-level permission (NOT voice channel-specific)
- Set in Server Settings → Roles → [Bot's Role] → General Permissions

**Documentation:**

- Discord.js uses the Discord API endpoint: `PATCH /guilds/{guild.id}/members/{user.id}`
- This requires the `MUTE_MEMBERS` permission flag at the guild level
- Does NOT require voice channel-specific permissions

**What it does:**

- Server-mutes the member (mutes them across all voice channels)
- Works regardless of voice channel permission overrides

## Important Distinctions

### Guild-Level vs Channel-Level Permissions

**Guild-Level Permissions (What the bot needs):**

- `Move Members` - For disconnecting users from voice
- `Mute Members` - For muting users in voice
- Set in: Server Settings → Roles → [Bot's Role] → **General Permissions** section
- Applies server-wide, not per-channel

**Channel-Level Permissions (NOT needed for bot):**

- Voice channel permission overrides
- These are for CONTROLLING what users can do, not what the bot can do
- The bot uses guild-level permissions to manage users

**Role Voice Permissions (What the restrictive role needs):**

- `Connect` permission disabled - Prevents users from joining voice channels
- `Speak` permission disabled - (Optional) Prevents users from speaking in voice
- Set in: Server Settings → Roles → [Restrictive Role] → **Voice Channel Permissions** section

## How It Works in Practice

### Scenario 1: Bot Disconnects User (Automatic)

```javascript
await member.voice.disconnect("Scheduled restriction");
```

**Requirements:**

- ✅ Bot has `MoveMembers` permission at guild level
- ❌ Bot does NOT need any voice channel permissions
- ❌ Target role does NOT need voice channel permissions configured (for disconnection to work)

**Result:**

- User is disconnected from voice channel
- Works even if the role has no voice channel permissions configured

### Scenario 2: Bot Mutes User (Fallback)

```javascript
await member.voice.setMute(true, "Scheduled restriction");
```

**Requirements:**

- ✅ Bot has `MuteMembers` permission at guild level
- ❌ Bot does NOT need any voice channel permissions
- ❌ Target role does NOT need voice channel permissions configured (for muting to work)

**Result:**

- User is muted in voice channel
- Works even if the role has no voice channel permissions configured

### Scenario 3: Preventing Future Voice Joins (Manual Setup Required)

**Requirements:**

- ⚠️ The **restrictive role** must have `Connect` permission disabled
- This is configured in: Server Settings → Roles → [Restrictive Role] → Voice Channel Permissions

**Result:**

- Users with this role cannot join voice channels
- Without this, users can still join (but will be disconnected if already in one)

## Verification Checklist

### ✅ Bot Permissions (For Disconnect/Mute)

- [ ] Bot role has `Move Members` permission enabled (guild-level)
- [ ] Bot role has `Mute Members` permission enabled (guild-level)
- [ ] These are in the **General Permissions** section, not voice channel permissions

### ✅ Intent Requirements

- [ ] `GUILD_VOICE_STATES` intent is enabled (required to see voice state)
- [ ] `GUILD_MEMBERS` intent is enabled (required for role-based targeting)

### ⚠️ Role Permissions (For Preventing Voice Joins)

- [ ] Restrictive role has `Connect` permission disabled (Voice Channel Permissions)
- [ ] Optionally: `Speak` permission disabled (Voice Channel Permissions)

## Testing

To verify the implementation works:

1. **Test Disconnect:**

   ```javascript
   // User must be in voice channel
   // Bot must have MoveMembers permission
   await member.voice.disconnect("Test");
   ```

2. **Test Mute:**

   ```javascript
   // User must be in voice channel
   // Bot must have MuteMembers permission
   await member.voice.setMute(true, "Test");
   ```

3. **Test Voice Join Prevention:**
   - User tries to join voice channel after getting restrictive role
   - Should be blocked if role has `Connect` disabled
   - Should succeed if role has `Connect` enabled (but will be disconnected if already in)

## Codebase Verification

### ✅ Required Intents (Verified in `src/index.js`)

The bot already has the required intents enabled:

```javascript
GatewayIntentBits.GuildVoiceStates,  // ✅ Required to see voice state
GatewayIntentBits.GuildMembers,     // ✅ Required for role-based targeting
```

### ✅ Implementation Verification

**Current implementation uses:**

- `member.voice.disconnect()` - ✅ Correct Discord.js method
- `member.voice.setMute(true)` - ✅ Correct Discord.js method

**These methods require:**

- Guild-level `MoveMembers` permission for disconnect
- Guild-level `MuteMembers` permission for mute
- ✅ Does NOT require voice channel permissions

### ✅ Permission Flow

1. **Bot Disconnect/Mute (Automatic):**

   ```
   Bot has guild-level MoveMembers → Can disconnect users
   Bot has guild-level MuteMembers → Can mute users
   No voice channel permissions needed ✅
   ```

2. **Prevent Voice Joins (Manual Setup):**
   ```
   Restrictive role has Connect disabled → Users can't join voice
   This is a role permission, not bot permission ✅
   ```

## References

- Discord.js Documentation: https://discord.js.org/#/docs/discord.js/main/class/GuildMember?scrollTo=voice
- Discord.js VoiceState: https://discord.js.org/#/docs/discord.js/main/class/VoiceState
- Discord API Guild Member Update: https://discord.com/developers/docs/resources/guild#modify-guild-member
- Voice State Update Event: https://discord.com/developers/docs/topics/gateway-events#voice-state-update

## Conclusion

**The current implementation is correct and will work:**

- ✅ Bot uses guild-level permissions (`MoveMembers`, `MuteMembers`)
- ✅ Bot does NOT need voice channel permissions configured
- ✅ Disconnect/mute works regardless of role voice channel permissions
- ✅ Role voice channel permissions are only needed to prevent future joins
- ✅ Required intents are already enabled in the bot (`GUILD_VOICE_STATES`, `GUILD_MEMBERS`)
- ✅ Implementation follows Discord.js best practices

**What you need to configure:**

1. **Bot role:** Enable `Move Members` and `Mute Members` in General Permissions (guild-level)
2. **Restrictive role:** Disable `Connect` in Voice Channel Permissions (role-level)
