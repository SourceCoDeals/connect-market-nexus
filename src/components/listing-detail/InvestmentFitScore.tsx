import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Target, CheckCircle, AlertCircle, XCircle, Settings, Share2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const navigate = useNavigate();
  
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
            <p className="text-xs text-sourceco-text/60 mb-3">
              Sign in to see how this investment matches your criteria
            </p>
            <Button 
              onClick={() => navigate('/login')} 
              size="sm"
              className="text-xs"
            >
              Sign In
            </Button>
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

    // Geographic fit
    maxScore += 20;
    const userLocations = user.target_locations || '';
    if (userLocations && userLocations.includes(location)) {
      score += 20;
      criteria.push({ 
        name: 'Geography', 
        status: 'match', 
        detail: 'Matches your target location' 
      });
    } else if (userLocations) {
      score += 8;
      criteria.push({ 
        name: 'Geography', 
        status: 'mismatch', 
        detail: 'Outside your target locations' 
      });
    } else {
      score += 15;
      criteria.push({ 
        name: 'Geography', 
        status: 'partial', 
        detail: 'No location preference set' 
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

  const { score, criteria } = calculateFitScore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-sourceco-accent';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match': return <CheckCircle className="h-3 w-3 text-sourceco-accent" />;
      case 'partial': return <AlertCircle className="h-3 w-3 text-yellow-600" />;
      case 'mismatch': return <XCircle className="h-3 w-3 text-red-600" />;
      default: return null;
    }
  };

  const handleUpdateProfile = () => {
    navigate('/profile');
  };

  const handleShareFitAnalysis = () => {
    const shareText = `Investment Fit Analysis:\n\n` +
      `Overall Fit Score: ${score}%\n\n` +
      `Criteria Breakdown:\n${criteria.map(c => `• ${c.name}: ${c.detail}`).join('\n')}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Investment Fit Analysis',
        text: shareText
      }).catch(() => {
        navigator.clipboard.writeText(shareText);
        toast.success('Fit analysis copied to clipboard');
      });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Fit analysis copied to clipboard');
    }
  };

  // Check if user has incomplete profile data
  const hasIncompleteProfile = !user.revenue_range_min || !user.business_categories?.length || !user.target_locations;

  return (
    <Card className="border-sourceco-form bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-sourceco-text flex items-center gap-2">
            <Target className="h-4 w-4" />
            Investment Fit Analysis
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleShareFitAnalysis}
              className="h-7 px-2 text-xs"
            >
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleUpdateProfile}
              className="h-7 px-2 text-xs"
            >
              <Settings className="h-3 w-3 mr-1" />
              Update
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile Completeness Warning */}
        {hasIncompleteProfile && (
          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <div className="text-xs font-medium text-yellow-800 mb-1">Improve Your Fit Score</div>
            <div className="text-xs text-yellow-700">
              Complete your investment preferences in your profile for more accurate fit analysis.
            </div>
          </div>
        )}

        {/* Overall Score */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
            {score}%
          </div>
          <div className="text-xs text-sourceco-text/60 mb-2">Investment Fit Score</div>
          <div className="text-xs text-sourceco-text/50 mb-2">
            Based on your profile vs. this opportunity
          </div>
          <Progress value={score} className="h-2" />
        </div>

        {/* Criteria Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-sourceco-text">Fit Criteria</h4>
          {criteria.map((criterion, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(criterion.status)}
                <span className="text-xs font-medium text-sourceco-text">{criterion.name}</span>
              </div>
              <span className="text-xs text-sourceco-text/60">{criterion.detail}</span>
            </div>
          ))}
        </div>

        {score >= 80 && (
          <div className="bg-sourceco-accent/10 p-3 rounded-lg border border-sourceco-accent/20">
            <div className="text-xs font-medium text-sourceco-accent mb-1">Strong Fit</div>
            <div className="text-xs text-sourceco-text/70">
              This opportunity aligns well with your investment criteria and preferences.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};