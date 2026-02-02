import { cn } from "@/lib/utils";

interface BrowserLogoProps {
  browser: string;
  className?: string;
}

// Real browser SVG logos as inline components
const ChromeLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="22" fill="#fff"/>
    <path d="M24 8c8.837 0 16 7.163 16 16 0 3.384-1.049 6.523-2.841 9.116L27.5 16.5 24 8z" fill="#EA4335"/>
    <path d="M8 24c0-8.837 7.163-16 16-16l3.5 8.5L11.116 33.16C9.05 30.523 8 27.384 8 24z" fill="#FBBC05"/>
    <path d="M24 40c-8.837 0-16-7.163-16-16 0-3.384 1.05-6.523 2.841-9.116L27.5 31.5l-3.5 8.5z" fill="#34A853"/>
    <path d="M40 24c0 8.837-7.163 16-16 16l-3.5-8.5 16.384-16.384C38.95 17.477 40 20.616 40 24z" fill="#4285F4"/>
    <circle cx="24" cy="24" r="8" fill="#fff"/>
    <circle cx="24" cy="24" r="8" fill="#4285F4"/>
    <circle cx="24" cy="24" r="4" fill="#fff"/>
  </svg>
);

const SafariLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="22" fill="url(#safari-gradient)"/>
    <path d="M24 6v4M24 38v4M42 24h-4M10 24H6" stroke="#fff" strokeWidth="1.5"/>
    <path d="M17 31l7-14 7 14-7-14-7 14z" fill="#fff" stroke="#E15153" strokeWidth="1.5"/>
    <defs>
      <linearGradient id="safari-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#17B1F9"/>
        <stop offset="100%" stopColor="#1A73E8"/>
      </linearGradient>
    </defs>
  </svg>
);

const FirefoxLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="20" fill="url(#firefox-gradient)"/>
    <path d="M38 18c-1-6-7-10-14-10s-13 4-14 10c-1 6 3 12 10 16s14 1 18-6c2-4 1-8 0-10z" fill="url(#firefox-flame)"/>
    <defs>
      <linearGradient id="firefox-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF3750"/>
        <stop offset="50%" stopColor="#FF980E"/>
        <stop offset="100%" stopColor="#FFD330"/>
      </linearGradient>
      <linearGradient id="firefox-flame" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF9500"/>
        <stop offset="100%" stopColor="#FF3750"/>
      </linearGradient>
    </defs>
  </svg>
);

const EdgeLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="20" fill="url(#edge-gradient)"/>
    <path d="M12 24c0-7 6-12 12-12s12 5 12 12c0 4-2 7-5 9-3 2-7 2-10 0" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none"/>
    <defs>
      <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0078D4"/>
        <stop offset="50%" stopColor="#0A93E4"/>
        <stop offset="100%" stopColor="#50E6FF"/>
      </linearGradient>
    </defs>
  </svg>
);

const OperaLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="20" fill="#FF1B2D"/>
    <ellipse cx="24" cy="24" rx="8" ry="14" fill="#fff"/>
    <ellipse cx="24" cy="24" rx="5" ry="11" fill="#FF1B2D"/>
  </svg>
);

const DefaultBrowserLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
    <circle cx="24" cy="24" r="8" fill="currentColor" opacity="0.3"/>
    <path d="M24 4v8M24 36v8M4 24h8M36 24h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

export function BrowserLogo({ browser, className }: BrowserLogoProps) {
  const normalizedBrowser = browser?.toLowerCase() || '';
  const logoClass = cn("h-4 w-4", className);
  
  if (normalizedBrowser.includes('chrome')) {
    return <ChromeLogo className={logoClass} />;
  }
  if (normalizedBrowser.includes('safari')) {
    return <SafariLogo className={logoClass} />;
  }
  if (normalizedBrowser.includes('firefox')) {
    return <FirefoxLogo className={logoClass} />;
  }
  if (normalizedBrowser.includes('edge')) {
    return <EdgeLogo className={logoClass} />;
  }
  if (normalizedBrowser.includes('opera')) {
    return <OperaLogo className={logoClass} />;
  }
  
  return <DefaultBrowserLogo className={logoClass} />;
}

