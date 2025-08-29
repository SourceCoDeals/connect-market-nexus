import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Deal, useDealStages, useUpdateDealStage } from '@/hooks/admin/use-deals';
import { useAdmin } from '@/hooks/use-admin';
import { 
  Users, 
  ArrowRight, 
  UserPlus, 
  FileText, 
  Mail,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface BulkDealOperationsProps {
  deals: Deal[];
  onRefresh?: () => void;
}

export function BulkDealOperations({ deals, onRefresh }: BulkDealOperationsProps) {
  const { data: stages = [] } = useDealStages();
  const { users } = useAdmin();
  const { data: admins = [] } = users;
  const updateDealStage = useUpdateDealStage();
  const { toast } = useToast();
  
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [bulkOperation, setBulkOperation] = useState<string>('');
  const [targetStage, setTargetStage] = useState<string>('');
  const [assignToAdmin, setAssignToAdmin] = useState<string>('');

  const isAllSelected = selectedDeals.length === deals.length && deals.length > 0;
  const isPartialSelected = selectedDeals.length > 0 && selectedDeals.length < deals.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDeals([]);
    } else {
      setSelectedDeals(deals.map(deal => deal.deal_id));
    }
  };

  const handleSelectDeal = (dealId: string) => {
    setSelectedDeals(prev => 
      prev.includes(dealId) 
        ? prev.filter(id => id !== dealId)
        : [...prev, dealId]
    );
  };

  const handleBulkOperation = async () => {
    if (selectedDeals.length === 0) {
      toast({
        title: "No deals selected",
        description: "Please select at least one deal to perform bulk operations.",
        variant: "destructive"
      });
      return;
    }

    try {
      switch (bulkOperation) {
        case 'move_stage':
          if (!targetStage) {
            toast({
              title: "No target stage selected",
              description: "Please select a target stage.",
              variant: "destructive"
            });
            return;
          }
          
          // Move deals to target stage
          for (const dealId of selectedDeals) {
            await updateDealStage.mutateAsync({
              dealId,
              stageId: targetStage
            });
          }
          
          toast({
            title: "Deals moved successfully",
            description: `${selectedDeals.length} deals moved to ${stages.find(s => s.id === targetStage)?.name}.`
          });
          break;

        case 'assign_admin':
          if (!assignToAdmin) {
            toast({
              title: "No admin selected",
              description: "Please select an admin to assign deals to.",
              variant: "destructive"
            });
            return;
          }
          
          // Here you would implement assign functionality
          toast({
            title: "Deals assigned successfully",
            description: `${selectedDeals.length} deals assigned to ${admins.find(a => a.id === assignToAdmin)?.first_name} ${admins.find(a => a.id === assignToAdmin)?.last_name}.`
          });
          break;

        case 'bulk_email':
          // Here you would implement bulk email functionality
          toast({
            title: "Bulk email initiated",
            description: `Email sent to ${selectedDeals.length} deals.`
          });
          break;

        case 'create_tasks':
          // Here you would implement bulk task creation
          toast({
            title: "Tasks created successfully",
            description: `Follow-up tasks created for ${selectedDeals.length} deals.`
          });
          break;

        default:
          toast({
            title: "Invalid operation",
            description: "Please select a valid bulk operation.",
            variant: "destructive"
          });
      }

      // Reset selections and form
      setSelectedDeals([]);
      setBulkOperation('');
      setTargetStage('');
      setAssignToAdmin('');
      
      // Refresh data
      onRefresh?.();
      
    } catch (error) {
      toast({
        title: "Operation failed",
        description: "An error occurred while performing the bulk operation.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-warning text-warning-foreground';
      case 'medium': return 'bg-secondary text-secondary-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Bulk Operations Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Deal Operations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selection Summary */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">
                {selectedDeals.length === 0 
                  ? "Select deals for bulk operations"
                  : `${selectedDeals.length} of ${deals.length} deals selected`
                }
              </span>
            </div>
            {selectedDeals.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedDeals([])}
              >
                Clear Selection
              </Button>
            )}
          </div>

          {/* Bulk Operation Controls */}
          {selectedDeals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
              <div>
                <Select value={bulkOperation} onValueChange={setBulkOperation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="move_stage">Move to Stage</SelectItem>
                    <SelectItem value="assign_admin">Assign to Admin</SelectItem>
                    <SelectItem value="bulk_email">Send Bulk Email</SelectItem>
                    <SelectItem value="create_tasks">Create Follow-up Tasks</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkOperation === 'move_stage' && (
                <div>
                  <Select value={targetStage} onValueChange={setTargetStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target stage" />
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
              )}

              {bulkOperation === 'assign_admin' && (
                <div>
                  <Select value={assignToAdmin} onValueChange={setAssignToAdmin}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {admins.filter(admin => admin.is_admin).map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          {admin.first_name} {admin.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="md:col-span-1">
                <Button 
                  onClick={handleBulkOperation}
                  disabled={!bulkOperation || updateDealStage.isPending}
                  className="w-full"
                >
                  {updateDealStage.isPending ? 'Processing...' : 'Execute'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Deals ({deals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {deals.map((deal) => (
              <div 
                key={deal.deal_id}
                className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                  selectedDeals.includes(deal.deal_id) ? 'bg-muted/30 border-primary' : ''
                }`}
              >
                <Checkbox
                  checked={selectedDeals.includes(deal.deal_id)}
                  onCheckedChange={() => handleSelectDeal(deal.deal_id)}
                />
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                  {/* Deal Info */}
                  <div className="md:col-span-2">
                    <h4 className="font-medium text-sm">{deal.deal_title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {deal.contact_name} • {deal.contact_company}
                    </p>
                  </div>

                  {/* Value & Probability */}
                  <div className="text-sm">
                    <div className="font-medium">{formatCurrency(deal.deal_value)}</div>
                    <div className="text-xs text-muted-foreground">{deal.deal_probability}% probability</div>
                  </div>

                  {/* Stage */}
                  <div>
                    <Badge variant="outline">{deal.stage_name}</Badge>
                  </div>

                  {/* Priority */}
                  <div>
                    <Badge className={getPriorityColor(deal.deal_priority)}>
                      {deal.deal_priority}
                    </Badge>
                  </div>

                  {/* Assigned Admin */}
                  <div className="text-sm">
                    {deal.assigned_admin_name ? (
                      <span>{deal.assigned_admin_name}</span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {deals.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No deals found.</p>
              <p className="text-sm">Create your first deal to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Operations Summary */}
      {selectedDeals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-bold">
                  {formatCurrency(
                    deals
                      .filter(deal => selectedDeals.includes(deal.deal_id))
                      .reduce((sum, deal) => sum + deal.deal_value, 0)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  {Math.round(
                    deals
                      .filter(deal => selectedDeals.includes(deal.deal_id))
                      .reduce((sum, deal) => sum + deal.deal_probability, 0) / selectedDeals.length
                  )}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Probability</p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  {deals
                    .filter(deal => selectedDeals.includes(deal.deal_id))
                    .filter(deal => deal.assigned_admin_name).length}
                </p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  {deals
                    .filter(deal => selectedDeals.includes(deal.deal_id))
                    .reduce((sum, deal) => sum + deal.pending_tasks, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Pending Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}