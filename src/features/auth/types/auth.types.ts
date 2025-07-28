import { z } from 'zod';
import type { User } from '@/types';

// Protected signup flow states - NEVER MODIFY WITHOUT TEAM APPROVAL
export const SIGNUP_FLOW_STATES = {
  IDLE: 'idle',
  SIGNING_UP: 'signing_up',
  SUCCESS: 'success',
  EMAIL_VERIFICATION: 'email_verification',
  PENDING_APPROVAL: 'pending_approval',
  ERROR: 'error'
} as const;

export type SignupFlowState = typeof SIGNUP_FLOW_STATES[keyof typeof SIGNUP_FLOW_STATES];

// Protected state transitions - CRITICAL: DO NOT MODIFY
export const ALLOWED_SIGNUP_TRANSITIONS: Record<SignupFlowState, SignupFlowState[]> = {
  [SIGNUP_FLOW_STATES.IDLE]: [SIGNUP_FLOW_STATES.SIGNING_UP],
  [SIGNUP_FLOW_STATES.SIGNING_UP]: [SIGNUP_FLOW_STATES.SUCCESS, SIGNUP_FLOW_STATES.ERROR],
  [SIGNUP_FLOW_STATES.SUCCESS]: [SIGNUP_FLOW_STATES.EMAIL_VERIFICATION],
  [SIGNUP_FLOW_STATES.EMAIL_VERIFICATION]: [SIGNUP_FLOW_STATES.PENDING_APPROVAL],
  [SIGNUP_FLOW_STATES.PENDING_APPROVAL]: [], // Terminal state
  [SIGNUP_FLOW_STATES.ERROR]: [SIGNUP_FLOW_STATES.IDLE, SIGNUP_FLOW_STATES.SIGNING_UP]
};

// Signup form validation schema
export const signupFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company: z.string().min(1, 'Company is required'),
  buyerType: z.enum(['corporate', 'privateEquity', 'familyOffice', 'searchFund', 'individual']),
  website: z.string().url('Please enter a valid website URL').optional().or(z.literal('')),
  phone_number: z.string().optional(),
  linkedinProfile: z.string().url('Please enter a valid LinkedIn URL').optional().or(z.literal('')),
  idealTargetDescription: z.string().optional(),
  businessCategories: z.array(z.string()).optional(),
  targetLocations: z.string().optional(),
  revenueRangeMin: z.number().optional(),
  revenueRangeMax: z.number().optional(),
  specificBusinessSearch: z.string().optional()
});

export type SignupFormData = z.infer<typeof signupFormSchema>;

// Protected auth context interface
export interface ProtectedAuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (userData: Partial<User>, password: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
  isBuyer: boolean;
  authChecked: boolean;
  // Protected signup flow state
  signupFlowState: SignupFlowState;
  transitionSignupState: (newState: SignupFlowState) => void;
}

// State transition guard
export class SignupStateTransitionError extends Error {
  constructor(from: SignupFlowState, to: SignupFlowState) {
    super(`Invalid signup state transition from ${from} to ${to}`);
    this.name = 'SignupStateTransitionError';
  }
}

export function validateSignupStateTransition(
  currentState: SignupFlowState,
  newState: SignupFlowState
): void {
  const allowedTransitions = ALLOWED_SIGNUP_TRANSITIONS[currentState];
  if (!allowedTransitions.includes(newState)) {
    throw new SignupStateTransitionError(currentState, newState);
  }
}