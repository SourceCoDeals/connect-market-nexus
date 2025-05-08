
import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import PendingApproval from "@/pages/PendingApproval";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailHandler from "@/components/VerifyEmailHandler";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminListings from "@/pages/admin/AdminListings";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminLayout from "@/components/layouts/AdminLayout";
import MarketplaceLayout from "@/components/layouts/MarketplaceLayout";
import Listings from "@/pages/marketplace/Listings";
import ListingDetails from "@/pages/marketplace/ListingDetails";
import MyRequests from "@/pages/marketplace/MyRequests";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/callback" element={<VerifyEmailHandler />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="requests" element={<AdminRequests />} />
        </Route>
        
        {/* Marketplace Routes */}
        <Route path="/" element={<ProtectedRoute><MarketplaceLayout /></ProtectedRoute>}>
          <Route index element={<Listings />} />
          <Route path="listings/:id" element={<ListingDetails />} />
          <Route path="my-requests" element={<MyRequests />} />
        </Route>
        
        {/* Dashboard - Redirect to marketplace */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
