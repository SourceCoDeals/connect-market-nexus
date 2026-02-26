-- ============================================================
-- Seed Data: Daily Standup Tasks from 3 Remarketing Touchbase Meetings
-- Meetings: Feb 23, 24, 25 2026 (Tom, Bill, Oz, Brandon)
-- ============================================================

DO $$
DECLARE
  -- Profile IDs (looked up by first_name)
  v_tom_id   uuid;
  v_bill_id  uuid;
  v_oz_id    uuid;
  v_brandon_id uuid;

  -- Meeting IDs
  v_meeting_feb23 uuid := gen_random_uuid();
  v_meeting_feb24 uuid := gen_random_uuid();
  v_meeting_feb25 uuid := gen_random_uuid();

  -- Task counter for priority ranking
  v_rank integer := 0;
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
  -- Meeting 1: Feb 23, 2026 — Tom, Bill, Oz (37 pages)
  -- ========================================================
  INSERT INTO standup_meetings (
    id, fireflies_transcript_id, meeting_title, meeting_date,
    meeting_duration_minutes, tasks_extracted, tasks_unassigned,
    extraction_confidence_avg, processed_at
  ) VALUES (
    v_meeting_feb23,
    'seed-remarketing-touchbase-2026-02-23',
    'Remarketing Touchbase - Feb 23 2026',
    '2026-02-23',
    45,
    8,
    0,
    85.00,
    '2026-02-23T17:00:00Z'
  );

  -- ========================================================
  -- Meeting 2: Feb 24, 2026 — Tom, Bill, Oz (13 pages)
  -- ========================================================
  INSERT INTO standup_meetings (
    id, fireflies_transcript_id, meeting_title, meeting_date,
    meeting_duration_minutes, tasks_extracted, tasks_unassigned,
    extraction_confidence_avg, processed_at
  ) VALUES (
    v_meeting_feb24,
    'seed-remarketing-touchbase-2026-02-24',
    'Remarketing Touchbase - Feb 24 2026',
    '2026-02-24',
    20,
    6,
    0,
    88.00,
    '2026-02-24T17:00:00Z'
  );

  -- ========================================================
  -- Meeting 3: Feb 25, 2026 — Bill, Brandon (10 pages)
  -- ========================================================
  INSERT INTO standup_meetings (
    id, fireflies_transcript_id, meeting_title, meeting_date,
    meeting_duration_minutes, tasks_extracted, tasks_unassigned,
    extraction_confidence_avg, processed_at
  ) VALUES (
    v_meeting_feb25,
    'seed-remarketing-touchbase-2026-02-25',
    'Remarketing Touchbase - Feb 25 2026',
    '2026-02-25',
    25,
    4,
    CASE WHEN v_brandon_id IS NULL THEN 2 ELSE 0 END,
    82.00,
    '2026-02-25T17:00:00Z'
  );

  -- ========================================================
  -- Tasks: Meeting 1 — Feb 23, 2026
  -- ========================================================

  -- Task 1: Oz — Finish TPA/Essential Benefits buyer universe
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Finish TPA buyer universe for Essential Benefits',
    'Complete buyer universe using PE Info, ChatGPT, and Google search. Spend 20-30 minutes. Focus on third-party administrators and benefits companies.',
    v_oz_id, 'build_buyer_universe', 'pending', '2026-02-23',
    v_meeting_feb23, '5:30', 'Essential Benefits',
    72.00, 1, 'high', v_oz_id IS NULL, false
  );

  -- Task 2: Oz — Build med spa buyer universe
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Build med spa buyer universe',
    'High priority — deals are coming in this space. Identify med spa aggregators, PE-backed platforms, and multi-location operators.',
    v_oz_id, 'build_buyer_universe', 'pending', '2026-02-23',
    v_meeting_feb23, '8:15', 'Med Spa',
    68.00, 2, 'high', v_oz_id IS NULL, false
  );

  -- Task 3: Oz — Find NES Navy buyers
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Find NES Navy buyers — military contractors and MROs',
    'Build buyer universe for NES Navy. Target military/defense contractors, maintenance/repair/overhaul companies, and government services firms.',
    v_oz_id, 'build_buyer_universe', 'pending', '2026-02-23',
    v_meeting_feb23, '12:00', 'NES Navy',
    65.00, 3, 'high', v_oz_id IS NULL, false
  );

  -- Task 4: Bill — Reach out to collision repair buyers without fee agreements
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Get fee agreements with collision repair buyers',
    'Reach out to collision repair buyers that do not have fee agreements in place. Priority outreach needed to formalize relationships.',
    v_bill_id, 'contact_owner', 'pending', '2026-02-23',
    v_meeting_feb23, '15:20', 'Collision Repair',
    82.00, 4, 'high', v_bill_id IS NULL, false
  );

  -- Task 5: Bill — Contact Supernova owner for Kelso Industries meeting
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Contact Supernova owner re: Kelso Industries meeting',
    'Kyle Collins already spoke with the Supernova owner. Follow up to arrange meeting with Kelso Industries.',
    v_bill_id, 'contact_owner', 'pending', '2026-02-23',
    v_meeting_feb23, '18:45', 'Supernova / Kelso Industries',
    78.00, 5, 'high', v_bill_id IS NULL, false
  );

  -- Task 6: Bill — Contact VSS buyer re: Dockery's Electrical
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Follow up with VSS buyer on Dockery''s Electrical deal',
    'Contact VSS buyer regarding interest in Dockery''s Electrical. Need to gauge interest level and next steps.',
    v_bill_id, 'follow_up_with_buyer', 'pending', '2026-02-23',
    v_meeting_feb23, '22:10', 'Dockery''s Electrical',
    75.00, 6, 'high', v_bill_id IS NULL, false
  );

  -- Task 7: Oz — Monitor marketplace for connection requests
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Monitor marketplace daily for quality connection requests',
    'Check incoming connection requests on the marketplace platform daily. Filter for quality leads and flag strong ones for follow-up.',
    v_oz_id, 'update_pipeline', 'pending', '2026-02-23',
    v_meeting_feb23, '28:00', NULL,
    45.00, 7, 'medium', v_oz_id IS NULL, false
  );

  -- Task 8: Tom — Hook up PhoneBurner API
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Hook up PhoneBurner API for contact export',
    'Integrate PhoneBurner API to export contacts directly into call lists for the remarketing workflow.',
    v_tom_id, 'update_pipeline', 'pending', '2026-02-23',
    v_meeting_feb23, '32:00', NULL,
    55.00, 8, 'medium', v_tom_id IS NULL, false
  );

  -- ========================================================
  -- Tasks: Meeting 2 — Feb 24, 2026
  -- ========================================================

  -- Task 9: Oz — Keep looking for Clear Choice buyers
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Continue building Clear Choice Windows & Doors buyer universe',
    'Keep looking for buyers for Clear Choice Windows & Doors even though Bill found one. Need more options in the pipeline.',
    v_oz_id, 'build_buyer_universe', 'pending', '2026-02-24',
    v_meeting_feb24, '3:00', 'Clear Choice Windows & Doors',
    62.00, 9, 'high', v_oz_id IS NULL, false
  );

  -- Task 10: Bill — Get a hold of Quick Lube owner
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Get a hold of Quick Lube owner',
    'Email was sent but need to get phone number and make direct contact. Owner has been unresponsive via email.',
    v_bill_id, 'contact_owner', 'pending', '2026-02-24',
    v_meeting_feb24, '4:30', 'Quick Lube',
    80.00, 10, 'high', v_bill_id IS NULL, false
  );

  -- Task 11: Oz — Build Threefold buyer universe
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Build Threefold buyer universe — collision repair platforms',
    'Research collision repair platform companies as potential buyers for Threefold. Look at PE-backed collision groups and MSOs.',
    v_oz_id, 'build_buyer_universe', 'pending', '2026-02-24',
    v_meeting_feb24, '6:00', 'Threefold',
    64.00, 11, 'high', v_oz_id IS NULL, false
  );

  -- Task 12: Oz — Continue NES Navy buyer universe
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Continue NES Navy buyer universe from yesterday',
    'Continuation from Feb 23 — keep building out the military/defense contractor and MRO buyer list for NES Navy.',
    v_oz_id, 'build_buyer_universe', 'pending', '2026-02-24',
    v_meeting_feb24, '7:00', 'NES Navy',
    63.00, 12, 'medium', v_oz_id IS NULL, false
  );

  -- Task 13: Bill — Get fee agreements with specific collision repair buyers
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Get fee agreements: Collision Right, Direct Repair, Lift Auto, Quality Collision, Authentic Auto Body',
    'Specific collision repair buyers without fee agreements: Collision Right, Direct Repair, Lift Auto Group, Quality Collision, Authentic Auto Body. Need signed agreements.',
    v_bill_id, 'contact_owner', 'pending', '2026-02-24',
    v_meeting_feb24, '8:30', 'Collision Repair',
    85.00, 13, 'high', v_bill_id IS NULL, false
  );

  -- Task 14: Tom — Build buyer introduction tracking feature
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Build buyer introduction tracking feature on deals',
    'Create a feature on the platform to track buyer introductions per deal — which buyers have been introduced, when, and the status of each intro.',
    v_tom_id, 'update_pipeline', 'pending', '2026-02-24',
    v_meeting_feb24, '11:00', NULL,
    58.00, 14, 'medium', v_tom_id IS NULL, false
  );

  -- ========================================================
  -- Tasks: Meeting 3 — Feb 25, 2026
  -- ========================================================

  -- Task 15: Brandon — Meet with Tom for marching orders
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review,
    is_manual
  ) VALUES (
    'Meet with Tom tomorrow morning for onboarding and deal assignments',
    'Schedule and attend meeting with Tom at 9 AM PST / 12 PM EST. Get marching orders, deal assignments, and understand current pipeline.',
    v_brandon_id, 'schedule_call', 'pending', '2026-02-26',
    v_meeting_feb25, '3:00', NULL,
    70.00, 15, 'high', v_brandon_id IS NULL,
    false
  );

  -- Task 16: Brandon — Reconnect with Bill for collaboration
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review,
    is_manual
  ) VALUES (
    'Reconnect with Bill tomorrow afternoon for collaboration planning',
    'Touch base with Bill in the afternoon to plan how to collaborate on deals and remarketing efforts going forward.',
    v_brandon_id, 'schedule_call', 'pending', '2026-02-26',
    v_meeting_feb25, '5:30', NULL,
    60.00, 16, 'high', v_brandon_id IS NULL,
    false
  );

  -- Task 17: Bill — Follow up with Tribe/Chilton Auto Collision
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Follow up with Tribe/Chilton Auto Collision — California single body shops',
    'Tribe (Chilton Auto Collision) expressed interest in California single body shops. Follow up to understand their acquisition criteria and present matches.',
    v_bill_id, 'follow_up_with_buyer', 'pending', '2026-02-25',
    v_meeting_feb25, '6:45', 'Chilton Auto Collision / Tribe',
    76.00, 17, 'high', v_bill_id IS NULL, false
  );

  -- Task 18: Bill — Show Brandon the platform and remarketing systems
  INSERT INTO daily_standup_tasks (
    title, description, assignee_id, task_type, status, due_date,
    source_meeting_id, source_timestamp, deal_reference,
    priority_score, priority_rank, extraction_confidence, needs_review, is_manual
  ) VALUES (
    'Demo platform and remarketing systems for Brandon',
    'Walk Brandon through the SourceCode platform, remarketing systems, CRM tools, and buyer outreach workflows on the next call.',
    v_bill_id, 'other', 'pending', '2026-02-26',
    v_meeting_feb25, '8:00', NULL,
    50.00, 18, 'medium', v_bill_id IS NULL, false
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
    WHERE status != 'completed'
  )
  UPDATE daily_standup_tasks t
  SET priority_rank = r.new_rank
  FROM ranked r
  WHERE t.id = r.id;

  RAISE NOTICE 'Seed complete — 3 meetings, 18 tasks, aliases for % team members',
    (SELECT count(*) FROM (
      SELECT 1 WHERE v_tom_id IS NOT NULL
      UNION ALL SELECT 1 WHERE v_bill_id IS NOT NULL
      UNION ALL SELECT 1 WHERE v_oz_id IS NOT NULL
      UNION ALL SELECT 1 WHERE v_brandon_id IS NOT NULL
    ) x);

END $$;
