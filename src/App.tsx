
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AuthFlowManager } from "@/components/auth/AuthFlowManager";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { SessionMonitoringProvider } from "@/components/security/SessionMonitoringProvider";

// Page imports
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import SavedListings from "./pages/SavedListings";
import MyRequests from "./pages/MyRequests";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyEmailHandler from "./pages/VerifyEmailHandler";
import VerificationSuccess from "./pages/VerificationSuccess";
import EmailVerificationRequired from "./pages/EmailVerificationRequired";
import PendingApproval from "./pages/PendingApproval";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminListings from "./pages/admin/AdminListings";
import AdminRequests from "./pages/admin/AdminRequests";

// Components
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SessionMonitoringProvider>
              <RealtimeProvider>
                <AuthFlowManager>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/verify-email-handler" element={<VerifyEmailHandler />} />
                    <Route path="/verification-success" element={<VerificationSuccess />} />
                    <Route path="/email-verification-required" element={<EmailVerificationRequired />} />
                    <Route path="/pending-approval" element={<PendingApproval />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />
                    
                    {/* Protected user routes */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    } />
                    <Route path="/marketplace" element={
                      <ProtectedRoute>
                        <Marketplace />
                      </ProtectedRoute>
                    } />
                    <Route path="/listing/:id" element={
                      <ProtectedRoute>
                        <ListingDetail />
                      </ProtectedRoute>
                    } />
                    <Route path="/saved-listings" element={
                      <ProtectedRoute>
                        <SavedListings />
                      </ProtectedRoute>
                    } />
                    <Route path="/my-requests" element={
                      <ProtectedRoute>
                        <MyRequests />
                      </ProtectedRoute>
                    } />
                    
                    {/* Admin routes */}
                    <Route path="/admin" element={
                      <ProtectedRoute requireAdmin>
                        <AdminDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/users" element={
                      <ProtectedRoute requireAdmin>
                        <AdminUsers />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/listings" element={
                      <ProtectedRoute requireAdmin>
                        <AdminListings />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/requests" element={
                      <ProtectedRoute requireAdmin>
                        <AdminRequests />
                      </ProtectedRoute>
                    } />
                    
                    {/* 404 route */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AuthFlowManager>
              </RealtimeProvider>
            </SessionMonitoringProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
