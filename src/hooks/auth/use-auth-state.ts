
import { useState, useEffect } from "react";
import { User } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { createUserObject } from "@/lib/auth-helpers";

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        setIsLoading(true);
        
        // Set timeout to prevent indefinite loading
        const timeoutId = setTimeout(() => {
          console.warn("Auth check timeout - forcing reset");
          setIsLoading(false);
          setUser(null);
        }, 5000);
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Clear timeout as we got a response
        clearTimeout(timeoutId);
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }
        
        if (session?.user) {
          console.log("Found existing session:", session.user.id);
          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            if (profileError.code === 'PGRST116') {
              console.warn("User profile not found, creating one");
              // Profile not found, handle this case
              await supabase.auth.signOut();
              setUser(null);
            } else {
              console.error("Profile error:", profileError);
              throw profileError;
            }
          } else if (profileData) {
            console.log("Loaded profile data:", profileData.email);
            // Create user object from profile data
            const userData = createUserObject(profileData);
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          }
        } else {
          console.log("No session found");
          setUser(null);
          localStorage.removeItem("user");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
    
    // Set up auth state change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event);
        
        if (event === "SIGNED_IN" && session) {
          // Use setTimeout to prevent deadlocks in Supabase auth
          setTimeout(async () => {
            try {
              // Fetch user profile when signed in
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (error) {
                console.error("Error fetching user profile:", error);
                if (error.code === 'PGRST116') {
                  // Profile not found
                  console.warn("User profile not found on sign in");
                  await supabase.auth.signOut();
                  setUser(null);
                  return;
                }
                throw error;
              }
              
              if (profile) {
                const userData = createUserObject(profile);
                setUser(userData);
                localStorage.setItem("user", JSON.stringify(userData));
              }
            } catch (error) {
              console.error("Error in auth state change handler:", error);
            }
          }, 0);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          localStorage.removeItem("user");
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isLoading,
    isAdmin: user?.role === "admin",
    isBuyer: user?.role === "buyer",
  };
}
