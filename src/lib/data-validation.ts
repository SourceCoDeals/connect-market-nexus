/**
 * Data validation utilities for the application's core domain objects.
 *
 * Uses Zod (v3 compat from zod v4 package — matching the rest of this
 * codebase's `import { z } from 'zod/v3'` convention) to define schemas
 * and expose typed validation functions.
 */

import { z } from 'zod/v3';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Schema for a deal / listing object coming from the API or CSV import. */
export const dealSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(500),
  category: z.string().min(1, 'Category is required').optional(),
  categories: z.array(z.string()).optional(),
  location: z.string().min(1, 'Location is required'),
  revenue: z
    .number({ invalid_type_error: 'Revenue must be a number' })
    .nonnegative('Revenue must be non-negative'),
  ebitda: z
    .number({ invalid_type_error: 'EBITDA must be a number' })
    .nonnegative('EBITDA must be non-negative'),
  description: z.string().min(1, 'Description is required'),
  description_html: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  image_url: z.string().url('Invalid image URL').nullish(),
  executive_summary: z.string().nullish(),
  hero_description: z.string().nullish(),
  owner_notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/** Schema for a user profile. */
export const profileSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email('Invalid email address'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  company: z.string().optional(),
  company_name: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  phone_number: z.string().optional(),
  role: z.enum(['admin', 'buyer']).optional(),
  buyer_type: z
    .enum([
      'corporate',
      'privateEquity',
      'familyOffice',
      'searchFund',
      'individual',
      'independentSponsor',
      'advisor',
      'businessOwner',
    ])
    .optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  bio: z.string().optional(),
  linkedin_profile: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  business_categories: z.array(z.string()).optional(),
  target_locations: z.union([z.array(z.string()), z.string()]).optional(),
  onboarding_completed: z.boolean().optional(),
});

/** Schema for a connection request. */
export const connectionRequestSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid('Invalid user ID'),
  listing_id: z.string().uuid('Invalid listing ID'),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  user_message: z.string().max(2000, 'Message too long').optional(),
  admin_comment: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type DealInput = z.infer<typeof dealSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{ path: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

function runValidation<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Validate a deal / listing object.
 *
 * @example
 * ```ts
 * const result = validateDeal(rawData);
 * if (!result.success) console.error(result.errors);
 * ```
 */
export function validateDeal(data: unknown): ValidationResult<DealInput> {
  return runValidation(dealSchema, data);
}

/**
 * Validate a user profile object.
 */
export function validateProfile(
  data: unknown,
): ValidationResult<ProfileInput> {
  return runValidation(profileSchema, data);
}

/**
 * Validate a connection request object.
 */
export function validateConnectionRequest(
  data: unknown,
): ValidationResult<ConnectionRequestInput> {
  return runValidation(connectionRequestSchema, data);
}

// ---------------------------------------------------------------------------
// Convenience: strict parse (throws on failure)
// ---------------------------------------------------------------------------

/**
 * Parse deal data, throwing a descriptive error on validation failure.
 */
export function parseDeal(data: unknown): DealInput {
  return dealSchema.parse(data);
}

/**
 * Parse profile data, throwing a descriptive error on validation failure.
 */
export function parseProfile(data: unknown): ProfileInput {
  return profileSchema.parse(data);
}

/**
 * Parse connection request data, throwing a descriptive error on validation
 * failure.
 */
export function parseConnectionRequest(
  data: unknown,
): ConnectionRequestInput {
  return connectionRequestSchema.parse(data);
}
