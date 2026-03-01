-- ============================================================
-- Seed Data: Daily Standup Tasks — Today's Remarketing Touchbase
-- All tasks are strict deal/buyer/remarketing action items, awaiting approval
-- ============================================================

DO $$
DECLARE
  -- Profile IDs (looked up by first_name)
  v_tom_id   uuid;
  v_bill_id  uuid;
  v_oz_id    uuid;
  v_brandon_id uuid;

  -- Meeting ID
  v_meeting_today uuid := gen_random_uuid();
BEGIN

  -- ========================================================
  -- Look up profile IDs by first_name
  -- ========================================================
  SELECT id INTO v_tom_id FROM profiles WHERE first_name = 'Tomos' LIMIT 1;
  SELECT id INTO v_bill_id FROM profiles WHERE first_name = 'Bill' LIMIT 1;
  SELECT id INTO v_oz_id FROM profiles WHERE first_name = 'Oz' LIMIT 1;
  SELECT id INTO v_brandon_id FROM profiles WHERE first_name = 'Brandon' LIMIT 1;

  -- ========================================================
  -- Team Member Aliases
  -- ========================================================
  IF v_tom_id IS NOT NULL THEN
    INSERT INTO team_member_aliases (profile_id, alias, created_by)
    VALUES
      (v_tom_id, 'Tom', v_tom_id),
      (v_tom_id, 'Tommy', v_tom_id),
      (v_tom_id, 'Tomos', v_tom_id)
    ON CONFLICT (profile_id, alias) DO NOTHING;
  END IF;

  IF v_bill_id IS NOT NULL THEN
    INSERT INTO team_member_aliases (profile_id, alias, created_by)
    VALUES
      (v_bill_id, 'Bill', v_bill_id),
      (v_bill_id, 'Bill Martin', v_bill_id)
    ON CONFLICT (profile_id, alias) DO NOTHING;
  END IF;

  IF v_oz_id IS NOT NULL THEN
    INSERT INTO team_member_aliases (profile_id, alias, created_by)
    VALUES
      (v_oz_id, 'Oz', v_oz_id),
      (v_oz_id, 'Ozzie', v_oz_id),
      (v_oz_id, 'Oswald', v_oz_id),
      (v_oz_id, 'Oz De La Luna', v_oz_id)
    ON CONFLICT (profile_id, alias) DO NOTHING;
  END IF;

  IF v_brandon_id IS NOT NULL THEN
    INSERT INTO team_member_aliases (profile_id, alias, created_by)
    VALUES
      (v_brandon_id, 'Brandon', v_brandon_id),
      (v_brandon_id, 'Brandon Hall', v_brandon_id)
    ON CONFLICT (profile_id, alias) DO NOTHING;
  END IF;

  -- ========================================================
  -- Today's Standup Meeting
  -- ========================================================
  INSERT INTO standup_meetings (
    id, fireflies_transcript_id, meeting_title, meeting_date,
    meeting_duration_minutes, tasks_extracted, tasks_unassigned,
    extraction_confidence_avg, processed_at
  ) VALUES (
    v_meeting_today,
    'seed-remarketing-touchbase-' || CURRENT_DATE::text,
    'Remarketing Touchbase - ' || to_char(CURRENT_DATE, 'Mon DD YYYY'),
    CURRENT_DATE,
    35,
    12,
    0,
    90.00,
    now()
  );

  -- ========================================================
  -- Oz's Tasks — Buyer universe building & deal outreach
  -- ========================================================

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Email TPA buyer list (5 contacts) to Bill for Essential Benefits outreach',
    'Pull the 5 TPA buyers identified yesterday from PE Info and email them to Bill with contact info and notes. He needs them for afternoon calls.',
    v_oz_id, 'send_materials', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '3:15', 'Essential Benefits',
    80.00, 1, 'high', v_oz_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Add 10 PE-backed med spa groups to buyer universe spreadsheet',
    'Use PE Info and Google to find 10 PE-backed med spa platforms. Add company name, contact person, email, and AUM to the shared buyer universe sheet.',
    v_oz_id, 'build_buyer_universe', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '6:30', 'Med Spa',
    72.00, 2, 'high', v_oz_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Call NES Navy owner to confirm asking price and get updated financials',
    'Call the NES Navy owner directly. Confirm the $2.5M asking price is still accurate and request trailing 12-month P&L and balance sheet.',
    v_oz_id, 'contact_owner', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '9:00', 'NES Navy',
    85.00, 3, 'high', v_oz_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Send Clear Choice Windows deal memo to Comfort Systems USA buyer contact',
    'Email the Clear Choice Windows & Doors deal memo to the Comfort Systems USA contact that Bill introduced last week. CC Bill on the email.',
    v_oz_id, 'send_materials', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '11:45', 'Clear Choice Windows & Doors',
    75.00, 4, 'high', v_oz_id IS NULL, false
  );

  -- ========================================================
  -- Bill's Tasks — Fee agreements, buyer follow-ups & intros
  -- ========================================================

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Call Collision Right, Direct Repair, and Lift Auto to get signed fee agreements',
    'Phone each buyer today. Collision Right (ask for Mike), Direct Repair (ask for Sarah), Lift Auto (ask for James). Goal: get fee agreements signed or verbal commitment by EOD.',
    v_bill_id, 'contact_owner', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '14:00', 'Collision Repair',
    90.00, 5, 'high', v_bill_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Schedule intro call between Kelso Industries and Supernova owner for this week',
    'Email both parties with 3 available time slots this week (Wed-Fri). Kelso contact: Dave Martinez. Supernova owner: Kyle Collins already has the relationship.',
    v_bill_id, 'schedule_call', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '16:20', 'Supernova / Kelso Industries',
    82.00, 6, 'high', v_bill_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Email VSS buyer the updated Dockery''s Electrical financials package',
    'Send the recast P&L and updated add-back schedule to VSS buyer. They requested this on Monday. Include the owner transition memo.',
    v_bill_id, 'send_materials', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '18:30', 'Dockery''s Electrical',
    78.00, 7, 'high', v_bill_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Call Tribe/Chilton buyer to get LOI status on California body shops',
    'Call the Tribe (Chilton Auto Collision) buyer directly. They said they''d have LOI ready by this week for the 3 California single body shops. Get a firm date or the signed LOI.',
    v_bill_id, 'follow_up_with_buyer', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '20:00', 'Chilton Auto Collision / Tribe',
    76.00, 8, 'high', v_bill_id IS NULL, false
  );

  -- ========================================================
  -- Tom's Tasks — Deal-focused remarketing activities
  -- ========================================================

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Send Threefold buyer shortlist to 3 collision repair PE groups',
    'Email the Threefold deal teaser and memo to Service King, Caliber Collision, and Classic Collision PE contacts. Track sends in the CRM.',
    v_tom_id, 'send_materials', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '24:00', 'Threefold',
    68.00, 9, 'high', v_tom_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Follow up with Quick Lube owner — get phone number and schedule call',
    'Owner has been unresponsive via email. Find direct phone number through LinkedIn or company website and call to schedule a 15-min intro.',
    v_tom_id, 'contact_owner', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '27:00', 'Quick Lube',
    74.00, 10, 'high', v_tom_id IS NULL, false
  );

  -- ========================================================
  -- Brandon's Tasks — Deal sourcing & buyer outreach
  -- ========================================================

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Research and list 5 potential buyers for the Authentic Auto Body deal',
    'Search for collision repair groups, MSOs, and PE-backed platforms that acquire single-location body shops. Add to buyer universe with contact info.',
    v_brandon_id, 'build_buyer_universe', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '30:00', 'Authentic Auto Body',
    62.00, 11, 'high', v_brandon_id IS NULL, false
  );

  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Call 3 marketplace connection requests and qualify buyer interest',
    'Review the 3 pending connection requests from the marketplace. Call each contact, qualify their acquisition criteria, budget, and timeline. Log results in CRM.',
    v_brandon_id, 'follow_up_with_buyer', 'pending_approval', CURRENT_DATE,
    v_meeting_today, '32:00', NULL,
    58.00, 12, 'medium', v_brandon_id IS NULL, false
  );

  -- ========================================================
  -- Recompute priority_rank globally (pinned first, then by score DESC)
  -- ========================================================
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        ORDER BY
          is_pinned DESC,
          pinned_rank ASC NULLS LAST,
          priority_score DESC,
          due_date ASC,
          created_at ASC
      ) AS new_rank
    FROM daily_standup_tasks
    WHERE status NOT IN ('completed')
  )
  UPDATE daily_standup_tasks t
  SET priority_rank = r.new_rank
  FROM ranked r
  WHERE t.id = r.id;

  RAISE NOTICE 'Seed complete — 1 meeting, 12 deal tasks, aliases for % team members',
    (SELECT count(*) FROM (
      SELECT 1 WHERE v_tom_id IS NOT NULL
      UNION ALL SELECT 1 WHERE v_bill_id IS NOT NULL
      UNION ALL SELECT 1 WHERE v_oz_id IS NOT NULL
      UNION ALL SELECT 1 WHERE v_brandon_id IS NOT NULL
    ) x);

END $$;
