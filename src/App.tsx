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
import ListingDetails from "@/pages/ListingDetails";
import Profile from "@/pages/Profile";
import EditProfile from "@/pages/EditProfile";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminListings from "@/pages/admin/AdminListings";
import AdminFeedback from "@/pages/admin/AdminFeedback";
import Onboarding from "@/pages/Onboarding";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Pricing from "@/pages/Pricing";
import Contact from "@/pages/Contact";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import EmailVerification from "@/pages/EmailVerification";
import Connections from "@/pages/Connections";
import BuyerDashboard from "@/pages/BuyerDashboard";
import EnhancedAnalyticsDashboard from "@/components/admin/EnhancedAdminDashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileOptimizedAdminDashboard from "@/components/admin/MobileOptimizedAdminDashboard";
import MobileDashboardTabs from "@/components/admin/MobileDashboardTabs";
import AdminEmail from "@/pages/admin/AdminEmail";

function AppContent() {
  // Use the user session refresh hook
  useUserSessionRefresh();
  
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/email-verification" element={<EmailVerification />} />

      <Route path="/marketplace" element={<RequireAuth><Marketplace /></RequireAuth>} />
      <Route path="/listings/:id" element={<RequireAuth><ListingDetails /></RequireAuth>} />
      <Route path="/profile/:id" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/edit-profile" element={<RequireAuth><EditProfile /></RequireAuth>} />
      <Route path="/connections" element={<RequireAuth><Connections /></RequireAuth>} />
      <Route path="/buyer-dashboard" element={<RequireAuth><BuyerDashboard /></RequireAuth>} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

      <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
      <Route path="/admin/listings" element={<RequireAdmin><AdminListings /></RequireAdmin>} />
      <Route path="/admin/feedback" element={<RequireAdmin><AdminFeedback /></RequireAdmin>} />
      <Route path="/admin/email" element={<RequireAdmin><AdminEmail /></RequireAdmin>} />
      <Route path="/admin/analytics" element={<RequireAdmin><EnhancedAnalyticsDashboard /></RequireAdmin>} />

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
