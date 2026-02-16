import React, { useState } from 'react';
import { Settings, GitMerge, ChevronDown } from 'lucide-react';
import { DealMergePanel } from '@/components/remarketing';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReMarketingSettings() {
  const [mergeOpen, setMergeOpen] = useState(true);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            ReMarketing module configuration and tools
          </p>
        </div>
      </div>

      <Collapsible open={mergeOpen} onOpenChange={setMergeOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GitMerge className="h-5 w-5 text-primary" />
                  Merge Deals
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown className={`h-4 w-4 transition-transform ${mergeOpen ? 'rotate-180' : ''}`} />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Link marketplace listings with buyer universe data
              </p>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              <DealMergePanel />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
