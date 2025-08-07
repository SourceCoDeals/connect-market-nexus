import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, calculateLocationMatchScore, calculateIndustryMatchScore } from '@/lib/financial-parser';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface InvestmentFitScoreProps {
  revenue: number;
  ebitda: number;
  category: string;
  location: string;
}


interface FitCriteria {
  name: string;
  score: number;
  weight: number;
  details: string;
}

export function InvestmentFitScore({ revenue, ebitda, category, location }: InvestmentFitScoreProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Investment Fit Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Sign in to see how well this opportunity matches your investment criteria
            </p>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ENHANCED: Parse user data with robust error handling for all formats
  const userTargetLocations = user.target_locations 
    ? (typeof user.target_locations === 'string'
        ? (user.target_locations.startsWith('[') 
           ? (() => {
               try { return JSON.parse(user.target_locations as string); } 
               catch { return user.target_locations.split(',').map(loc => loc.trim()).filter(Boolean); }
             })()
           : user.target_locations.split(',').map(loc => loc.trim()).filter(Boolean))
        : Array.isArray(user.target_locations)
        ? user.target_locations
        : [])
    : [];
  
  const userCategories = user.business_categories 
    ? (Array.isArray(user.business_categories) 
        ? user.business_categories 
        : typeof user.business_categories === 'string'
        ? ((user.business_categories as string).startsWith('[') 
           ? (() => {
               try { return JSON.parse(user.business_categories as string); } 
               catch { return [user.business_categories as string]; }
             })()
           : [user.business_categories as string])
        : [])
    : [];

  function calculateFitScore(): { score: number; criteria: FitCriteria[] } {
    // Location is already standardized, no need to map
    const listingLocation = location;
    
    let totalWeight = 0;
    let weightedScore = 0;
    const criteria: FitCriteria[] = [];

    // Revenue Range Matching (30% weight)
    const revenueWeight = 30;
    let revenueScore = 0;
    let revenueDetails = '';
    
    if (user.revenue_range_min || user.revenue_range_max) {
      const minRange = user.revenue_range_min || 0;
      const maxRange = user.revenue_range_max || Infinity;
      
      if (revenue >= minRange && revenue <= maxRange) {
        revenueScore = 100;
        revenueDetails = `✓ Perfect: $${formatCurrency(revenue)} fits range $${formatCurrency(minRange)}-$${formatCurrency(maxRange)}`;
      } else if (revenue < minRange) {
        const ratio = revenue / minRange;
        revenueScore = Math.max(0, ratio * 80);
        revenueDetails = `⚠ Below: $${formatCurrency(revenue)} vs min $${formatCurrency(minRange)}`;
      } else {
        const ratio = maxRange / revenue;
        revenueScore = Math.max(0, ratio * 80);
        revenueDetails = `⚠ Above: $${formatCurrency(revenue)} vs max $${formatCurrency(maxRange)}`;
      }
      totalWeight += revenueWeight;
      weightedScore += revenueScore * revenueWeight / 100;
    } else {
      revenueDetails = '○ Not set in your profile';
    }

    criteria.push({
      name: 'Revenue Match',
      score: revenueScore,
      weight: revenueWeight,
      details: revenueDetails
    });

    // Smart Location Matching (25% weight) - with hierarchical scoring
    const locationWeight = 25;
    let locationScore = 0;
    let locationDetails = '';
    
    if (userTargetLocations.length > 0) {
      locationScore = calculateLocationMatchScore(userTargetLocations, listingLocation);
      
      if (locationScore === 100) {
        locationDetails = `✓ Perfect: ${listingLocation} matches your targets`;
      } else if (locationScore === 75) {
        locationDetails = `✓ Good: ${listingLocation} is in nearby region`;
      } else if (locationScore === 50) {
        locationDetails = `○ Regional: ${listingLocation} same area as targets`;
      } else {
        locationDetails = `○ Different: ${listingLocation} vs targets: ${userTargetLocations.join(', ')}`;
      }
      totalWeight += locationWeight;
      weightedScore += locationScore * locationWeight / 100;
    } else {
      locationDetails = '○ Not set in your profile';
    }

    criteria.push({
      name: 'Location Match',
      score: locationScore,
      weight: locationWeight,
      details: locationDetails
    });

    // Smart Industry/Category Matching (25% weight)
    const categoryWeight = 25;
    let categoryScore = 0;
    let categoryDetails = '';
    
    if (userCategories.length > 0) {
      categoryScore = calculateIndustryMatchScore(userCategories, category);
      
      if (categoryScore === 100) {
        if (userCategories.includes('All Industries')) {
          categoryDetails = `✓ Perfect: Matches your "All Industries" preference`;
        } else {
          categoryDetails = `✓ Perfect: ${category} matches your interests`;
        }
      } else if (categoryScore === 80) {
        categoryDetails = `✓ Similar: ${category} is closely related to your interests`;
      } else if (categoryScore === 70) {
        categoryDetails = `○ Related: ${category} partially matches your interests`;
      } else {
        categoryDetails = `○ Different: ${category} vs your interests: ${userCategories.join(', ')}`;
      }
      totalWeight += categoryWeight;
      weightedScore += categoryScore * categoryWeight / 100;
    } else {
      categoryDetails = '○ Not set in your profile';
    }

    criteria.push({
      name: 'Industry Match',
      score: categoryScore,
      weight: categoryWeight,
      details: categoryDetails
    });

    // Investment Size Matching (20% weight)
    const sizeWeight = 20;
    let sizeScore = 0;
    let sizeDetails = '';
    
    if (user.investment_size) {
      const investmentSize = user.investment_size.toLowerCase();
      
      if (investmentSize.includes('small') || investmentSize.includes('<5m')) {
        sizeScore = revenue < 10000000 ? 100 : revenue < 25000000 ? 75 : 50;
        sizeDetails = `${sizeScore === 100 ? '✓' : sizeScore === 75 ? '○' : '⚠'} Small deal preference vs $${formatCurrency(revenue)} revenue`;
      } else if (investmentSize.includes('medium') || investmentSize.includes('5-25m')) {
        sizeScore = revenue >= 5000000 && revenue <= 50000000 ? 100 : 75;
        sizeDetails = `${sizeScore === 100 ? '✓' : '○'} Medium deal preference vs $${formatCurrency(revenue)} revenue`;
      } else if (investmentSize.includes('large') || investmentSize.includes('>25m')) {
        sizeScore = revenue > 25000000 ? 100 : revenue > 10000000 ? 75 : 50;
        sizeDetails = `${sizeScore === 100 ? '✓' : sizeScore === 75 ? '○' : '⚠'} Large deal preference vs $${formatCurrency(revenue)} revenue`;
      } else {
        sizeScore = 75; // Default if we can't parse
        sizeDetails = `○ Investment size: "${user.investment_size}" vs $${formatCurrency(revenue)} revenue`;
      }
      
      totalWeight += sizeWeight;
      weightedScore += sizeScore * sizeWeight / 100;
    } else {
      sizeDetails = '○ Not set in your profile';
    }

    criteria.push({
      name: 'Investment Size',
      score: sizeScore,
      weight: sizeWeight,
      details: sizeDetails
    });

    const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
    return { score: finalScore, criteria };
  }

  function getProfileCompleteness(): number {
    const fields = [
      user.revenue_range_min || user.revenue_range_max,
      userTargetLocations.length > 0,
      userCategories.length > 0,
      user.investment_size,
      user.buyer_type
    ];
    
    const completedFields = fields.filter(Boolean).length;
    return (completedFields / fields.length) * 100;
  }

  const { score: overallScore, criteria } = calculateFitScore();
  const profileCompleteness = getProfileCompleteness();

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    return 'text-muted-foreground';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 70) return '✓';
    return '○';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">Investment Fit Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-6">
          <div className="text-center">
            <div className={`text-3xl font-semibold ${getScoreColor(overallScore)}`}>
              {Math.round(overallScore)}%
            </div>
            <p className="text-sm text-muted-foreground">Investment Fit Score</p>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm text-foreground">Score Breakdown</h4>
            {criteria.map((criterion, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {criterion.name}
                  </span>
                  <span className={`font-semibold ${getScoreColor(criterion.score)}`}>
                    {Math.round(criterion.score)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {criterion.details}
                </p>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Profile data transparency */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">Your Profile Data</h4>
            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue Range:</span> 
                <span className="font-medium text-right">
                  {user.revenue_range_min || user.revenue_range_max 
                    ? `$${formatCurrency(user.revenue_range_min || 0)} - $${formatCurrency(user.revenue_range_max || Infinity)}`
                    : 'Not set'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Locations:</span> 
                <span className="font-medium text-right max-w-[60%]">
                  {userTargetLocations.length > 0 ? userTargetLocations.join(', ') : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Industries:</span> 
                <span className="font-medium text-right max-w-[60%]">
                  {userCategories.length > 0 ? userCategories.join(', ') : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Investment Size:</span> 
                <span className="font-medium text-right">{user.investment_size || 'Not set'}</span>
              </div>
            </div>
          </div>

          {profileCompleteness < 100 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-foreground">Profile Completion</h4>
                  <span className="text-sm font-medium text-muted-foreground">
                    {Math.round(profileCompleteness)}%
                  </span>
                </div>
                <Progress value={profileCompleteness} className="h-2" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Complete your profile to get more accurate investment fit scores and better deal matching.
                </p>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link to="/profile">Complete Profile</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}