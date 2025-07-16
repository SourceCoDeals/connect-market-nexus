
import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import PasswordReset from "@/pages/PasswordReset";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailHandler from "@/pages/VerifyEmailHandler";
import VerificationSuccess from "@/pages/VerificationSuccess";
import PendingApproval from "@/pages/PendingApproval";
import Marketplace from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import Profile from "@/pages/Profile";
import SavedListings from "@/pages/SavedListings";
import MyRequests from "@/pages/MyRequests";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminListings from "@/pages/admin/AdminListings";
import AdminRequests from "@/pages/admin/AdminRequests";
import NotFound from "@/pages/NotFound";
import Unauthorized from "@/pages/Unauthorized";
import AuthCallback from "@/pages/auth/callback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/password-reset" element={<PasswordReset />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-email-handler" element={<VerifyEmailHandler />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/verification-success" element={<VerificationSuccess />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected routes for approved users */}
            <Route
              path="/marketplace"
              element={
                <ProtectedRoute requireApproved={true}>
                  <Marketplace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listing/:id"
              element={
                <ProtectedRoute requireApproved={true}>
                  <ListingDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute requireApproved={false}>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved-listings"
              element={
                <ProtectedRoute requireApproved={true}>
                  <SavedListings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-requests"
              element={
                <ProtectedRoute requireApproved={true}>
                  <MyRequests />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/listings"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminListings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/requests"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminRequests />
                </ProtectedRoute>
              }
            />

            {/* Catch all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
