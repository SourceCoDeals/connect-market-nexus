import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  TrendingUp, 
  Users, 
  Shield, 
  MapPin,
  Briefcase,
  PieChart,
  Target,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DueDiligenceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  notes: string;
}

interface DueDiligenceTrackerProps {
  listingId: string;
  listingTitle: string;
}

const initialItems: DueDiligenceItem[] = [
  // Financial Analysis
  {
    id: 'financial-1',
    title: 'Historical Financial Performance',
    description: 'Review 3-5 years of financial statements and tax returns',
    category: 'Financial',
    priority: 'high',
    completed: false,
    notes: ''
  },
  {
    id: 'financial-2',
    title: 'Revenue Quality & Sustainability',
    description: 'Analyze customer concentration, contract terms, and recurring revenue',
    category: 'Financial',
    priority: 'high',
    completed: false,
    notes: ''
  },
  {
    id: 'financial-3',
    title: 'Working Capital Analysis',
    description: 'Examine cash conversion cycle, inventory turnover, and receivables',
    category: 'Financial',
    priority: 'medium',
    completed: false,
    notes: ''
  },
  {
    id: 'financial-4',
    title: 'Capital Expenditure Requirements',
    description: 'Assess ongoing CapEx needs and deferred maintenance',
    category: 'Financial',
    priority: 'medium',
    completed: false,
    notes: ''
  },

  // Operational
  {
    id: 'operational-1',
    title: 'Management Team Assessment',
    description: 'Evaluate key personnel, succession planning, and retention',
    category: 'Operational',
    priority: 'high',
    completed: false,
    notes: ''
  },
  {
    id: 'operational-2',
    title: 'Systems & Technology',
    description: 'Review IT infrastructure, software systems, and tech debt',
    category: 'Operational',
    priority: 'medium',
    completed: false,
    notes: ''
  },
  {
    id: 'operational-3',
    title: 'Supply Chain & Vendors',
    description: 'Analyze supplier relationships, dependencies, and contract terms',
    category: 'Operational',
    priority: 'medium',
    completed: false,
    notes: ''
  },
  {
    id: 'operational-4',
    title: 'Operational Efficiency',
    description: 'Identify improvement opportunities and cost optimization',
    category: 'Operational',
    priority: 'low',
    completed: false,
    notes: ''
  },

  // Market & Commercial
  {
    id: 'market-1',
    title: 'Market Size & Growth',
    description: 'Validate addressable market and growth projections',
    category: 'Market',
    priority: 'high',
    completed: false,
    notes: ''
  },
  {
    id: 'market-2',
    title: 'Competitive Positioning',
    description: 'Assess competitive advantages and market share',
    category: 'Market',
    priority: 'high',
    completed: false,
    notes: ''
  },
  {
    id: 'market-3',
    title: 'Customer Analysis',
    description: 'Review customer satisfaction, retention, and acquisition costs',
    category: 'Market',
    priority: 'medium',
    completed: false,
    notes: ''
  },

  // Legal & Compliance
  {
    id: 'legal-1',
    title: 'Corporate Structure & Governance',
    description: 'Review organizational structure, bylaws, and board composition',
    category: 'Legal',
    priority: 'high',
    completed: false,
    notes: ''
  },
  {
    id: 'legal-2',
    title: 'Material Contracts',
    description: 'Analyze key customer, supplier, and partnership agreements',
    category: 'Legal',
    priority: 'high',
    completed: false,
    notes: ''
  },
  {
    id: 'legal-3',
    title: 'Intellectual Property',
    description: 'Verify IP ownership, patents, trademarks, and protection',
    category: 'Legal',
    priority: 'medium',
    completed: false,
    notes: ''
  },
  {
    id: 'legal-4',
    title: 'Regulatory Compliance',
    description: 'Ensure compliance with industry regulations and standards',
    category: 'Legal',
    priority: 'high',
    completed: false,
    notes: ''
  },

  // Strategic
  {
    id: 'strategic-1',
    title: 'Growth Strategy Validation',
    description: 'Assess feasibility of projected growth plans and initiatives',
    category: 'Strategic',
    priority: 'medium',
    completed: false,
    notes: ''
  },
  {
    id: 'strategic-2',
    title: 'Integration Planning',
    description: 'Develop post-acquisition integration roadmap',
    category: 'Strategic',
    priority: 'low',
    completed: false,
    notes: ''
  }
];

