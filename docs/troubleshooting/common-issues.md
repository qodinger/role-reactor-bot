# Common Issues

Comprehensive guide to identifying, understanding, and resolving the most frequently encountered problems with Role Reactor Bot.

## Most Common Issues

### 1. Role Reactions Not Working

**Symptoms:**
- Clicking emoji reactions does nothing
- No bot response or confirmation
- Reactions appear but don't function

**Diagnostic Questions:**
```
✅ Are you clicking the bot's reactions below the message?
✅ Is the bot online and responsive?
✅ Do you have permission to add reactions?
✅ Is your Discord app/browser up to date?
```

**Solutions by Cause:**

**User Error (Most Common):**
```
Problem: Clicking emojis in message text instead of reactions
Solution: Click the bot's emoji reactions below the message

Problem: Multiple rapid clicks confusing the system
Solution: Wait 2-3 seconds between clicks, avoid spam clicking
```

**Permission Issues:**
```
Problem: Missing "Add Reactions" permission
Solution: Contact server admin to check your permissions

Problem: Bot missing "Manage Roles" permission
Solution: Server admin needs to fix bot permissions
```

**Technical Issues:**
```
Problem: Discord client sync issues
Solution: 
1. Restart Discord app
2. Clear Discord cache
3. Try different device/browser
4. Wait 5-10 minutes for sync
```

### 2. "Permission Denied" Errors

**Common Error Messages:**
```
❌ "I don't have permission to give you this role"
❌ "You don't have permission to get this role"
❌ "Role assignment failed - permission error"
```

**Diagnosis & Solutions:**

**Bot Permission Issues:**
```
Cause: Bot role positioned below target role in hierarchy
Solution: Server admin moves bot role above all managed roles

Cause: Bot missing "Manage Roles" permission
Solution: Server admin grants proper permissions to bot
```

**User Permission Issues:**
```
Cause: Server verification requirements not met
Solution: Complete phone/email verification as required

Cause: User lacks required prerequisite roles
Solution: Get prerequisite roles first, then try again
```

**Role Configuration Issues:**
```
Cause: Role set to admin-only assignment
Solution: Contact server staff to adjust role settings

Cause: Role deleted but still in message
Solution: Server admin updates role message
```

### 3. Bot Appears Offline or Unresponsive

**Identifying Bot Status Issues:**

**Complete Bot Offline:**
```
Signs:
• Bot shows as offline in member list
• No reactions on any role messages
• All bot commands fail

Immediate Actions:
1. Check if others are experiencing same issue
2. Wait 10-15 minutes for automatic restart
3. Contact server staff if problem persists
```

**Partial Bot Functionality:**
```
Signs:
• Some commands work, others don't
• Reactions work but no confirmation messages
• Bot responds slowly or inconsistently

Likely Causes:
• Discord API rate limiting
• Temporary server performance issues
• Bot experiencing high load

Solutions:
• Wait 15-30 minutes
• Try during off-peak hours
• Report to server staff if persistent
```

### 4. Roles Added But No Channel Access

**Symptoms:**
- Successfully got role (shows in profile)
- Expected channel access not granted
- Role appears to provide no benefits

**Diagnosis Steps:**

**Verify Role Benefits:**
```
Use command: /roleinfo role:@YourRole
Check: What permissions/access this role actually provides
Confirm: You understand what the role does
```

**Check Channel Permissions:**
```
Common misunderstandings:
• Role gives view access but not send permissions
• Role provides access to different channels than expected
• Channel access delayed due to Discord sync
```

**Permission Refresh:**
```
Try these refresh methods:
1. Leave and rejoin the server (last resort)
2. Switch to different channel and back
3. Restart Discord client
4. Wait 2-3 minutes for permission sync
```

### 5. Missing or Broken Emoji Reactions

**Visual Issues:**

**Emojis Display as Text or Boxes:**
```
Cause: Device doesn't support custom emojis
Solutions:
• Update Discord app to latest version
• Try on different device
• Use web version of Discord
• Contact server admin about using standard emojis
```

**Missing Reactions Below Message:**
```
Cause: Message too old or bot reactions removed
Solutions:
• Ask server admin to refresh the role message
• Try scrolling down to see if reactions are below view
• Refresh Discord client
```

**Duplicate or Extra Reactions:**
```
Cause: Multiple users or bots added same emoji
Solutions:
• Only click bot's official reactions
• Server admin should clean up duplicate reactions
• Report issue to server staff
```

## Platform-Specific Issues

### Mobile App Problems

**Touch Interface Issues:**
```
Problem: Reactions too small to click accurately
Solutions:
• Zoom in on message before clicking
• Use landscape orientation
• Long-press instead of quick tap
• Switch to desktop if needed
```

