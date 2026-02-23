/**
 * security.ts — Centralized security configuration constants
 *
 * All security-related thresholds, policies, and restrictions in one place.
 * Imported by auth guards, form validation, file upload handlers, etc.
 */

// ---------------------------------------------------------------------------
// Allowed Origins
// ---------------------------------------------------------------------------

/** Origins allowed for CORS and postMessage communication */
export const ALLOWED_ORIGINS = [
  'https://sourceco.co',
  'https://www.sourceco.co',
  'https://app.sourceco.co',
  // Supabase project URL
  'https://vhzipqarkmmfuqadefep.supabase.co',
  // Development
  ...(import.meta.env.DEV
    ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
    : []),
] as const;

/**
 * Check if an origin is in the allowed list.
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return (ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

// ---------------------------------------------------------------------------
// Session & Authentication
// ---------------------------------------------------------------------------

export const SESSION_CONFIG = {
  /** Session timeout in milliseconds (30 minutes of inactivity) */
  IDLE_TIMEOUT_MS: 30 * 60 * 1000,

  /** Maximum session lifetime in milliseconds (24 hours) */
  MAX_LIFETIME_MS: 24 * 60 * 60 * 1000,

  /** Session heartbeat interval in milliseconds (5 minutes) */
  HEARTBEAT_INTERVAL_MS: 5 * 60 * 1000,

  /** Warning before session timeout in milliseconds (5 minutes) */
  TIMEOUT_WARNING_MS: 5 * 60 * 1000,

  /** Maximum concurrent sessions per user */
  MAX_CONCURRENT_SESSIONS: 5,

  /** Auto-refresh tokens before they expire (handled by Supabase client) */
  AUTO_REFRESH_THRESHOLD_S: 60,
} as const;

// ---------------------------------------------------------------------------
// Password Policy
// ---------------------------------------------------------------------------

export const PASSWORD_POLICY = {
  /** Minimum password length */
  MIN_LENGTH: 8,

  /** Maximum password length (prevent DoS via bcrypt) */
  MAX_LENGTH: 128,

  /** Require at least one uppercase letter */
  REQUIRE_UPPERCASE: true,

  /** Require at least one lowercase letter */
  REQUIRE_LOWERCASE: true,

  /** Require at least one digit */
  REQUIRE_NUMBERS: true,

  /** Require at least one special character */
  REQUIRE_SPECIAL: true,

  /** Maximum password age in days before forced change */
  MAX_AGE_DAYS: 90,

  /** Number of previous passwords to check against reuse */
  PREVENT_REUSE_COUNT: 3,

  /** Minimum time between password changes (prevent rapid cycling) in minutes */
  MIN_CHANGE_INTERVAL_MINUTES: 5,

  /** List of special characters that satisfy the special character requirement */
  SPECIAL_CHARACTERS: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~',
} as const;

/**
 * Validate a password against the password policy.
 * Returns an array of violation messages (empty = compliant).
 */
