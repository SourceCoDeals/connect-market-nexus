import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useDeals, useDealStages } from '@/hooks/admin/use-deals';
import { 
  Zap, 
  Plus, 
  Settings, 
  Mail, 
  MessageSquare, 
  Calendar,
  CheckCircle,
  AlertTriangle,
  Users,
  FileText
} from 'lucide-react';

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  stage_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  auto_assign: boolean;
  due_days: number;
  template: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger_stage: string;
  target_stage: string;
  conditions: Record<string, any>;
  actions: string[];
  is_active: boolean;
}

const defaultTaskTemplates: TaskTemplate[] = [
  {
    id: '1',
    name: 'Send NDA',
    description: 'Send NDA agreement to the prospect',
    stage_id: 'nda-sent',
    priority: 'high',
    auto_assign: true,
    due_days: 1,
    template: 'Please find attached the NDA for review and signature.'
  },
  {
    id: '2',
    name: 'Follow up on NDA',
    description: 'Follow up if NDA not signed within 7 days',
    stage_id: 'nda-sent',
    priority: 'medium',
    auto_assign: true,
    due_days: 7,
    template: 'Following up on the NDA sent earlier. Please let us know if you have any questions.'
  },
  {
    id: '3',
    name: 'Send Fee Agreement',
    description: 'Send fee agreement once NDA is signed',
    stage_id: 'fee-agreement-sent',
    priority: 'high',
    auto_assign: true,
    due_days: 1,
    template: 'Thank you for signing the NDA. Please find the fee agreement attached.'
  },
  {
    id: '4',
    name: 'Schedule Discovery Call',
    description: 'Schedule initial discovery call with prospect',
    stage_id: 'qualified',
    priority: 'high',
    auto_assign: true,
    due_days: 2,
    template: 'Schedule a discovery call to understand requirements better.'
  },
  {
    id: '5',
    name: 'Prepare Due Diligence Materials',
    description: 'Prepare and organize due diligence documents',
    stage_id: 'due-diligence',
    priority: 'medium',
    auto_assign: false,
    due_days: 3,
    template: 'Organize all due diligence materials for prospect review.'
  }
];

const defaultAutomationRules: AutomationRule[] = [
  {
    id: '1',
    name: 'Auto-advance after NDA signed',
    trigger_stage: 'nda-sent',
    target_stage: 'nda-signed',
    conditions: { nda_status: 'signed' },
    actions: ['move_stage', 'create_task'],
    is_active: true
  },
  {
    id: '2',
    name: 'Auto-advance after Fee Agreement signed',
    trigger_stage: 'fee-agreement-sent',
    target_stage: 'fee-agreement-signed',
    conditions: { fee_agreement_status: 'signed' },
    actions: ['move_stage', 'send_notification'],
    is_active: true
  },
  {
    id: '3',
    name: 'Create follow-up task for stuck deals',
    trigger_stage: 'any',
    target_stage: 'same',
    conditions: { days_in_stage: 14 },
    actions: ['create_task', 'notify_admin'],
    is_active: true
  }
];

