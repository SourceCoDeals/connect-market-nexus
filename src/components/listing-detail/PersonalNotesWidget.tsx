import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface PersonalNotesWidgetProps {
  listingId: string;
}

interface PersonalNote {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const PersonalNotesWidget: React.FC<PersonalNotesWidgetProps> = ({ listingId }) => {
  const [note, setNote] = useState<PersonalNote | null>(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadNote();
    }
  }, [listingId, user]);

  const loadNote = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('listing_personal_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      if (data) {
        setNote(data);
        setContent(data.content || '');
      }
    } catch (error) {
      console.error('Error loading note:', error);
      toast({
        title: "Error loading notes",
        description: "Could not load your personal notes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async () => {
    if (!user || !content.trim()) return;
    
    setIsSaving(true);
    try {
      const noteData = {
        user_id: user.id,
        listing_id: listingId,
        content: content.trim(),
      };

      const { data, error } = await supabase
        .from('listing_personal_notes')
        .upsert(noteData, { 
          onConflict: 'user_id,listing_id' 
        })
        .select()
        .single();

      if (error) throw error;

      setNote(data);
      toast({
        title: "Notes saved",
        description: "Your investment notes have been saved.",
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

  const handleDelete = async () => {
    if (!user || !note) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('listing_personal_notes')
        .delete()
        .eq('id', note.id);

      if (error) throw error;

      setNote(null);
      setContent('');
      toast({
        title: "Notes deleted",
        description: "Your personal notes have been removed.",
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error deleting notes",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="border border-sourceco-form bg-white rounded-lg">
      <div className="p-4 border-b border-slate-100">
        <h3 className="document-label">Private Investment Notes</h3>
      </div>
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="py-6">
            <LoadingSpinner size="sm" variant="inline" showMessage message="Loading notes..." />
          </div>
        ) : (
          <>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add your private due diligence notes, investment thesis, follow-up items..."
              className="min-h-[100px] text-xs border-slate-200 focus:border-slate-400 resize-none"
            />

            <div className="flex gap-2">
              <Button
                onClick={saveNote}
                disabled={isSaving || !content.trim()}
                className="flex-1 text-xs h-8"
                variant="outline"
              >
                {isSaving ? 'Saving...' : 'Save Notes'}
              </Button>
              
              {note && (
                <Button
                  onClick={handleDelete}
                  disabled={isSaving}
                  variant="outline"
                  className="text-xs h-8 text-red-600 hover:text-red-700"
                >
                  Delete
                </Button>
              )}
            </div>

            {note && (
              <div className="text-xs text-slate-500 pt-1">
                Last updated: {new Date(note.updated_at).toLocaleString()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};