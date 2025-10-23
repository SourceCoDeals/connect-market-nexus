import React from 'react';

interface MetricIconProps {
  className?: string;
}

// Revenue Icon - Trending upward chart
export const RevenueIcon: React.FC<MetricIconProps> = ({ className = "w-5 h-5" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M22 12L18 8L13 13L9 9L2 16" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 8H22V14" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// EBITDA Icon - Dollar sign in circle
export const EBITDAIcon: React.FC<MetricIconProps> = ({ className = "w-5 h-5" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M12 6V18M15 9.5C15 8.11929 13.6569 7 12 7C10.3431 7 9 8.11929 9 9.5C9 10.8807 10.3431 12 12 12C13.6569 12 15 13.1193 15 14.5C15 15.8807 13.6569 17 12 17C10.3431 17 9 15.8807 9 14.5" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </svg>
);

// Margin Icon - Percentage in square
export const MarginIcon: React.FC<MetricIconProps> = ({ className = "w-5 h-5" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect 
      x="3" 
      y="3" 
      width="18" 
      height="18" 
      rx="2" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M8 8L16 16M16 9C16 9.55228 15.5523 10 15 10C14.4477 10 14 9.55228 14 9C14 8.44772 14.4477 8 15 8C15.5523 8 16 8.44772 16 9ZM10 15C10 15.5523 9.55228 16 9 16C8.44772 16 8 15.5523 8 15C8 14.4477 8.44772 14 9 14C9.55228 14 10 14.4477 10 15Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </svg>
);

// Employees Icon - Users/people
export const EmployeesIcon: React.FC<MetricIconProps> = ({ className = "w-5 h-5" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle 
      cx="9" 
      cy="7" 
      r="4" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Calendar Icon - For listed date
export const CalendarIcon: React.FC<MetricIconProps> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect 
      x="3" 
      y="4" 
      width="18" 
      height="18" 
      rx="2" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M16 2V6M8 2V6M3 10H21" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </svg>
);

// Document Icon - For business overview
export const DocumentIcon: React.FC<MetricIconProps> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M14 2V8H20M16 13H8M16 17H8M10 9H8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Chart Icon - For financial summary
export const ChartIcon: React.FC<MetricIconProps> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M3 3V21H21" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M18 9L13 14L9 10L3 16" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Building Icon - For ownership/company overview
export const BuildingIcon: React.FC<MetricIconProps> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect 
      x="4" 
      y="2" 
      width="16" 
      height="20" 
      rx="2" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M9 22V18H15V22M8 6H8.01M16 6H16.01M12 6H12.01M12 10H12.01M12 14H12.01M16 10H16.01M16 14H16.01M8 10H8.01M8 14H8.01" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </svg>
);

// Lock Icon - For locked content CTA
export const LockIcon: React.FC<MetricIconProps> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect 
      x="3" 
      y="11" 
      width="18" 
      height="11" 
      rx="2" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);
