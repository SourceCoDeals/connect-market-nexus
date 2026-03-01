import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useCreateDealComment } from '@/hooks/admin/use-deal-comments';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { Sparkles, Save, Copy, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';

interface BuyerNarrativePanelProps {
  dealId: string;
  listingId: string;
  dealTitle: string;
  buyers: RecommendedBuyer[];
  totalScored: number;
}

export function BuyerNarrativePanel({
  dealId,
  listingId,
  dealTitle,
  buyers,
  totalScored,
}: BuyerNarrativePanelProps) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();
  const createComment = useCreateDealComment();

  const generateNarrative = useCallback(async () => {
    setIsGenerating(true);
    setNarrative(null);

    try {
      // Get auth session for the edge function call
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          query: `Generate a buyer strategy narrative for this deal. Use the generate_buyer_narrative tool with deal_id "${listingId}".`,
          page_context: {
            page: 'deal_detail',
            entity_id: listingId,
            entity_type: 'deal',
            tab: 'recommended_buyers',
          },
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const event = JSON.parse(dataStr);
            if (event.type === 'text') {
              fullText += event.content || '';
              setNarrative(fullText);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (fullText) {
        setNarrative(fullText);
      } else {
        // Fallback: generate narrative client-side from the buyer data
        setNarrative(generateLocalNarrative(dealTitle, buyers, totalScored));
      }
    } catch (err) {
      console.error('[BuyerNarrativePanel] Generation failed:', err);
      // Fallback to client-side generation
      setNarrative(generateLocalNarrative(dealTitle, buyers, totalScored));
      toast({
        title: 'Note',
        description: 'Generated narrative from cached buyer data.',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [listingId, dealTitle, buyers, totalScored, toast]);

  const handleSaveToNotes = useCallback(() => {
    if (!narrative) return;

    const noteText = `AI Buyer Strategy \u2014 ${new Date().toLocaleDateString()}\n\n${narrative}`;
    createComment.mutate(
      { dealId, commentText: noteText, mentionedAdmins: [] },
      {
        onSuccess: () => {
          toast({
            title: 'Buyer strategy saved to Notes',
            description: 'The narrative has been saved as a deal note.',
          });
        },
      },
    );
  }, [narrative, dealId, createComment, toast]);

  const handleCopyToClipboard = useCallback(() => {
    if (!narrative) return;
    navigator.clipboard.writeText(narrative).then(() => {
      toast({ title: 'Copied to clipboard' });
    });
  }, [narrative, toast]);

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">AI Buyer Strategy</span>
        </div>
        <div className="flex items-center gap-2">
          {narrative && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCopyToClipboard}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSaveToNotes}
                disabled={createComment.isPending}
              >
                <Save className="h-3 w-3 mr-1" />
                Save to Notes
              </Button>
            </>
          )}
          {!narrative && !isGenerating && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={generateNarrative}
              disabled={buyers.length === 0}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Generate Buyer Strategy
            </Button>
          )}
          {narrative && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isGenerating && (
        <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating buyer strategy narrative...
        </div>
      )}

      {narrative && expanded && (
        <ScrollArea className="max-h-[400px]">
          <div className="px-4 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {narrative}
          </div>
        </ScrollArea>
      )}

      {!narrative && !isGenerating && (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          Click "Generate Buyer Strategy" to create a written narrative for this deal's recommended
          buyers.
        </div>
      )}
    </div>
  );
}

