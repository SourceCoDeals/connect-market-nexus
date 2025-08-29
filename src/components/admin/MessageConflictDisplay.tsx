import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  ExternalLink 
} from "lucide-react";
import { format } from "date-fns";

interface MessageConflictDisplayProps {
  sourceMetadata?: Record<string, any>;
  currentMessage?: string;
  className?: string;
}

export const MessageConflictDisplay = ({ 
  sourceMetadata, 
  currentMessage,
  className 
}: MessageConflictDisplayProps) => {
  if (!sourceMetadata) return null;

  const hasDuplicateSubmission = sourceMetadata.has_duplicate_submission;
  const isChannelDuplicate = sourceMetadata.is_channel_duplicate;
  const previousMessage = sourceMetadata.previous_message || sourceMetadata.original_message;
  const marketplaceMessage = sourceMetadata.marketplace_message;
  const duplicateCount = sourceMetadata.duplicate_submission_count || 1;
  const latestMessageAt = sourceMetadata.latest_message_at;

  if (!hasDuplicateSubmission && !isChannelDuplicate) return null;

  return (
    <Card className={`border-warning/30 bg-warning/5 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Message Conflict Detected
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasDuplicateSubmission && (
              <Badge variant="outline" className="text-xs">
                {duplicateCount > 1 ? `${duplicateCount} Submissions` : 'Duplicate Submission'}
              </Badge>
            )}
            {isChannelDuplicate && (
              <Badge variant="outline" className="text-xs">
                Channel Merge
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Duplicate Submission Case */}
        {hasDuplicateSubmission && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>
                User submitted {duplicateCount > 1 ? 'multiple requests' : 'another request'} for this listing
                {latestMessageAt && (
                  <span className="ml-1">
                    (latest: {format(new Date(latestMessageAt), 'MMM d, h:mm a')})
                  </span>
                )}
              </span>
            </div>
            
            {previousMessage && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Previous Message</span>
                </div>
                <div className="border border-border/40 rounded-md p-3 bg-background/30">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {previousMessage}
                  </p>
                </div>
              </div>
            )}
            
            {currentMessage && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-foreground" />
                  <span className="text-xs font-medium text-foreground">Latest Message</span>
                  <Badge variant="outline" className="text-xs">Current</Badge>
                </div>
                <div className="border border-border/40 rounded-md p-3 bg-background/50">
                  <p className="text-xs text-foreground leading-relaxed">
                    {currentMessage}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Channel Merge Case */}
        {isChannelDuplicate && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>
                Request originated from website form, then user submitted via marketplace
              </span>
            </div>
            
            {previousMessage && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Original Website Message</span>
                </div>
                <div className="border border-border/40 rounded-md p-3 bg-background/30">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {previousMessage}
                  </p>
                </div>
              </div>
            )}
            
            {(marketplaceMessage || currentMessage) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-foreground" />
                  <span className="text-xs font-medium text-foreground">Marketplace Message</span>
                  <Badge variant="outline" className="text-xs">Latest</Badge>
                </div>
                <div className="border border-border/40 rounded-md p-3 bg-background/50">
                  <p className="text-xs text-foreground leading-relaxed">
                    {marketplaceMessage || currentMessage}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        <Separator />
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            ✓ Admin should review both messages when making decision
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};