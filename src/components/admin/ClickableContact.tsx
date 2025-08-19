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
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group cursor-pointer relative z-10 ${className}`}
      title={`Send email to ${email}`}
      onClick={(e) => {
        e.stopPropagation();
        console.log('📧 Email clicked:', email);
      }}
      style={{ pointerEvents: 'auto' }}
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
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group cursor-pointer relative z-10 ${className}`}
      title={`Call ${phone}`}
      onClick={(e) => {
        e.stopPropagation();
        console.log('📞 Phone clicked:', phone);
      }}
      style={{ pointerEvents: 'auto' }}
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
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group cursor-pointer relative z-10 ${className}`}
      title="View LinkedIn profile"
      onClick={(e) => {
        e.stopPropagation();
        console.log('🔗 LinkedIn clicked:', processLinkedInUrl(linkedinUrl));
      }}
      style={{ pointerEvents: 'auto' }}
    >
      <Linkedin className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">LinkedIn</span>
    </a>
  );
};