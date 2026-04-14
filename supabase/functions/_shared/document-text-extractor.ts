/**
 * Document text extraction utility
 *
 * Extracts text content from uploaded data room files.
 *
 * Strategy by file type:
 *   - PDF / JPEG / PNG → Gemini 2.0 Flash (vision model, supports inline_data)
 *   - DOCX / XLSX / PPTX → Local ZIP+XML parsing via jszip (NO AI)
 *   - CSV / plain text → Read directly, no AI
 *
 * The previous version sent DOCX/XLSX/PPTX to Gemini via inline_data, but
 * Gemini only supports PDF, images, and text through that API. Office files
 * silently returned unsupported-format errors and text_content stayed NULL —
 * meaning every Word/Excel/PowerPoint upload was invisible to the enrichment
 * pipeline. This is the fix for BUG #2 in the April 2026 deep audit.
 *
 * Used by:
 * - data-room-upload (extract text on upload)
 * - enrich-deal (ensure data room text is available)
 */

// deno-lint-ignore-file no-explicit-any
// @ts-expect-error — esm.sh import for Deno runtime; Node tests re-implement
// the parsing functions separately, so this import is never evaluated there.
import JSZip from 'https://esm.sh/jszip@3.10.1';

const BUCKET_NAME = 'deal-data-rooms';

// Max file size for AI extraction (20MB — Gemini inline_data limit)
const MAX_EXTRACTION_SIZE = 20 * 1024 * 1024;

// File types that can have text extracted
const EXTRACTABLE_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
]);

// File types we can read as plain text directly
const PLAIN_TEXT_TYPES = new Set(['text/csv', 'text/plain']);

// File types handled locally via jszip
const OFFICE_ZIP_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// File types routed to Gemini
const GEMINI_INLINE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export function isExtractableType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return EXTRACTABLE_TYPES.has(mimeType);
}

/**
 * Convert an ArrayBuffer to base64 in chunks to avoid stack overflow
 * on large files (the naive String.fromCharCode spread approach fails above ~2MB).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// ============================================================================
// XML text extraction helpers (shared by DOCX/XLSX/PPTX)
// ============================================================================

/**
 * Strip XML tags and return unescaped text content.
 *
 * Used for extracting text from the result of regex-captured `<w:t>`-style
 * content. This is deliberately simple and NOT a full XML parser — it only
 * needs to handle the output of Office's XML writer, which is well-formed
 * and uses a small set of entities.
 */
export function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, '') // drop all tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * Extract text from Word document XML (`word/document.xml`).
 *
 * Word stores runs as:
 *   <w:p>
 *     <w:r><w:t>Hello </w:t></w:r>
 *     <w:r><w:t xml:space="preserve">world</w:t></w:r>
 *   </w:p>
 *
 * We collapse each <w:p> into a paragraph, then join with newlines. Tables
 * use <w:tbl> with <w:tr> rows — we treat each cell as a line and each row
 * separated by newline, which produces readable text.
 */
export function extractDocxText(xml: string): string {
  if (!xml) return '';

  const paragraphs: string[] = [];
  // Match <w:p>...</w:p> blocks (paragraphs)
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const inner = match[1];
    // Extract all <w:t>...</w:t> inside the paragraph
    const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const runs: string[] = [];
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(inner)) !== null) {
      runs.push(stripXmlTags(textMatch[1]));
    }
    // Paragraphs with <w:tab/> should show as tabs
    const paragraph = runs.join('').trim();
    if (paragraph.length > 0) {
      paragraphs.push(paragraph);
    }
  }

  return paragraphs.join('\n');
}

/**
 * Extract text from Excel `xl/sharedStrings.xml`.
 *
 * Shared strings are stored as:
 *   <si><t>Hello</t></si>
 *   <si><r><t>styled</t></r><r><t> text</t></r></si>
 *
 * Returns an array indexed the same way Excel references them.
 */
export function extractXlsxSharedStrings(xml: string): string[] {
  if (!xml) return [];

  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml)) !== null) {
    const inner = match[1];
    // Grab all <t>...</t> inside (handles both plain and rich-text variants)
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    const parts: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(inner)) !== null) {
      parts.push(stripXmlTags(tMatch[1]));
    }
    strings.push(parts.join(''));
  }

  return strings;
}

/**
 * Extract values from an Excel sheet XML (`xl/worksheets/sheet1.xml`).
 *
 * Cells look like:
 *   <c r="A1" t="s"><v>0</v></c>              — shared string, index 0
 *   <c r="B1" t="n"><v>42</v></c>             — number
 *   <c r="C1" t="inlineStr"><is><t>X</t></is></c>  — inline string
 *
 * Returns rows as arrays of cell strings, separated by newline.
 */
