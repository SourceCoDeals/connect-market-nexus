
import { useState } from 'react';
import { usePasswordSecurity } from './use-password-security';
import { PasswordSecurity } from '@/lib/password-security';
import { toast } from '@/hooks/use-toast';

export const useEnhancedPasswordSecurity = (password: string, email?: string, userId?: string) => {
  const [isValidating, setIsValidating] = useState(false);
  const [policyResult, setPolicyResult] = useState<any>(null);
  
  const { strengthResult, breachResult, isLoading, error, isSecure } = usePasswordSecurity(password, email);

  const validatePolicy = async () => {
    if (!password) return null;

    setIsValidating(true);
    try {
      const result = await PasswordSecurity.enforcePolicy(password, userId);
      setPolicyResult(result);
      
      if (!result.compliant) {
        toast({
          title: "Password Policy Violation",
          description: `Password must meet policy requirements: ${result.violations.join(', ')}`,
          variant: "destructive",
        });
      }
      
      return result;
    } catch (err) {
      console.error('Password policy validation failed:', err);
      return null;
    } finally {
      setIsValidating(false);
    }
  };

  const getSecurityWarnings = () => {
    const warnings: string[] = [];
    
    if (breachResult?.is_breached) {
      warnings.push(`This password has been found in ${breachResult.breach_count} data breaches`);
    }
    
    if (strengthResult && !strengthResult.meets_policy) {
      warnings.push('Password does not meet minimum security requirements');
    }
    
    if (policyResult && !policyResult.compliant) {
      warnings.push('Password violates organizational policy');
    }
    
    return warnings;
  };

  return {
    strengthResult,
    breachResult,
    policyResult,
    isLoading: isLoading || isValidating,
    error,
    isSecure: isSecure && (policyResult?.compliant !== false),
    warnings: getSecurityWarnings(),
    validatePolicy,
  };
};
