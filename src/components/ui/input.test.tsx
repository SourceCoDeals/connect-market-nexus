import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { Input } from './input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('handles text type by default', () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId('input');
    // Default type is text (undefined means text in HTML)
    expect(input.getAttribute('type')).toBeNull();
  });

  it('accepts different types', () => {
    render(<Input type="email" data-testid="email-input" />);
    const input = screen.getByTestId('email-input');
    expect(input.getAttribute('type')).toBe('email');
  });

  it('handles value changes', () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} data-testid="input" />);
    const input = screen.getByTestId('input');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input.classList.contains('custom-input')).toBe(true);
  });

  it('supports disabled state', () => {
    render(<Input disabled data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toBeDisabled();
  });

  it('has spellCheck enabled', () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input.getAttribute('spellcheck')).toBe('true');
  });

  it('forwards ref', () => {
    const ref = { current: null } as React.RefObject<HTMLInputElement>;
    render(<Input ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('accepts value prop (controlled)', () => {
    render(<Input value="controlled value" readOnly data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toBe('controlled value');
  });
});
