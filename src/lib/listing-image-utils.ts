/**
 * Get category-specific gradient for listing placeholder images
 */
export function getCategoryGradient(category: string): string {
  const categoryLower = category.toLowerCase();
  
  // Map categories to gradient styles
  const gradients: Record<string, string> = {
    healthcare: 'linear-gradient(135deg, hsl(213, 94%, 68%) 0%, hsl(213, 94%, 85%) 100%)',
    construction: 'linear-gradient(135deg, hsl(25, 95%, 60%) 0%, hsl(25, 95%, 75%) 100%)',
    aerospace: 'linear-gradient(135deg, hsl(215, 25%, 27%) 0%, hsl(215, 25%, 45%) 100%)',
    'home services': 'linear-gradient(135deg, hsl(142, 70%, 45%) 0%, hsl(142, 70%, 60%) 100%)',
    technology: 'linear-gradient(135deg, hsl(262, 83%, 58%) 0%, hsl(262, 83%, 75%) 100%)',
    manufacturing: 'linear-gradient(135deg, hsl(217, 92%, 42%) 0%, hsl(217, 92%, 60%) 100%)',
    retail: 'linear-gradient(135deg, hsl(346, 100%, 61%) 0%, hsl(346, 100%, 75%) 100%)',
    'food & beverage': 'linear-gradient(135deg, hsl(32, 98%, 56%) 0%, hsl(32, 98%, 70%) 100%)',
    education: 'linear-gradient(135deg, hsl(268, 64%, 52%) 0%, hsl(268, 64%, 68%) 100%)',
    transportation: 'linear-gradient(135deg, hsl(199, 89%, 48%) 0%, hsl(199, 89%, 65%) 100%)',
  };

  // Find matching gradient
  for (const [key, gradient] of Object.entries(gradients)) {
    if (categoryLower.includes(key)) {
      return gradient;
    }
  }

  // Default gradient (neutral slate)
  return 'linear-gradient(135deg, hsl(215, 16%, 47%) 0%, hsl(215, 16%, 65%) 100%)';
}

/**
 * Get listing display image or placeholder
 */
export function getListingImage(imageUrl: string | null, category: string): {
  type: 'image' | 'gradient';
  value: string;
} {
  if (imageUrl) {
    return { type: 'image', value: imageUrl };
  }
  
  return {
    type: 'gradient',
    value: getCategoryGradient(category),
  };
}
