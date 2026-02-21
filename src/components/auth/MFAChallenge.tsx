import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2 } from "lucide-react";

interface MFAChallengeProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function MFAChallenge({ onVerified, onCancel }: MFAChallengeProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    // Get the enrolled TOTP factor
    const getFactors = async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError("Failed to load MFA factors");
        return;
      }
      const verified = data?.totp?.find(
        (f: any) => f.status === "verified"
      );
      if (verified) {
        setFactorId(verified.id);
      } else {
        setError("No MFA factor found");
      }
    };
    getFactors();
  }, []);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;

    setIsVerifying(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      onVerified();
    } catch (err: any) {
      setError(err.message || "Invalid verification code. Please try again.");
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
          <CardDescription className="text-xs">
            Enter the 6-digit code from your authenticator app to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center">
            <Input
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(val);
              }}
              placeholder="000000"
              className="font-mono text-center text-2xl tracking-[0.5em] max-w-[220px] h-12"
              maxLength={6}
              autoFocus
              disabled={isVerifying}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) {
                  handleVerify();
                }
              }}
            />
          </div>

          <Button
            onClick={handleVerify}
            className="w-full"
            disabled={code.length !== 6 || isVerifying || !factorId}
          >
            {isVerifying ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Verify
          </Button>

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
