
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { SessionMonitoringProvider } from "@/components/security/SessionMonitoringProvider";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import Profile from "./pages/Profile";
import SavedListings from "./pages/SavedListings";
import MyRequests from "./pages/MyRequests";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminListings from "./pages/admin/AdminListings";
import AdminRequests from "./pages/admin/AdminRequests";
import Unauthorized from "./pages/Unauthorized";
import PendingApproval from "./pages/PendingApproval";
import EmailVerificationRequired from "./pages/EmailVerificationRequired";
import VerifyEmail from "./pages/VerifyEmail";
import VerificationSuccess from "./pages/VerificationSuccess";
import VerifyEmailHandler from "./pages/VerifyEmailHandler";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/auth/callback";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/MainLayout";
import AdminLayout from "./components/admin/AdminLayout";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SessionMonitoringProvider>
            <RealtimeProvider>
              <BrowserRouter>
                <AnalyticsProvider>
                  <div className="min-h-screen bg-background">
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/unauthorized" element={<Unauthorized />} />
                      <Route path="/pending-approval" element={<PendingApproval />} />
                      <Route path="/email-verification-required" element={<EmailVerificationRequired />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="/verification-success" element={<VerificationSuccess />} />
                      <Route path="/verify-email-handler" element={<VerifyEmailHandler />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />

                      {/* Protected routes */}
                      <Route path="/dashboard" element={
                        <ProtectedRoute requireApproved>
                          <MainLayout>
                            <Dashboard />
                          </MainLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/marketplace" element={
                        <ProtectedRoute requireApproved>
                          <MainLayout>
                            <Marketplace />
                          </MainLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/listing/:id" element={
                        <ProtectedRoute requireApproved>
                          <MainLayout>
                            <ListingDetail />
                          </MainLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/profile" element={
                        <ProtectedRoute requireApproved>
                          <MainLayout>
                            <Profile />
                          </MainLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/saved" element={
                        <ProtectedRoute requireApproved>
                          <MainLayout>
                            <SavedListings />
                          </MainLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/requests" element={
                        <ProtectedRoute requireApproved>
                          <MainLayout>
                            <MyRequests />
                          </MainLayout>
                        </ProtectedRoute>
                      } />

                      {/* Admin routes */}
                      <Route path="/admin" element={
                        <ProtectedRoute requireAdmin requireApproved>
                          <AdminLayout>
                            <AdminDashboard />
                          </AdminLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/admin/users" element={
                        <ProtectedRoute requireAdmin requireApproved>
                          <AdminLayout>
                            <AdminUsers />
                          </AdminLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/admin/listings" element={
                        <ProtectedRoute requireAdmin requireApproved>
                          <AdminLayout>
                            <AdminListings />
                          </AdminLayout>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/admin/requests" element={
                        <ProtectedRoute requireAdmin requireApproved>
                          <AdminLayout>
                            <AdminRequests />
                          </AdminLayout>
                        </ProtectedRoute>
                      } />

                      {/* 404 route */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                </AnalyticsProvider>
              </BrowserRouter>
            </RealtimeProvider>
          </SessionMonitoringProvider>
        </AuthProvider>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
