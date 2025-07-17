
import { supabase } from '@/integrations/supabase/client';

export interface PasswordStrengthResult {
  score: number;
  strength: 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong';
  feedback: string[];
  meets_policy: boolean;
}

export interface PasswordPolicyResult {
  compliant: boolean;
  violations: string[];
  policy: {
    min_length: number;
    require_uppercase: boolean;
    require_lowercase: boolean;
    require_numbers: boolean;
    require_special: boolean;
    max_age_days: number;
    prevent_reuse: number;
  };
}

export class PasswordSecurity {
  /**
   * Validate password strength
   */
  static async validateStrength(password: string, email?: string): Promise<PasswordStrengthResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('password-security', {
        body: {
          action: 'validate_strength',
          password,
          email
        }
      });

      if (error) {
        console.error('Password strength validation error:', error);
        return {
          score: 0,
          strength: 'very_weak',
          feedback: ['Validation service unavailable'],
          meets_policy: false
        };
      }

      return result;
    } catch (error) {
      console.error('Password strength validation failed:', error);
      return {
        score: 0,
        strength: 'very_weak',
        feedback: ['Validation failed'],
        meets_policy: false
      };
    }
  }

  /**
   * Check if password has been in data breaches
   */
  static async checkBreaches(password: string) {
    try {
      const { data: result, error } = await supabase.functions.invoke('password-security', {
        body: {
          action: 'check_breaches',
          password
        }
      });

      if (error) {
        console.error('Password breach check error:', error);
        return { is_breached: false, breach_count: 0 };
      }

      return result;
    } catch (error) {
      console.error('Password breach check failed:', error);
      return { is_breached: false, breach_count: 0 };
    }
  }

  /**
   * Enforce password policy
   */
  static async enforcePolicy(password: string, userId?: string): Promise<PasswordPolicyResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('password-security', {
        body: {
          action: 'enforce_policy',
          password,
          user_id: userId
        }
      });

      if (error) {
        console.error('Password policy enforcement error:', error);
        return {
          compliant: false,
          violations: ['Policy service unavailable'],
          policy: {
            min_length: 8,
            require_uppercase: true,
            require_lowercase: true,
            require_numbers: true,
            require_special: true,
            max_age_days: 90,
            prevent_reuse: 3
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Password policy enforcement failed:', error);
      return {
        compliant: false,
        violations: ['Policy enforcement failed'],
        policy: {
          min_length: 8,
          require_uppercase: true,
          require_lowercase: true,
          require_numbers: true,
          require_special: true,
          max_age_days: 90,
          prevent_reuse: 3
        }
      };
    }
  }
}
