import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
serve(
  async () =>
    new Response(JSON.stringify({ message: 'deprecated' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
);
