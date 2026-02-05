 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { CheckCircle2, FileText, Download, ExternalLink, Sparkles } from "lucide-react";
 
 interface GuideCompletionDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   industryName: string;
   wordCount: number;
   documentUrl?: string;
   onViewDocument?: () => void;
 }
 
 export const GuideCompletionDialog = ({
   open,
   onOpenChange,
   industryName,
   wordCount,
   documentUrl,
   onViewDocument
 }: GuideCompletionDialogProps) => {
   const handleViewDocument = () => {
     if (documentUrl) {
       window.open(documentUrl, '_blank');
     }
     onViewDocument?.();
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
             M&A Research Guide Complete
           </DialogTitle>
           <DialogDescription>
             Your industry research guide has been generated and saved
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-4 py-4">
           {/* Summary Stats */}
           <div className="grid grid-cols-2 gap-4">
             <div className="p-3 rounded-lg border bg-muted/30">
               <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                 <Sparkles className="h-4 w-4" />
                 Industry
               </div>
               <p className="font-medium">{industryName}</p>
             </div>
             <div className="p-3 rounded-lg border bg-muted/30">
               <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                 <FileText className="h-4 w-4" />
                 Word Count
               </div>
               <p className="font-medium">{wordCount.toLocaleString()} words</p>
             </div>
           </div>
 
           {/* What was created */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h4 className="font-medium text-primary mb-2 flex items-center gap-2">
               <FileText className="h-4 w-4" />
               Document Saved
             </h4>
            <p className="text-sm text-muted-foreground mb-2">
               An HTML document has been saved to <strong>Supporting Documents</strong> and can be:
             </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
               <li>Opened in browser and printed to PDF</li>
               <li>Shared with team members</li>
               <li>Used as reference for buyer criteria</li>
             </ul>
           </div>
 
           {/* Next Steps */}
           <div className="p-3 rounded-lg border">
             <h4 className="text-sm font-medium mb-2">Next Steps</h4>
             <p className="text-sm text-muted-foreground">
               Open the <strong>Buyer Fit Criteria</strong> section below and use "Extract from Guide" to automatically populate your matching criteria from this research.
             </p>
           </div>
         </div>
 
         <DialogFooter className="flex gap-2 sm:gap-2">
           {documentUrl && (
             <Button variant="outline" onClick={handleViewDocument}>
               <ExternalLink className="h-4 w-4 mr-1" />
               View Document
             </Button>
           )}
           <Button onClick={() => onOpenChange(false)}>
             Done
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default GuideCompletionDialog;