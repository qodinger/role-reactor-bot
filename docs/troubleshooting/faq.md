# Frequently Asked Questions

Common questions about using Role Reactor Bot in your Discord server.

## 🚀 Getting Started

### Q: How do I add Role Reactor Bot to my server?

**A:** Use our invitation link with pre-configured permissions:

[**🤖 Add Role Reactor Bot**](https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268823616&scope=bot%20applications.commands)

You need "Manage Server" permission to add bots to your Discord server.

### Q: What permissions does the bot need?

**A:** The bot requires these Discord permissions:
- **Manage Roles** - To assign/remove roles from members
- **Manage Messages** - To add reactions to messages
- **Add Reactions** - To react with emojis
- **Read Message History** - To detect when members react
- **View Channel** - To access channels
- **Send Messages** - To respond to commands

### Q: The bot isn't responding to my commands. What's wrong?

**A:** Check these common issues:
1. **Wait a few minutes** - Slash commands can take time to appear
2. **Check bot permissions** - Ensure it has required permissions
3. **Try different channel** - Some channels might restrict commands
4. **Verify bot is online** - Look for green status in member list

### Q: Can I use the bot for free?

**A:** Yes! Role Reactor Bot is completely free to use in your Discord server. Just invite it and start creating role messages.

## 🎯 Setting Up Roles

### Q: How many roles can I put in one message?

**A:** There's no hard limit, but we recommend:
- **Maximum 20 roles** per message for readability
- **Use categories** to organize large role sets
- **Create multiple messages** for different types of roles

### Q: Can members get multiple roles from the same message?

**A:** Yes! Members can react to multiple emojis and get all corresponding roles. This is the default behavior.

### Q: Why can't the bot assign certain roles?

**A:** The bot can only assign roles that are **below** its own role in your server's hierarchy. 

**Solution:** Go to Server Settings > Roles and drag the "Role Reactor Bot" role above any roles you want it to manage.

### Q: What happens if I delete a role that's used in a role message?

**A:** The emoji will still appear in the message, but the bot will log errors when members try to react. 

**Solution:** Use `/update-roles` to remove the deleted role from the message configuration.

### Q: Can I use custom emojis from other servers?

**A:** Yes, but with limitations:
- **Bot can use any emoji** it has access to
- **Members need Discord Nitro** to react with external emojis
- **Recommend using server-specific emojis** for best experience

## 👥 For Server Members

### Q: How do members get roles?

**A:** It's simple! Members just:
1. **Find the role message** in your server
2. **Click the emoji reaction** for the role they want
3. **Get the role instantly**
4. **Remove the reaction** to remove the role

### Q: Do members need special permissions to get roles?

**A:** No! Any member can react to get roles (unless you restrict the ability to add reactions in that channel).

### Q: Can members see what each emoji does?

**A:** Yes, if you write clear descriptions in your role messages. For example:

```
Choose your roles:

• 🎮 Gaming enthusiasts
• 🎨 Creative minds
• 💻 Tech lovers

🎮 🎨 💻
```

### Q: What if a member accidentally gets the wrong role?

**A:** No problem! They can simply **remove their reaction** to remove the role, or react to different emojis to get different roles.

## ⏰ Temporary Roles

### Q: How do temporary roles work?

**A:** Temporary roles are assigned with an expiration time:
- **Use `/assign-temp-role`** to give someone a role for a specific duration
- **Role expires automatically** when time is up
- **No manual removal needed** (but you can remove early if wanted)

### Q: What duration formats can I use?

**A:** These formats are supported:
- `30m` - 30 minutes
- `2h` - 2 hours
- `1d` - 1 day
- `1w` - 1 week
- **Maximum:** `4w` (4 weeks)

### Q: What happens if the bot goes offline with active temporary roles?

**A:** Temporary roles will still expire correctly when the bot comes back online. The expiration times are stored in the database.

### Q: Can I extend a temporary role?

**A:** Currently, you need to remove the existing temporary role and assign a new one with the desired duration.

## 🔧 Managing Role Messages

### Q: How do I update an existing role message?

**A:** Use the `/update-roles` command:

```
/update-roles message_id:123456789 title:"New Title" description:"Updated description"
```

