export interface AdminProfile {
  email: string;
  name: string;
  title: string;
  phone: string;
  calendlyUrl: string;
}

export const ADMIN_PROFILES: Record<string, AdminProfile> = {
  'bill.martin@sourcecodeals.com': {
    email: 'bill.martin@sourcecodeals.com',
    name: 'Bill Martin',
    title: 'Principal & SVP - Growth',
    phone: '',
    calendlyUrl: ''
  },
  'adam.haile@sourcecodeals.com': {
    email: 'adam.haile@sourcecodeals.com',
    name: 'Adam Haile',
    title: 'Founder & CEO',
    phone: '',
    calendlyUrl: ''
  }
};

export const getAdminProfile = (email: string): AdminProfile | null => {
  return ADMIN_PROFILES[email] || null;
};