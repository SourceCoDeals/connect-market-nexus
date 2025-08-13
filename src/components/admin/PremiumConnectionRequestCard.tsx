import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, ChevronUp, User, Building, MapPin, Mail, Shield, Clipboard, ExternalLink } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";

interface PremiumConnectionRequestCardProps {
  request: AdminConnectionRequest;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const variants = {
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800", 
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
  };
  
  const icons = {
    approved: "✓",
    rejected: "✕", 
    pending: "⏳"
  };
  
  return (
    <Badge variant="outline" className={`text-xs font-medium px-3 py-1.5 ${variants[status as keyof typeof variants]}`}>
      <span className="mr-1.5">{icons[status as keyof typeof icons]}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

export function PremiumConnectionRequestCard({ 
  request, 
  onApprove, 
  onReject, 
  isExpanded, 
  onToggleExpand 
}: PremiumConnectionRequestCardProps) {
  const user = request.user;
  const listing = request.listing as any;
  
  return (
    <Card className="group border border-border/60 hover:border-primary/30 transition-all duration-200 hover:shadow-lg bg-background/50 backdrop-blur-sm">
      <CardContent className="p-0">
        {/* Header Section - Always Visible */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg text-foreground">
                    {user?.first_name} {user?.last_name}
                  </h3>
                  <StatusBadge status={request.status} />
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Building className="h-4 w-4" />
                    <span>{user?.company || 'Company not specified'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    <span className="capitalize">{user?.buyer_type || 'Buyer type not specified'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-base text-foreground">
                    Interested in: {listing?.title}
                  </h4>
                  {listing?.deal_identifier && (
                    <code className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                      {listing.deal_identifier}
                    </code>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{listing?.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building className="h-4 w-4" />
                    <span>{listing?.category}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {request.status === "pending" && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                    onClick={() => onApprove(request)}
                  >
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                    onClick={() => onReject(request)}
                  >
                    Reject
                  </Button>
                </div>
              )}
              
              <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
        </div>
        
        {/* Expanded Content */}
        <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
          <CollapsibleContent>
            <div className="px-6 pb-6 border-t border-border/30 pt-4 space-y-6">
              {/* Detailed Information Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Buyer Details */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-base flex items-center gap-2 text-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    Contact Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium break-all">{user?.email}</span>
                    </div>
                    {user?.phone_number && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium">{user.phone_number}</span>
                      </div>
                    )}
                    {user?.website && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Website:</span>
                        <a 
                          href={user.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          {user.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Internal Company Information */}
                {(listing?.internal_company_name || listing?.internal_primary_owner || 
                  listing?.internal_salesforce_link || listing?.internal_deal_memo_link ||
                  listing?.internal_contact_info || listing?.internal_notes) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Shield className="h-4 w-4" />
                      Internal Information
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                        Admin Only
                      </Badge>
                    </h4>
                    <div className="space-y-2 text-sm bg-amber-50/30 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                      {listing.internal_company_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Real Company:</span>
                          <span className="font-medium">{listing.internal_company_name}</span>
                        </div>
                      )}
                      {listing.internal_primary_owner && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Owner:</span>
                          <span className="font-medium">{listing.internal_primary_owner}</span>
                        </div>
                      )}
                      {listing.internal_salesforce_link && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Salesforce:</span>
                          <a 
                            href={listing.internal_salesforce_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            View Opportunity
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {listing.internal_deal_memo_link && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Deal Memo:</span>
                          <a 
                            href={listing.internal_deal_memo_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            View Memo
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {listing.internal_contact_info && (
                        <div>
                          <span className="text-muted-foreground block mb-1">Internal Contacts:</span>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 p-2 rounded border">
                            {listing.internal_contact_info}
                          </p>
                        </div>
                      )}
                      {listing.internal_notes && (
                        <div>
                          <span className="text-muted-foreground block mb-1">Internal Notes:</span>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 p-2 rounded border">
                            {listing.internal_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Messages */}
              {(request.user_message || request.admin_comment) && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-base">Messages</h4>
                  
                  {request.user_message && (
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Buyer Message</span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-200">{request.user_message}</p>
                    </div>
                  )}
                  
                  {request.admin_comment && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Admin Response</span>
                      </div>
                      <p className="text-sm text-emerald-700 dark:text-emerald-200">{request.admin_comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}