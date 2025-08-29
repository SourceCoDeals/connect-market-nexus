import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Calendar, 
  FileText,
  User,
  Clock,
  Plus,
  Send,
  ExternalLink,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

interface CommunicationEntry {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'document' | 'system';
  title: string;
  content: string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  created_at: string;
  metadata?: {
    to?: string;
    cc?: string;
    subject?: string;
    duration?: number;
    attendees?: string[];
    document_type?: string;
    system_action?: string;
    deal_stage?: string;
  };
}

interface CommunicationTimelineProps {
  dealId: string;
  dealTitle: string;
  contactEmail?: string;
  contactName?: string;
}

export function CommunicationTimeline({ 
  dealId, 
  dealTitle, 
  contactEmail, 
  contactName 
}: CommunicationTimelineProps) {
  // Mock data - in real implementation, this would come from an API
  const [communications, setCommunications] = useState<CommunicationEntry[]>([
    {
      id: '1',
      type: 'system',
      title: 'Deal Created',
      content: 'Deal was created and assigned to initial stage',
      admin_id: 'admin-1',
      admin_name: 'System',
      admin_email: 'system@company.com',
      created_at: '2024-01-15T09:00:00Z',
      metadata: {
        system_action: 'deal_created',
        deal_stage: 'Sourced'
      }
    },
    {
      id: '2',
      type: 'email',
      title: 'Initial Outreach',
      content: 'Sent initial introduction email to the prospect',
      admin_id: 'admin-2',
      admin_name: 'John Smith',
      admin_email: 'john@company.com',
      created_at: '2024-01-15T10:30:00Z',
      metadata: {
        to: contactEmail,
        subject: 'Introduction - Business Acquisition Opportunity',
      }
    },
    {
      id: '3',
      type: 'call',
      title: 'Discovery Call',
      content: 'Had initial discovery call to understand requirements and timeline',
      admin_id: 'admin-2',
      admin_name: 'John Smith',
      admin_email: 'john@company.com',
      created_at: '2024-01-16T14:00:00Z',
      metadata: {
        duration: 45,
        attendees: [contactName || 'Contact']
      }
    },
    {
      id: '4',
      type: 'document',
      title: 'NDA Sent',
      content: 'Sent NDA for review and signature',
      admin_id: 'admin-2',
      admin_name: 'John Smith',
      admin_email: 'john@company.com',
      created_at: '2024-01-17T11:15:00Z',
      metadata: {
        document_type: 'NDA',
        to: contactEmail
      }
    },
    {
      id: '5',
      type: 'note',
      title: 'Follow-up Notes',
      content: 'Prospect is very interested. Mentioned they want to move quickly. Should follow up in 2 days if no response on NDA.',
      admin_id: 'admin-2',
      admin_name: 'John Smith',
      admin_email: 'john@company.com',
      created_at: '2024-01-17T16:30:00Z',
    },
    {
      id: '6',
      type: 'system',
      title: 'NDA Signed',
      content: 'NDA was signed electronically',
      admin_id: 'admin-1',
      admin_name: 'System',
      admin_email: 'system@company.com',
      created_at: '2024-01-18T08:45:00Z',
      metadata: {
        system_action: 'nda_signed',
        deal_stage: 'NDA Signed'
      }
    }
  ]);

  const [newEntry, setNewEntry] = useState({
    type: 'note' as CommunicationEntry['type'],
    title: '',
    content: '',
    metadata: {}
  });

  const [filter, setFilter] = useState<'all' | CommunicationEntry['type']>('all');

  const filteredCommunications = useMemo(() => {
    if (filter === 'all') return communications;
    return communications.filter(comm => comm.type === filter);
  }, [communications, filter]);

  const getTypeIcon = (type: CommunicationEntry['type']) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'note': return <MessageSquare className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      case 'system': return <Clock className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: CommunicationEntry['type']) => {
    switch (type) {
      case 'email': return 'bg-blue-500';
      case 'call': return 'bg-green-500';
      case 'meeting': return 'bg-purple-500';
      case 'note': return 'bg-yellow-500';
      case 'document': return 'bg-orange-500';
      case 'system': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const handleAddEntry = () => {
    if (!newEntry.title.trim() || !newEntry.content.trim()) return;

    const entry: CommunicationEntry = {
      id: Date.now().toString(),
      type: newEntry.type,
      title: newEntry.title,
      content: newEntry.content,
      admin_id: 'current-admin',
      admin_name: 'Current Admin',
      admin_email: 'admin@company.com',
      created_at: new Date().toISOString(),
      metadata: newEntry.metadata
    };

    setCommunications(prev => [entry, ...prev]);
    setNewEntry({
      type: 'note',
      title: '',
      content: '',
      metadata: {}
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Communication Timeline</h3>
          <p className="text-sm text-muted-foreground">
            Track all interactions for {dealTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Add New Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Communication Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="entry-type">Type</Label>
              <Select 
                value={newEntry.type} 
                onValueChange={(value: any) => setNewEntry(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entry-title">Title</Label>
              <Input
                id="entry-title"
                value={newEntry.title}
                onChange={(e) => setNewEntry(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Communication title"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="entry-content">Content</Label>
            <Textarea
              id="entry-content"
              value={newEntry.content}
              onChange={(e) => setNewEntry(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Describe the communication..."
              rows={3}
            />
          </div>
          
          <Button onClick={handleAddEntry} disabled={!newEntry.title.trim() || !newEntry.content.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-4">
        {filteredCommunications.map((entry, index) => (
          <div key={entry.id} className="flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${getTypeColor(entry.type)} flex items-center justify-center text-white`}>
                {getTypeIcon(entry.type)}
              </div>
              {index < filteredCommunications.length - 1 && (
                <div className="w-px h-16 bg-border mt-2" />
              )}
            </div>
            
            {/* Content */}
            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{entry.title}</h4>
                    <Badge variant="outline" className="capitalize">
                      {entry.type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">{entry.content}</p>
                
                {/* Metadata */}
                {entry.metadata && (
                  <div className="space-y-2">
                    {entry.metadata.to && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">To:</span>
                        <span>{entry.metadata.to}</span>
                      </div>
                    )}
                    {entry.metadata.subject && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Subject:</span>
                        <span>{entry.metadata.subject}</span>
                      </div>
                    )}
                    {entry.metadata.duration && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Duration:</span>
                        <span>{entry.metadata.duration} minutes</span>
                      </div>
                    )}
                    {entry.metadata.attendees && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Attendees:</span>
                        <span>{entry.metadata.attendees.join(', ')}</span>
                      </div>
                    )}
                    {entry.metadata.document_type && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Document:</span>
                        <span>{entry.metadata.document_type}</span>
                      </div>
                    )}
                    {entry.metadata.system_action && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Action:</span>
                        <span className="capitalize">{entry.metadata.system_action.replace('_', ' ')}</span>
                        {entry.metadata.deal_stage && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="text-xs">
                              {entry.metadata.deal_stage}
                            </Badge>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Admin info */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {entry.admin_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{entry.admin_name}</span>
                  </div>
                  
                  {(entry.type === 'email' || entry.type === 'document') && (
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {filteredCommunications.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No communications found.</p>
          <p className="text-sm">Start by adding a communication entry above.</p>
        </div>
      )}
    </div>
  );
}