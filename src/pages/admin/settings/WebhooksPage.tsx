import { WebhookSettings } from '@/components/settings/WebhookSettings';

export default function WebhooksPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Webhook Settings</h1>
        <p className="text-muted-foreground">
          Configure webhooks to receive real-time notifications when transcripts are processed
        </p>
      </div>
      <WebhookSettings />
    </div>
  );
}
