import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireEnvOr(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  port: parseInt(requireEnvOr('PORT', '3001'), 10),
  nodeEnv: requireEnvOr('NODE_ENV', 'development'),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: requireEnvOr('JWT_EXPIRES_IN', '7d'),
  frontendUrl: requireEnv('FRONTEND_URL'),
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    bucketName: process.env.GCP_BUCKET_NAME,
    keyFile: process.env.GCP_KEY_FILE,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
  },
};

// Validate production requirements
if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'secret' || config.jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to a secure value (at least 32 characters) in production. ' +
      'Current value is insecure.'
    );
  }
  
  if (!config.gcp.projectId || !config.gcp.bucketName || !config.gcp.keyFile) {
    console.warn(
      'Warning: GCP configuration is incomplete. File uploads will not work in production.'
    );
  }
}

