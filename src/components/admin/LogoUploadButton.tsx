import { Button } from "@/components/ui/button";
import { uploadPremiumLogo } from "@/lib/upload-logo";
import { toast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { useState } from "react";

export const LogoUploadButton = () => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    try {
      setIsUploading(true);
      await uploadPremiumLogo();
      toast({
        title: "Logo uploaded successfully",
        description: "The SourceCo logo has been uploaded to Supabase storage",
      });
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo to storage",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Button 
      onClick={handleUpload} 
      disabled={isUploading}
      size="sm"
      variant="outline"
    >
      <Upload className="w-4 h-4 mr-2" />
      {isUploading ? "Uploading..." : "Upload Logo to Storage"}
    </Button>
  );
};