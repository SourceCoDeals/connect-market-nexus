
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import VerifyEmailHandler from "@/components/VerifyEmailHandler";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import Profile from "./pages/Profile";
import SavedListings from "./pages/SavedListings";
import MyRequests from "./pages/MyRequests";
import PendingApproval from "./pages/PendingApproval";
import VerificationSuccess from "./pages/VerificationSuccess";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyEmailHandlerPage from "./pages/VerifyEmailHandler";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminListings from "./pages/admin/AdminListings";
import AdminBulkListings from "./pages/admin/AdminBulkListings";
import AdminRequests from "./pages/admin/AdminRequests";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/auth/callback";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/verification-success" element={<VerificationSuccess />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify-email-handler" element={<VerifyEmailHandlerPage />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              
              {/* Protected routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/marketplace" 
                element={
                  <ProtectedRoute>
                    <Marketplace />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/listing/:id" 
                element={
                  <ProtectedRoute>
                    <ListingDetail />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/saved-listings" 
                element={
                  <ProtectedRoute>
                    <SavedListings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/my-requests" 
                element={
                  <ProtectedRoute>
                    <MyRequests />
                  </ProtectedRoute>
                } 
              />
              
              {/* Admin routes */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="listings" element={<AdminListings />} />
                <Route path="bulk-listings" element={<AdminBulkListings />} />
                <Route path="requests" element={<AdminRequests />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            <VerifyEmailHandler />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
