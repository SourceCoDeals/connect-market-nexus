import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

describe('Card', () => {
  it('renders card component', () => {
    render(<Card data-testid="card">Card content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toBeInTheDocument();
    expect(card.textContent).toBe('Card content');
  });

  it('applies default card classes', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.classList.contains('rounded-xl')).toBe(true);
    expect(card.classList.contains('border')).toBe(true);
  });

  it('applies custom className', () => {
    render(<Card data-testid="card" className="custom-card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.classList.contains('custom-card')).toBe(true);
  });
});

describe('CardHeader', () => {
  it('renders header with padding', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId('header');
    expect(header).toBeInTheDocument();
    expect(header.classList.contains('p-6')).toBe(true);
  });
});

describe('CardTitle', () => {
  it('renders as h3 element', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title.tagName).toBe('H3');
    expect(title.classList.contains('text-2xl')).toBe(true);
  });
});

describe('CardDescription', () => {
  it('renders description text', () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('has muted foreground text', () => {
    render(<CardDescription data-testid="desc">Desc</CardDescription>);
    const desc = screen.getByTestId('desc');
    expect(desc.classList.contains('text-muted-foreground')).toBe(true);
  });
});

describe('CardContent', () => {
  it('renders content with padding', () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    const content = screen.getByTestId('content');
    expect(content).toBeInTheDocument();
    expect(content.classList.contains('p-6')).toBe(true);
  });
});

describe('CardFooter', () => {
  it('renders footer with flex layout', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer.classList.contains('flex')).toBe(true);
  });
});

describe('Full Card Composition', () => {
  it('renders a complete card with all parts', () => {
    render(
      <Card data-testid="full-card">
        <CardHeader>
          <CardTitle>My Card</CardTitle>
          <CardDescription>Card description here</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('My Card')).toBeInTheDocument();
    expect(screen.getByText('Card description here')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
