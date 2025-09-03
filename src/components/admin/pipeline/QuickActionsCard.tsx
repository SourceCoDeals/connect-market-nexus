import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  Plus,
  Send,
  ExternalLink,
  Clock,
  User,
  Zap
} from 'lucide-react';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
import { useCreateDealTask } from '@/hooks/admin/use-deal-tasks';
import { cn } from '@/lib/utils';

interface QuickActionsCardProps {
  dealId: string;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  className?: string;
}

export function QuickActionsCard({ 
  dealId, 
  contactEmail, 
  contactPhone, 
  contactName,
  className 
}: QuickActionsCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<'email' | 'call' | 'meeting' | 'task' | 'note' | null>(null);
  const [formData, setFormData] = useState({
    subject: '',
    content: '',
    duration: '',
    taskTitle: '',
    taskDescription: '',
    taskPriority: 'medium' as 'low' | 'medium' | 'high',
    taskDueDate: '',
    meetingDate: '',
    meetingTime: ''
  });

  const logContact = useLogDealContact();
  const createTask = useCreateDealTask();

  const quickActions = [
    {
      id: 'email',
      label: 'Send Email',
      icon: Mail,
      color: 'bg-blue-500 hover:bg-blue-600',
      enabled: !!contactEmail,
      description: 'Compose email'
    },
    {
      id: 'call',
      label: 'Log Call',
      icon: Phone,
      color: 'bg-green-500 hover:bg-green-600',
      enabled: !!contactPhone,
      description: 'Record call details'
    },
    {
      id: 'meeting',
      label: 'Schedule Meeting',
      icon: Calendar,
      color: 'bg-purple-500 hover:bg-purple-600',
      enabled: true,
      description: 'Plan meeting'
    },
    {
      id: 'task',
      label: 'Create Task',
      icon: Plus,
      color: 'bg-orange-500 hover:bg-orange-600',
      enabled: true,
      description: 'Add follow-up task'
    },
    {
      id: 'note',
      label: 'Add Note',
      icon: MessageSquare,
      color: 'bg-gray-500 hover:bg-gray-600',
      enabled: true,
      description: 'Quick note'
    }
  ];

  const handleActionClick = (actionId: string) => {
    setActiveAction(actionId as any);
    setIsDialogOpen(true);
    
    // Pre-fill some defaults
    if (actionId === 'email' && contactEmail) {
      setFormData(prev => ({
        ...prev,
        subject: `Follow-up: Business Opportunity Discussion`
      }));
    }
  };

  const handleSubmit = async () => {
    if (!activeAction) return;

    try {
      switch (activeAction) {
        case 'email':
          await logContact.mutateAsync({
            dealId,
            contactType: 'email',
            details: {
              recipient: contactEmail,
              subject: formData.subject,
              content: formData.content
            }
          });
          break;
          
        case 'call':
          await logContact.mutateAsync({
            dealId,
            contactType: 'phone',
            details: {
              phone: contactPhone,
              duration: formData.duration,
              notes: formData.content
            }
          });
          break;
          
        case 'meeting':
          await logContact.mutateAsync({
            dealId,
            contactType: 'meeting',
            details: {
              scheduled_date: formData.meetingDate,
              scheduled_time: formData.meetingTime,
              notes: formData.content
            }
          });
          break;
          
        case 'task':
          await createTask.mutateAsync({
            deal_id: dealId,
            title: formData.taskTitle,
            description: formData.taskDescription,
            priority: formData.taskPriority,
            due_date: formData.taskDueDate || undefined
          });
          break;
          
        case 'note':
          await logContact.mutateAsync({
            dealId,
            contactType: 'note',
            details: {
              note: formData.content
            }
          });
          break;
      }
      
      // Reset form and close dialog
      setFormData({
        subject: '',
        content: '',
        duration: '',
        taskTitle: '',
        taskDescription: '',
        taskPriority: 'medium',
        taskDueDate: '',
        meetingDate: '',
        meetingTime: ''
      });
      setIsDialogOpen(false);
      setActiveAction(null);
      
    } catch (error) {
      console.error('Failed to perform action:', error);
    }
  };

  const getDialogTitle = () => {
    switch (activeAction) {
      case 'email': return 'Send Email';
      case 'call': return 'Log Phone Call';
      case 'meeting': return 'Schedule Meeting';
      case 'task': return 'Create Task';
      case 'note': return 'Add Note';
      default: return 'Quick Action';
    }
  };

  const isLoading = logContact.isPending || createTask.isPending;

  return (
    <>
      <Card className={cn("border-gray-200/60 shadow-sm bg-white/60 rounded-lg", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-600" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                variant={action.enabled ? "default" : "outline"}
                size="sm"
                disabled={!action.enabled}
                onClick={() => handleActionClick(action.id)}
                className={cn(
                  "h-auto flex-col items-center gap-2 p-3 text-xs",
                  action.enabled ? action.color : "opacity-50"
                )}
              >
                <action.icon className="w-4 h-4" />
                <span className="font-medium">{action.label}</span>
              </Button>
            ))}
          </div>

          {/* Quick Info */}
          <div className="mt-4 pt-3 border-t border-gray-200/60">
            <div className="space-y-2">
              {contactEmail && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{contactEmail}</span>
                </div>
              )}
              {contactPhone && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Phone className="w-3 h-3" />
                  <span>{contactPhone}</span>
                </div>
              )}
              {contactName && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <User className="w-3 h-3" />
                  <span>{contactName}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {activeAction === 'email' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Subject</label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Email subject"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Message</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Email content..."
                    rows={4}
                  />
                </div>
              </>
            )}

            {activeAction === 'call' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Duration (minutes)</label>
                  <Input
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="30"
                    type="number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Call Notes</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="What was discussed during the call..."
                    rows={4}
                  />
                </div>
              </>
            )}

            {activeAction === 'meeting' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Date</label>
                    <Input
                      value={formData.meetingDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, meetingDate: e.target.value }))}
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Time</label>
                    <Input
                      value={formData.meetingTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, meetingTime: e.target.value }))}
                      type="time"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Meeting Notes</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Meeting agenda or notes..."
                    rows={3}
                  />
                </div>
              </>
            )}

            {activeAction === 'task' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Task Title</label>
                  <Input
                    value={formData.taskTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, taskTitle: e.target.value }))}
                    placeholder="What needs to be done?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Priority</label>
                    <Select value={formData.taskPriority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, taskPriority: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Due Date</label>
                    <Input
                      value={formData.taskDueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, taskDueDate: e.target.value }))}
                      type="date"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <Textarea
                    value={formData.taskDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, taskDescription: e.target.value }))}
                    placeholder="Task details..."
                    rows={3}
                  />
                </div>
              </>
            )}

            {activeAction === 'note' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Note</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Add your note here..."
                  rows={4}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isLoading || !formData.content && activeAction !== 'task'}
              >
                {isLoading ? 'Processing...' : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}