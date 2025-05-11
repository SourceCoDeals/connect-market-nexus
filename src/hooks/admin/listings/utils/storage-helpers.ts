
import { deleteListingImages, uploadListingImage, ensureListingsBucketExists } from '@/lib/storage-utils';

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
 * @deprecated Use deleteListingImages from @/lib/storage-utils instead
 */
export const deleteImagesForListing = deleteListingImages;
