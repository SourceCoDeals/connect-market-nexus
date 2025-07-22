
import { supabase } from "./integrations/supabase/client";
import { errorLogger } from "./lib/error-logger";

// Sample data for listings
const sampleListings = [
  {
    title: "Profitable SaaS Company in Marketing Space",
    category: "Technology",
    location: "California",
    revenue: 2500000,
    ebitda: 750000,
    description: "Established SaaS company with recurring revenue streams and loyal customer base. Strong growth potential in an expanding market. The platform serves over 500 enterprise clients with an average contract value of $40,000 per year.\n\nThe company has shown consistent growth of 25% year over year for the past 3 years. Customer acquisition costs have decreased by 15% in the last year while customer lifetime value has increased.\n\nTechnology stack includes React, Node.js, and AWS infrastructure. All IP is owned by the company with multiple pending patents.",
    tags: ["SaaS", "Recurring Revenue", "B2B"],
    owner_notes: "Looking for strategic buyer with industry expertise. Willing to stay on for 6-12 month transition period.",
  },
  {
    title: "Manufacturing Business with Strong Local Presence",
    category: "Manufacturing",
    location: "Texas",
    revenue: 5800000,
    ebitda: 1200000,
    description: "Well-established manufacturing business with proprietary processes and strong client relationships. Operates in a niche market with high barriers to entry. The company has been in operation for over 15 years with an excellent reputation in the industry.\n\nOwns a 45,000 sq ft production facility on 3 acres with state-of-the-art equipment. Current capacity utilization is at 60% with significant room for expansion.\n\nStrong relationships with suppliers resulting in favorable terms and priority allocation of materials. Customer base includes Fortune 500 companies with multi-year contracts.",
    tags: ["Manufacturing", "B2B", "Industrial"],
    owner_notes: "Owner retiring after 25 years in business. Management team willing to stay on.",
  },
  {
    title: "Chain of Premium Pet Supply Stores",
    category: "Retail",
    location: "Florida",
    revenue: 3700000,
    ebitda: 620000,
    description: "Established chain of three premium pet supply stores in affluent areas with loyal customer base and growing e-commerce presence. Each location is in a prime retail area with excellent foot traffic and visibility.\n\nStore size averages 3,500 sq ft with modern fixtures and premium branding. All three locations have favorable lease terms with options to extend.\n\nThe business has developed strong relationships with unique suppliers, carrying exclusive product lines not available through major retailers. The e-commerce platform was launched 2 years ago and now represents 15% of total sales with 40% growth year over year.",
    tags: ["Retail", "E-commerce", "Pets"],
    owner_notes: "Seeking buyer interested in expanding to additional locations. Owner willing to consult for 12 months post-sale.",
  },
  {
    title: "Profitable Digital Marketing Agency",
    category: "Marketing",
    location: "New York",
    revenue: 1800000,
    ebitda: 450000,
    description: "Boutique digital marketing agency specializing in SEO, PPC, and content marketing for B2B clients. Strong team and excellent reputation in the industry. The agency serves 35 retainer clients with an average monthly value of $4,200.\n\nThe company has won multiple industry awards and has been featured in leading marketing publications. Team includes 12 full-time employees and a network of reliable contractors for specialized tasks.\n\nClient retention is exceptional with an average relationship length of 3.5 years. New business comes primarily through referrals and the agency's own content marketing efforts.",
    tags: ["Agency", "Digital", "B2B"],
    owner_notes: "Owner looking to transition to advisory role. Leadership team in place and ready to continue operations.",
  },
  {
    title: "Established Healthcare Services Provider",
    category: "Healthcare",
    location: "Illinois",
    revenue: 4200000,
    ebitda: 980000,
    description: "Provider of specialized healthcare services with multiple locations and strong relationships with insurance companies. The business operates 4 clinics in high-traffic locations throughout the metropolitan area.\n\nServices are primarily reimbursed through insurance, with established relationships with all major carriers in the region. The business has invested in proprietary software for patient management and scheduling.\n\nHighly trained staff includes licensed healthcare professionals and administrative personnel. Excellent online reputation with 4.8/5.0 rating across major review platforms.",
    tags: ["Healthcare", "Services", "Insurance"],
    owner_notes: "Looking for buyer with healthcare experience. All key staff willing to remain with the business.",
  },
  {
    title: "Profitable IT Services Company",
    category: "Technology",
    location: "Washington",
    revenue: 3100000,
    ebitda: 820000,
    description: "IT services provider specializing in managed services, cloud solutions, and cybersecurity for SMBs. Stable client base with recurring revenue model. The company serves over 75 businesses on managed service contracts and provides project-based work for additional clients.\n\nServices include network management, cloud infrastructure, cybersecurity, and help desk support. The business has developed proprietary tools for monitoring and management.\n\nHighly skilled team includes certified IT professionals across multiple technology platforms. Client retention rate is over 95% annually.",
    tags: ["IT Services", "MSP", "Cybersecurity"],
    owner_notes: "Potential for geographic expansion. Owner looking to exit but willing to ensure smooth transition.",
  },
];

export const seedDatabase = async () => {
  try {
    const { data: existingListings, error: checkError } = await supabase
      .from('listings')
      .select('id')
      .limit(1);
    
    if (checkError) throw checkError;
    
    // Only seed if no listings exist
    if (existingListings && existingListings.length === 0) {
      // Insert sample listings
      const { error: listingsError } = await supabase
        .from('listings')
        .insert(sampleListings);
      
      if (listingsError) throw listingsError;
      
      await errorLogger.info('Database seeded successfully with sample data');
      return true;
    } else {
      return false; // Silent - already has data
    }
  } catch (error) {
    await errorLogger.error('Database seeding failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};
