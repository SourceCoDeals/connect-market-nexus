
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://vhzipqarkmmfuqadefep.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTcxMTMsImV4cCI6MjA2MjE5MzExM30.M653TuQcthJx8vZW4jPkUTdB67D_Dm48ItLcu_XBh2g";

// Create the Supabase client with explicit auth configuration
export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'sb-vhzipqarkmmfuqadefep-auth-token',
      detectSessionInUrl: true,
    }
  }
);

// Helper function to clean up auth state in case of issues
export const cleanupAuthState = async () => {
  console.log("Cleaning up auth state");
  
  try {
    // Attempt to sign out (but don't wait for it)
    supabase.auth.signOut().catch(() => {
      // Ignore errors
    });
    
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || 
          key.includes('sb-') || 
          key.startsWith('sb:') ||
          key === 'supabase.auth.token' ||
          key === 'user') {
        console.log(`Removing localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Remove from sessionStorage if in use
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || 
            key.includes('sb-') ||
            key.startsWith('sb:') ||
            key === 'supabase.auth.token') {
          console.log(`Removing sessionStorage key: ${key}`);
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error("Error during auth cleanup:", error);
  }
};

// Utility function to handle unauthorized errors
export const handleAuthErrors = (error: any) => {
  if (error && (
    error.status === 401 || 
    error.message?.includes('JWT') || 
    error.message?.includes('auth') ||
    error.message?.includes('token')
  )) {
    console.warn("Auth error detected, cleaning up session", error);
    cleanupAuthState();
    window.location.href = '/login';
    return true;
  }
  return false;
};
