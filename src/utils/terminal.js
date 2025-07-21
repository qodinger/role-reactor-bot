import chalk from "chalk";
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
};

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
