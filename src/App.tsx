
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyEmailHandler from "./pages/VerifyEmailHandler";
import VerificationSuccess from "./pages/VerificationSuccess";
import PendingApproval from "./pages/PendingApproval";
import Unauthorized from "./pages/Unauthorized";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import Profile from "./pages/Profile";
import SavedListings from "./pages/SavedListings";
import MyRequests from "./pages/MyRequests";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminListings from "./pages/admin/AdminListings";
import AdminRequests from "./pages/admin/AdminRequests";

// Auth callback
import AuthCallback from "./pages/auth/callback";

import "./App.css";

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
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify-email-handler" element={<VerifyEmailHandler />} />
              <Route path="/verification-success" element={<VerificationSuccess />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected routes for authenticated users */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireApproved={true}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
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

              {/* 404 route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
