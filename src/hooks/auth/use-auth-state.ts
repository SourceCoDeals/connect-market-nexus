
import { useState, useEffect } from "react";
import { User } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { createUserObject } from "@/lib/auth-helpers";

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    
    // First set up the auth state change listener before checking the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event);
        
        if (!isSubscribed) return;
        
        // Update state synchronously to prevent race conditions
        if (event === "SIGNED_OUT") {
          console.log("User signed out, clearing state");
          setUser(null);
          localStorage.removeItem("user");
          setIsLoading(false);
          setAuthChecked(true);
          return;
        }
        
        if (event === "SIGNED_IN" && session) {
          console.log("User signed in:", session.user.id);
          // Use setTimeout to avoid Supabase auth deadlocks
          setTimeout(async () => {
            if (!isSubscribed) return;
            
            try {
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (error) {
                console.error("Error fetching profile after sign in:", error);
                setUser(null);
                setIsLoading(false);
                setAuthChecked(true);
                return;
              }
              
              if (profile && isSubscribed) {
                const userData = createUserObject(profile);
                console.log("Setting user data after sign in:", userData.email);
                setUser(userData);
                localStorage.setItem("user", JSON.stringify(userData));
              }
            } catch (err) {
              console.error("Error in auth state change handler:", err);
              setUser(null);
            } finally {
              if (isSubscribed) {
                setIsLoading(false);
                setAuthChecked(true);
              }
            }
          }, 0);
        }
      }
    );
    
    const checkSession = async () => {
      try {
        setIsLoading(true);
        
        // Timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (isSubscribed) {
            console.warn("Auth check timeout - forcing completion");
            setIsLoading(false);
            setUser(null);
            setAuthChecked(true);
          }
        }, 2000); // Shorter timeout for better UX
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Clear timeout as we got a response
        clearTimeout(timeoutId);
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }
        
        if (session?.user && isSubscribed) {
          console.log("Found existing session:", session.user.id);
          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            console.error("Profile error:", profileError);
            setUser(null);
            localStorage.removeItem("user");
          } else if (profileData && isSubscribed) {
            console.log("Loaded profile data:", profileData.email);
            const userData = createUserObject(profileData);
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          }
        } else {
          console.log("No session found");
          if (isSubscribed) {
            setUser(null);
            localStorage.removeItem("user");
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (isSubscribed) {
          setUser(null);
          localStorage.removeItem("user");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };
    
    // Initialize by checking the session
    checkSession();
    
    // Clean up function
    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isLoading,
    isAdmin: user?.role === "admin",
    isBuyer: user?.role === "buyer",
    authChecked,
  };
}
