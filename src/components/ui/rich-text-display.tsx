import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface RichTextDisplayProps {
  content: string;
  className?: string;
  compact?: boolean;
}

export function RichTextDisplay({ content, className, compact = false }: RichTextDisplayProps) {
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

  // Compact mode for card previews - Stripe-inspired minimalism
  if (compact) {
    return (
      <div 
        className={cn(
          "text-[14px] leading-[1.65] text-slate-700 tracking-[-0.003em]",
          "[&_p]:m-0 [&_p]:inline",
          "[&_ul]:m-0 [&_ul]:inline [&_li]:m-0 [&_li]:inline [&_li]:before:content-none",
          "[&_ol]:m-0 [&_ol]:inline",
          "[&_strong]:font-semibold [&_em]:italic",
          "[&_*]:text-[14px] [&_*]:leading-[1.65]",
          className
        )}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    );
  }

  // Regular mode for detail pages - uses enhanced prose classes from index.css
  return (
    <div 
      className={cn(
        "prose max-w-none",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}