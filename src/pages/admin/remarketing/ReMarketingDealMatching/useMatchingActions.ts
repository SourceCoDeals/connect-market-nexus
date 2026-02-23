import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { OutreachStatus } from "@/components/remarketing";

interface UseMatchingActionsProps {
  listingId: string | undefined;
  scores: any[] | undefined;
  selectedUniverse: string;
  setIsScoring: (v: boolean) => void;
  setScoringProgress: (v: number) => void;
  customInstructions: string;
  setCustomInstructions: (v: string) => void;
  refetchOutreach: () => void;
  listing: any;
}

export function useMatchingActions({
  listingId, scores, selectedUniverse,
  setIsScoring, setScoringProgress, customInstructions, setCustomInstructions,
  refetchOutreach, listing,
}: UseMatchingActionsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [selectedBuyerForPass, setSelectedBuyerForPass] = useState<{ id: string; name: string; scoreData?: any } | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [highlightedBuyerIds, setHighlightedBuyerIds] = useState<string[]>([]);

  // Log learning history
  const logLearningHistory = async (scoreData: any, action: 'approved' | 'passed', passReason?: string, passCategory?: string) => {
    try {
      await supabase.from('buyer_learning_history').insert({
        buyer_id: scoreData.buyer_id, listing_id: listingId!, universe_id: scoreData.universe_id,
        score_id: scoreData.id, action, pass_reason: passReason, pass_category: passCategory,
        composite_score: scoreData.composite_score, geography_score: scoreData.geography_score,
        size_score: scoreData.size_score, service_score: scoreData.service_score,
        owner_goals_score: scoreData.owner_goals_score, action_by: user?.id,
      });
    } catch (error) { console.error('Failed to log learning history:', error); }
  };

  // Update score mutation
  const updateScoreMutation = useMutation({
    mutationFn: async ({ id, status, pass_reason, pass_category, scoreData }: { id: string; status: string; pass_reason?: string; pass_category?: string; scoreData?: any }) => {
      const { error } = await supabase.from('remarketing_scores').update({ status, pass_reason, pass_category }).eq('id', id);
      if (error) throw error;
      if (scoreData) await logLearningHistory(scoreData, status as 'approved' | 'passed', pass_reason, pass_category);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'learning-insights'] });
      toast.success('Match updated');
    },
    onError: () => { toast.error('Failed to update match'); }
  });

  // Bulk approve
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('remarketing_scores').update({ status: 'approved' }).in('id', ids);
      if (error) throw error;
      for (const id of ids) {
        const scoreData = scores?.find(s => s.id === id);
        if (scoreData) {
          await logLearningHistory(scoreData, 'approved');
          try { await supabase.from('remarketing_outreach').upsert({ score_id: id, listing_id: listingId!, buyer_id: scoreData.buyer_id, status: 'pending', created_by: user?.id }, { onConflict: 'score_id' }); } catch (err) { console.error('Failed to create outreach', id, err); }
          if (scoreData.buyer_id) supabase.functions.invoke('find-buyer-contacts', { body: { buyerId: scoreData.buyer_id } }).catch(err => console.warn('Contact discovery failed:', err));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
      refetchOutreach();
      setSelectedIds(new Set());
      toast.success(`Approved ${selectedIds.size} buyers — outreach tracking started`);
    },
    onError: () => { toast.error('Failed to bulk approve'); }
  });

  // Scoring
  const handleBulkScore = async (_instructions?: string) => {
    if (!selectedUniverse) { toast.error('Please select a universe first'); return; }
    setIsScoring(true);
    setScoringProgress(10);
    try {
      const { queueDealScoring } = await import("@/lib/remarketing/queueScoring");
      await queueDealScoring({ universeId: selectedUniverse, listingIds: [listingId!] });
      setScoringProgress(100);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
    } catch (error) { console.error('Scoring error:', error); toast.error('Failed to score buyers'); }
    finally { setIsScoring(false); setScoringProgress(0); }
  };

  const handleApplyAndRescore = async (instructions: string) => {
    if (!listingId) return;
    try { await supabase.from('deal_scoring_adjustments').upsert({ listing_id: listingId!, adjustment_type: 'custom_instructions', adjustment_value: 0, reason: instructions, created_by: user?.id }, { onConflict: 'listing_id,adjustment_type' }); }
    catch (error) { console.error('Failed to save custom instructions:', error); }
    await handleBulkScore(instructions);
  };

  const handleReset = async () => {
    setCustomInstructions("");
    try { await supabase.from('deal_scoring_adjustments').delete().eq('listing_id', listingId!).eq('adjustment_type', 'custom_instructions'); }
    catch (error) { console.error('Failed to clear custom instructions:', error); }
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
    queryClient.invalidateQueries({ queryKey: ['deal-scoring-adjustments', listingId] });
    toast.success('Scoring reset');
  };

  const handleOpenPassDialog = (scoreId: string, buyerName: string, scoreData?: any) => {
    setSelectedBuyerForPass({ id: scoreId, name: buyerName, scoreData });
    setPassDialogOpen(true);
  };

  const handleConfirmPass = (reason: string, category: string) => {
    if (selectedBuyerForPass) {
      updateScoreMutation.mutate({ id: selectedBuyerForPass.id, status: 'passed', pass_reason: reason, pass_category: category, scoreData: selectedBuyerForPass.scoreData });
      setPassDialogOpen(false);
      setSelectedBuyerForPass(null);
    }
  };

  const handleToggleInterested = async (scoreId: string, interested: boolean, scoreData?: any) => {
    if (interested) await handleApprove(scoreId, scoreData);
    else { await updateScoreMutation.mutateAsync({ id: scoreId, status: 'pending', scoreData }); toast.success('Reverted to pending'); }
  };

  const handleApprove = async (scoreId: string, scoreData?: any) => {
    await updateScoreMutation.mutateAsync({ id: scoreId, status: 'approved', scoreData });
    try {
      const { error } = await supabase.from('remarketing_outreach').upsert({ score_id: scoreId, listing_id: listingId!, buyer_id: scoreData?.buyer_id, status: 'pending', created_by: user?.id }, { onConflict: 'score_id' });
      if (error) console.error('Failed to auto-create outreach:', error);
      else { refetchOutreach(); toast.success('Buyer approved - outreach tracking started'); }
    } catch (error) { console.error('Failed to auto-create outreach:', error); }
    if (scoreData?.buyer_id) supabase.functions.invoke('find-buyer-contacts', { body: { buyerId: scoreData.buyer_id } }).catch(err => console.warn('Contact discovery failed:', err));
  };

  const handleBulkApprove = async () => { if (selectedIds.size === 0) return; await bulkApproveMutation.mutateAsync(Array.from(selectedIds)); };

  const handleBulkPass = async (reason: string, category: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('remarketing_scores').update({ status: 'passed', pass_reason: reason, pass_category: category }).in('id', ids);
    if (error) throw error;
    for (const id of ids) { const scoreData = scores?.find(s => s.id === id); if (scoreData) await logLearningHistory(scoreData, 'passed', reason, category); }
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
    setSelectedIds(new Set());
  };

  const handleExportCSV = () => {
    const selectedScores = scores?.filter(s => selectedIds.has(s.id)) || [];
    if (selectedScores.length === 0) return;
    const csvData = selectedScores.map(s => ({
      buyer_name: s.buyer?.company_name || '', website: s.buyer?.company_website || '',
      hq_location: s.buyer?.hq_city && s.buyer?.hq_state ? `${s.buyer.hq_city}, ${s.buyer.hq_state}` : '',
      pe_firm: s.buyer?.pe_firm_name || '', score: s.composite_score, tier: s.tier,
      geography_score: s.geography_score, size_score: s.size_score, service_score: s.service_score,
      owner_goals_score: s.owner_goals_score, size_multiplier: s.size_multiplier,
      service_multiplier: s.service_multiplier, status: s.status, fit_reasoning: s.fit_reasoning || '',
    }));
    const headers = Object.keys(csvData[0]);
    const csv = [headers.join(','), ...csvData.map(row => headers.map(h => `"${(row as Record<string, unknown>)[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buyer-matches-${listing?.title?.replace(/\s+/g, '-').toLowerCase() || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const handleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) newSelected.add(id); else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleOutreachUpdate = async (scoreId: string, status: OutreachStatus, notes: string) => {
    const score = scores?.find(s => s.id === scoreId);
    if (!score) return;
    const { error } = await supabase.from('remarketing_outreach').upsert({ score_id: scoreId, listing_id: listingId!, buyer_id: score.buyer_id, status, notes, contacted_at: status !== 'pending' ? new Date().toISOString() : null, created_by: user?.id }, { onConflict: 'score_id' });
    if (error) { console.error('Failed to update outreach:', error); toast.error('Failed to update outreach status'); return; }
    toast.success('Outreach status updated');
    refetchOutreach();
  };

  const handleScoreViewed = async (scoreId: string) => {
    try { await supabase.from('remarketing_scores').update({ last_viewed_at: new Date().toISOString() }).eq('id', scoreId); }
    catch (err) { console.error('Failed to track view:', err); }
  };

  const handleMoveToPipeline = async (scoreId: string, buyerId: string, targetListingId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('convert-to-pipeline-deal', { body: { listing_id: targetListingId, buyer_id: buyerId, score_id: scoreId } });
      if (error) throw error;
      if (data?.already_exists) { toast.info(`Already in pipeline: ${data.deal_title}`); return; }
      toast.success(`Moved to pipeline: ${data.deal_title}`, { action: { label: 'View in Pipeline', onClick: () => navigate(`/admin/deals/pipeline?deal=${data.deal_id}`) } });
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals-for-listing', listingId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    } catch (err: any) { console.error('Failed to move to pipeline:', err); toast.error(err?.message || 'Failed to move buyer to pipeline'); }
  };

  return {
    selectedIds, setSelectedIds,
    passDialogOpen, setPassDialogOpen,
    selectedBuyerForPass,
    emailDialogOpen, setEmailDialogOpen,
    highlightedBuyerIds, setHighlightedBuyerIds,
    updateScoreMutation, bulkApproveMutation,
    handleBulkScore, handleApplyAndRescore, handleReset,
    handleOpenPassDialog, handleConfirmPass,
    handleToggleInterested, handleApprove,
    handleBulkApprove, handleBulkPass,
    handleExportCSV, handleSelect,
    handleOutreachUpdate, handleScoreViewed,
    handleMoveToPipeline,
  };
}
