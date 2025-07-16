
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
    let authSubscription: any = null;
    
    // First check if we have a user in localStorage to avoid flashing
    try {
      const cachedUser = localStorage.getItem("user");
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        setUser(parsedUser);
      }
    } catch (err) {
      console.error("Error parsing cached user:", err);
      localStorage.removeItem("user");
    }
    
    // Set up the auth state change listener before checking the session
    const setupAuthListener = () => {
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
          
          if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session) {
            console.log(`User ${event}:`, session.user.id);
            // Use setTimeout to avoid Supabase auth deadlocks and fix memory leaks
            const timeoutId = setTimeout(async () => {
              if (!isSubscribed) return;
              
              try {
                const { data: profile, error } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                
                if (error) {
                  console.error(`Error fetching profile after ${event}:`, error);
                  setUser(null);
                  localStorage.removeItem("user");
                } else if (profile && isSubscribed) {
                  const userData = createUserObject(profile);
                  console.log(`Setting user data after ${event}:`, userData.email);
                  setUser(userData);
                  localStorage.setItem("user", JSON.stringify(userData));
                }
              } catch (err) {
                console.error(`Error in ${event} handler:`, err);
                setUser(null);
                localStorage.removeItem("user");
              } finally {
                if (isSubscribed) {
                  setIsLoading(false);
                  setAuthChecked(true);
                }
              }
            }, 0);

            // Store timeout ID for cleanup
            return () => {
              clearTimeout(timeoutId);
            };
          }
        }
      );
      
      authSubscription = subscription;
      return subscription;
    };
    
    const subscription = setupAuthListener();
    
    const checkSession = async () => {
      try {
        setIsLoading(true);
        
        // Timeout to prevent infinite loading - enhanced with proper cleanup
        const timeoutId = setTimeout(() => {
          if (isSubscribed) {
            console.warn("Auth check timeout - forcing completion");
            setIsLoading(false);
            setAuthChecked(true);
          }
        }, 3000); // Slightly longer timeout for better reliability
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Clear timeout as we got a response
        clearTimeout(timeoutId);
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setUser(null);
          localStorage.removeItem("user");
          setIsLoading(false);
          setAuthChecked(true);
          return;
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
    
    // Enhanced cleanup function to prevent memory leaks
    return () => {
      isSubscribed = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
      // Clear any timeouts that might still be running
      const highestId = setTimeout(() => {}, 0);
      for (let i = 0; i <= highestId; i++) {
        clearTimeout(i);
      }
    };
  }, []);

  return {
    user,
    isLoading,
    isAdmin: user?.is_admin === true, // Explicitly check for true
    isBuyer: user?.role === "buyer",
    authChecked,
  };
}
