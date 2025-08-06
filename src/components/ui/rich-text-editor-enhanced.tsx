import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Undo2, 
  Redo2,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  Minus,
  Eye,
  Save,
  FileText,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface RichTextEditorEnhancedProps {
  content?: string;
  onChange?: (content: string, json: any) => void;
  placeholder?: string;
  className?: string;
  characterLimit?: number;
  autoSave?: boolean;
  showWordCount?: boolean;
  showPreview?: boolean;
}

export function RichTextEditorEnhanced({ 
  content = '', 
  onChange, 
  placeholder = 'Start typing your professional business description...',
  className,
  characterLimit = 20000,
  autoSave = true,
  showWordCount = true,
  showPreview = true
}: RichTextEditorEnhancedProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      const text = editor.getText();
      
      setWordCount(text.trim().split(/\s+/).filter(word => word.length > 0).length);
      setCharacterCount(text.length);
      
      // Character limit enforcement
      if (text.length > characterLimit) {
        toast({
          title: "Character Limit Exceeded",
          description: `Maximum ${characterLimit.toLocaleString()} characters allowed.`,
          variant: "destructive"
        });
        return;
      }
      
      onChange?.(html, json);
      
      // Auto-save functionality
      if (autoSave) {
        const timer = setTimeout(() => {
          setLastSaved(new Date());
        }, 2000);
        return () => clearTimeout(timer);
      }
    },
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-6',
            'prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground',
            'prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground',
            'prose-blockquote:text-muted-foreground prose-blockquote:border-l-border',
            'prose-table:border-collapse prose-th:border prose-th:border-border prose-th:p-2',
            'prose-td:border prose-td:border-border prose-td:p-2 prose-hr:border-border'
          ),
          'data-placeholder': placeholder,
        },
        handleKeyDown: (view, event) => {
          // Add keyboard shortcuts
          if (event.metaKey || event.ctrlKey) {
            if (event.key === 'b') {
              event.preventDefault();
              editor.chain().focus().toggleBold().run();
              return true;
            }
            if (event.key === 'i') {
              event.preventDefault();
              editor.chain().focus().toggleItalic().run();
              return true;
            }
          }
          return false;
        },
      },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    children, 
    title,
    disabled = false
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <Button
      type="button"
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );

  const insertTable = () => {
    editor.chain().focus().insertTable({ 
      rows: 3, 
      cols: 3, 
      withHeaderRow: true 
    }).run();
  };

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {/* Enhanced Toolbar */}
      <div className="border-b bg-muted/50 p-3">
        <div className="flex flex-wrap gap-1 items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {/* Headings Group */}
            <div className="flex gap-1 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
              >
                <Heading1 className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
              >
                <Heading2 className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
              >
                <Heading3 className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <div className="w-px bg-border mx-1" />

            {/* Text Formatting Group */}
            <div className="flex gap-1 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <div className="w-px bg-border mx-1" />

            {/* Lists Group */}
            <div className="flex gap-1 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
              >
                <List className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
              >
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <div className="w-px bg-border mx-1" />

            {/* Advanced Formatting Group */}
            <div className="flex gap-1 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Quote"
              >
                <Quote className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={insertTable}
                title="Insert Table"
              >
                <TableIcon className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
              >
                <Minus className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <div className="w-px bg-border mx-1" />

            {/* History Group */}
            <div className="flex gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(editor.getHTML());
                toast({ title: "Copied!", description: "HTML content copied to clipboard" });
              }}
              className="flex items-center gap-1"
              title="Copy HTML"
            >
              <Copy className="h-4 w-4" />
            </Button>
            
            {showPreview && (
              <Button
                type="button"
                variant={isPreview ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
                className="flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                {isPreview ? 'Edit' : 'Preview'}
              </Button>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {showWordCount && (
              <>
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{characterCount.toLocaleString()}/{characterLimit.toLocaleString()} characters</span>
                {characterCount > characterLimit * 0.9 && (
                  <Badge variant="outline" className="text-xs border-warning text-warning">
                    Approaching limit
                  </Badge>
                )}
              </>
            )}
          </div>
          
          {autoSave && lastSaved && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Save className="h-3 w-3" />
              <span>Auto-saved {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="bg-background">
        {isPreview ? (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Preview Mode</span>
            </div>
            <RichTextDisplay content={editor.getHTML()} />
          </div>
        ) : (
          <EditorContent 
            editor={editor} 
            className="bg-background"
          />
        )}
      </div>

      {/* Content Guidelines */}
      <div className="border-t bg-muted/30 p-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <div><strong>Professional Content Guidelines:</strong></div>
          <div>• Use headings (H1-H3) to structure content sections</div>
          <div>• Create bullet points for key features and benefits</div>
          <div>• Insert tables for financial metrics and comparisons</div>
          <div>• Add horizontal rules to separate major sections</div>
          <div>• <strong>Keyboard shortcuts:</strong> Ctrl/Cmd+B (bold), Ctrl/Cmd+I (italic)</div>
        </div>
      </div>
    </div>
  );
}