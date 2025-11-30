/**
 * Environment Configuration Module
 * Loads and validates required environment variables
 * Validates: Requirements 11.1, 11.2, 11.3, 11.5
 */

function loadAndValidateEnv() {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingVars = [];

  // Check for required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // If any required variables are missing, log error and refuse to start
  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error(`[ENV ERROR] ${errorMessage}`);
    throw new Error(errorMessage);
  }

  // Build configuration object with defaults
  const config = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10)
  };

  return config;
}

module.exports = loadAndValidateEnv;
