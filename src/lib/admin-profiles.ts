export interface AdminProfile {
  email: string;
  name: string;
  title: string;
  phone: string;
  calendlyUrl: string;
}

export const ADMIN_PROFILES: Record<string, AdminProfile> = {
  'adam.haile@sourcecodeals.com': {
    email: 'adam.haile@sourcecodeals.com',
    name: 'Adam Haile',
    title: 'Founder & CEO',
    phone: '',
    calendlyUrl: ''
  },
  'ahaile14@gmail.com': {
    email: 'ahaile14@gmail.com',
    name: 'Adam Haile',
    title: 'Founder & CEO',
    phone: '',
    calendlyUrl: ''
  },
  'tomos.mughan@sourcecodeals.com': {
    email: 'tomos.mughan@sourcecodeals.com',
    name: 'Tomos Mughan',
    title: 'CEO',
    phone: '',
    calendlyUrl: ''
  },
  'bill.martin@sourcecodeals.com': {
    email: 'bill.martin@sourcecodeals.com',
    name: 'Bill Martin',
    title: 'Principal & SVP - Growth',
    phone: '',
    calendlyUrl: ''
  },
  'kyle.collins@sourcecodeals.com': {
    email: 'kyle.collins@sourcecodeals.com',
    name: 'Kyle Collins',
    title: 'Team Member',
    phone: '',
    calendlyUrl: ''
  },
  'daniel.kobayashi@sourcecodeals.com': {
    email: 'daniel.kobayashi@sourcecodeals.com',
    name: 'Daniel Kobayashi',
    title: 'Team Member',
    phone: '',
    calendlyUrl: ''
  },
  'oz.delaluna@captarget.com': {
    email: 'oz.delaluna@captarget.com',
    name: 'Oz De La Luna',
    title: 'Team Member',
    phone: '',
    calendlyUrl: ''
  },
  'oz.delaluna@sourcecodeals.com': {
    email: 'oz.delaluna@sourcecodeals.com',
    name: 'Oz De La Luna',
    title: 'Team Member',
    phone: '',
    calendlyUrl: ''
  },
};

export const getAdminProfile = (email: string): AdminProfile | null => {
  return ADMIN_PROFILES[email] || null;
};
