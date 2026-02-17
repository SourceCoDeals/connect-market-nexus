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
  const [dealOwnerAdmins, setDealOwnerAdmins] = useState<AdminProfile[]>([]);
  const [primaryOwnerAdmins, setPrimaryOwnerAdmins] = useState<AdminProfile[]>([]);
  const [isLoadingDealOwnerAdmins, setIsLoadingDealOwnerAdmins] = useState(false);
  const [isLoadingPrimaryOwnerAdmins, setIsLoadingPrimaryOwnerAdmins] = useState(false);

  const hasDealOwner = !!currentDealOwner;
  const hasPrimaryOwner = !!currentPrimaryOwner;
  const needsPrimaryOwner = !hasPrimaryOwner;
  const needsDealOwner = !hasDealOwner;

  // Load admins for deal owner selection
  useEffect(() => {
    if (open && needsDealOwner) {
      setIsLoadingDealOwnerAdmins(true);
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('is_admin', true)
        .order('first_name')
        .then((result) => {
          if (result.data) setDealOwnerAdmins(result.data);
          setIsLoadingDealOwnerAdmins(false);
        });
    }
  }, [open, needsDealOwner]);

  // Load admins for primary owner selection (SECURITY: Only admins can be primary owners)
  useEffect(() => {
    if (open && needsPrimaryOwner) {
      setIsLoadingPrimaryOwnerAdmins(true);
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('is_admin', true)
        .order('first_name')
        .then((result) => {
          if (result.data) setPrimaryOwnerAdmins(result.data);
          setIsLoadingPrimaryOwnerAdmins(false);
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
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-foreground">
              Send owner introduction
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 mt-2">
              Moving {dealTitle} to Owner intro requested
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm font-medium text-slate-700">Primary owner</span>
                <span className="text-sm text-slate-600">{currentPrimaryOwner.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm font-medium text-slate-700">Deal owner</span>
                <span className="text-sm text-slate-600">{currentDealOwner.name}</span>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-sm text-slate-600">
                An introduction email will be sent to <span className="font-medium text-slate-700">{currentPrimaryOwner.email}</span> with details about this buyer inquiry.
              </p>
            </div>
          </div>
          
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="bg-foreground text-background hover:bg-foreground/90">
              Send introduction
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Cases 2-4: One or both owners missing
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold text-foreground">
            Configure owner introduction
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate-600 mt-2">
            Moving {dealTitle} to Owner intro requested
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-600">
              This stage requires two contacts to send the introduction email:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 pl-4">
              <li>• <span className="font-medium text-slate-700">Primary owner</span> — receives the email</li>
              <li>• <span className="font-medium text-slate-700">Deal owner</span> — coordinates internally</li>
            </ul>
          </div>
          
          {needsPrimaryOwner && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Primary owner <span className="text-slate-500">(required)</span>
              </label>
              <p className="text-xs text-slate-500">
                The team member managing the relationship with this business owner
              </p>
              <Select value={selectedPrimaryOwnerId} onValueChange={setSelectedPrimaryOwnerId}>
                <SelectTrigger className="bg-white border-slate-200 focus:border-slate-400">
                  <SelectValue placeholder="Select primary owner" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {primaryOwnerAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id} className="text-sm">
                      {formatUserName(admin)} · {admin.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {needsDealOwner && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Deal owner <span className="text-slate-500">(required)</span>
              </label>
              <p className="text-xs text-slate-500">
                The admin coordinating this deal internally
              </p>
              <Select value={selectedDealOwnerId} onValueChange={setSelectedDealOwnerId}>
                <SelectTrigger className="bg-white border-slate-200 focus:border-slate-400">
                  <SelectValue placeholder="Select deal owner" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {dealOwnerAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id} className="text-sm">
                      {formatUserName(admin)} · {admin.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {hasPrimaryOwner && needsDealOwner && (
            <div className="space-y-2 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Primary owner</span>
                <span className="text-sm font-medium text-slate-700">{currentPrimaryOwner.name}</span>
              </div>
            </div>
          )}
          
          {hasDealOwner && needsPrimaryOwner && (
            <div className="space-y-2 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Deal owner</span>
                <span className="text-sm font-medium text-slate-700">{currentDealOwner.name}</span>
              </div>
            </div>
          )}
        </div>
        
        <AlertDialogFooter className="border-t border-slate-200 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!isValid()}
            className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Assign & send notification
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
