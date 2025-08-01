-- Update default signature for Bill Martin (ensure admin user exists first)
INSERT INTO public.admin_signature_preferences (
  admin_id,
  signature_html,
  signature_text,
  phone_number,
  calendly_url
) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'bill.martin@sourcecodeals.com' LIMIT 1),
  '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">
    <p style="margin: 0 0 10px 0;">Best regards,</p>
    <p style="margin: 0; line-height: 1.6;">
      <strong>Bill Martin</strong><br>
      Principal &amp; SVP - Growth<br>
      SourceCo Deals<br>
      <a href="mailto:bill.martin@sourcecodeals.com" style="color: #0066cc; text-decoration: none;">bill.martin@sourcecodeals.com</a><br>
      <a href="tel:+16148326099" style="color: #0066cc; text-decoration: none;">(614) 832-6099</a><br>
      <a href="https://calendly.com/bill-martin-sourceco/30min" style="color: #0066cc; text-decoration: none;">Schedule a call with me</a>
    </p>
  </div>',
  'Best regards,

Bill Martin
Principal & SVP - Growth
SourceCo Deals
bill.martin@sourcecodeals.com
(614) 832-6099
Schedule a call with me: https://calendly.com/bill-martin-sourceco/30min',
  '(614) 832-6099',
  'https://calendly.com/bill-martin-sourceco/30min'
)
ON CONFLICT (admin_id) DO UPDATE SET
  signature_html = EXCLUDED.signature_html,
  signature_text = EXCLUDED.signature_text,
  phone_number = EXCLUDED.phone_number,
  calendly_url = EXCLUDED.calendly_url,
  updated_at = NOW();