
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePasswordSecurity } from "@/hooks/security/use-password-security";
import { PasswordStrengthIndicator } from "@/components/security/PasswordStrengthIndicator";

const setSEO = () => {
  document.title = "Reset Password | SourceCo Marketplace";
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", "Securely set a new password for your SourceCo account.");
  else {
    const m = document.createElement("meta");
    m.name = "description";
    m.content = "Securely set a new password for your SourceCo account.";
    document.head.appendChild(m);
  }
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = window.location.href;
};

export default function ResetPassword() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => search.get("token") || "", [search]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { strengthResult, breachResult, isSecure } = usePasswordSecurity(password);

  useEffect(() => setSEO(), []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({ variant: "destructive", title: "Invalid link", description: "Missing or invalid token." });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: "Passwords do not match" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("password-reset", {
        body: { action: "reset", token, newPassword: password },
      });
      if (error) throw error;
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Reset failed", description: err.message || "Please request a new link." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Choose a strong new password to secure your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="text-sm text-destructive">Missing token. Please use the link from your email or request a new one.</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">New password</label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={loading} />
                {password && (
                  <PasswordStrengthIndicator password={password} strengthResult={strengthResult ?? undefined} />
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="confirm">Confirm password</label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required disabled={loading} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !token || password.length < 8 || password !== confirm || (strengthResult ? !isSecure : false)}>
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-between text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
          <Link to="/forgot-password" className="hover:underline">Request new link</Link>
        </CardFooter>
      </Card>
    </main>
  );
}
