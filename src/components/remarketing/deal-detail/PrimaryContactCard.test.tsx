import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { PrimaryContactCard } from './PrimaryContactCard';

vi.mock('@/components/shared/ClickToDialPhone', () => ({
  ClickToDialPhone: ({ phone, label }: { phone: string; label?: string }) => (
    <span data-testid="click-to-dial">{label ?? phone}</span>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseProps = {
  name: 'John Smith',
  email: 'john@example.com',
  phone: '555-0001',
  dealId: 'deal-1',
};

describe('PrimaryContactCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing additional phones in the read view', () => {
    render(
      <PrimaryContactCard
        {...baseProps}
        additionalPhones={['555-0002', '555-0003']}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const dials = screen.getAllByTestId('click-to-dial');
    const text = dials.map((n) => n.textContent);
    expect(text).toContain('555-0001');
    expect(text).toContain('555-0002');
    expect(text).toContain('555-0003');
  });

  it('sends additional phones through onSave when the user adds one', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<PrimaryContactCard {...baseProps} onSave={onSave} />);

    // Open the edit dialog
    fireEvent.click(screen.getByRole('button', { name: '' }));

    // Click "Add Phone Number"
    fireEvent.click(screen.getByRole('button', { name: /add phone number/i }));

    // Fill the new input — it's the only one with the "Additional phone number" placeholder
    const newInput = screen.getByPlaceholderText('Additional phone number');
    fireEvent.change(newInput, { target: { value: '555-0002' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Smith',
        email: 'john@example.com',
        phone: '555-0001',
        additionalPhones: ['555-0002'],
      }),
    );
  });

  it('filters out blank additional phones before saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<PrimaryContactCard {...baseProps} additionalPhones={['555-0002']} onSave={onSave} />);

    // Open edit
    fireEvent.click(screen.getByRole('button', { name: '' }));

    // Add a second additional slot and leave it blank
    fireEvent.click(screen.getByRole('button', { name: /add phone number/i }));

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalPhones: ['555-0002'],
      }),
    );
  });

  it('removes an additional phone when its X button is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <PrimaryContactCard
        {...baseProps}
        additionalPhones={['555-0002', '555-0003']}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '' }));

    // The additional-phone inputs have remove buttons (lucide X icon, no label);
    // grab them by finding the wrapper row.
    const inputs = screen.getAllByPlaceholderText('Additional phone number');
    expect(inputs).toHaveLength(2);

    // The remove button is the button sibling in the same row as the input.
    const firstRow = inputs[0].parentElement!;
    const removeButton = firstRow.querySelector('button')!;
    fireEvent.click(removeButton);

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalPhones: ['555-0003'],
      }),
    );
  });
});
