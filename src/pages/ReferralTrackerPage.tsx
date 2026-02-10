import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Lock,
  Building2,
  Handshake,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { ReferralSubmissionForm } from "@/components/remarketing/ReferralSubmissionForm";
import { ReferralCSVUpload } from "@/components/remarketing/ReferralCSVUpload";

interface PartnerData {
  name: string;
  company: string | null;
}

interface DealRow {
  id: string;
  title: string | null;
  category: string | null;
  revenue: number | null;
  ebitda: number | null;
  full_time_employees: number | null;
  location: string | null;
  source: "listing" | "submission";
  status?: string;
  is_priority_target?: boolean;
}

const formatCurrency = (value: number | null) => {
  if (!value) return "-";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const statusBadge = (status: string | undefined, source: "listing" | "submission") => {
  if (!status) return null;
  if (source === "listing") {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case "draft":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">In Review</Badge>;
      case "archived":
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Archived</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{status}</Badge>;
    }
  }
  switch (status) {
    case "pending":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
    case "approved":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Rejected</Badge>;
    default:
      return null;
  }
};

export default function ReferralTrackerPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);

  const fetchData = useCallback(async () => {
    if (!shareToken || !authenticated) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "validate-referral-access",
        {
          body: {
            action: "get-data",
            shareToken,
            password,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPartner(data.partner);

      const dealRows: DealRow[] = [];

      if (data.listings) {
        for (const l of data.listings) {
          dealRows.push({
            id: l.id,
            title: l.title || l.internal_company_name,
            category: l.category,
            revenue: l.revenue,
            ebitda: l.ebitda,
            full_time_employees: l.full_time_employees,
            location: l.location,
            source: "listing",
            status: l.status,
            is_priority_target: l.is_priority_target,
          });
        }
      }

      if (data.submissions) {
        for (const s of data.submissions) {
          if (s.status === "approved" && s.listing_id) continue;

          dealRows.push({
            id: s.id,
            title: s.company_name,
            category: s.industry,
            revenue: s.revenue,
            ebitda: s.ebitda,
            full_time_employees: null,
            location: s.location,
            source: "submission",
            status: s.status,
          });
        }
      }

      setDeals(dealRows);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [shareToken, authenticated, password]);

  useEffect(() => {
    if (authenticated) {
      fetchData();
    }
  }, [authenticated, fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareToken || !password.trim()) return;

    setIsAuthenticating(true);
    setLoginError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "validate-referral-access",
        {
          body: {
            action: "validate",
            shareToken,
            password: password.trim(),
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.valid) {
        setAuthenticated(true);
        setPartner(data.partner);
      } else {
        const msg = "Invalid password";
        setLoginError(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.message || "Authentication failed";
      setLoginError(msg);
      toast.error(msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-gray-700 bg-gray-800/50">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-amber-600/20 flex items-center justify-center">
                <Handshake className="h-8 w-8 text-amber-500" />
              </div>
            </div>
            <CardTitle className="text-2xl text-white">Referral Tracker</CardTitle>
            <p className="text-gray-400 text-sm mt-1">
              Enter your password to access your referral dashboard
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tracker-password" className="text-gray-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="tracker-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    autoFocus
                  />
                </div>
              </div>
              {loginError && (
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-md px-3 py-2">
                  {loginError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isAuthenticating || !password.trim()}
              >
                {isAuthenticating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Access Tracker
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main tracker page
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <header className="border-b border-gray-700 bg-gray-900/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
              <Handshake className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {partner?.name || "Partner"} — Referral Tracker
              </h1>
              {partner?.company && (
                <p className="text-sm text-gray-400">{partner.company}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="border-gray-600 text-gray-300">
            {deals.length} {deals.length === 1 ? "Referral" : "Referrals"}
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <Card className="border-gray-700 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-white">Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No referrals yet. Submit your first below.</p>
              </div>
            ) : (
              <div className="border border-gray-700 rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-300">Company Name</TableHead>
                      <TableHead className="text-gray-300">Industry</TableHead>
                      <TableHead className="text-gray-300 text-right">Revenue</TableHead>
                      <TableHead className="text-gray-300 text-right">EBITDA</TableHead>
                      <TableHead className="text-gray-300">Employees</TableHead>
                      <TableHead className="text-gray-300">Location</TableHead>
                      <TableHead className="text-gray-300">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => (
                      <TableRow key={deal.id} className={`border-gray-700 ${deal.is_priority_target ? "bg-amber-900/20" : ""}`}>
                        <TableCell className="font-medium text-white">
                          {deal.title || "Untitled"}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {deal.category || "-"}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm text-right">
                          {formatCurrency(deal.revenue)}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm text-right">
                          {formatCurrency(deal.ebitda)}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {deal.full_time_employees || "-"}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {deal.location || "-"}
                        </TableCell>
                        <TableCell>{statusBadge(deal.status, deal.source)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-700 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-white">Submit New Referrals</CardTitle>
            <p className="text-sm text-gray-400">
              Submit a single company or upload a spreadsheet with multiple companies
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Upload Spreadsheet
              </h3>
              <ReferralCSVUpload shareToken={shareToken!} onUploaded={fetchData} />
            </div>

            <Collapsible defaultOpen={false} className="border-t border-gray-700 pt-6">
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Or Submit One Company
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <ReferralSubmissionForm
                  shareToken={shareToken!}
                  onSubmitted={fetchData}
                />
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}