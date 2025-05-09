
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
    console.log('Checking if listings bucket exists...');
    
    // Try to get the bucket first
    const { data: buckets, error: listError } = await supabase.storage
      .listBuckets();
      
    if (listError) {
      console.error('Error listing buckets:', listError);
      toast({
        variant: 'destructive',
        title: 'Storage Error',
        description: `Failed to check storage buckets: ${listError.message}`,
      });
      return false;
    }
    
    // Check if our bucket exists
    const bucketExists = buckets?.some(bucket => bucket.name === LISTINGS_BUCKET);
    
    if (!bucketExists) {
      console.log(`Creating ${LISTINGS_BUCKET} storage bucket...`);
      
      // Create the bucket with public access
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
      
      // Make sure bucket is public by updating its settings
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
      return true;
    } else {
      console.log(`${LISTINGS_BUCKET} bucket already exists`);
      
      // Important: Set the bucket to public if it exists but isn't public
      const { data: bucket, error: getBucketError } = await supabase.storage
        .getBucket(LISTINGS_BUCKET);
      
      if (getBucketError) {
        console.error('Error getting bucket details:', getBucketError);
        return true; // Return true anyway since the bucket exists
      }
      
      if (!bucket?.public) {
        console.log(`Setting ${LISTINGS_BUCKET} bucket to public...`);
        const { error: updateError } = await supabase.storage
          .updateBucket(LISTINGS_BUCKET, { public: true });
        
        if (updateError) {
          console.error('Error setting bucket public:', updateError);
          return true; // Return true anyway since the bucket exists
        }
        
        console.log(`Updated ${LISTINGS_BUCKET} bucket to be public`);
      }
      
      return true;
    }
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
    
    console.log(`Uploading image for listing ${listingId}...`);
    
    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from(LISTINGS_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true, // Changed to true to allow overwriting existing files
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(LISTINGS_BUCKET)
      .getPublicUrl(fileName);
    
    if (!urlData.publicUrl) {
      throw new Error('Failed to get public URL');
    }
    
    console.log(`Image uploaded successfully, public URL: ${urlData.publicUrl}`);
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
