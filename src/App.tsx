import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuth, AuthProvider } from "@/context/AuthContext";
import { SessionMonitoringProvider } from "@/context/SessionContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Profile from "@/pages/Profile";
import Marketplace from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import MyRequests from "@/pages/MyRequests";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminListings from "@/pages/admin/AdminListings";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminConnectionRequests from "@/pages/admin/AdminConnectionRequests";
import CreateListing from "@/pages/CreateListing";
import EditListing from "@/pages/EditListing";
import { Toaster } from "@/hooks/use-toast";
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';
import { RealtimeIndicator } from '@/components/realtime/RealtimeIndicator';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter>
        <SessionMonitoringProvider>
          <AuthProvider>
            <RealtimeProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                <Route path="/" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/listing/:id" element={<ProtectedRoute><ListingDetail /></ProtectedRoute>} />
                <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
                <Route path="/marketplace" element={<Navigate to="/" replace />} />
                
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/listings" element={<AdminRoute><AdminListings /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                <Route path="/admin/connection-requests" element={<AdminRoute><AdminConnectionRequests /></AdminRoute>} />
                
                <Route path="/create-listing" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
                <Route path="/edit-listing/:id" element={<ProtectedRoute><EditListing /></ProtectedRoute>} />
                
                {/* Catch-all route for 404 Not Found */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <RealtimeIndicator />
            </RealtimeProvider>
          </AuthProvider>
        </SessionMonitoringProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user?.user_metadata?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
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
