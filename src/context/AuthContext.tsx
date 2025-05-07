
import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (userData: Partial<User>, password: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  isAdmin: boolean;
  isBuyer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data - this would be replaced with Supabase implementation
const MOCK_ADMIN: User = {
  id: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "User",
  company: "Marketplace Co",
  website: "marketplace.co",
  phone: "123-456-7890",
  role: "admin",
  isEmailVerified: true,
  isApproved: true,
  buyerType: "corporate",
  createdAt: new Date().toISOString(),
};

const MOCK_BUYER: User = {
  id: "buyer-1",
  email: "buyer@example.com",
  firstName: "Buyer",
  lastName: "User",
  company: "Acquisition Co",
  website: "acquisition.co",
  phone: "123-456-7890",
  role: "buyer",
  isEmailVerified: true,
  isApproved: true,
  buyerType: "privateEquity",
  createdAt: new Date().toISOString(),
  additionalInfo: {
    fundSize: "$100M-$500M",
    platformSize: "10 companies",
    aum: "$1B"
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check for stored user on initial load
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // Mock login function - would be replaced with Supabase auth
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if admin
      if (email === "admin@example.com" && password === "admin123") {
        setUser(MOCK_ADMIN);
        localStorage.setItem("user", JSON.stringify(MOCK_ADMIN));
        toast({
          title: "Welcome back",
          description: "You have successfully logged in as admin.",
        });
        navigate("/admin/dashboard");
        return;
      } 
      
      // Check if buyer
      if (email === "buyer@example.com" && password === "buyer123") {
        setUser(MOCK_BUYER);
        localStorage.setItem("user", JSON.stringify(MOCK_BUYER));
        toast({
          title: "Welcome back",
          description: "You have successfully logged in.",
        });
        navigate("/marketplace");
        return;
      }
      
      throw new Error("Invalid email or password");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setUser(null);
      localStorage.removeItem("user");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to log out",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: Partial<User>, password: string) => {
    setIsLoading(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, this would create a user in Supabase
      // For now, we're just validating the data and showing a success message
      
      if (!userData.email) throw new Error("Email is required");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
      
      toast({
        title: "Verification email sent",
        description: "Please check your email to verify your account.",
      });
      navigate("/verify-email", { state: { email: userData.email } });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message || "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    setIsLoading(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (user) {
        const updatedUser = { ...user, ...data };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update profile",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        signup,
        updateUserProfile,
        isAdmin: user?.role === "admin",
        isBuyer: user?.role === "buyer",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
