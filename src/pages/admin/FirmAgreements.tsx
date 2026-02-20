import React from 'react';
import { Building2, Users, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FirmAgreementsTable } from '@/components/admin/firm-agreements/FirmAgreementsTable';
import { FirmSyncTestingPanel } from '@/components/admin/firm-agreements/FirmSyncTestingPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function FirmAgreements() {
  const [isTestingOpen, setIsTestingOpen] = React.useState(false);
  const [pendingScrollId, setPendingScrollId] = React.useState<string | null>(null);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openAndScrollTo = (id: string) => {
    setIsTestingOpen(true);
    setPendingScrollId(id);
  };

  React.useEffect(() => {
    if (isTestingOpen && pendingScrollId) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToId(pendingScrollId);
          setPendingScrollId(null);
        });
      });
    }
  }, [isTestingOpen, pendingScrollId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Stripe-style header with generous padding - matches Users page */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Firm Agreements</h1>
              <p className="text-sm text-muted-foreground">
                Manage NDA and Fee Agreement signatures. Changes sync to all firm members automatically.
              </p>
            </div>
            
            {/* Top right actions */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Tools</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => openAndScrollTo('system-testing')}>
                    System Testing Panel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Subtle navigation tabs - matches Users page */}
          <Tabs defaultValue="firms" className="mt-6">
            <TabsList className="h-auto p-0 bg-transparent border-0 gap-6">
              <TabsTrigger 
                value="users"
                asChild
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 pt-0 font-medium text-sm data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
              >
                <Link to="/admin/marketplace/users" className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </Link>
              </TabsTrigger>
              <TabsTrigger 
                value="firms"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 pt-0 font-medium text-sm data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
              >
                Firm Agreements
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main content with generous padding - matches Users page */}
      <div className="px-8 py-8">
        <FirmAgreementsTable />

        {/* System Testing - Collapsible section */}
        <div id="system-testing" className="mt-12 pt-8 border-t scroll-mt-24 md:scroll-mt-28">
          <details open={isTestingOpen} className="group">
            <summary 
              className="flex items-center justify-between cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-3"
              onClick={(e) => {
                e.preventDefault();
                setIsTestingOpen(!isTestingOpen);
              }}
            >
              <span>🔧 System Testing & Diagnostics</span>
              <span className="group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-6">
              <FirmSyncTestingPanel />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
