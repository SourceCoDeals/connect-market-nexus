import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AccountInfoStepProps } from './types';

export const AccountInfoStep = ({ formData, handleInputChange }: AccountInfoStepProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs text-muted-foreground">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@company.com"
          value={formData.email}
          onChange={handleInputChange}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs text-muted-foreground">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={handleInputChange}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">
          Confirm Password
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          required
        />
      </div>
    </div>
  );
};
