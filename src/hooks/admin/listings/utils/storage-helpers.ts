
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { uploadListingImage, ensureListingsBucketExists } from '@/lib/storage-utils';

/**
 * Helper function to ensure the storage bucket exists
 * @deprecated Use ensureListingsBucketExists from @/lib/storage-utils instead
 */
export const ensureStorageBucketExists = ensureListingsBucketExists;

/**
 * Helper function to upload an image to Supabase Storage
 * @deprecated Use uploadListingImage from @/lib/storage-utils instead
 */
export const uploadImage = uploadListingImage;

/**
 * Helper function to delete images from storage
 */
export const deleteImagesForListing = async (listingId: string) => {
  try {
    const bucketName = 'listings';
    
    // List all files in the listing's folder
    const { data: fileList, error: listError } = await supabase.storage
      .from(bucketName)
      .list(`${listingId}`);
    
    if (!listError && fileList && fileList.length > 0) {
      // Delete all files for this listing
      const filePaths = fileList.map(file => `${listingId}/${file.name}`);
      await supabase.storage
        .from(bucketName)
        .remove(filePaths);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting images for listing:', error);
    // Return true anyway so listing deletion can continue
    return true;
  }
};
