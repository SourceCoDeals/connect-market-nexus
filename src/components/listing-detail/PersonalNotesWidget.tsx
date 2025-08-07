import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StickyNote, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

interface PersonalNotesWidgetProps {
  listingId: string;
}

interface PersonalNote {
  id: string;
  content: string;
  tags: string[];
  rating: number;
  created_at: string;
  updated_at: string;
}

const tagOptions = [
  { value: 'high-potential', label: 'High Potential' },
  { value: 'watch-list', label: 'Watch List' },
  { value: 'due-diligence', label: 'Due Diligence' },
  { value: 'follow-up', label: 'Follow Up' },
  { value: 'red-flag', label: 'Red Flag' },
  { value: 'financial-review', label: 'Financial Review' },
];

export const PersonalNotesWidget: React.FC<PersonalNotesWidgetProps> = ({ listingId }) => {
  const [note, setNote] = useState<PersonalNote | null>(null);
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadNote();
    }
  }, [listingId, user]);

  const getStorageKey = () => `personal_note_${user?.id}_${listingId}`;

  const loadNote = () => {
    if (!user) return;
    
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const noteData = JSON.parse(stored) as PersonalNote;
        setNote(noteData);
        setContent(noteData.content);
        setSelectedTags(noteData.tags);
        setRating(noteData.rating);
      }
    } catch (error) {
      console.error('Error loading note:', error);
    }
  };

  const saveNote = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const noteData: PersonalNote = {
        id: note?.id || crypto.randomUUID(),
        content,
        tags: selectedTags,
        rating,
        created_at: note?.created_at || now,
        updated_at: now
      };

      // Save to localStorage temporarily
      localStorage.setItem(getStorageKey(), JSON.stringify(noteData));
      setNote(noteData);

      toast({
        title: "Notes saved",
        description: "Your personal notes have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Error saving notes",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tagValue: string) => {
    setSelectedTags(prev => 
      prev.includes(tagValue) 
        ? prev.filter(t => t !== tagValue)
        : [...prev, tagValue]
    );
  };

  if (!user) return null;

  return (
    <Card className="border-sourceco-form bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-sourceco-text flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Personal Investment Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating */}
        <div>
          <label className="text-xs font-medium text-sourceco-text/70 mb-2 block">
            Investment Rating
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="text-lg hover:scale-110 transition-transform"
              >
                <Star 
                  className={`h-4 w-4 ${
                    star <= rating 
                      ? 'fill-[#d7b65c] text-[#d7b65c]' 
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-sourceco-text/70 mb-2 block">
            Investment Tags
          </label>
          <div className="flex flex-wrap gap-1">
            {tagOptions.map((tag) => (
              <Badge
                key={tag.value}
                variant={selectedTags.includes(tag.value) ? "default" : "outline"}
                className={`text-xs cursor-pointer transition-colors ${
                  selectedTags.includes(tag.value) 
                    ? 'bg-[#d7b65c] text-white hover:bg-[#d7b65c]/90' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleTag(tag.value)}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-sourceco-text/70 mb-2 block">
            Private Notes
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add your private investment notes, due diligence thoughts, or follow-up items..."
            className="text-sm min-h-[80px] resize-none"
          />
        </div>

        <Button
          onClick={saveNote}
          disabled={isSaving}
          className="w-full bg-[#d7b65c] hover:bg-[#d7b65c]/90 text-white text-xs"
        >
          {isSaving ? 'Saving...' : 'Save Notes'}
        </Button>

        {note && (
          <div className="text-xs text-gray-500 text-center">
            Last updated: {new Date(note.updated_at).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};