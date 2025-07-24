// PROTECTED AUTH FEATURE EXPORTS
// WARNING: This module contains critical authentication logic
// DO NOT MODIFY without proper review and testing

export { ProtectedSignupForm } from './components/ProtectedSignupForm';
export { AuthErrorBoundary } from './components/AuthErrorBoundary';
export { useProtectedAuth } from './hooks/useProtectedAuth';

export {
  type SignupFlowState,
  type SignupFormData,
  type ProtectedAuthContextType,
  SIGNUP_FLOW_STATES,
  signupFormSchema,
  validateSignupStateTransition,
  SignupStateTransitionError
} from './types/auth.types';

export {
  acquireSignupLock,
  releaseSignupLock,
  validateUserData,
  validateSignupFlow,
  preventDuplicateSignup,
  checkRateLimit,
  cleanupAuthGuards,
  AuthGuardError
} from './guards/AuthGuards';