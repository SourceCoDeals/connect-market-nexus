import { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FlaskConical, Activity, Beaker, Bot, Mail, ListChecks, Store } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const EnrichmentTest = lazy(() => import('@/pages/admin/EnrichmentTest'));
const SystemTestRunner = lazy(() => import('@/pages/admin/SystemTestRunner'));
const DocuSealHealthCheck = lazy(() => import('@/pages/admin/DocuSealHealthCheck'));
const ChatbotTestRunner = lazy(() => import('@/pages/admin/ChatbotTestRunner'));
const SmartleadTestPage = lazy(() => import('@/pages/admin/SmartleadTestPage'));
const ThirtyQuestionTest = lazy(() => import('@/pages/admin/ThirtyQuestionTest'));
const ListingPipelineTest = lazy(() => import('@/pages/admin/ListingPipelineTest'));

const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function TestingHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'enrichment';

  const setTab = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Testing & Diagnostics</h1>
            <p className="text-sm text-muted-foreground">
              Enrichment tests, system integration tests, DocuSeal health checks, Smartlead
              integration, and AI chatbot QA.
            </p>
          </div>
        </div>
      </div>
      <div className="px-8 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="enrichment" className="gap-2">
              <Beaker className="h-4 w-4" />
              Enrichment Test
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              System Tests
            </TabsTrigger>
            <TabsTrigger value="docuseal" className="gap-2">
              <Activity className="h-4 w-4" />
              DocuSeal Health
            </TabsTrigger>
            <TabsTrigger value="smartlead" className="gap-2">
              <Mail className="h-4 w-4" />
              Smartlead
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="gap-2">
              <Bot className="h-4 w-4" />
              AI Chatbot
            </TabsTrigger>
            <TabsTrigger value="30q" className="gap-2">
              <ListChecks className="h-4 w-4" />
              30-Question QA
            </TabsTrigger>
            <TabsTrigger value="listing-pipeline" className="gap-2">
              <Store className="h-4 w-4" />
              Listing Pipeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enrichment">
            <Suspense fallback={<Loading />}>
              <EnrichmentTest />
            </Suspense>
          </TabsContent>

          <TabsContent value="system">
            <Suspense fallback={<Loading />}>
              <SystemTestRunner />
            </Suspense>
          </TabsContent>

          <TabsContent value="docuseal">
            <Suspense fallback={<Loading />}>
              <DocuSealHealthCheck />
            </Suspense>
          </TabsContent>

          <TabsContent value="smartlead">
            <Suspense fallback={<Loading />}>
              <SmartleadTestPage />
            </Suspense>
          </TabsContent>

          <TabsContent value="chatbot">
            <Suspense fallback={<Loading />}>
              <ChatbotTestRunner />
            </Suspense>
          </TabsContent>

          <TabsContent value="30q">
            <Suspense fallback={<Loading />}>
              <ThirtyQuestionTest />
            </Suspense>
          </TabsContent>

          <TabsContent value="listing-pipeline">
            <Suspense fallback={<Loading />}>
              <ListingPipelineTest />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
