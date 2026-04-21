import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Globe, Building2, Calendar, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
];

export function CreateInviteLinkDialog({ open, onOpenChange, onCreated }: Props) {
  const [label, setLabel] = useState('');
  const [linkType, setLinkType] = useState<'general' | 'domain'>('general');
  const [domain, setDomain] = useState('');
  const [expiryDays, setExpiryDays] = useState('30');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiryDays, 10));

      const insertData: Record<string, unknown> = {
        label: label.trim() || null,
        expires_at: expiresAt.toISOString(),
        allowed_email_domain:
          linkType === 'domain' && domain.trim() ? domain.trim().toLowerCase() : null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      const { error } = await supabase.from('invite_links').insert(insertData as any);

      if (error) throw error;

      toast({ title: 'Invite link created', description: 'The link is ready to share.' });
      onCreated();
      onOpenChange(false);
      setLabel('');
      setLinkType('general');
      setDomain('');
      setExpiryDays('30');
    } catch (err) {
      console.error('Failed to create invite link:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create invite link.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const expiryLabel =
    EXPIRY_OPTIONS.find((o) => o.value === expiryDays)?.label ?? `${expiryDays} days`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Invite Link</DialogTitle>
          <DialogDescription>
            Generate a single-use link that pre-approves a new user on signup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Label (optional)
            </Label>
            <Input
              placeholder="e.g. ABC Capital Q2 cohort"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Link Type Cards */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Link Type
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLinkType('general')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all',
                  linkType === 'general'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50',
                )}
              >
                <Globe
                  className={cn(
                    'h-5 w-5',
                    linkType === 'general' ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <div>
                  <p className="text-sm font-medium">General</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Any email can use this link
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setLinkType('domain')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all',
                  linkType === 'domain'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50',
                )}
              >
                <Building2
                  className={cn(
                    'h-5 w-5',
                    linkType === 'domain' ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <div>
                  <p className="text-sm font-medium">Domain-locked</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Restricted to one email domain
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Domain Input */}
          {linkType === 'domain' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Allowed Email Domain
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                  @
                </span>
                <Input
                  placeholder="abccapital.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Only users with this email domain will be able to use the invite.
              </p>
            </div>
          )}

          {/* Expiry */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Expires In
            </Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Preview */}
          <div className="rounded-lg bg-muted/50 border p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Summary
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                {linkType === 'general' ? 'Any email' : `@${domain || '...'}`}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Expires in {expiryLabel}
              </span>
            </div>
            {label.trim() && <p className="text-xs text-muted-foreground">Label: {label.trim()}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || (linkType === 'domain' && !domain.trim())}
          >
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