// Client-side fallback narrative generation
function generateLocalNarrative(
  dealTitle: string,
  buyers: RecommendedBuyer[],
  totalScored: number,
): string {
  if (buyers.length === 0) return 'No scored buyers available for this deal.';

  const moveNow = buyers.filter((b) => b.tier === 'move_now');
  const strong = buyers.filter((b) => b.tier === 'strong_candidate');
  const spec = buyers.filter((b) => b.tier === 'speculative');
  const withCalls = buyers.filter((b) => b.transcript_insights.call_count > 0);
  const withCeo = buyers.filter((b) => b.transcript_insights.ceo_detected);
  const withOutreach = buyers.filter((b) => b.outreach_info.contacted);
  const withNda = buyers.filter((b) => b.outreach_info.nda_signed);
  const top10 = buyers.slice(0, 10);

  let text = `# Buyer Strategy \u2014 ${dealTitle}\n`;
  text += `*Generated ${new Date().toISOString().split('T')[0]}*\n\n`;
  text += `## Overview\n`;
  text += `Based on alignment scoring across ${totalScored} evaluated buyers, ${moveNow.length} are classified as "Move Now" candidates, ${strong.length} as "Strong Candidates", and ${spec.length} as "Speculative".`;

  // Enrichment summary
  const enrichmentParts: string[] = [];
  if (withCalls.length > 0) enrichmentParts.push(`${withCalls.length} have recorded calls`);
  if (withCeo.length > 0) enrichmentParts.push(`${withCeo.length} with CEO/owner engagement`);
  if (withOutreach.length > 0) enrichmentParts.push(`${withOutreach.length} have been contacted`);
  if (withNda.length > 0) enrichmentParts.push(`${withNda.length} with NDAs signed`);
  if (enrichmentParts.length > 0) {
    text += ` Engagement data: ${enrichmentParts.join(', ')}.`;
  }
  text += '\n\n';
  text += `## Ranked Buyer Shortlist\n\n`;

  for (const [idx, b] of top10.entries()) {
    const name = b.pe_firm_name ? `${b.company_name} (${b.pe_firm_name})` : b.company_name;
    const hq = [b.hq_city, b.hq_state].filter(Boolean).join(', ') || 'HQ undisclosed';
    const typeLabel = b.buyer_type?.replace(/_/g, ' ') || 'buyer';
    const feeStatus = b.has_fee_agreement ? 'Fee agreement signed' : 'No fee agreement';
    const signals = b.fit_signals.length > 0 ? b.fit_signals.join('; ') : 'General alignment';

    text += `**#${idx + 1}. ${name}** \u2014 Score: ${b.composite_fit_score}/100 [${b.tier_label}]\n`;
    text += `${typeLabel} headquartered in ${hq}. ${feeStatus}. Key fit signals: ${signals}.`;
    if (b.fit_reasoning) text += ` ${b.fit_reasoning}`;

    // Transcript insights
    if (b.transcript_insights.call_count > 0) {
      text += ` ${b.transcript_insights.call_count} call(s) on record`;
      if (b.transcript_insights.ceo_detected) text += ' (CEO participated)';
      text += '.';
    }

    // Outreach progress
    const outreachSteps: string[] = [];
    if (b.outreach_info.contacted) outreachSteps.push('contacted');
    if (b.outreach_info.nda_signed) outreachSteps.push('NDA signed');
    if (b.outreach_info.cim_sent) outreachSteps.push('memo sent');
    if (b.outreach_info.meeting_scheduled) outreachSteps.push('meeting scheduled');
    if (outreachSteps.length > 0) {
      text += ` Outreach: ${outreachSteps.join(' \u2192 ')}.`;
    }
    if (b.outreach_info.outcome) {
      text += ` Outcome: ${b.outreach_info.outcome}.`;
    }
    text += '\n\n';
  }

  text += `## Tier Summary\n`;
  if (moveNow.length > 0)
    text += `**Move Now**: ${moveNow.map((b) => b.company_name).join(', ')}\n`;
  if (strong.length > 0)
    text += `**Strong Candidates**: ${strong.map((b) => b.company_name).join(', ')}\n`;
  if (spec.length > 0) text += `**Speculative**: ${spec.map((b) => b.company_name).join(', ')}\n`;

  text += '\n---\n*AI-generated buyer strategy. Review before treating as authoritative.*';

  return text;
}
