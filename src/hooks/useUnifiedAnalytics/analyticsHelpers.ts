// Dev/bot traffic patterns to filter out
const DEV_TRAFFIC_PATTERNS = [
  'lovable.dev',
  'lovableproject.com',
  'preview--',
  'localhost',
  '127.0.0.1',
];

export function isDevTraffic(referrer: string | null): boolean {
  if (!referrer) return false;
  const lowerReferrer = referrer.toLowerCase();
  return DEV_TRAFFIC_PATTERNS.some(pattern => lowerReferrer.includes(pattern));
}

// Map self-reported sources (from signup "how did you hear about us") to channels
export function selfReportedSourceToChannel(source: string | null): string | null {
  if (!source) return null;
  const s = source.toLowerCase().trim();

  if (s === 'google') return 'Organic Search';
  if (s === 'linkedin' || s === 'instagram' || s === 'twitter' || s === 'facebook' || s === 'reddit' || s === 'youtube') return 'Organic Social';
  if (s === 'ai') return 'AI';
  if (s === 'newsletter' || s === 'podcast') return 'Newsletter';
  if (s === 'friend') return 'Referral';
  if (s === 'billboard') return 'Other';
  if (s === 'other') return null;

  return null;
}

export function categorizeChannel(referrer: string | null, utmSource: string | null, utmMedium: string | null): string {
  if (!referrer && !utmSource) return 'Direct';

  const source = (referrer || utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();

  // CRITICAL FIX: Detect email platform domains FIRST (Brevo, Mailchimp, etc.)
  if (source.includes('brevo') || source.includes('sendibt') ||
      source.includes('mailchimp') || source.includes('sendgrid') ||
      source.includes('hubspot') || source.includes('klaviyo') ||
      source.includes('campaign-archive') || source.includes('mailchi.mp')) return 'Newsletter';

  if (medium.includes('email') || medium.includes('newsletter')) return 'Newsletter';

  // Internal navigation
  if (source.includes('marketplace.sourcecodeals.com')) return 'Internal';

  // AI Sources
  if (source.includes('chatgpt') || source.includes('openai')) return 'AI';
  if (source.includes('claude') || source.includes('anthropic')) return 'AI';
  if (source.includes('perplexity')) return 'AI';
  if (source.includes('gemini') || source.includes('bard')) return 'AI';

  // Organic Social
  if (source.includes('linkedin')) return 'Organic Social';
  if (source.includes('twitter') || source.includes('x.com')) return 'Organic Social';
  if (source.includes('facebook') || source.includes('fb.com')) return 'Organic Social';
  if (source.includes('instagram')) return 'Organic Social';

  // Organic Search
  if (source.includes('google') && !medium.includes('cpc')) return 'Organic Search';
  if (source.includes('bing')) return 'Organic Search';
  if (source.includes('duckduckgo')) return 'Organic Search';
  if (source.includes('brave')) return 'Organic Search';

  // Paid
  if (medium.includes('cpc') || medium.includes('paid')) return 'Paid';

  // Referral
  if (referrer && !source.includes('direct')) return 'Referral';

  return 'Direct';
}

export function extractDomain(url: string | null): string {
  if (!url) return 'Direct';
  try {
    let hostname: string;

    if (!url.includes('://') && !url.startsWith('/')) {
      hostname = url.replace('www.', '').toLowerCase();
    } else {
      hostname = new URL(url).hostname.replace('www.', '');
    }

    // Normalize known email service tracking domains
    if (hostname.includes('brevo') || hostname.includes('sendibt') || hostname.includes('exdov')) {
      return 'brevo.com';
    }
    if (hostname.includes('mailchimp') || hostname.includes('mailchi.mp')) {
      return 'mailchimp.com';
    }
    if (hostname.includes('sendgrid')) {
      return 'sendgrid.com';
    }

    return hostname;
  } catch {
    return url.replace('www.', '').toLowerCase();
  }
}

// Discovery source priority system - get the TRUE origin of a visitor
export function getDiscoverySource(session: {
  original_external_referrer?: string | null;
  utm_source?: string | null;
  referrer?: string | null;
}): string | null {
  if (session.original_external_referrer) return session.original_external_referrer;
  if (session.utm_source) return session.utm_source;
  return session.referrer || null;
}

// Find the first session with meaningful attribution data
export function getFirstMeaningfulSession(sessions: any[]): any | null {
  if (!sessions || sessions.length === 0) return null;

  const chronological = [...sessions].reverse();

  const withCrossDomain = chronological.find(s => s.original_external_referrer);
  if (withCrossDomain) return withCrossDomain;

  const withUtm = chronological.find(s => s.utm_source);
  if (withUtm) return withUtm;

  const withReferrer = chronological.find(s => s.referrer);
  if (withReferrer) return withReferrer;

  return chronological[0];
}

export function getChannelIcon(channel: string): string {
  const icons: Record<string, string> = {
    'AI': 'sparkles',
    'Organic Social': 'users',
    'Organic Search': 'search',
    'Direct': 'globe',
    'Referral': 'link',
    'Paid': 'credit-card',
    'Newsletter': 'mail',
  };
  return icons[channel] || 'globe';
}

// Helper to get unique visitor key from a session
export function getVisitorKey(session: { user_id?: string | null; visitor_id?: string | null; session_id: string }): string | null {
  if (session.user_id) return session.user_id;
  if (session.visitor_id) return session.visitor_id;
  return null;
}

// Animal name generation for anonymous visitors
const ANIMALS = ['Wolf', 'Eagle', 'Lion', 'Tiger', 'Bear', 'Fox', 'Hawk', 'Panther', 'Falcon', 'Jaguar',
  'Raven', 'Phoenix', 'Dragon', 'Serpent', 'Griffin', 'Owl', 'Shark', 'Dolphin', 'Whale', 'Orca'];
const COLORS = ['Azure', 'Crimson', 'Emerald', 'Golden', 'Ivory', 'Jade', 'Coral', 'Silver', 'Amber', 'Violet',
  'Scarlet', 'Cobalt', 'Bronze', 'Indigo', 'Platinum', 'Onyx', 'Ruby', 'Sapphire', 'Topaz', 'Pearl'];

export function generateAnimalName(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % COLORS.length;
  const animalIndex = Math.abs(hash >> 8) % ANIMALS.length;
  return `${COLORS[colorIndex]} ${ANIMALS[animalIndex]}`;
}
