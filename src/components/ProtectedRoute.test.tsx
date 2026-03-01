import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import ProtectedRoute from './ProtectedRoute';

// Mock useAuth from AuthContext
const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Track Navigate calls
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: (props: { to: string; replace?: boolean }) => {
      mockNavigate(props);
      return <div data-testid="navigate" data-to={props.to} />;
    },
  };
});

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated user to /login', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAdmin: false,
      teamRole: null,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('blocks non-admin from a requireAdmin route', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        approval_status: 'approved',
      },
      isLoading: false,
      isAdmin: false,
      teamRole: 'viewer',
    });

    render(
      <ProtectedRoute requireAdmin>
        <div>Admin Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('allows approved user to pass through', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        approval_status: 'approved',
      },
      isLoading: false,
      isAdmin: false,
      teamRole: 'viewer',
    });

    render(
      <ProtectedRoute requireApproved>
        <div>Approved Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Approved Content')).toBeInTheDocument();
  });

  it('redirects unapproved user to /pending-approval', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-2',
        email: 'pending@example.com',
        approval_status: 'pending',
      },
      isLoading: false,
      isAdmin: false,
      teamRole: null,
    });

    render(
      <ProtectedRoute requireApproved>
        <div>Approved Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/pending-approval');
    expect(screen.queryByText('Approved Content')).not.toBeInTheDocument();
  });
});
