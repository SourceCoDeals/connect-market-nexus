
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AnalyticsProvider } from "./context/AnalyticsContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "./context/AuthContext";
import { SimpleRealtimeProvider } from "./components/realtime/SimpleRealtimeProvider";
import { Toaster } from "./components/ui/toaster";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import SavedListings from "./pages/SavedListings";
import MyRequests from "./pages/MyRequests";
import Profile from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyEmailHandler from "./pages/auth/callback";
import PendingApproval from "./pages/PendingApproval";
import Unauthorized from "./pages/Unauthorized";

// Admin pages
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRequests from "./pages/admin/AdminRequests";
import AdminListings from "./pages/admin/AdminListings";
import AdminDashboard from "./pages/admin/AdminDashboard";

// Simple query client - no complex configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1, // Simple retry logic
    },
  },
});

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AnalyticsProvider>
            <SimpleRealtimeProvider>
            <div className="min-h-screen bg-background">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/verify-email-handler" element={<VerifyEmailHandler />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* Protected user routes */}
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
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                {/* Admin routes */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminUsers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/requests"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminRequests />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/listings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminListings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/marketplace" replace />} />
                <Route path="*" element={<Navigate to="/marketplace" replace />} />
              </Routes>
            </div>
              <Toaster />
              <ReactQueryDevtools initialIsOpen={false} />
            </SimpleRealtimeProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
