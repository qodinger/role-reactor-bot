import chalk from "chalk";
import boxen from "boxen";
import gradient from "gradient-string";
import ora from "ora";

/**
 * Terminal beautification utilities for the Discord bot
 */

// Color schemes
export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  highlight: chalk.cyan,
  magenta: chalk.magenta,
  yellow: chalk.yellow,
  blue: chalk.blue,
  green: chalk.green,
  cyan: chalk.cyan,
  bold: chalk.bold,
  dim: chalk.dim,
  white: chalk.white,
};

// Emoji icons
export const icons = {
  bot: "🤖",
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "📖",
  server: "🌐",
  users: "👥",
  memory: "💾",
  time: "🕒",
  link: "🔗",
  permissions: "📋",
  rocket: "🚀",
  party: "🎉",
  gear: "⚙️",
  heart: "❤️",
  arrow: "→",
  bullet: "•",
  star: "★",
  lightning: "⚡",
};

/**
 * Create a minimal header without box
 * @param {string} text - Header text
 * @param {string} color - Header color
 * @returns {string} - Formatted header
 */
export function createHeader(text, color = "cyan") {
  const colorFn = chalk[color] || chalk.cyan;
  const line = "═".repeat(text.length + 4);
  return `\n${colorFn(line)}\n${colorFn.bold(`  ${text}  `)}\n${colorFn(line)}`;
}

/**
 * Create a simple section divider
 * @param {string} text - Section title
 * @param {string} color - Color for the divider
 * @returns {string} - Formatted divider
 */
export function createDivider(text, color = "gray") {
  const colorFn = colors[color] || colors.gray;
  return `\n${colorFn("─".repeat(60))}\n${colorFn.bold(`${text}`)}\n${colorFn("─".repeat(60))}`;
}

/**
 * Create a beautiful info box (only for important messages)
 * @param {string} title - Box title
 * @param {string|string[]} content - Box content
 * @param {Object} options - Box options
 * @returns {string} - Formatted box
 */
export function createInfoBox(title, content, options = {}) {
  const defaultOptions = {
    title,
    titleAlignment: "center",
    padding: 1,
    margin: 0,
    borderStyle: "round",
    borderColor: "cyan",
  };

  const boxOptions = { ...defaultOptions, ...options };
  const contentText = Array.isArray(content) ? content.join("\n") : content;

  return boxen(contentText, boxOptions);
}

/**
 * Create a success message without box
 * @param {string} message - Success message
 * @param {boolean} useBox - Whether to use a box (default: false)
 * @returns {string} - Formatted success message
 */
export function createSuccessMessage(message, useBox = false) {
  if (useBox) {
    return boxen(gradient.rainbow(message), {
      title: icons.party,
      titleAlignment: "center",
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "green",
    });
  }

  return `${icons.success} ${colors.success.bold(message)}`;
}

/**
 * Create an error message without box
 * @param {string} message - Error message
 * @param {boolean} useBox - Whether to use a box (default: false)
 * @returns {string} - Formatted error message
 */
