import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GENERIC_EMAIL_DOMAINS } from '@/lib/generic-email-domains';

type Size = 'xs' | 'sm' | 'md' | 'lg';
type Variant = 'framed' | 'bare';

const SIZE_CLASSES: Record<
  Size,
  { wrap: string; img: string; bareImg: string; text: string; rounded: string }
> = {
  xs: {
    wrap: 'h-5 w-5',
    img: 'h-3.5 w-3.5',
    bareImg: 'h-5 w-5',
    text: 'text-[8px]',
    rounded: 'rounded',
  },
  sm: {
    wrap: 'h-6 w-6',
    img: 'h-4 w-4',
    bareImg: 'h-6 w-6',
    text: 'text-[9px]',
    rounded: 'rounded-md',
  },
  md: {
    wrap: 'h-8 w-8',
    img: 'h-5 w-5',
    bareImg: 'h-8 w-8',
    text: 'text-[10.5px]',
    rounded: 'rounded-lg',
  },
  lg: {
    wrap: 'h-12 w-12',
    img: 'h-7 w-7',
    bareImg: 'h-12 w-12',
    text: 'text-sm',
    rounded: 'rounded-xl',
  },
};

const SIZE_PX: Record<Size, number> = { xs: 32, sm: 64, md: 64, lg: 128 };

interface CompanyLogoProps {
  website: string | null;
  name: string;
  enrichedLogoUrl?: string | null;
  /** Optional email used to derive a favicon when website is missing.
   *  Generic email domains (gmail, yahoo, etc.) are skipped — falls back to initials. */
  email?: string | null;
  size?: Size;
  /** 'framed' (default): subtle border + background. 'bare': prominent logo, no chrome. */
  variant?: Variant;
  className?: string;
}

/**
 * Shared company logo: prefers enriched logo, falls back to Google favicon,
 * then to initials. Single source of truth across admin tables and drawers.
 */
export function CompanyLogo({
  website,
  name,
  enrichedLogoUrl,
  email,
  size = 'md',
  variant = 'framed',
  className,
}: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);
  const sizes = SIZE_CLASSES[size];

  const initials =
    (name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .filter(Boolean)
      .join('')
      .toUpperCase() || '?';

  const cleanDomain = website ? website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] : null;

  // Fallback to email's domain if it's not a generic provider
  let emailDomain: string | null = null;
  if (!cleanDomain && email && email.includes('@')) {
    const candidate = email.split('@')[1]?.toLowerCase().trim() || null;
    if (candidate && !GENERIC_EMAIL_DOMAINS.has(candidate)) {
      emailDomain = candidate;
    }
  }

  const faviconDomain = cleanDomain || emailDomain;

  const logoSrc =
    !imgError &&
    (enrichedLogoUrl ||
      (faviconDomain
        ? `https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=${SIZE_PX[size]}`
        : null));

  const isBare = variant === 'bare';

  if (!logoSrc) {
    return (
      <div
        className={cn(
          sizes.wrap,
          sizes.rounded,
          sizes.text,
          isBare
            ? 'bg-muted/40 flex items-center justify-center font-semibold text-muted-foreground/80 shrink-0'
            : 'bg-background border border-border/60 flex items-center justify-center font-medium text-muted-foreground/70 shrink-0 tracking-tight',
          className,
        )}
        aria-hidden
      >
        {initials}
      </div>
    );
  }

  if (isBare) {
    return (
      <div className={cn(sizes.wrap, 'flex items-center justify-center shrink-0', className)}>
        <img
          src={logoSrc}
          alt=""
          className={cn(sizes.bareImg, 'object-contain')}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        sizes.wrap,
        sizes.rounded,
        'bg-background border border-border/60 flex items-center justify-center shrink-0 overflow-hidden',
        className,
      )}
    >
      <img
        src={logoSrc}
        alt=""
        className={cn(enrichedLogoUrl ? `${sizes.img} object-contain` : sizes.img)}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </div>
  );
}

export default CompanyLogo;
