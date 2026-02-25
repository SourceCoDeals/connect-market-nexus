import { useQuery } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Zap, PhoneCall, Webhook, ExternalLink, CheckCircle2 } from 'lucide-react';

function usePhoneBurnerConnection() {
  return useQuery({
    queryKey: ['phoneburner-connection-status'],
    queryFn: async () => {
      // Check if OAuth tokens exist for any user
      const { data: tokens } = await supabase
        .from('phoneburner_oauth_tokens')
        .select('id, user_id, expires_at, updated_at')
        .limit(5);

      return {
        connected: (tokens?.length ?? 0) > 0,
        tokens: tokens || [],
      };
    },
  });
}

function usePhoneBurnerStats() {
  return useQuery({
    queryKey: ['phoneburner-stats'],
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from('phoneburner_sessions')
        .select('id, session_status, total_dials, total_connections');

      const { count: webhookCount } = await supabase
        .from('phoneburner_webhooks_log')
        .select('id', { count: 'exact', head: true });

      return {
        sessionCount: sessions?.length ?? 0,
        activeSessionCount:
          sessions?.filter((s) => (s.session_status || 'active') === 'active').length ?? 0,
        totalDials: sessions?.reduce((sum, s) => sum + (s.total_dials || 0), 0) ?? 0,
        webhookEventCount: webhookCount ?? 0,
      };
    },
  });
}

function usePhoneBurnerWebhookLog() {
  return useQuery({
    queryKey: ['phoneburner-webhook-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoneburner_webhooks_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });
}

export default function PhoneBurnerSettingsPage() {
  const { data: connection, isLoading: connLoading } = usePhoneBurnerConnection();
  const { data: stats } = usePhoneBurnerStats();
  const { data: webhookEvents = [] } = usePhoneBurnerWebhookLog();

  const webhookUrl = `${SUPABASE_URL}/functions/v1/phoneburner-webhook`;
  const oauthCallbackUrl = `${SUPABASE_URL}/functions/v1/phoneburner-oauth-callback`;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PhoneBurner Integration</h1>
            <p className="text-muted-foreground">
              Manage your PhoneBurner power dialer connection and call tracking
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://www.phoneburner.com" target="_blank" rel="noopener noreferrer">
              Open PhoneBurner
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Connection</p>
            {connLoading ? (
              <Badge variant="outline" className="mt-1">
                Checking...
              </Badge>
            ) : connection?.connected ? (
              <Badge className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="mt-1">
                Not connected
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Phone className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Dial Sessions</p>
            <p className="text-xl font-bold mt-1">{stats?.sessionCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <PhoneCall className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xs text-muted-foreground">Total Dials</p>
            <p className="text-xl font-bold mt-1">{stats?.totalDials ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Webhook className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Webhook Events</p>
            <p className="text-xl font-bold mt-1">{stats?.webhookEventCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Details */}
      {connection?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              {connection.tokens.length} OAuth token{connection.tokens.length !== 1 ? 's' : ''}{' '}
              active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {connection.tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>User: {t.user_id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {new Date(t.expires_at) > new Date() ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Expired
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Updated: {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup</CardTitle>
          <CardDescription>
            Configure the PhoneBurner OAuth integration for your team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">1. OAuth App Credentials</h3>
            <p className="text-sm text-muted-foreground">
              Add the following secrets to your Supabase Edge Function environment:
            </p>
            <div className="space-y-1 text-xs font-mono bg-muted p-3 rounded-md">
              <p>PHONEBURNER_CLIENT_ID=your_client_id</p>
              <p>PHONEBURNER_CLIENT_SECRET=your_client_secret</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">2. OAuth Callback URL</h3>
            <p className="text-sm text-muted-foreground">
              Set this as the OAuth redirect URI in your PhoneBurner app settings:
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-3 py-2 rounded text-xs flex-1 overflow-x-auto">
                {oauthCallbackUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(oauthCallbackUrl)}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">3. Webhook URL</h3>
            <p className="text-sm text-muted-foreground">
              Add this webhook URL in your PhoneBurner settings to receive call events:
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-3 py-2 rounded text-xs flex-1 overflow-x-auto">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Subscribe to: call.started, call.connected, call.ended, disposition.set,
              callback.scheduled, contact.updated
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">4. Webhook Secret (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              For HMAC-SHA256 signature validation, set{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                PHONEBURNER_WEBHOOK_SECRET
              </code>{' '}
              in your Supabase secrets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
          <CardDescription>
            Push contacts from SourceCo to PhoneBurner for power dialing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="text-sm font-medium">Build a Contact List</p>
              <p className="text-xs text-muted-foreground">
                Select contacts from Buyer Contacts page and click "Save as List"
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="text-sm font-medium">Push to PhoneBurner</p>
              <p className="text-xs text-muted-foreground">
                Open any contact list and click "Push to Dialer" to send contacts to PhoneBurner
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="text-sm font-medium">Track Activity</p>
              <p className="text-xs text-muted-foreground">
                Call events and dispositions sync back automatically via webhooks. View call history
                on buyer detail pages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Webhook Events */}
      {webhookEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Webhook Events</CardTitle>
            <CardDescription>Latest call events received from PhoneBurner</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {webhookEvents.map((event: Record<string, unknown>) => (
                <div
                  key={event.id as string}
                  className="flex items-center justify-between py-2 px-3 rounded bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {event.event_type as string}
                    </Badge>
                    {!!event.event_id && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {String(event.event_id)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {event.processing_status === 'success' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                        Processed
                      </Badge>
                    ) : event.processing_status === 'failed' ? (
                      <Badge variant="destructive" className="text-xs">
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Pending
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at as string).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
