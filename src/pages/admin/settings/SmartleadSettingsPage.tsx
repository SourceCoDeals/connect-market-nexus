import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, Zap, Mail, BarChart3, Webhook } from 'lucide-react';
import { useSmartleadCampaigns, useSyncSmartleadCampaigns } from '@/hooks/smartlead';
import { useSmartleadWebhookEvents } from '@/hooks/smartlead';
import { SUPABASE_URL } from '@/integrations/supabase/client';

export default function SmartleadSettingsPage() {
  const { data: campaignsData, isLoading } = useSmartleadCampaigns();
  const syncMutation = useSyncSmartleadCampaigns();
  const { data: webhookEvents } = useSmartleadWebhookEvents(10);

  const localCampaigns = campaignsData?.local_campaigns || [];
  const remoteCampaigns = campaignsData?.campaigns || [];

  const webhookUrl = `${SUPABASE_URL}/functions/v1/smartlead-webhook`;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Smartlead Integration</h1>
            <p className="text-muted-foreground">
              Manage your Smartlead cold email campaigns and sync with platform contacts
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Campaigns
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Connection</p>
            {isLoading ? (
              <Badge variant="outline" className="mt-1">
                Checking...
              </Badge>
            ) : remoteCampaigns.length > 0 || localCampaigns.length > 0 ? (
              <Badge className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="mt-1">
                Not configured
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Remote Campaigns</p>
            <p className="text-xl font-bold mt-1">{remoteCampaigns.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Tracked Locally</p>
            <p className="text-xl font-bold mt-1">{localCampaigns.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Webhook className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Webhook Events</p>
            <p className="text-xl font-bold mt-1">{webhookEvents?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup</CardTitle>
          <CardDescription>
            Configure the Smartlead API key in your Supabase environment variables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">1. API Key</h3>
            <p className="text-sm text-muted-foreground">
              Add <code className="bg-muted px-1.5 py-0.5 rounded text-xs">SMARTLEAD_API_KEY</code>{' '}
              to your Supabase Edge Function secrets. You can find your API key in{' '}
              <span className="font-medium">Smartlead &rarr; Settings &rarr; API Keys</span>.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">2. Webhook URL</h3>
            <p className="text-sm text-muted-foreground">
              Add this webhook URL in your Smartlead campaign settings to receive real-time events:
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-3 py-2 rounded text-xs flex-1 overflow-x-auto">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                }}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">3. Webhook Secret (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              For added security, set{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                SMARTLEAD_WEBHOOK_SECRET
              </code>{' '}
              in your Supabase secrets and include it as a{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">?secret=</code> query
              parameter or{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">x-webhook-secret</code>{' '}
              header in your Smartlead webhook configuration.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Webhook Events */}
      {webhookEvents && webhookEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Webhook Events</CardTitle>
            <CardDescription>Latest events received from Smartlead</CardDescription>
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
                    <span className="text-muted-foreground">
                      {(event.lead_email as string) || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.processed ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                        Processed
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

      {/* External Link */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <a href="https://app.smartlead.ai" target="_blank" rel="noopener noreferrer">
            Open Smartlead Dashboard
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
