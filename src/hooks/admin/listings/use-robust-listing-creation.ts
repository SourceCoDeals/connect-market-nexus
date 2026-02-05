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
  acquisition_type?: 'add_on' | 'platform' | null;
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
  
  // CRITICAL: Marketplace visibility control
  is_internal_deal: boolean;
  
  // Employee metrics
  full_time_employees?: number | null;
  part_time_employees?: number | null;
  
  // Hero & Status
  hero_description?: string | null;
  status_tag?: string | null;
  visible_to_buyer_types?: string[] | null;
  
  // Internal company info
  internal_company_name?: string | null;
  internal_salesforce_link?: string | null;
  internal_deal_memo_link?: string | null;
  internal_contact_info?: string | null;
  internal_notes?: string | null;
  
  // Ownership
  primary_owner_id?: string | null;
  presented_by_admin_id?: string | null;
  
  // Custom metrics (metric 2)
  custom_metric_label?: string | null;
  custom_metric_value?: string | null;
  custom_metric_subtitle?: string | null;
  
  // Metric 3
  metric_3_type?: string | null;
  metric_3_custom_label?: string | null;
  metric_3_custom_value?: string | null;
  metric_3_custom_subtitle?: string | null;
  
  // Metric 4
  metric_4_type?: string | null;
  metric_4_custom_label?: string | null;
  metric_4_custom_value?: string | null;
  metric_4_custom_subtitle?: string | null;
  
  // Revenue/EBITDA subtitles
  revenue_metric_subtitle?: string | null;
  ebitda_metric_subtitle?: string | null;
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
        // CRITICAL: Admin listings are created as drafts (internal) until explicitly published
        // This prevents accidental marketplace publication
        const databaseInsert: DatabaseListingInsert = {
          title: sanitizeStringField(listing.title),
          categories: sanitizedCategories,
          category: sanitizedCategories[0], // First category for backward compatibility
          acquisition_type: (listing.acquisition_type === 'add_on' || listing.acquisition_type === 'platform') 
            ? listing.acquisition_type 
            : null,
          description: sanitizeStringField(listing.description),
          description_html: listing.description_html || null,
          description_json: listing.description_json || null,
          location: sanitizeStringField(listing.location),
          revenue: sanitizeNumericField(listing.revenue),
          ebitda: sanitizeNumericField(listing.ebitda),
          tags: sanitizedTags,
          owner_notes: listing.owner_notes ? sanitizeStringField(listing.owner_notes) : null,
          status: listing.status || 'active',
          image_url: null,
          // IMPORTANT: Create as internal draft - must use publish-listing to go public
          is_internal_deal: true,
          
          // Employee metrics
          full_time_employees: listing.full_time_employees || null,
          part_time_employees: listing.part_time_employees || null,
          
          // Hero & Status
          hero_description: listing.hero_description || null,
          status_tag: listing.status_tag || null,
          visible_to_buyer_types: listing.visible_to_buyer_types || null,
          
          // Internal company info
          internal_company_name: listing.internal_company_name || null,
          internal_salesforce_link: listing.internal_salesforce_link || null,
          internal_deal_memo_link: listing.internal_deal_memo_link || null,
          internal_contact_info: listing.internal_contact_info || null,
          internal_notes: listing.internal_notes || null,
          
          // Ownership
          primary_owner_id: listing.primary_owner_id || null,
          presented_by_admin_id: listing.presented_by_admin_id || null,
          
          // Custom metrics (metric 2)
          custom_metric_label: listing.custom_metric_label || null,
          custom_metric_value: listing.custom_metric_value || null,
          custom_metric_subtitle: listing.custom_metric_subtitle || null,
          
          // Metric 3
          metric_3_type: listing.metric_3_type || null,
          metric_3_custom_label: listing.metric_3_custom_label || null,
          metric_3_custom_value: listing.metric_3_custom_value || null,
          metric_3_custom_subtitle: listing.metric_3_custom_subtitle || null,
          
          // Metric 4
          metric_4_type: listing.metric_4_type || null,
          metric_4_custom_label: listing.metric_4_custom_label || null,
          metric_4_custom_value: listing.metric_4_custom_value || null,
          metric_4_custom_subtitle: listing.metric_4_custom_subtitle || null,
          
          // Revenue/EBITDA subtitles
          revenue_metric_subtitle: listing.revenue_metric_subtitle || null,
          ebitda_metric_subtitle: listing.ebitda_metric_subtitle || null,
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
        title: 'Listing Created as Draft',
        description: `"${data.title}" has been created. Use the Publish button to make it visible on the marketplace.`,
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