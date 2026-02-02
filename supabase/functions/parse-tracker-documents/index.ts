import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_url, document_type, tracker_id } = await req.json();

    console.log("[parse-tracker-documents] Processing:", {
      document_type,
      tracker_id,
    });

    // Fetch document content
    const docResponse = await fetch(document_url);
    if (!docResponse.ok) {
      throw new Error(\`Failed to fetch document: \${docResponse.statusText}\`);
    }

    const docBuffer = await docResponse.arrayBuffer();
    const base64Doc = btoa(String.fromCharCode(...new Uint8Array(docBuffer)));

    // Analyze with Claude Sonnet 4 (supports PDF)
    const system_prompt = \`You are a document analysis assistant specialized in analyzing M&A documents.

Your task is to extract key information from documents such as:
- CIMs (Confidential Information Memorandums)
- Investment presentations
- Company profiles
- Deal teaser documents

Extract and structure:
1. Company overview and business description
2. Financial information (revenue, EBITDA, margins)
3. Geographic footprint and locations
4. Services/products offered
5. Growth metrics and trends
6. Key risks and opportunities
7. Target buyer profile hints

Return a JSON object with the extracted information.\`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: system_prompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Doc,
              },
            },
            {
              type: "text",
              text: "Please analyze this document and extract all relevant M&A intelligence information. Return the extracted data as a structured JSON object.",
            },
          ],
        },
      ],
    });

    const assistant_message = response.content[0].type === "text"
      ? response.content[0].text
      : "";

    // Parse JSON from response
    let extracted_data = {};
    try {
      const jsonMatch = assistant_message.match(/\\{[\\s\\S]*\\}/);
      if (jsonMatch) {
        extracted_data = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("[parse-tracker-documents] Could not parse JSON from response");
      extracted_data = { raw_text: assistant_message };
    }

    console.log("[parse-tracker-documents] Extracted data successfully");

    return new Response(
      JSON.stringify({
        extracted_data,
        raw_response: assistant_message,
        usage: response.usage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[parse-tracker-documents] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