const categoryConfig = {
  Financial: { icon: TrendingUp, color: 'text-sourceco-accent', bg: 'bg-sourceco-accent/10' },
  Operational: { icon: Users, color: 'text-info', bg: 'bg-info/10' },
  Market: { icon: Target, color: 'text-success', bg: 'bg-success/10' },
  Legal: { icon: Shield, color: 'text-warning', bg: 'bg-warning/10' },
  Strategic: { icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-100' }
};

export const DueDiligenceTracker: React.FC<DueDiligenceTrackerProps> = ({
  listingId,
  listingTitle
}) => {
  const [items, setItems] = useState<DueDiligenceItem[]>(initialItems);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Financial', 'Market']);

  // Load saved progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`dd-tracker-${listingId}`);
    if (saved) {
      try {
        const savedItems = JSON.parse(saved);
        setItems(savedItems);
      } catch (error) {
        console.error('Error loading due diligence progress:', error);
      }
    }
  }, [listingId]);

  // Save progress to localStorage
  const saveProgress = (updatedItems: DueDiligenceItem[]) => {
    localStorage.setItem(`dd-tracker-${listingId}`, JSON.stringify(updatedItems));
    setItems(updatedItems);
  };

  const toggleItem = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    saveProgress(updatedItems);
  };

  const updateNotes = (itemId: string, notes: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, notes } : item
    );
    saveProgress(updatedItems);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getProgress = () => {
    const total = items.length;
    const completed = items.filter(item => item.completed).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    return { completed, total, percentage };
  };

  const getCategoryProgress = (category: string) => {
    const categoryItems = items.filter(item => item.category === category);
    const completed = categoryItems.filter(item => item.completed).length;
    const total = categoryItems.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    return { completed, total, percentage };
  };

  const getPriorityBadge = (priority: string) => {
    const config = {
      high: { className: 'bg-destructive/10 text-destructive border-destructive/30', label: 'High' },
      medium: { className: 'bg-warning/10 text-warning border-warning/30', label: 'Medium' },
      low: { className: 'bg-muted text-muted-foreground border-muted-foreground/30', label: 'Low' }
    };
    return config[priority as keyof typeof config] || config.low;
  };

  const progress = getProgress();
  const categories = [...new Set(items.map(item => item.category))];

  return (
    <Card className="border-sourceco-form">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Due Diligence Tracker
        </CardTitle>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Track your review progress for {listingTitle}
          </p>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span>Overall Progress</span>
              <span className="font-medium">{progress.completed} of {progress.total} completed</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map(category => {
          const categoryItems = items.filter(item => item.category === category);
          const categoryProgress = getCategoryProgress(category);
          const isExpanded = expandedCategories.includes(category);
          const config = categoryConfig[category as keyof typeof categoryConfig];

          return (
            <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto border border-sourceco-form hover:bg-sourceco-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${config.bg}`}>
                      <config.icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">{category}</div>
                      <div className="text-xs text-muted-foreground">
                        {categoryProgress.completed} of {categoryProgress.total} items
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${categoryProgress.percentage === 100 ? 'border-success/30 text-success bg-success/10' : 'border-muted-foreground/30'}`}
                    >
                      {Math.round(categoryProgress.percentage)}%
                    </Badge>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-3 pt-3">
                {categoryItems.map(item => {
                  const priorityBadge = getPriorityBadge(item.priority);
                  
                  return (
                    <div key={item.id} className="p-3 bg-sourceco-muted/30 rounded-lg space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={item.id}
                          checked={item.completed}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <label 
                                htmlFor={item.id} 
                                className={`text-sm font-medium cursor-pointer ${
                                  item.completed ? 'line-through text-muted-foreground' : ''
                                }`}
                              >
                                {item.title}
                              </label>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {item.description}
                              </p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${priorityBadge.className}`}
                            >
                              {priorityBadge.label}
                            </Badge>
                          </div>
                          
                          <Textarea
                            placeholder="Add notes, findings, or action items..."
                            value={item.notes}
                            onChange={(e) => updateNotes(item.id, e.target.value)}
                            className="text-xs min-h-[60px] resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Quick Stats */}
        <div className="pt-4 border-t border-sourceco-form">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-destructive">
                {items.filter(i => i.priority === 'high' && !i.completed).length}
              </div>
              <div className="text-xs text-muted-foreground">High Priority Remaining</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-sourceco-accent">
                {items.filter(i => i.notes.length > 0).length}
              </div>
              <div className="text-xs text-muted-foreground">Items with Notes</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-success">
                {Math.round(progress.percentage)}%
              </div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs border-sourceco-accent text-sourceco-accent hover:bg-sourceco-accent hover:text-white"
          >
            <FileText className="h-3 w-3 mr-2" />
            Export Report
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs border-sourceco-accent text-sourceco-accent hover:bg-sourceco-accent hover:text-white"
          >
            <PieChart className="h-3 w-3 mr-2" />
            Summary Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};