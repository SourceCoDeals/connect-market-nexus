import { Route, Navigate, useParams } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";

import { lazyWithRetry } from "./lazy";

const MAIntelligenceLayout = lazyWithRetry(() => import("@/components/ma-intelligence").then(m => ({ default: m.MAIntelligenceLayout })));
const MADashboard = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MADashboard })));
const MATrackers = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MATrackers })));
const MATrackerDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MATrackerDetail })));
const MAAllBuyers = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MAAllBuyers })));
const MABuyerDetail = lazyWithRetry(() => import("@/pages/admin/ma-intelligence").then(m => ({ default: m.MABuyerDetail })));

function RedirectWithId({ to }: { to: string }) {
  const params = useParams();
  const resolved = to.replace(/:(\w+)/g, (_, key) => params[key] ?? key);
  return <Navigate to={resolved} replace />;
}

export function maIntelligenceRoutes() {
  return (
    <Route path="/admin/ma-intelligence" element={<ProtectedRoute requireAdmin={true} requireRole="admin"><MAIntelligenceLayout /></ProtectedRoute>}>
      <Route index element={<MADashboard />} />
      <Route path="trackers" element={<MATrackers />} />
      <Route path="trackers/new" element={<MATrackerDetail />} />
      <Route path="trackers/:id" element={<MATrackerDetail />} />
      <Route path="buyers" element={<MAAllBuyers />} />
      <Route path="buyers/:id" element={<MABuyerDetail />} />
      {/* Deals routes redirect to unified All Deals page */}
      <Route path="deals" element={<Navigate to="/admin/deals" replace />} />
      <Route path="deals/:id" element={<RedirectWithId to="/admin/deals/:id" />} />
    </Route>
  );
}