export function validatePasswordPolicy(password: string): string[] {
  const violations: string[] = [];

  if (!password || typeof password !== 'string') {
    return ['Password is required.'];
  }

  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    violations.push(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_POLICY.MAX_LENGTH) {
    violations.push(`Password must be no more than ${PASSWORD_POLICY.MAX_LENGTH} characters.`);
  }
  if (PASSWORD_POLICY.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    violations.push('Password must contain at least one uppercase letter.');
  }
  if (PASSWORD_POLICY.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    violations.push('Password must contain at least one lowercase letter.');
  }
  if (PASSWORD_POLICY.REQUIRE_NUMBERS && !/\d/.test(password)) {
    violations.push('Password must contain at least one number.');
  }
  if (PASSWORD_POLICY.REQUIRE_SPECIAL) {
    const escaped = PASSWORD_POLICY.SPECIAL_CHARACTERS.replace(
      /[-[\]{}()*+?.,\\^$|#\s]/g,
      '\\$&'
    );
    const specialRegex = new RegExp(`[${escaped}]`);
    if (!specialRegex.test(password)) {
      violations.push('Password must contain at least one special character.');
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// File Upload Restrictions
// ---------------------------------------------------------------------------

export const FILE_UPLOAD_CONFIG = {
  /** Maximum file size in bytes (50 MB) */
  MAX_SIZE_BYTES: 50 * 1024 * 1024,

  /** Maximum file size for images in bytes (10 MB) */
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024,

  /** Allowed MIME types for document uploads */
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain',
  ] as readonly string[],

  /** Allowed MIME types for image uploads */
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ] as readonly string[],

  /** Allowed file extensions (lowercase, with dot) */
  ALLOWED_EXTENSIONS: [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.csv', '.txt',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  ] as readonly string[],

  /** Blocked file extensions (never allow these regardless of MIME type) */
  BLOCKED_EXTENSIONS: [
    '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.mjs',
    '.php', '.py', '.rb', '.pl', '.cgi',
    '.dll', '.so', '.dylib',
    '.msi', '.dmg', '.app',
    '.scr', '.com', '.pif',
    '.jar', '.war', '.class',
  ] as readonly string[],

  /** Maximum filename length */
  MAX_FILENAME_LENGTH: 255,
} as const;

/**
 * Validate a file against the upload restrictions.
 * Returns an array of violation messages (empty = valid).
 */
export function validateFileUpload(
  file: File,
  options: {
    isImage?: boolean;
    customMaxSize?: number;
    customAllowedTypes?: readonly string[];
  } = {}
): string[] {
  const violations: string[] = [];
  const { isImage = false, customMaxSize, customAllowedTypes } = options;

  // Check filename length
  if (file.name.length > FILE_UPLOAD_CONFIG.MAX_FILENAME_LENGTH) {
    violations.push(`Filename must be no more than ${FILE_UPLOAD_CONFIG.MAX_FILENAME_LENGTH} characters.`);
  }

  // Check blocked extensions
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if ((FILE_UPLOAD_CONFIG.BLOCKED_EXTENSIONS as readonly string[]).includes(extension)) {
    violations.push(`File type "${extension}" is not allowed.`);
    return violations; // Block immediately
  }

  // Check allowed extensions
  if (!(FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    violations.push(`File type "${extension}" is not supported.`);
  }

  // Check file size
  const maxSize = customMaxSize ?? (isImage
    ? FILE_UPLOAD_CONFIG.MAX_IMAGE_SIZE_BYTES
    : FILE_UPLOAD_CONFIG.MAX_SIZE_BYTES);
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    violations.push(`File size exceeds the ${maxMB} MB limit.`);
  }

  // Check MIME type
  const allowedTypes = customAllowedTypes ?? (isImage
    ? FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES
    : [...FILE_UPLOAD_CONFIG.ALLOWED_DOCUMENT_TYPES, ...FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES]);

  if (file.type && !(allowedTypes as readonly string[]).includes(file.type)) {
    violations.push(`File type "${file.type}" is not allowed.`);
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Rate Limiting Thresholds
// ---------------------------------------------------------------------------

export const RATE_LIMIT_CONFIG = {
  /** Login attempts: max per window */
  LOGIN_MAX_ATTEMPTS: 5,
  /** Login attempts: window in seconds */
  LOGIN_WINDOW_SECONDS: 300,

  /** API calls: max per window */
  API_MAX_REQUESTS: 100,
  /** API calls: window in seconds */
  API_WINDOW_SECONDS: 60,

  /** Form submissions: minimum interval in milliseconds */
  FORM_MIN_INTERVAL_MS: 2000,

  /** Search queries: max per window */
  SEARCH_MAX_REQUESTS: 30,
  /** Search queries: window in seconds */
  SEARCH_WINDOW_SECONDS: 60,

  /** File uploads: max per window */
  UPLOAD_MAX_REQUESTS: 10,
  /** File uploads: window in seconds */
  UPLOAD_WINDOW_SECONDS: 300,
} as const;

// ---------------------------------------------------------------------------
// Input Length Limits
// ---------------------------------------------------------------------------

export const INPUT_LIMITS = {
  /** Maximum length for text inputs (name, title, etc.) */
  TEXT_SHORT: 255,
  /** Maximum length for medium text (description, bio) */
  TEXT_MEDIUM: 2000,
  /** Maximum length for long text (rich text content) */
  TEXT_LONG: 50000,
  /** Maximum length for email addresses */
  EMAIL: 254,
  /** Maximum length for URLs */
  URL: 2048,
  /** Maximum length for phone numbers */
  PHONE: 30,
  /** Maximum length for search queries */
  SEARCH_QUERY: 500,
} as const;
