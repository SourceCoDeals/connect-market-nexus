import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

interface VisualsSectionProps {
  form: UseFormReturn<any>;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
}

export function VisualsSection({ form, imageFile, setImageFile, imagePreview, setImagePreview }: VisualsSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Visual Assets</h2>
        <p className="text-sm text-muted-foreground">
          Professional imagery that represents the business
        </p>
      </div>

      <Card className="p-6 border-primary/10 bg-primary/5">
        <div className="flex gap-3">
          <ImageIcon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Image Quality Guidelines</p>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li>• Use high-resolution images (minimum 1200x800px)</li>
              <li>• Ensure images are professional and represent the business</li>
              <li>• Avoid generic stock photos when possible</li>
              <li>• Images should be well-lit and properly composed</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-muted/50">
        <FormField
          control={form.control}
          name="listing_image"
          render={({ field }) => {
            const fileInputRef = useRef<HTMLInputElement>(null);
            
            const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) {
                setImageFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                  setImagePreview(reader.result as string);
                  field.onChange(reader.result as string);
                };
                reader.readAsDataURL(file);
              }
            };

            const handleRemove = () => {
              setImageFile(null);
              setImagePreview(null);
              field.onChange(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            };

            return (
              <FormItem>
                <FormLabel className="text-sm font-medium">Hero Image *</FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    {imagePreview ? (
                      <div className="relative group">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-64 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={handleRemove}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div 
                        className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, or WebP (max 5MB)
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </FormControl>
                <FormDescription className="text-xs">
                  Primary image that appears in listings and search results
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </Card>
    </div>
  );
}
