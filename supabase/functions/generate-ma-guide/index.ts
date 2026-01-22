import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { universe_name, fit_criteria, existing_content } = await req.json();

    if (!fit_criteria) {
      return new Response(
        JSON.stringify({ error: 'fit_criteria is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Generating MA Guide for: ${universe_name || 'unnamed universe'}`);

    const systemPrompt = `You are an expert M&A advisor creating professional deal documentation. 
Generate a comprehensive M&A Guide based on the buyer universe criteria provided.
The guide should be practical, actionable, and formatted in clean HTML.
Use proper heading structure (h2, h3), bullet points, and organized sections.`;

    const userPrompt = `Create an M&A Guide for the following buyer universe:

UNIVERSE NAME: ${universe_name || 'Buyer Universe'}

FIT CRITERIA:
${fit_criteria}

${existing_content ? `EXISTING CONTENT TO ENHANCE:
${existing_content}` : ''}

Generate a professional M&A Guide with these sections:
1. Investment Overview - Key thesis points and target profile
2. Ideal Target Characteristics - What makes a great fit
3. Deal Process - Steps from outreach to close  
4. Key Talking Points - Value drivers and selling points
5. Risk Considerations - Common concerns and mitigations
6. Buyer Engagement Strategy - How to approach and pitch

Format as clean HTML with h2/h3 headings, ul/li lists, and p tags.
Be specific based on the criteria provided.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI Gateway error:", response.status, text);
      throw new Error("Failed to generate MA Guide");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Clean up the response - remove markdown code blocks if present
    let cleanContent = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log(`Generated ${cleanContent.length} characters of MA Guide content`);

    return new Response(
      JSON.stringify({ content: cleanContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating MA Guide:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
