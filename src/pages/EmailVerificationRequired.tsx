import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { useVerificationEmail } from '@/hooks/auth/use-verification-email';

const EmailVerificationRequired = () => {
  const [email, setEmail] = useState<string>('');
  const { sendVerificationEmail, isSending } = useVerificationEmail();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get email from navigation state or URL params
    const emailFromState = location.state?.email;
    const urlParams = new URLSearchParams(location.search);
    const emailFromUrl = urlParams.get('email');
    
    const userEmail = emailFromState || emailFromUrl;
    if (userEmail) {
      setEmail(userEmail);
    }
  }, [location]);

  const handleResendEmail = async () => {
    if (!email) {
      return;
    }
    await sendVerificationEmail(email);
  };

  const handleBackToLogin = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Email Verification Required</CardTitle>
            <CardDescription>
              We've sent a verification email to {email && <strong>{email}</strong>}. 
              Please check your inbox and click the verification link to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              <p>Don't see the email? Check your spam folder or try resending.</p>
            </div>
            
            <div className="space-y-3">
              <Button
                onClick={handleResendEmail}
                disabled={isSending || !email}
                className="w-full"
                variant="outline"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend verification email'
                )}
              </Button>
              
              <Button
                onClick={handleBackToLogin}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailVerificationRequired;