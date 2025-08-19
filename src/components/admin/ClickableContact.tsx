import { Mail, Phone, ExternalLink } from "lucide-react";

interface ClickableEmailProps {
  email: string;
  className?: string;
}

interface ClickablePhoneProps {
  phone: string;
  className?: string;
}

interface ClickableLinkedInProps {
  linkedinProfile: string;
  className?: string;
}

/**
 * Clickable email component that opens email client
 */
export const ClickableEmail = ({ email, className = "" }: ClickableEmailProps) => {
  return (
    <a
      href={`mailto:${email}`}
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group ${className}`}
      title={`Send email to ${email}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Mail className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{email}</span>
    </a>
  );
};

/**
 * Clickable phone component that opens dialer
 */
export const ClickablePhone = ({ phone, className = "" }: ClickablePhoneProps) => {
  return (
    <a
      href={`tel:${phone}`}
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group ${className}`}
      title={`Call ${phone}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Phone className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{phone}</span>
    </a>
  );
};

/**
 * Clickable LinkedIn component that opens LinkedIn profile in new tab
 */
export const ClickableLinkedIn = ({ linkedinProfile, className = "" }: ClickableLinkedInProps) => {
  const processLinkedInUrl = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  };

  return (
    <a
      href={processLinkedInUrl(linkedinProfile)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group ${className}`}
      title="View LinkedIn profile"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">LinkedIn</span>
    </a>
  );
};