import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, RefreshCw, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RestorePreview {
  profile_id: string;
  email: string;
  current_categories: any;
  raw_categories: any;
  current_locations: any;
  raw_locations: any;
  restoration_needed: string;
  issue_type: string;
}

interface RestoreResult {
  profile_id: string;
  restoration_type: string;
  old_value: any;
  new_value: any;
  details: string;
}

export const AutomatedDataRestoration: React.FC = () => {
  const [previewData, setPreviewData] = useState<RestorePreview[]>([]);
  const [restoreResults, setRestoreResults] = useState<RestoreResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('preview_profile_data_restoration');
      
      if (error) throw error;
      
      setPreviewData(data || []);
      setShowPreview(true);
      toast({
        title: "Preview loaded",
        description: `Found ${data?.length || 0} profiles that need restoration`,
      });
    } catch (error) {
      console.error('Error loading preview:', error);
      toast({
        title: "Error",
        description: "Failed to load restoration preview",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const executeRestoration = async () => {
    setIsRestoring(true);
    try {
      const { data, error } = await supabase.rpc('restore_profile_data_automated');
      
      if (error) throw error;
      
      setRestoreResults(data || []);
      toast({
        title: "Restoration completed",
        description: `Successfully restored data for ${data?.length || 0} profile fields`,
      });
      
      // Refresh preview to show updated state
      setTimeout(() => {
        loadPreview();
      }, 1000);
    } catch (error) {
      console.error('Error executing restoration:', error);
      toast({
        title: "Error",
        description: "Failed to execute restoration",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const getIssueTypeColor = (issueType: string) => {
    if (issueType.includes('over_standardized')) return 'destructive';
    if (issueType.includes('wrong_standardization')) return 'destructive';
    if (issueType.includes('lost_all_industries')) return 'destructive';
    if (issueType.includes('corrupted_field')) return 'destructive';
    return 'secondary';
  };

  const formatJsonArray = (arr: any[]) => {
    if (!arr || !Array.isArray(arr)) return '—';
    return arr.join(', ');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Automated Data Restoration
          </CardTitle>
          <CardDescription>
            Automatically restore over-standardized and corrupted profile data using original signup snapshots.
            This fixes data integrity issues without requiring user intervention.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={loadPreview}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {isLoading ? 'Loading...' : 'Preview Restoration'}
            </Button>
            
            {showPreview && previewData.length > 0 && (
              <Button 
                onClick={executeRestoration}
                disabled={isRestoring}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {isRestoring ? 'Restoring...' : `Restore ${previewData.length} Profiles`}
              </Button>
            )}
          </div>

          {showPreview && previewData.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No profiles need restoration. All data appears to be intact.
              </AlertDescription>
            </Alert>
          )}

          {restoreResults.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully restored {restoreResults.length} profile fields. 
                Changes have been logged in the audit trail.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview Table */}
      {showPreview && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Profiles Needing Restoration</span>
              <Badge variant="destructive">{previewData.length} issues found</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Current Categories</TableHead>
                  <TableHead>Raw Categories</TableHead>
                  <TableHead>Current Locations</TableHead>
                  <TableHead>Raw Locations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((profile) => (
                  <TableRow key={profile.profile_id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
                    <TableCell>
                      <Badge variant={getIssueTypeColor(profile.issue_type)}>
                        {profile.issue_type}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {profile.restoration_needed}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatJsonArray(profile.current_categories)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-green-600">
                        {formatJsonArray(profile.raw_categories)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatJsonArray(profile.current_locations)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-green-600">
                        {formatJsonArray(profile.raw_locations)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Restoration Results */}
      {restoreResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Restoration Results</span>
              <Badge variant="default">{restoreResults.length} fields restored</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile ID</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restoreResults.map((result, index) => (
                  <TableRow key={`${result.profile_id}-${index}`}>
                    <TableCell className="font-mono text-xs">
                      {result.profile_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{result.restoration_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-red-600 max-w-xs truncate">
                        {JSON.stringify(result.old_value)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-green-600 max-w-xs truncate">
                        {JSON.stringify(result.new_value)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {result.details}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};