import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PersonalDetailsStepProps } from './types';

export const PersonalDetailsStep = ({ formData, handleInputChange }: PersonalDetailsStepProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="text-xs text-muted-foreground">
            First Name
          </Label>
          <Input
            id="firstName"
            name="firstName"
            placeholder="John"
            value={formData.firstName}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="text-xs text-muted-foreground">
            Last Name
          </Label>
          <Input
            id="lastName"
            name="lastName"
            placeholder="Doe"
            value={formData.lastName}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company" className="text-xs text-muted-foreground">
          Company
        </Label>
        <Input
          id="company"
          name="company"
          placeholder="Acme Inc."
          value={formData.company}
          onChange={handleInputChange}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phoneNumber" className="text-xs text-muted-foreground">
            Phone
          </Label>
          <Input
            id="phoneNumber"
            name="phoneNumber"
            placeholder="(123) 456-7890"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jobTitle" className="text-xs text-muted-foreground">
            Job Title
          </Label>
          <Input
            id="jobTitle"
            name="jobTitle"
            placeholder="e.g., Partner, VP"
            value={formData.jobTitle || ''}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="website" className="text-xs text-muted-foreground">
            Website
          </Label>
          <Input
            id="website"
            name="website"
            placeholder="example.com"
            value={formData.website}
            onChange={handleInputChange}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="linkedinProfile" className="text-xs text-muted-foreground">
            LinkedIn
          </Label>
          <Input
            id="linkedinProfile"
            name="linkedinProfile"
            placeholder="linkedin.com/in/..."
            value={formData.linkedinProfile}
            onChange={handleInputChange}
          />
        </div>
      </div>
    </div>
  );
};
