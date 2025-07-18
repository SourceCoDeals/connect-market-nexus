
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
    console.log('AuthFlowManager: Processing auth state', {
      currentPath,
      userEmail: user?.email,
      emailVerified: user?.email_verified,
      approvalStatus: user?.approval_status,
      isAdmin: user?.is_admin
    });
    
    // If user is authenticated, handle redirects based on verification/approval status
    if (user) {
      // Don't redirect if user is already on auth handling pages
      if (['/verify-email-handler', '/verification-success'].includes(currentPath)) {
        console.log('AuthFlowManager: User on auth handling page, not redirecting');
        return;
      }
      
      // Check email verification status first
      if (!user.email_verified) {
        console.log('AuthFlowManager: Email not verified, redirecting to email verification required');
        navigate('/email-verification-required', { 
          state: { email: user.email },
          replace: true 
        });
        return;
      }
      
      // Email is verified, now check approval status
      if (user.approval_status === 'pending' && !user.is_admin) {
        console.log('AuthFlowManager: Account pending approval, redirecting to pending approval');
        // Don't redirect if already on pending approval page
        if (currentPath !== '/pending-approval') {
          navigate('/pending-approval', { replace: true });
        }
        return;
      }
      
      // Handle rejected accounts
      if (user.approval_status === 'rejected') {
        console.log('AuthFlowManager: Account rejected, redirecting to login');
        navigate('/login', { 
          state: { message: 'Your account application has been rejected.' },
          replace: true 
        });
        return;
      }
      
      // User is verified and approved (or admin) - handle successful auth
      if (user.approval_status === 'approved' || user.is_admin) {
        // If user is on auth pages, redirect to appropriate dashboard
        if (['/login', '/signup', '/email-verification-required', '/pending-approval'].includes(currentPath) || currentPath === '/') {
          const redirectPath = user.is_admin ? '/admin' : '/marketplace';
          console.log('AuthFlowManager: User approved/admin, redirecting to', redirectPath);
          navigate(redirectPath, { replace: true });
          return;
        }
      }
    } else {
      // User not authenticated - redirect protected pages to login
      const publicPaths = [
        '/login', 
        '/signup', 
        '/email-verification-required', 
        '/verify-email', 
        '/verify-email-handler', 
        '/verification-success', 
        '/pending-approval',
        '/forgot-password'
      ];
      
      if (!publicPaths.includes(currentPath) && currentPath !== '/') {
        console.log('AuthFlowManager: User not authenticated, redirecting to login');
        navigate('/login', { 
          state: { from: currentPath },
          replace: true 
        });
      }
    }
  }, [user, authChecked, isLoading, navigate, location.pathname]);
  
  return <>{children}</>;
};
