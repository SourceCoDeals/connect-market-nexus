import { Linkedin, Building2, Briefcase, ExternalLink, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import type { VisitorCompany } from "@/hooks/useVisitorCompanies";

interface VisitorLiveFeedProps {
  visitors: VisitorCompany[];
  isLoading?: boolean;
}

export function VisitorLiveFeed({ visitors, isLoading }: VisitorLiveFeedProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Identified Visitors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visitors.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Identified Visitors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Waiting for visitor identifications...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Identified Visitors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {visitors.map((visitor) => (
            <VisitorCard key={visitor.id} visitor={visitor} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VisitorCard({ visitor }: { visitor: VisitorCompany }) {
  const fullName = [visitor.first_name, visitor.last_name].filter(Boolean).join(' ');
  const hasName = fullName.length > 0;

  return (
    <div className="p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Person info */}
          <div className="flex items-center gap-2">
            {hasName ? (
              <p className="text-sm font-medium truncate">{fullName}</p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Unknown Visitor</p>
            )}
            {visitor.linkedin_url && (
              <a
                href={visitor.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 flex-shrink-0"
              >
                <Linkedin className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Job title */}
          {visitor.job_title && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{visitor.job_title}</p>
            </div>
          )}

          {/* Company */}
          {visitor.company_name && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <p className="text-xs font-medium truncate">{visitor.company_name}</p>
              {visitor.company_industry && (
                <span className="text-xs text-muted-foreground">• {visitor.company_industry}</span>
              )}
            </div>
          )}

          {/* Page visited */}
          {visitor.captured_url && (
            <div className="flex items-center gap-1.5 mt-1">
              <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">
                {new URL(visitor.captured_url).pathname || '/'}
              </p>
            </div>
          )}
        </div>

        {/* Source badge and time */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            visitor.source === 'rb2b' 
              ? 'bg-blue-500/10 text-blue-500' 
              : visitor.source === 'warmly'
              ? 'bg-orange-500/10 text-orange-500'
              : 'bg-slate-500/10 text-slate-500'
          }`}>
            {visitor.source.toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(visitor.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
