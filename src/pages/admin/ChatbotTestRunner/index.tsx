import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, ClipboardList, ShieldCheck } from 'lucide-react';
import { InfraTestsTab } from './InfraTestsTab';
import { ScenariosTab } from './ScenariosTab';
import { RulesTab } from './RulesTab';

export default function ChatbotTestRunner() {
  const [tab, setTab] = useState('infra');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Chatbot Test Runner</h1>
        <p className="text-sm text-muted-foreground">
          Infrastructure checks and interactive QA scenarios for the AI chatbot system.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="infra" className="gap-2">
            <Cpu className="h-4 w-4" />
            Infrastructure Tests
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            QA Scenarios
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Rules & Guardrails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="infra" className="mt-6">
          <InfraTestsTab />
        </TabsContent>

        <TabsContent value="scenarios" className="mt-6">
          <ScenariosTab />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
