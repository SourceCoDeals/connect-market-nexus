import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vhzipqarkmmfuqadefep.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTcxMTMsImV4cCI6MjA2MjE5MzExM30.M653TuQcthJx8vZW4jPkUTdB67D_Dm48ItLcu_XBh2g";

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
      const client = createClient(SUPABASE_URL, SUPABASE_KEY);
      client.from('profiles').select('id, email, first_name, last_name').eq('role', 'admin').order('first_name').then((result: any) => {
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
                  <SelectContent>{admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.email})</SelectItem>)}</SelectContent>
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
