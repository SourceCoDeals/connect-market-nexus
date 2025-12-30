
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useVerificationSuccessEmail } from '@/hooks/auth/use-verification-success-email';

export default function AuthCallback() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { sendVerificationSuccessEmail } = useVerificationSuccessEmail();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('📧 Email verification callback - processing...');
        
        // Let Supabase handle the verification token
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          throw error;
        }

        if (data.session?.user) {
          console.log('✅ User session found, checking profile...');
          
          // Get latest profile data to see if verification was successful
          let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email_verified, approval_status, is_admin, first_name, last_name, email')
            .eq('id', data.session.user.id)
            .single();

          // Self-healing: if profile missing, create one from auth metadata
          if (!profile && (profileError?.code === 'PGRST116' || !profileError)) {
            console.log('⚠️ Profile missing in callback, attempting self-heal for:', data.session.user.email);
            const meta = data.session.user.user_metadata || {};
            
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .upsert({
                id: data.session.user.id,
                email: data.session.user.email || '',
                first_name: meta.first_name || meta.firstName || 'Unknown',
                last_name: meta.last_name || meta.lastName || 'User',
                company: meta.company || '',
                buyer_type: meta.buyer_type || meta.buyerType || 'individual',
                website: meta.website || '',
                linkedin_profile: meta.linkedin_profile || meta.linkedinProfile || '',
                approval_status: 'pending',
                email_verified: !!data.session.user.email_confirmed_at,
              }, { onConflict: 'id' })
              .select('email_verified, approval_status, is_admin, first_name, last_name, email')
              .single();
            
            if (insertError) {
              console.error('Self-heal profile creation failed in callback:', insertError);
            } else {
              console.log('✅ Self-healed profile created successfully in callback');
              profile = newProfile;
            }
          }

          console.log('📋 Profile data:', { 
            email_verified: profile?.email_verified, 
            approval_status: profile?.approval_status,
            is_admin: profile?.is_admin 
          });

          // Check if this is a fresh email verification (user just verified their email)
          const userJustVerified = data.session.user.email_confirmed_at && profile?.email_verified;
          
          // Send verification success email if user just verified their email
          if (userJustVerified && profile) {
            try {
              await sendVerificationSuccessEmail({
                email: profile.email,
                firstName: profile.first_name || '',
                lastName: profile.last_name || ''
              });
              console.log('✅ Verification success email sent');
            } catch (emailError) {
              // Don't block the flow if email fails - just log it
              console.error('Failed to send verification success email:', emailError);
            }
          }

          if (profile?.email_verified && profile?.approval_status === 'approved') {
            // Fully approved user - go to app
            navigate(profile.is_admin ? '/admin' : '/');
          } else {
            // Not fully approved yet - always go to pending approval
            // This handles both: email not verified OR email verified but waiting for admin approval
            navigate('/pending-approval');
          }
        } else {
          console.log('⚠️ No session found, redirecting to login');
          navigate('/login');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">Authentication error: {error}</div>
        <Button onClick={() => navigate('/login')}>
          Back to Login
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">Processing authentication...</h1>
        <p className="text-muted-foreground">Please wait...</p>
      </div>
    );
  }

  return null;
}
