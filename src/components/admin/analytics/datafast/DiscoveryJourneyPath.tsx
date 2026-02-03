import { Search, FileText, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscoveryJourneyPathProps {
  originalExternalReferrer?: string;
  blogLandingPage?: string;
  landingPage?: string;
  className?: string;
}

/**
 * Displays the full cross-domain discovery journey path:
 * External Source → Blog Entry → Marketplace Landing
 */
export function DiscoveryJourneyPath({ 
  originalExternalReferrer, 
  blogLandingPage, 
  landingPage,
  className 
}: DiscoveryJourneyPathProps) {
  // Only show if we have cross-domain journey data
  if (!originalExternalReferrer || !blogLandingPage) {
    return null;
  }
  
  const steps = [
    {
      icon: Search,
      label: "Discovery",
      value: formatDomain(originalExternalReferrer),
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      icon: FileText,
      label: "Blog Entry",
      value: blogLandingPage.startsWith('/') ? `sourcecodeals.com${blogLandingPage}` : blogLandingPage,
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    {
      icon: Building2,
      label: "Marketplace",
      value: landingPage || '/signup',
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
  ];
  
  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-xs text-muted-foreground block">Discovery Journey</span>
      <div className="relative">
        {/* Vertical connection line */}
        <div className="absolute left-[14px] top-4 bottom-4 w-px bg-border" />
        
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3 relative">
              {/* Icon container */}
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center border flex-shrink-0 bg-background z-10",
                step.color
              )}>
                <step.icon className="w-3.5 h-3.5" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {step.label}
                </div>
                <div className="text-xs font-mono truncate">
                  {step.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDomain(urlOrDomain: string): string {
  if (!urlOrDomain) return '';
  try {
    // Handle simple domains like "google.com" (no protocol)
    if (!urlOrDomain.includes('://')) {
      return urlOrDomain.replace('www.', '');
    }
    return new URL(urlOrDomain).hostname.replace('www.', '');
  } catch {
    return urlOrDomain.replace('www.', '');
  }
}
