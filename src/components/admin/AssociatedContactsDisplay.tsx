import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, Users, Mail, Phone, Building2, User, Plus } from "lucide-react";
import { useAssociatedContactsQuery } from "@/hooks/admin/use-associated-contacts";
import { AdminConnectionRequest } from "@/types/admin";

interface AssociatedContactsDisplayProps {
  connectionRequest: AdminConnectionRequest;
  className?: string;
}

export const AssociatedContactsDisplay = ({ 
  connectionRequest, 
  className = "" 
}: AssociatedContactsDisplayProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: contacts = [], isLoading } = useAssociatedContactsQuery(connectionRequest.id);

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-card-foreground">Associated Contacts</span>
        </div>
        <div className="text-xs text-muted-foreground">Loading contacts...</div>
      </div>
    );
  }

  if (contacts?.length === 0 || !Array.isArray(contacts)) {
    return null; // Don't show the section if no contacts
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full p-0 h-auto justify-start hover:bg-transparent"
          >
            <div className="flex items-center gap-2 pb-1 border-b border-border/40 w-full">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-card-foreground">
                Associated Contacts ({contacts?.length || 0})
              </span>
              <div className="ml-auto">
                {isOpen ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="text-xs text-muted-foreground mb-3">
            Other contacts from the same firm interested in this listing:
          </div>
          
          {contacts?.map((contact, index) => (
            <Card key={contact.id} className="border border-border/30">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">
                        {contact.relationship_metadata?.name || 'Unknown'}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {contact.relationship_metadata?.source === 'inbound_lead' ? 'Lead' : 'Request'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                    {contact.relationship_metadata?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <a 
                          href={`mailto:${contact.relationship_metadata.email}`}
                          className="hover:text-primary transition-colors"
                        >
                          {contact.relationship_metadata.email}
                        </a>
                      </div>
                    )}
                    
                    {contact.relationship_metadata?.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        <span>{contact.relationship_metadata.company}</span>
                      </div>
                    )}
                    
                    {contact.relationship_metadata?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{contact.relationship_metadata.phone}</span>
                      </div>
                    )}
                    
                    {contact.relationship_metadata?.role && (
                      <div className="text-xs">
                        <span className="font-medium">Role:</span> {contact.relationship_metadata.role}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <div className="pt-2 border-t border-border/30">
            <Button
              size="sm"
              variant="outline"
              className="w-full flex items-center gap-2 text-xs"
              onClick={() => {
                // TODO: Implement add contact functionality
                console.log('Add contact for request:', connectionRequest.id);
              }}
            >
              <Plus className="h-3 w-3" />
              Add Another Contact from Same Firm
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};