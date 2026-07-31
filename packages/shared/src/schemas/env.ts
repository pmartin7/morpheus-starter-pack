import { z } from 'zod';

export const EnvSchema = z.object({
  // Database
  NEON_DATABASE_URL: z.string().url(),

  // Firebase Admin SDK
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),

  // Firebase Auth emulator, for local dev and the auth-journey harness. When
  // set, the Admin SDK trusts tokens without verifying signatures — main.ts
  // refuses to boot if it is ever set in production.
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),

  // AI Providers
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEFAULT_AI_MODEL: z.string().min(1),

  // Observability (optional)
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_DATASET: z.string().optional(),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Vercel Blob (optional)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;
