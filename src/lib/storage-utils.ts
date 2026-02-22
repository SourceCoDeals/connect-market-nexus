import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const LISTINGS_BUCKET = 'listings';
export const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";

/**
 * Ensure the listings storage bucket exists and is configured correctly
 * @returns {Promise<boolean>} True if bucket exists or was created
 */
export const ensureListingsBucketExists = async (): Promise<boolean> => {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      return false;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === LISTINGS_BUCKET);
    
    if (!bucketExists) {
      
      try {
        const { error: createError } = await supabase.storage
          .createBucket(LISTINGS_BUCKET, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          });
        
        if (createError) {
          return false;
        }
      } catch (err) {
        // If we get an RLS violation, the bucket might already exist but not be visible to this user
      }
    }
    
    // Check if we can get public URLs
    try {
      const { data } = supabase.storage
        .from(LISTINGS_BUCKET)
        .getPublicUrl('test-permissions.txt');
      
      if (!data) {
        return false;
      }
      
      return true;
    } catch (err) {
      return false;
    }
  } catch (error: unknown) {
    return false;
  }
};

/**
 * Upload an image to the listings bucket
 * @param {File} file - The file to upload
 * @param {string} listingId - The ID of the listing
 * @returns {Promise<string>} The public URL of the uploaded image
 */
export const uploadListingImage = async (file: File, listingId: string): Promise<string> => {
  try {
    // Generate a unique file name
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fullPath = `${listingId}/${Date.now()}.${fileExt}`;

    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from(LISTINGS_BUCKET)
      .upload(fullPath, file, {
        cacheControl: '3600',
        upsert: true, // Use upsert to handle overwrites
      });
    
    if (uploadError) {
      throw uploadError;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(LISTINGS_BUCKET)
      .getPublicUrl(fullPath);
    
    if (!urlData.publicUrl) {
      throw new Error('Failed to get public URL');
    }
    
    return urlData.publicUrl;
  } catch (error: unknown) {
    toast({
      variant: 'destructive',
      title: 'Image upload failed',
      description: error instanceof Error ? error.message : 'Failed to upload image',
    });
    throw error;
  }
};

/**
 * Delete images for a specific listing
 * @param {string} listingId - The ID of the listing
 * @returns {Promise<boolean>} Success status
 */
export const deleteListingImages = async (listingId: string): Promise<boolean> => {
  try {
    // List all files in the listing's folder
    const { data: fileList, error: listError } = await supabase.storage
      .from(LISTINGS_BUCKET)
      .list(`${listingId}`);
    
    if (listError) {
      return false;
    }
    
    if (fileList && fileList.length > 0) {
      // Delete all files for this listing
      const filePaths = fileList.map(file => `${listingId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from(LISTINGS_BUCKET)
        .remove(filePaths);
      
      if (deleteError) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
};