export function WorkflowAutomation() {
  const { data: stages = [] } = useDealStages();
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>(defaultTaskTemplates);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(defaultAutomationRules);
  const [activeTab, setActiveTab] = useState<'templates' | 'rules' | 'history'>('templates');
  
  const [newTemplate, setNewTemplate] = useState<Partial<TaskTemplate>>({
    name: '',
    description: '',
    stage_id: '',
    priority: 'medium',
    auto_assign: true,
    due_days: 1,
    template: ''
  });

  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: '',
    trigger_stage: '',
    target_stage: '',
    conditions: {},
    actions: [],
    is_active: true
  });

  const handleCreateTaskTemplate = () => {
    if (!newTemplate.name || !newTemplate.stage_id) return;
    
    const template: TaskTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name,
      description: newTemplate.description || '',
      stage_id: newTemplate.stage_id,
      priority: newTemplate.priority || 'medium',
      auto_assign: newTemplate.auto_assign || false,
      due_days: newTemplate.due_days || 1,
      template: newTemplate.template || ''
    };
    
    setTaskTemplates(prev => [...prev, template]);
    setNewTemplate({
      name: '',
      description: '',
      stage_id: '',
      priority: 'medium',
      auto_assign: true,
      due_days: 1,
      template: ''
    });
  };

  const handleCreateAutomationRule = () => {
    if (!newRule.name || !newRule.trigger_stage) return;
    
    const rule: AutomationRule = {
      id: Date.now().toString(),
      name: newRule.name,
      trigger_stage: newRule.trigger_stage,
      target_stage: newRule.target_stage || 'same',
      conditions: newRule.conditions || {},
      actions: newRule.actions || [],
      is_active: newRule.is_active !== false
    };
    
    setAutomationRules(prev => [...prev, rule]);
    setNewRule({
      name: '',
      trigger_stage: '',
      target_stage: '',
      conditions: {},
      actions: [],
      is_active: true
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive';
      case 'high': return 'bg-warning';
      case 'medium': return 'bg-secondary';
      case 'low': return 'bg-muted';
      default: return 'bg-secondary';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'move_stage': return <Zap className="h-4 w-4" />;
      case 'create_task': return <FileText className="h-4 w-4" />;
      case 'send_notification': return <Mail className="h-4 w-4" />;
      case 'notify_admin': return <Users className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Automation</h2>
          <p className="text-muted-foreground">
            Configure automated tasks and stage progression rules
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-2 px-1 ${activeTab === 'templates' ? 'border-b-2 border-primary' : ''}`}
        >
          Task Templates
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-2 px-1 ${activeTab === 'rules' ? 'border-b-2 border-primary' : ''}`}
        >
          Automation Rules
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2 px-1 ${activeTab === 'history' ? 'border-b-2 border-primary' : ''}`}
        >
          Execution History
        </button>
      </div>

      {/* Task Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Create New Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Task Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Send NDA"
                  />
                </div>
                <div>
                  <Label htmlFor="template-stage">Stage</Label>
                  <Select 
                    value={newTemplate.stage_id} 
                    onValueChange={(value) => setNewTemplate(prev => ({ ...prev, stage_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the task"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="template-priority">Priority</Label>
                  <Select 
                    value={newTemplate.priority} 
                    onValueChange={(value: any) => setNewTemplate(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="template-due-days">Due in (days)</Label>
                  <Input
                    id="template-due-days"
                    type="number"
                    value={newTemplate.due_days}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, due_days: parseInt(e.target.value) }))}
                    min="1"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    checked={newTemplate.auto_assign}
                    onCheckedChange={(checked) => setNewTemplate(prev => ({ ...prev, auto_assign: checked }))}
                  />
                  <Label>Auto-assign</Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="template-content">Task Template</Label>
                <Textarea
                  id="template-content"
                  value={newTemplate.template}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, template: e.target.value }))}
                  placeholder="Default task description or email template"
                  rows={3}
                />
              </div>
              
              <Button onClick={handleCreateTaskTemplate} disabled={!newTemplate.name || !newTemplate.stage_id}>
                Create Template
              </Button>
            </CardContent>
          </Card>

          {/* Existing Templates */}
          <div className="space-y-4">
            {taskTemplates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{template.name}</h4>
                        <Badge className={getPriorityColor(template.priority)}>
                          {template.priority}
                        </Badge>
                        {template.auto_assign && (
                          <Badge variant="outline">Auto-assign</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Stage: {stages.find(s => s.id === template.stage_id)?.name}</span>
                        <span>Due in: {template.due_days} days</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Automation Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Create New Rule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Create Automation Rule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Auto-advance after NDA signed"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rule-trigger">Trigger Stage</Label>
                  <Select 
                    value={newRule.trigger_stage} 
                    onValueChange={(value) => setNewRule(prev => ({ ...prev, trigger_stage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Stage</SelectItem>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rule-target">Target Stage</Label>
                  <Select 
                    value={newRule.target_stage} 
                    onValueChange={(value) => setNewRule(prev => ({ ...prev, target_stage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same">Same Stage</SelectItem>
                      <SelectItem value="next">Next Stage</SelectItem>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newRule.is_active}
                  onCheckedChange={(checked) => setNewRule(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Active</Label>
              </div>
              
              <Button onClick={handleCreateAutomationRule} disabled={!newRule.name || !newRule.trigger_stage}>
                Create Rule
              </Button>
            </CardContent>
          </Card>

          {/* Existing Rules */}
          <div className="space-y-4">
            {automationRules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{rule.name}</h4>
                        {rule.is_active ? (
                          <Badge className="bg-success text-success-foreground">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Trigger: {stages.find(s => s.id === rule.trigger_stage)?.name || rule.trigger_stage}
                        {rule.target_stage !== 'same' && ` → ${stages.find(s => s.id === rule.target_stage)?.name || rule.target_stage}`}
                      </div>
                      <div className="flex items-center gap-2">
                        {rule.actions.map((action, index) => (
                          <Badge key={index} variant="outline" className="flex items-center gap-1">
                            {getActionIcon(action)}
                            {action.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => {
                          setAutomationRules(prev => 
                            prev.map(r => r.id === rule.id ? { ...r, is_active: checked } : r)
                          );
                        }}
                      />
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Execution History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Automation Execution History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No automation executions yet.</p>
              <p className="text-sm">When rules are triggered, execution logs will appear here.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
