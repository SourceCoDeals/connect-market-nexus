// Geographic coordinates for cities and countries

interface Coordinates {
  lat: number;
  lng: number;
}

// Major cities with their coordinates
const cityCoordinates: Record<string, Coordinates> = {
  // United States
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'Chicago': { lat: 41.8781, lng: -87.6298 },
  'Houston': { lat: 29.7604, lng: -95.3698 },
  'Phoenix': { lat: 33.4484, lng: -112.0740 },
  'Philadelphia': { lat: 39.9526, lng: -75.1652 },
  'San Antonio': { lat: 29.4241, lng: -98.4936 },
  'San Diego': { lat: 32.7157, lng: -117.1611 },
  'Dallas': { lat: 32.7767, lng: -96.7970 },
  'San Jose': { lat: 37.3382, lng: -121.8863 },
  'Austin': { lat: 30.2672, lng: -97.7431 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'Boston': { lat: 42.3601, lng: -71.0589 },
  'Seattle': { lat: 47.6062, lng: -122.3321 },
  'Denver': { lat: 39.7392, lng: -104.9903 },
  'Miami': { lat: 25.7617, lng: -80.1918 },
  'Atlanta': { lat: 33.7490, lng: -84.3880 },
  'Minneapolis': { lat: 44.9778, lng: -93.2650 },
  'Detroit': { lat: 42.3314, lng: -83.0458 },
  'Portland': { lat: 45.5152, lng: -122.6784 },
  // Europe
  'London': { lat: 51.5074, lng: -0.1278 },
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'Berlin': { lat: 52.5200, lng: 13.4050 },
  'Madrid': { lat: 40.4168, lng: -3.7038 },
  'Rome': { lat: 41.9028, lng: 12.4964 },
  'Amsterdam': { lat: 52.3676, lng: 4.9041 },
  'Brussels': { lat: 50.8503, lng: 4.3517 },
  'Vienna': { lat: 48.2082, lng: 16.3738 },
  'Stockholm': { lat: 59.3293, lng: 18.0686 },
  'Dublin': { lat: 53.3498, lng: -6.2603 },
  'Zurich': { lat: 47.3769, lng: 8.5417 },
  'Munich': { lat: 48.1351, lng: 11.5820 },
  'Milan': { lat: 45.4642, lng: 9.1900 },
  'Barcelona': { lat: 41.3851, lng: 2.1734 },
  'Prague': { lat: 50.0755, lng: 14.4378 },
  'Budapest': { lat: 47.4979, lng: 19.0402 },
  'Warsaw': { lat: 52.2297, lng: 21.0122 },
  'Copenhagen': { lat: 55.6761, lng: 12.5683 },
  'Oslo': { lat: 59.9139, lng: 10.7522 },
  'Helsinki': { lat: 60.1699, lng: 24.9384 },
  // Asia
  'Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Seoul': { lat: 37.5665, lng: 126.9780 },
  'Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Beijing': { lat: 39.9042, lng: 116.4074 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Delhi': { lat: 28.7041, lng: 77.1025 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Sydney': { lat: -33.8688, lng: 151.2093 },
  'Melbourne': { lat: -37.8136, lng: 144.9631 },
  'Auckland': { lat: -36.8509, lng: 174.7645 },
  // Americas
  'Toronto': { lat: 43.6532, lng: -79.3832 },
  'Vancouver': { lat: 49.2827, lng: -123.1207 },
  'Montreal': { lat: 45.5017, lng: -73.5673 },
  'Mexico City': { lat: 19.4326, lng: -99.1332 },
  'São Paulo': { lat: -23.5505, lng: -46.6333 },
  'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
  'Buenos Aires': { lat: -34.6037, lng: -58.3816 },
  'Lima': { lat: -12.0464, lng: -77.0428 },
  'Bogota': { lat: 4.7110, lng: -74.0721 },
};

// Country center coordinates (fallback when city not found)
const countryCoordinates: Record<string, Coordinates> = {
  'United States': { lat: 39.8283, lng: -98.5795 },
  'United Kingdom': { lat: 55.3781, lng: -3.4360 },
  'Germany': { lat: 51.1657, lng: 10.4515 },
  'France': { lat: 46.6034, lng: 2.2137 },
  'Canada': { lat: 56.1304, lng: -106.3468 },
  'Australia': { lat: -25.2744, lng: 133.7751 },
  'Italy': { lat: 41.8719, lng: 12.5674 },
  'Spain': { lat: 40.4637, lng: -3.7492 },
  'Brazil': { lat: -14.2350, lng: -51.9253 },
  'Mexico': { lat: 23.6345, lng: -102.5528 },
  'Japan': { lat: 36.2048, lng: 138.2529 },
  'China': { lat: 35.8617, lng: 104.1954 },
  'India': { lat: 20.5937, lng: 78.9629 },
  'South Korea': { lat: 35.9078, lng: 127.7669 },
  'Netherlands': { lat: 52.1326, lng: 5.2913 },
  'Belgium': { lat: 50.8503, lng: 4.3517 },
  'Switzerland': { lat: 46.8182, lng: 8.2275 },
  'Sweden': { lat: 60.1282, lng: 18.6435 },
  'Norway': { lat: 60.4720, lng: 8.4689 },
  'Denmark': { lat: 56.2639, lng: 9.5018 },
  'Finland': { lat: 61.9241, lng: 25.7482 },
  'Poland': { lat: 51.9194, lng: 19.1451 },
  'Austria': { lat: 47.5162, lng: 14.5501 },
  'Ireland': { lat: 53.1424, lng: -7.6921 },
  'Portugal': { lat: 39.3999, lng: -8.2245 },
  'Hungary': { lat: 47.1625, lng: 19.5033 },
  'Czech Republic': { lat: 49.8175, lng: 15.4730 },
  'Romania': { lat: 45.9432, lng: 24.9668 },
  'Greece': { lat: 39.0742, lng: 21.8243 },
  'Israel': { lat: 31.0461, lng: 34.8516 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Taiwan': { lat: 23.6978, lng: 120.9605 },
  'Thailand': { lat: 15.8700, lng: 100.9925 },
  'Vietnam': { lat: 14.0583, lng: 108.2772 },
  'Indonesia': { lat: -0.7893, lng: 113.9213 },
  'Philippines': { lat: 12.8797, lng: 121.7740 },
  'Malaysia': { lat: 4.2105, lng: 101.9758 },
  'New Zealand': { lat: -40.9006, lng: 174.8860 },
  'South Africa': { lat: -30.5595, lng: 22.9375 },
  'Argentina': { lat: -38.4161, lng: -63.6167 },
  'Chile': { lat: -35.6751, lng: -71.5430 },
  'Colombia': { lat: 4.5709, lng: -74.2973 },
  'Peru': { lat: -9.1900, lng: -75.0152 },
  'Ukraine': { lat: 48.3794, lng: 31.1656 },
  'Russia': { lat: 61.5240, lng: 105.3188 },
  'Turkey': { lat: 38.9637, lng: 35.2433 },
  'Egypt': { lat: 26.8206, lng: 30.8025 },
  'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
  'United Arab Emirates': { lat: 23.4241, lng: 53.8478 },
};

export function getCoordinates(city: string | null, country: string | null): Coordinates | null {
  // Try city first
  if (city && cityCoordinates[city]) {
    return cityCoordinates[city];
  }
  
  // Fallback to country
  if (country && countryCoordinates[country]) {
    return countryCoordinates[country];
  }
  
  return null;
}

export function getCityCoordinates(city: string): Coordinates | null {
  return cityCoordinates[city] || null;
}

export function getCountryCoordinates(country: string): Coordinates | null {
  return countryCoordinates[country] || null;
}

// Add some random offset to prevent overlapping markers at same location
export function addJitter(coords: Coordinates, seed: string): Coordinates {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const jitterLat = ((hash % 100) - 50) / 500; // ~0.1 degree max
  const jitterLng = (((hash >> 4) % 100) - 50) / 500;
  
  return {
    lat: coords.lat + jitterLat,
    lng: coords.lng + jitterLng,
  };
}
