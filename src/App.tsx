
import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuth, AuthProvider } from "@/context/AuthContext";
import { SessionMonitoringProvider } from "@/components/security/SessionMonitoringProvider";
import MainLayout from "@/components/MainLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import Marketplace from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import MyRequests from "@/pages/MyRequests";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminListings from "@/pages/admin/AdminListings";
import AdminUsers from "@/pages/admin/AdminUsers";
import { Toaster } from "@/components/ui/toaster";
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';
import { RealtimeIndicator } from '@/components/realtime/RealtimeIndicator';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster />
        <SessionMonitoringProvider>
          <RealtimeProvider>
            <Routes>
              {/* Login route without layout */}
              <Route path="/login" element={<Login />} />
              
              {/* Main app routes with MainLayout */}
              <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route index element={<Marketplace />} />
                <Route path="profile" element={<Profile />} />
                <Route path="listing/:id" element={<ListingDetail />} />
                <Route path="my-requests" element={<MyRequests />} />
              </Route>
              
              {/* Redirect /marketplace to / */}
              <Route path="/marketplace" element={<Navigate to="/" replace />} />
              
              {/* Admin routes with AdminLayout */}
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="listings" element={<AdminListings />} />
                <Route path="users" element={<AdminUsers />} />
              </Route>
              
              {/* Catch-all route for 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <RealtimeIndicator />
          </RealtimeProvider>
        </SessionMonitoringProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user?.is_admin) {
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
