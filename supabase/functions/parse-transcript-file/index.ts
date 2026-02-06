import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { ANTHROPIC_API_URL, getAnthropicHeaders, DEFAULT_CLAUDE_FAST_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      const base64Content = base64Encode(new Uint8Array(arrayBuffer));
      
      let mimeType = 'application/pdf';
      if (fileName.endsWith('.docx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileName.endsWith('.doc')) {
        mimeType = 'application/msword';
      }
      
      console.log(`Document file, size: ${arrayBuffer.byteLength} bytes, mime: ${mimeType}`);
      
      const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (!anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const makeRequest = () =>
        fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: getAnthropicHeaders(anthropicApiKey),
          body: JSON.stringify({
            model: DEFAULT_CLAUDE_FAST_MODEL,
            max_tokens: 16000,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: {
                      type: 'base64',
                      media_type: mimeType,
                      data: base64Content,
                    },
                  },
                  {
                    type: 'text',
                    text: 'Extract ALL text content from this document. Return ONLY the extracted text, preserving structure. No commentary.',
                  },
                ],
              },
            ],
          }),
        });

      // Retry on 429s with exponential backoff (up to 5 attempts)
      let aiResponse: Response | null = null;
      let lastErrorText = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        aiResponse = await makeRequest();
        if (aiResponse.ok) break;

        lastErrorText = await aiResponse.text();
        console.error(`Claude API error (attempt ${attempt + 1}/5):`, lastErrorText);

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
      extractedText = aiData.content?.[0]?.text || '';
      console.log(`Document text extracted via Claude Haiku, length: ${extractedText.length}`);
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