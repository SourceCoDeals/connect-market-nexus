import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Zap, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  type SmartListConfig,
  humanizeRule,
  SELLER_FIELDS,
  BUYER_FIELDS,
} from '@/lib/smart-list-rules';
import type { ContactList } from '@/types/contact-list';

interface SmartListBannerProps {
  list: ContactList;
  onRefresh: () => void;
}

export function SmartListBanner({ list, onRefresh }: SmartListBannerProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isTogglingAutoAdd, setIsTogglingAutoAdd] = useState(false);

  if (!list.is_smart_list || !list.list_rules) return null;

  const config = list.list_rules as SmartListConfig;
  const fields = list.source_entity === 'listings' ? SELLER_FIELDS : BUYER_FIELDS;

  const handleEvaluateNow = async () => {
    setIsEvaluating(true);
    try {
      const { data, error } = await supabase.rpc('evaluate_smart_list_now', {
        p_list_id: list.id,
      });
      if (error) throw error;
      toast.success(
        `Queued ${data} ${list.source_entity === 'listings' ? 'leads' : 'buyers'} for evaluation`,
      );
      onRefresh();
    } catch (err) {
      toast.error('Failed to trigger evaluation', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleToggleAutoAdd = async (enabled: boolean) => {
    setIsTogglingAutoAdd(true);
    try {
      const { error } = await (supabase.from('contact_lists') as any)
        .update({ auto_add_enabled: enabled })
        .eq('id', list.id);
      if (error) throw error;
      toast.success(enabled ? 'Auto-add enabled' : 'Auto-add paused');
      onRefresh();
    } catch (err) {
      toast.error('Failed to update auto-add setting');
    } finally {
      setIsTogglingAutoAdd(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          <span className="font-medium text-sm">Smart List</span>
          <Badge variant="outline" className="text-xs">
            {config.match_mode === 'all' ? 'ALL rules match' : 'ANY rule matches'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-add"
              checked={list.auto_add_enabled}
              onCheckedChange={handleToggleAutoAdd}
              disabled={isTogglingAutoAdd}
            />
            <Label htmlFor="auto-add" className="text-xs text-muted-foreground cursor-pointer">
              Auto-add
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleEvaluateNow} disabled={isEvaluating}>
            {isEvaluating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Evaluate Now
          </Button>
        </div>
      </div>

      {/* Rules summary */}
      <div className="flex flex-wrap gap-1.5">
        {config.rules.map((rule, i) => (
          <Badge key={i} variant="secondary" className="text-xs font-normal">
            {humanizeRule(rule, fields)}
          </Badge>
        ))}
      </div>

      {/* Last evaluated */}
      {list.last_evaluated_at && (
        <p className="text-xs text-muted-foreground">
          Last evaluated{' '}
          {formatDistanceToNow(new Date(list.last_evaluated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
