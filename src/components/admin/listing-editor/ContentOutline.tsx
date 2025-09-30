import { FileText, Building2, TrendingUp, ImageIcon, Lock, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Section {
  id: string;
  label: string;
  icon: any;
  required?: boolean;
}

const sections: Section[] = [
  { id: "overview", label: "Business Overview", icon: Building2, required: true },
  { id: "description", label: "Professional Description", icon: FileText, required: true },
  { id: "investment", label: "Investment Context", icon: TrendingUp },
  { id: "visuals", label: "Visual Assets", icon: ImageIcon, required: true },
  { id: "internal", label: "Internal Information", icon: Lock },
];

interface ContentOutlineProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  formValues: any;
}

export function ContentOutline({ activeSection, onSectionChange, formValues }: ContentOutlineProps) {
  const getSectionCompleteness = (sectionId: string): boolean => {
    switch (sectionId) {
      case "overview":
        return !!(formValues.title && formValues.categories?.length && formValues.locations?.length);
      case "description":
        return !!(formValues.business_description && formValues.business_description.length > 100);
      case "visuals":
        return !!(formValues.listing_image);
      default:
        return true;
    }
  };

  const completedSections = sections.filter(s => getSectionCompleteness(s.id)).length;
  const requiredSections = sections.filter(s => s.required).length;

  return (
    <div className="h-full flex flex-col border-r bg-card/30">
      <div className="p-6 border-b">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm">Content Outline</h3>
          <p className="text-xs text-muted-foreground">
            {completedSections} of {sections.length} sections complete
          </p>
        </div>
        
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Listing Quality</span>
            <span className="font-medium">{Math.round((completedSections / sections.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(completedSections / sections.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const isComplete = getSectionCompleteness(section.id);

            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  "hover:bg-accent/50",
                  isActive && "bg-accent shadow-sm"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("flex-1 text-left", isActive && "font-medium")}>
                  {section.label}
                </span>
                {section.required && (
                  isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/40" />
                  )
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
