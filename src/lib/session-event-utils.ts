import { SessionEvent } from "@/hooks/use-session-events";

export function getEventIcon(
  source: string,
  eventAction: string | null,
  actionType: string | null
): string {
  if (source === 'page_view') return 'Eye';
  if (source === 'listing_analytics') {
    if (actionType === 'view') return 'Eye';
    if (actionType === 'save') return 'Bookmark';
    if (actionType === 'connection_request') return 'Link';
  }
  if (source === 'user_event') {
    if (eventAction === 'click') return 'MousePointer';
    if (eventAction === 'search') return 'Search';
    if (eventAction === 'submit') return 'Send';
  }
  return 'Circle';
}

export function formatEventDescription(source: string, data: any): string {
  if (source === 'page_view') {
    let title = data.page_title || data.page_path || 'Unknown Page';
    
    // Clean up the title - remove " | Marketplace" suffix and similar
    title = title.replace(/\s*\|\s*Marketplace\s*$/i, '');
    
    // If it's "Listing Detail", try to extract business name from earlier in the title
    if (title === 'Listing Detail') {
      title = 'Listing Page';
    }
    
    return `View - ${title}`;
  }
  
  if (source === 'user_event') {
    const action = data.event_action || data.event_type || 'Event';
    const label = data.event_label || '';
    const category = data.event_category || '';
    
    // For search events, just show the search term
    if (action === 'has_results' || data.event_type === 'search') {
      return `Search - "${label}"`;
    }
    
    if (label && category) {
      return `${capitalize(action)} - ${category}: ${label}`;
    }
    if (label) {
      return `${capitalize(action)} - ${label}`;
    }
    if (category) {
      return `${capitalize(action)} - ${category}`;
    }
    return capitalize(action);
  }
  
  if (source === 'listing_analytics') {
    const action = data.action_type || 'Action';
    const listingTitle = data.listing_title || 'Listing';
    
    // Show the actual listing title for better context
    return `${capitalize(action)} - ${listingTitle}`;
  }
  
  return 'Event';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getMostFrequentEvents(events: SessionEvent[]): Array<{ type: string; count: number; icon: string }> {
  const frequencyMap = new Map<string, { count: number; icon: string }>();
  
  events.forEach(event => {
    const key = event.description;
    if (frequencyMap.has(key)) {
      frequencyMap.get(key)!.count++;
    } else {
      frequencyMap.set(key, { count: 1, icon: event.icon });
    }
  });
  
  return Array.from(frequencyMap.entries())
    .map(([type, data]) => ({ type, count: data.count, icon: data.icon }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export function groupEventsByTime(events: SessionEvent[]): SessionEvent[][] {
  if (events.length === 0) return [];
  
  const groups: SessionEvent[][] = [];
  let currentGroup: SessionEvent[] = [events[0]];
  
  for (let i = 1; i < events.length; i++) {
    const prevTime = new Date(events[i - 1].timestamp).getTime();
    const currentTime = new Date(events[i].timestamp).getTime();
    const prevEvent = events[i - 1];
    const currentEvent = events[i];
    
    // Group events within 1 second OR if they're sequential search events
    const isSequentialSearch = 
      prevEvent.description.startsWith('Search -') && 
      currentEvent.description.startsWith('Search -');
    
    const shouldGroup = (currentTime - prevTime < 1000) || isSequentialSearch;
    
    if (shouldGroup) {
      currentGroup.push(events[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [events[i]];
    }
  }
  
  groups.push(currentGroup);
  return groups;
}
