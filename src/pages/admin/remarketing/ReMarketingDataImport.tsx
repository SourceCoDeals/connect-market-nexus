import React from 'react';
import { GitMerge } from 'lucide-react';
import { DealMergePanel } from '@/components/remarketing';

export default function ReMarketingDataImport() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <GitMerge className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Merge Deals</h1>
            <p className="text-muted-foreground mt-1">
              Link marketplace listings with buyer universe data
            </p>
          </div>
        </div>
      </div>

      <DealMergePanel />
    </div>
  );
}
