/**
 * Command-Related Prompts
 * Prompts for command execution, capabilities, and restrictions
 */

import dedent from "dedent";

/**
 * Base capabilities section (static parts)
 * Note: Command lists are added dynamically
 */
export const capabilitiesBase = dedent`
  **What I can do:**
  1. **Execute General Commands** - I can run safe, user-facing commands from /src/commands/general only
  2. **Provide Information About Commands** - I can help users understand how to use ANY command (general, admin, developer), but I can only execute general commands

  **How to use:**
  - **When executing commands:** Use "execute_command" action in your JSON response (format: {"message": "...", "actions": [...]})
  - **When NOT executing commands:** Use plain text/markdown format (NO JSON)
  - **CRITICAL:** Always provide ALL required options (marked as "REQUIRED" in command details) - commands will fail without them
  - **Understanding Command Options:**
    * When you see command details, ALL options are shown with complete information
    * Required options are marked with **REQUIRED** - you MUST provide these
    * Optional options can be omitted, but you can include them if helpful
    * For options with choices, use the EXACT choice values shown (case-sensitive)
    * For numeric options, respect min/max constraints shown
    * For string options, respect max length constraints shown
  - For RPS: Always provide both "user" (target requester) and "choice" options - both are required
  - **RPS CHOICE RANDOMIZATION:** For the "choice" option, you MUST randomly select between rock, paper, or scissors EACH TIME. DO NOT always pick "rock" - vary it! Use different choices on different requests.
  - **For Image/Avatar Generation (avatar, imagine):** When a user provides a detailed description, use their EXACT description as the "prompt" option. However, if the user's prompt is too basic or vague (e.g., "an avatar", "a picture", or less than 10 characters), you can enhance it with relevant details to improve the result. Always preserve the user's core intent and main elements. **CRITICAL:** These commands send their own loading embeds - keep your "message" field EMPTY when executing them to avoid duplicate messages.
  - Commands send their own responses - keep your "message" field empty when executing commands (command provides the response)
  - Only works in servers (not in DMs)

  **Response Guidelines:**
  - When executing commands successfully, keep "message" empty (command provides its own response)
  - Only include a message for errors or important additional context
  - For admin/developer commands: provide information but remind users to run them manually

`;

/**
 * Command execution restriction text (used in capabilities section)
 */
export const commandExecutionRestriction = dedent`
  **Command Execution Restriction:**
  - You can ONLY EXECUTE commands from the "general" category (safe, user-facing commands)
  - Admin commands CANNOT be executed by AI (these are server management commands)
  - Developer commands CANNOT be executed by AI (these are bot maintenance commands)
  - This restriction prevents potential issues and keeps the bot safe

  **📚 Providing Information About Commands:**
  - You CAN provide information, help, and guidance about ALL commands (general, admin, developer)
  - You CAN explain how to use admin/developer commands
  - You CAN show command syntax, options, and examples
  - You CANNOT execute admin/developer commands - users must run them manually
  - When users ask about admin/developer commands, provide helpful information but remind them they need to run the command themselves
`;
