import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, FileSignature, UserCircle, Bell, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getProfileCompletionDetails } from '@/lib/buyer-metrics';
import { useBuyerNdaStatus } from '@/hooks/admin/use-docuseal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WhileYouWaitChecklistProps {
  listingCategory?: string;
  listingLocation?: string; // reserved for future geo-based suggestions
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href?: string;
  icon: React.ReactNode;
}

export function WhileYouWaitChecklist({
  listingCategory,
  listingLocation: _listingLocation,
}: WhileYouWaitChecklistProps) {
  const { user, isAdmin } = useAuth();
  const { data: ndaStatus } = useBuyerNdaStatus(!isAdmin ? user?.id : undefined);
  const profileDetails = user ? getProfileCompletionDetails(user) : null;

  // Check if user has deal alerts
  const { data: alertCount } = useQuery({
    queryKey: ['deal-alert-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('deal_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const ndaSigned = ndaStatus?.ndaSigned ?? user?.nda_signed ?? false;
  const profileComplete = profileDetails?.isComplete ?? false;
  const hasAlerts = (alertCount ?? 0) > 0;

  const items: ChecklistItem[] = [];

  if (!ndaSigned) {
    items.push({
      id: 'nda',
      label: 'Sign your NDA',
      description: 'Approvals move faster when documentation is complete',
      completed: false,
      href: '/pending-approval',
      icon: <FileSignature className="h-4 w-4" />,
    });
  }

  if (!profileComplete && profileDetails && profileDetails.percentage < 80) {
    items.push({
      id: 'profile',
      label: 'Complete your profile',
      description: `${profileDetails.percentage}% complete — a fuller profile helps us present you effectively`,
      completed: false,
      href: '/welcome',
      icon: <UserCircle className="h-4 w-4" />,
    });
  }

  items.push({
    id: 'browse',
    label: 'Browse similar deals',
    description: listingCategory
      ? `See other ${listingCategory} opportunities that match your criteria`
      : 'Explore more deals that match your investment thesis',
    completed: false,
    href: listingCategory
      ? `/marketplace?category=${encodeURIComponent(listingCategory)}`
      : '/marketplace',
    icon: <Search className="h-4 w-4" />,
  });

  if (!hasAlerts) {
    items.push({
      id: 'alert',
      label: 'Set up a deal alert',
      description: 'Get notified when new deals matching your criteria are added',
      completed: false,
      href: '/profile?tab=alerts',
      icon: <Bell className="h-4 w-4" />,
    });
  }

  // If everything is done, show nothing
  const actionableItems = items.filter((item) => !item.completed);
  if (actionableItems.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">While you wait</p>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.href || '#'}
            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-100 transition-colors group"
          >
            <div className="mt-0.5 shrink-0">
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}
              >
                {item.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
            </div>
            <div className="shrink-0 text-slate-400 group-hover:text-slate-600 mt-0.5">
              {item.icon}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
