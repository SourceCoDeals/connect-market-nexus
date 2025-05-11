
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
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === LISTINGS_BUCKET);
    
    if (!bucketExists) {
      console.log(`Creating ${LISTINGS_BUCKET} storage bucket...`);
      
      const { error: createError } = await supabase.storage
        .createBucket(LISTINGS_BUCKET, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
        toast({
          variant: 'destructive',
          title: 'Error creating storage bucket',
          description: createError.message,
        });
        return false;
      }
      
      // Set bucket to public
      const { error: updateError } = await supabase.storage
        .updateBucket(LISTINGS_BUCKET, { public: true });
      
      if (updateError) {
        console.error('Error setting bucket public:', updateError);
        toast({
          variant: 'destructive',
          title: 'Error configuring storage bucket',
          description: updateError.message,
        });
        return false;
      }
      
      console.log(`${LISTINGS_BUCKET} bucket created successfully`);
    } else {
      console.log(`${LISTINGS_BUCKET} bucket already exists`);
      
      // Ensure bucket is public
      const { error: updateError } = await supabase.storage
        .updateBucket(LISTINGS_BUCKET, { public: true });
      
      if (updateError) {
        console.error('Error setting bucket public:', updateError);
        return false;
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('Error in ensureListingsBucketExists:', error);
    toast({
      variant: 'destructive',
      title: 'Storage configuration error',
      description: error.message || 'An unexpected error occurred',
    });
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
    // First ensure the bucket exists
    const bucketExists = await ensureListingsBucketExists();
    if (!bucketExists) {
      throw new Error('Storage bucket not available');
    }
    
    // Generate a unique file name
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${listingId}/${Date.now()}.${fileExt}`;
    
    console.log(`Uploading file to ${LISTINGS_BUCKET}/${fileName}`);
    
    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from(LISTINGS_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true, // Changed from false to true to handle overwrites
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(LISTINGS_BUCKET)
      .getPublicUrl(fileName);
    
    console.log('Generated public URL:', urlData.publicUrl);
    
    if (!urlData.publicUrl) {
      throw new Error('Failed to get public URL');
    }
    
    return urlData.publicUrl;
  } catch (error: any) {
    console.error('Error uploading image:', error);
    toast({
      variant: 'destructive',
      title: 'Image upload failed',
      description: error.message || 'Failed to upload image',
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
      console.error('Error listing files:', listError);
      return false;
    }
    
    if (fileList && fileList.length > 0) {
      // Delete all files for this listing
      const filePaths = fileList.map(file => `${listingId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from(LISTINGS_BUCKET)
        .remove(filePaths);
      
      if (deleteError) {
        console.error('Error deleting files:', deleteError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting images:', error);
    return false;
  }
};
