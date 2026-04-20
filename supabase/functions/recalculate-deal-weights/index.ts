// Stub — this function was removed but the directory remained.
// Kept as a no-op to prevent deploy failures.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  return new Response(JSON.stringify({ message: 'deprecated' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
