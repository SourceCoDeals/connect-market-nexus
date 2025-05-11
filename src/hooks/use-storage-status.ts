
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LISTINGS_BUCKET } from '@/lib/storage-utils';

type StorageStatus = {
  isStorageReady: boolean;
  isChecking: boolean;
  errorMessage?: string;
};

// Cache key for session storage
const STORAGE_STATUS_KEY = 'supabase_storage_status';
// Cache duration in milliseconds (10 minutes)
const CACHE_DURATION = 10 * 60 * 1000;

/**
 * Hook to check if storage is properly configured
 * Returns storage status and performs check only once per session
 */
export function useStorageStatus(skipCache = false): StorageStatus {
  const [status, setStatus] = useState<StorageStatus>({
    isStorageReady: true, // Optimistic by default
    isChecking: true,
    errorMessage: undefined,
  });

  useEffect(() => {
    const checkStorage = async () => {
      // Check if we have a cached result
      if (!skipCache) {
        const cachedStatus = sessionStorage.getItem(STORAGE_STATUS_KEY);
        if (cachedStatus) {
          try {
            const parsedStatus = JSON.parse(cachedStatus);
            const timestamp = parsedStatus.timestamp || 0;
            
            // Use cached result if it's still valid (within cache duration)
            if (Date.now() - timestamp < CACHE_DURATION) {
              setStatus({
                isStorageReady: parsedStatus.isStorageReady,
                isChecking: false,
                errorMessage: parsedStatus.errorMessage,
              });
              return;
            }
          } catch (e) {
            console.error('Error parsing cached storage status', e);
            // Continue with the check if parsing fails
          }
        }
      }

      try {
        // Check if bucket exists
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          setStatus({
            isStorageReady: false,
            isChecking: false,
            errorMessage: `Storage access error: ${bucketsError.message}`,
          });
          cacheStatus(false, bucketsError.message);
          return;
        }

        const bucketExists = buckets?.some(b => b.name === LISTINGS_BUCKET);
        
        if (!bucketExists) {
          setStatus({
            isStorageReady: false,
            isChecking: false,
            errorMessage: `Storage bucket "${LISTINGS_BUCKET}" not found.`,
          });
          cacheStatus(false, `Storage bucket "${LISTINGS_BUCKET}" not found.`);
          return;
        }
        
        // Check public access by trying to get a public URL
        const testPath = 'test-access.txt';
        const { data: urlData } = supabase.storage
          .from(LISTINGS_BUCKET)
          .getPublicUrl(testPath);
        
        if (!urlData.publicUrl) {
          setStatus({
            isStorageReady: false, 
            isChecking: false,
            errorMessage: 'Unable to generate public URLs. Check bucket permissions.',
          });
          cacheStatus(false, 'Unable to generate public URLs. Check bucket permissions.');
          return;
        }

        // Everything looks good
        setStatus({ 
          isStorageReady: true, 
          isChecking: false 
        });
        cacheStatus(true);
        
      } catch (error: any) {
        console.error('Error checking storage status:', error);
        setStatus({
          isStorageReady: false,
          isChecking: false,
          errorMessage: error.message || 'Unknown storage error',
        });
        cacheStatus(false, error.message || 'Unknown storage error');
      }
    };

    const cacheStatus = (isReady: boolean, errorMsg?: string) => {
      try {
        sessionStorage.setItem(
          STORAGE_STATUS_KEY,
          JSON.stringify({
            isStorageReady: isReady,
            errorMessage: errorMsg,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.error('Error caching storage status', e);
      }
    };

    checkStorage();
  }, [skipCache]);

  return status;
}
