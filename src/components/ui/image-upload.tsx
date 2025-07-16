
import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Image as ImageIcon, AlertCircle, Clipboard } from 'lucide-react';
import { DEFAULT_IMAGE } from '@/lib/storage-utils';

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  currentImageUrl?: string | null;
  onRemoveImage: () => void;
  error?: string | null;
  className?: string;
}

export function ImageUpload({
  onImageSelect,
  currentImageUrl,
  onRemoveImage,
  error,
  className = "",
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > 5 * 1024 * 1024) {
      return "Image file size must be less than 5MB";
    }
    if (!file.type.startsWith("image/")) {
      return "Please select a valid image file (JPEG, PNG, WebP, GIF)";
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      // We'll let the parent handle the error
      return;
    }

    onImageSelect(file);
    
    // Simulate upload progress for UX
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 50);
  }, [onImageSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handlePaste = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const file = new File([blob], `pasted-image.${type.split('/')[1]}`, {
              type: type,
            });
            handleFileSelect(file);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  }, [handleFileSelect]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {currentImageUrl ? (
        <div className="rounded-md border overflow-hidden">
          <div className="relative max-w-md mx-auto">
            <img 
              src={currentImageUrl} 
              alt="Preview" 
              className="w-full h-auto object-cover rounded-md max-h-[200px]" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = DEFAULT_IMAGE;
              }}
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={onRemoveImage}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div 
          className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
            isDragging 
              ? 'border-primary bg-primary/10' 
              : 'border-muted-foreground/20 hover:bg-muted/50'
          }`}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            Click to upload, drag and drop, or paste from clipboard
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            PNG, JPG or WebP (max 5MB)
          </p>
          <div className="flex gap-2 justify-center">
            <Button type="button" variant="outline" size="sm" onClick={handleClick}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handlePaste}>
              <Clipboard className="h-4 w-4 mr-2" />
              Paste Image
            </Button>
          </div>
        </div>
      )}
      
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
