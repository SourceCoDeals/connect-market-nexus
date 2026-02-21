import { useState } from "react";
import { useMFA } from "@/hooks/use-mfa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function MFAEnrollment() {
  const { status, factors, isLoading, error, enroll, verify, unenroll, refresh } = useMFA();
  const [enrollData, setEnrollData] = useState<{
    id: string;
    qr_code: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartEnroll = async () => {
    setIsEnrolling(true);
    const result = await enroll();
    if (result) {
      setEnrollData({
        id: result.id,
        qr_code: result.totp.qr_code,
        secret: result.totp.secret,
      });
    }
    setIsEnrolling(false);
  };

  const handleVerify = async () => {
    if (!enrollData || verifyCode.length !== 6) return;
    setIsVerifying(true);
    const success = await verify(enrollData.id, verifyCode);
    if (success) {
      toast.success("MFA enabled successfully");
      setEnrollData(null);
      setVerifyCode("");
      await refresh();
    }
    setIsVerifying(false);
  };

  const handleDisable = async () => {
    const verifiedFactor = factors.find((f) => f.status === "verified");
    if (!verifiedFactor) return;

    setIsDisabling(true);
    const success = await unenroll(verifiedFactor.id);
    if (success) {
      toast.success("MFA disabled");
      setShowDisableDialog(false);
    }
    setIsDisabling(false);
  };

  const handleCopySecret = async () => {
    if (!enrollData?.secret) return;
    await navigator.clipboard.writeText(enrollData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancelEnroll = () => {
    // If we started enrollment but didn't verify, unenroll the pending factor
    if (enrollData) {
      unenroll(enrollData.id);
    }
    setEnrollData(null);
    setVerifyCode("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const verifiedFactor = factors.find((f) => f.status === "verified");

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
            </div>
            {verifiedFactor ? (
              <Badge variant="default" className="bg-green-600">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary">
                <ShieldOff className="mr-1 h-3 w-3" />
                Disabled
              </Badge>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security to your account using a TOTP authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {verifiedFactor ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                MFA is enabled using your authenticator app. You will be asked for a verification
                code when signing in.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Enrolled:</span>
                <span>{new Date(verifiedFactor.created_at).toLocaleDateString()}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDisableDialog(true)}
              >
                Disable MFA
              </Button>
            </div>
          ) : enrollData ? (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Scan this QR code with your authenticator app:
              </p>
              <div className="flex justify-center">
                <img
                  src={enrollData.qr_code}
                  alt="TOTP QR Code"
                  className="w-48 h-48 border rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Or enter this secret manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all">
                    {enrollData.secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={handleCopySecret}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Enter the 6-digit code from your authenticator:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={verifyCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setVerifyCode(val);
                    }}
                    placeholder="000000"
                    className="font-mono text-center text-lg tracking-widest max-w-[180px]"
                    maxLength={6}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && verifyCode.length === 6) {
                        handleVerify();
                      }
                    }}
                  />
                  <Button
                    onClick={handleVerify}
                    disabled={verifyCode.length !== 6 || isVerifying}
                  >
                    {isVerifying ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Verify
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancelEnroll}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Protect your admin account by requiring a verification code from an authenticator
                app (Google Authenticator, Authy, 1Password, etc.) each time you sign in.
              </p>
              <Button onClick={handleStartEnroll} disabled={isEnrolling}>
                {isEnrolling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Shield className="h-4 w-4 mr-1" />
                )}
                Enable MFA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
            <DialogDescription>
              This will remove MFA from your account. You will no longer need a verification code
              to sign in. This reduces the security of your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={isDisabling}
            >
              {isDisabling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Disable MFA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
