import type { FirstSessionData, AnalyticsSession, AnalyticsConnection, AnalyticsProfile, AnalyticsPageView } from "./types";
import {
  categorizeChannel,
  extractDomain,
  getDiscoverySource,
  getChannelIcon,
  getVisitorKey,
  selfReportedSourceToChannel,
} from "./analyticsHelpers";

/** Compute channel breakdown with unique visitors, sessions, signups, connections */
export function computeChannels(
  uniqueSessions: AnalyticsSession[],
  filteredConnections: AnalyticsConnection[],
  filteredProfiles: AnalyticsProfile[],
  profileToFirstSession: Map<string, FirstSessionData>,
  userToAttributionSession: Map<string, AnalyticsSession>
) {
  const channelVisitors: Record<string, Set<string>> = {};
  const channelSessions: Record<string, number> = {};
  const channelConnections: Record<string, number> = {};
  const channelSignups: Record<string, number> = {};

  uniqueSessions.forEach(s => {
    const discoverySource = getDiscoverySource(s);
    const channel = categorizeChannel(discoverySource, s.utm_source, s.utm_medium);
    if (!channelVisitors[channel]) {
      channelVisitors[channel] = new Set();
      channelSessions[channel] = 0;
    }
    const visitorKey = getVisitorKey(s);
    if (visitorKey) channelVisitors[channel].add(visitorKey);
    channelSessions[channel]++;
  });

  filteredConnections.forEach(c => {
    if (c.user_id) {
      const session = userToAttributionSession.get(c.user_id);
      if (session) {
        const discoverySource = getDiscoverySource(session);
        const channel = categorizeChannel(discoverySource, session.utm_source, session.utm_medium);
        channelConnections[channel] = (channelConnections[channel] || 0) + 1;
      }
    }
  });

  filteredProfiles.forEach(p => {
    const firstSession = profileToFirstSession.get(p.id);
    if (firstSession?.original_external_referrer) {
      const channel = categorizeChannel(firstSession.original_external_referrer, firstSession.utm_source, firstSession.utm_medium);
      channelSignups[channel] = (channelSignups[channel] || 0) + 1;
      return;
    }
    const selfReportedChannel = selfReportedSourceToChannel(p.referral_source);
    if (selfReportedChannel) {
      channelSignups[selfReportedChannel] = (channelSignups[selfReportedChannel] || 0) + 1;
      return;
    }
    if (firstSession) {
      const channel = categorizeChannel(firstSession.referrer, firstSession.utm_source, firstSession.utm_medium);
      channelSignups[channel] = (channelSignups[channel] || 0) + 1;
    }
  });

  return Object.keys(channelVisitors)
    .map(name => ({
      name,
      visitors: channelVisitors[name].size,
      sessions: channelSessions[name] || 0,
      signups: channelSignups[name] || 0,
      connections: channelConnections[name] || 0,
      icon: getChannelIcon(name),
    }))
    .sort((a, b) => b.visitors - a.visitors);
}

