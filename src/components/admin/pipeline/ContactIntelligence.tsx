import React from 'react';
import { Phone, Mail, LinkedinIcon, Globe, MessageSquare, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactIntelligenceProps {
  buyerProfile: any;
  dealData: any;
  className?: string;
}

export function ContactIntelligence({ buyerProfile, dealData, className }: ContactIntelligenceProps) {
  const getContactMethods = () => {
    const methods = [];
    
    // Primary contact info (from registered user or lead)
    const email = buyerProfile?.email || dealData?.contact_email || dealData?.lead_email;
    const phone = buyerProfile?.phone_number || dealData?.contact_phone || dealData?.lead_phone;
    const linkedin = buyerProfile?.linkedin_profile;
    const website = buyerProfile?.website || buyerProfile?.buyer_org_url;
    
    if (email) {
      methods.push({
        type: 'email',
        value: email,
        icon: Mail,
        label: 'Email',
        preferred: true
      });
    }
    
    if (phone) {
      methods.push({
        type: 'phone',
        value: phone,
        icon: Phone,
        label: 'Phone',
        preferred: false
      });
    }
    
    if (linkedin) {
      methods.push({
        type: 'linkedin',
        value: linkedin,
        icon: LinkedinIcon,
        label: 'LinkedIn',
        preferred: false
      });
    }
    
    if (website) {
      methods.push({
        type: 'website',
        value: website,
        icon: Globe,
        label: 'Website',
        preferred: false
      });
    }

    return methods;
  };

  const getProfileCompleteness = () => {
    if (!buyerProfile) return { score: 0, type: 'lead' };
    
    const fields = [
      'first_name', 'last_name', 'email', 'company', 'phone_number',
      'buyer_type', 'business_categories', 'target_locations', 'ideal_target_description'
    ];
    
    const completed = fields.filter(field => buyerProfile[field]).length;
    const score = Math.round((completed / fields.length) * 100);
    
    return {
      score,
      type: buyerProfile.id ? 'registered' : 'lead',
      completed,
      total: fields.length
    };
  };

  const getContactPersona = () => {
    const role = buyerProfile?.job_title || dealData?.contact_role || dealData?.lead_role;
    const company = buyerProfile?.company || dealData?.contact_company || dealData?.lead_company;
    
    if (role && company) {
      return `${role} at ${company}`;
    }
    if (role) return role;
    if (company) return company;
    return 'Contact details available';
  };

  const contactMethods = getContactMethods();
  const completeness = getProfileCompleteness();

  if (contactMethods.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Contact Person Summary */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">
            {getContactPersona()}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-xs px-2 py-1 rounded-full",
              completeness.type === 'registered' 
                ? "bg-green-50 text-green-700" 
                : "bg-amber-50 text-amber-700"
            )}>
              {completeness.type === 'registered' ? 'Registered User' : 'Lead Contact'}
            </span>
            {completeness.score > 0 && (
              <span className="text-xs text-muted-foreground">
                {completeness.score}% complete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact Methods */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Contact Methods
        </h4>
        {contactMethods.map((method, index) => {
          const Icon = method.icon;
          return (
            <div key={index} className="flex items-center gap-3 py-1.5">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground truncate">
                    {method.value}
                  </span>
                  {method.preferred && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {method.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Best Contact Time (placeholder for future enhancement) */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>Best contact time: Business hours EST</span>
      </div>
    </div>
  );
}