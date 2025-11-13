import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Using shared Supabase client from integrations

interface AssignOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealTitle: string;
  onConfirm: (ownerId: string) => void;
}

type Admin = { id: string; email: string; first_name: string | null; last_name: string | null };

export function AssignOwnerDialog({ open, onOpenChange, dealTitle, onConfirm }: AssignOwnerDialogProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      supabase.from('profiles').select('id, email, first_name, last_name').eq('is_admin', true).order('first_name').then((result: any) => {
        if (result.data) setAdmins(result.data);
        setIsLoading(false);
      });
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Assign Deal Owner</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>The deal <strong>{dealTitle}</strong> needs an owner before moving to "Owner intro requested" stage.</p>
            <div className="pt-2">
              <label className="text-sm font-medium text-foreground block mb-2">Select Deal Owner</label>
              {isLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
                <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                  <SelectTrigger><SelectValue placeholder="Choose an admin..." /></SelectTrigger>
                  <SelectContent position="popper" className="z-[70] bg-background text-foreground border border-border shadow-lg max-h-64">
                    {admins.length > 0 ? (
                      admins.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.first_name} {a.last_name} ({a.email})
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { if (selectedOwnerId) { onConfirm(selectedOwnerId); setSelectedOwnerId(''); } }} disabled={!selectedOwnerId}>Assign & Continue</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
