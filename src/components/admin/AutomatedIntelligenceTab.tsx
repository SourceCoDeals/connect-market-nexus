import { useAutomatedIntelligence } from '@/hooks/use-automated-intelligence';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  Workflow, 
  Brain,
  DollarSign,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  PauseCircle
} from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function AutomatedIntelligenceTab() {
  const { data, isLoading } = useAutomatedIntelligence(30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  const { 
    automatedWorkflows = [], 
    businessPredictions = [], 
    personalizedRecommendations = [], 
    marketOpportunities = [] 
  } = data || {};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused': return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Automated Intelligence</h2>
          <p className="text-muted-foreground">AI-powered automation and business intelligence</p>
        </div>
      </div>

      <Tabs defaultValue="workflows" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workflows">Smart Workflows</TabsTrigger>
          <TabsTrigger value="predictions">Business Predictions</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
          <TabsTrigger value="opportunities">Market Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-6">
          <div className="grid gap-6">
            {automatedWorkflows.map((workflow) => (
              <Card key={workflow.workflow_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Workflow className="h-5 w-5" />
                      {workflow.workflow_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(workflow.status)}
                      <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                        {workflow.status}
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Trigger: {workflow.trigger_condition} | 
                    Target Users: {workflow.target_users} | 
                    Success Rate: {workflow.success_rate}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Success Rate:</span>
                        <div className="mt-1">
                          <Progress value={workflow.success_rate} className="w-full" />
                          <span className="text-xs text-muted-foreground">{workflow.success_rate}%</span>
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Avg Response Time:</span>
                        <div className="text-lg font-semibold">{workflow.avg_response_time}h</div>
                      </div>
                      <div>
                        <span className="font-medium">Next Execution:</span>
                        <div className="text-sm">{workflow.next_execution}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">Workflow Actions</h4>
                      <div className="space-y-2">
                        {workflow.actions.map((action, index) => (
                          <div key={action.action_id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                                {index + 1}
                              </div>
                              <div>
                                <div className="font-medium">{action.description}</div>
                                <div className="text-sm text-muted-foreground">
                                  {action.action_type} • {action.timing}
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline">{action.success_rate}%</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <div className="grid gap-6">
            {businessPredictions.map((prediction, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    {prediction.prediction_type.replace('_', ' ').toUpperCase()} Prediction
                  </CardTitle>
                  <CardDescription>
                    {prediction.timeframe.replace('_', ' ')} forecast with {prediction.confidence_level}% confidence
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">
                          {prediction.prediction_type === 'revenue' ? 
                            `$${prediction.predicted_value.toLocaleString()}` :
                            prediction.predicted_value.toLocaleString()
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Predicted {prediction.prediction_type.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <Progress value={prediction.confidence_level} className="w-24 mb-1" />
                        <div className="text-xs text-muted-foreground">{prediction.confidence_level}% confidence</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Key Factors</h4>
                        <ul className="text-sm space-y-1">
                          {prediction.key_factors.map((factor, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <TrendingUp className="h-3 w-3 text-green-500" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Recommended Actions</h4>
                        <ul className="text-sm space-y-1">
                          {prediction.recommended_actions.map((action, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <Target className="h-3 w-3 text-blue-500" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Risk Factors</h4>
                        <ul className="text-sm space-y-1">
                          {prediction.risk_factors.map((risk, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                              {risk}
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

        <TabsContent value="recommendations" className="space-y-6">
          <div className="grid gap-4">
            {personalizedRecommendations.map((rec) => (
              <Card key={rec.user_id + rec.recommendation_type}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {rec.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityColor(rec.priority)}>{rec.priority}</Badge>
                      <Badge variant="outline">{rec.success_probability}% success</Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    User: {rec.user_name} | Type: {rec.recommendation_type.replace('_', ' ')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm">{rec.description}</p>
                    
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Expected Outcome:</span>
                        <div className="text-muted-foreground">{rec.expected_outcome}</div>
                      </div>
                      <div>
                        <span className="font-medium">Action Required:</span>
                        <div className="text-muted-foreground">{rec.action_required}</div>
                      </div>
                      <div>
                        <span className="font-medium">Deadline:</span>
                        <div className="text-muted-foreground">
                          {new Date(rec.deadline).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Progress value={rec.success_probability} className="flex-1 mr-4" />
                      <Button size="sm" variant="outline">
                        Take Action
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid gap-6">
            {marketOpportunities.map((opportunity) => (
              <Card key={opportunity.opportunity_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {opportunity.opportunity_type === 'geographic' && <MapPin className="h-5 w-5" />}
                      {opportunity.opportunity_type === 'category' && <TrendingUp className="h-5 w-5" />}
                      {opportunity.opportunity_type === 'pricing' && <DollarSign className="h-5 w-5" />}
                      {opportunity.opportunity_type === 'partnership' && <Target className="h-5 w-5" />}
                      {opportunity.title}
                    </span>
                    <Badge variant="secondary">{opportunity.opportunity_type}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Revenue Potential: ${opportunity.potential_revenue.toLocaleString()} | 
                    Success Probability: {opportunity.success_probability}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm">{opportunity.description}</p>
                    
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Effort Required:</span>
                        <div className={getEffortColor(opportunity.effort_required)}>
                          {opportunity.effort_required.toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Time to Implement:</span>
                        <div className="text-muted-foreground">{opportunity.time_to_implement}</div>
                      </div>
                      <div>
                        <span className="font-medium">Success Probability:</span>
                        <div className="text-muted-foreground">{opportunity.success_probability}%</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Required Resources</h4>
                        <ul className="text-sm space-y-1">
                          {opportunity.required_resources.map((resource, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {resource}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Next Steps</h4>
                        <ul className="text-sm space-y-1">
                          {opportunity.next_steps.map((step, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-semibold text-green-600">
                          ${opportunity.potential_revenue.toLocaleString()}
                        </div>
                        <Progress value={opportunity.success_probability} className="w-32" />
                      </div>
                      <Button size="sm">
                        Start Implementation
                      </Button>
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