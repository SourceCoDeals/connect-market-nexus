import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface CapTargetExclusionLogProps {
  exclusionLog: any[];
  showExclusionLog: boolean;
  setShowExclusionLog: (v: boolean) => void;
  isCleaningUp: boolean;
  showCleanupDialog: boolean;
  setShowCleanupDialog: (v: boolean) => void;
  onCleanup: () => void;
  cleanupResultOpen: boolean;
  setCleanupResultOpen: (v: boolean) => void;
  cleanupResult: { cleaned: number; total_checked: number; breakdown?: Record<string, number>; sample?: Array<{ company: string; reason: string }> } | null;
}

export function CapTargetExclusionLog({
  exclusionLog,
  showExclusionLog,
  setShowExclusionLog,
  isCleaningUp,
  showCleanupDialog,
  setShowCleanupDialog,
  onCleanup,
  cleanupResultOpen,
  setCleanupResultOpen,
  cleanupResult,
}: CapTargetExclusionLogProps) {
  if (!exclusionLog || exclusionLog.length === 0) return null;

  return (
    <>
      <Card className="border-orange-200">
        <CardContent className="p-0">
          <button
            className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setShowExclusionLog(!showExclusionLog)}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" />
              <span>{exclusionLog.length} companies excluded from CapTarget sync</span>
            </div>
            {showExclusionLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showExclusionLog && (
            <div className="border-t px-3 pb-3">
              <div className="flex items-center justify-between py-2">
                <p className="text-xs text-muted-foreground">Recent exclusions (PE/VC/advisory firms blocked from import)</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                  disabled={isCleaningUp}
                  onClick={() => setShowCleanupDialog(true)}
                >
                  {isCleaningUp ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Shield className="h-3 w-3 mr-1" />}
                  Clean Existing Deals
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Source</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exclusionLog.map((ex: any) => (
                      <TableRow key={ex.id}>
                        <TableCell className="text-xs font-medium">{ex.company_name || "—"}</TableCell>
                        <TableCell className="text-xs">{ex.exclusion_reason}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {ex.source === "retroactive_cleanup" ? "cleanup" : "sync"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ex.excluded_at ? format(new Date(ex.excluded_at), "MMM d, h:mm a") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup confirmation dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clean Up Existing CapTarget Deals?</AlertDialogTitle>
            <AlertDialogDescription>
              This will scan all existing CapTarget deals and remove any PE firms, VC firms, M&A advisors, investment banks, family offices, and search funds. Removed deals are logged for audit. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onCleanup} className="bg-orange-600 hover:bg-orange-700">
              Run Cleanup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cleanup result dialog */}
      <Dialog open={cleanupResultOpen} onOpenChange={setCleanupResultOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              Cleanup Complete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{cleanupResult?.total_checked ?? 0}</p>
                <p className="text-xs text-muted-foreground">Deals Checked</p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-2xl font-bold text-orange-600">{cleanupResult?.cleaned ?? 0}</p>
                <p className="text-xs text-muted-foreground">Removed</p>
              </div>
            </div>
            {cleanupResult?.sample && cleanupResult.sample.length > 0 && (
              <div className="max-h-48 overflow-y-auto text-xs space-y-1">
                <p className="font-medium text-muted-foreground">Sample of removed companies:</p>
                {cleanupResult.sample.map((s: any, i: number) => (
                  <p key={i} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{s.company}</span> — {s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setCleanupResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
