import { useState } from "react";
import { Transcript } from "./types";

export function useExtractionHandlers(
  transcripts: Transcript[],
  extractTranscriptMutation: {
    mutateAsync: (params: { transcriptId: string }) => Promise<unknown>;
    isPending: boolean;
  },
) {
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number; isRunning: boolean }>({ current: 0, total: 0, isRunning: false });
  const [extractionSummary, setExtractionSummary] = useState<{
    open: boolean;
    results: Array<{ fileName?: string; insights?: Record<string, unknown>; error?: string }>;
    totalCount: number;
    successCount: number;
    errorCount: number;
  }>({ open: false, results: [], totalCount: 0, successCount: 0, errorCount: 0 });

  const handleExtractAll = async () => {
    if (transcripts.length === 0) return;

    setExtractionProgress({ current: 0, total: transcripts.length, isRunning: true });
    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ fileName?: string; insights?: Record<string, unknown>; error?: string }> = [];

    for (let i = 0; i < transcripts.length; i++) {
      try {
        const data = await extractTranscriptMutation.mutateAsync({ transcriptId: transcripts[i].id }) as { insights?: { buyer?: Record<string, unknown> } } | null;
        successCount++;
        results.push({ fileName: transcripts[i].file_name || `Transcript ${i + 1}`, insights: data?.insights?.buyer });
      } catch (e: unknown) {
        // Extraction failed — tracked in results
        errorCount++;
        results.push({ fileName: transcripts[i].file_name || `Transcript ${i + 1}`, error: e instanceof Error ? e.message : 'Failed' });
      }
      setExtractionProgress({ current: i + 1, total: transcripts.length, isRunning: i < transcripts.length - 1 });
    }

    setExtractionProgress(prev => ({ ...prev, isRunning: false }));
    setExtractionSummary({ open: true, results, totalCount: transcripts.length, successCount, errorCount });
  };

  const handleSingleExtractWithSummary = async (transcriptId: string) => {
    try {
      const transcript = transcripts.find(t => t.id === transcriptId);
      const data = await extractTranscriptMutation.mutateAsync({ transcriptId }) as { insights?: { buyer?: Record<string, unknown> } } | null;
      setExtractionSummary({
        open: true,
        results: [{ fileName: transcript?.file_name || 'Transcript', insights: data?.insights?.buyer }],
        totalCount: 1,
        successCount: 1,
        errorCount: 0,
      });
    } catch (e: unknown) {
      const transcript = transcripts.find(t => t.id === transcriptId);
      setExtractionSummary({
        open: true,
        results: [{ fileName: transcript?.file_name || 'Transcript', error: e instanceof Error ? e.message : 'Failed' }],
        totalCount: 1,
        successCount: 0,
        errorCount: 1,
      });
    }
  };

  return {
    extractionProgress,
    extractionSummary,
    setExtractionSummary,
    handleExtractAll,
    handleSingleExtractWithSummary,
  };
}
