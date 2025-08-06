import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

export function RichTextDisplay({ content, className }: RichTextDisplayProps) {
  // Sanitize HTML content to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre'
    ],
    ALLOWED_ATTR: ['href', 'target', 'class'],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div 
      className={cn(
        "prose prose-sm max-w-none",
        "prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground",
        "prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground",
        "prose-blockquote:text-muted-foreground prose-blockquote:border-l-border",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}