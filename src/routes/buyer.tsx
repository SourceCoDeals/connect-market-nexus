import { Route, Navigate } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/components/MainLayout";

import { lazyWithRetry } from "./lazy";

const Marketplace = lazyWithRetry(() => import("@/pages/Marketplace"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const ListingDetail = lazyWithRetry(() => import("@/pages/ListingDetail"));
const MyRequests = lazyWithRetry(() => import("@/pages/MyRequests"));
const BuyerMessages = lazyWithRetry(() => import("@/pages/BuyerMessages"));
const SavedListings = lazyWithRetry(() => import("@/pages/SavedListings"));

export function buyerRoutes() {
  return (
    <>
      <Route path="/" element={<ProtectedRoute requireApproved={true}><MainLayout /></ProtectedRoute>}>
        <Route index element={<Marketplace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="listing/:id" element={<ListingDetail />} />
        <Route path="my-deals" element={<MyRequests />} />
        <Route path="my-requests" element={<Navigate to="/my-deals" replace />} />
        <Route path="messages" element={<BuyerMessages />} />
        <Route path="saved-listings" element={<SavedListings />} />
      </Route>
      <Route path="/marketplace" element={<Navigate to="/" replace />} />
    </>
  );
}
