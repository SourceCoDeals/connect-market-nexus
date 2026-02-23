import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ProfileSecurityProps } from "./types";

export function ProfileSecurity({
  isLoading,
  passwordData,
  passwordError,
  passwordSuccess,
  onPasswordDataChange,
  onSubmit,
}: ProfileSecurityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>
          Update your password and security settings.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {passwordSuccess && (
            <div className="flex items-center p-4 mb-4 text-sm text-green-800 border border-green-300 rounded-lg bg-green-50">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span>{passwordError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => onPasswordDataChange({ ...passwordData, currentPassword: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => onPasswordDataChange({ ...passwordData, newPassword: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => onPasswordDataChange({ ...passwordData, confirmPassword: e.target.value })}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
