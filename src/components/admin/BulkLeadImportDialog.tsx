import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { CreateInboundLeadData } from "@/hooks/admin/use-inbound-leads";

interface BulkLeadImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (leads: CreateInboundLeadData[]) => void;
  isLoading?: boolean;
}

interface ParsedLead {
  data: CreateInboundLeadData;
  errors: string[];
  index: number;
  isDuplicate?: boolean;
  duplicateInfo?: string;
}

export const BulkLeadImportDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}: BulkLeadImportDialogProps) => {
  const [csvText, setCsvText] = useState("");
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("manual");

  const sourceOptions = [
    { value: "manual", label: "Manual Entry" },
    { value: "webflow", label: "Webflow Form" },
    { value: "website", label: "Website Form" },
    { value: "referral", label: "Referral" },
    { value: "cold_outreach", label: "Cold Outreach" },
    { value: "networking", label: "Networking" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "email", label: "Email Campaign" },
  ];

  const sampleCSV = `Supported headers (flexible): Name, Email address, Company name, Phone number, Role, Message, Date
Example (comma CSV):
Name,Email address,Company name,Phone number,Role,Message
John Smith,john@kinderhook.com,Kinderhook Partners,555-0123,Partner,"Interested in SaaS opportunities"

Example (tab TSV with Date column):
Date	Name	Email address	Company name	Phone number	Role	Message
08/27/2025 9:37:24 pm	Paul Cifelli	pcifelli@kinderhook.com	Kinderhook Industries	12017451613	Private Equity	"Automotive, value added distribution, environmental services and healthcare services"`;


  const parseCSV = () => {
    if (!csvText.trim()) {
      setParseErrors(["Please enter CSV data"]);
      return;
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      setParseErrors(["CSV must have at least a header row and one data row"]);
      return;
    }

    // Handle both comma and tab delimited data
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    const errors: string[] = [];
    const leads: ParsedLead[] = [];

    // Flexible column name matching
    const findColumn = (variations: string[]) => {
      return headers.findIndex(h => variations.some(v => h.includes(v.toLowerCase())));
    };

    const nameIndex = findColumn(['name','full name','contact name']);
    const emailIndex = findColumn(['email address','email','e-mail']);
    const companyIndex = findColumn(['company name','company','organization','organisation','firm','fund']);
    const phoneIndex = findColumn(['phone number','phone','mobile','telephone','cell']);
    const roleIndex = findColumn(['role','buyer type','buyer','type','investor type','buyer role']);
    const messageIndex = findColumn(['message','notes','comment','comments','details','inquiry','note']);

    // Validate required columns
    if (nameIndex === -1) {
      errors.push("Missing required column: Name");
    }
    if (emailIndex === -1) {
      errors.push("Missing required column: Email");
    }
    
    if (errors.length > 0) {
      setParseErrors(errors);
      return;
    }

    // Helper to split CSV/TSV respecting quotes
    const splitCSVLine = (line: string, delimiter: string): string[] => {
      if (delimiter === ',') {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
            continue;
          }
          current += char;
        }
        result.push(current);
        return result.map(v => v.trim().replace(/^"|"$/g, ''));
      }
      return line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''));
    };

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = splitCSVLine(lines[i], delimiter);
      const leadErrors: string[] = [];
      
      if (values.length !== headers.length) {
        leadErrors.push(`Row ${i + 1}: Column count mismatch`);
        continue;
      }

      const leadData: CreateInboundLeadData = {
        name: nameIndex >= 0 ? values[nameIndex] || '' : '',
        email: emailIndex >= 0 ? values[emailIndex] || '' : '',
        company_name: companyIndex >= 0 ? values[companyIndex] || '' : '',
        phone_number: phoneIndex >= 0 ? values[phoneIndex] || '' : '',
        role: roleIndex >= 0 ? values[roleIndex] || '' : '',
        message: messageIndex >= 0 ? values[messageIndex] || '' : '',
        source: selectedSource as any,
        source_form_name: 'bulk_import',
      };

      // Validate required fields
      if (!leadData.name) {
        leadErrors.push('Name is required');
      }
      if (!leadData.email || !leadData.email.includes('@')) {
        leadErrors.push('Valid email is required');
      }

      leads.push({
        data: leadData,
        errors: leadErrors,
        index: i + 1
      });
    }

    setParsedLeads(leads);
    setParseErrors(errors);
  };

  const handleImport = () => {
    const validLeads = parsedLeads.filter(lead => lead.errors.length === 0);
    if (validLeads.length > 0) {
      onConfirm(validLeads.map(lead => lead.data));
      handleClose();
    }
  };

  const handleClose = () => {
    setCsvText("");
    setParsedLeads([]);
    setParseErrors([]);
    setSelectedSource("manual");
    onClose();
  };

  const validLeads = parsedLeads.filter(lead => lead.errors.length === 0);
  const invalidLeads = parsedLeads.filter(lead => lead.errors.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Leads
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section - Scrollable */}
          <div className="flex flex-col max-h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              <div>
                <Label htmlFor="source-select">Lead Source</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select the source for all leads in this import.
                </p>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="csv-input">CSV Data</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Paste CSV/TSV. Headers like Email address, Company name, Phone number, Role, Message, Date are supported.
                </p>
                <Textarea
                  id="csv-input"
                  placeholder={`Date\tName\tEmail address\tCompany name\tPhone number\tRole\tMessage\n08/27/2025 9:37:24 pm\tJohn Smith\tjohn@example.com\tAcme Partners\t555-0123\tPrivate Equity\t"Interested in SaaS and services"`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="min-h-[160px] font-mono text-xs"
                />
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Sample Format:</h4>
                <div className="bg-muted/50 border rounded-lg p-3">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {sampleCSV}
                  </pre>
                </div>
              </div>
            </div>

            {/* Parse Button - Fixed at bottom */}
            <div className="pt-4 border-t border-border/40 mt-4">
              <Button 
                onClick={parseCSV} 
                disabled={!csvText.trim() || isLoading}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Parse CSV
              </Button>
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-4 overflow-y-auto">
            <h4 className="text-sm font-semibold">Preview</h4>
            
            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs">
                    {parseErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {parsedLeads.length > 0 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {validLeads.length} Valid
                  </Badge>
                  {invalidLeads.length > 0 && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {invalidLeads.length} Invalid
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {parsedLeads.map((lead) => (
                    <div 
                      key={lead.index}
                      className={`p-3 rounded-lg border text-xs ${
                        lead.errors.length > 0 
                          ? 'bg-destructive/5 border-destructive/20' 
                          : 'bg-success/5 border-success/20'
                      }`}
                    >
                      <div className="font-medium">
                        Row {lead.index}: {lead.data.name || 'No Name'} ({lead.data.email || 'No Email'})
                      </div>
                      <div className="text-muted-foreground">
                        {lead.data.company_name && <span>{lead.data.company_name}</span>}
                        {lead.data.role && <span>{lead.data.company_name ? ' • ' : ''}Role: {lead.data.role}</span>}
                        {lead.data.phone_number && <span>{(lead.data.company_name || lead.data.role) ? ' • ' : ''}Phone: {lead.data.phone_number}</span>}
                      </div>
                      {lead.data.message && (
                        <div className="text-muted-foreground mt-1 break-words">“{lead.data.message}”</div>
                      )}
                      {lead.errors.length > 0 && (
                        <div className="text-destructive mt-1">
                          Errors: {lead.errors.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={validLeads.length === 0 || isLoading}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {isLoading ? "Importing..." : `Import ${validLeads.length} Lead${validLeads.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};