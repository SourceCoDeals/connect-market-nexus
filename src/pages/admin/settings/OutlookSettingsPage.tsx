/**
 * OutlookSettingsPage: Connection management for individual team members
 * and admin dashboard showing all connections.
 * Includes Historical Email Backfill with 1yr/3yr/5yr/10yr presets.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Unplug,
  Clock,
  Loader2,
  Shield,
  Webhook,
  Activity,
  History,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useEmailConnection,
  useAdminEmailConnections,
  useOutlookMigrationHealth,
} from '@/hooks/email';
import type { EmailConnectionStatus } from '@/types/email';

function StatusBadge({ status }: { status: EmailConnectionStatus }) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    case 'revoked':
      return (
        <Badge variant="secondary">
          <Unplug className="h-3 w-3 mr-1" />
          Disconnected
        </Badge>
      );
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const BACKFILL_PRESETS: { label: string; days: number }[] = [
  { label: '1 year', days: 365 },
  { label: '3 years', days: 1095 },
  { label: '5 years', days: 1825 },
  { label: '10 years', days: 3650 },
];

/**
 * Banner rendered at the top of the Outlook settings page when the Outlook
 * historical-tracking migration hasn't been applied to the production
 * database. Without the migration, sync silently drops every unmatched
 * email (the target queue table doesn't exist) and historical linking
 * breaks, so surfacing this prominently saves a long debugging session.
 */
