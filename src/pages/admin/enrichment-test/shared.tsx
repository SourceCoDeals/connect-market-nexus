import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { ChevronDown } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
export interface LogEntry {
  ts: string;
  msg: string;
  durationMs?: number;
  ok: boolean;
}

export type AddLogFn = (m: string, d?: number, ok?: boolean) => void;

// ─── Helpers ─────────────────────────────────────────────────────────
export function ts() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export function StatusBadge({ ok }: { ok: boolean | null | undefined }) {
  if (ok === null || ok === undefined) return null;
  return ok ? (
    <Badge className="bg-green-600 text-white">SUCCESS</Badge>
  ) : (
    <Badge variant="destructive">FAILED</Badge>
  );
}

export function JsonBlock({ data }: { data: unknown }) {
  return (
    <ScrollArea className="max-h-64 rounded-md border bg-muted p-3">
      <pre className="text-xs whitespace-pre-wrap break-all font-mono text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </ScrollArea>
  );
}

export function ComparisonTable({
  fields,
  before,
  after,
}: {
  fields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;
  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Field</TableHead>
            <TableHead>Before</TableHead>
            <TableHead>After</TableHead>
            <TableHead className="w-[80px]">Changed?</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => {
            const b = before ? String(before[f] ?? "\u2014") : "\u2014";
            const a = after ? String(after[f] ?? "\u2014") : "\u2014";
            const changed = b !== a;
            return (
              <TableRow key={f}>
                <TableCell className="font-mono text-xs">{f}</TableCell>
                <TableCell className="text-xs max-w-[260px] truncate">{b}</TableCell>
                <TableCell className="text-xs max-w-[260px] truncate">{a}</TableCell>
                <TableCell>
                  {changed ? (
                    <Badge className="bg-amber-500 text-white text-[10px]">YES</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">{"\u2014"}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              {icon}
              {title}
            </CardTitle>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
