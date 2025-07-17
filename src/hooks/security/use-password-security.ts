
import { useState, useEffect } from 'react';
import { PasswordSecurity, PasswordStrengthResult } from '@/lib/password-security';

export const usePasswordSecurity = (password: string, email?: string) => {
  const [strengthResult, setStrengthResult] = useState<PasswordStrengthResult | null>(null);
  const [breachResult, setBreachResult] = useState<{ is_breached: boolean; breach_count: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!password || password.length < 3) {
      setStrengthResult(null);
      setBreachResult(null);
      return;
    }

    const checkPassword = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check password strength
        const strength = await PasswordSecurity.validateStrength(password, email);
        setStrengthResult(strength);

        // Check for breaches (non-blocking)
        const breach = await PasswordSecurity.checkBreaches(password);
        setBreachResult(breach);
      } catch (err) {
        console.error('Password security check failed:', err);
        setError('Unable to validate password security');
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce password checking
    const timeoutId = setTimeout(checkPassword, 500);
    return () => clearTimeout(timeoutId);
  }, [password, email]);

  return {
    strengthResult,
    breachResult,
    isLoading,
    error,
    isSecure: strengthResult?.meets_policy && !breachResult?.is_breached,
  };
};
