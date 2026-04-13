/**
 * RLS static-analysis regression tests for the portal intelligence
 * migrations. Parses the SQL files and asserts that the RLS policies
 * use the canonical `public.is_admin(auth.uid())` helper and that the
 * product decision "thesis + recommendations are admin-only" holds.
 *
 * The whole reason P0-6 was a regression is that nothing was asserting
 * this invariant — so we codify it here at the pull-request level before
 * the migration ever hits Postgres.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../../supabase/migrations');

function loadMigration(filename: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf-8');
}

describe('portal intelligence RLS — migration static analysis', () => {
  const auditFixes = loadMigration('20260703000011_portal_intelligence_audit_fixes.sql');
  const phase2 = loadMigration('20260703000002_portal_intelligence_phase_2.sql');

  it('audit-fixes migration uses public.is_admin() for all admin policies', () => {
    // Every CREATE POLICY block for admin access should use is_admin(auth.uid())
    // and NOT reference profiles.is_admin.
    const adminPolicies = auditFixes.match(/CREATE POLICY "Admins[^"]*"[\s\S]*?;/g) ?? [];
    expect(adminPolicies.length).toBeGreaterThan(0);

    for (const policy of adminPolicies) {
      expect(
        policy.includes('public.is_admin(auth.uid())'),
        `admin policy should use is_admin() helper:\n${policy}`,
      ).toBe(true);
      expect(
        /FROM\s+profiles\s+WHERE.*is_admin\s*=\s*true/i.test(policy),
        `admin policy must not reference profiles.is_admin column:\n${policy}`,
      ).toBe(false);
    }
  });

  it('does NOT grant any "Portal users can view" policy on recommendations or criteria', () => {
    // Product decision: thesis criteria and deal recommendations are admin-
    // only. Neither migration should create a portal-user-visible policy on
    // these tables.
    const combined = auditFixes + '\n' + phase2;

    expect(
      /CREATE POLICY[^;]*ON portal_thesis_criteria FOR SELECT[^;]*portal_users/s.test(combined),
    ).toBe(false);
    expect(
      /CREATE POLICY[^;]*ON portal_deal_recommendations FOR SELECT[^;]*portal_users/s.test(
        combined,
      ),
    ).toBe(false);

    // The audit-fixes migration MUST drop the pre-existing portal-user SELECT
    // policy that shipped in 20260703000000.
    expect(auditFixes).toContain('DROP POLICY IF EXISTS "Portal users can view own org criteria"');
  });

  it('SECURITY DEFINER functions pin search_path', () => {
    // queue_portal_recommendation, log_portal_recommendation_event, and
    // cleanup_stale_portal_recommendations are all SECURITY DEFINER — they
    // MUST SET search_path to prevent search_path hijacking by a user with
    // CREATE on a schema in the resolved path.
    const definerBlocks: [string, RegExpMatchArray | null][] = [
      [
        'queue_portal_recommendation',
        auditFixes.match(
          /CREATE OR REPLACE FUNCTION public\.queue_portal_recommendation[\s\S]*?\$\$;/,
        ),
      ],
      [
        'log_portal_recommendation_event',
        phase2.match(
          /CREATE OR REPLACE FUNCTION public\.log_portal_recommendation_event[\s\S]*?\$\$;/,
        ),
      ],
      [
        'cleanup_stale_portal_recommendations',
        phase2.match(
          /CREATE OR REPLACE FUNCTION public\.cleanup_stale_portal_recommendations[\s\S]*?\$\$;/,
        ),
      ],
    ];

    for (const [name, match] of definerBlocks) {
      expect(match, `${name} block not found`).toBeTruthy();
      const block = match![0];
      expect(block, `${name}:\n${block}`).toContain('SECURITY DEFINER');
      expect(/SET\s+search_path\s*=/i.test(block), `${name} must SET search_path:\n${block}`).toBe(
        true,
      );
    }
  });

  it('portal_recommendation_queue has RLS enabled', () => {
    expect(auditFixes).toMatch(/ALTER TABLE portal_recommendation_queue ENABLE ROW LEVEL SECURITY/);
  });

  it('recommendation table has FK to listings with ON DELETE CASCADE', () => {
    expect(auditFixes).toMatch(
      /portal_deal_recommendations_listing_id_fkey[\s\S]*ON DELETE CASCADE/,
    );
  });

  it('thesis criteria table requires non-empty industry_keywords', () => {
    expect(auditFixes).toMatch(
      /portal_thesis_criteria_keywords_non_empty[\s\S]*cardinality\(industry_keywords\)\s*>\s*0/,
    );
  });

  it('BIGINT widening applied to all four money columns', () => {
    const alter = auditFixes.match(
      /ALTER TABLE portal_thesis_criteria[\s\S]*?TYPE BIGINT[\s\S]*?;/,
    );
    expect(alter).toBeTruthy();
    expect(alter![0]).toMatch(/ebitda_min\s+TYPE BIGINT/);
    expect(alter![0]).toMatch(/ebitda_max\s+TYPE BIGINT/);
    expect(alter![0]).toMatch(/revenue_min\s+TYPE BIGINT/);
    expect(alter![0]).toMatch(/revenue_max\s+TYPE BIGINT/);
  });

  it('stale cleanup cron is scheduled', () => {
    expect(phase2).toMatch(/cron\.schedule\(\s*'cleanup-stale-portal-recommendations'/);
  });

  it('process-portal-recommendations cron is scheduled', () => {
    expect(auditFixes).toMatch(/cron\.schedule\(\s*'process-portal-recommendations'/);
  });

  it('strong-match alert column exists on recommendations', () => {
    expect(phase2).toMatch(/ADD COLUMN IF NOT EXISTS strong_match_alerted_at TIMESTAMPTZ/);
  });

  it('pass-reason summary view exists', () => {
    expect(phase2).toMatch(/CREATE OR REPLACE VIEW portal_pass_reason_summary/);
  });

  it('portal-intelligence-docs storage bucket is created', () => {
    expect(phase2).toMatch(/INSERT INTO storage\.buckets[\s\S]*portal-intelligence-docs/);
  });

  it('audit trail table + trigger exist', () => {
    expect(phase2).toMatch(/CREATE TABLE IF NOT EXISTS portal_recommendation_events/);
    expect(phase2).toMatch(/CREATE TRIGGER trg_portal_rec_audit/);
  });
});
