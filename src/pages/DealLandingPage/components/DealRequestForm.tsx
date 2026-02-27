import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
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

  if (isSuccess) {
    return (
      <div
        id="request"
        className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 sm:p-8"
      >
        <p className="text-[15px] leading-[1.6] text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
          Thank you! We received your message and will be in touch via email as soon as possible.
          Should you have any further thoughts or inquiries, feel free to contact us at{' '}
          <a href="mailto:adam.haile@sourcecodeals.com" className="text-[#C9A84C] underline">
            adam.haile@sourcecodeals.com
          </a>
        </p>
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
