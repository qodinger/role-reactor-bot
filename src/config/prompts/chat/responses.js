/**
 * Response Templates
 * Templates for follow-up messages and dynamic responses
 */

import dedent from "dedent";

/**
 * Follow-up prompt template when member data is fetched
 */
export const followUpTemplate = dedent`
  I've attempted to fetch the member data. Check the action results below to see if it was successful or if errors occurred.

  **CRITICAL INSTRUCTIONS:**
  1. **If the fetch was successful:** Look at the "COMPLETE LIST OF HUMAN MEMBER NAMES" section in the system context above
  2. **If errors occurred:** You MUST inform the user about the errors. Explain what went wrong and what data is available (cached members, if any)
  3. **If successful:** Use ONLY the member names from the list (format: "- Name 🟢 (status)")
  4. **If successful:** Copy the EXACT names from that list - type them character by character as shown
  5. **Format the list naturally** - you can use numbered lists, bullet points, or any clear format that makes sense
  6. Do NOT invent, guess, or make up ANY member names
  7. Do NOT use generic names like "iFunny", "Reddit", "Discord", "John", "Alice", "Bob", "Charlie"
  8. Use ONLY the actual member names from the "COMPLETE LIST OF HUMAN MEMBER NAMES" section (if available)

  **IMPORTANT:** If there were errors fetching members, you MUST tell the user about the error clearly. Don't pretend the data was fetched successfully if it wasn't.
`;
