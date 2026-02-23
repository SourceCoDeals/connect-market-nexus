import { describe, it, expect } from 'vitest';
import {
  getEventIcon,
  formatEventDescription,
  getMostFrequentEvents,
  groupEventsByTime,
} from './session-event-utils';

describe('getEventIcon', () => {
  it('returns Eye for page_view source', () => {
    expect(getEventIcon('page_view', null, null)).toBe('Eye');
  });

  it('returns correct icon for listing_analytics actions', () => {
    expect(getEventIcon('listing_analytics', null, 'view')).toBe('Eye');
    expect(getEventIcon('listing_analytics', null, 'save')).toBe('Bookmark');
    expect(getEventIcon('listing_analytics', null, 'connection_request')).toBe('Link');
  });

  it('returns correct icon for user_event actions', () => {
    expect(getEventIcon('user_event', 'click', null)).toBe('MousePointer');
    expect(getEventIcon('user_event', 'search', null)).toBe('Search');
    expect(getEventIcon('user_event', 'submit', null)).toBe('Send');
  });

  it('returns Circle as default icon', () => {
    expect(getEventIcon('unknown_source', null, null)).toBe('Circle');
    expect(getEventIcon('listing_analytics', null, 'unknown_action')).toBe('Circle');
  });
});

describe('formatEventDescription', () => {
  it('formats page_view with page_title', () => {
    const result = formatEventDescription('page_view', { page_title: 'Dashboard' });
    expect(result).toBe('View - Dashboard');
  });

  it('formats page_view with page_path fallback', () => {
    const result = formatEventDescription('page_view', { page_path: '/listings' });
    expect(result).toBe('View - /listings');
  });

  it('strips " | Marketplace" suffix from page titles', () => {
    const result = formatEventDescription('page_view', { page_title: 'Deals | Marketplace' });
    expect(result).toBe('View - Deals');
  });

  it('replaces "Listing Detail" with "Listing Page"', () => {
    const result = formatEventDescription('page_view', { page_title: 'Listing Detail' });
    expect(result).toBe('View - Listing Page');
  });

  it('returns "View - Unknown Page" when no title or path', () => {
    const result = formatEventDescription('page_view', {});
    expect(result).toBe('View - Unknown Page');
  });

  it('formats user_event search events with quoted term', () => {
    const result = formatEventDescription('user_event', {
      event_action: 'has_results',
      event_label: 'SaaS companies',
    });
    expect(result).toBe('Search - "SaaS companies"');
  });

  it('formats user_event with event_type search', () => {
    const result = formatEventDescription('user_event', {
      event_type: 'search',
      event_label: 'restaurants',
    });
    expect(result).toBe('Search - "restaurants"');
  });

  it('formats user_event with action, category, and label', () => {
    const result = formatEventDescription('user_event', {
      event_action: 'click',
      event_category: 'nav',
      event_label: 'home button',
    });
    expect(result).toBe('Click - nav: home button');
  });

  it('formats user_event with action and label only', () => {
    const result = formatEventDescription('user_event', {
      event_action: 'click',
      event_label: 'sign up',
    });
    expect(result).toBe('Click - sign up');
  });

  it('formats user_event with action and category only', () => {
    const result = formatEventDescription('user_event', {
      event_action: 'submit',
      event_category: 'form',
    });
    expect(result).toBe('Submit - form');
  });

  it('formats user_event with action only', () => {
    const result = formatEventDescription('user_event', { event_action: 'scroll' });
    expect(result).toBe('Scroll');
  });

  it('formats listing_analytics with action_type and listing_title', () => {
    const result = formatEventDescription('listing_analytics', {
      action_type: 'view',
      listing_title: 'Bakery Franchise',
    });
    expect(result).toBe('View - Bakery Franchise');
  });

  it('defaults listing_analytics action to Action and title to Listing', () => {
    const result = formatEventDescription('listing_analytics', {});
    expect(result).toBe('Action - Listing');
  });

  it('returns "Event" for unknown source', () => {
    const result = formatEventDescription('random_source', {});
    expect(result).toBe('Event');
  });
});

describe('getMostFrequentEvents', () => {
  it('returns top 3 most frequent event descriptions', () => {
    const events = [
      {
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        source: 'page_view' as const,
        type: 'pv',
        description: 'View - Home',
        icon: 'Eye',
      },
      {
        id: '2',
        timestamp: '2024-01-01T00:01:00Z',
        source: 'page_view' as const,
        type: 'pv',
        description: 'View - Home',
        icon: 'Eye',
      },
      {
        id: '3',
        timestamp: '2024-01-01T00:02:00Z',
        source: 'page_view' as const,
        type: 'pv',
        description: 'View - Dashboard',
        icon: 'Eye',
      },
      {
        id: '4',
        timestamp: '2024-01-01T00:03:00Z',
        source: 'user_event' as const,
        type: 'ue',
        description: 'Click - nav',
        icon: 'MousePointer',
      },
      {
        id: '5',
        timestamp: '2024-01-01T00:04:00Z',
        source: 'user_event' as const,
        type: 'ue',
        description: 'Click - nav',
        icon: 'MousePointer',
      },
      {
        id: '6',
        timestamp: '2024-01-01T00:05:00Z',
        source: 'user_event' as const,
        type: 'ue',
        description: 'Click - nav',
        icon: 'MousePointer',
      },
      {
        id: '7',
        timestamp: '2024-01-01T00:06:00Z',
        source: 'listing_analytics' as const,
        type: 'la',
        description: 'View - Listing',
        icon: 'Eye',
      },
    ];
    const result = getMostFrequentEvents(events);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('Click - nav');
    expect(result[0].count).toBe(3);
    expect(result[1].type).toBe('View - Home');
    expect(result[1].count).toBe(2);
  });

  it('returns empty array for empty events', () => {
    expect(getMostFrequentEvents([])).toEqual([]);
  });
});

describe('groupEventsByTime', () => {
  it('returns empty array for empty input', () => {
    expect(groupEventsByTime([])).toEqual([]);
  });

  it('groups events within 1 second together', () => {
    const events = [
      {
        id: '1',
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'page_view' as const,
        type: 'pv',
        description: 'View - Home',
        icon: 'Eye',
      },
      {
        id: '2',
        timestamp: '2024-01-01T00:00:00.500Z',
        source: 'page_view' as const,
        type: 'pv',
        description: 'View - About',
        icon: 'Eye',
      },
      {
        id: '3',
        timestamp: '2024-01-01T00:00:05.000Z',
        source: 'page_view' as const,
        type: 'pv',
        description: 'View - Contact',
        icon: 'Eye',
      },
    ];
    const groups = groupEventsByTime(events);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2); // first two grouped
    expect(groups[1]).toHaveLength(1); // third is separate
  });

  it('groups sequential search events regardless of time gap', () => {
    const events = [
      {
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        source: 'user_event' as const,
        type: 'ue',
        description: 'Search - term1',
        icon: 'Search',
      },
      {
        id: '2',
        timestamp: '2024-01-01T00:00:10Z',
        source: 'user_event' as const,
        type: 'ue',
        description: 'Search - term2',
        icon: 'Search',
      },
    ];
    const groups = groupEventsByTime(events);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });
});
