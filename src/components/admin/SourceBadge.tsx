import { Badge } from '@/components/ui/badge';
import { ExternalLink, User, Upload, Bot, MousePointer } from 'lucide-react';

interface SourceBadgeProps {
  source: 'marketplace' | 'webflow' | 'manual' | 'import' | 'api';
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