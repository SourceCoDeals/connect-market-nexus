import { useState } from "react";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { PremiumRichTextEditor } from "@/components/ui/premium-rich-text-editor";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";
import { Check, X, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditableDescriptionProps {
  listingId: string;
  initialHtml?: string;
  initialPlain?: string;
  isEditing: boolean;
}

export function EditableDescription({ 
  listingId, 
  initialHtml, 
  initialPlain,
  isEditing 
}: EditableDescriptionProps) {
  const [isActive, setIsActive] = useState(false);
  const [value, setValue] = useState(initialHtml || initialPlain || "");
  const { useUpdateListing } = useAdminListings();
  const { mutate: updateListing, isPending } = useUpdateListing();

  const handleSave = () => {
    if (value.trim() && value !== initialHtml) {
      updateListing({
        id: listingId,
        listing: { 
          description_html: value,
          description: value.replace(/<[^>]*>/g, '') // Strip HTML for plain text fallback
        },
      });
    }
    setIsActive(false);
  };

  const handleCancel = () => {
    setValue(initialHtml || initialPlain || "");
    setIsActive(false);
  };

  if (!isEditing) {
    return (
      <div className="prose prose-slate max-w-none text-sm [&_p]:text-sm [&_div]:text-sm [&_span]:text-sm">
        {initialHtml ? (
          <RichTextDisplay content={initialHtml} />
        ) : (
          <p className="text-sm leading-relaxed text-slate-700">{initialPlain}</p>
        )}
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="space-y-3 border-2 border-sourceco-accent rounded-lg p-4">
        <PremiumRichTextEditor
          content={value}
          onChange={(html) => setValue(html)}
        />
        <div className="flex gap-2 pt-2 border-t border-sourceco-form">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !value.trim()}
            className="h-8 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Save Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            className="h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="prose prose-slate max-w-none text-sm [&_p]:text-sm [&_div]:text-sm [&_span]:text-sm cursor-pointer hover:bg-sourceco-accent/10 rounded p-3 -m-3 transition-colors relative group"
      onClick={() => setIsActive(true)}
    >
      {initialHtml ? (
        <RichTextDisplay content={initialHtml} />
      ) : (
        <p className="text-sm leading-relaxed text-slate-700">{initialPlain}</p>
      )}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-sourceco-accent text-white rounded-full p-1.5">
          <Edit className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
