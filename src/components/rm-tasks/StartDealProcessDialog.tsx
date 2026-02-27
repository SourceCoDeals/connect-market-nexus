import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Rocket, CheckCircle2, Clock } from 'lucide-react';
import { useCreateFromTemplate, useTeamMembers } from '@/hooks/useRmTasks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DEAL_STAGE_TEMPLATES, type DealStageTemplate } from '@/types/rm-tasks';

interface StartDealProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName?: string;
}

export function StartDealProcessDialog({
  open,
  onOpenChange,
  dealId,
  dealName,
}: StartDealProcessDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createFromTemplate = useCreateFromTemplate();
  const { data: teamMembers = [] } = useTeamMembers();

  const [template, setTemplate] = useState<DealStageTemplate>('intake_qualification');
  const [ownerId, setOwnerId] = useState(user?.id ?? '');

  const selectedTemplate = DEAL_STAGE_TEMPLATES[template];

  const handleCreate = async () => {
    try {
      const ids = await createFromTemplate.mutateAsync({
        template,
        dealId,
        ownerId: ownerId || user!.id,
      });
      toast({
        title: 'Tasks created',
        description: `${ids.length} template tasks created for ${dealName || 'this deal'}.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Failed to create template tasks',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Start Deal Process
          </DialogTitle>
          <DialogDescription>
            Create a standard set of milestone tasks for{' '}
            {dealName ? <span className="font-medium">{dealName}</span> : 'this deal'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Stage Template</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as DealStageTemplate)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DEAL_STAGE_TEMPLATES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label} ({config.tasks.length} tasks)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assign To (Deal Lead)</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tasks to be created:</Label>
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {selectedTemplate.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="flex-1">{t.title}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {t.due_days}d
                  </span>
                  {t.priority === 'high' && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded">HIGH</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createFromTemplate.isPending}>
            {createFromTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create {selectedTemplate.tasks.length} Tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
