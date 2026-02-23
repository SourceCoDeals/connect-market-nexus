import { Route } from "react-router-dom";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AuthCallback from "@/pages/auth/callback";
import PendingApproval from "@/pages/PendingApproval";

import { lazyWithRetry } from "./lazy";

const Welcome = lazyWithRetry(() => import("@/pages/Welcome"));
const SignupSuccess = lazyWithRetry(() => import("@/pages/SignupSuccess"));
const OwnerInquiry = lazyWithRetry(() => import("@/pages/OwnerInquiry"));
const OwnerInquirySuccess = lazyWithRetry(() => import("@/pages/OwnerInquirySuccess"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"));
const Unauthorized = lazyWithRetry(() => import("@/pages/Unauthorized"));
const ReferralTrackerPage = lazyWithRetry(() => import("@/pages/ReferralTrackerPage"));
const DataRoomPortal = lazyWithRetry(() => import("@/pages/DataRoomPortal"));
const TrackedDocumentViewer = lazyWithRetry(() => import("@/pages/TrackedDocumentViewer"));
const AdminLogin = lazyWithRetry(() => import("@/pages/AdminLogin"));

export function publicRoutes() {
  return (
    <>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/sell" element={<OwnerInquiry />} />
      <Route path="/sell/success" element={<OwnerInquirySuccess />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup-success" element={<SignupSuccess />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pending-approval" element={<PendingApproval />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/referrals/:shareToken" element={<ReferralTrackerPage />} />
      <Route path="/dataroom/:accessToken" element={<DataRoomPortal />} />
      <Route path="/view/:linkToken" element={<TrackedDocumentViewer />} />
    </>
  );
}
