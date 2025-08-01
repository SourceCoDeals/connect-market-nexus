-- Reset admin signature preferences table
DELETE FROM public.admin_signature_preferences;

-- Insert clean signatures for Bill Martin and Adam Haile
INSERT INTO public.admin_signature_preferences (admin_id, signature_html, signature_text, phone_number, calendly_url) VALUES
-- For any Bill Martin admin account
(
  (SELECT id FROM auth.users WHERE email = 'bill.martin@sourcecodeals.com' LIMIT 1),
  'Bill Martin<br>Principal &amp; SVP - Growth<br>bill.martin@sourcecodeals.com<br>(614) 832-6099<br><a href="https://calendly.com/bill-martin-sourceco/30min">Click here to schedule a call with me</a>',
  'Bill Martin
Principal & SVP - Growth
bill.martin@sourcecodeals.com
(614) 832-6099
Click here to schedule a call with me: https://calendly.com/bill-martin-sourceco/30min',
  '(614) 832-6099',
  'https://calendly.com/bill-martin-sourceco/30min'
),
-- For any Adam Haile admin account  
(
  (SELECT id FROM auth.users WHERE email = 'adam.haile@sourcecodeals.com' LIMIT 1),
  'Adam Haile<br>Growth Marketing<br>adam.haile@sourcecodeals.com<br>(614) 832-6099<br><a href="https://calendly.com/adam-haile-sourceco/30min">Click here to schedule a call with me</a>',
  'Adam Haile
Growth Marketing
adam.haile@sourcecodeals.com
(614) 832-6099
Click here to schedule a call with me: https://calendly.com/adam-haile-sourceco/30min',
  '(614) 832-6099',
  'https://calendly.com/adam-haile-sourceco/30min'
);