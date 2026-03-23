import { z } from "zod";

function readRequiredEnv(name: string, schema: z.ZodType<string>) {
  const value = process.env[name];
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variable ${name}: ${
        value == null ? "value is missing" : parsed.error.issues.map((issue) => issue.message).join(", ")
      }`,
    );
  }

  return parsed.data;
}

function readOptionalEnv(name: string, schema: z.ZodType<string>) {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  return schema.parse(value);
}

function readNumberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = z.coerce.number().int().positive().safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid environment variable ${name}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
  }

  return parsed.data;
}

export const env = {
  get DATABASE_URL() {
    return readRequiredEnv("DATABASE_URL", z.string().url());
  },
  get APP_URL() {
    return readRequiredEnv("APP_URL", z.string().url());
  },
  get SESSION_SECRET() {
    return readRequiredEnv("SESSION_SECRET", z.string().min(16));
  },
  get TOKEN_ENCRYPTION_KEY() {
    return readRequiredEnv("TOKEN_ENCRYPTION_KEY", z.string().min(16));
  },
  get CRON_SECRET() {
    return readRequiredEnv("CRON_SECRET", z.string().min(16));
  },
  get SPOTIFY_CLIENT_ID() {
    return readRequiredEnv("SPOTIFY_CLIENT_ID", z.string().min(1));
  },
  get SPOTIFY_CLIENT_SECRET() {
    return readRequiredEnv("SPOTIFY_CLIENT_SECRET", z.string().min(1));
  },
  get SPOTIFY_REDIRECT_URI() {
    return readRequiredEnv("SPOTIFY_REDIRECT_URI", z.string().url());
  },
  get MAIN_PLAYLIST_ID() {
    return readRequiredEnv("MAIN_PLAYLIST_ID", z.string().min(1));
  },
  get ARCHIVE_PLAYLIST_ID() {
    return readRequiredEnv("ARCHIVE_PLAYLIST_ID", z.string().min(1));
  },
  get SYNC_INTERVAL_MINUTES() {
    return readNumberEnv("SYNC_INTERVAL_MINUTES", 60);
  },
  get DISCORD_WEBHOOK_URL() {
    return readOptionalEnv("DISCORD_WEBHOOK_URL", z.string().url());
  },
};
