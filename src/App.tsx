
import { Route, Routes } from "react-router-dom";
import MainLayout from "@/components/MainLayout";
import Index from "@/pages/Index";
import Marketplace from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminListings from "@/pages/admin/AdminListings";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminRequests from "@/pages/admin/AdminRequests";
import Unauthorized from "@/pages/Unauthorized";
import ProtectedRoute from "@/components/ProtectedRoute";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailHandler from "@/components/VerifyEmailHandler";
import PendingApproval from "@/pages/PendingApproval";
import MyRequests from "@/pages/MyRequests";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Index />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="verify" element={<VerifyEmailHandler />} />
        <Route path="pending-approval" element={<PendingApproval />} />
        <Route path="unauthorized" element={<Unauthorized />} />
        
        <Route 
          path="profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="marketplace" 
          element={
            <ProtectedRoute>
              <Marketplace />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="listing/:id" 
          element={
            <ProtectedRoute>
              <ListingDetail />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="my-requests" 
          element={
            <ProtectedRoute>
              <MyRequests />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="admin" 
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="requests" element={<AdminRequests />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
