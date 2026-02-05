import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getGeminiNativeUrl, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

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
      
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      // Use native Gemini API which supports document processing
      const nativeUrl = getGeminiNativeUrl(DEFAULT_GEMINI_MODEL, geminiApiKey);
      
      const aiResponse = await fetch(nativeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract ALL text content from this document. Return ONLY the extracted text, preserving structure. No commentary.' },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Content
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16000,
          }
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Gemini API error:', errorText);
        throw new Error(`Failed to process document: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      extractedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`Document text extracted via Gemini, length: ${extractedText.length}`);
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