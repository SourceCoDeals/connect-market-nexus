/**
 * Helper/utility functions for Enhanced Real-Time Analytics
 */

import { generateAnonymousName } from "@/lib/anonymousNames";
import type { EnhancedActiveUser } from "./enhanced-realtime-types";

// Helper to calculate session status based on last activity
export function getSessionStatus(lastActiveAt: string | null): 'active' | 'idle' | 'ended' {
  if (!lastActiveAt) return 'ended';
  const lastActive = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastActive) / (60 * 1000);

  if (diffMinutes < 2) return 'active';
  if (diffMinutes < 10) return 'idle';
  return 'ended';
}

// Helper to calculate session duration dynamically
export function calculateDuration(session: {
  session_duration_seconds: number | null;
  started_at: string;
  last_active_at: string | null;
}): number {
  // If we have actual duration from heartbeat, use it
  if (session.session_duration_seconds && session.session_duration_seconds > 0) {
    return session.session_duration_seconds;
  }

  // Calculate from timestamps
  const startedAt = new Date(session.started_at).getTime();
  const lastActive = session.last_active_at
    ? new Date(session.last_active_at).getTime()
    : Date.now();

  return Math.max(0, Math.floor((lastActive - startedAt) / 1000));
}

// Helper to generate default coordinates for users without geo data
// Places them in the Atlantic Ocean area with consistent positioning based on session ID
export function getDefaultCoordinates(sessionId: string): { lat: number; lng: number } {
  const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    lat: 25 + (hash % 30), // Between 25°N and 55°N
    lng: -30 + (hash % 20), // Atlantic Ocean area (-30 to -10)
  };
}

// Helper to normalize referrer to a readable source name
// FIXED: Uses exact domain matching to prevent false positives (e.g., JWT tokens matching "t.co")
export function normalizeReferrer(referrer: string | null, utmSource: string | null): string {
  const source = referrer?.toLowerCase() || utmSource?.toLowerCase() || '';

  if (!source) return 'Direct';

  // Parse as URL for accurate domain matching
  let hostname = '';
  try {
    const url = new URL(source.startsWith('http') ? source : `https://${source}`);
    hostname = url.hostname.replace('www.', '');
  } catch {
    // If it can't parse as URL, check if source itself matches known patterns
    hostname = source;
  }

  // Check against EXACT domains - order matters for specificity

  // AI/Chat platforms
  if (hostname.includes('chatgpt.') || hostname.includes('chat.openai.')) return 'ChatGPT';
  if (hostname.includes('claude.ai') || hostname.includes('anthropic.')) return 'Claude';
  if (hostname.includes('perplexity.')) return 'Perplexity';
  if (hostname.includes('bard.google.') || hostname.includes('gemini.google.')) return 'Gemini';

  // Social Media
  if (hostname === 'twitter.com' || hostname === 'x.com' || hostname === 't.co') return 'X';
  if (hostname.includes('facebook.') || hostname === 'fb.com' || hostname.includes('fb.me')) return 'Facebook';
  if (hostname.includes('linkedin.')) return 'LinkedIn';
  if (hostname.includes('instagram.')) return 'Instagram';
  if (hostname.includes('tiktok.')) return 'TikTok';
  if (hostname.includes('youtube.') || hostname === 'youtu.be') return 'YouTube';
  if (hostname.includes('reddit.')) return 'Reddit';

  // Search Engines
  if (hostname.includes('google.')) return 'Google';
  if (hostname.includes('bing.')) return 'Bing';
  if (hostname.includes('duckduckgo.')) return 'DuckDuckGo';
  if (hostname.includes('yahoo.')) return 'Yahoo';

  // Email Marketing - Brevo/Sendinblue domains
  if (hostname.includes('brevo.') || hostname.includes('sendib') || hostname.includes('sendinblue')) return 'Brevo';
  if (hostname.includes('mailchimp.')) return 'Mailchimp';

  // Development/Preview
  if (hostname.includes('lovable.dev') || hostname.includes('lovable.app') || hostname.includes('lovableproject.com')) return 'Lovable';
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'Localhost';

  // Your own domain - show the subdomain or path for clarity
  if (hostname.includes('sourcecodeals.com') || hostname.includes('sourceco')) {
    // If it's from the main site (not marketplace), show sourcecodeals.com
    if (!hostname.includes('marketplace')) {
      return 'sourcecodeals.com';
    }
    return 'Internal';
  }

  // Microsoft/Enterprise
  if (hostname.includes('teams.') || hostname.includes('office.net') || hostname.includes('microsoft.')) return 'Teams';
  if (hostname.includes('slack.')) return 'Slack';

  // Return the domain name itself for other valid domains
  if (hostname && hostname.length > 0 && hostname.includes('.')) {
    // Clean up common prefixes/suffixes
    const cleanDomain = hostname
      .replace('.com', '')
      .replace('.org', '')
      .replace('.net', '')
      .replace('.io', '');
    return cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
  }

  return 'Referral';
}

// Extract external referrer domain for display (e.g., sourcecodeals.com/blog -> sourcecodeals.com)
export function extractExternalReferrer(referrer: string | null): string | null {
  if (!referrer) return null;

  try {
    const url = new URL(referrer.startsWith('http') ? referrer : `https://${referrer}`);
    const hostname = url.hostname.replace('www.', '');

    // Check if it's an internal/preview domain
    if (
      hostname.includes('lovable.') ||
      hostname.includes('localhost') ||
      hostname.includes('127.0.0.1') ||
      hostname.includes('marketplace.sourcecodeals')
    ) {
      return null;
    }

    // Return the full path for context (e.g., sourcecodeals.com/blog)
    const path = url.pathname !== '/' ? url.pathname : '';
    return `${hostname}${path}`;
  } catch {
    return null;
  }
}

export function createDefaultUser(sessionId: string, pagePath: string | null, timestamp: string): EnhancedActiveUser {
  return {
    sessionId,
    visitorId: null,
    userId: null,
    userName: null,
    displayName: generateAnonymousName(sessionId),
    companyName: null,
    buyerType: null,
    jobTitle: null,
    isAnonymous: true,
    country: null,
    countryCode: null,
    city: null,
    coordinates: null,
    deviceType: 'desktop',
    browser: null,
    os: null,
    referrer: null,
    utmSource: null,
    // Entry/Attribution
    entrySource: 'Direct',
    firstPagePath: pagePath,
    pageSequence: pagePath ? [pagePath] : [],
    ga4ClientId: null,
    firstTouchSource: null,
    firstTouchMedium: null,
    externalReferrer: null,
    // Session
    sessionDurationSeconds: 0,
    lastActiveAt: timestamp,
    currentPage: pagePath,
    sessionStatus: getSessionStatus(timestamp),
    listingsViewed: 0,
    listingsSaved: 0,
    connectionsSent: 0,
    totalVisits: 1,
    totalTimeSpent: 0,
    searchCount: 0,
    feeAgreementSigned: false,
    ndaSigned: false,
    // Cross-session journey data
    visitorFirstSeen: timestamp,
    visitorTotalSessions: 1,
    visitorTotalTime: 0,
  };
}
