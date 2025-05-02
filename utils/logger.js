const fs = require("fs");
const path = require("path");
const colors = require("colors/safe");

// initialize colors configuration
colors.setTheme({
  info: "cyan",
  success: "green",
  warn: "yellow",
  error: "red",
  debug: "magenta",
  value: "white", // for variable values
});

// Function to strip ANSI color codes from strings
function stripColorCodes(str) {
  // This regex pattern matches ANSI escape sequences
  return str.replace(/\u001b\[\d+m/g, "");
}

class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.logDir = path.join(__dirname, "../logs");
    this.logFile = path.join(this.logDir, `${moduleName}.log`);

    // create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // create log file if it doesn't exist
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, "");
    }
  }

  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();

    // fixed width columns for better readability
    const timestampStr = `[${timestamp}]`.padEnd(27);
    const levelStr = `[${level}]`.padEnd(12);
    const moduleStr = `[${this.moduleName}]`.padEnd(20);

    // add a separator for visual distinction between metadata and message
    const prefix = `${timestampStr} ${levelStr} ${moduleStr} │ `;
    return prefix + message;
  }

  _log(level, message, color) {
    const formattedMessage = this._formatMessage(level, message);
    console.log(colors[color](formattedMessage));

    // Strip color codes before writing to file
    const cleanMessage = stripColorCodes(formattedMessage);

    // append log to file
    fs.appendFileSync(this.logFile, cleanMessage + "\n");

    return formattedMessage;
  }

  /**
   * formats a variable value for display in logs
   * @param {any} val - the value to format
   * @returns {string} - formatted value
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
