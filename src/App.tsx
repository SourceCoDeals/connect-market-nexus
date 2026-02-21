import { lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  useParams,
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
        return new Promise(() => {});
      }
      throw error;
    })
  );

// Public pages
const Welcome = lazyWithRetry(() => import("@/pages/Welcome"));
const SignupSuccess = lazyWithRetry(() => import("@/pages/SignupSuccess"));
const OwnerInquiry = lazyWithRetry(() => import("@/pages/OwnerInquiry"));
const OwnerInquirySuccess = lazyWithRetry(() => import("@/pages/OwnerInquirySuccess"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"));
const Unauthorized = lazyWithRetry(() => import("@/pages/Unauthorized"));
const ReferralTrackerPage = lazyWithRetry(() => import("@/pages/ReferralTrackerPage"));

// Main app (buyer-facing)
const Marketplace = lazyWithRetry(() => import("@/pages/Marketplace"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const ListingDetail = lazyWithRetry(() => import("@/pages/ListingDetail"));
const MyRequests = lazyWithRetry(() => import("@/pages/MyRequests"));
const SavedListings = lazyWithRetry(() => import("@/pages/SavedListings"));

// Admin layout
const AdminLayout = lazyWithRetry(() => import("@/components/admin/AdminLayout"));

// Admin pages
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminListings = lazyWithRetry(() => import("@/pages/admin/AdminListings"));
const AdminUsers = lazyWithRetry(() => import("@/pages/admin/AdminUsers"));
const MarketplaceUsersPage = lazyWithRetry(() => import("@/pages/admin/MarketplaceUsersPage"));
const InternalTeamPage = lazyWithRetry(() => import("@/pages/admin/InternalTeamPage"));
const OwnerLeadsPage = lazyWithRetry(() => import("@/pages/admin/OwnerLeadsPage"));
const AdminRequests = lazyWithRetry(() => import("@/pages/admin/AdminRequests"));
const AdminDealSourcing = lazyWithRetry(() => import("@/pages/admin/AdminDealSourcing"));
const AdminPipeline = lazyWithRetry(() => import("@/pages/admin/AdminPipeline"));
const AdminNotifications = lazyWithRetry(() => import("@/pages/admin/AdminNotifications"));
const WebhooksPage = lazyWithRetry(() => import("@/pages/admin/settings/WebhooksPage"));
const TranscriptAnalytics = lazyWithRetry(() => import("@/pages/admin/analytics/TranscriptAnalytics"));
const EnrichmentTest = lazyWithRetry(() => import("@/pages/admin/EnrichmentTest"));
const DataRecoveryPage = lazyWithRetry(() => import("@/pages/admin/DataRecoveryPage"));
const FormMonitoringPage = lazyWithRetry(() => import("@/pages/admin/FormMonitoringPage"));
const SecuritySettings = lazyWithRetry(() => import("@/pages/admin/settings/SecuritySettings"));

// ReMarketing pages (now rendered inside AdminLayout via shared sidebar)
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

// M&A Intelligence (separate layout — unchanged)
const MAIntelligenceLayout = lazyWithRetry(() => import("@/components/ma-intelligence").then(m => ({ default: m.MAIntelligenceLayout })));
const MADashboard = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MADashboard })));
const MATrackers = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MATrackers })));
const MATrackerDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MATrackerDetail })));
const MAAllBuyers = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MAAllBuyers })));
const MABuyerDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MABuyerDetail })));
const MAAllDeals = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MAAllDeals })));
const MADealDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MADealDetail })));

