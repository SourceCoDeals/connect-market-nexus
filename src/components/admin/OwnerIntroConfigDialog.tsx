import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, AlertTriangle, Mail, Info, Loader2, User, Building2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

interface OwnerIntroConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealTitle: string;
  listingId: string;
  currentDealOwner: { id: string; name: string; email: string } | null;
  currentPrimaryOwner: { id: string; name: string; email: string } | null;
  onConfirm: (config: { primaryOwnerId: string | null; dealOwnerId: string | null }) => void;
}

type AdminProfile = { id: string; email: string; first_name: string | null; last_name: string | null };

export function OwnerIntroConfigDialog({
  open,
  onOpenChange,
  dealTitle,
  listingId,
  currentDealOwner,
  currentPrimaryOwner,
  onConfirm,
}: OwnerIntroConfigDialogProps) {
  const [selectedPrimaryOwnerId, setSelectedPrimaryOwnerId] = useState<string>('');
  const [selectedDealOwnerId, setSelectedDealOwnerId] = useState<string>('');
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [allUsers, setAllUsers] = useState<AdminProfile[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const hasDealOwner = !!currentDealOwner;
  const hasPrimaryOwner = !!currentPrimaryOwner;
  const needsPrimaryOwner = !hasPrimaryOwner;
  const needsDealOwner = !hasDealOwner;

  // Load admins for deal owner selection
  useEffect(() => {
    if (open && needsDealOwner) {
      setIsLoadingAdmins(true);
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('is_admin', true)
        .order('first_name')
        .then((result) => {
          if (result.data) setAdmins(result.data);
          setIsLoadingAdmins(false);
        });
    }
  }, [open, needsDealOwner]);

  // Load all approved users for primary owner selection
  useEffect(() => {
    if (open && needsPrimaryOwner) {
      setIsLoadingUsers(true);
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('approval_status', 'approved')
        .order('first_name')
        .then((result) => {
          if (result.data) setAllUsers(result.data);
          setIsLoadingUsers(false);
        });
    }
  }, [open, needsPrimaryOwner]);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPrimaryOwnerId(currentPrimaryOwner?.id || '');
      setSelectedDealOwnerId(currentDealOwner?.id || '');
    }
  }, [open, currentPrimaryOwner, currentDealOwner]);

  const handleConfirm = () => {
    onConfirm({
      primaryOwnerId: selectedPrimaryOwnerId || currentPrimaryOwner?.id || null,
      dealOwnerId: selectedDealOwnerId || currentDealOwner?.id || null,
    });
  };

  const isValid = () => {
    const hasPrimaryOwnerSelected = selectedPrimaryOwnerId || currentPrimaryOwner;
    const hasDealOwnerSelected = selectedDealOwnerId || currentDealOwner;
    return hasPrimaryOwnerSelected && hasDealOwnerSelected;
  };

  const formatUserName = (user: AdminProfile) => {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || user.email;
  };

  // Case 1: Both assigned - Just confirm
  if (hasDealOwner && hasPrimaryOwner) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              Send Owner Introduction Request
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Moving <span className="font-medium text-foreground">{dealTitle}</span> to{' '}
                  <span className="font-medium text-foreground">Owner intro requested</span>
                </p>
                
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/50">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0 dark:text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Deal Owner (Admin)</p>
                      </div>
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{currentDealOwner.name}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">{currentDealOwner.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0 dark:text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Primary Owner (Seller Contact)</p>
                      </div>
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{currentPrimaryOwner.name}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">{currentPrimaryOwner.email}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/50">
                  <Mail className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0 dark:text-blue-400" />
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    An email will be sent to <span className="font-medium">{currentPrimaryOwner.name}</span> introducing the buyer.{' '}
                    <span className="font-medium">{currentDealOwner.name}</span> will be referenced as the deal coordinator.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm}>
              <Mail className="h-4 w-4 mr-2" />
              Send Notification & Move Stage
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Case 2, 3, 4: Missing one or both owners - Show assignment interface
  const bothMissing = needsPrimaryOwner && needsDealOwner;
  const onlyPrimaryMissing = needsPrimaryOwner && !needsDealOwner;
  const onlyDealMissing = !needsPrimaryOwner && needsDealOwner;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {bothMissing && "Configure Owner Introduction"}
            {onlyPrimaryMissing && "Assign Primary Owner Required"}
            {onlyDealMissing && "Assign Deal Owner Required"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Moving <span className="font-medium text-foreground">{dealTitle}</span> to{' '}
                <span className="font-medium text-foreground">Owner intro requested</span>
              </p>

              {bothMissing && (
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/50">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0 dark:text-amber-400" />
                  <div className="text-sm text-amber-900 dark:text-amber-100">
                    <p className="font-medium mb-1">Both owners need to be assigned</p>
                    <p className="text-amber-800 dark:text-amber-200">
                      The <strong>Primary Owner</strong> is the seller's main contact who will receive the introduction email.
                      The <strong>Deal Owner</strong> is the admin coordinating this deal internally.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Primary Owner Assignment */}
                {needsPrimaryOwner && (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-5">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full p-2 ${selectedPrimaryOwnerId ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-red-100 dark:bg-red-950'}`}>
                        <Building2 className={`h-4 w-4 ${selectedPrimaryOwnerId ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-foreground block mb-1">
                          Primary Owner (Seller Contact) *
                        </label>
                        <p className="text-xs text-muted-foreground mb-3">
                          This person manages the relationship with the business owner and will receive the intro email
                        </p>
                        {isLoadingUsers ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <Select value={selectedPrimaryOwnerId} onValueChange={setSelectedPrimaryOwnerId}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select primary owner..." />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100] max-h-64" sideOffset={4}>
                              {allUsers.length > 0 ? (
                                allUsers.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {formatUserName(user)} ({user.email})
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="__none" disabled>
                                  No users found
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Deal Owner Assignment */}
                {needsDealOwner && (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-5">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full p-2 ${selectedDealOwnerId ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-red-100 dark:bg-red-950'}`}>
                        <User className={`h-4 w-4 ${selectedDealOwnerId ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-foreground block mb-1">
                          Deal Owner (Admin) *
                        </label>
                        <p className="text-xs text-muted-foreground mb-3">
                          The admin responsible for coordinating this deal internally
                        </p>
                        {isLoadingAdmins ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <Select value={selectedDealOwnerId} onValueChange={setSelectedDealOwnerId}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select deal owner..." />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100] max-h-64" sideOffset={4}>
                              {admins.length > 0 ? (
                                admins.map((admin) => (
                                  <SelectItem key={admin.id} value={admin.id}>
                                    {formatUserName(admin)} ({admin.email})
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="__none" disabled>
                                  No admins found
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show existing owners if only one is missing */}
                {!needsPrimaryOwner && currentPrimaryOwner && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/50">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <Building2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">Primary Owner Assigned</p>
                    </div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 ml-6">{currentPrimaryOwner.name}</p>
                  </div>
                )}

                {!needsDealOwner && currentDealOwner && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/50">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <User className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">Deal Owner Assigned</p>
                    </div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 ml-6">{currentDealOwner.name}</p>
                  </div>
                )}
              </div>

              {isValid() && (
                <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/50">
                  <Mail className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0 dark:text-blue-400" />
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    An introduction email will be sent to the primary owner once both owners are assigned.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!isValid()}>
            {isValid() ? (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Assign & Send Notification
              </>
            ) : (
              'Assign Owners to Continue'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
