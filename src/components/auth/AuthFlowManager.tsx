
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * AuthFlowManager handles the authentication flow redirects
 * Ensures users are routed to the correct screens based on their auth state
 */
export const AuthFlowManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authChecked, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (!authChecked || isLoading) {
      console.log('🔄 AuthFlowManager: Waiting for auth check completion', {
        authChecked,
        isLoading
      });
      return;
    }
    
    const currentPath = location.pathname;
    
    // If user is authenticated, handle redirects based on verification/approval status
    if (user) {
      console.log('🎯 AuthFlowManager: User authenticated, analyzing status', {
        email: user.email,
        email_verified: user.email_verified,
        email_verified_type: typeof user.email_verified,
        approval_status: user.approval_status,
        is_admin: user.is_admin,
        currentPath
      });
      
      // Define paths that shouldn't trigger redirects (callback and handler pages)
      const callbackPaths = [
        '/verify-email-handler', 
        '/verification-success',
        '/auth/callback'
      ];
      
      if (callbackPaths.includes(currentPath)) {
        console.log('🚫 AuthFlowManager: On callback path, skipping redirect');
        return;
      }
      
      // PRIORITY 1: Check email verification status with strict boolean comparison
      const isEmailVerified = user.email_verified === true;
      
      if (!isEmailVerified) {
        console.log('❌ AuthFlowManager: Email NOT verified, redirecting to verify-email', {
          email_verified: user.email_verified,
          email_verified_type: typeof user.email_verified,
          strictComparison: user.email_verified === true
        });
        
        // Only redirect if not already on verification pages
        if (currentPath !== '/verify-email' && currentPath !== '/pending-approval') {
          navigate('/verify-email', { 
            state: { email: user.email },
            replace: true 
          });
        }
        return;
      }
      
      console.log('✅ AuthFlowManager: Email verified, checking approval status');
      
      // PRIORITY 2: If email verified but pending approval (and not admin)
      if (isEmailVerified && user.approval_status === 'pending' && user.is_admin !== true) {
        console.log('⏳ AuthFlowManager: Email verified but pending approval, redirecting to pending-approval');
        
        if (currentPath !== '/pending-approval') {
          navigate('/pending-approval', { replace: true });
        }
        return;
      }
      
      // PRIORITY 3: If account rejected
      if (user.approval_status === 'rejected') {
        console.log('❌ AuthFlowManager: Account rejected, redirecting to login');
        navigate('/login', { replace: true });
        return;
      }
      
      // PRIORITY 4: If approved or admin, redirect to appropriate dashboard if on auth pages
      const isApprovedOrAdmin = (user.approval_status === 'approved' && isEmailVerified) || user.is_admin === true;
      const isOnAuthPage = ['/login', '/signup', '/', '/verify-email', '/pending-approval'].includes(currentPath);
      
      if (isApprovedOrAdmin && isOnAuthPage) {
        const redirectPath = user.is_admin === true ? '/admin' : '/marketplace';
        console.log('🎉 AuthFlowManager: User approved/admin, redirecting to', redirectPath);
        navigate(redirectPath, { replace: true });
        return;
      }
      
      console.log('✅ AuthFlowManager: User in correct state, no redirect needed');
      
    } else {
      // User not authenticated - redirect auth-required pages to login
      const publicPaths = [
        '/login', 
        '/signup', 
        '/verify-email', 
        '/verify-email-handler', 
        '/verification-success', 
        '/pending-approval', 
        '/forgot-password',
        '/auth/callback'
      ];
      
      if (!publicPaths.includes(currentPath) && currentPath !== '/') {
        console.log('🚪 AuthFlowManager: User not authenticated, redirecting to login from', currentPath);
        navigate('/login', { 
          state: { from: currentPath },
          replace: true 
        });
      }
    }
  }, [user, authChecked, isLoading, navigate, location.pathname]);
  
  return <>{children}</>;
};
