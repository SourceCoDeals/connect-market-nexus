import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { ProductionErrorBoundary, AdminErrorBoundary, AuthErrorBoundary } from './ProductionErrorBoundary';

// A component that throws an error
function ThrowingComponent(): JSX.Element {
  throw new Error('Production test error');
}

describe('ProductionErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <ProductionErrorBoundary component="TestComponent">
        <div>Safe content</div>
      </ProductionErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <ProductionErrorBoundary component="TestComponent">
        <ThrowingComponent />
      </ProductionErrorBoundary>
    );
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ProductionErrorBoundary component="TestComponent" fallback={<div>Custom fallback</div>}>
        <ThrowingComponent />
      </ProductionErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('calls onError callback', () => {
    const onError = vi.fn();
    render(
      <ProductionErrorBoundary component="TestComponent" onError={onError}>
        <ThrowingComponent />
      </ProductionErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('AdminErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <AdminErrorBoundary component="AdminPanel">
        <div>Admin content</div>
      </AdminErrorBoundary>
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('catches errors', () => {
    render(
      <AdminErrorBoundary component="AdminPanel">
        <ThrowingComponent />
      </AdminErrorBoundary>
    );
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
  });
});

describe('AuthErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <AuthErrorBoundary component="LoginForm">
        <div>Login form</div>
      </AuthErrorBoundary>
    );
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });

  it('catches errors', () => {
    render(
      <AuthErrorBoundary component="LoginForm">
        <ThrowingComponent />
      </AuthErrorBoundary>
    );
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
  });
});
