import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StickyNote, Tag, Star, AlertCircle, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  { value: 'high-potential', label: 'High Potential', color: 'bg-green-100 text-green-800' },
  { value: 'watch-list', label: 'Watch List', color: 'bg-blue-100 text-blue-800' },
  { value: 'due-diligence', label: 'Due Diligence', color: 'bg-purple-100 text-purple-800' },
  { value: 'follow-up', label: 'Follow Up', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'red-flag', label: 'Red Flag', color: 'bg-red-100 text-red-800' },
  { value: 'financial-review', label: 'Financial Review', color: 'bg-orange-100 text-orange-800' },
];

export const PersonalNotesWidget: React.FC<PersonalNotesWidgetProps> = ({ listingId }) => {
  const [note, setNote] = useState<PersonalNote | null>(null);
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadNote();
    }
  }, [listingId, user]);

  const loadNote = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('listing_personal_notes')
        .select('*')
        .eq('listing_id', listingId)
        .eq('user_id', user?.id)
        .single();

      if (data) {
        setNote(data);
        setContent(data.content || '');
        setSelectedTags(data.tags || []);
        setRating(data.rating || 0);
      }
    } catch (error) {
      // Note doesn't exist yet, which is fine
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const noteData = {
        listing_id: listingId,
        user_id: user.id,
        content,
        tags: selectedTags,
        rating,
        updated_at: new Date().toISOString()
      };

      if (note) {
        const { error } = await supabase
          .from('listing_personal_notes')
          .update(noteData)
          .eq('id', note.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('listing_personal_notes')
          .insert({
            ...noteData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        setNote(data);
      }

      toast({
        title: "Notes saved",
        description: "Your personal notes have been saved successfully.",
      });
    } catch (error) {
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
      </CardContent>
    </Card>
  );
};