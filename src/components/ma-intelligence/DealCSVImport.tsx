import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DealCSVImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackerId: string;
  onDealsImported: () => void;
}

export function DealCSVImport({ open, onOpenChange, trackerId, onDealsImported }: DealCSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportedCount(0);
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

      // Call deal column mapping edge function
      const { data: mappingData, error: mappingError } = await supabase.functions.invoke("map-deal-csv-columns", {
        body: {
          columns: headers,
        },
      });

      if (mappingError) throw mappingError;

      const columnMapping = mappingData.mapping;

      // Parse and import data
      const deals = [];
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(",").map(v => v.trim());
        const deal: any = {
          listing_id: trackerId,
        };

        // Map columns
        headers.forEach((header, index) => {
          const mappedField = columnMapping[header];
          if (mappedField && values[index]) {
            deal[mappedField] = values[index];
          }
        });

        deals.push(deal);
        setProgress(Math.round((i / rows.length) * 100));
      }

      // Bulk insert
      const { error: insertError } = await supabase
        .from("deals")
        .insert(deals);

      if (insertError) throw insertError;

      setImportedCount(deals.length);
      toast({
        title: "Import successful",
        description: `Imported ${deals.length} deals`,
      });

      setTimeout(() => {
        onDealsImported();
        onOpenChange(false);
        resetState();
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

  const resetState = () => {
    setFile(null);
    setProgress(0);
    setImportedCount(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Deals from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import deals into this tracker
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deal-csv-file">Select CSV File</Label>
            <div className="flex items-center gap-3">
              <input
                id="deal-csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("deal-csv-file")?.click()}
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
                <span>Importing deals...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {importedCount > 0 && !isUploading && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Successfully imported {importedCount} deals
            </div>
          )}

          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <p className="font-medium mb-1">Expected CSV columns:</p>
            <ul className="text-xs space-y-0.5 ml-4">
              <li>• Deal Name (required)</li>
              <li>• Company Website</li>
              <li>• Revenue, EBITDA</li>
              <li>• Headquarters, Location Count</li>
              <li>• Industry Type, Services</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Import Deals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
