import { useState } from 'react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RefreshCw, Zap, Shield, CheckCircle } from 'lucide-react';
import { BuyerTierBadgeFull } from './BuyerQualityBadges';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface BuyerQualityScorePanelProps {
  user: User;
}

export function BuyerQualityScorePanel({ user }: BuyerQualityScorePanelProps) {
  const queryClient = useQueryClient();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [overrideTier, setOverrideTier] = useState<string>(
    user.admin_tier_override != null ? String(user.admin_tier_override) : 'none',
  );
  const [overrideNote, setOverrideNote] = useState(user.admin_override_note || '');
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const { queueBuyerQualityScoring } = await import("@/lib/remarketing/queueScoring");
      const result = await queueBuyerQualityScoring([user.id]);
      if (result.errors > 0) throw new Error("Scoring failed");
      toast({
        title: 'Score recalculated',
        description: 'Buyer quality score updated',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Recalculation failed',
        description: (err as Error).message,
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSaveOverride = async () => {
    setIsSavingOverride(true);
    try {
      const tierValue = overrideTier === 'none' ? null : parseInt(overrideTier, 10);
      const { error } = await supabase
        .from('profiles')
        .update({
          admin_tier_override: tierValue,
          admin_override_note: tierValue != null ? overrideNote : null,
          // If override is set, update the active tier too
          buyer_tier: tierValue ?? user.buyer_tier,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast({ title: 'Override saved' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to save override',
        description: (err as Error).message,
      });
    } finally {
      setIsSavingOverride(false);
    }
  };

  const score = user.buyer_quality_score;
  const hasScore = score != null;

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      <div className="flex items-start gap-6">
        <div className="text-center">
          <div
            className={`text-4xl font-bold ${
              score != null && score >= 70
                ? 'text-green-600'
                : score != null && score >= 45
                  ? 'text-blue-600'
                  : score != null && score >= 15
                    ? 'text-amber-600'
                    : 'text-red-600'
            }`}
          >
            {hasScore ? score : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Quality Score</div>
        </div>
        <div className="space-y-2">
          <BuyerTierBadgeFull
            tier={user.buyer_tier}
            isOverride={user.admin_tier_override != null}
          />
          {user.platform_signal_detected && (
            <div className="flex items-center gap-1 text-xs text-green-700">
              <Zap className="h-3 w-3" />
              Add-On Signal ({user.platform_signal_source || 'detected'})
            </div>
          )}
          {user.buyer_quality_score_last_calculated ? (
            <div className="text-xs text-muted-foreground">
              Scored{' '}
              {formatDistanceToNow(new Date(user.buyer_quality_score_last_calculated), {
                addSuffix: true,
              })}
            </div>
          ) : (
            <div className="text-xs text-red-500">Not scored</div>
          )}
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={isRecalculating}
          >
            {isRecalculating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Recalculate Score
          </Button>
        </div>
      </div>

      {/* Score Breakdown */}
      {hasScore && (
        <div className="grid grid-cols-4 gap-4">
          <ScoreComponent label="Buyer Type" max={40} description="Based on buyer classification" />
          <ScoreComponent label="Platform Signal" max={30} description="Add-on / bolt-on intent" />
          <ScoreComponent
            label="Capital Credibility"
            max={20}
            description="Email, website, fund data"
          />
          <ScoreComponent
            label="Profile Completeness"
            max={10}
            description="Criteria, geo, phone, etc."
          />
        </div>
      )}

      {/* Admin Override */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4" />
          Admin Tier Override
        </div>
        <div className="flex items-center gap-3">
          <Select value={overrideTier} onValueChange={setOverrideTier}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="No override" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No override (use algorithm)</SelectItem>
              <SelectItem value="1">Tier 1 — Platform Add-On</SelectItem>
              <SelectItem value="2">Tier 2 — Committed Capital</SelectItem>
              <SelectItem value="3">Tier 3 — Indep. Sponsor/Search</SelectItem>
              <SelectItem value="4">Tier 4 — Unverified</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleSaveOverride} disabled={isSavingOverride}>
            {isSavingOverride ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            Save Override
          </Button>
        </div>
        {overrideTier !== 'none' && (
          <Textarea
            placeholder="Override reason/note (visible to admin team)"
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            className="text-sm"
            rows={2}
          />
        )}
      </div>
    </div>
  );
}

function ScoreComponent({
  label,
  max,
  description,
}: {
  label: string;
  max: number;
  description: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 text-center space-y-1">
      <div className="text-xs font-medium text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">max {max}</div>
      <div className="text-[10px] text-muted-foreground">{description}</div>
    </div>
  );
}
