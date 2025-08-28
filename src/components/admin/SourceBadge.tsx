import { Badge } from '@/components/ui/badge';
import { ExternalLink, User, Upload, Bot, MousePointer, Mail, Link, Users } from 'lucide-react';

interface SourceBadgeProps {
  source: 'marketplace' | 'webflow' | 'manual' | 'import' | 'api' | 'website' | 'referral' | 'cold_outreach' | 'networking' | 'linkedin' | 'email';
  className?: string;
}

export const SourceBadge = ({ source, className }: SourceBadgeProps) => {
  const getSourceConfig = (source: string) => {
    switch (source) {
      case 'webflow':
        return {
          label: 'Webflow',
          className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
          icon: <ExternalLink className="h-3 w-3 mr-1" />
        };
      case 'website':
        return {
          label: 'Website',
          className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
          icon: <Link className="h-3 w-3 mr-1" />
        };
      case 'referral':
        return {
          label: 'Referral',
          className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          icon: <Users className="h-3 w-3 mr-1" />
        };
      case 'cold_outreach':
        return {
          label: 'Cold Outreach',
          className: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
          icon: <ExternalLink className="h-3 w-3 mr-1" />
        };
      case 'networking':
        return {
          label: 'Networking',
          className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
          icon: <Users className="h-3 w-3 mr-1" />
        };
      case 'linkedin':
        return {
          label: 'LinkedIn',
          className: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
          icon: <ExternalLink className="h-3 w-3 mr-1" />
        };
      case 'email':
        return {
          label: 'Email',
          className: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
          icon: <Mail className="h-3 w-3 mr-1" />
        };
      case 'manual':
        return {
          label: 'Manual',
          className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
          icon: <User className="h-3 w-3 mr-1" />
        };
      case 'import':
        return {
          label: 'Import',
          className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
          icon: <Upload className="h-3 w-3 mr-1" />
        };
      case 'api':
        return {
          label: 'API',
          className: 'bg-green-500/10 text-green-600 border-green-500/20',
          icon: <Bot className="h-3 w-3 mr-1" />
        };
      default: // marketplace
        return {
          label: 'Marketplace',
          className: 'bg-muted/50 text-muted-foreground border-border',
          icon: <MousePointer className="h-3 w-3 mr-1" />
        };
    }
  };

  const config = getSourceConfig(source);
  
  return (
    <Badge variant="outline" className={`text-xs ${config.className} ${className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};