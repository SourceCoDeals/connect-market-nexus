import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AIResearchSectionProps } from "./types";

export function useGuideUpload({
  universeId,
  onGuideGenerated,
  onDocumentAdded,
}: Pick<AIResearchSectionProps, 'universeId' | 'onGuideGenerated' | 'onDocumentAdded'>) {
  const guideFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingGuide, setIsUploadingGuide] = useState(false);

  const handleUploadGuide = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !universeId) return;

    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.html', '.htm'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      toast.error('Please upload a PDF, Word, text, or HTML file');
      return;
    }

    setIsUploadingGuide(true);
    try {
      // 1. Upload to storage
      const fileName = `${universeId}/guides/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('universe-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from('universe-documents')
        .getPublicUrl(fileName);

      // 2. Build document entry with ma_guide type
      const guideDoc = {
        id: crypto.randomUUID(),
        name: file.name,
        url: urlData.publicUrl,
        uploaded_at: new Date().toISOString(),
        type: 'ma_guide',
      };

      // 3. Read current docs, replace any existing ma_guide, add new one
      const { data: universe, error: readError } = await supabase
        .from('remarketing_buyer_universes')
        .select('documents, ma_guide_content')
        .eq('id', universeId)
        .single();

      if (readError) throw readError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentDocs = (universe?.documents as any[]) || [];
      const filteredDocs = currentDocs.filter((d: { type?: string }) => !d.type || d.type !== 'ma_guide');
      const updatedDocs = [...filteredDocs, guideDoc];

      // 4. Save to database
      const { error: updateError } = await supabase
        .from('remarketing_buyer_universes')
        .update({
          documents: updatedDocs,
          ma_guide_content: `[Uploaded Guide: ${file.name}]`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', universeId);

      if (updateError) throw updateError;

      // 5. Update local state
      if (onDocumentAdded) {
        onDocumentAdded(guideDoc);
      }
      onGuideGenerated(`[Uploaded Guide: ${file.name}]`, {});

      toast.success(`Guide "${file.name}" uploaded successfully. Use "Enrich from Documents" or "Extract from Guide" to pull criteria.`);
    } catch (err) {
      toast.error(`Failed to upload guide: ${(err as Error).message}`);
    } finally {
      setIsUploadingGuide(false);
      if (guideFileInputRef.current) guideFileInputRef.current.value = '';
    }
  };

  return {
    guideFileInputRef,
    isUploadingGuide,
    handleUploadGuide,
  };
}
