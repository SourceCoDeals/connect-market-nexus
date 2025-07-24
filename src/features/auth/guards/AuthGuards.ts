import { type User } from '@/types';
import { type SignupFlowState, SIGNUP_FLOW_STATES } from '../types/auth.types';

/**
 * CRITICAL AUTH GUARDS - DO NOT MODIFY WITHOUT TEAM APPROVAL
 * These guards protect the signup flow from corruption
 */

export class AuthGuardError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthGuardError';
  }
}

// Prevent concurrent signup attempts
let isSignupInProgress = false;

export const acquireSignupLock = (): boolean => {
  if (isSignupInProgress) {
    throw new AuthGuardError('Signup already in progress', 'SIGNUP_IN_PROGRESS');
  }
  isSignupInProgress = true;
  return true;
};

export const releaseSignupLock = (): void => {
  isSignupInProgress = false;
};

// Validate user data integrity
export const validateUserData = (userData: Partial<User>): void => {
  if (!userData.email || !userData.first_name || !userData.last_name) {
    throw new AuthGuardError('Required user fields missing', 'INVALID_USER_DATA');
  }

  if (userData.email && !isValidEmail(userData.email)) {
    throw new AuthGuardError('Invalid email format', 'INVALID_EMAIL');
  }
};

// Email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Signup flow state validation
export const validateSignupFlow = (state: SignupFlowState): void => {
  const validStates = Object.values(SIGNUP_FLOW_STATES);
  if (!validStates.includes(state)) {
    throw new AuthGuardError(`Invalid signup flow state: ${state}`, 'INVALID_FLOW_STATE');
  }
};

// Prevent duplicate signups
const recentSignups = new Set<string>();

export const preventDuplicateSignup = (email: string): void => {
  if (recentSignups.has(email)) {
    throw new AuthGuardError('Signup already attempted for this email', 'DUPLICATE_SIGNUP');
  }
  
  recentSignups.add(email);
  
  // Clean up after 5 minutes
  setTimeout(() => {
    recentSignups.delete(email);
  }, 5 * 60 * 1000);
};

// Rate limiting for auth attempts
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const checkRateLimit = (identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): void => {
  const now = Date.now();
  const attempts = authAttempts.get(identifier);

  if (!attempts) {
    authAttempts.set(identifier, { count: 1, lastAttempt: now });
    return;
  }

  // Reset if window has passed
  if (now - attempts.lastAttempt > windowMs) {
    authAttempts.set(identifier, { count: 1, lastAttempt: now });
    return;
  }

  // Check if rate limited
  if (attempts.count >= maxAttempts) {
    throw new AuthGuardError('Too many attempts. Please try again later.', 'RATE_LIMITED');
  }

  // Increment attempt count
  attempts.count++;
  attempts.lastAttempt = now;
};

// Cleanup function for memory management
export const cleanupAuthGuards = (): void => {
  isSignupInProgress = false;
  recentSignups.clear();
  authAttempts.clear();
};