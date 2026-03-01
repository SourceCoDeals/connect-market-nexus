UPDATE daily_standup_tasks
SET title = 'Send Clear Choice Windows deal memo to Comfort Systems USA buyer contact',
    description = 'Email the Clear Choice Windows & Doors deal memo to the Comfort Systems USA contact that Bill introduced last week. CC Bill on the email.'
WHERE title = 'Send Clear Choice Windows CIM to Comfort Systems USA buyer contact';

UPDATE daily_standup_tasks
SET description = 'Email the Threefold deal teaser and memo to Service King, Caliber Collision, and Classic Collision PE contacts. Track sends in the CRM.'
WHERE title = 'Send Threefold buyer shortlist to 3 collision repair PE groups'
  AND description LIKE '%CIM to Service King%';