/** Compute referrer breakdown */
export function computeReferrers(
  uniqueSessions: AnalyticsSession[],
  filteredConnections: AnalyticsConnection[],
  filteredProfiles: AnalyticsProfile[],
  profileToFirstSession: Map<string, FirstSessionData>,
  userToAttributionSession: Map<string, AnalyticsSession>
) {
  const referrerVisitors: Record<string, Set<string>> = {};
  const referrerSessions: Record<string, number> = {};
  const referrerConnections: Record<string, number> = {};
  const referrerSignups: Record<string, number> = {};

  uniqueSessions.forEach(s => {
    const discoverySource = getDiscoverySource(s);
    const domain = extractDomain(discoverySource);
    if (!referrerVisitors[domain]) {
      referrerVisitors[domain] = new Set();
      referrerSessions[domain] = 0;
    }
    const visitorKey = getVisitorKey(s);
    if (visitorKey) referrerVisitors[domain].add(visitorKey);
    referrerSessions[domain]++;
  });

  filteredConnections.forEach(c => {
    if (c.user_id) {
      const userSession = userToAttributionSession.get(c.user_id);
      if (userSession) {
        const discoverySource = getDiscoverySource(userSession);
        const domain = extractDomain(discoverySource);
        referrerConnections[domain] = (referrerConnections[domain] || 0) + 1;
      }
    }
  });

  filteredProfiles.forEach(p => {
    const firstSession = profileToFirstSession.get(p.id);
    if (firstSession?.original_external_referrer) {
      const domain = extractDomain(firstSession.original_external_referrer);
      referrerSignups[domain] = (referrerSignups[domain] || 0) + 1;
      return;
    }
    if (p.referral_source && p.referral_source !== 'other') {
      const sourceDomain = p.referral_source.toLowerCase() + '.com';
      referrerSignups[sourceDomain] = (referrerSignups[sourceDomain] || 0) + 1;
      return;
    }
    if (firstSession) {
      const domain = extractDomain(firstSession.referrer);
      referrerSignups[domain] = (referrerSignups[domain] || 0) + 1;
    }
  });

  return Object.keys(referrerVisitors)
    .map(domain => ({
      domain,
      visitors: referrerVisitors[domain].size,
      sessions: referrerSessions[domain] || 0,
      signups: referrerSignups[domain] || 0,
      connections: referrerConnections[domain] || 0,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 20);
}

/** Compute campaign breakdown */
export function computeCampaigns(
  uniqueSessions: AnalyticsSession[],
  filteredConnections: AnalyticsConnection[],
  filteredProfiles: AnalyticsProfile[],
  profileToFirstSession: Map<string, FirstSessionData>,
  userToAttributionSession: Map<string, AnalyticsSession>
) {
  const campaignVisitors: Record<string, Set<string>> = {};
  const campaignSessions: Record<string, number> = {};
  const campaignSignups: Record<string, number> = {};
  const campaignConnections: Record<string, number> = {};

  uniqueSessions.forEach(s => {
    if (s.utm_campaign) {
      if (!campaignVisitors[s.utm_campaign]) {
        campaignVisitors[s.utm_campaign] = new Set();
        campaignSessions[s.utm_campaign] = 0;
      }
      const visitorKey = getVisitorKey(s);
      if (visitorKey) campaignVisitors[s.utm_campaign].add(visitorKey);
      campaignSessions[s.utm_campaign]++;
    }
  });

  filteredConnections.forEach(c => {
    if (c.user_id) {
      const userSession = userToAttributionSession.get(c.user_id);
      if (userSession?.utm_campaign) {
        campaignConnections[userSession.utm_campaign] = (campaignConnections[userSession.utm_campaign] || 0) + 1;
      }
    }
  });

  filteredProfiles.forEach(p => {
    const firstSession = profileToFirstSession.get(p.id);
    if (firstSession?.utm_campaign) {
      campaignSignups[firstSession.utm_campaign] = (campaignSignups[firstSession.utm_campaign] || 0) + 1;
    }
  });

  return Object.keys(campaignVisitors)
    .map(name => ({
      name,
      visitors: campaignVisitors[name].size,
      sessions: campaignSessions[name] || 0,
      signups: campaignSignups[name] || 0,
      connections: campaignConnections[name] || 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);
}

/** Compute keyword breakdown */
export function computeKeywords(
  uniqueSessions: AnalyticsSession[],
  filteredConnections: AnalyticsConnection[],
  filteredProfiles: AnalyticsProfile[],
  profileToFirstSession: Map<string, FirstSessionData>,
  userToAttributionSession: Map<string, AnalyticsSession>
) {
  const keywordVisitors: Record<string, Set<string>> = {};
  const keywordSessions: Record<string, number> = {};
  const keywordSignups: Record<string, number> = {};
  const keywordConnections: Record<string, number> = {};

  uniqueSessions.forEach(s => {
    if (s.utm_term) {
      if (!keywordVisitors[s.utm_term]) {
        keywordVisitors[s.utm_term] = new Set();
        keywordSessions[s.utm_term] = 0;
      }
      const visitorKey = getVisitorKey(s);
      if (visitorKey) keywordVisitors[s.utm_term].add(visitorKey);
      keywordSessions[s.utm_term]++;
    }
  });

  filteredConnections.forEach(c => {
    if (c.user_id) {
      const userSession = userToAttributionSession.get(c.user_id);
      if (userSession?.utm_term) {
        keywordConnections[userSession.utm_term] = (keywordConnections[userSession.utm_term] || 0) + 1;
      }
    }
  });

  filteredProfiles.forEach(p => {
    const firstSession = profileToFirstSession.get(p.id);
    if (firstSession?.utm_term) {
      keywordSignups[firstSession.utm_term] = (keywordSignups[firstSession.utm_term] || 0) + 1;
    }
  });

  return Object.keys(keywordVisitors)
    .map(term => ({
      term,
      visitors: keywordVisitors[term].size,
      sessions: keywordSessions[term] || 0,
      signups: keywordSignups[term] || 0,
      connections: keywordConnections[term] || 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);
}

/** Compute geography breakdown (countries, regions, cities) */
export function computeGeography(
  uniqueSessions: AnalyticsSession[],
  filteredConnections: AnalyticsConnection[],
  filteredProfiles: AnalyticsProfile[],
  profileToFirstSession: Map<string, FirstSessionData>,
  userToAttributionSession: Map<string, AnalyticsSession>
) {
  const countryVisitors: Record<string, Set<string>> = {};
  const countrySessions: Record<string, number> = {};
  const countryConnections: Record<string, number> = {};
  const countrySignups: Record<string, number> = {};
  const cityVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
  const cityConnections: Record<string, number> = {};
  const citySignups: Record<string, number> = {};
  const regionVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
  const regionConnections: Record<string, number> = {};
  const regionSignups: Record<string, number> = {};

  uniqueSessions.forEach(s => {
    const country = s.country || 'Unknown';
    const visitorKey = getVisitorKey(s);

    if (!countryVisitors[country]) { countryVisitors[country] = new Set(); countrySessions[country] = 0; }
    if (visitorKey) countryVisitors[country].add(visitorKey);
    countrySessions[country]++;

    if (s.city) {
      const cityKey = `${s.city}, ${country}`;
      if (!cityVisitors[cityKey]) cityVisitors[cityKey] = { visitors: new Set(), sessions: 0, country };
      if (visitorKey) cityVisitors[cityKey].visitors.add(visitorKey);
      cityVisitors[cityKey].sessions++;
    }

    const region = s.region;
    if (region) {
      const regionKey = `${region}, ${country}`;
      if (!regionVisitors[regionKey]) regionVisitors[regionKey] = { visitors: new Set(), sessions: 0, country };
      if (visitorKey) regionVisitors[regionKey].visitors.add(visitorKey);
      regionVisitors[regionKey].sessions++;
    }
  });

  filteredConnections.forEach(c => {
    if (c.user_id) {
      const userSession = userToAttributionSession.get(c.user_id);
      if (userSession) {
        const country = userSession.country || 'Unknown';
        countryConnections[country] = (countryConnections[country] || 0) + 1;
        if (userSession.city) {
          const cityKey = `${userSession.city}, ${country}`;
          cityConnections[cityKey] = (cityConnections[cityKey] || 0) + 1;
        }
        const region = userSession.region;
        if (region) {
          const regionKey = `${region}, ${country}`;
          regionConnections[regionKey] = (regionConnections[regionKey] || 0) + 1;
        }
      }
    }
  });

  filteredProfiles.forEach(p => {
    const firstSession = profileToFirstSession.get(p.id);
    if (firstSession) {
      const country = firstSession.country || 'Unknown';
      countrySignups[country] = (countrySignups[country] || 0) + 1;
      if (firstSession.city) {
        const cityKey = `${firstSession.city}, ${country}`;
        citySignups[cityKey] = (citySignups[cityKey] || 0) + 1;
      }
      const region = firstSession.region;
      if (region) {
        const regionKey = `${region}, ${country}`;
        regionSignups[regionKey] = (regionSignups[regionKey] || 0) + 1;
      }
    }
  });

  const countries = Object.keys(countryVisitors)
    .map(name => ({
      name,
      code: name.substring(0, 2).toUpperCase(),
      visitors: countryVisitors[name].size,
      sessions: countrySessions[name] || 0,
      signups: countrySignups[name] || 0,
      connections: countryConnections[name] || 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);

  const regions = Object.entries(regionVisitors)
    .map(([key, data]) => ({
      name: key.split(',')[0].trim(),
      country: data.country,
      visitors: data.visitors.size,
      sessions: data.sessions,
      signups: regionSignups[key] || 0,
      connections: regionConnections[key] || 0,
    }))
    .filter(r => r.name && r.name !== 'Unknown')
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  const cities = Object.entries(cityVisitors)
    .map(([key, data]) => ({
      name: key.split(',')[0].trim(),
      country: data.country,
      visitors: data.visitors.size,
      sessions: data.sessions,
      signups: citySignups[key] || 0,
      connections: cityConnections[key] || 0,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  const sessionsWithGeo = uniqueSessions.filter(s => s.country && s.country !== 'Unknown').length;
  const geoCoverage = uniqueSessions.length > 0
    ? Math.round((sessionsWithGeo / uniqueSessions.length) * 100)
    : 0;

  return { countries, regions, cities, geoCoverage };
}

/** Compute tech breakdown (browsers, OS, devices) */
export function computeTechBreakdown(
  uniqueSessions: AnalyticsSession[],
  filteredProfiles: AnalyticsProfile[],
  profileToFirstSession: Map<string, FirstSessionData>,
  currentVisitors: number
) {
  const browserVisitors: Record<string, Set<string>> = {};
  const browserSignups: Record<string, number> = {};
  const osVisitors: Record<string, Set<string>> = {};
  const osSignups: Record<string, number> = {};
  const deviceVisitors: Record<string, Set<string>> = {};
  const deviceSignups: Record<string, number> = {};

  uniqueSessions.forEach(s => {
    const browser = s.browser || 'Unknown';
    const os = s.os || 'Unknown';
    const device = s.device_type || 'Desktop';
    const visitorKey = getVisitorKey(s);

    if (!browserVisitors[browser]) browserVisitors[browser] = new Set();
    if (!osVisitors[os]) osVisitors[os] = new Set();
    if (!deviceVisitors[device]) deviceVisitors[device] = new Set();

    if (visitorKey) {
      browserVisitors[browser].add(visitorKey);
      osVisitors[os].add(visitorKey);
      deviceVisitors[device].add(visitorKey);
    }
  });

  filteredProfiles.forEach(p => {
    const firstSession = profileToFirstSession.get(p.id);
    if (firstSession) {
      const browser = firstSession.browser || 'Unknown';
      const os = firstSession.os || 'Unknown';
      const device = firstSession.device_type || 'Desktop';
      browserSignups[browser] = (browserSignups[browser] || 0) + 1;
      osSignups[os] = (osSignups[os] || 0) + 1;
      deviceSignups[device] = (deviceSignups[device] || 0) + 1;
    }
  });

  const totalVisitorsForPercent = currentVisitors || 1;

  const browsers = Object.entries(browserVisitors)
    .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
    .map(([name, visitors]) => ({ name, visitors: visitors.size, signups: browserSignups[name] || 0, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
    .sort((a, b) => b.visitors - a.visitors);

  const operatingSystems = Object.entries(osVisitors)
    .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
    .map(([name, visitors]) => ({ name, visitors: visitors.size, signups: osSignups[name] || 0, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
    .sort((a, b) => b.visitors - a.visitors);

  const devices = Object.entries(deviceVisitors)
    .filter(([type]) => type && type !== 'Unknown' && type !== 'null' && type !== 'undefined')
    .map(([type, visitors]) => ({ type, visitors: visitors.size, signups: deviceSignups[type] || 0, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
    .sort((a, b) => b.visitors - a.visitors);

  return { browsers, operatingSystems, devices };
}

/** Compute funnel stages */
export function computeFunnel(
  currentVisitors: number,
  uniqueSessions: AnalyticsSession[],
  filteredPageViews: AnalyticsPageView[],
  filteredConnections: AnalyticsConnection[],
  filteredConnectionsWithMilestones: AnalyticsConnection[],
  conversionRate: number
) {
  const registeredUsers = new Set(uniqueSessions.filter(s => s.user_id).map(s => s.user_id));
  const connectingUsers = new Set(filteredConnections.map(c => c.user_id));

  const marketplaceViews = new Set(
    filteredPageViews.filter(pv => pv.page_path?.includes('/marketplace') || pv.page_path === '/').map(pv => pv.session_id)
  ).size;

  const ndaSignedUsers = new Set(filteredConnectionsWithMilestones.filter(c => c.lead_nda_signed === true).map(c => c.user_id));
  const feeAgreementUsers = new Set(filteredConnectionsWithMilestones.filter(c => c.lead_fee_agreement_signed === true).map(c => c.user_id));

  const stages = [
    { name: 'Visitors', count: currentVisitors, dropoff: 0 },
    { name: 'Marketplace', count: marketplaceViews, dropoff: currentVisitors > 0 ? ((currentVisitors - marketplaceViews) / currentVisitors) * 100 : 0 },
    { name: 'Registered', count: registeredUsers.size, dropoff: marketplaceViews > 0 ? ((marketplaceViews - registeredUsers.size) / marketplaceViews) * 100 : 0 },
    { name: 'NDA Signed', count: ndaSignedUsers.size, dropoff: registeredUsers.size > 0 ? ((registeredUsers.size - ndaSignedUsers.size) / registeredUsers.size) * 100 : 0 },
    { name: 'Fee Agreement', count: feeAgreementUsers.size, dropoff: ndaSignedUsers.size > 0 ? ((ndaSignedUsers.size - feeAgreementUsers.size) / ndaSignedUsers.size) * 100 : 0 },
    { name: 'Connected', count: connectingUsers.size, dropoff: feeAgreementUsers.size > 0 ? ((feeAgreementUsers.size - connectingUsers.size) / feeAgreementUsers.size) * 100 : 0 },
  ];

  return { stages, overallConversion: conversionRate };
}
