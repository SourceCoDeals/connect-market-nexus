import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Download, 
  Upload, 
  ExternalLink, 
  ChevronDown,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  Building2,
  Users,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CRMExportPanelProps {
  selectedScores: Array<{
    id: string;
    buyer: {
      id: string;
      company_name: string;
      contacts?: Array<{
        name: string;
        email: string;
        title?: string;
        phone?: string;
      }>;
    };
    tier: string;
    composite_score: number;
    status: string;
    listing?: {
      id: string;
      title: string;
    };
  }>;
  onExportComplete?: () => void;
  className?: string;
}

type ExportFormat = 'csv' | 'hubspot' | 'salesforce';

interface FieldMapping {
  id: string;
  label: string;
  crmField: string;
  enabled: boolean;
  required?: boolean;
}

const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  { id: 'company_name', label: 'Company Name', crmField: 'Company', enabled: true, required: true },
  { id: 'contact_name', label: 'Contact Name', crmField: 'First Name / Last Name', enabled: true },
  { id: 'contact_email', label: 'Email', crmField: 'Email', enabled: true, required: true },
  { id: 'contact_phone', label: 'Phone', crmField: 'Phone', enabled: true },
  { id: 'contact_title', label: 'Title', crmField: 'Job Title', enabled: true },
  { id: 'tier', label: 'Match Tier', crmField: 'Custom: Match Tier', enabled: true },
  { id: 'score', label: 'Match Score', crmField: 'Custom: Match Score', enabled: true },
  { id: 'deal_name', label: 'Deal Name', crmField: 'Deal Name', enabled: true },
  { id: 'source', label: 'Source', crmField: 'Lead Source', enabled: true },
];

export const CRMExportPanel = ({
  selectedScores,
  onExportComplete,
  className
}: CRMExportPanelProps) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(DEFAULT_FIELD_MAPPINGS);
  const [isExporting, setIsExporting] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);

  const toggleField = (fieldId: string) => {
    setFieldMappings(mappings =>
      mappings.map(m =>
        m.id === fieldId && !m.required ? { ...m, enabled: !m.enabled } : m
      )
    );
  };

  const generateCSV = (): string => {
    const enabledFields = fieldMappings.filter(f => f.enabled);
    const headers = enabledFields.map(f => f.label).join(',');
    
    const rows = selectedScores.flatMap(score => {
      const contacts = score.buyer.contacts || [];
      if (contacts.length === 0) {
        // Create row without contact info
        return [enabledFields.map(field => {
          switch (field.id) {
            case 'company_name': return `"${score.buyer.company_name}"`;
            case 'contact_name': return '""';
            case 'contact_email': return '""';
            case 'contact_phone': return '""';
            case 'contact_title': return '""';
            case 'tier': return `"Tier ${score.tier}"`;
            case 'score': return score.composite_score.toString();
            case 'deal_name': return `"${score.listing?.title || ''}"`;
            case 'source': return '"Remarketing Engine"';
            default: return '""';
          }
        }).join(',')];
      }
      
      // Create a row for each contact
      return contacts.map(contact => 
        enabledFields.map(field => {
          switch (field.id) {
            case 'company_name': return `"${score.buyer.company_name}"`;
            case 'contact_name': return `"${contact.name}"`;
            case 'contact_email': return `"${contact.email}"`;
            case 'contact_phone': return `"${contact.phone || ''}"`;
            case 'contact_title': return `"${contact.title || ''}"`;
            case 'tier': return `"Tier ${score.tier}"`;
            case 'score': return score.composite_score.toString();
            case 'deal_name': return `"${score.listing?.title || ''}"`;
            case 'source': return '"Remarketing Engine"';
            default: return '""';
          }
        }).join(',')
      );
    });

    return `${headers}\n${rows.join('\n')}`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      if (exportFormat === 'csv') {
        const csv = generateCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `remarketing-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`Exported ${selectedScores.length} buyers to CSV`);
      } else {
        // For HubSpot/Salesforce - show coming soon message
        toast.info(`${exportFormat === 'hubspot' ? 'HubSpot' : 'Salesforce'} integration coming soon! Use CSV export for now.`);
      }
      
      onExportComplete?.();
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const contactCount = selectedScores.reduce((sum, s) => 
    sum + (s.buyer.contacts?.length || 0), 0
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          CRM Export
        </CardTitle>
        <CardDescription>
          Export selected buyers to your CRM or as a CSV file
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Summary */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">{selectedScores.length} buyers selected</p>
            <p className="text-sm text-muted-foreground">
              {contactCount} contacts will be exported
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {contactCount}
          </Badge>
        </div>

        {/* Export Format Selection */}
        <div className="space-y-2">
          <Label>Export Format</Label>
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV File
                </div>
              </SelectItem>
              <SelectItem value="hubspot">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  HubSpot (Coming Soon)
                </div>
              </SelectItem>
              <SelectItem value="salesforce">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Salesforce (Coming Soon)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Field Mapping (Collapsible) */}
        <Collapsible open={isFieldsOpen} onOpenChange={setIsFieldsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2">
              <span className="text-sm font-medium">Field Mapping</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isFieldsOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 p-2 border rounded-lg mt-2">
              {fieldMappings.map(field => (
                <div 
                  key={field.id}
                  className="flex items-center justify-between p-2 hover:bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={field.id}
                      checked={field.enabled}
                      onCheckedChange={() => toggleField(field.id)}
                      disabled={field.required}
                    />
                    <Label 
                      htmlFor={field.id} 
                      className={cn(
                        "cursor-pointer",
                        field.required && "text-muted-foreground"
                      )}
                    >
                      {field.label}
                      {field.required && <span className="text-xs ml-1">(required)</span>}
                    </Label>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    → {field.crmField}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Export Button */}
        <Button 
          onClick={handleExport}
          disabled={selectedScores.length === 0 || isExporting}
          className="w-full"
        >
          {isExporting ? (
            <>
              <Download className="h-4 w-4 mr-2 animate-pulse" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export {selectedScores.length} Buyers
            </>
          )}
        </Button>

        {/* Quick Actions */}
        {exportFormat === 'csv' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>CSV is compatible with all major CRMs</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CRMExportPanel;
