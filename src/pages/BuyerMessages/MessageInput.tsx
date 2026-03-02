import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { MAX_ATTACHMENT_SIZE, ACCEPTED_FILE_TYPES } from './types';

// ─── MessageInput ───
// Compose bar with text input, file attachment, and send button.

interface MessageInputProps {
  /** Current text value */
  value: string;
  /** Called when text changes */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called when send is triggered */
  onSend: () => void;
  /** Whether sending / uploading is in progress */
  isSending: boolean;
  /** Whether a file is currently being uploaded */
  isUploading: boolean;
  /** Current attachment file (if any) */
  attachment: File | null;
  /** Set the attachment */
  onAttachmentChange: (file: File | null) => void;
  /** Placeholder text */
  placeholder?: string;
}

export function MessageInput({
  value,
  onChange,
  onSend,
  isSending,
  isUploading,
  attachment,
  onAttachmentChange,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast({
        title: 'File Too Large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }
    onAttachmentChange(file);
    e.target.value = '';
  };

  const canSend = (value.trim() || attachment) && !isSending && !isUploading;

  return (
    <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid #E5DDD0' }}>
      {attachment && (
        <div
          className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ backgroundColor: '#FCF9F0', border: '1px solid #E5DDD0', color: '#0E101A' }}
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: '#5A5A5A' }} />
          <span className="truncate flex-1">{attachment.name}</span>
          <span className="text-[10px] shrink-0" style={{ color: '#9A9A9A' }}>
            {(attachment.size / 1024).toFixed(0)}KB
          </span>
          <button
            type="button"
            onClick={() => onAttachmentChange(null)}
            className="shrink-0 p-0.5 rounded hover:bg-black/5"
          >
            <X className="h-3.5 w-3.5" style={{ color: '#5A5A5A' }} />
          </button>
        </div>
      )}
      <div
        className="flex items-end gap-3 rounded-lg border-2 p-2"
        style={{ borderColor: '#E5DDD0', backgroundColor: '#FFFFFF' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-1.5 rounded hover:bg-black/5 transition-colors"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" style={{ color: '#5A5A5A' }} />
        </button>
        <input
          type="text"
          value={value}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          className="flex-1 text-sm px-2 py-1.5 bg-transparent focus:outline-none"
          style={{ color: '#0E101A' }}
        />
        <Button
          size="sm"
          onClick={onSend}
          disabled={!canSend}
          className="h-9 px-4"
          style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
        >
          {isUploading ? (
            <span className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Send className="w-3.5 h-3.5 mr-1.5" />
          )}
          {isUploading ? 'Uploading...' : 'Send'}
        </Button>
      </div>
      <p className="text-[10px] mt-1" style={{ color: '#9A9A9A' }}>
        Enter to send
      </p>
    </div>
  );
}
