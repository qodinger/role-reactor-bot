# Troubleshooting for Users

Common issues members face when using Role Reactor Bot and how to solve them quickly.

## Quick Fixes for Common Problems

### Problem: Clicking Emojis Doesn't Work

**Symptoms:**
- You click an emoji but nothing happens
- No confirmation message appears
- Role isn't added to your profile

**Quick Solutions:**

1. **Check You're Clicking the Right Place**
   ```
   ✅ Click the bot's reactions BELOW the message
   ❌ Don't click emojis IN the message text
   ```

2. **Verify Permissions**
   ```
   Make sure you can:
   • Add reactions to messages
   • See the channel where the role message is
   • Receive direct messages from the bot (for confirmations)
   ```

3. **Refresh Discord**
   ```
   • Close and reopen Discord app
   • Refresh Discord in your web browser (Ctrl+R or Cmd+R)
   • Try on a different device
   ```

### Problem: "I Don't Have Permission" Error

**Error Message:**
```
❌ You don't have permission to get this role
```

**Possible Causes & Solutions:**

1. **Role Requirements Not Met**
   ```
   Some roles require:
   • Certain server level or activity
   • Other prerequisite roles
   • Special permissions from staff
   
   Solution: Check role requirements or ask server staff
   ```

2. **Role Hierarchy Issues**
   ```
   The bot might not be able to assign the role due to:
   • Bot's role position too low
   • Role is above bot in server hierarchy
   
   Solution: Contact server administrators
   ```

3. **Server Configuration**
   ```
   Server settings might restrict:
   • Who can get certain roles
   • Time-based role assignment
   • Member verification requirements
   
   Solution: Check server rules or ask staff
   ```

### Problem: Role Added But No Access to Channels

**Symptoms:**
- Got the role successfully
- Role shows in your profile
- Still can't see or access promised channels

**Solutions:**

1. **Check Role Benefits**
   ```
   Use: /roleinfo role:@YourRole
   
   This shows exactly what the role provides
   ```

2. **Verify Channel Permissions**
   ```
   The role might provide:
   • View access only (not send messages)
   • Access to different channels than expected
   • Time-delayed access (some servers have delays)
   ```

3. **Refresh Your Discord**
   ```
   Channel permissions can take a moment to update:
   • Restart Discord app
   • Switch to another channel and back
   • Wait 1-2 minutes for permissions to sync
   ```

## Platform-Specific Issues

### Mobile App Issues

**Reaction Button Too Small:**
```
Solution:
• Zoom in on the message before clicking
• Use landscape mode for bigger buttons
• Switch to desktop/web version if needed
```

**Emojis Not Loading:**
```
Solution:
• Check your internet connection
• Update the Discord mobile app
• Clear Discord app cache
• Restart the app
```

**Notifications Not Working:**
```
Solution:
• Check Discord notification settings
• Verify phone notification permissions
• Enable Discord notifications in phone settings
```

### Desktop App Issues

**Custom Emojis Not Displaying:**
```
Problem: Custom server emojis show as :emoji_name:

Solution:
• Update Discord desktop app
• Check if you have "Use External Emojis" permission
• Try Discord in web browser
```

**Reaction Menu Not Appearing:**
```
Problem: Can't see bot reactions below message

Solution:
• Scroll down to see reactions
• Check if message is fully loaded
• Refresh Discord (Ctrl+R)
```

### Web Browser Issues

**Browser Compatibility:**
```
Supported browsers:
✅ Chrome (recommended)
✅ Firefox
✅ Safari
✅ Edge

Unsupported:
❌ Internet Explorer
❌ Very old browser versions
```

**JavaScript Disabled:**
```
Discord requires JavaScript to work properly
Solution: Enable JavaScript in browser settings
```

## Account and Permission Issues

### New Member Restrictions

**Account Age Requirements:**
```
Some servers require:
• Account older than X days
• Phone verification
• Email verification

Solution: Meet server requirements or contact staff
```

**Verification Level:**
```
High verification servers might require:
• Verified phone number
• Verified email
• Being in server for certain time

Check: Server Settings → Moderation → Verification Level
```

### Role Limits and Restrictions

**Server Role Limits:**
```
Discord limits:
• 250 total roles per server
• Members can have multiple roles simultaneously

If hitting limits: Server staff need to clean up unused roles
```

