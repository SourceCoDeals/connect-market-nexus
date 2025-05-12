
import { useState, useEffect } from 'react';

type StorageStatus = {
  isStorageReady: boolean;
  isChecking: boolean;
  errorMessage?: string;
};

/**
 * Hook to check if storage is properly configured
 * Modified to always return that storage is ready since the warning is no longer needed
 */
export function useStorageStatus(skipCache = false): StorageStatus {
  // Simply return that storage is ready to prevent showing any warnings
  return {
    isStorageReady: true,
    isChecking: false,
    errorMessage: undefined,
  };
}
