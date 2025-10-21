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
    const title = data.page_title || data.page_path || 'Unknown Page';
    return `View - ${title}`;
  }
  
  if (source === 'user_event') {
    const action = data.event_action || data.event_type || 'Event';
    const label = data.event_label || data.page_path || '';
    const category = data.event_category || '';
    
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
    return `${capitalize(action)} - Listing`;
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
    
    // Group events within 1 second of each other
    if (currentTime - prevTime < 1000) {
      currentGroup.push(events[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [events[i]];
    }
  }
  
  groups.push(currentGroup);
  return groups;
}
