/**
 * Runtime validation for required environment variables.
 *
 * Call `validateEnv()` early in the application bootstrap (e.g. before
 * creating the Supabase client) so that missing configuration is surfaced
 * immediately with a clear, actionable error message.
 */

interface EnvVar {
  /** The import.meta.env key (e.g. "VITE_SUPABASE_URL"). */
  name: string;
  /** A human-readable description shown in error messages. */
  description: string;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  {
    name: 'VITE_SUPABASE_URL',
    description: 'Supabase project URL (e.g. https://<ref>.supabase.co)',
  },
  {
    name: 'VITE_SUPABASE_PUBLISHABLE_KEY',
    description: 'Supabase anonymous / publishable API key',
  },
  {
    name: 'VITE_SUPABASE_PROJECT_ID',
    description: 'Supabase project reference ID',
  },
];

/**
 * Validates that every required `VITE_*` environment variable is present and
 * non-empty.  Throws an `Error` whose message lists **all** missing variables
 * so that the developer can fix them in a single pass rather than one at a
 * time.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = (import.meta as Record<string, Record<string, string>>).env?.[envVar.name];
    if (!value || value.trim() === '') {
      missing.push(`  - ${envVar.name}: ${envVar.description}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      [
        'Missing required environment variables:',
        ...missing,
        '',
        'Create a .env file in the project root or set these variables in your',
        "hosting provider's environment configuration.",
      ].join('\n'),
    );
  }
}
