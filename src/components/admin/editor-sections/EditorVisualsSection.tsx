import { FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef } from "react";

interface EditorVisualsSectionProps {
  imagePreview: string | null;
  imageError: string | null;
  onImageSelect: (file: File | null) => void;
  onRemoveImage: () => void;
}

export function EditorVisualsSection({
  imagePreview,
  imageError,
  onImageSelect,
  onRemoveImage,
}: EditorVisualsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onImageSelect(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-sourceco-muted">
          <ImageIcon className="h-5 w-5 text-sourceco-accent" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Visual Assets</h3>
          <p className="text-sm text-muted-foreground">Featured image and visual content</p>
        </div>
      </div>

      <div className="space-y-4">
        <FormLabel className="text-sm font-medium">Featured Image</FormLabel>
        
        {imagePreview ? (
          <div className="relative group">
            <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Replace
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onRemoveImage}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="aspect-video rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3"
          >
            <div className="p-4 rounded-full bg-sourceco-muted">
              <ImageIcon className="h-8 w-8 text-sourceco-accent" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Click to upload image</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP up to 5MB</p>
            </div>
          </div>
        )}

        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {imageError && (
          <p className="text-sm text-destructive">{imageError}</p>
        )}
      </div>
    </div>
  );
}
