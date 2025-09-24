// mypafreact/paf-system-backend-node/services/logger.js
const fs = require('fs');
const path = require('path');

// Define the path for the log file.
// path.join ensures it works on any OS.
// Using '..' to go up one level from /services to the project root.
const logFilePath = path.join(__dirname, '..', 'logs', 'activity.log');

// Ensure the /logs directory exists.
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Logs a message to the activity log file.
 * @param {string} level - The level of the log (e.g., 'INFO', 'ACTION', 'ERROR').
 * @param {string} message - The descriptive message to log.
 * @param {object} [details={}] - Optional object with details like user email, IP address, etc.
 */
const logActivity = (level, message, details = {}) => {
  // Create a timestamp in a readable format (e.g., 2024-07-16 14:30:15)
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  // Combine user and IP info if available
  const userInfo = details.user ? `User: ${details.user}` : '';
  const ipInfo = details.ip ? `IP: ${details.ip}` : '';
  const contextInfo = [userInfo, ipInfo].filter(Boolean).join(' | '); // Joins with '|' if both exist

  // Format the final log entry
  const logEntry = `${timestamp} [${level.toUpperCase()}] ${message} | ${contextInfo}\n`;

  // Append the log entry to the file.
  // Using 'a' for append flag. The callback handles errors.
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      console.error('Failed to write to activity log:', err);
    }
  });

  // Also log to the console for real-time visibility during development
  console.log(logEntry.trim());
};

module.exports = logActivity;