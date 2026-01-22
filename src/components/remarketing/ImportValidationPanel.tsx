import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Database, Users, Building, FileText, Star, Brain } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TableCount {
  table: string;
  label: string;
  icon: React.ReactNode;
  expected: number;
  current: number;
}

interface ImportValidationPanelProps {
  expectedCounts?: {
    universes?: number;
    buyers?: number;
    contacts?: number;
    transcripts?: number;
    scores?: number;
    learningHistory?: number;
  };
}

export function ImportValidationPanel({ expectedCounts }: ImportValidationPanelProps) {
  const { data: counts, isLoading } = useQuery({
    queryKey: ['import-validation-counts'],
    queryFn: async () => {
      const [universes, buyers, contacts, transcripts, scores, learningHistory, listings] = await Promise.all([
        supabase.from('remarketing_buyer_universes').select('id', { count: 'exact', head: true }),
        supabase.from('remarketing_buyers').select('id', { count: 'exact', head: true }),
        supabase.from('remarketing_buyer_contacts').select('id', { count: 'exact', head: true }),
        supabase.from('buyer_transcripts').select('id', { count: 'exact', head: true }),
        supabase.from('remarketing_scores').select('id', { count: 'exact', head: true }),
        supabase.from('buyer_learning_history').select('id', { count: 'exact', head: true }),
        supabase.from('listings').select('id', { count: 'exact', head: true }),
      ]);

      return {
        universes: universes.count ?? 0,
        buyers: buyers.count ?? 0,
        contacts: contacts.count ?? 0,
        transcripts: transcripts.count ?? 0,
        scores: scores.count ?? 0,
        learningHistory: learningHistory.count ?? 0,
        listings: listings.count ?? 0,
      };
    },
    refetchInterval: 5000, // Refresh every 5 seconds during import
  });

  const defaults = {
    universes: 9,
    buyers: 114,
    contacts: 484,
    transcripts: 8,
    scores: 159,
    learningHistory: 4,
  };

  const expected = { ...defaults, ...expectedCounts };

  const tables: TableCount[] = [
    {
      table: 'remarketing_buyer_universes',
      label: 'Universes',
      icon: <Database className="h-4 w-4" />,
      expected: expected.universes,
      current: counts?.universes ?? 0,
    },
    {
      table: 'remarketing_buyers',
      label: 'Buyers',
      icon: <Building className="h-4 w-4" />,
      expected: expected.buyers,
      current: counts?.buyers ?? 0,
    },
    {
      table: 'remarketing_buyer_contacts',
      label: 'Contacts',
      icon: <Users className="h-4 w-4" />,
      expected: expected.contacts,
      current: counts?.contacts ?? 0,
    },
    {
      table: 'buyer_transcripts',
      label: 'Transcripts',
      icon: <FileText className="h-4 w-4" />,
      expected: expected.transcripts,
      current: counts?.transcripts ?? 0,
    },
    {
      table: 'remarketing_scores',
      label: 'Scores',
      icon: <Star className="h-4 w-4" />,
      expected: expected.scores,
      current: counts?.scores ?? 0,
    },
    {
      table: 'buyer_learning_history',
      label: 'Learning History',
      icon: <Brain className="h-4 w-4" />,
      expected: expected.learningHistory,
      current: counts?.learningHistory ?? 0,
    },
  ];

  const getStatus = (current: number, expected: number) => {
    if (current === 0) return 'empty';
    if (current >= expected) return 'complete';
    if (current > 0) return 'partial';
    return 'empty';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Complete</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Partial</Badge>;
      default:
        return <Badge variant="destructive">Empty</Badge>;
    }
  };

  const totalExpected = tables.reduce((sum, t) => sum + t.expected, 0);
  const totalCurrent = tables.reduce((sum, t) => sum + t.current, 0);
  const overallProgress = totalExpected > 0 ? Math.round((totalCurrent / totalExpected) * 100) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Import Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-8 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Import Validation
          </CardTitle>
          <Badge variant={overallProgress === 100 ? 'default' : 'secondary'}>
            {overallProgress}% Complete
          </Badge>
        </div>
        <Progress value={overallProgress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {tables.map((table) => {
          const status = getStatus(table.current, table.expected);
          const progress = table.expected > 0 ? Math.round((table.current / table.expected) * 100) : 0;
          
          return (
            <div
              key={table.table}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(status)}
                <div className="flex items-center gap-2">
                  {table.icon}
                  <span className="text-sm font-medium">{table.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {table.current} / {table.expected}
                </span>
                {getStatusBadge(status)}
              </div>
            </div>
          );
        })}

        {counts && (
          <div className="pt-3 mt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Marketplace Listings</span>
              <span className="font-medium">{counts.listings} deals available</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
