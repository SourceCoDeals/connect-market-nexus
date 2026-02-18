
import { lazy, Suspense } from "react";
// Note: lazy is used by lazyWithRetry helper below
import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/context/AuthContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";
import { TabVisibilityProvider } from "@/context/TabVisibilityContext";
import { NavigationStateProvider } from "@/context/NavigationStateContext";
import SessionTrackingProvider from "@/components/SessionTrackingProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/components/MainLayout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SimpleToastProvider } from "@/components/ui/simple-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { errorHandler } from "@/lib/error-handler";

// Auth pages - eagerly loaded (needed immediately)
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AuthCallback from "@/pages/auth/callback";
import PendingApproval from "@/pages/PendingApproval";

// Dynamic import error recovery — reload on stale chunk failures
const lazyWithRetry = (importFn: () => Promise<any>) =>
  lazy(() =>
    importFn().catch((error: any) => {
      if (
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed')
      ) {
        console.warn('[ChunkRecovery] Stale module detected, reloading...', error.message);
        window.location.reload();
        return new Promise(() => {}); // Never resolves — page is reloading
      }
      throw error;
    })
  );

// Lazy-loaded page groups
const Welcome = lazyWithRetry(() => import("@/pages/Welcome"));
const SignupSuccess = lazyWithRetry(() => import("@/pages/SignupSuccess"));
const OwnerInquiry = lazyWithRetry(() => import("@/pages/OwnerInquiry"));
const OwnerInquirySuccess = lazyWithRetry(() => import("@/pages/OwnerInquirySuccess"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"));
const Unauthorized = lazyWithRetry(() => import("@/pages/Unauthorized"));
const ReferralTrackerPage = lazyWithRetry(() => import("@/pages/ReferralTrackerPage"));

// Main app pages - lazy loaded
const Marketplace = lazyWithRetry(() => import("@/pages/Marketplace"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const ListingDetail = lazyWithRetry(() => import("@/pages/ListingDetail"));
const MyRequests = lazyWithRetry(() => import("@/pages/MyRequests"));
const SavedListings = lazyWithRetry(() => import("@/pages/SavedListings"));

// Admin pages - lazy loaded (admin-only, heavy)
const AdminLayout = lazyWithRetry(() => import("@/components/admin/AdminLayout"));
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminListings = lazyWithRetry(() => import("@/pages/admin/AdminListings"));
const AdminUsers = lazyWithRetry(() => import("@/pages/admin/AdminUsers"));
const FirmAgreements = lazyWithRetry(() => import("@/pages/admin/FirmAgreements"));
const AdminRequests = lazyWithRetry(() => import("@/pages/admin/AdminRequests"));
const AdminDealSourcing = lazyWithRetry(() => import("@/pages/admin/AdminDealSourcing"));
const AdminPipeline = lazyWithRetry(() => import("@/pages/admin/AdminPipeline"));
const AdminNotifications = lazyWithRetry(() => import("@/pages/admin/AdminNotifications"));
const WebhooksPage = lazyWithRetry(() => import("@/pages/admin/settings/WebhooksPage"));
const TranscriptAnalytics = lazyWithRetry(() => import("@/pages/admin/analytics/TranscriptAnalytics"));
const EnrichmentTest = lazyWithRetry(() => import("@/pages/admin/EnrichmentTest"));

// ReMarketing pages - lazy loaded (admin subsystem)
const ReMarketingLayout = lazyWithRetry(() => import("@/components/remarketing").then(m => ({ default: m.ReMarketingLayout })));
const ReMarketingDashboard = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingDashboard"));
const ReMarketingUniverses = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingUniverses"));
const ReMarketingUniverseDetail = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingUniverseDetail"));
const ReMarketingDeals = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingDeals"));
const ReMarketingDealDetail = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingDealDetail"));
const ReMarketingBuyers = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingBuyers"));
const ReMarketingBuyerDetail = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingBuyerDetail"));
const ReMarketingDealMatching = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingDealMatching"));
const ReMarketingIntroductions = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingIntroductions"));
const ReMarketingAnalytics = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingAnalytics"));
const ReMarketingSettings = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingSettings"));
const ReMarketingActivityQueue = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingActivityQueue"));
const ReMarketingReferralPartners = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingReferralPartners"));
const ReMarketingReferralPartnerDetail = lazyWithRetry(() => import("@/pages/admin/remarketing/ReMarketingReferralPartnerDetail"));
const CapTargetDeals = lazyWithRetry(() => import("@/pages/admin/remarketing/CapTargetDeals"));
const GPPartnerDeals = lazyWithRetry(() => import("@/pages/admin/remarketing/GPPartnerDeals"));
const ValuationLeads = lazyWithRetry(() => import("@/pages/admin/remarketing/ValuationLeads"));

// M&A Intelligence pages - lazy loaded (admin subsystem)
const MAIntelligenceLayout = lazyWithRetry(() => import("@/components/ma-intelligence").then(m => ({ default: m.MAIntelligenceLayout })));
const MADashboard = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MADashboard })));
const MATrackers = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MATrackers })));
const MATrackerDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MATrackerDetail })));
const MAAllBuyers = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MAAllBuyers })));
const MABuyerDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MABuyerDetail })));
const MAAllDeals = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MAAllDeals })));
const MADealDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MADealDetail })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    }
  }
});

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        errorHandler(error, { 
          component: 'App', 
          operation: 'application root',
          metadata: { componentStack: errorInfo.componentStack }
        }, 'critical');
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TabVisibilityProvider>
          <NavigationStateProvider>
            <AuthProvider>
              <SessionTrackingProvider>
                <AnalyticsProvider>
                  <SimpleToastProvider>
                      <Toaster />
                      <SonnerToaster />
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>}>
          <Routes>
            {/* Public entry point - persona selection */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/sell" element={<OwnerInquiry />} />
            <Route path="/sell/success" element={<OwnerInquirySuccess />} />
            
            {/* Authentication routes - no protection needed */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/signup-success" element={<SignupSuccess />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Public referral tracker - partner-facing, no auth required */}
            <Route path="/referrals/:shareToken" element={<ReferralTrackerPage />} />

            {/* Main app routes with MainLayout - require approval */}
            <Route path="/" element={<ProtectedRoute requireApproved={true}><MainLayout /></ProtectedRoute>}>
              <Route index element={<Marketplace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="listing/:id" element={<ListingDetail />} />
              <Route path="my-requests" element={<MyRequests />} />
              <Route path="saved-listings" element={<SavedListings />} />
            </Route>
            
            {/* Redirect /marketplace to / */}
            <Route path="/marketplace" element={<Navigate to="/" replace />} />
            
            {/* Admin routes with AdminLayout - require admin */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="listings" element={<AdminListings />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="firm-agreements" element={<FirmAgreements />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="deal-sourcing" element={<AdminDealSourcing />} />
              <Route path="pipeline" element={<AdminPipeline />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings/webhooks" element={<WebhooksPage />} />
              <Route path="analytics/transcripts" element={<TranscriptAnalytics />} />
              <Route path="enrichment-test" element={<EnrichmentTest />} />
            </Route>

            {/* Remarketing routes with dedicated ReMarketingLayout */}
            <Route path="/admin/remarketing" element={<ProtectedRoute requireAdmin={true}><ReMarketingLayout /></ProtectedRoute>}>
              <Route index element={<ReMarketingDashboard />} />
              <Route path="universes" element={<ReMarketingUniverses />} />
              <Route path="universes/:id" element={<ReMarketingUniverseDetail />} />
              <Route path="deals" element={<ReMarketingDeals />} />
              <Route path="deals/:dealId" element={<ReMarketingDealDetail />} />
              <Route path="buyers" element={<ReMarketingBuyers />} />
              <Route path="buyers/:id" element={<ReMarketingBuyerDetail />} />
              <Route path="matching/:listingId" element={<ReMarketingDealMatching />} />
              <Route path="introductions/:listingId" element={<ReMarketingIntroductions />} />
              <Route path="analytics" element={<ReMarketingAnalytics />} />
              
              <Route path="captarget-deals" element={<CapTargetDeals />} />
              <Route path="captarget-deals/:dealId" element={<ReMarketingDealDetail />} />
              <Route path="gp-partner-deals" element={<GPPartnerDeals />} />
              <Route path="gp-partner-deals/:dealId" element={<ReMarketingDealDetail />} />
              <Route path="valuation-leads" element={<ValuationLeads />} />
              <Route path="referral-partners" element={<ReMarketingReferralPartners />} />
              <Route path="referral-partners/:partnerId" element={<ReMarketingReferralPartnerDetail />} />
              <Route path="activity-queue" element={<ReMarketingActivityQueue />} />
              <Route path="settings" element={<ReMarketingSettings />} />

            </Route>

            {/* M&A Intelligence routes with dedicated MAIntelligenceLayout */}
            <Route path="/admin/ma-intelligence" element={<ProtectedRoute requireAdmin={true}><MAIntelligenceLayout /></ProtectedRoute>}>
              <Route index element={<MADashboard />} />
              <Route path="trackers" element={<MATrackers />} />
              <Route path="trackers/new" element={<MATrackerDetail />} />
              <Route path="trackers/:id" element={<MATrackerDetail />} />
              <Route path="buyers" element={<MAAllBuyers />} />
              <Route path="buyers/:id" element={<MABuyerDetail />} />
              <Route path="deals" element={<MAAllDeals />} />
              <Route path="deals/:id" element={<MADealDetail />} />
            </Route>

            {/* Catch-all route for 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>

                </SimpleToastProvider>
              </AnalyticsProvider>
            </SessionTrackingProvider>
          </AuthProvider>
        </NavigationStateProvider>
      </TabVisibilityProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800">404 Not Found</h1>
        <p className="text-gray-600 mt-2">The page you are looking for does not exist.</p>
        <a href="/" className="text-blue-500 mt-4 inline-block">Go back to homepage</a>
      </div>
    </div>
  );
}

export default App;
