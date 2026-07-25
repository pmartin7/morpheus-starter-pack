import { EnvSchema } from '@morpheus/shared';

export { EnvSchema };

export function validateEnv(): void {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors
      .map(
        (e: { path: (string | number)[]; message: string }) =>
          `  ${e.path.join('.')}: ${e.message}`,
      )
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
}
