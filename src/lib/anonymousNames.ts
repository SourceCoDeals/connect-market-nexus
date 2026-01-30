// Generate consistent, memorable names for anonymous users
// Similar to DataFast's "aqua boa", "magenta perch" style

const colors = [
  'coral', 'azure', 'amber', 'jade', 'violet', 'rose', 'teal', 'gold',
  'crimson', 'sage', 'cobalt', 'peach', 'mint', 'ruby', 'slate', 'bronze'
];

const animals = [
  'falcon', 'panther', 'dolphin', 'phoenix', 'wolf', 'eagle', 'hawk', 'lynx',
  'tiger', 'orca', 'raven', 'fox', 'bear', 'owl', 'shark', 'lion'
];

// Simple hash function for consistent results
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function generateAnonymousName(sessionId: string): string {
  const hash = hashCode(sessionId);
  const color = colors[hash % colors.length];
  const animal = animals[(hash >> 4) % animals.length];
  return `${color} ${animal}`;
}

// Get avatar background color based on the generated name
export function getAvatarColor(name: string): string {
  const colorMap: Record<string, string> = {
    coral: 'bg-coral-500',
    azure: 'bg-blue-500',
    amber: 'bg-amber-500',
    jade: 'bg-emerald-500',
    violet: 'bg-violet-500',
    rose: 'bg-rose-500',
    teal: 'bg-teal-500',
    gold: 'bg-yellow-500',
    crimson: 'bg-red-600',
    sage: 'bg-green-500',
    cobalt: 'bg-indigo-600',
    peach: 'bg-orange-400',
    mint: 'bg-cyan-400',
    ruby: 'bg-pink-600',
    slate: 'bg-slate-500',
    bronze: 'bg-orange-600',
  };
  
  const colorWord = name.split(' ')[0];
  return colorMap[colorWord] || 'bg-gray-500';
}

// Get initials from name
export function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
