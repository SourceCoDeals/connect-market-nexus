import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { uploadListingImage } from '@/lib/storage-utils';

// Validation and sanitization utilities
const sanitizeArrayField = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.filter(item => item && typeof item === 'string' && item.trim().length > 0);
  }
  return [];
};

const sanitizeStringField = (field: any, defaultValue: string = ''): string => {
  if (typeof field === 'string') return field.trim();
  return defaultValue;
};

const sanitizeNumericField = (field: any): number => {
  const num = Number(field);
  return isNaN(num) ? 0 : num;
};

// Core listing data structure that matches the database exactly
interface DatabaseListingInsert {
  title: string;
  categories: string[];
  category: string;
  description: string;
  description_html: string | null;
  description_json: any;
  location: string;
  revenue: number;
  ebitda: number;
  tags: string[];
  owner_notes: string | null;
  status: 'active' | 'inactive';
  image_url: string | null;
}

/**
 * Robust listing creation hook with comprehensive error handling
 * and isolation from external dependencies
 */
export function useRobustListingCreation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listing,
      image,
      sendDealAlerts,
    }: {
      listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>;
      image?: File | null;
      sendDealAlerts?: boolean;
    }) => {
      console.log('🚀 Starting robust listing creation...');
      
      try {
        // Step 1: Validate and sanitize all input data
        const sanitizedCategories = sanitizeArrayField(listing.categories);
        const sanitizedTags = sanitizeArrayField(listing.tags);
        
        if (sanitizedCategories.length === 0) {
          throw new Error('At least one category is required');
        }

        // Step 2: Build the exact database structure
        const databaseInsert: DatabaseListingInsert = {
          title: sanitizeStringField(listing.title),
          categories: sanitizedCategories,
          category: sanitizedCategories[0], // First category for backward compatibility
          description: sanitizeStringField(listing.description),
          description_html: listing.description_html || null,
          description_json: listing.description_json || null,
          location: sanitizeStringField(listing.location),
          revenue: sanitizeNumericField(listing.revenue),
          ebitda: sanitizeNumericField(listing.ebitda),
          tags: sanitizedTags,
          owner_notes: listing.owner_notes ? sanitizeStringField(listing.owner_notes) : null,
          status: listing.status || 'active',
          image_url: null
        };

        console.log('📋 Sanitized listing data:', JSON.stringify(databaseInsert, null, 2));

        // Step 3: Insert listing with isolated transaction
        const { data: insertedListing, error: insertError } = await supabase
          .from('listings')
          .insert(databaseInsert)
          .select()
          .single();

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          throw new Error(`Database error: ${insertError.message}`);
        }

        if (!insertedListing) {
          throw new Error('No data returned from database insert');
        }

        console.log('✅ Listing created successfully:', insertedListing.id);

        // Step 4: Handle image upload separately (isolated from main transaction)
        let finalListing = insertedListing;
        
        if (image) {
          try {
            console.log('📷 Starting image upload...');
            const publicUrl = await uploadListingImage(image, insertedListing.id);
            
            // Update listing with image URL
            const { data: updatedListing, error: updateError } = await supabase
              .from('listings')
              .update({ 
                image_url: publicUrl,
                files: [publicUrl]
              })
              .eq('id', insertedListing.id)
              .select()
              .single();

            if (updateError) {
              console.warn('⚠️ Image URL update failed:', updateError);
              toast({
                variant: 'destructive',
                title: 'Partial Success',
                description: 'Listing created but image attachment failed. You can edit the listing to add an image.',
              });
            } else {
              console.log('✅ Image attached successfully');
              finalListing = updatedListing;
            }
          } catch (imageError: any) {
            console.warn('⚠️ Image upload failed:', imageError);
            toast({
              variant: 'destructive',
              title: 'Image Upload Failed',
              description: 'Listing created successfully, but image upload failed. You can edit the listing to add an image.',
            });
          }
        }

        // Step 5: Handle deal alerts separately (completely isolated)
        if (sendDealAlerts) {
          try {
            console.log('📧 Triggering deal alerts...');
            // Call deal alerts function separately to avoid transaction interference
            await triggerDealAlertsForListing(finalListing);
          } catch (alertError: any) {
            console.warn('⚠️ Deal alerts failed:', alertError);
            // Don't fail the entire operation for deal alerts
            toast({
              title: 'Listing Created',
              description: 'Listing created successfully, but deal alerts could not be sent.',
            });
          }
        }

        return finalListing as AdminListing;

      } catch (error: any) {
        console.error('💥 Listing creation failed:', error);
        throw new Error(error.message || 'Failed to create listing');
      }
    },
    onSuccess: (data) => {
      console.log('🎉 Listing creation completed successfully');
      
      // Clear all relevant caches
      const queriesToInvalidate = [
        ['admin-listings'],
        ['listings'],
        ['listing-metadata'],
        ['listing', data.id]
      ];

      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      toast({
        title: 'Listing Created Successfully',
        description: `"${data.title}" is now live on the marketplace.`,
      });
    },
    onError: (error: any) => {
      console.error('❌ Listing creation mutation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Create Listing',
        description: error.message || 'An unexpected error occurred',
      });
    },
  });
}

/**
 * Separate function to handle deal alerts without affecting main listing creation
 */
async function triggerDealAlertsForListing(listing: any): Promise<void> {
  try {
    // Query deal alerts that match this listing
    const { data: matchingAlerts, error } = await supabase
      .rpc('match_deal_alerts_with_listing', {
        listing_data: listing
      });

    if (error) {
      console.warn('Deal alerts matching failed:', error);
      return;
    }

    if (matchingAlerts && matchingAlerts.length > 0) {
      console.log(`Found ${matchingAlerts.length} matching alerts`);
      
      // Process instant alerts
      for (const alert of matchingAlerts) {
        if (alert.alert_frequency === 'instant') {
          // Log delivery attempt
          await supabase
            .from('alert_delivery_logs')
            .insert({
              alert_id: alert.alert_id,
              listing_id: listing.id,
              user_id: alert.user_id,
              delivery_status: 'pending'
            });

          // Trigger edge function
          try {
            const { data, error: functionError } = await supabase.functions.invoke('send-deal-alert', {
              body: {
                alert_id: alert.alert_id,
                user_email: alert.user_email,
                user_id: alert.user_id,
                listing_id: listing.id,
                alert_name: alert.alert_name,
                listing_data: listing
              }
            });

            if (functionError) {
              throw functionError;
            }
            
            console.log(`✅ Deal alert sent for user ${alert.user_id}`);
          } catch (emailError) {
            console.warn(`Failed to send deal alert for user ${alert.user_id}:`, emailError);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Deal alerts processing failed:', error);
    throw error;
  }
}