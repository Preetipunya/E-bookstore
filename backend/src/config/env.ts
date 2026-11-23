import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

function required(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  return devDefault;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://bookworm:bookworm@localhost:5432/bookworm'),
  jwtSecret: required('JWT_SECRET', 'dev-only-jwt-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080').split(',').map((s) => s.trim()),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? (process.env.NODE_ENV === 'test' ? 4 : 10)),
};
