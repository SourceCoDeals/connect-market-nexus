import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, CheckCircle, AlertCircle, XCircle, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface InvestmentFitScoreProps {
  revenue: number;
  ebitda: number;
  category: string;
  location: string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
};

interface FitCriteria {
  name: string;
  score: number;
  weight: number;
  details: string;
}

export function InvestmentFitScore({ revenue, ebitda, category, location }: InvestmentFitScoreProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <User className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="text-muted-foreground">
              Sign in to see your investment fit analysis
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getProfileCompleteness = () => {
    const fields = [
      user?.revenue_range_min,
      user?.revenue_range_max,
      user?.business_categories?.length,
      user?.target_locations,
      user?.investment_size,
      user?.ideal_target_description
    ];
    
    const completedFields = fields.filter(field => 
      field !== null && field !== undefined && field !== '' && field !== 0
    ).length;
    
    return Math.round((completedFields / fields.length) * 100);
  };

  const calculateFitScore = () => {
    if (!user) return { overallScore: 0, criteria: [], profileCompleteness: 0 };

    // Parse user target locations (now comma-separated standardized values)
    const userTargetLocations = user.target_locations ? 
      user.target_locations.split(',').map(loc => loc.trim()).filter(loc => loc.length > 0) : [];
    
    // Parse user business categories (array from database)
    const userBusinessCategories = Array.isArray(user.business_categories) ? 
      user.business_categories : [];

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

    // Location Matching (25% weight)  
    const locationWeight = 25;
    let locationScore = 0;
    let locationDetails = '';
    
    if (userTargetLocations.length > 0) {
      if (userTargetLocations.includes(listingLocation)) {
        locationScore = 100;
        locationDetails = `✓ Perfect: ${listingLocation} matches your targets`;
      } else {
        locationScore = 20;
        locationDetails = `✗ Mismatch: ${listingLocation} vs your targets: ${userTargetLocations.join(', ')}`;
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

    // Industry Matching (25% weight)
    const industryWeight = 25;
    let industryScore = 0;
    let industryDetails = '';
    
    if (userBusinessCategories.length > 0) {
      const hasMatch = userBusinessCategories.some(userCat => 
        userCat.toLowerCase() === category.toLowerCase()
      );
      
      if (hasMatch) {
        industryScore = 100;
        industryDetails = `✓ Perfect: ${category} matches your focus`;
      } else {
        industryScore = 30;
        industryDetails = `✗ Mismatch: ${category} vs your focus: ${userBusinessCategories.join(', ')}`;
      }
      totalWeight += industryWeight;
      weightedScore += industryScore * industryWeight / 100;
    } else {
      industryDetails = '○ Not set in your profile';
    }

    criteria.push({
      name: 'Industry Match',
      score: industryScore,
      weight: industryWeight,
      details: industryDetails
    });

    // Investment Size Matching (20% weight)
    const investmentWeight = 20;
    let investmentScore = 0;
    let investmentDetails = '';
    
    const estimatedValue = revenue * 4;
    
    if (user.investment_size) {
      const sizeText = user.investment_size.toLowerCase();
      let minInvestment = 0;
      let maxInvestment = Infinity;
      
      if (sizeText.includes('1m') || sizeText.includes('1 million')) {
        minInvestment = 1000000;
        maxInvestment = 5000000;
      } else if (sizeText.includes('5m') || sizeText.includes('5 million')) {
        minInvestment = 5000000;
        maxInvestment = 25000000;
      } else if (sizeText.includes('10m') || sizeText.includes('10 million')) {
        minInvestment = 10000000;
        maxInvestment = 50000000;
      }
      
      if (estimatedValue >= minInvestment && estimatedValue <= maxInvestment) {
        investmentScore = 100;
        investmentDetails = `✓ Good fit: Est. $${formatCurrency(estimatedValue)} matches target`;
      } else {
        investmentScore = 50;
        investmentDetails = `⚠ Size gap: Est. $${formatCurrency(estimatedValue)} vs target range`;
      }
      totalWeight += investmentWeight;
      weightedScore += investmentScore * investmentWeight / 100;
    } else {
      investmentDetails = '○ Not set in your profile';
    }

    criteria.push({
      name: 'Size Match',
      score: investmentScore,
      weight: investmentWeight,
      details: investmentDetails
    });

    const overallScore = totalWeight > 0 ? Math.round(weightedScore) : 0;
    const profileCompleteness = getProfileCompleteness();

    return { overallScore, criteria, profileCompleteness };
  };

  const { overallScore, criteria, profileCompleteness } = calculateFitScore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    if (score >= 60) return <AlertCircle className="h-4 w-4 text-amber-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Investment Fit Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}% Match
            </div>
            <div className="text-sm text-muted-foreground">
              Investment compatibility score
            </div>
          </div>
          <div className="flex items-center justify-center">
            {getScoreIcon(overallScore)}
          </div>
        </div>

        {/* Criteria Breakdown */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Match Analysis</div>
          <div className="space-y-2">
            {criteria.map((criterion, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{criterion.name}</span>
                  <span className={`text-sm font-medium ${getScoreColor(criterion.score)}`}>
                    {Math.round(criterion.score)}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground pl-0">
                  {criterion.details}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Transparency */}
        <div className="pt-4 border-t border-border">
          <div className="text-xs font-medium text-foreground mb-2">Your Profile Data Used:</div>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <div>• Revenue: {user?.revenue_range_min ? `$${formatCurrency(user.revenue_range_min)}` : 'Not set'} - {user?.revenue_range_max ? `$${formatCurrency(user.revenue_range_max)}` : 'Not set'}</div>
            <div>• Industries: {user?.business_categories?.length ? user.business_categories.slice(0,2).join(', ') + (user.business_categories.length > 2 ? ` +${user.business_categories.length - 2} more` : '') : 'None'}</div>
            <div>• Regions: {user?.target_locations || 'Not specified'}</div>
            <div>• Investment Size: {user?.investment_size || 'Not specified'}</div>
          </div>
        </div>

        {/* Profile Completeness CTA */}
        {profileCompleteness < 100 && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-foreground">
                Profile {profileCompleteness}% Complete
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/profile')}
                className="h-8 px-3 text-xs"
              >
                Complete Profile
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Complete your profile for more accurate investment matching.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}