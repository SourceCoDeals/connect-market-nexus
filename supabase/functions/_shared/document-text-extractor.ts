/**
 * Document text extraction utility
 *
 * Extracts text content from uploaded data room files using AI (Gemini)
 * for document understanding. Supports PDF, DOCX, images, and CSV files.
 *
 * Used by:
 * - data-room-upload (extract text on upload)
 * - enrich-deal (ensure data room text is available)
 */

import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from './ai-providers.ts';

const BUCKET_NAME = 'deal-data-rooms';

// File types that can have text extracted
const EXTRACTABLE_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
]);

// File types we can read as plain text directly
const PLAIN_TEXT_TYPES = new Set([
  'text/csv',
]);

export function isExtractableType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return EXTRACTABLE_TYPES.has(mimeType);
}

/**
 * Extract text from a file stored in Supabase storage.
 *
 * For CSV files: reads directly as text.
 * For PDF/DOCX/images: uses Gemini's multimodal capabilities for extraction.
 */
export async function extractTextFromDocument(
  supabase: { storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  storagePath: string,
  fileType: string,
  geminiApiKey: string,
): Promise<{ text: string | null; error?: string }> {
  try {
    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (downloadError || !fileData) {
      return { text: null, error: `Failed to download file: ${downloadError}` };
    }

    // For plain text files, read directly
    if (PLAIN_TEXT_TYPES.has(fileType)) {
      const text = await fileData.text();
      return { text: text.substring(0, 100_000) }; // Cap at 100K chars
    }

    // For binary files (PDF, DOCX, images), use Gemini for extraction
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    );

    // Map MIME types to Gemini-compatible types
    const geminiMimeType = mapToGeminiMimeType(fileType);
    if (!geminiMimeType) {
      return { text: null, error: `Unsupported file type for AI extraction: ${fileType}` };
    }

    const extractionPrompt = `Extract ALL text content from this document. Return the complete text faithfully, preserving structure (headings, bullet points, tables as text). Do not summarize or interpret — just extract the raw text content. If the document contains tables, format them as readable text with clear column headers. If there are multiple pages or sections, include all of them.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiApiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: geminiMimeType,
                    data: base64,
                  },
                },
                { text: extractionPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      return { text: null, error: `Gemini extraction failed (${response.status}): ${errText.substring(0, 200)}` };
    }

    const result = await response.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedText) {
      return { text: null, error: 'No text returned from AI extraction' };
    }

    // Cap at 100K characters
    return { text: extractedText.substring(0, 100_000) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: null, error: `Text extraction failed: ${message}` };
  }
}

function mapToGeminiMimeType(fileType: string): string | null {
  const mapping: Record<string, string> = {
    'application/pdf': 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
  };
  return mapping[fileType] || null;
}

/**
 * Extract text from a document and store it in the data_room_documents record.
 * Used during upload and as a fallback during enrichment.
 */
export async function extractAndStoreDocumentText(
  supabase: {
    storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } };
    from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: unknown }> } };
  },
  documentId: string,
  storagePath: string,
  fileType: string,
  geminiApiKey: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isExtractableType(fileType)) {
    return { success: false, error: 'File type not supported for text extraction' };
  }

  const { text, error } = await extractTextFromDocument(supabase, storagePath, fileType, geminiApiKey);

  if (error || !text) {
    console.warn(`[extract-doc-text] Failed for ${documentId}: ${error}`);
    return { success: false, error };
  }

  const { error: updateError } = await supabase
    .from('data_room_documents')
    .update({
      text_content: text,
      text_extracted_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (updateError) {
    console.error(`[extract-doc-text] DB update failed for ${documentId}:`, updateError);
    return { success: false, error: `DB update failed: ${updateError}` };
  }

  console.log(`[extract-doc-text] Extracted ${text.length} chars for document ${documentId}`);
  return { success: true };
}
