import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertTriangle, 
  User, 
  Mail, 
  Building2, 
  ArrowRight,
  ExternalLink 
} from 'lucide-react';

interface UserConflictWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflictData: {
    existingUser: {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      company?: string;
      created_at: string;
    };
    newLeadData: {
      name: string;
      email: string;
      company_name?: string;
      message?: string;
    };
  };
  onProceedWithExisting: () => void;
  onCreateDuplicate: () => void;
}

export const UserConflictWarningDialog = ({
  isOpen,
  onClose,
  conflictData,
  onProceedWithExisting,
  onCreateDuplicate,
}: UserConflictWarningDialogProps) => {
  if (!conflictData) return null;

  const { existingUser, newLeadData } = conflictData;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            User Account Conflict Detected
          </DialogTitle>
          <DialogDescription>
            A user with this email address already exists in the system. Choose how to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Existing User */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Existing User</span>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                      In System
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-blue-600" />
                      <span className="font-medium">{existingUser.email}</span>
                    </div>
                    <div>
                      <span className="font-medium">
                        {existingUser.first_name} {existingUser.last_name}
                      </span>
                    </div>
                    {existingUser.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-blue-600" />
                        <span>{existingUser.company}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Registered: {new Date(existingUser.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* New Lead Data */}
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-900">New Lead Data</span>
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                      From Webflow
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-orange-600" />
                      <span className="font-medium">{newLeadData.email}</span>
                    </div>
                    <div>
                      <span className="font-medium">{newLeadData.name}</span>
                    </div>
                    {newLeadData.company_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-orange-600" />
                        <span>{newLeadData.company_name}</span>
                      </div>
                    )}
                    {newLeadData.message && (
                      <div className="text-xs text-muted-foreground bg-white/50 p-2 rounded border">
                        "{newLeadData.message.substring(0, 100)}..."
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <strong>Recommendation:</strong> Use the existing user account to maintain data integrity and avoid duplicates.
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={onProceedWithExisting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Use Existing Account
                <span className="text-xs ml-2 opacity-80">(Recommended)</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={onCreateDuplicate}
                className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                Create Duplicate
                <span className="text-xs ml-2 opacity-80">(Not recommended)</span>
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
