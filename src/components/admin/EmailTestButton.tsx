import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function EmailTestButton() {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const sendTestEmail = async () => {
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-user-notification', {
        body: {
          email: 'ahaile14@gmail.com',
          subject: '✅ Connection Request Approved',
          message: `Adam,

Great news! Your connection request for "Premium SaaS Company - $2M ARR" has been approved.

We're now coordinating next steps and will follow up with you shortly to move this forward.

If you have any questions, please reply to this email.

Adam Haile
Growth Marketing
adam.haile@sourcecodeals.com`,
          type: 'connection_approved',
          fromEmail: 'adam.haile@sourcecodeals.com'
        }
      });
      
      if (error) {
        console.error('Error sending test email:', error);
        toast({
          title: "Error",
          description: `Failed to send test email: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Test email sent successfully:', data);
        toast({
          title: "Success",
          description: "Test connection approval email sent to ahaile14@gmail.com",
        });
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button 
      onClick={sendTestEmail} 
      disabled={isSending}
      variant="outline"
      size="sm"
    >
      {isSending ? "Sending..." : "Send Test Email"}
    </Button>
  );
}