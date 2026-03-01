/**
 * Scoring logic for Recommended Buyers
 */

import type { TranscriptInsight, OutreachInfo } from './use-recommended-buyers-types';

export function classifyTier(
  score: number,
  hasFeeAgreement: boolean,
  appetite: string,
): { tier: 'move_now' | 'strong_candidate' | 'speculative'; label: string } {
  const isActive = ['aggressive', 'active'].includes((appetite || '').toLowerCase());
  if (score >= 80 && (hasFeeAgreement || isActive)) {
    return { tier: 'move_now', label: 'Move Now' };
  }
  if (score >= 60) {
    return { tier: 'strong_candidate', label: 'Strong Candidate' };
  }
  return { tier: 'speculative', label: 'Speculative' };
}

export function computeFitSignals(
  buyer: Record<string, unknown>,
  score: Record<string, unknown>,
  transcript: TranscriptInsight,
  outreach: OutreachInfo,
): string[] {
  const signals: string[] = [];

  if (transcript.ceo_detected) {
    signals.push('CEO/owner participated in call');
  }

  const geoScore = Number(score.geography_score || 0);
  if (geoScore >= 80) {
    signals.push('Strong geographic footprint overlap');
  } else if (geoScore >= 60) {
    signals.push('Regional geographic proximity');
  }

  const sizeScore = Number(score.size_score || 0);
  if (sizeScore >= 80) {
    signals.push('EBITDA and revenue within target range');
  } else if (sizeScore >= 60) {
    signals.push('Size within broader acquisition criteria');
  }

  const svcScore = Number(score.service_score || 0);
  if (svcScore >= 80) {
    signals.push('Core service/sector alignment');
  } else if (svcScore >= 60) {
    signals.push('Related service/sector match');
  }

  const appetite = (buyer.acquisition_appetite as string) || '';
  if (['aggressive', 'active'].includes(appetite.toLowerCase())) {
    signals.push(`${appetite.charAt(0).toUpperCase() + appetite.slice(1)} acquisition mandate`);
  }

  if (buyer.has_fee_agreement) {
    signals.push('Fee agreement signed');
  }

  if (outreach.nda_signed) {
    signals.push('NDA executed');
  }

  if (transcript.call_count > 0) {
    signals.push(`${transcript.call_count} call(s) on record`);
  }

  const totalAcqs = Number(buyer.total_acquisitions || 0);
  if (totalAcqs >= 5) {
    signals.push(`${totalAcqs} prior acquisitions`);
  }

  return signals.slice(0, 5);
}

export const EMPTY_TRANSCRIPT: TranscriptInsight = {
  call_count: 0,
  ceo_detected: false,
  latest_call_date: null,
};

export const EMPTY_OUTREACH: OutreachInfo = {
  contacted: false,
  nda_signed: false,
  cim_sent: false,
  meeting_scheduled: false,
  outcome: null,
};
