const fs = require("fs");
const path = require("path");
const colors = require("colors/safe");

// Initialize colors configuration
colors.setTheme({
  info: "cyan",
  success: "green",
  warn: "yellow",
  error: "red",
  debug: "magenta",
  value: "white", // for variable values
});

class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.logDir = path.join(__dirname, "../logs");
    this.logFile = path.join(this.logDir, `${moduleName}.log`);

    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Create log file if it doesn't exist
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, "");
    }
  }

  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();

    // Fixed width columns for better readability - increased padding for better alignment
    const timestampStr = `[${timestamp}]`.padEnd(27); // Timestamp is about 24 chars + brackets
    const levelStr = `[${level}]`.padEnd(12); // Increased to 12 from 8 to fit [SUCCESS]
    const moduleStr = `[${this.moduleName}]`.padEnd(20); // Increased to 20 from 15 for longer module names

    // Add a separator for visual distinction between metadata and message
    const prefix = `${timestampStr} ${levelStr} ${moduleStr} │ `;
    return prefix + message;
  }

  _log(level, message, color) {
    const formattedMessage = this._formatMessage(level, message);
    console.log(colors[color](formattedMessage));

    // File logs don't need fancy formatting - keep it plain
    fs.appendFileSync(this.logFile, formattedMessage + "\n");

    return formattedMessage;
  }

  /**
   * Formats a variable value for display in logs
   * @param {any} val - The value to format
   * @returns {string} - Formatted value
   */
  val(val) {
    if (val === null) {
      return colors.value("null");
    } else if (val === undefined) {
      return colors.value("undefined");
    } else {
      return colors.value(`${val}`);
    }
  }

  info(message) {
    return this._log("INFO", message, "info");
  }

  success(message) {
    return this._log("SUCCESS", message, "success");
  }

  warn(message) {
    return this._log("WARN", message, "warn");
  }

  error(message) {
    return this._log("ERROR", message, "error");
  }

  debug(message) {
    return this._log("DEBUG", message, "debug");
  }
}

module.exports = (moduleName) => new Logger(moduleName);
