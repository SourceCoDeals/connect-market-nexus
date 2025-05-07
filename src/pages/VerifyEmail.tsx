
import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Gmail, Mailbox } from "lucide-react";

const VerifyEmail = () => {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Get email from location state if available
    if (location.state && location.state.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  useEffect(() => {
    let timer: number | undefined;
    if (countdown > 0) {
      timer = window.setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const handleResendVerification = () => {
    setResendDisabled(true);
    setCountdown(60); // 60 seconds cooldown
    
    // Simulate sending a verification email
    // This would be a call to your backend or Supabase in a real implementation
    setTimeout(() => {
      // Show toast or notification
      console.log("Verification email resent");
    }, 1500);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Check your email
          </CardTitle>
          <CardDescription className="text-center">
            We've sent a verification link to{" "}
            <span className="font-medium">{email || "your email"}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Please check your email and click on the verification link to continue.
            If you don't see it, check your spam folder.
          </p>
          
          <div className="flex flex-col space-y-2 items-center">
            <p className="text-sm font-medium">Open your email client:</p>
            <div className="flex space-x-4">
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors"
              >
                <div className="bg-red-100 p-2 rounded-full mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#EA4335">
                    <path d="M22.65 9.16l-8.5-6.19c-.66-.49-1.57-.49-2.23 0L3.42 9.16C2.52 9.81 2 10.87 2 12v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8c0-1.13-.52-2.19-1.35-2.84zM12 15.07L4.4 10.14 12 5.2l7.6 4.94L12 15.07z" />
                  </svg>
                </div>
                <span className="text-xs">Gmail</span>
              </a>
              <a
                href="https://outlook.live.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors"
              >
                <div className="bg-blue-100 p-2 rounded-full mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#0078D4">
                    <path d="M21.6 5H11.5L9.8 9.3 7.9 5H2.3L11.2 20H17l7-15h-2.4zm-9.4 12.9L4.6 6.1h2.5l7.3 11.8h-2.2z" />
                  </svg>
                </div>
                <span className="text-xs">Outlook</span>
              </a>
              <a
                href="https://mail.yahoo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors"
              >
                <div className="bg-purple-100 p-2 rounded-full mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#6001D2">
                    <path d="M19.44 4h-4.92c-.33 0-.67.11-.92.31l-2.58 2.16-2.59-2.16A1.49 1.49 0 007.51 4H2.56c-.39 0-.59.47-.31.75L9 12v6.5c0 .28.22.5.5.5h5c.28 0 .5-.22.5-.5V12l6.75-7.25c.28-.28.08-.75-.31-.75z" />
                  </svg>
                </div>
                <span className="text-xs">Yahoo</span>
              </a>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResendVerification}
            disabled={resendDisabled}
          >
            {resendDisabled
              ? `Resend email (${countdown}s)`
              : "Resend verification email"}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            <span>Return to </span>
            <Link
              to="/login"
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VerifyEmail;
