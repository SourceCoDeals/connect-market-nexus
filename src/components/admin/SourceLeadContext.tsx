import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Mail, 
  User, 
  MessageSquare, 
  ExternalLink, 
  Star,
  ArrowRight 
} from 'lucide-react';
import { AdminConnectionRequest } from '@/types/admin';
import { format } from 'date-fns';

interface SourceLeadContextProps {
  request: AdminConnectionRequest;
  className?: string;
}

export const SourceLeadContext = ({ request, className }: SourceLeadContextProps) => {
  // Only show for non-marketplace sources with lead context
  if (request.source === 'marketplace' || !request.source_lead_id || !request.source_metadata) {
    return null;
  }

  const metadata = request.source_metadata;
  
  return (
    <Card className={`border border-blue-500/20 bg-blue-50/50 ${className}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm text-blue-900">Original Lead Context</span>
            </div>
            {metadata.priority_score && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <Star className="h-3 w-3 mr-1" />
                Score: {metadata.priority_score}
              </Badge>
            )}
          </div>

          {/* Lead Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Original Contact Info */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Original Lead Details
              </div>
              
              {metadata.original_company && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{metadata.original_company}</span>
                </div>
              )}
              
              {metadata.original_role && (
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{metadata.original_role}</span>
                </div>
              )}

              {metadata.form_name && (
                <div className="text-xs text-muted-foreground">
                  Via: {metadata.form_name}
                </div>
              )}
            </div>

            {/* Conversion Info */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Conversion Details
              </div>
              
              {request.converted_at && (
                <div className="text-xs text-muted-foreground">
                  Converted: {format(new Date(request.converted_at), 'MMM d, yyyy h:mm a')}
                </div>
              )}
              
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <ArrowRight className="h-3 w-3" />
                <span>Lead → Connection Request</span>
              </div>
            </div>
          </div>

          {/* Original Message */}
          {metadata.original_message && (
            <div className="space-y-2 pt-2 border-t border-blue-200/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Original Message
                </span>
              </div>
              <div className="bg-white/80 border border-blue-200/50 rounded-md p-3">
                <p className="text-xs text-foreground leading-relaxed">
                  {metadata.original_message}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};