import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface FeeAgreementToggleProps {
  hasFeeAgreement: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export const FeeAgreementToggle = ({
  hasFeeAgreement,
  onChange,
  disabled = false,
}: FeeAgreementToggleProps) => {
  return (
    <div className="flex items-center gap-3 py-3">
      <Switch
        id="fee-agreement"
        checked={hasFeeAgreement}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      <Label 
        htmlFor="fee-agreement" 
        className="text-sm font-medium cursor-pointer"
      >
        Fee Agreement in Place
      </Label>
    </div>
  );
};
