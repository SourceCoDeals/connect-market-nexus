import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface BuyerDataSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function BuyerDataSection({
  title,
  description,
  children,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  collapsible = false,
  defaultOpen = true,
}: BuyerDataSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const headerContent = (
    <div className="flex items-start justify-between w-full">
      <div className="flex-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      <div className="flex items-center gap-2 ml-4">
        {isEditing ? (
          <>
            <Button size="sm" variant="default" onClick={onSave}>
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}
        {collapsible && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            className="ml-2"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CardHeader className="cursor-pointer">
            <CollapsibleTrigger asChild>
              {headerContent}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">{children}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card>
      <CardHeader>{headerContent}</CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
