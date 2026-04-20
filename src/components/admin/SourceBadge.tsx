import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, User, Upload, Bot, Mail, Link, Users } from 'lucide-react';

interface SourceBadgeProps {
  source:
    | 'marketplace'
    | 'webflow'
    | 'manual'
    | 'import'
    | 'api'
    | 'website'
    | 'referral'
    | 'cold_outreach'
    | 'networking'
    | 'linkedin'
    | 'email'
    | 'landing_page'
    | 'landing_page_email_capture';
  className?: string;
}

const sourceConfigs: Record<
  string,
  { label: string; className: string; icon: React.ReactNode; tooltip: string }
> = {
  webflow: {
    label: 'Webflow',
    className: 'border-border text-muted-foreground',
    icon: (
      <svg
        className="h-3 w-3 mr-1 flex-shrink-0"
        viewBox="0 0 28 18"
        fill="#4353FF"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M20.49 0s-3.05 9.63-3.17 10.01C17.2 9.54 14.97 0 14.97 0h-5.1s-3.05 9.63-3.17 10.01C6.58 9.54 4.35 0 4.35 0H0l5.47 18h5.1l3.17-10.01L16.91 18h5.1L27.48 0h-6.99z" />
      </svg>
    ),
    tooltip: 'This lead was submitted via a Webflow deal memo page on the SourceCo website.',
  },
  website: {
    label: 'Website',
    className: 'border-border text-muted-foreground',
    icon: <Link className="h-3 w-3 mr-1" />,
    tooltip: 'This request originated from the SourceCo website.',
  },
  referral: {
    label: 'Referral',
    className: 'border-border text-muted-foreground',
    icon: <Users className="h-3 w-3 mr-1" />,
    tooltip: 'This request came through a referral.',
  },
  cold_outreach: {
    label: 'Cold Outreach',
    className: 'border-border text-muted-foreground',
    icon: <ExternalLink className="h-3 w-3 mr-1" />,
    tooltip: 'This request originated from cold outreach efforts.',
  },
  networking: {
    label: 'Networking',
    className: 'border-border text-muted-foreground',
    icon: <Users className="h-3 w-3 mr-1" />,
    tooltip: 'This request came through networking.',
  },
  linkedin: {
    label: 'LinkedIn',
    className: 'border-border text-muted-foreground',
    icon: <ExternalLink className="h-3 w-3 mr-1" />,
    tooltip: 'This request originated from LinkedIn.',
  },
  email: {
    label: 'Email',
    className: 'border-border text-muted-foreground',
    icon: <Mail className="h-3 w-3 mr-1" />,
    tooltip: 'This request came via email.',
  },
  landing_page: {
    label: 'Landing Page',
    className: 'border-border text-muted-foreground',
    icon: <ExternalLink className="h-3 w-3 mr-1" />,
    tooltip: 'This request came from a landing page.',
  },
  landing_page_email_capture: {
    label: 'Landing Page',
    className: 'border-border text-muted-foreground',
    icon: <ExternalLink className="h-3 w-3 mr-1" />,
    tooltip: 'This request came from a landing page email capture.',
  },
  manual: {
    label: 'Manual',
    className: 'border-border text-muted-foreground',
    icon: <User className="h-3 w-3 mr-1" />,
    tooltip: 'This request was manually entered by an admin.',
  },
  import: {
    label: 'Import',
    className: 'border-border text-muted-foreground',
    icon: <Upload className="h-3 w-3 mr-1" />,
    tooltip: 'This request was imported from an external source.',
  },
  api: {
    label: 'API',
    className: 'border-border text-muted-foreground',
    icon: <Bot className="h-3 w-3 mr-1" />,
    tooltip: 'This request was created via API.',
  },
  marketplace: {
    label: 'Marketplace',
    className: 'border-border text-muted-foreground',
    icon: (
      <img
        src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png"
        alt=""
        className="h-3 w-3 mr-1 flex-shrink-0"
      />
    ),
    tooltip: 'This request was submitted through the SourceCo Marketplace by a registered user.',
  },
};

export const SourceBadge = memo(function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = sourceConfigs[source] ?? sourceConfigs.marketplace;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-xs cursor-help ${config.className} ${className ?? ''}`}
          >
            {config.icon}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {config.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
