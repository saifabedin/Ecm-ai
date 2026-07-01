const dotenv = require("dotenv");
const { join } = require("path");
const fs = require("fs");

dotenv.config({ path: join(__dirname, "../../.env") });

const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "REDIS_HOST",
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("[Security] Missing required environment variables:", missingVars);
  console.error("[Security] Please set these variables in your .env file");
  process.exit(1);
}

if (process.env.JWT_SECRET === "your-secret-key" || process.env.JWT_SECRET === "supersecretkey") {
console.warn("[Security] WARNING: Using default JWT_SECRET. Please set a strong secret in production!");
}

const securityConfig = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:4000"],
};

module.exports = securityConfig;