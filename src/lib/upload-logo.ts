// Utility to upload the premium SourceCo logo to Supabase storage
import { supabase } from '@/integrations/supabase/client';

export const uploadPremiumLogo = async () => {
  try {
    // Import the logo image
    const logoModule = await import('@/assets/sourceco-logo-premium.png');
    const logoUrl = logoModule.default;
    
    // Fetch the image and convert to blob
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('listing-images')
      .upload('sourceco-logo-premium.png', blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png'
      });
    
    if (error) {
      console.error('Logo upload error:', error);
      throw error;
    }
    
    console.log('✅ Premium SourceCo logo uploaded successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to upload premium logo:', error);
    throw error;
  }
};