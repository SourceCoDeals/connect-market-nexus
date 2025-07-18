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
    if (!authChecked || isLoading) return;
    
    const currentPath = location.pathname;
    
    // If user is authenticated, handle redirects based on verification/approval status
    if (user) {
      console.log('AuthFlowManager: User authenticated, checking status', {
        email: user.email,
        emailVerified: user.email_verified,
        approvalStatus: user.approval_status,
        isAdmin: user.is_admin,
        currentPath
      });
      
      // Don't redirect if user is already on the correct page
      if (currentPath === '/verify-email-handler' || 
          currentPath === '/verification-success' ||
          currentPath === '/pending-approval') {
        return;
      }
      
      // If email not verified, redirect to verification page ONLY
      if (!user.email_verified) {
        console.log('AuthFlowManager: Email not verified, redirecting to verify-email');
        navigate('/verify-email', { 
          state: { email: user.email },
          replace: true 
        });
        return;
      }
      
      // If email verified but pending approval (and not admin), redirect to pending approval
      if (user.email_verified && user.approval_status === 'pending' && !user.is_admin) {
        console.log('AuthFlowManager: Email verified but account pending approval, redirecting to pending-approval');
        navigate('/pending-approval', { replace: true });
        return;
      }
      
      // If account rejected
      if (user.approval_status === 'rejected') {
        console.log('AuthFlowManager: Account rejected, redirecting to login with message');
        navigate('/login', { replace: true });
        return;
      }
      
      // If approved, redirect to appropriate dashboard if on auth pages
      if (user.approval_status === 'approved' || user.is_admin) {
        if (currentPath === '/login' || currentPath === '/signup' || currentPath === '/') {
          const redirectPath = user.is_admin ? '/admin' : '/marketplace';
          console.log('AuthFlowManager: User approved, redirecting to', redirectPath);
          navigate(redirectPath, { replace: true });
          return;
        }
      }
    } else {
      // User not authenticated - redirect auth-required pages to login
      const publicPaths = ['/login', '/signup', '/verify-email', '/verify-email-handler', '/verification-success', '/pending-approval', '/forgot-password'];
      
      if (!publicPaths.includes(currentPath) && currentPath !== '/') {
        console.log('AuthFlowManager: User not authenticated, redirecting to login from', currentPath);
        navigate('/login', { 
          state: { from: currentPath },
          replace: true 
        });
      }
    }
  }, [user, authChecked, isLoading, navigate, location.pathname]);
  
  return <>{children}</>;
};