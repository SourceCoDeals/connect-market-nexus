import { supabase } from '@/integrations/supabase/client';

export const SOURCECO_LOGO_PATH = 'sourceco-logo-gold.png';

/**
 * Ensure the SourceCo logo is uploaded to storage
 */
export const ensureSourceCoLogoInStorage = async (): Promise<string | null> => {
  try {
    // First check if logo already exists in storage
    const { data: existingFile } = await supabase.storage
      .from('listings')
      .list('', { search: SOURCECO_LOGO_PATH });

    if (existingFile && existingFile.length > 0) {
      console.log('SourceCo logo already exists in storage');
      return `https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listings/${SOURCECO_LOGO_PATH}`;
    }

    // Try to fetch the logo from the uploaded location
    const sourceUrl = 'https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listing-images/660e3240-2a08-42a0-8723-65b152b941a5.png';
    const response = await fetch(sourceUrl);
    
    if (!response.ok) {
      console.warn('Could not fetch SourceCo logo from uploaded location');
      return null;
    }

    const logoBlob = await response.blob();
    
    // Upload to listings bucket
    const { data, error } = await supabase.storage
      .from('listings')
      .upload(SOURCECO_LOGO_PATH, logoBlob, {
        upsert: true,
        contentType: 'image/png'
      });

    if (error) {
      console.error('Failed to upload SourceCo logo to storage:', error);
      return null;
    }

    console.log('Successfully uploaded SourceCo logo to storage');
    return `https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listings/${SOURCECO_LOGO_PATH}`;
  } catch (error) {
    console.error('Error ensuring SourceCo logo in storage:', error);
    return null;
  }
};

/**
 * Get the SourceCo logo URL from storage
 */
export const getSourceCoLogoUrl = (): string => {
  return `https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listings/${SOURCECO_LOGO_PATH}`;
};