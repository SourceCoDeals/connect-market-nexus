
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useVerificationSuccessEmail } from '@/hooks/auth/use-verification-success-email';

export default function AuthCallback() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { sendVerificationSuccessEmail } = useVerificationSuccessEmail();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('📧 Email verification callback - processing...');
        
        // Let Supabase handle the verification token
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          throw error;
        }

        if (data.session?.user) {
          console.log('✅ User session found, checking profile...');
          
          // Get latest profile data to see if verification was successful
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email_verified, approval_status, is_admin, first_name, last_name, email')
            .eq('id', data.session.user.id)
            .single();

          // Self-healing: if profile missing, create one from auth metadata
          // Include ALL fields to prevent data loss if DB trigger failed
          if (!profile && (profileError?.code === 'PGRST116' || !profileError)) {
            console.log('⚠️ Profile missing in callback, attempting self-heal for:', data.session.user.email);
            const meta = data.session.user.user_metadata || {};
            
            // Parse arrays safely - same helper as use-nuclear-auth.ts
            const parseArray = (val: any): any[] => {
              if (Array.isArray(val)) return val;
              if (typeof val === 'string' && val.startsWith('[')) {
                try { return JSON.parse(val); } catch { return []; }
              }
              return [];
            };
            
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .upsert({
                id: data.session.user.id,
                email: data.session.user.email || '',
                first_name: meta.first_name || meta.firstName || 'Unknown',
                last_name: meta.last_name || meta.lastName || 'User',
                company: meta.company || '',
                buyer_type: meta.buyer_type || meta.buyerType || 'individual',
                website: meta.website || '',
                linkedin_profile: meta.linkedin_profile || meta.linkedinProfile || '',
                phone_number: meta.phone_number || meta.phoneNumber || '',
                job_title: meta.job_title || meta.jobTitle || '',
                // Key arrays from signup
                business_categories: parseArray(meta.business_categories || meta.businessCategories),
                target_locations: parseArray(meta.target_locations || meta.targetLocations),
                investment_size: parseArray(meta.investment_size || meta.investmentSize),
                geographic_focus: parseArray(meta.geographic_focus || meta.geographicFocus),
                industry_expertise: parseArray(meta.industry_expertise || meta.industryExpertise),
                integration_plan: parseArray(meta.integration_plan || meta.integrationPlan),
                equity_source: parseArray(meta.equity_source || meta.equitySource),
                financing_plan: parseArray(meta.financing_plan || meta.financingPlan),
                exclusions: parseArray(meta.exclusions),
                include_keywords: parseArray(meta.include_keywords || meta.includeKeywords),
                operating_company_targets: parseArray(meta.operating_company_targets || meta.operatingCompanyTargets),
                deal_sourcing_methods: parseArray(meta.deal_sourcing_methods || meta.dealSourcingMethods),
                // Step 3 fields - critical to capture
                referral_source: meta.referral_source || meta.referralSource || null,
                referral_source_detail: meta.referral_source_detail || meta.referralSourceDetail || null,
                target_acquisition_volume: meta.target_acquisition_volume || meta.targetAcquisitionVolume || null,
                // String fields
                ideal_target_description: meta.ideal_target_description || meta.idealTargetDescription || '',
                revenue_range_min: meta.revenue_range_min || meta.revenueRangeMin || '',
                revenue_range_max: meta.revenue_range_max || meta.revenueRangeMax || '',
                specific_business_search: meta.specific_business_search || meta.specificBusinessSearch || '',
                estimated_revenue: meta.estimated_revenue || meta.estimatedRevenue || '',
                fund_size: meta.fund_size || meta.fundSize || '',
                aum: meta.aum || '',
                is_funded: meta.is_funded || meta.isFunded || '',
                funded_by: meta.funded_by || meta.fundedBy || '',
                target_company_size: meta.target_company_size || meta.targetCompanySize || '',
                funding_source: meta.funding_source || meta.fundingSource || '',
                needs_loan: meta.needs_loan || meta.needsLoan || '',
                ideal_target: meta.ideal_target || meta.idealTarget || '',
                deploying_capital_now: meta.deploying_capital_now || meta.deployingCapitalNow || '',
                owning_business_unit: meta.owning_business_unit || meta.owningBusinessUnit || '',
                deal_size_band: meta.deal_size_band || meta.dealSizeBand || '',
                corpdev_intent: meta.corpdev_intent || meta.corpdevIntent || '',
                discretion_type: meta.discretion_type || meta.discretionType || '',
                committed_equity_band: meta.committed_equity_band || meta.committedEquityBand || '',
                deployment_timing: meta.deployment_timing || meta.deploymentTiming || '',
                deal_structure_preference: meta.deal_structure_preference || meta.dealStructurePreference || '',
                permanent_capital: meta.permanent_capital || meta.permanentCapital || null,
                flex_subxm_ebitda: meta.flex_subxm_ebitda || meta.flexSubxmEbitda || null,
                search_type: meta.search_type || meta.searchType || '',
                acq_equity_band: meta.acq_equity_band || meta.acqEquityBand || '',
                search_stage: meta.search_stage || meta.searchStage || '',
                flex_sub2m_ebitda: meta.flex_sub2m_ebitda || meta.flexSub2mEbitda || null,
                on_behalf_of_buyer: meta.on_behalf_of_buyer || meta.onBehalfOfBuyer || '',
                buyer_role: meta.buyer_role || meta.buyerRole || '',
                buyer_org_url: meta.buyer_org_url || meta.buyerOrgUrl || '',
                owner_timeline: meta.owner_timeline || meta.ownerTimeline || '',
                owner_intent: meta.owner_intent || meta.ownerIntent || '',
                uses_bank_finance: meta.uses_bank_finance || meta.usesBankFinance || '',
                max_equity_today_band: meta.max_equity_today_band || meta.maxEquityTodayBand || '',
                mandate_blurb: meta.mandate_blurb || meta.mandateBlurb || '',
                portfolio_company_addon: meta.portfolio_company_addon || meta.portfolioCompanyAddon || '',
                backers_summary: meta.backers_summary || meta.backersSummary || '',
                anchor_investors_summary: meta.anchor_investors_summary || meta.anchorInvestorsSummary || '',
                deal_intent: meta.deal_intent || meta.dealIntent || '',
                approval_status: 'pending',
                email_verified: !!data.session.user.email_confirmed_at,
              }, { onConflict: 'id' })
              .select('email_verified, approval_status, is_admin, first_name, last_name, email')
              .single();
            
            if (insertError) {
              console.error('Self-heal profile creation failed in callback:', insertError);
            } else {
              console.log('✅ Self-healed profile created successfully in callback');
              profile = newProfile;
            }
          }

          console.log('📋 Profile data:', { 
            email_verified: profile?.email_verified, 
            approval_status: profile?.approval_status,
            is_admin: profile?.is_admin 
          });

          // Check if this is a fresh email verification (user just verified their email)
          const userJustVerified = data.session.user.email_confirmed_at && profile?.email_verified;
          
          // Send verification success email if user just verified their email
          if (userJustVerified && profile) {
            try {
              await sendVerificationSuccessEmail({
                email: profile.email,
                firstName: profile.first_name || '',
                lastName: profile.last_name || ''
              });
              console.log('✅ Verification success email sent');
            } catch (emailError) {
              // Don't block the flow if email fails - just log it
              console.error('Failed to send verification success email:', emailError);
            }
          }

          if (profile?.email_verified && profile?.approval_status === 'approved') {
            // Fully approved user - go to app
            navigate(profile.is_admin ? '/admin' : '/');
          } else {
            // Not fully approved yet - always go to pending approval
            // This handles both: email not verified OR email verified but waiting for admin approval
            navigate('/pending-approval');
          }
        } else {
          console.log('⚠️ No session found, redirecting to login');
          navigate('/login');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">Authentication error: {error}</div>
        <Button onClick={() => navigate('/login')}>
          Back to Login
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">Processing authentication...</h1>
        <p className="text-muted-foreground">Please wait...</p>
      </div>
    );
  }

  return null;
}
