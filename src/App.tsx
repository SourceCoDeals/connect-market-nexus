
import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/context/AuthContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";
import { SessionMonitoringProvider } from "@/components/security/SessionMonitoringProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/components/MainLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailHandler from "@/pages/VerifyEmailHandler";
import EmailVerificationRequired from "@/pages/EmailVerificationRequired";
import PendingApproval from "@/pages/PendingApproval";
import VerificationSuccess from "@/pages/VerificationSuccess";
import Unauthorized from "@/pages/Unauthorized";
import Profile from "@/pages/Profile";
import Marketplace from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import MyRequests from "@/pages/MyRequests";
import SavedListings from "@/pages/SavedListings";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminListings from "@/pages/admin/AdminListings";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminRequests from "@/pages/admin/AdminRequests";
import { Toaster } from "@/components/ui/toaster";
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';
import { RealtimeIndicator } from '@/components/realtime/RealtimeIndicator';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AnalyticsProvider>
          <Toaster />
          <SessionMonitoringProvider>
            <RealtimeProvider>
            <Routes>
              {/* Authentication routes - no protection needed */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/email-verification-required" element={<EmailVerificationRequired />} />
              <Route path="/verify-email-handler" element={<VerifyEmailHandler />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/verification-success" element={<VerificationSuccess />} />
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
                <Route path="requests" element={<AdminRequests />} />
              </Route>
              
              {/* Catch-all route for 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </Routes>
              <RealtimeIndicator />
            </RealtimeProvider>
          </SessionMonitoringProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </QueryClientProvider>
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
