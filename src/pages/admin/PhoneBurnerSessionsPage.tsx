import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Phone,
  PhoneCall,
  Users,
  BarChart3,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  Target,
  Calendar,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface PhoneBurnerSession {
  id: string;
  session_name: string;
  session_type: string | null;
  session_status: string | null;
  session_description: string | null;
  total_contacts_added: number | null;
  total_dials: number | null;
  total_connections: number | null;
  total_talk_time_seconds: number | null;
  total_qualified_leads: number | null;
  total_meetings_scheduled: number | null;
  total_disqualified: number | null;
  total_voicemails_left: number | null;
  total_no_answers: number | null;
  connection_rate_percentage: number | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  created_by_user_id: string | null;
}

function usePhoneBurnerSessions() {
  return useQuery({
    queryKey: ['phoneburner-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoneburner_sessions')
        .select(
          'id, session_name, session_type, session_status, session_description, total_contacts_added, total_dials, total_connections, total_talk_time_seconds, total_qualified_leads, total_meetings_scheduled, total_disqualified, total_voicemails_left, total_no_answers, connection_rate_percentage, started_at, completed_at, last_activity_at, created_at, created_by_user_id',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PhoneBurnerSession[];
    },
  });
}

function StatusBadge({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  };
  const s = (status || 'active').toLowerCase();
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[s] || 'bg-muted text-muted-foreground'}`}
    >
      {s}
    </span>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '--';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function PhoneBurnerSessionsPage() {
  const { data: sessions = [], isLoading, refetch } = usePhoneBurnerSessions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = sessions.filter((s) => {
    const matchesSearch = !search || s.session_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || (s.session_status || 'active').toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregate stats
  const activeSessions = sessions.filter(
    (s) => (s.session_status || 'active').toLowerCase() === 'active',
  );
  const totalDials = sessions.reduce((sum, s) => sum + (s.total_dials || 0), 0);
  const totalConnections = sessions.reduce((sum, s) => sum + (s.total_connections || 0), 0);
  const totalTalkTime = sessions.reduce((sum, s) => sum + (s.total_talk_time_seconds || 0), 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PhoneBurner Sessions</h1>
          <p className="text-muted-foreground">
            Track dial sessions, call activity, and rep performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://www.phoneburner.com" target="_blank" rel="noopener noreferrer">
              Open PhoneBurner
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Phone className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Sessions</p>
            <p className="text-xl font-bold">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <PhoneCall className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-xl font-bold text-emerald-600">{activeSessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xs text-muted-foreground">Total Dials</p>
            <p className="text-xl font-bold text-blue-600">{totalDials}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-violet-600" />
            <p className="text-xs text-muted-foreground">Total Talk Time</p>
            <p className="text-xl font-bold text-violet-600">{formatDuration(totalTalkTime)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {sessions.length === 0 ? (
                <>
                  <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No dial sessions yet</p>
                  <p className="text-sm mt-1">
                    Push contacts from Buyer Contacts or Contact Lists to create a session
                  </p>
                </>
              ) : (
                'No sessions match your filters.'
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead className="text-center">Dials</TableHead>
                  <TableHead className="text-center">Connected</TableHead>
                  <TableHead>Talk Time</TableHead>
                  <TableHead>Outcomes</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((session) => {
                  const connectionRate =
                    session.total_dials && session.total_connections
                      ? Math.round((session.total_connections / session.total_dials) * 100)
                      : session.connection_rate_percentage;

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{session.session_name}</span>
                          </div>
                          {session.session_type && (
                            <span className="text-xs text-muted-foreground ml-6 capitalize">
                              {session.session_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={session.session_status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs gap-1 font-normal">
                          <Users className="h-3 w-3" />
                          {session.total_contacts_added ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {session.total_dials ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-sm">{session.total_connections ?? 0}</span>
                          {connectionRate != null && connectionRate > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {connectionRate}% rate
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDuration(session.total_talk_time_seconds)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          {(session.total_qualified_leads ?? 0) > 0 && (
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <Target className="h-3 w-3" />
                              {session.total_qualified_leads}
                            </span>
                          )}
                          {(session.total_meetings_scheduled ?? 0) > 0 && (
                            <span className="text-blue-600 flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {session.total_meetings_scheduled}
                            </span>
                          )}
                          {(session.total_voicemails_left ?? 0) > 0 && (
                            <span className="text-muted-foreground">
                              {session.total_voicemails_left} VM
                            </span>
                          )}
                          {!(session.total_qualified_leads ?? 0) &&
                            !(session.total_meetings_scheduled ?? 0) &&
                            !(session.total_voicemails_left ?? 0) && (
                              <span className="text-muted-foreground">--</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {session.last_activity_at
                            ? formatDistanceToNow(new Date(session.last_activity_at), {
                                addSuffix: true,
                              })
                            : session.started_at
                              ? format(new Date(session.started_at), 'MMM d, yyyy')
                              : format(new Date(session.created_at), 'MMM d, yyyy')}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Connection Rate Summary */}
      {totalConnections > 0 && totalDials > 0 && (
        <div className="flex justify-between items-center text-sm text-muted-foreground px-1">
          <span>
            Overall connection rate: {Math.round((totalConnections / totalDials) * 100)}% (
            {totalConnections}/{totalDials} dials)
          </span>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://www.phoneburner.com" target="_blank" rel="noopener noreferrer">
              Open PhoneBurner Dashboard
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
