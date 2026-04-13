import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, PhoneCall, PhoneOff, Voicemail, UserX } from 'lucide-react';

interface MemberWithActivity {
  contact_phone?: string | null;
  contact_email?: string | null;
  total_calls?: number;
  last_disposition?: string | null;
  contact?: { phone?: string | null; email?: string | null } | null;
}

interface ListAnalyticsSummaryProps {
  members: MemberWithActivity[];
}

function normalizeDisposition(d: string): string {
  const lower = d.toLowerCase();
  if (lower.includes('connect') || lower.includes('spoke') || lower.includes('decision maker'))
    return 'connected';
  if (lower.includes('voicemail') || lower.includes('vm')) return 'voicemail';
  if (lower.includes('no answer') || lower.includes('no_answer') || lower.includes('busy'))
    return 'no_answer';
  if (lower.includes('not interested') || lower.includes('dnc') || lower.includes('do not'))
    return 'not_interested';
  return 'other';
}

export function ListAnalyticsSummary({ members }: ListAnalyticsSummaryProps) {
  const stats = useMemo(() => {
    const total = members.length;
    if (total === 0) return null;

    const withPhone = members.filter((m) => m.contact_phone || m.contact?.phone).length;
    const withEmail = members.filter((m) => m.contact_email || m.contact?.email).length;
    const called = members.filter((m) => (m.total_calls ?? 0) > 0).length;
    const untouched = total - called;
    const totalCalls = members.reduce((sum, m) => sum + (m.total_calls ?? 0), 0);

    const dispositions: Record<string, number> = {};
    for (const m of members) {
      if (m.last_disposition) {
        const key = normalizeDisposition(m.last_disposition);
        dispositions[key] = (dispositions[key] || 0) + 1;
      }
    }

    return {
      total,
      withPhone,
      withEmail,
      called,
      untouched,
      callRate: total > 0 ? Math.round((called / total) * 100) : 0,
      avgCalls: called > 0 ? Math.round((totalCalls / called) * 10) / 10 : 0,
      connected: dispositions['connected'] || 0,
      voicemail: dispositions['voicemail'] || 0,
      noAnswer: dispositions['no_answer'] || 0,
      notInterested: dispositions['not_interested'] || 0,
    };
  }, [members]);

  if (!stats) return null;

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Stat icon={Phone} label="With Phone" value={stats.withPhone} total={stats.total} />
          <Stat icon={Mail} label="With Email" value={stats.withEmail} total={stats.total} />
          <div className="h-4 w-px bg-border" />
          <Stat
            icon={PhoneCall}
            label="Called"
            value={stats.called}
            total={stats.total}
            pct={stats.callRate}
          />
          <Stat icon={PhoneOff} label="Untouched" value={stats.untouched} />
          {stats.called > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-muted-foreground">Avg {stats.avgCalls} calls/contact</span>
              {stats.connected > 0 && (
                <Stat
                  icon={PhoneCall}
                  label="Connected"
                  value={stats.connected}
                  className="text-green-600"
                />
              )}
              {stats.voicemail > 0 && (
                <Stat icon={Voicemail} label="Voicemail" value={stats.voicemail} />
              )}
              {stats.notInterested > 0 && (
                <Stat
                  icon={UserX}
                  label="Not Interested"
                  value={stats.notInterested}
                  className="text-red-500"
                />
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  total,
  pct,
  className,
}: {
  icon: typeof Phone;
  label: string;
  value: number;
  total?: number;
  pct?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? 'text-muted-foreground'}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">{value}</span>
      {total != null && <span>/{total}</span>}
      {pct != null && <span>({pct}%)</span>}
      <span>{label}</span>
    </div>
  );
}
