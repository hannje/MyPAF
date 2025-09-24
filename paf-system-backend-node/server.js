// paf-system-backend-node/server.js
// Server startup - imports Express app from app.js module

require('dotenv').config();

const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env';
require('dotenv-expand').expand(require('dotenv').config({ path: `./${envFile}` }));

console.log('Environment:', process.env.NODE_ENV);

// Enhanced logging with timestamps
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

console.log = function(...args) {
    originalConsoleLog(`[${getTimestamp()}]`, ...args);
};

console.error = function(...args) {
    originalConsoleError(`[${getTimestamp()}] ERROR:`, ...args);
};

// Import the Express app from app.js
const { app } = require('./app');
const https = require('https');
const http = require('http');
const fs = require('fs');

// Server configuration
const HTTP_PORT = process.env.PORT || 8081;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

console.log(`Starting PAF System Backend...`);
console.log(`HTTP Port: ${HTTP_PORT}, HTTPS Port: ${HTTPS_PORT}`);

// Start HTTPS server if certificates are available, otherwise fall back to HTTP
try {
  // Try to read SSL certificate files
  const privateKey = fs.readFileSync('./certs/key.pem', 'utf8');
  const certificate = fs.readFileSync('./certs/cert.pem', 'utf8');
  const options = { key: privateKey, cert: certificate };

  // Start HTTPS server
  https.createServer(options, app).listen(HTTPS_PORT, () => {
    console.log(`✅ PAF System Backend is running securely on port ${HTTPS_PORT}.`);
    console.log(`   Access via: https://localhost:${HTTPS_PORT} or https://10.72.14.19:${HTTPS_PORT}`);
  });

} catch (error) {
  console.error("❌ Could not start HTTPS server. Error reading certificate files from './certs/' directory.", error.message);
  console.log("   Falling back to HTTP for development.");

  // Fallback to HTTP if certs are not found
  app.listen(HTTP_PORT, () => {
    console.log(`⚠️ PAF System Backend is running on insecure HTTP on port ${HTTP_PORT}.`);
  });
}