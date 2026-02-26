import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Phone,
  Zap,
  PhoneCall,
  Webhook,
  ExternalLink,
  CheckCircle2,
  UserPlus,
  Loader2,
  Trash2,
  KeyRound,
} from 'lucide-react';
import {
  usePhoneBurnerConnectedUsers,
  useDisconnectPhoneBurnerUser,
  useSavePhoneBurnerAccessToken,
} from '@/hooks/use-phoneburner-users';
import { toast } from 'sonner';

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
  const { data: connectedUsers = [], isLoading: usersLoading } =
    usePhoneBurnerConnectedUsers();
  const { data: stats } = usePhoneBurnerStats();
  const { data: webhookEvents = [] } = usePhoneBurnerWebhookLog();
  const disconnectMutation = useDisconnectPhoneBurnerUser();
  const saveMutation = useSavePhoneBurnerAccessToken();

  const webhookUrl = `${SUPABASE_URL}/functions/v1/phoneburner-webhook`;

  const [newToken, setNewToken] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  const handleSaveToken = async () => {
    const token = newToken.trim();
    const name = newDisplayName.trim();
    if (!token) {
      toast.error('Please enter an access token');
      return;
    }
    if (!name) {
      toast.error('Please enter a display name for this token');
      return;
    }
    saveMutation.mutate(
      { accessToken: token, displayName: name },
      {
        onSuccess: () => {
          toast.success(`PhoneBurner token saved for "${name}"`);
          setNewToken('');
          setNewDisplayName('');
        },
        onError: (err) =>
          toast.error(`Failed to save token: ${err instanceof Error ? err.message : 'Unknown error'}`),
      },
    );
  };

  const handleDisconnect = (userId: string, label: string) => {
    if (!confirm(`Disconnect ${label} from PhoneBurner? They will need a new token to push contacts.`)) {
      return;
    }
    disconnectMutation.mutate(userId, {
      onSuccess: () => toast.success(`${label} disconnected from PhoneBurner`),
      onError: () => toast.error('Failed to disconnect account'),
    });
  };

  const validCount = connectedUsers.filter((u) => !u.is_expired).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PhoneBurner Integration</h1>
            <p className="text-muted-foreground">
              Manage PhoneBurner access tokens for your team. Paste each user's API access token below.
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

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Connected Users</p>
            {usersLoading ? (
              <Badge variant="outline" className="mt-1">Checking...</Badge>
            ) : validCount > 0 ? (
              <Badge className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                {validCount} connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="mt-1">None</Badge>
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

      {/* Add Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Add Access Token
          </CardTitle>
          <CardDescription>
            Paste a PhoneBurner API access token to connect an account. Get tokens from{' '}
            <a
              href="https://www.phoneburner.com/developer"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              PhoneBurner Developer Settings
            </a>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pb-display-name">Display Name</Label>
              <Input
                id="pb-display-name"
                placeholder="e.g. John Smith"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pb-token">Access Token</Label>
              <Input
                id="pb-token"
                type="password"
                placeholder="Paste access token..."
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleSaveToken}
            disabled={saveMutation.isPending || !newToken.trim() || !newDisplayName.trim()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Save Token
          </Button>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Accounts with saved access tokens. The admin can push contact lists to any connected account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : connectedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No accounts connected yet</p>
              <p className="text-sm mt-1">
                Add an access token above to connect a PhoneBurner account.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {connectedUsers.map((user) => (
                <div
                  key={user.token_id}
                  className="flex items-center justify-between py-3 px-4 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{user.label}</span>
                      {user.is_manual_token && (
                        <Badge variant="outline" className="ml-2 text-xs">Manual Token</Badge>
                      )}
                      {user.phoneburner_user_email && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {user.phoneburner_user_email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                      Active
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Updated:{' '}
                      {user.updated_at
                        ? new Date(user.updated_at).toLocaleDateString()
                        : '--'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDisconnect(user.user_id, user.label)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup</CardTitle>
          <CardDescription>
            Configure PhoneBurner webhooks for call tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">1. Webhook URL</h3>
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
            <h3 className="text-sm font-medium">2. Webhook Secret (Optional)</h3>
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

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
          <CardDescription>
            Push contacts from SourceCo to individual PhoneBurner accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">1</div>
            <div>
              <p className="text-sm font-medium">Add Access Tokens</p>
              <p className="text-xs text-muted-foreground">
                Paste each team member's PhoneBurner API access token above. Tokens are stored securely.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">2</div>
            <div>
              <p className="text-sm font-medium">Admin Builds Calling Lists</p>
              <p className="text-xs text-muted-foreground">
                Select contacts from Buyer Contacts or any list and click "Push to Dialer."
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">3</div>
            <div>
              <p className="text-sm font-medium">Choose Target Account(s)</p>
              <p className="text-xs text-muted-foreground">
                In the Push to Dialer dialog, select one or more connected PhoneBurner accounts
                to push the contacts to.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">4</div>
            <div>
              <p className="text-sm font-medium">Track Activity</p>
              <p className="text-xs text-muted-foreground">
                Call events and dispositions sync back automatically via webhooks. View call
                history on buyer detail pages.
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
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Received</Badge>
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
