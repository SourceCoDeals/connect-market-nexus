/**
 * MemoEditor: Rich text editor for lead memo section-by-section editing
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';
import { LeadMemo, useUpdateMemo } from '@/hooks/admin/data-room/use-data-room';

interface MemoSection {
  key: string;
  title: string;
  content: string;
}

interface MemoEditorProps {
  memo: LeadMemo;
  dealId: string;
  onClose: () => void;
}

export function MemoEditor({ memo, dealId, onClose }: MemoEditorProps) {
  const updateMemo = useUpdateMemo();

  const initialSections = (memo.content as any)?.sections || [];
  const [sections, setSections] = useState<MemoSection[]>(initialSections);

  const handleSectionChange = useCallback((index: number, field: 'title' | 'content', value: string) => {
    setSections(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleAddSection = useCallback(() => {
    setSections(prev => [
      ...prev,
      { key: `custom_${Date.now()}`, title: 'New Section', content: '' },
    ]);
  }, []);

  const handleRemoveSection = useCallback((index: number) => {
    setSections(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveSection = useCallback((index: number, direction: 'up' | 'down') => {
    setSections(prev => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const handleSave = () => {
    const content = {
      ...((memo.content as any) || {}),
      sections,
    };

    // Generate HTML from sections
    const htmlContent = sections
      .map(s => `<h2>${s.title}</h2><div>${s.content.replace(/\n/g, '<br>')}</div>`)
      .join('');

    updateMemo.mutate({
      memoId: memo.id,
      content,
      htmlContent,
      dealId,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h3 className="font-medium">
            Edit {memo.memo_type === 'anonymous_teaser' ? 'Anonymous Teaser' : 'Full Lead Memo'}
            <span className="text-sm text-muted-foreground ml-2">v{memo.version}</span>
          </h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMemo.isPending}>
            {updateMemo.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, index) => (
        <Card key={section.key || index}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <Input
                value={section.title}
                onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                className="font-medium text-base border-none shadow-none px-0 h-auto focus-visible:ring-0"
                placeholder="Section title"
              />
              <div className="flex gap-1 ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleMoveSection(index, 'up')}
                  disabled={index === 0}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleMoveSection(index, 'down')}
                  disabled={index === sections.length - 1}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleRemoveSection(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={section.content}
              onChange={(e) => handleSectionChange(index, 'content', e.target.value)}
              className="min-h-[120px] resize-y"
              placeholder="Section content..."
            />
          </CardContent>
        </Card>
      ))}

      {/* Add Section */}
      <Button variant="outline" className="w-full" onClick={handleAddSection}>
        <Plus className="mr-2 h-4 w-4" />
        Add Section
      </Button>
    </div>
  );
}
