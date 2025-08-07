import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { User } from "@/types";
import { CheckCircle, XCircle, MoreHorizontal, UserCheck, UserPlus, UserMinus, Trash2, ChevronDown, ChevronRight, ExternalLink, Mail, Building, UserIcon, Linkedin, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { UserSavedListings } from "./UserSavedListings";
import { UserDataCompleteness } from "./UserDataCompleteness";
import { DualFeeAgreementToggle } from "./DualFeeAgreementToggle";
import { SimpleFeeAgreementDialog } from "./SimpleFeeAgreementDialog";
import { DualNDAToggle } from "./DualNDAToggle";
import { SimpleNDADialog } from "./SimpleNDADialog";

import { getFieldCategories, FIELD_LABELS } from '@/lib/buyer-type-fields';
import { useEnhancedUserExport } from '@/hooks/admin/use-enhanced-user-export';
import { useLogFeeAgreementEmail } from '@/hooks/admin/use-fee-agreement';
import { useLogNDAEmail } from '@/hooks/admin/use-nda';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface UsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  onDelete: (user: User) => void;
  isLoading: boolean;
}

// Helper function to render user detail with proper field filtering
const UserDetails = ({ user }: { user: User }) => {
  // Get buyer-type specific field categories
  const fieldCategories = getFieldCategories(user.buyer_type || 'corporate');

  return (
    <div className="space-y-6 p-4 bg-muted/20 rounded-lg">
      {/* Account Information Section */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          Account Information
        </h4>
        <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Created:</span> {new Date(user.created_at).toLocaleString()}</div>
          <div>
            <span className="text-muted-foreground">Email Verified:</span> 
            {user.email_verified ? " Yes" : " No"}
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span> 
            <span className={`capitalize ml-1 ${
              user.approval_status === "approved" ? "text-green-600" : 
              user.approval_status === "rejected" ? "text-red-600" : 
              "text-yellow-600"
            }`}>
              {user.approval_status}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Admin:</span> {user.is_admin ? " Yes" : " No"}
          </div>
        </div>
      </div>

      {/* Render each field category dynamically */}
      {Object.entries(fieldCategories).map(([categoryName, fields]) => {
        if (fields.length === 0) return null;
        
        return (
          <div key={categoryName} className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              {categoryName === 'Contact Information' && <Mail className="h-4 w-4" />}
              {categoryName === 'Business Profile' && <Building className="h-4 w-4" />}
              {categoryName === 'Financial Information' && <UserIcon className="h-4 w-4" />}
              {categoryName}
              {categoryName === 'Financial Information' && ` (${user.buyer_type})`}
            </h4>
            <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {fields.map((fieldKey) => {
                const fieldLabel = FIELD_LABELS[fieldKey as keyof typeof FIELD_LABELS] || fieldKey;
                const fieldValue = user[fieldKey as keyof User];
                
                // Handle special field rendering
                if (fieldKey === 'website' && fieldValue) {
                  return (
                    <div key={fieldKey} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <a href={fieldValue as string} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        {fieldValue as string} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  );
                }
                
                if (fieldKey === 'linkedin_profile' && fieldValue) {
                  return (
                    <div key={fieldKey} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <a href={fieldValue as string} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <Linkedin className="h-3 w-3" />
                        Profile
                      </a>
                    </div>
                  );
                }
                
                if (fieldKey === 'business_categories') {
                  return (
                    <div key={fieldKey} className="col-span-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <div className="mt-1">
                        {fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {fieldValue.map((cat, index) => (
                              <span key={index} className="text-xs bg-muted px-2 py-1 rounded">
                                {cat}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </div>
                    </div>
                  );
                }
                
                if (fieldKey === 'ideal_target_description' || fieldKey === 'specific_business_search') {
                  return (
                    <div key={fieldKey} className="col-span-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <p className="mt-1 text-xs leading-relaxed">{fieldValue as string || '—'}</p>
                    </div>
                  );
                }
                
                if (fieldKey === 'revenue_range_min' || fieldKey === 'revenue_range_max') {
                  const numValue = fieldValue as number;
                  return (
                    <div key={fieldKey}>
                      <span className="text-muted-foreground">{fieldLabel}:</span> 
                      {numValue ? `$${numValue.toLocaleString()}` : '—'}
                    </div>
                  );
                }
                
                // Skip funded_by if user is not funded
                if (fieldKey === 'funded_by' && user.is_funded !== 'yes') {
                  return null;
                }
                
                // Default field rendering
                return (
                  <div key={fieldKey}>
                    <span className="text-muted-foreground">{fieldLabel}:</span> {fieldValue as string || '—'}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Saved Listings Section */}
      <div className="space-y-3">
        <UserSavedListings userId={user.id} />
      </div>
    </div>
  );
};

// Component for user action buttons
function UserActionButtons({ 
  user, 
  onApprove, 
  onMakeAdmin,
  onRevokeAdmin,
  onDelete,
  isLoading 
}: { 
  user: User;
  onApprove: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  onDelete: (user: User) => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const handleSendPasswordReset = async () => {
    try {
      const { error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'request', email: user.email }
      });
      if (error) throw error;
      toast({
        title: 'Password reset initiated',
        description: 'If the email exists, the user will receive a reset link.'
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to send reset',
        description: err.message || 'Please try again.'
      });
    }
  };
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isLoading}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {user.approval_status === "pending" && (
            <DropdownMenuItem 
              onClick={() => onApprove(user)}
              className="text-green-600"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Approve User
            </DropdownMenuItem>
          )}
          
          {user.approval_status === "rejected" && (
            <DropdownMenuItem 
              onClick={() => onApprove(user)}
              className="text-green-600"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Approve User
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {!user.is_admin ? (
            <DropdownMenuItem 
              onClick={() => onMakeAdmin(user)}
              className="text-blue-600"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Make Admin
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={() => onRevokeAdmin(user)}
              className="text-orange-600"
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Revoke Admin
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSendPasswordReset}>
            <Mail className="h-4 w-4 mr-2" />
            Send password reset
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => onDelete(user)}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Loading skeleton component
const UsersTableSkeleton = () => (
  <div className="space-y-3">
    <div className="h-10 bg-muted/50 rounded-md animate-pulse"></div>
    {Array(5)
      .fill(0)
      .map((_, i) => (
        <div key={i} className="h-20 bg-muted/30 rounded-md animate-pulse"></div>
      ))}
  </div>
);

export function UsersTable({ 
  users, 
  onApprove, 
  onMakeAdmin,
  onRevokeAdmin,
  onDelete,
  isLoading 
}: UsersTableProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [selectedUserForEmail, setSelectedUserForEmail] = useState<User | null>(null);
  const [selectedUserForNDA, setSelectedUserForNDA] = useState<User | null>(null);
  const { exportUsersToCSV } = useEnhancedUserExport();
  const logEmailMutation = useLogFeeAgreementEmail();
  const logNDAEmail = useLogNDAEmail();
  const { toast } = useToast();
  const { user: currentAuthUser } = useAuth();
  
  const handleSendEmail = async (emailData: {
    userId: string;
    userEmail: string;
    subject: string;
    content: string;
    attachments?: File[];
    useTemplate: boolean;
  }) => {
    // Sending fee agreement email
    try {
      // Get current admin user info first
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        throw new Error('Authentication required. Please refresh and try again.');
      }

      const { data: adminProfile, error: profileError } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', currentUser.id)
        .single();

      if (profileError || !adminProfile) {
        throw new Error('Admin profile not found. Please contact support.');
      }

      if (!adminProfile.first_name || !adminProfile.last_name || !adminProfile.email) {
        throw new Error('Incomplete admin profile. Please complete your profile first.');
      }

      const adminName = `${adminProfile.first_name} ${adminProfile.last_name}`;

      // Process attachments with validation
      const processedAttachments = [];
      if (emailData.attachments && emailData.attachments.length > 0) {
        // Processing attachments
        
        for (const file of emailData.attachments) {
          // Enhanced validation - stricter size limit and type checking
          if (file.size > 10 * 1024 * 1024) { // 10MB limit for safety
            console.warn(`📎 File ${file.name} exceeds 10MB limit (${Math.round(file.size / 1024 / 1024)}MB), skipping`);
            alert(`File "${file.name}" is too large. Please use files under 10MB.`);
            continue;
          }

          // Validate file type - only allow PDFs
          if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            console.warn(`📎 File ${file.name} is not a PDF (${file.type}), skipping`);
            alert(`File "${file.name}" must be a PDF document.`);
            continue;
          }

          try {
            // Processing attachment
            const buffer = await file.arrayBuffer();
            
            // Validate buffer size
            if (buffer.byteLength === 0) {
              console.warn(`📎 File ${file.name} is empty, skipping`);
              continue;
            }
            
            // Convert to base64 with proper encoding
            const uint8Array = new Uint8Array(buffer);
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binaryString += String.fromCharCode(uint8Array[i]);
            }
            const base64 = btoa(binaryString);
            
            // Validate base64 encoding worked
            if (!base64 || base64.length === 0) {
              console.error(`📎 Failed to encode ${file.name} to base64`);
              continue;
            }
            
            processedAttachments.push({
              name: file.name,
              content: base64,
              type: file.type || 'application/pdf'
            });
            
            // File processed successfully
          } catch (attachError) {
            console.error(`❌ Error processing attachment ${file.name}:`, attachError);
            alert(`Failed to process "${file.name}". Please try again or use a different file.`);
          }
        }
      }

      const requestPayload = {
        userId: emailData.userId,
        userEmail: emailData.userEmail,
        subject: emailData.subject,
        content: emailData.content,
        useTemplate: emailData.useTemplate,
        adminId: currentUser.id,
        adminEmail: adminProfile.email,
        adminName: adminName,
        attachments: processedAttachments
      };

      // Sending email request

      // Send the email via edge function
      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-fee-agreement-email', {
        body: requestPayload
      });

      if (emailError) {
        console.error('Edge function error:', emailError);
        const errorMessage = emailError.message || 'Failed to send email';
        toast({
          title: "Email Failed",
          description: errorMessage,
          variant: "destructive",
        });
        throw new Error(errorMessage);
      }

      if (!emailResult?.success) {
        console.error('Email sending failed:', emailResult);
        const errorMessage = emailResult?.error || 'Email sending failed';
        toast({
          title: "Email Failed", 
          description: errorMessage,
          variant: "destructive",
        });
        throw new Error(errorMessage);
      }

      // Email sent successfully
      toast({
        title: "Email Sent",
        description: `Fee agreement email sent successfully to ${emailData.userEmail}`,
      });

      // Edge function handles all logging - no additional logging needed
      // Fee agreement email sent successfully
    } catch (error) {
      console.error('❌ Fee agreement email error:', error);
      throw error;
    }
  };
  
  const toggleExpand = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };
  
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return "Invalid date";
    }
  };

  if (isLoading) {
    return <UsersTableSkeleton />;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
          <Button
            onClick={() => exportUsersToCSV(users)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="min-w-[200px]">User & Company</TableHead>
              <TableHead className="w-20">Type</TableHead>
              <TableHead className="w-20">Profile</TableHead>
              <TableHead className="w-16">Fee</TableHead>
              <TableHead className="w-16">NDA</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="hidden lg:table-cell w-24">Joined</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.flatMap((user) => [
              <TableRow 
                key={user.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleExpand(user.id)}
              >
                <TableCell className="w-8">
                  <Button variant="ghost" size="sm">
                    {expandedUserId === user.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{user.firstName} {user.lastName}</span>
                      {user.is_admin && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 px-1 py-0">
                          Admin
                        </Badge>
                      )}
                      {user.email_verified && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 px-1 py-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          ✓
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    {user.company && (
                      <div className="text-xs font-medium text-foreground truncate">{user.company}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="text-xs">
                    {user.buyer_type === 'privateEquity' ? 'PE' :
                     user.buyer_type === 'familyOffice' ? 'FO' :
                     user.buyer_type === 'searchFund' ? 'SF' :
                     user.buyer_type === 'corporate' ? 'Corp' :
                     user.buyer_type === 'individual' ? 'Indiv' : '—'}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <UserDataCompleteness user={user} size="sm" />
                </TableCell>
                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                  <DualFeeAgreementToggle 
                    user={user}
                    onSendEmail={(user) => setSelectedUserForEmail(user)}
                    size="sm"
                  />
                </TableCell>
                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                  <DualNDAToggle 
                    user={user}
                    onSendEmail={(user) => setSelectedUserForNDA(user)}
                    size="sm"
                  />
                </TableCell>
                <TableCell className="py-2">
                  {user.approval_status === "approved" && (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs px-2 py-1">
                      ✓
                    </Badge>
                  )}
                  {user.approval_status === "pending" && (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs px-2 py-1">
                      ⏳
                    </Badge>
                  )}
                  {user.approval_status === "rejected" && (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs px-2 py-1">
                      ✗
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs py-2">{formatDate(user.created_at)}</TableCell>
                 <TableCell className="text-right py-2">
                  <UserActionButtons
                    user={user}
                    onApprove={onApprove}
                    onMakeAdmin={onMakeAdmin}
                    onRevokeAdmin={onRevokeAdmin}
                    onDelete={onDelete}
                    isLoading={isLoading}
                  />
                 </TableCell>
              </TableRow>,
              ...(expandedUserId === user.id ? [
                <TableRow key={`${user.id}-details`}>
                  <TableCell colSpan={10} className="p-0">
                    <UserDetails user={user} />
                  </TableCell>
                </TableRow>
              ] : [])
            ])}
          </TableBody>
        </Table>
      </div>
      
      <SimpleFeeAgreementDialog
        user={selectedUserForEmail}
        isOpen={!!selectedUserForEmail}
        onClose={() => setSelectedUserForEmail(null)}
        onSendEmail={async (user, options) => {
          if (!currentAuthUser) {
            throw new Error('Authentication required');
          }

          const { data: adminProfile, error: profileError } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', currentAuthUser.id)
            .single();

          if (profileError || !adminProfile) {
            throw new Error('Admin profile not found');
          }

          const adminName = `${adminProfile.first_name} ${adminProfile.last_name}`;

          await logEmailMutation.mutateAsync({
            userId: user.id,
            userEmail: user.email,
            subject: options?.subject,
            content: options?.content,
            attachments: options?.attachments,
            customSignatureText: options?.customSignatureText,
            adminId: currentAuthUser.id,
            adminEmail: adminProfile.email,
            adminName: adminName,
            notes: options?.subject ? `Custom fee agreement email: ${options.subject}` : 'Standard fee agreement email sent'
          });
        }}
      />
      
      <SimpleNDADialog
        open={!!selectedUserForNDA}
        onOpenChange={(open) => !open && setSelectedUserForNDA(null)}
        user={selectedUserForNDA}
        onSendEmail={async (user, options) => {
          if (!currentAuthUser) {
            throw new Error('Authentication required');
          }

          const { data: adminProfile, error: profileError } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', currentAuthUser.id)
            .single();

          if (profileError || !adminProfile) {
            throw new Error('Admin profile not found');
          }

          const adminName = `${adminProfile.first_name} ${adminProfile.last_name}`;

        await logNDAEmail.mutateAsync({
          userId: user.id,
          userEmail: user.email,
          customSubject: options?.subject || 'NDA Agreement | SourceCo',
          customMessage: options?.message || 'Please review and sign the attached NDA.',
          adminId: currentAuthUser.id,
          adminEmail: adminProfile.email,
          adminName: adminName,
          notes: options?.message ? `Custom NDA email sent: ${options.subject}` : 'Standard NDA email sent'
        });
        }}
      />
    </>
  );
}