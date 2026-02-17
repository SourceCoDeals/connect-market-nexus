import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Link as LinkIcon,
  Calendar,
  Upload,
  X,
  File,
  Check,
  Search,
} from "lucide-react";

interface SelectedFile {
  file: File;
  title: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  text?: string;
}

interface TranscriptAddDialogProps {
  // Manual entry state
  transcriptTitle: string;
  onTranscriptTitleChange: (val: string) => void;
  transcriptUrl: string;
  onTranscriptUrlChange: (val: string) => void;
  callDate: string;
  onCallDateChange: (val: string) => void;
  newTranscript: string;
  onNewTranscriptChange: (val: string) => void;
  // File upload
  fileInputRef: React.RefObject<HTMLInputElement>;
  selectedFiles: SelectedFile[];
  onSelectedFilesChange: (files: SelectedFile[]) => void;
  isMultiFileMode: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Add mutation
  addMutationPending: boolean;
  onAddMutate: () => void;
  processingProgress: { current: number; total: number };
  // Mode
  addMode: 'manual' | 'fireflies';
  onAddModeChange: (mode: 'manual' | 'fireflies') => void;
  // Fireflies search
  firefliesEmail: string;
  onFirefliesEmailChange: (val: string) => void;
  firefliesSearching: boolean;
  onFirefliesSearch: () => void;
  firefliesResults: any[];
  selectedFirefliesIds: Set<string>;
  onToggleFirefliesId: (id: string) => void;
  onToggleAllFireflies: () => void;
  firefliesImporting: boolean;
  onFirefliesImport: () => void;
  firefliesSearchInfo: string;
  // Dialog control
  onClose: () => void;
}

export function TranscriptAddDialog({
  transcriptTitle,
  onTranscriptTitleChange,
  transcriptUrl,
  onTranscriptUrlChange,
  callDate,
  onCallDateChange,
  newTranscript,
  onNewTranscriptChange,
  fileInputRef,
  selectedFiles,
  onSelectedFilesChange,
  isMultiFileMode,
  onFileUpload,
  addMutationPending,
  onAddMutate,
  processingProgress,
  addMode,
  onAddModeChange,
  firefliesEmail,
  onFirefliesEmailChange,
  firefliesSearching,
  onFirefliesSearch,
  firefliesResults,
  selectedFirefliesIds,
  onToggleFirefliesId,
  onToggleAllFireflies,
  firefliesImporting,
  onFirefliesImport,
  firefliesSearchInfo,
  onClose,
}: TranscriptAddDialogProps) {
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add Call Transcript</DialogTitle>
        <DialogDescription>
          Add a transcript from a call. AI will extract key information about the deal.
        </DialogDescription>
      </DialogHeader>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={addMode === 'manual' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onAddModeChange('manual')}
        >
          Manual Entry
        </Button>
        <Button
          variant={addMode === 'fireflies' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onAddModeChange('fireflies')}
        >
          <Search className="h-4 w-4 mr-2" />
          Pull from Fireflies
        </Button>
      </div>

      {addMode === 'fireflies' ? (
        <div className="space-y-4 py-4">
          {/* Email/domain input */}
          <div className="space-y-2">
            <Label>Contact Email or Company Domain</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@company.com or company.com"
                value={firefliesEmail}
                onChange={(e) => onFirefliesEmailChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !firefliesSearching && onFirefliesSearch()}
              />
              <Button
                onClick={onFirefliesSearch}
                disabled={!firefliesEmail.trim() || firefliesSearching}
              >
                {firefliesSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter an email to find all Fireflies calls with anyone at that company's domain.
              For example, entering <code>tyler@saltcreekcap.com</code> will find calls with ALL contacts at <code>@saltcreekcap.com</code>.
            </p>
            {firefliesSearchInfo && (
              <p className="text-xs text-primary">{firefliesSearchInfo}</p>
            )}
          </div>

          {/* Results list */}
          {firefliesResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{firefliesResults.length} transcripts found</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleAllFireflies}
                >
                  {selectedFirefliesIds.size === firefliesResults.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {firefliesResults.map((result: any) => (
                  <Card
                    key={result.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedFirefliesIds.has(result.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onToggleFirefliesId(result.id)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedFirefliesIds.has(result.id)}
                        readOnly
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          {result.date && (
                            <span>{new Date(result.date).toLocaleDateString()}</span>
                          )}
                          {result.duration_minutes && (
                            <span>{result.duration_minutes} min</span>
                          )}
                        </div>
                        {result.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {typeof result.summary === 'string' ? result.summary : result.summary.short_summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g., Discovery Call - Jan 15"
            value={transcriptTitle}
            onChange={(e) => onTranscriptTitleChange(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="transcriptUrl" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Transcript Link URL
            </Label>
            <Input
              id="transcriptUrl"
              placeholder="e.g., https://app.fireflies.ai/view/..."
              value={transcriptUrl}
              onChange={(e) => onTranscriptUrlChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="callDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Call Date
            </Label>
            <Input
              id="callDate"
              type="date"
              value={callDate}
              onChange={(e) => onCallDateChange(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="transcript">Notes / Transcript Content</Label>
          <Textarea
            id="transcript"
            placeholder="Paste the call transcript or notes here..."
            value={newTranscript}
            onChange={(e) => onNewTranscriptChange(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
        </div>

        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            addMutationPending ? 'bg-muted/50 cursor-not-allowed' : 'hover:bg-muted/50'
          }`}
          onClick={() => !addMutationPending && (fileInputRef.current as any)?.click()}
        >
          <input
            ref={fileInputRef as any}
            type="file"
            accept=".pdf,.txt,.doc,.docx,.vtt,.srt"
            onChange={onFileUpload}
            className="hidden"
            disabled={addMutationPending}
            multiple
          />
          <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
          <p className="text-sm font-medium">
            {selectedFiles.length > 0 ? 'Add more files' : 'Or upload files instead'}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports PDF, TXT, DOC, DOCX, VTT, SRT (max 10MB each) • Select multiple files
          </p>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{selectedFiles.length} file(s) selected</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => onSelectedFilesChange([])}
                disabled={addMutationPending}
              >
                Clear all
              </Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((sf, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-background rounded p-2">
                  {sf.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : sf.status === 'done' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : sf.status === 'error' ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : (
                    <File className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    value={sf.title}
                    onChange={(e) => onSelectedFilesChange(
                      selectedFiles.map((f, i) => i === idx ? { ...f, title: e.target.value } : f)
                    )}
                    className="h-7 text-sm flex-1"
                    disabled={addMutationPending}
                    placeholder="Title"
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-24">
                    {sf.file.name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => onSelectedFilesChange(selectedFiles.filter((_, i) => i !== idx))}
                    disabled={addMutationPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {addMode === 'fireflies' ? (
          <Button
            onClick={onFirefliesImport}
            disabled={selectedFirefliesIds.size === 0 || firefliesImporting}
          >
            {firefliesImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${selectedFirefliesIds.size} Transcript${selectedFirefliesIds.size !== 1 ? 's' : ''}`
            )}
          </Button>
        ) : (
          <Button
            onClick={onAddMutate}
            disabled={(isMultiFileMode ? selectedFiles.length === 0 : !transcriptUrl.trim()) || addMutationPending}
          >
            {addMutationPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {processingProgress.total > 1
                  ? `Processing ${processingProgress.current}/${processingProgress.total}...`
                  : 'Adding...'}
              </>
            ) : selectedFiles.length > 1 ? `Add ${selectedFiles.length} Transcripts` : "Add Transcript"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
