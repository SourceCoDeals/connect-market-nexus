import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Target, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mapToStandardizedLocation, StandardizedLocation } from "@/lib/financial-parser";
import { formatNumber } from "@/lib/currency-utils";

interface InvestmentFitScoreProps {
  revenue: number;
  ebitda: number;
  category: string;
  location: string;
}

export function InvestmentFitScore({ revenue, ebitda, category, location }: InvestmentFitScoreProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Sign in to see your investment fit analysis
          </div>
        </CardContent>
      </Card>
    );
  }

  // Standardize the listing location for accurate matching
  const standardizedListingLocation = mapToStandardizedLocation(location);

  const calculateFitScore = () => {
    let totalScore = 0;
    let maxScore = 0;
    const criteria = [];

    // Revenue Range (35% weight)
    const revenueWeight = 35;
    maxScore += revenueWeight;
    const userMinRevenue = user?.revenue_range_min || 0;
    const userMaxRevenue = user?.revenue_range_max || Infinity;
    
    let revenueScore = 0;
    let revenueStatus = 'mismatch';
    let revenueDetail = `Target: $${formatNumber(userMinRevenue)}-$${formatNumber(userMaxRevenue)}`;
    
    if (revenue >= userMinRevenue && revenue <= userMaxRevenue) {
      revenueScore = revenueWeight;
      revenueStatus = 'match';
    } else if (Math.abs(revenue - userMinRevenue) / userMinRevenue < 0.5 || 
               Math.abs(revenue - userMaxRevenue) / userMaxRevenue < 0.5) {
      revenueScore = revenueWeight * 0.7;
      revenueStatus = 'partial';
    }
    
    totalScore += revenueScore;
    criteria.push({
      name: 'Revenue Range',
      status: revenueStatus,
      weight: revenueScore,
      detail: revenueDetail
    });

    // Business Category (25% weight)
    const categoryWeight = 25;
    maxScore += categoryWeight;
    const userCategories = user?.business_categories || [];
    
    let categoryScore = 0;
    let categoryStatus = 'mismatch';
    let categoryDetail = `Interest: ${userCategories.length > 0 ? userCategories.slice(0, 2).join(', ') : 'Not specified'}`;
    
    if (userCategories.includes(category)) {
      categoryScore = categoryWeight;
      categoryStatus = 'match';
    } else if (userCategories.length === 0) {
      categoryScore = categoryWeight * 0.5;
      categoryStatus = 'partial';
      categoryDetail = 'No categories specified';
    }
    
    totalScore += categoryScore;
    criteria.push({
      name: 'Industry Focus',
      status: categoryStatus,
      weight: categoryScore,
      detail: categoryDetail
    });

    // Geographic Location (20% weight)
    const locationWeight = 20;
    maxScore += locationWeight;
    const userLocations = user?.target_locations?.split(',').map(l => l.trim()) || [];
    
    let locationScore = 0;
    let locationStatus = 'mismatch';
    let locationDetail = `Target: ${userLocations.length > 0 ? userLocations.slice(0, 2).join(', ') : 'Not specified'}`;
    
    if (userLocations.includes(standardizedListingLocation) || userLocations.includes('International')) {
      locationScore = locationWeight;
      locationStatus = 'match';
    } else if (userLocations.length === 0) {
      locationScore = locationWeight * 0.5;
      locationStatus = 'partial';
      locationDetail = 'No regions specified';
    }
    
    totalScore += locationScore;
    criteria.push({
      name: 'Geographic Focus',
      status: locationStatus,
      weight: locationScore,
      detail: locationDetail
    });

    // Investment Size Compatibility (20% weight)
    const investmentWeight = 20;
    maxScore += investmentWeight;
    const investmentSize = user?.investment_size || '';
    
    let investmentScore = 0;
    let investmentStatus = 'mismatch';
    let investmentDetail = `Size: ${investmentSize || 'Not specified'}`;
    
    // Estimate deal value (3-5x revenue multiple)
    const estimatedDealValue = revenue * 4;
    
    if (investmentSize) {
      const sizeRanges = {
        'Under $1M': [0, 1000000],
        '$1M - $5M': [1000000, 5000000],
        '$5M - $10M': [5000000, 10000000],
        '$10M - $25M': [10000000, 25000000],
        'Over $25M': [25000000, Infinity]
      };
      
      const [min, max] = sizeRanges[investmentSize as keyof typeof sizeRanges] || [0, 0];
      
      if (estimatedDealValue >= min && estimatedDealValue <= max) {
        investmentScore = investmentWeight;
        investmentStatus = 'match';
      } else if (Math.abs(estimatedDealValue - min) / min < 0.5 || 
                 Math.abs(estimatedDealValue - max) / max < 0.5) {
        investmentScore = investmentWeight * 0.7;
        investmentStatus = 'partial';
      }
    } else {
      investmentScore = investmentWeight * 0.3;
      investmentStatus = 'partial';
    }
    
    totalScore += investmentScore;
    criteria.push({
      name: 'Deal Size',
      status: investmentStatus,
      weight: investmentScore,
      detail: investmentDetail
    });

    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    return { score: finalScore, criteria };
  };

  const { score, criteria } = calculateFitScore();

  // Calculate profile completeness
  const getProfileCompleteness = () => {
    const fields = [
      user?.revenue_range_min,
      user?.revenue_range_max,
      user?.business_categories?.length,
      user?.target_locations,
      user?.investment_size,
      user?.ideal_target_description
    ];
    const completed = fields.filter(field => field && field !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  const profileCompleteness = getProfileCompleteness();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match': return <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />;
      case 'partial': return <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0" />;
      case 'mismatch': return <XCircle className="h-3 w-3 text-red-600 flex-shrink-0" />;
      default: return null;
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Investment Fit Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Overall Score - Minimal */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className={`text-xl font-medium ${getScoreColor(score)}`}>
                {score}% Match
              </div>
              <div className="text-xs text-muted-foreground">
                Based on {criteria.filter(c => c.status !== 'mismatch').length} of {criteria.length} criteria
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-muted flex items-center justify-center">
              <span className={`text-sm font-medium ${getScoreColor(score)}`}>
                {Math.round(score / 10)}
              </span>
            </div>
          </div>

          {/* Criteria Breakdown - Minimal */}
          <div className="space-y-2">
            {criteria.map((criterion, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getStatusIcon(criterion.status)}
                  <span className="text-muted-foreground truncate">{criterion.name}</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground ml-2">
                  {Math.round(criterion.weight)}pts
                </span>
              </div>
            ))}
          </div>

          {/* Data Transparency - Show what user data is being used */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <div className="font-medium text-foreground">Analysis based on your profile:</div>
            <div className="grid grid-cols-1 gap-y-0.5 space-y-0">
              <div>Revenue: {user?.revenue_range_min ? `$${formatNumber(user.revenue_range_min)}` : 'Not set'} - {user?.revenue_range_max ? `$${formatNumber(user.revenue_range_max)}` : 'Not set'}</div>
              <div>Industries: {user?.business_categories?.length ? `${user.business_categories.length} selected` : 'None selected'}</div>
              <div>Regions: {user?.target_locations || 'Not specified'}</div>
              <div>Investment Size: {user?.investment_size || 'Not specified'}</div>
            </div>
          </div>

          {/* Profile Completeness - Minimal */}
          {profileCompleteness < 100 && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">Profile: {profileCompleteness}% complete</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/profile')}
                  className="h-6 px-2 text-xs"
                >
                  Complete
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Missing criteria reduce accuracy. Complete your profile for better matching.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}