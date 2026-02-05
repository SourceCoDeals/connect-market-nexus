 import { useState, useEffect } from "react";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Textarea } from "@/components/ui/textarea";
 import { Label } from "@/components/ui/label";
 import { Loader2 } from "lucide-react";
 
 interface EditBuyerServicesBusinessModelDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   servicesOffered?: string | null;
   businessModel?: string | null;
   revenueModel?: string | null;
   onSave: (data: {
     services_offered?: string | null;
     business_model?: string | null;
     revenue_model?: string | null;
   }) => Promise<void>;
   isSaving?: boolean;
 }
 
 export const EditBuyerServicesBusinessModelDialog = ({
   open,
   onOpenChange,
   servicesOffered,
   businessModel,
   revenueModel,
   onSave,
   isSaving,
 }: EditBuyerServicesBusinessModelDialogProps) => {
   const [formData, setFormData] = useState({
     servicesOffered: servicesOffered || "",
     businessModel: businessModel || revenueModel || "",
   });
 
   useEffect(() => {
     if (open) {
       setFormData({
         servicesOffered: servicesOffered || "",
         businessModel: businessModel || revenueModel || "",
       });
     }
   }, [open, servicesOffered, businessModel, revenueModel]);
 
   const handleSave = async () => {
     await onSave({
       services_offered: formData.servicesOffered || null,
       business_model: formData.businessModel || null,
       revenue_model: formData.businessModel || null,
     });
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-lg">
         <DialogHeader>
           <DialogTitle>Edit Services & Business Model</DialogTitle>
         </DialogHeader>
         <div className="space-y-4 py-4">
           <div>
             <Label htmlFor="servicesOffered">Service Mix</Label>
             <Textarea
               id="servicesOffered"
               value={formData.servicesOffered}
               onChange={(e) => setFormData({ ...formData, servicesOffered: e.target.value })}
               placeholder="Describe the services offered by this platform..."
               rows={3}
             />
           </div>
           <div>
             <Label htmlFor="businessModel">Business Model</Label>
             <Textarea
               id="businessModel"
               value={formData.businessModel}
               onChange={(e) => setFormData({ ...formData, businessModel: e.target.value })}
               placeholder="Describe the business model (B2B, B2C, revenue model, etc.)..."
               rows={3}
             />
           </div>
         </div>
         <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Cancel
           </Button>
           <Button onClick={handleSave} disabled={isSaving}>
             {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
             Save
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default EditBuyerServicesBusinessModelDialog;