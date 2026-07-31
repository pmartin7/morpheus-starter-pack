import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { EnvSchema } from './env.js';

// A fresh copy per test: no shared mutable state, and each test states exactly
// which variables it removes or overrides.
function requiredEnv(): Record<string, string> {
  return {
    NEON_DATABASE_URL: 'postgres://user:secret@db.neon.tech/morpheus',
    FIREBASE_PROJECT_ID: 'morpheus-test',
    FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    FIREBASE_CLIENT_EMAIL: 'admin@morpheus-test.iam.gserviceaccount.com',
    DEFAULT_AI_MODEL: 'claude-sonnet-4-5',
  };
}

function rejectionOf(env: Record<string, string>): ZodError {
  const result = EnvSchema.safeParse(env);
  if (result.success) throw new Error('expected EnvSchema to reject this environment');
  return result.error;
}

describe('EnvSchema', () => {
  it('parses an environment that sets every variable', () => {
    const env = EnvSchema.parse({
      ...requiredEnv(),
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      OPENAI_API_KEY: 'sk-test',
      AXIOM_TOKEN: 'xaat-test',
      AXIOM_DATASET: 'morpheus',
      NODE_ENV: 'production',
      PORT: '8080',
      CORS_ORIGIN: 'https://morpheus.example.com',
      BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.CORS_ORIGIN).toBe('https://morpheus.example.com');
    // Process env values are strings; PORT is coerced so callers get a number.
    expect(env.PORT).toBe(8080);
  });

  it('names the offending variable when a required one is missing', () => {
    const { FIREBASE_PROJECT_ID: _missing, ...withoutProjectId } = requiredEnv();

    const error = rejectionOf(withoutProjectId);

    // The name has to survive into the failure: a fresh clone whose boot fails
    // with "invalid environment" and nothing else costs an hour of guessing.
    expect(error.flatten().fieldErrors.FIREBASE_PROJECT_ID).toBeDefined();
    expect(error.message).toContain('FIREBASE_PROJECT_ID');
  });

  it('rejects a required variable that is present but malformed', () => {
    const error = rejectionOf({ ...requiredEnv(), FIREBASE_CLIENT_EMAIL: 'not-an-email' });

    expect(error.flatten().fieldErrors.FIREBASE_CLIENT_EMAIL).toBeDefined();
  });

  it('applies defaults for NODE_ENV, PORT and CORS_ORIGIN when they are omitted', () => {
    const env = EnvSchema.parse(requiredEnv());

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('accepts an environment with none of the optional variables set', () => {
    const env = EnvSchema.parse(requiredEnv());

    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
    expect(env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
  });
});
