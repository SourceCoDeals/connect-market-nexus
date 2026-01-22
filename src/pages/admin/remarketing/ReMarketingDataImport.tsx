import React, { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { 
  Upload, 
  Database, 
  Users, 
  Building2, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ArrowRight,
  AlertTriangle,
  GitMerge
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DealMergePanel } from '@/components/remarketing';

type DataType = 'universes' | 'buyers' | 'contacts' | 'scores' | 'transcripts';

interface ImportStep {
  id: DataType;
  label: string;
  icon: React.ReactNode;
  description: string;
  dependsOn?: DataType;
}

const IMPORT_STEPS: ImportStep[] = [
  { 
    id: 'universes', 
    label: 'Industry Universes', 
    icon: <Database className="h-5 w-5" />,
    description: '9 industry trackers with M&A guides'
  },
  { 
    id: 'buyers', 
    label: 'Buyers', 
    icon: <Building2 className="h-5 w-5" />,
    description: '114 PE firms and platforms',
    dependsOn: 'universes'
  },
  { 
    id: 'contacts', 
    label: 'Contacts', 
    icon: <Users className="h-5 w-5" />,
    description: '484 buyer contacts',
    dependsOn: 'buyers'
  },
  { 
    id: 'transcripts', 
    label: 'Transcripts', 
    icon: <FileText className="h-5 w-5" />,
    description: '8 call transcripts',
    dependsOn: 'buyers'
  },
];

interface ImportResult {
  imported: number;
  errors: string[];
  idMapping?: Record<string, string>;
}

export default function ReMarketingDataImport() {
  const [currentStep, setCurrentStep] = useState<DataType>('universes');
  const [completedSteps, setCompletedSteps] = useState<Set<DataType>>(new Set());
  const [idMappings, setIdMappings] = useState<{
    universes: Record<string, string>;
    buyers: Record<string, string>;
  }>({ universes: {}, buyers: {} });
  const [results, setResults] = useState<Record<DataType, ImportResult | null>>({
    universes: null,
    buyers: null,
    contacts: null,
    scores: null,
    transcripts: null,
  });
  const [parsedData, setParsedData] = useState<Record<DataType, any[]>>({
    universes: [],
    buyers: [],
    contacts: [],
    scores: [],
    transcripts: [],
  });

  const importMutation = useMutation({
    mutationFn: async ({ dataType, data }: { dataType: DataType; data: any[] }) => {
      const { data: result, error } = await supabase.functions.invoke('import-reference-data', {
        body: {
          dataType,
          data,
          options: {
            universeIdMapping: idMappings.universes,
            buyerIdMapping: idMappings.buyers,
          }
        }
      });

      if (error) throw error;
      return result as ImportResult;
    },
    onSuccess: (result, { dataType }) => {
      setResults(prev => ({ ...prev, [dataType]: result }));
      
      if (result.idMapping) {
        if (dataType === 'universes') {
          setIdMappings(prev => ({ ...prev, universes: result.idMapping! }));
        } else if (dataType === 'buyers') {
          setIdMappings(prev => ({ ...prev, buyers: result.idMapping! }));
        }
      }

      if (result.errors.length === 0) {
        setCompletedSteps(prev => new Set([...prev, dataType]));
        toast.success(`Imported ${result.imported} ${dataType} successfully!`);
      } else {
        toast.warning(`Imported ${result.imported} ${dataType} with ${result.errors.length} errors`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    }
  });

  const handleFileUpload = useCallback((dataType: DataType, file: File) => {
    const delimiter = dataType === 'universes' ? ';' : ',';
    
    Papa.parse(file, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        console.log(`Parsed ${results.data.length} rows for ${dataType}`);
        setParsedData(prev => ({ ...prev, [dataType]: results.data as any[] }));
        toast.success(`Loaded ${results.data.length} ${dataType} records`);
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      }
    });
  }, []);

  const handleImport = (dataType: DataType) => {
    const data = parsedData[dataType];
    if (data.length === 0) {
      toast.error(`No data loaded for ${dataType}`);
      return;
    }
    importMutation.mutate({ dataType, data });
  };

  const getStepStatus = (step: ImportStep): 'pending' | 'ready' | 'loading' | 'complete' | 'error' => {
    if (completedSteps.has(step.id)) return 'complete';
    if (importMutation.isPending && currentStep === step.id) return 'loading';
    if (results[step.id]?.errors.length) return 'error';
    if (step.dependsOn && !completedSteps.has(step.dependsOn)) return 'pending';
    if (parsedData[step.id].length > 0) return 'ready';
    return 'pending';
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Data Migration</h1>
        <p className="text-muted-foreground mt-1">
          Import reference data and merge deals from SourceCo Whispers project
        </p>
      </div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList>
          <TabsTrigger value="import">
            <Upload className="mr-2 h-4 w-4" />
            Import Reference Data
          </TabsTrigger>
          <TabsTrigger value="merge">
            <GitMerge className="mr-2 h-4 w-4" />
            Merge Deals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-8">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Import order matters! Universes must be imported first, then Buyers, then Contacts.
              Each step creates ID mappings used by the next step.
            </AlertDescription>
          </Alert>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Import Progress</CardTitle>
          <CardDescription>
            {completedSteps.size} of {IMPORT_STEPS.length} steps completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress 
            value={(completedSteps.size / IMPORT_STEPS.length) * 100} 
            className="h-2"
          />
          <div className="flex justify-between mt-4">
            {IMPORT_STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-2">
                <div className={`
                  p-2 rounded-full 
                  ${completedSteps.has(step.id) ? 'bg-green-500/20 text-green-500' : 
                    currentStep === step.id ? 'bg-primary/20 text-primary' : 
                    'bg-muted text-muted-foreground'}
                `}>
                  {step.icon}
                </div>
                {idx < IMPORT_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import Steps */}
      <div className="grid gap-6">
        {IMPORT_STEPS.map((step) => {
          const status = getStepStatus(step);
          const result = results[step.id];
          const dataCount = parsedData[step.id].length;

          return (
            <Card 
              key={step.id}
              className={`transition-all ${currentStep === step.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setCurrentStep(step.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`
                    p-3 rounded-lg
                    ${status === 'complete' ? 'bg-green-500/20' : 
                      status === 'error' ? 'bg-destructive/20' :
                      status === 'loading' ? 'bg-primary/20' :
                      'bg-muted'}
                  `}>
                    {status === 'loading' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : status === 'complete' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : status === 'error' ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{step.label}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {dataCount > 0 && (
                    <Badge variant="secondary">{dataCount} loaded</Badge>
                  )}
                  {result && (
                    <Badge variant={result.errors.length ? 'destructive' : 'default'}>
                      {result.imported} imported
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(step.id, file);
                      }}
                      className="hidden"
                      id={`file-${step.id}`}
                      disabled={status === 'pending' && step.dependsOn !== undefined}
                    />
                    <label htmlFor={`file-${step.id}`}>
                      <Button 
                        variant="outline" 
                        asChild
                      >
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          Load CSV
                        </span>
                      </Button>
                    </label>
                  </div>
                  <Button
                    onClick={() => handleImport(step.id)}
                    disabled={
                      status === 'pending' || 
                      status === 'loading' || 
                      status === 'complete' ||
                      dataCount === 0
                    }
                  >
                    {status === 'loading' ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                    ) : status === 'complete' ? (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Complete</>
                    ) : (
                      <>Import {step.label}</>
                    )}
                  </Button>
                </div>

                {/* Errors Display */}
                {result?.errors.length ? (
                  <ScrollArea className="h-32 mt-4 p-3 bg-destructive/10 rounded-lg">
                    <div className="space-y-1 text-sm">
                      {result.errors.slice(0, 20).map((error, i) => (
                        <p key={i} className="text-destructive">{error}</p>
                      ))}
                      {result.errors.length > 20 && (
                        <p className="text-muted-foreground">
                          ...and {result.errors.length - 20} more errors
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                ) : null}

                {/* Dependency Notice */}
                {step.dependsOn && !completedSteps.has(step.dependsOn) && (
                  <Alert variant="default" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Import {IMPORT_STEPS.find(s => s.id === step.dependsOn)?.label} first
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ID Mappings Display */}
      {Object.keys(idMappings.universes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ID Mappings Created</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Universe mappings: {Object.keys(idMappings.universes).length}</p>
            <p>Buyer mappings: {Object.keys(idMappings.buyers).length}</p>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="merge">
          <DealMergePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
