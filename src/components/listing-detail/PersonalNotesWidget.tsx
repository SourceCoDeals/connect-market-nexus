import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { FileEdit } from 'lucide-react';

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
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_2px_8px_0_rgb(0_0_0_0.04)] hover:shadow-[0_4px_12px_0_rgb(215_182_92_0.08)] transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-medium text-slate-700 tracking-[-0.01em]">
          Investment Notes
        </h4>
        <FileEdit className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-6">
            <LoadingSpinner size="sm" variant="inline" showMessage message="Loading notes..." />
          </div>
        ) : (
          <>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add private notes..."
        disabled={isSaving}
        className="min-h-[100px] resize-none border-slate-200 focus:border-sourceco-accent focus:ring-1 focus:ring-sourceco-accent/20 text-[13px] leading-[1.6] placeholder:text-slate-400 transition-colors"
      />

            <div className="flex gap-2 pt-3">
              <Button
                onClick={saveNote}
                disabled={isSaving || !content.trim()}
                className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white font-medium text-[14px] tracking-[0.01em] transition-all duration-200 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              
              {note && (
                <Button
                  onClick={handleDelete}
                  disabled={isSaving}
                  variant="ghost"
                  className="h-10 px-4 text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-normal text-[14px] transition-all duration-200"
                >
                  Clear
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