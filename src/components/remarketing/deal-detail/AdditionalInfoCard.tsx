import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Loader2, FileText, Plus, AlertTriangle, Shield, Cpu, Building, TrendingUp as GrowthIcon } from "lucide-react";
import { toast } from "sonner";

interface AdditionalInfoCardProps {
  otherNotes: string | null;
  internalNotes: string | null;
  keyRisks?: string | null;
  competitivePosition?: string | null;
  technologySystems?: string | null;
  realEstateInfo?: string | null;
  growthTrajectory?: string | null;
  onSave: (data: { 
    otherNotes: string; 
    internalNotes: string;
    keyRisks?: string;
    competitivePosition?: string;
    technologySystems?: string;
    realEstateInfo?: string;
    growthTrajectory?: string;
  }) => Promise<void>;
}

export const AdditionalInfoCard = ({ 
  otherNotes, internalNotes, keyRisks, competitivePosition, technologySystems, realEstateInfo, growthTrajectory, onSave 
}: AdditionalInfoCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedOtherNotes, setEditedOtherNotes] = useState(otherNotes || "");
  const [editedInternalNotes, setEditedInternalNotes] = useState(internalNotes || "");
  const [editedKeyRisks, setEditedKeyRisks] = useState(keyRisks || "");
  const [editedCompetitivePosition, setEditedCompetitivePosition] = useState(competitivePosition || "");
  const [editedTechnologySystems, setEditedTechnologySystems] = useState(technologySystems || "");
  const [editedRealEstateInfo, setEditedRealEstateInfo] = useState(realEstateInfo || "");
  const [editedGrowthTrajectory, setEditedGrowthTrajectory] = useState(growthTrajectory || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ otherNotes: editedOtherNotes, internalNotes: editedInternalNotes, keyRisks: editedKeyRisks, competitivePosition: editedCompetitivePosition, technologySystems: editedTechnologySystems, realEstateInfo: editedRealEstateInfo, growthTrajectory: editedGrowthTrajectory });
      setIsEditOpen(false);
      toast.success("Additional information updated");
    } catch { toast.error("Failed to save"); } finally { setIsSaving(false); }
  };

  const openEdit = () => {
    setEditedOtherNotes(otherNotes || ""); setEditedInternalNotes(internalNotes || ""); setEditedKeyRisks(keyRisks || ""); setEditedCompetitivePosition(competitivePosition || ""); setEditedTechnologySystems(technologySystems || ""); setEditedRealEstateInfo(realEstateInfo || ""); setEditedGrowthTrajectory(growthTrajectory || ""); setIsEditOpen(true);
  };

  const hasContent = otherNotes || internalNotes || keyRisks || competitivePosition || technologySystems || realEstateInfo || growthTrajectory;

  const InfoField = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (<div className="space-y-1"><div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"><Icon className="h-3.5 w-3.5" />{label}</div><p className="text-sm whitespace-pre-wrap">{value}</p></div>);
  };

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Additional Information</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit}><Pencil className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {hasContent ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoField icon={AlertTriangle} label="Key Risks" value={keyRisks} />
                <InfoField icon={Shield} label="Competitive Position" value={competitivePosition} />
                <InfoField icon={Cpu} label="Technology / Systems" value={technologySystems} />
                <InfoField icon={Building} label="Real Estate" value={realEstateInfo} />
              </div>
              <InfoField icon={GrowthIcon} label="Growth Trajectory" value={growthTrajectory} />
              <InfoField icon={FileText} label="Other Notes" value={otherNotes} />
              {internalNotes && <div className="border-t pt-4 mt-4"><InfoField icon={FileText} label="Internal Notes (Private)" value={internalNotes} /></div>}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No additional information</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={openEdit}><Plus className="h-3 w-3 mr-1" />Add Notes</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Additional Information</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label htmlFor="keyRisks">Key Risks</Label><Textarea id="keyRisks" placeholder="Customer concentration risk..." value={editedKeyRisks} onChange={(e) => setEditedKeyRisks(e.target.value)} className="mt-1.5 min-h-[80px]" /></div>
              <div><Label htmlFor="competitivePosition">Competitive Position</Label><Textarea id="competitivePosition" placeholder="Market leader in region..." value={editedCompetitivePosition} onChange={(e) => setEditedCompetitivePosition(e.target.value)} className="mt-1.5 min-h-[80px]" /></div>
              <div><Label htmlFor="technologySystems">Technology / Systems</Label><Textarea id="technologySystems" placeholder="Uses ServiceTitan..." value={editedTechnologySystems} onChange={(e) => setEditedTechnologySystems(e.target.value)} className="mt-1.5 min-h-[80px]" /></div>
              <div><Label htmlFor="realEstateInfo">Real Estate</Label><Textarea id="realEstateInfo" placeholder="Owned 10,000 sq ft..." value={editedRealEstateInfo} onChange={(e) => setEditedRealEstateInfo(e.target.value)} className="mt-1.5 min-h-[80px]" /></div>
            </div>
            <div><Label htmlFor="growthTrajectory">Growth Trajectory</Label><Textarea id="growthTrajectory" placeholder="20% YoY growth..." value={editedGrowthTrajectory} onChange={(e) => setEditedGrowthTrajectory(e.target.value)} className="mt-1.5 min-h-[80px]" /></div>
            <div><Label htmlFor="otherNotes">Other Notes</Label><Textarea id="otherNotes" placeholder="Additional information..." value={editedOtherNotes} onChange={(e) => setEditedOtherNotes(e.target.value)} className="mt-1.5 min-h-[80px]" /></div>
            <div><Label htmlFor="internalNotes">Internal Notes (Private)</Label><Textarea id="internalNotes" placeholder="Internal team notes..." value={editedInternalNotes} onChange={(e) => setEditedInternalNotes(e.target.value)} className="mt-1.5 min-h-[80px]" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdditionalInfoCard;
