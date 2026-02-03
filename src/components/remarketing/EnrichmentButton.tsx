import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EnrichmentButtonProps {
  buyerId: string;
  buyerName: string;
  hasWebsite: boolean;
  lastEnriched?: string | null;
  size?: "sm" | "default";
  className?: string;
  onSuccess?: () => void;
}

export const EnrichmentButton = ({
  buyerId,
  buyerName,
  hasWebsite,
  lastEnriched,
  size = "default",
  className,
  onSuccess,
}: EnrichmentButtonProps) => {
  const queryClient = useQueryClient();
  const [enrichmentResult, setEnrichmentResult] = useState<'success' | 'error' | null>(null);

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('enrich-buyer', {
        body: { buyerId }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Enrichment failed');
      
      return data;
    },
    onSuccess: (data) => {
      setEnrichmentResult('success');
      toast.success(`Enriched ${buyerName}`, {
        description: `Updated ${data.data.fieldsUpdated} fields with ${data.data.dataCompleteness} confidence`
      });
      // Force an immediate refetch for active queries so the UI updates right away
      void queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', buyerId], refetchType: 'active' });
      void queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'], refetchType: 'active' });
      onSuccess?.();
      
      // Reset status after 3 seconds
      setTimeout(() => setEnrichmentResult(null), 3000);
    },
    onError: (error: Error) => {
      setEnrichmentResult('error');
      toast.error('Enrichment failed', {
        description: error.message
      });
      
      // Reset status after 3 seconds
      setTimeout(() => setEnrichmentResult(null), 3000);
    }
  });

  const handleEnrich = () => {
    if (!hasWebsite) {
      toast.error('No website URL', {
        description: 'Add a website URL to this buyer before enriching'
      });
      return;
    }
    enrichMutation.mutate();
  };

  const buttonContent = () => {
    if (enrichMutation.isPending) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {size === 'default' && <span>Enriching...</span>}
        </>
      );
    }
    if (enrichmentResult === 'success') {
      return (
        <>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {size === 'default' && <span>Enriched</span>}
        </>
      );
    }
    if (enrichmentResult === 'error') {
      return (
        <>
          <AlertCircle className="h-4 w-4 text-red-600" />
          {size === 'default' && <span>Failed</span>}
        </>
      );
    }
    return (
      <>
        <Sparkles className="h-4 w-4" />
        {size === 'default' && <span>Enrich with AI</span>}
      </>
    );
  };

  const button = (
    <Button
      variant="outline"
      size={size}
      onClick={handleEnrich}
      disabled={enrichMutation.isPending || !hasWebsite}
      className={cn(
        "gap-2",
        enrichmentResult === 'success' && "border-emerald-200 bg-emerald-50",
        enrichmentResult === 'error' && "border-red-200 bg-red-50",
        className
      )}
    >
      {buttonContent()}
    </Button>
  );

  if (!hasWebsite) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>Add a website URL to enable enrichment</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (lastEnriched) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>Last enriched: {new Date(lastEnriched).toLocaleDateString()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export default EnrichmentButton;
