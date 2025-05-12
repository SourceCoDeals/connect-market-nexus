
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { cleanupAuthState } from "@/lib/auth-helpers";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, login, isLoading, authChecked } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get redirect path from location state or default routes
  const getRedirectPath = () => {
    const from = location.state?.from;
    if (from && typeof from === 'string' && from !== '/login') {
      return from;
    }
    return user?.isAdmin ? "/admin" : "/marketplace";
  };

  // Cleanup auth state on mount to prevent auth issues
  useEffect(() => {
    console.log("Login page mounted, cleaning up previous auth state");
    const cleanup = async () => {
      try {
        await cleanupAuthState();
        console.log("Auth state cleaned up on login page mount");
      } catch (error) {
        console.error("Error cleaning up auth state:", error);
      }
    };
    cleanup();
  }, []);

  // Redirect if user is already logged in
  useEffect(() => {
    if (authChecked && user) {
      console.log("User already logged in, redirecting to", getRedirectPath());
      navigate(getRedirectPath(), { replace: true });
    }
  }, [user, navigate, authChecked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    
    if (!email.trim()) {
      setError("Email is required");
      setIsSubmitting(false);
      return;
    }
    
    if (!password) {
      setError("Password is required");
      setIsSubmitting(false);
      return;
    }
    
    try {
      console.log(`Attempting login with email: ${email}`);
      
      // Clean up auth state before attempting login
      await cleanupAuthState();
      
      // Manual sign in to have more control
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        throw signInError;
      }
      
      if (!data || !data.user) {
        throw new Error("Failed to login. No user data returned.");
      }
      
      console.log("Login successful, user ID:", data.user.id);
      
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (profileError || !profile) {
        throw profileError || new Error("Profile not found");
      }
      
      // Handle approval status
      if (!profile.email_verified) {
        toast({
          variant: "destructive",
          title: "Email not verified",
          description: "Please verify your email address before logging in.",
        });
        await supabase.auth.signOut();
        navigate("/verify-email", { state: { email } });
        return;
      }
      
      if (profile.approval_status === 'pending') {
        toast({
          variant: "destructive",
          title: "Account pending approval",
          description: "Your account is awaiting admin approval.",
        });
        await supabase.auth.signOut();
        navigate("/pending-approval");
        return;
      }
      
      if (profile.approval_status === 'rejected') {
        toast({
          variant: "destructive",
          title: "Account rejected",
          description: "Your account application has been rejected.",
        });
        await supabase.auth.signOut();
        return;
      }
      
      // Success message
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });
      
      // Redirect based on user role
      setTimeout(() => {
        if (profile.is_admin) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/marketplace";
        }
      }, 100);
      
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to sign in");
      toast({
        variant: "destructive",
        title: "Login failed",
        description: err.message || "Please check your credentials and try again"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while we check authentication
  if (!authChecked && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Sign in to Marketplace
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/15 p-3 rounded-md flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>{error}</div>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            <span>Don't have an account? </span>
            <Link
              to="/signup"
              className="text-primary font-medium hover:underline"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
