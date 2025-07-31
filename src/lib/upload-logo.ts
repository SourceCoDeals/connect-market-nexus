// Utility to upload the premium SourceCo logo to Supabase storage
import { supabase } from '@/integrations/supabase/client';

export const uploadPremiumLogo = async () => {
  try {
    // Use the actual uploaded logo
    const logoUrl = '/lovable-uploads/660e3240-2a08-42a0-8723-65b152b941a5.png';
    
    // Fetch the image and convert to blob
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    
    // Upload to Supabase storage with the correct filename
    const { data, error } = await supabase.storage
      .from('listing-images')
      .upload('660e3240-2a08-42a0-8723-65b152b941a5.png', blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png'
      });
    
    if (error) {
      console.error('Logo upload error:', error);
      throw error;
    }
    
    console.log('✅ SourceCo logo uploaded successfully:', data);
    
    // Also upload with a more readable name
    const { data: data2, error: error2 } = await supabase.storage
      .from('listing-images')
      .upload('sourceco-logo-email.png', blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png'
      });
    
    if (error2) {
      console.warn('Warning: Could not upload with readable name:', error2);
    }
    
    return data;
    return data;
  } catch (error) {
    console.error('❌ Failed to upload premium logo:', error);
    throw error;
  }
};