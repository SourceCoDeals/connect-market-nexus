// Convert country code to flag emoji

export function countryCodeToFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) {
    return '🌍';
  }
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

// Common country code mappings from country names
const countryNameToCode: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'Germany': 'DE',
  'France': 'FR',
  'Canada': 'CA',
  'Australia': 'AU',
  'Italy': 'IT',
  'Spain': 'ES',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'Japan': 'JP',
  'China': 'CN',
  'India': 'IN',
  'South Korea': 'KR',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Switzerland': 'CH',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Finland': 'FI',
  'Poland': 'PL',
  'Austria': 'AT',
  'Ireland': 'IE',
  'Portugal': 'PT',
  'Hungary': 'HU',
  'Czech Republic': 'CZ',
  'Romania': 'RO',
  'Greece': 'GR',
  'Israel': 'IL',
  'Singapore': 'SG',
  'Hong Kong': 'HK',
  'Taiwan': 'TW',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Indonesia': 'ID',
  'Philippines': 'PH',
  'Malaysia': 'MY',
  'New Zealand': 'NZ',
  'South Africa': 'ZA',
  'Argentina': 'AR',
  'Chile': 'CL',
  'Colombia': 'CO',
  'Peru': 'PE',
  'Ukraine': 'UA',
  'Russia': 'RU',
  'Turkey': 'TR',
  'Egypt': 'EG',
  'Saudi Arabia': 'SA',
  'United Arab Emirates': 'AE',
};

export function getCountryCode(countryName: string | null): string | null {
  if (!countryName) return null;
  return countryNameToCode[countryName] || null;
}

export function getFlagFromCountryName(countryName: string | null): string {
  const code = getCountryCode(countryName);
  return countryCodeToFlag(code);
}