**Personal Role Limits:**
```
No official limit on roles per member, but:
• Too many roles can cause performance issues
• Some servers may have custom limits

Best practice: Only keep roles you actively use
```

## Bot-Specific Issues

### Bot Offline or Unresponsive

**Check Bot Status:**
```
Signs bot is offline:
• No reactions on role messages
• Commands don't work
• Bot appears offline in member list

Solution: Contact server staff - they need to restart the bot
```

**Partial Bot Functionality:**
```
Bot responds to some things but not others:

Possible causes:
• Missing permissions for specific actions
• Temporary Discord API issues
• Bot maintenance or updates

Solution: Wait 10-15 minutes, then contact server staff
```

### Command Errors

**"Command Not Found" Error:**
```
Possible causes:
• Typo in command name
• Command disabled in this server
• You don't have permission to use command

Solution: Check command spelling or use /help
```

**"Command Failed" Error:**
```
General command errors usually mean:
• Temporary server issue
• Bot permission problem
• Discord API problems

Solution: Try again in a few minutes
```

## Getting Help Effectively

### Before Asking for Help

**Gather Information:**
```
Helpful details to include:
• What exactly you were trying to do
• What happened vs. what you expected
• Any error messages (screenshot if possible)
• What device/app you're using
• When the problem started
```

**Try Basic Troubleshooting:**
```
✅ Restart Discord app
✅ Try on different device
✅ Check if others have same issue
✅ Wait 5-10 minutes and try again
```

### Where to Get Help

**Server Support Channels:**
```
Most servers have:
• #help or #support channel
• #bot-support channel
• Staff direct messages
• General chat (for quick questions)
```

**Using Help Commands:**
```
Try these first:
/help - General bot information
/roleinfo role:@RoleName - Specific role details
/myroles - See your current roles
```

**Contacting Server Staff:**
```
When contacting staff:
✅ Be specific about the problem
✅ Include screenshots if helpful
✅ Mention what you've already tried
✅ Be patient - staff are usually volunteers
```

## Prevention Tips

### Best Practices

**Smart Role Management:**
```
✅ Read role descriptions before selecting
✅ Start with a few roles, add more gradually
✅ Remove roles you don't use
✅ Keep track of what roles give you access to what
```

**Staying Updated:**
```
✅ Read server announcements about role changes
✅ Check for bot updates or maintenance notices
✅ Follow server rules about role usage
✅ Ask questions when unsure
```

**Technical Hygiene:**
```
✅ Keep Discord app updated
✅ Use stable internet connection
✅ Clear Discord cache occasionally
✅ Use supported devices/browsers
```

## When All Else Fails

### Last Resort Solutions

**Complete Discord Reset:**
```
1. Log out of Discord completely
2. Clear Discord cache/data
3. Restart device
4. Log back in
5. Try role selection again
```

**Alternative Methods:**
```
If reactions don't work:
• Try /addrole command (if available)
• Ask staff to manually assign roles
• Use different device
• Wait for bot maintenance to complete
```

**Escalation Process:**
```
1. Try basic troubleshooting
2. Ask in server support channels
3. Contact server staff directly
4. If bot issue: Staff contacts bot developer
5. If Discord issue: Report to Discord support
```

## FAQ - Quick Answers

**Q: Why did my role disappear?**
A: Roles can be removed by server updates, bot maintenance, or accidental clicks. Check role messages to re-add it.

**Q: Can I get multiple roles from the same message?**
A: Usually yes! Click multiple emojis to get multiple roles, unless the message specifies otherwise.

**Q: Why do some emojis look different on my device?**
A: Different devices display emojis differently. The functionality is the same regardless of appearance.

**Q: How long do roles last?**
A: Most roles are permanent until you remove them. Some special roles (like event roles) may be temporary.

**Q: Can I get roles without using reactions?**
A: Some servers allow `/addrole` commands, but reactions are the primary method.

**Q: Why can't I see certain channels after getting a role?**
A: Roles provide different levels of access. Use `/roleinfo` to see exactly what each role provides.

Remember: Most role issues are simple and can be fixed quickly. Don't hesitate to ask for help, and server staff are usually happy to assist!
