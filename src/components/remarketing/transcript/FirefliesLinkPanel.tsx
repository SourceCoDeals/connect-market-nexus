import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Link as LinkIcon,
  Upload,
  RefreshCw,
  Search,
  ExternalLink,
  Clock,
  Link2,
  AlertCircle,
} from "lucide-react";

interface FirefliesLinkPanelProps {
  contactEmail?: string | null;
  contactName?: string | null;
  lastSynced: Date | null;
  syncLoading: boolean;
  onSync: () => void;
  // Paste link
  firefliesUrl: string;
  onFirefliesUrlChange: (val: string) => void;
  linkingUrl: boolean;
  onLinkByUrl: () => void;
  // Upload
  ffFileInputRef: React.RefObject<HTMLInputElement>;
  ffUploading: boolean;
  onFfFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Search
  ffQuery: string;
  onFfQueryChange: (val: string) => void;
  ffSearchLoading: boolean;
  onFfQuickSearch: () => void;
  ffResults: any[];
  ffLinking: string | null;
  onLinkSearchResult: (transcript: any) => void;
}

export function FirefliesLinkPanel({
  contactEmail,
  contactName,
  lastSynced,
  syncLoading,
  onSync,
  firefliesUrl,
  onFirefliesUrlChange,
  linkingUrl,
  onLinkByUrl,
  ffFileInputRef,
  ffUploading,
  onFfFileUpload,
  ffQuery,
  onFfQueryChange,
  ffSearchLoading,
  onFfQuickSearch,
  ffResults,
  ffLinking,
  onLinkSearchResult,
}: FirefliesLinkPanelProps) {
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
      {/* Auto-sync row */}
      {contactEmail && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Contact: {contactName || contactEmail}</p>
            {contactName && <p>{contactEmail}</p>}
            {lastSynced && <p>Last synced: {lastSynced.toLocaleTimeString()}</p>}
          </div>
          <Button size="sm" variant="outline" onClick={onSync} disabled={syncLoading} className="shrink-0">
            {syncLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            {syncLoading ? 'Syncing...' : 'Auto-Sync'}
          </Button>
        </div>
      )}
      {!contactEmail && (
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-xs text-muted-foreground">Add a contact email to enable auto-sync from Fireflies</p>
        </div>
      )}

      {/* Manual link tabs */}
      <Tabs defaultValue="link" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="link" className="text-xs"><Link2 className="h-3.5 w-3.5 mr-1" />Paste Link</TabsTrigger>
          <TabsTrigger value="upload" className="text-xs"><Upload className="h-3.5 w-3.5 mr-1" />Upload</TabsTrigger>
          <TabsTrigger value="search" className="text-xs"><Search className="h-3.5 w-3.5 mr-1" />Search</TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="https://app.fireflies.ai/view/..." value={firefliesUrl} onChange={e => onFirefliesUrlChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && !linkingUrl && onLinkByUrl()} className="flex-1 h-8 text-sm" />
            <Button onClick={onLinkByUrl} disabled={linkingUrl || !firefliesUrl.trim()} size="sm" className="h-8">
              {linkingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LinkIcon className="h-4 w-4 mr-1" />Link</>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Paste a Fireflies transcript URL to link it</p>
        </TabsContent>

        <TabsContent value="upload" className="space-y-2">
          <input ref={ffFileInputRef as any} type="file" accept=".pdf,.doc,.docx,.txt,.vtt,.srt,.md" multiple onChange={onFfFileUpload} className="hidden" />
          <Button variant="outline" className="w-full h-16 border-dashed" onClick={() => (ffFileInputRef.current as any)?.click()} disabled={ffUploading}>
            {ffUploading ? (
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Uploading...</span></div>
            ) : (
              <div className="flex flex-col items-center gap-1"><Upload className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">PDF, DOC, TXT, VTT, SRT</span></div>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="search" className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search by company name, keywords..." value={ffQuery} onChange={e => onFfQueryChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && !ffSearchLoading && onFfQuickSearch()} className="flex-1 h-8 text-sm" />
            <Button onClick={onFfQuickSearch} disabled={ffSearchLoading || !ffQuery.trim()} size="sm" className="h-8">
              {ffSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {ffResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-auto">
              {ffResults.map(r => (
                <div key={r.id} className="border rounded p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.date).toLocaleDateString()}</span>
                      {r.duration_minutes && <span>{r.duration_minutes}m</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.meeting_url && <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => window.open(r.meeting_url, '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>}
                    <Button size="sm" className="h-7" onClick={() => onLinkSearchResult(r)} disabled={ffLinking === r.id}>
                      {ffLinking === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><LinkIcon className="h-3.5 w-3.5 mr-1" />Link</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
