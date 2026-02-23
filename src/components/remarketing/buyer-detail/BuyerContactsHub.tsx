import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Users, Mail, Phone, Linkedin, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useBuyerAllContacts, type ContactSource } from "@/hooks/admin/use-buyer-all-contacts";

interface BuyerContactsHubProps {
  buyerId: string;
  emailDomain: string | null | undefined;
  onAddContact: () => void;
  onDeleteContact: (contactId: string) => void;
}

const SOURCE_CONFIG: Record<ContactSource, { label: string; className: string }> = {
  remarketing: { label: "CRM", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  marketplace: { label: "Marketplace", className: "bg-green-50 text-green-700 border-green-200" },
  lead: { label: "Lead", className: "bg-orange-50 text-orange-700 border-orange-200" },
};

export function BuyerContactsHub({ buyerId, emailDomain, onAddContact, onDeleteContact }: BuyerContactsHubProps) {
  const { data: contacts = [], isLoading } = useBuyerAllContacts(buyerId, emailDomain);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              All Contacts ({contacts.length})
            </CardTitle>
            <CardDescription>
              Contacts from CRM, marketplace registrations, and connection requests
              {emailDomain && (
                <span className="ml-1">
                  · Tracking <Badge variant="outline" className="text-[10px] ml-1">@{emailDomain}</Badge>
                </span>
              )}
            </CardDescription>
          </div>
          <Button size="sm" onClick={onAddContact}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No contacts found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>LinkedIn</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    {contact.profileId ? (
                      <Link
                        to={`/admin/users/${contact.profileId}`}
                        className="hover:underline text-primary flex items-center gap-1"
                      >
                        {contact.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      contact.name
                    )}
                    {contact.isPrimary && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">Primary</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold px-1.5 py-0 ${SOURCE_CONFIG[contact.source].className}`}
                    >
                      {SOURCE_CONFIG[contact.source].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{contact.role || '—'}</TableCell>
                  <TableCell>
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline text-sm">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline text-sm">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {contact.linkedinUrl ? (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Linkedin className="h-3 w-3" />
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {contact.source === 'remarketing' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          // Extract the real contact ID from the prefixed id
                          const realId = contact.id.replace('rm-', '');
                          if (confirm('Delete this contact?')) {
                            onDeleteContact(realId);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
