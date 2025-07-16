
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Mail, Clock } from "lucide-react";

interface ResendVerificationButtonProps {
  email: string;
}

export const ResendVerificationButton = ({ email }: ResendVerificationButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);

  const canResend = !lastSent || Date.now() - lastSent.getTime() > 60000; // 1 minute cooldown

  const handleResend = async () => {
    if (!canResend) return;

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setLastSent(new Date());
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and follow the instructions to verify your email.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send verification email",
        description: error.message || "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-center space-y-2">
      <Button
        variant="outline"
        onClick={handleResend}
        disabled={isLoading || !canResend}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Clock className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            {canResend ? "Resend verification email" : "Email sent - wait 1 minute"}
          </>
        )}
      </Button>
      
      {!canResend && lastSent && (
        <p className="text-xs text-muted-foreground">
          Email sent at {lastSent.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};
