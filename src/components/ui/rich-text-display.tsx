import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

export function RichTextDisplay({ content, className }: RichTextDisplayProps) {
  // Enhanced sanitization for business content with security-first approach
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      // Text formatting
      'p', 'br', 'strong', 'em', 'u', 's', 'span',
      // Headings for structure
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Lists for features and benefits
      'ul', 'ol', 'li',
      // Professional formatting
      'blockquote', 'div',
      // Links for company websites
      'a',
      // Code and pre for technical specifications
      'code', 'pre',
      // Tables for financial data
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'target', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
    // Security configurations
    SANITIZE_DOM: true,
    SAFE_FOR_TEMPLATES: true,
  });

  return (
    <div 
      className={cn(
        // Base prose styling with professional formatting
        "prose prose-sm max-w-none",
        // Theme-aware text colors using semantic tokens
        "prose-headings:text-foreground prose-p:text-foreground", 
        "prose-strong:text-foreground prose-em:text-foreground",
        "prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground",
        // Professional blockquote styling
        "prose-blockquote:text-muted-foreground prose-blockquote:border-l-border prose-blockquote:pl-4",
        // Link styling using design system colors
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        // Code styling for technical content
        "prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
        // Table styling for financial data
        "prose-table:text-foreground prose-th:text-foreground prose-td:text-foreground",
        "prose-table:border-collapse prose-th:border prose-td:border prose-th:border-border prose-td:border-border",
        "prose-th:bg-muted prose-th:font-semibold prose-th:p-2 prose-td:p-2",
        // Responsive adjustments
        "md:prose-base",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}