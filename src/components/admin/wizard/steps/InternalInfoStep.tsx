import { Control } from "react-hook-form";
import { InternalCompanyInfoSection } from "@/components/admin/InternalCompanyInfoSection";

interface InternalInfoStepProps {
  control: Control<any>;
  dealIdentifier?: string;
}

export function InternalInfoStep({ control, dealIdentifier }: InternalInfoStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Internal Information</h2>
        <p className="text-muted-foreground">
          Administrative details and internal tracking information
        </p>
      </div>

      <InternalCompanyInfoSection 
        control={control} 
        dealIdentifier={dealIdentifier}
      />
    </div>
  );
}
