import { usePredictiveUserIntelligence } from '@/hooks/use-predictive-user-intelligence';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, TrendingUp, Target, AlertTriangle, Users, Zap } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function PredictiveIntelligenceTab() {
  const { data, isLoading } = usePredictiveUserIntelligence(30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  const { userScores = [], behaviorPatterns = [], engagementStrategies = [] } = data || {};

  const getEngagementBadgeVariant = (level: string) => {
    switch (level) {
      case 'power_user': return 'default';
      case 'serious_buyer': return 'secondary';
      case 'browser': return 'outline';
      case 'inactive': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Predictive Intelligence</h2>
          <p className="text-muted-foreground">AI-powered user insights and engagement strategies</p>
        </div>
      </div>

      <Tabs defaultValue="user-scores" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="user-scores">User Intelligence</TabsTrigger>
          <TabsTrigger value="behavior-patterns">Behavior Patterns</TabsTrigger>
          <TabsTrigger value="engagement-strategies">Engagement Strategies</TabsTrigger>
        </TabsList>

        <TabsContent value="user-scores" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">High Conversion Probability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userScores.filter(u => u.conversion_probability >= 70).length}
                </div>
                <p className="text-xs text-muted-foreground">Users likely to convert</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">High Churn Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {userScores.filter(u => u.churn_risk >= 70).length}
                </div>
                <p className="text-xs text-muted-foreground">Users needing immediate attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Power Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {userScores.filter(u => u.engagement_level === 'power_user').length}
                </div>
                <p className="text-xs text-muted-foreground">Highly engaged users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Avg LTV Prediction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${Math.round(userScores.reduce((sum, u) => sum + u.lifetime_value_prediction, 0) / userScores.length || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Predicted lifetime value</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Top Priority Users
              </CardTitle>
              <CardDescription>Users requiring immediate attention based on AI analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userScores.slice(0, 10).map(user => (
                  <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{user.user_name}</h4>
                        <Badge variant={getEngagementBadgeVariant(user.engagement_level)}>
                          {user.engagement_level.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline">{user.buyer_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{user.next_action_recommendation}</p>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Conversion: </span>
                          <span className={getPriorityColor(user.conversion_probability)}>{user.conversion_probability}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Churn Risk: </span>
                          <span className={getPriorityColor(100 - user.churn_risk)}>{user.churn_risk}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">LTV: </span>
                          <span>${user.lifetime_value_prediction.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">{user.optimal_contact_time}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.days_since_last_activity} days since activity
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior-patterns" className="space-y-6">
          <div className="grid gap-6">
            {behaviorPatterns.map((pattern, index) => (
              <Card key={pattern.pattern_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      {pattern.pattern_name}
                    </span>
                    <Badge variant="outline">{pattern.user_count} users</Badge>
                  </CardTitle>
                  <CardDescription>
                    Conversion Rate: {pattern.conversion_rate.toFixed(1)}% | 
                    Avg Time to Convert: {pattern.avg_time_to_convert.toFixed(0)} days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Typical Journey
                      </h4>
                      <div className="space-y-2">
                        {pattern.typical_journey.map((step, stepIndex) => (
                          <div key={stepIndex} className="flex items-center gap-2 text-sm">
                            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                              {stepIndex + 1}
                            </div>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Success Indicators</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {pattern.success_indicators.map((indicator, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              {indicator}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Intervention Opportunities</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {pattern.intervention_opportunities.map((opportunity, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {opportunity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="engagement-strategies" className="space-y-6">
          <div className="grid gap-6">
            {engagementStrategies.map((strategy, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {strategy.strategy_name}
                    </span>
                    <Badge variant="secondary">{strategy.user_segment.replace('_', ' ')}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Expected Response Rate: {strategy.expected_response_rate}% | 
                    Channel: {strategy.channel} | 
                    Timing: {strategy.optimal_timing}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Strategy Details</h4>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Content Type:</span>
                          <Badge variant="outline" className="ml-2">
                            {strategy.content_type}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium">Channel:</span>
                          <Badge variant="outline" className="ml-2">
                            {strategy.channel}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium">Response Rate:</span>
                          <span className="ml-2">{strategy.expected_response_rate}%</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Message Template</h4>
                      <div className="p-3 bg-muted rounded-lg text-sm italic">
                        "{strategy.message_template}"
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${strategy.expected_response_rate}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}