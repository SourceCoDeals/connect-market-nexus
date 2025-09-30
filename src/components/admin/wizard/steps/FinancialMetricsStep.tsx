import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FinancialMetricsStep({ control }: { control: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Financial Analytics</h2>
        <p className="text-muted-foreground">
          Advanced financial metrics and performance indicators
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Coming Soon:</strong> Advanced financial analytics including customer concentration,
          revenue models, growth drivers, and market positioning metrics.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Advanced Metrics Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              We're building advanced financial analytics capabilities including customer concentration analysis,
              revenue breakdown, growth metrics, and competitive positioning.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
