import { ExternalLink } from "lucide-react";
import { processUrl, extractDomainFromEmail } from "@/lib/url-utils";

interface ClickableCompanyNameProps {
  companyName: string;
  website?: string | null;
  linkedinProfile?: string | null;
  email?: string | null;
  className?: string;
}

/**
 * Component that makes company names clickable, linking to their website or LinkedIn
 * Falls back gracefully if no links are available
 */
export const ClickableCompanyName = ({ 
  companyName, 
  website, 
  linkedinProfile, 
  email,
  className = "" 
}: ClickableCompanyNameProps) => {
  // Priority: website first, then extract from email, then LinkedIn, then no link
  const extractedDomain = extractDomainFromEmail(email);
  const primaryUrl = website?.trim() || extractedDomain || linkedinProfile?.trim();
  
  if (!primaryUrl) {
    // No link available, return plain text
    return <span className={className}>{companyName}</span>;
  }

  const processedUrl = processUrl(primaryUrl);
  const isLinkedIn = primaryUrl.includes('linkedin.com');

  return (
    <a
      href={processedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group ${className}`}
      title={`Visit ${companyName}${isLinkedIn ? ' on LinkedIn' : "'s website"}`}
    >
      <span>{companyName}</span>
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </a>
  );
};