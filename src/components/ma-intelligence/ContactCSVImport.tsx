import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizeDomain } from "@/lib/ma-intelligence/normalizeDomain";

interface ContactCSVImportProps {
  trackerId: string;
  onImportComplete: () => void;
}

export function ContactCSVImport({ trackerId, onImportComplete }: ContactCSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(0);

    try {
      // Read file content
      const text = await file.text();
      const rows = text.split("\n").filter(row => row.trim());

      if (rows.length === 0) {
        throw new Error("CSV file is empty");
      }

      // Parse header
      const headers = rows[0].split(",").map(h => h.trim());

      // Call mapping edge function
      const { data: mappingData, error: mappingError } = await supabase.functions.invoke("map-csv-columns", {
        body: {
          columns: headers,
        },
      });

      if (mappingError) throw mappingError;

      const columnMapping = mappingData.mapping;

      // Parse and import data
      const buyers = [];
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(",").map(v => v.trim());
        const buyer: any = {
          industry_tracker_id: trackerId,
        };

        // Map columns
        headers.forEach((header, index) => {
          const mappedField = columnMapping[header];
          if (mappedField && values[index]) {
            buyer[mappedField] = values[index];
          }
        });

        buyers.push(buyer);
        setProgress(Math.round((i / rows.length) * 100));
      }

      // Bulk upsert - skip duplicates by name within same universe
      const { data: inserted, error: insertError } = await supabase
        .from("remarketing_buyers")
        .upsert(buyers, { onConflict: 'universe_id,lower(trim(company_name)),lower(trim(COALESCE(pe_firm_name,\'\')))', ignoreDuplicates: true })
        .select('id');

      if (insertError) {
        if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          throw new Error("Some buyers already exist in this universe (matched by website domain). Remove duplicates and try again.");
        }
        throw insertError;
      }

      const actualCount = inserted?.length || 0;
      const skipped = buyers.length - actualCount;
      setImportedCount(actualCount);
      toast({
        title: "Import successful",
        description: `Imported ${actualCount} buyers${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`,
      });

      setTimeout(() => {
        onImportComplete();
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="csv-file">Select CSV File</Label>
        <div className="flex items-center gap-3">
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById("csv-file")?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose File
          </Button>
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              {file.name}
            </div>
          )}
        </div>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Importing buyers...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {importedCount > 0 && !isUploading && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          Successfully imported {importedCount} buyers
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={handleUpload}
          disabled={!file || isUploading}
        >
          Import Buyers
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <p className="font-medium mb-1">Expected CSV columns:</p>
        <ul className="text-xs space-y-0.5 ml-4">
          <li>• PE Firm Name (required)</li>
          <li>• Platform Company Name</li>
          <li>• PE Firm Website</li>
          <li>• Platform Website</li>
          <li>• HQ City, HQ State</li>
        </ul>
      </div>
    </div>
  );
}
