
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, AlertCircle, CheckCircle, FileText, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BulkListingParser } from "@/components/admin/BulkListingParser";
import { BulkListingPreview } from "@/components/admin/BulkListingPreview";
import { useBulkListingImport } from "@/hooks/admin/use-bulk-listing-import";
import { ParsedListing } from "@/types/bulk-listing";

const AdminBulkListings = () => {
  const [rawData, setRawData] = useState("");
  const [parsedListings, setParsedListings] = useState<ParsedListing[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  
  const { importListings, isLoading, progress, errors, results } = useBulkListingImport();

  const handleParseData = () => {
    if (!rawData.trim()) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "Please paste some listing data to parse",
      });
      return;
    }

    try {
      const parser = new BulkListingParser();
      const parsed = parser.parseRawData(rawData);
      setParsedListings(parsed);
      setShowPreview(true);
      
      toast({
        title: "Data Parsed Successfully",
        description: `Found ${parsed.length} listings`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Parse Error",
        description: error.message || "Failed to parse data",
      });
    }
  };

  const handleImport = async (dryRun = false) => {
    setIsDryRun(dryRun);
    
    if (parsedListings.length === 0) {
      toast({
        variant: "destructive",
        title: "No Listings",
        description: "Please parse some data first",
      });
      return;
    }

    try {
      await importListings(parsedListings, dryRun);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Import Error",
        description: error.message || "Failed to import listings",
      });
    }
  };

  const downloadTemplate = () => {
    const template = `Title: Multi Family Plumbing Contractor
Location: Southwest
Category: Consumer Services
Gross Revenue: $35,000,000
EBITDA: $5,000,000
Description: The company focuses exclusively on new construction for large multifamily projects in the Southwest. It has strong GC relationships, a skilled team, and scalable operations. The owner is looking for a partner that can help them grow through M&A.

____

Title: Tech Consulting Firm
Location: New York
Category: Technology
Gross Revenue: $2,500,000
EBITDA: $800,000
Description: A boutique technology consulting firm specializing in digital transformation for mid-market companies. Strong client relationships and recurring revenue model.

____`;

    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-listings-template.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Bulk Import Listings</h1>
          <p className="text-muted-foreground mt-1">
            Import multiple listings at once from raw text data
          </p>
        </div>
        <Button onClick={downloadTemplate} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <div className="space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Paste Listing Data
            </CardTitle>
            <CardDescription>
              Paste your raw listing data below. Separate multiple listings with "____" or similar dividers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your listing data here..."
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              className="min-h-[200px]"
            />
            <div className="flex gap-2">
              <Button onClick={handleParseData} disabled={!rawData.trim()}>
                Parse Data
              </Button>
              <Button 
                onClick={() => setRawData("")} 
                variant="outline"
                disabled={!rawData.trim()}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        {showPreview && parsedListings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="h-5 w-5 mr-2" />
                Preview Parsed Listings
                <Badge variant="secondary" className="ml-2">
                  {parsedListings.length} listings
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BulkListingPreview listings={parsedListings} />
              <Separator className="my-4" />
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleImport(true)}
                  variant="outline"
                  disabled={isLoading}
                >
                  Dry Run (Test Only)
                </Button>
                <Button 
                  onClick={() => handleImport(false)}
                  disabled={isLoading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Listings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Section */}
        {isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isDryRun ? "Validating Listings..." : "Importing Listings..."}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="mb-4" />
              <p className="text-sm text-muted-foreground">
                {progress}% complete
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {(errors.length > 0 || results.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully {isDryRun ? "validated" : "imported"} {results.length} listings
                  </AlertDescription>
                </Alert>
              )}
              
              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {errors.length} errors occurred during {isDryRun ? "validation" : "import"}
                  </AlertDescription>
                </Alert>
              )}

              {errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Errors:</h4>
                  {errors.map((error, index) => (
                    <div key={index} className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminBulkListings;
