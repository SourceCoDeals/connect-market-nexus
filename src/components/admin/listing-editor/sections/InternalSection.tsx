import { UseFormReturn } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { InternalCompanyInfoSection } from "@/components/admin/InternalCompanyInfoSection";
import { Lock } from "lucide-react";

interface InternalSectionProps {
  form: UseFormReturn<any>;
}

export function InternalSection({ form }: InternalSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2 flex items-center gap-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          Internal Information
        </h2>
        <p className="text-sm text-muted-foreground">
          Private data for admin and deal tracking purposes only
        </p>
      </div>

      <Card className="p-6 border-muted/50 bg-muted/5">
        <InternalCompanyInfoSection control={form.control} />
      </Card>
    </div>
  );
}