**To find the message ID:**
1. Enable Developer Mode in Discord settings
2. Right-click the role message
3. Select "Copy ID"

### Q: Can I delete a role message?

**A:** Yes, use `/delete-roles message_id:123456789`

**Note:** This only removes the bot's functionality. Members keep any roles they already have.

### Q: How do I see all my role messages?

**A:** Use `/list-roles` to see all role assignment messages in your server, including their IDs and details.

### Q: Can I move a role message to a different channel?

**A:** No, you can't move existing messages. You'll need to:
1. Create a new message in the desired channel
2. Delete the old message
3. Update any pins or references

## 🎨 Customization

### Q: Can I change the appearance of role messages?

**A:** Yes! You can customize:
- **Colors** using hex codes (e.g., `color:"#7289DA"`)
- **Formatting** with Discord markdown (**bold**, *italic*)
- **Organization** with categories (`#Category Name`)
- **Emojis** (Unicode, custom server emojis, external emojis)

### Q: How do I organize roles into categories?

**A:** Use the category format in your roles parameter:

```
roles:"#Gaming\n🎮:Gamer,🎲:Board Games\n#Creative\n🎨:Artist,📸:Photographer"
```

This creates visual sections in your role message.

### Q: Can I use animated emojis?

**A:** Yes, but:
- **Animated emojis work** for reactions
- **Members need Discord Nitro** to use animated emojis
- **Consider static alternatives** for better accessibility

## 🚨 Troubleshooting

### Q: "Missing Permissions" error when using commands

**Common causes:**
1. **Your permissions** - You need "Manage Roles" permission
2. **Bot permissions** - Bot needs "Manage Roles" permission
3. **Role hierarchy** - Bot role must be above managed roles

### Q: Emojis appear but roles aren't assigned

**Check these:**
1. **Role names** must match exactly (case-sensitive)
2. **Role hierarchy** - bot role above target roles
3. **Role still exists** - wasn't deleted
4. **Bot permissions** - has "Manage Roles"

### Q: Members can't see slash commands

**Solutions:**
1. **Wait** - Commands can take time to appear
2. **Check permissions** - Channel might restrict commands
3. **Bot permissions** - Needs "Use Application Commands"
4. **Try different channel**

### Q: Custom emojis not working

**Solutions:**
1. **Use correct format** - `<:name:id>` for custom emojis
2. **Bot has access** - Emoji must be from accessible server
3. **Test with Unicode** - Try standard emojis first

## 💡 Best Practices

### Q: What's the best way to organize roles?

**Recommendations:**
- **Start simple** with basic interest roles
- **Use categories** for organization
- **Clear descriptions** so members understand options
- **Logical order** with most important roles first

### Q: How should I explain the role system to my members?

**Tips:**
- **Pin instructions** in your roles channel
- **Use channel topics** to explain how it works
- **Create welcome messages** mentioning role assignment
- **Share the member guide** from our documentation

### Q: Should I create a dedicated roles channel?

**Yes! Benefits include:**
- **Focused purpose** - clear what the channel is for
- **Easy to find** - members know where to get roles
- **Better organization** - keeps role messages together
- **Reduced clutter** - doesn't mix with conversation

### Q: How often should I update my role messages?

**Consider updating when:**
- **Adding new roles** to your server
- **Removing unused roles** to clean up
- **Seasonal changes** (events, temporary interests)
- **Member feedback** suggests improvements

## 🆘 Still Need Help?

### Q: Where can I get more help?

**Support options:**
- **📖 Documentation** - Browse our complete guides
- **💬 Discord Support** - Join our support server
- **🐛 GitHub Issues** - Report bugs or problems
- **💡 Feature Requests** - Suggest new features

### Q: How do I report a bug?

**Steps:**
1. **Check existing issues** on our GitHub
2. **Gather information** - error messages, steps to reproduce
3. **Create detailed report** with all relevant info
4. **Include server details** - size, setup, permissions

### Q: Can I request new features?

**Absolutely!** We welcome feature suggestions:
- **GitHub Discussions** for detailed feature requests
- **Discord suggestions** for quick ideas
- **Community voting** helps prioritize development

---

**Don't see your question here?** Check our [troubleshooting guides](common-issues.md) or [get support](../support/getting-help.md)!
