import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { GEMINI_API_BASE } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Gemini Flash for PDF text extraction — fast, cheap, high output limits
const GEMINI_MODEL = "gemini-2.0-flash";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = file.name.toLowerCase();
    let extractedText = '';

    console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    if (fileName.endsWith('.txt') || fileName.endsWith('.vtt') || fileName.endsWith('.srt')) {
      extractedText = await file.text();
      console.log(`Text file extracted, length: ${extractedText.length}`);
    } 
    else if (fileName.endsWith('.pdf') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const base64Content = base64Encode(new Uint8Array(arrayBuffer) as unknown as ArrayBuffer);
      
      let mimeType = 'application/pdf';
      if (fileName.endsWith('.docx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileName.endsWith('.doc')) {
        mimeType = 'application/msword';
      }
      
      console.log(`Document file, size: ${arrayBuffer.byteLength} bytes, mime: ${mimeType}, model: ${GEMINI_MODEL}`);
      
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const geminiUrl = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

      const makeRequest = () =>
        fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Content,
                    },
                  },
                  {
                    text: 'Extract ALL text content from this document verbatim. This is a meeting transcript — preserve every speaker label, timestamp, and spoken word exactly as written. Return ONLY the extracted text with no commentary, no summaries, no omissions. Include every single page from start to finish.',
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 65536,
              temperature: 0,
            },
          }),
        });

      // Retry on 429s with exponential backoff (up to 5 attempts)
      let aiResponse: Response | null = null;
      let lastErrorText = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        aiResponse = await makeRequest();
        if (aiResponse.ok) break;

        lastErrorText = await aiResponse.text();
        console.error(`Gemini API error (attempt ${attempt + 1}/5):`, lastErrorText);

        if (aiResponse.status === 429 && attempt < 4) {
          const delayMs = 2000 * Math.pow(2, attempt);
          console.log(`Rate limited, retrying in ${delayMs}ms...`);
          await sleep(delayMs);
          continue;
        }
        break;
      }

      if (!aiResponse || !aiResponse.ok) {
        const status = aiResponse?.status ?? 500;

        if (status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limited by AI provider (429). Please try again shortly.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const snippet = (lastErrorText || '').slice(0, 800);
        return new Response(
          JSON.stringify({ error: `Failed to process document: ${status}`, details: snippet }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await aiResponse.json();
      
      // Extract text from Gemini native response format
      extractedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Check for truncation
      const finishReason = aiData.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        console.warn(`[TRUNCATION WARNING] Output was truncated for ${file.name}`);
      }
      
      console.log(`Document text extracted via Gemini Flash, length: ${extractedText.length}, finishReason: ${finishReason}`);
    }
    else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${fileName}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: extractedText,
        fileName: file.name,
        fileSize: file.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in parse-transcript-file:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});