export function extractXlsxSheetRows(xml: string, sharedStrings: string[]): string[][] {
  if (!xml) return [];

  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const cellType = typeMatch ? typeMatch[1] : 'n';

      if (cellType === 's') {
        // Shared string reference
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) {
          const idx = parseInt(stripXmlTags(vMatch[1]), 10);
          if (!isNaN(idx) && sharedStrings[idx] !== undefined) {
            cells.push(sharedStrings[idx]);
          } else {
            cells.push('');
          }
        } else {
          cells.push('');
        }
      } else if (cellType === 'inlineStr') {
        const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        cells.push(tMatch ? stripXmlTags(tMatch[1]) : '');
      } else {
        // Numeric / date / bool — read the <v> verbatim
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        cells.push(vMatch ? stripXmlTags(vMatch[1]) : '');
      }
    }
    // Skip totally empty rows
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Extract text from a PowerPoint slide XML (`ppt/slides/slideN.xml`).
 *
 * Slides use <a:t> for text runs and <a:p> for paragraphs.
 */
export function extractPptxSlideText(xml: string): string {
  if (!xml) return '';

  const paragraphs: string[] = [];
  const paraRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paraRegex.exec(xml)) !== null) {
    const inner = match[1];
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    const runs: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(inner)) !== null) {
      runs.push(stripXmlTags(tMatch[1]));
    }
    const paragraph = runs.join('').trim();
    if (paragraph.length > 0) paragraphs.push(paragraph);
  }

  return paragraphs.join('\n');
}

// ============================================================================
// Office file extraction (DOCX / XLSX / PPTX)
// ============================================================================

/**
 * Extract all text content from a DOCX/XLSX/PPTX file.
 *
 * Opens the file as a ZIP archive and parses the relevant XML members.
 * Returns plain text with structure preserved (paragraphs, rows, slide order).
 */
export async function extractOfficeFileText(
  arrayBuffer: ArrayBuffer,
  fileType: string,
): Promise<{ text: string | null; error?: string }> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    if (fileType.includes('wordprocessingml')) {
      // DOCX
      const documentFile = zip.file('word/document.xml');
      if (!documentFile) {
        return { text: null, error: 'DOCX missing word/document.xml' };
      }
      const xml = await documentFile.async('string');
      const text = extractDocxText(xml);
      return text.length > 0 ? { text } : { text: null, error: 'DOCX contained no text runs' };
    }

    if (fileType.includes('spreadsheetml')) {
      // XLSX
      const sharedStringsFile = zip.file('xl/sharedStrings.xml');
      let sharedStrings: string[] = [];
      if (sharedStringsFile) {
        const ssXml = await sharedStringsFile.async('string');
        sharedStrings = extractXlsxSharedStrings(ssXml);
      }

      // Find all sheets. They're named xl/worksheets/sheet1.xml, sheet2.xml, etc.
      const sheetFiles = Object.keys(zip.files)
        .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
        .sort((a, b) => {
          const ai = parseInt(a.match(/sheet(\d+)/)?.[1] || '0', 10);
          const bi = parseInt(b.match(/sheet(\d+)/)?.[1] || '0', 10);
          return ai - bi;
        });

      if (sheetFiles.length === 0) {
        return { text: null, error: 'XLSX contains no sheets' };
      }

      const sheetTexts: string[] = [];
      for (const sheetName of sheetFiles) {
        const sheetFile = zip.file(sheetName);
        if (!sheetFile) continue;
        const sheetXml = await sheetFile.async('string');
        const rows = extractXlsxSheetRows(sheetXml, sharedStrings);
        if (rows.length === 0) continue;
        const sheetIdx = sheetName.match(/sheet(\d+)/)?.[1] || '?';
        sheetTexts.push(`--- Sheet ${sheetIdx} ---`);
        for (const row of rows) {
          sheetTexts.push(row.join('\t'));
        }
      }

      if (sheetTexts.length === 0) {
        return { text: null, error: 'XLSX contained no cell data' };
      }
      return { text: sheetTexts.join('\n') };
    }

    if (fileType.includes('presentationml')) {
      // PPTX
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const ai = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
          const bi = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
          return ai - bi;
        });

      if (slideFiles.length === 0) {
        return { text: null, error: 'PPTX contains no slides' };
      }

      const slideTexts: string[] = [];
      for (const slideName of slideFiles) {
        const slideFile = zip.file(slideName);
        if (!slideFile) continue;
        const slideXml = await slideFile.async('string');
        const slideText = extractPptxSlideText(slideXml);
        if (slideText.length > 0) {
          const slideIdx = slideName.match(/slide(\d+)/)?.[1] || '?';
          slideTexts.push(`--- Slide ${slideIdx} ---\n${slideText}`);
        }
      }

      if (slideTexts.length === 0) {
        return { text: null, error: 'PPTX contained no text in slides' };
      }
      return { text: slideTexts.join('\n\n') };
    }

    return { text: null, error: `Unsupported Office file type: ${fileType}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: null, error: `Failed to parse Office file: ${message}` };
  }
}

// ============================================================================
// Top-level extraction entry points
// ============================================================================

/**
 * Extract text from a file stored in Supabase storage.
 *
 * Routing:
 *   - CSV / plain text → direct read, no AI
 *   - DOCX / XLSX / PPTX → local jszip parser
 *   - PDF / JPEG / PNG → Gemini 2.0 Flash via inline_data
 */
export async function extractTextFromDocument(
  supabase: {
    storage: {
      from: (bucket: string) => {
        download: (path: string) => Promise<{ data: Blob | null; error: unknown }>;
      };
    };
  },
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

    // Plain text files: direct read
    if (PLAIN_TEXT_TYPES.has(fileType)) {
      const text = await fileData.text();
      return { text: text.substring(0, 100_000) };
    }

    // Size check before loading into memory
    const arrayBuffer = await fileData.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_EXTRACTION_SIZE) {
      return {
        text: null,
        error: `File too large for extraction (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB, max ${MAX_EXTRACTION_SIZE / 1024 / 1024}MB)`,
      };
    }

    // Office files: local jszip parsing
    if (OFFICE_ZIP_TYPES.has(fileType)) {
      const result = await extractOfficeFileText(arrayBuffer, fileType);
      if (result.text) {
        // Cap at 100K chars
        return { text: result.text.substring(0, 100_000) };
      }
      return result;
    }

    // PDF / images: route to Gemini
    if (GEMINI_INLINE_TYPES.has(fileType)) {
      return await extractViaGemini(arrayBuffer, fileType, geminiApiKey);
    }

    return { text: null, error: `Unsupported file type for extraction: ${fileType}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: null, error: `Text extraction failed: ${message}` };
  }
}

