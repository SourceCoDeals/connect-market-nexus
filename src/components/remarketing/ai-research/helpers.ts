import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Helper to get the current session's access token for edge function calls
export const getSessionToken = async (): Promise<string> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
};

// Helper function to save guide to Supporting Documents with direct DB persistence
export const saveGuideToDocuments = async (
  content: string,
  industryName: string,
  universeId: string,
  onDocumentAdded: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void,
  onComplete?: (documentUrl: string) => void
): Promise<string | null> => {
  try {
    // 1. Call edge function to upload HTML to storage
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-guide-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getSessionToken()}`,
        },
        body: JSON.stringify({
          universeId,
          industryName,
          content
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to generate guide: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.document) {
      throw new Error(data.error || 'No document returned');
    }

    // 2. Read current documents from database
    const { data: universe, error: readError } = await supabase
      .from('remarketing_buyer_universes')
      .select('documents')
      .eq('id', universeId)
      .single();

    if (readError) {
      throw new Error(`Failed to read universe: ${readError.message}`);
    }

    // 3. Build updated documents array (replace any existing ma_guide)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentDocs = (universe?.documents as any[]) || [];
    const filteredDocs = currentDocs.filter(
      d => !d.type || d.type !== 'ma_guide'
    );
    const updatedDocs = [...filteredDocs, data.document];

    // 4. Write back to database
    const { error: updateError } = await supabase
      .from('remarketing_buyer_universes')
      .update({ documents: updatedDocs })
      .eq('id', universeId);

    if (updateError) {
      throw new Error(`Failed to save document: ${updateError.message}`);
    }

    // 5. Update local state for immediate UI feedback
    onDocumentAdded(data.document);

    // 6. Call completion callback with document URL
    if (onComplete) {
      onComplete(data.document.url);
    }

    return data.document.url;

  } catch (error) {
    toast.error(`Failed to save guide: ${(error as Error).message}`);
    return null;
  }
};
