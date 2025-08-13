// Test script to send connection approval email
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vhzipqarkmmfuqadefep.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTcxMTMsImV4cCI6MjA2MjE5MzExM30.M653TuQcthJx8vZW4jPkUTdB67D_Dm48ItLcu_XBh2g";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function sendTestEmail() {
  console.log('Sending test connection approval email...');
  
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
    } else {
      console.log('Test email sent successfully:', data);
    }
  } catch (error) {
    console.error('Failed to send test email:', error);
  }
}

sendTestEmail();