**App Performance Issues:**
```
Problem: Discord mobile app lagging or freezing
Solutions:
• Force close and restart Discord app
• Clear Discord app cache in device settings
• Update app to latest version
• Restart device if problems persist
```

**Mobile Notification Issues:**
```
Problem: Not receiving role confirmation notifications
Solutions:
• Check Discord notification settings in app
• Verify phone notification permissions
• Ensure Discord has permission to send notifications
• Test with other Discord notifications
```

### Desktop Application Issues

**Cache and Data Problems:**
```
Problem: Discord desktop app behaving inconsistently
Solutions:
• Clear Discord cache:
  - Windows: %appdata%\discord\Cache
  - Mac: ~/Library/Application Support/discord/Cache
• Restart Discord completely
• Update to latest version
```

**Display and Rendering Issues:**
```
Problem: Emojis or reactions not displaying correctly
Solutions:
• Update graphics drivers
• Try Discord web version
• Adjust Discord appearance settings
• Restart with different display settings
```

### Web Browser Issues

**Browser Compatibility:**
```
Supported browsers:
✅ Chrome/Chromium (recommended)
✅ Firefox
✅ Safari (macOS)
✅ Edge

Unsupported:
❌ Internet Explorer
❌ Very old browser versions

Solutions for unsupported browsers:
• Update to supported browser
• Use Discord desktop app instead
```

**JavaScript and Extension Conflicts:**
```
Problem: Browser extensions interfering with Discord
Solutions:
• Disable ad blockers temporarily
• Try Discord in incognito/private mode
• Disable all browser extensions
• Clear browser cache and cookies
```

## Server-Specific Issues

### High-Traffic Server Problems

**Rate Limiting Issues:**
```
Problem: Bot responses delayed during peak hours
Symptoms:
• Slow role assignment
• Delayed confirmation messages
• Intermittent functionality

Solutions:
• Try during off-peak hours
• Be patient with role assignments
• Avoid rapid-fire clicking
• Report persistent issues to server admin
```

### Large Server Role Limits

**Discord Role Limitations:**
```
Server Limits:
• Maximum 250 roles per server
• Complex permission calculations can slow down
• Large member counts affect performance

If hitting limits:
• Server admin needs to audit and remove unused roles
• Consider role consolidation
• May need to simplify role system
```

## Error Message Troubleshooting

### Common Error Messages and Solutions

**"Role not found" Error:**
```
Error: ❌ Role "@RoleName" not found
Causes:
• Role was deleted from server
• Role name changed since message created
• Typo in role name

Solutions:
• Contact server admin to update role message
• Check if role was renamed
• Try other roles in same message
```

**"Maximum roles reached" Error:**
```
Error: ❌ You have reached the maximum number of roles
Causes:
• Server has custom role limits
• Discord hitting internal limits (rare)
• Bot configuration limits

Solutions:
• Remove unused roles first
• Contact server admin about limits
• Prioritize most important roles
```

**"Command cooldown" Error:**
```
Error: ❌ Please wait before using this command again
Causes:
• Anti-spam protection active
• Rate limiting to prevent abuse

Solutions:
• Wait specified time period
• Avoid rapid command usage
• Normal functionality will resume
```

## Prevention and Best Practices

### Avoiding Common Issues

**Smart Usage Habits:**
```
✅ Wait between role changes (don't spam click)
✅ Read role descriptions before selecting
✅ Keep Discord app updated
✅ Use stable internet connection
✅ Follow server rules for role usage
```

**Regular Maintenance:**
```
For Users:
• Periodically review your roles with /myroles
• Remove roles you no longer need
• Report broken role messages to server staff
• Keep Discord client updated

For Server Admins:
• Regularly test role message functionality
• Monitor bot permissions and status
• Clean up unused or redundant roles
• Update role messages when roles change
```

### When to Contact Support

**Contact Server Staff When:**
```
🚨 Bot completely offline for 30+ minutes
🚨 All role messages broken across server
🚨 Persistent permission errors affecting multiple users
🚨 Bot giving roles to wrong people
🚨 Security concerns or unauthorized access
```

**Try Self-Help First For:**
```
💡 Individual role assignment issues
💡 Minor display problems
💡 Temporary Discord client issues
💡 Understanding how roles work
💡 Personal preference changes
```

**Information to Include When Reporting:**
```
Helpful details for support:
• Exact error message (screenshot preferred)
• What you were trying to do
• When the problem started
• Device/platform you're using
• Whether others have same issue
• What troubleshooting you've already tried
```

Remember: Most common issues have simple solutions! Try the basic troubleshooting steps first, and don't hesitate to ask for help when needed.
