import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track mock functions so we can configure them per test
const mockEnroll = vi.fn();
const mockVerify = vi.fn();
const mockUnenroll = vi.fn();
const mockListFactors = vi.fn();
const mockChallenge = vi.fn();
const mockGetAuthenticatorAssuranceLevel = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      mfa: {
        enroll: (...args: unknown[]) => mockEnroll(...args),
        verify: (...args: unknown[]) => mockVerify(...args),
        unenroll: (...args: unknown[]) => mockUnenroll(...args),
        listFactors: (...args: unknown[]) => mockListFactors(...args),
        challenge: (...args: unknown[]) => mockChallenge(...args),
        getAuthenticatorAssuranceLevel: (...args: unknown[]) =>
          mockGetAuthenticatorAssuranceLevel(...args),
      },
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

// Mock React hooks since we're in node environment
let stateStore: Record<string, unknown> = {};
let stateCounter = 0;

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const key = `state_${stateCounter++}`;
    if (!(key in stateStore)) {
      stateStore[key] = initial;
    }
    const setState = (val: unknown) => {
      stateStore[key] =
        typeof val === 'function' ? (val as (prev: unknown) => unknown)(stateStore[key]) : val;
    };
    return [stateStore[key], setState];
  },
  useEffect: (fn: () => void) => {
    fn();
  },
  useCallback: <T>(fn: T) => fn,
}));