// Helper: redirect with params interpolation
function RedirectWithId({ to }: { to: string }) {
  const params = useParams();
  const resolved = to.replace(/:(\w+)/g, (_, key) => params[key] ?? key);
  return <Navigate to={resolved} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: { retry: 1 },
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
                    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                      <Routes>
                        {/* ─── PUBLIC ─── */}
                        <Route path="/welcome" element={<Welcome />} />
                        <Route path="/sell" element={<OwnerInquiry />} />
                        <Route path="/sell/success" element={<OwnerInquirySuccess />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/signup-success" element={<SignupSuccess />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/pending-approval" element={<PendingApproval />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/unauthorized" element={<Unauthorized />} />
                        <Route path="/referrals/:shareToken" element={<ReferralTrackerPage />} />

                        {/* ─── BUYER-FACING (unchanged) ─── */}
                        <Route path="/" element={<ProtectedRoute requireApproved={true}><MainLayout /></ProtectedRoute>}>
                          <Route index element={<Marketplace />} />
                          <Route path="profile" element={<Profile />} />
                          <Route path="listing/:id" element={<ListingDetail />} />
                          <Route path="my-requests" element={<MyRequests />} />
                          <Route path="saved-listings" element={<SavedListings />} />
                        </Route>
                        <Route path="/marketplace" element={<Navigate to="/" replace />} />

                        {/* ─── UNIFIED ADMIN LAYOUT ─── */}
                        {/* All admin + remarketing routes share one layout with the unified sidebar */}
                        <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
                          {/* Dashboard */}
                          <Route index element={<AdminDashboard />} />

                          {/* DEALS */}
                          <Route path="deals" element={<ReMarketingDeals />} />
                          <Route path="deals/:dealId" element={<ReMarketingDealDetail />} />
                          <Route path="deals/pipeline" element={<AdminPipeline />} />

                          {/* BUYERS */}
                          <Route path="buyers" element={<ReMarketingBuyers />} />
                          <Route path="buyers/:id" element={<ReMarketingBuyerDetail />} />
                          <Route path="buyers/universes" element={<ReMarketingUniverses />} />
                          <Route path="buyers/universes/:id" element={<ReMarketingUniverseDetail />} />
                          <Route path="buyers/firm-agreements" element={<Navigate to="/admin/buyers?tab=needs_agreements" replace />} />
                          <Route path="buyers/deal-sourcing" element={<AdminDealSourcing />} />

                          {/* MARKETPLACE (listings absorbed into unified All Deals page) */}
                          <Route path="marketplace/listings" element={<Navigate to="/admin/deals?tab=marketplace" replace />} />
                          <Route path="marketplace/requests" element={<AdminRequests />} />
                          <Route path="marketplace/users" element={<MarketplaceUsersPage />} />

                          {/* REMARKETING (GlobalActivityStatusBar lives in ReMarketingLayout wrapper) */}
                          <Route path="remarketing" element={<ReMarketingLayout />}>
                            <Route index element={<ReMarketingDashboard />} />
                            <Route path="activity-queue" element={<ReMarketingActivityQueue />} />
                            <Route path="leads/captarget" element={<CapTargetDeals />} />
                            <Route path="leads/captarget/:dealId" element={<ReMarketingDealDetail />} />
                            <Route path="leads/gp-partners" element={<GPPartnerDeals />} />
                            <Route path="leads/gp-partners/:dealId" element={<ReMarketingDealDetail />} />
                            <Route path="leads/valuation" element={<ValuationLeads />} />
                            <Route path="leads/referrals" element={<ReMarketingReferralPartners />} />
                            <Route path="leads/referrals/:partnerId" element={<ReMarketingReferralPartnerDetail />} />
                            <Route path="matching/:listingId" element={<ReMarketingDealMatching />} />
                            <Route path="introductions/:listingId" element={<ReMarketingIntroductions />} />

                            {/* Old remarketing URL redirects (within the remarketing sub-router) */}
                            <Route path="deals" element={<Navigate to="/admin/deals" replace />} />
                            <Route path="deals/:dealId" element={<RedirectWithId to="/admin/deals/:dealId" />} />
                            <Route path="buyers" element={<Navigate to="/admin/buyers" replace />} />
                            <Route path="buyers/:id" element={<RedirectWithId to="/admin/buyers/:id" />} />
                            <Route path="universes" element={<Navigate to="/admin/buyers/universes" replace />} />
                            <Route path="universes/:id" element={<RedirectWithId to="/admin/buyers/universes/:id" />} />
                            <Route path="analytics" element={<Navigate to="/admin/analytics" replace />} />
                            <Route path="settings" element={<Navigate to="/admin/settings/remarketing" replace />} />
                            <Route path="captarget-deals" element={<Navigate to="/admin/remarketing/leads/captarget" replace />} />
                            <Route path="captarget-deals/:dealId" element={<RedirectWithId to="/admin/remarketing/leads/captarget/:dealId" />} />
                            <Route path="gp-partner-deals" element={<Navigate to="/admin/remarketing/leads/gp-partners" replace />} />
                            <Route path="gp-partner-deals/:dealId" element={<RedirectWithId to="/admin/remarketing/leads/gp-partners/:dealId" />} />
                            <Route path="valuation-leads" element={<Navigate to="/admin/remarketing/leads/valuation" replace />} />
                            <Route path="referral-partners" element={<Navigate to="/admin/remarketing/leads/referrals" replace />} />
                            <Route path="referral-partners/:partnerId" element={<RedirectWithId to="/admin/remarketing/leads/referrals/:partnerId" />} />
                          </Route>

                          {/* ANALYTICS */}
                          <Route path="analytics" element={<ReMarketingAnalytics />} />
                          <Route path="analytics/transcripts" element={<TranscriptAnalytics />} />

                          {/* ADMIN / SETTINGS */}
                          <Route path="settings/team" element={<InternalTeamPage />} />
                          <Route path="settings/owner-leads" element={<OwnerLeadsPage />} />
                          <Route path="settings/notifications" element={<AdminNotifications />} />
                          <Route path="settings/webhooks" element={<WebhooksPage />} />
                          <Route path="settings/enrichment-test" element={<EnrichmentTest />} />
                          <Route path="settings/remarketing" element={<ReMarketingSettings />} />
                          <Route path="settings/data-recovery" element={<DataRecoveryPage />} />
                          <Route path="settings/form-monitoring" element={<FormMonitoringPage />} />
                          <Route path="settings/security" element={<SecuritySettings />} />

                          {/* OLD ADMIN URL REDIRECTS */}
                          <Route path="listings" element={<Navigate to="/admin/deals?tab=marketplace" replace />} />
                          <Route path="users" element={<Navigate to="/admin/marketplace/users" replace />} />
                          <Route path="firm-agreements" element={<Navigate to="/admin/buyers?tab=needs_agreements" replace />} />
                          <Route path="requests" element={<Navigate to="/admin/marketplace/requests" replace />} />
                          <Route path="deal-sourcing" element={<Navigate to="/admin/buyers/deal-sourcing" replace />} />
                          <Route path="pipeline" element={<Navigate to="/admin/deals/pipeline" replace />} />
                          <Route path="notifications" element={<Navigate to="/admin/settings/notifications" replace />} />
                          <Route path="enrichment-test" element={<Navigate to="/admin/settings/enrichment-test" replace />} />
                        </Route>

                        {/* ─── M&A INTELLIGENCE (separate layout — unchanged) ─── */}
                        <Route path="/admin/ma-intelligence" element={<ProtectedRoute requireAdmin={true}><MAIntelligenceLayout /></ProtectedRoute>}>
                          <Route index element={<MADashboard />} />
                          <Route path="trackers" element={<MATrackers />} />
                          <Route path="trackers/new" element={<MATrackerDetail />} />
                          <Route path="trackers/:id" element={<MATrackerDetail />} />
                          <Route path="buyers" element={<MAAllBuyers />} />
                          <Route path="buyers/:id" element={<MABuyerDetail />} />
                          {/* Deals routes redirect to unified All Deals page */}
                          <Route path="deals" element={<Navigate to="/admin/deals" replace />} />
                          <Route path="deals/:id" element={<RedirectWithId to="/admin/deals/:id" />} />
                        </Route>

                        {/* Catch-all */}
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
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground">404 Not Found</h1>
        <p className="text-muted-foreground mt-2">The page you are looking for does not exist.</p>
        <a href="/" className="text-primary mt-4 inline-block">Go back to homepage</a>
      </div>
    </div>
  );
}

export default App;
