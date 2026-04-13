import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Zap, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCreateContactList } from '@/hooks/admin/use-contact-lists';
import { SmartListRuleBuilder } from './SmartListRuleBuilder';
import { type SmartListRule, type SmartListConfig, matchesRules } from '@/lib/smart-list-rules';

interface CreateSmartListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSmartListDialog({ open, onOpenChange }: CreateSmartListDialogProps) {
  const navigate = useNavigate();
  const createList = useCreateContactList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceEntity, setSourceEntity] = useState<'listings' | 'remarketing_buyers'>('listings');
  const [rules, setRules] = useState<SmartListRule[]>([]);
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSampled, setPreviewSampled] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const PREVIEW_SAMPLE_SIZE = 10000;

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setRules([]);
      setMatchMode('all');
      setPreviewCount(null);
      setPreviewSampled(false);
      setSourceEntity('listings');
    }
  }, [open]);

  // Reset preview when rules change
  useEffect(() => {
    setPreviewCount(null);
    setPreviewSampled(false);
  }, [rules, matchMode, sourceEntity]);

  const handlePreview = async () => {
    if (rules.length === 0) return;
    setIsPreviewing(true);

    try {
      const config: SmartListConfig = { rules, match_mode: matchMode };

      if (sourceEntity === 'listings') {
        // Fetch a sample of listings and evaluate client-side
        const { data, error } = await supabase
          .from('listings')
          .select(
            'id, industry, category, categories, services, service_mix, executive_summary, address_state, linkedin_employee_count, google_review_count, google_rating, number_of_locations, deal_total_score, deal_source, enriched_at, main_contact_email, main_contact_phone, is_priority_target, website, created_at',
          )
          .is('deleted_at', null)
          .or('not_a_fit.eq.false,not_a_fit.is.null')
          .not('main_contact_email', 'is', null)
          .limit(PREVIEW_SAMPLE_SIZE);

        if (error) throw error;
        const rows = data || [];
        const matches = rows.filter((row) =>
          matchesRules(row as Record<string, unknown>, config),
        );
        setPreviewCount(matches.length);
        setPreviewSampled(rows.length >= PREVIEW_SAMPLE_SIZE);
      } else {
        const { data, error } = await supabase
          .from('buyers')
          .select('id, target_services, target_geographies, buyer_type, is_pe_backed, hq_state')
          .eq('archived', false)
          .is('deleted_at', null)
          .limit(PREVIEW_SAMPLE_SIZE);

        if (error) throw error;
        const rows = data || [];
        const matches = rows.filter((row) =>
          matchesRules(row as Record<string, unknown>, config),
        );
        setPreviewCount(matches.length);
        setPreviewSampled(rows.length >= PREVIEW_SAMPLE_SIZE);
      }
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCreate = () => {
    if (!name.trim() || rules.length === 0) return;

    const config: SmartListConfig = { rules, match_mode: matchMode };
    const listType = sourceEntity === 'listings' ? 'seller' : 'buyer';

    createList.mutate(
      {
        name,
        description: description || undefined,
        list_type: listType,
        members: [],
        is_smart_list: true,
        list_rules: config,
        match_mode: matchMode,
        source_entity: sourceEntity,
        auto_add_enabled: true,
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          navigate(`/admin/lists/${data.id}`);
        },
      },
    );
  };

  const canCreate = name.trim().length > 0 && rules.length > 0 && !createList.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Create Smart List
          </DialogTitle>
          <DialogDescription>
            Define rules and matching leads will be automatically added to this list.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="smart-name">List Name *</Label>
            <Input
              id="smart-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Restoration Companies — Midwest"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="smart-desc">Description</Label>
            <Textarea
              id="smart-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this list for?"
              rows={2}
            />
          </div>

          {/* Source entity */}
          <div className="space-y-2">
            <Label>List Type</Label>
            <Select
              value={sourceEntity}
              onValueChange={(v) => {
                setSourceEntity(v as 'listings' | 'remarketing_buyers');
                setRules([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listings">Seller List (deals / leads)</SelectItem>
                <SelectItem value="remarketing_buyers">Buyer List (buyers / contacts)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rules */}
          <div className="space-y-2">
            <Label>Rules</Label>
            <SmartListRuleBuilder
              sourceEntity={sourceEntity}
              rules={rules}
              matchMode={matchMode}
              onRulesChange={setRules}
              onMatchModeChange={setMatchMode}
            />
          </div>

          {/* Preview */}
          {rules.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 flex-wrap">
              <Button variant="outline" size="sm" onClick={handlePreview} disabled={isPreviewing}>
                {isPreviewing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                )}
                Preview
              </Button>
              {previewCount !== null && (
                <Badge variant="secondary" className="text-sm">
                  {previewSampled ? '~' : ''}
                  {previewCount} {sourceEntity === 'listings' ? 'leads' : 'buyers'} match
                </Badge>
              )}
              {previewSampled && (
                <span className="text-xs text-muted-foreground">
                  Sampled first {PREVIEW_SAMPLE_SIZE.toLocaleString()} — full evaluation runs when
                  the list is saved.
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {createList.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Create Smart List
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