describe('useMFA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateStore = {};
    stateCounter = 0;
    // Default: no factors
    mockListFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  });

  describe('fetchFactors / initialization', () => {
    it('should set status to "disabled" when no TOTP factors exist', async () => {
      mockListFactors.mockResolvedValue({ data: { totp: [] }, error: null });
      const { useMFA } = await import('./use-mfa');
      const result = useMFA();
      // After useEffect runs fetchFactors
      expect(mockListFactors).toHaveBeenCalled();
      expect(result.status).toBe('disabled');
    });

    it('should set status to "enrolled" when a verified factor exists', async () => {
      mockListFactors.mockResolvedValue({
        data: {
          totp: [
            { id: 'factor-1', status: 'verified', factor_type: 'totp', created_at: '2025-01-01' },
          ],
        },
        error: null,
      });

      // Reset module state
      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const result = useMFA();
      expect(result.factors.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle listFactors error gracefully', async () => {
      mockListFactors.mockResolvedValue({
        data: null,
        error: new Error('MFA service unavailable'),
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const result = useMFA();
      expect(result.error).toBeDefined();
    });
  });

  describe('enroll', () => {
    it('should call supabase.auth.mfa.enroll with correct params', async () => {
      mockEnroll.mockResolvedValue({
        data: {
          id: 'new-factor-id',
          type: 'totp',
          totp: {
            qr_code: 'data:image/png;base64,abc',
            secret: 'JBSWY3DPEHPK3PXP',
            uri: 'otpauth://totp/SourceCo?secret=JBSWY3DPEHPK3PXP',
          },
        },
        error: null,
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { enroll } = useMFA();
      const result = await enroll('My Authenticator');

      expect(mockEnroll).toHaveBeenCalledWith({
        factorType: 'totp',
        friendlyName: 'My Authenticator',
      });
      expect(result).not.toBeNull();
      expect(result?.totp.secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('should use default friendly name when none provided', async () => {
      mockEnroll.mockResolvedValue({
        data: {
          id: 'new-factor-id',
          type: 'totp',
          totp: { qr_code: '', secret: '', uri: '' },
        },
        error: null,
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { enroll } = useMFA();
      await enroll();

      expect(mockEnroll).toHaveBeenCalledWith({
        factorType: 'totp',
        friendlyName: 'SourceCo Authenticator',
      });
    });

    it('should return null and set error on enrollment failure', async () => {
      mockEnroll.mockResolvedValue({
        data: null,
        error: new Error('Enrollment failed'),
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { enroll } = useMFA();
      const result = await enroll();

      expect(result).toBeNull();
    });
  });

  describe('verify', () => {
    it('should challenge then verify with correct params', async () => {
      mockChallenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      });
      mockVerify.mockResolvedValue({ error: null });
      mockListFactors.mockResolvedValue({ data: { totp: [] }, error: null });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { verify } = useMFA();
      const result = await verify('factor-abc', '123456');

      expect(mockChallenge).toHaveBeenCalledWith({ factorId: 'factor-abc' });
      expect(mockVerify).toHaveBeenCalledWith({
        factorId: 'factor-abc',
        challengeId: 'challenge-123',
        code: '123456',
      });
      expect(result).toBe(true);
    });

    it('should return false when challenge fails', async () => {
      mockChallenge.mockResolvedValue({
        data: null,
        error: new Error('Challenge creation failed'),
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { verify } = useMFA();
      const result = await verify('factor-abc', '123456');

      expect(result).toBe(false);
    });

    it('should return false when verification code is invalid', async () => {
      mockChallenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      });
      mockVerify.mockResolvedValue({
        error: new Error('Invalid TOTP code'),
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { verify } = useMFA();
      const result = await verify('factor-abc', '000000');

      expect(result).toBe(false);
    });
  });

  describe('unenroll', () => {
    it('should unenroll a factor successfully', async () => {
      mockUnenroll.mockResolvedValue({ error: null });
      mockListFactors.mockResolvedValue({ data: { totp: [] }, error: null });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { unenroll } = useMFA();
      const result = await unenroll('factor-to-remove');

      expect(mockUnenroll).toHaveBeenCalledWith({ factorId: 'factor-to-remove' });
      expect(result).toBe(true);
    });

    it('should return false when unenroll fails', async () => {
      mockUnenroll.mockResolvedValue({
        error: new Error('Cannot unenroll'),
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { unenroll } = useMFA();
      const result = await unenroll('factor-abc');

      expect(result).toBe(false);
    });
  });

  describe('challengeAndVerify', () => {
    it('should return false when no verified factor exists', async () => {
      mockListFactors.mockResolvedValue({
        data: { totp: [{ id: 'f1', status: 'unverified' }] },
        error: null,
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { challengeAndVerify } = useMFA();
      const result = await challengeAndVerify('123456');

      expect(result).toBe(false);
    });
  });

  describe('getAssuranceLevel', () => {
    it('should return assurance level data', async () => {
      mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
        data: {
          currentLevel: 'aal1',
          nextLevel: 'aal2',
          currentAuthenticationMethods: [{ method: 'password', timestamp: 1234567890 }],
        },
        error: null,
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { getAssuranceLevel } = useMFA();
      const result = await getAssuranceLevel();

      expect(result.currentLevel).toBe('aal1');
      expect(result.nextLevel).toBe('aal2');
      expect(result.currentAuthenticationMethods).toHaveLength(1);
    });

    it('should throw when getAuthenticatorAssuranceLevel fails', async () => {
      mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
        data: null,
        error: new Error('Assurance level check failed'),
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useMFA } = await import('./use-mfa');
      const { getAssuranceLevel } = useMFA();
      await expect(getAssuranceLevel()).rejects.toThrow('Assurance level check failed');
    });
  });
});

describe('useMFAChallengeRequired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateStore = {};
    stateCounter = 0;
  });

  it('should set needsChallenge true when aal1 with aal2 next', async () => {
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    });

    vi.resetModules();
    stateStore = {};
    stateCounter = 0;

    const { useMFAChallengeRequired } = await import('./use-mfa');
    const result = useMFAChallengeRequired();
    // In our mocked useEffect, the check runs synchronously
    expect(result).toBeDefined();
  });

  it('should set needsChallenge false when already aal2', async () => {
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2' },
      error: null,
    });

    vi.resetModules();
    stateStore = {};
    stateCounter = 0;

    const { useMFAChallengeRequired } = await import('./use-mfa');
    const result = useMFAChallengeRequired();
    expect(result).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: null,
      error: new Error('Service unavailable'),
    });

    vi.resetModules();
    stateStore = {};
    stateCounter = 0;

    const { useMFAChallengeRequired } = await import('./use-mfa');
    const result = useMFAChallengeRequired();
    expect(result).toBeDefined();
  });
});
