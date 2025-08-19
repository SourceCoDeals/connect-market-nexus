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
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group cursor-pointer ${className}`}
      title={`Send email to ${email}`}
      onClick={(e) => {
        console.log('📧 Email CLICKED:', email);
        console.log('📧 Event object:', e);
        e.stopPropagation();
        // Fallback navigation
        if (!e.defaultPrevented) {
          console.log('📧 Using fallback navigation');
          window.location.href = `mailto:${email}`;
        }
      }}
      onMouseDown={(e) => {
        console.log('📧 Email MOUSE DOWN:', email);
        e.stopPropagation();
      }}
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
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group cursor-pointer ${className}`}
      title={`Call ${phone}`}
      onClick={(e) => {
        console.log('📞 Phone CLICKED:', phone);
        console.log('📞 Event object:', e);
        e.stopPropagation();
        // Fallback navigation
        if (!e.defaultPrevented) {
          console.log('📞 Using fallback navigation');
          window.location.href = `tel:${phone}`;
        }
      }}
      onMouseDown={(e) => {
        console.log('📞 Phone MOUSE DOWN:', phone);
        e.stopPropagation();
      }}
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
      className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group cursor-pointer ${className}`}
      title="View LinkedIn profile"
      onClick={(e) => {
        console.log('🔗 LinkedIn CLICKED:', processLinkedInUrl(linkedinUrl));
        console.log('🔗 Event object:', e);
        e.stopPropagation();
        // Fallback navigation
        if (!e.defaultPrevented) {
          console.log('🔗 Using fallback navigation');
          window.open(processLinkedInUrl(linkedinUrl), '_blank', 'noopener,noreferrer');
        }
      }}
      onMouseDown={(e) => {
        console.log('🔗 LinkedIn MOUSE DOWN:', processLinkedInUrl(linkedinUrl));
        e.stopPropagation();
      }}
    >
      <Linkedin className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">LinkedIn</span>
    </a>
  );
};