function MigrationHealthBanner({ isAdmin }: { isAdmin: boolean }) {
  const { data: health } = useOutlookMigrationHealth(isAdmin);
  if (!health || health.migrationApplied) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Database migration not applied</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          The Outlook historical-tracking migration{' '}
          <code className="bg-black/10 dark:bg-white/10 px-1 rounded">
            20260703000001_fix_outlook_historical_tracking.sql
          </code>{' '}
          has not been applied to this database. Until it is, the sync engine silently drops every
          email from an unknown contact, historical emails aren&apos;t linked to deals, and the
          Backfill button will error out.
        </p>
        <p>Run this once from a terminal with the Supabase CLI installed and authenticated:</p>
        <pre className="bg-black/10 dark:bg-white/10 p-2 rounded text-xs font-mono overflow-x-auto">
          supabase db push --project-ref vhzipqarkmmfuqadefep
        </pre>
        <p className="text-xs">
          If you don&apos;t have the CLI, open Supabase dashboard → SQL Editor and paste the
          contents of the migration file instead. Refresh this page after the migration succeeds —
          this banner will disappear.
        </p>
        {health.errorCode && (
          <p className="text-xs opacity-75">
            Detected error code: <code>{health.errorCode}</code>
            {health.errorMessage ? ` — ${health.errorMessage}` : null}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

function MyConnection() {
  const {
    connection,
    isLoading,
    isConnected,
    connect,
    isConnecting,
    disconnect,
    isDisconnecting,
    backfillHistory,
    isBackfilling,
    lastBackfillResult,
  } = useEmailConnection();
  const [selectedPreset, setSelectedPreset] = useState<number>(365);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!connection || connection.status === 'revoked') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Connect Your Outlook Account
          </CardTitle>
          <CardDescription>
            Link your Microsoft Outlook account to automatically sync and track email correspondence
            with contacts in the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => connect()} disabled={isConnecting}>
            {isConnecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {isConnecting ? 'Connecting...' : 'Connect Outlook'}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            You'll be redirected to Microsoft to sign in and authorize access. This allows the
            platform to read and send emails on your behalf.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Outlook Connection
            </CardTitle>
            <CardDescription className="mt-1">{connection.email_address}</CardDescription>
          </div>
          <StatusBadge status={connection.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection.error_message && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{connection.error_message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Last Synced</p>
            <p className="font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(connection.last_sync_at)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Webhook Status</p>
            <p className="font-medium flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5" />
              {connection.webhook_subscription_id ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-yellow-600">Polling only</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Connected Since</p>
            <p className="font-medium">{formatDate(connection.created_at)}</p>
          </div>
          {connection.webhook_expires_at && (
            <div>
              <p className="text-muted-foreground text-xs">Webhook Expires</p>
              <p className="font-medium">{formatDate(connection.webhook_expires_at)}</p>
            </div>
          )}
        </div>

        <Separator />

        {isConnected && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Historical Email Backfill</p>
              </div>
              <p className="text-xs text-muted-foreground">
                The initial connection automatically syncs the last 365 days of history. Run a
                deeper backfill below to pull older Outlook threads and automatically link them to
                matching contacts and deals. Emails that don&apos;t match a known contact yet are
                stored and retro-linked the moment a matching contact is created.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {BACKFILL_PRESETS.map((preset) => (
                  <Button
                    key={preset.days}
                    size="sm"
                    variant={selectedPreset === preset.days ? 'default' : 'outline'}
                    onClick={() => setSelectedPreset(preset.days)}
                    disabled={isBackfilling}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  onClick={() => backfillHistory({ daysBack: selectedPreset })}
                  disabled={isBackfilling}
                >
                  {isBackfilling ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <History className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {isBackfilling ? 'Backfilling…' : `Backfill ${selectedPreset} days`}
                </Button>
              </div>
              {lastBackfillResult && (
                <p className="text-xs text-muted-foreground">
                  Last backfill pulled{' '}
                  <span className="font-medium text-foreground">
                    {lastBackfillResult.syncResult?.synced ?? 0}
                  </span>{' '}
                  matched emails and queued{' '}
                  <span className="font-medium text-foreground">
                    {lastBackfillResult.syncResult?.queuedUnmatched ?? 0}
                  </span>{' '}
                  for future contacts.
                </p>
              )}
            </div>

            <Separator />
          </>
        )}

        <div className="flex gap-2">
          {!isConnected && (
            <Button size="sm" onClick={() => connect()} disabled={isConnecting}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isConnecting ? 'animate-spin' : ''}`} />
              Reconnect
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (
                window.confirm(
                  'Are you sure you want to disconnect your Outlook account? Email history will be preserved.',
                )
              ) {
                disconnect(undefined);
              }
            }}
            disabled={isDisconnecting}
          >
            <Unplug className="h-3.5 w-3.5 mr-1.5" />
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminConnectionsDashboard() {
  const { data: connections, isLoading } = useAdminEmailConnections();
  const {
    disconnect,
    isDisconnecting,
    bulkBackfillAll,
    isBulkBackfilling,
    lastBulkBackfillResult,
  } = useEmailConnection();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const activeConnectionCount = (connections || []).filter((c) => c.status === 'active').length;

  const handleBulkBackfill = () => {
    if (activeConnectionCount === 0) return;
    const confirmed = window.confirm(
      `This will import the last 365 days of Outlook history for all ${activeConnectionCount} connected team member${activeConnectionCount === 1 ? '' : 's'}, linking emails to existing contacts and deals. Emails for contacts that don't exist yet will be queued and auto-linked when those contacts are created.\n\nThis may take several minutes. Continue?`,
    );
    if (confirmed) {
      bulkBackfillAll({ daysBack: 365 });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Team Outlook Connections
        </CardTitle>
        <CardDescription>
          Monitor all team member email connections. Connections in error state need attention.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bulk backfill — lives in its own dedicated block above the
            connection list so it's visually impossible to miss. The old
            placement (tucked into the CardHeader) was invisible in some
            layouts. */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Historical Email Backfill — All Mailboxes
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Imports the last 365 days of Outlook history for every connected team member in one
                sequential run, linking each email to existing contacts and deals. Emails for
                contacts that don&apos;t exist yet are queued and auto-linked the moment those
                contacts are created.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleBulkBackfill}
              disabled={isBulkBackfilling || activeConnectionCount === 0}
              title={
                activeConnectionCount === 0
                  ? 'No active connections to backfill'
                  : `Backfill 365 days of history for all ${activeConnectionCount} connected mailboxes`
              }
            >
              {isBulkBackfilling ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <History className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isBulkBackfilling
                ? 'Backfilling all…'
                : `Backfill all (365 days)${
                    activeConnectionCount > 0 ? ` · ${activeConnectionCount}` : ''
                  }`}
            </Button>
          </div>
          {activeConnectionCount === 0 && (
            <p className="text-xs text-muted-foreground">
              No active connections yet. Have team members click Connect Outlook above first, then
              come back here to backfill.
            </p>
          )}
          {lastBulkBackfillResult && (
            <p className="text-xs text-muted-foreground">
              Last run: processed{' '}
              <span className="font-medium text-foreground">
                {lastBulkBackfillResult.mailboxesProcessed}
              </span>{' '}
              mailboxes ({lastBulkBackfillResult.mailboxesFailed} failed). Imported{' '}
              <span className="font-medium text-foreground">
                {lastBulkBackfillResult.totalSynced}
              </span>{' '}
              matched emails, queued{' '}
              <span className="font-medium text-foreground">
                {lastBulkBackfillResult.totalQueued}
              </span>{' '}
              for future contacts, re-linked{' '}
              <span className="font-medium text-foreground">
                {lastBulkBackfillResult.totalRematched}
              </span>{' '}
              from the unmatched queue.
            </p>
          )}
        </div>

        {!connections || connections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No team members have connected their Outlook accounts yet.
          </p>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  conn.status === 'error'
                    ? 'border-destructive/50 bg-destructive/5'
                    : conn.status === 'expired'
                      ? 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10'
                      : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {conn.profile
                        ? `${conn.profile.first_name} ${conn.profile.last_name}`
                        : 'Unknown User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{conn.email_address}</p>
                    {conn.error_message && (
                      <p className="text-xs text-destructive mt-0.5 truncate">
                        {conn.error_message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right text-xs text-muted-foreground mr-2">
                    <p>Last sync: {formatDate(conn.last_sync_at)}</p>
                  </div>
                  <StatusBadge status={conn.status} />
                  {conn.status !== 'revoked' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (window.confirm(`Disconnect ${conn.email_address}?`)) {
                          disconnect(conn.sourceco_user_id);
                        }
                      }}
                      disabled={isDisconnecting}
                    >
                      <Unplug className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const OutlookSettingsPage = () => {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Outlook Email Integration</h2>
        <p className="text-muted-foreground mt-1">
          Connect your Microsoft Outlook account to automatically sync and track email
          correspondence with contacts.
        </p>
      </div>

      {isAdmin && <MigrationHealthBanner isAdmin={isAdmin} />}

      <MyConnection />

      {isAdmin && (
        <>
          <Separator />
          <AdminConnectionsDashboard />
        </>
      )}
    </div>
  );
};

export default OutlookSettingsPage;
