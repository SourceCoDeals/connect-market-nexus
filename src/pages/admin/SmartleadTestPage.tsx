import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  BarChart3,
  Users,
  Send,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSmartleadCampaigns } from '@/hooks/smartlead';
import type { SmartleadCampaign } from '@/types/smartlead';
import { SectionCard, JsonBlock, ts } from './enrichment-test/shared';
import type { LogEntry, AddLogFn } from './enrichment-test/shared';

// ─── Log Console ─────────────────────────────────────────────────────

function LogConsole({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return null;
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium">Execution Log</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-48 rounded-md border bg-muted p-3">
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">[{log.ts}]</span>
                {log.ok ? (
                  <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />
                )}
                <span className={log.ok ? 'text-foreground' : 'text-red-500'}>{log.msg}</span>
                {log.durationMs !== undefined && (
                  <span className="text-muted-foreground ml-auto shrink-0">{log.durationMs}ms</span>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Campaign List Test ──────────────────────────────────────────────

function CampaignListTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);

  const addLog: AddLogFn = useCallback(
    (msg, durationMs, ok = true) => setLogs((p) => [...p, { ts: ts(), msg, durationMs, ok }]),
    [],
  );

  const runTest = async () => {
    setRunning(true);
    setLogs([]);
    setResult(null);

    addLog('Querying smartlead_campaigns table...');
    const start = Date.now();

    const { data, error } = await supabase
      .from('smartlead_campaigns')
      .select('id, name, status, lead_count, smartlead_campaign_id, created_at, last_synced_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const dur = Date.now() - start;

    if (error) {
      addLog(`Query failed: ${error.message}`, dur, false);
    } else {
      addLog(`Fetched ${data?.length || 0} campaign(s) from database`, dur, true);
      setResult(data);
    }

    // Test stats table
    addLog('Querying smartlead_campaign_stats table...');
    const start2 = Date.now();
    const { data: stats, error: statsError } = await supabase
      .from('smartlead_campaign_stats')
      .select('*')
      .limit(5);

    const dur2 = Date.now() - start2;
    if (statsError) {
      addLog(`Stats query failed: ${statsError.message}`, dur2, false);
    } else {
      addLog(`Fetched ${stats?.length || 0} stat snapshot(s)`, dur2, true);
    }

    setRunning(false);
  };

  return (
    <SectionCard title="Campaign Database Tables" icon={<BarChart3 className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        Verify that Smartlead campaign tables are accessible and contain data.
      </p>
      <Button onClick={runTest} disabled={running} size="sm" className="gap-2">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run Test
      </Button>
      <LogConsole logs={logs} />
      {result != null && <JsonBlock data={result} />}
    </SectionCard>
  );
}

// ─── Webhook Events Test ─────────────────────────────────────────────

function WebhookEventsTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);

  const addLog: AddLogFn = useCallback(
    (msg, durationMs, ok = true) => setLogs((p) => [...p, { ts: ts(), msg, durationMs, ok }]),
    [],
  );

  const runTest = async () => {
    setRunning(true);
    setLogs([]);
    setResult(null);

    addLog('Querying smartlead_webhook_events table...');
    const start = Date.now();

    const { data, error } = await supabase
      .from('smartlead_webhook_events')
      .select('id, event_type, lead_email, processed, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    const dur = Date.now() - start;

    if (error) {
      addLog(`Query failed: ${error.message}`, dur, false);
    } else {
      addLog(`Fetched ${data?.length || 0} webhook event(s)`, dur, true);

      // Summarize by event type
      const summary: Record<string, number> = {};
      for (const evt of data || []) {
        summary[evt.event_type] = (summary[evt.event_type] || 0) + 1;
      }
      if (Object.keys(summary).length > 0) {
        addLog(
          `Event types: ${Object.entries(summary)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')}`,
        );
      }

      setResult(data);
    }

    setRunning(false);
  };

  return (
    <SectionCard title="Webhook Events" icon={<RefreshCw className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        Verify that Smartlead webhook events are being received and stored.
      </p>
      <Button onClick={runTest} disabled={running} size="sm" className="gap-2">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run Test
      </Button>
      <LogConsole logs={logs} />
      {result != null && <JsonBlock data={result} />}
    </SectionCard>
  );
}

// ─── Email History Lookup Test ───────────────────────────────────────

function EmailHistoryTest() {
  const [email, setEmail] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);

  const addLog: AddLogFn = useCallback(
    (msg, durationMs, ok = true) => setLogs((p) => [...p, { ts: ts(), msg, durationMs, ok }]),
    [],
  );

  const runTest = async () => {
    if (!email.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);

    addLog(`Looking up Smartlead history for: ${email}`);

    // Check campaign leads
    const start1 = Date.now();
    const { data: leads, error: leadsError } = await supabase
      .from('smartlead_campaign_leads')
      .select('*, campaign:smartlead_campaigns(name, status)')
      .eq('email', email.trim());

    const dur1 = Date.now() - start1;
    if (leadsError) {
      addLog(`Campaign leads query failed: ${leadsError.message}`, dur1, false);
    } else {
      addLog(`Found in ${leads?.length || 0} campaign(s)`, dur1, true);
    }

    // Check webhook events
    const start2 = Date.now();
    const { data: events, error: eventsError } = await supabase
      .from('smartlead_webhook_events')
      .select('event_type, lead_email, created_at')
      .eq('lead_email', email.trim())
      .order('created_at', { ascending: false })
      .limit(20);

    const dur2 = Date.now() - start2;
    if (eventsError) {
      addLog(`Webhook events query failed: ${eventsError.message}`, dur2, false);
    } else {
      addLog(`Found ${events?.length || 0} email event(s)`, dur2, true);
    }

    setResult({ campaigns: leads, events });
    setRunning(false);
  };

  return (
    <SectionCard title="Email History Lookup" icon={<Mail className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        Look up Smartlead email history for a specific email address.
      </p>
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="lookup-email" className="text-xs">
            Email address
          </Label>
          <Input
            id="lookup-email"
            type="email"
            placeholder="contact@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8"
          />
        </div>
        <Button onClick={runTest} disabled={running || !email.trim()} size="sm" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Look Up
        </Button>
      </div>
      <LogConsole logs={logs} />
      {result != null && <JsonBlock data={result} />}
    </SectionCard>
  );
}

// ─── Push to Smartlead Test ──────────────────────────────────────────

function PushToSmartleadTest() {
  const { data: campaigns } = useSmartleadCampaigns();
  const [campaignId, setCampaignId] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);

  const addLog: AddLogFn = useCallback(
    (msg, durationMs, ok = true) => setLogs((p) => [...p, { ts: ts(), msg, durationMs, ok }]),
    [],
  );

  const campaignsList: SmartleadCampaign[] = campaigns?.campaigns || [];
  const activeCampaigns = campaignsList.filter(
    (c) => c.status === 'ACTIVE' || c.status === 'DRAFTED',
  );

  const runTest = async () => {
    if (!campaignId || !testEmail.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);

    addLog(`Testing push to campaign: ${campaignId}`);
    addLog(`Test email: ${testEmail}`);

    // Look up the campaign
    const start = Date.now();
    const { data: campaign, error: campError } = await supabase
      .from('smartlead_campaigns')
      .select('id, name, smartlead_campaign_id, status, lead_count')
      .eq('id', campaignId)
      .single();

    const dur = Date.now() - start;
    if (campError || !campaign) {
      addLog(`Campaign not found: ${campError?.message || 'no data'}`, dur, false);
      setRunning(false);
      return;
    }
    addLog(
      `Campaign: "${campaign.name}" (ID: ${campaign.smartlead_campaign_id}, Status: ${campaign.status})`,
      dur,
    );

    // Check if the email already exists as a lead
    const start2 = Date.now();
    const { data: existing } = await supabase
      .from('smartlead_campaign_leads')
      .select('id, email, lead_status')
      .eq('campaign_id', campaignId)
      .eq('email', testEmail.trim())
      .maybeSingle();

    const dur2 = Date.now() - start2;
    if (existing) {
      addLog(`Email already in campaign as lead (status: ${existing.lead_status})`, dur2, true);
    } else {
      addLog('Email not yet in this campaign', dur2, true);
    }

    // Try calling the smartlead-leads edge function
    addLog('Calling smartlead-leads edge function (dry run check)...');
    const start3 = Date.now();
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('smartlead-leads', {
        body: {
          action: 'get_campaign_leads',
          campaign_id: campaign.smartlead_campaign_id,
          limit: 5,
        },
      });
      const dur3 = Date.now() - start3;
      if (fnError) {
        addLog(`Edge function error: ${fnError.message}`, dur3, false);
      } else {
        addLog(
          `Edge function responded OK (${Array.isArray(fnData?.leads) ? fnData.leads.length : 0} leads returned)`,
          dur3,
          true,
        );
        setResult({ campaign, existing_lead: existing, edge_function_response: fnData });
      }
    } catch (err) {
      const dur3 = Date.now() - start3;
      addLog(
        `Edge function call failed: ${err instanceof Error ? err.message : String(err)}`,
        dur3,
        false,
      );
    }

    setRunning(false);
  };

  return (
    <SectionCard title="Push to Smartlead (Dry Run)" icon={<Send className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        Test the push-to-Smartlead flow without actually adding leads. Verifies campaign lookup,
        duplicate detection, and edge function connectivity.
      </p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1 min-w-[200px]">
          <Label className="text-xs">Campaign</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select campaign..." />
            </SelectTrigger>
            <SelectContent>
              {activeCampaigns.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </SelectItem>
              ))}
              {activeCampaigns.length === 0 && (
                <SelectItem value="_none" disabled>
                  No active campaigns
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1 min-w-[200px]">
          <Label className="text-xs">Test email</Label>
          <Input
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="h-8"
          />
        </div>
        <Button
          onClick={runTest}
          disabled={running || !campaignId || !testEmail.trim()}
          size="sm"
          className="gap-2"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Test
        </Button>
      </div>
      <LogConsole logs={logs} />
      {result != null && <JsonBlock data={result} />}
    </SectionCard>
  );
}

// ─── Campaign Leads Test ─────────────────────────────────────────────

function CampaignLeadsTest() {
  const { data: campaigns } = useSmartleadCampaigns();
  const [campaignId, setCampaignId] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);

  const addLog: AddLogFn = useCallback(
    (msg, durationMs, ok = true) => setLogs((p) => [...p, { ts: ts(), msg, durationMs, ok }]),
    [],
  );

  const runTest = async () => {
    if (!campaignId) return;
    setRunning(true);
    setLogs([]);
    setResult(null);

    addLog('Querying campaign leads from database...');
    const start = Date.now();

    const { data: leads, error } = await supabase
      .from('smartlead_campaign_leads')
      .select('id, email, first_name, last_name, lead_status, lead_category, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(25);

    const dur = Date.now() - start;
    if (error) {
      addLog(`Query failed: ${error.message}`, dur, false);
    } else {
      addLog(`Found ${leads?.length || 0} lead(s) in this campaign`, dur, true);

      // Summary by status
      const statusSummary: Record<string, number> = {};
      for (const lead of leads || []) {
        const st = lead.lead_status || 'unknown';
        statusSummary[st] = (statusSummary[st] || 0) + 1;
      }
      if (Object.keys(statusSummary).length > 0) {
        addLog(
          `Status breakdown: ${Object.entries(statusSummary)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')}`,
        );
      }

      setResult(leads);
    }

    setRunning(false);
  };

  return (
    <SectionCard title="Campaign Leads" icon={<Users className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        View leads in a specific Smartlead campaign from the local database.
      </p>
      <div className="flex gap-2 items-end">
        <div className="space-y-1 min-w-[200px]">
          <Label className="text-xs">Campaign</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select campaign..." />
            </SelectTrigger>
            <SelectContent>
              {(campaigns?.campaigns || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.lead_count || 0} leads)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={runTest} disabled={running || !campaignId} size="sm" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Load Leads
        </Button>
      </div>
      <LogConsole logs={logs} />
      {result != null && <JsonBlock data={result} />}
    </SectionCard>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function SmartleadTestPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Smartlead Integration Tests
        </h2>
        <p className="text-sm text-muted-foreground">
          Test Smartlead API integration, campaign management, lead push, and webhook processing.
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        <CampaignListTest />
        <WebhookEventsTest />
        <EmailHistoryTest />
        <CampaignLeadsTest />
        <PushToSmartleadTest />
      </div>
    </div>
  );
}