async function extractViaGemini(
  arrayBuffer: ArrayBuffer,
  fileType: string,
  geminiApiKey: string,
): Promise<{ text: string | null; error?: string }> {
  if (!geminiApiKey) {
    return { text: null, error: 'Gemini API key not configured' };
  }
  const base64 = arrayBufferToBase64(arrayBuffer);

  const extractionPrompt = `Extract ALL text content from this document. Return the complete text faithfully, preserving structure (headings, bullet points, tables as text). Do not summarize or interpret — just extract the raw text content. If the document contains tables, format them as readable text with clear column headers. If there are multiple pages or sections, include all of them.`;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      geminiApiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: fileType,
                  data: base64,
                },
              },
              { text: extractionPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 32768,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    return {
      text: null,
      error: `Gemini extraction failed (${response.status}): ${errText.substring(0, 200)}`,
    };
  }

  const result = await response.json();
  const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!extractedText) {
    return { text: null, error: 'No text returned from Gemini extraction' };
  }

  return { text: extractedText.substring(0, 100_000) };
}

/**
 * Extract text from a document and store it in the data_room_documents record.
 * Used during upload and as a fallback during enrichment.
 *
 * Writes both text_content (on success) AND text_extraction_error (on failure).
 * Previously only success was written — failures were silent.
 */
export async function extractAndStoreDocumentText(
  supabase: {
    storage: {
      from: (bucket: string) => {
        download: (path: string) => Promise<{ data: Blob | null; error: unknown }>;
      };
    };
    from: (table: string) => {
      update: (data: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>;
      };
    };
  },
  documentId: string,
  storagePath: string,
  fileType: string,
  geminiApiKey: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isExtractableType(fileType)) {
    const errorMsg = `File type not supported for text extraction: ${fileType}`;
    // Record the error on the document so it's visible in the UI
    await supabase
      .from('data_room_documents')
      .update({ text_extraction_error: errorMsg })
      .eq('id', documentId);
    return { success: false, error: errorMsg };
  }

  const { text, error } = await extractTextFromDocument(
    supabase,
    storagePath,
    fileType,
    geminiApiKey,
  );

  if (error || !text) {
    console.warn(`[extract-doc-text] Failed for ${documentId}: ${error}`);
    // Write the error to the row so operators can see why it failed.
    await supabase
      .from('data_room_documents')
      .update({
        text_extraction_error: error || 'Unknown extraction error',
      })
      .eq('id', documentId);
    return { success: false, error };
  }

  const { error: updateError } = await supabase
    .from('data_room_documents')
    .update({
      text_content: text,
      text_extracted_at: new Date().toISOString(),
      text_extraction_error: null, // clear any previous error
    })
    .eq('id', documentId);

  if (updateError) {
    console.error(`[extract-doc-text] DB update failed for ${documentId}:`, updateError);
    return { success: false, error: `DB update failed: ${updateError}` };
  }

  console.log(`[extract-doc-text] Extracted ${text.length} chars for document ${documentId}`);
  return { success: true };
}
