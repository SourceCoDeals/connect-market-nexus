
import { supabase } from '@/integrations/supabase/client';

export interface SecurityValidationResult {
  valid: boolean;
  errors: string[];
  sanitized_data?: any;
  risk_score?: number;
}

export class SecurityValidation {
  /**
   * Validate profile data with security checks
   */
  static async validateProfile(data: any, userId?: string): Promise<SecurityValidationResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('security-validation', {
        body: {
          action: 'validate_profile',
          data,
          user_id: userId
        }
      });

      if (error) {
        console.error('Profile validation error:', error);
        return {
          valid: false,
          errors: ['Validation service unavailable'],
          risk_score: 5
        };
      }

      return result;
    } catch (error) {
      console.error('Profile validation failed:', error);
      return {
        valid: false,
        errors: ['Validation failed'],
        risk_score: 5
      };
    }
  }

  /**
   * Validate listing data with security checks
   */
  static async validateListing(data: any, userId?: string): Promise<SecurityValidationResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('security-validation', {
        body: {
          action: 'validate_listing',
          data,
          user_id: userId
        }
      });

      if (error) {
        console.error('Listing validation error:', error);
        return {
          valid: false,
          errors: ['Validation service unavailable'],
          risk_score: 5
        };
      }

      return result;
    } catch (error) {
      console.error('Listing validation failed:', error);
      return {
        valid: false,
        errors: ['Validation failed'],
        risk_score: 5
      };
    }
  }

  /**
   * Validate connection request with security checks
   */
  static async validateConnectionRequest(data: any, userId?: string): Promise<SecurityValidationResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('security-validation', {
        body: {
          action: 'validate_connection_request',
          data,
          user_id: userId
        }
      });

      if (error) {
        console.error('Connection request validation error:', error);
        return {
          valid: false,
          errors: ['Validation service unavailable'],
          risk_score: 5
        };
      }

      return result;
    } catch (error) {
      console.error('Connection request validation failed:', error);
      return {
        valid: false,
        errors: ['Validation failed'],
        risk_score: 5
      };
    }
  }
}
