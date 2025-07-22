
import { useState, useEffect } from "react";
import { User, ApprovalStatus } from "@/types";
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
        console.log("Loaded cached user:", parsedUser.email);
      }
    } catch (err) {
      console.error("Error parsing cached user:", err);
      localStorage.removeItem("user");
    }
    
    // Set up the auth state change listener before checking the session
    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log("Auth state change:", event, session?.user?.email);
          
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
            setTimeout(async () => {
              if (!isSubscribed) return;
              
              try {
                const { data: profile, error } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                
                if (error) {
                  console.error(`Error fetching profile after ${event}:`, error);
                  // Create a minimal user object if profile doesn't exist yet
                  const minimalUser: User = {
                    id: session.user.id,
                    email: session.user.email || '',
                    first_name: session.user.user_metadata?.first_name || '',
                    last_name: session.user.user_metadata?.last_name || '',
                    email_verified: session.user.email_confirmed_at !== null,
                    approval_status: 'pending' as ApprovalStatus,
                    is_admin: false,
                    role: 'buyer' as const,
                    created_at: session.user.created_at,
                    updated_at: new Date().toISOString(),
                    company: '',
                    website: '',
                    phone_number: '',
                    buyer_type: 'corporate' as const,
                    company_name: null,
                    estimated_revenue: null,
                    fund_size: null,
                    investment_size: null,
                    aum: null,
                    is_funded: null,
                    funded_by: null,
                    target_company_size: null,
                    funding_source: null,
                    needs_loan: null,
                    ideal_target: null,
                    bio: null,
                    // Computed properties
                    firstName: session.user.user_metadata?.first_name || '',
                    lastName: session.user.user_metadata?.last_name || '',
                    phoneNumber: '',
                    isAdmin: false,
                    buyerType: 'corporate' as const,
                    emailVerified: session.user.email_confirmed_at !== null,
                    isApproved: false,
                    createdAt: session.user.created_at,
                    updatedAt: new Date().toISOString()
                  };
                  setUser(minimalUser);
                  localStorage.setItem("user", JSON.stringify(minimalUser));
                } else if (profile && isSubscribed) {
                  const userData = createUserObject(profile);
                  console.log(`Setting user data after ${event}:`, userData.email, 'Email verified:', userData.email_verified);
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
        
        // Timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (isSubscribed) {
            console.warn("Auth check timeout - forcing completion");
            setIsLoading(false);
            setAuthChecked(true);
          }
        }, 3000);
        
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
            // Create minimal user object for users without profiles yet
            const minimalUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              first_name: session.user.user_metadata?.first_name || '',
              last_name: session.user.user_metadata?.last_name || '',
              email_verified: session.user.email_confirmed_at !== null,
              approval_status: 'pending' as ApprovalStatus,
              is_admin: false,
              role: 'buyer' as const,
              created_at: session.user.created_at,
              updated_at: new Date().toISOString(),
              company: '',
              website: '',
              phone_number: '',
              buyer_type: 'corporate' as const,
              company_name: null,
              estimated_revenue: null,
              fund_size: null,
              investment_size: null,
              aum: null,
              is_funded: null,
              funded_by: null,
              target_company_size: null,
              funding_source: null,
              needs_loan: null,
              ideal_target: null,
              bio: null,
              // Computed properties
              firstName: session.user.user_metadata?.first_name || '',
              lastName: session.user.user_metadata?.last_name || '',
              phoneNumber: '',
              isAdmin: false,
              buyerType: 'corporate' as const,
              emailVerified: session.user.email_confirmed_at !== null,
              isApproved: false,
              createdAt: session.user.created_at,
              updatedAt: new Date().toISOString()
            };
            setUser(minimalUser);
            localStorage.setItem("user", JSON.stringify(minimalUser));
          } else if (profileData && isSubscribed) {
            console.log("Loaded profile data:", profileData.email, 'Email verified:', profileData.email_verified);
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
    };
  }, []);

  return {
    user,
    isLoading,
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    authChecked,
  };
}
