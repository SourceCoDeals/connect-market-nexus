interface IconProps {
  className?: string;
}

// Add-On Icon: Puzzle piece suggesting complementary fit
export const AddOnIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M8 4H4V8C4 8 5 9 6 9C7 9 8 8 8 8V12H12V8C12 8 13 9 14 9C15 9 16 8 16 8V4H12V8C12 8 11 9 10 9C9 9 8 8 8 8V4Z" 
      fill="currentColor" 
      opacity="0.3"
    />
    <rect x="4" y="12" width="12" height="8" rx="0.5" fill="currentColor" opacity="0.3"/>
  </svg>
);

// Platform Icon: Layered foundation suggesting scalability
export const PlatformIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="14" width="16" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="6" y="10" width="12" height="2" fill="currentColor" opacity="0.4"/>
    <rect x="8" y="6" width="8" height="2" fill="currentColor" opacity="0.3"/>
    <rect x="4" y="17" width="16" height="3" fill="currentColor"/>
  </svg>
);
