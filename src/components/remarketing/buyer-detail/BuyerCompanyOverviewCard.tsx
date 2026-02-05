 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Building2, Globe, MapPin, Calendar, Users, Briefcase, Home, Pencil, ExternalLink } from "lucide-react";
 
 interface BuyerCompanyOverviewCardProps {
   website?: string | null;
   hqCity?: string | null;
   hqState?: string | null;
   hqCountry?: string | null;
   foundedYear?: number | null;
   employeeCount?: number | null;
   employeeRange?: string | null;
   industryVertical?: string | null;
   numberOfLocations?: number | null;
   operatingLocations?: string[] | null;
   onEdit: () => void;
 }
 
 export const BuyerCompanyOverviewCard = ({
   website,
   hqCity,
   hqState,
   hqCountry,
   foundedYear,
   employeeCount,
   employeeRange,
   industryVertical,
   numberOfLocations,
   operatingLocations,
   onEdit,
 }: BuyerCompanyOverviewCardProps) => {
   const headquarters = [hqCity, hqState, hqCountry].filter(Boolean).join(", ");
   const employees = employeeCount ? employeeCount.toLocaleString() : employeeRange || null;
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="flex items-center gap-2 text-base font-semibold">
             <Building2 className="h-4 w-4" />
             Company Overview
           </CardTitle>
           <Button variant="ghost" size="icon" onClick={onEdit}>
             <Pencil className="h-4 w-4" />
           </Button>
         </div>
       </CardHeader>
       <CardContent>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {/* Website */}
           <div className="flex items-start gap-3">
             <Globe className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
             <div className="min-w-0">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Website</p>
               {website ? (
                 <a
                   href={website.startsWith("http") ? website : `https://${website}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                 >
                   {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                   <ExternalLink className="h-3 w-3 flex-shrink-0" />
                 </a>
               ) : (
                 <p className="text-sm text-muted-foreground italic">Not specified</p>
               )}
             </div>
           </div>
 
           {/* Headquarters */}
           <div className="flex items-start gap-3">
             <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
             <div className="min-w-0">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Headquarters</p>
               {headquarters ? (
                 <p className="text-sm">{headquarters}</p>
               ) : (
                 <p className="text-sm text-muted-foreground italic">Not specified</p>
               )}
             </div>
           </div>
 
           {/* Founded */}
           <div className="flex items-start gap-3">
             <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
             <div className="min-w-0">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Founded</p>
               {foundedYear ? (
                 <p className="text-sm">{foundedYear}</p>
               ) : (
                 <p className="text-sm text-muted-foreground italic">Not specified</p>
               )}
             </div>
           </div>
 
           {/* Employees */}
           <div className="flex items-start gap-3">
             <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
             <div className="min-w-0">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employees</p>
               {employees ? (
                 <p className="text-sm">{employees}</p>
               ) : (
                 <p className="text-sm text-muted-foreground italic">Not specified</p>
               )}
             </div>
           </div>
 
           {/* Industry */}
           <div className="flex items-start gap-3">
             <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
             <div className="min-w-0">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Industry</p>
               {industryVertical ? (
                 <p className="text-sm">{industryVertical}</p>
               ) : (
                 <p className="text-sm text-muted-foreground italic">Not specified</p>
               )}
             </div>
           </div>
 
           {/* Number of Locations */}
           <div className="flex items-start gap-3">
             <Home className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
             <div className="min-w-0">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Number of Locations</p>
               {numberOfLocations || operatingLocations?.length ? (
                 <p className="text-sm">{numberOfLocations || operatingLocations?.length} locations</p>
               ) : (
                 <p className="text-sm text-muted-foreground italic">Not specified</p>
               )}
             </div>
           </div>
         </div>
       </CardContent>
     </Card>
   );
 };
 
 export default BuyerCompanyOverviewCard;