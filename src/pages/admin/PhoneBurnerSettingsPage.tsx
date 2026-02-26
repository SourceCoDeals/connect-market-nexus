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
  AlertTriangle,
  Key,
} from 'lucide-react';
import {
  usePhoneBurnerConnectedUsers,
  useDisconnectPhoneBurnerUser,
  useInitiatePhoneBurnerOAuth,
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

function AddAccessTokenForm() {
  const [accessToken, setAccessToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const saveMutation = useSavePhoneBurnerAccessToken();

  const handleSave = () => {
    if (!accessToken.trim()) {
      toast.error('Please enter an access token');
      return;
    }
    if (!displayName.trim()) {
      toast.error('Please enter a display name');
      return;
    }
    saveMutation.mutate(
      { accessToken: accessToken.trim(), displayName: displayName.trim() },
      {
        onSuccess: () => {
          toast.success(`PhoneBurner token saved for "${displayName.trim()}"`);
          setAccessToken('');
          setDisplayName('');
        },
        onError: (err) => {
          toast.error(`Failed to save token: ${err instanceof Error ? err.message : 'Unknown error'}`);
        },
      },
    );
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Key className="h-4 w-4 text-muted-foreground" />
        Add Access Token Manually
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a PhoneBurner access token directly. This is tied to your current user account.
        To get a token, go to PhoneBurner → Settings → API.
      </p>
      <div className="grid gap-2">
        <div className="space-y-1">
          <Label htmlFor="pb-display-name" className="text-xs">Display Name</Label>
          <Input
            id="pb-display-name"
            placeholder="e.g. Nish - PhoneBurner"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pb-access-token" className="text-xs">Access Token</Label>
          <Input
            id="pb-access-token"
            type="password"
            placeholder="Paste your PhoneBurner access token"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="h-8 text-sm font-mono"
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saveMutation.isPending || !accessToken.trim() || !displayName.trim()}
      >
        {saveMutation.isPending ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Key className="mr-2 h-3.5 w-3.5" />
        )}
        Save Token
      </Button>
    </div>
  );
}

export default function PhoneBurnerSettingsPage() {
  const { data: connectedUsers = [], isLoading: usersLoading } =
    usePhoneBurnerConnectedUsers();
  const { data: stats } = usePhoneBurnerStats();
  const { data: webhookEvents = [] } = usePhoneBurnerWebhookLog();
  const disconnectMutation = useDisconnectPhoneBurnerUser();
  const oauthMutation = useInitiatePhoneBurnerOAuth();

  const webhookUrl = `${SUPABASE_URL}/functions/v1/phoneburner-webhook`;
  const oauthCallbackUrl = `${SUPABASE_URL}/functions/v1/phoneburner-oauth-callback`;

  const handleConnect = async () => {
    try {
      const result = await oauthMutation.mutateAsync();
      if (result.authorize_url) {
        window.location.href = result.authorize_url;
      }
    } catch {
      toast.error('Failed to start PhoneBurner OAuth. Use the manual token option below instead.');
    }
  };

  const handleDisconnect = (userId: string, label: string) => {
    if (!confirm(`Disconnect ${label} from PhoneBurner? They will need to reconnect to push contacts.`)) {
      return;
    }
    disconnectMutation.mutate(userId, {
      onSuccess: () => toast.success(`${label} disconnected from PhoneBurner`),
      onError: () => toast.error('Failed to disconnect account'),
    });
  };

  const validCount = connectedUsers.filter((u) => !u.is_expired).length;
  const expiredCount = connectedUsers.filter((u) => u.is_expired).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PhoneBurner Integration</h1>
            <p className="text-muted-foreground">
              Manage PhoneBurner connections for your team. Each user connects their own account.
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

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Connected Accounts
              </CardTitle>
              <CardDescription>
                Each team member connects their own PhoneBurner account via OAuth or by pasting
                an access token directly.
              </CardDescription>
            </div>
            <Button
              onClick={handleConnect}
              disabled={oauthMutation.isPending}
              size="sm"
              variant="outline"
            >
              {oauthMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Connect via OAuth
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual token form — always visible */}
          <AddAccessTokenForm />

          {/* Connected accounts list */}
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : connectedUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No accounts connected yet</p>
              <p className="text-sm mt-1">
                Paste an access token above or click "Connect via OAuth" to link a PhoneBurner account.
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
                      {user.phoneburner_user_email && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {user.phoneburner_user_email}
                        </span>
                      )}
                      {user.profile_email &&
                        user.profile_email !== user.phoneburner_user_email && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (SourceCo: {user.profile_email})
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {user.is_manual_token && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Key className="h-3 w-3" />
                        Manual token
                      </Badge>
                    )}
                    {user.is_expired ? (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Expired
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                        Active
                      </Badge>
                    )}
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
              {expiredCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  {expiredCount} account{expiredCount !== 1 ? 's have' : ' has'} expired
                  tokens. Re-paste the access token above to refresh.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup</CardTitle>
          <CardDescription>Configure PhoneBurner for your team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Option A — Manual Access Token (Recommended)</h3>
            <p className="text-sm text-muted-foreground">
              Get your access token from PhoneBurner → Settings → API Access, then paste it in
              the form above. No OAuth app setup required.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Option B — OAuth App (for automatic token refresh)</h3>
            <p className="text-sm text-muted-foreground">
              Add these secrets to your Supabase Edge Function environment, then click
              "Connect via OAuth":
            </p>
            <div className="space-y-1 text-xs font-mono bg-muted p-3 rounded-md">
              <p>PHONEBURNER_CLIENT_ID=your_client_id</p>
              <p>PHONEBURNER_CLIENT_SECRET=your_client_secret</p>
            </div>
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
            <h3 className="text-sm font-medium">Webhook URL (for call event tracking)</h3>
            <p className="text-sm text-muted-foreground">
              Add this in PhoneBurner settings to receive call events back into SourceCo:
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
                      <Badge variant="outline" className="text-xs">Pending</Badge>
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
