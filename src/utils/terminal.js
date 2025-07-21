import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";

/**
 * Color schemes for terminal output.
 */
export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  highlight: chalk.cyan,
  cyan: chalk.cyan,
  magenta: chalk.magenta,
  bold: chalk.bold,
  dim: chalk.dim,
};

/**
 * Emoji icons for terminal output.
 */
export const icons = {
  bot: "🤖",
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "📖",
  rocket: "🚀",
  lightning: "⚡",
  party: "🎉",
  link: "🔗",
  server: "🌐",
  folder: "📁",
};

/**
 * Creates a beautiful info box.
 * @param {string} title - Box title.
 * @param {string|string[]} content - Box content.
 * @param {object} options - Boxen options.
 * @returns {string} The formatted box.
 */
export function createInfoBox(title, content, options = {}) {
  const boxOptions = {
    title,
    titleAlignment: "center",
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "cyan",
    ...options,
  };
  const contentText = Array.isArray(content) ? content.join("\n") : content;
  return boxen(contentText, boxOptions);
}

/**
 * Creates a success message.
 * @param {string} message - The success message.
 * @returns {string} The formatted message.
 */
export function createSuccessMessage(message) {
  return `${icons.success} ${colors.success.bold(message)}`;
}

/**
 * Creates an error message.
 * @param {string} message - The error message.
 * @returns {string} The formatted message.
 */
export function createErrorMessage(message) {
  return `${icons.error} ${colors.error.bold(message)}`;
}

/**
 * Creates a warning message.
 * @param {string} message - The warning message.
 * @returns {string} The formatted message.
 */
export function createWarningMessage(message) {
  return `${icons.warning} ${colors.warning.bold(message)}`;
}

/**
 * Creates a simple header for terminal output.
 * @param {string} text - The header text.
 * @param {string} color - The color of the header.
 * @returns {string} The formatted header.
 */
export function createHeader(text, color = "cyan") {
  const colorFn = chalk[color] || chalk.cyan;
  const line = "═".repeat(text.length + 4);
  return `\n${colorFn(line)}\n${colorFn.bold(`  ${text}  `)}\n${colorFn(line)}`;
}

/**
 * Creates a spinner for long-running operations.
 * @param {string} text - The text to display next to the spinner.
 * @returns {import("ora").Ora} The spinner instance.
 */
export function createSpinner(text = "Loading...") {
  return ora({
    text,
    color: "cyan",
    spinner: "dots",
  });
}
