import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Deal } from '@/hooks/admin/use-deals';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useUpdateDeal } from '@/hooks/admin/use-deals';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Calendar, Clock, TrendingUp, User, Building, MapPin } from 'lucide-react';

interface DealOverviewTabProps {
  deal: Deal;
}

export function DealOverviewTab({ deal }: DealOverviewTabProps) {
  const updateDeal = useUpdateDeal();
  const { data: adminProfiles } = useAdminProfiles([deal.assigned_to]);

  const handleOwnerChange = (adminId: string) => {
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { assigned_to: adminId }
    });
  };

  const getStageColor = (stageName: string) => {
    switch (stageName?.toLowerCase()) {
      case 'qualified':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'proposal':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'negotiation':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'closed won':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'closed lost':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Deal Summary */}
      <Card className="border-0 shadow-sm bg-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            Deal Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Stage</p>
              <Badge className={`${getStageColor(deal.stage_name)} text-sm`}>
                {deal.stage_name}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Priority</p>
              <Badge className={`${getPriorityColor(deal.deal_priority)} text-sm`}>
                {deal.deal_priority || 'Medium'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Expected Close</p>
              <p className="text-sm font-semibold text-gray-900">
                {deal.deal_expected_close_date ? formatDate(deal.deal_expected_close_date) : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Days in Stage</p>
              <p className="text-sm font-semibold text-gray-900">
                {Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deal Owner */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600" />
            Deal Owner
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Assigned To</p>
              <p className="text-lg font-semibold text-gray-900">
                {deal.assigned_to && adminProfiles?.[deal.assigned_to] 
                  ? adminProfiles[deal.assigned_to].displayName 
                  : 'Unassigned'
                }
              </p>
            </div>
            <Select onValueChange={handleOwnerChange} value={deal.assigned_to || ''}>
              <SelectTrigger className="w-48 border-gray-200">
                <SelectValue placeholder="Assign owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {/* We'll populate this with admin users */}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building className="h-5 w-5 text-gray-600" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Contact Name</p>
              <p className="text-lg font-semibold text-gray-900">{deal.contact_name || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Company</p>
              <p className="text-lg font-semibold text-gray-900">{deal.contact_company || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
              <p className="text-lg font-semibold text-gray-900">{deal.contact_email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
              <p className="text-lg font-semibold text-gray-900">{deal.contact_phone || 'Not provided'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Deal Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(deal.deal_value || 0)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Probability</p>
              <p className="text-2xl font-bold text-gray-900">{deal.deal_probability}%</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Pending Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{deal.pending_tasks || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Activities</p>
              <p className="text-2xl font-bold text-gray-900">{deal.activity_count || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {deal.deal_description && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">Description</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {deal.deal_description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}