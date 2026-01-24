import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Users, 
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  FileText,
  Target,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ScoreTierBadge } from '@/components/remarketing';
import type { OutreachStatus } from '@/components/remarketing/OutreachStatusDialog';

// Pipeline stages in order
const PIPELINE_STAGES: Array<{
  id: OutreachStatus | 'scored' | 'approved';
  label: string;
  icon: typeof Target;
  color: string;
  bgColor: string;
}> = [
  { id: 'scored', label: 'Scored', icon: Target, color: 'text-slate-600', bgColor: 'bg-slate-100' },
  { id: 'approved', label: 'Approved', icon: CheckCircle2, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { id: 'contacted', label: 'Contacted', icon: Mail, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  { id: 'responded', label: 'Responded', icon: Mail, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  { id: 'meeting_scheduled', label: 'Meeting', icon: Calendar, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { id: 'loi_sent', label: 'LOI Sent', icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { id: 'closed_won', label: 'Won', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  { id: 'closed_lost', label: 'Lost', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
];

interface PipelineCard {
  id: string;
  scoreId: string;
  buyerId: string;
  buyerName: string;
  tier: string | null;
  compositeScore: number;
  listingId: string;
  listingTitle: string;
  universeName: string | null;
  stage: string;
  stageEnteredAt: string | null;
  outreachNotes: string | null;
}

const ReMarketingPipeline = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedUniverse, setSelectedUniverse] = useState<string>('all');

  // Fetch universes
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id, name')
        .eq('archived', false)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all scores with outreach data
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['remarketing', 'pipeline', selectedUniverse],
    queryFn: async () => {
      // First get scores
      let scoresQuery = supabase
        .from('remarketing_scores')
        .select(`
          id,
          composite_score,
          tier,
          status,
          buyer_id,
          listing_id,
          universe_id,
          buyer:remarketing_buyers(id, company_name),
          listing:listings(id, title),
          universe:remarketing_buyer_universes(id, name)
        `)
        .neq('status', 'hidden');

      if (selectedUniverse !== 'all') {
        scoresQuery = scoresQuery.eq('universe_id', selectedUniverse);
      }

      const { data: scores, error: scoresError } = await scoresQuery;
      if (scoresError) throw scoresError;

      // Get outreach records
      const { data: outreach, error: outreachError } = await supabase
        .from('remarketing_outreach')
        .select('*');
      if (outreachError) throw outreachError;

      const outreachMap = new Map(outreach?.map(o => [o.score_id, o]) || []);

      // Build pipeline cards
      const cards: PipelineCard[] = (scores || []).map(score => {
        const outreachRecord = outreachMap.get(score.id);
        let stage = 'scored';
        
        if (score.status === 'approved') {
          stage = outreachRecord?.status || 'approved';
        } else if (score.status === 'passed') {
          stage = 'closed_lost';
        }

        return {
          id: score.id,
          scoreId: score.id,
          buyerId: score.buyer_id,
          buyerName: (score.buyer as any)?.company_name || 'Unknown',
          tier: score.tier,
          compositeScore: score.composite_score,
          listingId: score.listing_id,
          listingTitle: (score.listing as any)?.title || 'Unknown Deal',
          universeName: (score.universe as any)?.name || null,
          stage,
          stageEnteredAt: outreachRecord?.updated_at || null,
          outreachNotes: outreachRecord?.notes || null,
        };
      });

      return cards;
    },
  });

  // Group cards by stage
  const cardsByStage = useMemo(() => {
    const grouped: Record<string, PipelineCard[]> = {};
    for (const stage of PIPELINE_STAGES) {
      grouped[stage.id] = [];
    }
    
    for (const card of pipelineData || []) {
      if (grouped[card.stage]) {
        grouped[card.stage].push(card);
      } else {
        // Default to scored if unknown stage
        grouped['scored'].push(card);
      }
    }
    
    return grouped;
  }, [pipelineData]);

  // Update outreach status mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ scoreId, newStage }: { scoreId: string; newStage: string }) => {
      const card = pipelineData?.find(c => c.scoreId === scoreId);
      if (!card) throw new Error('Card not found');

      if (newStage === 'scored' || newStage === 'approved') {
        // These are score statuses, not outreach
        if (newStage === 'approved') {
          await supabase
            .from('remarketing_scores')
            .update({ status: 'approved' })
            .eq('id', scoreId);
        }
      } else {
        // Update outreach status
        await supabase.from('remarketing_outreach').upsert({
          score_id: scoreId,
          listing_id: card.listingId,
          buyer_id: card.buyerId,
          status: newStage,
          contacted_at: newStage !== 'pending' ? new Date().toISOString() : null,
        }, { onConflict: 'score_id' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'pipeline'] });
      toast.success('Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!pipelineData) return null;
    
    const total = pipelineData.length;
    const approved = cardsByStage['approved']?.length || 0;
    const contacted = (cardsByStage['contacted']?.length || 0) + 
                      (cardsByStage['responded']?.length || 0) +
                      (cardsByStage['meeting_scheduled']?.length || 0);
    const won = cardsByStage['closed_won']?.length || 0;
    const lost = cardsByStage['closed_lost']?.length || 0;
    
    return {
      total,
      approved,
      contacted,
      won,
      lost,
      conversionRate: approved > 0 ? Math.round((won / approved) * 100) : 0,
      responseRate: contacted > 0 ? Math.round((contacted / approved) * 100) : 0,
    };
  }, [pipelineData, cardsByStage]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Buyer Pipeline</h1>
          <p className="text-muted-foreground">
            Track buyers through the outreach funnel
          </p>
        </div>
        <Select value={selectedUniverse} onValueChange={setSelectedUniverse}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Universes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universes</SelectItem>
            {universes?.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Scored</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Approved</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-cyan-600" />
                <span className="text-sm text-muted-foreground">In Outreach</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.contacted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Won</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.won}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Win Rate</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.conversionRate}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kanban Board */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pipeline Board</CardTitle>
          <CardDescription>Drag cards to update status (coming soon) or click to view details</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="flex gap-4 p-4 min-w-max">
              {PIPELINE_STAGES.map((stage) => {
                const cards = cardsByStage[stage.id] || [];
                const Icon = stage.icon;
                
                return (
                  <div
                    key={stage.id}
                    className="w-72 flex-shrink-0"
                  >
                    {/* Column Header */}
                    <div className={cn(
                      'flex items-center gap-2 p-3 rounded-t-lg',
                      stage.bgColor
                    )}>
                      <Icon className={cn('h-4 w-4', stage.color)} />
                      <span className={cn('font-medium text-sm', stage.color)}>
                        {stage.label}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {cards.length}
                      </Badge>
                    </div>
                    
                    {/* Column Content */}
                    <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2">
                      {cards.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          No buyers in this stage
                        </div>
                      ) : (
                        cards.slice(0, 20).map((card) => (
                          <Link
                            key={card.id}
                            to={`/admin/remarketing/matching/${card.listingId}`}
                            className="block"
                          >
                            <div className="bg-background border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="font-medium text-sm truncate flex-1">
                                  {card.buyerName}
                                </span>
                                <ScoreTierBadge tier={card.tier as any} size="sm" />
                              </div>
                              
                              <p className="text-xs text-muted-foreground truncate mb-2">
                                {card.listingTitle}
                              </p>
                              
                              {card.universeName && (
                                <Badge variant="outline" className="text-[10px] mb-2">
                                  {card.universeName}
                                </Badge>
                              )}
                              
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>Score: {card.compositeScore}</span>
                                {card.stageEnteredAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(card.stageEnteredAt), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))
                      )}
                      {cards.length > 20 && (
                        <div className="text-center py-2 text-xs text-muted-foreground">
                          +{cards.length - 20} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {PIPELINE_STAGES.slice(0, 7).map((stage, index) => {
              const count = cardsByStage[stage.id]?.length || 0;
              const Icon = stage.icon;
              const prevCount = index > 0 ? cardsByStage[PIPELINE_STAGES[index - 1].id]?.length || 0 : count;
              const convRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
              
              return (
                <div key={stage.id} className="flex items-center">
                  <div className="text-center">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2',
                      stage.bgColor
                    )}>
                      <Icon className={cn('h-5 w-5', stage.color)} />
                    </div>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{stage.label}</p>
                    {index > 0 && convRate > 0 && (
                      <p className="text-[10px] text-green-600 mt-1">{convRate}%</p>
                    )}
                  </div>
                  {index < 6 && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReMarketingPipeline;
