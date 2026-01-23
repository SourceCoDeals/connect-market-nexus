import { useState } from "react";
import { Star, Plus, Mail, Phone, Linkedin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  linkedin_url?: string | null;
  company_type?: string | null;
  is_primary?: boolean;
}

interface MainContactCardProps {
  contacts: Contact[];
  onAddContact: () => void;
}

export const MainContactCard = ({
  contacts,
  onAddContact,
}: MainContactCardProps) => {
  const [selectedContactId, setSelectedContactId] = useState<string>(
    contacts.find(c => c.is_primary)?.id || contacts[0]?.id || ""
  );

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Star className="h-4 w-4" />
            Main Point of Contact
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAddContact}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mb-2 opacity-50" />
            <p>No contacts available.</p>
            <p className="text-sm">Click "Add Contact" to create your first contact.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Contact Selector */}
            {contacts.length > 1 && (
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} · {contact.role || "No role"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Selected Contact Display */}
            {selectedContact && (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                      {getInitials(selectedContact.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{selectedContact.name}</span>
                      {selectedContact.company_type && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedContact.company_type}
                        </Badge>
                      )}
                    </div>
                    
                    {selectedContact.role && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{selectedContact.role}</span>
                      </div>
                    )}
                    
                    {selectedContact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <a 
                          href={`mailto:${selectedContact.email}`}
                          className="text-primary hover:underline"
                        >
                          {selectedContact.email}
                        </a>
                      </div>
                    )}
                    
                    {selectedContact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <a 
                          href={`tel:${selectedContact.phone}`}
                          className="hover:underline"
                        >
                          {selectedContact.phone}
                        </a>
                      </div>
                    )}
                    
                    {selectedContact.linkedin_url && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                        <a 
                          href={selectedContact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  {selectedContact.email && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <a href={`mailto:${selectedContact.email}`}>
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                      </a>
                    </Button>
                  )}
                  {selectedContact.phone && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <a href={`tel:${selectedContact.phone}`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Call
                      </a>
                    </Button>
                  )}
                  {selectedContact.linkedin_url && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <a 
                        href={selectedContact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Linkedin className="mr-2 h-4 w-4" />
                        LinkedIn
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
