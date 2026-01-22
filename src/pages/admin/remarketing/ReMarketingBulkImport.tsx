import React, { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Upload, 
  Database, 
  Users, 
  Building, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Trash2,
  Play,
  Star,
  Brain
} from 'lucide-react';
import { ImportValidationPanel } from '@/components/remarketing/ImportValidationPanel';

interface ParsedData {
  universes: any[];
  buyers: any[];
  contacts: any[];
  transcripts: any[];
  scores: any[];
  learningHistory: any[];
  companies: any[];
}

interface ImportResults {
  universes: { imported: number; errors: string[] };
  buyers: { imported: number; errors: string[] };
  contacts: { imported: number; errors: string[] };
  transcripts: { imported: number; errors: string[] };
  scores: { imported: number; errors: string[] };
  learningHistory: { imported: number; errors: string[] };
  dealMappings: Record<string, string>;
}

function DataBadge({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{count}</p>
      </div>
    </div>
  );
}

function ResultRow({ label, result }: { label: string; result: { imported: number; errors: string[] } }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Badge className="bg-green-500">{result.imported} imported</Badge>
        {result.errors.length > 0 && (
          <Badge variant="destructive">{result.errors.length} errors</Badge>
        )}
      </div>
    </div>
  );
}

export default function ReMarketingBulkImport() {
  const [parsedData, setParsedData] = useState<ParsedData>({
    universes: [],
    buyers: [],
    contacts: [],
    transcripts: [],
    scores: [],
    learningHistory: [],
    companies: [],
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [progress, setProgress] = useState(0);

  const loadAllCSVs = async () => {
    setIsLoading(true);
    setProgress(0);
    
    const files = [
      { key: 'universes', path: '/data/industry_trackers.csv' },
      { key: 'buyers', path: '/data/buyers.csv' },
      { key: 'contacts', path: '/data/buyer_contacts.csv' },
      { key: 'transcripts', path: '/data/buyer_transcripts.csv' },
      { key: 'scores', path: '/data/buyer_deal_scores.csv' },
      { key: 'learningHistory', path: '/data/buyer_learning_history.csv' },
      { key: 'companies', path: '/data/companies.csv' },
    ];

    const newData: ParsedData = {
      universes: [],
      buyers: [],
      contacts: [],
      transcripts: [],
      scores: [],
      learningHistory: [],
      companies: [],
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const response = await fetch(file.path);
        if (!response.ok) {
          console.warn(`Could not fetch ${file.path}`);
          continue;
        }
        const text = await response.text();
        
        const result = Papa.parse(text, {
          header: true,
          delimiter: ';',
          skipEmptyLines: true,
        });
        
        (newData as any)[file.key] = result.data;
        setProgress(((i + 1) / files.length) * 100);
      } catch (e) {
        console.error(`Error loading ${file.path}:`, e);
      }
    }

    setParsedData(newData);
    setIsLoading(false);
    toast.success('All CSV files loaded');
  };

  const clearExistingData = async () => {
    setIsClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import-remarketing', {
        body: { action: 'clear' }
      });
      
      if (error) throw error;
      toast.success('Cleared all existing remarketing data');
    } catch (e: any) {
      toast.error(`Failed to clear data: ${e.message}`);
    }
    setIsClearing(false);
  };

  const runImport = async () => {
    if (!parsedData.universes.length && !parsedData.buyers.length) {
      toast.error('No data loaded. Click "Load All CSVs" first.');
      return;
    }

    setIsImporting(true);
    setProgress(0);
    
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import-remarketing', {
        body: { 
          action: 'import',
          data: parsedData
        }
      });
      
      if (error) throw error;
      
      setResults(data as ImportResults);
      toast.success('Import complete!');
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    }
    
    setIsImporting(false);
    setProgress(100);
  };

  const totalLoaded = 
    parsedData.universes.length + 
    parsedData.buyers.length + 
    parsedData.contacts.length + 
    parsedData.transcripts.length +
    parsedData.scores.length +
    parsedData.learningHistory.length +
    parsedData.companies.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Data Import</h1>
        <p className="text-muted-foreground">
          Import all reference data from CSV files in one operation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                Load CSV Files
              </CardTitle>
              <CardDescription>
                Load all CSV files from /public/data directory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={loadAllCSVs} 
                  disabled={isLoading}
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Load All CSVs
                </Button>
                
                {totalLoaded > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {totalLoaded} total rows loaded
                  </Badge>
                )}
              </div>
              
              {isLoading && (
                <Progress value={progress} className="mt-4" />
              )}
              
              {totalLoaded > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DataBadge icon={<Database className="h-4 w-4" />} label="Universes" count={parsedData.universes.length} />
                  <DataBadge icon={<Building className="h-4 w-4" />} label="Buyers" count={parsedData.buyers.length} />
                  <DataBadge icon={<Users className="h-4 w-4" />} label="Contacts" count={parsedData.contacts.length} />
                  <DataBadge icon={<FileText className="h-4 w-4" />} label="Transcripts" count={parsedData.transcripts.length} />
                  <DataBadge icon={<Star className="h-4 w-4" />} label="Scores" count={parsedData.scores.length} />
                  <DataBadge icon={<Brain className="h-4 w-4" />} label="Learning" count={parsedData.learningHistory.length} />
                  <DataBadge icon={<FileText className="h-4 w-4" />} label="Companies" count={parsedData.companies.length} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                Clear Existing Data (Optional)
              </CardTitle>
              <CardDescription>
                Remove all existing remarketing data before importing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={clearExistingData} 
                disabled={isClearing}
                variant="destructive"
              >
                {isClearing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Clear All Remarketing Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                Run Import
              </CardTitle>
              <CardDescription>
                Import all loaded data with automatic ID mapping
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={runImport} 
                disabled={isImporting || totalLoaded === 0}
                className="bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {isImporting ? 'Importing...' : 'Run Full Import'}
              </Button>
            </CardContent>
          </Card>

          {results && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ResultRow label="Universes" result={results.universes} />
                <ResultRow label="Buyers" result={results.buyers} />
                <ResultRow label="Contacts" result={results.contacts} />
                <ResultRow label="Transcripts" result={results.transcripts} />
                <ResultRow label="Scores" result={results.scores} />
                <ResultRow label="Learning History" result={results.learningHistory} />
                
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Deal Mappings Created: {Object.keys(results.dealMappings || {}).length}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ImportValidationPanel />
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Import Order</AlertTitle>
            <AlertDescription className="text-xs">
              Data is imported in dependency order: Universes → Buyers → Contacts/Transcripts → Scores → Learning History. 
              ID mappings are created automatically.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
