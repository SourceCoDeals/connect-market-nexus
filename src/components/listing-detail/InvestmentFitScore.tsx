import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Target, CheckCircle, AlertCircle, XCircle, User, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { mapToStandardizedLocation } from '@/lib/financial-parser';

interface InvestmentFitScoreProps {
  revenue: number;
  ebitda: number;
  category: string;
  location: string;
}

export const InvestmentFitScore: React.FC<InvestmentFitScoreProps> = ({
  revenue,
  ebitda,
  category,
  location
}) => {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <Card className="border-sourceco-form bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-sourceco-text flex items-center gap-2">
            <Target className="h-4 w-4" />
            Investment Fit Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-2">
              Please sign in to see how this opportunity fits your investment criteria
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate fit score based on user preferences vs listing characteristics
  const calculateFitScore = () => {
    let score = 0;
    let maxScore = 0;
    const criteria = [];

    // Revenue range fit
    maxScore += 25;
    const userMinRevenue = user.revenue_range_min || 0;
    const userMaxRevenue = user.revenue_range_max || Number.MAX_SAFE_INTEGER;
    
    if (revenue >= userMinRevenue && revenue <= userMaxRevenue) {
      score += 25;
      criteria.push({ 
        name: 'Revenue Range', 
        status: 'match', 
        detail: 'Within your target range' 
      });
    } else if (revenue < userMinRevenue) {
      score += 10;
      criteria.push({ 
        name: 'Revenue Range', 
        status: 'partial', 
        detail: 'Below target range' 
      });
    } else {
      score += 15;
      criteria.push({ 
        name: 'Revenue Range', 
        status: 'partial', 
        detail: 'Above target range' 
      });
    }

    // Business category fit
    maxScore += 25;
    const userCategories = user.business_categories || [];
    if (Array.isArray(userCategories) && userCategories.length > 0) {
      if (userCategories.includes(category)) {
        score += 25;
        criteria.push({ 
          name: 'Industry Focus', 
          status: 'match', 
          detail: 'Matches your sector preference' 
        });
      } else {
        score += 5;
        criteria.push({ 
          name: 'Industry Focus', 
          status: 'mismatch', 
          detail: 'Different from your focus areas' 
        });
      }
    } else {
      score += 15;
      criteria.push({ 
        name: 'Industry Focus', 
        status: 'partial', 
        detail: 'No specific preference set' 
      });
    }

    // Geographic fit with standardized locations
    maxScore += 20;
    const userLocations = user.target_locations || '';
    const standardizedListingLocation = mapToStandardizedLocation(location);
    const standardizedUserLocation = userLocations ? mapToStandardizedLocation(userLocations) : '';
    
    if (standardizedUserLocation && standardizedListingLocation === standardizedUserLocation) {
      score += 20;
      criteria.push({ 
        name: 'Geography', 
        status: 'match', 
        detail: `Perfect match: ${standardizedListingLocation}` 
      });
    } else if (standardizedUserLocation) {
      // Check for regional proximity
      const regionalMatch = checkRegionalProximity(standardizedListingLocation, standardizedUserLocation);
      if (regionalMatch) {
        score += 12;
        criteria.push({ 
          name: 'Geography', 
          status: 'partial', 
          detail: `Nearby region: ${standardizedListingLocation}` 
        });
      } else {
        score += 8;
        criteria.push({ 
          name: 'Geography', 
          status: 'mismatch', 
          detail: `Different region: ${standardizedListingLocation}` 
        });
      }
    } else {
      score += 15;
      criteria.push({ 
        name: 'Geography', 
        status: 'partial', 
        detail: 'Complete your profile to specify target locations' 
      });
    }

    // Profitability fit (based on buyer type)
    maxScore += 20;
    const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
    
    if (user.buyer_type === 'privateEquity') {
      if (ebitdaMargin >= 15) {
        score += 20;
        criteria.push({ 
          name: 'Profitability', 
          status: 'match', 
          detail: 'Strong margins for PE investment' 
        });
      } else if (ebitdaMargin >= 10) {
        score += 15;
        criteria.push({ 
          name: 'Profitability', 
          status: 'partial', 
          detail: 'Moderate margins' 
        });
      } else {
        score += 5;
        criteria.push({ 
          name: 'Profitability', 
          status: 'mismatch', 
          detail: 'Low margins for PE model' 
        });
      }
    } else {
      if (ebitda > 0) {
        score += 20;
        criteria.push({ 
          name: 'Profitability', 
          status: 'match', 
          detail: 'Positive cash flow' 
        });
      } else {
        score += 10;
        criteria.push({ 
          name: 'Profitability', 
          status: 'partial', 
          detail: 'Growth-focused business' 
        });
      }
    }

    // Investment size fit
    maxScore += 10;
    const estimatedValue = ebitda * 5; // Rough 5x multiple
    const userInvestmentSize = user.investment_size || '';
    
    if (userInvestmentSize && estimatedValue > 0) {
      // Simple heuristic based on common investment size ranges
      const sizeRanges = {
        'Under $1M': [0, 1000000],
        '$1M - $5M': [1000000, 5000000],
        '$5M - $10M': [5000000, 10000000],
        '$10M - $25M': [10000000, 25000000],
        'Over $25M': [25000000, Number.MAX_SAFE_INTEGER]
      };
      
      const range = sizeRanges[userInvestmentSize as keyof typeof sizeRanges];
      if (range && estimatedValue >= range[0] && estimatedValue <= range[1]) {
        score += 10;
        criteria.push({ 
          name: 'Investment Size', 
          status: 'match', 
          detail: 'Fits your investment range' 
        });
      } else {
        score += 5;
        criteria.push({ 
          name: 'Investment Size', 
          status: 'partial', 
          detail: 'Different size than typical range' 
        });
      }
    } else {
      score += 7;
      criteria.push({ 
        name: 'Investment Size', 
        status: 'partial', 
        detail: 'Investment size not specified' 
      });
    }

    return { 
      score: Math.round((score / maxScore) * 100), 
      criteria 
    };
  };

  // Helper function to check regional proximity
  const checkRegionalProximity = (location1: string, location2: string): boolean => {
    const proximityGroups = [
      ['Northeast US', 'Southeast US'],
      ['West Coast US', 'Southwest US', 'Mountain West US'],
      ['Midwest US', 'Northeast US'],
      ['Eastern Canada', 'Western Canada'],
      ['Western Europe', 'Eastern Europe', 'United Kingdom'],
      ['Asia Pacific', 'Australia/New Zealand']
    ];
    
    return proximityGroups.some(group => 
      group.includes(location1) && group.includes(location2)
    );
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
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match': return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'partial': return <AlertCircle className="h-3 w-3 text-yellow-600" />;
      case 'mismatch': return <XCircle className="h-3 w-3 text-red-600" />;
      default: return null;
    }
  };

  return (
    <Card className="border-sourceco-form bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-4 border-b border-sourceco-form/50">
        <CardTitle className="text-lg font-semibold text-sourceco-text flex items-center gap-3 tracking-tight">
          <div className="p-2 bg-sourceco-accent/10 rounded-lg">
            <Target className="h-5 w-5 text-sourceco-accent" />
          </div>
          Investment Fit Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Personalized compatibility based on your investment criteria
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Overall Score */}
        <div className="text-center space-y-4">
          <div className="relative">
            <div className={`text-4xl font-bold ${getScoreColor(score)} tracking-tight`}>
              {score}%
            </div>
            <div className="text-sm text-muted-foreground font-medium mt-1">Investment Fit Score</div>
          </div>
          <div className="space-y-2">
            <Progress value={score} className="h-3 bg-sourceco-background" />
            <div className="text-xs text-muted-foreground">
              Based on your investment preferences
            </div>
          </div>
        </div>

        {/* Criteria Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-sourceco-text">Detailed Analysis</h4>
          <div className="space-y-3">
            {criteria.map((criterion, index) => (
              <div key={index} className="flex items-start justify-between p-3 bg-sourceco-background/50 rounded-lg border border-sourceco-form/50">
                <div className="flex items-center gap-3">
                  {getStatusIcon(criterion.status)}
                  <span className="text-sm font-medium text-slate-700">{criterion.name}</span>
                </div>
                <span className="text-sm text-muted-foreground text-right max-w-[60%]">{criterion.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Completion Guidance */}
        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border border-blue-200/50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Profile Completeness</span>
            </div>
            <span className="text-sm font-bold text-blue-600">{profileCompleteness}%</span>
          </div>
          
          <Progress value={profileCompleteness} className="h-2 mb-3" />
          
          <div className="text-xs text-blue-700 mb-3">
            {profileCompleteness >= 80 
              ? "Your profile is comprehensive! This analysis is based on your detailed investment preferences."
              : "Complete your investment profile for more accurate fit analysis. Missing preferences are treated as flexible criteria."
            }
          </div>
          
          {profileCompleteness < 80 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-blue-800">Enhance your analysis by adding:</div>
              <div className="grid gap-1 text-xs text-blue-700">
                {!user?.revenue_range_min && <span>• Target revenue range</span>}
                {(!user?.business_categories || user.business_categories.length === 0) && <span>• Industry preferences</span>}
                {!user?.target_locations && <span>• Geographic focus areas</span>}
                {!user?.investment_size && <span>• Investment size preferences</span>}
                {!user?.ideal_target_description && <span>• Investment criteria description</span>}
              </div>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.href = '/profile'}
            className="mt-3 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Settings className="h-3 w-3 mr-1" />
            Update Investment Profile
          </Button>
        </div>

        {score >= 80 && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="text-xs font-medium text-green-800 mb-1">Strong Fit</div>
            <div className="text-xs text-green-700">
              This opportunity aligns well with your investment criteria and preferences.
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-sourceco-form space-y-1">
          <div>This score is calculated dynamically based on your profile preferences vs. this listing's characteristics</div>
          <div className="text-sourceco-accent font-medium">
            Analysis updates automatically when you modify your investment criteria
          </div>
        </div>
      </CardContent>
    </Card>
  );
};