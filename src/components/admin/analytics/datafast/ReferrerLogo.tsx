import { cn } from "@/lib/utils";

interface ReferrerLogoProps {
  domain: string;
  className?: string;
}

// SVG components for known platforms
function BrevoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor">
      <circle cx="16" cy="16" r="16" fill="#0B996E"/>
      <path d="M10 11h12l-6 10-6-10z" fill="white"/>
    </svg>
  );
}

function LinkedInLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="3" fill="#0A66C2"/>
      <path d="M7.5 10v7.5h-2.5v-7.5h2.5zm-1.25-1c-.83 0-1.25-.56-1.25-1.25S6.42 6.5 7.25 6.5c.83 0 1.25.56 1.25 1.25S8.08 9 7.25 9h-.003zM18 17.5h-2.5v-4c0-1-.36-1.68-1.25-1.68-.68 0-1.09.46-1.27.91-.07.16-.09.39-.09.61v4.16h-2.5V10h2.5v1.02c.33-.51.92-1.24 2.24-1.24 1.63 0 2.87 1.07 2.87 3.37v4.35z" fill="white"/>
    </svg>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function TwitterXLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect width="24" height="24" rx="4" fill="black"/>
      <path d="M13.3 10.6L18.5 4.5h-1.2l-4.5 5.3-3.6-5.3H5l5.5 8-5.5 6.5h1.2l4.8-5.6 3.8 5.6H19l-5.7-8.4zm-1.7 2l-.6-.8-4.4-6.3h1.9l3.6 5.1.6.8 4.7 6.7h-1.9l-3.9-5.5z" fill="white"/>
    </svg>
  );
}

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="4" fill="#1877F2"/>
      <path d="M16.5 12.5l.5-3.5h-3.5V7c0-1 .5-1.5 1.5-1.5H17V2.5s-1-.5-2.5-.5c-2.5 0-4 1.5-4 4.5V9H7.5v3.5h3v8.5h4v-8.5h3z" fill="white"/>
    </svg>
  );
}

function MailchimpLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className}>
      <circle cx="16" cy="16" r="16" fill="#FFE01B"/>
      <path d="M16 8c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#262626"/>
    </svg>
  );
}

function SendgridLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className}>
      <rect width="32" height="32" rx="4" fill="#2196F3"/>
      <path d="M8 8h5.3v5.3H8V8zm5.3 5.3h5.4v5.4h-5.4v-5.4zm5.4 5.4H24V24h-5.3v-5.3z" fill="white"/>
    </svg>
  );
}

function DirectLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" className="text-muted-foreground"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className="text-muted-foreground"/>
      <path d="M2 12h20" className="text-muted-foreground"/>
    </svg>
  );
}

// Platform detection
const PLATFORM_LOGOS: Array<{ match: string[]; Logo: React.FC<{ className?: string }> }> = [
  { match: ['brevo', 'sendibt', 'r.sp1-brevo', 'exdov'], Logo: BrevoLogo },
  { match: ['mailchimp', 'mailchi.mp', 'campaign-archive'], Logo: MailchimpLogo },
  { match: ['sendgrid'], Logo: SendgridLogo },
  { match: ['linkedin'], Logo: LinkedInLogo },
  { match: ['google'], Logo: GoogleLogo },
  { match: ['twitter', 'x.com'], Logo: TwitterXLogo },
  { match: ['facebook', 'fb.com'], Logo: FacebookLogo },
  { match: ['direct'], Logo: DirectLogo },
];

export function ReferrerLogo({ domain, className }: ReferrerLogoProps) {
  const lowerDomain = domain.toLowerCase();
  
  // Check for known platforms
  for (const { match, Logo } of PLATFORM_LOGOS) {
    if (match.some(keyword => lowerDomain.includes(keyword))) {
      return <Logo className={cn("flex-shrink-0", className)} />;
    }
  }
  
  // Fallback to Google favicon service
  return (
    <img 
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className={cn("flex-shrink-0 rounded", className)}
      onError={(e) => { 
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

// Helper to get display-friendly referrer name
// eslint-disable-next-line react-refresh/only-export-components
export function formatReferrerName(domain: string): string {
  const lowerDomain = domain.toLowerCase();
  
  // Known platform names
  if (lowerDomain.includes('brevo') || lowerDomain.includes('sendibt') || lowerDomain.includes('exdov')) {
    return 'Brevo (Email)';
  }
  if (lowerDomain.includes('mailchimp') || lowerDomain.includes('mailchi.mp')) {
    return 'Mailchimp';
  }
  if (lowerDomain.includes('sendgrid')) {
    return 'SendGrid';
  }
  if (lowerDomain.includes('linkedin')) {
    return 'LinkedIn';
  }
  if (lowerDomain.includes('google')) {
    return 'Google';
  }
  if (lowerDomain.includes('twitter') || lowerDomain.includes('x.com')) {
    return 'X (Twitter)';
  }
  if (lowerDomain.includes('facebook') || lowerDomain.includes('fb.com')) {
    return 'Facebook';
  }
  if (lowerDomain === 'direct') {
    return 'Direct Traffic';
  }
  
  // Clean up domain for display
  return domain
    .replace(/^www\./, '')
    .replace(/\.(com|net|org|io|co|app)$/, '');
}
