/**
 * auth-guard.ts — Authentication and authorization guard utilities
 *
 * Provides functions to enforce authentication and role-based access control.
 * Aligned with the existing AuthContext / useNuclearAuth patterns in this codebase,
 * where user data comes from the profiles table and is_admin is the canonical
 * admin flag (synced from user_roles via DB trigger).
 */

import { supabase } from '@/integrations/supabase/client';
import type { User, UserRole } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthGuardResult {
  authenticated: boolean;
  user: User | null;
  error?: string;
}

export class AuthError extends Error {
  public code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'SESSION_EXPIRED';

  constructor(
    message: string,
    code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'SESSION_EXPIRED' = 'UNAUTHENTICATED'
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Core Guards
// ---------------------------------------------------------------------------

/**
 * Require that a valid authenticated session exists.
 * Throws AuthError if there is no session or the session is expired.
 *
 * Uses supabase.auth.getSession() which is the same pattern used by
 * useNuclearAuth and BuyerDataRoom for session checks.
 *
 * @returns The authenticated Supabase session
 */
export async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw new AuthError(
      'Session validation failed: ' + error.message,
      'SESSION_EXPIRED'
    );
  }

  if (!session || !session.user) {
    throw new AuthError(
      'Authentication required. Please log in.',
      'UNAUTHENTICATED'
    );
  }

  // Validate the session hasn't expired
  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    throw new AuthError(
      'Session has expired. Please log in again.',
      'SESSION_EXPIRED'
    );
  }

  return session;
}

/**
 * Require that the current user has admin privileges.
 * Checks the profiles table is_admin flag, which is the canonical source
 * (synced from user_roles table via database trigger).
 *
 * @throws AuthError with code UNAUTHENTICATED if not logged in
 * @throws AuthError with code FORBIDDEN if not an admin
 */
export async function requireAdmin(): Promise<void> {
  const session = await requireAuth();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    throw new AuthError(
      'Unable to verify admin status.',
      'FORBIDDEN'
    );
  }

  if (profile.is_admin !== true) {
    throw new AuthError(
      'Admin access required. You do not have permission to perform this action.',
      'FORBIDDEN'
    );
  }
}

/**
 * Require that the current user has a specific role.
 * Checks the profiles table role column.
 *
 * @param role - The required role ('admin' | 'buyer')
 * @throws AuthError if user does not have the required role
 */
export async function requireRole(role: UserRole): Promise<void> {
  const session = await requireAuth();

  // Admin role is checked via is_admin flag, not the role column
  if (role === 'admin') {
    return requireAdmin();
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    throw new AuthError(
      `Unable to verify ${role} role.`,
      'FORBIDDEN'
    );
  }

  // For buyer role, also check approval status
  if (role === 'buyer') {
    if (profile.approval_status !== 'approved') {
      throw new AuthError(
        'Your account is pending approval.',
        'FORBIDDEN'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Synchronous Guards (for use with existing auth context)
// ---------------------------------------------------------------------------

/**
 * Synchronous check that the user from AuthContext is authenticated.
 * Use this when you already have the user object from useAuth().
 *
 * @param user - The user from AuthContext
 * @throws AuthError if user is null
 */
export function requireAuthSync(user: User | null): asserts user is User {
  if (!user) {
    throw new AuthError(
      'Authentication required. Please log in.',
      'UNAUTHENTICATED'
    );
  }
}

/**
 * Synchronous check that the user from AuthContext is an admin.
 *
 * @param user - The user from AuthContext
 * @throws AuthError if user is null or not admin
 */
export function requireAdminSync(user: User | null): asserts user is User {
  requireAuthSync(user);

  if (!user.is_admin) {
    throw new AuthError(
      'Admin access required.',
      'FORBIDDEN'
    );
  }
}

/**
 * Synchronous check that the user has the approved status.
 *
 * @param user - The user from AuthContext
 * @throws AuthError if user is not approved
 */
export function requireApprovedSync(user: User | null): asserts user is User {
  requireAuthSync(user);

  if (user.approval_status !== 'approved') {
    throw new AuthError(
      'Your account is pending approval.',
      'FORBIDDEN'
    );
  }
}

// ---------------------------------------------------------------------------
// Utility Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a navigation/redirect to the login page is needed.
 * Returns the redirect path or null if authenticated.
 *
 * Used in route guards and protected page wrappers.
 */
export function getAuthRedirect(
  user: User | null,
  isLoading: boolean,
  authChecked: boolean
): string | null {
  if (isLoading || !authChecked) return null; // Still loading
  if (!user) return '/login';
  if (user.approval_status === 'pending') return '/pending-approval';
  return null;
}

/**
 * Safely handle an AuthError by redirecting if appropriate.
 * Call this in catch blocks when using the async guards.
 */
export function handleAuthError(error: unknown): void {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'UNAUTHENTICATED':
      case 'SESSION_EXPIRED':
        window.location.href = '/login';
        break;
      case 'FORBIDDEN':
        // Stay on page, the caller should show an error message
        console.warn('[AuthGuard]', error.message);
        break;
    }
  }
}
