 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Store, Pencil } from "lucide-react";
 
 interface BuyerServicesBusinessModelCardProps {
   servicesOffered?: string | null;
   businessModel?: string | null;
   revenueModel?: string | null;
   onEdit: () => void;
 }
 
 export const BuyerServicesBusinessModelCard = ({
   servicesOffered,
   businessModel,
   revenueModel,
   onEdit,
 }: BuyerServicesBusinessModelCardProps) => {
   const hasContent = servicesOffered || businessModel || revenueModel;
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="flex items-center gap-2 text-base font-semibold">
             <Store className="h-4 w-4" />
             Services & Business Model
           </CardTitle>
           <Button variant="ghost" size="icon" onClick={onEdit}>
             <Pencil className="h-4 w-4" />
           </Button>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {!hasContent ? (
           <p className="text-sm text-muted-foreground italic">No services or business model specified</p>
         ) : (
           <>
             {servicesOffered && (
               <div>
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                   Service Mix
                 </p>
                 <p className="text-sm text-primary">{servicesOffered}</p>
               </div>
             )}
             {(businessModel || revenueModel) && (
               <div className="pt-2 border-t">
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                   Business Model
                 </p>
                 <p className="text-sm text-muted-foreground">
                   {businessModel || revenueModel}
                 </p>
               </div>
             )}
           </>
         )}
       </CardContent>
     </Card>
   );
 };
 
 export default BuyerServicesBusinessModelCard;