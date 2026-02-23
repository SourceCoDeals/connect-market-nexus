#!/bin/bash
#
# Generate a new React component with standard structure.
#
# Usage:
#   ./scripts/generate-component.sh MyComponent
#   ./scripts/generate-component.sh admin/DealCard
#
# This creates:
#   src/components/<path>/MyComponent.tsx   — The component file
#   src/components/<path>/index.ts          — Barrel export
#   src/components/<path>/MyComponent.test.tsx — Test scaffold
#

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <ComponentName>"
  echo ""
  echo "Examples:"
  echo "  $0 MyComponent           -> src/components/MyComponent/"
  echo "  $0 admin/DealCard        -> src/components/admin/DealCard/"
  exit 1
fi

COMPONENT_PATH="$1"
COMPONENT_NAME=$(basename "$COMPONENT_PATH")
DIR="src/components/$COMPONENT_PATH"

if [ -d "$DIR" ]; then
  echo "Error: Directory $DIR already exists."
  exit 1
fi

mkdir -p "$DIR"

# ── Component file ──
cat > "$DIR/$COMPONENT_NAME.tsx" << EOF
import { type FC } from 'react';
import { cn } from '@/lib/utils';

export interface ${COMPONENT_NAME}Props {
  className?: string;
  children?: React.ReactNode;
}

const ${COMPONENT_NAME}: FC<${COMPONENT_NAME}Props> = ({ className, children }) => {
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
};

export default ${COMPONENT_NAME};
EOF

# ── Barrel export ──
cat > "$DIR/index.ts" << EOF
export { default as ${COMPONENT_NAME} } from './${COMPONENT_NAME}';
export type { ${COMPONENT_NAME}Props } from './${COMPONENT_NAME}';
EOF

# ── Test file ──
cat > "$DIR/$COMPONENT_NAME.test.tsx" << EOF
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ${COMPONENT_NAME} from './${COMPONENT_NAME}';

describe('${COMPONENT_NAME}', () => {
  it('renders without crashing', () => {
    render(<${COMPONENT_NAME}>Test</${COMPONENT_NAME}>);
    expect(screen.getByText('Test')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<${COMPONENT_NAME} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
EOF

echo "Component created successfully!"
echo ""
echo "  $DIR/$COMPONENT_NAME.tsx"
echo "  $DIR/index.ts"
echo "  $DIR/$COMPONENT_NAME.test.tsx"
echo ""
echo "Import it with:"
echo "  import { $COMPONENT_NAME } from '@/components/$COMPONENT_PATH';"
