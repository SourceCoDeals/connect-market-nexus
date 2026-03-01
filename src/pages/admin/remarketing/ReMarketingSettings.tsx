import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, GitMerge, ChevronDown, Users, Zap } from 'lucide-react';
import { DealMergePanel } from '@/components/remarketing';
import { TeamMemberRegistry } from '@/components/daily-tasks/TeamMemberRegistry';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

function useAutoApproveSetting() {
  return useQuery({
    queryKey: ['app-settings', 'task_auto_approve_high_confidence'],
    queryFn: async () => {
      const { data } = await (supabase
        .from('app_settings' as any)
        .select('value')
        .eq('key', 'task_auto_approve_high_confidence')
        .single() as any);
      if (!data) return true; // default: enabled
      return (data as any).value === 'true' || (data as any).value === true;
    },
    staleTime: 60_000,
  });
}

function useUpdateAutoApproveSetting() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await (supabase
        .from('app_settings' as any)
        .upsert(
          { key: 'task_auto_approve_high_confidence', value: String(enabled) },
          { onConflict: 'key' },
        ) as any);
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ['app-settings', 'task_auto_approve_high_confidence'] });
      toast({ title: `Auto-approve ${enabled ? 'enabled' : 'disabled'}` });
    },
    onError: (err) => {
      toast({
        title: 'Failed to update setting',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

export default function ReMarketingSettings() {
  const [mergeOpen, setMergeOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);

  const { data: autoApproveEnabled, isLoading: autoApproveLoading } = useAutoApproveSetting();
  const updateAutoApprove = useUpdateAutoApproveSetting();

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">ReMarketing module configuration and tools</p>
        </div>
      </div>

      <Collapsible open={mergeOpen} onOpenChange={setMergeOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GitMerge className="h-5 w-5 text-primary" />
                  Merge Deals
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${mergeOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Link marketplace listings with buyer universe data
              </p>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              <DealMergePanel />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={teamOpen} onOpenChange={setTeamOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Daily Tasks — Team Name Mapping
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${teamOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Map Fireflies speaker names to team members for automatic task assignment
              </p>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              <TeamMemberRegistry />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  Daily Tasks — Automation
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${tasksOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Control how AI-extracted standup tasks are processed
              </p>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-approve-toggle" className="text-sm font-medium">
                    Auto-approve high-confidence standup tasks
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Tasks with high AI confidence and a matched assignee skip the approval queue and
                    go directly to reps. Medium/low confidence tasks still require manual review.
                  </p>
                </div>
                <Switch
                  id="auto-approve-toggle"
                  checked={autoApproveEnabled ?? true}
                  onCheckedChange={(checked) => updateAutoApprove.mutate(checked)}
                  disabled={autoApproveLoading || updateAutoApprove.isPending}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
