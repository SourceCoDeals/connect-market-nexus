import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";
import { SessionMonitoringProvider } from "@/components/security/SessionMonitoringProvider";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { useUserSessionRefresh } from "@/hooks/auth/use-user-session-refresh";
import Marketplace from "@/pages/Marketplace";
import Profile from "@/pages/Profile";
import SavedListings from "@/pages/SavedListings";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminListings from "@/pages/admin/AdminListings";  
import AdminRequests from "@/pages/admin/AdminRequests";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import Unauthorized from "@/pages/Unauthorized";
import VerifyEmailHandler from "@/pages/VerifyEmailHandler";
import { EnhancedAdminDashboard } from "@/components/admin/EnhancedAdminDashboard";

function AppContent() {
  // Use the user session refresh hook
  useUserSessionRefresh();
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/verify-email" element={<VerifyEmailHandler />} />

      <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/saved-listings" element={<ProtectedRoute><SavedListings /></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/listings" element={<ProtectedRoute requireAdmin><AdminListings /></ProtectedRoute>} />
      <Route path="/admin/requests" element={<ProtectedRoute requireAdmin><AdminRequests /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><EnhancedAdminDashboard /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 2 * 60 * 1000, // 2 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AnalyticsProvider>
              <SessionMonitoringProvider>
                <RealtimeProvider>
                  <AppContent />
                </RealtimeProvider>
              </SessionMonitoringProvider>
            </AnalyticsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;