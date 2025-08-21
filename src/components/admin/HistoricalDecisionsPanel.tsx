import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, User, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface HistoricalRequest {
  id: string;
  status: string;
  decision_at: string;
  created_at: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  listing_title: string;
  listing_company: string;
}

export function HistoricalDecisionsPanel() {
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch historical requests with missing approver data
  const { data: historicalRequests, isLoading } = useQuery({
    queryKey: ['historical-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          id,
          status,
          decision_at,
          created_at,
          user_id,
          listing_id
        `)
        .in('status', ['approved', 'rejected', 'on_hold'])
        .or('approved_by.is.null,rejected_by.is.null,on_hold_by.is.null')
        .order('decision_at', { ascending: false });

      if (error) throw error;

      // Fetch user and listing data separately
      const userIds = [...new Set(data.map(req => req.user_id))];
      const listingIds = [...new Set(data.map(req => req.listing_id))];

      const [usersResult, listingsResult] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, email').in('id', userIds),
        supabase.from('listings').select('id, title, internal_company_name').in('id', listingIds)
      ]);

      const usersMap = new Map(usersResult.data?.map(u => [u.id, u]) || []);
      const listingsMap = new Map(listingsResult.data?.map(l => [l.id, l]) || []);

      return data.map(req => {
        const user = usersMap.get(req.user_id);
        const listing = listingsMap.get(req.listing_id);
        
        return {
          id: req.id,
          status: req.status,
          decision_at: req.decision_at,
          created_at: req.created_at,
          user_first_name: user?.first_name || '',
          user_last_name: user?.last_name || '',
          user_email: user?.email || '',
          listing_title: listing?.title || '',
          listing_company: listing?.internal_company_name || ''
        };
      }) as HistoricalRequest[];
    }
  });

  // Fetch admin users for assignment
  const { data: adminUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_admin', true)
        .eq('approval_status', 'approved');

      if (error) throw error;
      return data;
    }
  });

  // Mutation to assign historical decisions
  const assignDecisionMutation = useMutation({
    mutationFn: async ({ requestIds, adminId }: { requestIds: string[]; adminId: string }) => {
      const results = [];
      
      for (const requestId of requestIds) {
        const request = historicalRequests?.find(r => r.id === requestId);
        if (!request) continue;

        const { data, error } = await supabase.rpc('assign_connection_request_decider', {
          p_request_id: requestId,
          p_decision: request.status,
          p_admin_id: adminId,
          p_decision_at: request.decision_at
        });

        if (error) throw error;
        results.push(data);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      setSelectedRequests([]);
      setSelectedAdmin('');
      toast({
        title: 'Success',
        description: `Assigned decisions for ${selectedRequests.length} request(s)`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign decisions',
        variant: 'destructive'
      });
    }
  });

  const handleSelectRequest = (requestId: string) => {
    setSelectedRequests(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRequests.length === historicalRequests?.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(historicalRequests?.map(r => r.id) || []);
    }
  };

  const handleAssignDecisions = () => {
    if (!selectedAdmin || selectedRequests.length === 0) return;
    assignDecisionMutation.mutate({
      requestIds: selectedRequests,
      adminId: selectedAdmin
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historical Decisions</CardTitle>
          <CardDescription>Loading historical requests...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historical Decisions
        </CardTitle>
        <CardDescription>
          Assign decision makers to historical connection requests that are missing approval attribution.
          Found {historicalRequests?.length || 0} requests with missing decision attribution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {historicalRequests?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>All historical decisions have been attributed!</p>
          </div>
        ) : (
          <>
            {/* Assignment Controls */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select admin to assign as decision maker" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminUsers?.map(admin => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.first_name} {admin.last_name} ({admin.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSelectAll}
                variant="outline"
                size="sm"
              >
                {selectedRequests.length === historicalRequests?.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                onClick={handleAssignDecisions}
                disabled={!selectedAdmin || selectedRequests.length === 0 || assignDecisionMutation.isPending}
                size="sm"
              >
                Assign to {selectedRequests.length} Request{selectedRequests.length !== 1 ? 's' : ''}
              </Button>
            </div>

            {/* Historical Requests List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {historicalRequests?.map(request => (
                <div
                  key={request.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedRequests.includes(request.id)
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleSelectRequest(request.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedRequests.includes(request.id)}
                        onChange={() => handleSelectRequest(request.id)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium">
                          {request.user_first_name} {request.user_last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.user_email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        request.status === 'approved' ? 'default' :
                        request.status === 'rejected' ? 'destructive' : 'secondary'
                      }>
                        {request.status}
                      </Badge>
                      <div className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(request.decision_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <strong>{request.listing_title}</strong>
                    {request.listing_company && ` (${request.listing_company})`}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}