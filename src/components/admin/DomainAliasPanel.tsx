import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Globe, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirmDomainAliases } from '@/hooks/admin/use-firm-agreement-queries';
import {
  useAddDomainAlias,
  useRemoveDomainAlias,
} from '@/hooks/admin/use-firm-agreement-mutations';
import { isGenericEmailDomain, extractEmailDomain } from '@/lib/generic-email-domains';

interface DomainAliasPanelProps {
  firmId: string | null;
  /**
   * Optional label shown in the header when a caller wants to disambiguate
   * (e.g. "Blackstone — Domain Aliases"). Defaults to "Domain Aliases".
   */
  title?: string;
}

/**
 * Renders the list of email domain aliases associated with a firm_agreements
 * row and allows admins to add/remove them. The primary domain is badged and
 * cannot be deleted.
 *
 * Validation is double-gated: this component blocks generic domains client-
 * side via isGenericEmailDomain (fast, clear error), and the Postgres side
 * rejects them via the generic_email_domains table + RLS / constraints.
 */
export function DomainAliasPanel({ firmId, title = 'Domain Aliases' }: DomainAliasPanelProps) {
  const { data: aliases = [], isLoading } = useFirmDomainAliases(firmId);
  const addMutation = useAddDomainAlias();
  const removeMutation = useRemoveDomainAlias();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (!firmId) return;
    const raw = input.trim().toLowerCase();
    if (raw.length === 0) return;

    // Accept either "gmail.com" or "foo@acme.co" — strip the @prefix if present.
    const domain = raw.includes('@') ? (extractEmailDomain(raw) ?? '') : raw;

    if (!domain || !domain.includes('.')) {
      toast({
        variant: 'destructive',
        title: 'Invalid domain',
        description: 'Enter a valid domain like "acme.com".',
      });
      return;
    }

    if (isGenericEmailDomain(domain)) {
      toast({
        variant: 'destructive',
        title: 'Generic email domain',
        description: 'Cannot add free/consumer email domains (gmail, yahoo, etc.) as a firm alias.',
      });
      return;
    }

    if (aliases.some((a) => a.domain.toLowerCase() === domain)) {
      toast({
        variant: 'destructive',
        title: 'Already added',
        description: `${domain} is already an alias for this firm.`,
      });
      return;
    }

    addMutation.mutate(
      { firmId, domain },
      {
        onSuccess: () => setInput(''),
      },
    );
  };

  const handleRemove = (aliasId: string, domain: string, isPrimary: boolean) => {
    if (!firmId) return;
    if (isPrimary) {
      toast({
        variant: 'destructive',
        title: 'Cannot remove primary',
        description: 'The primary domain cannot be deleted. Set a different primary first.',
      });
      return;
    }
    if (
      confirm(`Remove alias "${domain}"? Activity from this domain will no longer match this firm.`)
    ) {
      removeMutation.mutate({ aliasId, firmId });
    }
  };

  if (!firmId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            {title}
          </CardTitle>
          <CardDescription>
            No firm association — domain tracking requires a linked firm record.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>
          All email domains that resolve to this firm. Activity from any of these domains (calls,
          emails, LinkedIn) will be grouped under this buyer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading aliases…
          </div>
        ) : aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No aliases yet. Add the firm's primary corporate domain below.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {aliases.map((alias) => (
              <li key={alias.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{alias.domain}</span>
                  {alias.is_primary && (
                    <Badge variant="secondary" className="text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={alias.is_primary || removeMutation.isPending}
                  onClick={() => handleRemove(alias.id, alias.domain, alias.is_primary)}
                  aria-label={`Remove alias ${alias.domain}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="acme.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            disabled={addMutation.isPending}
          />
          <Button
            onClick={handleAdd}
            disabled={addMutation.isPending || input.trim().length === 0}
            size="sm"
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
