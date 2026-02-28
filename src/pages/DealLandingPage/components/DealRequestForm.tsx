import { useState, type FormEvent } from 'react';
import { Mail, CheckCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { useDealLandingFormSubmit } from '@/hooks/useDealLandingFormSubmit';

const ROLE_OPTIONS = [
  'Private Equity',
  'Family Office',
  'Independent Sponsor',
  'Corporate',
  'Search Fund',
  'Individual Investor',
  'Consultant/Advisor',
  'Other',
];

interface DealRequestFormProps {
  listingId: string;
  dealTitle: string;
}

export default function DealRequestForm({ listingId, dealTitle }: DealRequestFormProps) {
  const { submit, isSubmitting, isSuccess, error } = useDealLandingFormSubmit(listingId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !role || !message) return;
    submit({ name, email, company, phone, role, message });
  };

  // GAP 14: Build marketplace signup URL with UTM attribution
  const signupUrl = new URL('https://marketplace.sourcecodeals.com/signup');
  signupUrl.searchParams.set('utm_source', 'landing_page');
  signupUrl.searchParams.set('utm_medium', 'form_success');
  signupUrl.searchParams.set('utm_content', 'post_submission_nudge');
  signupUrl.searchParams.set('utm_campaign', listingId);

  // GAP 11: Post-submission signup nudge
  if (isSuccess) {
    return (
      <div
        id="request"
        className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 sm:p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
          <h3 className="text-[18px] font-bold text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
            Request Received
          </h3>
        </div>

        <p className="text-[15px] leading-[1.6] text-[#374151] mb-6 font-['Inter',system-ui,sans-serif]">
          Your request is being reviewed by our team. We'll be in touch shortly with next steps
          and detailed deal materials.
        </p>

        {/* Signup Nudge */}
        <div className="bg-[#F7F5F0] rounded-lg p-5 mb-4">
          <h4 className="text-[15px] font-semibold text-[#1A1A1A] mb-2 font-['Inter',system-ui,sans-serif]">
            While you wait — explore more deals
          </h4>
          <p className="text-[13px] text-[#6B7280] leading-[1.6] mb-3 font-['Inter',system-ui,sans-serif]">
            Join our marketplace to browse 50+ vetted, founder-led businesses with $2M-50M revenue.
            Get instant access to new deal flow as soon as it's available.
          </p>
          <a
            href={signupUrl.toString()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#C9A84C] text-[#1A1A1A] font-semibold text-[15px] py-3 rounded-md hover:bg-[#b8963e] transition-colors font-['Inter',system-ui,sans-serif]"
          >
            <ArrowRight className="w-4 h-4" />
            Join the Marketplace — Free
          </a>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://tidycal.com/tomosmughan/30-minute-meeting"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 flex-1 bg-white border border-[#D1D5DB] text-[#374151] font-medium text-[13px] py-2.5 rounded-md hover:bg-gray-50 transition-colors font-['Inter',system-ui,sans-serif]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Schedule a Call
          </a>
        </div>
      </div>
    );
  }

  const inputClasses =
    "w-full bg-[#F7F5F0] border border-[#D1D5DB] rounded px-3 py-2.5 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] transition-colors font-['Inter',system-ui,sans-serif]";
  const labelClasses =
    "block text-[14px] font-medium text-[#374151] mb-1.5 font-['Inter',system-ui,sans-serif]";

  return (
    <div
      id="request"
      className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 sm:p-8"
    >
      <div className="flex items-center gap-3 mb-2">
        <Mail className="w-5 h-5 text-[#6B7280]" />
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
          Request Full Deal Details
        </h2>
      </div>
      <p className="text-[14px] text-[#6B7280] mb-6 font-['Inter',system-ui,sans-serif]">
        Get full access to detailed financials and business metrics to {dealTitle}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your@email.com"
              required
              className={inputClasses}
            />
          </div>
        </div>

        {/* Row 2: Company + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Company name</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company URL or name"
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>
              Phone number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (614) 316-2342"
              required
              className={inputClasses}
            />
          </div>
        </div>

        {/* Row 3: Role Dropdown */}
        <div>
          <label className={labelClasses}>
            What best describes you? <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className={`${inputClasses} appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.75rem_center] bg-[length:16px_16px] pr-10`}
          >
            <option value="" disabled>
              Select your role
            </option>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Row 4: Mandate Textarea */}
        <div>
          <label className={labelClasses}>
            Your interest or mandate <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="This helps us prioritize introductions based on buyer fit and seller expectations. Even a quick note on why this deal or how it fits your mandate gives us context to move faster with your request."
            required
            rows={4}
            className={`${inputClasses} resize-y min-h-[100px]`}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-[14px] font-['Inter',system-ui,sans-serif]">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#1A1A1A] text-white font-semibold text-[15px] py-3.5 rounded-md hover:bg-[#333333] transition-colors disabled:opacity-60 font-['Inter',system-ui,sans-serif]"
        >
          {isSubmitting ? 'Submitting...' : 'Request Full Deal Details'}
        </button>
      </form>
    </div>
  );
}
