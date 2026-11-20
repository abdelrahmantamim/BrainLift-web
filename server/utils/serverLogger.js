import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'server-logs.log');

// Create a write stream that appends to the log file
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Function to format timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Logger function that writes to both console and file
function serverLog(level, category, message, ...args) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${level}] [${category}]`;
  
  // Format the message
  const fullMessage = `${prefix} ${message}`;
  
  // Write to console with color
  if (level === 'ERROR') {
    console.error(fullMessage, ...args);
  } else {
    console.log(fullMessage, ...args);
  }
  
  // Write to file
  const logEntry = args.length > 0 
    ? `${fullMessage} ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
      ).join(' ')}\n`
    : `${fullMessage}\n`;
    
  logStream.write(logEntry);
}

// Convenience methods
const logger = {
  log: (category, message, ...args) => serverLog('INFO', category, message, ...args),
  info: (category, message, ...args) => serverLog('INFO', category, message, ...args),
  warn: (category, message, ...args) => serverLog('WARN', category, message, ...args),
  error: (category, message, ...args) => serverLog('ERROR', category, message, ...args),
  debug: (category, message, ...args) => serverLog('DEBUG', category, message, ...args),
};

// Log startup
logger.info('ServerLogger', 'Server logging initialized');
logger.info('ServerLogger', `Logging to: ${logFile}`);

export default logger;
export { serverLog };