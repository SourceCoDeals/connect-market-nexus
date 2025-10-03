import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, X, Check } from 'lucide-react';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useTaskReviewers, useAddTaskReviewer, useRemoveTaskReviewer } from '@/hooks/admin/use-deal-tasks';

interface TaskReviewersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

export function TaskReviewersDialog({ open, onOpenChange, taskId }: TaskReviewersDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: adminProfiles } = useAdminProfiles();
  const { data: reviewers = [] } = useTaskReviewers(taskId);
  const addReviewer = useAddTaskReviewer();
  const removeReviewer = useRemoveTaskReviewer();

  const reviewerIds = new Set(reviewers.map(r => r.admin_id));
  
  const filteredAdmins = adminProfiles 
    ? Object.values(adminProfiles).filter(admin => 
        admin.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleToggleReviewer = async (adminId: string) => {
    if (reviewerIds.has(adminId)) {
      await removeReviewer.mutateAsync({ taskId, adminId });
    } else {
      await addReviewer.mutateAsync({ taskId, adminId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reviewers</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredAdmins.map((admin) => {
              const isReviewer = reviewerIds.has(admin.id);
              
              return (
                <button
                  key={admin.id}
                  onClick={() => handleToggleReviewer(admin.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isReviewer ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                  }`}>
                    {isReviewer && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {admin.first_name?.[0]}{admin.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <span className="text-sm text-foreground">{admin.displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
