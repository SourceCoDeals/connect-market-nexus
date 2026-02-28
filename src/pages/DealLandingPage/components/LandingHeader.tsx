const NAV_ITEMS = [
  { label: 'Live Deals', href: 'https://www.sourcecodeals.com/off-market-deal-memos' },
  { label: 'Buyers', href: 'https://www.sourcecodeals.com/buyers' },
  { label: 'Owners', href: 'https://www.sourcecodeals.com/owners' },
  { label: 'About', href: 'https://www.sourcecodeals.com/about' },
  { label: 'Resources', href: 'https://www.sourcecodeals.com/resources' },
];

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <a href="https://www.sourcecodeals.com" className="flex items-center gap-2">
            <img
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png"
              alt="SourceCo"
              className="h-8 w-8"
            />
            <span className="text-xl font-bold text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
              SourceCo
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-[#374151] hover:text-[#1A1A1A] transition-colors font-['Inter',system-ui,sans-serif]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href="https://marketplace.sourcecodeals.com/signup?utm_source=landing_page&utm_medium=header&utm_content=join_marketplace"
            className="hidden sm:inline-flex items-center px-4 py-2 border border-[#C9A84C] text-sm font-semibold text-[#C9A84C] rounded-md hover:bg-[#C9A84C] hover:text-white transition-colors font-['Inter',system-ui,sans-serif]"
          >
            Join the Marketplace
          </a>
        </div>
      </div>
    </header>
  );
}