export function createErrorMessage(message, useBox = false) {
  if (useBox) {
    return boxen(chalk.red(message), {
      title: icons.error,
      titleAlignment: "center",
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
  }

  return `${icons.error} ${colors.error.bold(message)}`;
}

/**
 * Create a warning message without box
 * @param {string} message - Warning message
 * @param {boolean} useBox - Whether to use a box (default: false)
 * @returns {string} - Formatted warning message
 */
export function createWarningMessage(message, useBox = false) {
  if (useBox) {
    return boxen(chalk.yellow(message), {
      title: icons.warning,
      titleAlignment: "center",
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "yellow",
    });
  }

  return `${icons.warning} ${colors.warning.bold(message)}`;
}

/**
 * Create a loading spinner
 * @param {string} text - Loading text
 * @returns {Object} - Ora spinner instance
 */
export function createSpinner(text = "Loading...") {
  return ora({
    text,
    color: "cyan",
    spinner: "dots",
  });
}

/**
 * Log a clean section divider
 * @param {string} text - Section title
 * @param {string} color - Color for the section
 */
export function logSection(text, color = "cyan") {
  const colorFn = colors[color] || colors.cyan;
  console.log(`\n${colorFn("─".repeat(60))}`);
  console.log(colorFn.bold(`${icons.arrow} ${text}`));
  console.log(colorFn("─".repeat(60)));
}

/**
 * Log colored status information
 * @param {string} icon - Status icon
 * @param {string} label - Status label
 * @param {string} value - Status value
 * @param {string} color - Text color
 */
export function logStatus(icon, label, value, color = "white") {
  const colorFn = colors[color] || colors.white;
  console.log(`${icon} ${colors.bold(label)}: ${colorFn(value)}`);
}

/**
 * Log a simple key-value pair
 * @param {string} key - Key name
 * @param {string} value - Value
 * @param {string} keyColor - Key color
 * @param {string} valueColor - Value color
 */
export function logKeyValue(
  key,
  value,
  keyColor = "cyan",
  valueColor = "white",
) {
  const keyColorFn = colors[keyColor] || colors.cyan;
  const valueColorFn = colors[valueColor] || colors.white;
  console.log(`  ${keyColorFn(key)}: ${valueColorFn(value)}`);
}

/**
 * Log a list item
 * @param {string} text - List item text
 * @param {string} color - Text color
 * @param {string} bulletIcon - Bullet icon
 */
export function logListItem(text, color = "white", bulletIcon = icons.bullet) {
  const colorFn = colors[color] || colors.white;
  console.log(`  ${colors.dim(bulletIcon)} ${colorFn(text)}`);
}

/**
 * Create a table with methods for testing
 * @param {Array} headers - Column headers
 * @returns {Object} - Table object with methods
 */
export function createTable(headers = []) {
  const rows = [];

  return {
    addRow: rowData => {
      rows.push(rowData);
    },
    display: () => {
      if (headers.length > 0) {
        console.log(headers.join(" | "));
        console.log("-".repeat(headers.join(" | ").length));
      }
      rows.forEach(row => {
        console.log(row.join(" | "));
      });
    },
    getRowCount: () => rows.length,
    getHeaders: () => headers,
  };
}

/**
 * Print bot statistics in a clean format
 * @param {Object} stats - Bot statistics
 */
export function printBotStats(stats) {
  logStatus(icons.success, "Status", colors.success("ONLINE"), "green");
  logStatus(icons.bot, "Bot Name", stats.botName, "highlight");
  logStatus(icons.info, "Bot ID", stats.botId, "yellow");
  logStatus(icons.server, "Servers", stats.servers.toLocaleString(), "magenta");
  logStatus(
    icons.users,
    "Total Users",
    stats.users.toLocaleString(),
    "highlight",
  );
  logStatus(icons.time, "Started at", stats.startTime, "muted");
  logStatus(icons.memory, "Memory Usage", `${stats.memoryUsage} MB`, "blue");

  console.log();
}

/**
 * Print a progress indicator
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {string} label - Progress label
 * @param {number} barLength - Length of progress bar
 */
export function printProgress(
  current,
  total,
  label = "Progress",
  barLength = 30,
) {
  const percentage = Math.round((current / total) * 100);
  const filledLength = Math.round((current / total) * barLength);
  const emptyLength = barLength - filledLength;

  const filled = colors.cyan("█".repeat(filledLength));
  const empty = colors.dim("░".repeat(emptyLength));
  const bar = `[${filled}${empty}]`;

  console.log(`  ${label}: ${bar} ${percentage}% (${current}/${total})`);
}

/**
 * Log a simple message with timestamp
 * @param {string} message - Message text
 * @param {string} level - Log level (info, success, error, warning)
 */
export function logMessage(message, level = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const timestampStr = colors.dim(`[${timestamp}]`);

  let icon, colorFn;

  switch (level) {
    case "success":
      icon = icons.success;
      colorFn = colors.success;
      break;
    case "error":
      icon = icons.error;
      colorFn = colors.error;
      break;
    case "warning":
      icon = icons.warning;
      colorFn = colors.warning;
      break;
    default:
      icon = icons.info;
      colorFn = colors.info;
  }

  console.log(`${timestampStr} ${icon} ${colorFn(message)}`);
}

/**
 * Create a beautiful welcome box (optionally with gradient text)
 * @param {string} titleText - The text to display in the box
 * @param {string} gradientType - The gradient type (default: undefined for no gradient)
 * @returns {string} - The formatted box
 */
export function createWelcomeBox(titleText, gradientType) {
  const content =
    gradientType && gradient[gradientType]
      ? gradient[gradientType](titleText)
      : titleText;
  return boxen(content, {
    padding: 1,
    margin: 0,
    borderStyle: "round",
    borderColor: "cyan",
    title: "RoleReactor",
    titleAlignment: "center",
  });
}

// Colorize text with specified color
export function colorize(text, color) {
  const colorFn = colors[color];
  if (!colorFn) {
    return text; // Return plain text for unknown colors
  }
  return colorFn(text);
}

// Log message with level
export function log(message, level = "info") {
  const levelColors = {
    error: "error",
    warning: "warning",
    success: "success",
    info: "info",
    debug: "info",
    DEBUG: "info", // Handle uppercase DEBUG
  };
  const color = levelColors[level] || "info";

  if (level === "ERROR" || level === "error") {
    console.error(colorize(message, color));
  } else {
    console.log(colorize(message, color));
  }
}

// Create progress bar
export function createProgressBar(total) {
  let current = 0;

  return {
    update: value => {
      if (value < 0 || value > total) {
        throw new Error("Invalid progress value");
      }
      current = value;
      const percentage = Math.round((current / total) * 100);
      console.log(`Progress: ${percentage}%`);
    },
    complete: () => {
      current = total;
      console.log("Progress: 100%");
    },
    getCurrent: () => current,
    getTotal: () => total,
  };
}

// Prompt for user input
export function prompt(message) {
  return new Promise(resolve => {
    process.stdout.write(message);
    // Check if stdin is available (for tests)
    if (process.stdin && typeof process.stdin.on === "function") {
      process.stdin.once("data", data => {
        resolve(data.toString().trim());
      });
    } else {
      // Fallback for test environment
      resolve("");
    }
  });
}

// Prompt with validation
export function promptWithValidation(message, validator) {
  return new Promise(resolve => {
    const ask = () => {
      prompt(message).then(input => {
        if (validator && !validator(input)) {
          console.log("Invalid input, please try again.");
          ask();
        } else {
          resolve(input);
        }
      });
    };
    ask();
  });
}

export default {
  colors,
  icons,
  createHeader,
  createDivider,
  createInfoBox,
  createSuccessMessage,
  createErrorMessage,
  createWarningMessage,
  createSpinner,
  logSection,
  logStatus,
  logKeyValue,
  logListItem,
  createTable,
  printBotStats,
  printProgress,
  logMessage,
  createWelcomeBox,
  colorize,
  log,
  createProgressBar,
  prompt,
  promptWithValidation,
};
