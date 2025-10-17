
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
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/components/MainLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import SignupSuccess from "@/pages/SignupSuccess";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PendingApproval from "@/pages/PendingApproval";
import Unauthorized from "@/pages/Unauthorized";
import Profile from "@/pages/Profile";
import Marketplace from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import MyRequests from "@/pages/MyRequests";
import SavedListings from "@/pages/SavedListings";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminListings from "@/pages/admin/AdminListings";
import AdminUsers from "@/pages/admin/AdminUsers";
import FirmAgreements from "@/pages/admin/FirmAgreements";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminPipeline from "@/pages/admin/AdminPipeline";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AuthCallback from "@/pages/auth/callback";
import { Toaster } from "@/components/ui/toaster";
import { SimpleToastProvider } from "@/components/ui/simple-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { errorHandler } from "@/lib/error-handler";

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
              <AnalyticsProvider>
                <SimpleToastProvider>
                  <Toaster />
          <Routes>
            {/* Authentication routes - no protection needed */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/signup-success" element={<SignupSuccess />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
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
              <Route path="pipeline" element={<AdminPipeline />} />
              <Route path="notifications" element={<AdminNotifications />} />
            </Route>
            
            {/* Catch-all route for 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
                </SimpleToastProvider>
              </AnalyticsProvider>
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
