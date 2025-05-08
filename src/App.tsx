
import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import PendingApproval from "@/pages/PendingApproval";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailHandler from "@/components/VerifyEmailHandler";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminListings from "@/pages/admin/AdminListings";
import AdminRequests from "@/pages/admin/AdminRequests";
import MainLayout from "@/components/MainLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Listings from "@/pages/Marketplace";
import ListingDetails from "@/pages/ListingDetail";
import MyRequests from "@/pages/MyRequests";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import Unauthorized from "@/pages/Unauthorized";
import Profile from "@/pages/Profile";
import Dashboard from "@/pages/Dashboard";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/callback" element={<VerifyEmailHandler />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        {/* Dashboard redirect */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        
        {/* Profile Route */}
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Profile />} />
        </Route>
        
        {/* Admin Routes */}
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
        
        {/* Marketplace Routes */}
        <Route 
          path="/marketplace" 
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Listings />} />
          <Route path="listings/:id" element={<ListingDetails />} />
        </Route>

        {/* My Requests Route */}
        <Route 
          path="/my-requests" 
          element={
            <ProtectedRoute>
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