// OS Logos
export function OSLogo({ os, className }: { os: string; className?: string }) {
  const normalizedOS = os?.toLowerCase() || '';
  const logoClass = cn("h-4 w-4", className);
  
  if (normalizedOS.includes('mac') || normalizedOS.includes('ios')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <path d="M39 33.3c-1 2.2-1.5 3.2-2.8 5.1-1.8 2.7-4.4 6-7.5 6-2.8 0-3.5-1.8-7.3-1.9-3.8 0-4.6 1.9-7.4 1.9-3.1 0-5.5-3-7.4-5.7C3.8 34.1 1.5 25 4.5 19.1c2.1-4.1 5.8-6.5 9.8-6.5 3.6 0 5.9 1.9 8.9 1.9 2.9 0 4.7-1.9 8.8-1.9 3.5 0 6.7 1.9 8.8 5.2-7.8 4.2-6.5 15.2 1.2 18.3-1 2.9-1.5 4.1-3 6.3" fill="currentColor"/>
        <path d="M31 4.8c1.4-1.8 2.5-4.3 2.1-6.8-2.3.2-5 1.6-6.6 3.5-1.4 1.7-2.6 4.2-2.1 6.7 2.5.1 5.1-1.4 6.6-3.4" fill="currentColor"/>
      </svg>
    );
  }
  if (normalizedOS.includes('windows')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <path d="M6 12.3l15.7-2.1v15.2H6V12.3z" fill="#00A4EF"/>
        <path d="M23.7 9.9L42 7v18.4H23.7V9.9z" fill="#00A4EF"/>
        <path d="M6 27.4h15.7v15.2L6 40.5V27.4z" fill="#00A4EF"/>
        <path d="M23.7 27.4H42v17.4l-18.3-2.7V27.4z" fill="#00A4EF"/>
      </svg>
    );
  }
  if (normalizedOS.includes('linux')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="24" rx="16" ry="18" fill="#FFC107"/>
        <ellipse cx="24" cy="22" rx="12" ry="13" fill="#000"/>
        <circle cx="19" cy="20" r="3" fill="#fff"/>
        <circle cx="29" cy="20" r="3" fill="#fff"/>
        <ellipse cx="24" cy="28" rx="4" ry="3" fill="#FFC107"/>
      </svg>
    );
  }
  if (normalizedOS.includes('android')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <path d="M8 22v12c0 2.2 1.8 4 4 4h4v8c0 1.1.9 2 2 2s2-.9 2-2v-8h8v8c0 1.1.9 2 2 2s2-.9 2-2v-8h4c2.2 0 4-1.8 4-4V22H8z" fill="#3DDC84"/>
        <path d="M40 22V32c0 1.1.9 2 2 2s2-.9 2-2v-10c0-1.1-.9-2-2-2s-2 .9-2 2zM4 22v10c0 1.1.9 2 2 2s2-.9 2-2V22c0-1.1-.9-2-2-2s-2 .9-2 2z" fill="#3DDC84"/>
        <path d="M8 22a16 16 0 0132 0H8z" fill="#3DDC84"/>
        <circle cx="16" cy="14" r="2" fill="#fff"/>
        <circle cx="32" cy="14" r="2" fill="#fff"/>
      </svg>
    );
  }
  
  return (
    <svg className={logoClass} viewBox="0 0 48 48" fill="none">
      <rect x="8" y="8" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
      <rect x="16" y="36" width="16" height="4" rx="1" fill="currentColor" opacity="0.3"/>
    </svg>
  );
}

// Source/Referrer logos with favicons
export function SourceLogo({ source, className }: { source: string; className?: string }) {
  const normalizedSource = source?.toLowerCase() || '';
  const logoClass = cn("h-4 w-4", className);
  
  // Well-known sources with custom icons
  if (normalizedSource === 'direct') {
    return (
      <svg className={logoClass} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
      </svg>
    );
  }
  if (normalizedSource.includes('google')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <path d="M43.6 20H24v8.8h11.2c-1 5-5 8.2-11.2 8.2-6.8 0-12.4-5.6-12.4-12.5S17.2 12 24 12c3 0 5.7 1 7.8 2.8l6-6C34 5.5 29.3 3.5 24 3.5 12.6 3.5 3.3 12.8 3.3 24S12.6 44.5 24 44.5c11.7 0 19.5-8.2 19.5-20 0-1.5-.2-3-.5-4.5z" fill="#4285F4"/>
        <path d="M7.5 14.8l6.9 5c1.9-4.8 6.5-8.3 12-8.3 3 0 5.7 1 7.8 2.8l6-6C34 5.5 29.3 3.5 24 3.5c-7.7 0-14.3 4.4-17.5 10.8z" fill="#EA4335"/>
        <path d="M24 44.5c5 0 9.5-1.6 13-4.6l-6.4-5c-1.9 1.3-4.2 2-6.6 2-6.2 0-11.4-4.2-13.3-10l-6.8 5.3c3.2 6.4 9.8 11.3 17.5 11.3z" fill="#34A853"/>
        <path d="M43.5 24c0-1.5-.2-3-.5-4.5H24v8.8h11.2c-.5 2.5-2 4.7-4.2 6.1l6.4 5c3.8-3.5 6.1-8.7 6.1-15.4z" fill="#FBBC05"/>
      </svg>
    );
  }
  if (normalizedSource.includes('linkedin')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="8" fill="#0A66C2"/>
        <path d="M16 19h-5v17h5V19zM13.5 16.5c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zM38 36h-5v-9c0-2.2-1.8-4-4-4s-4 1.8-4 4v9h-5V19h5v2c1.2-1.8 3.2-3 5.5-3 4.1 0 7.5 3.4 7.5 7.5V36z" fill="#fff"/>
      </svg>
    );
  }
  if (normalizedSource.includes('twitter') || normalizedSource.includes('x.com')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="8" fill="#000"/>
        <path d="M28.2 12h4.8l-10.5 12L34 36h-8.7l-6.8-8.9L11 36H6.2l11.2-12.8L5.3 12H14l6.1 8.1L28.2 12zm-1.7 21.6h2.6L13.4 14.5h-2.8l15.9 19.1z" fill="#fff"/>
      </svg>
    );
  }
  if (normalizedSource.includes('facebook')) {
    return (
      <svg className={logoClass} viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="8" fill="#1877F2"/>
        <path d="M29 25.5l.9-6H24v-3.9c0-1.6.8-3.2 3.4-3.2h2.6V7.1s-2.4-.4-4.6-.4c-4.7 0-7.8 2.9-7.8 8v4.5h-5.2v6h5.2V40h6.4V25.5H29z" fill="#fff"/>
      </svg>
    );
  }
  
  // Default - use favicon service
  return (
    <img 
      src={`https://www.google.com/s2/favicons?domain=${source}&sz=32`}
      alt=""
      className={logoClass}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
