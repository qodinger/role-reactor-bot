/**
 * Response Templates
 * Templates for follow-up messages and dynamic responses
 */

import dedent from "dedent";

/**
 * Template for when users ask about members but fetching is disabled
 */
export const memberInfoGuidanceTemplate = dedent`
  I can help you find member information! Here are the best ways to see member details in Discord:

  **📱 Quick Member Info:**
  • **Member List**: Check the right sidebar - shows all members with real-time status
  • **Search Members**: Press Ctrl+K (Cmd+K on Mac) to search for specific people
  • **Server Stats**: Member count is shown in the server name at the top
  • **Online Status**: 🟢 Online, 🟡 Away/Idle, 🔴 Do Not Disturb, ⚫ Offline

  **🔧 For Admins:**
  • **Role Members**: Server Settings → Roles → Click any role to see its members
  • **Member Management**: Server Settings → Members for detailed member info
  • **Server Insights**: Server Settings → Server Insights for activity stats

  **📊 Current Server Stats:**
  • Total Members: {memberCount}
  • Server Created: {createdDate}
  • Channels: {channelCount}

  Discord's built-in features are faster and more reliable than AI fetching! Need help with something specific?
`;

/**
 * Follow-up prompt template when member data is fetched (rare case when enabled)
 */
export const followUpTemplate = dedent`
  I've attempted to fetch the member data. Check the action results below to see if it was successful or if errors occurred.

  **CRITICAL INSTRUCTIONS:**
  1. **If the fetch was successful:** Look at the "COMPLETE LIST OF HUMAN MEMBER NAMES" section in the system context above
  2. **If errors occurred:** You MUST inform the user about the errors. Explain what went wrong and guide them to Discord's built-in member list instead
  3. **If permission denied:** Explain that member fetching is disabled for security/performance and guide to Discord's native features
  4. **If successful:** Use ONLY the member names from the list (format: "- Name 🟢 (status)")
  5. **If successful:** Copy the EXACT names from that list - type them character by character as shown
  6. **Format the list naturally** - you can use numbered lists, bullet points, or any clear format that makes sense
  7. Do NOT invent, guess, or make up ANY member names
  8. Do NOT use generic names like "iFunny", "Reddit", "Discord", "John", "Alice", "Bob", "Charlie"
  9. Use ONLY the actual member names from the "COMPLETE LIST OF HUMAN MEMBER NAMES" section (if available)

  **IMPORTANT:** If there were errors or permission issues, guide users to Discord's member list on the right sidebar instead.
`;
