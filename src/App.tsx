
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import PendingApproval from "@/pages/PendingApproval";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailHandlerPage from "@/pages/VerifyEmailHandler";
import VerificationSuccess from "@/pages/VerificationSuccess";
import AuthCallback from "@/pages/auth/callback";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminListings from "@/pages/admin/AdminListings";
import AdminRequests from "@/pages/admin/AdminRequests";
import MainLayout from "@/components/MainLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Listings from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import MyRequests from "@/pages/MyRequests";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/NotFound";
import Unauthorized from "@/pages/Unauthorized";
import Profile from "@/pages/Profile";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Redirect root to appropriate location based on auth state */}
        <Route path="/" element={<Navigate to="/marketplace" replace />} />
        
        {/* Auth Routes - Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email-handler" element={<VerifyEmailHandlerPage />} />
        <Route path="/verification-success" element={<VerificationSuccess />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        {/* Admin Routes - Protected + Admin only */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="requests" element={<AdminRequests />} />
        </Route>
        
        {/* Profile Route - Protected */}
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute requireApproved={true}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Profile />} />
        </Route>
        
        {/* Marketplace Routes - Protected + Approved only */}
        <Route 
          path="/marketplace" 
          element={
            <ProtectedRoute requireApproved={true}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Listings />} />
        </Route>

        {/* Individual Listing Route - Protected */}
        <Route 
          path="/listing/:id" 
          element={
            <ProtectedRoute requireApproved={true}>
              <MainLayout>
                <ListingDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* My Requests Route - Protected */}
        <Route 
          path="/my-requests" 
          element={
            <ProtectedRoute requireApproved={true}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MyRequests />} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
