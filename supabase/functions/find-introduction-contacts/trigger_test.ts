/**
 * One-time test to trigger contact discovery for Trivest Partners.
 * Run via: supabase--test_edge_functions
 */

Deno.test('Trigger contact discovery for Trivest Partners', async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('Missing env vars, skipping');
    return;
  }

  const url = `${supabaseUrl}/functions/v1/find-introduction-contacts`;
  console.log(`Calling: ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey || '',
      'x-internal-secret': serviceRoleKey,
    },
    body: JSON.stringify({
      buyer_id: '89bffd5b-f87c-4507-b217-7f595c05efbf',
      buyer_type: 'private_equity',
      pe_firm_name: 'Trivest Partners',
      pe_firm_website: 'trivest.com',
      company_name: 'Trivest Partners',
      company_website: 'https://www.trivest.com',
      email_domain: 'trivest.com',
      trigger_source: 'manual',
    }),
  });

  const body = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${body}`);

  if (!res.ok) {
    throw new Error(`Failed with status ${res.status}: ${body}`);
  }

  const data = JSON.parse(body);
  console.log(`PE contacts found: ${data.pe_contacts_found}`);
  console.log(`Company contacts found: ${data.company_contacts_found}`);
  console.log(`Total saved: ${data.total_saved}`);
  console.log(`Skipped duplicates: ${data.skipped_duplicates}`);
});
