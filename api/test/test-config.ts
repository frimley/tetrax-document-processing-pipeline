import { ConfigModule } from "@nestjs/config";

export const testConfig = () => ({
  // Database Configuration (use in-memory for tests)
  DATABASE_URL: "postgresql://test:test@localhost:5432/tetrax_test",

  // Redis Configuration (mock or test instance)
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  REDIS_PASSWORD: "",

  // S3/MinIO Configuration (mock for tests)
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key",
  S3_ENDPOINT: "http://localhost:9000",
  S3_FORCE_PATH_STYLE: "true",
  S3_BUCKET: "test-bucket",

  // JWT Configuration
  JWT_SECRET: "test-jwt-secret",

  // Application Configuration
  PORT: "3002",
  NODE_ENV: "test",

  // Health Check Security (disabled for tests)
  HEALTH_CHECK_IP_WHITELIST: "127.0.0.1,::1",
  HEALTH_CHECK_RATE_LIMIT_WINDOW_MS: "60000",
  HEALTH_CHECK_RATE_LIMIT_MAX_REQUESTS: "1000", // Higher limit for tests
});

export const TestConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  load: [testConfig],
  ignoreEnvFile: true, // Don't load .env files during testing
});
