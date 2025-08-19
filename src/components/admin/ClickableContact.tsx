import { Mail, Phone, Linkedin } from "lucide-react";

interface ClickableEmailProps {
  email: string;
  className?: string;
}

interface ClickablePhoneProps {
  phone: string;
  className?: string;
}

interface ClickableLinkedInProps {
  linkedinUrl: string;
  className?: string;
}

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

export const ClickableLinkedIn = ({ linkedinUrl, className = "" }: ClickableLinkedInProps) => {
  const processLinkedInUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  return (
    <a
      href={processLinkedInUrl(linkedinUrl)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group ${className}`}
      title="View LinkedIn profile"
      onClick={(e) => e.stopPropagation()}
    >
      <Linkedin className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">LinkedIn</span>
    </a>
  );
};