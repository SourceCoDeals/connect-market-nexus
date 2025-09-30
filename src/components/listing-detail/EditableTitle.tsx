import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditableTitleProps {
  listingId: string;
  initialValue: string;
  isEditing: boolean;
}

export function EditableTitle({ listingId, initialValue, isEditing }: EditableTitleProps) {
  const [isActive, setIsActive] = useState(false);
  const [value, setValue] = useState(initialValue);
  const { useUpdateListing } = useAdminListings();
  const { mutate: updateListing, isPending } = useUpdateListing();

  const handleSave = () => {
    if (value.trim() && value !== initialValue) {
      updateListing({
        id: listingId,
        listing: { title: value.trim() },
      });
    }
    setIsActive(false);
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsActive(false);
  };

  if (!isEditing) {
    return <h1 className="document-title">{initialValue}</h1>;
  }

  if (isActive) {
    return (
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-3xl font-light text-slate-900 border-2 border-sourceco-accent"
          autoFocus
          disabled={isPending}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !value.trim()}
            className="h-7 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <h1
      className="document-title cursor-pointer hover:bg-sourceco-accent/10 rounded px-2 -mx-2 transition-colors"
      onClick={() => setIsActive(true)}
    >
      {initialValue}
    </h1>
  );
}
